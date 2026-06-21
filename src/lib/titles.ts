export type TitleType = 'official' | 'founder';

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
};

// 各ユーザーに付与する称号（ここを編集して称号を管理）
export const USER_TITLES: Record<string, TitleType[]> = {
  '@koki':      ['official'],
  '@mayu_note': ['founder', 'official'],
  '@rin_puri':  ['founder'],
};

export function getUserTitles(userId: string): TitleType[] {
  return USER_TITLES[userId] ?? [];
}
