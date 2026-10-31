// ============================================================
// 自由回答の翻訳（Phase B）— ブラウザとサーバーの両方で使う定義
//
// ・ブラウザは「何を訳すか（種類・ユーザー名・項目の場所／回答ID）」だけを送る。文章は送らない。
// ・翻訳してよい項目・場所の形・言語の見分け方は、サーバーの判定とここで共通にする。
// ============================================================
import type { Lang } from '@/lib/i18n';

export const TRANSLATION_LANGS: Lang[] = ['ja', 'en', 'ko', 'zh', 'zh-tw', 'id', 'th', 'vi', 'tl', 'ms', 'es', 'pt', 'fr', 'de', 'it', 'ru', 'ar', 'hi', 'tr', 'nl'];

/**
 * プロフ帳で翻訳してよい項目（トップレベルのキー）。
 * 名前・ニックネーム・ID・誕生日・血液型・MBTI・性別・選択式の項目（教科など）は入れない。
 * __questions / __best3 / __monthly は中の場所まで指定する（例：__questions.2.a）。
 */
export const TRANSLATABLE_PROFILE_FIELDS = [
  'catchphrase', 'message',                                   // ひとこと・自己紹介
  'hometown',                                                 // 基本情報の自由回答
  'favoriteFood', 'dislikeFood', 'favoriteColor', 'favoriteCharacter', // 好きなもの・嫌いなもの
  'specialty', 'holiday', 'wantToGo', 'collection', 'motto', 'charmPoint', 'dream', // わたしのこと
  '__questions', '__best3', '__monthly',                      // ひとこと質問・BEST3・今月のBEST3
] as const;

const PATH_RE = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z0-9_]+){0,3}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USERNAME_RE = /^[A-Za-z0-9_.-]{1,40}$/;

/** 翻訳してよい「場所」か。入れ子は __questions.N.a / __best3.<分類>.N / __monthly.episode / __monthly.items.N だけ */
export function isTranslatableProfilePath(path: string): boolean {
  if (!PATH_RE.test(path)) return false;
  const parts = path.split('.');
  const top = parts[0];
  if (!(TRANSLATABLE_PROFILE_FIELDS as readonly string[]).includes(top)) return false;
  if (top === '__questions') return parts.length === 3 && /^\d{1,2}$/.test(parts[1]) && parts[2] === 'a';
  if (top === '__best3') return parts.length === 3 && /^[a-z]{1,20}$/.test(parts[1]) && /^\d$/.test(parts[2]);
  if (top === '__monthly') return (parts.length === 2 && parts[1] === 'episode') || (parts.length === 3 && parts[1] === 'items' && /^\d$/.test(parts[2]));
  return parts.length === 1;
}

export type TranslateItem =
  | { kind: 'profile_field'; owner: string; path: string }
  | { kind: 'answer'; id: string };

/** 送られてきた 1 件を検査して、決まった形だけを取り出す（文章などほかの値は捨てる） */
export function parseTranslateItem(raw: unknown): TranslateItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.kind === 'profile_field' && typeof r.owner === 'string' && typeof r.path === 'string') {
    const owner = r.owner.replace(/^@/, '');
    if (!USERNAME_RE.test(owner) || !isTranslatableProfilePath(r.path)) return null;
    return { kind: 'profile_field', owner, path: r.path };
  }
  if (r.kind === 'answer' && typeof r.id === 'string' && UUID_RE.test(r.id)) return { kind: 'answer', id: r.id.toLowerCase() };
  return null;
}

export const itemKey = (it: TranslateItem) => (it.kind === 'answer' ? `answer:${it.id}` : `profile:${it.owner}:${it.path}`);

export type TranslateStatus = 'done' | 'kept' | 'original' | 'pending';
export type TranslateResult = { key: string; status: TranslateStatus; text?: string };

// ── 言語の見分け（文字の種類だけで判断。迷うときは「同じ言語かもしれない」側に倒す）──
export type Script = 'ja' | 'ko' | 'th' | 'ar' | 'hi' | 'ru' | 'han' | 'latin' | 'none';
export function detectScript(text: string): Script {
  if (!/\p{L}/u.test(text)) return 'none';                  // 絵文字・記号・数字だけ
  if (/[぀-ヿㇰ-ㇿ]/.test(text)) return 'ja'; // ひらがな・カタカナ
  if (/[가-힯ᄀ-ᇿ㄰-㆏]/.test(text)) return 'ko';
  if (/[฀-๿]/.test(text)) return 'th';
  if (/[؀-ۿ]/.test(text)) return 'ar';
  if (/[ऀ-ॿ]/.test(text)) return 'hi';
  if (/[Ѐ-ӿ]/.test(text)) return 'ru';
  if (/\p{Script=Han}/u.test(text)) return 'han';           // 漢字だけ（日本語か中国語か分からない）
  return 'latin';
}

const LATIN_LANGS: Lang[] = ['en', 'id', 'vi', 'tl', 'ms', 'es', 'pt', 'fr', 'de', 'it', 'tr', 'nl'];

/** 原文の言語と閲覧者の表示言語が「明らかに違う」ときだけ true（翻訳ボタンを出す・API を呼ぶ条件） */
export function differsFromViewer(text: string, viewer: Lang): boolean {
  const s = detectScript(text);
  switch (s) {
    case 'none': return false;
    case 'ja': return viewer !== 'ja';
    case 'han': return !['ja', 'zh', 'zh-tw'].includes(viewer);
    case 'latin': return !LATIN_LANGS.includes(viewer);     // ラテン文字どうしは言語を見分けられないので訳さない
    case 'ko': return viewer !== 'ko';
    case 'th': return viewer !== 'th';
    case 'ar': return viewer !== 'ar';
    case 'hi': return viewer !== 'hi';
    case 'ru': return viewer !== 'ru';
  }
}

/** 原文の言語（プロンプトに渡す名前）。漢字だけの文は Miri では日本語として扱う */
export function sourceLangOf(text: string): Lang | null {
  const s = detectScript(text);
  if (s === 'ja' || s === 'han') return 'ja';
  if (s === 'ko' || s === 'th' || s === 'ar' || s === 'hi' || s === 'ru') return s;
  return null;
}

// ── 固有名詞の用語集（運営が管理。まずはファイルで始める）──
// keep：この語は原文のまま残す／official：翻訳先の言語で広く使われている正式名（あれば置きかえてよい）
export type GlossaryEntry = { term: string; kind: 'artist' | 'work' | 'brand' | 'place' | 'community' | 'slang'; keep: boolean; official?: Partial<Record<Lang, string>>; note?: string };
export const GLOSSARY: GlossaryEntry[] = [
  { term: 'Juice=Juice', kind: 'artist', keep: true, note: 'アイドルグループ' },
  { term: '嵐', kind: 'artist', keep: true, official: { en: 'Arashi' }, note: 'アイドルグループ（天気の嵐と区別）' },
  { term: '米津玄師', kind: 'artist', keep: true, official: { en: 'Kenshi Yonezu' } },
  { term: '鬼滅の刃', kind: 'work', keep: false, official: { en: 'Demon Slayer: Kimetsu no Yaiba', ko: '귀멸의 칼날', zh: '鬼灭之刃', 'zh-tw': '鬼滅之刃', th: 'ดาบพิฆาตอสูร' } },
  { term: '君の名は。', kind: 'work', keep: false, official: { en: 'Your Name.', ko: '너의 이름은.', zh: '你的名字。', 'zh-tw': '你的名字。' } },
  { term: 'どうぶつの森', kind: 'work', keep: false, official: { en: 'Animal Crossing', ko: '동물의 숲', zh: '动物森友会', 'zh-tw': '集合啦！動物森友會' } },
  { term: 'スタバ', kind: 'brand', keep: false, official: { en: 'Starbucks', ko: '스타벅스', zh: '星巴克', 'zh-tw': '星巴克', th: 'สตาร์บัคส์' } },
  { term: 'マック', kind: 'brand', keep: false, official: { en: "McDonald's", ko: '맥도날드', zh: '麦当劳', 'zh-tw': '麥當勞', th: 'แมคโดนัลด์' } },
  { term: 'ぴえん', kind: 'slang', keep: true, note: '泣きそうな気持ちを表すネットスラング。意味が文脈しだいなので原文のまま' },
  { term: '草', kind: 'slang', keep: true, note: '「笑」のネットスラング。単独では原文のまま' },
];

/** 原文に含まれる用語集の語 */
export function glossaryHits(text: string): GlossaryEntry[] {
  return GLOSSARY.filter((g) => text.includes(g.term));
}

/** API を呼ばずに「原文のまま」と決めてよい文（記号・絵文字だけ／1 文字のかな・英字／用語集の残す語と完全一致） */
export function keepWithoutEngine(text: string): boolean {
  const t = text.trim();
  if (!/\p{L}/u.test(t)) return true;
  const letters = t.match(/\p{L}/gu) ?? [];
  if (letters.length === 1 && !/\p{Script=Han}/u.test(letters[0])) return true;
  return GLOSSARY.some((g) => g.keep && g.term === t);
}
