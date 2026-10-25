import type { MouseEvent } from 'react';
import { Heart, Sparkles } from 'lucide-react';
import type { answers, profiles, questions } from '@/lib/mock';
import { RetroText, ReactionGlyph } from '@/components/RetroEmoji';
// RetroText はレトロコード([♥]等)をピクセルアートに、それ以外はそのまま表示する
import { getUserTitles, TITLE_DEFS, type TitleType } from '@/lib/titles';
import { penAttrs, useUserPen } from '@/lib/pen';
import { t, type Lang } from '@/lib/i18n';

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

// 称号は共通の「シール」ルールで表示（白フチ＋小さな影）。色はテーマに左右されない
// 明示値で、文字と背景のコントラストはすべて 7:1 以上を確保している。
const TITLE_STICKER: Record<TitleType, { bg: string; fg: string }> = {
  official: { bg: '#DCEBFF', fg: '#1E3A8A' }, // サックス地 × 濃紺
  founder:  { bg: '#1F2C56', fg: '#FFD666' }, // ネイビー地 × 金
  pioneer:  { bg: '#FFE0EC', fg: '#8A1C4A' }, // さくら地 × ベリー
};

export function TitleBadge({ type, lang = 'ja' }: { type: TitleType; userId?: string; lang?: Lang }) {
  const def = TITLE_DEFS[type];
  const c = TITLE_STICKER[type] ?? TITLE_STICKER.official;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black leading-none tracking-wide"
      style={{ background: c.bg, color: c.fg, boxShadow: 'inset 0 0 0 2px rgba(255,255,255,.85), 0 1px 3px rgba(0,0,0,.18)' }}
    >
      <span aria-hidden>{def.emoji}</span>{lang === 'ja' ? def.label : t(`title_${type}`, lang)}
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
  // 書いた人の「わたしのペン」（未設定なら従来の文字のまま）
  const pen = useUserPen(answer?.user?.id);
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
      {pen ? (
        <p
          {...penAttrs(pen)}
          style={{ ...penAttrs(pen).style, ['--pen-base' as any]: detail ? '20px' : '17px' }}
          className={`${detail ? 'leading-9' : 'leading-7'} pen-text pen-size notebook-lines rounded-2xl px-2 py-1`}
        ><RetroText text={translatedBody ?? answer.body} /></p>
      ) : (
        <p className={`${detail ? 'text-xl leading-9' : 'text-base leading-7'} notebook-lines rounded-2xl px-2 py-1 font-medium text-ink`}><RetroText text={translatedBody ?? answer.body} /></p>
      )}
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
