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
  '(' + RETRO_CODES.map((c) => c.code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')',
  'g'
);

/** 文字列が単一のレトロコードか（＝ピクセルデコ・スタンプか） */
export function isRetroCode(s: string): boolean {
  return !!CODE_RENDER[s];
}

/** テキスト中のショートコードをアニメSVGに変換して表示 */
export function RetroText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(CODE_RE);
  return (
    <span className={className} style={{ wordBreak: 'break-word' }}>
      {parts.map((part, i) => {
        const factory = CODE_RENDER[part];
        return factory
          ? <span key={i} style={{ display: 'inline-block', verticalAlign: 'middle', margin: '0 1px' }}>{factory()}</span>
          : <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </span>
  );
}

/** テキストエリアの上に表示する絵文字ピッカーボタン列 */
export function RetroEmojiPicker({ onInsert }: { onInsert: (code: string) => void }) {
  return (
    <div className="rounded-2xl bg-base px-3 py-2">
      <div className="flex gap-1.5 overflow-x-auto">
        {RETRO_CODES.map(({ code, label }) => (
          <button key={code} type="button" title={label} aria-label={label} onClick={() => onInsert(code)} className="flex shrink-0 items-center justify-center rounded-xl bg-white p-1.5 shadow-card transition active:scale-90 hover:bg-pink/10">
            {CODE_RENDER[code]?.()}
          </button>
        ))}
      </div>
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

/** リアクション値を正しく描く共通部品。
 *  'g:heart'=ガラケースタンプ / '[♥]'=ガチャ専用スプライト / それ以外=通常絵文字 */
export function ReactionGlyph({ value, size = 20 }: { value: string; size?: number }) {
  if (value.startsWith('g:')) return <GarakeSticker keyId={value.slice(2)} size={size} />;
  if (isRetroCode(value)) return <RetroText text={value} />;
  // 旧仕様の 'px:😊' は通常絵文字として表示（自動ドット化は廃止）
  const shown = value.startsWith('px:') ? value.slice(3) : value;
  return <span style={{ fontSize: size * 0.9, lineHeight: 1, display: 'inline-block', verticalAlign: 'middle' }}>{shown}</span>;
}
