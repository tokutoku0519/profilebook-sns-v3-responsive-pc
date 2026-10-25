'use client';
// ============================================================
// 文具のデコツールバー（ペンケース）
// ペン＝書体と大きさ／マーカー＝インクの色／シール＝回答に貼るスタンプ／デコ＝デコ絵文字。
// 選んだ結果は、上の便せん（入力欄そのもの）とプレビューにすぐ反映される。
// お題の回答で使い、日記・ブログ（Unit 4）でも同じ部品を使える作り。
// ============================================================
import { useId, useState } from 'react';
import { RetroEmojiPicker } from '@/components/RetroEmoji';
import { DEFAULT_PEN, PEN_FONTS, PEN_INKS, PEN_SIZES, type Pen } from '@/lib/pen';

type Tool = 'pen' | 'marker' | 'sticker' | 'deco';

const TOOLS: { id: Tool; icon: string; label: string }[] = [
  { id: 'pen', icon: '🖊️', label: 'ペン' },
  { id: 'marker', icon: '🖍️', label: 'マーカー' },
  { id: 'sticker', icon: '🌟', label: 'シール' },
  { id: 'deco', icon: '✨', label: 'デコ' },
];

export function DecoToolbar({
  pen,
  onPenChange,
  sticker,
  onOpenSticker,
  onInsertDeco,
}: {
  pen: Pen | null;
  onPenChange: (pen: Pen) => void;
  /** 回答に貼るシール（未対応の画面では省略） */
  sticker?: string;
  onOpenSticker?: () => void;
  onInsertDeco: (code: string) => void;
}) {
  const [tool, setTool] = useState<Tool>('pen');
  const cur = pen ?? DEFAULT_PEN;
  const uid = useId();
  const tools = TOOLS.filter((t) => t.id !== 'sticker' || onOpenSticker);

  return (
    <div className="pb-toolcase p-1.5">
      <div role="tablist" aria-label="デコの道具" className="grid gap-1" style={{ gridTemplateColumns: `repeat(${tools.length}, minmax(0, 1fr))` }}>
        {tools.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`${uid}-tab-${t.id}`}
            aria-selected={tool === t.id}
            aria-controls={`${uid}-panel`}
            onClick={() => setTool(t.id)}
            className="pb-tool"
          >
            <span aria-hidden className="text-lg leading-none">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-tab-${tool}`} className="mt-1.5 rounded-[10px] bg-white/80 p-2.5">
        {tool === 'pen' && <PenFontPicker pen={cur} onChange={onPenChange} hint="書体（えらぶとすぐ上の便せんに反映）" />}
        {tool === 'marker' && <PenInkPicker pen={cur} onChange={onPenChange} />}

        {tool === 'sticker' && onOpenSticker && (
          <div className="flex items-center gap-3">
            <span aria-hidden className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-cream text-3xl shadow-[inset_0_0_0_3px_rgba(255,255,255,.9),0_2px_4px_rgba(0,0,0,.15)]">{sticker}</span>
            <div className="min-w-0 flex-1">
              <p className="pb-label">回答に貼るシール</p>
              <button
                type="button"
                onClick={onOpenSticker}
                className="mt-1 min-h-[44px] w-full rounded-lg border-2 border-dashed border-pink/40 text-sm font-black text-pinkStrong active:scale-[0.98]"
              >
                シールを貼りかえる
              </button>
            </div>
          </div>
        )}

        {tool === 'deco' && (
          <>
            <p className="pb-label mb-1.5">デコ絵文字（カーソルの位置に入る）</p>
            <RetroEmojiPicker onInsert={onInsertDeco} />
          </>
        )}
      </div>
      <p className="mt-1.5 px-1 text-[11px] font-bold text-muted">✎ えらんだペンは「わたしの字」として、プロフ帳と回答に使われます</p>
    </div>
  );
}

/** ペンの書体と大きさを選ぶ部品（回答のツールバー・プロフィール編集で共用） */
export function PenFontPicker({ pen, onChange, hint = '書体' }: { pen: Pen; onChange: (pen: Pen) => void; hint?: string }) {
  return (
    <>
      <p className="pb-label mb-1.5">{hint}</p>
      {/* 試し書き見本＋名前＋ひとこと説明＋向いている使い方 */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {PEN_FONTS.map((f) => {
          const on = pen.font === f.id;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange({ ...pen, font: f.id })}
              className={`relative min-h-[84px] rounded-lg px-2.5 pb-2 pt-1.5 text-left transition ${on ? 'bg-pink/10 ring-2 ring-pink' : 'bg-white ring-1 ring-black/10 hover:bg-pink/5'}`}
            >
              {on && <span aria-hidden className="pb-stamp absolute -right-1.5 -top-1.5 h-7 w-7 rotate-12 text-[9px]">これ</span>}
              <span className="block truncate text-[18px] leading-snug text-ink" style={{ fontFamily: f.family, fontWeight: f.weight }}>はじめまして♡</span>
              <span className="mt-0.5 flex items-center gap-1">
                <span className="text-[12px] font-black text-ink">{f.label}</span>
                <span className="rounded bg-cream px-1 text-[9px] font-black text-ink/80">{f.use === 'body' ? '本文向き' : f.use === 'title' ? '見出し向き' : '本文・見出し'}</span>
              </span>
              <span className="mt-0.5 block text-[10px] font-bold leading-tight text-muted">{f.desc}</span>
            </button>
          );
        })}
      </div>
      <p className="pb-label mb-1.5 mt-2.5">文字の大きさ</p>
      <div className="flex gap-1.5">
        {PEN_SIZES.map((s) => {
          const on = pen.size === s.id;
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange({ ...pen, size: s.id })}
              className={`min-h-[40px] flex-1 rounded-lg text-sm font-black transition ${on ? 'bg-pink text-white' : 'bg-white text-ink ring-1 ring-black/10'}`}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </>
  );
}

/** インクの色を選ぶ部品（マーカーのキャップ風） */
export function PenInkPicker({ pen, onChange }: { pen: Pen; onChange: (pen: Pen) => void }) {
  return (
    <>
      <p className="pb-label mb-1.5">インクの色</p>
      <div className="grid grid-cols-4 gap-1.5">
        {PEN_INKS.map((c) => {
          const on = pen.ink === c.id;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange({ ...pen, ink: c.id })}
              className={`flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-lg transition ${on ? 'bg-pink/10 ring-2 ring-pink' : 'bg-white ring-1 ring-black/10'}`}
            >
              {/* マーカーのキャップ */}
              <span aria-hidden className="grid h-5 w-9 place-items-center rounded-full text-[11px] font-black text-white shadow-[inset_0_-3px_0_rgba(0,0,0,.2),0_0_0_2px_rgba(255,255,255,.75)]" style={{ background: c.color }}>{on ? '✓' : ''}</span>
              <span className="text-[10px] font-black text-ink">{c.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
