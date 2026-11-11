import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// GET の中の fetch（Supabase への問い合わせ）を Next.js にキャッシュさせない（申請の件数・状態・翻訳の可否が古くならないように）
export const fetchCache = 'force-no-store';

// ============================================================
// 退会・データ削除の申請の「見落とし防止」：受付中の申請の件数を、毎日 1 回、運営者に知らせる
//  ・Vercel Cron が呼ぶ（vercel.json。本番のデプロイでだけ動く）。CRON_SECRET で呼び出し元を確かめる
//  ・ADMIN_NOTIFY_WEBHOOK_URL・CRON_SECRET・SUPABASE_SERVICE_ROLE_KEY がそろわなければ何もしない
//  ・送るのは件数だけ（名前・ID・申請の内容は送らない）。受付中が 0 件なら送らない
//  ・申請のときの通知（/api/account-deletion）とは別の経路なので、どちらかが失敗しても気づける
// ============================================================

const OVERDUE_DAYS = 7;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const hook = process.env.ADMIN_NOTIFY_WEBHOOK_URL;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!hook || !url || !key) return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 503 });

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) } });
  const overdueBefore = new Date(Date.now() - OVERDUE_DAYS * 86_400_000).toISOString();
  let open = 0, overdue = 0, source = 'account_deletion_requests';
  const t = await admin.from('account_deletion_requests').select('requested_at').in('status', ['received', 'in_progress']);
  if (t.error) {
    // テーブルを適用する前：feedback で受けた申請を数える
    source = 'feedback';
    const f = await admin.from('feedback').select('created_at').eq('kind', 'account_deletion').eq('status', 'new');
    if (f.error) return NextResponse.json({ ok: false, reason: 'query_failed' }, { status: 500 });
    const rows = (f.data as Array<{ created_at: string }>) ?? [];
    open = rows.length; overdue = rows.filter((r) => r.created_at < overdueBefore).length;
  } else {
    const rows = (t.data as Array<{ requested_at: string }>) ?? [];
    open = rows.length; overdue = rows.filter((r) => r.requested_at < overdueBefore).length;
  }
  if (open === 0) return NextResponse.json({ ok: true, open, overdue, notified: false });

  const text = `[Miri] 受付中の退会・データ削除の申請が ${open} 件あります（うち ${OVERDUE_DAYS} 日を過ぎたもの ${overdue} 件）。Supabase の ${source} を確認してください。`;
  try {
    await fetch(hook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, content: text }), signal: AbortSignal.timeout(5000) });
  } catch {
    return NextResponse.json({ ok: false, open, overdue, notified: false }, { status: 502 });
  }
  return NextResponse.json({ ok: true, open, overdue, notified: true });
}
