// ============================================================
//  世界観付きプロフ帳背景（ガチャ排出）
//
//  カラーグラデーションだけでなく「世界観」を持った背景。
//  絵文字がふわふわ浮かぶアニメーション付きで、プロフ帳の
//  表紙カードに適用される。
//
//  【追加方法】BG_THEMES 配列にオブジェクトを追記するだけ。
//  レアリティ排出率はスタンプガチャと同じ N75% / R20% / SR5%。
// ============================================================

export type BgRarity = 'N' | 'R' | 'SR';

export type BgFloater = {
  emoji: string;
  /** 左位置（%） */
  left: number;
  /** 上位置（%） */
  top: number;
  /** 文字サイズ（rem） */
  size: number;
  /** アニメーション遅延（秒） */
  delay: number;
  /** アニメーション周期（秒） */
  duration: number;
};

export type BgTheme = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  rarity: BgRarity;
  /** tailwind の gradient クラス（from-* via-* to-*） */
  gradient: string;
  /** 浮かぶ絵文字たち */
  floaters: BgFloater[];
};

export const BG_GACHA_COST = 150;

export const BG_THEMES: BgTheme[] = [
  {
    id: 'bg-umi',
    name: 'うみのなか',
    emoji: '🐙',
    description: 'タコやおさかなが泳ぐ、ゆらゆら海中のプロフ帳。',
    rarity: 'N',
    gradient: 'from-sky-200 via-cyan-100 to-blue-200',
    floaters: [
      { emoji: '🐙', left: 74, top: 12, size: 2.0, delay: 0.0, duration: 7 },
      { emoji: '🐠', left: 8,  top: 30, size: 1.4, delay: 1.2, duration: 6 },
      { emoji: '🐡', left: 55, top: 62, size: 1.2, delay: 2.4, duration: 8 },
      { emoji: '🫧', left: 28, top: 10, size: 1.0, delay: 0.6, duration: 5 },
      { emoji: '🐚', left: 12, top: 74, size: 1.1, delay: 1.8, duration: 9 },
      { emoji: '🪸', left: 86, top: 70, size: 1.3, delay: 0.9, duration: 8 },
    ],
  },
  {
    id: 'bg-sora',
    name: 'そらのうえ',
    emoji: '☁️',
    description: '雲の上をお散歩。にじと小鳥といっしょのプロフ帳。',
    rarity: 'N',
    gradient: 'from-sky-100 via-blue-50 to-indigo-100',
    floaters: [
      { emoji: '☁️', left: 10, top: 14, size: 1.8, delay: 0.0, duration: 8 },
      { emoji: '🌈', left: 70, top: 8,  size: 1.6, delay: 1.0, duration: 9 },
      { emoji: '🕊️', left: 46, top: 40, size: 1.2, delay: 2.0, duration: 6 },
      { emoji: '☁️', left: 80, top: 64, size: 1.4, delay: 0.5, duration: 7 },
      { emoji: '🎈', left: 22, top: 66, size: 1.2, delay: 1.5, duration: 8 },
    ],
  },
  {
    id: 'bg-okashi',
    name: 'おかしのいえ',
    emoji: '🍭',
    description: 'クッキーの屋根にキャンディの窓。あまあまなプロフ帳。',
    rarity: 'R',
    gradient: 'from-rose-100 via-amber-50 to-orange-100',
    floaters: [
      { emoji: '🍭', left: 78, top: 10, size: 1.8, delay: 0.0, duration: 7 },
      { emoji: '🍪', left: 10, top: 18, size: 1.4, delay: 1.0, duration: 8 },
      { emoji: '🧁', left: 56, top: 58, size: 1.5, delay: 2.0, duration: 6 },
      { emoji: '🍬', left: 26, top: 44, size: 1.1, delay: 0.4, duration: 5 },
      { emoji: '🍩', left: 88, top: 66, size: 1.3, delay: 1.6, duration: 9 },
      { emoji: '🍰', left: 8,  top: 72, size: 1.2, delay: 2.4, duration: 8 },
    ],
  },
  {
    id: 'bg-matenrou',
    name: 'まてんろうの夜',
    emoji: '🌃',
    description: 'ビルの灯りがきらめく夜景。ちょっぴり大人なプロフ帳。',
    rarity: 'R',
    gradient: 'from-indigo-200 via-violet-100 to-slate-200',
    floaters: [
      { emoji: '🏙️', left: 72, top: 58, size: 2.0, delay: 0.0, duration: 10 },
      { emoji: '🌙', left: 12, top: 10, size: 1.6, delay: 0.8, duration: 8 },
      { emoji: '✨', left: 40, top: 26, size: 1.0, delay: 1.6, duration: 5 },
      { emoji: '🌟', left: 84, top: 14, size: 1.1, delay: 0.4, duration: 6 },
      { emoji: '🚕', left: 16, top: 70, size: 1.2, delay: 2.2, duration: 9 },
    ],
  },
  {
    id: 'bg-heisei-girly',
    name: '平成ガーリールーム',
    emoji: '🎀',
    description: 'プリ帳・デコ電・りぼん。あのころの女の子の部屋。',
    rarity: 'SR',
    gradient: 'from-pink-200 via-fuchsia-100 to-purple-200',
    floaters: [
      { emoji: '🎀', left: 76, top: 10, size: 1.8, delay: 0.0, duration: 6 },
      { emoji: '📼', left: 10, top: 20, size: 1.3, delay: 1.0, duration: 8 },
      { emoji: '💝', left: 52, top: 50, size: 1.4, delay: 2.0, duration: 7 },
      { emoji: '📷', left: 26, top: 66, size: 1.2, delay: 0.6, duration: 9 },
      { emoji: '💿', left: 88, top: 60, size: 1.2, delay: 1.4, duration: 8 },
      { emoji: '✨', left: 40, top: 14, size: 1.0, delay: 2.6, duration: 5 },
      { emoji: '💌', left: 8,  top: 76, size: 1.1, delay: 1.8, duration: 7 },
    ],
  },
  {
    id: 'bg-hoshizora',
    name: 'ほしぞらプラネタリウム',
    emoji: '🌌',
    description: '流れ星に願いごと。満天の星のプロフ帳。',
    rarity: 'SR',
    gradient: 'from-indigo-300 via-purple-200 to-pink-200',
    floaters: [
      { emoji: '🌌', left: 70, top: 12, size: 1.8, delay: 0.0, duration: 9 },
      { emoji: '⭐', left: 14, top: 16, size: 1.2, delay: 0.8, duration: 6 },
      { emoji: '🌠', left: 44, top: 34, size: 1.4, delay: 1.6, duration: 7 },
      { emoji: '🪐', left: 86, top: 56, size: 1.4, delay: 0.4, duration: 8 },
      { emoji: '✨', left: 24, top: 62, size: 1.0, delay: 2.2, duration: 5 },
      { emoji: '🔭', left: 8,  top: 78, size: 1.2, delay: 1.2, duration: 9 },
    ],
  },
];

// ── ガチャ排出ロジック（スタンプガチャと同じ重み） ──────────
const BG_RARITY_WEIGHT: Record<BgRarity, number> = { N: 75, R: 20, SR: 5 };

export function drawBgGacha(ownedIds: string[]): { theme: BgTheme; isNew: boolean } {
  const pool = BG_THEMES.flatMap((t) => Array<BgTheme>(BG_RARITY_WEIGHT[t.rarity]).fill(t));
  const drawn = pool[Math.floor(Math.random() * pool.length)];
  return { theme: drawn, isNew: !ownedIds.includes(drawn.id) };
}

export function getBgTheme(id: string | null | undefined): BgTheme | null {
  if (!id) return null;
  return BG_THEMES.find((t) => t.id === id) ?? null;
}
