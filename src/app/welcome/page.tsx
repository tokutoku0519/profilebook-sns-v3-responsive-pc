'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getCurrentUserId, ensureProfile } from '@/lib/db';

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
  const isLast = step === steps.length - 1;

  // OAuth（Google等）からの着地を確定：セッション確立→認証クッキー→ユーザー名の用意。
  // メール導線ではすでに設定済みなので何もしない（冪等）。
  useEffect(() => {
    (async () => {
      if (!supabase) return;
      try {
        // PKCEで ?code= が付いて戻る場合は交換（implicit の場合は自動処理済み）
        const params = new URLSearchParams(window.location.search);
        if (params.get('code')) {
          try { await supabase.auth.exchangeCodeForSession(params.get('code')!); } catch {}
          window.history.replaceState({}, '', '/welcome');
        }
        const uid = await getCurrentUserId();
        if (!uid) return; // 未ログインならそのまま（アプリ側ゲートで弾かれる）
        // 認証ゲート通過用クッキー
        const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
        document.cookie = `miri_auth=1; path=/; expires=${expires}; SameSite=Strict`;
        // 正しいユーザー名でルーティングできるように（無ければプロフィール行を保証して取得）
        if (!localStorage.getItem('miri_username')) {
          const p = await ensureProfile();
          if (p?.username) localStorage.setItem('miri_username', p.username);
          if (p?.display_name) localStorage.setItem('miri_displayname', p.display_name);
        }
      } catch {}
    })();
  }, []);

  function done() {
    // 壊れた localStorage データを除去する
    try {
      const saved = localStorage.getItem('profilebook_answers_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        const valid = Array.isArray(parsed)
          ? parsed.filter((a: any) => a?.question?.category)
          : [];
        localStorage.setItem('profilebook_answers_v2', JSON.stringify(valid));
      }
    } catch {
      localStorage.removeItem('profilebook_answers_v2');
    }
    // アプリ内オンボーディング画面をスキップするためのフラグ
    localStorage.setItem('miri_onboarded', '1');
    router.push(`/${getStoredUsername()}`);
  }

  return (
    <div className="flex h-screen flex-col items-center justify-between bg-base px-6 pb-12 pt-16">
      <div className="flex flex-col items-center gap-6 text-center">
        <img src="/icon.png" alt="Miri" className="h-24 w-24 rounded-[28px] shadow-card" />
        <div>
          <p className="text-2xl font-black text-ink">Miriへようこそ！</p>
          <p className="mt-1 text-sm font-bold text-muted">平成プロフィール帳 × SNS</p>
        </div>

        <div className="mt-4 w-full rounded-[32px] bg-white p-8 shadow-card">
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
          onClick={() => isLast ? done() : setStep(s => s + 1)}
          className="h-14 w-full rounded-full bg-pink text-base font-black text-white shadow-floating active:scale-[0.98] transition"
        >
          {isLast ? 'はじめる ✨' : 'つぎへ →'}
        </button>
      </div>
    </div>
  );
}
