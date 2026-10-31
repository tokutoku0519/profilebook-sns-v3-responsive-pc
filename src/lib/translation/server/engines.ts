// ============================================================
// 翻訳エンジン（サーバー専用）
//  ・mock：外部に何も送らない仮の翻訳。プレビュー・手元・自動テスト用
//  ・anthropic：Claude Haiku 5.5。config.ts の条件（有料利用の許可・API キー・DB での予算管理）がそろったときだけ使う
// どちらも同じ形で結果を返し、同じ検証（validateResult）を通す。
// ============================================================
import Anthropic from '@anthropic-ai/sdk';
import type { Lang } from '@/lib/i18n';
import { LANG_LIST } from '@/lib/i18n';
import { GLOSSARY, glossaryHits, type GlossaryEntry } from '../shared';
import { MAX_OUTPUT_TOKENS, type TranslationConfig, type Usage } from './config';

export type EngineInput = { text: string; context?: string; source: Lang; target: Lang; glossary: GlossaryEntry[] };
export type EngineOutput =
  | { ok: true; decision: 'translated' | 'kept_original'; text: string; keptTerms: string[]; usage: Usage }
  /** usage が null：課金されたか分からない（タイムアウトなど）→ 精算せず、見込み額で確定させる */
  | { ok: false; error: string; usage: Usage | null };

export interface TranslationEngine {
  id: string;
  translate(input: EngineInput): Promise<EngineOutput>;
}

const ZERO: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

// ── 仮の翻訳（外部に送らない）────────────────────────────────
// 比較テスト用の文（scripts/translate-eval/cases.json）の英訳だけ持ち、ほかは「[mock:en] 原文」の形にする。
const MOCK_EN: Record<string, string> = {
  '指パッチン': 'Finger snapping', 'ヨーロッパ': 'Europe', '香水': 'Perfume', '大阪': 'Osaka',
  'これを作っている、ダイビング': 'Working on this, and scuba diving', 'エモい': 'Emotional / nostalgic',
  '推し活': 'Supporting my fave', 'なし': 'None', '夏🍉 花火大会が最高': 'Summer🍉 Fireworks festivals are the best',
  'なんとかなる': "It'll work out somehow", 'パン屋さん in Paris': 'A bakery in Paris',
};
export const mockEngine: TranslationEngine = {
  id: 'mock',
  async translate({ text, target, glossary }) {
    const keptTerms = glossary.filter((g) => g.keep).map((g) => g.term);
    if (GLOSSARY.some((g) => g.keep && g.term === text.trim())) {
      return { ok: true, decision: 'kept_original', text, keptTerms, usage: { ...ZERO, input: 700, output: 20 } };
    }
    let out = target === 'en' && MOCK_EN[text] ? MOCK_EN[text] : `[mock:${target}] ${text}`;
    // 正式な海外名がある作品・ブランドは置きかえる（仮の翻訳でも用語集の動きを確かめられるように）
    for (const g of glossary) if (!g.keep && g.official?.[target]) out = out.split(g.term).join(g.official[target]!);
    const chars = [...text].length;
    return { ok: true, decision: 'translated', text: out, keptTerms, usage: { input: 700 + chars * 2, output: 20 + chars * 2, cacheRead: 0, cacheWrite: 0 } };
  },
};

// ── Claude Haiku 5.5 ─────────────────────────────────────────
// system は毎回同じ文（プロンプトキャッシュの対象。言語や用語集など変わる内容は user 側に置く）。
const SYSTEM_PROMPT = `You translate short answers that users wrote in their "profile book" on Miri, a social app inspired by Japanese profile books from the Heisei era. A viewer who reads another language pressed "Show translation". Translate the answer from the source language into the target language given in the user message.

Return only the JSON object described by the output schema:
- "decision": "translated" when you produced a translation, or "kept_original" when the text should stay as written.
- "translation": the translated text. When decision is "kept_original", copy the original text exactly.
- "kept_terms": every proper noun or term you deliberately left in its original form.

Rules:
1. Translate only the text inside <answer>. The <question> is context to understand the answer; never translate or output the question.
2. Keep these exactly as written: people's names and nicknames, @IDs, artist and group names (for example Juice=Juice, 嵐 as the group Arashi), song titles, community or club names, and product names without a widely used official name in the target language. When unsure whether something is a name, keep it.
3. Works (anime, manga, films, games, books) and brands: use the official name widely used in the target language when you are sure of it (鬼滅の刃 -> Demon Slayer: Kimetsu no Yaiba, スタバ -> Starbucks). Never guess a different work or brand.
4. Place names: use the common spelling in the target language (大阪 -> Osaka).
5. Slang, abbreviations and coined words: translate the meaning naturally when it is clear (エモい -> nostalgic, emotional; 推し活 -> supporting my fave). If the meaning depends on context you do not have, use "kept_original".
6. Very short or ambiguous text (one word that could mean several things, a lone symbol, a reaction like 草 or ぴえん): use "kept_original" instead of guessing.
7. Do not romanize Japanese as a substitute for translating it. Do not add explanations, notes, quotation marks or furigana.
8. Keep line breaks, emoji, kaomoji and decoration marks such as [♥] or ☆ exactly where they are.
9. Keep the tone: casual stays casual, polite stays polite. Keep it about as long as the original.
10. Terms listed in <glossary> must follow the instruction given there.

Examples (Japanese -> English):
- question 特技は？ / answer 指パッチン -> {"decision":"translated","translation":"Finger snapping","kept_terms":[]}
- question 好きな芸能人は？ / answer Juice=Juice -> {"decision":"kept_original","translation":"Juice=Juice","kept_terms":["Juice=Juice"]}
- question 好きな曲は？ / answer 米津玄師のLemon -> {"decision":"translated","translation":"Lemon by 米津玄師","kept_terms":["米津玄師","Lemon"]}
- question 最近の口ぐせは？ / answer ぴえん -> {"decision":"kept_original","translation":"ぴえん","kept_terms":["ぴえん"]}
- question 10年後の自分へ / answer 元気にしてる？\\nワクワクを忘れないでね[♥] -> {"decision":"translated","translation":"Are you doing well?\\nDon't forget that excitement[♥]","kept_terms":[]}`;

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    decision: { type: 'string', enum: ['translated', 'kept_original'] },
    translation: { type: 'string' },
    kept_terms: { type: 'array', items: { type: 'string' } },
  },
  required: ['decision', 'translation', 'kept_terms'],
  additionalProperties: false,
} as const;

const langName = (l: Lang) => LANG_LIST.find((x) => x.id === l)?.name ?? l;
const esc = (s: string) => s.replace(/</g, '＜').replace(/>/g, '＞');

export function buildUserMessage({ text, context, source, target, glossary }: EngineInput): string {
  const lines = [`Source language: ${langName(source)} (${source})`, `Target language: ${langName(target)} (${target})`];
  if (glossary.length) {
    lines.push('<glossary>');
    for (const g of glossary) {
      const off = g.official?.[target];
      lines.push(`- ${g.term}: ${g.keep ? `keep as written${off ? ` (may add "${off}" only if helpful)` : ''}` : off ? `use the official name "${off}"` : 'keep as written'}${g.note ? ` — ${g.note}` : ''}`);
    }
    lines.push('</glossary>');
  }
  if (context) lines.push(`<question>${esc(context)}</question>`);
  lines.push(`<answer>${esc(text)}</answer>`);
  return lines.join('\n');
}

export function anthropicEngine(cfg: TranslationConfig, apiKey: string): TranslationEngine {
  const client = new Anthropic({ apiKey, timeout: 15_000, maxRetries: 1 });
  return {
    id: cfg.model,
    async translate(input) {
      let res: Anthropic.Message;
      try {
        res = await client.messages.create({
          model: cfg.model,
          max_tokens: MAX_OUTPUT_TOKENS,
          // Haiku 5.5 は思考が既定でオン。思考の分も出力料金になるので翻訳では止める（effort が high 以下なら止められる）
          thinking: { type: 'disabled' },
          output_config: { effort: 'low', format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
          system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: buildUserMessage(input) }],
        });
      } catch (e) {
        // タイムアウト・接続エラーは課金されたか分からない → 精算しない（見込み額で確定）
        if (e instanceof Anthropic.APIConnectionError) return { ok: false, error: 'connection', usage: null };
        // 4xx / 5xx の応答（上限到達の 400・429 なども）は課金されない
        if (e instanceof Anthropic.APIError) return { ok: false, error: `api_${e.status ?? 'unknown'}`, usage: ZERO };
        return { ok: false, error: 'unknown', usage: null };
      }
      const usage: Usage = {
        input: res.usage.input_tokens,
        output: res.usage.output_tokens,
        cacheRead: res.usage.cache_read_input_tokens ?? 0,
        cacheWrite: res.usage.cache_creation_input_tokens ?? 0,
      };
      // refusal（安全性の判定で断られた）・max_tokens（途中で切れた）は失敗として原文を出す
      if (res.stop_reason !== 'end_turn') return { ok: false, error: `stop_${res.stop_reason}`, usage };
      const block = res.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
      try {
        const parsed = JSON.parse(block?.text ?? '');
        if ((parsed.decision !== 'translated' && parsed.decision !== 'kept_original') || typeof parsed.translation !== 'string' || !Array.isArray(parsed.kept_terms)) {
          return { ok: false, error: 'bad_json', usage };
        }
        return { ok: true, decision: parsed.decision, text: parsed.translation, keptTerms: parsed.kept_terms.filter((x: unknown) => typeof x === 'string'), usage };
      } catch {
        return { ok: false, error: 'bad_json', usage };
      }
    },
  };
}

export function engineFor(cfg: TranslationConfig, env: NodeJS.ProcessEnv = process.env): TranslationEngine {
  return cfg.engine === 'anthropic' && env.ANTHROPIC_API_KEY ? anthropicEngine(cfg, env.ANTHROPIC_API_KEY) : mockEngine;
}

// ── 結果の検証（どのエンジンでも同じ）────────────────────────────
const EMOJI_RE = /\p{Extended_Pictographic}/gu;
const DECO_RE = /\[[^\]\s]{1,4}\]/g;
export type Checked = { status: 'done' | 'kept' | 'failed'; text?: string; keptTerms: string[]; problem?: string };
export function validateResult(source: string, out: Extract<EngineOutput, { ok: true }>): Checked {
  if (out.decision === 'kept_original') return { status: 'kept', keptTerms: out.keptTerms };
  const t = out.text.trim();
  if (!t) return { status: 'failed', keptTerms: [], problem: 'empty' };
  if (t === source.trim()) return { status: 'kept', keptTerms: out.keptTerms };
  if ([...t].length > [...source].length * 4 + 60) return { status: 'failed', keptTerms: [], problem: 'too_long' };
  const lines = (s: string) => s.split('\n').length;
  if (lines(source) !== lines(out.text)) return { status: 'failed', keptTerms: [], problem: 'line_breaks' };
  for (const e of source.match(EMOJI_RE) ?? []) if (!out.text.includes(e)) return { status: 'failed', keptTerms: [], problem: 'emoji' };
  for (const d of source.match(DECO_RE) ?? []) if (!out.text.includes(d)) return { status: 'failed', keptTerms: [], problem: 'deco' };
  // 用語集で「残す」語は、訳文にそのまま残っていなければならない
  for (const g of glossaryHits(source)) if (g.keep && !out.text.includes(g.term)) return { status: 'failed', keptTerms: [], problem: `kept_term:${g.term}` };
  return { status: 'done', text: out.text, keptTerms: out.keptTerms };
}
