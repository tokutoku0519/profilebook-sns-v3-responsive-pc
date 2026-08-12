// 公開ブログ記事のサーバーレンダリング・ページ（外部リンク／検索インデックス用）。
// URL: /b/<記事ID>  … 公開(public)の記事だけ表示。フォロワー限定・非公開は 404。
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type Row = {
  id: string; title: string | null; body: string; text_color: string | null;
  mood: string | null; weather: string | null; visibility: string | null;
  created_at: string; user_id: string;
  profiles?: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
};

async function getPost(id: string): Promise<Row | null> {
  if (!supabase) return null;
  // 埋め込みJOINは環境によって失敗しうるため、記事と著者を別々に取得
  const { data } = await supabase
    .from('blog_posts')
    .select('id,title,body,text_color,mood,weather,visibility,created_at,user_id')
    .eq('id', id)
    .maybeSingle();
  const row = data as Row | null;
  if (!row) return null;
  if ((row.visibility ?? 'public') !== 'public') return null; // 公開記事のみ
  try {
    const { data: prof } = await supabase
      .from('profiles').select('username,display_name,avatar_url').eq('id', row.user_id).maybeSingle();
    row.profiles = (prof as Row['profiles']) ?? null;
  } catch { row.profiles = null; }
  return row;
}

// ── 本文マークアップ → プレーン文字列（description用） ──
function plain(body: string): string {
  let t = body ?? '';
  t = t.replace(/^\[\[bg:[^\]]+\]\]\n?/i, '');
  t = t.replace(/^\[\[img:[^\]]+\]\]$/gim, '');
  t = t.replace(/^\s*---\s*$/gim, '');
  t = t.replace(/^#{1,2}\s+/gim, '');
  t = t.replace(/\[\[\/?(?:c(?::#[0-9a-fA-F]{3,8})?|hl(?::#[0-9a-fA-F]{3,8})?|big|small)\]\]/g, '');
  return t.replace(/\s+/g, ' ').trim();
}

const BLOG_BG: Record<string, React.CSSProperties> = {
  plain: { background: '#ffffff' },
  cream: { background: '#FFF8EE' },
  sakura: { background: 'linear-gradient(160deg,#fff1f6,#ffe3ef)' },
  sky: { background: 'linear-gradient(160deg,#eef6ff,#dcecff)' },
  mint: { background: 'linear-gradient(160deg,#effaf3,#dcf3e6)' },
  lemon: { background: 'linear-gradient(160deg,#fffbe6,#fff2c2)' },
  lavender: { background: 'linear-gradient(160deg,#f5f0ff,#e9e0ff)' },
  dot: { backgroundColor: '#fff7fb', backgroundImage: 'radial-gradient(rgba(236,72,153,.12) 1.4px, transparent 1.4px)', backgroundSize: '14px 14px' },
  grid: { backgroundColor: '#ffffff', backgroundImage: 'linear-gradient(rgba(120,120,160,.10) 1px,transparent 1px),linear-gradient(90deg,rgba(120,120,160,.10) 1px,transparent 1px)', backgroundSize: '20px 20px' },
};

const INLINE_RE = /\[\[(c:#[0-9a-fA-F]{3,8}|hl(?::#[0-9a-fA-F]{3,8})?|big|small)\]\]([\s\S]*?)\[\[\/(?:c|hl|big|small)\]\]/g;
function renderInline(text: string, kp: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0; let k = 0; let m: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text))) {
    if (m.index > last) out.push(<span key={`${kp}-${k++}`}>{text.slice(last, m.index)}</span>);
    const tag = m[1]; const inner = m[2];
    const style: React.CSSProperties = {};
    if (tag.startsWith('c:#')) style.color = tag.slice(2);
    else if (tag.startsWith('hl')) { style.backgroundColor = tag.includes(':#') ? tag.split(':')[1] : '#fff59d'; style.padding = '0 .14em'; style.borderRadius = '.25em'; }
    else if (tag === 'big') style.fontSize = '1.35em';
    else if (tag === 'small') style.fontSize = '0.82em';
    out.push(<span key={`${kp}-${k++}`} style={style}>{inner}</span>);
    last = INLINE_RE.lastIndex;
  }
  if (last < text.length) out.push(<span key={`${kp}-${k++}`}>{text.slice(last)}</span>);
  return out;
}

function ArticleBody({ body, titleColor }: { body: string; titleColor?: string }) {
  let text = body ?? '';
  const bgM = text.match(/^\[\[bg:[a-z0-9_-]+\]\]\n?/i);
  if (bgM) text = text.slice(bgM[0].length);
  const lines = text.split('\n');
  return (
    <>
      {lines.map((raw, i) => {
        const line = raw.replace(/\s+$/, '');
        if (/^\s*---\s*$/.test(line)) return <hr key={i} style={{ margin: '18px 0', border: 0, borderTop: '2px dashed rgba(236,72,153,.3)' }} />;
        const img = line.match(/^\[\[img:([\s\S]+)\]\]$/);
        if (img) return <div key={i} style={{ margin: '14px 0', borderRadius: 16, overflow: 'hidden' }}><img src={img[1]} alt="" style={{ width: '100%', display: 'block' }} /></div>;
        const h3 = line.match(/^##\s+(.*)$/);
        if (h3) return <h3 key={i} style={{ margin: '16px 0 4px', fontSize: 17, fontWeight: 900, color: titleColor || '#EC4899' }}>{renderInline(h3[1], `l${i}`)}</h3>;
        const h2 = line.match(/^#\s+(.*)$/);
        if (h2) return <h2 key={i} style={{ margin: '20px 0 6px', fontSize: 20, fontWeight: 900, color: titleColor || '#EC4899', borderLeft: '4px solid rgba(236,72,153,.4)', paddingLeft: 8 }}>{renderInline(h2[1], `l${i}`)}</h2>;
        if (line.trim() === '') return <div key={i} style={{ height: 10 }} />;
        return <p key={i} style={{ margin: '6px 0', fontSize: 16, fontWeight: 600, lineHeight: 1.9, color: '#1F2C56' }}>{renderInline(line, `l${i}`)}</p>;
      })}
    </>
  );
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const post = await getPost(params.id);
  if (!post) return { title: '記事が見つかりません — Miri', robots: { index: false, follow: false } };
  const title = (post.title?.trim() || '無題の記事') + ' — Miri';
  const description = plain(post.body).slice(0, 120);
  return {
    title,
    description,
    robots: { index: true, follow: true },
    openGraph: { title, description, type: 'article' },
    twitter: { card: 'summary', title, description },
  };
}

export default async function BlogArticlePage({ params }: { params: { id: string } }) {
  const post = await getPost(params.id);
  if (!post) notFound();
  const author = post.profiles;
  const bgIdMatch = post.body.match(/^\[\[bg:([a-z0-9_-]+)\]\]/i);
  const bg = BLOG_BG[bgIdMatch?.[1] ?? 'plain'] ?? BLOG_BG.plain;
  const d = new Date(post.created_at);
  const dateStr = d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <main style={{ minHeight: '100vh', background: '#FFF8EE', padding: '24px 16px', fontFamily: 'system-ui, "Hiragino Kaku Gothic ProN", sans-serif' }}>
      <article style={{ maxWidth: 640, margin: '0 auto', background: '#fff', borderRadius: 24, overflow: 'hidden', boxShadow: '0 6px 24px rgba(0,0,0,.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 18px', background: 'linear-gradient(90deg,rgba(236,72,153,.1),rgba(164,123,255,.1))', borderBottom: '1px dashed rgba(236,72,153,.2)', fontSize: 12, fontWeight: 800, color: '#6B7490' }}>
          <span>🗓 {dateStr}</span>
          <span>{post.weather ?? ''}{post.mood ?? ''}</span>
        </div>
        <div style={{ padding: 20, ...bg }}>
          <h1 style={{ margin: '0 0 10px', fontSize: 24, fontWeight: 900, lineHeight: 1.3, color: post.text_color || '#EC4899' }}>✿ {post.title?.trim() || '無題の記事'}</h1>
          <ArticleBody body={post.body} titleColor={post.text_color ?? undefined} />
          <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 8, color: '#1F2C56' }}>
            <span style={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: '50%', background: 'rgba(236,72,153,.1)', fontSize: 18 }}>{author?.avatar_url && !author.avatar_url.startsWith('http') ? author.avatar_url : '📷'}</span>
            <span style={{ fontSize: 13, fontWeight: 900 }}>{author?.display_name || author?.username || '名無し'}</span>
          </div>
        </div>
      </article>
      <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, fontWeight: 800, color: '#6B7490' }}>
        <a href="/" style={{ color: '#4F73E8', textDecoration: 'none' }}>Miri — 平成プロフィール帳 × SNS</a>
      </p>
    </main>
  );
}
