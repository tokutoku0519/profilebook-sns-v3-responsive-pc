'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { isDev } from '@/lib/env';
import { TERMS_VERSION } from '@/lib/terms';
import { getMyProfile } from '@/lib/db';
import { Turnstile, TURNSTILE_ENABLED, resetTurnstile } from '@/components/Turnstile';

function setAuthCookie() {
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `miri_auth=1; path=/; expires=${expires}; SameSite=Strict`;
}

function getStoredUsername(): string {
  try { return localStorage.getItem('miri_username') || 'me'; } catch { return 'me'; }
}

// ログイン/新規登録時に、前ユーザー・デモの端末データを一掃する。
// Supabase セッション（sb-* キー）は保持するので、これで認証は切れない。
function clearLocalExceptSession() {
  try {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith('sb-')) localStorage.removeItem(k);
    }
  } catch {}
}

export default function Page() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [checked, setChecked] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const onToken = useCallback((t: string) => setCaptchaToken(t), []);

  useEffect(() => {
    // dev/test 環境はそのままアプリへ
    if (isDev || window.location.hostname.includes('miri-test')) {
      const u = getStoredUsername();
      router.replace(`/${u}`);
      return;
    }
    // 認証済みならアプリへリダイレクト
    if (document.cookie.includes('miri_auth=1')) {
      const u = getStoredUsername();
      router.replace(`/${u}`);
      return;
    }
    setChecked(true);
  }, [router]);

  async function signInWithGoogle() {
    if (!supabase) { setError('設定エラーです'); return; }
    setError('');
    // 着地先を /welcome にして、そこで認証確定（クッキー＋ユーザー名）を行う
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/welcome` },
    });
    if (err) setError('Googleログインを開始できませんでした');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (mode === 'signup' && !agreed) {
      setError('利用規約とプライバシーポリシーへの同意が必要です');
      return;
    }
    if (!supabase) { setError('設定エラーです'); return; }

    // Cloudflare Turnstile（ボット対策）：有効時はトークンをサーバー検証してから続行
    if (TURNSTILE_ENABLED) {
      if (!captchaToken) { setError('「私はロボットではありません」の確認を完了してください'); return; }
      setLoading(true);
      try {
        const res = await fetch('/api/turnstile', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: captchaToken }),
        });
        const j = await res.json().catch(() => ({ success: false }));
        if (!j.success) {
          setError('ボット確認に失敗しました。もう一度お試しください');
          setCaptchaToken(''); resetTurnstile(); setLoading(false); return;
        }
      } catch {
        setError('確認に失敗しました。通信環境をご確認ください');
        setLoading(false); return;
      }
    } else {
      setLoading(true);
    }

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
      if (err) { setError(err.message); setLoading(false); setCaptchaToken(''); resetTurnstile(); return; }
      if (data.session) {
        // 初回は /setup でID・名前を設定してもらう
        const fallbackId = data.user?.id?.split('-')[0] || 'me';
        try {
          clearLocalExceptSession();
          localStorage.setItem('miri_username', fallbackId);
        } catch {}
        setAuthCookie();
        router.push('/setup');
      } else {
        setEmailSent(true);
      }
    } else {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) { setError('メールアドレスかパスワードが違います'); setLoading(false); setCaptchaToken(''); resetTurnstile(); return; }
      // ログインユーザーのプロフィール（ID・表示名）を Supabase から取得。
      const prof = await getMyProfile();
      try {
        // 前ユーザー/デモの端末データ（コイン・スタンプ・通知・プロフ等）を一掃。
        // Supabaseセッション(sb-*)は保持。プロフィールは Supabase から復元される。
        clearLocalExceptSession();
        if (prof?.username) localStorage.setItem('miri_username', prof.username);
        else localStorage.setItem('miri_username', data.user?.id?.split('-')[0] || 'me');
        if (prof?.display_name) localStorage.setItem('miri_displayname', prof.display_name);
      } catch {}
      setAuthCookie();
      router.push('/welcome');
    }
    setLoading(false);
  }

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base">
        <span className="text-3xl animate-pulse">🎀</span>
      </div>
    );
  }

  if (emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base px-6">
        <div className="w-full max-w-sm rounded-[32px] bg-white p-8 shadow-card text-center">
          <p className="text-3xl mb-4">📧</p>
          <p className="text-lg font-black text-ink mb-2">確認メールを送信しました</p>
          <p className="text-sm font-bold text-muted">メールのリンクをクリックしてください</p>
        </div>
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
          {TURNSTILE_ENABLED && <Turnstile onToken={onToken} />}
          {error && <p className="text-center text-xs font-bold text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading || (mode === 'signup' && !agreed)}
            className="h-12 w-full rounded-full bg-pink text-sm font-black text-white shadow-floating transition active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? '...' : mode === 'login' ? 'ログイン' : '登録する'}
          </button>
        </form>

        {/* ソーシャルログイン */}
        <div className="my-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-purple/15" />
          <span className="text-[10px] font-bold text-muted">または</span>
          <span className="h-px flex-1 bg-purple/15" />
        </div>
        <button
          type="button"
          onClick={signInWithGoogle}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-purple/20 bg-white text-sm font-black text-ink transition active:scale-[0.98]"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.3 0 10.1-2 13.7-5.3l-6.3-5.3C29.3 34.9 26.8 36 24 36c-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.4l6.3 5.3C41.4 36 44 30.5 44 24c0-1.3-.1-2.3-.4-3.5z" />
          </svg>
          Googleで続ける
        </button>

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
