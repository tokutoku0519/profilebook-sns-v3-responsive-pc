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
  /** ThemeArt のイラストID（絵文字は使わずオリジナルSVGで描画） */
  art: string;
  /** 左位置（%） */
  left: number;
  /** 上位置（%） */
  top: number;
  /** 大きさ（rem相当。SVGの描画サイズに換算される） */
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
      { art: 'octopus', left: 74, top: 12, size: 2.0, delay: 0.0, duration: 7 },
      { art: 'fish', left: 8,  top: 30, size: 1.4, delay: 1.2, duration: 6 },
      { art: 'fish2', left: 55, top: 62, size: 1.2, delay: 2.4, duration: 8 },
      { art: 'bubble', left: 28, top: 10, size: 1.0, delay: 0.6, duration: 5 },
      { art: 'shell', left: 12, top: 74, size: 1.1, delay: 1.8, duration: 9 },
      { art: 'coral', left: 86, top: 70, size: 1.3, delay: 0.9, duration: 8 },
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
      { art: 'cloud', left: 10, top: 14, size: 1.8, delay: 0.0, duration: 8 },
      { art: 'rainbow', left: 70, top: 8,  size: 1.6, delay: 1.0, duration: 9 },
      { art: 'bird', left: 46, top: 40, size: 1.2, delay: 2.0, duration: 6 },
      { art: 'cloud', left: 80, top: 64, size: 1.4, delay: 0.5, duration: 7 },
      { art: 'balloon', left: 22, top: 66, size: 1.2, delay: 1.5, duration: 8 },
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
      { art: 'lollipop', left: 78, top: 10, size: 1.8, delay: 0.0, duration: 7 },
      { art: 'cookie', left: 10, top: 18, size: 1.4, delay: 1.0, duration: 8 },
      { art: 'cupcake', left: 56, top: 58, size: 1.5, delay: 2.0, duration: 6 },
      { art: 'candy', left: 26, top: 44, size: 1.1, delay: 0.4, duration: 5 },
      { art: 'donut', left: 88, top: 66, size: 1.3, delay: 1.6, duration: 9 },
      { art: 'cake', left: 8,  top: 72, size: 1.2, delay: 2.4, duration: 8 },
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
      { art: 'city', left: 72, top: 58, size: 2.0, delay: 0.0, duration: 10 },
      { art: 'moon', left: 12, top: 10, size: 1.6, delay: 0.8, duration: 8 },
      { art: 'sparkle', left: 40, top: 26, size: 1.0, delay: 1.6, duration: 5 },
      { art: 'star', left: 84, top: 14, size: 1.1, delay: 0.4, duration: 6 },
      { art: 'taxi', left: 16, top: 70, size: 1.2, delay: 2.2, duration: 9 },
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
      { art: 'ribbon', left: 76, top: 10, size: 1.8, delay: 0.0, duration: 6 },
      { art: 'cassette', left: 10, top: 20, size: 1.3, delay: 1.0, duration: 8 },
      { art: 'heart', left: 52, top: 50, size: 1.4, delay: 2.0, duration: 7 },
      { art: 'camera', left: 26, top: 66, size: 1.2, delay: 0.6, duration: 9 },
      { art: 'cd', left: 88, top: 60, size: 1.2, delay: 1.4, duration: 8 },
      { art: 'sparkle', left: 40, top: 14, size: 1.0, delay: 2.6, duration: 5 },
      { art: 'letter', left: 8,  top: 76, size: 1.1, delay: 1.8, duration: 7 },
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
      { art: 'galaxy', left: 70, top: 12, size: 1.8, delay: 0.0, duration: 9 },
      { art: 'star', left: 14, top: 16, size: 1.2, delay: 0.8, duration: 6 },
      { art: 'shootingstar', left: 44, top: 34, size: 1.4, delay: 1.6, duration: 7 },
      { art: 'planet', left: 86, top: 56, size: 1.4, delay: 0.4, duration: 8 },
      { art: 'sparkle', left: 24, top: 62, size: 1.0, delay: 2.2, duration: 5 },
      { art: 'telescope', left: 8,  top: 78, size: 1.2, delay: 1.2, duration: 9 },
    ],
  },
];

// ============================================================
//  カラーテーマ（コイン購入・買い切り）
//  ガチャの世界観背景とちがい、確実にコインで買えるテーマ。
//  同じ「プロフ帳表紙」スロットに装備する（floaters なしの静かな背景）。
// ============================================================

export type PurchasableTheme = BgTheme & { price: number };

export const COLOR_THEMES: PurchasableTheme[] = [
  { id: 'ct-sakura',  name: 'さくら夜',           emoji: '🌸', description: '夜桜みたいなピンクのグラデーション。', rarity: 'N', gradient: 'from-pink-200 via-rose-100 to-purple-100',    floaters: [], price: 120 },
  { id: 'ct-ocean',   name: 'ディープオーシャン', emoji: '🌊', description: '深い海の色。すっきりクールに。',       rarity: 'N', gradient: 'from-blue-200 via-cyan-100 to-sky-100',       floaters: [], price: 150 },
  { id: 'ct-galaxy',  name: 'ギャラクシー',       emoji: '🌌', description: '銀河のむらさき。ちょっとミステリアス。', rarity: 'N', gradient: 'from-indigo-300 via-purple-200 to-pink-200',  floaters: [], price: 200 },
  { id: 'ct-autumn',  name: 'もみじ',             emoji: '🍂', description: '秋のあたたかいオレンジ。',             rarity: 'N', gradient: 'from-orange-200 via-amber-100 to-yellow-100', floaters: [], price: 120 },
  { id: 'ct-rainbow', name: 'レインボー',         emoji: '🌈', description: 'にじ色でいちばん目立つ！',             rarity: 'N', gradient: 'from-pink-200 via-yellow-100 to-green-100',   floaters: [], price: 180 },
  { id: 'ct-mist',    name: 'ミスティパープル',   emoji: '🌙', description: '霧のかかった夜のむらさき。',           rarity: 'N', gradient: 'from-violet-300 via-purple-200 to-fuchsia-100', floaters: [], price: 150 },
];

// ── ガチャ排出ロジック（スタンプガチャと同じ重み） ──────────
const BG_RARITY_WEIGHT: Record<BgRarity, number> = { N: 75, R: 20, SR: 5 };

export function drawBgGacha(ownedIds: string[]): { theme: BgTheme; isNew: boolean } {
  const pool = BG_THEMES.flatMap((t) => Array<BgTheme>(BG_RARITY_WEIGHT[t.rarity]).fill(t));
  const drawn = pool[Math.floor(Math.random() * pool.length)];
  return { theme: drawn, isNew: !ownedIds.includes(drawn.id) };
}

/** 装備中IDからテーマを引く（世界観背景・カラーテーマ共通） */
export function getBgTheme(id: string | null | undefined): BgTheme | null {
  if (!id) return null;
  return BG_THEMES.find((t) => t.id === id) ?? COLOR_THEMES.find((t) => t.id === id) ?? null;
}
