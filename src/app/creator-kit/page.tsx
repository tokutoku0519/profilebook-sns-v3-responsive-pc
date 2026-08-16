// 企業向け「Miri Creator Kit」紹介ページ（公開・検索インデックス対象）。
// 企業参入の敷居を下げるための価値訴求＋素材仕様＋制作プロセスをまとめた1枚。
import type { Metadata } from 'next';
import { siteUrl } from '@/lib/siteUrl';

export const metadata: Metadata = {
  title: 'Miri Creator Kit — 企業コラボのご案内',
  description: '御社のキャラクター・商品を使ったMiriアイテムを無料で掲載。企業の負担は「素材提供・SNS告知・デザイン確認」だけ。最短1週間で企画から公開まで。',
  alternates: { canonical: `${siteUrl()}/creator-kit` },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Miri Creator Kit — 企業コラボのご案内',
    description: '御社のキャラクター・商品を使ったMiriアイテムを無料で掲載。企業の負担は最小限。',
    type: 'website',
    url: `${siteUrl()}/creator-kit`,
  },
};

const C = {
  bg: '#F4F2FB', card: '#ffffff', ink: '#1F2C56', muted: '#6B7490',
  pink: '#EC4899', blue: '#4F73E8', purple: '#8B5CF6', line: 'rgba(120,120,160,.16)',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 40 }}>
      <h2 style={{ fontSize: 20, fontWeight: 900, color: C.ink, margin: '0 0 16px' }}>{title}</h2>
      {children}
    </section>
  );
}

export default function CreatorKitPage() {
  const enterPoints = [
    { emoji: '🩹', title: 'スタンプ', desc: 'プロフ帳や回答に貼れる限定スタンプ' },
    { emoji: '▦', title: 'ピクセル絵文字', desc: 'ドット絵タッチの限定絵文字' },
    { emoji: '🎨', title: '背景テーマ', desc: 'プロフ帳・アプリの世界観背景' },
    { emoji: '💬', title: 'PR質問', desc: 'ブランドロゴ付きのお題（回答でコイン付与）' },
  ];
  const companyDoes = ['キャラクター・商品素材の提供', 'SNSでの告知', 'デザインの確認（監修）'];
  const miriDoes = ['スタンプ / ピクセル絵文字', '背景テーマ', 'PR質問', 'シェア画像'];
  const specs = [
    { name: 'Miri Sticker', lines: ['512 × 512 px', 'PNG（透過）', '1個〜。パックでも可'] },
    { name: 'Miri Background', lines: ['1080 × 1920 px', 'PNG / JPG', 'プロフ帳の背景に'] },
    { name: 'Miri Question Card', lines: ['ブランドロゴ', '質問文', '選択肢（任意）'] },
  ];
  const steps = [
    { n: 1, t: 'テンプレDL', d: 'Figma / Canva テンプレートを配布' },
    { n: 2, t: '自社制作', d: '御社デザイナーが素材を制作' },
    { n: 3, t: '提出', d: 'Miriへ素材を提出' },
    { n: 4, t: '審査', d: 'ガイドライン・表示確認' },
    { n: 5, t: '公開', d: 'アプリに掲載（最短1週間）' },
  ];

  return (
    <main style={{ minHeight: '100vh', background: C.bg, padding: '32px 16px 64px', fontFamily: 'system-ui, "Hiragino Kaku Gothic ProN", sans-serif', color: C.ink }}>
      <div style={{ maxWidth: 780, margin: '0 auto' }}>
        {/* Hero */}
        <div style={{ background: `linear-gradient(150deg, ${C.blue}, ${C.purple})`, borderRadius: 28, padding: '36px 28px', color: '#fff', boxShadow: '0 10px 30px rgba(80,80,160,.18)' }}>
          <p style={{ fontSize: 13, fontWeight: 800, opacity: .9, margin: 0, letterSpacing: '.08em' }}>Miri Creator Kit</p>
          <h1 style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.4, margin: '10px 0 12px' }}>
            御社のキャラクター・商品で、<br />Miriアイテムを<span style={{ background: 'rgba(255,255,255,.22)', padding: '0 8px', borderRadius: 8 }}>無料掲載</span>。
          </h1>
          <p style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.8, margin: 0, opacity: .95 }}>
            「限定スタンプを作りませんか？」ではなく、<br />
            <b>御社の素材で、Miriがアイテムを制作して掲載します。</b><br />
            企業の負担は最小限。最短1週間で企画から公開まで。
          </p>
        </div>

        {/* 負担の比較 */}
        <Section title="企業にお願いするのは、3つだけ">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: C.card, borderRadius: 20, padding: 20, boxShadow: '0 4px 16px rgba(0,0,0,.05)' }}>
              <p style={{ fontSize: 13, fontWeight: 900, color: C.blue, margin: '0 0 12px' }}>御社がやること</p>
              {companyDoes.map((x) => (
                <p key={x} style={{ fontSize: 14, fontWeight: 700, margin: '8px 0', display: 'flex', gap: 8 }}><span>✓</span>{x}</p>
              ))}
            </div>
            <div style={{ background: C.card, borderRadius: 20, padding: 20, boxShadow: '0 4px 16px rgba(0,0,0,.05)' }}>
              <p style={{ fontSize: 13, fontWeight: 900, color: C.pink, margin: '0 0 12px' }}>Miriがやること</p>
              {miriDoes.map((x) => (
                <p key={x} style={{ fontSize: 14, fontWeight: 700, margin: '8px 0', display: 'flex', gap: 8 }}><span>🎀</span>{x}</p>
              ))}
            </div>
          </div>
          <p style={{ fontSize: 13, fontWeight: 700, color: C.muted, marginTop: 14, lineHeight: 1.8 }}>
            つまり、企画・デザインの重い部分はMiriが担当。御社は素材の提供と監修だけで、コラボアイテムが公開できます。
          </p>
        </Section>

        {/* 参入できる箇所 */}
        <Section title="コラボできるアイテム">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14 }}>
            {enterPoints.map((e) => (
              <div key={e.title} style={{ background: C.card, borderRadius: 18, padding: 18, boxShadow: '0 4px 16px rgba(0,0,0,.05)' }}>
                <p style={{ fontSize: 26, margin: 0 }}>{e.emoji}</p>
                <p style={{ fontSize: 15, fontWeight: 900, margin: '8px 0 4px' }}>{e.title}</p>
                <p style={{ fontSize: 12, fontWeight: 600, color: C.muted, margin: 0, lineHeight: 1.6 }}>{e.desc}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* 素材仕様 */}
        <Section title="素材仕様（Creator Kit）">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
            {specs.map((s) => (
              <div key={s.name} style={{ background: C.card, borderRadius: 18, padding: 20, boxShadow: '0 4px 16px rgba(0,0,0,.05)', border: `1px solid ${C.line}` }}>
                <p style={{ fontSize: 15, fontWeight: 900, color: C.purple, margin: '0 0 12px' }}>{s.name}</p>
                {s.lines.map((l) => (
                  <p key={l} style={{ fontSize: 13, fontWeight: 700, margin: '6px 0', color: C.ink }}>・{l}</p>
                ))}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 13, fontWeight: 700, color: C.muted, marginTop: 14 }}>
            ※ Figma / Canva のテンプレートを配布します（下記お問い合わせ）。テンプレに沿って作るだけで掲載規格に収まります。
          </p>
        </Section>

        {/* プロセス */}
        <Section title="企画から公開まで（最短1週間）">
          <div style={{ display: 'grid', gap: 10 }}>
            {steps.map((s) => (
              <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 14, background: C.card, borderRadius: 16, padding: '14px 18px', boxShadow: '0 3px 12px rgba(0,0,0,.04)' }}>
                <span style={{ flexShrink: 0, display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(150deg,${C.blue},${C.purple})`, color: '#fff', fontWeight: 900, fontSize: 15 }}>{s.n}</span>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 900, margin: 0 }}>{s.t}</p>
                  <p style={{ fontSize: 12, fontWeight: 600, color: C.muted, margin: '2px 0 0' }}>{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* お問い合わせ */}
        <Section title="お問い合わせ">
          <div style={{ background: C.card, borderRadius: 20, padding: 24, boxShadow: '0 4px 16px rgba(0,0,0,.05)', textAlign: 'center' }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: C.ink, margin: '0 0 16px', lineHeight: 1.8 }}>
              コラボのご相談・テンプレートのご請求はこちらから。<br />企画内容に合わせてご提案します。
            </p>
            {/* TODO: 実際の問い合わせ先（メール/フォームURL）に差し替えてください */}
            <a href="mailto:contact@example.com?subject=Miri%20Creator%20Kit%20コラボの相談"
              style={{ display: 'inline-block', background: C.pink, color: '#fff', fontWeight: 900, fontSize: 15, padding: '14px 28px', borderRadius: 999, textDecoration: 'none' }}>
              コラボを相談する
            </a>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginTop: 14 }}>※ 掲載可否・内容はMiriのガイドラインに基づき審査します。</p>
          </div>
        </Section>

        <p style={{ textAlign: 'center', marginTop: 40, fontSize: 12, fontWeight: 800 }}>
          <a href="/" style={{ color: C.blue, textDecoration: 'none' }}>Miri — 平成プロフィール帳 × SNS</a>
        </p>
      </div>
    </main>
  );
}
