'use client';
// ============================================================
// わたしのペン：ユーザーごとの「字」（書体・インクの色・文字の大きさ）
//
// ・保存先は本人の book.__pen（profile_book の jsonb。DBスキーマ変更なし）。
//   他人には get_visible_book 経由で公開される（コイン等の内部キーとは別）。
// ・保存するのは下の一覧の「ID」だけ。CSS の値や任意の文字列は保存しない
//   （normalizePen で必ずホワイトリストに丸める＝不正な値が来ても既定に戻る）。
// ・表示はプロフ帳・お題の回答で共通。日記・ブログ（Unit 4）にも同じ形で使える。
//
// フォントはすべて Google Fonts 配信。Kosugi Maru は Apache License 2.0、それ以外は
// SIL Open Font License 1.1（どちらも商用利用・Web 埋め込み可）。読み込みは layout.tsx の1本の CSS で、
// 実際のフォントファイルは「その書体で表示した文字」の分だけ取得される。
// ============================================================
import { useEffect, useState } from 'react';
import type React from 'react';
import { getUserPenRaw } from '@/lib/db';

export type PenFontId = 'futsu' | 'garakei' | 'maru' | 'tegaki' | 'yurufuwa' | 'hime' | 'decome' | 'pop' | 'retro' | 'hoso';
export type PenInkId = 'navy' | 'pink' | 'purple' | 'blue' | 'green' | 'red' | 'brown' | 'orange';
export type PenSizeId = 's' | 'm' | 'l';
export type Pen = { v: 1; font: PenFontId; ink: PenInkId; size: PenSizeId };

// 未対応の文字（ハングル・タイ文字など）や外国語は、読みやすい標準フォントで表示する
const FALLBACK = '"Hiragino Maru Gothic ProN", "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif';

export const PEN_FONTS: {
  id: PenFontId;
  /** 雰囲気が分かる表示名 */
  label: string;
  /** ひとことの説明 */
  desc: string;
  /** 向いている使い方（長い文章＝本文／タイトルや短いひとこと＝見出し） */
  use: 'body' | 'title' | 'both';
  family: string;
  weight: number;
  /** 'free' = 最初から使える。将来ショップ/ガチャで手に入る書体はここに商品IDを入れる */
  source: 'free';
}[] = [
  // id は保存データに使うので変えない（表示名・説明だけ変える）
  { id: 'futsu',    label: 'ふつう',     desc: 'いちばん読みやすい標準の字',           use: 'body',  family: FALLBACK,                              weight: 500, source: 'free' },
  { id: 'garakei',  label: 'ガラケー',   desc: '昔のケータイ画面みたいな丸ゴシック',   use: 'both',  family: `"Kosugi Maru", ${FALLBACK}`,          weight: 400, source: 'free' },
  { id: 'maru',     label: 'まる文字',   desc: 'ころんと太めの丸い字',                 use: 'title', family: `"M PLUS Rounded 1c", ${FALLBACK}`,    weight: 700, source: 'free' },
  { id: 'tegaki',   label: '交換ノート', desc: 'ノートに書いたきれいめの手書き',       use: 'both',  family: `"Klee One", ${FALLBACK}`,             weight: 600, source: 'free' },
  { id: 'yurufuwa', label: 'ゆるふわ',   desc: 'ふんわり細い、やさしい手書き',         use: 'both',  family: `"Zen Kurenaido", ${FALLBACK}`,        weight: 400, source: 'free' },
  { id: 'hime',     label: '姫かわ',     desc: '女児雑誌みたいなまんまる丸文字',       use: 'title', family: `"Hachi Maru Pop", ${FALLBACK}`,       weight: 400, source: 'free' },
  { id: 'decome',   label: 'デコメ',     desc: 'ぷっくりポップなデコメの字',           use: 'title', family: `"Mochiy Pop One", ${FALLBACK}`,       weight: 400, source: 'free' },
  { id: 'pop',      label: 'マジック',   desc: 'マジックペンで書いたような太字',       use: 'title', family: `"Yusei Magic", ${FALLBACK}`,          weight: 400, source: 'free' },
  { id: 'retro',    label: 'ドット',     desc: 'ゲーム画面みたいなドット文字',         use: 'title', family: `"DotGothic16", ${FALLBACK}`,          weight: 400, source: 'free' },
  { id: 'hoso',     label: 'ほそ字',     desc: '前略プロフみたいな細めの手書き',       use: 'both',  family: `"Yomogi", ${FALLBACK}`,               weight: 400, source: 'free' },
];

// インクの色。紙（白〜クリーム）の上で 4.5:1 以上。夜テーマ用の明るい色は globals.css 側。
export const PEN_INKS: { id: PenInkId; label: string; color: string }[] = [
  { id: 'navy',   label: 'えんぴつ', color: '#1F2C56' },
  { id: 'pink',   label: 'ピンク',   color: '#BE185D' },
  { id: 'purple', label: 'むらさき', color: '#6D28D9' },
  { id: 'blue',   label: 'あお',     color: '#1D4ED8' },
  { id: 'green',  label: 'みどり',   color: '#136C33' },
  { id: 'red',    label: 'あか',     color: '#B91C1C' },
  { id: 'brown',  label: 'ちゃいろ', color: '#7C4A1E' },
  { id: 'orange', label: 'オレンジ', color: '#A44A06' },
];

export const PEN_SIZES: { id: PenSizeId; label: string; scale: number }[] = [
  { id: 's', label: '小', scale: 0.9 },
  { id: 'm', label: '中', scale: 1 },
  { id: 'l', label: '大', scale: 1.18 },
];

export const DEFAULT_PEN: Pen = { v: 1, font: 'tegaki', ink: 'navy', size: 'm' };

/** 保存データ・他人のデータを安全なペンに丸める。ペン未設定なら null（＝従来の見た目のまま）。 */
export function normalizePen(raw: unknown): Pen | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const font = PEN_FONTS.some((f) => f.id === r.font) ? (r.font as PenFontId) : DEFAULT_PEN.font;
  const ink = PEN_INKS.some((c) => c.id === r.ink) ? (r.ink as PenInkId) : DEFAULT_PEN.ink;
  const size = PEN_SIZES.some((s) => s.id === r.size) ? (r.size as PenSizeId) : DEFAULT_PEN.size;
  return { v: 1, font, ink, size };
}

export const penFont = (pen: Pen) => PEN_FONTS.find((f) => f.id === pen.font) ?? PEN_FONTS[2];
export const penScale = (pen: Pen) => PEN_SIZES.find((s) => s.id === pen.size)?.scale ?? 1;

/**
 * ペンを適用する要素に付ける属性。中の .pen-text / .prof-hand がこの字で表示される。
 * 色は data-pen-ink で指定（夜テーマでは明るいインクに切り替わる）。
 */
export function penAttrs(pen: Pen | null | undefined): { 'data-pen-ink'?: PenInkId; style?: React.CSSProperties } {
  if (!pen) return {};
  const f = penFont(pen);
  return {
    'data-pen-ink': pen.ink,
    style: { ['--pen-font' as any]: f.family, ['--pen-weight' as any]: String(f.weight), ['--pen-scale' as any]: String(penScale(pen)) },
  };
}

// ── 他人のペンの取得（ユーザーごとに1回だけ。セッション中はキャッシュ）──
const cache = new Map<string, Promise<Pen | null>>();
const listeners = new Set<() => void>();

/** 自分のペンを変えたときに呼ぶ（表示中の自分の回答もすぐ新しい字になる）。 */
export function setCachedPen(userId: string, pen: Pen | null) {
  cache.set(userId, Promise.resolve(pen));
  listeners.forEach((fn) => fn());
}

function fetchPen(userId: string): Promise<Pen | null> {
  let p = cache.get(userId);
  if (!p) {
    p = getUserPenRaw(userId).then(normalizePen).catch(() => null);
    cache.set(userId, p);
  }
  return p;
}

/** userId（'@username'）のペン。取得できない・未設定なら null。 */
export function useUserPen(userId: string | undefined): Pen | null {
  const [pen, setPen] = useState<Pen | null>(null);
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const load = () => { fetchPen(userId).then((p) => { if (alive) setPen(p); }); };
    load();
    listeners.add(load);
    return () => { alive = false; listeners.delete(load); };
  }, [userId]);
  return pen;
}
