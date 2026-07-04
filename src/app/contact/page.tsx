'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// ── カテゴリ定義 ──────────────────────────────────────────────
const CATEGORIES = [
  { id: 'bug', label: '不具合の報告', emoji: '🐞' },
  { id: 'account', label: 'アカウント・ログイン', emoji: '🔑' },
  { id: 'deletion', label: '退会について', emoji: '👋' },
  { id: 'feature', label: '機能の要望', emoji: '💡' },
  { id: 'report', label: '違反・迷惑行為の通報', emoji: '🚨' },
  { id: 'other', label: 'その他', emoji: '💬' },
] as const;

type CategoryId = (typeof CATEGORIES)[number]['id'];

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  open: { label: '受付中', className: 'bg-pink/10 text-pink' },
  in_progress: { label: '対応中', className: 'bg-amber-100 text-amber-600' },
  resolved: { label: '解決済み', className: 'bg-emerald-100 text-emerald-600' },
  closed: { label: '終了', className: 'bg-zinc-100 text-zinc-500' },
};

type Inquiry = {
  id: string;
  category: string;
  body: string;
  status: string;
  admin_reply: string | null;
  created_at: string;
};

// Supabase未設定（ローカル開発）時のフォールバック保存先
const LOCAL_KEY = 'miri_inquiries';

function loadLocalInquiries(): Inquiry[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
  } catch {
    return [];
  }
}

export default function ContactPage() {
  const [category, setCategory] = useState<CategoryId>('bug');
  const [email, setEmail] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<Inquiry[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  // ログイン中ならメールアドレスを自動入力し、過去の問い合わせを読み込む
  useEffect(() => {
    (async () => {
      const { supabase } = await import('@/lib/supabase');
      if (!supabase) {
        setHistory(loadLocalInquiries());
        return;
      }
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) return;
      setUserId(session.user.id);
      if (session.user.email) setEmail(session.user.email);
      const { data: rows } = await supabase
        .from('inquiries')
        .select('id, category, body, status, admin_reply, created_at')
        .order('created_at', { ascending: false })
        .limit(20);
      if (rows) setHistory(rows as Inquiry[]);
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!body.trim()) {
      setError('お問い合わせ内容を入力してください');
      return;
    }
    setSubmitting(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      if (supabase) {
        const { error: err } = await supabase.from('inquiries').insert({
          user_id: userId,
          email: email.trim(),
          category,
          body: body.trim(),
        });
        if (err) throw err;
      } else {
        // ローカル開発（Supabase未設定）時はlocalStorageに保存
        const entry: Inquiry = {
          id: `local-${Date.now()}`,
          category,
          body: body.trim(),
          status: 'open',
          admin_reply: null,
          created_at: new Date().toISOString(),
        };
        localStorage.setItem(LOCAL_KEY, JSON.stringify([entry, ...loadLocalInquiries()]));
      }
      setSubmitted(true);
    } catch {
      setError('送信に失敗しました。時間をおいて再度お試しください。');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-base px-4 pb-16 pt-10">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-[32px] bg-white p-10 text-center shadow-card">
            <p className="text-4xl">📮</p>
            <p className="mt-4 text-lg font-black text-ink">お問い合わせを受け付けました</p>
            <p className="mt-2 text-sm font-bold leading-6 text-muted">
              内容を確認のうえ、必要に応じてご入力いただいたメールアドレス宛にご連絡します。
              しばらくお待ちください。
            </p>
            <div className="mt-6 flex flex-col items-center gap-3">
              <button
                onClick={() => {
                  setSubmitted(false);
                  setBody('');
                }}
                className="rounded-full bg-pink px-8 py-3 text-sm font-black text-white shadow-card active:scale-[0.98]"
              >
                続けて問い合わせる
              </button>
              <Link href="/" className="text-xs font-bold text-muted underline">
                アプリに戻る
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-base px-4 pb-16 pt-10">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="mb-6 text-center">
          <p className="text-2xl font-black text-ink">お問い合わせ</p>
          <p className="mt-1 text-xs font-bold text-muted">Miri（みんなのプロフィール帳SNS）</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-[32px] bg-white p-6 shadow-card">
          <p className="mb-3 text-sm font-black text-ink">お問い合わせの種類</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`flex items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-xs font-black transition ${
                  category === c.id ? 'bg-pink/10 text-pink ring-2 ring-pink' : 'bg-base text-muted hover:bg-pink/5'
                }`}
              >
                <span className="text-base">{c.emoji}</span>
                {c.label}
              </button>
            ))}
          </div>

          <p className="mb-2 mt-6 text-sm font-black text-ink">返信先メールアドレス</p>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="h-12 w-full rounded-full border-2 border-purple/20 bg-base px-5 text-sm font-bold text-ink placeholder:text-muted focus:border-pink focus:outline-none"
          />

          <p className="mb-2 mt-6 text-sm font-black text-ink">お問い合わせ内容</p>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            maxLength={2000}
            placeholder={
              category === 'bug'
                ? '発生した問題・操作手順・お使いの端末などをできるだけ詳しく教えてください'
                : 'お問い合わせ内容をご記入ください'
            }
            className="w-full resize-none rounded-3xl border-2 border-purple/20 bg-base p-4 text-sm font-bold leading-6 text-ink placeholder:text-muted focus:border-pink focus:outline-none"
          />
          <p className="mt-1 text-right text-[10px] font-bold text-muted">{body.length}/2000</p>

          {error && <p className="mt-2 text-center text-xs font-bold text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-4 h-12 w-full rounded-full bg-pink text-sm font-black text-white shadow-floating transition active:scale-[0.98] disabled:opacity-60"
          >
            {submitting ? '送信中...' : '送信する'}
          </button>

          <p className="mt-3 text-center text-[10px] font-bold leading-4 text-muted">
            ご入力いただいた内容は
            <Link href="/privacy" className="underline">プライバシーポリシー</Link>
            に基づき、お問い合わせ対応の目的でのみ利用します。
          </p>
        </form>

        {history.length > 0 && (
          <section className="rounded-[32px] bg-white p-6 shadow-card">
            <p className="mb-4 text-sm font-black text-ink">📋 過去のお問い合わせ</p>
            <div className="space-y-3">
              {history.map((q) => {
                const status = STATUS_LABELS[q.status] ?? STATUS_LABELS.open;
                const cat = CATEGORIES.find((c) => c.id === q.category);
                return (
                  <div key={q.id} className="rounded-2xl bg-base p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-black text-ink">
                        {cat ? `${cat.emoji} ${cat.label}` : q.category}
                      </p>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-xs font-bold leading-5 text-muted">{q.body}</p>
                    {q.admin_reply && (
                      <div className="mt-3 rounded-xl bg-pink/5 p-3">
                        <p className="text-[10px] font-black text-pink">運営からの返信</p>
                        <p className="mt-1 whitespace-pre-wrap text-xs font-bold leading-5 text-ink">{q.admin_reply}</p>
                      </div>
                    )}
                    <p className="mt-2 text-right text-[10px] font-bold text-muted">
                      {new Date(q.created_at).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <p className="text-center">
          <Link href="/" className="text-xs font-bold text-muted underline">← アプリに戻る</Link>
        </p>
      </div>
    </main>
  );
}
