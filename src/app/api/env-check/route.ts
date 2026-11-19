import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isPreviewDeploy, supabaseUrlOrNull } from '@/lib/dbGuard';
import { getRuntime } from '@/lib/translation/server/service';

// ============================================================
// プレビューが「どのデータベースにつながっているか」を確かめるページ（/api/env-check）
//
// ・本番（Production）では 404（何も返さない）
// ・秘密の値（キー）は返さない。返すのは、つながっている Supabase のホスト名・印の有無・設定の有無だけ
// ・判定：検証用の印（public._miri_environment に 'staging'）を service role で読めれば「検証用」。
//   本番の DB には印がないので、もし本番につながっていれば「危険」と表示される
// ============================================================
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  if (process.env.VERCEL_ENV === 'production') return new NextResponse('Not Found', { status: 404 });

  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  let host: string | null = null;
  try { host = raw ? new URL(raw).host : null; } catch { host = 'invalid'; }
  const url = supabaseUrlOrNull();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let stagingMarker: boolean | null = null;
  let markerError: string | null = null;
  if (url && serviceKey) {
    try {
      const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await admin.from('_miri_environment').select('name').eq('name', 'staging').maybeSingle();
      if (error) { stagingMarker = false; markerError = error.code || 'error'; }
      else stagingMarker = !!data;
    } catch { markerError = 'unreachable'; }
  }

  const connected = !!url;
  const verdict = !connected
    ? 'DB につながっていない（安全。検証用の 4 つの値が未設定か、NEXT_PUBLIC_DB_LABEL=staging がない）'
    : stagingMarker === true
      ? 'OK：検証用（miri-staging）につながっている'
      : stagingMarker === false
        ? '危険：検証用の印がない DB につながっている。すぐに環境変数を見直してください'
        : '確認できない：SUPABASE_SERVICE_ROLE_KEY がないか、DB に届かない';

  let translationEnabled: boolean | null = null;
  try { translationEnabled = getRuntime().cfg.enabled; } catch { translationEnabled = null; }

  return NextResponse.json({
    verdict,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    isPreview: isPreviewDeploy(),
    // ブラウザ側の安全装置が働くには、Vercel が NEXT_PUBLIC_VERCEL_ENV を公開している必要がある
    browserGuardActive: process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview',
    appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? null,
    dbLabel: process.env.NEXT_PUBLIC_DB_LABEL ?? null,
    supabaseHost: host,
    connected,
    serviceRoleKeySet: !!serviceKey,
    stagingMarker,
    markerError,
    translationEnabled,
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    commit: (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 7) || null,
  }, { headers: { 'cache-control': 'no-store' } });
}
