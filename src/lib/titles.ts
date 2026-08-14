export type TitleType = 'official' | 'founder' | 'pioneer';

export const TITLE_DEFS: Record<TitleType, {
  label: string;
  emoji: string;
  rare: boolean;
  description: string;
}> = {
  official: {
    label: '公認',
    emoji: '✓',
    rare: false,
    description: 'Miriが認定した公認クリエイター',
  },
  founder: {
    label: '創設メンバー',
    emoji: '✦',
    rare: true,
    description: 'Miriの立ち上げを支えた創設メンバー。データはサービス正式リリース後もそのまま引き継がれます。',
  },
  pioneer: {
    label: '先駆者',
    emoji: '🚀',
    rare: true,
    description: 'テスト公開の時期からMiriを一緒に育ててくれた先駆者。あなたのデータは正式リリース後もそのまま引き継がれます。',
  },
};

// ── 「先駆者」自動付与の基準 ───────────────────────────────
// この日時「以降」に登録したアカウントには自動で先駆者称号が付く（テスト公開の開始日時）。
// テスト期間を締めたいときは、この値を過去日時にすれば新規付与が止まる。
export const PIONEER_SINCE = '2026-08-14T00:00:00Z';

/** アカウント作成日時が先駆者の対象か（テスト公開開始以降の登録か）。 */
export function isPioneerAccount(createdAt?: string | null): boolean {
  if (!createdAt) return false;
  const t = Date.parse(createdAt);
  return Number.isFinite(t) && t >= Date.parse(PIONEER_SINCE);
}

// 各ユーザーに付与する称号（モック/デモ用。ここを編集して称号を管理）
export const USER_TITLES: Record<string, TitleType[]> = {
  '@koki':      ['official'],
  '@mayu_note': ['founder', 'official'],
  '@rin_puri':  ['founder'],
};

// 本番(DB)ユーザーの称号を実行時に登録するレジストリ。キーは画面と同じ "@username"。
// DBの profiles.titles を読み込んだ箇所から registerUserTitles で登録する。
const RUNTIME_TITLES: Record<string, TitleType[]> = {};

/** DBから読んだ称号を "@username" キーで登録（表示に反映される）。 */
export function registerUserTitles(handle: string, titles?: string[] | null): void {
  if (!handle || !titles) return;
  const valid = titles.filter((t): t is TitleType => Object.prototype.hasOwnProperty.call(TITLE_DEFS, t));
  RUNTIME_TITLES[handle] = valid;
}

export function getUserTitles(userId: string): TitleType[] {
  const stat = USER_TITLES[userId] ?? [];
  const dyn = RUNTIME_TITLES[userId] ?? [];
  if (stat.length === 0) return dyn;
  if (dyn.length === 0) return stat;
  // 両方あれば重複を除いて統合
  return Array.from(new Set([...stat, ...dyn]));
}
