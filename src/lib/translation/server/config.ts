// ============================================================
// 翻訳 API の設定（サーバー専用。環境変数から読む）
//
// 安全側の既定：
//  ・本番（VERCEL_ENV=production）は、TRANSLATION_ENABLED=true を明示しない限り止まっている
//  ・本番では仮の翻訳（mock）は使わない
//  ・実際の翻訳（Claude Haiku 5.5）は TRANSLATION_ENGINE=anthropic と TRANSLATION_ALLOW_PAID=true の両方と
//    ANTHROPIC_API_KEY がそろったときだけ。さらに予算・同意・記録を DB で持つ（TRANSLATION_STORE=db）ときだけ
//  ・さらに、翻訳専用ワークスペースが米国だけに制限されていることを運営者が確かめた印（TRANSLATION_WORKSPACE_GEO=us）が必要
//    （Console の Workspace geo = US・allowed_inference_geos = ["us"]。scripts/translate-eval/check-workspace.mjs で確認）
//  ・プレビュー・手元では、何も設定しなくても「仮の翻訳＋メモリ保存」で動く（外部への送信なし）
// ============================================================

export type EngineName = 'mock' | 'anthropic';
export type StoreName = 'memory' | 'db';

export type TranslationConfig = {
  enabled: boolean;
  /** 止まっている理由（運営向け。画面には出さない） */
  reason: string;
  engine: EngineName;
  store: StoreName;
  isProduction: boolean;
  model: string;
  monthlyCapUsd: number;
  monthlyTargetUsd: number;
  userDailyLimit: number;
  ownerDailyLimit: number;
  maxEstimateUsd: number;
  /** Anthropic で推論する地域。外国の名称（アメリカ合衆国）を特定するため us に固定する（既定の global は国が決まらない） */
  inferenceGeo: 'us';
  /** 1 つの文で API を呼ぶ最大の回数（接続エラー・429・529 のときだけ 1 回やり直す。やり直しも送信として記録する） */
  maxAttempts: number;
  /** テスト用（仮の翻訳でだけ使う。本番では仮の翻訳は使わない）：応答の地域・失敗・事前確認の結果をまねる */
  mockFault: { geo?: string; fail?: 'timeout' | 'error' | 'overloaded_once'; preflight?: 'fail' };
  /** 料金（米ドル / 100 万トークン）。inference_geo=us の 1.1 倍を含めた額 */
  price: { input: number; output: number; cacheRead: number; cacheWrite: number };
};

/** 推論を米国内に限ると料金が 1.1 倍（Claude API Docs「Data residency」） */
export const US_GEO_MULTIPLIER = 1.1;

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return v !== undefined && v !== '' && Number.isFinite(n) && n >= 0 ? n : d;
};

export function translationConfig(env: NodeJS.ProcessEnv = process.env): TranslationConfig {
  const isProduction = env.VERCEL_ENV === 'production';
  const engine: EngineName = env.TRANSLATION_ENGINE === 'anthropic' ? 'anthropic' : 'mock';
  const store: StoreName = env.TRANSLATION_STORE === 'db' ? 'db' : 'memory';
  const base = {
    engine, store, isProduction,
    model: env.TRANSLATION_MODEL || 'claude-haiku-5-5',
    monthlyCapUsd: num(env.TRANSLATION_MONTHLY_CAP_USD, 10),
    monthlyTargetUsd: num(env.TRANSLATION_MONTHLY_TARGET_USD, 5),
    userDailyLimit: num(env.TRANSLATION_USER_DAILY_LIMIT, 30),
    ownerDailyLimit: num(env.TRANSLATION_OWNER_DAILY_LIMIT, 60),
    maxEstimateUsd: 0.002,
    inferenceGeo: 'us' as const,
    maxAttempts: 2,
    mockFault: isProduction ? {} : {
      geo: env.TRANSLATION_MOCK_GEO || undefined,
      fail: (['timeout', 'error', 'overloaded_once'] as const).find((x) => x === env.TRANSLATION_MOCK_FAIL),
      preflight: env.TRANSLATION_MOCK_PREFLIGHT === 'fail' ? 'fail' as const : undefined,
    },
    // Claude Haiku 5.5 の公式料金（2026-10 時点）× 米国内での推論（inference_geo: us）の 1.1 倍。変わったら環境変数で上書きする
    price: {
      input: num(env.TRANSLATION_PRICE_INPUT, 0.10 * US_GEO_MULTIPLIER),
      output: num(env.TRANSLATION_PRICE_OUTPUT, 0.50 * US_GEO_MULTIPLIER),
      cacheRead: num(env.TRANSLATION_PRICE_CACHE_READ, 0.01 * US_GEO_MULTIPLIER),
      cacheWrite: num(env.TRANSLATION_PRICE_CACHE_WRITE, 0.125 * US_GEO_MULTIPLIER),
    },
  };
  const off = (reason: string): TranslationConfig => ({ ...base, enabled: false, reason });

  const flag = env.TRANSLATION_ENABLED;
  if (flag !== undefined && flag !== 'true') return off('TRANSLATION_ENABLED が true ではない');
  if (flag === undefined && isProduction) return off('本番は TRANSLATION_ENABLED=true を明示するまで止める');
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return off('Supabase の設定がない');

  if (engine === 'mock' && isProduction) return off('本番では仮の翻訳を使わない');
  if (engine === 'anthropic') {
    if (env.TRANSLATION_ALLOW_PAID !== 'true') return off('有料 API の利用が許可されていない（TRANSLATION_ALLOW_PAID）');
    if (!env.ANTHROPIC_API_KEY) return off('ANTHROPIC_API_KEY がない');
    if (store !== 'db') return off('有料 API は予算・同意・記録を DB で持つとき（TRANSLATION_STORE=db）だけ使う');
    if (env.TRANSLATION_WORKSPACE_GEO !== 'us') return off('翻訳専用ワークスペースが米国だけに制限されていることを確認していない（TRANSLATION_WORKSPACE_GEO=us）');
  }
  if (store === 'db' && !env.SUPABASE_SERVICE_ROLE_KEY) return off('SUPABASE_SERVICE_ROLE_KEY がない');
  return { ...base, enabled: true, reason: '' };
}

/** 1 回の翻訳で最大かかる額（確保する額）。入力は system と文字数で、出力は max_tokens で上限が決まる */
export const MAX_OUTPUT_TOKENS = 400;
export function estimateUsd(cfg: TranslationConfig, chars: number): number {
  const inputTokens = 1300 + chars * 3;
  return (inputTokens * cfg.price.input + MAX_OUTPUT_TOKENS * cfg.price.output) / 1_000_000;
}

export type Usage = { input: number; output: number; cacheRead: number; cacheWrite: number };
export function costUsd(cfg: TranslationConfig, u: Usage): number {
  return (u.input * cfg.price.input + u.output * cfg.price.output + u.cacheRead * cfg.price.cacheRead + u.cacheWrite * cfg.price.cacheWrite) / 1_000_000;
}
