// 一致率しんだん（相性診断）の二択質問セットと一致率計算。
// 各ユーザーの回答は profiles.book.__choices（{key:'a'|'b'}）に保存する。
export type Choice = 'a' | 'b';
export type ChoiceQ = { key: string; label: string; a: string; b: string };

export const CHOICE_QUESTIONS: ChoiceQ[] = [
  { key: 'time',    label: '朝・夜',   a: '朝型',       b: '夜型' },
  { key: 'pet',     label: 'どっち？', a: '犬派',       b: '猫派' },
  { key: 'nature',  label: '自然',     a: '海',         b: '山' },
  { key: 'holiday', label: '休日',     a: 'インドア',   b: 'アウトドア' },
  { key: 'taste',   label: '味',       a: '辛いもの',   b: '甘いもの' },
  { key: 'trip',    label: '旅行',     a: '計画派',     b: 'ノープラン' },
  { key: 'contact', label: '連絡',     a: 'マメに連絡', b: '気まぐれ' },
  { key: 'music',   label: '音楽',     a: 'J-POP',      b: '洋楽・ロック' },
  { key: 'sns',     label: 'SNS',      a: 'よく投稿',   b: '見る専門' },
  { key: 'vibe',    label: '性格',     a: 'わいわい',   b: 'まったり' },
];

export type Choices = Record<string, Choice | string>;

/** 2人の回答から一致率を算出（両者が答えた質問だけで比較）。 */
export function matchPercent(mine: Choices, theirs: Choices): { percent: number; same: number; total: number } {
  const keys = CHOICE_QUESTIONS.map((q) => q.key).filter((k) => mine?.[k] && theirs?.[k]);
  const same = keys.filter((k) => mine[k] === theirs[k]).length;
  const total = keys.length;
  return { percent: total ? Math.round((same / total) * 100) : 0, same, total };
}
