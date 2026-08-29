import type { MouseEvent } from 'react';
import { Heart, Sparkles } from 'lucide-react';
import type { answers, profiles, questions } from '@/lib/mock';
import { RetroText, ReactionGlyph } from '@/components/RetroEmoji';
// RetroText はレトロコード([♥]等)をピクセルアートに、それ以外はそのまま表示する
import { getUserTitles, TITLE_DEFS, type TitleType } from '@/lib/titles';

type Question = (typeof questions)[number];
type Answer = (typeof answers)[number];
type Profile = (typeof profiles)[number];

// アバターは絵文字（例 "📷"）と画像URL（http... / data:...）の両方を取りうる。
// URLなら <img> で、絵文字ならそのまま文字として表示する。
function isImageAvatar(v?: string): boolean {
  return !!v && (v.startsWith('http') || v.startsWith('data:'));
}
function AvatarInline({ value, alt = '' }: { value?: string; alt?: string }) {
  if (isImageAvatar(value)) {
    return <img src={value} alt={alt} className="h-full w-full rounded-full object-cover" />;
  }
  return <>{value || '📷'}</>;
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      {action && <button onClick={onAction} className="text-xs font-bold text-pinkStrong">{action}</button>}
    </div>
  );
}

export function TitleBadge({ type }: { type: TitleType; userId?: string }) {
  const def = TITLE_DEFS[type];

  if (type === 'founder') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-900 px-2.5 py-0.5 text-[10px] font-black tracking-widest text-amber-400 ring-1 ring-amber-500/40 shadow-sm">
        {def.emoji} {def.label}
      </span>
    );
  }

  if (type === 'pioneer') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 px-2.5 py-0.5 text-[10px] font-black tracking-widest text-white ring-1 ring-white/50 shadow-sm">
        {def.emoji} {def.label}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-[10px] font-black text-sky-600 ring-1 ring-sky-200">
      {def.emoji} {def.label}
    </span>
  );
}

export function QuestionCard({ question, hero = false }: { question: Question; hero?: boolean }) {
  if (!question) return null;
  return (
    <article className={`${hero ? 'min-h-36' : 'min-h-24'} sticker-shine rounded-[28px] border border-pink/20 bg-gradient-to-br from-white via-blue-50 to-purple-50 p-4 shadow-card`}>
      {question.sponsor && (
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-full bg-cream px-3 py-1 text-[11px] font-bold text-ink">PR</span>
        </div>
      )}
      <h3 className="relative z-10 text-lg font-bold leading-snug text-ink">{question.title}</h3>
      {hero && <button className="relative z-10 mt-4 rounded-full bg-pink px-4 py-2 text-sm font-bold text-white shadow-card">このお題に答える</button>}
    </article>
  );
}

export function AnswerCard({ answer, detail = false, translatedBody, onUserClick, liked = false, reactions, onLike, onSticker }: { answer: Answer; detail?: boolean; translatedBody?: string; onUserClick?: (user: Answer['user']) => void; liked?: boolean; reactions?: Record<string, { count: number; mine: boolean }>; onLike?: () => void; onSticker?: () => void }) {
  if (!answer) return null;
  const titles = getUserTitles(answer.user.id);
  // 絵文字スタンプ（like以外）を件数の多い順に。詳細画面はリアクションバーがあるので非表示。
  const stickerChips = !detail && reactions
    ? Object.entries(reactions).filter(([type]) => type !== 'like').sort((a, b) => b[1].count - a[1].count)
    : [];
  // カード全体が <button> の中に置かれることがあるため、ユーザー部分は span + stopPropagation で扱う
  const userClickProps = onUserClick
    ? {
        role: 'button' as const,
        tabIndex: 0,
        onClick: (e: MouseEvent) => { e.stopPropagation(); onUserClick(answer.user); },
        className: 'flex items-center gap-2 rounded-full -m-1 p-1 transition active:scale-[0.98] hover:bg-pink/5 cursor-pointer',
      }
    : { className: 'flex items-center gap-2' };
  return (
    <article className={`rounded-[28px] border border-purple-100 bg-white p-4 shadow-card ${detail ? 'min-h-56' : ''}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full bg-purple/15 px-3 py-1 text-[11px] font-bold text-purple">{answer.question?.category}</span>
        <Sparkles size={18} className="text-pink" />
      </div>
      <p className="mb-2 text-xs font-bold text-muted">{answer.question?.title}</p>
      <p className={`${detail ? 'text-xl leading-9' : 'text-base leading-7'} notebook-lines rounded-2xl px-2 py-1 font-medium text-ink`}><RetroText text={translatedBody ?? answer.body} /></p>
      {stickerChips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {stickerChips.map(([emoji, info]) => (
            <span key={emoji} className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-black ${info.mine ? 'bg-pink/15 text-pink ring-1 ring-pink' : 'bg-base text-ink'}`}>
              <span className="text-sm"><ReactionGlyph value={emoji} size={16} /></span>{info.count}
            </span>
          ))}
        </div>
      )}
      <div className="mt-4 flex items-center justify-between">
        <span {...userClickProps}>
          <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-pink/15 text-xl"><AvatarInline value={answer.user.avatar} alt={answer.user.name} /></span>
          <span>
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-bold">{answer.user.name}</span>
              {titles.map((t) => <TitleBadge key={t} type={t} userId={answer.user.id} />)}
            </span>
            <span className="block text-[11px] text-muted">{answer.user.id}</span>
          </span>
        </span>
        <div className="flex items-center gap-2 text-xs font-bold text-muted">
          {onSticker && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e: MouseEvent) => { e.stopPropagation(); onSticker(); }}
              className="grid h-7 w-7 place-items-center rounded-full bg-base text-sm transition active:scale-90 hover:bg-pink/10 cursor-pointer"
              aria-label="スタンプでリアクション"
            >
              😊<span className="ml-[-2px] text-[10px]">＋</span>
            </span>
          )}
          {onLike ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e: MouseEvent) => { e.stopPropagation(); onLike(); }}
              className={`flex items-center gap-1 rounded-full -m-1 p-1 transition active:scale-90 hover:bg-pink/5 cursor-pointer ${liked ? 'text-pink' : ''}`}
            >
              <Heart size={15} fill={liked ? 'currentColor' : 'none'} className={liked ? 'heart-pop' : ''} />
              {(reactions?.like?.count ?? answer.reactions.like)}
            </span>
          ) : (
            <span className={`flex items-center gap-1 ${liked ? 'text-pink' : ''}`}>
              <Heart size={15} fill={liked ? 'currentColor' : 'none'} className={liked ? 'heart-pop' : ''} />
              {(reactions?.like?.count ?? answer.reactions.like)}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

export function ProfileCard({ profile }: { profile: Profile }) {
  const titles = getUserTitles(profile.id);
  return (
    <article className="min-w-[150px] rounded-[26px] border border-purple-100 bg-white p-4 text-center shadow-card">
      <div className="mx-auto mb-3 grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-pink/20 to-purple/20 text-3xl"><AvatarInline value={profile.avatar} alt={profile.name} /></div>
      <h3 className="font-bold text-ink">{profile.name}</h3>
      {titles.length > 0 && (
        <div className="mt-1 flex flex-wrap justify-center gap-1">
          {titles.map((t) => <TitleBadge key={t} type={t} userId={profile.id} />)}
        </div>
      )}
      <p className="mt-1 text-[11px] text-muted">{profile.id}</p>
      <p className="mt-2 rounded-full bg-mint px-2 py-1 text-[11px] font-bold text-ink">{profile.common}</p>
    </article>
  );
}
