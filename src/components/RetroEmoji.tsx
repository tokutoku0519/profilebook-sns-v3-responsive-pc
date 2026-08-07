'use client';

import React, { useEffect, useRef, useState } from 'react';

// ── 絵文字をガラケー風ピクセルに自動変換 ──────────────────────
// どんな絵文字でも、低解像度キャンバスに描いてから粗く拡大＝ドット絵化する。
// 生成した dataURL は emoji 文字＋解像度でキャッシュして使い回す。
const pixelCache = new Map<string, string>();
// ① 大きいキャンバスに絵文字を「全体・中央」で描く → ② res×res に縮小（平均化）
// → 表示側で imageRendering:pixelated により粗く拡大。これで切れ・変な拡大を防ぐ。
function emojiToPixelDataUrl(emoji: string, res: number): string {
  const key = `${emoji}@${res}`;
  const cached = pixelCache.get(key);
  if (cached) return cached;
  try {
    const BIG = 72;
    const big = document.createElement('canvas');
    big.width = BIG; big.height = BIG;
    const bctx = big.getContext('2d');
    if (!bctx) return '';
    bctx.clearRect(0, 0, BIG, BIG);
    bctx.textAlign = 'center';
    bctx.textBaseline = 'middle';
    bctx.font = `${Math.floor(BIG * 0.8)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","EmojiOne Color",sans-serif`;
    bctx.fillText(emoji, BIG / 2, BIG / 2);
    // 実際に描かれた不透明ピクセルの範囲（インクの矩形）を検出して中央フィット
    let minX = BIG, minY = BIG, maxX = 0, maxY = 0, found = false;
    try {
      const d = bctx.getImageData(0, 0, BIG, BIG).data;
      for (let y = 0; y < BIG; y++) {
        for (let x = 0; x < BIG; x++) {
          if (d[(y * BIG + x) * 4 + 3] > 16) {
            found = true;
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
          }
        }
      }
    } catch { /* getImageData 不可なら全体を使う */ }
    if (!found) { minX = 0; minY = 0; maxX = BIG - 1; maxY = BIG - 1; }
    const bw = maxX - minX + 1, bh = maxY - minY + 1;
    const small = document.createElement('canvas');
    small.width = res; small.height = res;
    const sctx = small.getContext('2d');
    if (!sctx) return '';
    sctx.imageSmoothingEnabled = true;
    (sctx as any).imageSmoothingQuality = 'high';
    sctx.clearRect(0, 0, res, res);
    const pad = 1, avail = res - pad * 2;
    const scale = Math.min(avail / bw, avail / bh);
    const dw = bw * scale, dh = bh * scale;
    sctx.drawImage(big, minX, minY, bw, bh, (res - dw) / 2, (res - dh) / 2, dw, dh);
    const url = small.toDataURL();
    pixelCache.set(key, url);
    return url;
  } catch { return ''; }
}

// 絵文字ごとの動き（ハート＝鼓動／星＝キラキラ／炎・音符＝バウンド 等）
function animForEmoji(emoji: string): string {
  if (/[❤♥]|❤|🧡|💛|💚|💙|💜|🤍|🤎|🖤|🩷|💗|💕|💖|💘|💝|😍|🥰|😘|😻/.test(emoji)) return 'retro-heartbeat';
  if (/⭐|🌟|✨|💫|🎆|🎇|🌠|🔆|😆|😂|🤣/.test(emoji)) return 'retro-sparkle';
  if (/🌸|🌺|🌷|🌹|🌻|💐|🍀|☘|🌈|🎡|🎠|🌀/.test(emoji)) return 'retro-spin';
  if (/😢|😭|😥|😪|💧|🥺|😰|😱|😨/.test(emoji)) return 'retro-wiggle';
  return 'retro-bounce';
}

/** 絵文字1つをガラケー風ドット絵で表示（res が小さいほど粗い） */
export function PixelEmoji({ emoji, size = 22, res = 11, className }: { emoji: string; size?: number; res?: number; className?: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => { setUrl(emojiToPixelDataUrl(emoji, res)); }, [emoji, res]);
  if (!url) {
    // 生成前（SSR/初回）は通常の絵文字でフォールバック
    return <span className={className} style={{ fontSize: size * 0.9, lineHeight: 1, display: 'inline-block', verticalAlign: 'middle' }}>{emoji}</span>;
  }
  return (
    <img
      src={url}
      alt={emoji}
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, imageRendering: 'pixelated', display: 'inline-block', verticalAlign: 'middle' }}
    />
  );
}

export const VEGETABLES = [
  ['carrot','にんじん'],['potato','じゃがいも'],['sweet-potato','さつまいも'],['daikon','大根'],['turnip','かぶ'],['radish','ラディッシュ'],['burdock','ごぼう'],['lotus-root','れんこん'],['ginger','しょうが'],['taro','さといも'],['konjac','こんにゃく芋'],['yam','長いも'],
  ['lettuce','レタス'],['cabbage','キャベツ'],['napa-cabbage','白菜'],['spinach','ほうれん草'],['komatsuna','小松菜'],['bok-choy','チンゲンサイ'],['mizuna','水菜'],['red-leaf-lettuce','サニーレタス'],['broccoli','ブロッコリー'],['cauliflower','カリフラワー'],['kale','ケール'],['red-cabbage','紫キャベツ'],
  ['tomato','トマト'],['cherry-tomato','ミニトマト'],['eggplant','なす'],['cucumber','きゅうり'],['zucchini','ズッキーニ'],['yellow-zucchini','黄ズッキーニ'],['green-pepper','ピーマン'],['paprika','パプリカ'],['pumpkin','かぼちゃ'],['corn','とうもろこし'],['okra','オクラ'],['goya','ゴーヤ'],
  ['edamame','枝豆'],['broad-bean','そら豆'],['green-peas','グリーンピース'],['snap-pea','スナップエンドウ'],['green-bean','インゲン'],
  ['shiitake','しいたけ'],['enoki','えのき'],['shimeji','しめじ'],['eringi','エリンギ'],['maitake','まいたけ'],['mushroom','マッシュルーム'],
  ['scallion','ねぎ'],['long-scallion','長ねぎ'],['chive','ニラ'],['celery','セロリ'],['shiso','しそ'],['cilantro','パクチー'],['basil','バジル'],['mint','ミント'],['parsley','パセリ'],['rosemary','ローズマリー'],
  ['garlic','にんにく'],['onion','玉ねぎ'],['chili','唐辛子'],['green-chili','青唐辛子'],['myoga','みょうが'],['beet','ビーツ'],['winter-melon','冬瓜'],['olive','オリーブ'],
] as const;

const VEGETABLE_BY_LABEL = Object.fromEntries(VEGETABLES.map(([id, label]) => [label, id]));

export function VegetableEmoji({ id, label, size = 24 }: { id?: string; label?: string; size?: number }) {
  const resolvedId = id ?? (label ? VEGETABLE_BY_LABEL[label] : undefined);
  if (!resolvedId) return null;
  const resolvedLabel = label ?? VEGETABLES.find(([candidate]) => candidate === resolvedId)?.[1] ?? '野菜';
  return <img src={`/vegetables/${resolvedId}.gif`} width={size} height={size} alt={resolvedLabel} title={resolvedLabel} className="inline-block shrink-0 align-middle [image-rendering:pixelated]" />;
}

// 1 cell = 3 CSS px  (3px/cell × 7cells = 21px per sprite, ガラケーらしい小サイズ)
const C = 3;

type Px = [number, number, string]; // [col, row, color]

// text-map → pixel list  ("." and unknown chars = empty)
function parseMap(src: string, pal: Record<string, string>): Px[] {
  const px: Px[] = [];
  src.trim().split('\n').forEach((row, r) => {
    row.split('').forEach((ch, c) => {
      if (pal[ch]) px.push([c, r, pal[ch]]);
    });
  });
  return px;
}

function PixelSprite({
  px,
  w,
  h,
  scale = 1,
  className,
}: {
  px: Px[];
  w: number;
  h: number;
  scale?: number;
  className?: string;
}) {
  const sw = w * C * scale;
  const sh = h * C * scale;
  return (
    <svg
      width={sw}
      height={sh}
      viewBox={`0 0 ${w * C} ${h * C}`}
      style={{ imageRendering: 'pixelated', display: 'inline-block', verticalAlign: 'middle' }}
      className={className}
      aria-hidden
    >
      {px.map(([x, y, col], i) => (
        <rect key={i} x={x * C} y={y * C} width={C} height={C} fill={col} />
      ))}
    </svg>
  );
}

// ── スプライト定義 ───────────────────────────────────────────

// キラキラスター 7×7  — 4方向放射 + 白いハイライト
const SPARKLE_PX = parseMap(
  `...Y...
...Y...
.W.Y.W.
YYYYYYY
.W.Y.W.
...Y...
...Y...`,
  { Y: '#FFDD00', W: '#FFFAAA' }
);

// ハート 8×7  — 上2つのふくらみ + 下に向かって収束
const HEART_PX = parseMap(
  `.PP..PP.
PPPPPPPP
PPPPPPPP
.PPPPPP.
..PPPP..
...PP...
....P...`,
  { P: '#FF77AA' }
);

// お花 7×7  — ピンクの円形ボディ + 黄色のチェッカーセンター
const FLOWER_PX = parseMap(
  `..ppp..
.ppppp.
ppYyYpp
ppyYypp
ppYyYpp
.ppppp.
..ppp..`,
  { p: '#FF99CC', Y: '#FFDD00', y: '#FFBB00' }
);

// 音符 5×7  — 8分音符 (♪)
const NOTE_PX = parseMap(
  `.VVV.
.VVV.
.V...
.V...
.V...
VV...
VV...`,
  { V: '#BB77EE' }
);

// メール封筒 9×7  — V型フラップ付き (AppHeaderロゴ用)
const MAIL_PX = parseMap(
  `DDDDDDDDD
DlllllllD
DlWlllWlD
DllWlWllD
DlllWlllD
DlllllllD
DDDDDDDDD`,
  { D: '#DD5588', l: '#FFCCDD', W: '#FFFFFF' }
);

// リボン 9×7  — 蝶ネクタイ型
const RIBBON_PX = parseMap(
  `P.......P
PP.....PP
.PP...PP.
..PPPPP..
.PP...PP.
PP.....PP
P.......P`,
  { P: '#FF88BB' }
);

// ミニスター 5×5  — 小さいキラキラ
const MINI_STAR_PX = parseMap(
  `..Y..
.YwY.
YwYwY
.YwY.
..Y..`,
  { Y: '#FFDD00', w: '#FFFACC' }
);

// レインボー 9×5  — 半円アーチ
const RAINBOW_PX = parseMap(
  `....R....
...ROO...
..ROYYOO.
.ROYYGGOO
ROYYGGBB.`,
  { R: '#FF4444', O: '#FF9900', Y: '#FFDD00', G: '#44CC66', B: '#4499FF' }
);

// スマイル 7×7
const SMILE_PX = parseMap(
  `.YYYYY.
YYYYYYY
YKYYYKY
YYYYYYY
YKYYYKY
.YKKKY.
.YYYYY.`,
  { Y: '#FFCC33', K: '#7A4A1A' }
);

// なきがお 7×7（青い涙つき）
const CRY_PX = parseMap(
  `.YYYYY.
YYYYYYY
YKYYYKY
YBYYYBY
YKYYYKY
.YKKKY.
.YYYYY.`,
  { Y: '#FFCC33', K: '#7A4A1A', B: '#4AA8FF' }
);

// つき 7×7（三日月）
const MOON_PX = parseMap(
  `..MMM..
.MM....
MM.....
MM.....
MM.....
.MM....
..MMM..`,
  { M: '#FFD24A' }
);

// クローバー 7×7（四つ葉）
const CLOVER_PX = parseMap(
  `.G...G.
GGG.GGG
GGGGGGG
...S...
GGGGGGG
GGG.GGG
.G.S.G.`,
  { G: '#4CC66A', S: '#2E7D46' }
);

// ダイヤ 7×7（宝石）
const GEM_PX = parseMap(
  `.CCCCC.
CWCCWCC
.CCCCC.
.CCCCC.
..CCC..
..CCC..
...C...`,
  { C: '#5AD1FF', W: '#EAFBFF' }
);

// おうかん 7×6（王冠）
const CROWN_PX = parseMap(
  `Y..Y..Y
YY.Y.YY
YYYYYYY
YYYYYYY
YRYRYRY
YYYYYYY`,
  { Y: '#FFC93A', R: '#FF5A7A' }
);

// ほのお 7×7（炎）
const FIRE_PX = parseMap(
  `...R...
..ROR..
.ROYOR.
ROYYYOR
ROYWYOR
.ROYOR.
..ROR..`,
  { R: '#FF5A2A', O: '#FF9A2A', Y: '#FFD24A', W: '#FFF3C0' }
);

// いなずま 7×7（稲妻）
const BOLT_PX = parseMap(
  `....YY.
...YY..
..YYY..
.YYYYY.
...YY..
..YY...
.YY....`,
  { Y: '#FFD400' }
);

// ねこ 7×7（猫の顔）
const CAT_PX = parseMap(
  `E.....E
EE...EE
EEEEEEE
EKEEEKE
EEEPEEE
EEEEEEE
.EEEEE.`,
  { E: '#E0A25A', K: '#3A2A1A', P: '#FF88AA' }
);

// コーヒー 7×7（マグカップ + 湯気）
const COFFEE_PX = parseMap(
  `..s.s..
..s.s..
WWWWWH.
WCCCWH.
WCCCWH.
WWWWW..
.WWW...`,
  { s: '#C9C9C9', W: '#EFE4D0', C: '#8A5A2A', H: '#EFE4D0' }
);

// ソフトクリーム 7×7
const ICECREAM_PX = parseMap(
  `..WWW..
.WWWWW.
WWWWWWW
.WWWWW.
..CCC..
..CCC..
...C...`,
  { W: '#FFD6E6', C: '#E0A85A' }
);

// ゲーム 7×5（コントローラー）
const GAME_PX = parseMap(
  `.GGGGG.
GGGGGGG
GWGGGWG
GGGGGGG
.G...G.`,
  { G: '#6A5AD0', W: '#FFFFFF' }
);

// ── エクスポートコンポーネント ───────────────────────────────

export function RetroStar({ scale = 1 }: { scale?: number }) {
  return (
    <span className="retro-sparkle" style={{ display: 'inline-block' }}>
      <PixelSprite px={SPARKLE_PX} w={7} h={7} scale={scale} />
    </span>
  );
}

export function RetroHeart({ scale = 1 }: { scale?: number }) {
  return (
    <span className="retro-heartbeat" style={{ display: 'inline-block' }}>
      <PixelSprite px={HEART_PX} w={8} h={7} scale={scale} />
    </span>
  );
}

export function RetroFlower({ scale = 1 }: { scale?: number }) {
  return (
    <span className="retro-spin" style={{ display: 'inline-block' }}>
      <PixelSprite px={FLOWER_PX} w={7} h={7} scale={scale} />
    </span>
  );
}

export function RetroNote({ scale = 1 }: { scale?: number }) {
  return (
    <span className="retro-bounce" style={{ display: 'inline-block' }}>
      <PixelSprite px={NOTE_PX} w={5} h={7} scale={scale} />
    </span>
  );
}

export function RetroMail({ scale = 1 }: { scale?: number }) {
  return (
    <span className="retro-wiggle" style={{ display: 'inline-block' }}>
      <PixelSprite px={MAIL_PX} w={9} h={7} scale={scale} />
    </span>
  );
}

export function RetroRibbon({ scale = 1 }: { scale?: number }) {
  return (
    <span className="retro-heartbeat" style={{ display: 'inline-block' }}>
      <PixelSprite px={RIBBON_PX} w={9} h={7} scale={scale} />
    </span>
  );
}

export function RetroMiniStar({ scale = 1 }: { scale?: number }) {
  return (
    <span className="retro-sparkle" style={{ display: 'inline-block' }}>
      <PixelSprite px={MINI_STAR_PX} w={5} h={5} scale={scale} />
    </span>
  );
}

export function RetroRainbow({ scale = 1 }: { scale?: number }) {
  return (
    <span className="retro-bounce" style={{ display: 'inline-block' }}>
      <PixelSprite px={RAINBOW_PX} w={9} h={5} scale={scale} />
    </span>
  );
}

export function RetroSmile({ scale = 1 }: { scale?: number }) { return <span className="retro-bounce" style={{ display: 'inline-block' }}><PixelSprite px={SMILE_PX} w={7} h={7} scale={scale} /></span>; }
export function RetroCry({ scale = 1 }: { scale?: number }) { return <span className="retro-bounce" style={{ display: 'inline-block' }}><PixelSprite px={CRY_PX} w={7} h={7} scale={scale} /></span>; }
export function RetroMoon({ scale = 1 }: { scale?: number }) { return <span className="retro-bounce" style={{ display: 'inline-block' }}><PixelSprite px={MOON_PX} w={7} h={7} scale={scale} /></span>; }
export function RetroClover({ scale = 1 }: { scale?: number }) { return <span className="retro-bounce" style={{ display: 'inline-block' }}><PixelSprite px={CLOVER_PX} w={7} h={7} scale={scale} /></span>; }
export function RetroGem({ scale = 1 }: { scale?: number }) { return <span className="retro-bounce" style={{ display: 'inline-block' }}><PixelSprite px={GEM_PX} w={7} h={7} scale={scale} /></span>; }
export function RetroCrown({ scale = 1 }: { scale?: number }) { return <span className="retro-bounce" style={{ display: 'inline-block' }}><PixelSprite px={CROWN_PX} w={7} h={6} scale={scale} /></span>; }
export function RetroFire({ scale = 1 }: { scale?: number }) { return <span className="retro-heartbeat" style={{ display: 'inline-block' }}><PixelSprite px={FIRE_PX} w={7} h={7} scale={scale} /></span>; }
export function RetroBolt({ scale = 1 }: { scale?: number }) { return <span className="retro-bounce" style={{ display: 'inline-block' }}><PixelSprite px={BOLT_PX} w={7} h={7} scale={scale} /></span>; }
export function RetroCat({ scale = 1 }: { scale?: number }) { return <span className="retro-bounce" style={{ display: 'inline-block' }}><PixelSprite px={CAT_PX} w={7} h={7} scale={scale} /></span>; }
export function RetroCoffee({ scale = 1 }: { scale?: number }) { return <span className="retro-bounce" style={{ display: 'inline-block' }}><PixelSprite px={COFFEE_PX} w={7} h={7} scale={scale} /></span>; }
export function RetroIcecream({ scale = 1 }: { scale?: number }) { return <span className="retro-bounce" style={{ display: 'inline-block' }}><PixelSprite px={ICECREAM_PX} w={7} h={7} scale={scale} /></span>; }
export function RetroGame({ scale = 1 }: { scale?: number }) { return <span className="retro-bounce" style={{ display: 'inline-block' }}><PixelSprite px={GAME_PX} w={7} h={5} scale={scale} /></span>; }

// ── ショートコードシステム ─────────────────────────────────

// ショートコード → レンダリング関数
const CODE_RENDER: Record<string, () => React.ReactElement> = {
  '[★]':  () => <RetroStar  scale={0.85} />,
  '[♥]':  () => <RetroHeart scale={0.85} />,
  '[♪]':  () => <RetroNote  scale={0.85} />,
  '[✿]':  () => <RetroFlower scale={0.85} />,
  '[✉]':  () => <RetroMail  scale={0.85} />,
  '[🎀]': () => <RetroRibbon scale={0.85} />,
  '[⭐]': () => <RetroMiniStar scale={0.85} />,
  '[🌈]': () => <RetroRainbow scale={0.7} />,
  '[😊]': () => <RetroSmile scale={0.85} />,
  '[😭]': () => <RetroCry scale={0.85} />,
  '[🌙]': () => <RetroMoon scale={0.85} />,
  '[🍀]': () => <RetroClover scale={0.85} />,
  '[💎]': () => <RetroGem scale={0.85} />,
  '[👑]': () => <RetroCrown scale={0.85} />,
  '[🔥]': () => <RetroFire scale={0.85} />,
  '[⚡]': () => <RetroBolt scale={0.85} />,
  '[🐱]': () => <RetroCat scale={0.85} />,
  '[☕]': () => <RetroCoffee scale={0.85} />,
  '[🍦]': () => <RetroIcecream scale={0.85} />,
  '[🎮]': () => <RetroGame scale={0.85} />,
};

// ピッカーに表示する順番・ラベル
export const RETRO_CODES: { code: string; label: string }[] = [
  { code: '[★]',  label: 'キラキラ' },
  { code: '[♥]',  label: 'ハート'   },
  { code: '[♪]',  label: '音符'     },
  { code: '[✿]',  label: 'お花'     },
  { code: '[✉]',  label: 'メール'   },
  { code: '[🎀]', label: 'リボン'   },
  { code: '[⭐]', label: 'スター'   },
  { code: '[🌈]', label: 'にじ'     },
  { code: '[😊]', label: 'スマイル' },
  { code: '[😭]', label: 'なき'     },
  { code: '[🌙]', label: 'つき'     },
  { code: '[🍀]', label: 'クローバー' },
  { code: '[💎]', label: 'ダイヤ'   },
  { code: '[👑]', label: 'おうかん' },
  { code: '[🔥]', label: 'ほのお'   },
  { code: '[⚡]', label: 'いなずま' },
  { code: '[🐱]', label: 'ねこ'     },
  { code: '[☕]', label: 'コーヒー' },
  { code: '[🍦]', label: 'アイス'   },
  { code: '[🎮]', label: 'ゲーム'   },
];

// ショートコードを検索する正規表現（RETRO_CODES から自動生成）
const CODE_RE = new RegExp(
  '(' + [...RETRO_CODES.map((c) => c.code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), '\\[野菜:[^\\]]+\\]'].join('|') + ')',
  'g'
);

/** 文字列が単一のレトロコードか（＝ピクセルデコ・スタンプか） */
export function isRetroCode(s: string): boolean {
  return !!CODE_RENDER[s] || /^\[野菜:[^\]]+\]$/.test(s);
}

/** テキスト中のショートコードをアニメSVGに変換して表示 */
export function RetroText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(CODE_RE);
  return (
    <span className={className} style={{ wordBreak: 'break-word' }}>
      {parts.map((part, i) => {
        const factory = CODE_RENDER[part];
        const vegetable = part.match(/^\[野菜:([^\]]+)\]$/)?.[1];
        return factory
          ? <span key={i} style={{ display: 'inline-block', verticalAlign: 'middle', margin: '0 1px' }}>{factory()}</span>
          : vegetable && VEGETABLE_BY_LABEL[vegetable]
            ? <VegetableEmoji key={i} label={vegetable} />
          : <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </span>
  );
}

/** テキストエリアの上に表示する絵文字ピッカーボタン列 */
export function RetroEmojiPicker({ onInsert }: { onInsert: (code: string) => void }) {
  const [vegetablesOpen, setVegetablesOpen] = React.useState(false);
  return (
    <div className="rounded-2xl bg-base px-3 py-2">
      <div className="flex gap-1.5 overflow-x-auto">
        <button type="button" onClick={() => setVegetablesOpen(!vegetablesOpen)} aria-expanded={vegetablesOpen} className={`flex shrink-0 items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-black shadow-card transition ${vegetablesOpen ? 'bg-pink text-white' : 'bg-white text-ink'}`}>
          <VegetableEmoji id="carrot" size={22} /> 野菜
        </button>
        {RETRO_CODES.map(({ code, label }) => (
          <button key={code} type="button" title={label} aria-label={label} onClick={() => onInsert(code)} className="flex shrink-0 items-center justify-center rounded-xl bg-white p-1.5 shadow-card transition active:scale-90 hover:bg-pink/10">
            {CODE_RENDER[code]?.()}
          </button>
        ))}
      </div>
      {vegetablesOpen && (
        <div className="mt-2 grid max-h-52 grid-cols-6 gap-1.5 overflow-y-auto rounded-xl bg-white/70 p-2 sm:grid-cols-8">
          {VEGETABLES.map(([id, label]) => (
            <button key={id} type="button" title={label} aria-label={label} onClick={() => onInsert(`[野菜:${label}]`)} className="grid aspect-square place-items-center rounded-xl bg-white shadow-sm transition hover:bg-pink/10 active:scale-90">
              <VegetableEmoji id={id} label={label} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** テキストエリアのカーソル位置にショートコードを挿入する */
export function insertRetroCode(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  code: string,
  setValue: (v: string) => void
): void {
  const el = ref.current;
  if (!el) { setValue(code); return; }
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  setValue(el.value.slice(0, start) + code + el.value.slice(end));
  requestAnimationFrame(() => {
    el.selectionStart = el.selectionEnd = start + code.length;
    el.focus();
  });
}

// ── ガラケー風・手描き顔スプライト（人の顔はこちらを優先） ──────────
// パレット: Y=顔 K=目/口 P=ほお R=ハート W=白 B=青(涙) D=黒(サングラス)
const F = { Y: '#FFC93A', K: '#5A3A1A', P: '#FF7BA0', R: '#FF5A7A', W: '#FFFFFF', B: '#4AA8FF', D: '#3A2A1A' };
const FACE_HAPPY = parseMap(`.YYYYY.
YYYYYYY
YKYYYKY
PYYYYYP
YKKKKKY
.YKKKY.
.YYYYY.`, F);
const FACE_GRIN = parseMap(`.YYYYY.
YYYYYYY
YKYYYKY
YYYYYYY
KKKKKKK
KWWWWWK
.KKKKK.`, F);
const FACE_LAUGH = parseMap(`.YYYYY.
YYYYYYY
KYKYKYK
YYYYYYY
KKKKKKK
YKWWWKY
.YKKKY.`, F);
const FACE_LOVE = parseMap(`.YYYYY.
YRYYYRY
RRRYRRR
YRYYYRY
YYYYYYY
YKKKKKY
.YYYYY.`, F);
const FACE_WINK = parseMap(`.YYYYY.
YYYYYYY
YKYYKKY
PYYYYYP
YKKKKKY
.YKKKY.
.YYYYY.`, F);
const FACE_COOL = parseMap(`.YYYYY.
YYYYYYY
DDDDDDD
YDDYDDY
YYYYYYY
.YKKKY.
.YYYYY.`, F);
const FACE_SURPRISE = parseMap(`.YYYYY.
YYYYYYY
YKYYYKY
YYYYYYY
YYKKKYY
YYKKKYY
.YYYYY.`, F);
const FACE_SAD = parseMap(`.YYYYY.
YYYYYYY
YKYYYKY
YBYYYBY
YYYYYYY
.YKKKY.
.YKKKY.`, F);
const FACE_ANGRY = parseMap(`.YYYYY.
YKYYYKY
YYKYKYY
YKYYYKY
YYYYYYY
.YKKKY.
.YYYYY.`, F);
const FACE_SLEEPY = parseMap(`.YYYYY.
YYYYYYY
YKKYKKY
YYYYYYY
YYYYYYY
.YKKKY.
.YYYYY.`, F);

// 絵文字 → 手描きスプライト（人の顔まわりを網羅）
const FACE_MAP: Record<string, number[][]> = {
  '😊': FACE_HAPPY as any, '🙂': FACE_HAPPY as any, '😌': FACE_HAPPY as any, '☺️': FACE_HAPPY as any, '😇': FACE_HAPPY as any,
  '😀': FACE_GRIN as any, '😃': FACE_GRIN as any, '😄': FACE_GRIN as any, '😁': FACE_GRIN as any, '😺': FACE_GRIN as any,
  '😆': FACE_LAUGH as any, '😅': FACE_LAUGH as any, '😂': FACE_LAUGH as any, '🤣': FACE_LAUGH as any, '😹': FACE_LAUGH as any,
  '😍': FACE_LOVE as any, '🥰': FACE_LOVE as any, '😘': FACE_LOVE as any, '😻': FACE_LOVE as any, '🤩': FACE_LOVE as any,
  '😉': FACE_WINK as any, '😜': FACE_WINK as any, '😝': FACE_WINK as any, '😛': FACE_WINK as any,
  '😎': FACE_COOL as any, '🤓': FACE_COOL as any, '🥸': FACE_COOL as any,
  '😮': FACE_SURPRISE as any, '😯': FACE_SURPRISE as any, '😲': FACE_SURPRISE as any, '😳': FACE_SURPRISE as any, '😱': FACE_SURPRISE as any, '🙀': FACE_SURPRISE as any,
  '😢': FACE_SAD as any, '😭': FACE_SAD as any, '😥': FACE_SAD as any, '😿': FACE_SAD as any, '🥺': FACE_SAD as any,
  '😠': FACE_ANGRY as any, '😡': FACE_ANGRY as any, '🤬': FACE_ANGRY as any, '😤': FACE_ANGRY as any,
  '😴': FACE_SLEEPY as any, '😪': FACE_SLEEPY as any, '😑': FACE_SLEEPY as any, '😐': FACE_SLEEPY as any,
};

// ── 厳選ガラケー風スタンプ（1つずつ手描き）──────────────────
// 自動ドット化はやめ、ここに載っているスプライトだけをドット絵として使う。
// 追加はこの配列に { key, px, w, h, anim, label } を足すだけ。
type GarakeItem = { key: string; px: Px[]; w: number; h: number; anim: string; label: string };
export const GARAKE_LIST: GarakeItem[] = [
  // 顔
  { key: 'happy',    px: FACE_HAPPY,    w: 7, h: 7, anim: 'retro-bounce',    label: 'にこ' },
  { key: 'grin',     px: FACE_GRIN,     w: 7, h: 7, anim: 'retro-bounce',    label: 'わらい' },
  { key: 'laugh',    px: FACE_LAUGH,    w: 7, h: 7, anim: 'retro-sparkle',   label: 'ばくわら' },
  { key: 'love',     px: FACE_LOVE,     w: 7, h: 7, anim: 'retro-heartbeat', label: 'ラブ' },
  { key: 'wink',     px: FACE_WINK,     w: 7, h: 7, anim: 'retro-bounce',    label: 'ウインク' },
  { key: 'cool',     px: FACE_COOL,     w: 7, h: 7, anim: 'retro-bounce',    label: 'クール' },
  { key: 'surprise', px: FACE_SURPRISE, w: 7, h: 7, anim: 'retro-wiggle',    label: 'びっくり' },
  { key: 'sad',      px: FACE_SAD,      w: 7, h: 7, anim: 'retro-wiggle',    label: 'なき' },
  { key: 'angry',    px: FACE_ANGRY,    w: 7, h: 7, anim: 'retro-wiggle',    label: 'おこ' },
  { key: 'sleepy',   px: FACE_SLEEPY,   w: 7, h: 7, anim: 'retro-bounce',    label: 'ねむい' },
  { key: 'cat',      px: CAT_PX,        w: 7, h: 7, anim: 'retro-bounce',    label: 'ねこ' },
  // デコ
  { key: 'heart',    px: HEART_PX,      w: 8, h: 7, anim: 'retro-heartbeat', label: 'ハート' },
  { key: 'star',     px: SPARKLE_PX,    w: 7, h: 7, anim: 'retro-sparkle',   label: 'スター' },
  { key: 'ministar', px: MINI_STAR_PX,  w: 5, h: 5, anim: 'retro-sparkle',   label: 'ミニ星' },
  { key: 'flower',   px: FLOWER_PX,     w: 7, h: 7, anim: 'retro-spin',      label: 'お花' },
  { key: 'note',     px: NOTE_PX,       w: 5, h: 7, anim: 'retro-bounce',    label: '音符' },
  { key: 'ribbon',   px: RIBBON_PX,     w: 9, h: 7, anim: 'retro-heartbeat', label: 'リボン' },
  { key: 'rainbow',  px: RAINBOW_PX,    w: 9, h: 5, anim: 'retro-bounce',    label: 'にじ' },
  { key: 'moon',     px: MOON_PX,       w: 7, h: 7, anim: 'retro-bounce',    label: 'つき' },
  { key: 'clover',   px: CLOVER_PX,     w: 7, h: 7, anim: 'retro-spin',      label: 'クローバー' },
  { key: 'gem',      px: GEM_PX,        w: 7, h: 7, anim: 'retro-sparkle',   label: 'ダイヤ' },
  { key: 'crown',    px: CROWN_PX,      w: 7, h: 6, anim: 'retro-bounce',    label: 'おうかん' },
  { key: 'fire',     px: FIRE_PX,       w: 7, h: 7, anim: 'retro-heartbeat', label: 'ほのお' },
  { key: 'bolt',     px: BOLT_PX,       w: 7, h: 7, anim: 'retro-bounce',    label: 'いなずま' },
  { key: 'coffee',   px: COFFEE_PX,     w: 7, h: 7, anim: 'retro-bounce',    label: 'コーヒー' },
  { key: 'icecream', px: ICECREAM_PX,   w: 7, h: 7, anim: 'retro-bounce',    label: 'アイス' },
  { key: 'game',     px: GAME_PX,       w: 7, h: 5, anim: 'retro-bounce',    label: 'ゲーム' },
  { key: 'mail',     px: MAIL_PX,       w: 9, h: 7, anim: 'retro-wiggle',    label: 'メール' },
];
const GARAKE_BY_KEY: Record<string, GarakeItem> = Object.fromEntries(GARAKE_LIST.map((g) => [g.key, g]));

/** 厳選ガラケースタンプを1つ描く（key指定）。 */
export function GarakeSticker({ keyId, size = 22, animated = true }: { keyId: string; size?: number; animated?: boolean }) {
  const g = GARAKE_BY_KEY[keyId];
  if (!g) return null;
  const scale = size / (Math.max(g.w, g.h) * C);
  return (
    <span className={animated ? g.anim : undefined} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <PixelSprite px={g.px} w={g.w} h={g.h} scale={scale} />
    </span>
  );
}

// ══════════════════════════════════════════════════════════════
//  フルーツ・ドット絵（仕様書ベース／1つずつ手描き）
//  ・太めの輪郭・少ない色数・24px相当でも一目で分かるシルエット
//  ・各果物に「その果物らしい」動き（globals.css の .fruit-* を割当）
//  追加はスプライト定義 → FRUIT_LIST に { key, px, w, h, anim, label } を足すだけ。
// ══════════════════════════════════════════════════════════════

// りんご 13×13 — 丸く重み。ぷにっと跳ねる(bounce)
const FR_APPLE = parseMap(
`......s......
.....ssL.....
....s.LLL....
..KKKKKKK....
.KRRRRRRRKK..
KRHHRRRRRRRK.
KRHHRRRRRRRK.
KRRRRRRRRRRK.
KRRRRRRRRRRK.
KRRRRRRRRRrK.
.KRRRRRRRrK..
.KrRRRRrrrK..
..KKrrrrKK...`,
  { K: '#8f1a12', R: '#e8392b', r: '#bf241c', H: '#ff9d90', s: '#6f4a1e', L: '#5ab23c' });

// 青りんご 13×13 — 軽快。左右にコロン(roll)
const FR_GREENAPPLE = parseMap(
`......s......
.....ssL.....
....s.LLL....
..KKKKKKK....
.KGGGGGGGKK..
KGHHGGGGGGGK.
KGHHGGGGGGGK.
KGGGGGGGGGGK.
KGGGGGGGGGGK.
KGGGGGGGGGgK.
.KGGGGGGGgK..
.KgGGGGgggK..
..KKggggKK...`,
  { K: '#3f7d18', G: '#8fd13a', g: '#6aa828', H: '#e9ffb0', s: '#6f4a1e', L: '#4e9e2e' });

// 梨 11×13 — 細い首。上だけ揺れる(wobble)
const FR_PEAR = parseMap(
`....s......
...sL......
....LL.....
....K......
...KYYK....
...KYYYK...
..KYHYYK...
.KYHYYYYK..
.KYYYYYYK..
.KYYYYYYK..
.KYYYYYYK..
..KYYYYK...
...KKKK....`,
  { K: '#9a8a2a', Y: '#d9d36a', H: '#f4f0b0', s: '#6f4a1e', L: '#5ab23c' });

// 桃 13×13 — 柔らかさ。ぷるんと弾む(bounce)
const FR_PEACH = parseMap(
`......LL.....
....KKKKK....
..KKPPPPPKK..
.KPPPPoPPPPK.
KPPHPPoPPPPK.
KPPHPPoPPPPK.
KPPPPPoPPPPK.
KPPPPPoPPPPK.
KPPPPPoPPPPK.
.KPPPPoPPPK..
.KrPPPPPPrK..
..KKrPPrKK...
...KKKKKK....`,
  { K: '#c65a86', P: '#ffb4c4', r: '#ef8aa6', o: '#f19bb2', H: '#ffe0e8', L: '#5ab23c' });

// みかん 13×13 — 丸いので転がる(roll)
const FR_ORANGE = parseMap(
`....Ll.......
....KKK......
..KKKKKKK....
.KOOOOOOOK...
KOOHHOOOOOOK.
KOOHHOOOOOOK.
KOOOOOOOOOOK.
KOOOOOOOOOOK.
KOOOOOOOOOOK.
.KOOOOOOOOK..
.KoOOOOOooK..
..KKoooOKK...
...KKKKKK....`,
  { K: '#c9631a', O: '#ff9d2e', o: '#df7c17', H: '#ffd08a', L: '#4e9e2e', l: '#6fbf3a' });

// レモン 13×10 — 横長の楕円＋両端の突起で「レモンらしさ」。左右に振れる(wobble)
const FR_LEMON = parseMap(
`.....KKK.....
...KKYYYKK...
..KYHYYYYYK..
.KYHYYYYYYYK.
bKYYYYYYYYYKb
.KYYYYYYYYYK.
..KYYYYYYYK..
...KKYYYKK...
.....KKK.....
.............`,
  { K: '#c9a91a', Y: '#ffe14a', H: '#fff3a8', b: '#ffe14a' });

// スイカ 13×13 — 重い。前後にゴロン(roll)。三角スライス
const FR_WATERMELON = parseMap(
`KKKKKKKKKKKKK
KGGGGGGGGGGGK
KWWWWWWWWWWWK
KRRRRRRRRRRRK
.KRRkRRRRkRRK
.KRRRRRRRRRK.
..KRRkRRRRRK.
..KRRRRRkRK..
...KRRRRRRK..
...KRRkRRK...
....KRRRK....
.....KRK.....
......K......`,
  { K: '#2f7d34', G: '#57b34a', W: '#f3fff0', R: '#f0475e', k: '#2a2a2a' });

// バナナ 13×13 — 細長く軽い。くるっと回転(rotate)
const FR_BANANA = parseMap(
`.........bK..
........KYYK.
.......KYYYK.
......KYYYK..
.....KYYYK...
....KYYYK....
b...KYYK.....
KK.KYYK......
.KKYYYK......
.KYYYYK......
.KbYYK.......
..KKK........
.............`,
  { K: '#b98b16', Y: '#ffdd4a', b: '#7a5210' });

// ぶどう 13×13 — 粒が揺れる(shake)。房
const FR_GRAPES = parseMap(
`......S......
.....LSL.....
..KKKKKKK....
.KPPKPPKPPK..
.KPpKPpKPpK..
..KPPKPPK....
..KPpKPpK....
...KPPKP.....
...KPpKp.....
....KPK......
....KpK......
.....K.......
.............`,
  { K: '#41205e', P: '#8a4fd0', p: '#6d33b0', L: '#4e9e2e', S: '#6f4a1e' });

// さくらんぼ 13×11 — 双子。カチンと当たる(shake)
const FR_CHERRY = parseMap(
`......Ss.....
.....S.s.....
....S..sLL...
...S...s.L...
..S....s.....
.KKK..KKK....
KRHRK.KRRK...
KRRRKKKRHRK..
KRRRK.KRRRK..
.KKK...KKK...
.............`,
  { K: '#8f1a12', R: '#e8392b', H: '#ff9d90', S: '#5a8a2e', s: '#5a8a2e', L: '#5ab23c' });

// いちご 13×12 — 小さく可愛い。ぴょんぴょん(bounce)
const FR_STRAWBERRY = parseMap(
`....LGLGL....
...LLGGGLL...
....KKKKK....
..KKRRRRRKK..
.KRyRRRyRRRK.
.KRRRRRRRRRK.
.KRRyRRRyRRK.
..KRRRRRRRK..
..KRyRRRyRK..
...KRRRRRK...
....KRyRK....
.....KRK.....`,
  { K: '#9a1f16', R: '#f0435a', y: '#ffe14a', L: '#4e9e2e', G: '#6fbf3a' });

// ブルーベリー 13×12 — 小粒。ぷるぷる震える(shake)
const FR_BLUEBERRY = parseMap(
`..KKK...KKK..
.KBBBK.KBBBK.
KBBhBBKBBhBBK
KBkBBBKBBkBBK
.KBBBK.KBBBK.
..KKK...KKK..
....KKKKK....
...KBBBBBK...
..KBBhBBBK...
..KBkBBBBK...
...KBBBBK....
....KKKK.....`,
  { K: '#26306e', B: '#4a6fd0', h: '#a9c0ff', k: '#1b2350' });

// パイナップル 13×13 — 本体は重い。葉だけ揺れる(leaf)
const FR_PINEAPPLE = parseMap(
`....G.G.G....
...GGGGGGG...
..G.GGGGG.G..
....GG.GG....
....KKKKK....
..KOoOoOoOK..
.KoOoOoOoOoK.
.KOoOoOoOoOK.
.KoOoOoOoOoK.
.KOoOoOoOoOK.
..KoOoOoOoK..
..KOoOoOoOK..
...KKKKKKK...`,
  { K: '#8a5a1e', O: '#f0b93a', o: '#c98a24', G: '#4e9e2e' });

// メロン 13×13 — 重量感。上下にぽよん(bounce)。網目
const FR_MELON = parseMap(
`....Ll.......
...KKKKK.....
..KMMMMMMK...
.KMnMMnMMMK..
KMMMnMMnMMMK.
KMnMMMnMMnMK.
KMMnMMMnMMMK.
KMnMMnMMMnMK.
KMMMnMMnMMMK.
.KMnMMMnMMK..
.KMMnMMnMMK..
..KMMMMMMK...
...KKKKK.....`,
  { K: '#5a8a3a', M: '#c6e0a0', n: '#8fb86a', L: '#4e9e2e', l: '#6fbf3a' });

// ── ここから追加フルーツ（参考画像の全種類にあわせて拡充） ──

// ラズベリー — 粒の集合。小刻みに震える(shake)
const FR_RASPBERRY = parseMap(
`....LL.....
...KKKK....
..KRRRRK...
.KRoRRoRK..
.KRRoRRRK..
.KRoRRoRK..
.KRRoRRRK..
..KRoRRK...
..KRRRK....
...KKK.....`,
  { K: '#8a2350', R: '#e85a92', o: '#c23a6e', L: '#5ab23c' });

// ブラックベリー — 少し重め。ゆっくり弾む(bounce)
const FR_BLACKBERRY = parseMap(
`....LL.....
...KKKK....
..KPPPPK...
.KPoPPoPK..
.KPPoPPPK..
.KPoPPoPK..
.KPPoPPPK..
..KPoPPK...
..KPPPK....
...KKK.....`,
  { K: '#1a1030', P: '#4a2f6e', o: '#2e1c48', L: '#4e9e2e' });

// キウイ — 断面が特徴。半回転(rotate)
const FR_KIWI = parseMap(
`....fffff....
..ffGGGGGff..
.fGGGGGGGGGf.
fGGGsGGGsGGGf
fGGGGGWGGGGGf
fGsGGWWWGGsGf
fGGGGGWGGGGGf
fGGGsGGGsGGGf
.fGGGGGGGGGf.
..ffGGGGGff..
....fffff....`,
  { f: '#a5793f', G: '#8cc63f', W: '#eef7d8', s: '#2a2a2a' });

// ココナッツ — 硬い印象。ゴロンと転がる(roll)
const FR_COCONUT = parseMap(
`...KKKKKKK...
..KbbbbbbbK..
.KbhbbbbhbK..
KbbbWWWWWbbbK
KbhWWWWWWWhbK
KbbWWWWWWWbbK
KbhWWWWWWWhbK
KbbbWWWWWbbbK
.KbhbbbbhbK..
..KbbbbbbK...
...KKKKKK....`,
  { K: '#43260f', b: '#7a4a24', h: '#9a6a34', W: '#efe6d0' });

// マンゴー — 柔らかい。ゆらっと左右(wobble)
const FR_MANGO = parseMap(
`....KKKK.....
..KKRRROKK...
.KRROOOOOOK..
KRROOOOOOYYK.
KROHOOOOOYYK.
KROHOOOOOOYK.
KROOOOOOOOYK.
.KROOOOOOYK..
..KRROOOYK...
...KKKKKK....`,
  { K: '#b5471f', R: '#e8552e', O: '#ff9d2e', Y: '#ffcf4a', H: '#ffe0b0' });

// カットマンゴー — 果肉が光る(glow)。角切り
const FR_CUTMANGO = parseMap(
`.KKKKKKKKKK.
KYyYyYyYyYyK
KyYyYyYyYyYK
KYyYyYyYyYyK
KyYyYyYyYyYK
.KKYyYyYyKK.
..gKKKKKKg..
...gggggg...`,
  { K: '#c98a24', Y: '#ffdf6a', y: '#f0b028', g: '#8cc63f' });

// パパイヤ — 中の種がぷるっと(shake)
const FR_PAPAYA = parseMap(
`..KKKKKKK..
.KOOOOOOOK.
KOOOOOOOOOK
KOOsssssOOK
KOsssssssOK
KOsssssssOK
KOOsssssOOK
KOOOOOOOOOK
.KOOOOOOOK.
..KKKKKKK..`,
  { K: '#c9631a', O: '#ffa347', s: '#2a2a2a' });

// トマト — 柔らかい皮。ぷにっと潰れる(bounce)
const FR_TOMATO = parseMap(
`....GLG.....
..KKKKKKK...
.KRRRRRRRKK.
KRRHRRRRRRK.
KRRHRRRRRRRK
KRRRRRRRRRRK
KRRRRRRRRRRK
.KRRRRRRRRK.
.KrRRRRRRrK.
..KKrrrrKK..`,
  { K: '#a51f16', R: '#f0433a', r: '#c22a1f', H: '#ff8a80', G: '#4e9e2e', L: '#6fbf3a' });

// オリーブ — 小粒。ころころ転がる(roll)
const FR_OLIVE = parseMap(
`.....L....
....LLK...
....KK....
...KGGK...
..KGGGGK..
..KGHGGK..
..KGGGGK..
..KGGGGK..
...KGGK...
...KKK....`,
  { K: '#5a7a1e', G: '#8faa3a', H: '#c6d98a', L: '#6fbf3a' });

// アサイー — 粒感。ぷるっと震える(shake)
const FR_ACAI = parseMap(
`..KKK.KKK..
.KPPKKKPPK.
KPPhPKPPhPK
KPPPPKPPPPK
.KPPKKKPPK.
..KKK.KKK..
...KKKKK...
..KPPPPPK..
..KPhPPPK..
...KPPPK...`,
  { K: '#241436', P: '#5a2f7a', h: '#8a5aa8' });

// マスカット — 透明感。粒だけ少し動く(shake)
const FR_MUSCAT = parseMap(
`......S......
.....LSL.....
..KKKKKKK....
.KGGKGGKGGK..
.KGhKGhKGhK..
..KGGKGGK....
..KGhKGhK....
...KGGKG.....
...KGhKg.....
....KGK......
....KgK......`,
  { K: '#5a7a1e', G: '#b6d95a', h: '#d8eca0', g: '#8fb83a', L: '#4e9e2e', S: '#6f4a1e' });

// 巨峰 — 重量感。重そうに揺れる(wobble)
const FR_KYOHO = parseMap(
`......S......
.....LSL.....
..KKKKKKK....
.KPPKPPKPPK..
.KPpKPpKPpK..
..KPPKPPK....
..KPpKPpK....
...KPPKP.....
...KPpKp.....
....KPK......
....KpK......`,
  { K: '#2a1440', P: '#5c2f86', p: '#43206a', L: '#4e9e2e', S: '#6f4a1e' });

// 夕張メロン — 柔らかさ。少し沈む(bounce)
const FR_YUBARI = parseMap(
`....Ll.......
...KKKKK.....
..KMMMMMMK...
.KMnMMnMMMK..
KMMMnMMnMMMK.
KMnMMMnMMnMK.
KMMnMMMnMMMK.
KMnMMnMMMnMK.
KMMMnMMnMMMK.
.KMnMMMnMMK..
.KMMnMMnMMK..
..KMMMMMMK...
...KKKKK.....`,
  { K: '#8a6a2a', M: '#e6cf9a', n: '#c6a85a', L: '#4e9e2e', l: '#6fbf3a' });

// デコポン — 頭の出っ張り。頭だけ揺れる(wobble)
const FR_DEKOPON = parseMap(
`....KKK......
...KOOOK.....
..KKKKKKK....
.KOOOOOOOK...
KOOHHOOOOOOK.
KOOHHOOOOOOK.
KOOOOOOOOOOK.
KOOOOOOOOOOK.
.KOOOOOOOOK..
.KoOOOOOooK..
..KKoooOKK...
...KKKKKK....`,
  { K: '#c9631a', O: '#ff9d2e', o: '#df7c17', H: '#ffd08a' });

// ゆず — 香りの爽快感。左右小刻み(shake)
const FR_YUZU = parseMap(
`....Ll.....
...KKK.....
..KYYYYK...
.KYYYYYYK..
KYYHYYYYYK.
KYYYYYYYYK.
KYyYYYyYYK.
.KYYYYYYK..
..KYYYYK...
...KKKK....`,
  { K: '#c9a91a', Y: '#ffe14a', y: '#e8c92a', H: '#fff3a8', L: '#4e9e2e', l: '#6fbf3a' });

// ドラゴンフルーツ — 葉状の皮。ヒラヒラ揺れる(wobble)
const FR_DRAGONFRUIT = parseMap(
`....g.g......
..g.KKK.g....
...KPPPKg....
.gKPPPPPK....
KPPPPPPPPKg..
KPPHPPPPPK...
KPPHPPPPPPKg.
KPPPPPPPPK...
.gKPPPPPKg...
...KKKKK.g...
....g.g......`,
  { K: '#b02a6a', P: '#e8558f', H: '#ff9dc0', g: '#6fbf3a' });

// スターフルーツ — 星形が映える。くるっと星回転(rotate)
const FR_STARFRUIT = parseMap(
`......k......
.....kYk.....
.....kYk.....
kkkkkYYYkkkkk
.kYYYYYYYYYk.
..kYYYYYYYk..
...kYYYYYk...
..kYYkkkYYk..
..kYk...kYk..
.kYk.....kYk.
.kk.......kk.`,
  { k: '#b5a02a', Y: '#ffe14a' });

// ライチ — 殻が少し開く(open)
const FR_LYCHEE = parseMap(
`...KKKK....
..KRrRrK...
.KRrRrRrK..
KRrRWWrRK..
KRrWWWWrK..
KRrRWWrRK..
.KRrRrRK...
..KRrRK....
...KKK.....`,
  { K: '#8a1f16', R: '#e0432e', r: '#b83322', W: '#f4ece0' });

// ロンガン — 殻が開いて閉じる(open)。断面
const FR_LONGAN = parseMap(
`...KKKK....
..KttttK...
.KtWWWWtK..
KtWWWWWWtK.
KtWWksWWtK.
KtWWkkWWtK.
KtWWWWWWtK.
.KtWWWWtK..
..KttttK...
...KKK.....`,
  { K: '#7a5a2a', t: '#c9a86a', W: '#efe8d8', k: '#2a2018', s: '#3a2a1a' });

// ランブータン — 毛がフワフワ(shake)
const FR_RAMBUTAN = parseMap(
`..h.h.h.h....
.hKhKhKhKh...
h.KRRRRRK.h..
.hRRWWWRRh...
h.RRWWWWWRh..
.hRWWWWWWRh..
h.RRWWWWWR.h.
.hRRWWWRRh...
h.KRRRRRK.h..
.hKhKhKhKh...
..h.h.h.h....`,
  { K: '#8a1f16', R: '#e0432e', W: '#f2ece0', h: '#d4402a' });

// ドリアン — トゲがピクッ(shake)
const FR_DURIAN = parseMap(
`...s.s.s.s...
..sGsGsGsGs..
.sGGGGGGGGGs.
sGGGGGGGGGGGs
.sGGGGGGGGGs.
sGGGGGGGGGGGs
.sGGGGGGGGGs.
sGGGGGGGGGGGs
.sGGGGGGGGGs.
..sGsGsGsGs..
...s.s.s.s...`,
  { G: '#9aa84a', s: '#c9b06a' });

// ジャックフルーツ — 巨大感。ゆっくり上下(bounce)
const FR_JACKFRUIT = parseMap(
`....KKKKK....
..KKgGgGgKK..
.KgGgGgGgGgK.
KgGgGgGgGgGgK
KGgGgGgGgGgGK
KgGgGgGgGgGgK
KGgGgGgGgGgGK
KgGgGgGgGgGgK
.KgGgGgGgGgK.
..KKgGgGgKK..
....KKKKK....`,
  { K: '#6a7a2a', G: '#9ab84a', g: '#7a9a34' });

// アボカド — 半分状態で種がコロン(bounce)
const FR_AVOCADO = parseMap(
`....KKK....
...KDDDK...
..KDGGGDK..
.KDGGGGGDK.
.KDGGbbGDK.
KDGGbbbbGDK
KDGGbbbbGDK
.KDGGbbGDK.
.KDGGGGGDK.
.KDGGGGGDK.
..KDGGGDK..
...KDDDK...
....KKK....`,
  { K: '#3a5a1a', D: '#4e7a24', G: '#c6e08a', b: '#8a5a2a' });

// ハネデューメロン — 丸い。ぽよん(bounce)
const FR_HONEYDEW = parseMap(
`....KKKKK....
..KKMMMMMKK..
.KMMMMMMMMMK.
KMMHMMMMMMMK.
KMHMMMMMMMMK.
KMMMMMMMMMMK.
KMMMMMMMMMMK.
.KMMMMMMMMK..
..KMMMMMMK...
...KKKKKK....`,
  { K: '#7a9a4a', M: '#d6ecb0', H: '#f0f8d8' });

// 柿 — ヘタが揺れる(leaf)
const FR_PERSIMMON = parseMap(
`...LKLKL.....
...KLKLK.....
..KKKKKKK....
.KOOOOOOOK...
KOOHOOOOOOK.
KOOHOOOOOOK.
KOOOOOOOOOK.
KOOOOOOOOOK.
.KOOOOOOOK..
.KoOOOOooK..
..KKoooKK...
...KKKKK....`,
  { K: '#b5531a', O: '#ff8a2e', o: '#df6c14', H: '#ffc98a', L: '#4e9e2e' });

// 栗 — イガが少し開閉(open)
const FR_CHESTNUT = parseMap(
`....K......
...KKK.....
..KbbbK....
.KbbbbbK...
KbhbbbbK...
KbbbbbbK...
KbbbbbbbK..
.KWWWWWK...
.KWWWWWK...
..KKKKK....`,
  { K: '#4a2a12', b: '#8a5626', h: '#a5702e', W: '#e8d0a0' });

// 銀杏 — 小さい実。ぷるっと震える(shake)
const FR_GINKGO = parseMap(
`...........
..KK..KK...
.KYYK.KYYK.
KYYYKKYYYK.
KYhYKKYhYK.
KYYYKKYYYK.
.KYYK.KYYK.
..KK..KK...`,
  { K: '#b5a02a', Y: '#f0dc6a', h: '#fff0a0' });

// カシス — 集合体。粒が揺れる(shake)
const FR_CASSIS = parseMap(
`....S......
...LSL.....
..KK.KK....
.KPPKPPK...
KPhPKPhPK..
KPPPKPPPK..
.KPPKPPK...
..KKKKK....
..KPPPK....
..KPhPK....
...KKK.....`,
  { K: '#1a1030', P: '#3a2058', h: '#6a3f8a', L: '#4e9e2e', S: '#6f4a1e' });

// スグリ — 房状。房が揺れる(wobble)
const FR_CURRANT = parseMap(
`.....S.....
....SSS....
...S.S.S...
..KKKKKKK..
.KRhKRhKRhK
.KRRKRRKRRK
..KKKKKKK..
....KKK....
...KRhRK...
...KRRRK...
....KKK....`,
  { K: '#8a1f16', R: '#e8433a', h: '#ff8a80', S: '#5a8a2e' });

// クランベリー — 軽い。ぴょん(bounce)
const FR_CRANBERRY = parseMap(
`...........
..KKK.KKK..
.KRRRKRRRK.
KRRhRKRhRRK
KRRRRKRRRRK
.KRRRKRRRK.
..KKK.KKK..`,
  { K: '#8a1f16', R: '#d0342e', h: '#ff7a70' });

// グーズベリー — 丸い。ぷるっ(bounce)
const FR_GOOSEBERRY = parseMap(
`.....s.....
....KKK....
..KKGGGKK..
.KGvGGGvGK.
KGvGGGGGvGK
KGvGHGGGvGK
KGvGGGGGvGK
.KGvGGGvGK.
..KGGGGGK..
...KKKKK...`,
  { K: '#6a8a2a', G: '#c6e08a', v: '#9ab85a', H: '#eef7d8', s: '#6f4a1e' });

// 無花果 — 断面が特徴。少し開く(open)
const FR_FIG = parseMap(
`....KKK....
...KPPPK...
..KPPPPPK..
.KPpppppPK.
.KpppRRppK.
KppRRRRRppK
KpRRRRRRRpK
.KppRRRppK.
.KPpppppPK.
..KPPPPPK..
...KKKK....`,
  { K: '#4a2a5a', P: '#7a4a8a', p: '#e8a0b0', R: '#d0506a' });

// ざくろ — 実がキラッ(glow)
const FR_POMEGRANATE = parseMap(
`....K.K......
...KKKKK.....
..KKRRRKK....
.KRRRRRRRK...
KRsRsRsRsRK..
KRRsRsRsRRK..
KRsRsRsRsRK..
KRRsRsRsRRK..
.KRsRsRsRK...
..KRRRRRK....
...KKKKK.....`,
  { K: '#8a1f16', R: '#c22a2e', s: '#ff5a6e' });

// パッションフルーツ — 中身が揺れる(glow)
const FR_PASSION = parseMap(
`....KKKKK....
..KKPPPPPKK..
.KPPPPPPPPPK.
KPPyYyYyYyPPK
KPPyKyKyKyPPK
KPPYyYyYyYPPK
KPPyKyKyKyPPK
KPPyYyYyYyPPK
.KPPPPPPPPPK.
..KKPPPPPKK..
....KKKKK....`,
  { K: '#2a1838', P: '#7a4a6a', Y: '#ffe86a', y: '#e8c22a' });

// ドラゴンアイ — 瞬きのように開閉(open)
const FR_DRAGONEYE = parseMap(
`...KKKK....
..KttttK...
.KtWWWWtK..
KtWWWWWWtK.
KtWkkkWtK..
KtWkKkWtK..
KtWkkkWtK..
.KtWWWWtK..
..KttttK...
...KKK.....`,
  { K: '#7a5a2a', t: '#c9a86a', W: '#f0e8d6', k: '#3a2a1a' });

type FruitItem = { key: string; px: Px[]; anim: string; label: string };
export const FRUIT_LIST: FruitItem[] = [
  { key: 'apple',        px: FR_APPLE,        anim: 'fruit-bounce', label: 'りんご' },
  { key: 'greenapple',   px: FR_GREENAPPLE,   anim: 'fruit-roll',   label: '青りんご' },
  { key: 'pear',         px: FR_PEAR,         anim: 'fruit-wobble', label: '梨' },
  { key: 'peach',        px: FR_PEACH,        anim: 'fruit-bounce', label: '桃' },
  { key: 'orange',       px: FR_ORANGE,       anim: 'fruit-roll',   label: 'みかん' },
  { key: 'lemon',        px: FR_LEMON,        anim: 'fruit-wobble', label: 'レモン' },
  { key: 'watermelon',   px: FR_WATERMELON,   anim: 'fruit-roll',   label: 'スイカ' },
  { key: 'banana',       px: FR_BANANA,       anim: 'fruit-rotate', label: 'バナナ' },
  { key: 'grapes',       px: FR_GRAPES,       anim: 'fruit-shake',  label: 'ぶどう' },
  { key: 'cherry',       px: FR_CHERRY,       anim: 'fruit-shake',  label: 'さくらんぼ' },
  { key: 'strawberry',   px: FR_STRAWBERRY,   anim: 'fruit-bounce', label: 'いちご' },
  { key: 'blueberry',    px: FR_BLUEBERRY,    anim: 'fruit-shake',  label: 'ブルーベリー' },
  { key: 'raspberry',    px: FR_RASPBERRY,    anim: 'fruit-shake',  label: 'ラズベリー' },
  { key: 'blackberry',   px: FR_BLACKBERRY,   anim: 'fruit-bounce', label: 'ブラックベリー' },
  { key: 'pineapple',    px: FR_PINEAPPLE,    anim: 'fruit-leaf',   label: 'パイナップル' },
  { key: 'kiwi',         px: FR_KIWI,         anim: 'fruit-rotate', label: 'キウイ' },
  { key: 'coconut',      px: FR_COCONUT,      anim: 'fruit-roll',   label: 'ココナッツ' },
  { key: 'mango',        px: FR_MANGO,        anim: 'fruit-wobble', label: 'マンゴー' },
  { key: 'cutmango',     px: FR_CUTMANGO,     anim: 'fruit-glow',   label: 'カットマンゴー' },
  { key: 'papaya',       px: FR_PAPAYA,       anim: 'fruit-shake',  label: 'パパイヤ' },
  { key: 'tomato',       px: FR_TOMATO,       anim: 'fruit-bounce', label: 'トマト' },
  { key: 'olive',        px: FR_OLIVE,        anim: 'fruit-roll',   label: 'オリーブ' },
  { key: 'acai',         px: FR_ACAI,         anim: 'fruit-shake',  label: 'アサイー' },
  { key: 'muscat',       px: FR_MUSCAT,       anim: 'fruit-shake',  label: 'マスカット' },
  { key: 'kyoho',        px: FR_KYOHO,        anim: 'fruit-wobble', label: '巨峰' },
  { key: 'melon',        px: FR_MELON,        anim: 'fruit-bounce', label: 'メロン' },
  { key: 'yubari',       px: FR_YUBARI,       anim: 'fruit-bounce', label: '夕張メロン' },
  { key: 'honeydew',     px: FR_HONEYDEW,     anim: 'fruit-bounce', label: 'ハネデューメロン' },
  { key: 'dekopon',      px: FR_DEKOPON,      anim: 'fruit-wobble', label: 'デコポン' },
  { key: 'yuzu',         px: FR_YUZU,         anim: 'fruit-shake',  label: 'ゆず' },
  { key: 'dragonfruit',  px: FR_DRAGONFRUIT,  anim: 'fruit-wobble', label: 'ドラゴンフルーツ' },
  { key: 'starfruit',    px: FR_STARFRUIT,    anim: 'fruit-rotate', label: 'スターフルーツ' },
  { key: 'lychee',       px: FR_LYCHEE,       anim: 'fruit-open',   label: 'ライチ' },
  { key: 'longan',       px: FR_LONGAN,       anim: 'fruit-open',   label: 'ロンガン' },
  { key: 'rambutan',     px: FR_RAMBUTAN,     anim: 'fruit-shake',  label: 'ランブータン' },
  { key: 'durian',       px: FR_DURIAN,       anim: 'fruit-shake',  label: 'ドリアン' },
  { key: 'jackfruit',    px: FR_JACKFRUIT,    anim: 'fruit-bounce', label: 'ジャックフルーツ' },
  { key: 'avocado',      px: FR_AVOCADO,      anim: 'fruit-bounce', label: 'アボカド' },
  { key: 'persimmon',    px: FR_PERSIMMON,    anim: 'fruit-leaf',   label: '柿' },
  { key: 'chestnut',     px: FR_CHESTNUT,     anim: 'fruit-open',   label: '栗' },
  { key: 'ginkgo',       px: FR_GINKGO,       anim: 'fruit-shake',  label: '銀杏' },
  { key: 'cassis',       px: FR_CASSIS,       anim: 'fruit-shake',  label: 'カシス' },
  { key: 'currant',      px: FR_CURRANT,      anim: 'fruit-wobble', label: 'スグリ' },
  { key: 'cranberry',    px: FR_CRANBERRY,    anim: 'fruit-bounce', label: 'クランベリー' },
  { key: 'gooseberry',   px: FR_GOOSEBERRY,   anim: 'fruit-bounce', label: 'グーズベリー' },
  { key: 'fig',          px: FR_FIG,          anim: 'fruit-open',   label: '無花果' },
  { key: 'pomegranate',  px: FR_POMEGRANATE,  anim: 'fruit-glow',   label: 'ざくろ' },
  { key: 'passion',      px: FR_PASSION,      anim: 'fruit-glow',   label: 'パッションフルーツ' },
  { key: 'dragoneye',    px: FR_DRAGONEYE,    anim: 'fruit-open',   label: 'ドラゴンアイ' },
];
const FRUIT_BY_KEY: Record<string, FruitItem> = Object.fromEntries(FRUIT_LIST.map((f) => [f.key, f]));

// スプライトの実際の描画範囲（インクのある矩形）を求める
function spriteBBox(px: Px[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of px) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}

/** フルーツのドット絵を1つ描く（key指定）。
 *  実際のドット範囲を正方形にフィットさせて中央配置＝位置ズレしない。 */
export function FruitSticker({ keyId, size = 24, animated = true }: { keyId: string; size?: number; animated?: boolean }) {
  const f = FRUIT_BY_KEY[keyId];
  if (!f) return null;
  const { minX, minY, maxX, maxY } = spriteBBox(f.px);
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const side = Math.max(bw, bh);
  // 正方形の中央にインクが来るようにオフセット（余白を均等に）
  const offX = minX - (side - bw) / 2;
  const offY = minY - (side - bh) / 2;
  return (
    <span className={animated ? f.anim : undefined} style={{ display: 'inline-block', verticalAlign: 'middle', lineHeight: 0 }}>
      <svg
        width={size}
        height={size}
        viewBox={`${offX * C} ${offY * C} ${side * C} ${side * C}`}
        style={{ imageRendering: 'pixelated', display: 'block' }}
        aria-hidden
      >
        {f.px.map(([x, y, col], i) => (
          <rect key={i} x={x * C} y={y * C} width={C} height={C} fill={col} />
        ))}
      </svg>
    </span>
  );
}

/** リアクション値を正しく描く共通部品。
 *  'f:apple'=フルーツドット絵 / 'g:heart'=ガラケースタンプ / '[♥]'=ガチャ専用スプライト / それ以外=通常絵文字 */
export function ReactionGlyph({ value, size = 20 }: { value: string; size?: number }) {
  if (value.startsWith('f:')) return <FruitSticker keyId={value.slice(2)} size={size} />;
  if (value.startsWith('g:')) return <GarakeSticker keyId={value.slice(2)} size={size} />;
  const vegetable = value.match(/^\[野菜:([^\]]+)\]$/)?.[1];
  if (vegetable) return <VegetableEmoji label={vegetable} size={size} />;
  if (isRetroCode(value)) return <RetroText text={value} />;
  // 旧仕様の 'px:😊' は通常絵文字として表示（自動ドット化は廃止）
  const shown = value.startsWith('px:') ? value.slice(3) : value;
  return <span style={{ fontSize: size * 0.9, lineHeight: 1, display: 'inline-block', verticalAlign: 'middle' }}>{shown}</span>;
}
