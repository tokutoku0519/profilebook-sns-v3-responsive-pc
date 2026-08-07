'use client';

// 動くドット絵（野菜・フルーツ）プレビュー用ページ。
// URL: /preview  … ピッカーを開かずに全スタンプの見た目・動きを一覧で確認できる。
import { FRUIT_LIST, FruitSticker, VEGETABLES, VegetableEmoji } from '@/components/RetroEmoji';

export default function StickerPreviewPage() {
  return (
    <div className="min-h-screen bg-base px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 text-center">
          <h1 className="text-2xl font-black text-ink">動くドット絵スタンプ プレビュー</h1>
          <p className="mt-1 text-sm font-bold text-muted">
            野菜 {VEGETABLES.length} 種（GIF）・フルーツ {FRUIT_LIST.length} 種（ドット絵アニメ）
          </p>
          <p className="mt-1 text-xs font-bold text-muted">
            実際は投稿・日記のエディタ（野菜／フルーツ）や、リアクションの「🍓」から選べます
          </p>
        </header>

        {/* 野菜（GIF） */}
        <section className="mb-6 rounded-[28px] bg-white p-5 shadow-card">
          <p className="mb-3 text-sm font-black text-pinkStrong">🥕 野菜（{VEGETABLES.length}）</p>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
            {VEGETABLES.map(([id, label]) => (
              <div key={id} className="flex flex-col items-center gap-1">
                <div className="grid h-16 w-full place-items-center rounded-2xl bg-base">
                  <VegetableEmoji id={id} label={label} size={44} />
                </div>
                <span className="text-[10px] font-bold text-muted text-center leading-tight">{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* フルーツ（ドット絵アニメ） */}
        <section className="mb-6 rounded-[28px] bg-white p-5 shadow-card">
          <p className="mb-3 text-sm font-black text-pinkStrong">🍓 フルーツ（{FRUIT_LIST.length}）</p>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
            {FRUIT_LIST.map((f) => (
              <div key={f.key} className="flex flex-col items-center gap-1">
                <div className="grid h-16 w-full place-items-center rounded-2xl bg-base">
                  <FruitSticker keyId={f.key} size={44} />
                </div>
                <span className="text-[10px] font-bold text-muted text-center leading-tight">{f.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* リアクション実寸（小） */}
        <section className="rounded-[28px] bg-white p-5 shadow-card">
          <p className="mb-3 text-sm font-black text-pinkStrong">実寸（小）サンプル</p>
          <div className="flex flex-wrap gap-2">
            {VEGETABLES.slice(0, 10).map(([id, label]) => (
              <span key={id} className="flex items-center gap-1 rounded-full bg-base px-2.5 py-1.5">
                <VegetableEmoji id={id} label={label} size={20} />
                <span className="text-[11px] font-black text-ink">{label}</span>
              </span>
            ))}
            {FRUIT_LIST.slice(0, 10).map((f) => (
              <span key={f.key} className="flex items-center gap-1 rounded-full bg-base px-2.5 py-1.5">
                <FruitSticker keyId={f.key} size={20} />
                <span className="text-[11px] font-black text-ink">{f.label}</span>
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
