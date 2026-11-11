import { NextResponse, type NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// GET の中の fetch（Supabase への問い合わせ）を Next.js にキャッシュさせない（申請の件数・状態・翻訳の可否が古くならないように）
export const fetchCache = 'force-no-store';

// ============================================================
// 退会・データ削除の申請（運営者が確認して削除する。自動では削除しない）
//  GET  … 自分の申請の状態（受付中の申請があるか・受付日時）
//  POST { note } … 申請する（受付中の申請があれば、新しく作らずにそれを返す）
//
// ・本人確認：ブラウザが渡すアクセストークン（Bearer）を Supabase に確かめる。
//   書き込みは「その人のトークン」で行い、RLS（本人の行だけ）を通す。service_role は使わない。
// ・保存先：account_deletion_requests（supabase/proposal_account_deletion_requests.sql。未適用）。
//   まだテーブルがない本番では、既存の feedback に kind='account_deletion' で記録する（従来どおり）。
// ・運営者への通知：ADMIN_NOTIFY_WEBHOOK_URL（Slack・Discord などの受信 URL）があれば、
//   「申請が 1 件あります」とだけ送る（名前・メールなどの個人情報は送らない）。
// ============================================================

const hits = new Map<string, number[]>();
function rateLimited(key: string, limit = 5, windowMs = 60_000): boolean {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) hits.clear();
  return list.length > limit;
}

async function asUser(req: NextRequest): Promise<{ client: SupabaseClient; userId: string } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!url || !anon || !token) return null;
  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` }, fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return { client, userId: data.user.id };
}

/** テーブルがまだない（提案の SQL を適用していない）ときのエラー */
const missingTable = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /account_deletion_requests/.test(e.message ?? ''));

type Pending = { pending: boolean; requestedAt?: string; via?: 'table' | 'feedback' };

async function findPending(client: SupabaseClient, userId: string): Promise<Pending | 'no_table'> {
  const { data, error } = await client.from('account_deletion_requests')
    .select('id,requested_at,status').eq('user_id', userId).in('status', ['received', 'in_progress']).limit(1);
  if (missingTable(error)) return 'no_table';
  const row = (data as Array<{ requested_at: string }> | null)?.[0];
  return row ? { pending: true, requestedAt: row.requested_at, via: 'table' } : { pending: false };
}
async function findPendingFeedback(client: SupabaseClient, userId: string): Promise<Pending> {
  const { data } = await client.from('feedback').select('id,created_at,status').eq('user_id', userId).eq('kind', 'account_deletion').eq('status', 'new').limit(1);
  const row = (data as Array<{ created_at: string }> | null)?.[0];
  return row ? { pending: true, requestedAt: row.created_at, via: 'feedback' } : { pending: false };
}

async function notifyAdmin() {
  const hook = process.env.ADMIN_NOTIFY_WEBHOOK_URL;
  if (!hook) return;
  const text = '[Miri] 退会・データ削除の申請が 1 件あります。Supabase の account_deletion_requests（または feedback の kind=account_deletion）を確認してください。';
  try {
    await fetch(hook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, content: text }), signal: AbortSignal.timeout(5000) });
  } catch {
    // 通知に失敗しても申請は記録されている（運営者は一覧を定期的に確認する）
  }
}

export async function GET(req: NextRequest) {
  const me = await asUser(req);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const p = await findPending(me.client, me.userId);
  return NextResponse.json(p === 'no_table' ? await findPendingFeedback(me.client, me.userId) : p, { headers: { 'cache-control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const me = await asUser(req);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (rateLimited(me.userId)) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  let body: { note?: unknown } = {};
  try { body = await req.json(); } catch {}
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : '';

  const { data: prof } = await me.client.from('profiles').select('username').eq('id', me.userId).maybeSingle();
  const username = (prof as { username?: string } | null)?.username ?? '';

  // 受付中の申請があれば、二重に作らない
  const existing = await findPending(me.client, me.userId);
  if (existing !== 'no_table') {
    if (existing.pending) return NextResponse.json({ ok: true, ...existing });
    const { data, error } = await me.client.from('account_deletion_requests')
      .insert({ user_id: me.userId, username, note }).select('requested_at').single();
    if (error) {
      // 同時に 2 回押した（受付中は 1 人 1 件の制約）→ 既存の申請を返す
      const again = await findPending(me.client, me.userId);
      if (again !== 'no_table' && again.pending) return NextResponse.json({ ok: true, ...again });
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    await notifyAdmin();
    return NextResponse.json({ ok: true, pending: true, requestedAt: (data as { requested_at: string }).requested_at, via: 'table' });
  }

  // テーブルがまだない本番：既存の feedback に記録する（RLS：本人の行だけ書ける）
  const fb = await findPendingFeedback(me.client, me.userId);
  if (fb.pending) return NextResponse.json({ ok: true, ...fb });
  const { error } = await me.client.from('feedback').insert({ user_id: me.userId, username, kind: 'account_deletion', body: `[退会・データ削除の申請] ${note}`.slice(0, 2000) });
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  await notifyAdmin();
  return NextResponse.json({ ok: true, pending: true, requestedAt: new Date().toISOString(), via: 'feedback' });
}
