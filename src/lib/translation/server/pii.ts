// ============================================================
// 外部の翻訳サービスへ送る前の個人情報のチェック（サーバー専用）
//
// ・伏せ字にして送るもの：メールアドレス・電話番号・URL・郵便番号・@ID
//   → ⟦1⟧ のような記号に置きかえて送り、訳文で元に戻す（記号が消えたら翻訳は失敗として原文を出す）
// ・送らないもの（翻訳せず原文のまま）：住所らしい文、要配慮個人情報にかかわる言葉を含む文
//   （病歴・障害・信条・犯罪歴など。言葉の一覧による判定なので、見落とし・取りすぎがある）
// 目的は「本人や第三者の個人情報を外へ出す量を減らす」こと。完全な検出は保証しない（ポリシーにもそう書く）。
// ============================================================

export type Screened =
  | { ok: true; text: string; tokens: string[] }   // tokens[i] が ⟦i+1⟧ の元の文字列
  | { ok: false; reason: 'address' | 'sensitive' };

const MASKS: RegExp[] = [
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,                                // メールアドレス
  /(?:https?:\/\/|www\.)[^\s　]+/gi,                                                  // URL
  /(?:\+?\d{1,3}[-\s]?)?(?:\(?0\d{1,4}\)?[-\s]?)\d{1,4}[-\s]?\d{3,4}(?!\d)/g,        // 電話番号（ハイフン・空白あり）
  /(?<!\d)0\d{9,10}(?!\d)/g,                                                         // 電話番号（数字だけ 10〜11 桁）
  /〒?\s?\d{3}-\d{4}(?!\d)/g,                                                         // 郵便番号
  /(?<![A-Za-z0-9_])@[A-Za-z0-9_.]{2,30}/g,                                          // @ID
];

// 都道府県＋市区町村＋番地らしい数字
const ADDRESS = /(?:東京都|北海道|(?:京都|大阪)府|[^\s　]{2,3}県)[^\s　]{0,12}?[市区町村郡][^\s　]{0,20}?\d{1,4}(?:丁目|番地?|号|[-‐−ー])/;
// 要配慮個人情報（個人情報保護法 2 条 3 項）にかかわりやすい言葉。取りすぎても「翻訳しないだけ」なので広めにする
const SENSITIVE = /(病気|病院|通院|入院|手術|診断|障害|障がい|精神科|心療内科|うつ病|鬱|発達障|持病|服薬|妊娠|宗教|信仰|信者|政党|支持政党|前科|逮捕|犯罪歴|被害届|生活保護|出自|部落|国籍|人種|性的指向|同性愛|LGBT|HIV)/i;

export function screenPersonalInfo(text: string): Screened {
  if (ADDRESS.test(text)) return { ok: false, reason: 'address' };
  if (SENSITIVE.test(text)) return { ok: false, reason: 'sensitive' };
  const tokens: string[] = [];
  let out = text;
  for (const re of MASKS) {
    out = out.replace(re, (m) => {
      // 数字が 9 桁未満の「電話番号らしいもの」は日付・点数などの誤検出が多いので伏せない
      if (re !== MASKS[0] && re !== MASKS[1] && re !== MASKS[5] && (m.match(/\d/g) ?? []).length < 9 && !m.startsWith('〒')) {
        if (!/^\d{3}-\d{4}$/.test(m.trim())) return m;
      }
      tokens.push(m);
      return `⟦${tokens.length}⟧`;
    });
  }
  return { ok: true, text: out, tokens };
}

/** 訳文の ⟦n⟧ を元に戻す。記号が 1 つでも欠けていたら null（翻訳失敗として原文を出す） */
export function restoreMasked(translated: string, tokens: string[]): string | null {
  for (let i = 0; i < tokens.length; i++) if (!translated.includes(`⟦${i + 1}⟧`)) return null;
  return translated.replace(/⟦(\d+)⟧/g, (m, n) => tokens[Number(n) - 1] ?? m);
}
