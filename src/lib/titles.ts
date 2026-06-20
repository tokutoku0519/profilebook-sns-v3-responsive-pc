export type TitleType = 'official' | 'tester';

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
  tester: {
    label: 'テストプレイヤー',
    emoji: '⚡',
    rare: true,
    description: '初期テストプレイを担った創設メンバー。データはサービス正式リリース後もそのまま引き継がれます。',
  },
};

// 各ユーザーに付与する称号（ここを編集して称号を管理）
export const USER_TITLES: Record<string, TitleType[]> = {
  '@koki':      ['official'],
  '@mayu_note': ['tester', 'official'],
  '@rin_puri':  ['tester'],
};

// テストプレイヤーのシリアルナンバー
export const TESTER_SERIALS: Record<string, number> = {
  '@mayu_note': 1,
  '@rin_puri':  2,
};

export function getUserTitles(userId: string): TitleType[] {
  return USER_TITLES[userId] ?? [];
}
