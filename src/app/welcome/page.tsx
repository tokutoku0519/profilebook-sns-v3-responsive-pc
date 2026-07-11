'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const steps = [
  { emoji: '📖', title: 'お題に答えよう', desc: '毎日届くお題に、プロフィール帳みたいに答えてね。' },
  { emoji: '🎀', title: 'プロフ帳を作ろう', desc: '自分だけのプロフィール帳をデコって、個性を見せよう。' },
  { emoji: '🍀', title: 'なかよくなろう', desc: '共通点をみつけたら、プロフ帳を交換したり日記をいっしょに書いたり。すこしずつ仲良くなろう。' },
];

export default function WelcomePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const isLast = step === steps.length - 1;

  function done() {
    // メインアプリに入る前に壊れた localStorage データを除去する
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
    router.push('/');
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

      <div className="w-full space-y-3">
        <button
          onClick={() => isLast ? done() : setStep(s => s + 1)}
          className="h-14 w-full rounded-full bg-pink text-base font-black text-white shadow-floating active:scale-[0.98] transition"
        >
          {isLast ? 'はじめる ✨' : 'つぎへ →'}
        </button>
        {!isLast && (
          <button onClick={done} className="w-full py-2 text-sm font-black text-muted">
            スキップ
          </button>
        )}
      </div>
    </div>
  );
}
