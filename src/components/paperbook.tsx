'use client';

// ============================================================
// 紙のプロフィール帳 共通コンポーネント（Phase A）
// デザイントークン/CSSは globals.css の pb-* を使用。
// 装飾の回転・位置は固定値（同じ画面で安定表示。ランダムは使わない）。
// 後から他画面へも流用できるよう、見た目はここに集約する。
// ============================================================
import React from 'react';

/** マスキングテープ風の見出しラベル（印刷文字） */
export function TapeLabel({
  children,
  tone = 'cream',
  rotate = -2,
  className = '',
}: {
  children: React.ReactNode;
  tone?: 'cream' | 'sax';
  rotate?: number;
  className?: string;
}) {
  return (
    <span
      className={`pb-tape ${tone === 'sax' ? 'pb-tape-sax' : ''} pb-pop text-sm font-bold ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {children}
    </span>
  );
}

/** ポラロイド/シール貼り風の写真フレーム（少し傾ける） */
export function PolaroidPhoto({
  src,
  emoji,
  caption,
  rotate = -3,
  size = 92,
}: {
  src?: string;
  emoji?: string;
  caption?: string;
  rotate?: number;
  size?: number;
}) {
  return (
    <div className="pb-polaroid shrink-0" style={{ transform: `rotate(${rotate}deg)`, width: size + 14 }}>
      <div
        className="grid place-items-center overflow-hidden rounded-[2px] bg-cream text-4xl"
        style={{ width: size, height: size }}
      >
        {src ? <img src={src} alt="avatar" className="h-full w-full object-cover" /> : (emoji || '📷')}
      </div>
      {caption !== undefined && (
        <p className="mt-1 text-center text-[11px] font-bold text-ink prof-hand leading-tight">
          {caption}
        </p>
      )}
    </div>
  );
}

/** 丸シールのバッジ（絵文字や短文を貼る） */
export function Sticker({
  children,
  color = 'rgb(255 236 179)',
  rotate = 0,
  size = 34,
  className = '',
  title,
}: {
  children: React.ReactNode;
  color?: string;
  rotate?: number;
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`pb-sticker text-[13px] font-black leading-none text-ink ${className}`}
      style={{ background: color, width: size, height: size, transform: `rotate(${rotate}deg)` }}
    >
      {children}
    </span>
  );
}

/** 色紙シート。variant で地紋（方眼/罫線/無地）、tilt で微回転。 */
export function PaperSheet({
  children,
  variant = 'plain',
  tilt = 0,
  className = '',
  style,
}: {
  children: React.ReactNode;
  variant?: 'plain' | 'grid' | 'ruled';
  tilt?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const tex = variant === 'grid' ? 'pb-grid' : variant === 'ruled' ? 'pb-ruled' : '';
  return (
    <section
      className={`pb-sheet ${tex} ${className}`}
      style={{ transform: tilt ? `rotate(${tilt}deg)` : undefined, ...style }}
    >
      {children}
    </section>
  );
}

/** 記入欄：印刷ラベル＋手書き回答（点線ベースライン）。
 *  空欄でも大きな空白を作らず、薄い記入線だけ見せる。 */
export function PaperFieldLine({
  label,
  value,
  placeholder = '　　　　',
}: {
  label: string;
  value?: string;
  placeholder?: string;
}) {
  const v = (value ?? '').trim();
  return (
    <div className="pb-fieldline">
      <span className="pb-fieldline-label">{label}</span>
      <span className="pb-fieldline-value text-[16px] leading-snug text-ink prof-hand">
        {v || <span className="font-medium text-muted/35">{placeholder}</span>}
      </span>
    </div>
  );
}

/** シール風バッジ（ラベル付き。インデックス/称号などに） */
export function StickerBadge({
  children,
  tone = 'cream',
  rotate = -2,
  className = '',
}: {
  children: React.ReactNode;
  tone?: 'cream' | 'sax' | 'coral' | 'white';
  rotate?: number;
  className?: string;
}) {
  const bg =
    tone === 'sax' ? 'rgb(206 227 255)'
    : tone === 'coral' ? 'rgb(255 122 105)'
    : tone === 'white' ? '#fff'
    : 'rgb(var(--color-cream))';
  const fg = tone === 'coral' ? 'text-white' : 'text-ink';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black leading-none ${fg} ${className}`}
      style={{ background: bg, boxShadow: 'inset 0 0 0 2px rgba(255,255,255,.7), 0 2px 4px rgba(0,0,0,.14)', transform: `rotate(${rotate}deg)` }}
    >
      {children}
    </span>
  );
}

/** 手書き風テキスト（回答・本文・自己紹介向け） */
export function HandwrittenText({
  children,
  className = '',
  as: As = 'span',
}: {
  children: React.ReactNode;
  className?: string;
  as?: any;
}) {
  return <As className={`prof-hand ${className}`}>{children}</As>;
}

/** Miriらしいチップ（汎用pillより紙シール寄り）。onClick があればボタン。 */
export function CapsulePill({
  children,
  active = false,
  onClick,
  disabled,
  title,
  className = '',
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const base = `inline-flex items-center justify-center gap-1 rounded-full px-3.5 font-black leading-none transition`;
  const look = active
    ? 'bg-pink text-white shadow-sm'
    : 'bg-cream text-ink ring-1 ring-black/10';
  if (onClick) {
    // 押せるチップ：44px近いタップ領域＋“貼れるシール”の立体感（下影）で装飾と区別する
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title}
        aria-pressed={active}
        className={`${base} ${look} min-h-[38px] py-2 text-[12px] cursor-pointer shadow-[0_2px_0_rgba(0,0,0,.10)] hover:-translate-y-px active:translate-y-px active:shadow-none disabled:cursor-wait disabled:opacity-60 ${active ? '' : 'hover:bg-pink/10'} ${className}`}
      >
        {children}
      </button>
    );
  }
  return <span title={title} className={`${base} ${look} py-1.5 text-[11px] ${className}`}>{children}</span>;
}

/** ノート風セクション：地紋つき紙シート＋マステ見出し＋シールアイコン。 */
export function NotebookSection({
  title,
  icon,
  tone = 'cream',
  variant = 'plain',
  right,
  tilt = 0,
  className = '',
  children,
}: {
  title: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'cream' | 'sax';
  variant?: 'plain' | 'grid' | 'ruled';
  right?: React.ReactNode;
  tilt?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <PaperSheet variant={variant} tilt={tilt} className={`p-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon != null && <Sticker color="rgb(206 227 255)" rotate={-6} size={28}>{icon}</Sticker>}
          <TapeLabel tone={tone} rotate={-1}>{title}</TapeLabel>
        </div>
        {right}
      </div>
      {children}
    </PaperSheet>
  );
}

/** なかよし度などの“育つハート”メーター。シール台紙に貼っていくイメージで、
 *  貼れたハート＝白フチのシール、まだのハート＝点線の空き枠（はっきり見える濃さ）。 */
export function HeartMeter({ level, max = 5 }: { level: number; max?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5" role="img" aria-label={`なかよし度 ${level} / ${max}`}>
      {Array.from({ length: max }).map((_, i) =>
        i < level ? (
          <span
            key={i}
            aria-hidden
            className="grid h-8 w-8 place-items-center rounded-full bg-white text-lg leading-none"
            style={{ boxShadow: 'inset 0 0 0 2px rgba(255,255,255,.9), 0 2px 4px rgba(0,0,0,.18)' }}
          >
            💗
          </span>
        ) : (
          <span
            key={i}
            aria-hidden
            className="grid h-8 w-8 place-items-center rounded-full border-2 border-dashed border-pink/45 bg-white/60 text-[15px] font-black leading-none text-pink/70"
          >
            ♡
          </span>
        ),
      )}
      <span className="ml-1 text-[11px] font-black text-muted">{level}/{max}</span>
    </span>
  );
}
