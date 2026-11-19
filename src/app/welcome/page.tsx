'use client';

// ============================================================
// ログイン・新規登録のあとの行き先を決める画面（＋はじめての案内）
//
// ・Google などのログインの戻り先も兼ねる（?code= があればセッションを確定する）
// ・端末の利用者が替わっていれば、前の人の端末データを消す（src/lib/localData.ts）
// ・案内（3 枚）を出すのは、新しく作ったアカウントの最初の 1 回だけ（src/lib/onboarding.ts）。
//   それ以外は、何も見せずにすぐアプリへ移る（判断が終わるまでは読みこみ中の表示だけ）
// ・?replay=1：マイページの「使い方をもう一度見る」。記録は変えない
// ============================================================
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getCurrentUserId, ensureProfile } from '@/lib/db';
import { prepareLocalForUser } from '@/lib/localData';
import { markOnboarded, needsOnboarding } from '@/lib/onboarding';

function getStoredUsername(): string {
  try { return localStorage.getItem('miri_username') || 'me'; } catch { return 'me'; }
}

const steps = [
  { emoji: '📖', title: 'お題に答えよう', desc: '毎日届くお題に、プロフィール帳みたいに答えてね。' },
  { emoji: '🎀', title: 'プロフ帳を作ろう', desc: '自分だけのプロフィール帳をデコって、個性を見せよう。' },
  { emoji: '🍀', title: 'なかよくなろう', desc: '共通点をみつけたら、プロフ帳を交換したり日記をいっしょに書いたり。すこしずつ仲良くなろう。' },
];

export default function WelcomePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  // checking：行き先を判断中（読みこみ中の表示だけ）／intro：案内を見せる
  const [mode, setMode] = useState<'checking' | 'intro'>('checking');
  const [replay, setReplay] = useState(false);
  const isLast = step === steps.length - 1;

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const isReplay = params.get('replay') === '1';
      setReplay(isReplay);
      if (!supabase) { router.replace(`/${getStoredUsername()}`); return; }
      try {
        // PKCEで ?code= が付いて戻る場合は交換（implicit の場合は自動処理済み）
        if (params.get('code')) {
          try { await supabase.auth.exchangeCodeForSession(params.get('code')!); } catch {}
          window.history.replaceState({}, '', '/welcome');
        }
        const uid = await getCurrentUserId();
        if (!uid) { router.replace('/'); return; }
        // 端末の利用者が替わっていれば、前の人のデータを消す（同じ人なら何も消さない）
        prepareLocalForUser(uid);
        // 認証ゲート通過用クッキー
        const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
        document.cookie = `miri_auth=1; path=/; expires=${expires}; SameSite=Strict`;
        // 正しいユーザー名でルーティングできるように（無ければプロフィール行を保証して取得）
        if (!localStorage.getItem('miri_username')) {
          const p = await ensureProfile();
          if (p?.username) localStorage.setItem('miri_username', p.username);
          if (p?.display_name) localStorage.setItem('miri_displayname', p.display_name);
        }
        if (isReplay || (await needsOnboarding())) { setMode('intro'); return; }
      } catch {}
      router.replace(`/${getStoredUsername()}`);
    })();
  }, [router]);

  async function finish() {
    if (!replay) await markOnboarded();   // スキップ・最後まで見た、のどちらも「完了」として記録
    router.replace(`/${getStoredUsername()}`);
  }

  if (mode === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base" aria-busy="true" data-welcome="checking">
        <span className="text-3xl animate-pulse" aria-hidden>🎀</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col items-center justify-between bg-base px-6 pb-12 pt-16" data-welcome="intro">
      <div className="flex w-full flex-col items-center gap-6 text-center">
        <div className="flex w-full max-w-xs justify-end">
          <button type="button" onClick={finish} className="min-h-[44px] rounded-full px-4 text-sm font-black text-muted underline" data-welcome-skip>
            スキップ
          </button>
        </div>
        <img src="/icon.png" alt="Miri" className="h-24 w-24 rounded-[28px] shadow-card" />
        <div>
          <p className="text-2xl font-black text-ink">Miriへようこそ！</p>
          <p className="mt-1 text-sm font-bold text-muted">平成プロフィール帳 × SNS</p>
        </div>

        <div className="mt-4 w-full max-w-sm rounded-[32px] bg-white p-8 shadow-card">
          <p className="mb-3 text-4xl">{steps[step].emoji}</p>
          <p className="text-lg font-black text-ink">{steps[step].title}</p>
          <p className="mt-2 text-sm font-bold leading-6 text-muted">{steps[step].desc}</p>
        </div>

        <div className="flex gap-2">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-all ${i === step ? 'w-6 bg-pink' : 'w-2 bg-purple/20'}`}
            />
          ))}
        </div>
      </div>

      <div className="w-full max-w-xs mx-auto">
        <button
          onClick={() => isLast ? finish() : setStep(s => s + 1)}
          className="h-14 w-full rounded-full bg-pink text-base font-black text-white shadow-floating active:scale-[0.98] transition"
          data-welcome-next
        >
          {isLast ? 'はじめる ✨' : 'つぎへ →'}
        </button>
      </div>
    </div>
  );
}
