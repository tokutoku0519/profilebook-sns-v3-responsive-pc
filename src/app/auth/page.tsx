'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isDev } from '@/lib/env';
import { TERMS_VERSION } from '@/lib/terms';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // dev環境・vercelプレビューはログイン不要
    if (isDev || /\.vercel\.app$/.test(window.location.hostname)) {
      router.replace('/');
      return;
    }
    let unsubscribe: (() => void) | undefined;
    import('@/lib/supabase').then(({ supabase }) => {
      if (!supabase) { setChecking(false); return; }
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          router.replace('/');
        } else {
          setChecking(false);
        }
      });
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
        if (session) router.replace('/');
      });
      unsubscribe = () => subscription.unsubscribe();
    });
    return () => unsubscribe?.();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (mode === 'signup' && !agreed) {
      setError('利用規約とプライバシーポリシーへの同意が必要です');
      return;
    }
    setLoading(true);
    const { supabase } = await import('@/lib/supabase');
    if (!supabase) { setError('設定エラーです'); setLoading(false); return; }

    if (mode === 'signup') {
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            terms_agreed_at: new Date().toISOString(),
            terms_version: TERMS_VERSION,
          },
        },
      });
      if (err) { setError(err.message); setLoading(false); return; }
      if (data.session) {
        // メール確認不要の場合 onAuthStateChange が router.replace('/') を呼ぶ
      } else {
        setError('確認メールを送信しました。メールのリンクをクリックしてください。');
        setLoading(false);
      }
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) { setError('メールアドレスかパスワードが違います'); setLoading(false); return; }
      // onAuthStateChange が router.replace('/') を呼ぶ
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base">
        <span className="text-3xl animate-pulse">🎀</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-base px-6 gap-8">
      <div className="flex flex-col items-center gap-3">
        <img src="/icon.png" alt="Miri" className="h-20 w-20 rounded-[24px] shadow-card" />
        <p className="text-2xl font-black text-ink">Miri</p>
        <p className="text-sm font-bold text-muted">平成プロフィール帳 × SNS</p>
      </div>

      <div className="w-full max-w-sm rounded-[32px] bg-white p-8 shadow-card">
        <p className="mb-6 text-center text-lg font-black text-ink">
          {mode === 'login' ? 'ログイン' : 'アカウント作成'}
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="メールアドレス"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="h-12 w-full rounded-full border-2 border-purple/20 bg-base px-5 text-sm font-bold text-ink placeholder:text-muted focus:border-pink focus:outline-none"
          />
          <input
            type="password"
            placeholder="パスワード（6文字以上）"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            className="h-12 w-full rounded-full border-2 border-purple/20 bg-base px-5 text-sm font-bold text-ink placeholder:text-muted focus:border-pink focus:outline-none"
          />
          {mode === 'signup' && (
            <div className="rounded-2xl bg-base px-4 py-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={e => { setAgreed(e.target.checked); setError(''); }}
                  className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-pink"
                />
                <span className="text-xs font-bold leading-5 text-ink">
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-pink underline">利用規約</a>
                  と
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-pink underline">プライバシーポリシー</a>
                  に同意します
                </span>
              </label>
              <p className="mt-2 pl-8 text-[10px] font-bold leading-4 text-muted">
                本サービスには企業からのPR質問が含まれ、回答データは個人を特定できない統計データに加工したうえで、企業のリサーチ等に利用・提供されることがあります。
              </p>
            </div>
          )}
          {error && <p className="text-center text-xs font-bold text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading || (mode === 'signup' && !agreed)}
            className="h-12 w-full rounded-full bg-pink text-sm font-black text-white shadow-floating transition active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? '...' : mode === 'login' ? 'ログイン' : '登録する'}
          </button>
        </form>
        <button
          onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError(''); }}
          className="mt-4 w-full text-center text-xs font-bold text-muted"
        >
          {mode === 'login' ? 'アカウントを作成する →' : '← ログインに戻る'}
        </button>
        <p className="mt-3 text-center text-[10px] font-bold text-muted">
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline">利用規約</a>
          <span className="mx-1">·</span>
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">プライバシーポリシー</a>
        </p>
      </div>
    </div>
  );
}
