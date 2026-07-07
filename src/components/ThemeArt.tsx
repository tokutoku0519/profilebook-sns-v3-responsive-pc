// ============================================================
//  背景テーマ用オリジナルイラスト
//
//  OS標準の絵文字に頼らず、どの端末でも同じ見た目になる
//  手描きSVG。ゆるかわ・パステル・平成プロフ帳テイスト。
//
//  【追加方法】ART にモチーフを追記し、bgThemes.ts の floaters
//  から art id で参照するだけ。
// ============================================================

import type { ReactElement } from 'react';

const INK = '#5b4a52';

/** ちいさな顔（目2つ＋にっこり口） */
function Face({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle cx={-4.5} cy={0} r={1.5} fill={INK} />
      <circle cx={4.5} cy={0} r={1.5} fill={INK} />
      <path d="M -2 3 Q 0 5 2 3" stroke={INK} strokeWidth={1.4} fill="none" strokeLinecap="round" />
    </g>
  );
}

function Blush({ x, y, gap = 8.5 }: { x: number; y: number; gap?: number }) {
  return (
    <g fill="#ff8fae" opacity={0.5}>
      <circle cx={x - gap} cy={y} r={2.1} />
      <circle cx={x + gap} cy={y} r={2.1} />
    </g>
  );
}

const ART: Record<string, ReactElement> = {
  // ── うみのなか ──────────────────────────────────────────
  octopus: (
    <g>
      <circle cx={12.5} cy={34} r={4.5} fill="#ff9db8" />
      <circle cx={21} cy={37.5} r={4.5} fill="#ff9db8" />
      <circle cx={30} cy={36.5} r={4.5} fill="#ff9db8" />
      <circle cx={37} cy={32} r={4} fill="#ff9db8" />
      <ellipse cx={24} cy={20} rx={14} ry={13.5} fill="#ffaec5" />
      <ellipse cx={24} cy={26} rx={8.5} ry={5} fill="#ffd3de" />
      <Face x={24} y={19} />
      <Blush x={24} y={23} gap={9.5} />
    </g>
  ),
  fish: (
    <g>
      <path d="M31 24 L42 15 L40 24 L42 33 Z" fill="#7fc8e8" />
      <ellipse cx={20} cy={24} rx={13} ry={9} fill="#a9def2" />
      <path d="M17 15 Q20 11 23 15" fill="#7fc8e8" />
      <ellipse cx={19} cy={28} rx={4.5} ry={2.5} fill="#7fc8e8" opacity={0.7} />
      <circle cx={13} cy={22} r={1.6} fill={INK} />
      <path d="M9.5 25 Q11 26.5 12.5 25" stroke={INK} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      <circle cx={16} cy={26} r={1.8} fill="#ff8fae" opacity={0.5} />
    </g>
  ),
  fish2: (
    <g>
      <path d="M31 24 L42 15 L40 24 L42 33 Z" fill="#ffab76" />
      <ellipse cx={20} cy={24} rx={13} ry={9} fill="#ffc79b" />
      <path d="M17 15 Q20 11 23 15" fill="#ffab76" />
      <ellipse cx={19} cy={28} rx={4.5} ry={2.5} fill="#ffab76" opacity={0.7} />
      <circle cx={13} cy={22} r={1.6} fill={INK} />
      <path d="M9.5 25 Q11 26.5 12.5 25" stroke={INK} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      <circle cx={16} cy={26} r={1.8} fill="#ff8fae" opacity={0.5} />
    </g>
  ),
  bubble: (
    <g>
      <circle cx={22} cy={26} r={12} fill="#cfeafb" opacity={0.65} />
      <circle cx={22} cy={26} r={12} fill="none" stroke="#ffffff" strokeWidth={1.5} opacity={0.8} />
      <circle cx={17.5} cy={21} r={3.2} fill="#ffffff" opacity={0.85} />
      <circle cx={37} cy={12} r={4.5} fill="#cfeafb" opacity={0.6} />
      <circle cx={35.5} cy={10.5} r={1.4} fill="#ffffff" opacity={0.85} />
    </g>
  ),
  shell: (
    <g>
      <path d="M10 26 A14 14 0 0 1 38 26 L24 42 Z" fill="#ffd9c9" />
      <path d="M24 42 L14 22 M24 42 L24 18 M24 42 L34 22" stroke="#ffab8a" strokeWidth={1.6} strokeLinecap="round" />
      <path d="M10 26 A14 14 0 0 1 38 26" fill="none" stroke="#ffab8a" strokeWidth={1.8} strokeLinecap="round" />
    </g>
  ),
  coral: (
    <g stroke="#ff9d94" strokeWidth={5} strokeLinecap="round" fill="none">
      <path d="M24 42 V18" />
      <path d="M24 30 Q17 26 15 18" />
      <path d="M24 32 Q31 28 33 21" />
      <g stroke="none" fill="#ffc7c2">
        <circle cx={24} cy={16.5} r={3} />
        <circle cx={14.5} cy={16.5} r={2.6} />
        <circle cx={33.5} cy={19.5} r={2.6} />
      </g>
    </g>
  ),
  // ── そらのうえ ──────────────────────────────────────────
  cloud: (
    <g>
      <circle cx={15} cy={27} r={8} fill="#ffffff" />
      <circle cx={25} cy={22} r={10} fill="#ffffff" />
      <circle cx={34} cy={28} r={7} fill="#ffffff" />
      <rect x={12} y={26} width={26} height={9} rx={4.5} fill="#ffffff" />
      <Face x={24} y={27} />
      <Blush x={24} y={30.5} />
    </g>
  ),
  rainbow: (
    <g fill="none" strokeLinecap="round">
      <path d="M9 34 A15 15 0 0 1 39 34" stroke="#ff9db8" strokeWidth={4} />
      <path d="M13 34 A11 11 0 0 1 35 34" stroke="#ffdf8e" strokeWidth={4} />
      <path d="M17 34 A7 7 0 0 1 31 34" stroke="#9fd8f0" strokeWidth={4} />
      <g fill="#ffffff" stroke="none">
        <circle cx={9} cy={34} r={4.5} />
        <circle cx={39} cy={34} r={4.5} />
      </g>
    </g>
  ),
  bird: (
    <g>
      <path d="M31 20 L38 18 L33 24 Z" fill="#ffdf8e" />
      <circle cx={22} cy={25} r={10.5} fill="#bfe3f7" />
      <ellipse cx={17} cy={26} rx={5.5} ry={4} fill="#8ecae6" />
      <circle cx={27} cy={21} r={1.6} fill={INK} />
      <path d="M31 25.5 L35 24.5" stroke="#f4a259" strokeWidth={2.2} strokeLinecap="round" />
      <circle cx={26} cy={26} r={2} fill="#ff8fae" opacity={0.5} />
      <path d="M19 35.5 L19 38 M25 35.5 L25 38" stroke="#f4a259" strokeWidth={1.8} strokeLinecap="round" />
    </g>
  ),
  balloon: (
    <g>
      <ellipse cx={24} cy={17} rx={9.5} ry={11.5} fill="#ffaec5" />
      <ellipse cx={20.5} cy={12.5} rx={3} ry={4} fill="#ffffff" opacity={0.6} transform="rotate(-20 20.5 12.5)" />
      <path d="M21.5 28 L24 30.5 L26.5 28 Z" fill="#ff8fae" />
      <path d="M24 30.5 Q28 36 24 42" stroke="#e88ba3" strokeWidth={1.6} fill="none" strokeLinecap="round" />
    </g>
  ),
  // ── おかしのいえ ────────────────────────────────────────
  lollipop: (
    <g>
      <rect x={22.6} y={27} width={2.8} height={15} rx={1.4} fill="#e8c9a0" />
      <circle cx={24} cy={17} r={11} fill="#ffd1e0" />
      <path d="M24 17 m0 -7 A7 7 0 1 1 17 17 A4.5 4.5 0 1 0 21.5 12.5" stroke="#ff6b9d" strokeWidth={2.6} fill="none" strokeLinecap="round" />
    </g>
  ),
  cookie: (
    <g>
      <circle cx={24} cy={24} r={13.5} fill="#eab676" />
      <circle cx={24} cy={24} r={10.5} fill="#f2c690" />
      <circle cx={19} cy={20} r={2.1} fill="#8a5a35" />
      <circle cx={28.5} cy={18.5} r={2.1} fill="#8a5a35" />
      <circle cx={22} cy={28.5} r={2.1} fill="#8a5a35" />
      <circle cx={30} cy={26.5} r={2.1} fill="#8a5a35" />
    </g>
  ),
  cupcake: (
    <g>
      <circle cx={24} cy={13.5} r={3.2} fill="#ff7a8f" />
      <circle cx={17.5} cy={22} r={5.5} fill="#fff0f5" />
      <circle cx={24} cy={18.5} r={6} fill="#fff0f5" />
      <circle cx={30.5} cy={22} r={5.5} fill="#fff0f5" />
      <path d="M14 26 H34 L31 40 H17 Z" fill="#f4a76a" />
      <path d="M19 27 L18 39 M24 27 V39 M29 27 L30 39" stroke="#dd8b4e" strokeWidth={1.4} strokeLinecap="round" />
    </g>
  ),
  candy: (
    <g>
      <path d="M15 24 L6 17 L8 24 L6 31 Z" fill="#ffc7d6" />
      <path d="M33 24 L42 17 L40 24 L42 31 Z" fill="#ffc7d6" />
      <circle cx={24} cy={24} r={9} fill="#ffaec5" />
      <path d="M19 17 Q24 24 19 31 M29 17 Q24 24 29 31" stroke="#ffffff" strokeWidth={2.2} fill="none" strokeLinecap="round" opacity={0.8} />
    </g>
  ),
  donut: (
    <g>
      <circle cx={24} cy={24} r={13} fill="#f0c48e" />
      <path d="M11 24 A13 13 0 0 1 37 24 Q34 28 31 25 Q28 30 24 26 Q19 30 16 25 Q13 28 11 24 Z" fill="#ff9db8" />
      <circle cx={24} cy={24} r={4.5} fill="#fdf3f6" />
      <rect x={17} y={17} width={3} height={1.6} rx={0.8} fill="#fff" transform="rotate(30 18.5 17.8)" />
      <rect x={28} y={15} width={3} height={1.6} rx={0.8} fill="#ffe08a" transform="rotate(-20 29.5 15.8)" />
      <rect x={33} y={21} width={3} height={1.6} rx={0.8} fill="#9fd8f0" transform="rotate(40 34.5 21.8)" />
    </g>
  ),
  cake: (
    <g>
      <circle cx={24} cy={12.5} r={4} fill="#ff5b6e" />
      <path d="M23 9 Q24 7 25.5 8.5" stroke="#5f8f4e" strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <path d="M12 21 Q16 17 24 17 Q32 17 36 21 L36 25 Q30 29 24 26 Q18 23 12 25 Z" fill="#fff5f7" />
      <rect x={12} y={25} width={24} height={5} fill="#ffb3c1" />
      <rect x={12} y={30} width={24} height={8} rx={2} fill="#fff5f7" />
    </g>
  ),
  // ── まてんろうの夜 ──────────────────────────────────────
  city: (
    <g>
      <rect x={8} y={20} width={9} height={22} rx={1.5} fill="#b9c3f0" />
      <rect x={19} y={11} width={11} height={31} rx={1.5} fill="#98a6e8" />
      <rect x={32} y={24} width={8} height={18} rx={1.5} fill="#cdd4f6" />
      <g fill="#fff7c9">
        <rect x={10.5} y={23} width={2.4} height={2.4} rx={0.6} />
        <rect x={10.5} y={29} width={2.4} height={2.4} rx={0.6} />
        <rect x={22} y={15} width={2.4} height={2.4} rx={0.6} />
        <rect x={26} y={21} width={2.4} height={2.4} rx={0.6} />
        <rect x={22} y={27} width={2.4} height={2.4} rx={0.6} />
        <rect x={34.5} y={28} width={2.4} height={2.4} rx={0.6} />
      </g>
    </g>
  ),
  moon: (
    <g>
      <path d="M30 6.5 A17.5 17.5 0 1 0 30 41.5 A13.5 13.5 0 1 1 30 6.5 Z" fill="#ffdf8e" />
      <circle cx={17} cy={20} r={1.5} fill={INK} />
      <path d="M14.5 25.5 Q16.5 27.5 18.5 25.5" stroke={INK} strokeWidth={1.4} fill="none" strokeLinecap="round" />
      <circle cx={13} cy={23} r={1.9} fill="#ff8fae" opacity={0.5} />
      <path d="M37 12 L38.2 15 L41.2 16.2 L38.2 17.4 L37 20.4 L35.8 17.4 L32.8 16.2 L35.8 15 Z" fill="#fff2c4" />
    </g>
  ),
  sparkle: (
    <g fill="#ffe08a">
      <path d="M24 8 L27.5 20.5 L40 24 L27.5 27.5 L24 40 L20.5 27.5 L8 24 L20.5 20.5 Z" />
      <circle cx={37} cy={10} r={2} fill="#fff2c4" />
    </g>
  ),
  star: (
    <g>
      <path d="M24 6 L29.3 17.6 L42 19 L32.5 27.6 L35.2 40 L24 33.6 L12.8 40 L15.5 27.6 L6 19 L18.7 17.6 Z" fill="#ffd166" />
      <Face x={24} y={24} s={0.9} />
      <Blush x={24} y={27.5} gap={7.5} />
    </g>
  ),
  taxi: (
    <g>
      <path d="M15 22 Q17 14 24 14 Q31 14 33 22 Z" fill="#ffd166" />
      <rect x={8} y={22} width={32} height={10} rx={4} fill="#ffdf8e" />
      <rect x={18} y={16.5} width={5.5} height={5.5} rx={1.5} fill="#cfeafb" />
      <rect x={25.5} y={16.5} width={5.5} height={5.5} rx={1.5} fill="#cfeafb" />
      <circle cx={15} cy={33} r={4} fill={INK} />
      <circle cx={33} cy={33} r={4} fill={INK} />
      <circle cx={15} cy={33} r={1.6} fill="#fff" />
      <circle cx={33} cy={33} r={1.6} fill="#fff" />
      <rect x={21} y={10.5} width={6} height={4} rx={1.2} fill="#5b8dd8" />
    </g>
  ),
  // ── 平成ガーリールーム ──────────────────────────────────
  ribbon: (
    <g>
      <path d="M22 24 C13 13 4 17 6.5 24 C4 31 13 35 22 24 Z" fill="#ff9db8" />
      <path d="M26 24 C35 13 44 17 41.5 24 C44 31 35 35 26 24 Z" fill="#ff9db8" />
      <path d="M20 28 L16 39 L21 36 Z" fill="#ffaec5" />
      <path d="M28 28 L32 39 L27 36 Z" fill="#ffaec5" />
      <circle cx={24} cy={24} r={4.6} fill="#ff6b9d" />
    </g>
  ),
  cassette: (
    <g>
      <rect x={7} y={13} width={34} height={22} rx={3} fill="#9b95e0" />
      <rect x={11} y={16.5} width={26} height={8} rx={2} fill="#fff5f7" />
      <circle cx={17} cy={20.5} r={2.6} fill="#ffffff" stroke="#7d76c9" strokeWidth={1.4} />
      <circle cx={31} cy={20.5} r={2.6} fill="#ffffff" stroke="#7d76c9" strokeWidth={1.4} />
      <path d="M13 30 H35" stroke="#7d76c9" strokeWidth={2} strokeLinecap="round" />
    </g>
  ),
  heart: (
    <g>
      <path d="M24 40 C10 30 6 20 12 14 C17 9.5 24 13 24 18.5 C24 13 31 9.5 36 14 C42 20 38 30 24 40 Z" fill="#ff8fb0" />
      <ellipse cx={16.5} cy={17.5} rx={3} ry={2.2} fill="#ffffff" opacity={0.6} transform="rotate(-25 16.5 17.5)" />
    </g>
  ),
  camera: (
    <g>
      <rect x={12} y={11} width={9} height={6} rx={2} fill="#ffaec5" />
      <rect x={7} y={15} width={34} height={23} rx={5} fill="#ff9db8" />
      <circle cx={24} cy={26.5} r={7.5} fill="#fff0f5" />
      <circle cx={24} cy={26.5} r={5} fill="#8ecae6" />
      <circle cx={22} cy={24.5} r={1.6} fill="#ffffff" />
      <circle cx={35} cy={20} r={1.8} fill="#fff2c4" />
    </g>
  ),
  cd: (
    <g>
      <circle cx={24} cy={24} r={13.5} fill="#dfe4ff" />
      <path d="M13 18 A12.5 12.5 0 0 1 20 12.2" stroke="#ffb3d1" strokeWidth={3} fill="none" strokeLinecap="round" />
      <path d="M35 30 A12.5 12.5 0 0 1 28 35.8" stroke="#9fd8f0" strokeWidth={3} fill="none" strokeLinecap="round" />
      <circle cx={24} cy={24} r={5.5} fill="#ffffff" />
      <circle cx={24} cy={24} r={2.2} fill="#c3cbf5" />
    </g>
  ),
  letter: (
    <g>
      <rect x={7} y={13} width={34} height={23} rx={3} fill="#fffbfc" stroke="#ffc7d6" strokeWidth={1.6} />
      <path d="M8 15 L24 27 L40 15" stroke="#ffc7d6" strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <path d="M24 36.5 C19.5 33 18 29.5 20 27.5 C21.6 26 24 27.2 24 29 C24 27.2 26.4 26 28 27.5 C30 29.5 28.5 33 24 36.5 Z" fill="#ff8fb0" />
    </g>
  ),
  // ── ほしぞらプラネタリウム ──────────────────────────────
  galaxy: (
    <g>
      <circle cx={24} cy={24} r={13.5} fill="#8d7fdb" />
      <path d="M24 24 m-8 0 A8 8 0 1 1 24 32 A5.5 5.5 0 1 0 29.5 26.5" stroke="#e8e2ff" strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <circle cx={17} cy={18} r={1.3} fill="#fff2c4" />
      <circle cx={31} cy={30} r={1.3} fill="#fff2c4" />
      <circle cx={36} cy={13} r={1.8} fill="#ffe08a" />
    </g>
  ),
  shootingstar: (
    <g>
      <path d="M6 34 L22 24 M4 26 L16 19 M12 40 L24 31" stroke="#ffe9ad" strokeWidth={2.4} strokeLinecap="round" />
      <path d="M31 8 L34.4 15.4 L42.5 16.3 L36.5 21.8 L38.2 29.7 L31 25.6 L23.8 29.7 L25.5 21.8 L19.5 16.3 L27.6 15.4 Z" fill="#ffd166" />
    </g>
  ),
  planet: (
    <g>
      <ellipse cx={24} cy={24} rx={17} ry={5.5} fill="none" stroke="#d8a06a" strokeWidth={2.6} transform="rotate(-18 24 24)" />
      <circle cx={24} cy={24} r={9.5} fill="#f0b48e" />
      <circle cx={20} cy={21} r={2.2} fill="#e89a6d" />
      <circle cx={28} cy={27} r={1.7} fill="#e89a6d" />
    </g>
  ),
  telescope: (
    <g>
      <rect x={12} y={17} width={24} height={7.5} rx={3.5} fill="#8d7fdb" transform="rotate(-28 24 21)" />
      <rect x={31} y={9} width={7} height={6} rx={2.5} fill="#6f61c4" transform="rotate(-28 34.5 12)" />
      <path d="M22 28 L15 42 M25 28 L32 42 M23.5 28 V40" stroke="#7d76c9" strokeWidth={2.4} strokeLinecap="round" />
      <circle cx={40} cy={7} r={2} fill="#ffe08a" />
    </g>
  ),
};

export function ThemeArt({ art, size = 32 }: { art: string; size?: number }) {
  const node = ART[art];
  if (!node) return null;
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden style={{ display: 'block' }}>
      {node}
    </svg>
  );
}

// ── Miriコイン（🪙の代わりに使うオリジナルアイコン） ─────────
// テキスト中に置けるよう inline-block + ベースライン調整済み。
export function CoinIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden
      style={{ display: 'inline-block', verticalAlign: '-0.15em' }}
    >
      <circle cx={24} cy={24} r={21} fill="#f2b64c" />
      <circle cx={24} cy={24} r={21} fill="none" stroke="#d9992e" strokeWidth={2.5} />
      <circle cx={24} cy={24} r={15} fill="#ffd97a" stroke="#e8ae45" strokeWidth={2} />
      <path
        d="M24 31.5 C17.5 27 15.5 22.8 18 20.2 C20 18.2 23 19.6 24 21.8 C25 19.6 28 18.2 30 20.2 C32.5 22.8 30.5 27 24 31.5 Z"
        fill="#e8963c"
      />
      <path d="M12 13 A16 16 0 0 1 20 8.5" stroke="#fff3d1" strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.9} />
    </svg>
  );
}

// ── かけら（ガチャ被りでもらえるキラキラの結晶） ─────────────
export function ShardIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden
      style={{ display: 'inline-block', verticalAlign: '-0.15em' }}
    >
      <path d="M24 4 L37 16 L31 42 L17 42 L11 16 Z" fill="#b8a5f2" />
      <path d="M24 4 L31 42 L17 42 Z" fill="#cfc2f7" />
      <path d="M24 4 L37 16 L31 42" fill="none" stroke="#9d86e8" strokeWidth={1.6} />
      <path d="M24 4 L11 16 L17 42" fill="none" stroke="#9d86e8" strokeWidth={1.6} />
      <circle cx={20} cy={14} r={2.2} fill="#ffffff" opacity={0.85} />
      <path d="M40 6 L41 9 L44 10 L41 11 L40 14 L39 11 L36 10 L39 9 Z" fill="#ffe08a" />
    </svg>
  );
}
