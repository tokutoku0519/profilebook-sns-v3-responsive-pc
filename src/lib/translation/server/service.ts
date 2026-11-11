// ============================================================
// 翻訳の流れ（サーバー専用）
//   権限の確認 → 翻訳済みを返す → 目印を取る → API を呼ばない判定 → 個人情報のチェック → 米国の指定の確認
//   → [予算の確保 → 送信の記録（送信中）→ 送信 → 応答の地域・ワークスペースを照合 → 記録に結果を書く → 精算]
//   （やり直しは 429・529 のときだけ 1 回）
//   → 検証・伏せ字を戻す → 保存 → もう一度確認して返す
// どこで止まっても、画面は原文を表示する（status: 'original'）。
// ============================================================
import { createClient } from '@supabase/supabase-js';
import type { Lang } from '@/lib/i18n';
import { differsFromViewer, glossaryHits, itemKey, keepWithoutEngine, sourceLangOf, type KeptReason, type TranslateItem, type TranslateResult } from '../shared';
import { costUsd, estimateUsd, translationConfig, type TranslationConfig } from './config';
import { engineFor, validateResult, type EngineOutput, type TranslationEngine } from './engines';
import { DbStore, MemoryStore, type TranslationStore } from './store';
import { restoreMasked, screenPersonalInfo } from './pii';

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
  const keptResult = (reason?: KeptReason | null): TranslateResult => (reason === 'personal' ? { key, status: 'kept', reason: 'personal' } : { key, status: 'kept' });

  // 1. 翻訳済み（返す前に権限と原文の一致を確かめる）
  const cached = await store.getCached(it, target);
  if (cached === 'unavailable') return original;
  if (cached) return cached.status === 'kept' ? keptResult(cached.keptReason) : { key, status: 'done', text: cached.text };

  // 2. 翻訳中の目印。取れなければ、ほかで翻訳中（少し待って取り直す）。同じ文・同じ言語を同時に二重に送らない
  const claim = await store.claim(it, target, rt.engine.id);
  if (!claim.claimed) return claim.reason === 'busy' ? { key, status: 'pending' } : original;
  const src = claim.source;

  // 3. API を呼ばずに決める：表示言語と同じ言語・記号だけ・用語集の「残す語」と完全一致
  if (!differsFromViewer(src.text, target) || keepWithoutEngine(src.text)) {
    const reason: KeptReason = differsFromViewer(src.text, target) ? 'no_engine' : 'same_lang';
    await store.save(it, target, src.hash, { status: 'kept', keptTerms: [], usage: null, costUsd: 0, keptReason: reason });
    return keptResult(reason);
  }

  // 4. 個人情報のチェック：連絡先・住所・要配慮の内容を含む文は送らない。URL・@ID は伏せ字にして送る
  const body = screenPersonalInfo(src.text);
  const ctx = src.context ? screenPersonalInfo(src.context) : null;
  if (!body.ok || (ctx && !ctx.ok)) {
    await store.save(it, target, src.hash, { status: 'kept', keptTerms: [], usage: null, costUsd: 0, keptReason: 'personal' });
    return keptResult('personal');
  }

  // 5. 米国の指定がなければ送らない（設定の誤りに備えた確認。API の呼び出しはしない）
  //    ワークスペースの制限（allowed_inference_geos = ["us"]）は運営者が 1 回確認し、毎回の応答で地域とワークスペースを照合する
  if (rt.cfg.inferenceGeo !== 'us') { await store.release(it, target, src.hash); return original; }

  // 6. 送る（やり直しは接続エラー・429・529 のときだけ 1 回。1 回ごとに予算の確保と送信の記録をしてから送る）
  const input = { text: body.text, context: ctx?.text, source: sourceLangOf(src.text) ?? 'ja', target, glossary: glossaryHits(body.text) } as const;
  let out: EngineOutput | null = null;
  let cost = 0;
  for (let attempt = 1; attempt <= rt.cfg.maxAttempts; attempt++) {
    const est = estimateUsd(rt.cfg, [...body.text].length + [...(ctx?.text ?? '')].length);
    const rsv = await store.reserve(viewerId, src.ownerId, est);
    if (rsv.result !== 'ok' || !rsv.id) break;
    // 送信の記録（送信中）。許可が取り消されていた・止まっていたら作られない → 送らない
    const pid = await store.beginProvision({ ownerId: src.ownerId, item: it, lang: target, requestedGeo: rt.cfg.inferenceGeo, model: rt.engine.id, attempt });
    if (!pid) { await store.settle(rsv.id, ZERO_USAGE); break; }
    out = await rt.engine.translate(input);
    // エンジンが何を返しても、応答に書かれた地域が us でなければ「地域の不一致」として扱う（二重の確認）
    if (out.transport === 'response' && out.inferenceGeo !== rt.cfg.inferenceGeo) {
      out = { ok: false, error: 'geo_mismatch', usage: out.usage, transport: 'response', inferenceGeo: out.inferenceGeo ?? null, workspaceId: out.workspaceId, requestId: out.requestId, latencyMs: out.latencyMs };
    }
    // 応答が翻訳専用ワークスペース以外から返ってきた → キー・ワークスペースの取り違え。
    //  成功した応答はワークスペースの ID が必ず一致すること。エラーの応答は、別のワークスペースの ID が書かれているときだけ
    //  （無効なキーの 401 などはワークスペースの ID が付かないことがあり、それは取り違えではないので止めない）
    const wsWrong = !!rt.cfg.workspaceId && (
      (out.transport === 'response' && out.workspaceId !== rt.cfg.workspaceId) ||
      (out.transport === 'error_response' && out.workspaceId != null && out.workspaceId !== rt.cfg.workspaceId));
    if (wsWrong) {
      out = { ok: false, error: 'workspace_mismatch', usage: out.usage, transport: out.transport, inferenceGeo: out.inferenceGeo ?? null, workspaceId: out.workspaceId, requestId: out.requestId, latencyMs: out.latencyMs };
    }
    // 送った事実は消さない。結果（応答あり・地域やワークスペースの不一致・エラー・届いたか不明）を書く
    const mismatch = !out.ok && (out.error === 'geo_mismatch' || out.error === 'workspace_mismatch');
    await store.finishProvision(pid, {
      outcome: mismatch ? (out as { error: string }).error as 'geo_mismatch' | 'workspace_mismatch'
        : out.transport === 'unknown' ? 'unknown' : out.transport === 'error_response' ? 'error_response' : 'completed',
      reportedGeo: out.inferenceGeo ?? null, requestId: out.requestId, errorCode: out.ok ? undefined : out.error,
      workspaceId: out.workspaceId ?? null, latencyMs: out.latencyMs,
    });
    // 精算（実際の使用量から）。使用量が分からないときは精算せず、15 分後に見込み額で確定させる
    if (out.usage) cost += (await store.settle(rsv.id, out.usage)) ?? costUsd(rt.cfg, out.usage);
    // 米国・翻訳専用ワークスペースで処理されたと確認できない → 結果は使わず、新しい翻訳を止める（運営者が確認してから再開）
    if (mismatch) {
      await store.halt(`${(out as { error: string }).error}:${out.inferenceGeo ?? 'none'}:${out.workspaceId ?? 'none'}`);
      out = null; break;
    }
    if (out.ok || !out.retryable) break;
  }
  if (!out) { await store.release(it, target, src.hash); return original; }

  // 7. 検証して伏せ字を戻し、保存（保存の瞬間にも許可・原文・公開範囲を確かめる。取り消し後は保存しない）
  let checked = out.ok ? validateResult(body.text, out) : { status: 'failed' as const, keptTerms: [] as string[], text: undefined as string | undefined };
  if (checked.status === 'done') {
    const restored = restoreMasked(checked.text ?? '', body.tokens);
    checked = restored == null ? { status: 'failed', keptTerms: [], text: undefined } : { ...checked, text: restored };
  }
  const saved = await store.save(it, target, src.hash, {
    status: checked.status, text: checked.text, keptTerms: checked.keptTerms, usage: out.usage, costUsd: cost,
    keptReason: checked.status === 'kept' ? 'model' : undefined,
  });
  if (!saved || checked.status === 'failed') return original;

  // 8. 返す前にもう一度（翻訳中に非公開・許可の取り消し・編集があれば返さない）
  const again = await store.getCached(it, target);
  if (!again || again === 'unavailable') return original;
  return again.status === 'kept' ? keptResult(again.keptReason) : { key, status: 'done', text: again.text };
}

const ZERO_USAGE = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

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
