// ============================================================
// 自由回答の翻訳 — ブラウザ側の呼び出し
// 送るのは「種類・ユーザー名・項目の場所／回答ID」と翻訳先の言語だけ。文章は送らない。
// ============================================================
import type { Lang } from '@/lib/i18n';
import { getAccessToken } from '@/lib/db';
import type { ConsentCandidate, ConsentItem, ScopeMode, TranslateItem, TranslateResult } from './shared';
import type { ConsentLocale } from './consentText';

export type TranslateAvailability = { enabled: boolean; mock: boolean; ownerAllows?: boolean };

const statusCache = new Map<string, { at: number; p: Promise<TranslateAvailability> }>();
const OFF: TranslateAvailability = { enabled: false, mock: false };

/** 翻訳が使えるか・その人が翻訳を許可しているか（1 分だけ覚える） */
export function fetchTranslateAvailability(owner?: string): Promise<TranslateAvailability> {
  const key = owner ?? '';
  const hit = statusCache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.p;
  const p = fetch(`/api/translate${owner ? `?owner=${encodeURIComponent(owner)}` : ''}`, { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : OFF))
    .then((j) => ({ enabled: !!j.enabled, mock: !!j.mock, ownerAllows: j.ownerAllows === true }))
    .catch(() => OFF);
  statusCache.set(key, { at: Date.now(), p });
  return p;
}

async function post(body: Record<string, unknown>): Promise<Response | null> {
  const token = await getAccessToken().catch(() => null);
  if (!token) return null;
  try {
    return await fetch('/api/translate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch { return null; }
}

/** 翻訳を頼む。ほかで翻訳中（pending）の項目は少し待って取り直す。null：ログインしていない・通信できない */
export async function requestTranslations(target: Lang, items: TranslateItem[]): Promise<{ results: TranslateResult[]; mock: boolean } | null> {
  let res = await post({ action: 'translate', target, items });
  if (!res) return null;
  if (!res.ok) return { results: [], mock: false };
  let json = (await res.json()) as { results: TranslateResult[]; mock: boolean };
  for (let round = 0; round < 3 && json.results.some((r) => r.status === 'pending'); round++) {
    await new Promise((ok) => setTimeout(ok, 1500));
    const pendingKeys = new Set(json.results.filter((r) => r.status === 'pending').map((r) => r.key));
    const again = items.filter((it) => pendingKeys.has(it.kind === 'answer' ? `answer:${it.id}` : `profile:${it.owner}:${it.path}`));
    res = await post({ action: 'translate', target, items: again });
    if (!res?.ok) break;
    const next = (await res.json()) as { results: TranslateResult[] };
    const byKey = new Map(next.results.map((r) => [r.key, r]));
    json = { ...json, results: json.results.map((r) => byKey.get(r.key) ?? r) };
  }
  return json;
}

export type MyConsent = { allow: boolean; version: string | null; current: boolean; grantedAt: string | null; items: ConsentItem[]; scope: ScopeMode; currentVersion: string };

export async function getMyTranslationConsent(): Promise<MyConsent | null> {
  const res = await post({ action: 'get_consent' });
  if (!res?.ok) return null;
  return (await res.json()) as MyConsent;
}

/** 翻訳の対象に選べる、いま公開中の自分の項目・回答 */
export async function listConsentCandidates(): Promise<ConsentCandidate[] | null> {
  const res = await post({ action: 'list_candidates' });
  if (!res?.ok) return null;
  return ((await res.json()) as { candidates: ConsentCandidate[] }).candidates;
}

export type ConsentResult = { ok: boolean; reason?: string };
async function consentCall(body: Record<string, unknown>): Promise<ConsentResult> {
  const res = await post(body);
  if (!res) return { ok: false, reason: 'network' };
  const j = (await res.json().catch(() => ({}))) as ConsentResult;
  if (res.ok) statusCache.clear();
  return { ok: res.ok && j.ok !== false, reason: j.reason };
}
/** 説明を確認したうえでの許可（版・表示した言語・生まれた年月・選んだ項目を送る）。
 *  年齢はサーバーで計算し直す（ブラウザの判定だけでは許可されない）。生まれた年月はサーバーで保存しない */
export const grantTranslationConsent = (version: string, locale: ConsentLocale, birthYear: number, birthMonth: number, scope: ScopeMode, items: ConsentItem[]) =>
  consentCall({ action: 'grant_consent', version, locale, birthYear, birthMonth, scope, items: scope === 'all' ? [] : items });
export const setTranslationItems = (scope: ScopeMode, items: ConsentItem[]) => consentCall({ action: 'set_items', scope, items: scope === 'all' ? [] : items });
export const revokeTranslationConsent = () => consentCall({ action: 'revoke_consent' });
