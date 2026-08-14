// 特定商取引法に基づく表記（有料課金を提供する場合の法定表示）。
// ⚠️ 以下の【 】は必ず実際の事業者情報に置き換えてください（プレースホルダのまま公開しない）。
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '特定商取引法に基づく表記 — Miri',
  robots: { index: false, follow: false },
};

const ROWS: { label: string; value: string }[] = [
  { label: '販売事業者', value: '【事業者名／屋号】' },
  { label: '運営責任者', value: '【氏名】' },
  { label: '所在地', value: '【住所】（請求があれば遅滞なく開示します 等の記載も可）' },
  { label: '連絡先', value: '【メールアドレス】／【電話番号（請求があれば開示）】' },
  { label: '販売価格', value: 'コインパッケージごとに購入画面に税込価格で表示します。' },
  { label: '商品代金以外の必要料金', value: 'インターネット接続料金・通信料金等はお客様のご負担となります。' },
  { label: '支払方法', value: 'クレジットカード（Stripe を通じた決済）。' },
  { label: '支払時期', value: '購入手続き完了時に即時決済されます。' },
  { label: '商品の引渡し時期', value: '決済完了後、ただちにアカウントへコインを付与します。' },
  { label: '返品・キャンセル', value: 'デジタルコンテンツ（コイン）の性質上、付与後の返品・返金はお受けできません（法令に基づく場合を除く）。【必要に応じて修正】' },
  { label: '動作環境', value: '最新版の主要ブラウザ（Chrome / Safari 等）。' },
];

export default function TokushohoPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#FFF8EE', padding: '32px 16px', fontFamily: 'system-ui, "Hiragino Kaku Gothic ProN", sans-serif', color: '#1F2C56' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', background: '#fff', borderRadius: 24, padding: 24, boxShadow: '0 6px 24px rgba(0,0,0,.08)' }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>特定商取引法に基づく表記</h1>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#6B7490', marginBottom: 20 }}>
          ※ 本ページは雛形です。公開前に【 】内を実際の事業者情報に置き換えてください。
        </p>
        <dl style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 0 }}>
          {ROWS.map((r) => (
            <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 12, padding: '12px 0', borderBottom: '1px dashed rgba(120,120,160,.25)' }}>
              <dt style={{ fontSize: 13, fontWeight: 900 }}>{r.label}</dt>
              <dd style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.7, margin: 0 }}>{r.value}</dd>
            </div>
          ))}
        </dl>
        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 12, fontWeight: 800 }}>
          <a href="/" style={{ color: '#4F73E8', textDecoration: 'none' }}>← Miri にもどる</a>
        </p>
      </div>
    </main>
  );
}
