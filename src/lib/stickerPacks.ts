// ============================================================
//  デコメ絵文字パック定義
//
//  【各社向け追加方法】
//  STICKER_PACKS 配列の末尾に下記フォーマットのオブジェクトを追記するだけ。
//  コンポーネント側の変更は一切不要。
//
//  ■ 取得方法 (acquisition.type)
//    "free"     : 全ユーザーが無料で使用可能
//    "purchase" : price 円で買い切り購入
//    "gacha"    : coinCost コイン消費でランダム排出
//
//  ■ ガチャレアリティ
//    "N"  (ノーマル)   : 排出率 75%
//    "R"  (レア)       : 排出率 20%
//    "SR" (スーパーレア): 排出率 5%
//
//  ■ imageUrl
//    本番環境ではステッカー画像 URL を指定（WebP/APNG 推奨）。
//    未指定の場合は emoji をフォールバック表示。
// ============================================================

export type StickerRarity = 'N' | 'R' | 'SR';

export type StickerItem = {
  id: string;
  name: string;
  emoji: string;
  imageUrl?: string;
  rarity?: StickerRarity;
};

export type StickerAcquisition =
  | { type: 'free' }
  | { type: 'purchase'; price: number }
  | { type: 'gacha'; coinCost: number };

export type StickerPack = {
  id: string;
  name: string;
  creator: string;        // 制作会社・クリエイター名
  thumbnail: string;      // パックアイコン (emoji or URL)
  description: string;
  acquisition: StickerAcquisition;
  stickers: StickerItem[];
  tags: string[];
  isNew?: boolean;
  collab?: boolean;
};

// ============================================================
//  パック定義リスト ← 各社はここに追記するだけ
// ============================================================
export const STICKER_PACKS: StickerPack[] = [

  // ── Miri公式（無料） ──────────────────────────────────────
  {
    id: 'miri-basic',
    name: 'Miri公式スタンプ',
    creator: 'Miri',
    thumbnail: '🌸',
    description: 'Miri公式の基本スタンプ。みんな無料で使えるよ！',
    acquisition: { type: 'free' },
    tags: ['かわいい', '定番', '無料'],
    stickers: [
      { id: 'mb-01', name: 'ときめき',   emoji: '💗' },
      { id: 'mb-02', name: 'さくら',     emoji: '🌸' },
      { id: 'mb-03', name: 'きらきら',   emoji: '✨' },
      { id: 'mb-04', name: 'りぼん',     emoji: '🎀' },
      { id: 'mb-05', name: 'プリクラ',   emoji: '📷' },
      { id: 'mb-06', name: '夜型',       emoji: '🌙' },
      { id: 'mb-07', name: 'カフェ',     emoji: '☕' },
      { id: 'mb-08', name: '勉強中',     emoji: '📚' },
      { id: 'mb-09', name: 'BGM',       emoji: '🎵' },
      { id: 'mb-10', name: '最高な日',   emoji: '🌈' },
      { id: 'mb-11', name: 'わかりみ',   emoji: '😭' },
      { id: 'mb-12', name: 'おやすみ',   emoji: '🌛' },
    ],
  },

  // ── 平成レトロ（有料 ¥480） ───────────────────────────────
  {
    id: 'retro-heisei',
    name: '平成レトロスタンプ',
    creator: 'Miri',
    thumbnail: '📼',
    description: '平成を生きた人ならわかる、懐かしいあのころの絵文字。',
    acquisition: { type: 'purchase', price: 480 },
    tags: ['平成', 'レトロ', 'ノスタルジー'],
    isNew: true,
    stickers: [
      { id: 'rh-01', name: 'VHSテープ',     emoji: '📼' },
      { id: 'rh-02', name: 'ポケベル',       emoji: '📟' },
      { id: 'rh-03', name: 'ゲームオーバー', emoji: '👾' },
      { id: 'rh-04', name: 'フロッピー',     emoji: '💾' },
      { id: 'rh-05', name: 'ブラウン管',     emoji: '📺' },
      { id: 'rh-06', name: 'デコメール',     emoji: '💌' },
      { id: 'rh-07', name: 'ギャル絵文字',   emoji: '🌺' },
      { id: 'rh-08', name: 'ピース',         emoji: '✌️' },
      { id: 'rh-09', name: '遊園地',         emoji: '🎠' },
      { id: 'rh-10', name: 'エモい',         emoji: '💫' },
      { id: 'rh-11', name: 'キタ━━━!!',     emoji: '🌟' },
      { id: 'rh-12', name: 'ナウいね',       emoji: '😎' },
    ],
  },

  // ── 深夜カフェ（有料 ¥240） ──────────────────────────────
  {
    id: 'night-cafe',
    name: '深夜カフェスタンプ',
    creator: 'Miri',
    thumbnail: '🌙',
    description: '深夜にひとりでいるときのための、静かなスタンプ集。',
    acquisition: { type: 'purchase', price: 240 },
    tags: ['深夜', 'カフェ', 'しっとり'],
    stickers: [
      { id: 'nc-01', name: '深夜3時',       emoji: '🕒' },
      { id: 'nc-02', name: 'コーヒー',       emoji: '☕' },
      { id: 'nc-03', name: '読書中',         emoji: '📖' },
      { id: 'nc-04', name: 'キャンドル',     emoji: '🕯️' },
      { id: 'nc-05', name: 'ジャズ',         emoji: '🎷' },
      { id: 'nc-06', name: '夜景',           emoji: '🌆' },
      { id: 'nc-07', name: '考えてる',       emoji: '💭' },
      { id: 'nc-08', name: '夜明け前',       emoji: '🌃' },
      { id: 'nc-09', name: 'お茶',           emoji: '🫖' },
      { id: 'nc-10', name: '眠れない',       emoji: '🦉' },
    ],
  },

  // ── ねこカフェコラボ（有料 ¥360 / コラボ事例） ────────────
  {
    id: 'neko-cafe-collab',
    name: 'ねこカフェ × Miriスタンプ',
    creator: 'ねこカフェ NYAN',
    thumbnail: '🐱',
    description: 'ねこカフェ NYAN との初コラボ！限定ねこスタンプ8種。',
    acquisition: { type: 'purchase', price: 360 },
    tags: ['ねこ', 'コラボ', 'かわいい'],
    isNew: true,
    collab: true,
    stickers: [
      { id: 'ny-01', name: 'ちゃとらくん',   emoji: '🐱' },
      { id: 'ny-02', name: 'はちわれちゃん', emoji: '😸' },
      { id: 'ny-03', name: 'びっくり！',     emoji: '🙀' },
      { id: 'ny-04', name: '笑いすぎ',       emoji: '😹' },
      { id: 'ny-05', name: 'もふもふ',       emoji: '😻' },
      { id: 'ny-06', name: 'あしあと',       emoji: '🐾' },
      { id: 'ny-07', name: 'おさんぽ',       emoji: '🐈' },
      { id: 'ny-08', name: 'おひるね',       emoji: '💤' },
    ],
  },

  // ── ラッキーガチャ（ガチャ 100コイン/回） ─────────────────
  {
    id: 'lucky-gacha',
    name: 'ガラケーデコガチャ',
    creator: 'Miri',
    thumbnail: '🎰',
    description: 'ガラケー風のピクセルデコが当たる！リアクションでも使える。SR 5%。',
    acquisition: { type: 'gacha', coinCost: 100 },
    tags: ['ガチャ', 'デコ', 'ピクセル', 'レトロ'],
    // emoji には Retro ショートコードを入れる（アプリ側でピクセルアートに描画される）
    stickers: [
      // N
      { id: 'lg-n1', name: 'ハート',    emoji: '[♥]', rarity: 'N' },
      { id: 'lg-n2', name: 'キラキラ',  emoji: '[★]', rarity: 'N' },
      { id: 'lg-n3', name: 'お花',      emoji: '[✿]', rarity: 'N' },
      { id: 'lg-n4', name: '音符',      emoji: '[♪]', rarity: 'N' },
      { id: 'lg-n5', name: 'クローバー', emoji: '[🍀]', rarity: 'N' },
      { id: 'lg-n6', name: 'スマイル',  emoji: '[😊]', rarity: 'N' },
      // R
      { id: 'lg-r1', name: 'にじ',      emoji: '[🌈]', rarity: 'R' },
      { id: 'lg-r2', name: 'つき',      emoji: '[🌙]', rarity: 'R' },
      { id: 'lg-r3', name: 'リボン',    emoji: '[🎀]', rarity: 'R' },
      // SR
      { id: 'lg-sr1', name: 'ダイヤ',   emoji: '[💎]', rarity: 'SR' },
      { id: 'lg-sr2', name: 'おうかん', emoji: '[👑]', rarity: 'SR' },
    ],
  },

  // ── 〔追加例〕各社はここからコピー&ペーストして追記 ──────
  // {
  //   id: 'company-pack-1',          // ← 一意のID（英数字ハイフンのみ）
  //   name: 'パック名',
  //   creator: '会社名 / クリエイター名',
  //   thumbnail: '🎨',              // パックアイコン (emoji or 画像URL)
  //   description: 'このパックの説明文',
  //   acquisition: { type: 'purchase', price: 480 },
  //   tags: ['タグ1', 'タグ2'],
  //   stickers: [
  //     { id: 'cp1-01', name: 'スタンプ名', emoji: '😊', imageUrl: 'https://cdn.example.com/sticker1.webp' },
  //   ],
  // },

];

// ── ガチャ排出ロジック ─────────────────────────────────────
const RARITY_WEIGHT: Record<StickerRarity, number> = { N: 75, R: 20, SR: 5 };

export function drawGacha(
  pack: StickerPack,
  ownedGachaIds: string[],
): { sticker: StickerItem; isNew: boolean } {
  const pool = pack.stickers.flatMap((s) => {
    const w = RARITY_WEIGHT[s.rarity ?? 'N'];
    return Array<StickerItem>(w).fill(s);
  });
  const drawn = pool[Math.floor(Math.random() * pool.length)];
  return { sticker: drawn, isNew: !ownedGachaIds.includes(drawn.id) };
}

export function draw10Gacha(
  pack: StickerPack,
  ownedGachaIds: string[],
): Array<{ sticker: StickerItem; isNew: boolean }> {
  const results: Array<{ sticker: StickerItem; isNew: boolean }> = [];
  let currentOwned = [...ownedGachaIds];
  for (let i = 0; i < 10; i++) {
    const r = drawGacha(pack, currentOwned);
    results.push(r);
    if (r.isNew) currentOwned.push(r.sticker.id);
  }
  return results;
}

export function getOwnedStickers(pack: StickerPack, ownedIds: string[]): StickerItem[] {
  if (pack.acquisition.type === 'gacha') {
    return pack.stickers.filter((s) => ownedIds.includes(s.id));
  }
  return pack.stickers;
}

export const RARITY_LABELS: Record<StickerRarity, string> = {
  N: 'ノーマル',
  R: 'レア',
  SR: 'スーパーレア',
};

export const RARITY_COLOR: Record<StickerRarity, string> = {
  N: 'text-muted bg-base',
  R: 'text-sky-600 bg-sky-50',
  SR: 'text-amber-500 bg-zinc-900',
};
