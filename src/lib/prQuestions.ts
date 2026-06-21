export type PRQuestion = {
  id: string;
  brand: string;
  brandEmoji: string;
  brandBg: string;
  question: string;
  reward: number;
};

export const PR_QUESTIONS: PRQuestion[] = [
  {
    id: 'pr-1',
    brand: 'mellow milk',
    brandEmoji: '☕',
    brandBg: 'from-amber-100 to-yellow-50',
    question: '最近お気に入りのカフェタイムの過ごし方は？',
    reward: 15,
  },
  {
    id: 'pr-2',
    brand: 'Nintendo',
    brandEmoji: '🎮',
    brandBg: 'from-red-100 to-pink-50',
    question: '最近ハマってるゲームや好きなキャラクターは？',
    reward: 20,
  },
  {
    id: 'pr-3',
    brand: 'Spotify',
    brandEmoji: '🎵',
    brandBg: 'from-green-100 to-emerald-50',
    question: '今の気分に合う曲・プレイリストを教えて！',
    reward: 15,
  },
  {
    id: 'pr-4',
    brand: 'PARCO',
    brandEmoji: '🛍',
    brandBg: 'from-purple-100 to-violet-50',
    question: 'お買い物でいちばんテンションあがる瞬間は？',
    reward: 20,
  },
  {
    id: 'pr-5',
    brand: 'LOTTE',
    brandEmoji: '🍫',
    brandBg: 'from-pink-100 to-rose-50',
    question: '好きなチョコレートのフレーバーは？理由も教えて！',
    reward: 15,
  },
];

export function getTodaysPRQuestion(): PRQuestion {
  const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24)) % PR_QUESTIONS.length;
  return PR_QUESTIONS[dayIndex];
}

export function hasAnsweredPRToday(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('miri_pr_answered') === new Date().toDateString();
}

export function markPRAnswered(): void {
  localStorage.setItem('miri_pr_answered', new Date().toDateString());
}
