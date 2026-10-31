// ============================================================
// 翻訳の流れ（サーバー専用）
//   権限の確認 → 翻訳済みを返す → 目印を取る → API を呼ばない判定 → 予算の確保 → 翻訳 → 精算 → 検証 → 保存 → もう一度確認して返す
// どこで止まっても、画面は原文を表示する（status: 'original'）。
// ============================================================
import { createClient } from '@supabase/supabase-js';
import type { Lang } from '@/lib/i18n';
import { differsFromViewer, glossaryHits, itemKey, keepWithoutEngine, sourceLangOf, type TranslateItem, type TranslateResult } from '../shared';
import { costUsd, estimateUsd, translationConfig, type TranslationConfig } from './config';
import { engineFor, validateResult, type TranslationEngine } from './engines';
import { DbStore, MemoryStore, type TranslationStore } from './store';

export type Runtime = { cfg: TranslationConfig; store: TranslationStore | null; engine: TranslationEngine };

// 1 つのサーバー（関数のインスタンス）の中で使い回す。メモリ保存はここに残る
let runtime: Runtime | null = null;
export function getRuntime(): Runtime {
  if (runtime) return runtime;
  const cfg = translationConfig();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  let store: TranslationStore | null = null;
  if (cfg.enabled) {
    store = cfg.store === 'db'
      ? new DbStore(createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', { auth: { persistSession: false, autoRefreshToken: false } }), cfg)
      : new MemoryStore(cfg, url, anon);
  }
  runtime = { cfg, store, engine: engineFor(cfg) };
  return runtime;
}

/** アクセストークンからログイン中のユーザーを確かめる（Supabase に問い合わせる） */
export async function userIdFromToken(token: string): Promise<string | null> {
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  return error ? null : data.user?.id ?? null;
}

export async function translateOne(rt: Runtime, viewerId: string, target: Lang, it: TranslateItem): Promise<TranslateResult> {
  const key = itemKey(it);
  const original: TranslateResult = { key, status: 'original' };
  const store = rt.store;
  if (!store) return original;

  // 1. 翻訳済み（返す前に権限と原文の一致を確かめる）
  const cached = await store.getCached(it, target);
  if (cached === 'unavailable') return original;
  if (cached) return { key, status: cached.status, text: cached.text };

  // 2. 翻訳中の目印。取れなければ、ほかで翻訳中（少し待って取り直す）
  const claim = await store.claim(it, target, rt.engine.id);
  if (!claim.claimed) return claim.reason === 'busy' ? { key, status: 'pending' } : original;
  const src = claim.source;

  // 3. API を呼ばずに決める：表示言語と同じ言語・記号だけ・用語集の「残す語」と完全一致
  if (!differsFromViewer(src.text, target) || keepWithoutEngine(src.text)) {
    await store.save(it, target, src.hash, { status: 'kept', keptTerms: [], usage: null, costUsd: 0 });
    return { key, status: 'kept' };
  }

  // 4. 予算の確保（上限・1 人あたり・1 原文あたりの回数）
  const est = estimateUsd(rt.cfg, [...src.text].length + [...(src.context ?? '')].length);
  const rsv = await store.reserve(viewerId, src.ownerId, est);
  if (rsv.result !== 'ok' || !rsv.id) { await store.release(it, target, src.hash); return original; }

  // 5. 翻訳
  const out = await rt.engine.translate({ text: src.text, context: src.context, source: sourceLangOf(src.text) ?? 'ja', target, glossary: glossaryHits(src.text) });

  // 6. 精算（実際の使用量から）。使用量が分からないときは精算せず、15 分後に見込み額で確定させる
  let cost = 0;
  if (out.usage) cost = (await store.settle(rsv.id, out.usage)) ?? costUsd(rt.cfg, out.usage);

  // 7. 検証して保存（保存の瞬間にも原文と権限を確かめる）
  const checked = out.ok ? validateResult(src.text, out) : { status: 'failed' as const, keptTerms: [] };
  const saved = await store.save(it, target, src.hash, { status: checked.status, text: checked.text, keptTerms: checked.keptTerms, usage: out.usage, costUsd: cost });
  if (!saved || checked.status === 'failed') return original;

  // 8. 返す前にもう一度（翻訳中に非公開・許可の取り消し・編集があれば返さない）
  const again = await store.getCached(it, target);
  if (!again || again === 'unavailable') return original;
  return { key, status: again.status, text: again.text };
}

/** 同時に動かす数を絞って順に処理する */
export async function translateMany(rt: Runtime, viewerId: string, target: Lang, items: TranslateItem[], concurrency = 4): Promise<TranslateResult[]> {
  const results: TranslateResult[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      try { results[i] = await translateOne(rt, viewerId, target, items[i]); }
      catch { results[i] = { key: itemKey(items[i]), status: 'original' }; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}
