import { NextResponse, type NextRequest } from 'next/server';
import type { Lang } from '@/lib/i18n';
import { parseConsentItem, parseScopeMode, parseTranslateItem, TRANSLATION_LANGS, type ConsentItem, type TranslateItem } from '@/lib/translation/shared';
import { CONSENT_VERSION } from '@/lib/translation/consentText';
import { getRuntime, translateMany, userIdFromToken } from '@/lib/translation/server/service';
import { screenPersonalInfo } from '@/lib/translation/server/pii';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// GET の中の fetch（Supabase への問い合わせ）を Next.js にキャッシュさせない（申請の件数・状態・翻訳の可否が古くならないように）
export const fetchCache = 'force-no-store';

// 自由回答の翻訳 API（Phase B）
//  GET  /api/translate?owner=<username> … 使えるか・その人が翻訳を許可しているか（ボタンを出すかどうか）
//  POST { action: 'translate', target, items } … 翻訳（ログイン必須。文章は受け取らない。原文はサーバーが DB から読む）
//  POST { action: 'get_consent' }                          … 自分の許可の状態（版・選んだ項目）
//  POST { action: 'list_candidates' }                      … 翻訳の対象に選べる、いま公開中の自分の項目・回答
//  POST { action: 'grant_consent', version, locale, birthYear, birthMonth, items } … 説明を確認して許可（直接オンにはできない）
//        年齢はサーバー（と SQL）で計算する。生まれた年月は保存しない。16 歳未満・不明は許可しない
//  POST { action: 'set_items', items }                     … 翻訳してよい項目を変える
//  POST { action: 'revoke_consent' }                       … 許可を取り消す（翻訳キャッシュは削除、法定の記録は残す）
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
  // 止まっている理由は本番以外でだけ返す（検証環境の設定の確認用。環境変数の名前だけで、値は含まない）
  if (!rt.cfg.enabled && !rt.cfg.isProduction) body.reason = rt.cfg.reason;
  if (rt.cfg.enabled && rt.store && /^[A-Za-z0-9_.-]{1,40}$/.test(owner)) body.ownerAllows = await rt.store.ownerAllows(owner);
  // 使用状況は本番以外でだけ返す（本番は SQL Editor の translation_budget で見る）
  if (rt.cfg.enabled && rt.store && !rt.cfg.isProduction && req.nextUrl.searchParams.get('usage') === '1') {
    body.usage = await rt.store.usage();
    body.records = await rt.store.recordCounts();
  }
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

  const parseItems = (raw: unknown): ConsentItem[] | null => {
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > 150) return null;
    const items = raw.map(parseConsentItem);
    return items.every((x): x is ConsentItem => !!x) ? items : null;
  };
  if (body.action === 'get_consent') return NextResponse.json({ ...(await rt.store.getConsent(userId)), currentVersion: CONSENT_VERSION });
  if (body.action === 'list_candidates') {
    // 本人向け：個人情報のチェックで送られない項目には理由を付ける（チェックに使った文はブラウザに返さない）
    const rows = await rt.store.candidates(userId);
    const candidates = rows.map(({ checkText, ...c }) => {
      const sc = checkText ? screenPersonalInfo(checkText) : null;
      return sc && !sc.ok ? { ...c, blocked: sc.reason } : c;
    });
    return NextResponse.json({ candidates });
  }
  if (body.action === 'grant_consent') {
    // scope：items（選んだ項目だけ）／all（公開中のすべて・今後のものを含む。項目は送らなくてよい）
    const scope = parseScopeMode(body.scope);
    const items = scope === 'all' ? [] : parseItems(body.items);
    const int = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) ? v : null);
    const birthYear = int(body.birthYear), birthMonth = int(body.birthMonth);
    if (!scope || !items || (body.locale !== 'ja' && body.locale !== 'en') || typeof body.version !== 'string') {
      return NextResponse.json({ ok: false, reason: 'bad_request' }, { status: 400 });
    }
    // 年齢が分からない（入力なし・形がおかしい）ときは許可しない
    if (birthYear == null || birthMonth == null) return NextResponse.json({ ok: false, reason: 'age_invalid' }, { status: 400 });
    const r = await rt.store.grantConsent(userId, { version: body.version, locale: body.locale, birthYear, birthMonth, scope, items });
    return NextResponse.json(r, { status: r.ok ? 200 : r.reason === 'age_invalid' ? 400 : 409 });
  }
  if (body.action === 'set_items') {
    const scope = parseScopeMode(body.scope);
    const items = scope === 'all' ? [] : parseItems(body.items);
    if (!scope || !items) return NextResponse.json({ ok: false, reason: 'bad_request' }, { status: 400 });
    const r = await rt.store.setConsentItems(userId, scope, items);
    return NextResponse.json(r, { status: r.ok ? 200 : 409 });
  }
  if (body.action === 'revoke_consent') {
    await rt.store.revokeConsent(userId);
    return NextResponse.json({ ok: true });
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
