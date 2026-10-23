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
