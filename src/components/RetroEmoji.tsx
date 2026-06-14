'use client';

import React from 'react';

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
];

// ショートコードを検索する正規表現
const CODE_RE = /(\[★\]|\[♥\]|\[♪\]|\[✿\]|\[✉\]|\[🎀\]|\[⭐\])/g;

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
    <div className="flex gap-1.5 overflow-x-auto rounded-2xl bg-base px-3 py-2">
      {RETRO_CODES.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          title={label}
          onClick={() => onInsert(code)}
          className="flex shrink-0 items-center justify-center rounded-xl bg-white p-1.5 shadow-card transition active:scale-90 hover:bg-pink/10"
        >
          {CODE_RENDER[code]?.()}
        </button>
      ))}
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
