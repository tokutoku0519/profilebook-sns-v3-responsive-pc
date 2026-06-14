import { Heart, Sparkles } from 'lucide-react';
import type { answers, profiles, questions } from '@/lib/mock';
import { RetroText } from '@/components/RetroEmoji';

type Question = (typeof questions)[number];
type Answer = (typeof answers)[number];
type Profile = (typeof profiles)[number];

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      {action && <button onClick={onAction} className="text-xs font-bold text-pinkStrong">{action}</button>}
    </div>
  );
}

export function QuestionCard({ question, hero = false }: { question: Question; hero?: boolean }) {
  return (
    <article className={`${hero ? 'min-h-36' : 'min-h-24'} sticker-shine rounded-[28px] border border-pink/20 bg-gradient-to-br from-white via-pink-50 to-purple-50 p-4 shadow-card`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-pinkStrong shadow-sm">{question.category}</span>
        {question.sponsor && <span className="rounded-full bg-cream px-3 py-1 text-[11px] font-bold text-ink">PR</span>}
      </div>
      <h3 className="relative z-10 text-lg font-bold leading-snug text-ink">{question.title}</h3>
      {hero && <button className="relative z-10 mt-4 rounded-full bg-pink px-4 py-2 text-sm font-bold text-white shadow-card">このお題に答える</button>}
    </article>
  );
}

export function AnswerCard({ answer, detail = false }: { answer: Answer; detail?: boolean }) {
  return (
    <article className={`rounded-[28px] border border-purple-100 bg-white p-4 shadow-card ${detail ? 'min-h-56' : ''}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full bg-purple/15 px-3 py-1 text-[11px] font-bold text-purple">{answer.question.category}</span>
        <Sparkles size={18} className="text-pink" />
      </div>
      <p className="mb-2 text-xs font-bold text-muted">{answer.question.title}</p>
      <p className={`${detail ? 'text-xl leading-9' : 'text-base leading-7'} notebook-lines rounded-2xl px-2 py-1 font-medium text-ink`}><RetroText text={answer.body} /></p>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-pink/15 text-lg">{answer.user.avatar}</span>
          <div>
            <div className="text-sm font-bold">{answer.user.name}</div>
            <div className="text-[11px] text-muted">{answer.user.id}</div>
          </div>
        </div>
        <div className="flex gap-3 text-xs font-bold text-muted">
          <span className="flex items-center gap-1"><Heart size={15} />{answer.reactions.like}</span>
        </div>
      </div>
    </article>
  );
}

export function ProfileCard({ profile }: { profile: Profile }) {
  return (
    <article className="min-w-[150px] rounded-[26px] border border-purple-100 bg-white p-4 text-center shadow-card">
      <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-pink/20 to-purple/20 text-2xl">{profile.avatar}</div>
      <h3 className="font-bold text-ink">{profile.name}</h3>
      <p className="text-[11px] text-muted">{profile.id}</p>
      <p className="mt-2 rounded-full bg-mint px-2 py-1 text-[11px] font-bold text-ink">{profile.common}</p>
    </article>
  );
}
