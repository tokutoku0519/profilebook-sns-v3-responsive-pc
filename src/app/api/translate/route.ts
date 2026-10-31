import { NextResponse, type NextRequest } from 'next/server';
import type { Lang } from '@/lib/i18n';
import { parseTranslateItem, TRANSLATION_LANGS, type TranslateItem } from '@/lib/translation/shared';
import { getRuntime, translateMany, userIdFromToken } from '@/lib/translation/server/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 自由回答の翻訳 API（Phase B）
//  GET  /api/translate?owner=<username> … 使えるか・その人が翻訳を許可しているか（ボタンを出すかどうか）
//  POST { action: 'translate', target, items } … 翻訳（ログイン必須。文章は受け取らない。原文はサーバーが DB から読む）
//  POST { action: 'get_consent' | 'set_consent', allow? } … 自分のプロフ帳・回答の翻訳を許可するか（ログイン必須）
// 1 つの関数にまとめているのは、プレビューのメモリ保存（許可・翻訳・予算）を同じインスタンスで共有するため。

const MAX_ITEMS = 40;
const hits = new Map<string, number[]>();
function rateLimited(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) hits.clear();
  return list.length > limit;
}

export async function GET(req: NextRequest) {
  const rt = getRuntime();
  const owner = (req.nextUrl.searchParams.get('owner') ?? '').replace(/^@/, '');
  const body: Record<string, unknown> = { enabled: rt.cfg.enabled, mock: rt.cfg.enabled && rt.engine.id === 'mock' };
  if (rt.cfg.enabled && rt.store && /^[A-Za-z0-9_.-]{1,40}$/.test(owner)) body.ownerAllows = await rt.store.ownerAllows(owner);
  // 使用状況は本番以外でだけ返す（本番は SQL Editor の translation_budget で見る）
  if (rt.cfg.enabled && rt.store && !rt.cfg.isProduction && req.nextUrl.searchParams.get('usage') === '1') body.usage = await rt.store.usage();
  return NextResponse.json(body, { headers: { 'cache-control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const rt = getRuntime();
  if (!rt.cfg.enabled || !rt.store) return NextResponse.json({ error: 'disabled' }, { status: 503 });

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'local';
  // 同じ回線（学校・家庭）を複数人で使うことを考え、IP は 1 分 120 回、1 人は 1 分 30 回まで
  if (rateLimited(`ip:${ip}`, 120)) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  const auth = req.headers.get('authorization') ?? '';
  const userId = await userIdFromToken(auth.startsWith('Bearer ') ? auth.slice(7) : '');
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (rateLimited(`user:${userId}`, 30)) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {}

  if (body.action === 'get_consent') return NextResponse.json({ allow: await rt.store.getConsent(userId) });
  if (body.action === 'set_consent') {
    if (typeof body.allow !== 'boolean') return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    await rt.store.setConsent(userId, body.allow);
    return NextResponse.json({ allow: body.allow });
  }
  if (body.action !== 'translate') return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const target = body.target as Lang;
  if (!TRANSLATION_LANGS.includes(target)) return NextResponse.json({ error: 'bad_target' }, { status: 400 });
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > MAX_ITEMS) return NextResponse.json({ error: 'bad_items' }, { status: 400 });
  // 決まった形（種類・ユーザー名・場所／回答ID）だけを取り出す。文章などほかの値は使わない
  const items = body.items.map(parseTranslateItem).filter((x): x is TranslateItem => !!x);
  if (!items.length) return NextResponse.json({ error: 'bad_items' }, { status: 400 });

  const results = await translateMany(rt, userId, target, items);
  return NextResponse.json({ results, mock: rt.engine.id === 'mock' }, { headers: { 'cache-control': 'no-store' } });
}
