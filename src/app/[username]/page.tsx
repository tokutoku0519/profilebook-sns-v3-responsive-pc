'use client';

import { Component, Fragment, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: any) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'monospace', fontSize: 13 }}>
          <p style={{ fontWeight: 'bold', color: '#e11d48', marginBottom: 8 }}>クラッシュエラー（開発用）</p>
          <pre style={{ background: '#fef2f2', padding: 12, borderRadius: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {this.state.error.message}{'\n'}{this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
import { ArrowLeft, Bell, Bookmark, Handshake, Heart, Home, Lock, LogOut, Plus, Search, Settings, Share2, ShoppingBag, UserRound, Users } from 'lucide-react';
import { ToastContainer, ToastItem } from '@/components/Toast';
import { BottomTab, type TabKey } from '@/components/BottomTab';
import { EMOJI_CATEGORIES, searchEmojis } from '@/lib/emoji';
import { AnswerCard, ProfileCard, QuestionCard, SectionHeader, TitleBadge } from '@/components/Cards';
import { TapeLabel, PolaroidPhoto, Sticker, PaperSheet, PaperFieldLine, StickerBadge, HandwrittenText, CapsulePill, NotebookSection, HeartMeter, PrintedHeading, CircleChoice, LetterBoxes, ShapedFrame } from '@/components/paperbook';
import { RetroEmojiPicker, RetroFlower, RetroHeart, RetroMiniStar, RetroNote, RetroRibbon, RetroStar, RetroText, ReactionGlyph, PIXEL_EMOJIS, PixelEmojiImg, isRetroCode, insertRetroCode } from '@/components/RetroEmoji';
import { initialAnswers, profiles, questions } from '@/lib/data';
import { isDev } from '@/lib/env';
import { DEFAULT_PEN, normalizePen, penAttrs, setCachedPen, useUserPen, type Pen } from '@/lib/pen';
import { DecoToolbar, PenFontPicker, PenInkPicker } from '@/components/DecoToolbar';
import { getQuestionsForLang, getActiveQuestionsForLang, localizeQuestion } from '@/lib/localeQuestions';
import { getGenderOptions } from '@/lib/localeConfig';
import { getUserTitles, TITLE_DEFS } from '@/lib/titles';
import { STICKER_PACKS, draw10Gacha, drawGacha, RARITY_COLOR, type StickerItem, type StickerPack } from '@/lib/stickerPacks';
import { t, tf, tv, LANG_LIST, type Lang } from '@/lib/i18n';
import { LangContext, useLang } from '@/lib/langContext';
import { COIN_PACKAGES } from '@/lib/coinPackages';
import { getAccessToken, submitFeedback, saveMyChoices, getMyChoices, getUserChoices, saveProfileIdentity, getPerceptionSummary, castPerceptionVote, clearPerceptionVote, type PerceptionSummary } from '@/lib/db';
import { activeBrandCampaigns, campaignAssets } from '@/lib/brandCampaigns';
import { CHOICE_QUESTIONS, matchPercent } from '@/lib/choiceQuiz';

// 決済（Stripe）が有効かのフラグ。Vercel に NEXT_PUBLIC_STRIPE_ENABLED=1 を設定すると
// 購入ボタンが実際の Checkout を開始する。未設定なら「準備中」表示で安全に無効化される。
const STRIPE_ENABLED = process.env.NEXT_PUBLIC_STRIPE_ENABLED === '1';
import { getShareTargets, shareT, buildShareText, type SharePlatform } from '@/lib/shareTargets';
import { getTodaysPRQuestion, hasAnsweredPRToday, markPRAnswered, type PRQuestion } from '@/lib/prQuestions';
import { BG_THEMES, BG_GACHA_COST, SHARD_EXCHANGE_COST, COLOR_THEMES, drawBgGacha, getBgTheme, type BgTheme } from '@/lib/bgThemes';
import { ThemeArt, CoinIcon, ShardIcon } from '@/components/ThemeArt';
import { dbReady, getMyProfile, getProfileByUsername, saveProfileBook, saveGameData, signOut, getFeed, upsertAnswer, getMyAnswer, searchProfiles, hasValidSession, ensureProfile, getCurrentUserId, toggleReaction, getComments, addComment as dbAddComment, follow as dbFollow, unfollow as dbUnfollow, getFollowingIds, getFollowers, getFollowing, getFriendIds, isFollowedBy, getFollowCounts, getFriendStatus, requestFriend, acceptFriend, removeFriend, getIncomingFriendRequests, createNotification, getNotifications, getUnreadNotificationCount, markNotificationsRead, subscribeNotifications, submitReport, getCirclesShared, createCircleShared, joinCircle as dbJoinCircle, leaveCircle as dbLeaveCircle, approveCircleMember, rejectCircleMember, getCirclePostsShared, createCirclePostShared, addCircleReplyShared, voteCircleShared, getBlogFeedShared, getBlogPostsByUserShared, createBlogPostShared, toggleBlogLikeShared, addBlogCommentShared, deleteBlogPostShared, getDiaryPagesShared, createDiaryPageShared, addDiaryEntryShared, updateDiaryEntryShared, deleteDiaryEntryShared, type FriendStatus, type NotificationRow, type AnswerRow, type ProfileRow, type CommentRow } from '@/lib/db';

type Screen = 'home' | 'search' | 'create' | 'profile' | 'detail' | 'mypage' | 'notifications' | 'followers' | 'settings' | 'official-question-create' | 'diary-list' | 'diary-detail' | 'diary-create' | 'blog-list' | 'blog-detail' | 'blog-create' | 'circles' | 'circle-detail' | 'circle-create' | 'shop' | 'onboarding' | 'bookmarks' | 'daily-question' | 'wallet' | 'collab' | 'diagnosis';
type Question = (typeof questions)[number];
type Answer = (typeof initialAnswers)[number];
type Profile = (typeof profiles)[number];

// アプリ内アクティビティの通知（localStorage 永続化）
// key があれば表示のときにその言語で組み立てる（text は日本語の控え＝古い通知はこれだけ）
type AppNotification = { id: number; icon: string; text: string; at: number; key?: string; vars?: Record<string, string | number> };
function notifText(n: { text: string; key?: string; vars?: Record<string, string | number> }, lang: Lang): string {
  if (!n.key) return n.text;
  // 差し込む値が決まった名前（背景名など）なら表示用の訳にする。ユーザーの名前・文はそのまま
  const vars = Object.fromEntries(Object.entries(n.vars ?? {}).map(([k, v]) => [k, typeof v === 'string' ? tv(v, lang) : v]));
  return tf(n.key, lang, vars);
}

type DraftAnswer = {
  questionId: string;
  body: string;
  sticker: string;
  visibility: 'public' | 'followers' | 'private';
};

type Circle = {
  id: string;
  name: string;
  emoji: string;
  memberIds: string[];
  createdBy: string;
  /** 公認サークル（著名なグループ・公式アカウントが運営） */
  isOfficial?: boolean;
  /** 公認サークルのみ：ファンの参加を許可するか */
  allowFans?: boolean;
  /** ファンとして参加中のユーザー */
  fanIds?: string[];
  /** ファン参加の承認待ちユーザー（承認制） */
  pendingFanIds?: string[];
};

type CirclePost = {
  id: string;
  circleId: string;
  body: string;
  postedBy: string;
  postedByName: string;
  postedByAvatar: string;
  postedAt: string;
  replies: { userId: string; userName: string; userAvatar: string; body: string; postedAt: string }[];
  /** 回答できる範囲。members = メンバーのみ / everyone = ファンも回答OK（未指定は members 扱い） */
  audience?: 'members' | 'everyone';
  /** お題の形式。vote = 「一番〜な人は誰？」のメンバー投票（未指定は talk 扱い） */
  kind?: 'talk' | 'vote';
  /** vote 形式の投票結果 */
  votes?: { userId: string; targetId: string }[];
};

type DiaryComment = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  body: string;
  postedAt: string;
};

type DiaryEntry = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  title?: string;      // 記事タイトル（アメブロ風）
  mood?: string;       // 今日の気分（絵文字）
  weather?: string;    // 今日の天気（絵文字）
  body: string;
  photoUrl?: string;
  font?: string;
  textColor?: string;  // タイトルの見出し色（デコ）
  likes?: number;
  likedByMe?: boolean;
  comments?: DiaryComment[];
  postedAt: string;
};

type DiaryPage = {
  id: string;
  theme: string;
  description: string;
  createdBy: string;
  createdByName: string;
  createdByAvatar: string;
  createdAt: string;
  entries: DiaryEntry[];
  visibility: 'public' | 'followers' | 'mentioned';
  mentionedUserIds: string[];
};

// アバターを絵文字/写真URL(http・data)両対応で丸く表示する共通バブル。
function AvatarBubble({ value, className = 'h-8 w-8 text-base' }: { value?: string; className?: string }) {
  const isImg = !!value && (value.startsWith('http') || value.startsWith('data:'));
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-pink/10 ${className}`}>
      {isImg ? <img src={value} alt="" className="h-full w-full object-cover" /> : (value || '📷')}
    </span>
  );
}

// 個人ブログの記事（アメブロ風・1人1記事＝交換日記とは別機能）
type BlogPost = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  title?: string;
  mood?: string;
  weather?: string;
  body: string;
  photoUrl?: string;
  textColor?: string;
  visibility: 'public' | 'followers';
  likes: number;
  likedByMe: boolean;
  comments: DiaryComment[];
  postedAt: string;
};



const me = {
  name: 'Koki',
  id: '@koki',
  avatar: '📷',
  bio: 'プロフィール帳SNSを作っています',
  common: 'プロフ帳派',
  isOfficial: true,
};
// ダミーユーザー：development（=①デモ）でのみ表示。production（=②本番）では空。
const followers = isDev ? [
  { name: 'まゆ', id: '@mayu_note', avatar: '🎀', bio: '平成女児の残党。甘いものと夜散歩。', common: '揚げパン派' },
  { name: 'りん', id: '@rin_puri', avatar: '🌙', bio: '懐かしいものを集めています。', common: '夜型' },
  { name: 'なな', id: '@nana_7', avatar: '🧸', bio: 'シールと喫茶店が好き。', common: 'インドア派' },
  { name: 'はる', id: '@haru_cafe', avatar: '☕️', bio: '喫茶店と散歩が好き。', common: 'カフェ巡り派' },
  { name: 'ゆい', id: '@yui_book', avatar: '📚', bio: 'プロフィール帳世代です。', common: '文房具好き' },
  { name: 'あかり', id: '@akari_28', avatar: '🍒', bio: 'かわいいもの収集中。', common: 'シール派' },
] : [];

// デモ用（=①dev）のプロフィール帳サンプル（Koki）。
const demoProfileBookInfo = {
  name: 'Koki',
  nickname: 'こうき',
  birthday: '5月19日',
  bloodType: 'A型',
  gender: '',
  mbti: 'ENFP',
  hometown: '東京',
  favoriteFood: 'オムライス',
  dislikeFood: 'セロリ',
  favoriteColor: 'ピンク / ラベンダー',
  favoriteSubject: '美術・現代文',
  dislikeSubject: '数学',
  hobby: '写真・企画・深夜散歩',
  charmPoint: '思いついたらすぐ作るところ',
  dream: '平成プロフィール帳SNSを流行らせる',
  favoriteCharacter: 'ポチャッコ',
  favoriteMusic: '平成J-POP / アイドルソング',
  favoriteTv: 'YouTube・ジブリ映画',
  favoriteArtist: '椎名林檎・宇多田ヒカル',
  favoriteManga: '少女漫画全般',
  favoriteGame: 'どうぶつの森・マリオカート',
  specialty: 'アイデアを思いついたらすぐ形にすること',
  personality: '好奇心旺盛でちょっと飽き性',
  catchphrase: '「それ、やってみよ」',
  message: 'このアプリを一緒に育ててくれると嬉しい♡',
  favoriteSeason: '春',
  myBoom: 'サウナと朝の散歩',
  wantToGo: '台湾・北欧',
  collection: 'レトロなガチャガチャ',
  motto: '思い立ったが吉日',
  holiday: 'カフェでのんびり企画を練る',
  attribute: 'highschool',
  activity: '',
};
// 本番（=②）は空欄スタート（新規ユーザーが自分で埋める）。
const emptyProfileBookInfo: typeof demoProfileBookInfo = {
  name: '', nickname: '', birthday: '', bloodType: '', gender: '', mbti: '', hometown: '',
  favoriteFood: '', dislikeFood: '', favoriteColor: '', favoriteSubject: '', dislikeSubject: '',
  hobby: '', charmPoint: '', dream: '', favoriteCharacter: '', favoriteMusic: '', favoriteTv: '',
  favoriteArtist: '', favoriteManga: '', favoriteGame: '', specialty: '', personality: '',
  catchphrase: '', message: '',
  favoriteSeason: '', myBoom: '', wantToGo: '', collection: '', motto: '', holiday: '',
  attribute: 'highschool', activity: '',
};
const defaultProfileBookInfo = isDev ? demoProfileBookInfo : emptyProfileBookInfo;

// すきなもの BEST3 のカテゴリ定義（表示・編集はこの配列で共通化する）
const BEST3_CATEGORIES = [
  { key: 'drink',  emoji: '🥤', label: '飲み物' },
  { key: 'tv',     emoji: '📺', label: 'テレビ・YouTube' },
  { key: 'artist', emoji: '🎵', label: 'アーティスト' },
  { key: 'movie',  emoji: '🎬', label: '映画' },
  { key: 'book',   emoji: '📖', label: '漫画・本' },
  { key: 'game',   emoji: '🎮', label: 'ゲーム' },
  { key: 'hobby',  emoji: '🎨', label: '趣味' },
] as const;

type Best3Data = Record<string, string[]>;

const emptyBest3: Best3Data = {
  food: ['', '', ''], drink: ['', '', ''], tv: ['', '', ''], artist: ['', '', ''],
  movie: ['', '', ''], book: ['', '', ''], game: ['', '', ''], hobby: ['', '', ''],
};
const demoBest3: Best3Data = {
  food: ['オムライス', '揚げパン', '喫茶店のプリン'],
  drink: ['クリームソーダ', 'コーヒー牛乳', 'ミルクティー'],
  tv: ['水曜日のダウンタウン', 'あちこちオードリー', 'YouTube'],
  artist: ['宇多田ヒカル', '椎名林檎', 'Superfly'],
  movie: ['千と千尋の神隠し', '耳をすませば', '時をかける少女'],
  book: ['NANA', 'ハチミツとクローバー', '君に届け'],
  game: ['どうぶつの森', 'マリオカート', 'スプラトゥーン'],
  hobby: ['写真', '深夜散歩', 'カフェ巡り'],
};
const defaultBest3: Best3Data = isDev ? demoBest3 : emptyBest3;

// 今月のBEST3：月ごとに固定テーマを切り替え（1月=index0 … 12月=index11）
// 各月のテーマは「◯◯のBEST3を教えて！」という質問として表示される。
// 迷わず答えられるよう、シンプルな名詞のお題にする（例示カッコは付けない）。
const MONTHLY_BEST3_THEMES = [
  '今年やってみたいこと',   // 1月：お正月・新年の抱負
  '温まりたい飲みもの',     // 2月：真冬・バレンタイン
  '春に食べたいもの',       // 3月：ひな祭り・卒業
  '新生活で始めたいこと',   // 4月：入学・新生活
  '連休にやりたいこと',     // 5月：GW・行楽
  '雨の日の楽しみ方',       // 6月：梅雨
  '夏に聴きたい曲',         // 7月：七夕・夏本番
  '夏にやりたいこと',       // 8月：お盆・花火
  'この秋やってみたいこと', // 9月：お月見・シルバーウィーク・運動会
  '秋に食べたいもの',       // 10月：ハロウィン・収穫祭・食欲の秋
  '秋におでかけしたい場所', // 11月：紅葉・行楽・文化祭
  '今年やってよかったこと', // 12月：クリスマス・年末年始のふりかえり
];

// 月ごとの季節イベント見出し（エピソード質問プールのテーマ表示用）。
const MONTHLY_EVENT_LABELS = [
  '正月・初詣・おせち・福袋・成人式・雪',       // 1月
  '節分・バレンタイン・受験・雪・冬スポーツ',   // 2月
  '卒業・春休み・ひな祭り・桜・引っ越し',       // 3月
  '入学・入社・新生活・花見・新学期',           // 4月
  'GW・こどもの日・母の日・新緑・五月病',       // 5月
  '梅雨・紫陽花・父の日・衣替え',               // 6月
  '七夕・夏祭り・海・プール・夏休み・花火',     // 7月
  'お盆・帰省・甲子園・夏祭り・花火・旅行',     // 8月
  '運動会・十五夜・三連休・台風・秋の始まり',   // 9月
  'ハロウィン・文化祭・体育祭・秋の味覚・衣替え', // 10月
  '紅葉・七五三・文化祭・冬支度・鍋',           // 11月
  'クリスマス・忘年会・大掃除・年末・イルミネーション', // 12月
];

// 月替わりのエピソード質問プール（BEST3とは別に併記）。特定の季節イベントに絞り、
// エピソードを引き出す“ちょい深掘り”のお題。ユーザーは 🔀 で好きな質問を選んで答えられる。
const MONTHLY_EPISODE_POOL: string[][] = [
  [ // 1月
    'おせちで一番好きなの何？', 'お雑煮のお餅は焼く派？そのまま派？', '初詣で毎年やることある？',
    'おみくじ、大吉出るまで引き直す？', '福袋買うなら何の福袋？', 'お正月、家から一歩も出ない日ある？',
    '雪が積もったら雪だるま作る？雪合戦する？', 'お年玉、子どもの頃何に使ってた？',
  ],
  [ // 2月
    '節分の豆、年の数だけちゃんと食べる？', '恵方巻き一本食べ切れる？', 'チョコはビター・ミルク・ホワイトどれ派？',
    'バレンタインで一番うれしいお菓子は？', '手作りチョコ、作ったことある？', 'スキーとスノボならどっち？',
    '受験勉強中によく食べてたものある？', '冬のコンビニでつい買うものは？',
  ],
  [ // 3月
    '卒業式で泣いたことある？', '卒アル、今でも見る？', '寄せ書きに何書くか迷うタイプ？',
    '春休み、旅行するならどこ行きたい？', '桜は昼と夜どっちが好き？', '桜味のお菓子、好き？苦手？',
    '引っ越すなら家具を全部買い替えたい？', '学生時代の「卒業したくなかった場所」は？',
  ],
  [ // 4月
    '席替え、窓側と廊下側どっちが好きだった？', '新しいクラスで最初に話しかける派？待つ派？',
    '入学式・入社式の日って覚えてる？', '花見するなら宴会派？散歩派？', '新生活で最初に買いたいものは？',
    'ノートは最初のページだけ綺麗になるタイプ？', '新しい環境で自己紹介するとき必ず言うことある？',
    '春になると始めたくなることある？',
  ],
  [ // 5月
    'GW、予定詰め込む派？何もしない派？', '旅行で渋滞3時間、耐えられる？', 'こいのぼり、自分の家に飾ってた？',
    '柏餅とちまきどっち派？', '母の日に何か渡すタイプ？', 'ピクニックに1個持っていくなら何？',
    '連休最終日の夜、何して過ごす？', '5月くらいになると新生活に慣れてくる派？',
  ],
  [ // 6月
    '傘はビニール傘派？ちゃんとした傘派？', '雨の日、出かけるの嫌？むしろ好き？', '長靴履いてたの何歳くらいまで？',
    '紫陽花は青・紫・ピンクどれが好き？', '雨の日に聴きたくなる曲ある？', '部屋干しの匂い、めちゃくちゃ気になる？',
    '父の日って何あげればいいか毎年迷わない？', '梅雨に家でやるなら映画・ゲーム・読書どれ？',
  ],
  [ // 7月
    '七夕の短冊に本気のお願い書く？', '夏祭りで最初に買う屋台は？', 'かき氷、何味選ぶ？',
    '浴衣、自分で着られる？', '海とプールならどっち？', '花火は打ち上げ派？手持ち派？',
    '夏休みの宿題、最初に終わらせる派？8/31派？', 'セミ捕まえられる？',
  ],
  [ // 8月
    '帰省したら必ず食べるものある？', 'お盆の親戚の集まり、好きだった？', '高校野球、母校じゃなくても見ちゃう？',
    '夏祭りの屋台で一番テンション上がるの何？', '花火大会、場所取り何時間前までならできる？',
    '夏の旅行なら海・山・都会どれ？', '夏休み、ラジオ体操ちゃんと行ってた？', '夏の夜、コンビニまで散歩するの好き？',
  ],
  [ // 9月
    '運動会で好きだった種目は？', 'リレーの選手になったことある？', '玉入れ、意外と本気になるタイプ？',
    '運動会のお弁当で入っててほしいものは？', '月を見ながら団子食べたことある？', '月見バーガー、毎年食べる？',
    '三連休があったら旅行と家でゴロゴロどっち？', '夏服、何月まで着る？', '台風の日、ちょっとワクワクしてた？',
  ],
  [ // 10月
    'ハロウィンで仮装するなら何になりたい？', '子どもの頃ハロウィンってやってた？',
    '文化祭なら出店とステージどっちやりたい？', '文化祭の模擬店で売るなら何？',
    '栗・さつまいも・かぼちゃ、一番好きなのどれ？', '焼き芋はねっとり派？ホクホク派？',
    '秋服で一番好きなアイテムは？', '金木犀の匂い、気づく派？',
  ],
  [ // 11月
    '紅葉なら赤と黄色どっちが好き？', '紅葉を見にわざわざ出かける？', '七五三の写真、家に飾ってある？',
    '鍋の具、一番最初に取るの何？', '鍋の締めは雑炊・うどん・ラーメンどれ？', 'こたつ、出したら動けなくなるタイプ？',
    'マフラーって毎年使う？', '秋の夜長、何してる時間が一番好き？',
  ],
  [ // 12月
    'クリスマスケーキ、ショートとチョコどっち？', 'サンタクロース何歳まで信じてた？',
    'クリスマスプレゼントでもらって一番うれしかったものは？', 'イルミネーション、わざわざ見に行く？',
    '忘年会の二次会、行く派？帰る派？', '大掃除で毎年最後まで残る場所どこ？',
    '年越しそば、何時くらいに食べる？', '大晦日は紅白・YouTube・ゲーム・外出どれ？',
  ],
];

// 英語版（日本語以外の画面で表示。ほかの言語は英語にフォールバック）。順番は日本語のプールと同じ。
const MONTHLY_EVENT_EN = [
  'New Year, shrine visits, lucky bags, snow', 'Setsubun, Valentine\'s Day, exams, winter sports',
  'Graduation, spring break, Hinamatsuri, cherry blossoms', 'New school year, new job, flower viewing',
  'Golden Week, Children\'s Day, Mother\'s Day, fresh green', 'Rainy season, hydrangeas, Father\'s Day',
  'Tanabata, summer festivals, beach, pool, fireworks', 'Obon, going home, summer festivals, travel',
  'Sports day, moon viewing, long weekends, typhoons', 'Halloween, school festival, autumn flavors',
  'Autumn leaves, Shichi-Go-San, hot pot season', 'Christmas, year-end parties, big cleaning, illuminations',
];
const MONTHLY_EPISODE_EN: string[][] = [
  ['Your favorite New Year dish?', 'Toasted or plain mochi in your ozoni?', 'Something you always do at your New Year shrine visit?',
   'Would you redraw your fortune until you get "great luck"?', 'Which lucky bag would you buy?', 'Do you have a New Year day when you never leave home?',
   'When it snows: snowman or snowball fight?', 'What did you spend your New Year money on as a kid?'],
  ['Do you eat exactly as many Setsubun beans as your age?', 'Can you finish a whole ehomaki roll?', 'Dark, milk or white chocolate?',
   'The Valentine\'s treat that makes you happiest?', 'Have you ever made homemade chocolate?', 'Skiing or snowboarding?',
   'A snack you always ate while studying for exams?', 'Something you always grab at the convenience store in winter?'],
  ['Have you ever cried at a graduation ceremony?', 'Do you still look at your yearbook?', 'Do you struggle with what to write in farewell messages?',
   'Where would you travel during spring break?', 'Cherry blossoms by day or by night?', 'Sakura-flavored sweets: love them or not?',
   'If you moved, would you replace all your furniture?', 'A school place you didn\'t want to leave behind?'],
  ['Window seat or hallway seat in class?', 'In a new class, do you talk first or wait?',
   'Do you remember your entrance ceremony or first day at work?', 'Flower viewing: picnic party or a quiet walk?', 'The first thing you want to buy for a new life?',
   'Are you the type whose notebook is neat only on the first page?', 'Something you always say when introducing yourself?',
   'Something you feel like starting every spring?'],
  ['Golden Week: packed plans or do nothing?', 'Could you survive a 3-hour traffic jam on a trip?', 'Did your family put up carp streamers?',
   'Kashiwa-mochi or chimaki?', 'Do you give something on Mother\'s Day?', 'One thing you\'d bring to a picnic?',
   'How do you spend the last night of a long holiday?', 'By May, are you used to your new life?'],
  ['Plastic umbrella or a proper one?', 'Rainy days: hate going out or kind of love it?', 'Until what age did you wear rain boots?',
   'Blue, purple or pink hydrangeas?', 'A song you want to hear on rainy days?', 'Does the smell of indoor-dried laundry bother you?',
   'Do you struggle every year with Father\'s Day gifts?', 'Rainy season at home: movies, games or books?'],
  ['Do you write a serious wish on your Tanabata paper?', 'The first food stall you visit at a summer festival?', 'Which shaved-ice flavor do you pick?',
   'Can you put on a yukata by yourself?', 'Beach or pool?', 'Big fireworks or sparklers?',
   'Summer homework: finish first or last-minute on Aug 31?', 'Can you catch cicadas?'],
  ['A food you always eat when you go home for summer?', 'Did you like family gatherings during Obon?', 'Do you watch the high-school baseball tournament?',
   'The festival stall that excites you most?', 'How many hours early would you go to save a spot for fireworks?',
   'Summer trip: beach, mountains or city?', 'Did you really go to morning radio exercises in summer?', 'Do you like late-night summer walks to the convenience store?'],
  ['Your favorite event at sports day?', 'Were you ever on the relay team?', 'Do you get surprisingly serious at the ball-toss game?',
   'What do you want in your sports-day lunch box?', 'Have you eaten dumplings while viewing the moon?', 'Do you eat the moon-viewing burger every year?',
   'A long weekend: travel or lazing at home?', 'Until which month do you wear summer clothes?', 'Did typhoon days secretly excite you?'],
  ['What costume would you wear for Halloween?', 'Did you celebrate Halloween as a kid?',
   'School festival: run a food stand or perform on stage?', 'What would you sell at a school festival stand?',
   'Chestnuts, sweet potatoes or pumpkin?', 'Sticky or fluffy baked sweet potatoes?',
   'Your favorite autumn clothing item?', 'Do you notice the smell of osmanthus?'],
  ['Red or yellow autumn leaves?', 'Do you go out of your way to see autumn leaves?', 'Are your Shichi-Go-San photos displayed at home?',
   'The first thing you take from a hot pot?', 'Hot pot finish: rice porridge, udon or ramen?', 'Once the kotatsu is out, can you never leave it?',
   'Do you wear a scarf every year?', 'Your favorite way to spend long autumn nights?'],
  ['Christmas cake: strawberry shortcake or chocolate?', 'Until what age did you believe in Santa?',
   'The best Christmas present you ever got?', 'Do you go out of your way to see illuminations?',
   'Year-end party afterparty: stay or go home?', 'The place that always gets cleaned last in your big cleaning?',
   'What time do you eat your New Year\'s Eve soba?', 'New Year\'s Eve: TV, YouTube, games or going out?'],
];

// __monthly.episode は今月出題された1問への回答（文字列）。質問文は monthKey から決定的に選ぶ。
type MonthlyBest3 = { monthKey: string; items: string[]; episode?: string };

// monthKey から決定的に1問のインデックスを選ぶ（毎月変わる・同月内は固定・全ユーザー共通）。
function pickMonthlyEpisodeIndex(monthKey: string, poolLen: number): number {
  if (poolLen <= 0) return 0;
  let h = 0;
  for (let i = 0; i < monthKey.length; i++) h = (h * 31 + monthKey.charCodeAt(i)) >>> 0;
  return h % poolLen;
}

// 現在の月のキー・テーマ・ラベル・イベント見出し・今月のエピソード質問(1問)を返す。
function currentMonthInfo() {
  const d = new Date();
  const monthKey = `${d.getFullYear()}-${d.getMonth() + 1}`;
  const pool = MONTHLY_EPISODE_POOL[d.getMonth()];
  const episodeIndex = pickMonthlyEpisodeIndex(monthKey, pool.length);
  return {
    monthKey,
    monthIndex: d.getMonth(),
    episodeIndex,
    theme: MONTHLY_BEST3_THEMES[d.getMonth()],
    events: MONTHLY_EVENT_LABELS[d.getMonth()],
    episodeQ: pool[episodeIndex],
    label: `${d.getMonth() + 1}月`,
  };
}

/** 保存されている「M月D日」を表示言語の書き方にする（保存形式は変えない） */
function formatBirthday(value: string, lang: Lang): string {
  const mo = Number(((value ?? '').match(/(\d{1,2})月/) || [])[1] || 0);
  const da = Number(((value ?? '').match(/(\d{1,2})日/) || [])[1] || 0);
  if (!mo && !da) return value ?? '';
  if (lang === 'ja') return `${mo ? `${mo}月` : ''}${da ? `${da}日` : ''}`;
  try {
    if (mo && da) return new Intl.DateTimeFormat(INTL_LOCALE[lang] ?? lang, { month: 'long', day: 'numeric' }).format(new Date(2024, mo - 1, da));
    if (mo) return monthName(mo - 1, lang);
  } catch {}
  return value;
}

// 言語ごとの月名（例：October / 10月 / 10월）
const INTL_LOCALE: Partial<Record<Lang, string>> = { 'zh-tw': 'zh-TW', zh: 'zh-CN', tl: 'fil' };
function monthName(monthIndex: number, lang: Lang): string {
  if (lang === 'ja') return `${monthIndex + 1}月`;
  try { return new Intl.DateTimeFormat(INTL_LOCALE[lang] ?? lang, { month: 'long' }).format(new Date(2026, monthIndex, 1)); }
  catch { return String(monthIndex + 1); }
}

/**
 * 今月のおだいを表示言語で返す。テーマ（BEST3）は20言語の翻訳キー、エピソード質問と季節の見出しは
 * 日本語・英語の訳を持ち、ほかの言語は英語にフォールバックする（機械翻訳はしない）。
 * 「◯◯ は？」のように日本語の文をつなげて訳すと不自然になるため、質問文は言語ごとの型で組み立てる。
 */
function localizedMonthInfo(info: { monthIndex: number; episodeIndex: number; theme: string; events: string; episodeQ: string }, lang: Lang) {
  const m = info.monthIndex;
  const theme = lang === 'ja' ? info.theme : t(`mtheme_${m}`, lang);
  return {
    title: tf('monthly_title', lang, { month: monthName(m, lang) }),
    theme,
    best3Q: tf('monthly_best3_q', lang, { theme }),
    episodeQ: lang === 'ja' ? info.episodeQ : (MONTHLY_EPISODE_EN[m]?.[info.episodeIndex] ?? info.episodeQ),
    events: lang === 'ja' ? info.events : (MONTHLY_EVENT_EN[m] ?? ''),
  };
}

const demoProfileQuestions = [
  { q: '朝おきて一番にすることは？', a: 'スマホを見る' },
  { q: 'しあわせを感じるときは？', a: '予定のない休日にカフェでぼーっとしている時' },
  { q: '自分を動物に例えると？', a: '好奇心強めの犬' },
  { q: 'コンビニでつい買っちゃうものは？', a: 'カフェラテとグミ' },
  { q: '最近ハマっていることは？', a: 'プロフィール帳SNSを作ること' },
  { q: '気分転換の方法は？', a: '深夜に一人でカフェに行く' },
  { q: '自分のこだわりを一つあげるとしたら？', a: 'フォントと余白' },
  { q: '友だちに一言メッセージを書くとしたら？', a: 'いつもありがとう、大好きだよ♡' },
  { q: '10年後の自分へひとこと？', a: 'あのときのワクワクを忘れないでね' },
  { q: '好きな季節とその理由は？', a: '秋。空気がいちばん好きな匂いがする' },
];
// 公式の質問（最初から入っている10問）は、保存されている日本語の文と翻訳キーを対応させて表示だけ翻訳する。
// ユーザーが書きかえた質問・自分で足した質問は、書いたままの文を表示する（翻訳しない）。
const DEFAULT_PQ_KEY: Record<string, string> = Object.fromEntries(demoProfileQuestions.map((x, i) => [x.q, `pq_${i + 1}`]));
function displayProfileQuestion(q: string, lang: Lang): string {
  const key = DEFAULT_PQ_KEY[q];
  return key && lang !== 'ja' ? t(key, lang) : q;
}
// 本番はお題（q）はそのまま・回答（a）だけ空にして新規ユーザーに埋めてもらう。
const defaultProfileQuestions = isDev
  ? demoProfileQuestions
  : demoProfileQuestions.map((x) => ({ q: x.q, a: '' }));

// ── オンボーディング報酬 ──────────────────────────────────
const REWARD_PER_FIELD = 10; // プロフィール項目を新しく1つ埋めるごと
const SETUP_BONUS = 50;      // 初期設定(/setup)完了ボーナス（初回のみ）
// 報酬対象のプロフィール帳フィールド（選択式の gender/attribute/activity は除外）
const REWARDABLE_FIELDS: (keyof typeof defaultProfileBookInfo)[] = [
  'name', 'nickname', 'birthday', 'bloodType', 'mbti', 'hometown',
  'favoriteFood', 'dislikeFood', 'favoriteColor', 'favoriteSubject', 'dislikeSubject',
  'hobby', 'charmPoint', 'dream', 'favoriteCharacter', 'favoriteMusic', 'favoriteTv',
  'favoriteArtist', 'favoriteManga', 'favoriteGame', 'specialty', 'personality',
  'catchphrase', 'message',
  'wantToGo', 'collection', 'motto', 'holiday',
];

// 日次お題から除外するお題ID（プロフ帳の標準しつもんと同内容のもの）。
// 例：q4/eq14=「いま一番ハマってること」＝ しつもん「最近ハマっていることは？」。
// 今後かぶるお題が増えたらここにIDを足すだけで日次から出なくなる。
const DAILY_EXCLUDE_QIDS = new Set<string>(['q4', 'eq14']);

// 項目ごとの公開範囲。未設定は「公開」扱い。編集画面では各項目のインライン
// チップ（VisChip）で 公開／フォロワー限定／非公開 を切り替える。
type FieldVisibility = 'public' | 'followers' | 'private';

// ── プロフィール完成度＆節目ごほうび（ドーパミン設計） ──────────
// 埋めるほど楽しくなるよう、①完成度メーター ②節目(25/50/75/100%)の
// ジャックポット ③次のごほうび予告 ④達成演出 を用意する。
type ProfileMilestone = { pct: number; coins: number; label: string; emoji: string };
const PROFILE_MILESTONES: ProfileMilestone[] = [
  { pct: 25,  coins: 50,  label: 'スタートダッシュ', emoji: '🌱' },
  { pct: 50,  coins: 120, label: 'ハーフ達成',       emoji: '⭐' },
  { pct: 75,  coins: 250, label: 'あと少し！',        emoji: '🔥' },
  { pct: 100, coins: 500, label: 'コンプリート',      emoji: '🏆' },
];

function countFilledProfileFields(info: typeof defaultProfileBookInfo): number {
  return REWARDABLE_FIELDS.filter((k) => {
    const v = (info as any)[k];
    return typeof v === 'string' && v.trim().length > 0;
  }).length;
}
function profileCompletion(info: typeof defaultProfileBookInfo): { filled: number; total: number; pct: number } {
  const total = REWARDABLE_FIELDS.length;
  const filled = countFilledProfileFields(info);
  return { filled, total, pct: Math.round((filled / total) * 100) };
}

// 編集画面の上部に出す完成度メーター（バーが伸び、節目のごほうびを予告する）
function ProfileProgress({ info, lang = 'ja' }: { info: typeof defaultProfileBookInfo; lang?: Lang }) {
  const { filled, total, pct } = profileCompletion(info);
  const next = PROFILE_MILESTONES.find((m) => pct < m.pct);
  const fieldsToNext = next ? Math.max(1, Math.ceil((next.pct / 100) * total) - filled) : 0;
  return (
    <section className="rounded-[32px] bg-gradient-to-br from-pink/10 via-white to-purple/10 p-5 shadow-card ring-1 ring-pink/15">
      <div className="mb-2 flex items-end justify-between">
        <p className="text-base font-black text-ink">📔 {t('pe_progress_title', lang)}</p>
        <p className="text-2xl font-black text-pink leading-none">{pct}<span className="text-sm">%</span></p>
      </div>
      {/* バー本体＋節目ピン */}
      <div className="relative mt-3 h-4 w-full rounded-full bg-pink/10">
        <div
          className="prof-progress-fill relative h-full overflow-hidden rounded-full bg-gradient-to-r from-pink to-purple"
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
        {PROFILE_MILESTONES.map((m) => {
          const reached = pct >= m.pct;
          return (
            <span
              key={m.pct}
              className={`absolute top-1/2 grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[11px] shadow-sm ring-2 transition ${reached ? 'bg-white ring-pink' : 'bg-white/80 ring-pink/20 grayscale'}`}
              style={{ left: `${m.pct}%` }}
              title={`${m.pct}%: ${tv(m.label, lang)}`}
            >
              {m.emoji}
            </span>
          );
        })}
      </div>
      {/* 次のごほうび予告 or コンプリート */}
      <div className="mt-4 rounded-2xl bg-white/70 px-4 py-3">
        {next ? (
          <p className="text-xs font-black text-ink">
            <span className="mr-1">{next.emoji}</span>{tf('pe_progress_next', lang, { n: fieldsToNext, pct: next.pct })}
            <span className="ml-1 inline-block rounded-full bg-pink/15 px-2 py-0.5 text-[11px] text-pinkStrong">🎁 {tf('pe_progress_coins', lang, { n: next.coins })}</span>
          </p>
        ) : (
          <p className="text-xs font-black text-pinkStrong">🏆 {t('pe_progress_complete', lang)}</p>
        )}
        <p className="mt-1 text-[10px] font-bold text-muted">{tf('pe_progress_rule', lang, { n: REWARD_PER_FIELD })}</p>
      </div>
    </section>
  );
}

// 節目達成のお祝いオーバーレイ（紙吹雪＋ジャックポット表示。タップで閉じる）
type Celebration = { pct: number; coins: number; label: string; emoji: string; isComplete: boolean };
function ProfileCelebration({ data, onClose }: { data: Celebration; onClose: () => void }) {
  const lang = useLang();
  const colors = ['#EC4899', '#A855F7', '#38BDF8', '#FBBF24', '#34D399', '#FB7185'];
  const pieces = Array.from({ length: 28 }, (_, i) => ({
    left: (i * 37) % 100,
    delay: (i % 10) * 0.12,
    dur: 1.8 + ((i * 13) % 12) / 10,
    color: colors[i % colors.length],
  }));
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-6"
      onClick={onClose}
      role="button"
      tabIndex={0}
    >
      {/* 紙吹雪 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {pieces.map((p, i) => (
          <span
            key={i}
            className="confetti-piece"
            style={{ left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }}
          />
        ))}
      </div>
      <div className="gacha-pop relative w-full max-w-xs rounded-[32px] bg-white p-8 text-center shadow-floating">
        <div className="mb-2 text-6xl">{data.emoji}</div>
        <p className="text-lg font-black text-ink">{data.isComplete ? t('cel_complete', lang) : tf('cel_pct', lang, { n: data.pct })}</p>
        <p className="mt-1 text-sm font-bold text-muted">{data.label}</p>
        <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full bg-pink/15 px-5 py-2 text-lg font-black text-pink">
          🎁 {tf('cel_coins', lang, { n: data.coins })}
        </div>
        {data.isComplete && (
          <p className="mt-4 rounded-2xl bg-gradient-to-r from-pink/15 to-purple/15 px-3 py-2 text-xs font-black text-purple">
            🏆 {t('cel_share', lang)}
          </p>
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-full bg-pink py-3 text-sm font-black text-white shadow-floating active:scale-[0.98]"
        >
          {t('cel_ok', lang)} 🎉
        </button>
      </div>
    </div>
  );
}

// アイコン画像を縮小して軽いJPEG data URIにする。
// base64 のまま巨大画像を保存するとサーバー保存が失敗したりフィードが重くなるため、
// 最大辺 max px・JPEG 品質 quality に落としてから保存する（数MB→数十KB）。
function downscaleImageFile(file: File, max = 256, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read_failed'));
    reader.onload = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onerror = () => resolve(src); // デコード不可なら原本のまま
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w >= h && w > max) { h = Math.round((h * max) / w); w = max; }
        else if (h > w && h > max) { w = Math.round((w * max) / h); h = max; }
        else if (w === h && w > max) { w = max; h = max; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(src); return; }
        ctx.drawImage(img, 0, 0, w, h);
        try { resolve(canvas.toDataURL('image/jpeg', quality)); } catch { resolve(src); }
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

// Supabase の回答行(AnswerRow)を、アプリ内の Answer 形に変換する
function feedRowToAnswer(row: AnswerRow): Answer {
  const reactions = { like: 0, same: 0, wakaru: 0, natsukashii: 0 };
  for (const r of row.reactions ?? []) {
    if (r.type in reactions) (reactions as any)[r.type]++;
  }
  const prof = row.profile;
  const bodyText = row.sticker ? `${row.sticker} ${row.body ?? ''}` : (row.body ?? '');
  return {
    id: row.id,
    question: { id: row.question_key, category: row.question_category ?? '', title: row.question_title, sponsor: null },
    body: bodyText,
    user: {
      name: prof?.display_name ?? 'ゲスト',
      id: prof ? '@' + prof.username : '@unknown',
      avatar: prof?.avatar_url || '📷',
    },
    reactions,
  } as Answer;
}

// Supabase の profiles 行 → アプリ内の簡易 Profile（検索結果・外部プロフ表示用）
function rowToMiniProfile(p: ProfileRow): Profile {
  const book: Record<string, any> = p.book || {};
  return {
    name: p.display_name || p.username,
    id: '@' + p.username,
    // 一覧・検索はアバターをテキスト描画するため、写真URL（http/data）は 📷 に落として崩れを防ぐ
    avatar: p.avatar_url && !p.avatar_url.startsWith('http') && !p.avatar_url.startsWith('data:') ? p.avatar_url : '📷',
    bio: book.message || book.personality || book.hobby || '',
    common: book.hobby || book.favoriteFood || '',
  } as Profile;
}

type PremiumSection = {
  price: number;
  description: string;
  questions: Array<{ q: string; a: string }>;
  note: string;
};

type ProfileBook = {
  info: Omit<typeof defaultProfileBookInfo, 'attribute' | 'activity'> & { attribute?: string; activity?: string };
  best3: Best3Data;
  questions: Array<{ q: string; a: string }>;
  themeColor: 'pink' | 'purple' | 'blue' | 'green' | 'orange';
  isOfficial?: boolean;
  premium?: PremiumSection;
};

// ダミーのプロフ帳データも development（=①デモ）でのみ。production（=②）は空。
const mockProfileBooks: Record<string, ProfileBook> = isDev ? {
  '@mayu_note': {
    themeColor: 'pink',
    info: {
      name: 'まゆ', nickname: 'まゆにゃん', birthday: '3月3日（ひな祭り！）',
      bloodType: 'B型', gender: '', mbti: 'ISFJ', hometown: '神奈川',
      favoriteFood: '揚げパン・苺のショートケーキ', dislikeFood: '納豆（においがムリ）',
      favoriteColor: 'ピンク・ベージュ', favoriteSubject: '家庭科・音楽', dislikeSubject: '数学',
      favoriteCharacter: 'シナモロール', favoriteMusic: 'BoA・浜崎あゆみ',
      favoriteTv: '学校へ行こう！・めちゃイケ', favoriteArtist: '浜崎あゆみ・倖田來未',
      favoriteManga: 'ちびまる子ちゃん・りぼん系', favoriteGame: 'たまごっち・プリクラ',
      hobby: '雑貨屋さんめぐり・シール集め', specialty: '一瞬でかわいいものを見つけること',
      personality: 'おっとり系だけど芯がある', catchphrase: '「え、それかわいくない？」',
      charmPoint: 'えくぼとふわふわした雰囲気', dream: 'かわいいカフェを開きたい',
      message: 'みんなと仲良くしたいな！よろしく♡',
      favoriteSeason: '', myBoom: '', wantToGo: '', collection: '', motto: '', holiday: '',
    },
    best3: {
      tv: ['学校へ行こう！', 'めちゃイケ', 'はなまるマーケット'],
      food: ['揚げパン', '苺のショートケーキ', 'コンビニスイーツ'],
      places: ['雑貨屋さん', 'カフェ', 'プリクラコーナー'],
      music: ['浜崎あゆみ', 'BoA', 'SPEED'],
    },
    questions: [
      { q: '朝おきて一番にすることは？', a: '目覚まし3回止めてからスマホ見る' },
      { q: 'しあわせを感じるときは？', a: 'かわいい雑貨を見つけた瞬間' },
      { q: '自分を動物に例えると？', a: 'うさぎ（のんびり見えてマイペース）' },
      { q: 'コンビニでつい買っちゃうものは？', a: '苺のデザートとミルクティー' },
      { q: '好きなことばは？', a: '「かわいいは正義」' },
      { q: '泣いた映画・ドラマは？', a: '世界の中心で、愛をさけぶ（3回泣いた）' },
      { q: '休日の過ごし方は？', a: '雑貨屋さんめぐりしてカフェでお茶' },
      { q: 'もし1日だけ過去に戻れたら？', a: '中学のプリクラ撮り直したい笑' },
    ],
    isOfficial: true,
    premium: {
      price: 480,
      description: 'まゆの深掘りQ&Aとこっそりメモが読めます',
      questions: [
        { q: '本当は誰にも言えない好きなものは？', a: '深夜にひとりでコンビニ行くこと。静かな夜が一番自分らしい。' },
        { q: '泣きたいとき何する？', a: 'お気に入りのプリクラ帳を見ながら昔話をする。昔の自分に励まされる気がする。' },
        { q: '人生で後悔してることは？', a: '高校のとき言えなかった「ありがとう」。今でも時々思い出す。' },
      ],
      note: '読んでくれてありがとう。ここにだけ本音を書いてる。フォローしてくれてる人にだけ見せたくて作った場所です♡',
    },
  },
  '@rin_puri': {
    themeColor: 'purple',
    info: {
      name: 'りん', nickname: 'りんりん', birthday: '11月11日（ポッキーの日！）',
      bloodType: 'A型', gender: '', mbti: 'INFP', hometown: '京都',
      favoriteFood: 'おはぎ・和菓子全般', dislikeFood: '辛いもの（苦手）',
      favoriteColor: '紫・ネイビー', favoriteSubject: '国語・美術', dislikeSubject: '体育',
      favoriteCharacter: 'ムーミン', favoriteMusic: '椎名林檎・くるり',
      favoriteTv: 'NHKドキュメンタリー・深夜ドラマ', favoriteArtist: '椎名林檎・宇多田ヒカル',
      favoriteManga: 'NANA・ハチミツとクローバー', favoriteGame: '塊魂・ぷよぷよ',
      hobby: '古道具屋めぐり・フィルム写真', specialty: '無言でも場を和ませること',
      personality: '内向的だけど好奇心強め', catchphrase: '「なんか、いいな」',
      charmPoint: 'あいまいな笑顔', dream: '旅する写真家になりたい',
      message: 'ゆっくりつながりましょ',
      favoriteSeason: '', myBoom: '', wantToGo: '', collection: '', motto: '', holiday: '',
    },
    best3: {
      tv: ['深夜ドラマ全般', 'NHKドキュメンタリー', '世にも奇妙な物語'],
      food: ['おはぎ', '京都の湯豆腐', '夜食のカップ麺'],
      places: ['古道具屋', '図書館', '夜の商店街'],
      music: ['椎名林檎', 'くるり', 'スピッツ'],
    },
    questions: [
      { q: '朝おきて一番にすることは？', a: 'カーテンを開けずにスマホ見る' },
      { q: 'しあわせを感じるときは？', a: '古いものに出会った瞬間' },
      { q: '自分を動物に例えると？', a: 'ねこ（気まぐれで単独行動派）' },
      { q: 'コンビニでつい買っちゃうものは？', a: 'ホットスナックとホットコーヒー' },
      { q: '好きなことばは？', a: '「なんでもない日、万歳」' },
      { q: '泣いた映画・ドラマは？', a: 'ハチミツとクローバー（アニメ）' },
      { q: '休日の過ごし方は？', a: '古道具屋をひとりでぶらぶら' },
      { q: 'もし1日だけ過去に戻れたら？', a: '平成の深夜番組を全部録画したい' },
    ],
    isOfficial: true,
    premium: {
      price: 480,
      description: 'りんの創作メモと非公開Q&Aが読めます',
      questions: [
        { q: '写真を撮るとき何を考えてる？', a: '「この光、二度と来ない」ってことだけ。シャッターを押す理由はいつもそれ。' },
        { q: 'ひとりの時間に何してる？', a: 'レコードかけながら古いカメラを磨いてる。無音じゃなくて、音のある静けさが好き。' },
        { q: '今いちばん会いたい人は？', a: '祖母。もう会えないけど、ファインダー越しに世界を見るたびに隣にいる気がする。' },
      ],
      note: '購入してくれてありがとう。ここには書き物と写真と、ふと思ったことを残してる。',
    },
  },
  '@nana_7': {
    themeColor: 'blue',
    info: {
      name: 'なな', nickname: 'なな・7ちゃん', birthday: '7月7日（七夕！）',
      bloodType: 'O型', gender: '', mbti: 'ESFP', hometown: '大阪',
      favoriteFood: 'たこ焼き・クレープ', dislikeFood: 'レバー',
      favoriteColor: '水色・白', favoriteSubject: '家庭科・体育', dislikeSubject: '古文',
      favoriteCharacter: 'ハローキティ', favoriteMusic: 'モーニング娘。・SPEED',
      favoriteTv: 'SMAP×SMAP・笑っていいとも', favoriteArtist: 'モーニング娘。・松浦亜弥',
      favoriteManga: 'なかよし系・セーラームーン', favoriteGame: '太鼓の達人・DDR',
      hobby: 'シール収集・喫茶店めぐり', specialty: '初対面でもすぐ仲良くなれること',
      personality: 'にぎやかで人見知りゼロ', catchphrase: '「それ絶対楽しいやつ！」',
      charmPoint: '笑顔と元気の押しつけ', dream: 'みんなが笑ってる場所を作りたい',
      message: 'よろしゅうな〜！一緒に楽しもう！',
      favoriteSeason: '', myBoom: '', wantToGo: '', collection: '', motto: '', holiday: '',
    },
    best3: {
      tv: ['SMAP×SMAP', '笑っていいとも！', 'ごきげんよう'],
      food: ['たこ焼き', 'クレープ', '抹茶アイス'],
      places: ['ゲーセン', '喫茶店', 'プリクラ屋さん'],
      music: ['モーニング娘。', 'SPEED', '松浦亜弥'],
    },
    questions: [
      { q: '朝おきて一番にすることは？', a: 'とにかく元気よく起きる（無理やり）' },
      { q: 'しあわせを感じるときは？', a: 'みんなで笑ってる瞬間' },
      { q: '自分を動物に例えると？', a: '犬（陽気でどこでも馴染む）' },
      { q: 'コンビニでつい買っちゃうものは？', a: 'からあげくんとプリン' },
      { q: '好きなことばは？', a: '「なんとかなる！」' },
      { q: '泣いた映画・ドラマは？', a: '金八先生（毎回泣く）' },
      { q: '休日の過ごし方は？', a: '友達呼んでにぎやかにすごす' },
      { q: 'もし1日だけ過去に戻れたら？', a: 'いいともに出たい笑' },
    ],
  },
  '@haru_cafe': {
    themeColor: 'green',
    info: {
      name: 'はる', nickname: 'はるちゃん', birthday: '4月4日',
      bloodType: 'AB型', gender: '', mbti: 'ISFP', hometown: '神戸',
      favoriteFood: 'サンドイッチ・珈琲', dislikeFood: 'ジャンクフード',
      favoriteColor: '緑・アイボリー', favoriteSubject: '生物・現代文', dislikeSubject: '数学・物理',
      favoriteCharacter: 'リラックマ', favoriteMusic: 'カフェBGM・ジャズ',
      favoriteTv: 'のんのんびより・ドキュメント72時間', favoriteArtist: 'いきものがかり・YUKI',
      favoriteManga: 'よつばと！・ちいかわ', favoriteGame: 'ピクミン・どうぶつの森',
      hobby: '喫茶店めぐり・散歩・読書', specialty: 'おいしいコーヒーを入れること',
      personality: 'おだやかでマイペース', catchphrase: '「ゆっくりでいい」',
      charmPoint: '話をちゃんと聞いてくれるところ', dream: 'のんびりできる純喫茶を開きたい',
      message: 'ゆっくりこのアプリ楽しみましょ♪',
      favoriteSeason: '', myBoom: '', wantToGo: '', collection: '', motto: '', holiday: '',
    },
    best3: {
      tv: ['ドキュメント72時間', 'のんのんびより', 'タモリ倶楽部'],
      food: ['サンドイッチ', 'ハンドドリップコーヒー', '純喫茶のプリン'],
      places: ['純喫茶', '公園', '古本屋'],
      music: ['いきものがかり', 'YUKI', 'カフェ系ジャズ'],
    },
    questions: [
      { q: '朝おきて一番にすることは？', a: 'コーヒーを入れる' },
      { q: 'しあわせを感じるときは？', a: 'いいコーヒーが入った朝' },
      { q: '自分を動物に例えると？', a: 'ねこ（マイペースで好きなことをする）' },
      { q: 'コンビニでつい買っちゃうものは？', a: 'コーヒーとクリームパン' },
      { q: '好きなことばは？', a: '「ゆっくり、でも確かに」' },
      { q: '泣いた映画・ドラマは？', a: '南極大陸（ぼろぼろ泣いた）' },
      { q: '休日の過ごし方は？', a: '純喫茶で本を読む' },
      { q: 'もし1日だけ過去に戻れたら？', a: '昭和の純喫茶に行ってみたい' },
    ],
  },
  '@yui_book': {
    themeColor: 'orange',
    info: {
      name: 'ゆい', nickname: 'ゆいゆい', birthday: '1月14日',
      bloodType: 'A型', gender: '', mbti: 'INTJ', hometown: '埼玉',
      favoriteFood: '和食全般・おにぎり', dislikeFood: 'パクチー',
      favoriteColor: 'からし色・白', favoriteSubject: '国語・歴史', dislikeSubject: '音楽（音痴）',
      favoriteCharacter: 'ムーミン・クロミ', favoriteMusic: 'BUMP OF CHICKEN・Mr.Children',
      favoriteTv: '鑑定団・歴史バラエティ', favoriteArtist: 'BUMP OF CHICKEN・椎名林檎',
      favoriteManga: '20世紀少年・よつばと！', favoriteGame: 'どうぶつの森・FF',
      hobby: '文房具集め・手紙を書くこと', specialty: '読んだ本の内容を全部覚えていること',
      personality: 'クールに見えて実は熱い', catchphrase: '「ちゃんとやればできる」',
      charmPoint: '考えすぎて面白いことを言う', dream: '好きな本に囲まれて暮らしたい',
      message: 'よろしくお願いします（文章力に自信あり）',
      favoriteSeason: '', myBoom: '', wantToGo: '', collection: '', motto: '', holiday: '',
    },
    best3: {
      tv: ['開運！なんでも鑑定団', '歴史秘話ヒストリア', 'NHKスペシャル'],
      food: ['おにぎり（梅）', '蕎麦', 'どら焼き'],
      places: ['本屋', '図書館', '文房具屋'],
      music: ['BUMP OF CHICKEN', 'Mr.Children', '秦基博'],
    },
    questions: [
      { q: '朝おきて一番にすることは？', a: 'その日の予定を頭の中で確認する' },
      { q: 'しあわせを感じるときは？', a: '好きな本を読み切った瞬間' },
      { q: '自分を動物に例えると？', a: 'ふくろう（夜型で観察が好き）' },
      { q: 'コンビニでつい買っちゃうものは？', a: 'お茶と肉まん' },
      { q: '好きなことばは？', a: '「好奇心は最高の教師」' },
      { q: '泣いた映画・ドラマは？', a: '火垂るの墓（トラウマレベル）' },
      { q: '休日の過ごし方は？', a: '本屋と図書館をはしごする' },
      { q: 'もし1日だけ過去に戻れたら？', a: '江戸時代の本屋に行ってみたい' },
    ],
  },
  '@akari_28': {
    themeColor: 'pink',
    info: {
      name: 'あかり', nickname: 'あかりん', birthday: '2月8日',
      bloodType: 'B型', gender: '', mbti: 'ESFJ', hometown: '福岡',
      favoriteFood: 'チョコレート・イチゴ系', dislikeFood: 'ゴーヤ',
      favoriteColor: '赤・ゴールド', favoriteSubject: '美術・英語', dislikeSubject: '数学・理科',
      favoriteCharacter: 'マイメロ・ポムポムプリン', favoriteMusic: 'Perfume・きゃりーぱみゅぱみゅ',
      favoriteTv: 'めちゃイケ・テラスハウス', favoriteArtist: 'Perfume・西野カナ',
      favoriteManga: 'ちゃお系・フルーツバスケット', favoriteGame: 'プリパラ・プリクラ',
      hobby: 'シール集め・デコグッズ収集', specialty: 'プレゼントのラッピングがうまい',
      personality: '世話好きで感情豊か', catchphrase: '「かわいい〜！！」',
      charmPoint: '声が大きくて元気なところ', dream: 'アイドルプロデューサーになりたい',
      message: 'みんな大好き！一緒にかわいい世界作ろ♡',
      favoriteSeason: '', myBoom: '', wantToGo: '', collection: '', motto: '', holiday: '',
    },
    best3: {
      tv: ['めちゃイケ', 'テラスハウス', 'アメトーーク'],
      food: ['チョコレートケーキ', 'イチゴパフェ', 'タピオカ'],
      places: ['ロフト・東急ハンズ', 'アイドルライブ', 'プリクラコーナー'],
      music: ['Perfume', 'きゃりーぱみゅぱみゅ', '西野カナ'],
    },
    questions: [
      { q: '朝おきて一番にすることは？', a: 'インスタのストーリーチェック' },
      { q: 'しあわせを感じるときは？', a: '好きなアイドルがかわいかった時' },
      { q: '自分を動物に例えると？', a: 'ハムスター（小さくてよく動く）' },
      { q: 'コンビニでつい買っちゃうものは？', a: 'チョコ系のお菓子とフルーツ飲料' },
      { q: '好きなことばは？', a: '「かわいいは作れる」' },
      { q: '泣いた映画・ドラマは？', a: '花より男子（全部泣いた）' },
      { q: '休日の過ごし方は？', a: 'ショッピングモールで買い物三昧' },
      { q: 'もし1日だけ過去に戻れたら？', a: 'モーニング娘。の全盛期に行きたい！' },
    ],
  },
} : {};

// 荒らし・イタズラ対策: NGワードフィルター
const NG_WORDS = ['死ね', 'ころす', '殺す', 'うざい', 'きもい', 'クズ', 'ゴミ', 'バカ', 'アホ', 'ブス', 'デブ'];

const DIARY_COLORS = [
  { label: '黒',        value: '#1a1a2e', bg: '#1a1a2e' },
  { label: 'ピンク',    value: '#e91e8c', bg: '#e91e8c' },
  { label: 'パープル',  value: '#7c3aed', bg: '#7c3aed' },
  { label: 'ブルー',    value: '#2563eb', bg: '#2563eb' },
  { label: 'グリーン',  value: '#16a34a', bg: '#16a34a' },
  { label: 'レッド',    value: '#dc2626', bg: '#dc2626' },
  { label: 'オレンジ',  value: '#ea580c', bg: '#ea580c' },
  { label: 'ブラウン',  value: '#92400e', bg: '#92400e' },
] as const;

type AppThemeId = 'default' | 'lavender' | 'soda' | 'herb' | 'peach' | 'strawberry' | 'banana' | 'night';

const APP_THEMES: { id: AppThemeId; name: string; emoji: string; preview: string }[] = [
  { id: 'default',    name: 'Miri',        emoji: '💙', preview: '#4F73E8' },
  { id: 'lavender',  name: 'ラベンダー',   emoji: '💜', preview: '#B79AEF' },
  { id: 'soda',      name: 'ソーダ',       emoji: '🩵', preview: '#60A5FA' },
  { id: 'herb',      name: 'ハーブ',       emoji: '🌿', preview: '#34D399' },
  { id: 'peach',     name: 'ピーチ',       emoji: '🍑', preview: '#FB923C' },
  { id: 'strawberry',name: 'ストロベリー', emoji: '🍓', preview: '#F87171' },
  { id: 'banana',    name: 'バナナ',       emoji: '🍋', preview: '#EAB308' },
  { id: 'night',     name: 'ナイト',       emoji: '🌙', preview: '#D8B4FE' },
];

function applyTheme(id: AppThemeId) {
  const root = document.documentElement;
  if (id === 'default') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', id);
  }
}

const BLOOD_TYPE_OPTIONS = ['A型', 'B型', 'O型', 'AB型', '不明'];
const SUBJECT_OPTIONS = ['国語','数学','英語','理科','社会','体育','音楽','美術','家庭科','技術','現代文','古文','漢文','化学','物理','生物','地理','歴史','倫理','情報'];
const PERSONALITY_OPTIONS = ['おっとり系','元気・明るい','クール・落ち着き','ちょっと不思議','真面目','天然','ふわふわ','ツンデレ','好奇心旺盛','マイペース','リーダー気質','聞き上手'];
// 性格投票の集計は選択肢にある値だけを表示する（DB側の値チェックと合わせた二重の守り）
const onlyKnownPerception = (s: PerceptionSummary): PerceptionSummary => s.filter((x) => PERSONALITY_OPTIONS.includes(x.value));

type ProfileFieldDef = {
  key: string;
  label: string;
  type: 'text' | 'select';
  options?: string[];
};

// ── 立場（ライフステージ）: MECE、必ず1つに当てはまる ──────────────────
type LifeStageDef = {
  id: string;
  emoji: string;
  label: string;
  sectionTitle: string;
  showSubjectFields: boolean;
  fields: ProfileFieldDef[];
};

const LIFE_STAGE_DEFS: LifeStageDef[] = [
  {
    id: 'elementary', emoji: '🎒', label: '小・中学生', sectionTitle: '学校プロフ', showSubjectFields: true,
    fields: [
      { key: 'grade', label: '学年', type: 'select', options: ['小1','小2','小3','小4','小5','小6','中1','中2','中3'] },
      { key: 'club', label: '部活・習い事', type: 'text' },
    ],
  },
  {
    id: 'highschool', emoji: '📚', label: '高校生', sectionTitle: '高校プロフ', showSubjectFields: true,
    fields: [
      { key: 'grade', label: '学年', type: 'select', options: ['高1','高2','高3'] },
      { key: 'club', label: '部活・習い事', type: 'text' },
    ],
  },
  {
    id: 'college', emoji: '🎓', label: '大学生・専門学生', sectionTitle: '大学生プロフ', showSubjectFields: false,
    fields: [
      { key: 'faculty', label: '学部・専攻', type: 'text' },
      { key: 'circle', label: 'サークル・部活', type: 'text' },
      { key: 'partTimeJob', label: 'バイト', type: 'text' },
    ],
  },
  {
    id: 'worker', emoji: '💼', label: '社会人', sectionTitle: 'しごとプロフ', showSubjectFields: false,
    fields: [
      { key: 'jobType', label: '職種', type: 'text' },
      { key: 'industry', label: '業界', type: 'text' },
      { key: 'yearsWorked', label: '社会人歴', type: 'text' },
    ],
  },
];

// ── 特技・活動: 任意で1つ選べる（ライフステージと直交） ──────────────────
type ActivityDef = {
  id: string;
  emoji: string;
  label: string;
  sectionTitle: string;
  fields: ProfileFieldDef[];
};

const ACTIVITY_DEFS: ActivityDef[] = [
  {
    id: 'baseball', emoji: '⚾', label: '野球', sectionTitle: '野球プロフ',
    fields: [
      { key: 'position', label: '守備位置', type: 'select', options: ['投手','捕手','一塁手','二塁手','三塁手','遊撃手','左翼手','中堅手','右翼手','DH'] },
      { key: 'batting', label: '投打', type: 'select', options: ['右投右打','右投左打','左投左打','両投両打'] },
      { key: 'team', label: 'チーム名', type: 'text' },
      { key: 'idolPlayer', label: '憧れの選手', type: 'text' },
    ],
  },
  {
    id: 'soccer', emoji: '⚽', label: 'サッカー', sectionTitle: 'サッカープロフ',
    fields: [
      { key: 'soccerPos', label: 'ポジション', type: 'select', options: ['GK','DF','MF','FW'] },
      { key: 'jerseyNumber', label: '背番号', type: 'text' },
      { key: 'team', label: 'チーム名', type: 'text' },
      { key: 'idolPlayer', label: '憧れの選手', type: 'text' },
    ],
  },
  {
    id: 'musician', emoji: '🎸', label: '音楽・バンド', sectionTitle: '音楽プロフ',
    fields: [
      { key: 'part', label: 'パート', type: 'select', options: ['ボーカル','ギター','ベース','ドラム','キーボード','その他'] },
      { key: 'bandName', label: 'バンド名・ユニット名', type: 'text' },
      { key: 'experience', label: '音楽歴', type: 'text' },
      { key: 'idol', label: '憧れのアーティスト', type: 'text' },
    ],
  },
  {
    id: 'gamer', emoji: '🎮', label: 'ゲーム', sectionTitle: 'ゲーマープロフ',
    fields: [
      { key: 'mainGame', label: 'メインゲーム', type: 'text' },
      { key: 'platform', label: 'プラットフォーム', type: 'select', options: ['Switch','PS5','Xbox','PC','スマホ','アーケード'] },
      { key: 'playStyle', label: 'プレイスタイル', type: 'select', options: ['ガチ勢','エンジョイ勢','実況・配信','収集・やりこみ'] },
      { key: 'gamerId', label: 'ゲーマーID・配信名', type: 'text' },
    ],
  },
  {
    id: 'creator', emoji: '🎨', label: 'アート・創作', sectionTitle: 'クリエイタープロフ',
    fields: [
      { key: 'creatorType', label: 'ジャンル', type: 'select', options: ['イラスト','デザイン','写真','映像','ハンドメイド','その他'] },
      { key: 'tools', label: '使用ツール・道具', type: 'text' },
      { key: 'sns', label: '活動SNS・URL', type: 'text' },
    ],
  },
];

// プロフィールの共通点フィールド定義（共通点さがし・なかよし度に使用）
const MATCH_FIELDS: { key: keyof typeof defaultProfileBookInfo; label: string }[] = [
  { key: 'bloodType', label: '血液型' },
  { key: 'mbti', label: 'MBTI' },
  { key: 'favoriteFood', label: '好きな食べ物' },
  { key: 'favoriteSubject', label: '好きな教科' },
  { key: 'favoriteCharacter', label: '好きなキャラ' },
  { key: 'favoriteGame', label: '好きなゲーム' },
  { key: 'personality', label: '性格' },
];

function containsNgWord(text: string): boolean {
  return NG_WORDS.some((w) => text.includes(w));
}

const initialDiaryPages: DiaryPage[] = isDev ? [
  {
    id: 'diary-1',
    theme: '給食の思い出',
    description: '学校の給食で好きだったもの、嫌いだったもの教えて！揚げパンとソフト麺、どっち派？',
    createdBy: '@mayu_note',
    createdByName: 'まゆ',
    createdByAvatar: '🎀',
    createdAt: '2024-04-01T09:00:00Z',
    entries: [
      { id: 'e1-1', authorId: '@mayu_note', authorName: 'まゆ', authorAvatar: '🎀', body: '揚げパンの日は朝から絶対楽しみだった〜！ミルメーク入れた牛乳も最高だったな', postedAt: '2024-04-01T09:10:00Z' },
      { id: 'e1-2', authorId: '@rin_puri', authorName: 'りん', authorAvatar: '🌙', body: 'ソフト麺の日がいちばん好き！ミートソース派でした。冷凍みかんも懐かしいよね', postedAt: '2024-04-01T10:30:00Z' },
      { id: 'e1-3', authorId: '@nana_7', authorName: 'なな', authorAvatar: '🧸', body: '冷凍みかんが苦手で端っこに置いてた笑。でもなぜかデザートの日は誰より早かった', postedAt: '2024-04-01T13:00:00Z' },
    ],
    visibility: 'followers',
    mentionedUserIds: [],
  },
  {
    id: 'diary-2',
    theme: '放課後の定番',
    description: '学校終わったらどこ行ってた？寄り道先とかあの頃の定番を教えて！',
    createdBy: '@haru_cafe',
    createdByName: 'はる',
    createdByAvatar: '☕️',
    createdAt: '2024-04-02T14:00:00Z',
    entries: [
      { id: 'e2-1', authorId: '@haru_cafe', authorName: 'はる', authorAvatar: '☕️', body: 'マックでポテト食べながら次の日の話してた。なんであんなに話すことあったんだろ笑', postedAt: '2024-04-02T14:10:00Z' },
      { id: 'e2-2', authorId: '@yui_book', authorName: 'ゆい', authorAvatar: '📚', body: '図書館！でも半分くらい漫画読んでた笑。司書さんに何度怒られたことか', postedAt: '2024-04-02T16:00:00Z' },
    ],
    visibility: 'followers',
    mentionedUserIds: [],
  },
] : [];

const initialCircles: Circle[] = isDev ? [
  { id: 'circle-1', name: 'ダンスサークル', emoji: '🕺', memberIds: ['@koki', '@mayu_note', '@nana_7', '@akari_28'], createdBy: '@koki' },
  { id: 'circle-2', name: '写真好き集まれ', emoji: '📸', memberIds: ['@koki', '@rin_puri', '@haru_cafe'], createdBy: '@rin_puri' },
  { id: 'circle-3', name: '深夜散歩部', emoji: '🌙', memberIds: ['@koki', '@haru_cafe', '@yui_book', '@rin_puri'], createdBy: '@koki' },
  // 公認サークルの例：著名グループが運営し、ファンも参加できる
  {
    id: 'circle-official-1', name: 'STARLIGHT公式', emoji: '⭐',
    memberIds: ['@mayu_note', '@rin_puri', '@nana_7', '@haru_cafe'], createdBy: '@mayu_note',
    isOfficial: true, allowFans: true, fanIds: ['@koki', '@yui_book', '@akari_28'], pendingFanIds: [],
  },
  // 自分がオーナーの公認サークル（ファン申請の承認デモ）
  {
    id: 'circle-official-2', name: 'Koki写真部 公式', emoji: '📷',
    memberIds: ['@koki', '@rin_puri'], createdBy: '@koki',
    isOfficial: true, allowFans: true, fanIds: ['@mayu_note'], pendingFanIds: ['@yui_book', '@akari_28'],
  },
  // 自分が部外者の公認サークル（ファン申請デモ）
  {
    id: 'circle-official-3', name: 'BLUE ROSE公式', emoji: '🌹',
    memberIds: ['@yui_book', '@akari_28'], createdBy: '@yui_book',
    isOfficial: true, allowFans: true, fanIds: ['@haru_cafe'], pendingFanIds: [],
  },
] : [];

const initialCirclePosts: CirclePost[] = isDev ? [
  {
    id: 'cp-1', circleId: 'circle-1',
    body: '最近の練習でいちばん苦戦したところは？',
    postedBy: '@koki', postedByName: 'Koki', postedByAvatar: '📷', postedAt: '2024-04-10T10:00:00Z',
    replies: [
      { userId: '@mayu_note', userName: 'まゆ', userAvatar: '🎀', body: 'ターンの軸が全然ブレる😭 毎日鏡の前で練習中', postedAt: '2024-04-10T11:00:00Z' },
      { userId: '@nana_7', userName: 'なな', userAvatar: '🧸', body: '早いパートの手の動き！ゆっくりからやってる', postedAt: '2024-04-10T12:00:00Z' },
    ],
  },
  {
    id: 'cp-2', circleId: 'circle-1',
    body: '今年の発表会の衣装テーマ、なんかアイデアある？',
    postedBy: '@akari_28', postedByName: 'あかり', postedByAvatar: '🍒', postedAt: '2024-04-11T09:00:00Z',
    replies: [],
  },
  {
    id: 'cp-3', circleId: 'circle-2',
    body: '最近撮った写真で一番お気に入り、テーマ教えて！',
    postedBy: '@rin_puri', postedByName: 'りん', postedByAvatar: '🌙', postedAt: '2024-04-12T15:00:00Z',
    replies: [
      { userId: '@koki', userName: 'Koki', userAvatar: '📷', body: '夕方の喫茶店の逆光。偶然すごくよく撮れた', postedAt: '2024-04-12T16:00:00Z' },
    ],
  },
  {
    id: 'cp-4', circleId: 'circle-3',
    body: '深夜散歩のおすすめコース、誰か教えて',
    postedBy: '@haru_cafe', postedByName: 'はる', postedByAvatar: '☕️', postedAt: '2024-04-13T23:00:00Z',
    replies: [
      { userId: '@koki', userName: 'Koki', userAvatar: '📷', body: '川沿い→高架下→コンビニ、は鉄板です', postedAt: '2024-04-13T23:30:00Z' },
      { userId: '@yui_book', userName: 'ゆい', userAvatar: '📚', body: '住宅街をランダムに歩くのが好き、迷子になっても楽しい', postedAt: '2024-04-14T00:10:00Z' },
    ],
  },
  // 公認サークル：ファンも回答できる投票お題
  {
    id: 'cp-5', circleId: 'circle-official-1',
    body: '一番朝が弱いメンバーは誰？',
    postedBy: '@mayu_note', postedByName: 'まゆ', postedByAvatar: '🎀', postedAt: '2024-04-15T18:00:00Z',
    replies: [],
    audience: 'everyone', kind: 'vote',
    votes: [
      { userId: '@rin_puri', targetId: '@nana_7' },
      { userId: '@haru_cafe', targetId: '@nana_7' },
      { userId: '@yui_book', targetId: '@mayu_note' },
    ],
  },
  // 公認サークル：メンバーだけの質問（ファンには内容が見えない）
  {
    id: 'cp-6', circleId: 'circle-official-1',
    body: '次のライブのセトリ、最後の曲どっちにする？',
    postedBy: '@rin_puri', postedByName: 'りん', postedByAvatar: '🌙', postedAt: '2024-04-16T12:00:00Z',
    replies: [
      { userId: '@nana_7', userName: 'なな', userAvatar: '🧸', body: '新曲で締めたい！', postedAt: '2024-04-16T13:00:00Z' },
    ],
    audience: 'members',
  },
  // 自分がオーナーの公認サークルのお題
  {
    id: 'cp-7', circleId: 'circle-official-2',
    body: '一番シャッターチャンスに強い人は誰？',
    postedBy: '@koki', postedByName: 'Koki', postedByAvatar: '📷', postedAt: '2024-04-17T10:00:00Z',
    replies: [],
    audience: 'everyone', kind: 'vote',
    votes: [{ userId: '@mayu_note', targetId: '@rin_puri' }],
  },
  // 部外者視点デモ用（申請前は内容が見えない）
  {
    id: 'cp-8', circleId: 'circle-official-3',
    body: '新衣装のカラー、どっちが好き？',
    postedBy: '@yui_book', postedByName: 'ゆい', postedByAvatar: '📚', postedAt: '2024-04-18T09:00:00Z',
    replies: [],
    audience: 'everyone',
  },
] : [];

// 装備中の背景テーマ（ガチャ背景）をヘッダー/タブの色合わせに使うためのコンテキスト
const ChromeThemeContext = createContext<BgTheme | null>(null);

// 他人のプロフ帳では未入力の項目を隠す（自分のときは空欄も見せて入力を促す）
const HideEmptyProfileContext = createContext<boolean>(false);
// プロフ帳のテーマ色（ProfileLine のラベル・区切り線の色に使う）
const ProfThemeContext = createContext<string>('pink');
// テーマ色 → 区切り線の bg クラス
const THEME_BAR: Record<string, string> = {
  pink:   'bg-pink',
  purple: 'bg-purple',
  blue:   'bg-blue-400',
  green:  'bg-green-500',
  orange: 'bg-orange-400',
};

function tabFromScreen(screen: Screen): TabKey {
  if (screen === 'search') return 'search';
  if (screen === 'create') return 'create';
  if (screen === 'mypage' || screen === 'followers' || screen === 'settings' || screen === 'official-question-create' || screen === 'shop' || screen === 'wallet') return 'mypage';
  if (screen === 'notifications') return 'notifications';
  if (screen === 'diary-list' || screen === 'diary-detail' || screen === 'diary-create') return 'home';
  if (screen === 'blog-list' || screen === 'blog-detail' || screen === 'blog-create') return 'home';
  if (screen === 'circles' || screen === 'circle-detail' || screen === 'circle-create') return 'home';
  return 'home';
}

function Phone({ children, active, go, lang, bgTheme = null, unread = 0 }: { children: React.ReactNode; active: TabKey; go: (s: Screen) => void; lang: Lang; bgTheme?: BgTheme | null; unread?: number }) {
  return (
    <main className="relative mx-auto h-dvh w-full max-w-[390px] overflow-hidden bg-base text-ink shadow-2xl shadow-purple/10 sm:max-w-none md:mx-0 md:h-[calc(100vh-48px)] md:rounded-[32px]">
      {/* 装備中テーマをアプリ全体の背景に敷く（上に薄い白で読みやすさを確保） */}
      {bgTheme && (
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <SceneBackground theme={bgTheme} subtle />
          <div className="absolute inset-0 bg-white/40" />
        </div>
      )}
      <ChromeThemeContext.Provider value={bgTheme}>
        <div className="relative z-10 h-full overflow-y-auto pb-32 md:pb-8">{children}</div>
        <div className="relative z-20 md:hidden"><BottomTab active={active} onChange={(key) => go(key === 'notifications' ? 'notifications' : key)} lang={lang} unread={unread} themeGradient={bgTheme?.gradient} /></div>
      </ChromeThemeContext.Provider>
    </main>
  );
}

function DesktopNav({ active, go, lang = 'ja', currentScreen }: { active: TabKey; go: (s: Screen) => void; lang?: Lang; currentScreen?: Screen }) {
  const secondaryScreens: Screen[] = ['followers', 'settings', 'shop', 'circles', 'wallet'];
  const inSecondary = currentScreen ? secondaryScreens.includes(currentScreen) : false;
  const items: { key: TabKey; labelKey: string; icon: any; screen: Screen }[] = [
    { key: 'home', labelKey: 'tab_home', icon: Home, screen: 'home' },
    { key: 'search', labelKey: 'tab_search', icon: Search, screen: 'search' },
    { key: 'create', labelKey: 'tab_create', icon: Plus, screen: 'create' },
    { key: 'notifications', labelKey: 'tab_notifications', icon: Bell, screen: 'notifications' },
    { key: 'mypage', labelKey: 'tab_mypage', icon: UserRound, screen: 'mypage' }
  ];
  // 全項目を同じルール（アイコン/文字/余白）で描く。選択中は「ノートのインデックス」：
  // クリーム紙＋左端の色付きタブ＋濃い文字。装飾は選択中だけに付けて主張しすぎない。
  const NavRow = ({ icon: Icon, label, selected, onClick }: { icon: any; label: string; selected: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      aria-current={selected ? 'page' : undefined}
      className={`relative flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm font-black transition ${
        selected ? 'bg-cream text-ink shadow-[0_2px_0_rgba(0,0,0,.08)]' : 'text-muted hover:bg-pink/10 hover:text-ink'
      }`}
    >
      {selected && <span aria-hidden className="absolute inset-y-1.5 left-0 w-1.5 rounded-r-full bg-pink" />}
      <Icon size={20} className={selected ? 'text-pink' : ''} />
      {label}
    </button>
  );
  const secondary: { screen: Screen; label: string; icon: any }[] = [
    { screen: 'shop', label: t('nav_shop', lang), icon: ShoppingBag },
    { screen: 'collab', label: t('nav_collab', lang), icon: Handshake },
    { screen: 'circles', label: t('nav_circles', lang), icon: Lock },
    { screen: 'followers', label: t('nav_following', lang), icon: Users },
    { screen: 'settings', label: t('nav_settings', lang), icon: Settings },
  ];
  return (
    <aside className="hidden h-[calc(100vh-48px)] w-[220px] shrink-0 rounded-[32px] border border-white/70 bg-white/80 p-5 shadow-card backdrop-blur md:block lg:w-[260px]">
      <div className="mb-8 flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-pink shadow-card overflow-hidden"><img src="/icon.png" alt="Miri" className="h-full w-full object-cover" /></div><div><p className="flex items-center gap-1.5 text-xl font-black">Miri<RetroMiniStar /></p><p className="text-xs font-bold text-muted">Profile Book SNS</p></div></div>
      <nav className="space-y-1">
        {items.map((item) => (
          <NavRow key={item.key} icon={item.icon} label={t(item.labelKey, lang)} selected={!inSecondary && active === item.key} onClick={() => go(item.screen)} />
        ))}
      </nav>
      <div className="mx-3 my-3 border-t-2 border-dotted border-black/10" aria-hidden />
      <div className="space-y-1">
        {secondary.map((s) => (
          <NavRow key={s.screen} icon={s.icon} label={s.label} selected={currentScreen === s.screen} onClick={() => go(s.screen)} />
        ))}
      </div>
      {isDev && (
      <div className="mt-6 rounded-[24px] bg-cream p-4 text-xs font-bold leading-6">
        投稿・検索・リアクション・コメントが動くPC対応版です。次はSupabase保存に進めます。
      </div>
      )}
    </aside>
  );
}

function OfficialBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-500 ring-1 ring-blue-100">
      ✓ 公認
    </span>
  );
}

function RightRail({ answers, go, avatarUrl, ownedStickerCount, lang = 'ja', translatedAnswerBodies = {} }: { answers: Answer[]; go: (s: Screen, answerId?: string) => void; avatarUrl: string; ownedStickerCount: number; lang?: Lang; translatedAnswerBodies?: Record<string, string> }) {
  const myAnswers = answers.filter((a) => a.user.id === me.id);
  // フォロー中の件数は本番ではSupabaseから取得（マイページと表記を揃える）。デモはダミー件数。
  const [followingCount, setFollowingCount] = useState<number>(() => (isDev ? followers.length : 0));
  useEffect(() => {
    if (isDev || !dbReady()) return;
    let cancelled = false;
    getFollowCounts().then((c) => { if (!cancelled) setFollowingCount(c.following); });
    return () => { cancelled = true; };
  }, []);
  return (
    <aside className="hidden h-[calc(100vh-48px)] w-[320px] shrink-0 overflow-y-auto rounded-[32px] border border-white/70 bg-white/70 p-5 shadow-card backdrop-blur xl:block">
      <section className="cursor-pointer rounded-[28px] bg-white p-4 shadow-card transition hover:bg-pink/5 active:scale-[0.99]" onClick={() => go('profile')}>
        <div className="flex items-center gap-3"><div className="grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-pink/15 text-2xl">{avatarUrl ? <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" /> : me.avatar}</div><div><p className="font-black">{me.name}</p><p className="text-xs font-bold text-muted">{me.id}</p></div></div>
        <div className="mt-4 grid grid-cols-3 rounded-3xl bg-base p-3 text-center text-xs font-bold">
          <div><p className="text-lg text-ink">{myAnswers.length}</p>{t('tab_create', lang)}</div>
          <button onClick={(e) => { e.stopPropagation(); go('followers'); }} className="hover:text-pinkStrong transition"><p className="text-lg text-ink">{followingCount}</p>{t('btn_following', lang)}</button>
          <button onClick={(e) => { e.stopPropagation(); go('shop'); }} className="hover:text-pinkStrong transition"><p className="text-lg text-ink">{ownedStickerCount}</p>{t('nav_shop', lang)}</button>
        </div>
      </section>
      <section className="mt-5 rounded-[28px] bg-white p-4 shadow-card">
        <SectionHeader title={t('feed_popular', lang)} />
        <div className="space-y-3">{answers.slice(0,3).map((answer) => (
          <button key={answer.id} onClick={() => go('detail', answer.id)} className="block w-full rounded-2xl bg-base p-3 text-left hover:bg-pink/10">
            <span className="inline-block rounded-full bg-pink/10 px-2 py-0.5 text-[10px] font-black text-pinkStrong">{answer.question ? localizeQuestion(answer.question, lang).category : ''}</span>
            <span className="mt-1 block text-xs font-black leading-5 text-ink line-clamp-2">Q. {answer.question ? localizeQuestion(answer.question, lang).title : ''}</span>
            <span className="mt-0.5 block text-xs font-bold leading-5 text-muted line-clamp-2">{(translatedAnswerBodies[answer.id] ?? answer.body).slice(0,50)}</span>
          </button>
        ))}</div>
      </section>
      {profiles.length > 0 && (
      <section className="mt-5 rounded-[28px] bg-white p-4 shadow-card">
        <SectionHeader title={t('feed_suggested', lang)} />
        <div className="space-y-3">{profiles.slice(0,3).map((profile) => <button key={profile.id} onClick={() => go('profile', profile.id)} className="flex w-full items-center gap-3 rounded-2xl bg-base p-3 text-left hover:bg-pink/10"><span className="grid h-10 w-10 place-items-center rounded-full bg-white text-xl">{profile.avatar}</span><span><b className="text-sm">{profile.name}</b><br /><span className="text-xs text-muted">{profile.common}</span></span></button>)}</div>
      </section>
      )}
    </aside>
  );
}

function DesktopShell({ children, active, currentScreen, go, answers, avatarUrl, ownedStickerCount, lang, bgTheme = null, translatedAnswerBodies = {}, unread = 0 }: { children: React.ReactNode; active: TabKey; currentScreen?: Screen; go: (s: Screen, answerId?: string) => void; answers: Answer[]; avatarUrl: string; ownedStickerCount: number; lang: Lang; bgTheme?: BgTheme | null; translatedAnswerBodies?: Record<string, string>; unread?: number }) {
  return (
    <div className="min-h-screen bg-purple/25 p-0 md:p-6">
      <div className="mx-auto flex max-w-[1280px] gap-5">
        <DesktopNav active={active} go={go} lang={lang} currentScreen={currentScreen} />
        <div className="min-w-0 flex-1"><Phone active={active} go={go} lang={lang} bgTheme={bgTheme} unread={unread}>{children}</Phone></div>
        <RightRail answers={answers} go={go} avatarUrl={avatarUrl} ownedStickerCount={ownedStickerCount} lang={lang} translatedAnswerBodies={translatedAnswerBodies} />
      </div>
    </div>
  );
}

function AppHeader({ title = 'Miri', back = false, onBack, onBell, unread = 0, noAuto = false }: { title?: string; back?: boolean; onBack?: () => void; onBell?: () => void; unread?: number; /** 見出しが翻訳キー＋ユーザー名のとき true（自動翻訳でユーザー名をローマ字化させない） */ noAuto?: boolean }) {
  const chromeTheme = useContext(ChromeThemeContext);
  // ガチャ背景を装備中は、その背景グラデーションでヘッダーも色合わせ
  const headerBg = chromeTheme ? `bg-gradient-to-b ${chromeTheme.gradient}` : 'bg-base/90';
  return (
    <header className={`sticky top-0 z-20 flex h-16 items-center justify-between px-4 pt-2 backdrop-blur ${headerBg}`}>
      <button onClick={back ? onBack : undefined} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-card">
        {back ? <ArrowLeft size={20} /> : <img src="/icon.png" alt="Miri" className="h-8 w-8 rounded-xl object-cover" />}
      </button>
      <h1 className="min-w-0 truncate px-2 text-lg font-black tracking-tight" data-noauto={noAuto || undefined}>{title}</h1>
      <button onClick={onBell} className="relative grid h-10 w-10 place-items-center rounded-full bg-white shadow-card">
        <Bell size={19} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-pink px-1 text-[9px] font-black text-white">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>
    </header>
  );
}

// PR案件（企業のPR質問）は一旦非表示。データ・ロジックは残し、表示だけオフにする。
const SHOW_PR_QUESTIONS = false;

function HomeScreen({
  go,
  answers,
  communityQuestions,
  diaryPages,
  blogPosts = [],
  circles,
  circlePosts,
  dailyQuestion,
  hasAnsweredToday,
  prQuestion,
  hasAnsweredPR,
  translatedAnswerBodies,
  isTranslating,
  likedIds,
  reactionsMap,
  onLike,
  onReact,
  myStickers = [],
  unread = 0,
  lang = 'ja',
}: {
  go: (s: Screen, payload?: any) => void;
  answers: Answer[];
  communityQuestions: any[];
  diaryPages: DiaryPage[];
  blogPosts?: BlogPost[];
  circles: Circle[];
  circlePosts: CirclePost[];
  dailyQuestion: Question;
  hasAnsweredToday: boolean;
  prQuestion: PRQuestion;
  hasAnsweredPR: boolean;
  translatedAnswerBodies: Record<string, string>;
  isTranslating: boolean;
  likedIds?: Set<string>;
  reactionsMap?: Record<string, Record<string, { count: number; mine: boolean }>>;
  onLike?: (answerId: string) => void;
  onReact?: (answerId: string, type: string) => void;
  myStickers?: string[];
  unread?: number;
  lang?: Lang;
}) {
  // フィードのカードから直接スタンプでリアクションするためのピッカー対象
  const [stickerPickerFor, setStickerPickerFor] = useState<string | null>(null);
  return (
    <>
      <AppHeader onBell={() => go('notifications')} unread={unread} />
      <div className="space-y-6 px-4 pt-3">
{communityQuestions.length > 0 && (
  <section className="space-y-3">
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-black text-ink">
        {t('home_community_q', lang)}
      </h2>

      <button onClick={() => go('search')} className="text-xs font-black text-pink">
        {t('btn_see_more', lang)}
      </button>
    </div>

    {communityQuestions.map((q) => (
      <div
        key={q.id}
        className="w-full rounded-[24px] bg-white p-4 text-left shadow-card"
      >
        {/* 投稿者（企業/公認アカウント）: タップでそのアカウントへ遷移 */}
        <button
          type="button"
          onClick={() => go('profile', q.createdBy)}
          className="mb-2 flex items-center gap-2 rounded-full active:scale-[0.98]"
        >
          <OfficialBadge />
          <span className="text-xs font-black text-muted underline decoration-dotted underline-offset-2">
            {tf('home_created_by', lang, { name: q.createdByName })}
          </span>
        </button>

        {/* お題本文: タップで回答画面へ */}
        <button
          type="button"
          onClick={() => go('create', q)}
          className="block w-full text-left active:scale-[0.99]"
        >
          <p className="text-base font-black text-ink">
            {q.title}
          </p>

          <p className="mt-1 text-xs font-bold text-muted">
            {q.description}
          </p>
        </button>
      </div>
    ))}
  </section>
)}

        <section className="relative">
          <span className="pointer-events-none absolute -right-1 -top-3 z-10"><RetroStar /></span>
          <SectionHeader
            title={t('home_today', lang)}
            action={hasAnsweredToday ? `${t('home_answered', lang)} ✅` : t('home_answer', lang)}
            onAction={() => go('daily-question')}
          />
          <button onClick={() => go('daily-question')} className="block w-full text-left">
            <div className="relative overflow-hidden rounded-[28px] bg-white p-4 shadow-card active:scale-[0.98] transition">
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-full bg-base px-2 py-0.5 text-[10px] font-black text-muted">📅 {t('home_daily_badge', lang)}</span>
              </div>
              <p className="text-base font-black text-ink leading-relaxed pr-2">{dailyQuestion ? localizeQuestion(dailyQuestion, lang).title : ''}</p>
              <div className="mt-3 flex items-center gap-2">
                {hasAnsweredToday ? (
                  <span className="rounded-full bg-pink/10 px-3 py-1 text-[10px] font-black text-pink">🔓 {t('home_see_answers', lang)}</span>
                ) : (
                  <span className="rounded-full bg-purple/10 px-3 py-1 text-[10px] font-black text-purple">🔒 {t('home_locked', lang)}</span>
                )}
              </div>
            </div>
          </button>
        </section>
        {/* ── PR案件 ──（一旦非表示：SHOW_PR_QUESTIONS で切替） */}
        {SHOW_PR_QUESTIONS && (
        <section>
          <div className="flex items-center mb-3">
            <h2 className="text-lg font-black text-ink">💼 {t('home_pr', lang)}</h2>
          </div>
          <button
            onClick={() => !hasAnsweredPR && go('create', { ...prQuestion, id: prQuestion.id, category: 'PR', title: prQuestion.question })}
            className={`w-full text-left rounded-[24px] bg-gradient-to-br ${prQuestion.brandBg} p-4 shadow-card transition ${hasAnsweredPR ? 'opacity-60' : 'active:scale-[0.99]'}`}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{prQuestion.brandEmoji}</span>
                <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-black text-ink">{prQuestion.brand}</span>
                <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-black text-amber-600">PR</span>
              </div>
              <span className="rounded-full bg-amber-400 px-3 py-1 text-[11px] font-black text-white">
                <CoinIcon size={13} /> +{prQuestion.reward}
              </span>
            </div>
            <p className="text-sm font-black text-ink leading-relaxed">{tv(prQuestion.question, lang)}</p>
            <p className="mt-2 text-[10px] font-bold text-ink/60">
              {hasAnsweredPR ? `✅ ${t('home_pr_done', lang)}` : t('home_pr_reward', lang)}
            </p>
          </button>
        </section>
        )}

        <section className="relative">
          <span className="pointer-events-none absolute right-20 -top-2 z-10"><RetroNote /></span>
          <SectionHeader title={t('sec_trending', lang)} action={t('btn_see_more', lang)} onAction={() => go('search')} />
          {!isTranslating && answers.length === 0 && (
            <button onClick={() => go('create')} className="flex w-full flex-col items-center gap-2 rounded-[28px] border border-dashed border-pink/40 bg-white/70 px-6 py-8 text-center shadow-card transition active:scale-[0.99]">
              <span className="text-3xl">🌱</span>
              <p className="text-sm font-black text-ink">{t('home_empty_title', lang)}</p>
              <p className="text-xs font-bold text-muted">{t('home_empty_desc', lang)}</p>
              <span className="mt-1 rounded-full bg-pink px-4 py-1.5 text-xs font-black text-white">{t('btn_answer_topic', lang)}</span>
            </button>
          )}
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
            {isTranslating && (
              <p className="w-full text-center text-xs font-bold text-muted py-2">🌐 {t('msg_translating', lang)}</p>
            )}
            {answers.map((answer) => (
              <button key={answer.id} onClick={() => go('detail', answer.id)} className="min-w-[288px] text-left transition active:scale-[0.98]">
                <AnswerCard answer={answer} translatedBody={translatedAnswerBodies[answer.id]} liked={likedIds?.has(answer.id)} reactions={reactionsMap?.[answer.id]} onLike={onLike ? () => onLike(answer.id) : undefined} onSticker={onReact ? () => setStickerPickerFor(answer.id) : undefined} onUserClick={(u) => go('profile', { name: u.name, id: u.id, avatar: u.avatar, bio: '', common: '' })} />
              </button>
            ))}
          </div>
        </section>
        <section>
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-lg font-black text-ink"><RetroHeart scale={0.85} />🤝 {t('sec_diary', lang)}</h2>
            <button onClick={() => go('diary-list')} className="text-xs font-black text-pink">{t('btn_see_more', lang)}</button>
          </div>
          <p className="mt-0.5 text-[11px] font-bold text-muted">{t('home_diary_desc', lang)}</p>
          <div className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-2">
            {diaryPages.slice(0, 5).map((page) => (
              <button key={page.id} onClick={() => go('diary-detail', page.id)} className="min-w-[220px] rounded-[24px] bg-gradient-to-br from-pink/10 via-white to-purple/10 p-4 text-left shadow-card active:scale-[0.98]">
                <p className="font-black text-ink">{page.theme}</p>
                <p className="mt-1 line-clamp-2 text-xs font-bold text-muted">{page.description}</p>
                <p className="mt-3 text-xs font-black text-pink">✍ {t('msg_entries', lang).replace('%n', String(page.entries.length))}</p>
              </button>
            ))}
            <button onClick={() => go('diary-create')} className="grid min-w-[110px] place-items-center rounded-[24px] border border-dashed border-pink/40 bg-white px-4 text-sm font-black text-pink shadow-card active:scale-[0.98]">
              {t('btn_create', lang)}
            </button>
          </div>
        </section>

        {/* ブログ（個人記事・交換日記とは別機能） */}
        <section>
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-lg font-black text-ink">📔 {t('pb_blog', lang)}</h2>
            <button onClick={() => go('blog-list')} className="text-xs font-black text-pink">{t('btn_see_more', lang)}</button>
          </div>
          <p className="mt-0.5 text-[11px] font-bold text-muted">{t('home_blog_desc', lang)}</p>
          <div className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-2">
            {[...blogPosts].sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()).slice(0, 5).map((p) => (
              <button key={p.id} onClick={() => go('blog-detail', p.id)} className="min-w-[220px] max-w-[220px] overflow-hidden rounded-[24px] bg-gradient-to-br from-purple/10 via-white to-pink/10 text-left shadow-card active:scale-[0.98]">
                {p.photoUrl && (
                  <div className="h-24 w-full overflow-hidden bg-pink/5">
                    <img src={p.photoUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                )}
                <div className="p-4">
                  <p className="text-sm">{p.weather}{p.mood}</p>
                  <p className="mt-1 font-black leading-snug text-ink line-clamp-1" style={{ color: p.textColor || undefined }}>{p.title || t('pb_blog_untitled', lang)}</p>
                  <p className="mt-1 line-clamp-2 text-xs font-bold text-muted"><RetroText text={blogPlain(p.body)} /></p>
                  <div className="mt-2.5 flex items-center gap-1.5">
                    <AvatarBubble value={p.authorAvatar} className="h-6 w-6 text-xs" />
                    <span className="min-w-0">
                      <span className="block truncate text-[11px] font-black text-ink leading-tight">{p.authorName}</span>
                      <span className="block truncate text-[10px] font-bold text-muted leading-tight">{p.authorId}</span>
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-black text-pink">♡ {p.likes}　💬 {p.comments.length}</p>
                </div>
              </button>
            ))}
            <button onClick={() => go('blog-create')} className="grid min-w-[110px] place-items-center rounded-[24px] border border-dashed border-purple/40 bg-white px-4 text-sm font-black text-purple shadow-card active:scale-[0.98]">
              ＋ {t('home_blog_write', lang)}
            </button>
          </div>
        </section>
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-ink">🔒 {t('nav_circles', lang)}</h2>
            <button onClick={() => go('circles')} className="text-xs font-black text-pink">{t('tab_search', lang)} →</button>
          </div>
          <p className="mt-0.5 text-[11px] font-bold text-muted">{t('home_circle_desc', lang)}</p>
          <div className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-2">
            {circles.map((c) => {
              const latest = circlePosts.filter((p) => p.circleId === c.id).slice(-1)[0];
              return (
                <button key={c.id} onClick={() => go('circle-detail', c.id)}
                  className="min-w-[200px] rounded-[24px] bg-gradient-to-br from-purple/10 via-white to-pink/10 p-4 text-left shadow-card active:scale-[0.98]">
                  <p className="text-2xl">{c.emoji}</p>
                  <p className="mt-1 font-black text-ink">{c.name}</p>
                  <p className="mt-0.5 text-[11px] font-bold text-muted">{c.memberIds.length}{t('label_members', lang)}</p>
                  {latest && <p className="mt-2 line-clamp-1 text-xs font-bold text-muted">「{latest.body.slice(0, 18)}…」</p>}
                </button>
              );
            })}
            <button onClick={() => go('circles')}
              className="grid min-w-[130px] place-items-center rounded-[24px] border border-dashed border-purple/40 bg-white px-4 text-center text-sm font-black text-purple shadow-card active:scale-[0.98]">
              🔍 {t('home_circle_find', lang)}
            </button>
            <button onClick={() => go('circle-create')}
              className="grid min-w-[100px] place-items-center rounded-[24px] border border-dashed border-pink/40 bg-white px-4 text-sm font-black text-pink shadow-card active:scale-[0.98]">
              ＋ {t('btn_create', lang)}
            </button>
          </div>
        </section>
        <section className="relative">
          <span className="pointer-events-none absolute -right-1 -top-3 z-10"><RetroFlower /></span>
          <SectionHeader title={t('sec_new_profiles', lang)} action={t('btn_see', lang)} onAction={() => go('search')} />
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
            {profiles.map((profile) => (
              <button key={profile.id} onClick={() => go('profile', profile.id)} className="text-left transition active:scale-[0.98]">
                <ProfileCard profile={profile} />
              </button>
            ))}
          </div>
        </section>
        {questions.length > 2 && (
        <section>
          <SectionHeader title={t('sec_collab', lang)} />
          <button onClick={() => go('create')} className="block w-full text-left"><QuestionCard question={questions[2]} /></button>
        </section>
        )}
      </div>

      {/* フィードのカードから直接スタンプでリアクション（ボトムシート） */}
      {stickerPickerFor && onReact && (
        <div className="pixel-picker-overlay fixed inset-0 z-50 flex items-end justify-center" onClick={() => setStickerPickerFor(null)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="pixel-picker-sheet relative w-full max-w-md p-3" onClick={(e) => e.stopPropagation()}>
            <p className="mb-2 px-2 text-xs font-black text-white drop-shadow">{t('react_sticker', lang)}</p>
            <EmojiPicker myStickers={myStickers} onPick={(e) => { onReact(stickerPickerFor, e); setStickerPickerFor(null); }} />
          </div>
        </div>
      )}
    </>
  );
}

// さがす画面の話題タグ（表示は翻訳キー、検索には日本語の語も使う）
const TREND_TAGS = [
  { key: 'tag_heisei', ja: '平成' }, { key: 'tag_lunch', ja: '給食' }, { key: 'tag_nightowl', ja: '夜型' },
  { key: 'tag_indoor', ja: 'インドア' }, { key: 'tag_oshi', ja: '推し活' }, { key: 'tag_afterschool', ja: '放課後' },
];

function SearchScreen({ go, answers, myProfile, questionList, reactionsMap, likedIds, onLike, onReact, myStickers = [] }: {
  go: (s: Screen, payload?: any) => void;
  answers: Answer[];
  myProfile: typeof defaultProfileBookInfo;
  questionList: Question[];
  reactionsMap?: Record<string, Record<string, { count: number; mine: boolean }>>;
  likedIds?: Set<string>;
  onLike?: (answerId: string) => void;
  onReact?: (answerId: string, type: string) => void;
  myStickers?: string[];
}) {
  const lang = useLang();
  const [query, setQuery] = useState('');
  const [stickerPickerFor, setStickerPickerFor] = useState<string | null>(null);
  const [mode, setMode] = useState<'answer' | 'person' | 'question' | 'match'>('answer');
  // 話題タグ：表示は閲覧者の言語。押したときは訳と日本語の両方で探す（回答は日本語で書かれていることが多いため）
  const tagHit = TREND_TAGS.find((tg) => t(tg.key, lang) === query.trim());
  const terms = [query.toLowerCase(), ...(tagHit ? [tagHit.ja.toLowerCase()] : [])];
  const hit = (text: string) => terms.some((w) => text.toLowerCase().includes(w));
  // 回答タブでお題を選んで絞り込むためのお題ID（'' = すべてのお題）
  const [selectedOdaiId, setSelectedOdaiId] = useState('');
  const filteredAnswers = answers.filter((a) =>
    hit(`${a.body} ${a.question?.title ?? ''} ${a.question ? localizeQuestion(a.question, lang).title : ''} ${a.user.name}`)
    && (!selectedOdaiId || a.question?.id === selectedOdaiId)
  );
  const localProfiles = profiles.filter((p) => `${p.name} ${p.id} ${p.bio} ${p.common}`.toLowerCase().includes(query.toLowerCase()));
  const filteredQuestions = questionList.filter((q) => hit(`${q.title} ${q.category}`));

  // なかま検索：Supabase の実ユーザーも検索（入力が止まってから照会）
  const [dbProfiles, setDbProfiles] = useState<Profile[]>([]);
  useEffect(() => {
    const q = query.trim();
    if (mode !== 'person' || !q || !dbReady()) { setDbProfiles([]); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const rows = await searchProfiles(q);
      if (!cancelled) setDbProfiles(rows.map(rowToMiniProfile));
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, mode]);

  // ローカル（ダミー）＋Supabaseをマージ（id重複は排除）
  const filteredProfiles = useMemo(() => {
    const seen = new Set(localProfiles.map((p) => p.id));
    const merged = [...localProfiles];
    for (const p of dbProfiles) { if (!seen.has(p.id)) { seen.add(p.id); merged.push(p); } }
    return merged;
  }, [localProfiles, dbProfiles]);

  // 共通点マッチング
  const matches = useMemo(() => {
    const result: { profile: typeof followers[0]; field: string; value: string }[] = [];
    for (const [id, book] of Object.entries(mockProfileBooks)) {
      const profile = followers.find((f) => f.id === id);
      if (!profile) continue;
      for (const { key, label } of MATCH_FIELDS) {
        const myVal = myProfile[key]?.trim();
        const theirVal = book.info[key]?.trim();
        if (myVal && theirVal && myVal === theirVal) {
          result.push({ profile, field: label, value: myVal });
          break;
        }
      }
    }
    return result;
  }, [myProfile]);

  return (
    <>
      <AppHeader title={t('header_search', lang)} back onBack={() => go('home')} onBell={() => go('notifications')} />
      <div className="px-4 pt-3">
        <div className="flex items-center gap-2 rounded-full border border-purple-100 bg-white px-4 py-3 shadow-card">
          <Search size={20} className="text-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder={t('search_ph', lang)} />
        </div>
        <div className="mt-4 grid grid-cols-4 rounded-full bg-white p-1 text-center text-xs font-bold shadow-card">
          <button onClick={() => setMode('answer')} className={`rounded-full py-2 ${mode === 'answer' ? 'bg-pink text-white' : 'text-muted'}`}>{t('label_answers', lang)}</button>
          <button onClick={() => setMode('question')} className={`rounded-full py-2 ${mode === 'question' ? 'bg-pink text-white' : 'text-muted'}`}>{t('search_tab_topics', lang)}</button>
          <button onClick={() => setMode('person')} className={`rounded-full py-2 ${mode === 'person' ? 'bg-pink text-white' : 'text-muted'}`}>{t('search_tab_people', lang)}</button>
          <button onClick={() => setMode('match')} className={`rounded-full py-2 ${mode === 'match' ? 'bg-pink text-white' : 'text-muted'}`}>{t('search_tab_match', lang)}</button>
        </div>

        {mode === 'match' ? (
          <div className="mt-4 space-y-4 pb-8">
            <p className="text-xs font-bold text-muted">{t('search_match_desc', lang)} 🍀</p>
            {matches.length === 0 ? (
              <div className="rounded-[28px] bg-white p-8 text-center text-sm font-bold text-muted shadow-card">
                {t('search_match_empty', lang)}
              </div>
            ) : matches.map(({ profile, field, value }) => (
              <button key={profile.id} onClick={() => go('profile', profile.id)}
                className="flex w-full items-center gap-3 rounded-[24px] bg-white p-4 text-left shadow-card active:scale-[0.98]">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-pink/15 text-2xl">{profile.avatar}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-ink">{profile.name}</p>
                  <p className="text-xs font-bold text-muted">{profile.id}</p>
                  <p className="mt-1 text-xs font-bold text-pink">✨ {tf('fl_common', lang, { label: tv(field, lang), v: tv(value, lang) })}</p>
                </div>
                <span className="shrink-0 rounded-full bg-pink/10 px-3 py-2 text-xs font-black text-pink">{t('search_book', lang)}</span>
              </button>
            ))}
            <div className="rounded-[24px] bg-cream/60 px-4 py-3 text-xs font-bold text-muted">
              💡 {t('search_match_tip', lang)}
            </div>
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              {TREND_TAGS.map((tg) => (
                <button key={tg.key} onClick={() => setQuery(t(tg.key, lang))} className="rounded-full bg-white px-3 py-2 text-xs font-bold text-muted shadow-card">#{t(tg.key, lang)}</button>
              ))}
            </div>

            {/* お題プルダウン（回答タブ=絞り込み / お題タブ=選んで答える） */}
            {(mode === 'answer' || mode === 'question') && (
              <div className="mt-4">
                <select
                  value={mode === 'answer' ? selectedOdaiId : ''}
                  onChange={(e) => {
                    const qid = e.target.value;
                    if (mode === 'question') {
                      const q = questionList.find((x) => x.id === qid);
                      if (q) go('create', q);
                    } else {
                      setSelectedOdaiId(qid);
                    }
                  }}
                  className="w-full rounded-2xl border border-purple-100 bg-white p-3 text-sm font-bold text-ink outline-none shadow-card"
                >
                  <option value="">{mode === 'answer' ? t('search_all_topics', lang) : t('search_pick_topic', lang)}</option>
                  {questionList.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
                </select>
              </div>
            )}

            <section className="mt-6 space-y-3">
              <SectionHeader title={mode === 'answer' ? t('search_find_answers', lang) : mode === 'person' ? t('search_find_people', lang) : t('search_find_topics', lang)} />
              {mode === 'answer' && filteredAnswers.map((answer) => <button key={answer.id} onClick={() => go('detail', answer.id)} className="block w-full text-left"><AnswerCard answer={answer} liked={likedIds?.has(answer.id)} reactions={reactionsMap?.[answer.id]} onLike={onLike ? () => onLike(answer.id) : undefined} onSticker={onReact ? () => setStickerPickerFor(answer.id) : undefined} onUserClick={(u) => go('profile', { name: u.name, id: u.id, avatar: u.avatar, bio: '', common: '' })} /></button>)}
              {mode === 'person' && <div className="grid grid-cols-2 gap-3">{filteredProfiles.map((profile) => <button key={profile.id} onClick={() => go('profile', profile)} className="text-left"><ProfileCard profile={profile} /></button>)}</div>}
              {mode === 'question' && filteredQuestions.map((question) => <button key={question.id} onClick={() => go('create', question)} className="block w-full text-left"><QuestionCard question={question} /></button>)}
              {((mode === 'answer' && filteredAnswers.length === 0) || (mode === 'person' && filteredProfiles.length === 0) || (mode === 'question' && filteredQuestions.length === 0)) && (
                <div className="rounded-[28px] bg-white p-8 text-center text-sm font-bold text-muted shadow-card">{t('search_none', lang)}</div>
              )}
            </section>
          </>
        )}
      </div>

      {/* さがすのカードから直接スタンプでリアクション（ボトムシート） */}
      {stickerPickerFor && onReact && (
        <div className="pixel-picker-overlay fixed inset-0 z-50 flex items-end justify-center" onClick={() => setStickerPickerFor(null)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="pixel-picker-sheet relative w-full max-w-md p-3" onClick={(e) => e.stopPropagation()}>
            <p className="mb-2 px-2 text-xs font-black text-white drop-shadow">{t('react_sticker', lang)}</p>
            <EmojiPicker myStickers={myStickers} onPick={(e) => { onReact(stickerPickerFor, e); setStickerPickerFor(null); }} />
          </div>
        </div>
      )}
    </>
  );
}

// ── スタンプピッカーパネル ────────────────────────────────────
function StickerPickerPanel({
  ownedPackIds,
  ownedGachaStickers,
  onSelect,
  onClose,
}: {
  ownedPackIds: string[];
  ownedGachaStickers: string[];
  onSelect: (sticker: StickerItem) => void;
  onClose: () => void;
}) {
  const lang = useLang();
  const [activePack, setActivePack] = useState<string | null>(null);

  const usablePacks = STICKER_PACKS.filter((p) =>
    p.acquisition.type === 'free' || ownedPackIds.includes(p.id) ||
    (p.acquisition.type === 'gacha' && p.stickers.some((s) => ownedGachaStickers.includes(s.id)))
  );
  const currentPack = usablePacks.find((p) => p.id === activePack) ?? usablePacks[0] ?? null;

  const getStickers = (pack: StickerPack) =>
    pack.acquisition.type === 'gacha'
      ? pack.stickers.filter((s) => ownedGachaStickers.includes(s.id))
      : pack.stickers;

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        className="absolute bottom-16 left-0 right-0 max-h-[55vh] overflow-hidden rounded-t-[28px] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* パックタブ */}
        <div className="flex gap-2 overflow-x-auto border-b border-pink/10 px-3 py-2">
          {usablePacks.map((p) => (
            <button
              key={p.id}
              onClick={() => setActivePack(p.id)}
              className={`shrink-0 grid h-10 w-10 place-items-center rounded-xl text-xl transition ${
                (currentPack?.id === p.id) ? 'bg-pink/15 ring-2 ring-pink' : 'bg-base'
              }`}
            >
              {p.thumbnail}
            </button>
          ))}
          <button
            onClick={onClose}
            className="ml-auto shrink-0 grid h-10 w-10 place-items-center rounded-xl bg-base text-muted"
          >
            ✕
          </button>
        </div>

        {/* スタンプグリッド */}
        {currentPack ? (
          <div className="grid grid-cols-5 gap-2 overflow-y-auto p-3 pb-6" style={{ maxHeight: '45vh' }}>
            {getStickers(currentPack).map((s) => (
              <button
                key={s.id}
                onClick={() => { onSelect(s); onClose(); }}
                className="flex flex-col items-center gap-1 rounded-2xl bg-base p-2 active:scale-95 transition"
              >
                <span className="text-3xl"><RetroText text={s.emoji} /></span>
                <span className="text-[9px] font-bold text-muted leading-tight text-center">{s.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-2xl mb-2">🎭</p>
            <p className="text-sm font-black text-ink">{t('stamp_none', lang)}</p>
            <p className="text-xs font-bold text-muted">{t('stamp_none_desc', lang)}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CreateScreen({
  go,
  onPost,
  question,
  questionList = [],
  onCreateDiary,
  ownedPackIds,
  ownedGachaStickers,
  pen = null,
  onPenChange,
}: {
  go: (s: Screen, payload?: any) => void;
  onPost: (draft: DraftAnswer) => string;
  question?: any;
  questionList?: any[];
  onCreateDiary: (caption: string, photoUrl: string, font: string, textColor: string, visibility: 'public' | 'followers' | 'mentioned', mentionedUserIds: string[]) => string;
  ownedPackIds: string[];
  ownedGachaStickers: string[];
  /** わたしのペン（未設定なら null） */
  pen?: Pen | null;
  onPenChange?: (pen: Pen) => void;
}) {
  const lang = useLang();
  const [createMode, setCreateMode] = useState<'question' | 'diary'>('question');
  // 便せんに表示するペン（未設定の人には既定の手書きペンで書き心地を見せる）
  const writingPen = pen ?? DEFAULT_PEN;
  const [showStickerPicker, setShowStickerPicker] = useState(false);

  // --- お題モード ---
  // 特定のお題（PR案件・公認お題）は変更不可。それ以外はプルダウンでお題を選べる。
  const isLocked = !!question && (String(question.id).startsWith('pr-') || !!question.isOfficialQuestion || !!question.sponsor);
  const _fallbackQ = questionList[0] ?? questions[0] ?? getQuestionsForLang('ja')[0];
  const [draft, setDraft] = useState<DraftAnswer>({
    questionId: question?.id || _fallbackQ.id,
    body: '',
    sticker: '🌸',
    visibility: 'public',
  });
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (question?.id) {
      setDraft((prev) => ({ ...prev, questionId: question.id }));
    }
  }, [question]);

  // 既にこのお題へ回答済みなら、その内容を前入力（＝編集できる）
  useEffect(() => {
    const qid = question?.id;
    if (!qid || !dbReady()) return;
    let cancelled = false;
    getMyAnswer(qid).then((row) => {
      if (cancelled || !row) return;
      setDraft((prev) => ({
        ...prev,
        questionId: qid,
        body: row.body ?? '',
        sticker: row.sticker || prev.sticker,
        visibility: (row.visibility as DraftAnswer['visibility']) ?? 'public',
      }));
    });
    return () => { cancelled = true; };
  }, [question]);

  const selectedQuestion = isLocked
    ? question
    : (questionList.find((q) => q.id === draft.questionId) || question || _fallbackQ);

  const canPost = draft.body.trim().length > 0;

  function submit() {
    if (!canPost) return;
    // 便せんで見えていた字のまま回答が表示されるよう、未設定なら既定ペンを「わたしの字」にする
    if (!pen && onPenChange) onPenChange(DEFAULT_PEN);
    const id = onPost(draft);
    setDraft({ questionId: question?.id || _fallbackQ.id, body: '', sticker: '🎀', visibility: 'public' });
    go('detail', id);
  }

  // --- 日記モード ---
  const [diaryCaption, setDiaryCaption] = useState('');
  const diaryCaptionRef = useRef<HTMLTextAreaElement>(null);
  const [diaryCaptionPhoto, setDiaryCaptionPhoto] = useState('');
  const [diaryNgError, setDiaryNgError] = useState(false);
  const [diaryColor, setDiaryColor] = useState<string>(DIARY_COLORS[0].value);
  const [diaryVisibility, setDiaryVisibility] = useState<'public' | 'followers' | 'mentioned'>('followers');
  const [diaryMentionedIds, setDiaryMentionedIds] = useState<string[]>([]);

  const diaryCanSubmit =
    (diaryCaption.trim().length > 0 || diaryCaptionPhoto !== '') &&
    !containsNgWord(diaryCaption) &&
    (diaryVisibility !== 'mentioned' || diaryMentionedIds.length > 0);

  function handleDiaryCaptionPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setDiaryCaptionPhoto(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function toggleDiaryMention(userId: string) {
    setDiaryMentionedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  function submitDiary() {
    if (containsNgWord(diaryCaption)) { setDiaryNgError(true); return; }
    if (!diaryCanSubmit) return;
    if (!pen && onPenChange) onPenChange(DEFAULT_PEN);
    const id = onCreateDiary(diaryCaption.trim(), diaryCaptionPhoto, 'inherit', diaryColor, diaryVisibility, diaryMentionedIds);
    setDiaryCaption('');
    setDiaryCaptionPhoto('');
    setDiaryNgError(false);
    setDiaryVisibility('followers');
    setDiaryMentionedIds([]);
    go('diary-detail', id);
  }

  return (
    <>
      <AppHeader title={t('create_title', lang)} back onBack={() => go('home')} onBell={() => go('notifications')} />
      <div className="space-y-4 px-4 pt-3 pb-8">

        {/* モード切替タブ */}
        <div className="grid grid-cols-2 gap-1 rounded-full bg-white p-1 text-xs font-bold shadow-card">
          <button
            onClick={() => setCreateMode('question')}
            className={`rounded-full py-2.5 transition ${createMode === 'question' ? 'bg-pink text-white shadow-sm' : 'text-muted'}`}
          >
            ✏️ {t('btn_answer_topic', lang)}
          </button>
          <button
            onClick={() => setCreateMode('diary')}
            className={`rounded-full py-2.5 transition ${createMode === 'diary' ? 'bg-pink text-white shadow-sm' : 'text-muted'}`}
          >
            📖 {t('create_tab_diary', lang)}
          </button>
        </div>

        {/* ── お題モード ── */}
        {createMode === 'question' && (
          <>
            {/* 特定のお題を指定して来た場合（PR・公認お題など）はドロップダウンを出さず、
                そのお題1件だけを表示（質問が二重に見えるのを防ぐ）。
                フリー作成時のみ、答えるお題を選べるドロップダウンを表示する。 */}
            {!isLocked && (
              <section className="rounded-[28px] bg-white p-4 shadow-card">
                <label className="mb-2 block text-sm font-bold">{t('create_pick_topic', lang)}</label>
                <select value={draft.questionId} onChange={(e) => setDraft({ ...draft, questionId: e.target.value })} className="w-full rounded-2xl border border-purple-100 bg-base p-3 text-sm font-bold outline-none">
                  {questionList.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
                </select>
              </section>
            )}
            <QuestionCard question={selectedQuestion} />
            {/* 便せん：ここに書いた字（わたしのペン）がそのまま回答の字になる */}
            <section className="pb-sheet px-4 pb-4 pt-4">
              <PrintedHeading
                kicker="WRITE"
                title={<label htmlFor="answer-body">{t('create_your_answer', lang)}</label>}
                right={selectedQuestion?.answerType !== 'select' ? <span className="pb-label pb-0.5">{draft.body.length}/160</span> : undefined}
              />
              {selectedQuestion?.answerType === 'select' && Array.isArray(selectedQuestion?.answerOptions) && selectedQuestion.answerOptions.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {selectedQuestion.answerOptions.map((opt: string) => (
                    <button key={opt} type="button"
                      onClick={() => setDraft({ ...draft, body: opt })}
                      aria-pressed={draft.body === opt}
                      className={`rounded-2xl py-4 text-sm font-black transition ${draft.body === opt ? 'bg-pink text-white shadow-card' : 'bg-base text-ink hover:bg-pink/10'}`}>
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <div {...penAttrs(writingPen)} style={{ ...penAttrs(writingPen).style, ['--pen-base' as any]: '17px' }}>
                    <textarea
                      id="answer-body"
                      ref={bodyRef}
                      value={draft.body}
                      maxLength={160}
                      onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                      style={{ lineHeight: '34px', backgroundOrigin: 'content-box' }}
                      className="pen-text pen-size notebook-lines h-44 w-full resize-none rounded-2xl border-2 border-dashed border-pink/25 bg-white p-4 outline-none focus:border-pink placeholder:font-sans placeholder:text-[14px] placeholder:text-muted"
                      placeholder={t('create_ph', lang)}
                    />
                  </div>
                  <div className="mt-3">
                    <DecoToolbar
                      pen={writingPen}
                      onPenChange={(p) => onPenChange?.(p)}
                      sticker={draft.sticker}
                      onOpenSticker={() => setShowStickerPicker(true)}
                      onInsertDeco={(code) => insertRetroCode(bodyRef, code, (v) => setDraft((prev) => ({ ...prev, body: v })))}
                    />
                  </div>
                  {/* できあがり：みんなのタイムラインでの見え方（デコ絵文字も絵で表示） */}
                  <div className="mt-3 rounded-xl border-2 border-dotted border-ink/15 bg-white px-3 py-2.5" aria-live="polite">
                    <p className="pb-label mb-1">{t('create_preview', lang)}</p>
                    <div className="flex items-start gap-2">
                      <p
                        {...penAttrs(writingPen)}
                        style={{ ...penAttrs(writingPen).style, ['--pen-base' as any]: '17px' }}
                        className="pen-text pen-size notebook-lines min-h-[2rem] min-w-0 flex-1 rounded-xl px-2 py-1 leading-8"
                      >
                        {draft.body ? <RetroText text={draft.body} /> : <span className="font-sans text-[13px] font-bold text-muted">{t('create_preview_empty', lang)}</span>}
                      </p>
                      <span aria-hidden className="grid h-10 w-10 shrink-0 rotate-6 place-items-center rounded-full bg-cream text-xl shadow-[inset_0_0_0_2px_rgba(255,255,255,.9),0_2px_4px_rgba(0,0,0,.15)]">{draft.sticker}</span>
                    </div>
                  </div>
                </>
              )}
            </section>
            {/* 選択式のお題でもシールは貼れる（記述式はツールバーの「シール」から） */}
            {selectedQuestion?.answerType === 'select' && (
              <section className="pb-sheet px-4 pb-4 pt-4">
                <PrintedHeading kicker="STICKER" title={t('tool_sticker', lang)} />
                <div className="flex items-center gap-3">
                  <span className="grid h-14 w-14 place-items-center rounded-2xl bg-pink/10 text-3xl">{draft.sticker}</span>
                  <button
                    onClick={() => setShowStickerPicker(true)}
                    className="flex-1 rounded-full border-2 border-dashed border-pink/30 py-3 text-sm font-black text-pink hover:bg-pink/5 active:scale-[0.98]"
                  >
                    🎭 {t('tool_sticker_change', lang)}
                  </button>
                </div>
              </section>
            )}
            {showStickerPicker && (
              <StickerPickerPanel
                ownedPackIds={ownedPackIds}
                ownedGachaStickers={ownedGachaStickers}
                onSelect={(s) => setDraft({ ...draft, sticker: s.emoji })}
                onClose={() => setShowStickerPicker(false)}
              />
            )}
            <section className="rounded-[28px] bg-white p-4 shadow-card">
              <label className="mb-2 block text-sm font-bold">{t('create_visibility', lang)}</label>
              <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                {[['public', t('create_vis_public', lang)],['followers', t('create_vis_followers', lang)],['private', t('create_vis_private', lang)]].map(([key,label]) => <button key={key} onClick={() => setDraft({ ...draft, visibility: key as DraftAnswer['visibility'] })} className={`rounded-full py-3 ${draft.visibility === key ? 'bg-purple text-white' : 'bg-base text-muted'}`}>{label}</button>)}
              </div>
            </section>
            <button onClick={submit} disabled={!canPost} className={`h-14 w-full rounded-full text-base font-black text-white shadow-floating transition ${canPost ? 'bg-pink active:scale-[0.98]' : 'bg-muted/30'}`}>{t('btn_post', lang)}</button>
          </>
        )}

        {/* ── 日記モード ── */}
        {createMode === 'diary' && (
          <>
            {/* 写真エリア */}
            <label className="block cursor-pointer">
              {diaryCaptionPhoto ? (
                <div className="relative">
                  <img src={diaryCaptionPhoto} alt="preview" className="h-64 w-full rounded-[28px] object-cover shadow-card" />
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); setDiaryCaptionPhoto(''); }}
                    className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-black/50 text-xs font-black text-white backdrop-blur-sm"
                  >✕</button>
                </div>
              ) : (
                <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-[28px] border-2 border-dashed border-pink/30 bg-pink/5 shadow-card">
                  <span className="text-3xl">📷</span>
                  <span className="text-sm font-bold text-muted">{t('diary_add_photo', lang)}</span>
                  <span className="text-xs text-muted/60">{t('diary_tap_pick', lang)}</span>
                </div>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleDiaryCaptionPhoto} />
            </label>

            {/* タイトルの色（ページの見出しに使われる）。本文の字は下の「わたしのペン」 */}
            <section className="pb-sheet p-4">
              <p className="pb-label mb-2">{t('diary_title_color', lang)}</p>
              <div className="flex gap-2 flex-wrap">
                {DIARY_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setDiaryColor(c.value)}
                    title={tv(c.label, lang)}
                    aria-label={tv(c.label, lang)}
                    aria-pressed={diaryColor === c.value}
                    className={`h-8 w-8 rounded-full transition ${diaryColor === c.value ? 'ring-2 ring-offset-2 ring-pink scale-110' : ''}`}
                    style={{ backgroundColor: c.bg }}
                  />
                ))}
              </div>
            </section>

            {/* 公開範囲 */}
            <section className="rounded-[28px] bg-white p-4 shadow-card">
              <p className="mb-2 text-xs font-black text-muted">{t('diary_who_can_write', lang)}</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ['followers', '👥', t('create_vis_followers', lang)],
                  ['mentioned', '✉️', t('diary_aud_mentioned', lang)],
                  ['public',    '🌍', t('diary_aud_public', lang)],
                ] as const).map(([key, icon, label]) => (
                  <button
                    key={key}
                    onClick={() => setDiaryVisibility(key)}
                    className={`rounded-2xl py-3 text-xs font-black transition ${
                      diaryVisibility === key
                        ? key === 'public' ? 'bg-blue-400 text-white shadow-sm'
                          : key === 'mentioned' ? 'bg-purple text-white shadow-sm'
                          : 'bg-pink text-white shadow-sm'
                        : 'bg-base text-muted'
                    }`}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>

              {diaryVisibility === 'mentioned' && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-black text-muted">
                    {tf('diary_invite_pick', lang, { n: diaryMentionedIds.length })}
                  </p>
                  {followers.map((f) => {
                    const selected = diaryMentionedIds.includes(f.id);
                    return (
                      <button
                        key={f.id}
                        onClick={() => toggleDiaryMention(f.id)}
                        className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${selected ? 'bg-purple/10' : 'bg-base'}`}
                      >
                        <span className="text-xl">{f.avatar}</span>
                        <span className="flex-1 text-sm font-black text-ink">{f.name}</span>
                        <span className={`text-xs font-black ${selected ? 'text-purple' : 'text-muted'}`}>
                          {selected ? `✓ ${t('diary_inviting', lang)}` : t('diary_invite', lang)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* コメント入力 */}
            <section className="pb-sheet p-4">
              {diaryNgError && (
                <p className="mb-2 rounded-2xl bg-pink/10 px-3 py-2 text-xs font-black text-pink">
                  {t('ng_word', lang)}
                </p>
              )}
              <div {...penAttrs(writingPen)} style={{ ...penAttrs(writingPen).style, ['--pen-base' as any]: '16px' }}>
                <textarea
                  ref={diaryCaptionRef}
                  value={diaryCaption}
                  onChange={(e) => { setDiaryCaption(e.target.value); if (diaryNgError) setDiaryNgError(false); }}
                  maxLength={200}
                  rows={3}
                  aria-label={t('diary_body_aria', lang)}
                  placeholder={t('diary_ph', lang)}
                  className="pen-text pen-size pb-ruled pb-ruled-rows w-full resize-none bg-transparent leading-7 outline-none"
                />
              </div>
              <div className="mt-2">
                <DecoToolbar
                  pen={writingPen}
                  onPenChange={(p) => onPenChange?.(p)}
                  onInsertDeco={(code) => insertRetroCode(diaryCaptionRef, code, setDiaryCaption)}
                />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs font-bold text-muted">{diaryCaption.length}/200</span>
                <button
                  onClick={submitDiary}
                  disabled={!diaryCanSubmit}
                  className="rounded-full bg-pink px-6 py-2 text-sm font-black text-white disabled:opacity-40 active:scale-[0.98] transition"
                >
                  {t('btn_post', lang)}
                </button>
              </div>
            </section>
          </>
        )}

      </div>
    </>
  );
}

// ── プロフ帳テーマカラー ──────────────────────────────
const THEME_GRADIENT: Record<string, string> = {
  pink:   'from-pink/20 via-white to-purple/10',
  purple: 'from-purple/20 via-white to-pink/10',
  blue:   'from-blue-100 via-white to-purple/10',
  green:  'from-green-50 via-white to-teal-50',
  orange: 'from-orange-50 via-white to-pink/10',
};
const THEME_ACCENT: Record<string, string> = {
  pink:   'text-pink',
  purple: 'text-purple',
  blue:   'text-blue-500',
  green:  'text-green-600',
  orange: 'text-orange-500',
};
const THEME_BG: Record<string, string> = {
  pink:   'bg-pink/10',
  purple: 'bg-purple/10',
  blue:   'bg-blue-50',
  green:  'bg-green-50',
  orange: 'bg-orange-50',
};

function ProfSectionHeader({ icon, title }: { icon: string; title: string; theme?: string }) {
  // プロフ帳の各コーナー見出し（印刷文字＋点線）。テーマ色は番号バッジ側で表現する。
  return <PrintedHeading title={<><span aria-hidden className="mr-1">{icon}</span>{title}</>} />;
}

// ── 世界観背景：オリジナルSVGイラストがふわふわ浮かぶシーン ──
// subtle=true でアプリ全体の背景用に薄く表示（本文と混ざらないように）
function SceneBackground({ theme, scale = 1, subtle = false }: { theme: BgTheme; scale?: number; subtle?: boolean }) {
  return (
    <div className={`absolute inset-0 overflow-hidden bg-gradient-to-br ${theme.gradient}`} aria-hidden>
      {theme.floaters.map((f, i) => (
        <span
          key={i}
          className="bg-floater"
          style={{
            left: `${f.left}%`,
            top: `${f.top}%`,
            animationDelay: `${f.delay}s`,
            animationDuration: `${f.duration}s`,
            ...(subtle ? { opacity: 0.35 } : {}),
          }}
        >
          <ThemeArt art={f.art} size={f.size * 32 * scale} />
        </span>
      ))}
    </div>
  );
}

// ── ガチャ回転演出：カプセルがドキドキ揺れて弾ける ──────────
function GachaSpinOverlay({ burst }: { burst: boolean }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-zinc-900/80 backdrop-blur-sm">
      <div className="relative">
        {/* キラキラ */}
        {[
          { left: -44, top: -10, delay: 0 },
          { left: 96, top: -22, delay: 0.35 },
          { left: -20, top: 90, delay: 0.6 },
          { left: 110, top: 70, delay: 0.9 },
        ].map((s, i) => (
          <span key={i} className="gacha-spark" style={{ left: s.left, top: s.top, animationDelay: `${s.delay}s` }}>
            <ThemeArt art="sparkle" size={26} />
          </span>
        ))}
        {/* カプセル */}
        <div className={burst ? 'gacha-capsule-burst' : 'gacha-capsule'}>
          <svg viewBox="0 0 96 96" width={120} height={120} aria-hidden>
            <path d="M10 48 A38 38 0 0 1 86 48 Z" fill="#fffbfc" stroke="#e8d5dc" strokeWidth={2} />
            <path d="M10 48 A38 38 0 0 0 86 48 Z" fill="#ff8fb0" stroke="#e87a9c" strokeWidth={2} />
            <rect x={8} y={45.5} width={80} height={5} rx={2.5} fill="#f7dce5" />
            <circle cx={34} cy={30} r={6} fill="#ffffff" opacity={0.8} />
          </svg>
        </div>
      </div>
      <p className="mt-6 text-sm font-black text-white/90 tracking-widest">ドキドキ…</p>
    </div>
  );
}

// 言語ごとの手書きフォント（Google Fonts は表示中の言語のぶんだけ読み込まれる）
function handFontVars(lang: Lang): React.CSSProperties {
  const L = String(lang);
  const set = (font: string, weight: number): React.CSSProperties =>
    ({ ['--hand-font' as any]: font, ['--hand-weight' as any]: String(weight) });
  if (L === 'ja') return set('"Klee One","Zen Kurenaido","Hiragino Maru Gothic ProN",system-ui,sans-serif', 600);
  if (L === 'ko') return set('"Gaegu","Apple SD Gothic Neo",system-ui,sans-serif', 700);
  if (L === 'zh' || L === 'zh-tw') return set('"Ma Shan Zheng","PingFang SC",system-ui,sans-serif', 400);
  if (L === 'th') return set('"Sriracha",system-ui,sans-serif', 400);
  if (L === 'hi') return set('"Kalam","Caveat",system-ui,sans-serif', 700);
  if (L === 'ar') return set('system-ui,sans-serif', 600); // アラビア語の手書きフォントは未搭載→標準
  // ラテン系（英・西・葡・仏・独・伊・蘭・土・尼・馬・比）＋ベトナム語＋ロシア語(キリル) → Caveat
  return set('"Caveat","Klee One",system-ui,sans-serif', 700);
}

function ProfileBookContent({
  info,
  best3,
  monthlyBest3 = null,
  isSelf = false,
  questions,
  answers,
  avatarEmoji,
  avatarUrl,
  userId,
  themeColor = 'pink',
  bgTheme = null,
  favoritePhotos,
  customFields = {},
  onGoDetail,
  lang = 'ja',
  bare = false,
  visibility = {},
  viewerIsFollower = false,
  pen = null,
}: {
  info: typeof defaultProfileBookInfo;
  best3: Best3Data;
  monthlyBest3?: { theme: string; label: string; items: string[]; events?: string; episodeQ?: string; episode?: string } | null;
  isSelf?: boolean;
  questions: Array<{ q: string; a: string }>;
  answers: Answer[];
  avatarEmoji: string;
  avatarUrl?: string;
  userId: string;
  themeColor?: string;
  bgTheme?: BgTheme | null;
  favoritePhotos?: string[];
  customFields?: Record<string, string>;
  onGoDetail?: (id: string) => void;
  lang?: Lang;
  /** 画面側が背景を用意する場合は true（自前で背景を描かない＝トンマナ統一用） */
  bare?: boolean;
  /** 項目ごとの公開設定 { fieldKey: 'public'|'followers'|'private' }。未設定=公開。 */
  visibility?: Record<string, FieldVisibility>;
  /** 閲覧者がこのプロフの持ち主をフォローしているか（followers限定の判定用）。 */
  viewerIsFollower?: boolean;
  /** 持ち主の「わたしのペン」。手書きの回答（.prof-hand）がこの字で表示される。未設定なら従来の手書き風。 */
  pen?: Pen | null;
}) {
  const accent = THEME_ACCENT[themeColor] ?? THEME_ACCENT.pink;
  // 項目の公開判定：本人は常に表示。他人は 公開=常に / フォロワー限定=フォロワーのみ / 非公開=不可。
  const canShow = (key: string): boolean => {
    if (isSelf) return true;
    const v = visibility[key] ?? 'public';
    if (v === 'public') return true;
    if (v === 'followers') return viewerIsFollower;
    return false;
  };
  const bg = THEME_BG[themeColor] ?? THEME_BG.pink;

  // ユーザーが書いた内容（基本情報・回答・自作の質問）は機械翻訳しない＝書いたまま表示する。
  // 公式の質問（最初から入っている10問）だけ、表示言語の訳に置き換える。
  const lifeStageDef = LIFE_STAGE_DEFS.find((a) => a.id === info.attribute);
  const activityDef  = ACTIVITY_DEFS.find((a) => a.id === info.activity);

  // 他人のプロフ帳では、全項目が空のセクションごと非表示にする（自分は入力促進のため常に表示）
  const has = (...keys: (keyof typeof info)[]) => keys.some((k) => ((info[k] as string) ?? '').trim());
  const showBasic = isSelf || has('name', 'nickname', 'birthday', 'bloodType', 'gender', 'mbti', 'hometown');
  const showLikes = isSelf || has('favoriteFood', 'dislikeFood', 'favoriteColor', 'favoriteSubject', 'dislikeSubject', 'favoriteCharacter', 'favoriteMusic', 'favoriteTv', 'favoriteArtist', 'favoriteManga', 'favoriteGame');
  const showAbout = isSelf || has('hobby', 'specialty', 'personality', 'catchphrase', 'charmPoint', 'dream', 'wantToGo', 'collection', 'motto', 'holiday');

  // 紙に貼ったシール（固定位置・3枚だけ。タップを妨げない）
  const deco = ['🎀', '⭐', '🍀'];
  const colorDots = swatchesOf(info.favoriteColor);
  const hideEmptySlots = !isSelf;
  // 今月のおだいを表示言語で（日本語の文をつなげて機械翻訳しない）
  const mInfo = monthlyBest3 ? localizedMonthInfo(currentMonthInfo(), lang) : null;
  // コーナー番号（01, 02, …）。表示されるコーナーだけに描画順で振る（他人のプロフ帳で番号が飛ばないように）
  let cornerNo = 0;
  const nextNo = () => String(++cornerNo).padStart(2, '0');

  return (
    <HideEmptyProfileContext.Provider value={!isSelf}>
    <ProfThemeContext.Provider value={themeColor}>
    <div className="relative min-h-full" {...penAttrs(pen)} style={{ ...handFontVars(lang), ...penAttrs(pen).style }} data-noauto>
      {/* ── 背景：テーマありなら世界観、なければ中立の紙地。bare のときは画面側が用意する ── */}
      {!bare && (bgTheme
        ? <div className="pointer-events-none absolute inset-0"><SceneBackground theme={bgTheme} subtle /></div>
        : <div className="pointer-events-none absolute inset-0 prof-paper" />)}

      <div className="relative z-10 space-y-4 px-4 pt-4 pb-32">
      <span className="prof-deco text-2xl" style={{ top: 8, right: 10, ['--r' as any]: '10deg', animationDelay: '.8s' } as any}>{deco[0]}</span>
      <span className="prof-deco text-xl" style={{ top: '46%', left: 2, ['--r' as any]: '-8deg', animationDelay: '1.4s' } as any}>{deco[1]}</span>
      <span className="prof-deco text-xl" style={{ bottom: 40, right: 12, ['--r' as any]: '-10deg', animationDelay: '.6s' } as any}>{deco[2]}</span>

      {/* ── 表紙：ポラロイド写真＋マステ見出し＋なまえ（手書き）・ID（印刷） ── */}
      <PaperSheet variant="grid" className="relative overflow-hidden px-4 pb-4 pt-5">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="pb-pop text-[11px] tracking-[.3em] text-muted">MY PROFILE</p>
            <TapeLabel tone="cream" rotate={-2} className="mt-1 text-lg">{t('pb_cover_title', lang)}</TapeLabel>
          </div>
          <Sticker color="rgb(255 122 105 / .9)" rotate={8} size={38} className="text-white" title="PROFILE">✿</Sticker>
        </div>

        <div className="relative flex items-start gap-3.5">
          {/* 貼った写真（ポラロイド＋マステ留め） */}
          <div className="relative">
            <span aria-hidden className="pb-tape pb-tape-sax !absolute -top-2 left-1/2 z-10 h-4 w-14 -translate-x-1/2" style={{ transform: 'translateX(-50%) rotate(-4deg)' }} />
            <PolaroidPhoto src={avatarUrl} emoji={avatarEmoji} rotate={-3} size={92} />
          </div>

          {/* なまえは大きく手書き、ID は小さく印刷、口ぐせは吹き出しで */}
          <div className="min-w-0 flex-1">
            <p className="pb-label">{t('field_name', lang)}</p>
            <p className="pb-writeline break-words text-[24px] leading-tight text-ink prof-hand">
              {info.nickname || info.name || userId}
            </p>
            <p className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5">
              <span className="pb-label">ID</span>
              <span className="break-all text-[12px] font-bold text-muted">{userId}</span>
            </p>
            {info.catchphrase && (
              <p className="relative mt-2.5 inline-block max-w-full rounded-[14px] border-2 border-ink/15 bg-white px-3 py-1.5 text-[14px] leading-snug text-ink prof-hand">
                <span aria-hidden className="absolute -top-[7px] left-4 h-3 w-3 rotate-45 border-l-2 border-t-2 border-ink/15 bg-white" />
                <span className="relative">{info.catchphrase}</span>
              </p>
            )}
          </div>
        </div>

        {/* ひとこと（未入力なら非表示）：便せんの1行メモ */}
        {(info.message) && (
          <div className="pb-memo mt-4 rotate-[-0.4deg]">
            <span className="pb-label absolute left-3 top-1.5">{t('field_message', lang)}</span>
            <p className="pt-2 text-[15px] leading-relaxed text-ink prof-hand">{info.message}</p>
          </div>
        )}
        {bgTheme && (
          <div className="relative mt-2 flex justify-end">
            <span className="inline-flex items-center gap-1 rounded-full bg-base px-2 py-0.5 text-[9px] font-black text-muted">{bgTheme.floaters[0] && <ThemeArt art={bgTheme.floaters[0].art} size={12} />}{bgTheme.name}</span>
          </div>
        )}
      </PaperSheet>

      {/* ── きほんじょうほう：項目ごとに記入欄の形を変える（名前は長い線、血液型は丸つけ、MBTIはマス） ── */}
      {showBasic && (
      <PaperSheet className="px-4 pb-4 pt-4">
        <PrintedHeading no={nextNo()} kicker="BASIC" title={t('sec_basic', lang)} />
        <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-4">
          {canShow('name') && (isSelf || (info.name ?? '').trim()) && (
            <div className="col-span-2">
              <p className="pb-label">{t('field_name', lang)}</p>
              <p className="pb-writeline text-[20px] leading-snug text-ink prof-hand">{info.name}</p>
            </div>
          )}
          {(isSelf || (info.nickname ?? '').trim()) && (
            <div className="col-span-2">
              <p className="pb-label">{t('field_nickname', lang)}</p>
              <p className="pb-writeline text-[18px] leading-snug text-ink prof-hand">{info.nickname}</p>
            </div>
          )}
          {canShow('birthday') && (isSelf || (info.birthday ?? '').trim()) && (
            <div className="pb-box">
              <p className="pb-label">🎂 {t('field_birthday', lang)}</p>
              <p className="mt-0.5 min-h-[1.5em] break-words text-[18px] leading-snug text-ink prof-hand">{formatBirthday(info.birthday, lang)}</p>
            </div>
          )}
          {t('show_bloodType', lang) === 'true' && canShow('bloodType') && (isSelf || (info.bloodType ?? '').trim()) && (
            <div className="pb-box">
              <p className="pb-label">{t('field_bloodType', lang)}</p>
              <div className="mt-1"><CircleChoice options={['A', 'B', 'O', 'AB']} value={info.bloodType === '不明' ? tv('不明', lang) : info.bloodType} /></div>
            </div>
          )}
          {info.gender && canShow('gender') && (
            <div className="pb-box">
              <p className="pb-label">{t('field_gender', lang)}</p>
              <p className="mt-0.5 break-words text-[17px] leading-snug text-ink prof-hand">{info.gender}</p>
            </div>
          )}
          {canShow('mbti') && (isSelf || (info.mbti ?? '').trim()) && (
            <div className="pb-box">
              <p className="pb-label">{t('field_mbti', lang)}</p>
              <div className="mt-1"><LetterBoxes value={info.mbti} pattern={/^[EI][NS][TF][JP](-[AT])?$/i} /></div>
            </div>
          )}
          {canShow('hometown') && (isSelf || (info.hometown ?? '').trim()) && (
            <div className="col-span-2 flex items-end gap-2 sm:col-span-4">
              <p className="pb-label shrink-0 pb-1">📍 {t('field_hometown', lang)}</p>
              <p className="pb-writeline min-w-0 flex-1 text-[17px] leading-snug text-ink prof-hand">{info.hometown}</p>
            </div>
          )}
        </div>
      </PaperSheet>
      )}

      {/* ── すき・きらい：枠の形で「すき（ハート）／きらい（×）／色（パレット）／キャラ（星）」を描き分け ── */}
      {showLikes && (
      <PaperSheet className="px-4 pb-4 pt-4">
        <PrintedHeading no={nextNo()} kicker="LIKE & DISLIKE" title={t('sec_likes', lang)} />
        {/* 食べ物・テレビ・音楽・漫画・ゲーム・趣味は「すきなもの BEST3」に一本化（重複解消） */}
        <div className="grid grid-cols-2 gap-3">
          {canShow('favoriteFood') && <FavBubble shape="heart" mark="♥" label={t('field_favoriteFood', lang)} value={info.favoriteFood} />}
          {canShow('dislikeFood') && <FavBubble shape="cross" mark="✕" label={t('field_dislikeFood', lang)} value={info.dislikeFood} />}
          {canShow('favoriteColor') && (
            <FavBubble shape="color" mark="🎨" label={t('field_favoriteColor', lang)} value={info.favoriteColor}>
              {colorDots.length > 0 && (
                <span aria-hidden className="mt-1.5 flex justify-center gap-1.5">
                  {colorDots.map((c) => <span key={c} className="pb-swatch" style={{ background: c }} />)}
                </span>
              )}
            </FavBubble>
          )}
          {canShow('favoriteCharacter') && <FavBubble shape="star" mark="★" label={t('field_favoriteCharacter', lang)} value={info.favoriteCharacter} />}
        </div>
        {/* 教科は時間割のマスで（すき／にがて） */}
        {(lifeStageDef?.showSubjectFields ?? true) && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            {canShow('favoriteSubject') && <SubjectCell label={`◎ ${t('field_favoriteSubject', lang)}`} value={tv(info.favoriteSubject, lang)} />}
            {canShow('dislikeSubject') && <SubjectCell label={`△ ${t('field_dislikeSubject', lang)}`} value={tv(info.dislikeSubject, lang)} />}
          </div>
        )}
      </PaperSheet>
      )}

      {/* ── わたしのこと：基本は記入線。座右の銘と将来の夢はメモ用紙で目立たせる ── */}
      {showAbout && (
      <PaperSheet className="px-4 pb-4 pt-4">
        <PrintedHeading no={nextNo()} kicker="ABOUT ME" title={t('sec_about', lang)} />
        <div className="space-y-1">
        {canShow('specialty') && <ProfileLine label={t('field_specialty', lang)} value={info.specialty} />}
        {canShow('holiday') && <ProfileLine label={t('field_holiday', lang)} value={info.holiday} />}
        {canShow('wantToGo') && <ProfileLine label={t('field_wantToGo', lang)} value={info.wantToGo} />}
        {canShow('collection') && <ProfileLine label={t('field_collection', lang)} value={info.collection} />}
        {canShow('motto') && <MemoLine label={t('field_motto', lang)} value={info.motto} quote />}
        {canShow('charmPoint') && <ProfileLine label={t('field_charmPoint', lang)} value={info.charmPoint} />}
        {canShow('dream') && <MemoLine label={t('field_dream', lang)} value={info.dream} tone="sax" />}
        </div>
      </PaperSheet>
      )}

      {/* ── ライフステージ専用セクション ── */}
      {lifeStageDef && lifeStageDef.fields.some((f) => customFields[f.key]) && (
        <PaperSheet variant="ruled" className="px-4 pb-4 pt-4">
          <ProfSectionHeader icon={lifeStageDef.emoji} title={tv(lifeStageDef.sectionTitle, lang)} theme={themeColor} />
          <div className="space-y-1">
          {lifeStageDef.fields.map((f) =>
            customFields[f.key] ? (
              <ProfileLine key={f.key} label={tv(f.label, lang)} value={customFields[f.key]} />
            ) : null
          )}
          </div>
        </PaperSheet>
      )}

      {/* ── 特技・活動セクション ── */}
      {activityDef && activityDef.fields.some((f) => customFields[f.key]) && (
        <PaperSheet variant="ruled" className="px-4 pb-4 pt-4">
          <ProfSectionHeader icon={activityDef.emoji} title={tv(activityDef.sectionTitle, lang)} theme={themeColor} />
          <div className="space-y-1">
          {activityDef.fields.map((f) =>
            customFields[f.key] ? (
              <ProfileLine key={f.key} label={tv(f.label, lang)} value={customFields[f.key]} />
            ) : null
          )}
          </div>
        </PaperSheet>
      )}

      {/* ── 今月のおだい（今月の1問＋BEST3・毎月切替）：付せんメモ ── */}
      {(() => {
        if (!monthlyBest3) return null;
        const hasEpisode = (monthlyBest3.episode ?? '').trim();
        const hasBest3 = monthlyBest3.items.some((v) => v.trim());
        if (!hasEpisode && !hasBest3 && !isSelf) return null;
        return (
          <section className="pb-memo space-y-3 rotate-[0.3deg]">
            <span className="pb-tape !absolute -top-2.5 left-1/2 h-4 w-16 -translate-x-1/2" style={{ transform: 'translateX(-50%) rotate(2deg)' }} aria-hidden />
            <p className="pb-label">🗓️ {mInfo ? mInfo.title : monthlyBest3.label}</p>
            {/* 今月のエピソード質問（今月の1問） */}
            {(monthlyBest3.episodeQ || hasEpisode) && (
              <div>
                {monthlyBest3.episodeQ && <p className="text-[13px] font-black leading-snug text-ink"><span className="pb-q-no">Q</span>{mInfo ? mInfo.episodeQ : monthlyBest3.episodeQ}</p>}
                {hasEpisode ? (
                  <p className="mt-1 whitespace-pre-wrap text-[16px] leading-relaxed text-ink prof-hand">{monthlyBest3.episode}</p>
                ) : isSelf ? (
                  <p className="mt-1 text-xs font-bold text-muted">{t('pb_monthly_ep_empty', lang)}</p>
                ) : null}
              </div>
            )}
            {/* 今月のBEST3 */}
            <div>
              <p className="text-[13px] font-black leading-snug text-ink"><span className="pb-q-no">Q</span>{mInfo ? mInfo.best3Q : `${monthlyBest3.theme} は？`}</p>
              {hasBest3 ? (
                <Best3Lines items={monthlyBest3.items} hideEmpty={hideEmptySlots} />
              ) : isSelf ? (
                <p className="mt-1 text-xs font-bold text-muted">{t('pb_monthly_b3_empty', lang)}</p>
              ) : null}
            </div>
          </section>
        );
      })()}

      {/* ── すきなもの BEST3：ランキングではなく ①②③ の記入欄 ── */}
      {(isSelf || BEST3_CATEGORIES.some((c) => (best3[c.key] ?? []).some((v) => v.trim()))) && (
        <PaperSheet variant="grid" className="px-4 pb-4 pt-4">
          <PrintedHeading no={nextNo()} kicker="MY BEST 3" title={t('best3_title', lang)} />
          {(() => {
            const filled = BEST3_CATEGORIES.filter((c) => (best3[c.key] ?? []).some((v) => v.trim()));
            if (filled.length === 0) {
              return <p className="text-xs font-bold text-muted">{t('pb_best3_empty', lang)}</p>;
            }
            return (
              <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                {filled.map((cat) => (
                  <div key={cat.key}>
                    <p className="pb-label">{cat.emoji} {t(`best3_${cat.key}`, lang)}</p>
                    <Best3Lines items={best3[cat.key] ?? []} hideEmpty={hideEmptySlots} />
                  </div>
                ))}
              </div>
            );
          })()}
        </PaperSheet>
      )}

      {/* ── しつもんコーナー：Q は印刷、A は手書き（他人のプロフ帳では未回答の質問は隠す） ── */}
      {(() => {
        const qaSource = questions.map((item) => ({ q: displayProfileQuestion(item.q, lang), a: item.a }));
        // 他人が見るときは回答済み（a が空でない）だけを表示。自分は入力促進のため全部表示。
        const visibleQA = isSelf ? qaSource : qaSource.filter((item) => (item.a ?? '').trim());
        if (visibleQA.length === 0) return null; // 全部未回答なら section ごと非表示
        return (
          <PaperSheet className="px-4 pb-3 pt-4">
            <PrintedHeading no={nextNo()} kicker="QUESTION CORNER" title={t('sec_qa', lang)} />
            <div className="grid sm:grid-cols-2 sm:gap-x-5">
              {visibleQA.map((item, i) => (
                <div key={i} className="pb-q">
                  <p className="text-[13px] font-black leading-snug text-ink"><span className="pb-q-no">Q{i + 1}</span>{item.q}</p>
                  <p className="mt-1.5 flex gap-1.5 text-[16px] leading-relaxed text-ink">
                    <span aria-hidden className="pb-label pt-1">A.</span>
                    <span className="pb-writeline min-w-0 flex-1 prof-hand">{item.a}</span>
                  </p>
                </div>
              ))}
            </div>
          </PaperSheet>
        );
      })()}

      {/* ── お気に入り写真 ── */}
      {favoritePhotos && favoritePhotos.length > 0 && (
        <section className="pb-sheet px-4 pb-4 pt-4">
          <ProfSectionHeader icon="📷" title={t('sec_fav_photos', lang)} theme={themeColor} />
          <div className="grid grid-cols-3 gap-2">
            {favoritePhotos.map((photo, i) => (
              <div key={i} className="aspect-square overflow-hidden rounded-2xl">
                <img src={photo} alt={`photo-${i}`} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── さいきんの回答 ── */}
      {answers.length > 0 && onGoDetail && (
        <section className="pb-sheet px-4 pb-4 pt-4">
          <ProfSectionHeader icon="📝" title={t('sec_recent_answers', lang)} theme={themeColor} />
          <div className="space-y-2">
            {answers.slice(0, 3).map((answer) => (
              <button
                key={answer.id}
                onClick={() => onGoDetail(answer.id)}
                className={`w-full rounded-2xl ${bg} p-3 text-left active:scale-[0.99]`}
              >
                <p className={`text-[11px] font-black ${accent}`}>
                  {typeof answer.question === 'string' ? answer.question : answer.question ? localizeQuestion(answer.question, lang).title : ''}
                </p>
                <p className="mt-1 text-[15px] text-ink leading-relaxed prof-hand">{answer.body}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      </div>
    </div>
    </ProfThemeContext.Provider>
    </HideEmptyProfileContext.Provider>
  );
}

// 他己紹介アンケート：相手の性格を「みんなで投票」して教えてあげるカード。
// 集計はその場で表示し、自分の票は付け替え・取り消しできる。
function PerceptionVoteCard({ targetUid, targetName, lang = 'ja' }: { targetUid: string; targetName: string; lang?: Lang }) {
  const [summary, setSummary] = useState<PerceptionSummary>([]);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const load = () => {
    getPerceptionSummary(targetUid).then((r) => { const known = onlyKnownPerception(r.summary); setSummary(known); setMyVote(r.myVote && PERSONALITY_OPTIONS.includes(r.myVote) ? r.myVote : null); setTotal(known.reduce((n, x) => n + x.count, 0)); });
  };
  useEffect(() => { if (dbReady() && targetUid) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [targetUid]);
  if (!dbReady() || !targetUid) return null;
  const VOTE_FAIL_MESSAGE: Record<string, string> = {
    not_logged_in: t('vote_err_login', lang),
    self: t('vote_err_self', lang),
    not_configured: t('vote_err_config', lang),
    not_ready: t('vote_err_ready', lang),
    error: t('vote_err_generic', lang),
  };
  const vote = async (v: string) => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    const prev = myVote;
    try {
      if (prev === v) {
        setMyVote(null); // 楽観表示（取り消し）
        const ok = await clearPerceptionVote(targetUid);
        if (!ok) { setMyVote(prev); setNotice(VOTE_FAIL_MESSAGE.error); }
      } else {
        setMyVote(v); // 楽観表示（選択）
        const r = await castPerceptionVote(targetUid, v);
        if (!r.ok) { setMyVote(prev); setNotice(VOTE_FAIL_MESSAGE[r.reason] ?? VOTE_FAIL_MESSAGE.error); }
      }
      load();
    } catch {
      setMyVote(prev);
      setNotice(VOTE_FAIL_MESSAGE.error);
    } finally {
      setBusy(false); // 例外時も必ず解除（ボタンが押せないまま固まらない）
    }
  };
  return (
    <PaperSheet variant="grid" className="px-4 pb-4 pt-4">
      <PrintedHeading
        kicker="FROM FRIENDS"
        title={tf('vote_title', lang, { name: targetName })}
        right={<StickerBadge tone="sax" rotate={3}>{tf('count_people', lang, { n: total })}</StickerBadge>}
      />
      <p className="-mt-1 mb-2.5 text-[12px] font-bold text-muted">{tf('vote_desc', lang, { name: targetName })}</p>
      <div className="flex flex-wrap gap-1.5">
        {PERSONALITY_OPTIONS.map((opt) => {
          const c = summary.find((s) => s.value === opt)?.count ?? 0;
          const mine = myVote === opt;
          return (
            <CapsulePill key={opt} active={mine} disabled={busy} onClick={() => vote(opt)} title={mine ? t('vote_tap_cancel', lang) : t('vote_tap_vote', lang)}>
              {mine && <span aria-hidden>✓</span>}{tv(opt, lang)}{c > 0 ? <span className={mine ? 'text-white/90' : 'text-pink'}>{c}</span> : null}
            </CapsulePill>
          );
        })}
      </div>
      {notice && (
        <p role="status" className="mt-2 rounded-lg bg-cream px-3 py-1.5 text-[12px] font-black text-ink">⚠️ {notice}</p>
      )}
      {summary[0] && summary[0].count > 0 && (
        <p className="mt-3 text-[13px] text-ink prof-hand">🏆 {tf('vote_top', lang, { v: tv(summary[0].value, lang), n: summary[0].count })}</p>
      )}
    </PaperSheet>
  );
}

// 自分のプロフィールで「みんなが選ぶわたしの性格」を表示するカード。
function MyPerceptionCard({ lang = 'ja' }: { lang?: Lang }) {
  const [summary, setSummary] = useState<PerceptionSummary>([]);
  const [total, setTotal] = useState(0);
  useEffect(() => {
    if (!dbReady()) return;
    let cancelled = false;
    getCurrentUserId().then((uid) => {
      if (cancelled || !uid) return;
      getPerceptionSummary(uid).then((r) => { if (!cancelled) { const known = onlyKnownPerception(r.summary); setSummary(known); setTotal(known.reduce((n, x) => n + x.count, 0)); } });
    });
    return () => { cancelled = true; };
  }, []);
  if (!dbReady() || total === 0) return null;
  return (
    <div className="px-4 pt-3">
      <PaperSheet variant="grid" className="px-4 pb-4 pt-4">
        <PrintedHeading kicker="FROM FRIENDS" title={t('vote_my_title', lang)} right={<StickerBadge tone="sax" rotate={3}>{tf('count_people', lang, { n: total })}</StickerBadge>} />
        <p className="-mt-1 mb-2.5 text-[12px] font-bold text-muted">{t('vote_my_desc', lang)}</p>
        <ul className="flex flex-wrap gap-1.5">
          {summary.slice(0, 5).map((s, i) => (
            <li key={s.value}>
              <CapsulePill active={i === 0}>{i === 0 ? '🏆 ' : ''}{tv(s.value, lang)}<span className={i === 0 ? 'text-white' : 'text-ink'}>×{s.count}</span></CapsulePill>
            </li>
          ))}
        </ul>
      </PaperSheet>
    </div>
  );
}

function OtherProfileScreen({
  go,
  profile,
  answers,
  subscribedOfficials,
  onToggleSubscription,
  myProfile,
  diaryPages = [],
  circles = [],
  exchanged = false,
  onExchange,
  supabaseBook = null,
  targetUid = null,
  onOpenBlog,
  lang = 'ja',
}: {
  go: (s: Screen, payload?: any) => void;
  profile: Profile;
  answers: Answer[];
  subscribedOfficials: string[];
  onToggleSubscription: (userId: string) => void;
  myProfile?: typeof defaultProfileBookInfo;
  diaryPages?: DiaryPage[];
  circles?: Circle[];
  exchanged?: boolean;
  onExchange?: (userId: string) => void;
  supabaseBook?: { info?: Record<string, any>; best3?: Best3Data; monthly?: MonthlyBest3; questions?: { q: string; a: string }[]; visibility?: Record<string, FieldVisibility>; pen?: Pen | null } | null;
  targetUid?: string | null;
  onOpenBlog?: (post: BlogPost) => void;
  lang?: Lang;
}) {
  // 相手が公開しているブログ記事
  const [userBlogs, setUserBlogs] = useState<BlogPost[]>([]);
  useEffect(() => {
    if (isDev || !dbReady()) return;
    let cancelled = false;
    getBlogPostsByUserShared(profile.id).then((rows) => { if (!cancelled) setUserBlogs(rows as BlogPost[]); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);
  const alreadyFollowing = followers.some((f) => f.id === profile.id);
  const [isFollowing, setIsFollowing] = useState(alreadyFollowing);

  // 相手が自分をフォローしているか（相互フォロー判定＝仲良し度を双方向で同じにするため）
  const [followsMe, setFollowsMe] = useState(false);
  // Supabase 上の実ユーザーはフォロー状態をサーバーから復元
  useEffect(() => {
    if (!dbReady() || !targetUid) return;
    let cancelled = false;
    getFollowingIds().then((ids) => { if (!cancelled) setIsFollowing(ids.includes(targetUid)); });
    isFollowedBy(targetUid).then((v) => { if (!cancelled) setFollowsMe(v); });
    return () => { cancelled = true; };
  }, [targetUid]);
  const mutualFollow = isFollowing && followsMe;

  function toggleFollow() {
    const next = !isFollowing;
    setIsFollowing(next); // 楽観
    if (dbReady() && targetUid) {
      if (next) { void dbFollow(targetUid); void createNotification(targetUid, 'follow'); }
      else void dbUnfollow(targetUid);
    }
  }

  // なかよし（承認制のプロフ帳交換）
  const [friendStatus, setFriendStatus] = useState<FriendStatus>('none');
  useEffect(() => {
    if (!dbReady() || !targetUid) { setFriendStatus('none'); return; }
    let cancelled = false;
    getFriendStatus(targetUid).then((s) => { if (!cancelled) setFriendStatus(s); });
    return () => { cancelled = true; };
  }, [targetUid]);

  function onFriendAction() {
    if (!dbReady() || !targetUid) return;
    if (friendStatus === 'none') {
      setFriendStatus('pending_out');
      void requestFriend(targetUid);
      void createNotification(targetUid, 'friend_request');
    } else if (friendStatus === 'pending_in') {
      setFriendStatus('friends');
      void acceptFriend(targetUid);
      void createNotification(targetUid, 'friend_accept');
    } else {
      // pending_out（取消）／friends（解除）
      setFriendStatus('none');
      void removeFriend(targetUid);
    }
  }
  const friendBtn = {
    none:        { label: `📖 ${t('fr_request', lang)}`, cls: 'bg-purple text-white' },
    pending_out: { label: `⏳ ${t('fr_pending', lang)}`, cls: 'bg-base text-purple ring-2 ring-purple/40' },
    pending_in:  { label: `✅ ${t('fr_accept', lang)}`, cls: 'bg-purple text-white' },
    friends:     { label: `📖 ${t('fr_friends', lang)}`, cls: 'bg-base text-purple ring-2 ring-purple/40' },
  }[friendStatus];
  const isFriend = friendStatus === 'friends';

  const book = mockProfileBooks[profile.id];
  const theirAnswers = answers.filter((a) => a.user.id === profile.id);
  // Supabase から取得した本人のプロフ帳があれば優先。無ければモック／簡易合成。
  const hasSb = !!supabaseBook && !!supabaseBook.info && Object.keys(supabaseBook.info).length > 0;
  const info = {
    ...(hasSb
      ? { ...defaultProfileBookInfo, ...supabaseBook!.info }
      : book?.info ?? {
          ...defaultProfileBookInfo,
          name: profile.name,
          nickname: profile.name,
          message: profile.bio,
          catchphrase: `「${profile.common}」`,
        }),
    attribute: (hasSb ? supabaseBook!.info!.attribute : book?.info?.attribute) ?? 'highschool',
    activity: (hasSb ? supabaseBook!.info!.activity : book?.info?.activity) ?? '',
  };
  const best3 = supabaseBook?.best3 ?? book?.best3 ?? {};
  const questions = supabaseBook?.questions ?? book?.questions ?? [];
  // 相手の「今月のBEST3」（今月のぶんのみ表示）
  const otherMonthly = (() => {
    const m = supabaseBook?.monthly;
    const cur = currentMonthInfo();
    if (m && m.monthKey === cur.monthKey && (m.items.some((v) => v.trim()) || (m.episode ?? '').trim())) {
      return { theme: cur.theme, label: cur.label, items: m.items, events: cur.events, episodeQ: cur.episodeQ, episode: m.episode };
    }
    return null;
  })();
  const themeColor = book?.themeColor ?? 'pink';
  const premium = book?.premium;
  const isSubscribed = subscribedOfficials.includes(profile.id) || (me.isOfficial && book?.isOfficial === true);

  // ── なかよし度：プロフ帳の共通点＋いっしょの行動から算出 ──
  const commonPoints = useMemo(() => {
    // 相手のプロフ帳は Supabase 優先（無ければモック）。共通点は両者で同じになる（対称）。
    const theirInfo: Record<string, any> | undefined = supabaseBook?.info ?? book?.info;
    if (!myProfile || !theirInfo) return [] as { label: string; value: string }[];
    const result: { label: string; value: string }[] = [];
    for (const { key, label } of MATCH_FIELDS) {
      const mine = (myProfile as any)[key]?.trim();
      const theirs = theirInfo[key]?.trim?.();
      if (mine && theirs && mine === theirs) result.push({ label, value: mine });
    }
    return result;
  }, [myProfile, book, supabaseBook]);
  // いっしょに日記を書いたことがあるか
  const wroteDiaryTogether = useMemo(() =>
    diaryPages.some((page) => {
      const authors = new Set([page.createdBy, ...page.entries.map((e) => e.authorId)]);
      return authors.has(me.id) && authors.has(profile.id);
    }), [diaryPages, profile.id]);
  // おなじサークルに入っているか
  const inSameCircle = useMemo(() =>
    circles.some((c) => c.memberIds.includes(me.id) && c.memberIds.includes(profile.id)),
    [circles, profile.id]);
  // なかよしアクション（各1ポイント）
  // 仲良し度は双方向で同じになるよう、対称な関係だけで算出する
  // （相互フォロー／なかよし／いっしょに日記／おなじサークル／プロフ帳の共通点）。
  const friendActions: { label: string; done: boolean }[] = [
    { label: `🎀 ${t('fl_mutual', lang)}`, done: mutualFollow },
    { label: `📖 ${t('fl_exchanged', lang)}`, done: isFriend },
    { label: `📔 ${t('fl_diary', lang)}`, done: wroteDiaryTogether },
    { label: `🔒 ${t('fl_circle', lang)}`, done: inSameCircle },
  ];
  const friendLevel = Math.min(5, commonPoints.length + friendActions.filter((a) => a.done).length);
  const FRIEND_LEVEL_LABELS = [0, 1, 2, 3, 4, 5].map((n) => t(`fl_level_${n}`, lang));

  return (
    <>
      <AppHeader noAuto title={tf('pb_header_other', lang, { name: profile.name })} back onBack={() => go('home')} onBell={() => go('notifications')} />
      {/* 画面全体を1つの背景に統一（上のなかよし度〜下のプロフ帳まで同じトンマナ）。文言は翻訳キー、名前や回答は原文のまま（自動翻訳しない） */}
      <div className="relative min-h-full" data-noauto>
      <div className="pointer-events-none absolute inset-0 prof-paper" />
      <div className="relative z-10">
      {/* プロフ帳こうかんカード（フォロー／なかよし）。交換ずみはハンコと交換記録で見せる */}
      <div className="px-4 pt-2">
        <PaperSheet variant="plain" className="px-3 pb-3 pt-2.5">
          <p className="pb-label">📖 {t('fr_card_title', lang)}</p>
          <div className="mt-2 flex min-w-0 gap-2">
            <button
              onClick={toggleFollow}
              aria-pressed={isFollowing}
              className={`min-h-[44px] flex-1 rounded-xl text-[13px] font-black shadow-[0_2px_0_rgba(0,0,0,.12)] active:translate-y-px active:shadow-none transition ${
                isFollowing ? 'bg-base text-pink ring-2 ring-pink' : 'bg-pink text-white'
              }`}
            >
              {isFollowing ? `🎀 ${t('btn_following', lang)}` : `🎀 ${t('btn_follow_short', lang)}`}
            </button>
            <button
              onClick={onFriendAction}
              className={`min-h-[44px] flex-1 rounded-xl text-[13px] font-black shadow-[0_2px_0_rgba(0,0,0,.12)] active:translate-y-px active:shadow-none transition ${friendBtn.cls}`}
            >
              {friendBtn.label}
            </button>
          </div>
          {friendStatus !== 'none' && (
            <div className="mt-2 flex items-center gap-2 border-t-2 border-dotted border-ink/15 pt-1.5">
              <p role="status" className="min-w-0 flex-1 text-[13px] text-ink prof-hand">
                {friendStatus === 'friends' && `✎ ${tf('fr_log_friends', lang, { name: profile.name })}`}
                {friendStatus === 'pending_out' && `✎ ${tf('fr_log_out', lang, { name: profile.name })}`}
                {friendStatus === 'pending_in' && `✎ ${tf('fr_log_in', lang, { name: profile.name })}`}
              </p>
              {/* 交換記録のハンコ（装飾） */}
              {isFriend && <span aria-hidden className="pb-stamp h-11 w-11 shrink-0 rotate-[-12deg] px-0.5 text-[9px] leading-tight">{t('fr_stamp', lang)}</span>}
            </div>
          )}
        </PaperSheet>
      </div>

      {/* 相性チェック（昔のプロフ帳の相性占いコーナー風）→ 一致率しんだんへ */}
      <div className="px-4 pt-3">
        <PaperSheet variant="plain" className="border-2 border-dashed border-pink/30 px-4 pb-4 pt-4">
          <PrintedHeading kicker="MATCH CHECK" title={t('mc_title', lang)} right={<span aria-hidden className="text-xl">💘</span>} />
          <div className="flex items-end justify-center gap-3">
            <div className="min-w-0 flex-1 text-center">
              <p className="pb-label">{t('mc_me', lang)}</p>
              <p className="pb-writeline truncate text-[17px] text-ink prof-hand">{myProfile?.nickname || myProfile?.name || t('mc_me', lang)}</p>
            </div>
            <span aria-hidden className="pb-1 text-2xl text-pink">♡</span>
            <div className="min-w-0 flex-1 text-center">
              <p className="pb-label">{t('mc_them', lang)}</p>
              <p className="pb-writeline truncate text-[17px] text-ink prof-hand">{profile.name}</p>
            </div>
          </div>
          <p className="mt-2.5 text-center text-[12px] font-bold text-muted">{t('mc_desc', lang)}</p>
          <button
            onClick={() => go('diagnosis', profile.id)}
            className="relative mt-2.5 min-h-[48px] w-full overflow-hidden rounded-xl pb-banner border-2 border-dashed border-white/70 py-3 text-sm font-black shadow-[0_2px_0_rgba(0,0,0,.15)] active:translate-y-px active:shadow-none"
          >
            💯 {tf('mc_btn', lang, { name: profile.name })}
          </button>
        </PaperSheet>
      </div>

      {/* 他己紹介アンケート（性格をみんなで投票） */}
      {targetUid && (
        <div className="px-4 pt-3">
          <PerceptionVoteCard targetUid={targetUid} targetName={profile.name} lang={lang} />
        </div>
      )}

      {/* なかよし度 */}
      <div className="px-4 pt-3">
        <PaperSheet variant="plain" className="px-4 pb-4 pt-4">
          <PrintedHeading
            kicker="FRIENDSHIP"
            title={t('fl_title', lang)}
            right={<StickerBadge tone="coral" rotate={4}>{FRIEND_LEVEL_LABELS[friendLevel]}</StickerBadge>}
          />
          {/* シール台紙：なかよしになるたびハートのシールが1枚ずつ貼られていく */}
          <div className="rounded-xl border-2 border-dashed border-ink/15 bg-cream/60 px-3 py-2.5">
            <p className="pb-label mb-1.5">{t('fl_sheet', lang)}</p>
            <HeartMeter level={friendLevel} />
          </div>
          {/* なかよしアクションの内訳 */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {commonPoints.map((c) => (
              <span key={c.label} className="inline-flex items-center gap-1 rounded-full bg-cream px-3 py-1.5 text-[11px] font-black text-ink shadow-[0_2px_4px_rgba(0,0,0,.12)]">
                ✨ {tf('fl_common', lang, { label: tv(c.label, lang), v: tv(c.value, lang) })}
              </span>
            ))}
            {friendActions.map((a) => (
              <span key={a.label}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-black ${a.done ? 'bg-white text-ink shadow-[inset_0_0_0_2px_rgba(255,255,255,.9),0_2px_4px_rgba(0,0,0,.16)]' : 'border border-dashed border-ink/25 bg-transparent text-muted'}`}>
                {a.done ? '✓' : '○'} {a.label}
              </span>
            ))}
          </div>
          {friendLevel < 5 && (
            <p className="mt-3 text-[12px] font-bold text-muted">
              {t('fl_hint', lang)} 🌱
            </p>
          )}
        </PaperSheet>
      </div>

      {/* 称号バッジ */}
      {(() => {
        const titles = getUserTitles(profile.id);
        if (titles.length === 0) return null;
        const hasFounder = titles.includes('founder');
        return (
          <div className="space-y-2 px-4 pt-3">
            <div className="flex flex-wrap gap-2">
              {titles.map((tt) => <TitleBadge key={tt} type={tt} userId={profile.id} lang={lang} />)}
            </div>
            {hasFounder && (
              <PaperSheet variant="plain" className="border-2 border-double border-amber-500/60 px-4 pb-3.5 pt-3">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="text-xs font-black tracking-widest text-ink">🏅 {t('title_ultra_rare', lang)}</span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black text-amber-900">ULTRA RARE</span>
                </div>
                <p className="text-xs font-bold leading-5 text-ink">{lang === 'ja' ? TITLE_DEFS.founder.description : t('title_founder_desc', lang)}</p>
              </PaperSheet>
            )}
          </div>
        );
      })()}

      <ProfileBookContent
        bare
        info={info}
        best3={best3}
        monthlyBest3={otherMonthly}
        questions={questions}
        answers={theirAnswers}
        avatarEmoji={profile.avatar}
        userId={profile.id}
        themeColor={themeColor}
        onGoDetail={(id) => go('detail', id)}
        lang={lang}
        visibility={supabaseBook?.visibility ?? {}}
        viewerIsFollower={isFollowing}
        pen={supabaseBook?.pen ?? null}
      />

      {/* 相手の公開ブログ */}
      {userBlogs.length > 0 && (
        <div className="px-4 pb-4">
          <section className="pb-sheet px-4 pb-4 pt-4">
            <ProfSectionHeader icon="📔" title={t('pb_blog', lang)} theme={themeColor} />
            <div className="space-y-2">
              {userBlogs.slice(0, 5).map((p) => (
                <button key={p.id} onClick={() => onOpenBlog?.(p)}
                  className="block w-full rounded-2xl bg-base p-3 text-left transition active:scale-[0.99]">
                  <p className="text-sm">{p.weather}{p.mood} <span className="font-black text-ink" style={{ color: p.textColor || undefined }}>{p.title || t('pb_blog_untitled', lang)}</span></p>
                  <p className="mt-1 line-clamp-1 text-xs font-bold text-muted"><RetroText text={blogPlain(p.body)} /></p>
                  <p className="mt-1 text-[10px] font-black text-pink">♡ {p.likes}　💬 {p.comments.length}</p>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ── プレミアムコンテンツ ── */}
      {premium && (
        <div className="px-4 pb-10">
          <div className="overflow-hidden rounded-[32px] shadow-card">
            {/* ヘッダー */}
            <div className="bg-gradient-to-r from-amber-400 to-orange-400 p-5">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-xl">✨</span>
                <p className="font-black text-white">{t('pm_title', lang)}</p>
                {isSubscribed && (
                  <span className="rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-black text-white">{t('pm_purchased', lang)}</span>
                )}
              </div>
              <p className="text-xs font-bold text-white/80">{premium.description}</p>
              {!isSubscribed && (
                <p className="mt-1 text-[10px] font-bold text-white/80"><CoinIcon size={12} /> {tf('pm_coins', lang, { n: 200 })} · {t('pm_forever', lang)}</p>
              )}
            </div>

            {!isSubscribed ? (
              /* ロック中：先頭Q&Aをぼかしてゲート表示 */
              <div className="relative bg-white">
                <div className="select-none px-5 py-6 blur-sm pointer-events-none">
                  {premium.questions.slice(0, 1).map((item, i) => (
                    <div key={i} className="mb-4">
                      <p className="text-xs font-black text-amber-600 mb-1">Q. {item.q}</p>
                      <p className="text-sm font-bold text-ink leading-6">{item.a}</p>
                    </div>
                  ))}
                  {premium.note && (
                    <p className="text-xs font-bold text-muted">{premium.note.slice(0, 40)}…</p>
                  )}
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-[3px]">
                  <span className="mb-2 text-4xl">🔒</span>
                  <p className="mb-1 text-base font-black text-ink"><CoinIcon size={15} /> {tf('pm_unlock_with', lang, { n: 200 })}</p>
                  <p className="mb-5 text-xs font-bold text-muted">{t('pm_forever', lang)}</p>
                  <button
                    onClick={() => onToggleSubscription(profile.id)}
                    className="rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-8 py-3 text-sm font-black text-white shadow-floating active:scale-[0.98] transition"
                  >
                    <CoinIcon size={14} /> {t('pm_unlock_btn', lang)}
                  </button>
                </div>
              </div>
            ) : (
              /* 解除済み：全コンテンツ表示 */
              <div className="space-y-4 bg-white p-5">
                {premium.questions.map((item, i) => (
                  <div key={i} className="rounded-2xl bg-amber-50 p-4">
                    <p className="mb-2 text-xs font-black text-amber-600">Q. {item.q}</p>
                    <p className="text-sm font-bold text-ink leading-6">{item.a}</p>
                  </div>
                ))}
                {premium.note && (
                  <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50 p-4">
                    <p className="mb-2 text-xs font-black text-amber-700">✉ {tf('pm_message_from', lang, { name: profile.name })}</p>
                    <p className="text-sm font-bold text-ink leading-6">{premium.note}</p>
                  </div>
                )}
                <button
                  onClick={() => onToggleSubscription(profile.id)}
                  className="text-xs font-bold text-muted underline"
                >
                  {t('pm_cancel', lang)}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
      </div>
    </>
  );
}

function ProfileScreen({
  go,
  profileBookInfo,
  best3,
  monthlyBest3,
  profileQuestions,
  avatarUrl,
  favoritePhotos,
  customFields,
  equippedBg = null,
  lang = 'ja',
  pen = null,
}: {
  go: (s: Screen, answerId?: string) => void;
  profileBookInfo: typeof defaultProfileBookInfo;
  best3: typeof defaultBest3;
  monthlyBest3?: { theme: string; label: string; items: string[]; events?: string; episodeQ?: string; episode?: string } | null;
  profileQuestions: typeof defaultProfileQuestions;
  avatarUrl: string;
  favoritePhotos: string[];
  customFields?: Record<string, string>;
  equippedBg?: BgTheme | null;
  lang?: Lang;
  pen?: Pen | null;
}) {
  const [showShare, setShowShare] = useState(false);
  return (
    <>
      <AppHeader noAuto title={t('header_profile', lang)} back onBack={() => go('home')} onBell={() => go('notifications')} />
      {/* 画面全体を1つの背景に統一（上のボタン〜下のプロフ帳まで同じトンマナ） */}
      <div className="relative min-h-full" data-noauto>
      {equippedBg
        ? <div className="pointer-events-none absolute inset-0"><SceneBackground theme={equippedBg} subtle /></div>
        : <div className="pointer-events-none absolute inset-0 prof-paper" />}
      <div className="relative z-10">
      <div className="flex gap-2 px-4 pt-2">
        <button
          onClick={() => go('settings')}
          className="flex-1 rounded-full bg-white py-3 text-sm font-black text-pink shadow-card active:scale-[0.99]"
        >
          ✏️ {t('btn_edit_profile', lang)}
        </button>
        <button
          onClick={() => setShowShare(true)}
          aria-label={t('pb_share', lang)}
          title={t('pb_share', lang)}
          className="rounded-full bg-white px-4 py-3 text-sm font-black text-muted shadow-card active:scale-[0.99]"
        >
          <Share2 size={17} />
        </button>
        <button
          onClick={() => go('diagnosis')}
          className="rounded-full bg-white px-4 py-3 text-sm font-black text-purple shadow-card active:scale-[0.99]"
          title={t('pb_answer_match', lang)}
          aria-label={t('pb_answer_match', lang)}
        >
          💯
        </button>
        {me.isOfficial && (
          <button
            onClick={() => go('official-question-create')}
            className="flex-1 rounded-full bg-blue-50 py-3 text-sm font-black text-blue-500 shadow-card active:scale-[0.99]"
          >
            ✓ {t('pb_create_topic', lang)}
          </button>
        )}
      </div>

      {/* 自分の称号バッジ */}
      {(() => {
        const titles = getUserTitles(me.id);
        if (titles.length === 0) return null;
        return (
          <div className="flex flex-wrap gap-2 px-4 pt-3">
            {titles.map((tt) => <TitleBadge key={tt} type={tt} userId={me.id} lang={lang} />)}
          </div>
        );
      })()}

      {/* みんなが選ぶ「わたしの性格」（友だちの投票がある時だけ表示） */}
      <MyPerceptionCard lang={lang} />

      <ProfileBookContent
        bare
        info={profileBookInfo}
        best3={best3}
        monthlyBest3={monthlyBest3}
        isSelf
        questions={profileQuestions}
        answers={[]}
        avatarEmoji={me.avatar}
        avatarUrl={avatarUrl || undefined}
        userId={me.id}
        themeColor="pink"
        bgTheme={equippedBg}
        favoritePhotos={favoritePhotos}
        customFields={customFields}
        lang={lang}
        pen={pen}
      />
      </div>
      </div>

      {showShare && (
        <ProfileShareModal
          userId={me.id}
          avatar={me.avatar}
          avatarUrl={avatarUrl || undefined}
          info={profileBookInfo}
          lang={lang}
          onClose={() => setShowShare(false)}
        />
      )}
    </>
  );
}

function ProfileEditScreen({
  go,
  profileBookInfo,
  best3,
  monthlyBest3,
  onSaveMonthlyBest3,
  profileQuestions,
  onSave,
  onSaveBest3,
  onSaveQuestions,
  avatarUrl,
  onSaveAvatar,
  favoritePhotos,
  onSaveFavoritePhotos,
  appTheme,
  onChangeTheme,
  customFields,
  onSaveCustomFields,
  fieldVisibility = {},
  onSaveVisibility = () => {},
  premiumContent,
  onSavePremiumContent,
  lang,
  onChangeLang,
  notifyOdai,
  onToggleNotifyOdai,
  ownedBgIds = [],
  ownedThemeIds = [],
  equippedBgId = null,
  onEquipBg = () => {},
  onLogout,
  pen = null,
  onPenChange = () => {},
}: {
  go: (s: Screen) => void;
  profileBookInfo: typeof defaultProfileBookInfo;
  best3: typeof defaultBest3;
  monthlyBest3: MonthlyBest3;
  onSaveMonthlyBest3: (items: string[], episode: string) => void;
  profileQuestions: typeof defaultProfileQuestions;
  onSave: (next: typeof defaultProfileBookInfo) => void;
  onSaveBest3: (next: typeof defaultBest3) => void;
  onSaveQuestions: (next: typeof defaultProfileQuestions) => void;
  avatarUrl: string;
  onSaveAvatar: (url: string) => void;
  favoritePhotos: string[];
  onSaveFavoritePhotos: (photos: string[]) => void;
  appTheme: AppThemeId;
  onChangeTheme: (id: AppThemeId) => void;
  customFields: Record<string, string>;
  onSaveCustomFields: (next: Record<string, string>) => void;
  fieldVisibility?: Record<string, FieldVisibility>;
  onSaveVisibility?: (next: Record<string, FieldVisibility>) => void;
  premiumContent: PremiumSection;
  onSavePremiumContent: (next: PremiumSection) => void;
  lang: Lang;
  onChangeLang: (l: Lang) => void;
  notifyOdai: boolean;
  onToggleNotifyOdai: (val: boolean) => void;
  ownedBgIds?: string[];
  ownedThemeIds?: string[];
  equippedBgId?: string | null;
  onEquipBg?: (id: string | null) => void;
  onLogout: () => void;
  /** わたしのペン（保存ボタンで保存） */
  pen?: Pen | null;
  onPenChange?: (pen: Pen) => void;
}) {
  const [form, setForm] = useState(profileBookInfo);
  const [penForm, setPenForm] = useState<Pen>(pen ?? DEFAULT_PEN);
  const penTouched = useRef(false);
  const [best3Form, setBest3Form] = useState(best3);
  const [monthlyForm, setMonthlyForm] = useState<string[]>(monthlyBest3.items);
  const [monthlyEpisodeForm, setMonthlyEpisodeForm] = useState<string>(monthlyBest3.episode ?? '');
  const monthInfo = currentMonthInfo();
  const [questionsForm, setQuestionsForm] = useState(profileQuestions);
  const [localAvatarUrl, setLocalAvatarUrl] = useState(avatarUrl);
  const [localPhotos, setLocalPhotos] = useState<string[]>(favoritePhotos);
  const [localCustomFields, setLocalCustomFields] = useState<Record<string, string>>(customFields);
  const [visForm, setVisForm] = useState<Record<string, FieldVisibility>>(fieldVisibility);
  // 各項目にインラインの公開範囲チップを付けるためのprops。
  const vprops = (key: string) => ({
    vis: visForm[key] ?? ('public' as FieldVisibility),
    onVis: (v: FieldVisibility) => setVisForm((prev) => ({ ...prev, [key]: v })),
  });
  const [premiumForm, setPremiumForm] = useState<PremiumSection>(premiumContent);
  const [showShare, setShowShare] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // 縮小してから反映（保存失敗・重さ対策）。失敗時は原本を使う。
    try {
      setLocalAvatarUrl(await downscaleImageFile(file, 256, 0.82));
    } catch {
      const reader = new FileReader();
      reader.onload = (ev) => setLocalAvatarUrl(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  }

  function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target?.result as string);
      reader.readAsDataURL(file);
    });
  }

  async function handleAddPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const remaining = 10 - localPhotos.length;
    const toAdd = files.slice(0, remaining);
    const urls = await Promise.all(toAdd.map(readFileAsDataUrl));
    setLocalPhotos((prev) => [...prev, ...urls]);
    e.target.value = '';
  }

  async function handleReplacePhoto(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await readFileAsDataUrl(file);
    setLocalPhotos((prev) => prev.map((p, i) => (i === index ? url : p)));
    e.target.value = '';
  }

  function handleDeletePhoto(index: number) {
    setLocalPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  const update = (key: keyof typeof defaultProfileBookInfo, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // 立場（ライフステージ）を選ぶ：その立場で使わない専用項目は消し、特技・活動の項目は残す（従来どおり）
  function selectStage(id: string) {
    update('attribute', id);
    setLocalCustomFields((prev) => {
      const next: Record<string, string> = {};
      ACTIVITY_DEFS.find((a) => a.id === form.activity)?.fields.forEach((f) => {
        if (prev[f.key]) next[f.key] = prev[f.key];
      });
      return next;
    });
  }
  // 特技・活動を選ぶ（''＝なし）：立場の項目は残し、選んだ活動の項目だけ引き継ぐ（従来どおり）
  function selectActivity(id: string) {
    update('activity', id);
    setLocalCustomFields((prev) => {
      const next: Record<string, string> = {};
      LIFE_STAGE_DEFS.find((ls) => ls.id === form.attribute)?.fields.forEach((f) => {
        if (prev[f.key]) next[f.key] = prev[f.key];
      });
      ACTIVITY_DEFS.find((a) => a.id === id)?.fields.forEach((f) => {
        if (prev[f.key]) next[f.key] = prev[f.key];
      });
      return next;
    });
  }

  // 保存（下のボタンと、上のインデックスの「保存」で共通）
  function saveAll() {
    onSave(form);
    onSaveBest3(best3Form);
    onSaveMonthlyBest3(monthlyForm, monthlyEpisodeForm);
    onSaveQuestions(questionsForm);
    onSaveAvatar(localAvatarUrl);
    onSaveFavoritePhotos(localPhotos);
    onSaveCustomFields(localCustomFields);
    onSaveVisibility(visForm);
    if (me.isOfficial) onSavePremiumContent(premiumForm);
    if (penTouched.current) onPenChange(penForm);
    go('profile');
  }

  const L = (k: string) => t(k, lang);
  // インデックス（見出しタブ）：押すとその記入用紙までスクロール
  const INDEX: [string, string][] = [
    ['pe-lang', L('idx_lang')], ['pe-photo', L('idx_photo')], ['pe-stage', L('idx_stage')], ['pe-basic', L('idx_basic')],
    ['pe-likes', L('idx_likes')], ['pe-about', L('idx_about')], ['pe-monthly', L('idx_monthly')], ['pe-best3', L('idx_best3')],
    ['pe-qa', L('idx_qa')], ['pe-pen', L('idx_pen')], ['pe-theme', L('idx_theme')], ['pe-settings', L('idx_settings')],
  ];
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const mInfo = localizedMonthInfo(monthInfo, lang);

  // ひとこと質問：変更は form の中だけ（保存ボタンで保存）。元の配列・オブジェクトは書き換えない。
  const [editingQ, setEditingQ] = useState<number | null>(null);
  const [confirmDelQ, setConfirmDelQ] = useState<number | null>(null);
  const setQA = (i: number, patch: Partial<{ q: string; a: string }>) =>
    setQuestionsForm((prev) => prev.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const growArea = (el: HTMLTextAreaElement | null) => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } };
  // ID・表示名の変更ページへ移る前の確認（保存していない入力が消えるため）
  const [confirmIdPage, setConfirmIdPage] = useState(false);

  return (
    <EditLangContext.Provider value={lang}>
      <AppHeader noAuto title={L('header_settings')} back onBack={() => go('profile')} onBell={() => go('notifications')} />

      {/* 固定文言はすべて翻訳キー。ユーザーの入力内容は自動翻訳しない（data-noauto） */}
      <div className="space-y-4 px-4 pt-3 pb-32" {...penAttrs(penForm)} style={penAttrs(penForm).style} data-noauto>

        {/* ===== プロフィール完成度メーター（うめるほど楽しく） ===== */}
        <ProfileProgress info={form} lang={lang} />

        {/* ===== ことば / Language（最上位の設定：見出しタブ・メニュー・項目名が切り替わる） ===== */}
        <section id="pe-lang" className="pb-sheet scroll-mt-32 p-5">
          <PrintedHeading kicker="LANGUAGE" title={lang === 'ja' ? 'ことば / Language' : lang === 'en' ? 'Language' : `${L('idx_lang')} / Language`} />
          <p className="-mt-1 mb-2.5 text-[12px] font-bold text-muted">{L('pe_lang_desc')}</p>
          {/* いまの言語でどう表示されるかの見本 */}
          <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-lg border-2 border-dotted border-ink/15 bg-cream/50 px-3 py-2" aria-live="polite">
            <span className="pb-label mr-0.5">{L('pe_lang_now')}</span>
            {['tab_home', 'tab_search', 'tab_mypage', 'field_nickname', 'field_birthday'].map((k) => (
              <span key={k} className="rounded bg-white px-1.5 py-0.5 text-[12px] font-black text-ink shadow-[0_1px_2px_rgba(0,0,0,.12)]">{t(k, lang)}</span>
            ))}
          </div>
          {(() => {
            const MAIN: Lang[] = ['ja', 'en', 'ko', 'zh', 'zh-tw'];
            const card = (l: (typeof LANG_LIST)[number], big: boolean) => {
              const on = lang === l.id;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => onChangeLang(l.id)}
                  aria-pressed={on}
                  className={`relative flex items-center gap-1.5 rounded-lg text-left transition ${big ? 'min-h-[48px] px-3' : 'min-h-[44px] px-2'} ${on ? 'bg-pink/10 ring-2 ring-pink' : 'bg-white ring-1 ring-ink/10 hover:bg-pink/5'}`}
                >
                  {/* 選んだ言語にはマステを貼って、チェックのシール */}
                  {on && <span aria-hidden className="pb-tape !absolute -top-1.5 left-3 h-2.5 w-10 !p-0" style={{ transform: 'rotate(-3deg)' }} />}
                  <span aria-hidden className={big ? 'text-base' : 'text-[13px]'}>{l.flag}</span>
                  <span lang={l.id} className={`min-w-0 flex-1 truncate font-black text-ink ${big ? 'text-[14px]' : 'text-[12px]'}`}>{l.name}</span>
                  {on && <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-pink text-[11px] font-black text-white shadow-[inset_0_0_0_2px_rgba(255,255,255,.8)]">✓</span>}
                </button>
              );
            };
            return (
              <>
                <p className="pb-label mb-1.5">{L('pe_lang_main')}</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{LANG_LIST.filter((l) => MAIN.includes(l.id)).map((l) => card(l, true))}</div>
                <p className="pb-label mb-1.5 mt-3">{L('pe_lang_other')}</p>
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">{LANG_LIST.filter((l) => !MAIN.includes(l.id)).map((l) => card(l, false))}</div>
              </>
            );
          })()}
        </section>

        {/* ===== インデックス（見出しタブ）：記入用紙へ移動＋いつでも保存 ===== */}
        <nav aria-label={L('pe_index_aria')} className="sticky top-16 z-10 -mx-4 bg-base/95 px-4 py-2 backdrop-blur">
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {INDEX.map(([id, label]) => (
              <button key={id} type="button" onClick={() => jump(id)}
                className="shrink-0 whitespace-nowrap rounded-t-lg border-b-2 border-pink/40 bg-white px-3 py-2 text-[12px] font-black text-ink shadow-[0_-1px_3px_rgba(0,0,0,.06)] active:translate-y-px">
                {label}
              </button>
            ))}
            <button type="button" onClick={saveAll}
              className="shrink-0 whitespace-nowrap rounded-lg bg-pink px-3 py-2 text-[12px] font-black text-white shadow-card active:scale-[0.98]">
              ✓ {L('btn_save')}
            </button>
          </div>
        </nav>

        {/* ===== 写真と名札（アイコン・表示名・ID） ===== */}
        <div id="pe-photo" className="scroll-mt-32 space-y-4">
          <PrintedHeading no="01" kicker="PHOTO & NAME TAG" title={L('pe_photo_title')} />
          <section className="pb-sheet p-4">
            <div className="flex items-start gap-4">
              {/* ポラロイドに貼った写真 */}
              <div className="shrink-0 text-center">
                <div className="pb-polaroid relative -rotate-2">
                  <span aria-hidden className="pb-tape pb-tape-sax !absolute -top-2 left-1/2 z-10 h-3.5 w-12 -translate-x-1/2 !p-0" style={{ transform: 'translateX(-50%) rotate(-4deg)' }} />
                  <div className="grid h-20 w-20 place-items-center overflow-hidden bg-cream text-4xl">
                    {localAvatarUrl ? <img src={localAvatarUrl} alt={L('pe_avatar')} className="h-full w-full object-cover" /> : me.avatar}
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <label className="min-h-[36px] cursor-pointer px-1 py-2 text-[12px] font-black text-pinkStrong underline decoration-dotted underline-offset-4">
                    {L('btn_pick_image')}
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                  </label>
                  {localAvatarUrl && (
                    <button type="button" onClick={() => setLocalAvatarUrl('')} className="min-h-[36px] px-1 text-[12px] font-bold text-muted underline decoration-dotted underline-offset-4">{L('btn_delete')}</button>
                  )}
                </div>
              </div>
              {/* 名札：表示名と ID（変更は小さな「編集」から。移る前に確認） */}
              <div className="min-w-0 flex-1 overflow-hidden rounded-lg border-2 border-ink/15 bg-white">
                <p className="gk-font flex items-center justify-between bg-pink/15 px-3 py-1 text-[11px] text-ink">
                  <span>NAME TAG</span>
                  <button type="button" onClick={() => setConfirmIdPage(true)} className="-my-1 min-h-[32px] px-1 text-[12px] font-black text-pinkStrong" aria-label={L('pe_id_edit_aria')}>✎ {L('btn_edit')}</button>
                </p>
                <div className="px-3 pb-2.5 pt-2">
                  <p className="pb-label">{L('pe_display_name')}</p>
                  <p className="pb-writeline truncate text-[17px] leading-snug text-ink prof-hand">{me.name}</p>
                  <p className="pb-label mt-2">{L('pe_user_id')}</p>
                  <p className="gk-font truncate text-[14px] text-ink">{me.id}</p>
                </div>
              </div>
            </div>
            <p className="mt-3 text-[11px] font-bold leading-relaxed text-muted">{L('pe_id_note')}</p>
          </section>

          <section className="pb-sheet p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="pb-label pb-label-md">{tf('pe_photos_count', lang, { n: localPhotos.length })}</p>
              {localPhotos.length < 10 && (
                <label className="min-h-[36px] cursor-pointer rounded-full bg-pink/10 px-3 py-2 text-xs font-black text-pinkStrong active:scale-[0.99]">
                  ＋ {L('btn_add')}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleAddPhotos} />
                </label>
              )}
            </div>
            {localPhotos.length === 0 ? (
              <label className="flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-pink/30 bg-pink/5 p-8 text-xs font-bold text-muted">
                {L('pe_photos_empty')}
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleAddPhotos} />
              </label>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {localPhotos.map((photo, index) => (
                  <div key={index} className="relative aspect-square overflow-hidden rounded-2xl">
                    <img src={photo} alt={`photo-${index}`} className="h-full w-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 flex gap-1 p-1">
                      <label className="flex-1 cursor-pointer rounded-lg bg-white/80 py-1 text-center text-[10px] font-black text-ink backdrop-blur-sm">
                        {L('btn_replace')}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleReplacePhoto(index, e)} />
                      </label>
                      <button type="button" onClick={() => handleDeletePhoto(index)} className="flex-1 rounded-lg bg-pink/80 py-1 text-[10px] font-black text-white backdrop-blur-sm">
                        {L('btn_delete')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div id="pe-stage" className="scroll-mt-32 space-y-4">
        {/* ===== 立場：ケータイのメニューのように番号つきの一覧から選ぶ ===== */}
        <section className="pb-sheet p-5">
          <PrintedHeading kicker="STATUS" title={L('pe_stage_title')} />
          <p className="-mt-1 mb-2.5 text-[12px] font-bold text-muted">{L('pe_stage_desc')}</p>
          <div role="radiogroup" aria-label={L('idx_stage')} className="overflow-hidden rounded-lg border-2 border-ink/10 bg-white">
            {LIFE_STAGE_DEFS.map((ls, i) => {
              const on = form.attribute === ls.id;
              return (
                <button
                  key={ls.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => selectStage(ls.id)}
                  className={`flex min-h-[50px] w-full items-center gap-3 px-3 text-left transition ${i > 0 ? 'border-t-2 border-dotted border-ink/10' : ''} ${on ? 'bg-pink/10' : 'hover:bg-pink/5'}`}
                >
                  {/* ケータイのボタン番号 */}
                  <span aria-hidden className={`gk-font grid h-7 w-7 shrink-0 place-items-center rounded-md text-[13px] ${on ? 'bg-pink text-white' : 'bg-base text-ink ring-1 ring-ink/15'}`}>{i + 1}</span>
                  <span aria-hidden className="text-lg">{ls.emoji}</span>
                  <span className={`flex-1 text-[14px] ${on ? 'font-black text-ink' : 'font-bold text-ink/85'}`}>{tv(ls.label, lang)}</span>
                  {on && <span aria-hidden className="pb-stamp h-9 w-9 shrink-0 -rotate-12 text-[9px] leading-tight">{L('stamp_chosen')}</span>}
                </button>
              );
            })}
          </div>
        </section>

        {/* ===== 特技・活動：あてはまるシールを1枚はる（なくてもOK） ===== */}
        <section className="pb-sheet p-5">
          <PrintedHeading kicker="MY THING" title={L('pe_activity_title')} right={<span className="pb-label pb-0.5">{L('pe_if_any')}</span>} />
          <p className="-mt-1 mb-2.5 text-[12px] font-bold text-muted">{L('pe_activity_desc')}</p>
          {(() => {
            const GROUPS: { label: string; ids: string[] }[] = [
              { label: `🏃 ${L('grp_sports')}`, ids: ['baseball', 'soccer'] },
              { label: `🎶 ${L('grp_culture')}`, ids: ['musician', 'gamer', 'creator'] },
            ];
            const grouped = new Set(GROUPS.flatMap((g) => g.ids));
            const others = ACTIVITY_DEFS.filter((a) => !grouped.has(a.id)).map((a) => a.id);
            const groups = others.length ? [...GROUPS, { label: `✨ ${L('grp_other')}`, ids: others }] : GROUPS;
            return (
              <div className="space-y-2.5">
                {groups.map((g) => (
                  <div key={g.label}>
                    <p className="pb-label mb-1.5">{g.label}</p>
                    <div className="flex flex-wrap gap-2">
                      {ACTIVITY_DEFS.filter((a) => g.ids.includes(a.id)).map((act) => {
                        const on = form.activity === act.id;
                        return (
                          <button
                            key={act.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() => selectActivity(on ? '' : act.id)}
                            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3.5 text-[13px] font-black transition ${on ? '-rotate-2 bg-cream text-ink shadow-[inset_0_0_0_2px_rgba(255,255,255,.9),0_2px_5px_rgba(0,0,0,.18)]' : 'border-2 border-dashed border-ink/20 bg-white/70 text-ink/80 hover:bg-pink/5'}`}
                          >
                            <span aria-hidden className="text-base">{act.emoji}</span>{tv(act.label, lang)}{on && <span aria-hidden className="text-pinkStrong">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div className="flex justify-end pt-0.5">
                  <button
                    type="button"
                    aria-pressed={!form.activity}
                    onClick={() => selectActivity('')}
                    className={`min-h-[40px] px-2 text-[12px] font-bold underline decoration-dotted underline-offset-4 ${!form.activity ? 'text-ink' : 'text-muted'}`}
                  >
                    {!form.activity ? `✓ ${L('act_none')}` : L('act_none_set')}
                  </button>
                </div>
              </div>
            );
          })()}
        </section>
        </div>

        {/* ===== 記入用紙：きほんじょうほう／すき・きらい／わたしのこと（項目の順番は従来どおり） ===== */}
        <p className="rounded-xl bg-white/70 px-4 py-2.5 text-[12px] font-bold text-muted">{L('pe_save_note')}</p>
        <section id="pe-basic" className="pb-sheet scroll-mt-32 space-y-3 p-5">
          <PrintedHeading no="02" kicker="BASIC" title={L('sec_basic')} />
          <NameField label={L('field_name')} value={form.name} onChange={(v) => update('name', v)} {...vprops('name')} />
          <EditField label={L('field_nickname')} value={form.nickname} onChange={(v) => update('nickname', v)} />
          <BirthdayField label={L('field_birthday')} value={form.birthday} onChange={(v) => update('birthday', v)} {...vprops('birthday')} />
          {/* 血液型はプロフ帳と同じく、その言語で一般的なときだけ見せる（保存値はそのまま） */}
          {L('show_bloodType') === 'true' && <BloodTypeField label={L('field_bloodType')} value={form.bloodType} onChange={(v) => update('bloodType', v)} options={BLOOD_TYPE_OPTIONS} {...vprops('bloodType')} />}
          <CheckListField label={L('field_gender')} value={form.gender ?? ''} onChange={(v) => update('gender' as any, v)} options={getGenderOptions(lang)} {...vprops('gender')} />
          <MbtiField label="MBTI" value={form.mbti} onChange={(v) => update('mbti', v)} {...vprops('mbti')} />
          <EditField label={L('field_hometown')} value={form.hometown} onChange={(v) => update('hometown', v)} {...vprops('hometown')} />
        </section>
        <section id="pe-likes" className="pb-sheet scroll-mt-32 space-y-3 p-5">
          <PrintedHeading no="03" kicker="LIKE & DISLIKE" title={L('sec_likes')} />
          <EditField label={L('field_favoriteFood')} value={form.favoriteFood} onChange={(v) => update('favoriteFood', v)} {...vprops('favoriteFood')} />
          <EditField label={L('field_dislikeFood')} value={form.dislikeFood} onChange={(v) => update('dislikeFood', v)} {...vprops('dislikeFood')} />
          <EditField label={L('field_favoriteColor')} value={form.favoriteColor} onChange={(v) => update('favoriteColor', v)} {...vprops('favoriteColor')} />
          {(LIFE_STAGE_DEFS.find((ls) => ls.id === form.attribute)?.showSubjectFields ?? true) && (
            <>
              <SelectField label={L('field_favoriteSubject')} value={form.favoriteSubject} onChange={(v) => update('favoriteSubject', v)} options={SUBJECT_OPTIONS} columns={3} {...vprops('favoriteSubject')} />
              <SelectField label={L('field_dislikeSubject')} value={form.dislikeSubject} onChange={(v) => update('dislikeSubject', v)} options={SUBJECT_OPTIONS} columns={3} {...vprops('dislikeSubject')} />
            </>
          )}
          <EditField label={L('field_favoriteCharacter')} value={form.favoriteCharacter} onChange={(v) => update('favoriteCharacter', v)} {...vprops('favoriteCharacter')} />
          <p className="rounded-xl bg-cream/60 px-4 py-2.5 text-[11px] font-bold text-muted">{L('pe_best3_note')}</p>
        </section>
        <section id="pe-about" className="pb-sheet scroll-mt-32 space-y-3 p-5">
          <PrintedHeading no="04" kicker="ABOUT ME" title={L('sec_about')} />
          <EditField label={L('field_specialty')} value={form.specialty} onChange={(v) => update('specialty', v)} {...vprops('specialty')} />
          <EditField label={L('field_holiday')} value={form.holiday} onChange={(v) => update('holiday', v)} {...vprops('holiday')} />
          <EditField label={L('field_wantToGo')} value={form.wantToGo} onChange={(v) => update('wantToGo', v)} {...vprops('wantToGo')} />
          <EditField label={L('field_collection')} value={form.collection} onChange={(v) => update('collection', v)} {...vprops('collection')} />
          <EditField label={L('field_motto')} value={form.motto} onChange={(v) => update('motto', v)} {...vprops('motto')} />
          <EditField label={L('field_charmPoint')} value={form.charmPoint} onChange={(v) => update('charmPoint', v)} {...vprops('charmPoint')} />
          <EditField label={L('field_dream')} value={form.dream} onChange={(v) => update('dream', v)} {...vprops('dream')} />
          <EditField label={L('field_message')} value={form.message} onChange={(v) => update('message', v)} />
        </section>

        {/* ===== ライフステージ／特技・活動の専用項目 ===== */}
        {[LIFE_STAGE_DEFS.find((ls) => ls.id === form.attribute), ACTIVITY_DEFS.find((a) => a.id === form.activity)].map((def) => {
          if (!def || def.fields.length === 0) return null;
          return (
            <section key={def.id} className="pb-sheet space-y-3 p-5">
              <PrintedHeading title={<><span aria-hidden className="mr-1">{def.emoji}</span>{tv(def.sectionTitle, lang)}</>} />
              {def.fields.map((f) =>
                f.type === 'select' && f.options ? (
                  <SelectField key={f.key} label={tv(f.label, lang)} value={localCustomFields[f.key] ?? ''} onChange={(v) => setLocalCustomFields((prev) => ({ ...prev, [f.key]: v }))} options={f.options} />
                ) : (
                  <EditField key={f.key} label={tv(f.label, lang)} value={localCustomFields[f.key] ?? ''} onChange={(v) => setLocalCustomFields((prev) => ({ ...prev, [f.key]: v }))} />
                )
              )}
            </section>
          );
        })}

        {/* ===== 今月のおだい ===== */}
        <section id="pe-monthly" className="pb-memo scroll-mt-32 space-y-4 p-5">
          <div>
            <PrintedHeading no="05" kicker="THIS MONTH" title={`🗓️ ${mInfo.title}`} className="mb-1" />
            <p className="mt-1 text-xs font-bold text-muted">{L('pe_monthly_desc')}</p>
          </div>
          <div className="rounded-lg bg-white/80 p-4">
            {mInfo.events && <p className="text-[11px] font-black text-muted">🍂 {mInfo.events}</p>}
            <p className="mt-1 text-[14px] font-black leading-snug text-ink"><span className="pb-q-no">Q</span>{mInfo.episodeQ}</p>
            <textarea
              value={monthlyEpisodeForm}
              onChange={(e) => { setMonthlyEpisodeForm(e.target.value); growArea(e.target); }}
              ref={growArea}
              rows={2}
              maxLength={300}
              aria-label={mInfo.episodeQ}
              placeholder={L('ph_episode')}
              className="pen-text pb-ruled pb-ruled-rows mt-2 w-full resize-none bg-transparent text-[16px] leading-7 outline-none"
            />
          </div>
          <div className="rounded-lg bg-white/80 p-4">
            <p className="text-[14px] font-black leading-snug text-ink"><span className="pb-q-no">Q</span>{mInfo.best3Q}</p>
            <div className="mt-2">
              <Best3EditBlock title={mInfo.theme} items={monthlyForm} onChange={(next) => setMonthlyForm(next)} hideTitle />
            </div>
          </div>
        </section>

        {/* ===== すきなもの BEST3 ===== */}
        <section id="pe-best3" className="pb-sheet pb-grid scroll-mt-32 space-y-4 p-5">
          <PrintedHeading no="06" kicker="MY BEST 3" title={L('best3_title')} />
          {BEST3_CATEGORIES.map((cat) => (
            <Best3EditBlock
              key={cat.key}
              title={`${cat.emoji} ${L(`best3_${cat.key}`)}`}
              items={best3Form[cat.key] ?? ['', '', '']}
              onChange={(next) => setBest3Form((prev) => ({ ...prev, [cat.key]: next }))}
            />
          ))}
        </section>

        {/* ===== ひとことしつもん：1枚の「質問コーナー」に Q（印刷）と A（手書きの罫線）が続く ===== */}
        <section id="pe-qa" className="pb-sheet scroll-mt-32 p-5">
          <PrintedHeading no="07" kicker="QUESTION CORNER" title={L('sec_qa')} right={<span className="pb-label pb-0.5">{tf('pe_qa_count', lang, { n: questionsForm.length })}</span>} />
          <p className="-mt-1 mb-1 text-[12px] font-bold text-muted">{L('pe_qa_desc')}</p>
          <ol>
            {questionsForm.map((item, index) => {
              const shownQ = displayProfileQuestion(item.q, lang);
              return (
                <li key={index} className="border-b-2 border-dotted border-ink/10 py-3 last:border-b-0">
                  <div className="flex items-start gap-2">
                    <span className="pb-q-no mt-0.5 shrink-0">Q{index + 1}</span>
                    {editingQ === index ? (
                      <input
                        autoFocus
                        value={item.q}
                        onChange={(e) => setQA(index, { q: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter') setEditingQ(null); }}
                        aria-label={tf('pe_qa_q_aria', lang, { n: index + 1 })}
                        placeholder={L('ph_question')}
                        maxLength={60}
                        className="min-w-0 flex-1 border-b-2 border-pink/50 bg-transparent pb-1 text-[14px] font-black text-ink outline-none"
                      />
                    ) : (
                      <p className="min-w-0 flex-1 break-words text-[14px] font-black leading-snug text-ink">{shownQ || <span className="text-muted">{L('ph_question')}</span>}</p>
                    )}
                    {/* 質問の操作：文字を変える／消す（消す前に確認） */}
                    <div className="-mt-1 flex shrink-0 items-center">
                      <button type="button" onClick={() => {
                        if (editingQ === index) { setEditingQ(null); return; }
                        // 公式の質問を書きかえるときは、いま表示されている言語の文から書きはじめる
                        if (shownQ !== item.q) setQA(index, { q: shownQ });
                        setEditingQ(index);
                      }}
                        className="min-h-[36px] px-1.5 text-[12px] font-black text-pinkStrong" aria-label={tf('pe_qa_edit_aria', lang, { n: index + 1 })}>
                        {editingQ === index ? `✓ ${L('btn_done')}` : `✎ ${L('btn_edit')}`}
                      </button>
                      <button type="button" onClick={() => setConfirmDelQ(index)}
                        className="min-h-[36px] px-1.5 text-[12px] font-bold text-muted" aria-label={tf('pe_qa_del_aria', lang, { n: index + 1 })}>
                        🗑
                      </button>
                    </div>
                  </div>
                  {confirmDelQ === index && (
                    <div role="alertdialog" aria-label={L('pe_qa_del_confirm')} className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-[#d9473f]/10 px-3 py-2">
                      <p className="flex-1 text-[12px] font-black text-ink">{L('pe_qa_del_confirm')}</p>
                      <button type="button" onClick={() => setConfirmDelQ(null)} className="min-h-[36px] rounded-md bg-white px-3 text-[12px] font-black text-ink ring-1 ring-ink/15">{L('btn_cancel')}</button>
                      <button type="button" onClick={() => {
                        setQuestionsForm((prev) => prev.filter((_, i) => i !== index));
                        setConfirmDelQ(null);
                        // 消した行より下を編集中なら、番号がひとつ繰り上がる
                        setEditingQ((cur) => (cur === null || cur === index ? null : cur > index ? cur - 1 : cur));
                      }} className="min-h-[36px] rounded-md bg-[#c23a33] px-3 text-[12px] font-black text-white">{L('btn_delete')}</button>
                    </div>
                  )}
                  <div className="mt-1.5 flex gap-1.5">
                    <span aria-hidden className="pb-label shrink-0 pt-1.5">A.</span>
                    <textarea
                      value={item.a}
                      onChange={(e) => { setQA(index, { a: e.target.value }); growArea(e.target); }}
                      ref={growArea}
                      rows={1}
                      maxLength={200}
                      aria-label={tf('pe_qa_a_aria', lang, { n: index + 1 })}
                      placeholder={L('ph_answer')}
                      className="pen-text pb-ruled pb-ruled-rows min-h-[28px] min-w-0 flex-1 resize-none overflow-hidden bg-transparent text-[16px] leading-7 outline-none"
                    />
                  </div>
                </li>
              );
            })}
          </ol>
          <button
            type="button"
            onClick={() => { setQuestionsForm((prev) => [...prev, { q: '', a: '' }]); setEditingQ(questionsForm.length); }}
            className="mt-2 min-h-[44px] w-full rounded-lg border-2 border-dashed border-pink/40 text-[13px] font-black text-pinkStrong active:scale-[0.99]"
          >
            ＋ {L('pe_qa_add')}
          </button>
        </section>

        {/* ===== わたしの字：書体・インク・大きさ（文字プレビューつき。保存ボタンで保存） ===== */}
        <section id="pe-pen" className="pb-sheet scroll-mt-32 space-y-3 p-5">
          <PrintedHeading no="08" kicker="MY PEN" title={L('pe_pen_title')} />
          <p className="-mt-1 text-[12px] font-bold text-muted">{L('pe_pen_desc')}</p>
          <div {...penAttrs(penForm)} style={{ ...penAttrs(penForm).style, ['--pen-base' as any]: '18px' }} className="rounded-xl border-2 border-dashed border-ink/15 bg-white px-4 py-3" aria-live="polite">
            <p className="pb-label">{L('pen_preview')}</p>
            <p className="pen-text pen-size mt-1 break-words leading-relaxed">{form.nickname || form.name || L('field_name')}</p>
            <p className="pen-text mt-0.5 break-words text-[15px] leading-relaxed">{form.message || L('pen_preview_sample')}</p>
          </div>
          <PenFontPicker pen={penForm} lang={lang} onChange={(p) => { penTouched.current = true; setPenForm(p); }} />
          <div className="pt-1"><PenInkPicker pen={penForm} lang={lang} onChange={(p) => { penTouched.current = true; setPenForm(p); }} /></div>
        </section>

        {/* ===== きせかえ：小さなプロフ帳の表紙で選ぶ（テーマIDと適用ロジックは従来どおり） ===== */}
        <section id="pe-theme" className="pb-sheet scroll-mt-32 p-5">
          <PrintedHeading no="09" kicker="DRESS UP" title={L('pe_theme_title')} />
          <p className="-mt-1 mb-3 text-[12px] font-bold text-muted">{L('pe_theme_desc')}</p>
          <div className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-8">
            {APP_THEMES.map((th) => {
              const on = appTheme === th.id;
              return (
                <button key={th.id} type="button" onClick={() => onChangeTheme(th.id)} aria-pressed={on}
                  className="group flex flex-col items-center gap-1 text-center">
                  <MiniBookCover themeId={th.id} emoji={th.emoji} selected={on} />
                  <span className={`block w-full line-clamp-2 break-words text-[11px] leading-tight ${on ? 'font-black text-ink' : 'font-bold text-ink/75'}`}>{L(`theme_${th.id}`)}</span>
                </button>
              );
            })}
          </div>

          {/* 手に入れた背景（ガチャ・ショップ）も同じ「表紙」で着せ替え */}
          <div className="mt-5 border-t-2 border-dotted border-ink/10 pt-4">
            <p className="pb-label pb-label-md">🖼 {L('pe_owned_bg_title')}</p>
            <p className="mb-3 mt-0.5 text-[11px] font-bold text-muted">{L('pe_owned_bg_desc')}</p>
            {(() => {
              const ownedThemes = [
                ...BG_THEMES.filter((bg) => ownedBgIds.includes(bg.id)),
                ...COLOR_THEMES.filter((bg) => ownedThemeIds.includes(bg.id)),
              ];
              if (ownedThemes.length === 0) {
                return (
                  <button type="button" onClick={() => go('shop')}
                    className="min-h-[44px] w-full rounded-lg border-2 border-dashed border-pink/30 px-3 text-xs font-black text-pinkStrong hover:bg-pink/5">
                    {L('pe_owned_bg_empty')} →
                  </button>
                );
              }
              return (
                <div className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-8">
                  <button type="button" onClick={() => onEquipBg(null)} aria-pressed={!equippedBgId} className="flex flex-col items-center gap-1">
                    <MiniBookCover themeId="default" emoji="📔" selected={!equippedBgId} plain />
                    <span className="block w-full line-clamp-2 break-words text-[11px] font-bold leading-tight text-ink/80">{L('pe_bg_none')}</span>
                  </button>
                  {ownedThemes.map((bg) => {
                    const equipped = equippedBgId === bg.id;
                    return (
                      <button key={bg.id} type="button" onClick={() => onEquipBg(equipped ? null : bg.id)} aria-pressed={equipped} className="flex flex-col items-center gap-1">
                        <MiniBookCover themeId="default" emoji={bg.emoji} selected={equipped} scene={bg} />
                        <span className="block w-full line-clamp-2 break-words text-[11px] font-bold leading-tight text-ink/80">{tv(bg.name, lang)}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </section>

        {/* ===== プレミアム設定（公認ユーザーのみ） ===== */}
        {me.isOfficial && (
          <section className="space-y-4 rounded-[24px] border-2 border-amber-100 bg-white p-5 shadow-card">
            <div>
              <p className="text-base font-black text-ink">✨ {L('pe_premium_title')}</p>
              <p className="mt-1 text-xs font-bold text-muted">{L('pe_premium_desc')}</p>
            </div>
            <EditField label={L('pe_premium_intro')} value={premiumForm.description} onChange={(v) => setPremiumForm((p) => ({ ...p, description: v }))} />
            <div className="flex items-center gap-3">
              <label className="shrink-0 text-xs font-bold text-muted">{L('pe_premium_price')}</label>
              <input type="number" min={0} value={premiumForm.price}
                onChange={(e) => setPremiumForm((p) => ({ ...p, price: Number(e.target.value) || 480 }))}
                className="w-full rounded-2xl border border-amber-200 bg-amber-50/40 px-4 py-2 text-sm font-bold outline-none focus:border-amber-400" />
            </div>
            <div>
              <p className="mb-2 text-sm font-black text-ink">{L('pe_premium_qa')}</p>
              {premiumForm.questions.map((item, i) => (
                <div key={i} className="mb-3 space-y-2 rounded-2xl bg-amber-50 p-4">
                  <EditField label={`Q${i + 1}`} value={item.q} onChange={(v) => {
                    const next = [...premiumForm.questions]; next[i] = { ...next[i], q: v }; setPremiumForm((p) => ({ ...p, questions: next }));
                  }} />
                  <EditField label={`A${i + 1}`} value={item.a} onChange={(v) => {
                    const next = [...premiumForm.questions]; next[i] = { ...next[i], a: v }; setPremiumForm((p) => ({ ...p, questions: next }));
                  }} />
                  <button type="button" onClick={() => setPremiumForm((p) => ({ ...p, questions: p.questions.filter((_, j) => j !== i) }))}
                    className="text-xs font-black text-pink">{L('btn_delete')}</button>
                </div>
              ))}
              <button type="button" onClick={() => setPremiumForm((p) => ({ ...p, questions: [...p.questions, { q: '', a: '' }] }))}
                className="w-full rounded-2xl border border-dashed border-amber-300 bg-amber-50 py-3 text-sm font-black text-amber-700 active:scale-[0.99]">
                ＋ {L('pe_qa_add')}
              </button>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-muted">{L('pe_premium_note')}</label>
              <textarea value={premiumForm.note} onChange={(e) => setPremiumForm((p) => ({ ...p, note: e.target.value }))} rows={3} maxLength={300}
                className="w-full resize-none rounded-3xl border border-amber-200 bg-amber-50/40 p-4 text-sm font-bold outline-none focus:border-amber-400 leading-6"
                placeholder={L('ph_premium_note')} />
            </div>
          </section>
        )}

        <button onClick={saveAll} className="min-h-[56px] w-full rounded-[20px] bg-pink px-5 py-4 text-base font-black text-white shadow-card active:scale-[0.99]">
          {L('btn_save_reflect')}
        </button>

        {/* ===== せってい（すぐ反映される項目） ===== */}
        <div id="pe-settings" className="scroll-mt-32 space-y-4 pt-2">
          <PrintedHeading no="10" kicker="SETTINGS" title={L('idx_settings')} />
          {/* 通知 */}
          <section className="pb-sheet p-5">
            <p className="mb-1 text-base font-black text-ink">🔔 {L('pe_notify_title')}</p>
            <p className="mb-4 text-xs font-bold text-muted">{L('pe_notify_desc')}</p>
            <button type="button" role="switch" aria-checked={notifyOdai} onClick={() => onToggleNotifyOdai(!notifyOdai)}
              className="flex w-full items-center justify-between gap-3 rounded-2xl bg-base px-4 py-3.5 text-left">
              <span>
                <span className="block text-sm font-black text-ink">{L('pe_notify_daily')}</span>
                <span className="block text-xs font-bold text-muted">{L('pe_notify_daily_desc')}</span>
              </span>
              <span aria-hidden className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${notifyOdai ? 'bg-pink' : 'bg-zinc-300'}`}>
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${notifyOdai ? 'translate-x-6' : 'translate-x-1'}`} />
              </span>
            </button>
            {notifyOdai && <p className="mt-2 text-center text-[11px] font-bold text-pinkStrong">✓ {L('pe_notify_on')}</p>}
          </section>
          {/* シェア */}
          <section className="pb-sheet p-5">
            <p className="mb-1 text-base font-black text-ink">📤 {L('pe_share_title')}</p>
            <p className="mb-4 text-xs font-bold text-muted">{L('pe_share_desc')}</p>
            <button onClick={() => setShowShare(true)}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-pink to-purple py-3.5 text-sm font-black text-white shadow-card active:scale-[0.98]">
              <Share2 size={16} />{L('pe_share_btn')}
            </button>
          </section>
          {/* ご意見・不具合 */}
          <section className="pb-sheet p-5">
            <p className="mb-1 text-base font-black text-ink">💬 {L('pe_feedback_title')}</p>
            <p className="mb-4 text-xs font-bold text-muted">{L('pe_feedback_desc')}</p>
            <button type="button" onClick={() => setShowFeedback(true)}
              className="min-h-[48px] w-full rounded-2xl bg-blue-500 px-5 py-3.5 text-sm font-black text-white shadow-card active:scale-[0.98]">
              {L('pe_feedback_btn')}
            </button>
          </section>
          <button type="button" onClick={onLogout}
            className="min-h-[52px] w-full rounded-[20px] border-2 border-red-200 bg-white px-5 py-4 text-base font-black text-red-600 active:scale-[0.99]">
            {L('btn_logout')}
          </button>
        </div>
      </div>

      {/* ID・表示名の変更ページへ移る前の確認 */}
      {confirmIdPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-6" onClick={() => setConfirmIdPage(false)}>
          <div role="dialog" aria-modal="true" aria-label={L('pe_id_confirm_title')} className="w-full max-w-xs rounded-[24px] bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-center text-sm font-black text-ink">{L('pe_id_confirm_title')}</p>
            <p className="mt-2 text-center text-[12px] font-bold leading-relaxed text-muted">{L('pe_id_confirm_desc')}</p>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setConfirmIdPage(false)} className="min-h-[44px] flex-1 rounded-full border border-ink/15 text-sm font-black text-ink">{L('btn_cancel')}</button>
              <button type="button" onClick={() => { window.location.href = '/setup'; }} className="min-h-[44px] flex-1 rounded-full bg-pink text-sm font-black text-white">{L('btn_go')}</button>
            </div>
          </div>
        </div>
      )}
      {showShare && (
        <ProfileShareModal
          userId={me.id}
          avatar={me.avatar}
          avatarUrl={localAvatarUrl || undefined}
          info={form}
          lang={lang}
          onClose={() => setShowShare(false)}
        />
      )}
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
    </EditLangContext.Provider>
  );
}

// ── フィードバック投稿モーダル（テスター用の窓口） ───────────────
function FeedbackModal({ onClose }: { onClose: () => void }) {
  const lang = useLang();
  const [kind, setKind] = useState<'bug' | 'request' | 'question'>('bug');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);
  const KINDS: { key: 'bug' | 'request' | 'question'; label: string }[] = [
    { key: 'bug', label: `🐛 ${t('fb_bug', lang)}` },
    { key: 'request', label: `✨ ${t('fb_request', lang)}` },
    { key: 'question', label: `❓ ${t('fb_question', lang)}` },
  ];
  async function send() {
    if (sending || !body.trim()) return;
    setSending(true); setError(false);
    const ok = await submitFeedback(kind, body);
    setSending(false);
    if (ok) { setDone(true); setTimeout(onClose, 1400); }
    else setError(true);
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-h-[92vh] overflow-y-auto rounded-t-[32px] bg-white pb-10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-pink/30" />
        <div className="flex items-center justify-between px-5 py-4">
          <p className="text-base font-black text-ink">💬 {t('pe_feedback_btn', lang)}</p>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-base text-muted">✕</button>
        </div>
        {done ? (
          <div className="px-6 py-10 text-center">
            <p className="text-3xl">🙏</p>
            <p className="mt-3 text-sm font-black text-ink">{t('fb_sent', lang)}</p>
          </div>
        ) : (
          <div className="space-y-4 px-5">
            <div className="flex gap-2">
              {KINDS.map((k) => (
                <button key={k.key} type="button" onClick={() => setKind(k.key)}
                  className={`flex-1 rounded-full py-2.5 text-xs font-black transition ${kind === k.key ? 'bg-pink text-white shadow-card' : 'bg-base text-muted'}`}>
                  {k.label}
                </button>
              ))}
            </div>
            <textarea
              value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} rows={6}
              placeholder={t('fb_ph', lang)}
              className="w-full rounded-2xl border-2 border-purple/15 bg-white px-4 py-3 text-sm font-bold text-ink outline-none focus:border-pink"
            />
            {error && <p className="text-center text-xs font-black text-red-500">{t('fb_error', lang)}</p>}
            <button onClick={send} disabled={!body.trim() || sending}
              className="flex h-13 w-full items-center justify-center gap-2 rounded-full bg-pink py-3.5 text-sm font-black text-white shadow-floating disabled:opacity-40 active:scale-[0.98]">
              {sending ? t('fb_sending', lang) : t('btn_send', lang)}
            </button>
            <p className="text-center text-[11px] font-bold text-muted">※ {t('fb_note', lang)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
// ── Canvas roundRect ポリフィル ──────────────────────────────
function canvasRoundRect(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function truncateStr(str: string, max: number) {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

// ── 共有カード（A〜D）用の描画ヘルパー ───────────────────────
// 平成プロフ帳っぽい世界観：ノート罫線・マスキングテープ・手書き風フォント・手描き飾り。
const CARD_HAND = '"Klee One", "Zen Kurenaido", "Hiragino Maru Gothic ProN", sans-serif';
const CARD_INK = '#2B2E4A';
const CARD_MUTED = '#8A93AD';
const CARD_PURPLE = '#A88FE0';
const CARD_BLUE = '#8FB0E8';

export type ShareCardType = 'A' | 'B' | 'C' | 'D';
type ShareCardData = {
  name: string; id: string; avatar: string;
  avatarImg?: HTMLImageElement; qrEl?: HTMLImageElement;
  fields: { label: string; value: string }[]; // 埋まっている項目
  hookLabel: string; // B/D の設問に使う項目ラベル（例：好きな食べ物）
  raw: Record<string, string>; // 言語非依存で値を引く用（Aカードなど）
};

// A カードの値引き（キー→表示値）。言語に依存せず raw から取り出す。
function cvVal(d: ShareCardData, key: string): string { return (d.raw?.[key] ?? '').trim(); }

function cardSparkle(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = Math.max(2, s * 0.12);
  ctx.beginPath();
  ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x + s * 0.18, y - s * 0.18, x + s, y);
  ctx.quadraticCurveTo(x + s * 0.18, y + s * 0.18, x, y + s);
  ctx.quadraticCurveTo(x - s * 0.18, y + s * 0.18, x - s, y);
  ctx.quadraticCurveTo(x - s * 0.18, y - s * 0.18, x, y - s);
  ctx.fill(); ctx.restore();
}
function cardHeart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, s * 0.18);
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.7);
  ctx.bezierCurveTo(x - s, y - s * 0.2, x - s * 0.5, y - s, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.5, y - s, x + s, y - s * 0.2, x, y + s * 0.7);
  ctx.stroke(); ctx.restore();
}
function cardStar(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, s * 0.16); ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const px = x + Math.cos(a) * s, py = y + Math.sin(a) * s;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    const a2 = a + Math.PI / 5;
    ctx.lineTo(x + Math.cos(a2) * s * 0.45, y + Math.sin(a2) * s * 0.45);
  }
  ctx.closePath(); ctx.stroke(); ctx.restore();
}
function cardWashi(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, angle: number, color: string) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.globalAlpha = 0.7; ctx.fillStyle = color; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.globalAlpha = 0.9; ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = -w / 2 + 8; i < w / 2; i += 16) ctx.fillRect(i, -h / 2 + 2, 3, h - 4);
  ctx.restore();
}
// 手書き風の下線（少し波打つ）
function cardUnderline(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number, color: string, lw = 5) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y);
  const seg = (x2 - x1) / 4;
  for (let i = 1; i <= 4; i++) ctx.quadraticCurveTo(x1 + seg * (i - 0.5), y + (i % 2 ? 4 : -4), x1 + seg * i, y);
  ctx.stroke(); ctx.restore();
}
function cardCheckbox(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  canvasRoundRect(ctx, x, y, s, s, 5); ctx.stroke(); ctx.restore();
}

// ノート紙のベース（全カード共通）
// ============================================================
//  共有カード（A〜D）：縦長 Instagramストーリー比率 1080×1920。
//  参考テンプレ準拠：淡いラベンダー/ブルー、リング綴じ、点線の記入欄、
//  ♡/☆の飾り、QRで答え合わせ。B/C/D は本人の答えを伏せる。
// ============================================================
const CV_PINK = '#EE9EC7';
const CV_BLUE = '#8FB0E8';
const CV_PURP = '#A892E0';
const CV_INK = '#4B4F86';
const CV_MUTE = '#9AA0C8';
const CV_LINE = 'rgba(150,158,205,0.5)';

function cvDot(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number) {
  ctx.save(); ctx.strokeStyle = CV_LINE; ctx.lineWidth = 3; ctx.setLineDash([2, 9]); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke(); ctx.restore();
}
// タイトルのリボン風バナー
function cvBanner(ctx: CanvasRenderingContext2D, cx: number, y: number, text: string, size: number, color: string) {
  ctx.save(); ctx.font = `700 ${size}px ${CARD_HAND}`;
  const w = ctx.measureText(text).width + 90;
  ctx.translate(cx, y);
  ctx.fillStyle = color; ctx.globalAlpha = 0.92;
  canvasRoundRect(ctx, -w / 2, -size * 0.8, w, size * 1.6, size * 0.8); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-w / 2, -size * 0.8); ctx.lineTo(-w / 2 - 24, 0); ctx.lineTo(-w / 2, size * 0.8); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(w / 2, -size * 0.8); ctx.lineTo(w / 2 + 24, 0); ctx.lineTo(w / 2, size * 0.8); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 2);
  ctx.restore(); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}
// 白の角丸ボックス＋小見出しタブ
function cvBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, title: string, color: string) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  canvasRoundRect(ctx, x, y, w, h, 24); ctx.fill();
  ctx.strokeStyle = 'rgba(150,158,205,0.32)'; ctx.lineWidth = 2;
  canvasRoundRect(ctx, x, y, w, h, 24); ctx.stroke();
  if (title) {
    ctx.font = `700 28px ${CARD_HAND}`;
    const tw = ctx.measureText(title).width + 40;
    ctx.fillStyle = color; ctx.globalAlpha = 0.92;
    canvasRoundRect(ctx, x + 24, y - 20, tw, 40, 20); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(title, x + 24 + tw / 2, y);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();
}
// ラベル＋点線欄（value があれば手書きで載せる／無ければ空欄で伏せる）
function cvField(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, label: string, value: string, accent: string) {
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = accent; ctx.font = `700 29px ${CARD_HAND}`;
  ctx.fillText('♡ ' + label, x, y);
  const lx = x + Math.min(ctx.measureText('♡ ' + label).width + 24, w * 0.6);
  cvDot(ctx, lx, x + w, y + 4);
  if (value) { ctx.fillStyle = CV_INK; ctx.font = `600 29px ${CARD_HAND}`; ctx.fillText(truncateStr(value, 15), lx + 8, y - 2); }
}
function cvScatter(ctx: CanvasRenderingContext2D, W: number, H: number) {
  cardSparkle(ctx, W - 74, 96, 16, CV_PURP);
  cardHeart(ctx, 116, 130, 16, CV_PINK);
  cardStar(ctx, W - 96, H - 130, 18, CV_BLUE);
  cardHeart(ctx, W - 70, Math.round(H * 0.5), 14, CV_PINK);
  cardStar(ctx, 108, Math.round(H * 0.64), 14, CV_PURP);
  cardSparkle(ctx, W - 120, Math.round(H * 0.3), 12, CV_BLUE);
}

// リング綴じのノート地（全カード共通・縦長）
function drawCardBase(ctx: CanvasRenderingContext2D, W: number, H: number, _tapeColor: string) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#ECEAF9'); g.addColorStop(0.5, '#EAF0FB'); g.addColorStop(1, '#F2EAFB');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const holeX = 58;
  const n = 20;
  for (let i = 0; i < n; i++) {
    const hy = 74 + i * ((H - 148) / (n - 1));
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.beginPath(); ctx.arc(holeX, hy, 15, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(150,158,205,0.5)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(holeX, hy, 22, Math.PI * 0.18, Math.PI * 1.12); ctx.stroke();
  }
  cvScatter(ctx, W, H);
}

// アイコン円（点線枠）
function drawCardAvatar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, d: ShareCardData) {
  ctx.save();
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, '#EAF0FF'); g.addColorStop(1, '#EFE6FB');
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
  ctx.setLineDash([4, 8]); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(150,158,205,0.7)';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  if (d.avatarImg) {
    ctx.beginPath(); ctx.arc(cx, cy, r - 4, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(d.avatarImg, cx - r, cy - r, r * 2, r * 2);
  } else {
    const glyph = (d.avatar && d.avatar.trim()) ? d.avatar : (d.name?.trim()?.[0] || '🙂');
    ctx.fillStyle = '#8478BE'; ctx.font = `${Math.round(r * 1.0)}px "Klee One", serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(glyph, cx, cy + 2);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  }
  ctx.restore();
}

// 右下などの大きなQRパネル（テープ枠＋ラベル）
function drawCardQr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, d: ShareCardData, tapeLabel: string, tapeColor: string, sub?: string) {
  ctx.save();
  ctx.fillStyle = '#ffffff'; canvasRoundRect(ctx, x, y, w, h, 28); ctx.fill();
  ctx.setLineDash([9, 8]); ctx.strokeStyle = 'rgba(150,158,205,0.7)'; ctx.lineWidth = 3;
  canvasRoundRect(ctx, x + 12, y + 12, w - 24, h - 24, 20); ctx.stroke(); ctx.setLineDash([]);
  if (d.qrEl) { const q = Math.min(w, h) - 110; ctx.drawImage(d.qrEl, x + (w - q) / 2, y + 36, q, q); }
  ctx.restore();
  cardWashi(ctx, x + w / 2, y + h - 34, 210, 52, 0, tapeColor);
  ctx.fillStyle = CV_INK; ctx.font = `700 30px ${CARD_HAND}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(tapeLabel, x + w / 2, y + h - 34);
  if (sub) { ctx.fillStyle = CV_MUTE; ctx.font = `700 24px ${CARD_HAND}`; ctx.fillText(sub, x + w / 2, y + h + 22); }
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

// フッター（Miri／#Miriプロフィール）
function drawCardLogo(ctx: CanvasRenderingContext2D, cx: number, y: number, text: string) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = CV_BLUE; ctx.font = `700 30px ${CARD_HAND}`;
  ctx.fillText(text, cx, y);
  ctx.restore(); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

// ── A：プロフィールカード（本人の情報を見せる） ──
function drawShareCardA(ctx: CanvasRenderingContext2D, W: number, H: number, d: ShareCardData) {
  drawCardBase(ctx, W, H, '');
  const L = 100, R = W - 60, CW = R - L;
  cvBanner(ctx, W / 2, 150, 'Miri PROFILE CARD', 52, CV_PURP);
  ctx.fillStyle = CV_MUTE; ctx.font = `700 26px ${CARD_HAND}`; ctx.textAlign = 'center';
  ctx.fillText('よろしくおねがいします♡', W / 2, 210); ctx.textAlign = 'left';
  // アイコン＋名前/ID/ひとこと
  drawCardAvatar(ctx, L + 130, 400, 128, d);
  const tx = L + 300;
  cvField(ctx, tx, 330, R - tx, 'なまえ', d.name, CV_PINK);
  cvField(ctx, tx, 410, R - tx, '@ID', d.id, CV_BLUE);
  const f = (k: string) => cvVal(d, k.replace('field_', ''));
  cvField(ctx, tx, 490, R - tx, 'ひとこと', '', CV_PURP);
  // 基本情報ボックス
  cvBox(ctx, L, 600, CW, 130, '基本のわたし', CV_BLUE);
  cvField(ctx, L + 40, 665, (CW - 80) / 2 - 20, '誕生日', f('field_birthday'), CV_PINK);
  cvField(ctx, L + 40 + (CW - 80) / 2 + 20, 665, (CW - 80) / 2 - 20, 'MBTI', f('field_mbti'), CV_PURP);
  cvField(ctx, L + 40, 715, CW - 80, '住んでいるところ', f('field_hometown'), CV_BLUE);
  // 好きなもの
  cvBox(ctx, L, 790, CW, 300, '好きなもの', CV_PINK);
  const cw2 = (CW - 80) / 2;
  const favs: [string, string][] = [
    ['好きな食べもの', f('field_favoriteFood')], ['好きな色', f('field_favoriteColor')],
    ['アーティスト・曲', f('field_favoriteMusic') || f('field_favoriteArtist')], ['キャラ・モノ', f('field_favoriteCharacter')],
    ['好きなTV・映画', f('field_favoriteTv')], ['マンガ・本', f('field_favoriteManga')],
  ];
  favs.forEach(([lab, val], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    cvField(ctx, L + 40 + col * (cw2 + 20), 860 + row * 72, cw2, lab, val, col === 0 ? CV_PINK : CV_PURP);
  });
  // 最近ハマってること
  cvBox(ctx, L, 1150, CW, 150, '最近ハマってること', CV_BLUE);
  ctx.fillStyle = CV_INK; ctx.font = `600 30px ${CARD_HAND}`;
  ctx.fillText(truncateStr(f('field_hobby') || '　', 26), L + 44, 1225);
  cvDot(ctx, L + 44, R - 44, 1235);
  cvDot(ctx, L + 44, R - 44, 1285);
  // QR
  drawCardQr(ctx, W / 2 - 210, 1380, 420, 420, d, 'Miriでチェック！', '#C9B8EC', 'QRコードをスキャン');
  drawCardLogo(ctx, W / 2, H - 70, 'ここまで見てくれてありがとう♡ 仲良くしてね');
}

// ── B：意外と知らない（質問だけ見せて答えは伏せる） ──
function drawShareCardB(ctx: CanvasRenderingContext2D, W: number, H: number, d: ShareCardData) {
  drawCardBase(ctx, W, H, '');
  const L = 100, R = W - 60, CW = R - L;
  ctx.textAlign = 'center';
  ctx.fillStyle = CV_INK; ctx.font = `700 66px ${CARD_HAND}`;
  ctx.fillText('親友なのに、', W / 2, 175);
  ctx.fillStyle = CV_PINK; ctx.fillText('意外と知らない。', W / 2, 255);
  ctx.fillStyle = CV_MUTE; ctx.font = `700 28px ${CARD_HAND}`;
  ctx.fillText('もっと知ってほしい、私のこと。', W / 2, 310); ctx.textAlign = 'left';
  // アイコン＋なまえ/ニックネーム
  drawCardAvatar(ctx, L + 110, 470, 100, d);
  cvField(ctx, L + 250, 420, R - (L + 250), 'なまえ', d.name, CV_PINK);
  cvField(ctx, L + 250, 490, R - (L + 250), 'ニックネーム', cvVal(d, 'nickname'), CV_BLUE);
  cvField(ctx, L + 250, 560, R - (L + 250), '@ID', d.id, CV_PURP);
  // 意外と知らない10のこと
  cvBox(ctx, L, 650, CW, 720, '意外と知らない10のこと', CV_PURP);
  const qs = ['初対面の印象は？', '実は◯◯なんです', '苦手なもの・こと', '好きな食べ物', '朝型・夜型',
    '最近よく考えてること', 'ちょっとした弱点', '自分のトリセツ', '周りからよく言われること', '意外な特技・自慢できること'];
  qs.forEach((q, i) => {
    const y = 720 + i * 63;
    ctx.fillStyle = CV_PINK; ctx.font = `700 30px ${CARD_HAND}`; ctx.textAlign = 'center';
    ctx.beginPath(); ctx.arc(L + 56, y - 9, 20, 0, Math.PI * 2); ctx.fillStyle = 'rgba(238,158,199,0.2)'; ctx.fill();
    ctx.fillStyle = CV_PINK; ctx.fillText(String(i + 1), L + 56, y - 8); ctx.textAlign = 'left';
    ctx.fillStyle = CV_INK; ctx.font = `600 30px ${CARD_HAND}`; ctx.fillText(q, L + 92, y);
  });
  drawCardQr(ctx, W / 2 - 190, 1430, 380, 380, d, '答えはMiriで', '#C9B8EC', 'QRで答え合わせ♡');
  drawCardLogo(ctx, W / 2, H - 66, 'これを読めばMiriのことまるわかり！?');
}

// ── C：一致率診断（二択。本人の答えは伏せる） ──
function drawShareCardC(ctx: CanvasRenderingContext2D, W: number, H: number, d: ShareCardData) {
  drawCardBase(ctx, W, H, '');
  const L = 100, R = W - 60;
  ctx.textAlign = 'center';
  ctx.fillStyle = CV_MUTE; ctx.font = `700 28px ${CARD_HAND}`; ctx.fillText('私との一致率、何％？', W / 2, 132);
  cvBanner(ctx, W / 2, 198, '一致率しんだん', 50, CV_BLUE);
  ctx.fillStyle = CV_INK; ctx.font = `700 32px ${CARD_HAND}`; ctx.fillText('あなたと私、どっちが近い？', W / 2, 272);
  ctx.fillStyle = CV_MUTE; ctx.font = `700 23px ${CARD_HAND}`; ctx.fillText('あなたはどっち？予想してね！', W / 2, 308); ctx.textAlign = 'left';
  const pairs: [string, string, string][] = [
    ['朝・夜', '朝型', '夜型'], ['どっち？', '犬派', '猫派'], ['自然', '海', '山'],
    ['休日', 'インドア', 'アウトドア'], ['味', '辛いもの', '甘いもの'], ['旅行', '計画派', 'ノープラン'],
    ['連絡', 'マメ', '気まぐれ'], ['音楽', 'J-POP', '洋楽・ロック'], ['SNS', 'よく投稿', '見る専門'],
    ['性格', 'わいわい', 'まったり'],
  ];
  const rowH = 50, step = 82, y0 = 356;
  pairs.forEach((p, i) => {
    const y = y0 + i * step;
    ctx.fillStyle = CV_PURP; ctx.globalAlpha = 0.9; canvasRoundRect(ctx, L, y, 128, rowH, 15); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff'; ctx.font = `700 22px ${CARD_HAND}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(p[0], L + 64, y + rowH / 2);
    ctx.fillStyle = 'rgba(143,176,232,0.16)'; canvasRoundRect(ctx, L + 142, y, 300, rowH, 15); ctx.fill();
    ctx.fillStyle = CV_BLUE; ctx.font = `700 28px ${CARD_HAND}`; ctx.fillText(p[1], L + 142 + 150, y + rowH / 2);
    ctx.fillStyle = CV_PINK; ctx.font = `700 24px ${CARD_HAND}`; ctx.fillText('or', W / 2 + 32, y + rowH / 2);
    ctx.fillStyle = 'rgba(238,158,199,0.16)'; canvasRoundRect(ctx, R - 300, y, 300, rowH, 15); ctx.fill();
    ctx.fillStyle = CV_PINK; ctx.font = `700 28px ${CARD_HAND}`; ctx.fillText(p[2], R - 150, y + rowH / 2);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  });
  const rowsBottom = y0 + (pairs.length - 1) * step + rowH;
  ctx.textAlign = 'center';
  ctx.fillStyle = CV_INK; ctx.font = `700 30px ${CARD_HAND}`;
  ctx.fillText('QRを読み取って、一致率を診断！', W / 2, rowsBottom + 66);
  ctx.fillStyle = CV_MUTE; ctx.font = `700 22px ${CARD_HAND}`;
  ctx.fillText('同じ質問にあなたも答えると、Miriが一致率を出すよ♡', W / 2, rowsBottom + 106); ctx.textAlign = 'left';
  const qy = rowsBottom + 148;
  drawCardQr(ctx, W / 2 - 190, qy, 380, 380, d, 'QRで診断', '#AEC4EE', '#Miriプロフィール');
  drawCardLogo(ctx, W / 2, qy + 380 + 62, 'つながる、ひろがる。Miri');
}

// ── D：穴埋め（本人が答えた項目だけ出題。答えは伏せる） ──
function drawShareCardD(ctx: CanvasRenderingContext2D, W: number, H: number, d: ShareCardData) {
  drawCardBase(ctx, W, H, '');
  const L = 100, R = W - 60, CW = R - L;
  cvBanner(ctx, W / 2, 150, '穴埋めプロフィール', 50, CV_PURP);
  ctx.textAlign = 'center';
  ctx.fillStyle = CV_BLUE; ctx.font = `700 32px ${CARD_HAND}`; ctx.fillText('予想してみて！', W / 2, 215);
  ctx.fillStyle = CV_MUTE; ctx.font = `700 26px ${CARD_HAND}`; ctx.fillText('わたしのこと、どれくらい知ってる？', W / 2, 258); ctx.textAlign = 'left';
  drawCardAvatar(ctx, L + 110, 400, 100, d);
  const bx = L + 250, bw = R - bx;
  cvField(ctx, bx, 370, bw, 'なまえ', '', CV_PINK);
  const basics = ([['birthday', '誕生日'], ['mbti', 'MBTI'], ['hometown', '出身']] as [string, string][]).filter(([k]) => cvVal(d, k));
  basics.slice(0, 2).forEach(([, lab], i) => {
    cvField(ctx, bx + (i % 2) * (bw / 2 + 10), 445, bw / 2 - 10, lab, '', i % 2 ? CV_PURP : CV_BLUE);
  });
  const dPrompts: [string, string][] = [
    ['favoriteFood', '私の好きな食べ物は'], ['hobby', '趣味は'], ['dream', '将来の夢は'],
    ['favoriteMusic', '好きな音楽は'], ['favoriteArtist', '好きなアーティストは'],
    ['favoriteCharacter', '好きなキャラは'], ['favoriteColor', '好きな色は'],
    ['charmPoint', 'チャームポイントは'], ['specialty', '得意なことは'], ['personality', '性格は'],
    ['dislikeFood', '苦手な食べ物は'], ['favoriteTv', '好きなTV・映画は'],
    ['favoriteManga', '好きなマンガ・本は'], ['favoriteGame', '好きなゲームは'],
  ];
  const qs = dPrompts.filter(([k]) => cvVal(d, k)).map(([, p]) => p).slice(0, 10);
  const boxTop = 590, rowH2 = 62;
  if (qs.length === 0) {
    cvBox(ctx, L, boxTop, CW, 200, '穴埋めチャレンジ！ Q&A', CV_PINK);
    ctx.fillStyle = CV_MUTE; ctx.font = `700 26px ${CARD_HAND}`; ctx.textAlign = 'center';
    ctx.fillText('プロフィールを埋めると穴埋めが作られます♪', W / 2, boxTop + 110); ctx.textAlign = 'left';
    drawCardQr(ctx, W / 2 - 180, boxTop + 250, 360, 360, d, '答えを見る', '#AEC4EE', 'つづきはMiriで👀');
    drawCardLogo(ctx, W / 2, boxTop + 250 + 360 + 56, 'つながる、ひろがる。Miri');
    return;
  }
  const boxH = qs.length * rowH2 + 80;
  cvBox(ctx, L, boxTop, CW, boxH, '穴埋めチャレンジ！ Q&A', CV_PINK);
  qs.forEach((q, i) => {
    const y = boxTop + 66 + i * rowH2;
    ctx.fillStyle = 'rgba(238,158,199,0.2)'; ctx.beginPath(); ctx.arc(L + 54, y - 9, 19, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = CV_PINK; ctx.font = `700 26px ${CARD_HAND}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(String(i + 1), L + 54, y - 1); ctx.textAlign = 'left';
    ctx.fillStyle = CV_INK; ctx.font = `600 27px ${CARD_HAND}`; ctx.fillText(q, L + 86, y);
    const lx = L + 86 + ctx.measureText(q).width + 16;
    cvDot(ctx, lx, R - 40, y + 4);
  });
  const qy = boxTop + boxH + 46;
  drawCardQr(ctx, W / 2 - 180, qy, 360, 360, d, '答えを見る', '#AEC4EE', 'つづきはMiriで👀');
  drawCardLogo(ctx, W / 2, qy + 360 + 56, 'つながる、ひろがる。Miri');
}

// ── プロフィールシェアモーダル ───────────────────────────────
function ProfileShareModal({
  userId, avatar, avatarUrl, info, lang = 'ja', onClose,
}: {
  userId: string;
  avatar: string;
  avatarUrl?: string;
  info: typeof defaultProfileBookInfo;
  lang?: Lang;
  onClose: () => void;
}) {
  const name = info.name;
  const [tab, setTab] = useState<'qr' | 'image'>('qr');
  const [cardType, setCardType] = useState<ShareCardType>('A');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [imageGenerated, setImageGenerated] = useState(false);
  const [snsHint, setSnsHint] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qrIncludedRef = useRef(false);
  const pendingImageShareRef = useRef<SharePlatform | null>(null);
  // QR・共有リンクは「その人のプロフィールページ」を指す（アプリ入口ではなく本人のプロフへ）
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://miriapp.vercel.app';
  const shareUrl = `${origin}/${userId.replace(/^@/, '')}`;
  const shareText = buildShareText(name, lang);
  const snsTargets = getShareTargets(lang);

  // canvas は tab='image' になった後レンダリングされるので useEffect で生成する
  useEffect(() => {
    if (tab === 'image' && !imageGenerated) {
      handleGenerateImage();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // カードタイプ（A〜D）を切り替えたら作り直す
  useEffect(() => {
    if (tab === 'image') handleGenerateImage();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardType]);

  // QRコード生成
  useEffect(() => {
    import('qrcode').then(({ default: QRCode }) => {
      QRCode.toDataURL(shareUrl, {
        width: 512,
        margin: 2,
        color: { dark: '#1a1a2e', light: '#ffffff' },
      }).then(setQrDataUrl);
    });
  }, [shareUrl]);

  // QR生成が画像タブより遅れた場合に再描画
  useEffect(() => {
    if (qrDataUrl && !qrIncludedRef.current && tab === 'image') {
      handleGenerateImage();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrDataUrl]);

  // 埋まっているプロフ項目からカード用データを組み立てる
  function buildCardData(imgEl?: HTMLImageElement, qrEl?: HTMLImageElement): ShareCardData {
    const candidates: [string, string][] = [
      ['field_nickname', info.nickname], ['field_birthday', info.birthday], ['field_mbti', info.mbti],
      ['field_favoriteFood', info.favoriteFood], ['field_hobby', info.hobby],
      ['field_favoriteMusic', info.favoriteMusic], ['field_favoriteCharacter', info.favoriteCharacter],
      ['field_dream', info.dream],
    ];
    const fields = candidates.filter(([, v]) => v && v.trim()).map(([k, v]) => ({ label: t(k, lang), value: v }));
    // B/D の設問に使う項目（好きな食べ物→趣味→夢…の優先。無ければ「好きな食べ物」）
    const hookPick = [
      info.favoriteFood ? 'field_favoriteFood' : '', info.hobby ? 'field_hobby' : '',
      info.dream ? 'field_dream' : '', info.favoriteMusic ? 'field_favoriteMusic' : '',
    ].find((k) => k) || 'field_favoriteFood';
    const raw: Record<string, string> = {
      name, id: userId,
      birthday: info.birthday, mbti: info.mbti, hometown: info.hometown, nickname: info.nickname,
      favoriteFood: info.favoriteFood, favoriteColor: info.favoriteColor,
      favoriteMusic: info.favoriteMusic, favoriteArtist: info.favoriteArtist,
      favoriteCharacter: info.favoriteCharacter, favoriteTv: info.favoriteTv,
      favoriteManga: info.favoriteManga, favoriteGame: info.favoriteGame, hobby: info.hobby,
      dislikeFood: info.dislikeFood, specialty: info.specialty, personality: info.personality,
      charmPoint: info.charmPoint, dream: info.dream,
    };
    return { name, id: userId, avatar, avatarImg: imgEl, qrEl, fields, hookLabel: t(hookPick, lang), raw };
  }

  function drawCard(imgEl?: HTMLImageElement, qrEl?: HTMLImageElement) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = 1080, H = 1920;
    canvas.width = W;
    canvas.height = H;
    const data = buildCardData(imgEl, qrEl);
    if (cardType === 'A') drawShareCardA(ctx, W, H, data);
    else if (cardType === 'B') drawShareCardB(ctx, W, H, data);
    else if (cardType === 'C') drawShareCardC(ctx, W, H, data);
    else drawShareCardD(ctx, W, H, data);
    qrIncludedRef.current = !!qrEl;
    setImageGenerated(true);
  }

  function handleGenerateImage() {
    setImageGenerated(false);
    const doDraw = (avatarImg?: HTMLImageElement, qrImg?: HTMLImageElement) => {
      // 手書き風フォント（Google FontsのCJK）は「描画する文字」を指定してロードしないと
      // 未取得グリフがシステムフォントに化ける（部分的に太字に見える原因）。全文字を渡して読む。
      const cardText =
        'Miriつながるひろがるプロフィールをみてね答えを見る答えはMiriでQRで開くQRで診断一致率をチェック穴埋めで予想してみて親友なのに意外と知らない知ってる私とのは何朝型犬派海派旅行計画甘党つづき私の' +
        '0123456789%？?。、！ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz@_-' +
        [name, userId, info.favoriteFood, info.hobby, info.dream, info.favoriteMusic, info.nickname, info.birthday, info.mbti, info.favoriteCharacter,
          t('field_favoriteFood', lang), t('field_hobby', lang), t('field_dream', lang), t('field_favoriteMusic', lang),
          t('field_nickname', lang), t('field_birthday', lang), t('field_mbti', lang), t('field_favoriteCharacter', lang)].join('');
      const fonts = (document as any).fonts;
      const ready = fonts?.load
        ? Promise.all([
            fonts.load(`600 48px "Klee One"`, cardText),
            fonts.load(`400 40px "Klee One"`, cardText),
          ]).catch(() => {})
        : Promise.resolve();
      ready.then(() => drawCard(avatarImg, qrImg));
    };

    const loadQr = (avatarImg?: HTMLImageElement) => {
      if (qrDataUrl) {
        const qrImg = new Image();
        qrImg.onload = () => doDraw(avatarImg, qrImg);
        qrImg.src = qrDataUrl;
      } else {
        doDraw(avatarImg);
      }
    };

    if (avatarUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => loadQr(img);
      img.onerror = () => loadQr();
      img.src = avatarUrl;
    } else {
      loadQr();
    }
  }

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const file = new File([blob], `miri-profile-${userId}.png`, { type: 'image/png' });
      if (isIOS && navigator.share && (navigator as { canShare?: (d: object) => boolean }).canShare?.({ files: [file] })) {
        navigator.share({ files: [file], title: 'Miriプロフィール画像' }).catch(() => {});
      } else {
        const a = document.createElement('a');
        a.download = `miri-profile-${userId}.png`;
        const url = URL.createObjectURL(blob);
        a.href = url;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    });
  }

  function handleShare(withImage = false) {
    if (!navigator.share) return;
    if (withImage && canvasRef.current) {
      canvasRef.current.toBlob((blob) => {
        if (!blob) return;
        const file = new File([blob], 'miri-profile.png', { type: 'image/png' });
        navigator.share({ title: shareText, files: [file] }).catch(() => {
          navigator.share({ title: shareText, url: shareUrl });
        });
      });
    } else {
      navigator.share({ title: shareText, url: shareUrl });
    }
  }

  // ── SNS別シェア（初期設定言語に合わせて出し分け） ──
  function handleSnsClick(p: SharePlatform) {
    setSnsHint('');
    if (p.kind === 'url' && p.buildUrl) {
      window.open(p.buildUrl(shareUrl, shareText), '_blank', 'noopener');
    } else if (p.kind === 'copy') {
      navigator.clipboard?.writeText(shareUrl).then(
        () => setSnsHint(shareT(p.hintKey ?? 'hint_copied', lang)),
        () => setSnsHint(shareUrl),
      );
    } else {
      shareImageToSns(p);
    }
  }

  function shareImageToSns(p: SharePlatform) {
    // 画像がまだ生成されていなければ画像タブに切り替えて生成後に続行
    if (tab !== 'image' || !imageGenerated || !canvasRef.current) {
      pendingImageShareRef.current = p;
      setTab('image');
      return;
    }
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], 'miri-profile.png', { type: 'image/png' });
      const nav = navigator as Navigator & { canShare?: (d: object) => boolean };
      if (navigator.share && nav.canShare?.({ files: [file] })) {
        // モバイル：共有シートからストーリーズ等に直接渡せる
        navigator.share({ files: [file], title: shareText }).catch((err) => {
          if (err?.name !== 'AbortError') saveImageFallback(blob, p);
        });
      } else {
        saveImageFallback(blob, p);
      }
    });
  }

  function saveImageFallback(blob: Blob, p: SharePlatform) {
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.download = `miri-profile-${userId}.png`;
    a.href = url;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setSnsHint(shareT(p.hintKey ?? 'hint_image_saved', lang));
    if (p.id === 'instagram' && /Android|iPhone|iPad|iPod/.test(navigator.userAgent)) {
      setTimeout(() => { window.location.href = 'instagram://story-camera'; }, 500);
    }
  }

  // 画像生成待ちのSNSシェアがあれば生成完了後に実行
  useEffect(() => {
    if (imageGenerated && pendingImageShareRef.current) {
      const p = pendingImageShareRef.current;
      pendingImageShareRef.current = null;
      shareImageToSns(p);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageGenerated]);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-h-[92vh] overflow-y-auto rounded-t-[32px] bg-white pb-10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-pink/30" />
        <div className="flex items-center justify-between px-5 py-4">
          <p className="text-base font-black text-ink">プロフィールをシェア</p>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-base text-muted">✕</button>
        </div>

        {/* タブ */}
        <div className="flex gap-2 px-5 pb-5">
          {[
            { key: 'qr' as const, label: '🔲 QRコード' },
            { key: 'image' as const, label: '🖼 シェア画像' },
          ].map(({ key, label }) => (
            <button key={key}
              onClick={() => setTab(key)}
              className={`rounded-full px-5 py-2.5 text-sm font-black transition ${tab === key ? 'bg-pink text-white shadow-card' : 'bg-base text-muted'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* ── QRコードタブ ── */}
        {tab === 'qr' && (
          <div className="flex flex-col items-center gap-4 px-5">
            <div className="rounded-[28px] bg-base p-4 shadow-card">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR code" className="h-52 w-52 rounded-xl" />
              ) : (
                <div className="grid h-52 w-52 place-items-center">
                  <p className="text-sm font-bold text-muted">生成中…</p>
                </div>
              )}
            </div>
            <p className="text-xs font-bold text-muted text-center">
              スキャンするとMiriが開きます
            </p>
            <div className="w-full rounded-2xl bg-base px-4 py-3 text-center text-xs font-black text-ink">
              {shareUrl}
            </div>
            <div className="flex w-full gap-3">
              <button onClick={() => handleShare(false)}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-pink py-3.5 text-sm font-black text-white shadow-card active:scale-[0.98]">
                <Share2 size={15} />シェアする
              </button>
              {qrDataUrl && (
                <a href={qrDataUrl} download="miri-qr.png"
                  className="flex flex-1 items-center justify-center rounded-full bg-base py-3.5 text-sm font-black text-ink shadow-card active:scale-[0.98]">
                  💾 QR保存
                </a>
              )}
            </div>
          </div>
        )}

        {/* ── シェア画像タブ ── */}
        {tab === 'image' && (
          <div className="flex flex-col items-center gap-4 px-5">
            {/* カードの種類を選ぶ */}
            <div className="flex w-full flex-wrap gap-2">
              {([
                { key: 'A' as const, label: '📇 プロフ' },
                { key: 'B' as const, label: '👀 意外と知らない' },
                { key: 'C' as const, label: '💯 一致率診断' },
                { key: 'D' as const, label: '✏️ 穴埋め' },
              ]).map(({ key, label }) => (
                <button key={key} onClick={() => setCardType(key)}
                  className={`rounded-full px-3.5 py-2 text-xs font-black transition ${cardType === key ? 'bg-pink text-white shadow-card' : 'bg-base text-muted'}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="relative w-full max-w-[400px]">
              <canvas
                ref={canvasRef}
                className="w-full rounded-2xl shadow-card"
                style={{ aspectRatio: '1080/1920' }}
              />
              {!imageGenerated && (
                <div className="absolute inset-0 grid place-items-center rounded-2xl bg-base">
                  <p className="text-sm font-bold text-muted">生成中…</p>
                </div>
              )}
            </div>
            <p className="text-xs font-bold text-muted text-center">
              iOS: 長押し → 写真に追加 / Android: 下のボタンで保存
            </p>
            <div className="flex w-full gap-3">
              <button onClick={() => handleShare(true)} disabled={!imageGenerated}
                className={`flex flex-1 items-center justify-center gap-2 rounded-full py-3.5 text-sm font-black shadow-card transition ${imageGenerated ? 'bg-pink text-white active:scale-[0.98]' : 'bg-base text-muted'}`}>
                <Share2 size={15} />シェア
              </button>
              <button onClick={handleDownload} disabled={!imageGenerated}
                className={`flex flex-1 items-center justify-center gap-2 rounded-full py-3.5 text-sm font-black shadow-card transition ${imageGenerated ? 'bg-base text-ink active:scale-[0.98]' : 'bg-base text-muted'}`}>
                💾 画像を保存
              </button>
            </div>
            <button onClick={handleGenerateImage}
              className="w-full rounded-full border-2 border-dashed border-pink/30 py-3 text-sm font-black text-pink hover:bg-pink/5">
              🔄 画像を再生成
            </button>
          </div>
        )}

        {/* ── SNSシェア（初期設定言語に合わせたSNSをワンタッチで） ── */}
        <div className="mt-6 px-5">
          <p className="mb-3 text-xs font-black text-muted">📲 {shareT('sns_row_label', lang)}</p>
          <div className="flex flex-wrap gap-2">
            {snsTargets.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSnsClick(p)}
                className="flex items-center gap-1.5 rounded-full px-5 py-3 text-sm font-black shadow-card transition active:scale-[0.97]"
                style={{ background: p.color, color: p.textColor ?? '#fff' }}
              >
                {p.label}
              </button>
            ))}
          </div>
          {snsHint && (
            <p className="mt-3 rounded-2xl bg-pink/10 px-4 py-2.5 text-xs font-bold text-pink">💡 {snsHint}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function OfficialQuestionCreateScreen({
  go,
  onCreate,
}: {
  go: (s: Screen, answerId?: string) => void;
  onCreate: (title: string, description: string, answerType: 'free' | 'select', answerOptions: string[]) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [answerType, setAnswerType] = useState<'free' | 'select'>('free');
  const [options, setOptions] = useState<string[]>(['', '']);

  function updateOption(i: number, v: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? v : o)));
  }
  function addOption() { if (options.length < 8) setOptions((p) => [...p, '']); }
  function removeOption(i: number) { if (options.length > 2) setOptions((p) => p.filter((_, idx) => idx !== i)); }

  const validOptions = options.filter((o) => o.trim());
  const canCreate = title.trim() && (answerType === 'free' || validOptions.length >= 2);

  return (
    <>
      <AppHeader title="お題を作成" back onBack={() => go('profile')} onBell={() => go('notifications')} />
      <div className="space-y-4 px-4 pt-3 pb-32">
        <section className="rounded-[32px] bg-white p-5 shadow-card">
          <div className="mb-2 flex items-center gap-2">
            <OfficialBadge />
            <p className="text-xl font-black text-ink">公認ユーザーのお題</p>
          </div>
          <p className="text-sm font-bold text-muted">作成したお題は、みんなが回答できる通常のお題として表示されます。</p>
        </section>

        <section className="space-y-4 rounded-[32px] bg-white p-5 shadow-card">
          <label className="block">
            <span className="text-xs font-black text-muted">お題タイトル</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="例：最近いちばん元気をもらった曲は？"
              className="mt-1 w-full rounded-2xl border border-purple/15 bg-cream/20 px-4 py-3 text-sm font-bold text-ink outline-none focus:border-pink" />
          </label>
          <label className="block">
            <span className="text-xs font-black text-muted">補足説明</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="例：理由も一緒に教えてね"
              className="mt-1 h-20 w-full resize-none rounded-2xl border border-purple/15 bg-cream/20 px-4 py-3 text-sm font-bold text-ink outline-none focus:border-pink" />
          </label>
        </section>

        {/* 回答形式 */}
        <section className="rounded-[32px] bg-white p-5 shadow-card">
          <p className="mb-3 font-black text-ink">回答形式</p>
          <div className="grid grid-cols-2 gap-2">
            {(['free', 'select'] as const).map((t) => (
              <button key={t} type="button" onClick={() => setAnswerType(t)}
                className={`rounded-2xl py-3 text-sm font-black transition ${answerType === t ? 'bg-pink text-white shadow-card' : 'bg-base text-muted'}`}>
                {t === 'free' ? '✏️ 自由記述' : '☑️ 選択式'}
              </button>
            ))}
          </div>
          {answerType === 'free' && (
            <p className="mt-3 text-xs font-bold text-muted">回答者が自由にテキストで回答します</p>
          )}
        </section>

        {/* 選択肢エディタ */}
        {answerType === 'select' && (
          <section className="rounded-[32px] bg-white p-5 shadow-card">
            <p className="mb-3 font-black text-ink">選択肢を設定 <span className="text-xs font-bold text-muted">（最大8個）</span></p>
            <div className="space-y-2">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-pink/10 text-xs font-black text-pink">{i + 1}</span>
                  <input value={opt} onChange={(e) => updateOption(i, e.target.value)}
                    placeholder={`選択肢 ${i + 1}`}
                    className="flex-1 rounded-2xl border border-purple/15 bg-base px-3 py-2 text-sm font-bold outline-none focus:border-pink" />
                  {options.length > 2 && (
                    <button type="button" onClick={() => removeOption(i)} className="text-xs font-black text-muted hover:text-pink">✕</button>
                  )}
                </div>
              ))}
            </div>
            {options.length < 8 && (
              <button type="button" onClick={addOption}
                className="mt-3 w-full rounded-2xl border border-dashed border-pink/40 py-2 text-xs font-black text-pink active:scale-[0.99]">
                ＋ 選択肢を追加
              </button>
            )}
            <p className="mt-3 text-xs font-bold text-muted">同じ回答を選んだ人同士がつながりやすくなります ✨</p>
          </section>
        )}

        <button disabled={!canCreate}
          onClick={() => { onCreate(title, description, answerType, validOptions); go('home'); }}
          className="w-full rounded-[24px] bg-pink px-5 py-4 text-base font-black text-white shadow-card disabled:opacity-40 active:scale-[0.99]">
          お題を公開する
        </button>
      </div>
    </>
  );
}
// 項目ごとの公開範囲チップ。タップで 公開→フォロワー→非公開 を巡回。
// 編集画面の表示言語（項目の部品がプレースホルダーや選択肢の表示に使う）
const EditLangContext = createContext<Lang>('ja');

// きせかえ用：テーマごとの表紙の色（globals.css の各テーマの色トークンと同じ値）
const THEME_SWATCH: Record<string, { cover: string; accent: string; paper: string }> = {
  default:    { cover: '#4F73E8', accent: '#A47BFF', paper: '#FFF8EE' },
  lavender:   { cover: '#B79AEF', accent: '#F58DB2', paper: '#F8F5FF' },
  soda:       { cover: '#60A5FA', accent: '#A78BFA', paper: '#F0F9FF' },
  herb:       { cover: '#34D399', accent: '#60A5FA', paper: '#F0FDF4' },
  peach:      { cover: '#FB923C', accent: '#F58DB2', paper: '#FFF7ED' },
  strawberry: { cover: '#F87171', accent: '#F58DB2', paper: '#FFF1F2' },
  banana:     { cover: '#EAB308', accent: '#FB923C', paper: '#FEFCE8' },
  night:      { cover: '#2A2350', accent: '#D8B4FE', paper: '#201B3C' },
};
/** 小さなプロフ帳の表紙（背表紙・ラベル・シール）。選んだものはマステと ✓ で「いまの表紙」 */
function MiniBookCover({ themeId, emoji, selected, plain = false, scene }: { themeId: string; emoji: string; selected: boolean; plain?: boolean; scene?: BgTheme }) {
  const sw = THEME_SWATCH[themeId] ?? THEME_SWATCH.default;
  return (
    <span className={`relative block aspect-[3/4] w-full max-w-[76px] transition ${selected ? '-translate-y-1' : 'group-hover:-translate-y-0.5'}`}>
      {selected && <span aria-hidden className="pb-tape !absolute -top-1.5 left-1/2 z-20 h-3 w-9 -translate-x-1/2 !p-0" style={{ transform: 'translateX(-50%) rotate(-5deg)' }} />}
      <span className={`absolute inset-0 overflow-hidden rounded-r-md rounded-l-sm shadow-[0_3px_6px_rgba(0,0,0,.18)] ${selected ? 'ring-2 ring-pink ring-offset-2 ring-offset-white' : ''}`}
        style={{ background: plain ? '#f3f0ea' : sw.cover }}>
        {scene && <span className="absolute inset-0"><SceneBackground theme={scene} scale={0.4} /></span>}
        {/* 背表紙 */}
        <span aria-hidden className="absolute inset-y-0 left-0 w-[14%] bg-black/15" />
        {/* 表紙のラベル（紙） */}
        <span aria-hidden className="absolute left-[24%] right-[10%] top-[22%] rounded-sm px-1 py-[3px]" style={{ background: sw.paper }}>
          <span className="block h-[3px] rounded-full" style={{ background: sw.accent, opacity: 0.8 }} />
          <span className="mt-[3px] block h-[2px] w-2/3 rounded-full bg-black/15" />
          <span className="mt-[3px] block h-[2px] w-1/2 rounded-full bg-black/15" />
        </span>
        {/* シール */}
        <span aria-hidden className="absolute bottom-[10%] right-[10%] grid h-[30%] w-[38%] place-items-center rounded-full bg-white text-[13px] shadow-[inset_0_0_0_2px_rgba(255,255,255,.9),0_1px_3px_rgba(0,0,0,.2)]">{emoji}</span>
      </span>
      {selected && <span aria-hidden className="absolute -right-1.5 -top-1.5 z-20 grid h-5 w-5 place-items-center rounded-full bg-pink text-[11px] font-black text-white shadow-[inset_0_0_0_2px_rgba(255,255,255,.85)]">✓</span>}
    </span>
  );
}

function VisChip({ value = 'public', onChange }: { value?: FieldVisibility; onChange: (v: FieldVisibility) => void }) {
  const order: FieldVisibility[] = ['public', 'followers', 'private'];
  // 見出しの横に貼る小さな「見せる相手」タグ（タップで みんな → フォロワー → ひみつ）
  const lang = useContext(EditLangContext);
  const meta: Record<FieldVisibility, { t: string; icon: string; c: string }> = {
    public: { t: t('vis_public', lang), icon: '👀', c: 'border-ink/20 bg-white' },
    followers: { t: t('vis_followers', lang), icon: '👥', c: 'border-purple/50 bg-purple/15' },
    private: { t: t('vis_private', lang), icon: '🔒', c: 'border-[#d9473f]/50 bg-[#d9473f]/15' },
  };
  const m = meta[value] ?? meta.public;
  return (
    <button
      type="button"
      onClick={() => onChange(order[(order.indexOf(value) + 1) % order.length])}
      aria-label={tf('vis_aria', lang, { v: m.t })}
      title={t('vis_hint', lang)}
      className={`inline-flex min-h-[30px] shrink-0 items-center gap-1 rounded-md border border-dashed px-2 text-[11px] font-black text-ink transition active:scale-95 ${m.c}`}
    >
      <span aria-hidden>{m.icon}</span>{m.t}
    </button>
  );
}

// フィールドのラベル行（右端に任意で公開範囲チップ）
function FieldLabel({ label, vis, onVis }: { label: string; vis?: FieldVisibility; onVis?: (v: FieldVisibility) => void }) {
  // 記入用紙の印刷された項目名（入力した文字＝手書きと区別する）
  if (!onVis) return <span className="pb-label pb-label-md">{label}</span>;
  // 見せる相手タグは項目名のすぐ横に（右端に離さない）
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="pb-label pb-label-md">{label}</span>
      <VisChip value={vis} onChange={onVis} />
    </span>
  );
}

function EditField({
  label,
  value,
  onChange,
  vis,
  onVis,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  vis?: FieldVisibility;
  onVis?: (v: FieldVisibility) => void;
}) {
  return (
    <label className="block">
      <FieldLabel label={label} vis={vis} onVis={onVis} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pen-text mt-1 w-full rounded-xl border-2 border-ink/10 bg-white px-3.5 py-2.5 text-[15px] font-bold text-ink outline-none focus:border-pink"
      />
    </label>
  );
}

// 誕生日：月・日のプルダウン（値は "M月D日" 形式で保存し既存表示と互換）
function BirthdayField({ label, value, onChange, vis, onVis }: { label: string; value: string; onChange: (v: string) => void; vis?: FieldVisibility; onVis?: (v: FieldVisibility) => void }) {
  const lang = useContext(EditLangContext);
  // 月・日を独立して読み取る（「3月」だけ／「15日」だけの途中状態も保持・表示できる）。
  const month = ((value ?? '').match(/(\d{1,2})月/) || [])[1] || '';
  const day = ((value ?? '').match(/(\d{1,2})日/) || [])[1] || '';
  const set = (mo: string, da: string) => onChange(`${mo ? `${mo}月` : ''}${da ? `${da}日` : ''}`);
  // 選択肢そのものに「月／日」を含めて自己完結させ、選んだ値がひと目で分かるように。
  // 未選択はグレー、選択後はピンク枠＋濃い文字で区別する（固定ラベルは廃止）。
  const sel = (filled: boolean) =>
    `pen-text mt-1 w-full appearance-none rounded-xl border-2 bg-white px-3.5 py-2.5 text-[15px] font-black outline-none focus:border-pink ${
      filled ? 'border-pink/40 text-ink' : 'border-ink/10 text-muted'
    }`;
  return (
    <div>
      <FieldLabel label={label} vis={vis} onVis={onVis} />
      <div className="mt-1 grid grid-cols-2 gap-2">
        <select value={month} aria-label={`${label} ${t('ph_month', lang)}`} onChange={(e) => set(e.target.value, day)} className={sel(!!month)}>
          <option value="">{t('ph_month', lang)}</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((mo) => <option key={mo} value={mo}>{monthName(mo - 1, lang)}</option>)}
        </select>
        <select value={day} aria-label={`${label} ${t('ph_day', lang)}`} onChange={(e) => set(month, e.target.value)} className={sel(!!day)}>
          <option value="">{t('ph_day', lang)}</option>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((da) => <option key={da} value={da}>{lang === 'ja' ? `${da}日` : da}</option>)}
        </select>
      </div>
      {(month || day) && (
        <p className="pb-label mt-1.5">✎ {formatBirthday(value, lang)}</p>
      )}
    </div>
  );
}

// なまえ：姓・名を分けて入力（値は "姓 名" のスペース区切りで保存）
function NameField({ label, value, onChange, vis, onVis }: { label: string; value: string; onChange: (v: string) => void; vis?: FieldVisibility; onVis?: (v: FieldVisibility) => void }) {
  const lang = useContext(EditLangContext);
  const parts = (value ?? '').split(/\s+/);
  const last = parts[0] ?? '';
  const first = parts.slice(1).join(' ');
  const set = (l: string, f: string) => onChange(`${l} ${f}`.trim());
  const inp = 'pen-text mt-1 w-full rounded-xl border-2 border-ink/10 bg-white px-3.5 py-2.5 text-[15px] font-bold text-ink outline-none focus:border-pink';
  return (
    <div>
      <FieldLabel label={label} vis={vis} onVis={onVis} />
      <div className="mt-1 flex gap-2">
        <input value={last} onChange={(e) => set(e.target.value, first)} placeholder={t('ph_last_name', lang)} aria-label={`${label} ${t('ph_last_name', lang)}`} className={inp} />
        <input value={first} onChange={(e) => set(last, e.target.value)} placeholder={t('ph_first_name', lang)} aria-label={`${label} ${t('ph_first_name', lang)}`} className={inp} />
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  vis,
  onVis,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  /** 互換のため残している（並びはチップの折り返しで決まる） */
  columns?: number;
  vis?: FieldVisibility;
  onVis?: (v: FieldVisibility) => void;
}) {
  // 選んだものは「貼ったシール」、まだのものは白い札。もう一度押すと外せる。
  const lang = useContext(EditLangContext);
  return (
    <div>
      <FieldLabel label={label} vis={vis} onVis={onVis} />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const on = value === opt;
          return (
            <button
              key={opt}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? '' : opt)}
              className={`min-h-[40px] rounded-full px-3.5 text-[13px] font-black transition ${
                on
                  ? '-rotate-1 bg-cream text-ink shadow-[inset_0_0_0_2px_rgba(255,255,255,.9),0_2px_5px_rgba(0,0,0,.18)]'
                  : 'bg-white text-ink/80 ring-1 ring-ink/15 hover:bg-pink/5'
              }`}
            >
              {on && <span aria-hidden className="mr-0.5 text-pinkStrong">✓</span>}{tv(opt, lang)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// 血液型：プロフ帳の「A・B・O・AB」に手書きの丸をつける
function BloodTypeField({ label, value, onChange, options, vis, onVis }: { label: string; value: string; onChange: (v: string) => void; options: string[]; vis?: FieldVisibility; onVis?: (v: FieldVisibility) => void }) {
  const lang = useContext(EditLangContext);
  const suffix = t('blood_suffix', lang); // 「型」（英語などは空）
  return (
    <div>
      <FieldLabel label={label} vis={vis} onVis={onVis} />
      <div className="mt-1.5 flex flex-wrap items-center gap-x-1 rounded-lg bg-white px-2 py-1 ring-1 ring-ink/10">
        {options.map((opt, i) => {
          const on = value === opt;
          const short = /型$/.test(opt) ? opt.replace(/型$/, '') : tv(opt, lang);
          return (
            <span key={opt} className="flex items-center">
              {i > 0 && <span aria-hidden className="px-0.5 text-muted">{/型$/.test(options[i - 1]) && !/型$/.test(opt) && suffix ? `${suffix} ・` : '・'}</span>}
              <button
                type="button"
                aria-pressed={on}
                aria-label={/型$/.test(opt) ? `${opt.replace(/型$/, '')}${suffix}` : tv(opt, lang)}
                onClick={() => onChange(on ? '' : opt)}
                className={`pb-choice min-h-[44px] min-w-[44px] !text-[17px] ${on ? 'pb-choice-on' : '!text-ink/75'}`}
              >
                {short}
              </button>
            </span>
          );
        })}
        {suffix && options.length > 0 && /型$/.test(options[options.length - 1]) && <span aria-hidden className="ml-1 text-[12px] font-black text-muted">{suffix}</span>}
      </div>
    </div>
  );
}

// せいべつ：アンケート用紙のチェック欄（☑）
function CheckListField({ label, value, onChange, options, vis, onVis }: { label: string; value: string; onChange: (v: string) => void; options: string[]; vis?: FieldVisibility; onVis?: (v: FieldVisibility) => void }) {
  return (
    <div>
      <FieldLabel label={label} vis={vis} onVis={onVis} />
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
        {options.map((opt) => {
          const on = value === opt;
          return (
            <button key={opt} type="button" role="checkbox" aria-checked={on} onClick={() => onChange(on ? '' : opt)}
              className="flex min-h-[40px] items-center gap-1.5 text-[14px] font-bold text-ink">
              <span aria-hidden className={`grid h-5 w-5 place-items-center rounded-[4px] border-2 ${on ? 'border-pinkStrong bg-pink/10 text-pinkStrong' : 'border-ink/35 bg-white'}`}>
                {on && <span className="text-[13px] font-black leading-none">✓</span>}
              </span>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// MBTI：16個から探すのではなく、4つの軸を選んでいくと結果が決まる「診断カード」
const MBTI_AXES: { a: string; b: string }[] = [
  { a: 'E', b: 'I' }, { a: 'N', b: 'S' }, { a: 'T', b: 'F' }, { a: 'J', b: 'P' },
];
function MbtiField({ label, value, onChange, vis, onVis }: { label: string; value: string; onChange: (v: string) => void; vis?: FieldVisibility; onVis?: (v: FieldVisibility) => void }) {
  const lang = useContext(EditLangContext);
  const valid = /^[EI][NS][TF][JP]$/.test(value ?? '');
  const [picks, setPicks] = useState<(string | null)[]>(() => (valid ? value.split('') : [null, null, null, null]));
  useEffect(() => { if (/^[EI][NS][TF][JP]$/.test(value ?? '')) setPicks(value.split('')); }, [value]);
  const pick = (i: number, letter: string) => {
    const next = [...picks];
    next[i] = next[i] === letter ? null : letter;
    setPicks(next);
    // 4つそろったら結果として保存（そろうまでは未入力のまま）
    onChange(next.every(Boolean) ? next.join('') : '');
  };
  const done = picks.every(Boolean);
  return (
    <div>
      <FieldLabel label={label} vis={vis} onVis={onVis} />
      <div className="mt-1.5 rounded-lg bg-white p-3 ring-1 ring-ink/10">
        <div className="space-y-1.5">
          {MBTI_AXES.map((ax, i) => (
            <div key={ax.a} className="flex items-center gap-1.5" role="radiogroup" aria-label={`${t(`mbti_${ax.a}`, lang)} / ${t(`mbti_${ax.b}`, lang)}`}>
              {[[ax.a, t(`mbti_${ax.a}`, lang)], [ax.b, t(`mbti_${ax.b}`, lang)]].map(([letter, word], j) => {
                const on = picks[i] === letter;
                return (
                  <Fragment key={letter}>
                    {j === 1 && <span aria-hidden className="text-[11px] font-black text-muted">/</span>}
                    <button type="button" role="radio" aria-checked={on} onClick={() => pick(i, letter)}
                      className={`flex min-h-[40px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-1 text-[13px] font-black leading-tight transition ${on ? 'bg-cream text-ink shadow-[inset_0_0_0_2px_rgba(255,255,255,.9),0_2px_4px_rgba(0,0,0,.15)]' : 'text-ink/75 ring-1 ring-ink/15'}`}>
                      <span className="gk-font text-[15px]">{letter}</span><span className="min-w-0 truncate">{word}</span>
                    </button>
                  </Fragment>
                );
              })}
            </div>
          ))}
        </div>
        <div className="mt-2.5 flex items-center gap-2 border-t-2 border-dotted border-ink/10 pt-2">
          <span className="pb-label">{t('mbti_result', lang)}</span>
          <span className="inline-flex gap-1" aria-live="polite">
            {picks.map((c, i) => <span key={i} className="pb-letterbox gk-font">{c ?? '?'}</span>)}
          </span>
          {done && <span aria-hidden className="pb-stamp h-9 w-9 -rotate-12 text-[9px] leading-tight">{t('mbti_done', lang)}</span>}
          {(done || picks.some(Boolean)) && (
            <button type="button" onClick={() => { setPicks([null, null, null, null]); onChange(''); }}
              className="ml-auto min-h-[36px] px-1 text-[11px] font-bold text-muted underline decoration-dotted underline-offset-4">{t('mbti_clear', lang)}</button>
          )}
        </div>
      </div>
    </div>
  );
}

function Best3EditBlock({
  title,
  items,
  onChange,
  hideTitle = false,
}: {
  title: string;
  items: string[];
  onChange: (next: string[]) => void;
  /** 見出しを外に出しているとき（今月のおだい）は表示しない */
  hideTitle?: boolean;
}) {
  const lang = useContext(EditLangContext);
  const safeItems = [items[0] || '', items[1] || '', items[2] || ''];

  const updateItem = (index: number, value: string) => {
    const next = [...safeItems];
    next[index] = value;
    onChange(next);
  };

  return (
    <div className="space-y-2.5 rounded-xl border border-ink/10 bg-white/70 p-3.5">
      {!hideTitle && <p className="pb-label pb-label-md">{title}</p>}

      {safeItems.map((item, index) => (
        <label key={index} className="flex items-center gap-3">
          <span className="pb-num" aria-hidden>{index + 1}</span>
          <input
            value={item}
            onChange={(e) => updateItem(index, e.target.value)}
            placeholder={tf('ph_rank', lang, { n: index + 1 })}
            aria-label={`${title} ${tf('ph_rank', lang, { n: index + 1 })}`}
            className="pen-text w-full rounded-xl border-2 border-ink/10 bg-white px-3.5 py-2.5 text-[15px] font-bold text-ink outline-none focus:border-pink"
          />
        </label>
      ))}
    </div>
  );
}

// よく使う絵文字（クイック選択）。これ以外でも下の入力欄から任意の絵文字が使える。
const STICKER_CHOICES = [
  '😆', '😭', '👏', '🥹', '🔥', '🎉', '😮', '🙏', '💯', '✨', '😂', '🥰',
  '😍', '🤣', '😊', '😎', '🥺', '😳', '😱', '🤔', '😴', '😇', '🤗', '😏',
  '👍', '👎', '🙌', '🤝', '💪', '✌️', '🫶', '👀', '🫡', '🤙', '🙆', '🙅',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🩷', '💗', '💖', '💕', '💔', '💫',
  '🌸', '🌟', '⭐️', '🌈', '☀️', '🌙', '🍀', '🎀', '🎁', '🍰', '🍜', '☕️',
  '🎮', '🎵', '📷', '📚', '⚽️', '🏆', '💎', '👑', '💰', '🚀', '🫠', '💤',
];

// 所持しているスタンプ（無料＋購入パック＋当てたガチャ）の絵文字一覧を返す
function getOwnedStickerEmojis(ownedPackIds: string[], ownedGachaStickers: string[]): string[] {
  const out: string[] = [];
  for (const p of STICKER_PACKS) {
    const usable =
      p.acquisition.type === 'free' ||
      ownedPackIds.includes(p.id) ||
      (p.acquisition.type === 'gacha' && p.stickers.some((s) => ownedGachaStickers.includes(s.id)));
    if (!usable) continue;
    const items = p.acquisition.type === 'gacha'
      ? p.stickers.filter((s) => ownedGachaStickers.includes(s.id))
      : p.stickers;
    for (const s of items) if (s.emoji && !out.includes(s.emoji)) out.push(s.emoji);
  }
  return out;
}

// アプリ内の全絵文字ピッカー（カテゴリタブ＋一覧＋自由入力）。myStickers があれば先頭に「マイスタンプ」タブ。
function EmojiPicker({ onPick, myStickers = [] }: { onPick: (emoji: string) => void; myStickers?: string[] }) {
  const PIXEL_CAT = '__pixel';
  const categories = myStickers.length > 0
    ? [{ id: 'mine', label: 'マイスタンプ', icon: '🎁', emojis: myStickers }, ...EMOJI_CATEGORIES]
    : EMOJI_CATEGORIES;
  // 末尾に「ピクセル絵文字」専用カテゴリ（通常絵文字とは別）
  const tabs = [...categories, { id: PIXEL_CAT, label: 'ピクセル絵文字', icon: '▦', emojis: [] as string[] }];
  const [cat, setCat] = useState(categories[0].id);
  const [input, setInput] = useState('');
  const current = categories.find((c) => c.id === cat) ?? categories[0];
  const submitInput = () => { const e = firstGrapheme(input); if (e) { onPick(e); setInput(''); } };
  // 入力があればキーワード検索（例:「ハート」「ねこ」「わらい」）。ヒットしなければ直接入力扱い。
  const q = input.trim();
  const searchHits = q ? searchEmojis(q) : [];
  const searching = q.length > 0;
  const pixelTab = cat === PIXEL_CAT && !searching;
  return (
    <div className="space-y-2 rounded-2xl bg-white p-3 shadow-card">
      {/* 検索＆自由入力（端末キーボードからでも／キーワードでも） */}
      <div className="flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submitInput(); }}
          placeholder="🔍 絵文字か言葉で検索（例:ハート）"
          className="min-w-0 flex-1 rounded-full bg-base px-4 py-2 text-base font-bold text-ink placeholder:text-muted placeholder:font-normal outline-none"
        />
        <button onClick={submitInput} disabled={!input.trim()} className="shrink-0 rounded-full bg-pink px-4 py-2 text-xs font-black text-white disabled:opacity-40">つける</button>
      </div>
      {/* カテゴリタブ（検索中は隠す）。末尾に▦ピクセル絵文字 */}
      {!searching && (
        <div className="flex gap-1 overflow-x-auto pb-1">
          {tabs.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              aria-label={c.label}
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xl transition ${cat === c.id ? 'bg-pink/15 ring-1 ring-pink' : 'hover:bg-base'}`}
            >
              {c.icon}
            </button>
          ))}
        </div>
      )}
      {/* 一覧：ピクセル絵文字カテゴリなら画像、そうでなければ通常絵文字（検索中は検索結果） */}
      {pixelTab ? (
        PIXEL_EMOJIS.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs font-bold text-muted">ピクセル絵文字はまだありません。</p>
        ) : (
          <div className="grid max-h-52 grid-cols-6 gap-1 overflow-y-auto">
            {PIXEL_EMOJIS.map((p) => (
              <button key={p.key} onClick={() => onPick(`pe:${p.key}`)} aria-label={p.label}
                className="grid h-12 w-full place-items-center rounded-xl transition hover:bg-pink/10 active:scale-90">
                <PixelEmojiImg keyId={p.key} size={30} />
              </button>
            ))}
          </div>
        )
      ) : searching && searchHits.length === 0 ? (
        <p className="px-1 py-6 text-center text-xs font-bold text-muted">「{q}」に一致する絵文字はありません。<br />そのまま「つける」で直接入力できます。</p>
      ) : (
        <div className="grid max-h-52 grid-cols-8 gap-0.5 overflow-y-auto">
          {(searching ? searchHits : current.emojis).map((emoji, i) => (
            <button
              key={emoji + i}
              onClick={() => onPick(emoji)}
              className="grid h-10 w-full place-items-center rounded-lg text-2xl transition hover:bg-pink/10 active:scale-90"
            >
              {isRetroCode(emoji) ? <RetroText text={emoji} /> : <span>{emoji}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// 入力文字列から先頭の1絵文字を取り出す（複数コードポイントの絵文字も1つとして扱う）
function firstGrapheme(s: string): string {
  const v = s.trim();
  if (!v) return '';
  try {
    // @ts-ignore Segmenter は対応環境のみ
    if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
      // @ts-ignore
      const seg = new (Intl as any).Segmenter('ja', { granularity: 'grapheme' });
      const it = seg.segment(v)[Symbol.iterator]().next();
      return it.value ? it.value.segment : v;
    }
  } catch {}
  return [...v][0] ?? v;
}

function DetailScreen({
  go, answer, onReact, reactions, authorUid, isBookmarked, onToggleBookmark, onShare, onReport,
  ownedPackIds = [], ownedGachaStickers = [],
}: {
  go: (s: Screen, payload?: any) => void;
  answer: Answer;
  onReact: (answerId: string, type: string) => void;
  reactions: Record<string, { count: number; mine: boolean }>;
  authorUid?: string | null;
  isBookmarked: boolean;
  onToggleBookmark: (id: string) => void;
  onShare: (text: string) => void;
  onReport?: (answerId: string) => void;
  ownedPackIds?: string[];
  ownedGachaStickers?: string[];
}) {
  const lang = useLang();
  const myStickers = getOwnedStickerEmojis(ownedPackIds, ownedGachaStickers);
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [heartPop, setHeartPop] = useState(false);

  const likeInfo = reactions['like'] ?? { count: 0, mine: false };
  // 絵文字スタンプ（like以外）を件数の多い順に
  const stickerEntries = Object.entries(reactions)
    .filter(([type]) => type !== 'like')
    .sort((a, b) => b[1].count - a[1].count);

  function tapLike() {
    if (!likeInfo.mine) { setHeartPop(true); setTimeout(() => setHeartPop(false), 450); }
    onReact(answer.id, 'like');
  }

  // コメントを Supabase から読み込み（ローカル生成の回答 a-... は対象外）
  useEffect(() => {
    if (!dbReady() || answer.id.startsWith('a-')) { setComments([]); return; }
    let cancelled = false;
    getComments(answer.id).then((cs) => { if (!cancelled) setComments(cs); });
    return () => { cancelled = true; };
  }, [answer.id]);

  async function addComment() {
    const body = comment.trim();
    if (!body) return;
    setComment('');
    // 楽観追加
    const optimistic: CommentRow = {
      id: 'tmp-' + Date.now(), answer_id: answer.id, user_id: 'me', body,
      created_at: new Date().toISOString(),
      profile: { username: me.id.replace(/^@/, ''), display_name: me.name, avatar_url: me.avatar } as any,
    };
    setComments((cs) => [...cs, optimistic]);
    if (dbReady() && !answer.id.startsWith('a-')) {
      await dbAddComment(answer.id, body);
      if (authorUid) void createNotification(authorUid, 'comment', { answerId: answer.id, body });
    }
  }

  return (
    <>
      <AppHeader title={t('detail_title', lang)} back onBack={() => go('home')} onBell={() => go('notifications')} />
      <div className="space-y-5 px-4 pt-3">
        <AnswerCard answer={answer} detail liked={likeInfo.mine} onUserClick={(u) => go('profile', { name: u.name, id: u.id, avatar: u.avatar, bio: '', common: '' })} />

        {/* リアクション（❤️すき＋絵文字スタンプ） */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* いいね（ハート） */}
            <button
              onClick={tapLike}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-black shadow-card transition active:scale-95 ${likeInfo.mine ? 'bg-pink text-white' : 'bg-white text-ink'}`}
            >
              <Heart size={18} fill={likeInfo.mine ? 'currentColor' : 'none'} className={heartPop ? 'heart-pop' : ''} />
              {t('detail_like', lang)}{likeInfo.count > 0 && <span>{likeInfo.count}</span>}
            </button>

            {/* 付いている絵文字スタンプ（Slack風チップ） */}
            {stickerEntries.map(([emoji, info]) => (
              <button
                key={emoji}
                onClick={() => onReact(answer.id, emoji)}
                className={`flex items-center gap-1 rounded-full px-3 py-2 text-sm font-black shadow-card transition active:scale-95 ${info.mine ? 'bg-pink/15 text-pink ring-1 ring-pink' : 'bg-white text-ink'}`}
              >
                <span className="text-base"><ReactionGlyph value={emoji} size={18} /></span>{info.count}
              </button>
            ))}

            {/* スタンプ追加 */}
            <button
              onClick={() => setShowStickerPicker((v) => !v)}
              className={`grid h-11 w-11 place-items-center rounded-full text-lg shadow-card transition active:scale-95 ${showStickerPicker ? 'bg-pink/15 text-pink' : 'bg-white text-muted'}`}
            >
              ＋
            </button>
          </div>

          {/* スタンプ選択パネル：全絵文字ピッカー＋マイスタンプ */}
          {showStickerPicker && (
            <EmojiPicker myStickers={myStickers} onPick={(e) => { onReact(answer.id, e); setShowStickerPicker(false); }} />
          )}
        </div>

        {/* シェア・ブックマーク */}
        <div className="flex gap-3">
          <button
            onClick={() => onShare(`「${answer.question ? localizeQuestion(answer.question, lang).title : ''}」\n\n${answer.body}\n\n— ${answer.user.name} on Miri`)}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white py-3 text-sm font-black text-muted shadow-card transition active:scale-[0.98]"
          >
            <Share2 size={16} />{t('detail_share', lang)}
          </button>
          <button
            onClick={() => onToggleBookmark(answer.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-sm font-black shadow-card transition active:scale-[0.98] ${isBookmarked ? 'bg-pink text-white' : 'bg-white text-muted'}`}
          >
            <Bookmark size={16} fill={isBookmarked ? 'currentColor' : 'none'} />
            {isBookmarked ? t('detail_saved', lang) : t('nav_bookmark', lang)}
          </button>
        </div>

        {/* 通報（自分の回答には出さない） */}
        {onReport && answer.user?.id !== me.id && (
          <div className="text-center">
            <button
              onClick={() => onReport(answer.id)}
              className="text-[11px] font-bold text-muted underline underline-offset-2 active:opacity-70"
            >
              🚩 {t('detail_report', lang)}
            </button>
          </div>
        )}

        <section className="rounded-[28px] bg-white p-4 shadow-card">
          <SectionHeader title={t('detail_comments', lang)} />
          <div className="mb-3 flex gap-2">
            <input value={comment} onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addComment()}
              placeholder={t('detail_comment_ph', lang)} className="min-w-0 flex-1 rounded-full bg-base px-4 py-3 text-sm outline-none" />
            <button onClick={addComment} className="rounded-full bg-pink px-4 text-xs font-black text-white">{t('btn_send', lang)}</button>
          </div>
          <div className="space-y-2">
            {comments.length === 0 && <p className="py-2 text-center text-xs font-bold text-muted">{t('detail_no_comments', lang)}</p>}
            {comments.map((c) => (
              <div key={c.id} className="rounded-2xl bg-blue-50 p-3">
                <p className="mb-0.5 text-[11px] font-black text-muted">{c.profile?.display_name ?? t('guest', lang)}</p>
                <p className="text-sm text-ink">{c.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionHeader title={t('detail_same_answer', lang)} action={t('btn_see_more', lang)} />
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">{profiles.map((profile) => <ProfileCard key={profile.id} profile={profile} />)}</div>
        </section>
        <button onClick={() => go('create')} className="h-14 w-full rounded-full bg-pink text-base font-black text-white shadow-floating">{t('btn_answer_q', lang)}</button>
      </div>
    </>
  );
}

// 自分のデータ（プロフ帳・回答・コイン・所持デコ等）を JSON でダウンロード＝万一の保険バックアップ
function exportMyData(): void {
  if (typeof window === 'undefined') return;
  const ls = (k: string) => localStorage.getItem(k);
  const json = (k: string) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
  const data = {
    _meta: { app: 'Miri', kind: 'backup', version: 1, exportedAt: new Date().toISOString() },
    profile: {
      info: json('profileBookInfo'),
      best3: json('best3'),
      monthly: json('miri_monthly_best3'),
      questions: json('profileQuestions'),
      customFields: json('profileCustomFields'),
    },
    answers: json('profilebook_answers_v2'),
    game: {
      coins: Number(ls('miri_coins') || '0'),
      ownedPacks: json('miri_owned_packs'),
      gachaStickers: json('miri_gacha_stickers'),
      ownedBgs: json('miri_owned_bgs'),
      equippedBg: ls('miri_equipped_bg'),
      shards: Number(ls('miri_bg_shards') || '0'),
      ownedThemes: json('miri_owned_themes'),
      appTheme: ls('appTheme'),
      coinHistory: json('miri_coin_history'),
    },
    bookmarks: json('miri_bookmarks'),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  a.href = url;
  a.download = `miri-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function MyPageScreen({ go, answers, avatarUrl, onGoBookmarks, ownedStickerCount, coins, lang, onLogout }: { go: (s: Screen, answerId?: string) => void; answers: Answer[]; avatarUrl: string; onGoBookmarks: () => void; ownedStickerCount: number; coins: number; lang: Lang; onLogout: () => void }) {
  const [tab, setTab] = useState<'answers' | 'saved' | 'drafts'>('answers');
  const myAnswers = answers.filter((a) => a.user.id === me.id);
  // 本番はフォロー中/フォロワー数をSupabaseから取得。デモ(①)はダミー件数。
  const [followCounts, setFollowCounts] = useState<{ following: number; followers: number }>(
    () => (isDev ? { following: followers.length, followers: followers.length } : { following: 0, followers: 0 }),
  );
  useEffect(() => {
    if (isDev || !dbReady()) return;
    let cancelled = false;
    getFollowCounts().then((c) => { if (!cancelled) setFollowCounts(c); });
    return () => { cancelled = true; };
  }, []);
  return (
    <>
      <AppHeader title={t('header_mypage', lang)} onBell={() => go('notifications')} />
      <div className="space-y-5 px-4 pt-3">
        <section
  onClick={() => go('profile')}
  className="cursor-pointer rounded-[32px] bg-white p-5 shadow-card transition active:scale-[0.99]"
>
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-4">
      <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-pink/10 text-3xl">
        {avatarUrl ? <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" /> : '📷'}
      </div>
      <div>
        <p className="text-xl font-black text-ink">{me.name}</p>
        <p className="text-sm font-bold text-muted">{me.id}</p>
      </div>
    </div>
    <span className="text-xs font-black text-pink">{t('btn_view_profile_book', lang)}</span>
  </div>

  <div className="mt-5 grid grid-cols-4 rounded-[24px] bg-pink/5 p-4 text-center text-sm font-black text-ink">
    <div>
      <p className="text-xl">{myAnswers.length}</p>
      <p>{t('label_answers', lang)}</p>
    </div>
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        go('followers');
      }}
      className="rounded-2xl transition hover:bg-white/70 active:scale-[0.98]"
    >
      <p className="text-xl">{followCounts.following}</p>
      <p className="text-[11px]">{t('btn_following', lang)}</p>
    </button>
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        go('followers');
      }}
      className="rounded-2xl transition hover:bg-white/70 active:scale-[0.98]"
    >
      <p className="text-xl">{followCounts.followers}</p>
      <p className="text-[11px]">{t('label_followers_count', lang)}</p>
    </button>
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); go('shop'); }}
      className="rounded-2xl transition hover:bg-white/70 active:scale-[0.98]"
    >
      <p className="text-xl">{ownedStickerCount}</p>
      <p className="text-[11px]">{t('label_stamps_count', lang)}</p>
    </button>
  </div>
</section>

        {/* コイン残高バナー */}
        <button
          onClick={() => go('wallet')}
          className="flex items-center justify-between rounded-[24px] bg-gradient-to-r from-amber-400 to-orange-400 px-5 py-4 shadow-card transition active:scale-[0.98]"
        >
          <div className="text-left">
            <p className="text-[10px] font-black text-white/80">{t('coins_wallet', lang)}</p>
            <p className="text-2xl font-black text-white"><CoinIcon size={22} /> {coins.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-black text-white/90">{t('coins_earn', lang)} →</p>
            <p className="text-[10px] font-bold text-white/70">{t('btn_coin_history', lang)}</p>
          </div>
        </button>

        {/* ログアウト（コインウォレットと同列に配置して分かりやすく） */}
        <button
          onClick={onLogout}
          className="flex w-full items-center justify-between rounded-[24px] border-2 border-red-200 bg-white px-5 py-4 shadow-card transition active:scale-[0.98]"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-red-50 text-red-500">
              <LogOut size={18} />
            </span>
            <p className="text-sm font-black text-red-500">{t('btn_logout', lang)}</p>
          </div>
          <span className="text-xs font-black text-red-400">→</span>
        </button>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onGoBookmarks}
            className="flex items-center gap-3 rounded-[24px] bg-white p-4 shadow-card transition active:scale-[0.98]"
          >
            <span className="grid h-10 w-10 place-items-center rounded-full bg-pink/15 text-pink">
              <Bookmark size={18} />
            </span>
            <div className="text-left">
              <p className="text-sm font-black text-ink">{t('nav_bookmark', lang)}</p>
              <p className="text-xs font-bold text-muted">{t('nav_saved_answers', lang)}</p>
            </div>
          </button>
          <button
            onClick={() => go('shop')}
            className="flex items-center gap-3 rounded-[24px] bg-white p-4 shadow-card transition active:scale-[0.98]"
          >
            <span className="grid h-10 w-10 place-items-center rounded-full bg-purple/15 text-purple">
              <ShoppingBag size={18} />
            </span>
            <div className="text-left">
              <p className="text-sm font-black text-ink">{t('nav_shop', lang)}</p>
              <p className="text-xs font-bold text-muted">{t('nav_theme_sticker', lang)}</p>
            </div>
          </button>
        </div>

        {/* データバックアップ（JSONで手元に保存＝万一の保険） */}
        <button
          onClick={exportMyData}
          className="flex w-full items-center justify-between rounded-[24px] border-2 border-mint bg-white px-5 py-4 shadow-card transition active:scale-[0.98]"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-mint/40 text-xl">💾</span>
            <div className="text-left">
              <p className="text-sm font-black text-ink">{t('mypage_backup', lang)}</p>
              <p className="text-xs font-bold text-muted">{t('mypage_backup_desc', lang)}</p>
            </div>
          </div>
          <span className="text-xs font-black text-muted">↓</span>
        </button>

      </div>
    </>
  );
}

function ProfileLine({ label, value }: { label: string; value: string }) {
  const hideEmpty = useContext(HideEmptyProfileContext);
  // 他人のプロフ帳では未入力（空欄）の項目は表示しない
  if (hideEmpty && !(value ?? '').trim()) return null;
  // 平成プロフ帳の“書き込み欄”：印刷された項目名 → 点線の記入線に手書き回答。
  return (
    <div className="flex items-end gap-2.5 py-1.5">
      <span className="pb-label max-w-[42%] shrink-0 pb-1">{label}</span>
      <span className="pb-writeline min-w-0 flex-1 text-[16px] leading-snug text-ink prof-hand">{value}</span>
    </div>
  );
}

// メモ用紙に書く項目（座右の銘・将来の夢）。1行で終わらない回答も読みやすく。
function MemoLine({ label, value, quote = false, tone = 'cream' }: { label: string; value: string; quote?: boolean; tone?: 'cream' | 'sax' }) {
  const hideEmpty = useContext(HideEmptyProfileContext);
  if (hideEmpty && !(value ?? '').trim()) return null;
  const v = (value ?? '').trim();
  return (
    <div className={`pb-memo my-2 ${tone === 'sax' ? 'pb-memo-sax rotate-[0.4deg]' : 'rotate-[-0.4deg]'}`}>
      <p className="pb-label absolute left-3 top-1.5">{label}</p>
      <p className="min-h-[1.6em] pt-2 text-[17px] leading-relaxed text-ink prof-hand">
        {v && quote ? `「${v.replace(/^「|」$/g, '')}」` : v}
      </p>
    </div>
  );
}

// すき・きらい：形の違う記入枠（ハート/×/パレット/星）に手書きで書き込む
function FavBubble({ label, value, shape = 'heart', mark, children }: { label: string; value: string; shape?: 'heart' | 'cross' | 'color' | 'star'; mark?: string; children?: React.ReactNode }) {
  const hideEmpty = useContext(HideEmptyProfileContext);
  if (hideEmpty && !(value ?? '').trim()) return null;
  return (
    <ShapedFrame shape={shape} label={label} mark={mark}>
      <span className="block min-h-[1.5em] break-words text-[17px] leading-snug text-ink prof-hand">{value}</span>
      {children}
    </ShapedFrame>
  );
}

// 時間割のマス（すきな教科・にがてな教科）
function SubjectCell({ label, value }: { label: string; value: string }) {
  const hideEmpty = useContext(HideEmptyProfileContext);
  if (hideEmpty && !(value ?? '').trim()) return null;
  return (
    <div className="pb-cell">
      <p className="pb-cell-head pb-label">{label}</p>
      <p className="min-h-[2.4em] break-words px-2.5 py-1.5 text-[16px] leading-snug text-ink prof-hand">{value}</p>
    </div>
  );
}

// BEST3 の記入欄（印刷の ①②③ ＋ 手書き）。他人のプロフ帳では空いている行は出さない。
function Best3Lines({ items, hideEmpty }: { items: string[]; hideEmpty: boolean }) {
  const rows = [0, 1, 2].map((i) => ({ i, v: (items[i] ?? '').trim() })).filter((r) => !hideEmpty || r.v);
  return (
    <ol className="mt-1 space-y-1">
      {rows.map(({ i, v }) => (
        <li key={i} className="flex items-end gap-2">
          <span className="pb-num mb-1" aria-hidden>{i + 1}</span>
          <span className="sr-only">{i + 1}位</span>
          <span className="pb-writeline min-w-0 flex-1 text-[16px] leading-snug text-ink prof-hand">{v}</span>
        </li>
      ))}
    </ol>
  );
}

// 「すきな色」の文字から色見本を作る（わかる色だけ・最大3つ。わからなければ出さない）
const COLOR_WORDS: Array<[RegExp, string]> = [
  [/ピンク|桃|pink/i, '#F7A1C4'], [/ラベンダー|lavender/i, '#B9A3E3'], [/紫|むらさき|パープル|purple|violet/i, '#8E4EC6'],
  [/水色|みずいろ|スカイ|sky|light ?blue/i, '#7CC7F2'], [/紺|ネイビー|navy/i, '#1F2C56'], [/青|あお|ブルー|blue/i, '#3E63DD'],
  [/赤|あか|レッド|red/i, '#E5484D'], [/オレンジ|橙|orange/i, '#F59E42'], [/黄|きいろ|イエロー|yellow/i, '#F5D547'],
  [/ミント|mint/i, '#9FE2C9'], [/緑|みどり|グリーン|green/i, '#46A758'], [/ベージュ|beige/i, '#E8D5B5'],
  [/茶|ちゃいろ|ブラウン|brown/i, '#9A6B4A'], [/金|ゴールド|gold/i, '#D4AF37'], [/銀|シルバー|silver/i, '#C0C0C8'],
  [/グレー|灰|gr[ae]y/i, '#9CA3AF'], [/白|しろ|ホワイト|white/i, '#FFFFFF'], [/黒|くろ|ブラック|black/i, '#222222'],
];
function swatchesOf(text: string): string[] {
  const out: string[] = [];
  for (const part of (text ?? '').split(/[\/／・,、&＆と]+/)) {
    const hit = COLOR_WORDS.find(([re]) => re.test(part));
    if (hit && !out.includes(hit[1])) out.push(hit[1]);
    if (out.length >= 3) break;
  }
  return out;
}

// 関係性から「仲良し度」を算出（1〜3）。なかよし成立＞相互フォロー＞片方向。
function closenessOf(uid: string, opts: { friendIds: Set<string>; followingIds: Set<string>; followerIds: Set<string> }) {
  if (opts.friendIds.has(uid)) return { level: 3, label: 'なかよし' };
  if (opts.followingIds.has(uid) && opts.followerIds.has(uid)) return { level: 2, label: '相互フォロー' };
  return { level: 1, label: 'フォロー' };
}

function FollowersScreen({ go, lang = 'ja' }: { go: (s: Screen, payload?: any) => void; lang?: Lang }) {
  const [tab, setTab] = useState<'following' | 'followers' | 'requests'>('following');
  const [following, setFollowing] = useState<ProfileRow[]>([]);
  const [followerList, setFollowerList] = useState<ProfileRow[]>([]);
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [incoming, setIncoming] = useState<ProfileRow[]>([]);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // デモ(①)ではダミーユーザーで仲良し度を見せる
    if (isDev) {
      const rows: ProfileRow[] = followers.map((f) => ({
        id: f.id, username: f.id.replace(/^@/, ''), display_name: f.name,
        avatar_url: f.avatar, cover_theme: null, book: {}, is_official: false, titles: [],
      }));
      setFollowing(rows);
      setFollowerList([...rows].reverse());
      // 先頭2人を「なかよし」、残りは相互フォロー扱い（デモ用）
      setFriendIds(new Set(rows.slice(0, 2).map((r) => r.id)));
      // デモでは受信申請サンプルを1件表示
      setIncoming(rows.slice(2, 3));
      setLoading(false);
      return;
    }
    if (!dbReady()) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const [fg, fl, fr, inc] = await Promise.all([getFollowing(), getFollowers(), getFriendIds(), getIncomingFriendRequests()]);
      if (cancelled) return;
      setFollowing(fg); setFollowerList(fl); setFriendIds(new Set(fr)); setIncoming(inc); setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  async function accept(person: ProfileRow) {
    setAccepting(person.id);
    if (!isDev && dbReady()) {
      await acceptFriend(person.id);
      void createNotification(person.id, 'friend_accept');
    }
    setIncoming((prev) => prev.filter((p) => p.id !== person.id));
    setFriendIds((prev) => new Set(prev).add(person.id));
    setAccepting(null);
  }

  const followingIds = new Set(following.map((p) => p.id));
  const followerIds = new Set(followerList.map((p) => p.id));
  const list = tab === 'following' ? following : followerList;

  return (
    <>
      <AppHeader title={t('header_follow', lang)} back onBack={() => go('mypage')} onBell={() => go('notifications')} />
      <div className="space-y-4 px-4 pt-3">
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-base p-1">
          <button onClick={() => setTab('following')}
            className={`rounded-xl py-2 text-sm font-black transition ${tab === 'following' ? 'bg-white shadow-card text-pink' : 'text-muted'}`}>
            {t('btn_following', lang)} {following.length}
          </button>
          <button onClick={() => setTab('followers')}
            className={`rounded-xl py-2 text-sm font-black transition ${tab === 'followers' ? 'bg-white shadow-card text-pink' : 'text-muted'}`}>
            {t('label_followers_tab', lang)} {followerList.length}
          </button>
          <button onClick={() => setTab('requests')}
            className={`relative rounded-xl py-2 text-sm font-black transition ${tab === 'requests' ? 'bg-white shadow-card text-purple' : 'text-muted'}`}>
            {t('fr_requests_tab', lang)} {incoming.length}
            {incoming.length > 0 && tab !== 'requests' && (
              <span className="absolute right-1.5 top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-purple px-1 text-[9px] font-black text-white">{incoming.length}</span>
            )}
          </button>
        </div>

        {/* なかよし申請（受信） */}
        {tab === 'requests' && (
          <section className="space-y-3">
            {loading && <div className="rounded-[24px] bg-white p-6 text-center text-sm font-bold text-muted shadow-card">{t('loading', lang)}</div>}
            {!loading && incoming.length === 0 && (
              <div className="rounded-[24px] bg-white p-6 text-center text-sm font-bold text-muted shadow-card">
                {t('fr_no_requests', lang)}
              </div>
            )}
            {incoming.map((person) => (
              <div key={person.id} className="flex items-center gap-3 rounded-[24px] bg-white p-4 shadow-card">
                <button onClick={() => go('profile', '@' + person.username)}
                  className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-purple/10 text-2xl">
                  {person.avatar_url && person.avatar_url.startsWith('http')
                    ? <img src={person.avatar_url} alt="" className="h-full w-full object-cover" />
                    : (person.avatar_url || '📷')}
                </button>
                <button onClick={() => go('profile', '@' + person.username)} className="min-w-0 flex-1 text-left">
                  <p className="font-black">{person.display_name || person.username}</p>
                  <p className="text-xs font-bold text-muted">📖 {t('fr_wants_swap', lang)}</p>
                </button>
                <button
                  onClick={() => accept(person)}
                  disabled={accepting === person.id}
                  className="shrink-0 rounded-full bg-purple px-4 py-2 text-[12px] font-black text-white transition active:scale-95 disabled:opacity-50"
                >
                  {accepting === person.id ? '…' : `✅ ${t('fr_accept', lang)}`}
                </button>
              </div>
            ))}
          </section>
        )}

        {tab !== 'requests' && (
        <section className="space-y-3">
          {loading && <div className="rounded-[24px] bg-white p-6 text-center text-sm font-bold text-muted shadow-card">{t('loading', lang)}</div>}
          {!loading && list.length === 0 && (
            <div className="rounded-[24px] bg-white p-6 text-center text-sm font-bold text-muted shadow-card">
              {tab === 'following' ? t('fl_none_following', lang) : t('fl_none_followers', lang)}
            </div>
          )}
          {list.map((person) => {
            const close = closenessOf(person.id, { friendIds, followingIds, followerIds });
            return (
              <button
                key={person.id}
                onClick={() => go('profile', '@' + person.username)}
                className="flex w-full items-center gap-3 rounded-[24px] bg-white p-4 text-left shadow-card transition active:scale-[0.98]"
              >
                <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-pink/15 text-2xl">
                  {person.avatar_url && person.avatar_url.startsWith('http')
                    ? <img src={person.avatar_url} alt="" className="h-full w-full object-cover" />
                    : (person.avatar_url || '📷')}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-black">{person.display_name || person.username}</p>
                  <p className="text-xs font-bold text-muted">@{person.username}</p>
                  {/* 仲良し度（ハート） */}
                  <div className="mt-1 flex items-center gap-1">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className={`text-xs ${i < close.level ? '' : 'opacity-20 grayscale'}`}>💗</span>
                    ))}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-2 text-[11px] font-black ${close.level === 3 ? 'bg-pink/15 text-pink' : close.level === 2 ? 'bg-purple/10 text-purple' : 'bg-base text-muted'}`}>
                  {tv(close.label, lang)}
                </span>
              </button>
            );
          })}
        </section>
        )}
      </div>
    </>
  );
}

// アメブロ風：今日の気分・天気・見出し色の選択肢
const DIARY_MOODS = ['😊', '🥰', '😆', '😌', '😴', '😢', '😤', '🤔', '😳', '😑'];
const DIARY_WEATHERS = ['☀️', '⛅', '☁️', '🌧️', '⛈️', '❄️', '🌈', '🌙'];
const DIARY_TITLE_COLORS: { label: string; value: string; cls: string }[] = [
  { label: 'ピンク', value: '#EC4899', cls: 'text-pink' },
  { label: 'むらさき', value: '#8B5CF6', cls: 'text-purple' },
  { label: 'あお', value: '#3B82F6', cls: 'text-blue-500' },
  { label: 'みどり', value: '#10B981', cls: 'text-emerald-500' },
  { label: 'オレンジ', value: '#F59E0B', cls: 'text-amber-500' },
  { label: 'こげ茶', value: '#78350F', cls: 'text-amber-900' },
];

// 記事の書き込みフォーム（タイトル・気分・天気・見出し色・本文・写真・プレビュー）を共通化
function DiaryComposer({
  title, setTitle, body, setBody, mood, setMood, weather, setWeather,
  titleColor, setTitleColor, photoUrl, setPhotoUrl, bodyRef, ngError, onBodyChange,
  simple = false, bodyPlaceholder,
}: {
  title: string; setTitle: (v: string) => void;
  body: string; setBody: (v: string) => void;
  mood: string; setMood: (v: string) => void;
  weather: string; setWeather: (v: string) => void;
  titleColor: string; setTitleColor: (v: string) => void;
  photoUrl: string; setPhotoUrl: (v: string) => void;
  bodyRef: React.RefObject<HTMLTextAreaElement | null>;
  ngError?: boolean;
  onBodyChange?: (v: string) => void;
  // simple=交換日記（タイトル/気分/天気/見出し色なしの「書き込み」）／false=ブログ（記事）
  simple?: boolean;
  bodyPlaceholder?: string;
}) {
  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  }
  const hasPreview = title.trim() || body.trim() || mood || weather || photoUrl;
  return (
    <>
      {/* 記事タイトル・見出し色・気分・天気（ブログのみ。交換日記=simpleでは非表示） */}
      {!simple && (
      <>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={40}
        placeholder="タイトル（例：今日のできごと♪）"
        className="mb-2 w-full rounded-2xl border border-purple/15 bg-white px-4 py-2.5 text-base font-black outline-none focus:border-pink"
        style={{ color: titleColor }}
      />
      {/* タイトル色（デコ） */}
      <div className="mb-3 flex items-center gap-1.5">
        <span className="text-[10px] font-black text-muted">見出し色</span>
        {DIARY_TITLE_COLORS.map((c) => (
          <button key={c.value} type="button" aria-label={c.label} onClick={() => setTitleColor(c.value)}
            className={`h-6 w-6 rounded-full transition ${titleColor === c.value ? 'ring-2 ring-offset-1 ring-ink/40 scale-110' : ''}`}
            style={{ backgroundColor: c.value }} />
        ))}
      </div>
      {/* 今日の気分・天気 */}
      <div className="mb-3 space-y-2 rounded-2xl bg-cream/30 p-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="shrink-0 text-[10px] font-black text-muted">気分</span>
          {DIARY_MOODS.map((m) => (
            <button key={m} type="button" onClick={() => setMood(mood === m ? '' : m)}
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-lg transition ${mood === m ? 'bg-pink/20 ring-1 ring-pink' : 'hover:bg-white'}`}>{m}</button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="shrink-0 text-[10px] font-black text-muted">天気</span>
          {DIARY_WEATHERS.map((w) => (
            <button key={w} type="button" onClick={() => setWeather(weather === w ? '' : w)}
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-lg transition ${weather === w ? 'bg-blue-100 ring-1 ring-blue-300' : 'hover:bg-white'}`}>{w}</button>
          ))}
        </div>
      </div>
      </>
      )}
      {photoUrl && (
        <div className="relative mb-3 inline-block">
          <img src={photoUrl} alt="preview" className="h-24 w-24 rounded-2xl object-cover" />
          <button type="button" onClick={() => setPhotoUrl('')}
            className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-pink text-[10px] font-black text-white shadow">✕</button>
        </div>
      )}
      <RetroEmojiPicker onInsert={(code) => insertRetroCode(bodyRef, code, setBody)} />
      <textarea
        ref={bodyRef}
        value={body}
        onChange={(e) => { setBody(e.target.value); onBodyChange?.(e.target.value); }}
        maxLength={200}
        rows={3}
        placeholder={bodyPlaceholder ?? 'あの頃の思い出を書いてね（200文字以内）'}
        className="mt-2 w-full resize-none rounded-2xl border border-purple/15 bg-cream/20 px-4 py-3 text-sm font-bold text-ink outline-none focus:border-pink"
      />
      <div className="mt-2 flex items-center gap-3">
        <span className="text-xs font-bold text-muted">{body.length}/200</span>
        <label className="cursor-pointer rounded-full bg-pink/10 px-3 py-1.5 text-xs font-black text-pink">
          📷 写真をつける
          <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
        </label>
      </div>
      {ngError && (
        <p className="mt-2 rounded-2xl bg-pink/10 px-3 py-2 text-xs font-black text-pink">不適切な言葉が含まれています。書き直してね。</p>
      )}
      {/* プレビュー */}
      {hasPreview && (
        <div className="mt-3 overflow-hidden rounded-2xl border border-purple/20">
          <div className="flex items-center justify-between bg-gradient-to-r from-pink/10 to-purple/10 px-3 py-1.5">
            <span className="text-[10px] font-black text-muted">プレビュー</span>
            {!simple && <span className="text-base">{weather}{mood}</span>}
          </div>
          <div className="bg-white px-4 py-3">
            {!simple && title.trim() && (
              <p className="mb-1 text-base font-black leading-snug" style={{ color: titleColor }}>✿ <RetroText text={title} /></p>
            )}
            <p className="min-h-[1.5rem] text-sm font-bold leading-7 text-ink"><RetroText text={body} /></p>
            {photoUrl && <img src={photoUrl} alt="" className="mt-2 w-full rounded-xl object-cover" />}
          </div>
        </div>
      )}
    </>
  );
}

// 書いた人の「わたしのペン」で本文を表示（ペン未設定なら従来の文字）
function AuthorPenText({ userId, className = '', base = '15px', children }: { userId: string; className?: string; base?: string; children: React.ReactNode }) {
  const pen = useUserPen(userId);
  if (!pen) return <p className={className}>{children}</p>;
  return <p {...penAttrs(pen)} style={{ ...penAttrs(pen).style, ['--pen-base' as any]: base }} className={`${className} pen-text pen-size`}>{children}</p>;
}

function DiaryListScreen({
  go,
  diaryPages,
}: {
  go: (s: Screen, payload?: any) => void;
  diaryPages: DiaryPage[];
}) {
  const lang = useLang();
  return (
    <>
      <AppHeader title={t('sec_diary', lang)} back onBack={() => go('home')} onBell={() => go('notifications')} />
      <div className="space-y-4 px-4 pt-3 pb-32">
        <button
          onClick={() => go('diary-create')}
          className="flex w-full items-center justify-center gap-2 rounded-[24px] bg-pink px-5 py-4 text-sm font-black text-white shadow-floating active:scale-[0.99]"
        >
          ＋ {t('dl_new', lang)}
        </button>
        <p className="px-1 text-xs font-bold text-muted">
          {t('dl_desc', lang)}
        </p>
        {diaryPages.length === 0 && (
          <div className="rounded-[28px] bg-white p-8 text-center text-sm font-bold text-muted shadow-card">
            {t('dl_empty', lang)}
          </div>
        )}
        {diaryPages.map((page) => (
          <button
            key={page.id}
            onClick={() => go('diary-detail', page.id)}
            className="pb-sheet relative w-full overflow-hidden py-5 pl-9 pr-5 text-left active:scale-[0.99]"
          >
            {/* ノートの背（とじ紐の穴） */}
            <span aria-hidden className="absolute inset-y-0 left-0 w-6 bg-[repeating-linear-gradient(180deg,transparent_0_14px,rgb(var(--pb-line)/.35)_14px_20px)] bg-[length:100%_34px] bg-pink/15" />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="pb-label">📓 {t('pen_font_tegaki', lang)}</p>
                <p className="mt-0.5 font-black text-ink">{page.theme}</p>
                <p className="mt-1 text-xs font-bold leading-5 text-muted">{page.description}</p>
              </div>
              <span className="shrink-0 rounded-full bg-cream px-3 py-1 text-xs font-black text-ink shadow-[0_2px_4px_rgba(0,0,0,.12)]">
                {tf('dl_pages', lang, { n: page.entries.length })}
              </span>
            </div>
            {page.entries.length > 0 && (() => {
              const latest = page.entries[page.entries.length - 1];
              return (
                <div className="pb-memo mt-3 !py-2">
                  <p className="pb-label">{t('dl_latest', lang)}</p>
                  <AuthorPenText userId={latest.authorId} base="14px" className="mt-0.5 line-clamp-1 text-xs font-black text-ink">
                    {latest.body.slice(0, 24) || t('dl_photo', lang)}
                  </AuthorPenText>
                </div>
              );
            })()}
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">{page.createdByAvatar}</span>
                <span className="text-xs font-bold text-muted">{tf('home_created_by', lang, { name: page.createdByName })}</span>
              </div>
              <span className={`rounded-full px-2 py-1 text-[10px] font-black ${
                page.visibility === 'public' ? 'bg-blue-50 text-blue-500' :
                page.visibility === 'followers' ? 'bg-base text-muted' :
                'bg-purple/10 text-purple'
              }`}>
                {page.visibility === 'public' ? `🌍 ${t('diary_aud_public', lang)}` : page.visibility === 'followers' ? `👥 ${t('create_vis_followers', lang)}` : `✉️ ${t('dl_invite_only', lang)}`}
              </span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

function DiaryDetailScreen({
  go,
  page,
  onAddEntry,
  onEditEntry,
  onDeleteEntry,
  onReportEntry,
  onToggleLike,
  onAddComment,
  sharedMode = false,
}: {
  go: (s: Screen) => void;
  page: DiaryPage;
  onAddEntry: (pageId: string, data: { body: string; photoUrl?: string; title?: string; mood?: string; weather?: string; textColor?: string }) => void;
  onEditEntry: (pageId: string, entryId: string, data: { body: string; photoUrl?: string; title?: string; mood?: string; weather?: string; textColor?: string }) => void;
  onDeleteEntry: (pageId: string, entryId: string) => void;
  onReportEntry: (pageId: string, entryId: string) => void;
  onToggleLike: (pageId: string, entryId: string) => void;
  onAddComment: (pageId: string, entryId: string, body: string) => void;
  sharedMode?: boolean;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [mood, setMood] = useState<string>('');
  const [weather, setWeather] = useState<string>('');
  const [titleColor, setTitleColor] = useState<string>(DIARY_TITLE_COLORS[0].value);
  const [ngError, setNgError] = useState(false);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const diaryBodyRef = useRef<HTMLTextAreaElement>(null);

  const today = new Date().toDateString();
  const todaysMyEntry = page.entries.find(
    (e) => e.authorId === me.id && new Date(e.postedAt).toDateString() === today
  ) ?? null;

  useEffect(() => {
    if (todaysMyEntry) {
      setTitle(todaysMyEntry.title ?? '');
      setBody(todaysMyEntry.body);
      setPhotoUrl(todaysMyEntry.photoUrl ?? '');
      setMood(todaysMyEntry.mood ?? '');
      setWeather(todaysMyEntry.weather ?? '');
      setTitleColor(todaysMyEntry.textColor ?? DIARY_TITLE_COLORS[0].value);
    } else {
      setTitle('');
      setBody('');
      setPhotoUrl('');
      setMood('');
      setWeather('');
      setTitleColor(DIARY_TITLE_COLORS[0].value);
    }
    setNgError(false);
  }, [page.id]);

  function toggleCommentsOpen(id: string) {
    setOpenComments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function submitComment(entryId: string) {
    const text = (commentDraft[entryId] ?? '').trim();
    if (!text || containsNgWord(text)) return;
    onAddComment(page.id, entryId, text);
    setCommentDraft((prev) => ({ ...prev, [entryId]: '' }));
  }

  // 共有モードでは「見られている＝書き込み権あり」（RLSで read≒write のため）
  const canWrite = sharedMode ||
    page.visibility === 'public' ||
    page.visibility === 'followers' ||
    page.createdBy === me.id ||
    page.mentionedUserIds.includes(me.id);

  const canSubmit = canWrite && body.trim().length > 0 && !containsNgWord(body);

  function submit() {
    if (containsNgWord(body)) { setNgError(true); return; }
    if (!canWrite) return;
    const data = { body: body.trim(), photoUrl: photoUrl || undefined, title: title.trim() || undefined, mood: mood || undefined, weather: weather || undefined, textColor: titleColor };
    if (todaysMyEntry) {
      onEditEntry(page.id, todaysMyEntry.id, data);
    } else {
      onAddEntry(page.id, data);
      setTitle('');
      setBody('');
      setPhotoUrl('');
      setMood('');
      setWeather('');
    }
    setNgError(false);
  }

  function canDeleteEntry(entry: DiaryEntry) {
    return entry.authorId === me.id || page.createdBy === me.id;
  }

  const visibilityLabel =
    page.visibility === 'public' ? '🌍 全体公開' :
    page.visibility === 'followers' ? '👥 フォロワー全員' :
    `✉️ 招待制（${page.mentionedUserIds.length}人）`;

  return (
    <>
      <AppHeader title={page.theme} back onBack={() => go('diary-list')} onBell={() => go('notifications')} />
      <div className="space-y-4 px-4 pt-3 pb-8">
        {/* テーマカード */}
        <section className="pb-sheet pb-grid p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <TapeLabel tone="cream" rotate={-2}>📓 交換ノート</TapeLabel>
            <span className="rounded-full bg-cream px-3 py-1 text-[11px] font-black text-ink">{visibilityLabel}</span>
          </div>
          <p className="text-sm font-bold leading-6 text-ink">{page.description}</p>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-lg">{page.createdByAvatar}</span>
            <span className="text-xs font-black text-muted">{page.createdByName} が作成・{page.entries.length}件の書き込み</span>
          </div>
        </section>

        {/* 書き込み一覧 */}
        {page.entries.length === 0 && (
          <div className="rounded-[28px] bg-white p-8 text-center text-sm font-bold text-muted shadow-card">
            まだ書き込みがないよ。最初の一言を書いてみて！
          </div>
        )}
        {page.entries.map((entry) => {
          const d = new Date(entry.postedAt);
          const dateStr = d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
          const timeStr = d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
          const commentsOpen = openComments.has(entry.id);
          const commentCount = entry.comments?.length ?? 0;
          return (
          <article key={entry.id} className="pb-sheet overflow-hidden">
            {/* ページの上（日付＋気分・天気） */}
            <div className="flex items-center justify-between border-b-2 border-dotted border-ink/15 px-4 py-2">
              <p className="pb-label">🗓 {dateStr} {timeStr}</p>
              <div className="flex items-center gap-1 text-base">
                {entry.weather && <span title="天気">{entry.weather}</span>}
                {entry.mood && <span title="気分">{entry.mood}</span>}
              </div>
            </div>

            <div className="p-4">
              {/* 記事タイトル（大きく・カラフル） */}
              {entry.title && (
                <h3 className="mb-2 text-lg font-black leading-snug" style={{ color: entry.textColor || '#EC4899' }}>
                  <span className="mr-1">✿</span><RetroText text={entry.title} />
                </h3>
              )}
              {/* 本文（書いた人のペンで） */}
              <AuthorPenText userId={entry.authorId} className="pb-ruled pb-ruled-rows text-sm font-bold leading-7 text-ink"><RetroText text={entry.body} /></AuthorPenText>
              {entry.photoUrl && (
                <div className="mt-3 overflow-hidden rounded-2xl">
                  <img src={entry.photoUrl} alt="entry photo" className="w-full object-cover" />
                </div>
              )}

              {/* 署名 */}
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-pink/10 text-lg">{entry.authorAvatar}</span>
                  <p className="text-xs font-black text-ink">{entry.authorName}</p>
                </div>
                <div className="flex gap-1">
                  {canDeleteEntry(entry) && (
                    <button onClick={() => setConfirmDeleteId(entry.id)} className="rounded-full bg-pink/10 px-2 py-1 text-[10px] font-black text-pink">削除</button>
                  )}
                  {reportedIds.has(entry.id) ? (
                    <span className="rounded-full bg-base px-2 py-1 text-[10px] font-bold text-muted">報告済</span>
                  ) : (
                    <button
                      onClick={() => { onReportEntry(page.id, entry.id); setReportedIds((prev) => new Set([...prev, entry.id])); }}
                      className="rounded-full bg-base px-2 py-1 text-[10px] font-black text-muted"
                    >報告</button>
                  )}
                </div>
              </div>
            </div>

            {/* いいね・コメント（交換日記はシンプルなので共有モードでは非表示） */}
            {!sharedMode && (<>
            <div className="flex items-center gap-2 border-t border-pink/10 px-4 py-2.5">
              <button
                onClick={() => onToggleLike(page.id, entry.id)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black transition active:scale-95 ${entry.likedByMe ? 'bg-pink/15 text-pink' : 'bg-base text-muted'}`}
              >
                <Heart size={15} fill={entry.likedByMe ? 'currentColor' : 'none'} className={entry.likedByMe ? 'heart-pop' : ''} />
                いいね {entry.likes ?? 0}
              </button>
              <button
                onClick={() => toggleCommentsOpen(entry.id)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black transition active:scale-95 ${commentsOpen ? 'bg-purple/15 text-purple' : 'bg-base text-muted'}`}
              >
                💬 コメント {commentCount}
              </button>
            </div>

            {/* コメント欄 */}
            {commentsOpen && (
              <div className="space-y-2 border-t border-pink/10 bg-cream/20 px-4 py-3">
                {commentCount === 0 && <p className="text-[11px] font-bold text-muted">まだコメントはありません。最初のコメントを送ってみよう！</p>}
                {entry.comments?.map((c) => (
                  <div key={c.id} className="flex items-start gap-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-sm shadow-sm">{c.authorAvatar}</span>
                    <div className="min-w-0 flex-1 rounded-2xl bg-white px-3 py-2 shadow-sm">
                      <p className="text-[11px] font-black text-ink">{c.authorName}</p>
                      <p className="text-xs font-bold leading-5 text-ink"><RetroText text={c.body} /></p>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    value={commentDraft[entry.id] ?? ''}
                    onChange={(e) => setCommentDraft((prev) => ({ ...prev, [entry.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitComment(entry.id); }}
                    maxLength={100}
                    placeholder="コメントを書く…"
                    className="min-w-0 flex-1 rounded-full border border-purple/15 bg-white px-4 py-2 text-xs font-bold text-ink outline-none focus:border-pink"
                  />
                  <button
                    onClick={() => submitComment(entry.id)}
                    disabled={!(commentDraft[entry.id] ?? '').trim()}
                    className="shrink-0 rounded-full bg-purple px-4 py-2 text-[11px] font-black text-white disabled:opacity-40"
                  >送信</button>
                </div>
              </div>
            )}
            </>)}
          </article>
          );
        })}

        {/* 書き込みフォーム or 権限なし表示 */}
        {canWrite ? (
          <section className="rounded-[32px] bg-white p-5 shadow-card">
            <p className="mb-3 text-sm font-black text-ink">
              {todaysMyEntry ? '✏️ 今日の書き込みを修正する' : '✍ 書き込む'}
            </p>
            {todaysMyEntry && (
              <p className="mb-2 rounded-2xl bg-purple/10 px-3 py-2 text-xs font-black text-purple">
                今日はすでに書き込み済みです。内容を修正できます。
              </p>
            )}
            <DiaryComposer
              simple
              bodyPlaceholder="このテーマへのひとことを書いてね（200文字以内）"
              title={title} setTitle={setTitle}
              body={body} setBody={setBody}
              mood={mood} setMood={setMood}
              weather={weather} setWeather={setWeather}
              titleColor={titleColor} setTitleColor={setTitleColor}
              photoUrl={photoUrl} setPhotoUrl={setPhotoUrl}
              bodyRef={diaryBodyRef} ngError={ngError}
              onBodyChange={() => { if (ngError) setNgError(false); }}
            />
            <div className="mt-3 flex justify-end">
              <button
                onClick={submit}
                disabled={!canSubmit}
                className="rounded-full bg-pink px-6 py-2 text-sm font-black text-white shadow-card disabled:opacity-40 active:scale-[0.98]"
              >
                {todaysMyEntry ? '修正する' : '書く'}
              </button>
            </div>
          </section>
        ) : (
          <div className="rounded-[28px] bg-white p-6 text-center text-sm font-bold text-muted shadow-card">
            この日記は招待されたメンバーのみ書き込めます ✉️
          </div>
        )}
      </div>

      {/* 削除確認モーダル */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-6">
          <div className="w-full max-w-xs rounded-[28px] bg-white p-6 shadow-2xl">
            <p className="text-center text-sm font-black text-ink">この書き込みを削除しますか？</p>
            <p className="mt-1 text-center text-xs font-bold text-muted">削除したら元に戻せません</p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 rounded-full border border-purple/20 py-3 text-sm font-black text-muted"
              >
                キャンセル
              </button>
              <button
                onClick={() => { onDeleteEntry(page.id, confirmDeleteId); setConfirmDeleteId(null); }}
                className="flex-1 rounded-full bg-pink py-3 text-sm font-black text-white"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DiaryCreateScreen({
  go,
  onCreate,
}: {
  go: (s: Screen, payload?: any) => void;
  onCreate: (theme: string, description: string, firstEntryBody: string, firstPhotoUrl: string, visibility: 'public' | 'followers' | 'mentioned', mentionedUserIds: string[], firstMeta?: { title?: string; mood?: string; weather?: string; textColor?: string }) => string;
}) {
  const [theme, setTheme] = useState('');
  const [description, setDescription] = useState('');
  const [firstEntryBody, setFirstEntryBody] = useState('');
  const [firstPhotoUrl, setFirstPhotoUrl] = useState('');
  const [firstTitle, setFirstTitle] = useState('');
  const [firstMood, setFirstMood] = useState('');
  const [firstWeather, setFirstWeather] = useState('');
  const [firstTitleColor, setFirstTitleColor] = useState(DIARY_TITLE_COLORS[0].value);
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'mentioned'>('followers');
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const firstBodyRef = useRef<HTMLTextAreaElement>(null);

  const canCreate = theme.trim().length > 0 && (visibility === 'followers' || mentionedUserIds.length > 0);

  // 招待できる相手＝自分のフォロワー。デモ(①)はダミー、本番はSupabaseから取得。
  const [inviteList, setInviteList] = useState<{ id: string; name: string; avatar: string }[]>(
    () => (isDev ? followers.map((f) => ({ id: f.id, name: f.name, avatar: f.avatar })) : []),
  );
  useEffect(() => {
    if (isDev || !dbReady()) return;
    let cancelled = false;
    getFollowers().then((rows) => {
      if (cancelled) return;
      setInviteList(rows.map((r) => ({
        id: '@' + r.username,
        name: r.display_name || r.username,
        avatar: r.avatar_url && !r.avatar_url.startsWith('http') && !r.avatar_url.startsWith('data:') ? r.avatar_url : '📷',
      })));
    });
    return () => { cancelled = true; };
  }, []);

  const [mentionSearch, setMentionSearch] = useState('');
  const mq = mentionSearch.trim().toLowerCase();
  // 検索語（名前 or @ユーザー名）で絞り込み。選択済みの人は絞り込んでも常に表示する。
  const shownInvitees = mq
    ? inviteList.filter((f) => mentionedUserIds.includes(f.id) || f.name.toLowerCase().includes(mq) || f.id.toLowerCase().includes(mq))
    : inviteList;
  // フォロワー以外も全体検索して招待できる（本番のみ）
  const [searchedUsers, setSearchedUsers] = useState<{ id: string; name: string; avatar: string }[]>([]);
  useEffect(() => {
    const q = mentionSearch.trim();
    if (isDev || !dbReady() || q.length < 1) { setSearchedUsers([]); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const rows = await searchProfiles(q);
      if (cancelled) return;
      const followerIds = new Set(inviteList.map((f) => f.id));
      setSearchedUsers(
        rows
          .map((r) => ({ id: '@' + r.username, name: r.display_name || r.username, avatar: r.avatar_url && !r.avatar_url.startsWith('http') && !r.avatar_url.startsWith('data:') ? r.avatar_url : '📷' }))
          .filter((u) => u.id !== me.id && !followerIds.has(u.id)),
      );
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentionSearch]);

  function toggleMention(userId: string) {
    setMentionedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  return (
    <>
      <AppHeader title="日記を作る" back onBack={() => go('diary-list')} onBell={() => go('notifications')} />
      <div className="space-y-4 px-4 pt-3 pb-32">

        {/* テーマ・説明 */}
        <section className="space-y-4 rounded-[32px] bg-white p-5 shadow-card">
          <p className="font-black text-ink">テーマを決めてね</p>
          <label className="block">
            <span className="text-xs font-black text-muted">テーマ（30文字以内）</span>
            <input
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              maxLength={30}
              placeholder="例：給食の思い出"
              className="mt-1 w-full rounded-2xl border border-purple/15 bg-cream/20 px-4 py-3 text-sm font-bold text-ink outline-none focus:border-pink"
            />
          </label>
          <label className="block">
            <span className="text-xs font-black text-muted">みんなへのひとこと（80文字以内）</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={80}
              rows={2}
              placeholder="例：学校の給食で好きだったもの教えて！"
              className="mt-1 w-full resize-none rounded-2xl border border-purple/15 bg-cream/20 px-4 py-3 text-sm font-bold text-ink outline-none focus:border-pink"
            />
          </label>
        </section>

        {/* 書き込める相手 */}
        <section className="rounded-[32px] bg-white p-5 shadow-card">
          <p className="mb-3 font-black text-ink">書き込める相手</p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setVisibility('followers')}
              className={`rounded-2xl py-3 text-xs font-black transition ${visibility === 'followers' ? 'bg-pink text-white shadow-card' : 'bg-base text-muted'}`}
            >
              👥 フォロワー
            </button>
            <button
              onClick={() => setVisibility('mentioned')}
              className={`rounded-2xl py-3 text-xs font-black transition ${visibility === 'mentioned' ? 'bg-purple text-white shadow-card' : 'bg-base text-muted'}`}
            >
              ✉️ 特定の人
            </button>
            <button
              onClick={() => setVisibility('public')}
              className={`rounded-2xl py-3 text-xs font-black transition ${visibility === 'public' ? 'bg-blue-400 text-white shadow-card' : 'bg-base text-muted'}`}
            >
              🌍 全体
            </button>
          </div>

          {visibility === 'mentioned' && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-black text-muted">招待するフォロワーを選んでね（{mentionedUserIds.length}人選択中）</p>
              {/* ユーザー名で検索 */}
              <input
                value={mentionSearch}
                onChange={(e) => setMentionSearch(e.target.value)}
                placeholder="🔍 名前・@ユーザー名で検索"
                className="w-full rounded-full border border-purple/15 bg-base px-4 py-2 text-sm font-bold text-ink placeholder:text-muted placeholder:font-normal outline-none focus:border-pink"
              />
              {inviteList.length === 0 && (
                <p className="rounded-2xl bg-base px-3 py-3 text-xs font-bold text-muted">まだフォロワーがいません。フォロワーが増えると、ここから招待できます。</p>
              )}
              {inviteList.length > 0 && shownInvitees.length === 0 && (
                <p className="rounded-2xl bg-base px-3 py-3 text-xs font-bold text-muted">「{mentionSearch}」に一致するフォロワーはいません。</p>
              )}
              {shownInvitees.map((f) => {
                const selected = mentionedUserIds.includes(f.id);
                return (
                  <button
                    key={f.id}
                    onClick={() => toggleMention(f.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${selected ? 'bg-purple/10' : 'bg-base'}`}
                  >
                    <span className="text-xl">{f.avatar}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-ink">{f.name}</span>
                      <span className="block truncate text-[11px] font-bold text-muted">{f.id}</span>
                    </span>
                    <span className={`shrink-0 text-xs font-black ${selected ? 'text-purple' : 'text-muted'}`}>
                      {selected ? '✓ 招待中' : '招待する'}
                    </span>
                  </button>
                );
              })}
              {/* フォロワー以外の全体検索結果 */}
              {searchedUsers.length > 0 && (
                <>
                  <p className="pt-2 text-[10px] font-black text-muted">他のユーザー</p>
                  {searchedUsers.map((u) => {
                    const selected = mentionedUserIds.includes(u.id);
                    return (
                      <button key={u.id} onClick={() => toggleMention(u.id)}
                        className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${selected ? 'bg-purple/10' : 'bg-base'}`}>
                        <span className="text-xl">{u.avatar}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-black text-ink">{u.name}</span>
                          <span className="block truncate text-[11px] font-bold text-muted">{u.id}</span>
                        </span>
                        <span className={`shrink-0 text-xs font-black ${selected ? 'text-purple' : 'text-muted'}`}>{selected ? '✓ 招待中' : '招待する'}</span>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </section>

        {/* 最初の書き込み（任意）— 交換日記はシンプルな書き込み（本文＋写真） */}
        <section className="rounded-[32px] bg-white p-5 shadow-card">
          <p className="mb-1 font-black text-ink">最初の書き込み <span className="text-xs font-bold text-muted">（任意）</span></p>
          <p className="mb-3 text-xs font-bold text-muted">日記を作ったあと、最初のひとことを残せます（あとから詳細画面でも書けます）</p>
          <DiaryComposer
            simple
            bodyPlaceholder="最初のひとことを書いてもいいよ（200文字以内）"
            title={firstTitle} setTitle={setFirstTitle}
            body={firstEntryBody} setBody={setFirstEntryBody}
            mood={firstMood} setMood={setFirstMood}
            weather={firstWeather} setWeather={setFirstWeather}
            titleColor={firstTitleColor} setTitleColor={setFirstTitleColor}
            photoUrl={firstPhotoUrl} setPhotoUrl={setFirstPhotoUrl}
            bodyRef={firstBodyRef}
          />
        </section>

        <div className="rounded-2xl bg-purple/5 px-4 py-3 text-xs font-bold leading-5 text-muted">
          ⚠️ 誹謗中傷・個人情報の書き込みは禁止です。違反した書き込みは作成者が削除できます。
        </div>

        <button
          disabled={!canCreate}
          onClick={() => {
            const id = onCreate(theme.trim(), description.trim(), firstEntryBody, firstPhotoUrl, visibility, mentionedUserIds, { title: firstTitle, mood: firstMood, weather: firstWeather, textColor: firstTitleColor });
            if (id) go('diary-detail', id);
          }}
          className="h-14 w-full rounded-full bg-pink text-base font-black text-white shadow-floating disabled:opacity-40 active:scale-[0.98]"
        >
          日記を作ってまわす ✉️
        </button>
      </div>
    </>
  );
}

// ===================== ブログ画面（個人記事・交換日記とは別機能） =====================

// ============ アメブロ風ブログ：リッチ本文 ============
// 本文(body)にマークアップを埋め込んで保存（SQL不要）。
//  先頭 [[bg:ID]] = 記事背景 / 行頭 "# " = 見出し(大) / "## " = 見出し(小)
//  行 "---" = 区切り線 / 行 [[img:URL]] = 画像 / 本文内 [[c:#hex]]..[[/c]] = 文字色
//  [[hl]]..[[/hl]] or [[hl:#hex]] = ハイライト / [[big]]..[[/big]] 大 / [[small]]..[[/small]] 小
type BlogBlock =
  | { type: 'p'; text: string }
  | { type: 'h'; level: 2 | 3; text: string }
  | { type: 'img'; url: string }
  | { type: 'hr'; variant?: string; color?: string }
  | { type: 'space' };

// 区切り線バリエーション（ギャルっぽい装飾ライン）
const BLOG_DIVIDERS: { id: string; label: string; text: string }[] = [
  { id: 'line',    label: '線',     text: '' },
  { id: 'hearts',  label: 'ハート', text: '♡ ⋆ ｡ ⋆ ♡ ⋆ ｡ ⋆ ♡' },
  { id: 'stars',   label: 'スター', text: '⋆ ✦ ⋆ ✧ ⋆ ✦ ⋆ ✧ ⋆' },
  { id: 'ribbon',  label: 'リボン', text: '･ﾟ✧ ── ✿ ── ✧ﾟ･' },
  { id: 'sparkle', label: 'キラ',   text: '✩°｡ ⋆⸜ ♡ ⸝⋆ ｡°✩' },
  { id: 'wave',    label: 'なみ',   text: '～★～☆～★～☆～' },
];
const DIVIDER_TEXT: Record<string, string> = Object.fromEntries(BLOG_DIVIDERS.map((d) => [d.id, d.text]));

const BLOG_BG: { id: string; label: string; style: React.CSSProperties }[] = [
  { id: 'plain',    label: 'なし',       style: { background: '#ffffff' } },
  { id: 'cream',    label: 'クリーム',   style: { background: '#FFF8EE' } },
  { id: 'sakura',   label: 'さくら',     style: { background: 'linear-gradient(160deg,#fff1f6,#ffe3ef)' } },
  { id: 'sky',      label: 'そら',       style: { background: 'linear-gradient(160deg,#eef6ff,#dcecff)' } },
  { id: 'mint',     label: 'ミント',     style: { background: 'linear-gradient(160deg,#effaf3,#dcf3e6)' } },
  { id: 'lemon',    label: 'レモン',     style: { background: 'linear-gradient(160deg,#fffbe6,#fff2c2)' } },
  { id: 'lavender', label: 'ラベンダー', style: { background: 'linear-gradient(160deg,#f5f0ff,#e9e0ff)' } },
  { id: 'dot',      label: 'ドット',     style: { backgroundColor: '#fff7fb', backgroundImage: 'radial-gradient(rgba(236,72,153,.12) 1.4px, transparent 1.4px)', backgroundSize: '14px 14px' } },
  { id: 'grid',     label: '方眼',       style: { backgroundColor: '#ffffff', backgroundImage: 'linear-gradient(rgba(120,120,160,.10) 1px,transparent 1px),linear-gradient(90deg,rgba(120,120,160,.10) 1px,transparent 1px)', backgroundSize: '20px 20px' } },
];
const BLOG_BG_BY_ID = Object.fromEntries(BLOG_BG.map((b) => [b.id, b]));

// body から背景IDとブロック列を取り出す
function parseBlogDoc(body: string): { bgId: string; blocks: BlogBlock[] } {
  let text = body ?? '';
  let bgId = 'plain';
  const bgM = text.match(/^\[\[bg:([a-z0-9_-]+)\]\]\n?/i);
  if (bgM) { bgId = bgM[1]; text = text.slice(bgM[0].length); }
  const blocks: BlogBlock[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (/^\s*---\s*$/.test(line)) { blocks.push({ type: 'hr' }); continue; }
    const hrv = line.match(/^\[\[hr:([a-z]+)(?::(#[0-9a-fA-F]{3,8}))?\]\]$/);
    if (hrv) { blocks.push({ type: 'hr', variant: hrv[1], color: hrv[2] || undefined }); continue; }
    const img = line.match(/^\[\[img:([\s\S]+)\]\]$/);
    if (img) { blocks.push({ type: 'img', url: img[1] }); continue; }
    // 素の data:image 行（テキストとして混入した画像）も画像として扱う＝救済。
    if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(line)) { blocks.push({ type: 'img', url: line }); continue; }
    const h3 = line.match(/^##\s+(.*)$/);
    if (h3) { blocks.push({ type: 'h', level: 3, text: h3[1] }); continue; }
    const h2 = line.match(/^#\s+(.*)$/);
    if (h2) { blocks.push({ type: 'h', level: 2, text: h2[1] }); continue; }
    if (line.trim() === '') { blocks.push({ type: 'space' }); continue; }
    blocks.push({ type: 'p', text: line });
  }
  return { bgId, blocks };
}

// 一覧・フィードのプレビュー用：マークアップを外したプレーン文字列
function blogPlain(body: string): string {
  let t = body ?? '';
  t = t.replace(/^\[\[bg:[^\]]+\]\]\n?/i, '');
  t = t.replace(/^\[\[img:[^\]]+\]\]$/gim, '');
  t = t.replace(/^data:image\/[a-z0-9.+-]+;base64,\S*/gim, '');
  t = t.replace(/^\[\[hr:[^\]]+\]\]$/gim, '');
  t = t.replace(/^\s*---\s*$/gim, '');
  t = t.replace(/^#{1,2}\s+/gim, '');
  t = t.replace(/\[\[\/?(?:c(?::#[0-9a-fA-F]{3,8})?|hl(?::#[0-9a-fA-F]{3,8})?|big|small|b|u)\]\]/g, '');
  return t.replace(/\n{2,}/g, '\n').trim();
}

// インライン装飾のスタイル
function blogInlineStyle(tag: string): React.CSSProperties {
  const style: React.CSSProperties = {};
  if (tag.startsWith('c:#')) style.color = tag.slice(2);
  else if (tag.startsWith('hl')) {
    style.backgroundColor = tag.includes(':#') ? tag.split(':')[1] : '#fff59d';
    style.borderRadius = '.15em';
    (style as any).boxDecorationBreak = 'clone';
    (style as any).WebkitBoxDecorationBreak = 'clone';
    style.padding = '.02em .08em';
  }
  else if (tag === 'big') style.fontSize = '1.35em';
  else if (tag === 'small') style.fontSize = '0.82em';
  else if (tag === 'b') style.fontWeight = 900;
  else if (tag === 'u') style.textDecoration = 'underline';
  return style;
}
const BLOG_OPEN_RE = /\[\[(c:#[0-9a-fA-F]{3,8}|hl(?::#[0-9a-fA-F]{3,8})?|big|small|b|u)\]\]/;
const BLOG_TOKEN_RE = /\[\[(\/)?(?:c(?::#[0-9a-fA-F]{3,8})?|hl(?::#[0-9a-fA-F]{3,8})?|big|small|b|u)\]\]/g;
let __blogKey = 0;
// 本文内のインライン装飾（色・ハイライト・大小・太字・下線）を「入れ子対応」で描画。
function renderBlogSeg(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    const om = rest.match(BLOG_OPEN_RE);
    if (!om || om.index === undefined) { out.push(<RetroText key={__blogKey++} text={rest} />); break; }
    if (om.index > 0) out.push(<RetroText key={__blogKey++} text={rest.slice(0, om.index)} />);
    const tag = om[1];
    const contentStart = i + om.index + om[0].length;
    // このタグに対応する閉じ（入れ子を数えて depth が 0 に戻る位置）を探す
    BLOG_TOKEN_RE.lastIndex = contentStart;
    let depth = 1; let mm: RegExpExecArray | null; let closeStart = -1; let closeEnd = -1;
    while ((mm = BLOG_TOKEN_RE.exec(text))) {
      if (mm[1] === '/') depth--; else depth++;
      if (depth === 0) { closeStart = mm.index; closeEnd = BLOG_TOKEN_RE.lastIndex; break; }
    }
    if (closeStart === -1) { out.push(<RetroText key={__blogKey++} text={rest} />); break; }
    const inner = text.slice(contentStart, closeStart);
    out.push(<span key={__blogKey++} style={blogInlineStyle(tag)}>{renderBlogSeg(inner)}</span>);
    i = closeEnd;
  }
  return out;
}
function renderBlogInline(text: string): React.ReactNode[] {
  __blogKey = 0;
  return renderBlogSeg(text);
}

// ブログ本文レンダラ（詳細で使用）
function BlogBody({ body, titleColor }: { body: string; titleColor?: string }) {
  const { blocks } = parseBlogDoc(body);
  return (
    <div className="space-y-1.5">
      {blocks.map((b, i) => {
        if (b.type === 'hr') {
          if (b.variant && b.variant !== 'line' && DIVIDER_TEXT[b.variant] !== undefined)
            return <div key={i} className="my-4 text-center text-sm font-black tracking-widest" style={{ color: b.color || 'rgba(236,72,153,.7)' }}>{DIVIDER_TEXT[b.variant]}</div>;
          return <hr key={i} className="my-4 border-0 border-t-2 border-dashed" style={{ borderTopColor: b.color || 'rgba(236,72,153,.3)' }} />;
        }
        if (b.type === 'space') return <div key={i} className="h-2.5" />;
        if (b.type === 'img') return <div key={i} className="my-3 overflow-hidden rounded-2xl shadow-sm"><img src={b.url} alt="" className="w-full object-cover" /></div>;
        if (b.type === 'h') return b.level === 3
          ? <h4 key={i} className="mt-3 mb-0.5 text-base font-black" style={{ color: titleColor || '#EC4899' }}>{renderBlogInline(b.text)}</h4>
          : <h3 key={i} className="mt-4 mb-1 border-l-4 border-pink/40 pl-2 text-lg font-black leading-snug" style={{ color: titleColor || '#EC4899' }}>{renderBlogInline(b.text)}</h3>;
        return <p key={i} className="text-base font-semibold leading-8 text-ink">{renderBlogInline(b.text)}</p>;
      })}
    </div>
  );
}

// contentEditable の内容を「安全マークアップ」に直列化（保存・表示は React の BlogBody＝HTML注入なしでXSS安全）
function rgbToHex(c: string): string {
  if (!c) return '';
  if (c.startsWith('#')) return c;
  const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return c;
  return '#' + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
}
function serializeInline(node: Node): string {
  let out = '';
  node.childNodes.forEach((ch) => {
    if (ch.nodeType === 3) { out += ch.nodeValue ?? ''; return; }
    if (ch.nodeType !== 1) return;
    const el = ch as HTMLElement;
    if (el.tagName === 'BR') { out += '\n'; return; }
    let inner = serializeInline(el);
    const st = el.style;
    const tag = el.tagName;
    const fs = parseFloat(st.fontSize) || 0;
    if (fs >= 1.2) inner = `[[big]]${inner}[[/big]]`;
    else if (fs > 0 && fs <= 0.95) inner = `[[small]]${inner}[[/small]]`;
    const underline = tag === 'U' || (st.textDecoration || st.textDecorationLine || '').includes('underline');
    if (underline) inner = `[[u]]${inner}[[/u]]`;
    const bold = tag === 'B' || tag === 'STRONG' || st.fontWeight === 'bold' || (parseInt(st.fontWeight, 10) >= 600);
    if (bold) inner = `[[b]]${inner}[[/b]]`;
    const bg = st.backgroundColor;
    if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') inner = `[[hl:${rgbToHex(bg)}]]${inner}[[/hl]]`;
    const col = st.color;
    if (col) inner = `[[c:${rgbToHex(col)}]]${inner}[[/c]]`;
    out += inner;
  });
  return out;
}
function serializeEditor(root: HTMLElement | null): string {
  if (!root) return '';
  const lines: string[] = [];
  const walk = (parent: HTMLElement) => {
    parent.childNodes.forEach((node) => {
      if (node.nodeType === 3) { const t = node.nodeValue ?? ''; if (t.trim() !== '') lines.push(t); return; }
      if (node.nodeType !== 1) return;
      const el = node as HTMLElement; const tag = el.tagName;
      if (tag === 'HR') { const c = el.getAttribute('data-color'); lines.push(c ? `[[hr:line:${c}]]` : '---'); return; }
      if (el.getAttribute('data-hr')) { const v = el.getAttribute('data-hr'); const c = el.getAttribute('data-color'); lines.push(c ? `[[hr:${v}:${c}]]` : `[[hr:${v}]]`); return; }
      if (tag === 'IMG') { lines.push(`[[img:${el.getAttribute('src') ?? ''}]]`); return; }
      if (tag === 'H1' || tag === 'H2') { lines.push('# ' + serializeInline(el)); return; }
      if (tag === 'H3' || tag === 'H4' || tag === 'H5' || tag === 'H6') { lines.push('## ' + serializeInline(el)); return; }
      if (tag === 'DIV' || tag === 'P') {
        const hasBlock = Array.from(el.childNodes).some((c) => c.nodeType === 1 && ['IMG', 'HR', 'DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes((c as HTMLElement).tagName));
        if (hasBlock) { walk(el); return; }
        lines.push(serializeInline(el));
        return;
      }
      lines.push(serializeInline(el));
    });
  };
  walk(root);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/g, '');
}

// アメブロ風 WYSIWYG エディタ：プレビュー＝編集面（contentEditable）。タグは一切見せない。
function BlogWysiwygEditor({
  title, setTitle, mood, setMood, weather, setWeather,
  titleColor, setTitleColor, bgId, setBgId, getBodyRef, onTextChange, ngError,
}: {
  title: string; setTitle: (v: string) => void;
  mood: string; setMood: (v: string) => void;
  weather: string; setWeather: (v: string) => void;
  titleColor: string; setTitleColor: (v: string) => void;
  bgId: string; setBgId: (v: string) => void;
  getBodyRef: React.MutableRefObject<() => string>;
  onTextChange: (hasText: boolean) => void;
  ngError?: boolean;
}) {
  const edRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const TEXT_COLORS = ['#EC4899', '#F97316', '#EAB308', '#22C55E', '#3B82F6', '#8B5CF6', '#111827'];
  const MARKER_COLORS = ['#fff59d', '#ffc9de', '#bfe3ff', '#c8f0cf', '#ffd8a8'];
  const [active, setActive] = useState<{ color: string; hl: string; bold: boolean; underline: boolean }>({ color: '', hl: '', bold: false, underline: false });
  // 直近に選んだ文字色。区切り線を挿入するときの色に使う（未選択なら標準のピンク）。
  const [pickedColor, setPickedColor] = useState('');

  useEffect(() => { getBodyRef.current = () => serializeEditor(edRef.current); }, [getBodyRef]);
  const notify = () => onTextChange(!!edRef.current?.textContent?.trim());
  // ツールバーをタップしても本文の選択を失わないように（iOSはpointerdownで抑止するのが確実）
  const keepSel = (e: React.SyntheticEvent) => e.preventDefault();

  // 現在カーソル位置に効いている装飾を取得（パレットのチェック表示用）
  function refreshActive() {
    const root = edRef.current;
    const sel = window.getSelection();
    if (!root || !sel || sel.rangeCount === 0 || !root.contains(sel.anchorNode)) return;
    try {
      setActive({
        color: rgbToHex(String(document.queryCommandValue('foreColor') || '')).toLowerCase(),
        hl: rgbToHex(String(document.queryCommandValue('backColor') || document.queryCommandValue('hiliteColor') || '')).toLowerCase(),
        bold: document.queryCommandState('bold'),
        underline: document.queryCommandState('underline'),
      });
    } catch {}
  }
  useEffect(() => {
    const h = () => refreshActive();
    document.addEventListener('selectionchange', h);
    return () => document.removeEventListener('selectionchange', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 色/ハイライト/太字/下線：execCommand で「選択に適用」も「以降の入力に継続」も両対応
  function exec(cmd: string, val?: string) {
    edRef.current?.focus();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(cmd, false, val);
    notify(); refreshActive();
  }
  const setColor = (col: string) => { setPickedColor(col); exec('foreColor', col); };
  function setHl(col: string) {
    edRef.current?.focus();
    document.execCommand('styleWithCSS', false, 'true');
    if (!document.execCommand('hiliteColor', false, col)) document.execCommand('backColor', false, col);
    notify(); refreshActive();
  }
  const toggleBold = () => exec('bold');
  const toggleUnderline = () => exec('underline');
  // 装飾を解除して以降の入力をプレーンに戻す（色・太字・下線・マーカーを一括オフ）
  function clearFmt() {
    edRef.current?.focus();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand('removeFormat');
    if (document.queryCommandState('underline')) document.execCommand('underline');
    if (document.queryCommandState('bold')) document.execCommand('bold');
    if (!document.execCommand('hiliteColor', false, 'transparent')) document.execCommand('backColor', false, 'transparent');
    notify(); refreshActive();
  }

  // 大／小は選択範囲を span で包む
  function wrapInline(css: string) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;
    const span = document.createElement('span');
    span.setAttribute('style', css);
    try { range.surroundContents(span); }
    catch { const frag = range.extractContents(); span.appendChild(frag); range.insertNode(span); }
    sel.removeAllRanges();
    notify();
  }
  function block(tag: string) { edRef.current?.focus(); document.execCommand('formatBlock', false, tag); notify(); }
  function insertHtml(html: string) { edRef.current?.focus(); document.execCommand('insertHTML', false, html); notify(); }
  function insertDivider(id: string) {
    const c = pickedColor; // 文字色パレットで選んだ色。未選択なら標準（ピンク）。
    if (id === 'line') {
      insertHtml(c ? `<hr data-color="${c}" style="border-top-color:${c}"><br>` : '<hr><br>');
      return;
    }
    const cattr = c ? ` data-color="${c}"` : '';
    const cstyle = c ? ` style="color:${c}"` : '';
    insertHtml(`<div data-hr="${id}"${cattr} contenteditable="false" class="blog-hr"${cstyle}>${DIVIDER_TEXT[id] || ''}</div><br>`);
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => insertHtml(`<img src="${String(ev.target?.result || '')}" alt=""><br>`);
    r.readAsDataURL(f); e.target.value = '';
  }
  function onPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    // 画像を貼り付けたときは <img> として挿入（テキストの data URI 混入を防ぐ）。
    const imgItem = Array.from(e.clipboardData.items || []).find((it) => it.kind === 'file' && it.type.startsWith('image/'));
    if (imgItem) {
      const file = imgItem.getAsFile();
      if (file) {
        const r = new FileReader();
        r.onload = (ev) => insertHtml(`<img src="${String(ev.target?.result || '')}" alt=""><br>`);
        r.readAsDataURL(file);
        return;
      }
    }
    const t = e.clipboardData.getData('text/plain');
    // テキストとして貼られた data:image URI も画像として挿入（生URIの混入を防ぐ）。
    if (/^\s*data:image\/[a-z0-9.+-]+;base64,/i.test(t)) {
      insertHtml(`<img src="${t.trim()}" alt=""><br>`);
      return;
    }
    document.execCommand('insertText', false, t);
    notify();
  }

  const btn = 'shrink-0 rounded-xl bg-white px-2.5 py-1.5 text-[11px] font-black text-ink shadow-card transition active:scale-90 hover:bg-pink/10';
  // 選択中（アクティブ）表現を全ボタン共通に：外枠を濃く強調＋少し大きく
  const btnActive = 'ring-2 ring-ink bg-pink/10 text-pink';
  const swatchActive = 'ring-2 ring-ink scale-110 shadow-card';
  const swatchIdle = 'ring-2 ring-white';
  // デコメ道具箱のタブ（押しても本文の選択を保つ）
  const [tool, setTool] = useState<'text' | 'pen' | 'marker' | 'deco' | 'line' | 'photo'>('text');
  const TOOLS: { id: typeof tool; label: string }[] = [
    { id: 'text', label: '✏️ 文字' }, { id: 'pen', label: '🖊 色ペン' }, { id: 'marker', label: '🖍 マーカー' },
    { id: 'deco', label: '✨ デコ絵文字' }, { id: 'line', label: '〰 区切り' }, { id: 'photo', label: '📷 写真' },
  ];
  // デコ絵文字はショートコード（例 [♥]）で入れる。できあがり（記事）ではドット絵で表示される。
  function insertDeco(code: string) {
    edRef.current?.focus();
    document.execCommand('insertText', false, code);
    notify();
  }

  return (
    <div className="space-y-3">
      {/* 記事の情報（タイトル・見出し色・気分・天気） */}
      <div className="gk-frame">
        <div className="gk-paper space-y-2.5 rounded-[10px] bg-[#fffafd] p-3">
          <p className="gk-font text-[11px] text-muted">■ 記事の情報</p>
          <input
            value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40}
            placeholder="タイトル（例：今日のできごと♪）" aria-label="タイトル"
            className="w-full rounded-md border-2 border-[#b9b3cf] bg-[#ffffff] px-3 py-2.5 text-base font-black outline-none focus:border-pink"
            style={{ color: titleColor }}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-black text-muted">見出し色</span>
            {DIARY_TITLE_COLORS.map((c) => (
              <button key={c.value} type="button" onClick={() => setTitleColor(c.value)} aria-label={c.label} aria-pressed={titleColor === c.value}
                className={`h-7 w-7 rounded-full transition active:scale-90 ${titleColor === c.value ? swatchActive : swatchIdle}`}
                style={{ background: c.value }} />
            ))}
          </div>
          {/* 気分（横1列・はみ出す分はスクロール） */}
          <div className="flex items-center gap-1">
            <span className="shrink-0 text-[11px] font-black text-muted">気分</span>
            <div className="flex flex-nowrap gap-1 overflow-x-auto">
              {DIARY_MOODS.map((m) => (
                <button key={m} type="button" onClick={() => setMood(mood === m ? '' : m)} aria-pressed={mood === m}
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg transition ${mood === m ? 'bg-pink/15 ring-1 ring-pink' : 'hover:bg-base'}`}>{m}</button>
              ))}
            </div>
          </div>
          {/* 天気（横1列・はみ出す分はスクロール） */}
          <div className="flex items-center gap-1">
            <span className="shrink-0 text-[11px] font-black text-muted">天気</span>
            <div className="flex flex-nowrap gap-1 overflow-x-auto">
              {DIARY_WEATHERS.map((w) => (
                <button key={w} type="button" onClick={() => setWeather(weather === w ? '' : w)} aria-pressed={weather === w}
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg transition ${weather === w ? 'bg-blue-100 ring-1 ring-blue-300' : 'hover:bg-base'}`}>{w}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* デコメ道具箱（ガラケーのデコメ編集のように、道具を選んで本文を飾る） */}
      <div className="gk-frame">
        <div className="gk-paper rounded-[10px] bg-[#fffafd] p-2">
          <div role="tablist" aria-label="デコメ道具箱" className="flex gap-1 overflow-x-auto border-b-2 border-pink/30 px-0.5">
            {TOOLS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tool === t.id}
                onPointerDown={keepSel} onClick={() => setTool(t.id)}
                className="gk-tab shrink-0">{t.label}</button>
            ))}
          </div>
          <div role="tabpanel" className="flex min-h-[52px] flex-wrap items-center gap-1.5 rounded-b-lg bg-[#ffffff] p-2">
            {tool === 'text' && (<>
              <button type="button" className={btn} onPointerDown={keepSel} onClick={() => block('h2')}>見出し</button>
              <button type="button" className={btn} onPointerDown={keepSel} onClick={() => block('h3')}>小見出し</button>
              <button type="button" className={`${btn} ${active.bold ? btnActive : ''}`} aria-pressed={active.bold} onPointerDown={keepSel} onClick={toggleBold}><b>B</b> 太字</button>
              <button type="button" className={`${btn} ${active.underline ? btnActive : ''}`} aria-pressed={active.underline} onPointerDown={keepSel} onClick={toggleUnderline}><u>U</u> 下線</button>
              <button type="button" className={btn} onPointerDown={keepSel} onClick={() => wrapInline('font-size:1.35em')}>大</button>
              <button type="button" className={btn} onPointerDown={keepSel} onClick={() => wrapInline('font-size:0.82em')}>小</button>
              <button type="button" className={btn} onPointerDown={keepSel} onClick={clearFmt}>✕ 解除</button>
              <button type="button" className={btn} onPointerDown={keepSel} onClick={() => block('p')}>戻す</button>
            </>)}
            {tool === 'pen' && (<>
              <span className="text-[11px] font-black text-muted">文字色</span>
              {TEXT_COLORS.map((col) => (
                <button key={col} type="button" onPointerDown={keepSel} onClick={() => setColor(col)} aria-label={`色 ${col}`} aria-pressed={active.color === col.toLowerCase()}
                  className={`h-8 w-8 rounded-full transition active:scale-90 ${active.color === col.toLowerCase() ? swatchActive : swatchIdle}`}
                  style={{ background: col }} />
              ))}
            </>)}
            {tool === 'marker' && (<>
              {MARKER_COLORS.map((col) => (
                <button key={col} type="button" onPointerDown={keepSel} onClick={() => setHl(col)} aria-label={`マーカー ${col}`} aria-pressed={active.hl === col.toLowerCase()}
                  className={`h-8 w-8 rounded-md transition active:scale-90 ${active.hl === col.toLowerCase() ? swatchActive : swatchIdle}`}
                  style={{ background: col }} />
              ))}
              <button type="button" onPointerDown={keepSel} onClick={() => setHl('transparent')} className={btn}>マーカーなし</button>
            </>)}
            {tool === 'deco' && (
              <div className="w-full" onPointerDown={keepSel} onMouseDown={keepSel}>
                <RetroEmojiPicker onInsert={insertDeco} />
                <p className="mt-1 text-[11px] font-bold text-muted">カーソルの位置に入ります。記事ではドット絵の絵文字になります。</p>
              </div>
            )}
            {tool === 'line' && BLOG_DIVIDERS.map((d) => (
              <button key={d.id} type="button" onPointerDown={keepSel} onClick={() => insertDivider(d.id)} className={btn}>
                {d.id === 'line' ? '― 線' : d.text.slice(0, 5)}
              </button>
            ))}
            {tool === 'photo' && (
              <button type="button" className={btn} onPointerDown={keepSel} onClick={() => fileRef.current?.click()}>🖼 写真をえらんで入れる</button>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
          </div>
        </div>
      </div>

      {/* 編集面＝できあがりそのまま（contentEditable） */}
      <p className="text-[11px] font-bold text-muted">👇 ここに直接書けます。文字を選んでから道具を押すと、その部分を飾れます。</p>
      <div
        ref={edRef}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        onInput={notify}
        onPaste={onPaste}
        role="textbox"
        aria-multiline="true"
        aria-label="ブログの本文"
        data-placeholder="ここに本文を書こう…"
        className="gk-paper blog-editable min-h-[240px] rounded-xl border-2 border-pink/25 p-4 text-base font-semibold leading-8 text-ink outline-none focus:border-pink"
        style={{ ...(BLOG_BG_BY_ID[bgId] ?? BLOG_BG[0]).style, ['--title-color' as any]: titleColor }}
      />
      {ngError && <p className="text-[11px] font-black text-red-500">不適切な語が含まれています。</p>}

      {/* 記事背景（編集面に即反映） */}
      <div>
        <p className="gk-font mb-1.5 text-[11px] text-muted">■ ブログの背景</p>
        <div className="flex flex-wrap gap-1.5">
          {BLOG_BG.map((b) => (
            <button key={b.id} type="button" onClick={() => setBgId(b.id)} title={b.label} aria-label={`背景 ${b.label}`} aria-pressed={bgId === b.id}
              className={`h-9 w-9 rounded-xl ring-2 transition ${bgId === b.id ? 'ring-pink scale-110' : 'ring-white'}`}
              style={b.style} />
          ))}
        </div>
      </div>
    </div>
  );
}


// ガラケーブログ風の日付（例：2026.10.24(土) 14:32）
function gkDate(iso: string, withTime = true): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const wd = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p2(d.getMonth() + 1)}.${p2(d.getDate())}(${wd})${withTime ? ` ${p2(d.getHours())}:${p2(d.getMinutes())}` : ''}`;
}

function BlogListScreen({ go, posts, onDelete }: { go: (s: Screen, payload?: any) => void; posts: BlogPost[]; onDelete?: (id: string) => void }) {
  const [tab, setTab] = useState<'all' | 'mine'>('all');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const base = tab === 'mine' ? posts.filter((p) => p.authorId === me.id) : posts;
  const sorted = [...base].sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
  const mineCount = posts.filter((p) => p.authorId === me.id).length;
  return (
    <>
      <AppHeader title="ブログ" back onBack={() => go('home')} onBell={() => go('notifications')} />
      <div className="space-y-4 px-4 pt-3 pb-32">
        {/* ブログのトップ（個人サイトの看板） */}
        <div className="gk-frame">
          <div className="gk-paper rounded-[10px] bg-[#fffafd] px-4 py-3 text-center">
            <p className="gk-font text-[11px] text-muted">☆*:.｡. Miri BLOG .｡.:*☆</p>
            <p className="gk-font mt-0.5 text-lg text-[#8a1c4a]">{tab === 'mine' ? 'じぶんのブログ' : 'みんなのブログ'}</p>
            <p className="mt-1 text-[12px] font-bold text-muted">{tab === 'mine' ? 'あなたが書いた記事の一覧です。' : 'いいね・コメントで反応できます。'}</p>
          </div>
        </div>
        <button onClick={() => go('blog-create')}
          className="gk-btn w-full !min-h-[52px] text-[15px]">
          ✎ ブログを書く
        </button>
        <div className="flex gap-1 border-b-2 border-pink/30 px-1" role="group" aria-label="表示するブログ">
          <button onClick={() => setTab('all')} aria-pressed={tab === 'all'} className="gk-tab">みんな</button>
          <button onClick={() => setTab('mine')} aria-pressed={tab === 'mine'} className="gk-tab">じぶん（{mineCount}）</button>
        </div>
        {sorted.length === 0 && (
          <div className="gk-frame"><div className="gk-paper rounded-[10px] bg-[#ffffff] p-8 text-center text-sm font-bold text-muted">
            {tab === 'mine' ? 'まだブログを投稿していません。' : 'まだブログがありません。最初のブログを書いてみて！'}
          </div></div>
        )}
        {sorted.map((p) => {
          const isNew = Date.now() - new Date(p.postedAt).getTime() < 24 * 3600 * 1000;
          return (
            <div key={p.id} className="gk-frame">
              <button onClick={() => go('blog-detail', p.id)}
                className="gk-paper block w-full overflow-hidden rounded-[10px] bg-[#ffffff] text-left active:scale-[0.995]">
                <div className="gk-datebar">
                  <span className="gk-font">{gkDate(p.postedAt)}{isNew && <span className="gk-new gk-font ml-2">NEW!</span>}</span>
                  <span className="text-base" aria-hidden>{p.weather}{p.mood}</span>
                </div>
                {p.photoUrl && (
                  <div className="h-40 w-full overflow-hidden bg-pink/5">
                    <img src={p.photoUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                )}
                <div className="px-4 pb-3 pt-3">
                  <p className="mb-1 text-base font-black leading-snug" style={{ color: p.textColor || '#EC4899' }}>☆彡 <RetroText text={p.title || '無題のブログ'} /></p>
                  <p className="line-clamp-2 text-sm font-bold leading-6 text-ink"><RetroText text={blogPlain(p.body)} /></p>
                  <p className="mt-1 text-right text-[12px] font-black text-[#8a1c4a]">つづきを読む »</p>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t-2 border-dotted border-pink/20 px-4 py-2 text-[12px] font-black text-muted">
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); go('profile', p.authorId); }}
                    className="-m-1 flex items-center gap-1.5 rounded-full p-1 transition hover:bg-pink/5 cursor-pointer"
                  >
                    <AvatarBubble value={p.authorAvatar} className="h-7 w-7 text-sm" />
                    <span className="text-ink">{p.authorName}</span>
                  </span>
                  <span className="ml-auto flex items-center gap-1"><Heart size={13} fill={p.likedByMe ? 'currentColor' : 'none'} className={p.likedByMe ? 'text-pink' : ''} />いいね({p.likes})</span>
                  <span>💬 コメント({p.comments.length})</span>
                  {onDelete && p.authorId === me.id && (
                    <span role="button" tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); setConfirmId(p.id); }}
                      className="rounded px-1.5 py-0.5 text-[11px] font-black text-[#B91C1C] underline decoration-dotted">削除</span>
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </div>
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-6" onClick={() => setConfirmId(null)}>
          <div className="w-full max-w-xs rounded-[28px] bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-center text-sm font-black text-ink">このブログを削除しますか？</p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setConfirmId(null)} className="flex-1 rounded-full border border-purple/20 py-3 text-sm font-black text-muted">キャンセル</button>
              <button onClick={() => { onDelete?.(confirmId); setConfirmId(null); }} className="flex-1 rounded-full bg-pink py-3 text-sm font-black text-white">削除する</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function BlogCreateScreen({ go, onCreate }: { go: (s: Screen, payload?: any) => void; onCreate: (data: { title?: string; mood?: string; weather?: string; body: string; photoUrl?: string; textColor?: string; visibility: 'public' | 'followers' }) => Promise<string> | string }) {
  const [title, setTitle] = useState('');
  const [mood, setMood] = useState('');
  const [weather, setWeather] = useState('');
  const [titleColor, setTitleColor] = useState(DIARY_TITLE_COLORS[0].value);
  const [bgId, setBgId] = useState('plain');
  const [visibility, setVisibility] = useState<'public' | 'followers'>('public');
  const [ngError, setNgError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [hasText, setHasText] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const getBodyRef = useRef<() => string>(() => '');
  const canPost = hasText && !submitting;

  // 投稿が「完了」するまでスピナーを回し続け、完了したら詳細へ遷移する。
  async function submit() {
    if (submitting) return; // 連打防止
    const bodyText = (getBodyRef.current?.() ?? '').trim();
    if (!bodyText) return;
    if (containsNgWord(bodyText)) { setNgError(true); return; }
    setSaveError(false);
    setSubmitting(true);
    try {
      const finalBody = (bgId && bgId !== 'plain' ? `[[bg:${bgId}]]\n` : '') + bodyText;
      const id = await onCreate({ title: title.trim() || undefined, mood: mood || undefined, weather: weather || undefined, body: finalBody, textColor: titleColor, visibility });
      if (id) { go('blog-detail', id); return; } // 遷移後はこの画面が消えるので submitting は戻さない
      setSaveError(true); setSubmitting(false);
    } catch {
      setSaveError(true); setSubmitting(false);
    }
  }

  return (
    <>
      <AppHeader title="ブログを書く" back onBack={() => go('blog-list')} onBell={() => go('notifications')} />
      <div className="space-y-4 px-4 pt-3 pb-32">
        <section>
          <BlogWysiwygEditor
            title={title} setTitle={setTitle}
            mood={mood} setMood={setMood}
            weather={weather} setWeather={setWeather}
            titleColor={titleColor} setTitleColor={setTitleColor}
            bgId={bgId} setBgId={setBgId}
            getBodyRef={getBodyRef}
            onTextChange={(has) => { setHasText(has); if (ngError) setNgError(false); }}
            ngError={ngError}
          />
        </section>
        <section className="gk-frame">
          <div className="gk-paper rounded-[10px] bg-[#fffafd] p-3">
            <p className="gk-font mb-2 text-[11px] text-muted">■ 公開範囲</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setVisibility('public')} aria-pressed={visibility === 'public'} className="gk-btn">🌍 全体に公開</button>
              <button onClick={() => setVisibility('followers')} aria-pressed={visibility === 'followers'} className="gk-btn">👥 フォロワー</button>
            </div>
          </div>
        </section>
        <button onClick={submit} disabled={!canPost}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-pink text-base font-black text-white shadow-floating disabled:opacity-40 active:scale-[0.98]">
          {submitting
            ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> 投稿中…</>
            : <>ブログを投稿する ✿</>}
        </button>
        {saveError && <p className="text-center text-xs font-black text-red-500">投稿に失敗しました。もう一度お試しください。</p>}
      </div>
    </>
  );
}

function BlogDetailScreen({ go, post, onToggleLike, onAddComment, onDelete }: {
  go: (s: Screen, payload?: any) => void;
  post: BlogPost;
  onToggleLike: (postId: string) => void;
  onAddComment: (postId: string, body: string) => void;
  onDelete: (postId: string) => void;
}) {
  const [comment, setComment] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const isMine = post.authorId === me.id;
  const blogBg = (BLOG_BG_BY_ID[parseBlogDoc(post.body).bgId] ?? BLOG_BG[0]).style;
  function submitComment() {
    const text = comment.trim();
    if (!text || containsNgWord(text)) return;
    onAddComment(post.id, text);
    setComment('');
  }
  return (
    <>
      <AppHeader title="ブログ" back onBack={() => go('blog-list')} onBell={() => go('notifications')} />
      <div className="space-y-4 px-4 pt-3 pb-8">
        <div className="gk-frame">
          <article className="gk-paper overflow-hidden rounded-[10px] bg-[#ffffff]">
            <div className="gk-datebar">
              <p className="gk-font">{gkDate(post.postedAt)}</p>
              <div className="flex items-center gap-1 text-base" aria-label={`天気と気分 ${post.weather ?? ''}${post.mood ?? ''}`}>{post.weather}{post.mood}</div>
            </div>
            <div className="p-4" style={blogBg}>
              <h3 className="mb-3 border-b-2 border-dotted pb-2 text-xl font-black leading-snug" style={{ color: post.textColor || '#EC4899', borderColor: `${post.textColor || '#EC4899'}55` }}>☆彡 <RetroText text={post.title || '無題のブログ'} /></h3>
              {post.photoUrl && <div className="mb-3 overflow-hidden rounded-2xl"><img src={post.photoUrl} alt="" className="w-full object-cover" /></div>}
              <BlogBody body={post.body} titleColor={post.textColor} />
              <p className="gk-font mt-4 text-right text-[11px] text-muted">posted by {post.authorName}</p>
            </div>
            {/* いいね・コメント・リンク（平成のホームページ風の出っ張ったボタン） */}
            <div className="flex flex-wrap items-center gap-2 border-t-2 border-dotted border-pink/20 bg-[#fffafd] px-4 py-2.5">
              <button onClick={() => onToggleLike(post.id)} aria-pressed={post.likedByMe} className="gk-btn">
                <Heart size={15} fill={post.likedByMe ? 'currentColor' : 'none'} className={post.likedByMe ? 'heart-pop text-pink' : ''} />いいね！({post.likes})
              </button>
              <a href="#blog-comments" className="gk-btn">💬 コメント({post.comments.length})</a>
              {post.visibility === 'public' && !post.id.startsWith('b-') && (
                <button
                  onClick={async () => {
                    const url = `${location.origin}/b/${post.id}`;
                    try {
                      if (navigator.share) { await navigator.share({ title: post.title || 'ブログ', url }); }
                      else { await navigator.clipboard.writeText(url); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 1800); }
                    } catch { try { await navigator.clipboard.writeText(url); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 1800); } catch {} }
                  }}
                  className="gk-btn ml-auto">
                  {linkCopied ? '✓ コピー済' : '🔗 リンク'}
                </button>
              )}
            </div>
          </article>
        </div>

        {/* この記事を書いた人（前略プロフの自己紹介枠） */}
        <div className="gk-frame">
          <div className="gk-paper flex items-center gap-3 rounded-[10px] bg-[#ffffff] px-4 py-3">
            <AvatarBubble value={post.authorAvatar} className="h-12 w-12 text-xl" />
            <div className="min-w-0 flex-1">
              <p className="gk-font text-[11px] text-muted">★この記事を書いた人</p>
              <p className="truncate text-sm font-black text-ink">{post.authorName}</p>
            </div>
            <button type="button" onClick={() => go('profile', post.authorId)} className="gk-btn shrink-0">プロフを見る »</button>
          </div>
          {isMine && (
            <div className="gk-paper mt-1.5 flex justify-end rounded-[10px] bg-[#fffffff0] px-4 py-2">
              <button onClick={() => setConfirmDelete(true)} className="gk-btn !text-[#B91C1C]">🗑 この記事を削除</button>
            </div>
          )}
        </div>

        {/* コメント欄（番号つき） */}
        <section id="blog-comments" className="gk-frame scroll-mt-20">
          <div className="gk-paper rounded-[10px] bg-[#ffffff] px-4 py-3">
            <p className="gk-font text-sm text-[#8a1c4a]">■ コメント（{post.comments.length}）</p>
            {post.comments.length === 0 && <p className="py-2 text-[12px] font-bold text-muted">まだコメントはありません。最初のひとことをどうぞ！</p>}
            <ol>
              {post.comments.map((c, i) => (
                <li key={c.id} className="gk-comment">
                  <span className="gk-comment-no gk-font" aria-hidden>{i + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-black text-ink">
                      <span aria-hidden className="mr-1">{c.authorAvatar}</span>{c.authorName}
                      {c.postedAt && <span className="gk-font ml-2 text-[10px] font-normal text-muted">{gkDate(c.postedAt)}</span>}
                    </p>
                    <p className="mt-0.5 text-[13px] font-bold leading-6 text-ink"><RetroText text={c.body} /></p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="flex items-center gap-2 pt-3">
              <input value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submitComment(); }}
                maxLength={100} placeholder="コメントを書く…" aria-label="コメントを書く"
                className="min-h-[40px] min-w-0 flex-1 rounded-md border-2 border-[#b9b3cf] bg-white px-3 py-2 text-[13px] font-bold text-ink outline-none focus:border-pink" />
              <button onClick={submitComment} disabled={!comment.trim()} className="gk-btn shrink-0 disabled:opacity-40">送信</button>
            </div>
          </div>
        </section>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-6">
          <div className="w-full max-w-xs rounded-[28px] bg-white p-6 shadow-2xl">
            <p className="text-center text-sm font-black text-ink">このブログを削除しますか？</p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 rounded-full border border-purple/20 py-3 text-sm font-black text-muted">キャンセル</button>
              <button onClick={() => { onDelete(post.id); go('blog-list'); }} className="flex-1 rounded-full bg-pink py-3 text-sm font-black text-white">削除する</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ===================== サークル画面 =====================

const CIRCLE_EMOJIS = ['🔒','🎭','📸','⚾','🎸','📚','🎨','💃','🏃','🌙','🍕','🎮','🎵','🐾','🌸'];

function CirclesScreen({
  go, circles, circlePosts,
}: { go: (s: Screen, payload?: any) => void; circles: Circle[]; circlePosts: CirclePost[] }) {
  const lang = useLang();
  return (
    <>
      <AppHeader title={t('nav_circles', lang)} back onBack={() => go('home')} onBell={() => go('notifications')} />
      <div className="space-y-4 px-4 pt-3 pb-32">
        <button onClick={() => go('circle-create')}
          className="flex w-full items-center justify-center gap-2 rounded-[24px] bg-pink px-5 py-4 text-sm font-black text-white shadow-floating active:scale-[0.99]">
          🔒 {t('circle_new', lang)}
        </button>
        {circles.length === 0 ? (
          <div className="rounded-[28px] bg-white p-8 text-center text-sm font-bold text-muted shadow-card">
            {t('circle_empty', lang)}
          </div>
        ) : circles.map((c) => {
          const posts = circlePosts.filter((p) => p.circleId === c.id);
          const iAmMember = c.memberIds.includes(me.id);
          const dbMembers = (c as any).members as { id: string; name: string; avatar: string }[] | undefined;
          const members = dbMembers ?? [
            ...(iAmMember ? [{ id: me.id, name: me.name, avatar: me.avatar }] : []),
            ...followers.filter((f) => c.memberIds.includes(f.id)),
          ];
          const memberCount = dbMembers ? dbMembers.length : members.length;
          const fanCount = c.fanIds?.length ?? 0;
          return (
            <button key={c.id} onClick={() => go('circle-detail', c.id)}
              className="flex w-full items-start gap-4 rounded-[28px] bg-white p-4 text-left shadow-card active:scale-[0.98]">
              <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-3xl ${c.isOfficial ? 'bg-amber-100' : 'bg-purple/10'}`}>{c.emoji}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-black text-ink">{c.name}</p>
                  {c.isOfficial ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-600">⭐ {t('title_official', lang)}</span>
                  ) : (
                    <span className="rounded-full bg-pink/10 px-2 py-0.5 text-[10px] font-black text-pink">🔒</span>
                  )}
                  {(c as any).visibility === 'followers' && (
                    <span className="rounded-full bg-purple/10 px-2 py-0.5 text-[10px] font-black text-purple">👥 {t('circle_followers_only', lang)}</span>
                  )}
                  {c.isOfficial && !iAmMember && c.fanIds?.includes(me.id) && (
                    <span className="rounded-full bg-pink/10 px-2 py-0.5 text-[10px] font-black text-pink">🎫 {t('circle_fan_joined', lang)}</span>
                  )}
                  {c.createdBy === me.id && (c.pendingFanIds?.length ?? 0) > 0 && (
                    <span className="rounded-full bg-pink px-2 py-0.5 text-[10px] font-black text-white">🔔 {t('fr_requests_tab', lang)} {c.pendingFanIds?.length}</span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {tf('circle_stats', lang, { n: memberCount, q: posts.length })}{c.isOfficial && c.allowFans ? ` · ${tf('circle_fans', lang, { n: fanCount })}` : ''}
                </p>
                <div className="mt-2 flex items-center gap-1">
                  {members.slice(0, 5).map((m, i) => (
                    <span key={i} className="text-base">{m.avatar}</span>
                  ))}
                  {!iAmMember && (() => {
                    const st = (c as any).myStatus;
                    const approval = ((c as any).joinPolicy ?? 'open') === 'approval';
                    if (st === 'pending') return <span className="ml-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-600">⏳ {t('circle_pending', lang)}</span>;
                    return <span className="ml-1 rounded-full bg-pink/10 px-2 py-0.5 text-[10px] font-black text-pink">{approval ? `✋ ${t('circle_approval', lang)}` : t('circle_tap_join', lang)}</span>;
                  })()}
                </div>
              </div>
            </button>
          );
        })}
        <p className="text-center text-xs font-bold text-muted">🔒 {t('circle_private_note', lang)}</p>
      </div>
    </>
  );
}

function CircleDetailScreen({
  go, circle, posts, onPost, onReply, onVote, onApplyFan, onApproveFan, onRejectFan, onJoin, onLeave, onApprove, onReject,
}: {
  go: (s: Screen, payload?: any) => void;
  circle: Circle;
  posts: CirclePost[];
  onPost: (circleId: string, body: string, opts?: { audience?: 'members' | 'everyone'; kind?: 'talk' | 'vote' }) => void;
  onReply: (postId: string, body: string) => void;
  onVote: (postId: string, targetId: string) => void;
  onApplyFan: (circleId: string) => void;
  onApproveFan: (circleId: string, userId: string) => void;
  onRejectFan: (circleId: string, userId: string) => void;
  onJoin: (circleId: string) => void;
  onLeave: (circleId: string) => void;
  onApprove: (circleId: string, atName: string) => void;
  onReject: (circleId: string, atName: string) => void;
}) {
  const [newQ, setNewQ] = useState('');
  const [newKind, setNewKind] = useState<'talk' | 'vote'>('talk');
  const [newAudience, setNewAudience] = useState<'members' | 'everyone'>('members');
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const newQRef = useRef<HTMLTextAreaElement>(null);
  const iAmMember = circle.memberIds.includes(me.id);
  const dbMembers = (circle as any).members as { id: string; name: string; avatar: string }[] | undefined;
  // 表示用メンバー一覧（本番=DB / デモ=mockフォロワー＋自分）
  const memberList = dbMembers ?? [
    ...(iAmMember ? [{ id: me.id, name: me.name, avatar: me.avatar }] : []),
    ...followers.filter((f) => circle.memberIds.includes(f.id)),
  ];
  // 自分以外のメンバー（デモ表示の互換のため）
  const members = memberList.filter((m) => m.id !== me.id);
  const iAmFan = !iAmMember && (circle.fanIds?.includes(me.id) ?? false);
  const fanJoinable = circle.isOfficial && circle.allowFans;
  const iAmOwner = circle.createdBy === me.id;
  const iAmPending = !iAmMember && !iAmFan && (circle.pendingFanIds?.includes(me.id) ?? false);
  const pendingFans = followers.filter((f) => circle.pendingFanIds?.includes(f.id));
  // 投票の候補（サークルメンバー全員）
  const voteCandidates = memberList;

  return (
    <>
      <AppHeader title={`${circle.emoji} ${circle.name}`} back onBack={() => go('circles')} onBell={() => go('notifications')} />
      <div className="space-y-4 px-4 pt-3 pb-32">
        <section className="rounded-[24px] bg-white p-4 shadow-card">
          <div className="mb-3 flex items-center gap-2">
            <p className="text-xs font-black text-muted">メンバー {memberList.length}人</p>
            {circle.isOfficial && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-600">⭐ 公認サークル</span>
            )}
            {fanJoinable && (
              <span className="rounded-full bg-pink/10 px-2 py-0.5 text-[10px] font-black text-pink">🎫 ファン {circle.fanIds?.length ?? 0}人</span>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {memberList.map((m) => (
              <div key={m.id} className="flex flex-col items-center gap-1">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-pink/10 text-xl">{m.avatar}</div>
                <p className="text-[10px] font-bold text-muted">{m.name}</p>
              </div>
            ))}
          </div>
          {/* 参加／リクエスト／退会（共有コミュニティ） */}
          {(() => {
            const joinPolicy = ((circle as any).joinPolicy ?? 'open') as 'open' | 'approval';
            const myStatus = ((circle as any).myStatus ?? (iAmMember ? 'member' : 'none')) as 'member' | 'pending' | 'none';
            if (myStatus === 'pending') {
              return <div className="mt-3 rounded-full bg-amber-50 px-4 py-2.5 text-center text-xs font-black text-amber-600 ring-1 ring-amber-200">⏳ 承認まちです。作成者の承認をまってね</div>;
            }
            if (!iAmMember) {
              return (
                <button onClick={() => onJoin(circle.id)}
                  className="mt-3 h-11 w-full rounded-full bg-pink text-sm font-black text-white shadow-card active:scale-[0.98]">
                  {joinPolicy === 'approval' ? '✋ 参加をリクエストする（承認制）' : '＋ このサークルに参加する'}
                </button>
              );
            }
            if (circle.createdBy !== me.id) {
              return (
                <button onClick={() => onLeave(circle.id)}
                  className="mt-3 h-9 w-full rounded-full border border-purple/20 text-xs font-black text-muted active:scale-[0.98]">
                  サークルを退会する
                </button>
              );
            }
            return <span className="mt-3 inline-block rounded-full bg-pink/10 px-3 py-1 text-[10px] font-black text-pink">{joinPolicy === 'approval' ? '✋ 承認制サークル' : '🌍 誰でも参加OK'}</span>;
          })()}
          {/* 作成者：参加リクエストの承認 */}
          {circle.createdBy === me.id && ((circle as any).pendingMembers?.length ?? 0) > 0 && (
            <div className="mt-4 space-y-2 border-t border-dashed border-purple/15 pt-3">
              <p className="text-xs font-black text-ink">🔔 参加リクエスト（{(circle as any).pendingMembers.length}）</p>
              {((circle as any).pendingMembers as { id: string; name: string; avatar: string }[]).map((pm) => (
                <div key={pm.id} className="flex items-center gap-3 rounded-2xl bg-base p-3">
                  <span className="text-xl">{pm.avatar}</span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-ink">{pm.name}</p><p className="truncate text-[10px] font-bold text-muted">{pm.id}</p></div>
                  <button onClick={() => onApprove(circle.id, pm.id)} className="shrink-0 rounded-full bg-pink px-3 py-1.5 text-[11px] font-black text-white active:scale-95">承認</button>
                  <button onClick={() => onReject(circle.id, pm.id)} className="shrink-0 rounded-full bg-base px-2 py-1.5 text-[11px] font-black text-muted ring-1 ring-purple/15">却下</button>
                </div>
              ))}
            </div>
          )}
          {iAmFan && (
            <p className="mt-3 rounded-2xl bg-pink/5 px-3 py-2 text-[10px] font-bold text-muted">
              🎫 ファンとして参加中。「ファンもOK」のお題に回答・投票できます
            </p>
          )}
        </section>

        {/* ── ファン申請（部外者向け・承認制） ── */}
        {fanJoinable && !iAmMember && !iAmFan && (
          <section className="rounded-[24px] bg-gradient-to-br from-amber-50 to-blue-50 p-4 shadow-card">
            <p className="text-sm font-black text-ink">🎫 ファンになる</p>
            <p className="mt-1 text-[10px] font-bold leading-4 text-muted">
              ファンになると「🎫 ファンもOK」のお題に回答・投票できます。参加はサークルの承認制です。
            </p>
            {iAmPending ? (
              <div className="mt-3 rounded-full bg-white px-4 py-2.5 text-center text-xs font-black text-amber-600 ring-1 ring-amber-300">
                ⏳ 申請中です。承認をまってね
              </div>
            ) : (
              <button onClick={() => onApplyFan(circle.id)}
                className="mt-3 h-11 w-full rounded-full bg-pink text-sm font-black text-white shadow-card active:scale-[0.98]">
                🎫 ファン参加を申請する
              </button>
            )}
          </section>
        )}

        {/* ── ファン申請の承認（オーナー向け） ── */}
        {iAmOwner && fanJoinable && pendingFans.length > 0 && (
          <section className="rounded-[24px] bg-white p-4 shadow-card">
            <p className="mb-3 text-sm font-black text-ink">🔔 ファン申請の承認まち <span className="ml-1 rounded-full bg-pink px-2 py-0.5 text-[10px] font-black text-white">{pendingFans.length}</span></p>
            <div className="space-y-2">
              {pendingFans.map((f) => (
                <div key={f.id} className="flex items-center gap-3 rounded-2xl bg-base p-3">
                  <span className="text-xl">{f.avatar}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-ink">{f.name}</p>
                    <p className="text-[10px] font-bold text-muted">{f.id}</p>
                  </div>
                  <button onClick={() => onApproveFan(circle.id, f.id)}
                    className="rounded-full bg-pink px-3 py-1.5 text-[11px] font-black text-white shadow-card active:scale-95">
                    承認
                  </button>
                  <button onClick={() => onRejectFan(circle.id, f.id)}
                    className="rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-muted ring-1 ring-purple/20 active:scale-95">
                    見送り
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {iAmMember ? (
          <section className="rounded-[24px] bg-white p-4 shadow-card">
            <p className="mb-2 text-sm font-black text-ink">🔒 お題を書く</p>
            {/* お題の形式 */}
            <div className="mb-2 grid grid-cols-2 gap-2 rounded-full bg-base p-1 text-center text-xs font-black">
              <button type="button" onClick={() => setNewKind('talk')}
                className={`rounded-full py-2 ${newKind === 'talk' ? 'bg-pink text-white' : 'text-muted'}`}>💬 フリー回答</button>
              <button type="button" onClick={() => setNewKind('vote')}
                className={`rounded-full py-2 ${newKind === 'vote' ? 'bg-pink text-white' : 'text-muted'}`}>🗳 メンバー投票</button>
            </div>
            {newKind === 'talk' && <RetroEmojiPicker onInsert={(code) => insertRetroCode(newQRef, code, setNewQ)} />}
            <textarea ref={newQRef} value={newQ} onChange={(e) => setNewQ(e.target.value)} maxLength={100} rows={2}
              placeholder={newKind === 'vote' ? '例：一番朝が弱い人は誰？／一番歌がうまい人は誰？' : 'サークル内だけのお題を書いてね（100文字以内）'}
              className="mt-2 w-full resize-none rounded-2xl border border-purple/15 bg-base px-4 py-3 text-sm font-bold text-ink outline-none focus:border-pink" />
            {newQ && newKind === 'talk' && (
              <div className="mt-2 rounded-2xl border border-purple/20 bg-white px-4 py-3">
                <p className="mb-1 text-[10px] font-bold text-muted">プレビュー</p>
                <p className="min-h-[1.5rem] text-sm font-bold leading-7 text-ink"><RetroText text={newQ} /></p>
              </div>
            )}
            {/* ファンの回答可否（公認サークル×ファン許可のみ） */}
            {fanJoinable && (
              <div className="mt-3 rounded-2xl bg-base p-3">
                <p className="mb-2 text-[10px] font-black text-muted">だれが回答できる？</p>
                <div className="grid grid-cols-2 gap-2 text-center text-xs font-black">
                  <button type="button" onClick={() => setNewAudience('members')}
                    className={`rounded-full py-2 ${newAudience === 'members' ? 'bg-purple text-white' : 'bg-white text-muted'}`}>🔒 メンバーのみ</button>
                  <button type="button" onClick={() => setNewAudience('everyone')}
                    className={`rounded-full py-2 ${newAudience === 'everyone' ? 'bg-pink text-white' : 'bg-white text-muted'}`}>🎫 ファンもOK</button>
                </div>
              </div>
            )}
            <button disabled={!newQ.trim()}
              onClick={() => { onPost(circle.id, newQ.trim(), { kind: newKind, audience: fanJoinable ? newAudience : 'members' }); setNewQ(''); setNewKind('talk'); setNewAudience('members'); }}
              className="mt-3 h-11 w-full rounded-full bg-pink text-sm font-black text-white shadow-card disabled:opacity-40 active:scale-[0.98]">
              投稿する
            </button>
          </section>
        ) : (
          <div className="rounded-2xl bg-purple/5 px-4 py-3 text-xs font-bold leading-5 text-muted">
            お題を作れるのはメンバーだけです。ファンは「🎫 ファンもOK」のお題に参加できます
          </div>
        )}

        {!iAmMember && !iAmFan ? (
          <EmptyState text="🔒 参加するとサークル内のお題が見られます" />
        ) : posts.length === 0 ? (
          <EmptyState text="まだお題がありません。最初のお題を書いてみよう！" />
        ) : posts.map((p) => {
          const forEveryone = p.audience === 'everyone';
          const canSee = iAmMember || (iAmFan && forEveryone);
          const canAnswer = iAmMember || (iAmFan && forEveryone);
          // ファンにはメンバー限定のお題を見せない（存在だけ表示）
          if (!canSee) {
            return (
              <div key={p.id} className="rounded-[24px] bg-white p-4 shadow-card opacity-70">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔒</span>
                  <p className="text-xs font-bold text-muted">メンバー限定のお題です</p>
                </div>
              </div>
            );
          }
          const isVote = p.kind === 'vote';
          const votes = p.votes ?? [];
          const myVote = votes.find((v) => v.userId === me.id);
          return (
            <div key={p.id} className="rounded-[24px] bg-white p-4 shadow-card">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-lg">{p.postedByAvatar}</span>
                <span className="text-xs font-black text-ink">{p.postedByName}</span>
                {isVote && <span className="rounded-full bg-purple/10 px-2 py-0.5 text-[10px] font-black text-purple">🗳 投票</span>}
                <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-black ${forEveryone ? 'bg-amber-100 text-amber-600' : 'bg-pink/10 text-pink'}`}>
                  {forEveryone ? '🎫 ファンもOK' : '🔒 メンバー限定'}
                </span>
              </div>
              <p className="mb-3 text-sm font-black text-ink"><RetroText text={p.body} /></p>

              {isVote ? (
                /* ── メンバー投票（一番〜な人は誰？） ── */
                <div className="space-y-2">
                  {voteCandidates.length === 0 ? null : myVote || !canAnswer ? (
                    /* 投票済み or 閲覧のみ → 結果表示 */
                    voteCandidates.map((c) => {
                      const count = votes.filter((v) => v.targetId === c.id).length;
                      const pct = votes.length === 0 ? 0 : Math.round((count / votes.length) * 100);
                      const isMine = myVote?.targetId === c.id;
                      return (
                        <div key={c.id} className="relative overflow-hidden rounded-2xl bg-base px-3 py-2">
                          <div className="absolute inset-y-0 left-0 bg-pink/15 transition-all" style={{ width: `${pct}%` }} />
                          <div className="relative flex items-center gap-2 text-xs font-bold text-ink">
                            <span className="text-base">{c.avatar}</span>
                            <span className="flex-1">{c.name}{isMine && <span className="ml-1 text-pink">✓ 投票した</span>}</span>
                            <span className="font-black text-pink">{count}票</span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    /* 未投票 → 候補から選ぶ */
                    <>
                      <p className="text-[10px] font-bold text-muted">だれか1人を選んでね（結果は投票後に見えるよ）</p>
                      <div className="flex flex-wrap gap-2">
                        {voteCandidates.map((c) => (
                          <button key={c.id} onClick={() => onVote(p.id, c.id)}
                            className="flex items-center gap-2 rounded-full bg-base px-3 py-2 text-xs font-black text-ink transition hover:bg-pink/10 active:scale-95">
                            <span className="text-base">{c.avatar}</span>{c.name}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  <p className="text-right text-[10px] font-bold text-muted">合計 {votes.length}票</p>
                </div>
              ) : (
                /* ── フリー回答 ── */
                <>
                  {p.replies.length > 0 && (
                    <div className="space-y-2 border-t border-dashed border-purple/15 pt-3">
                      {p.replies.map((r, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="text-base">{r.userAvatar}</span>
                          <div className="flex-1 rounded-2xl bg-base px-3 py-2 text-xs font-bold text-ink">
                            <span className="font-black text-pink">{r.userName}</span>: {r.body}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {canAnswer && (replyTargetId === p.id ? (
                    <div className="mt-3 flex gap-2">
                      <input value={replyText} onChange={(e) => setReplyText(e.target.value)} maxLength={80}
                        placeholder="返信を書く…"
                        className="flex-1 rounded-full border border-purple/15 bg-base px-4 py-2 text-xs font-bold outline-none focus:border-pink" />
                      <button
                        onClick={() => {
                          if (replyText.trim()) onReply(p.id, replyText.trim());
                          setReplyTargetId(null); setReplyText('');
                        }}
                        className="rounded-full bg-pink px-4 py-2 text-xs font-black text-white">送る</button>
                    </div>
                  ) : (
                    <button onClick={() => setReplyTargetId(p.id)}
                      className="mt-2 text-xs font-black text-pink">
                      ↩ 返信する
                    </button>
                  ))}
                </>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function CircleCreateScreen({
  go, onCreate,
}: {
  go: (s: Screen, payload?: any) => void;
  onCreate: (name: string, emoji: string, memberIds: string[], opts?: { isOfficial?: boolean; allowFans?: boolean; joinPolicy?: 'open' | 'approval'; visibility?: 'public' | 'followers' }) => string;
}) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🔒');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [isOfficial, setIsOfficial] = useState(false);
  const [allowFans, setAllowFans] = useState(false);
  const [joinPolicy, setJoinPolicy] = useState<'open' | 'approval'>('open');
  const [visibility, setVisibility] = useState<'public' | 'followers'>('public');

  return (
    <>
      <AppHeader title="サークルを作る" back onBack={() => go('circles')} onBell={() => go('notifications')} />
      <div className="space-y-4 px-4 pt-3 pb-32">
        <section className="rounded-[32px] bg-white p-5 shadow-card">
          <p className="mb-2 font-black text-ink">サークル名</p>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20}
            placeholder="例：ダンスサークル、野球部、映研…"
            className="w-full rounded-2xl border border-purple/15 bg-base px-4 py-3 text-sm font-bold outline-none focus:border-pink" />
        </section>

        <section className="rounded-[32px] bg-white p-5 shadow-card">
          <p className="mb-3 font-black text-ink">アイコン</p>
          <div className="grid grid-cols-5 gap-2">
            {CIRCLE_EMOJIS.map((e) => (
              <button key={e} type="button" onClick={() => setEmoji(e)}
                className={`grid h-12 w-full place-items-center rounded-2xl text-2xl transition ${emoji === e ? 'bg-pink/20 ring-2 ring-pink' : 'bg-base hover:bg-pink/10'}`}>
                {e}
              </button>
            ))}
          </div>
        </section>

        {/* 共有モード（本番）は「参加制」なので招待は不要。デモ(①)のみ招待UIを表示。 */}
        {isDev ? (
          <section className="rounded-[32px] bg-white p-5 shadow-card">
            <p className="mb-1 font-black text-ink">メンバーを招待</p>
            <p className="mb-3 text-xs font-bold text-muted">フォロー中の人から選んでね（あとから追加できます）</p>
            <div className="space-y-2">
              {followers.map((f) => {
                const sel = selectedMembers.includes(f.id);
                return (
                  <button key={f.id} type="button"
                    onClick={() => setSelectedMembers((prev) => sel ? prev.filter((id) => id !== f.id) : [...prev, f.id])}
                    className={`flex w-full items-center gap-3 rounded-2xl p-3 transition ${sel ? 'bg-purple/10' : 'bg-base'}`}>
                    <span className="text-xl">{f.avatar}</span>
                    <span className="flex-1 text-left text-sm font-black text-ink">{f.name}</span>
                    <span className={`text-xs font-black ${sel ? 'text-purple' : 'text-muted'}`}>{sel ? '✓ 招待中' : '招待する'}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : (
          <div className="rounded-2xl bg-purple/5 px-4 py-3 text-xs font-bold leading-5 text-muted">
            👥 作ったサークルは「さがす」から誰でも見つけて参加できます（参加制）。
          </div>
        )}

        {/* 公開範囲（誰に見つけてもらえるか） */}
        <section className="rounded-[32px] bg-white p-5 shadow-card">
          <p className="mb-3 font-black text-ink">公開範囲</p>
          <div className="grid grid-cols-1 gap-2">
            <button type="button" onClick={() => setVisibility('public')}
              className={`rounded-2xl border-2 p-3 text-left transition ${visibility === 'public' ? 'border-blue-400 bg-blue-50' : 'border-transparent bg-base'}`}>
              <p className="text-sm font-black text-ink">🌍 全体に表示</p>
              <p className="mt-0.5 text-[11px] font-bold text-muted">だれでも「さがす」から見つけられます</p>
            </button>
            <button type="button" onClick={() => setVisibility('followers')}
              className={`rounded-2xl border-2 p-3 text-left transition ${visibility === 'followers' ? 'border-pink bg-pink/5' : 'border-transparent bg-base'}`}>
              <p className="text-sm font-black text-ink">👥 フォロワーにだけ表示</p>
              <p className="mt-0.5 text-[11px] font-bold text-muted">あなたをフォローしている人だけが見つけられます</p>
            </button>
          </div>
        </section>

        {/* 参加方式（作成者が選ぶ） */}
        <section className="rounded-[32px] bg-white p-5 shadow-card">
          <p className="mb-3 font-black text-ink">参加方式</p>
          <div className="grid grid-cols-1 gap-2">
            <button type="button" onClick={() => setJoinPolicy('open')}
              className={`rounded-2xl border-2 p-3 text-left transition ${joinPolicy === 'open' ? 'border-pink bg-pink/5' : 'border-transparent bg-base'}`}>
              <p className="text-sm font-black text-ink">🌍 誰でも参加OK</p>
              <p className="mt-0.5 text-[11px] font-bold text-muted">「さがす／サークル」から誰でもすぐ参加できます</p>
            </button>
            <button type="button" onClick={() => setJoinPolicy('approval')}
              className={`rounded-2xl border-2 p-3 text-left transition ${joinPolicy === 'approval' ? 'border-purple bg-purple/5' : 'border-transparent bg-base'}`}>
              <p className="text-sm font-black text-ink">✋ 承認制（招待が必要）</p>
              <p className="mt-0.5 text-[11px] font-bold text-muted">参加は「リクエスト → 作成者が承認」。承認した人だけが中を見られます</p>
            </button>
          </div>
        </section>

        {/* 公認ユーザーのみ：公認サークル＋ファン参加設定 */}
        {me.isOfficial && (
          <section className="rounded-[32px] bg-white p-5 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-black text-ink">⭐ 公認サークルにする</p>
                <p className="mt-0.5 text-[10px] font-bold text-muted">公認ユーザー（著名なグループ）だけが使えます</p>
              </div>
              <button type="button" onClick={() => { setIsOfficial((v) => !v); if (isOfficial) setAllowFans(false); }}
                className={`h-7 w-12 rounded-full p-0.5 transition ${isOfficial ? 'bg-amber-400' : 'bg-purple/15'}`}>
                <span className={`block h-6 w-6 rounded-full bg-white shadow transition ${isOfficial ? 'translate-x-5' : ''}`} />
              </button>
            </div>
            {isOfficial && (
              <div className="mt-4 flex items-center justify-between border-t border-dashed border-purple/15 pt-4">
                <div>
                  <p className="font-black text-ink">🎫 ファンの参加を許可</p>
                  <p className="mt-0.5 text-[10px] font-bold text-muted">ファンは「ファンもOK」のお題にだけ回答できます</p>
                </div>
                <button type="button" onClick={() => setAllowFans((v) => !v)}
                  className={`h-7 w-12 rounded-full p-0.5 transition ${allowFans ? 'bg-pink' : 'bg-purple/15'}`}>
                  <span className={`block h-6 w-6 rounded-full bg-white shadow transition ${allowFans ? 'translate-x-5' : ''}`} />
                </button>
              </div>
            )}
          </section>
        )}

        <div className="rounded-2xl bg-purple/5 px-4 py-3 text-xs font-bold leading-5 text-muted">
          🔒 サークル内のお題はメンバーだけに表示されます
        </div>

        <button disabled={!name.trim()}
          onClick={() => { const id = onCreate(name.trim(), emoji, selectedMembers, { isOfficial, allowFans, joinPolicy, visibility }); if (id) go('circle-detail', id); }}
          className="h-14 w-full rounded-full bg-pink text-base font-black text-white shadow-floating disabled:opacity-40 active:scale-[0.98]">
          {emoji} サークルを作る
        </button>
      </div>
    </>
  );
}

// ===================== /サークル画面 =====================

// ===================== ショップ画面 =====================

type ShopCategory = 'theme' | 'stamp' | 'deco' | 'font';

// カラーテーマはコイン購入制になったため COLOR_THEMES (@/lib/bgThemes) に移動
const SHOP_ITEMS: Record<'deco' | 'font', { id: string; name: string; preview: string; price: number; owned: boolean }[]> = {
  deco: [
    { id: 'gold-frame', name: '🖼 ゴールドフレーム', preview: '✦ ── ✦ ── ✦', price: 200, owned: false },
    { id: 'glitter-bg', name: '✨ キラキラ背景', preview: '✦✧✦✧✦✧✦✧', price: 150, owned: false },
    { id: 'sakura-bg', name: '🌸 さくら背景', preview: '🌸 ·  · 🌸 ·  ·', price: 150, owned: false },
    { id: 'gradient-bg', name: '🌈 グラデーション', preview: '▓▒░ rainbow ░▒▓', price: 200, owned: false },
    { id: 'premium-cover', name: '💎 プレミアムカバー', preview: '💎 ──────── 💎', price: 250, owned: false },
    { id: 'art-frame', name: '🎨 アートフレーム', preview: '❋ ────── ❋', price: 200, owned: false },
  ],
  font: [
    { id: 'tegaki', name: '📝 てがき体', preview: "Miri", price: 100, owned: false },
    { id: 'pop', name: '💫 ポップ体', preview: "Miri", price: 100, owned: false },
    { id: 'elegant', name: '✒ エレガント体', preview: "Miri", price: 120, owned: false },
    { id: 'maru', name: '🌸 丸ゴシック', preview: "Miri", price: 100, owned: false },
  ],
};

const SHOP_CATEGORY_LABELS: { key: ShopCategory; label: string; emoji: string }[] = [
  { key: 'stamp', label: 'スタンプ', emoji: '🎭' },
  { key: 'theme', label: 'テーマ', emoji: '🎨' },
  { key: 'deco',  label: 'デコ',   emoji: '✨' },
  { key: 'font',  label: 'フォント', emoji: '🔤' },
];

type GachaResult = { sticker: StickerItem; isNew: boolean }[];

// ── 一致率しんだん（相性診断）画面 ───────────────────────────
function DiagnosisScreen({ go, target }: { go: (s: Screen, payload?: any) => void; target: string | null }) {
  const isSelf = !target || target === me.id;
  const [loading, setLoading] = useState(true);
  const [targetChoices, setTargetChoices] = useState<Record<string, string>>({});
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [result, setResult] = useState<{ percent: number; same: number; total: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mine = await getMyChoices();
      if (cancelled) return;
      if (isSelf) { setPicks(mine); }
      else { const th = await getUserChoices(target!); if (!cancelled) setTargetChoices(th); }
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const back = () => go('profile', isSelf ? undefined : (target ?? undefined));
  if (loading) return (<><AppHeader title="一致率しんだん" back onBack={back} /><div className="p-10 text-center text-sm font-bold text-muted">読み込み中…</div></>);

  const QChoice = ({ q, accent }: { q: (typeof CHOICE_QUESTIONS)[number]; accent: string }) => (
    <div className="rounded-2xl bg-white p-3 shadow-card">
      <p className="mb-2 text-xs font-black text-muted">{q.label}</p>
      <div className="grid grid-cols-2 gap-2">
        {(['a', 'b'] as const).map((opt) => (
          <button key={opt} onClick={() => setPicks((p) => ({ ...p, [q.key]: opt }))}
            className={`rounded-xl py-3 text-sm font-black transition ${picks[q.key] === opt ? `${accent} text-white shadow-card` : 'bg-base text-ink'}`}>
            {q[opt]}
          </button>
        ))}
      </div>
    </div>
  );

  // 自分の答えを登録（他の人が診断できるように）
  if (isSelf) {
    const answered = CHOICE_QUESTIONS.filter((q) => picks[q.key]).length;
    return (
      <>
        <AppHeader title="一致率しんだん" back onBack={back} />
        <div className="space-y-4 px-4 pt-3 pb-32">
          <div className="pb-banner rounded-[24px] p-5 shadow-card">
            <p className="text-sm font-black">💯 あなたの答えを登録</p>
            <p className="mt-1 text-xs font-bold">答えておくと、友達があなたとの一致率を診断できます！</p>
          </div>
          {CHOICE_QUESTIONS.map((q) => <QChoice key={q.key} q={q} accent="bg-pink" />)}
          <button onClick={async () => setSaved(await saveMyChoices(picks))} disabled={answered === 0}
            className="w-full rounded-full bg-pink py-4 text-base font-black text-white shadow-floating disabled:opacity-40 active:scale-[0.98]">
            登録する（{answered}/{CHOICE_QUESTIONS.length}）
          </button>
          {saved && <p className="text-center text-sm font-black text-green-500">✅ 登録しました！シェア画像の「一致率しんだん」から友達に広めよう</p>}
        </div>
      </>
    );
  }

  // 相手を診断
  const answerable = CHOICE_QUESTIONS.filter((q) => targetChoices[q.key]);
  if (answerable.length === 0) {
    return (
      <>
        <AppHeader title="一致率しんだん" back onBack={back} />
        <div className="p-10 text-center">
          <p className="text-3xl">🥺</p>
          <p className="mt-3 text-sm font-black text-ink">{target} さんはまだ一致率しんだんに答えていません。</p>
          <p className="mt-1 text-xs font-bold text-muted">相手が答えると診断できるようになります。</p>
        </div>
      </>
    );
  }
  if (result) {
    return (
      <>
        <AppHeader title="一致率しんだん" back onBack={back} />
        <div className="flex flex-col items-center gap-5 px-6 pt-12 pb-32 text-center">
          <p className="text-sm font-black text-muted">{target} との一致率は…</p>
          <p className="text-7xl font-black text-pink">{result.percent}<span className="text-3xl">%</span></p>
          <p className="text-sm font-bold text-ink">{result.total}問中 {result.same}問が同じ！</p>
          <div className="flex flex-col gap-2 w-full max-w-xs">
            <button onClick={() => { setResult(null); setPicks({}); }} className="rounded-full bg-base px-6 py-3 text-sm font-black text-ink">もう一度</button>
            <button onClick={() => go('diagnosis', null)} className="rounded-full bg-pink px-6 py-3 text-sm font-black text-white">自分も答えて診断されよう ✿</button>
          </div>
        </div>
      </>
    );
  }
  const done = answerable.filter((q) => picks[q.key]).length;
  return (
    <>
      <AppHeader title="一致率しんだん" back onBack={back} />
      <div className="space-y-4 px-4 pt-3 pb-32">
        <div className="pb-banner rounded-[24px] p-5 shadow-card">
          <p className="text-sm font-black">💯 {target} との一致率しんだん</p>
          <p className="mt-1 text-xs font-bold">あなたはどっち？答えると一致率が出るよ！</p>
        </div>
        {answerable.map((q) => <QChoice key={q.key} q={q} accent="bg-blue-400" />)}
        <button onClick={() => setResult(matchPercent(picks, targetChoices))} disabled={done < answerable.length}
          className="w-full rounded-full bg-pink py-4 text-base font-black text-white shadow-floating disabled:opacity-40 active:scale-[0.98]">
          結果を見る（{done}/{answerable.length}）
        </button>
      </div>
    </>
  );
}

// ── コラボ特集（企業コラボの一覧・入口） ───────────────────────
function CollabScreen({ go }: { go: (s: Screen, payload?: any) => void }) {
  const lang = useLang();
  const campaigns = activeBrandCampaigns();
  return (
    <>
      <AppHeader title={t('collab_title', lang)} back onBack={() => go('home')} onBell={() => go('notifications')} />
      <div className="space-y-4 px-4 pt-3 pb-32">
        <div className="pb-banner rounded-[24px] p-5 shadow-card">
          <p className="text-sm font-black">🤝 {t('collab_brand', lang)}</p>
          <p className="mt-1 text-xs font-bold">{t('collab_desc', lang)}</p>
        </div>
        {campaigns.length === 0 && <EmptyState text={t('collab_none', lang)} />}
        {campaigns.map((c) => {
          const a = campaignAssets(c);
          return (
            <section key={c.id} className="overflow-hidden rounded-[28px] bg-white shadow-card">
              <div className="flex items-center gap-3 px-5 py-4" style={{ background: `${c.color}14` }}>
                <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-2xl text-2xl" style={{ background: `${c.color}22` }}>
                  {c.logo.startsWith('http') ? <img src={c.logo} alt="" className="h-full w-full rounded-2xl object-cover" /> : c.logo}
                </span>
                <div>
                  <p className="text-base font-black text-ink">{c.brand}</p>
                  <p className="text-[11px] font-bold text-muted">{t('collab_live', lang)}</p>
                </div>
              </div>
              <div className="space-y-3 p-5">
                <p className="text-sm font-bold leading-6 text-ink">{tv(c.blurb, lang)}</p>
                {a.sticker && (
                  <button onClick={() => go('shop')} className="flex w-full items-center gap-3 rounded-2xl bg-base p-3 text-left active:scale-[0.99]">
                    <span className="text-2xl">{a.sticker.thumbnail}</span>
                    <span className="min-w-0 flex-1"><b className="text-sm text-ink">{tv(a.sticker.name, lang)}</b><br /><span className="text-[11px] text-muted">{t('collab_see_shop', lang)} →</span></span>
                  </button>
                )}
                {a.bg && (
                  <button onClick={() => go('shop')} className="flex w-full items-center gap-3 rounded-2xl bg-base p-3 text-left active:scale-[0.99]">
                    <span className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${a.bg.gradient} text-lg`}>{a.bg.emoji}</span>
                    <span className="min-w-0 flex-1"><b className="text-sm text-ink">{tv(a.bg.name, lang)}</b><br /><span className="text-[11px] text-muted">{t('collab_bg', lang)} →</span></span>
                  </button>
                )}
                {a.pr && (
                  <button onClick={() => go('home')} className="flex w-full items-center gap-3 rounded-2xl bg-base p-3 text-left active:scale-[0.99]">
                    <span className="text-2xl">{a.pr.brandEmoji}</span>
                    <span className="min-w-0 flex-1"><b className="text-sm text-ink">{tv(a.pr.question, lang)}</b><br /><span className="text-[11px] text-muted">{tf('collab_pr', lang, { n: a.pr.reward })} →</span></span>
                  </button>
                )}
              </div>
            </section>
          );
        })}
        <p className="px-2 text-center text-[11px] font-bold text-muted">
          {t('collab_biz', lang)} <a href="/creator-kit" className="text-blue-500 underline">Miri Creator Kit</a>
        </p>
      </div>
    </>
  );
}

function ShopScreen({
  go,
  coins,
  ownedPackIds,
  ownedGachaStickers,
  onPurchasePack,
  onAddGachaStickers,
  onSpendCoins,
  ownedBgIds,
  equippedBgId,
  onAddBg,
  onEquipBg,
  ownedThemeIds,
  onBuyTheme,
  bgShards = 0,
  onAddBgShards,
  onExchangeBg,
  lang = 'ja',
}: {
  go: (s: Screen) => void;
  coins: number;
  ownedPackIds: string[];
  ownedGachaStickers: string[];
  onPurchasePack: (packId: string) => void;
  onAddGachaStickers: (ids: string[]) => void;
  onSpendCoins: (amount: number) => void;
  ownedBgIds: string[];
  equippedBgId: string | null;
  onAddBg: (id: string) => void;
  onEquipBg: (id: string | null) => void;
  ownedThemeIds: string[];
  onBuyTheme: (id: string) => void;
  bgShards?: number;
  onAddBgShards?: (n: number) => void;
  onExchangeBg?: (id: string) => void;
  lang?: Lang;
}) {
  const [tab, setTab] = useState<ShopCategory>('stamp');
  const [gachaResult, setGachaResult] = useState<GachaResult | null>(null);
  const [detailPack, setDetailPack] = useState<StickerPack | null>(null);
  const [bgResult, setBgResult] = useState<{ theme: BgTheme; isNew: boolean; shards: number } | null>(null);
  const [gachaResultShards, setGachaResultShards] = useState(0);
  // はじめて1回無料ガチャ（端末に使用済みフラグ）
  const [freeGachaUsed, setFreeGachaUsed] = useState(() => {
    try { return localStorage.getItem('miri_free_gacha_used') === '1'; } catch { return false; }
  });
  // ガチャ演出：'spin'（カプセルが揺れる）→ 'burst'（弾ける）→ 結果表示
  const [spinPhase, setSpinPhase] = useState<'spin' | 'burst' | null>(null);
  const pendingRevealRef = useRef<(() => void) | null>(null);

  // 被り1個あたりのかけら（レアいほど多い）
  const SHARD_BY_RARITY: Record<string, number> = { N: 1, R: 2, SR: 3 };

  /** カプセル演出を挟んでから結果を表示する */
  function playGacha(reveal: () => void) {
    pendingRevealRef.current = reveal;
    setSpinPhase('spin');
    setTimeout(() => setSpinPhase('burst'), 1500);
    setTimeout(() => {
      setSpinPhase(null);
      pendingRevealRef.current?.();
      pendingRevealRef.current = null;
    }, 1850);
  }

  function handleDraw(pack: StickerPack, count: 1 | 10, free = false) {
    if (pack.acquisition.type !== 'gacha') return;
    const cost = pack.acquisition.coinCost * count;
    if (free) {
      if (freeGachaUsed) return;
      try { localStorage.setItem('miri_free_gacha_used', '1'); } catch {}
      setFreeGachaUsed(true);
    } else {
      if (coins < cost) return;
      onSpendCoins(cost);
    }
    const results = count === 1
      ? [drawGacha(pack, ownedGachaStickers)]
      : draw10Gacha(pack, ownedGachaStickers);
    const newIds = results.filter((r) => r.isNew).map((r) => r.sticker.id);
    if (newIds.length > 0) onAddGachaStickers(newIds);
    // 被り分はかけらに変換
    const shards = results.filter((r) => !r.isNew).reduce((sum, r) => sum + (SHARD_BY_RARITY[r.sticker.rarity ?? 'N'] ?? 1), 0);
    if (shards > 0) onAddBgShards?.(shards);
    playGacha(() => { setGachaResultShards(shards); setGachaResult(results); });
  }

  function handleDrawBg() {
    if (coins < BG_GACHA_COST) return;
    onSpendCoins(BG_GACHA_COST);
    const result = drawBgGacha(ownedBgIds);
    if (result.isNew) onAddBg(result.theme.id);
    const shards = result.isNew ? 0 : SHARD_BY_RARITY[result.theme.rarity] ?? 1;
    if (shards > 0) onAddBgShards?.(shards);
    playGacha(() => setBgResult({ ...result, shards }));
  }

  const freePacks     = STICKER_PACKS.filter((p) => p.acquisition.type === 'free');
  const purchasePacks = STICKER_PACKS.filter((p) => p.acquisition.type === 'purchase');
  const gachaPacks    = STICKER_PACKS.filter((p) => p.acquisition.type === 'gacha');

  return (
    <>
      <AppHeader title={t('header_shop', lang)} back onBack={() => go('mypage')} onBell={() => go('notifications')} />

      {/* コインバランス */}
      <div className="mx-4 mt-3 flex items-center justify-between rounded-[24px] bg-zinc-900 px-5 py-3">
        <div>
          <p className="text-[10px] font-black text-zinc-500">{t('label_coin_balance', lang)}</p>
          <p className="text-xl font-black text-amber-400"><CoinIcon size={18} /> {coins.toLocaleString()}</p>
        </div>
        <button onClick={() => go('wallet')} className="rounded-full bg-amber-400 px-4 py-2 text-xs font-black text-zinc-900 shadow-card active:scale-[0.98]">
          {t('btn_buy_coins', lang)}
        </button>
      </div>

      {/* カテゴリタブ */}
      <div className="mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {SHOP_CATEGORY_LABELS.map(({ key, emoji }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-black transition ${
              tab === key ? 'bg-pink text-white shadow-card' : 'bg-white text-muted shadow-card hover:bg-pink/10'
            }`}>
            <span>{emoji}</span>{t(`tab_${key}`, lang)}
          </button>
        ))}
      </div>

      {/* ── スタンプタブ ── */}
      {tab === 'stamp' && (
        <div className="space-y-6 px-4 pb-10 pt-3">

          {/* 無料 */}
          <section>
            <p className="mb-3 text-sm font-black text-ink">🆓 {t('sec_free_stamps', lang)}</p>
            <div className="space-y-2">
              {freePacks.map((pack) => (
                <PackRow key={pack.id} pack={pack} owned={true} onDetail={() => setDetailPack(pack)}
                  action={<span className="rounded-full bg-green-100 px-3 py-1 text-[11px] font-black text-green-600">{t('label_free', lang)}</span>} />
              ))}
            </div>
          </section>

          {/* 有料 */}
          <section>
            <p className="mb-3 text-sm font-black text-ink">💳 {t('sec_paid_stamps', lang)}</p>
            <div className="space-y-2">
              {purchasePacks.map((pack) => {
                const price = (pack.acquisition as { type: 'purchase'; price: number }).price;
                const owned = ownedPackIds.includes(pack.id);
                return (
                  <PackRow key={pack.id} pack={pack} owned={owned} onDetail={() => setDetailPack(pack)}
                    action={
                      owned
                        ? <span className="rounded-full bg-pink/10 px-3 py-1 text-[11px] font-black text-pink">購入済み</span>
                        : <button onClick={() => onPurchasePack(pack.id)}
                            className="rounded-full bg-pink px-3 py-1 text-[11px] font-black text-white shadow-card active:scale-[0.97]">
                            ¥{price}
                          </button>
                    } />
                );
              })}
            </div>
          </section>

          {/* ガチャ */}
          <section>
            <p className="mb-3 text-sm font-black text-ink">🎰 {t('sec_gacha_stamps', lang)}</p>
            <div className="space-y-3">
              {gachaPacks.map((pack) => {
                const cost = (pack.acquisition as { type: 'gacha'; coinCost: number }).coinCost;
                const ownedCount = pack.stickers.filter((s) => ownedGachaStickers.includes(s.id)).length;
                return (
                  <div key={pack.id} className="rounded-[24px] bg-white p-4 shadow-card">
                    <div className="mb-3 flex items-center gap-3">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-zinc-900 text-2xl">{pack.thumbnail}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-black text-ink">{tv(pack.name, lang)}</p>
                          {pack.isNew && <span className="rounded-full bg-pink px-2 py-0.5 text-[9px] font-black text-white">NEW</span>}
                        </div>
                        <p className="text-[11px] font-bold text-muted">{pack.description}</p>
                        <p className="mt-1 text-[10px] font-bold text-muted">
                          所持: {ownedCount}/{pack.stickers.length} · SR 5% · R 20% · N 75%
                        </p>
                      </div>
                    </div>
                    {/* ガチャ排出一覧プレビュー */}
                    <button onClick={() => setDetailPack(pack)} className="mb-3 flex gap-1">
                      {pack.stickers.slice(0, 8).map((s) => (
                        <span key={s.id}
                          className={`grid h-8 w-8 place-items-center rounded-xl text-lg ${ownedGachaStickers.includes(s.id) ? '' : 'opacity-30'}`}>
                          <RetroText text={s.emoji} />
                        </span>
                      ))}
                      {pack.stickers.length > 8 && <span className="grid h-8 w-8 place-items-center rounded-xl bg-base text-[10px] font-black text-muted">+{pack.stickers.length - 8}</span>}
                    </button>
                    {!freeGachaUsed && (
                      <button
                        onClick={() => handleDraw(pack, 1, true)}
                        className="mb-2 w-full rounded-full bg-gradient-to-r from-pink to-purple py-2.5 text-sm font-black text-white shadow-floating active:scale-[0.98]">
                        🎁 はじめて無料で1回引く！
                      </button>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDraw(pack, 1)}
                        disabled={coins < cost}
                        className={`flex-1 rounded-full py-2.5 text-sm font-black transition ${coins >= cost ? 'bg-zinc-900 text-amber-400 active:scale-[0.98]' : 'bg-base text-muted'}`}>
                        <CoinIcon size={14} /> {cost} で1回引く
                      </button>
                      <button
                        onClick={() => handleDraw(pack, 10)}
                        disabled={coins < cost * 10}
                        className={`flex-1 rounded-full py-2.5 text-sm font-black transition ${coins >= cost * 10 ? 'bg-amber-400 text-zinc-900 active:scale-[0.98]' : 'bg-base text-muted'}`}>
                        <CoinIcon size={14} /> {cost * 10} で10連
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* ── 世界観背景ガチャ（テーマタブ） ── */}
      {tab === 'theme' && (
        <div className="space-y-4 px-4 pt-3">
          {/* ガチャバナー */}
          <section className="overflow-hidden rounded-[28px] bg-gradient-to-br from-indigo-100 via-purple-50 to-blue-100 p-5 shadow-card">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-2xl">🎠</span>
              <p className="text-base font-black text-ink">世界観背景ガチャ</p>
              <span className="rounded-full bg-pink px-2 py-0.5 text-[9px] font-black text-white">NEW</span>
            </div>
            <p className="text-xs font-bold text-muted">
              うみのなか、おかしのいえ、まてんろう…。イラストがふわふわ動く世界観背景がアプリ全体の背景になるよ！
            </p>
            <p className="mt-1 text-[10px] font-bold text-muted">
              所持: {ownedBgIds.length}/{BG_THEMES.length} · SR 5% · R 20% · N 75% · 被りはかけらに変わるよ
            </p>
            {/* 排出ラインナップ */}
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {BG_THEMES.map((t) => (
                <div key={t.id}
                  className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br ${t.gradient} ${ownedBgIds.includes(t.id) ? '' : 'opacity-40 grayscale-[0.4]'}`}>
                  <span className="absolute left-1.5 top-1">{t.floaters[0] && <ThemeArt art={t.floaters[0].art} size={20} />}</span>
                  <span className={`absolute right-1 top-1 rounded-full px-1.5 py-0.5 text-[8px] font-black ${RARITY_COLOR[t.rarity]}`}>{t.rarity}</span>
                  <span className="absolute bottom-1 left-1.5 right-1 truncate text-[8px] font-black text-ink/70">
                    {ownedBgIds.includes(t.id) ? t.name : '？？？'}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={handleDrawBg}
              disabled={coins < BG_GACHA_COST}
              className={`mt-3 w-full rounded-full py-3 text-sm font-black transition ${coins >= BG_GACHA_COST ? 'bg-zinc-900 text-amber-400 active:scale-[0.98]' : 'bg-white/70 text-muted'}`}>
              <CoinIcon size={14} /> {BG_GACHA_COST} で1回引く
            </button>
          </section>

          {/* かけら交換所：被りで貯まったかけらを好きな背景と交換 */}
          <section className="rounded-[28px] bg-white p-5 shadow-card">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-sm font-black text-ink"><ShardIcon size={16} /> かけら交換所</p>
              <span className="rounded-full bg-purple/10 px-2.5 py-1 text-[11px] font-black text-purple"><ShardIcon size={13} /> {bgShards}</span>
            </div>
            <p className="mb-3 text-[11px] font-bold text-muted">
              ガチャの被りでかけらGET（N=1・R=2・SR=3）。{SHARD_EXCHANGE_COST}個で好きな世界観背景と交換できるよ！
            </p>
            <div className="grid grid-cols-2 gap-3">
              {BG_THEMES.filter((t) => !ownedBgIds.includes(t.id)).map((t) => (
                <div key={t.id} className="overflow-hidden rounded-[20px] shadow-card">
                  <div className={`relative h-16 bg-gradient-to-br ${t.gradient}`}>
                    <span className="absolute left-2 top-2">{t.floaters[0] && <ThemeArt art={t.floaters[0].art} size={26} />}</span>
                    <span className={`absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-black ${RARITY_COLOR[t.rarity]}`}>{t.rarity}</span>
                  </div>
                  <div className="p-3">
                    <p className="truncate text-xs font-black text-ink">{tv(t.name, lang)}</p>
                    <button
                      onClick={() => onExchangeBg?.(t.id)}
                      disabled={bgShards < SHARD_EXCHANGE_COST}
                      className={`mt-2 w-full rounded-full py-1.5 text-[11px] font-black transition active:scale-[0.97] ${bgShards >= SHARD_EXCHANGE_COST ? 'bg-purple text-white' : 'bg-base text-muted'}`}>
                      <ShardIcon size={12} /> {SHARD_EXCHANGE_COST} で交換
                    </button>
                  </div>
                </div>
              ))}
              {BG_THEMES.every((t) => ownedBgIds.includes(t.id)) && (
                <p className="col-span-2 rounded-2xl bg-base p-4 text-center text-xs font-bold text-muted">🎉 全部の世界観背景をコンプリートしたよ！</p>
              )}
            </div>
          </section>

          {/* 所持している背景（つけかえ） */}
          {ownedBgIds.length > 0 && (
            <section className="rounded-[28px] bg-white p-5 shadow-card">
              <p className="mb-3 text-sm font-black text-ink">🎨 もっている世界観背景</p>
              <div className="grid grid-cols-2 gap-3">
                {BG_THEMES.filter((t) => ownedBgIds.includes(t.id)).map((t) => {
                  const equipped = equippedBgId === t.id;
                  return (
                    <div key={t.id} className={`overflow-hidden rounded-[20px] shadow-card ${equipped ? 'ring-2 ring-pink' : ''}`}>
                      <div className={`relative h-20 bg-gradient-to-br ${t.gradient}`}>
                        {t.floaters.slice(0, 4).map((f, i) => (
                          <span key={i} className="bg-floater" style={{ left: `${f.left}%`, top: `${f.top}%`, animationDelay: `${f.delay}s`, animationDuration: `${f.duration}s` }}><ThemeArt art={f.art} size={f.size * 22} /></span>
                        ))}
                        <span className={`absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-black ${RARITY_COLOR[t.rarity]}`}>{t.rarity}</span>
                      </div>
                      <div className="p-3">
                        <p className="flex items-center gap-1 text-xs font-black text-ink">{t.floaters[0] && <ThemeArt art={t.floaters[0].art} size={14} />}{tv(t.name, lang)}</p>
                        <button
                          onClick={() => onEquipBg(equipped ? null : t.id)}
                          className={`mt-2 w-full rounded-full py-1.5 text-[11px] font-black transition active:scale-[0.97] ${equipped ? 'bg-base text-pink ring-1 ring-pink' : 'bg-pink text-white'}`}>
                          {equipped ? '✓ 使用中（外す）' : 'プロフ帳につける'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ── カラーテーマ（コイン購入）── */}
      {tab === 'theme' && (
        <div className="px-4 pb-8 pt-4">
          <p className="mb-3 text-sm font-black text-ink">🎨 カラーテーマ <span className="ml-1 text-[10px] font-bold text-muted">コインで買い切り・プロフ帳の表紙になるよ</span></p>
          <div className="grid grid-cols-2 gap-3">
            {COLOR_THEMES.map((item) => {
              const owned = ownedThemeIds.includes(item.id);
              const equipped = equippedBgId === item.id;
              return (
                <div key={item.id} className={`rounded-[24px] bg-white p-4 shadow-card ${equipped ? 'ring-2 ring-pink' : ''}`}>
                  <div className={`mb-3 h-20 rounded-2xl bg-gradient-to-br ${item.gradient}`} />
                  <p className="text-sm font-black text-ink">{tv(item.name, lang)}</p>
                  <div className="mt-2">
                    {owned ? (
                      <button
                        onClick={() => onEquipBg(equipped ? null : item.id)}
                        className={`w-full rounded-full py-1.5 text-[11px] font-black transition active:scale-[0.97] ${equipped ? 'bg-base text-pink ring-1 ring-pink' : 'bg-pink text-white'}`}>
                        {equipped ? '✓ 使用中（外す）' : 'プロフ帳につける'}
                      </button>
                    ) : (
                      <button
                        onClick={() => onBuyTheme(item.id)}
                        disabled={coins < item.price}
                        className={`w-full rounded-full py-1.5 text-[11px] font-black transition active:scale-[0.97] ${coins >= item.price ? 'bg-zinc-900 text-amber-400' : 'bg-base text-muted'}`}>
                        <CoinIcon size={13} /> {item.price} で購入
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 通常タブ（deco/font：準備中） ── */}
      {(tab === 'deco' || tab === 'font') && (
        <>
          <div className="grid grid-cols-2 gap-3 px-4 pb-8 pt-3">
            {SHOP_ITEMS[tab].map((item) => (
              <div key={item.id} className="rounded-[24px] bg-white p-4 shadow-card">
                <div className="mb-3 flex h-20 items-center justify-center rounded-2xl bg-gradient-to-br from-pink/10 to-purple/10 text-center text-2xl font-black leading-snug">
                  {item.preview}
                </div>
                <p className="text-sm font-black text-ink">{tv(item.name, lang)}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs font-black text-pinkStrong">¥{item.price}</span>
                  <button disabled className="rounded-full bg-base px-3 py-1.5 text-[11px] font-black text-muted ring-1 ring-pink/20">
                    🔒 準備中
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="px-6 pb-6 text-center text-[11px] font-bold text-muted">購入機能は近日公開予定です。</p>
        </>
      )}

      {/* ── パック詳細モーダル ── */}
      {detailPack && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setDetailPack(null)}>
          <div className="w-full max-h-[70vh] overflow-y-auto rounded-t-[32px] bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center gap-3">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-base text-3xl">{detailPack.thumbnail}</span>
              <div>
                <p className="font-black text-ink">{tv(detailPack.name, lang)}</p>
                <p className="text-xs font-bold text-muted">{detailPack.creator}</p>
              </div>
              <button onClick={() => setDetailPack(null)} className="ml-auto text-xl text-muted">✕</button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {detailPack.stickers.map((s) => (
                <div key={s.id} className="flex flex-col items-center gap-1 rounded-2xl bg-base p-2">
                  <span className={`text-3xl ${detailPack.acquisition.type === 'gacha' && !ownedGachaStickers.includes(s.id) ? 'opacity-30' : ''}`}><RetroText text={s.emoji} /></span>
                  <span className="text-[9px] font-bold text-muted text-center leading-tight">{s.name}</span>
                  {s.rarity && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${RARITY_COLOR[s.rarity]}`}>{s.rarity}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── ガチャ結果モーダル ── */}
      {gachaResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/80 backdrop-blur-sm">
          <div className="gacha-pop mx-4 w-full max-w-sm rounded-[32px] bg-white p-6 shadow-2xl">
            <p className="mb-4 text-center text-base font-black text-ink">
              {gachaResult.length === 1 ? 'ガチャ結果' : '10連ガチャ結果 🎉'}
            </p>
            <div className={`${gachaResult.length === 1 ? 'flex justify-center' : 'grid grid-cols-5 gap-2'}`}>
              {gachaResult.map((r, i) => (
                <div key={i} className={`flex flex-col items-center gap-1 rounded-2xl p-2 ${r.sticker.rarity === 'SR' ? 'bg-zinc-900' : r.sticker.rarity === 'R' ? 'bg-sky-50' : 'bg-base'} ${gachaResult.length === 1 ? 'h-32 w-32' : ''}`}>
                  <span className={gachaResult.length === 1 ? 'text-6xl' : 'text-2xl'}><RetroText text={r.sticker.emoji} /></span>
                  {r.sticker.rarity && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${RARITY_COLOR[r.sticker.rarity]}`}>{r.sticker.rarity}</span>
                  )}
                  {!r.isNew && <span className="text-[9px] font-bold text-muted">重複</span>}
                  {r.isNew && <span className="text-[9px] font-black text-pink">NEW!</span>}
                </div>
              ))}
            </div>
            {gachaResultShards > 0 && (
              <p className="mx-auto mt-4 w-fit rounded-full bg-purple/10 px-3 py-1.5 text-xs font-black text-purple">
                重複分は <ShardIcon size={14} /> かけら +{gachaResultShards} に変わったよ！
              </p>
            )}
            <button onClick={() => setGachaResult(null)}
              className="mt-5 w-full rounded-full bg-pink py-3 text-base font-black text-white shadow-card active:scale-[0.98]">
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* ── ガチャ回転演出 ── */}
      {spinPhase && <GachaSpinOverlay burst={spinPhase === 'burst'} />}

      {/* ── 背景ガチャ結果モーダル ── */}
      {bgResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/80 backdrop-blur-sm">
          <div className="gacha-pop mx-4 w-full max-w-sm overflow-hidden rounded-[32px] bg-white shadow-2xl">
            <div className={`relative h-40 bg-gradient-to-br ${bgResult.theme.gradient}`}>
              {bgResult.theme.floaters.map((f, i) => (
                <span key={i} className="bg-floater" style={{ left: `${f.left}%`, top: `${f.top}%`, animationDelay: `${f.delay}s`, animationDuration: `${f.duration}s` }}><ThemeArt art={f.art} size={f.size * 32} /></span>
              ))}
              <span className={`absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-black ${RARITY_COLOR[bgResult.theme.rarity]}`}>{bgResult.theme.rarity}</span>
            </div>
            <div className="p-6 text-center">
              <p className="text-base font-black text-ink">
                {tv(bgResult.theme.name, lang)}
                {bgResult.isNew && <span className="ml-2 rounded-full bg-pink px-2 py-0.5 text-[10px] font-black text-white">NEW!</span>}
              </p>
              <p className="mt-1 text-xs font-bold text-muted">{bgResult.theme.description}</p>
              {!bgResult.isNew && (
                <p className="mx-auto mt-3 w-fit rounded-full bg-purple/10 px-3 py-1.5 text-xs font-black text-purple">
                  もってたから <ShardIcon size={14} /> かけら +{bgResult.shards} GET！
                </p>
              )}
              <div className="mt-4 flex gap-2">
                <button onClick={() => { onEquipBg(bgResult.theme.id); setBgResult(null); }}
                  className="flex-1 rounded-full bg-pink py-3 text-sm font-black text-white shadow-card active:scale-[0.98]">
                  プロフ帳につける
                </button>
                <button onClick={() => setBgResult(null)}
                  className="flex-1 rounded-full bg-base py-3 text-sm font-black text-muted active:scale-[0.98]">
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PackRow({ pack, owned, onDetail, action }: {
  pack: StickerPack;
  owned: boolean;
  onDetail: () => void;
  action: React.ReactNode;
}) {
  const lang = useLang();
  return (
    <div className="flex items-center gap-3 rounded-[20px] bg-white p-3 shadow-card">
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl ${owned ? 'bg-pink/10' : 'bg-base'}`}>{pack.thumbnail}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-black text-ink">{tv(pack.name, lang)}</p>
          {pack.isNew && <span className="rounded-full bg-pink px-1.5 py-0.5 text-[9px] font-black text-white">NEW</span>}
          {pack.collab && <span className="rounded-full bg-purple/15 px-1.5 py-0.5 text-[9px] font-black text-purple">コラボ</span>}
        </div>
        <p className="text-[11px] font-bold text-muted">{pack.creator}</p>
        <button onClick={onDetail} className="mt-1 flex gap-0.5">
          {pack.stickers.slice(0, 6).map((s) => <span key={s.id} className="text-base"><RetroText text={s.emoji} /></span>)}
        </button>
      </div>
      {action}
    </div>
  );
}

// ===================== /ショップ画面 =====================

function notificationTimeAgo(at: number, lang: Lang = 'ja'): string {
  const diff = Date.now() - at;
  const min = Math.floor(diff / 60000);
  if (min < 1) return t('time_now', lang);
  // 「5分前」「5 minutes ago」などは各言語の書き方（Intl）に任せる
  const rtf = (() => { try { return new Intl.RelativeTimeFormat(INTL_LOCALE[lang] ?? lang, { numeric: 'always' }); } catch { return null; } })();
  const hour = Math.floor(min / 60);
  const day = Math.floor(hour / 24);
  if (rtf) return min < 60 ? rtf.format(-min, 'minute') : hour < 24 ? rtf.format(-hour, 'hour') : rtf.format(-day, 'day');
  return min < 60 ? `${min}分前` : hour < 24 ? `${hour}時間前` : `${day}日前`;
}

// Supabase通知（他ユーザーの行動）を表示用に整形。名前・コメント本文は原文のまま差し込む（訳さない）
function formatServerNotif(n: NotificationRow, lang: Lang = 'ja'): { id: string; icon: string; text: string; at: number; onOpen?: 'answer' | 'profile'; answerId?: string; username?: string } {
  const name = n.actor?.display_name ?? t('sn_someone', lang);
  const uname = n.actor?.username;
  const at = new Date(n.created_at).getTime();
  const base = { id: n.id, at, answerId: n.answer_id ?? undefined, username: uname };
  const said = n.body ? `${lang === 'ja' ? '：' : ': '}${n.body}` : '';
  const circle = n.body ?? t('nav_circles', lang);
  const msg = (key: string, vars: Record<string, string> = {}) => tf(key, lang, { name, ...vars });
  switch (n.type) {
    case 'like':          return { ...base, icon: '💗', text: msg('sn_like'), onOpen: 'answer' };
    case 'sticker':       return { ...base, icon: n.emoji || '⭐️', text: msg('sn_sticker'), onOpen: 'answer' };
    case 'comment':       return { ...base, icon: '💬', text: msg('sn_comment') + said, onOpen: 'answer' };
    case 'follow':        return { ...base, icon: '🎀', text: msg('sn_follow'), onOpen: 'profile' };
    case 'friend_request':return { ...base, icon: '📖', text: msg('sn_friend_request'), onOpen: 'profile' };
    case 'friend_accept': return { ...base, icon: '📖', text: msg('sn_friend_accept'), onOpen: 'profile' };
    case 'circle_request':return { ...base, icon: '🔒', text: msg('sn_circle_request', { circle }) };
    case 'circle_join':   return { ...base, icon: '🔒', text: msg('sn_circle_join', { circle }) };
    case 'circle_accept': return { ...base, icon: '🎉', text: msg('sn_circle_accept', { circle }) };
    case 'blog_like':     return { ...base, icon: '💗', text: msg('sn_blog_like') };
    case 'blog_comment':  return { ...base, icon: '💬', text: msg('sn_blog_comment') + said };
    case 'diary_invite':  return { ...base, icon: '📔', text: msg('sn_diary_invite', { diary: n.body ?? '' }) };
    default:              return { ...base, icon: '🔔', text: msg('sn_default') };
  }
}

function NotificationsScreen({ go, notifications = [], serverNotifs = [] }: { go: (s: Screen, payload?: any) => void; notifications?: AppNotification[]; serverNotifs?: NotificationRow[] }) {
  // 他ユーザー通知（サーバー）＋端末内通知を時系列でまとめる
  const lang = useLang();
  const server = serverNotifs.map((n) => formatServerNotif(n, lang));
  const local = notifications.map((n) => ({ id: 'l-' + n.id, icon: n.icon, text: notifText(n, lang), at: n.at, onOpen: undefined as undefined, answerId: undefined, username: undefined }));
  const merged = [...server, ...local].sort((a, b) => b.at - a.at);
  return (
    <>
      <AppHeader title={t('header_notifications', lang)} />
      <div className="space-y-3 px-4 pt-3">
        {merged.length === 0 && (
          <div className="flex gap-3 rounded-[24px] bg-white p-4 shadow-card">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-pink/15">🎀</span>
            <p className="text-sm font-bold leading-6">{t('notif_welcome', lang)}</p>
          </div>
        )}
        {merged.map((n) => {
          const clickable = n.onOpen === 'answer' ? () => n.answerId && go('detail', n.answerId)
            : n.onOpen === 'profile' ? () => n.username && go('profile', '@' + n.username)
            : undefined;
          return (
            <div key={n.id} onClick={clickable} role={clickable ? 'button' : undefined}
              className={`flex gap-3 rounded-[24px] bg-white p-4 shadow-card ${clickable ? 'cursor-pointer transition active:scale-[0.99]' : ''}`}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-pink/15 text-lg"><RetroText text={n.icon} /></span>
              <div className="min-w-0">
                <p className="text-sm font-bold leading-6">{n.text}</p>
                <p className="text-[10px] font-bold text-muted">{notificationTimeAgo(n.at, lang)}</p>
              </div>
            </div>
          );
        })}
        <button onClick={() => go('home')} className="mt-4 h-12 w-full rounded-full bg-pink text-sm font-black text-white">{t('btn_back_home', lang)}</button>
      </div>
    </>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-[28px] bg-white p-8 text-center text-sm font-bold text-muted shadow-card">{text}</div>;
}

// ── コインウォレット画面 ────────────────────────────────────────
// コインパッケージ定義は @/lib/coinPackages に集約（サーバー検証と共通化）。

// コイン履歴の理由（保存は日本語の文）。決まった形の文だけ表示用に訳す
function coinReason(reason: string, lang: Lang): string {
  if (lang === 'ja' || !reason) return reason;
  let m: RegExpMatchArray | null;
  if ((m = reason.match(/^(\d+)日連続ログインボーナス$/))) return tf('coin_r_streak', lang, { n: m[1] });
  if ((m = reason.match(/^プロフィール(\d+)%達成ボーナス$/))) return tf('coin_r_milestone', lang, { n: m[1] });
  if ((m = reason.match(/^PR案件回答（(.+)）$/))) return tf('coin_r_pr', lang, { brand: m[1] });
  return tv(reason, lang);
}

function WalletScreen({ go, coins, onCheckout }: { go: (s: Screen) => void; coins: number; onCheckout: (packageId: string) => void }) {
  const lang = useLang();
  // 購入は確認をはさむ
  const [pendingPkg, setPendingPkg] = useState<(typeof COIN_PACKAGES)[number] | null>(null);
  const history: Array<{ amount: number; reason: string; date: string }> = (() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('miri_coin_history') || '[]'); } catch { return []; }
  })();

  const earnMethods = [
    { icon: '🌅', label: t('earn_daily', lang), reward: '+3', desc: t('earn_daily_desc', lang) },
    { icon: '✍', label: t('earn_answer', lang), reward: '+5', desc: t('earn_answer_desc', lang) },
    { icon: '💼', label: t('earn_pr', lang), reward: '+15〜20', desc: t('earn_pr_desc', lang) },
    { icon: '🔥', label: t('earn_streak', lang), reward: '+20', desc: t('earn_streak_desc', lang) },
    { icon: '👋', label: t('earn_invite', lang), reward: '+50', desc: t('earn_invite_desc', lang) },
  ];

  return (
    <>
      <AppHeader title={t('header_wallet', lang)} back onBack={() => go('mypage')} />
      <div className="space-y-4 px-4 pt-3 pb-32">
        {/* 残高 */}
        <section className="rounded-[32px] bg-gradient-to-br from-amber-400 to-orange-400 p-6 shadow-card text-white text-center">
          <p className="text-sm font-black opacity-80">{t('wallet_balance', lang)}</p>
          <p className="mt-1 text-5xl font-black"><CoinIcon size={42} /> {coins.toLocaleString()}</p>
          <p className="mt-2 text-xs font-bold opacity-70">{t('wallet_desc', lang)}</p>
        </section>

        {/* コイン購入 */}
        <section className="rounded-[28px] bg-white p-5 shadow-card">
          <p className="mb-1 text-sm font-black text-ink">💳 {t('wallet_buy', lang)}</p>
          <p className="mb-4 text-xs font-bold text-muted">
            {`※ ${STRIPE_ENABLED ? t('wallet_stripe_test', lang) : t('wallet_pay_soon', lang)}`}
          </p>
          <div className="space-y-2">
            {COIN_PACKAGES.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => setPendingPkg(pkg)}
                className={`flex w-full items-center justify-between rounded-2xl px-4 py-3.5 transition active:scale-[0.98] ${pkg.popular ? 'bg-gradient-to-r from-amber-400 to-orange-400 shadow-card' : 'bg-base hover:bg-amber-50'}`}
              >
                <div className="flex items-center gap-2 text-left">
                  <CoinIcon size={22} />
                  <div>
                    <p className={`text-sm font-black ${pkg.popular ? 'text-white' : 'text-ink'}`}>
                      {tf('pm_coins', lang, { n: pkg.coins.toLocaleString() })}
                      {pkg.bonus > 0 && <span className={`ml-1.5 text-[10px] ${pkg.popular ? 'text-white/80' : 'text-green-500'}`}>{tf('wallet_bonus', lang, { n: pkg.bonus })}</span>}
                    </p>
                    {pkg.popular && <span className="rounded-full bg-white/25 px-2 py-0.5 text-[9px] font-black text-white">{t('wallet_popular', lang)}</span>}
                  </div>
                </div>
                <span className={`text-base font-black ${pkg.popular ? 'text-white' : 'text-amber-500'}`}>¥{pkg.price.toLocaleString()}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-center text-[10px] font-bold text-muted">
            <a href="/tokushoho" target="_blank" rel="noopener noreferrer" className="underline">{t('wallet_tokushoho', lang)}</a>
          </p>
        </section>

        {/* 使い道 */}
        <section className="rounded-[28px] bg-white p-5 shadow-card">
          <p className="mb-3 text-sm font-black text-ink">💎 {t('wallet_uses', lang)}</p>
          <div className="space-y-2">
            {[
              { icon: '🔒', label: t('wallet_use_premium', lang), cost: '200' },
              { icon: '🎰', label: t('wallet_use_gacha', lang), cost: '30〜50' },
              { icon: '🎨', label: t('wallet_use_theme', lang), cost: '80〜120' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-2xl bg-base px-4 py-3">
                <div className="flex items-center gap-2">
                  <span>{item.icon}</span>
                  <span className="text-sm font-bold text-ink">{item.label}</span>
                </div>
                <span className="text-sm font-black text-amber-500"><CoinIcon size={14} /> {item.cost}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 稼ぎ方 */}
        <section className="rounded-[28px] bg-white p-5 shadow-card">
          <p className="mb-3 text-sm font-black text-ink"><CoinIcon size={15} /> {t('wallet_earn', lang)}</p>
          <div className="space-y-2">
            {earnMethods.map((m) => (
              <div key={m.label} className="flex items-center justify-between rounded-2xl bg-base px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{m.icon}</span>
                  <div>
                    <p className="text-sm font-black text-ink">{m.label}</p>
                    <p className="text-[10px] font-bold text-muted">{m.desc}</p>
                  </div>
                </div>
                <span className="text-sm font-black text-green-500">{m.reward}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 履歴 */}
        {history.length > 0 && (
          <section className="rounded-[28px] bg-white p-5 shadow-card">
            <p className="mb-3 text-sm font-black text-ink">📋 {t('wallet_history', lang)}</p>
            <div className="space-y-2">
              {history.slice(0, 20).map((item, i) => (
                <div key={i} className="flex items-center justify-between border-b border-dashed border-purple/15 py-2 last:border-0">
                  <div>
                    <p className="text-sm font-bold text-ink">{coinReason(item.reason, lang)}</p>
                    <p className="text-[10px] font-bold text-muted">{new Date(item.date).toLocaleDateString(lang === 'ja' ? 'ja-JP' : INTL_LOCALE[lang] ?? lang)}</p>
                  </div>
                  <span className={`text-sm font-black ${item.amount > 0 ? 'text-green-500' : 'text-red-400'}`}>
                    {item.amount > 0 ? '+' : ''}{item.amount}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* 購入確認（誤タップでの増殖防止） */}
      {pendingPkg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-8" onClick={() => setPendingPkg(null)}>
          <div className="w-full max-w-xs rounded-[28px] bg-white p-6 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-3xl"><CoinIcon size={32} /></p>
            <p className="mt-2 text-lg font-black text-ink">{tf('pm_coins', lang, { n: (pendingPkg.coins + pendingPkg.bonus).toLocaleString() })}</p>
            <p className="mt-1 text-xs font-bold text-muted">
              {STRIPE_ENABLED ? `¥${pendingPkg.price.toLocaleString()} (${t('wallet_stripe_test_short', lang)})` : t('wallet_pay_soon', lang)}
            </p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setPendingPkg(null)} className="flex-1 rounded-full bg-base py-3 text-sm font-black text-muted active:scale-[0.98]">{t('btn_cancel', lang)}</button>
              <button
                onClick={() => { onCheckout(pendingPkg.id); setPendingPkg(null); }}
                className="flex-1 rounded-full bg-amber-400 py-3 text-sm font-black text-white shadow-card active:scale-[0.98]"
              >{STRIPE_ENABLED ? t('wallet_checkout', lang) : 'OK'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── オンボーディング画面 ────────────────────────────────────────
function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const lang = useLang();
  const steps = [
    { emoji: '📖', title: t('ob_1_title', lang), desc: t('ob_1_desc', lang) },
    { emoji: '🎀', title: t('ob_2_title', lang), desc: t('ob_2_desc', lang) },
    { emoji: '🍀', title: t('ob_3_title', lang), desc: t('ob_3_desc', lang) },
  ];
  const [step, setStep] = useState(0);
  const isLast = step === steps.length - 1;

  return (
    <div className="flex h-full flex-col items-center justify-between bg-base px-6 pb-12 pt-16">
      <div className="flex flex-col items-center gap-6 text-center">
        <img src="/icon.png" alt="Miri" className="h-24 w-24 rounded-[28px] shadow-card" />
        <div>
          <p className="text-2xl font-black text-ink">{t('ob_welcome', lang)}</p>
          <p className="mt-1 text-sm font-bold text-muted">{t('ob_tagline', lang)}</p>
        </div>

        <div className="mt-4 w-full rounded-[32px] bg-white p-8 shadow-card">
          <p className="mb-3 text-4xl">{steps[step].emoji}</p>
          <p className="text-lg font-black text-ink">{steps[step].title}</p>
          <p className="mt-2 text-sm font-bold leading-6 text-muted">{steps[step].desc}</p>
        </div>

        <div className="flex gap-2">
          {steps.map((_, i) => (
            <span key={i} className={`h-2 rounded-full transition-all ${i === step ? 'w-6 bg-pink' : 'w-2 bg-purple/20'}`} />
          ))}
        </div>
      </div>

      <div className="w-full space-y-3">
        <button
          onClick={() => isLast ? onDone() : setStep(s => s + 1)}
          className="h-14 w-full rounded-full bg-pink text-base font-black text-white shadow-floating active:scale-[0.98] transition"
        >
          {isLast ? `${t('ob_start', lang)} ✨` : `${t('ob_next', lang)} →`}
        </button>
        {!isLast && (
          <button onClick={onDone} className="w-full py-2 text-sm font-black text-muted">
            {t('ob_skip', lang)}
          </button>
        )}
      </div>
    </div>
  );
}

// ── 今日のお題画面 ──────────────────────────────────────────────
function DailyQuestionScreen({
  go,
  question,
  dailyRecord,
  onSubmit,
  answers,
}: {
  go: (s: Screen, payload?: any) => void;
  question: Question;
  dailyRecord: { date: string; qid?: string; body: string } | null;
  onSubmit: (body: string) => void;
  answers: Answer[];
}) {
  const lang = useLang();
  const [body, setBody] = useState('');
  const [ngError, setNgError] = useState(false);
  const [editing, setEditing] = useState(false);
  const revealed = dailyRecord !== null;
  // このお題への、自分以外の回答（同じお題に限定）
  const othersAnswers = answers.filter((a) => a.user.id !== me.id && a.question?.id === question?.id);

  function submit() {
    if (containsNgWord(body)) { setNgError(true); return; }
    if (!body.trim()) return;
    onSubmit(body.trim());
    setBody('');
    setNgError(false);
    setEditing(false);
  }

  // 「編集する」を押したら、今の回答を前入力して編集モードへ
  function startEdit() {
    setBody(dailyRecord?.body ?? '');
    setEditing(true);
    setNgError(false);
  }

  return (
    <>
      <AppHeader title={t('home_today', lang)} back onBack={() => go('home')} onBell={() => go('notifications')} />
      <div className="space-y-4 px-4 pt-3 pb-32">

        {/* 問題カード */}
        <section className="overflow-hidden rounded-[32px] border border-pink/20 bg-gradient-to-br from-pink/15 via-white to-purple/15 p-5 shadow-card">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-full bg-pink/10 px-3 py-1 text-[10px] font-black text-pink">📅 {t('home_today', lang)}</span>
            <span className="rounded-full bg-base px-3 py-1 text-[10px] font-black text-muted">{question ? localizeQuestion(question, lang).category : ''}</span>
          </div>
          <p className="text-lg font-black text-ink leading-relaxed">{question ? localizeQuestion(question, lang).title : ''}</p>
        </section>

        {!revealed ? (
          <>
            <section className="rounded-[28px] bg-white p-5 shadow-card">
              <p className="mb-3 text-sm font-black text-ink">✍️ {t('create_your_answer', lang)}</p>
              <div className="mb-4 rounded-2xl bg-purple/5 px-4 py-3">
                <p className="text-xs font-bold text-muted">🔒 {t('home_locked', lang)}</p>
              </div>
              <textarea
                value={body}
                onChange={(e) => { setBody(e.target.value); setNgError(false); }}
                maxLength={200}
                rows={4}
                className="w-full resize-none rounded-3xl border border-pink/20 bg-blue-50/40 p-4 text-sm font-bold outline-none focus:border-pink leading-7"
                placeholder={t('daily_ph', lang)}
              />
              <div className="mt-1 flex items-center justify-between">
                <span className={`text-xs font-bold ${ngError ? 'text-red-500' : 'text-transparent'}`}>
                  {t('daily_ng', lang)}
                </span>
                <span className="text-xs font-bold text-muted">{body.length}/200</span>
              </div>
            </section>
            <button
              onClick={submit}
              disabled={!body.trim()}
              className={`h-14 w-full rounded-full text-base font-black text-white shadow-floating transition ${body.trim() ? 'bg-pink active:scale-[0.98]' : 'bg-muted/30'}`}
            >
              {t('daily_submit', lang)} 🔓
            </button>
          </>
        ) : (
          <>
            {/* 自分の回答 */}
            <section className="rounded-[28px] border-2 border-pink/30 bg-white p-5 shadow-card">
              <div className="mb-3 flex items-center justify-between">
                <span className="rounded-full bg-pink/10 px-3 py-1 text-[10px] font-black text-pink">✅ {t('create_your_answer', lang)}</span>
                {!editing && (
                  <button onClick={startEdit} className="rounded-full bg-base px-3 py-1 text-[10px] font-black text-pink transition active:scale-95">
                    ✏️ {t('btn_edit_profile', lang)}
                  </button>
                )}
              </div>
              {editing ? (
                <>
                  <textarea
                    value={body}
                    onChange={(e) => { setBody(e.target.value); setNgError(false); }}
                    maxLength={200}
                    rows={4}
                    className="w-full resize-none rounded-3xl border border-pink/20 bg-blue-50/40 p-4 text-sm font-bold outline-none focus:border-pink leading-7"
                    placeholder={t('daily_ph', lang)}
                  />
                  <div className="mt-1 flex items-center justify-between">
                    <span className={`text-xs font-bold ${ngError ? 'text-red-500' : 'text-transparent'}`}>{t('daily_ng', lang)}</span>
                    <span className="text-xs font-bold text-muted">{body.length}/200</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => { setEditing(false); setNgError(false); }} className="h-11 flex-1 rounded-full bg-base text-sm font-black text-muted transition active:scale-[0.98]">
                      {t('btn_cancel', lang)}
                    </button>
                    <button onClick={submit} disabled={!body.trim()} className={`h-11 flex-1 rounded-full text-sm font-black text-white shadow-floating transition ${body.trim() ? 'bg-pink active:scale-[0.98]' : 'bg-muted/30'}`}>
                      {t('btn_save', lang)}
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm font-bold text-ink leading-6">{dailyRecord.body}</p>
              )}
            </section>

            {/* みんなの回答 */}
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-ink">{t('daily_everyone', lang)}</h2>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-muted shadow-card">{tf('daily_count', lang, { n: othersAnswers.length })}</span>
            </div>
            {othersAnswers.length === 0 ? (
              <div className="rounded-[28px] bg-white p-8 text-center text-sm font-bold text-muted shadow-card">
                {t('daily_none', lang)}
              </div>
            ) : (
              <div className="space-y-3">
                {othersAnswers.map((answer) => (
                  <button
                    key={answer.id}
                    onClick={() => go('detail', answer.id)}
                    className="w-full rounded-[28px] bg-white p-4 text-left shadow-card transition active:scale-[0.98]"
                  >
                    <div
                      className="mb-2 flex items-center gap-2 rounded-full -m-1 p-1 transition active:scale-[0.98] hover:bg-pink/5"
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); go('profile', { name: answer.user.name, id: answer.user.id, avatar: answer.user.avatar, bio: '', common: '' }); }}
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-pink/10 text-lg">
                        {answer.user.avatar && (answer.user.avatar.startsWith('http') || answer.user.avatar.startsWith('data:'))
                          ? <img src={answer.user.avatar} alt="" className="h-full w-full object-cover" />
                          : answer.user.avatar}
                      </span>
                      <div>
                        <p className="text-sm font-black text-ink">{answer.user.name}</p>
                        <p className="text-[10px] font-bold text-muted">{answer.user.id}</p>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-ink leading-6">{answer.body}</p>
                    <div className="mt-3 flex gap-4">
                      <span className="text-xs font-bold text-muted">💗 {answer.reactions.like}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

// ── ブックマーク画面 ──────────────────────────────────────────────
function BookmarksScreen({ go, answers, bookmarks, onToggleBookmark }: {
  go: (s: Screen, payload?: any) => void;
  answers: Answer[];
  bookmarks: string[];
  onToggleBookmark: (id: string) => void;
}) {
  const lang = useLang();
  const saved = answers.filter(a => bookmarks.includes(a.id));
  return (
    <>
      <AppHeader title={t('nav_bookmark', lang)} back onBack={() => go('mypage')} onBell={() => go('notifications')} />
      <div className="space-y-3 px-4 pt-3 pb-32">
        {saved.length === 0 ? (
          <div className="mt-10 flex flex-col items-center gap-4 text-center">
            <span className="text-5xl">🔖</span>
            <p className="font-black text-ink">{t('bm_empty', lang)}</p>
            <p className="text-sm font-bold text-muted">{t('bm_empty_desc', lang)}</p>
          </div>
        ) : saved.map(answer => (
          <button key={answer.id} onClick={() => go('detail', answer.id)}
            className="block w-full text-left">
            <AnswerCard answer={answer} onUserClick={(u) => go('profile', { name: u.name, id: u.id, avatar: u.avatar, bio: '', common: '' })} />
          </button>
        ))}
      </div>
    </>
  );
}

// プロフィール保存(persistBook)を直列化するための共有チェーン（モジュール単一インスタンス）。
// 複数の保存呼び出しを順番に流し、古い内容の保存が新しい内容を上書きするのを防ぐ。
let __persistChain: Promise<void> = Promise.resolve();

export default function Page() {
  // 初回描画は常にスプラッシュ（サーバーと一致させる）。AppContent は localStorage 等を
  // 初期値に使うため、マウント後にだけ描画する（dev で true から始めると #418 になる）。
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isDev) { setReady(true); return; }
    // miri-test 環境は認証不要
    if (window.location.hostname.includes('miri-test')) { setReady(true); return; }
    // miri_auth クッキーで確認（middleware のフォールバック）
    if (!document.cookie.includes('miri_auth=1')) {
      window.location.replace('/');
      return;
    }
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center bg-base">
        <span className="text-3xl animate-pulse">🎀</span>
      </div>
    );
  }

  return <ErrorBoundary><AppContent /></ErrorBoundary>;
}

function AppContent() {
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window === 'undefined') return 'ja';
    return (localStorage.getItem('miri_lang') as Lang) || 'ja';
  });

  function changeLang(l: Lang) {
    setLang(l);
    localStorage.setItem('miri_lang', l);
  }

  // 画面の自動翻訳（外部の翻訳サービスへ画面の文字を送る仕組み）は廃止した。翻訳は t() のキーだけ。
  // 以前の自動翻訳が端末に残したキャッシュを消す。
  useEffect(() => {
    try { localStorage.removeItem('miri_trans_cache'); localStorage.removeItem('miri_trans_cache_v2'); } catch {}
  }, []);

  // 全質問（過去回答のタイトル解決・検索用。RETIRED も含む＝表示が壊れない）
  const localizedQuestions = useMemo(() => getQuestionsForLang(lang), [lang]);
  // 現役の質問（デイリー出題・新規回答の候補に使う。RETIRED は除外）
  const activeQuestions = useMemo(() => getActiveQuestionsForLang(lang), [lang]);

  // ユーザーの回答は外部の翻訳サービスへ送らない（原文のまま表示）。
  // 自由回答の翻訳は、サーバー側の翻訳API（閲覧権限の確認つき）を承認後に入れる。
  const translatedAnswerBodies: Record<string, string> = {};
  const isTranslating = false;

const [selectedQuestion, setSelectedQuestion] = useState<any>(null);

  const [screen, setScreen] = useState<Screen>(() => {
    if (typeof window === 'undefined') return 'home';
    return localStorage.getItem('miri_onboarded') ? 'home' : 'onboarding';
  });
  const [selectedAnswerId, setSelectedAnswerId] = useState(initialAnswers[0]?.id ?? '');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [diagTarget, setDiagTarget] = useState<string | null>(null); // 一致率しんだんの相手（@username）／null=自分
  // モックに居ない（＝Supabase上の実ユーザー）を開いたときに読み込むプロフィール
  const [viewedProfile, setViewedProfile] = useState<Profile | null>(null);
  // 開いている他ユーザーの Supabase プロフ帳（info/BEST3/今月/しつもん）
  const [viewedProfileBook, setViewedProfileBook] = useState<{ info?: Record<string, any>; best3?: Best3Data; monthly?: MonthlyBest3; questions?: { q: string; a: string }[]; visibility?: Record<string, FieldVisibility>; pen?: Pen | null } | null>(null);
  // 開いている他ユーザーの uuid（フォロー用）
  const [viewedProfileUid, setViewedProfileUid] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answer[]>(initialAnswers);
  // 自分の uuid
  const [myUid, setMyUid] = useState<string | null>(null);
  // 回答ごとのリアクション集計： { answerId: { type('like'|絵文字): {count, mine} } }
  const [reactState, setReactState] = useState<Record<string, Record<string, { count: number; mine: boolean }>>>({});
  // 回答ごとの投稿者 uuid（通知の宛先に使う）
  const [answerAuthorUid, setAnswerAuthorUid] = useState<Record<string, string>>({});
  useEffect(() => { if (dbReady()) { void getCurrentUserId().then((id) => setMyUid(id)); } }, []);
  const selectedAnswer = answers.find((a) => a.id === selectedAnswerId) || answers[0];

  // 日次お題は「プロフ帳の標準しつもん」と同内容のものを出さない（二度手間を避ける）。
  // 重複するお題IDをここに追加する（例：q4/eq14＝「いま一番ハマってること」＝しつもん「最近ハマっていることは？」）。
  const dailyPool = useMemo(() => {
    const pool = activeQuestions.filter((q) => !DAILY_EXCLUDE_QIDS.has(q.id));
    return pool.length ? pool : activeQuestions;
  }, [activeQuestions]);

  // ── 今日のお題（言語に応じて切り替わる）────────────────────────
  const dailyQuestion = useMemo(() => {
    const today = new Date().toDateString();
    let h = 0;
    for (let i = 0; i < today.length; i++) h = Math.imul(31, h) + today.charCodeAt(i) | 0;
    return dailyPool[Math.abs(h) % dailyPool.length];
  }, [dailyPool]);

  // 自分が既に回答したお題のID集合（＝もう「新規回答」できないお題）
  const myAnsweredQids = useMemo(
    () => new Set(answers.filter((a) => a.user.id === me.id && a.question?.id).map((a) => a.question!.id)),
    [answers]
  );

  const [dailyRecord, setDailyRecord] = useState<{ date: string; qid?: string; body: string } | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const s = localStorage.getItem('miri_daily_answer');
      if (!s) return null;
      const r = JSON.parse(s) as { date: string; qid?: string; body: string };
      // お題と同じ「ローカル日付」で判定し、かつ回答が“今日のお題”に対するものだけ表示する
      // （タイムゾーン差やお題切替による質問と回答のズレを防ぐ）。
      const okDate = r.date === new Date().toDateString();
      const okQuestion = !!r.qid && r.qid === dailyQuestion?.id;
      return okDate && okQuestion ? r : null;
    } catch { return null; }
  });

  function submitDailyAnswer(body: string) {
    const record = { date: new Date().toDateString(), qid: dailyQuestion?.id ?? '', body };
    setDailyRecord(record);
    localStorage.setItem('miri_daily_answer', JSON.stringify(record));
    postAnswer({ questionId: dailyQuestion?.id ?? '', body, sticker: '✍️', visibility: 'public' });
  }


  const [profileBookInfo, setProfileBookInfo] = useState(() => {
  if (typeof window === 'undefined') return defaultProfileBookInfo;
  try {
    const saved = localStorage.getItem('profileBookInfo');
    return saved ? { ...defaultProfileBookInfo, ...JSON.parse(saved) } : defaultProfileBookInfo;
  } catch { return defaultProfileBookInfo; }
});

  // 項目ごとの公開範囲（公開/フォロワー限定/非公開）。未設定＝公開。
  const [fieldVisibility, setFieldVisibility] = useState<Record<string, FieldVisibility>>(() => {
    if (typeof window === 'undefined') return {};
    try { return JSON.parse(localStorage.getItem('profileFieldVisibility') || '{}'); } catch { return {}; }
  });
  function updateFieldVisibility(next: Record<string, FieldVisibility>) {
    profileDirtyRef.current = true;
    setFieldVisibility(next);
    try { localStorage.setItem('profileFieldVisibility', JSON.stringify(next)); } catch {}
    persistBook(); // book.__visibility に保存
  }

  // わたしのペン（書体・インク・大きさ）。未設定なら null＝従来の見た目。
  const [myPen, setMyPen] = useState<Pen | null>(() => {
    if (typeof window === 'undefined') return null;
    try { return normalizePen(JSON.parse(localStorage.getItem('miri_pen') || 'null')); } catch { return null; }
  });
  // 表示中の自分の回答・プロフ帳にもすぐ反映（ユーザーID確定後も追従）
  useEffect(() => { setCachedPen(me.id, myPen); }, [myPen, me.id]);
  const penSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function updateMyPen(next: Pen) {
    profileDirtyRef.current = true;
    setMyPen(next);
    try { localStorage.setItem('miri_pen', JSON.stringify(next)); } catch {}
    // 連続で選び直しても保存は最後の1回だけ（book.__pen）
    if (penSaveTimer.current) clearTimeout(penSaveTimer.current);
    penSaveTimer.current = setTimeout(() => { void persistBook(); }, 800);
  }

  // ── ログインユーザーのSupabaseプロフィールを読み込み、me・プロフィール帳へ反映 ──
  // （production で Supabase が設定されているときのみ。dev/未設定では従来どおり）
  const [, setMeVersion] = useState(0);
  // 初回のサーバー読込は非同期で遅れて解決する。その間にユーザーが編集・保存すると、
  // 遅れて届いたサーバーの“古いプロフィール”がローカルの編集を上書きしてしまう。
  // ユーザーが編集したら true にして、初回読込の上書きをスキップする（編集を守る）。
  const profileDirtyRef = useRef(false);
  useEffect(() => {
    // ① まずローカル（/setup で保存したID・表示名）から me を即時更新（確実・同期）
    try {
      const u = localStorage.getItem('miri_username');
      const dn = localStorage.getItem('miri_displayname');
      if (u) me.id = '@' + u;
      if (dn) me.name = dn;
      // 本番の新規ユーザーは公認扱いにしない（Koki既定のisOfficial=trueを打ち消す）
      if (!isDev && (u || dn)) me.isOfficial = false;
    } catch {}
    setMeVersion((v) => v + 1);
    // ※ 初期設定ボーナスは「ゲームデータ復元後」に別effectで付与する（再ログインでの再取得防止）

    // ② Supabase から正式なプロフィールを読み込んで上書き（あれば）
    if (!dbReady()) return;
    let cancelled = false;
    (async () => {
      // セッション切れ検知：miri_auth クッキーで「ログイン中」に見えても Supabase セッションが
      // 失効していると回答が保存されず“自分の回答だけ”になる。明示的に再ログインを促す。
      try {
        const looksLoggedIn = document.cookie.includes('miri_auth=1') || !!localStorage.getItem('miri_username');
        if (!isDev && looksLoggedIn) {
          const ok = await hasValidSession();
          if (!cancelled && !ok) {
            showToast(`⚠️ ${t('toast_session_expired', lang)}`);
          } else if (!cancelled && ok) {
            // 有効セッションがあれば profiles 行を保証（旧アカウントで欠落していると回答保存が失敗する）
            await ensureProfile();
            // 前回サーバー保存に失敗した編集（写真・プロフ帳）があれば、
            // セッションが復帰したこのタイミングで自動的に再送する。
            if (localStorage.getItem('miri_pending_profile_sync') === '1') {
              await persistBook();               // book（プロフ帳・BEST3・ゲーム）を再送
              syncIdentityToProfiles();          // 名前・写真アイコンを再送
              if (localStorage.getItem('miri_pending_profile_sync') !== '1') {
                showToast(`✅ ${t('toast_saved_pending', lang)}`);
              }
            }
          }
        }
      } catch {}

      const p = await getMyProfile();
      if (cancelled || !p) return;
      me.id = '@' + p.username;
      me.isOfficial = !!p.is_official;
      // ユーザーがこのセッションで編集済みなら、遅れて届いたサーバー値で上書きしない
      // （＝編集を守る。写真・名前・プロフ帳すべてに適用）。
      const overwriteFromServer = !profileDirtyRef.current;
      // プロフィール帳を Supabase から復元（端末を変えても引き継ぐ）
      const book: any = (p.book && typeof p.book === 'object') ? p.book : {};
      const { __best3, __monthly, __questions, __visibility, __game, __choices, __perception, __pen, ...info } = book;
      // 項目ごとの公開設定を復元（他端末でも引き継ぐ）。
      if (overwriteFromServer && __visibility && typeof __visibility === 'object') {
        setFieldVisibility(__visibility);
        try { localStorage.setItem('profileFieldVisibility', JSON.stringify(__visibility)); } catch {}
      }
      // 公開表示名はニックネーム優先。DBの display_name が本名など古い値でも、
      // 読み込み時にニックネームへ揃える（サイドバー・新規回答へ即反映）。
      const preferredName =
        ((info.nickname || info.name || p.display_name || p.username) || '').trim() || p.username;
      if (overwriteFromServer) me.name = preferredName;
      // DBの display_name がニックネームと違うなら、一度だけ更新して既存回答の著者名も直す。
      if (overwriteFromServer && preferredName && preferredName !== p.display_name) {
        void saveProfileIdentity({ display_name: preferredName });
        // すでに読み込み済みの自分の回答も、その場で新しい表示名へ更新（リロード不要）。
        setAnswers((prev) =>
          prev.map((a) => (a.user.id === '@' + p.username ? { ...a, user: { ...a.user, name: preferredName } } : a)),
        );
      }
      // 写真アイコンを Supabase から復元（端末を変えても引き継ぐ）
      if (overwriteFromServer && p.avatar_url && (p.avatar_url.startsWith('http') || p.avatar_url.startsWith('data:'))) {
        setAvatarUrl(p.avatar_url);
        try { localStorage.setItem('avatarUrl', p.avatar_url); } catch {}
      }
      if (overwriteFromServer && Object.keys(book).length > 0) {
        // BEST3 / 今月のBEST3 / ひとことしつもん は名前空間キーで格納しているので分離して復元。
        if (__best3) { setBest3(__best3); try { localStorage.setItem('best3', JSON.stringify(__best3)); } catch {} }
        { const pen = normalizePen(__pen); if (pen) { setMyPen(pen); try { localStorage.setItem('miri_pen', JSON.stringify(pen)); } catch {} } }
        // 今月のぶんだけ復元（過去の月のものは無視して新しい枠にする）
        if (__monthly && __monthly.monthKey === currentMonthInfo().monthKey) {
          setMonthlyBest3(__monthly);
          try { localStorage.setItem('miri_monthly_best3', JSON.stringify(__monthly)); } catch {}
        }
        if (__questions) { setProfileQuestions(__questions); try { localStorage.setItem('profileQuestions', JSON.stringify(__questions)); } catch {} }
        if (Object.keys(info).length > 0) {
          setProfileBookInfo((prev: typeof defaultProfileBookInfo) => ({ ...prev, ...info }));
        }
      }

      // ── 旧バージョンで端末だけに保存されたプロフ帳を Supabase へ自動移行 ──
      // サーバーの book が実質空で、端末に入力済みデータがあるときのみ一度アップロードする。
      try {
        const serverHasData =
          !!__best3 || !!__monthly || !!__questions ||
          Object.values(info).some((v: any) => typeof v === 'string' && v.trim());
        const localInfo = JSON.parse(localStorage.getItem('profileBookInfo') || '{}');
        const localHasInfo = Object.values(localInfo).some((v: any) => typeof v === 'string' && v.trim());
        const localB3 = JSON.parse(localStorage.getItem('best3') || 'null');
        const localHasB3 = localB3 && Object.values(localB3).some((arr: any) => Array.isArray(arr) && arr.some((v: string) => v && v.trim()));
        const localMo = JSON.parse(localStorage.getItem('miri_monthly_best3') || 'null');
        const localHasMo = localMo && Array.isArray(localMo.items) && localMo.items.some((v: string) => v && v.trim());
        if (!cancelled && !serverHasData && (localHasInfo || localHasB3 || localHasMo)) {
          persistBook(); // 端末のデータをサーバーへ移行
        }
      } catch {}

      setMeVersion((v) => v + 1);
    })();
    return () => { cancelled = true; };
  }, []);

const [communityQuestions, setCommunityQuestions] = useState(() => {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem('communityQuestions');
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
});

const [avatarUrl, setAvatarUrl] = useState<string>(() => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('avatarUrl') || '';
});

function updateAvatarUrl(url: string) {
  profileDirtyRef.current = true; // 初回サーバー読込による上書きから編集を守る
  setAvatarUrl(url);
  if (url) localStorage.setItem('avatarUrl', url);
  else localStorage.removeItem('avatarUrl');
  syncIdentityToProfiles({ avatarUrl: url });
}

// プロフィール帳の「なまえ／ニックネーム」と写真アイコンを、アカウントの公開情報
// （profiles.display_name / avatar_url）へ同期する。
// これをしないと、過去にした回答に表示される著者名・アイコンが古いまま残る
// （回答フィードは answers に profiles を結合して著者情報を表示しているため）。
function syncIdentityToProfiles(override?: { info?: typeof defaultProfileBookInfo; avatarUrl?: string }) {
  const info = override?.info ?? profileBookInfo;
  const photo = override?.avatarUrl !== undefined ? override.avatarUrl : avatarUrl;
  const username = me.id.replace(/^@/, '');
  // 公開する表示名は「ニックネーム」を優先（本名＝なまえ より先）。
  const displayName = ((info.nickname || info.name || me.name || username) || '').trim() || username;
  const avatar = photo || me.avatar;

  // 画面内の自分の情報を即時更新（リロードを待たずに、既存の回答へも反映する）
  me.name = displayName;
  setAnswers((prev) =>
    prev.map((a) => (a.user.id === me.id ? { ...a, user: { ...a.user, name: displayName, avatar } } : a)),
  );
  setMeVersion((v) => v + 1);

  // Supabase の公開プロフィールへ保存（未設定・未認証なら best-effort でスキップ）
  if (!dbReady()) return;
  (async () => {
    try {
      const res = await saveProfileIdentity({ display_name: displayName, avatar_url: avatar });
      if (!res.ok && res.error !== 'not_configured') onProfileSyncFailed();
    } catch { onProfileSyncFailed(); }
  })();
}

const [appTheme, setAppTheme] = useState<AppThemeId>(() => {
  if (typeof window === 'undefined') return 'default';
  return (localStorage.getItem('appTheme') as AppThemeId) || 'default';
});

useEffect(() => {
  applyTheme(appTheme);
}, [appTheme]);

function changeTheme(id: AppThemeId) {
  setAppTheme(id);
  localStorage.setItem('appTheme', id);
  applyTheme(id);
}

const [circles, setCircles] = useState<Circle[]>(() => {
  if (typeof window === 'undefined') return initialCircles;
  try { const saved = localStorage.getItem('circles'); return saved ? JSON.parse(saved) : initialCircles; } catch { return initialCircles; }
});
const [circlePosts, setCirclePosts] = useState<CirclePost[]>(() => {
  if (typeof window === 'undefined') return initialCirclePosts;
  try { const saved = localStorage.getItem('circlePosts'); return saved ? JSON.parse(saved) : initialCirclePosts; } catch { return initialCirclePosts; }
});
const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null);

  // ── スタンプ・ガチャ ──────────────────────────────────────
  const [coins, setCoins] = useState<number>(() => {
    // ①dev=デモ用に500 / ②本番=0スタート（新規ユーザーはKokiの残高を引き継がない）
    const initial = isDev ? 500 : 0;
    if (typeof window === 'undefined') return initial;
    const s = localStorage.getItem('miri_coins');
    return s ? Number(s) : initial;
  });
  // ゲームデータ（コイン＋報酬ガード）の復元が終わったか。
  // これが true になるまでボーナス付与を待たせ、再ログイン直後の「ガード未復元での再取得」を防ぐ。
  const [gameLoaded, setGameLoaded] = useState(false);

  // ── PR案件 ────────────────────────────────────────────────
  const [prQuestion] = useState<PRQuestion>(() => getTodaysPRQuestion());
  const [hasAnsweredPR, setHasAnsweredPR] = useState<boolean>(() => hasAnsweredPRToday());
  const [ownedPackIds, setOwnedPackIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try { const s = localStorage.getItem('miri_owned_packs'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [ownedGachaStickers, setOwnedGachaStickers] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try { const s = localStorage.getItem('miri_gacha_stickers'); return s ? JSON.parse(s) : []; } catch { return []; }
  });

  // ── 世界観背景ガチャ ──────────────────────────────────────
  const [ownedBgIds, setOwnedBgIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try { const s = localStorage.getItem('miri_owned_bgs'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [equippedBgId, setEquippedBgId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('miri_equipped_bg');
  });

  function addOwnedBg(id: string) {
    setOwnedBgIds((prev) => {
      const next = [...new Set([...prev, id])];
      localStorage.setItem('miri_owned_bgs', JSON.stringify(next));
      return next;
    });
    const theme = getBgTheme(id);
    if (theme) addNotification('🎠', `新しい背景「${theme.name}」をゲットしました！`, 'notif_bg_get', { name: theme.name });
  }

  // ── かけら（ガチャ被り補償） ──────────────────────────────
  const [bgShards, setBgShards] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    const s = localStorage.getItem('miri_bg_shards');
    return s ? parseInt(s, 10) || 0 : 0;
  });

  function addBgShards(n: number) {
    setBgShards((prev) => {
      const next = prev + n;
      localStorage.setItem('miri_bg_shards', String(next));
      return next;
    });
  }

  function exchangeBgTheme(id: string) {
    const theme = BG_THEMES.find((t) => t.id === id);
    if (!theme || ownedBgIds.includes(id) || bgShards < SHARD_EXCHANGE_COST) return;
    setBgShards((prev) => {
      const next = prev - SHARD_EXCHANGE_COST;
      localStorage.setItem('miri_bg_shards', String(next));
      return next;
    });
    addOwnedBg(id);
    showToast(`✨ ${tf('toast_shard_swap', lang, { name: tv(theme.name, lang) })}`);
  }

  function equipBg(id: string | null) {
    setEquippedBgId(id);
    if (id) localStorage.setItem('miri_equipped_bg', id);
    else localStorage.removeItem('miri_equipped_bg');
  }

  // ── カラーテーマ（コイン購入・買い切り） ──────────────────
  const [ownedThemeIds, setOwnedThemeIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try { const s = localStorage.getItem('miri_owned_themes'); return s ? JSON.parse(s) : []; } catch { return []; }
  });

  function buyTheme(id: string) {
    const item = COLOR_THEMES.find((t) => t.id === id);
    if (!item || ownedThemeIds.includes(id)) return;
    if (!spendCoins(item.price)) { showToast(`${t('toast_no_coins', lang)} 🥲`); return; }
    setOwnedThemeIds((prev) => {
      const next = [...prev, id];
      localStorage.setItem('miri_owned_themes', JSON.stringify(next));
      return next;
    });
    showToast(tf('toast_bought_item', lang, { name: tv(item.name, lang) }));
    addNotification('🎨', `カラーテーマ「${item.name}」を購入しました`, 'notif_theme_buy', { name: item.name });
  }

  // ── プロフ帳交換（なかよし度アクション） ─────────────────
  const [exchangedProfiles, setExchangedProfiles] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try { const s = localStorage.getItem('miri_exchanged_profiles'); return s ? JSON.parse(s) : []; } catch { return []; }
  });

  function exchangeProfileBook(userId: string) {
    setExchangedProfiles((prev) => {
      if (prev.includes(userId)) return prev;
      const next = [...prev, userId];
      localStorage.setItem('miri_exchanged_profiles', JSON.stringify(next));
      return next;
    });
    showToast(`📖 ${t('toast_book_exchanged', lang)} 💗`);
  }

  function purchasePack(packId: string) {
    setOwnedPackIds((prev) => {
      const next = [...prev, packId];
      localStorage.setItem('miri_owned_packs', JSON.stringify(next));
      return next;
    });
    showToast(`✨ ${t('toast_stamp_bought', lang)}`);
  }

  function addGachaStickers(ids: string[]) {
    setOwnedGachaStickers((prev) => {
      const next = [...new Set([...prev, ...ids])];
      localStorage.setItem('miri_gacha_stickers', JSON.stringify(next));
      return next;
    });
  }

  function addCoins(amount: number, reason = '') {
    setCoins((prev) => {
      const next = prev + amount;
      localStorage.setItem('miri_coins', String(next));
      if (reason) {
        try {
          const history = JSON.parse(localStorage.getItem('miri_coin_history') || '[]');
          history.unshift({ amount, reason, date: new Date().toISOString() });
          localStorage.setItem('miri_coin_history', JSON.stringify(history.slice(0, 100)));
        } catch { /* ignore corrupted history */ }
      }
      return next;
    });
  }

  function spendCoins(amount: number): boolean {
    if (coins < amount) return false;
    setCoins((prev) => {
      const next = prev - amount;
      localStorage.setItem('miri_coins', String(next));
      return next;
    });
    return true;
  }

  // コイン購入：Stripe Checkout を開始（有効時のみ）。付与は決済検証後にサーバー側で行う。
  async function startCheckout(packageId: string) {
    if (!STRIPE_ENABLED) { showToast(`💳 ${t('wallet_pay_soon', lang)}`); return; }
    try {
      const token = await getAccessToken();
      if (!token) { showToast(t('toast_login_required', lang)); return; }
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ packageId }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.url) { window.location.href = json.url; return; }
      showToast(t('toast_checkout_failed_later', lang));
    } catch {
      showToast(t('toast_checkout_failed_network', lang));
    }
  }

  // ── ゲームデータ（コイン/スタンプ/背景/かけら/テーマ）のSupabase同期 ──
  // 既存の book 列に __game として保存するため、SQL/テーブル追加は不要。
  const gameSyncReady = useRef(false);
  // 起動時：サーバーの __game を端末へ復元
  // ※ 自動保存(persistGame)は「復元が成功してから」のみ有効化する。
  //   セッション未確立で getMyProfile が null のときに保存を有効化すると、
  //   空データでサーバーを上書きしてしまうため、成功するまでリトライする。
  useEffect(() => {
    if (!dbReady()) { gameSyncReady.current = true; setGameLoaded(true); return; }
    let cancelled = false;
    let tries = 0;
    async function loadOnce(): Promise<boolean> {
      const uid = await getCurrentUserId();
      if (!uid) return false;            // セッション未確立 → まだ有効化しない
      const p = await getMyProfile();
      if (!p) return false;              // プロフィール取得失敗 → リトライ
      const g = (p.book as any)?.__game;
      if (!cancelled && g && typeof g === 'object') {
        if (typeof g.coins === 'number') { setCoins(g.coins); localStorage.setItem('miri_coins', String(g.coins)); }
        if (Array.isArray(g.packs)) { setOwnedPackIds(g.packs); localStorage.setItem('miri_owned_packs', JSON.stringify(g.packs)); }
        if (Array.isArray(g.gacha)) { setOwnedGachaStickers(g.gacha); localStorage.setItem('miri_gacha_stickers', JSON.stringify(g.gacha)); }
        if (Array.isArray(g.bgs)) { setOwnedBgIds(g.bgs); localStorage.setItem('miri_owned_bgs', JSON.stringify(g.bgs)); }
        if (Array.isArray(g.themes)) { setOwnedThemeIds(g.themes); localStorage.setItem('miri_owned_themes', JSON.stringify(g.themes)); }
        if (typeof g.shards === 'number') { setBgShards(g.shards); localStorage.setItem('miri_bg_shards', String(g.shards)); }
        if (g.bg !== undefined) { setEquippedBgId(g.bg); if (g.bg) localStorage.setItem('miri_equipped_bg', g.bg); else localStorage.removeItem('miri_equipped_bg'); }
        if (g.appTheme) { setAppTheme(g.appTheme); localStorage.setItem('appTheme', g.appTheme); applyTheme(g.appTheme); }
        if (g.freeGacha) { try { localStorage.setItem('miri_free_gacha_used', g.freeGacha); } catch {} }
        // ── 報酬の重複防止ガードを復元（コイン無限増殖対策）──
        // 配列は「取得済みを絶対に減らさない」ためローカルとサーバーを統合（union）してから保存。
        const mergeArr = (key: string, serverVal: any) => {
          let local: string[] = [];
          try { local = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
          const server = Array.isArray(serverVal) ? serverVal : [];
          localStorage.setItem(key, JSON.stringify([...new Set([...server, ...local])]));
        };
        mergeArr('miri_earned_fields', g.earnedFields);   // プロフィール入力報酬
        mergeArr('miri_profile_milestones', g.profileMilestones); // プロフィール完成度ボーナス
        mergeArr('miri_rewarded_qids', g.rewardedQids);   // お題回答報酬
        if (g.setupBonus) localStorage.setItem('miri_setup_bonus', g.setupBonus); // 初期設定ボーナス（1回のみ）
        if (g.prAnswered) localStorage.setItem('miri_pr_answered', g.prAnswered); // PR案件（日次）
        if (g.dailyLogin) localStorage.setItem('miri_daily_login', g.dailyLogin); // デイリーログイン（日次）
        if (typeof g.loginStreak === 'number' && g.loginStreak > 0) {
          const localStreak = parseInt(localStorage.getItem('miri_streak') || '0');
          localStorage.setItem('miri_streak', String(Math.max(localStreak, g.loginStreak)));
        }
      }
      return true;                       // 取得できた（__game が無い新規アカウントも成功扱い）
    }
    (async () => {
      // 成功するまで最大5回リトライ（セッション復元待ち）。それでもダメなら
      // 保存を有効化しない＝サーバーを空で上書きしない安全側に倒す。
      while (!cancelled && tries < 5) {
        const ok = await loadOnce();
        if (ok) { gameSyncReady.current = true; setGameLoaded(true); return; }
        tries++;
        await new Promise((r) => setTimeout(r, 600));
      }
    })();
    return () => { cancelled = true; };
  }, []);
  // 変更時：デバウンスしてサーバーへ保存（初回復元後のみ）
  // ※ ゲームデータ専用の read-merge-write を使う。book 全体を localStorage から
  //    組み直す persistBook を使うと、別端末ログイン直後（プロフ本文がまだ
  //    localStorage に無い状態）にサーバーのプロフ帳を空で上書きしてしまうため。
  useEffect(() => {
    if (!gameSyncReady.current || !dbReady()) return;
    const t = setTimeout(() => { persistGame(); }, 1500);
    return () => clearTimeout(t);
  }, [coins, ownedPackIds, ownedGachaStickers, ownedBgIds, equippedBgId, bgShards, ownedThemeIds, appTheme]);

  // Stripe からの戻り（?checkout=success|cancel）を処理：付与済みコインをサーバーから取り込む。
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const cs = params.get('checkout');
    if (!cs) return;
    // URL からパラメータを消す（再実行防止・見た目）
    const url = new URL(window.location.href);
    url.searchParams.delete('checkout');
    window.history.replaceState({}, '', url.toString());
    if (cs === 'cancel') { showToast(t('toast_checkout_cancel', lang)); return; }
    if (cs !== 'success') return;
    showToast(`🎁 ${t('toast_checkout_thanks', lang)}`);
    if (!dbReady()) return;
    let stop = false;
    (async () => {
      // Webhook 付与が反映されるまで数回リトライしてサーバー残高を取り込む
      for (let tries = 0; !stop && tries < 6; tries++) {
        const p = await getMyProfile();
        const g = (p?.book as any)?.__game;
        const localCoins = Number(localStorage.getItem('miri_coins') || '0');
        if (g && typeof g.coins === 'number' && g.coins > localCoins) {
          setCoins(g.coins);
          localStorage.setItem('miri_coins', String(g.coins));
          showToast(`✅ ${t('toast_coins_applied', lang)}`);
          return;
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
    })();
    return () => { stop = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 通知設定 ────────────────────────────────────────────────
  const [notifyOdai, setNotifyOdai] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('miri_notify_odai') === 'true';
  });

  function toggleNotifyOdai(val: boolean) {
    if (val) {
      if (typeof Notification === 'undefined' || Notification.permission === 'denied') {
        showToast(t('toast_notif_blocked', lang));
        return;
      }
      Notification.requestPermission().then((perm) => {
        const granted = perm === 'granted';
        setNotifyOdai(granted);
        localStorage.setItem('miri_notify_odai', String(granted));
        if (!granted) showToast(t('toast_notif_needed', lang));
        else showToast(`🔔 ${t('toast_notif_on', lang)}`);
      });
    } else {
      setNotifyOdai(false);
      localStorage.setItem('miri_notify_odai', 'false');
    }
  }

  // お題変更時に通知
  useEffect(() => {
    if (!notifyOdai) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    const today = new Date().toDateString();
    if (localStorage.getItem('miri_last_notified_odai') === today) return;
    new Notification(`✿ Miri — ${t('home_today', lang)}`, { body: dailyQuestion?.title ?? '', tag: 'miri-daily' });
    localStorage.setItem('miri_last_notified_odai', today);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifyOdai, dailyQuestion]);

  // 初期設定(/setup)完了ボーナス（初回のみ）。
  // ゲームデータ復元後にだけ判定＝再ログイン/端末クリアでガードが空のうちに再取得されるのを防ぐ。
  useEffect(() => {
    if (!gameLoaded) return;
    try {
      if (localStorage.getItem('miri_username') && !localStorage.getItem('miri_setup_bonus')) {
        localStorage.setItem('miri_setup_bonus', '1');
        addCoins(SETUP_BONUS, '初期設定ボーナス');
        showToast(tf('toast_setup_bonus', lang, { n: SETUP_BONUS }));
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameLoaded]);

  // デイリーログインボーナス（連続日数は「前日にログインしていたか」で判定。1日でも空くとリセット）
  // ゲームデータ復元後にだけ判定＝日次ガードが空のうちに再取得されるのを防ぐ。
  useEffect(() => {
    if (!gameLoaded) return;
    const now = new Date();
    const today = now.toDateString();
    const last = localStorage.getItem('miri_daily_login');
    if (last === today) return;
    const yesterday = new Date(now.getTime() - 86400000).toDateString();
    const prevStreak = parseInt(localStorage.getItem('miri_streak') || '0');
    const streak = last === yesterday ? prevStreak + 1 : 1; // 昨日ログイン→継続、そうでなければ1日目
    localStorage.setItem('miri_daily_login', today);
    localStorage.setItem('miri_streak', String(streak));
    // 7日ごとに連続ボーナス（7,14,21…日目）。それ以外の日はデイリー分のみ。
    const bonus = streak > 0 && streak % 7 === 0 ? 20 : 0;
    const total = 3 + bonus;
    addCoins(total, bonus ? `${streak}日連続ログインボーナス` : 'デイリーログイン');
    setTimeout(() => {
      const streakNote = bonus ? tf('daily_streak', lang, { n: streak }) : '';
      showToast(`🎁 ${tf('toast_daily', lang, { n: total })}${streakNote}`);
      addNotification('🎁', `デイリーログインボーナスで ${total} コインもらいました${bonus ? `（${streak}日連続！）` : ''}`, bonus ? 'notif_daily_streak' : 'notif_daily', { n: total, d: streak });
    }, 800);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameLoaded]);

  const ownedStickerCount = useMemo(() =>
    STICKER_PACKS.reduce((total, pack) => {
      if (pack.acquisition.type === 'free') return total + pack.stickers.length;
      if (pack.acquisition.type === 'purchase') return total + (ownedPackIds.includes(pack.id) ? pack.stickers.length : 0);
      return total + pack.stickers.filter((s) => ownedGachaStickers.includes(s.id)).length;
    }, 0),
  [ownedPackIds, ownedGachaStickers]);

  // ── 公認ユーザー購読 ─────────────────────────────────────────
  const [subscribedOfficials, setSubscribedOfficials] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try { const s = localStorage.getItem('miri_subscribed_officials'); return s ? JSON.parse(s) : []; } catch { return []; }
  });

  function toggleSubscription(userId: string) {
    if (subscribedOfficials.includes(userId)) return; // 解除不可
    const ok = spendCoins(200);
    if (!ok) {
      showToast(t('toast_need_200', lang));
      return;
    }
    setSubscribedOfficials((prev) => {
      const next = [...prev, userId];
      localStorage.setItem('miri_subscribed_officials', JSON.stringify(next));
      return next;
    });
    showToast(`✨ ${t('toast_premium_unlocked', lang)}`);
  }

  // ── 自分のプレミアムコンテンツ（公認ユーザー用） ─────────────
  const defaultPremiumContent: PremiumSection = { price: 480, description: '', questions: [], note: '' };
  const [premiumContent, setPremiumContent] = useState<PremiumSection>(() => {
    if (typeof window === 'undefined') return defaultPremiumContent;
    try { const s = localStorage.getItem('miri_premium_content'); return s ? JSON.parse(s) : defaultPremiumContent; } catch { return defaultPremiumContent; }
  });

  function updatePremiumContent(next: PremiumSection) {
    setPremiumContent(next);
    localStorage.setItem('miri_premium_content', JSON.stringify(next));
  }

// 共有サークルを使うか（本番＝Supabase / ①dev＝端末内デモ）
const circlesUseDb = !isDev && dbReady();

async function reloadCircles() {
  if (!circlesUseDb) return;
  const rows = await getCirclesShared();
  setCircles(rows as Circle[]);
}
async function reloadCirclePosts(circleId: string) {
  if (!circlesUseDb) return;
  const rows = await getCirclePostsShared(circleId);
  // 表示中サークルの投稿だけ差し替え（他サークルのぶんは保持）
  setCirclePosts((prev) => [...prev.filter((p) => p.circleId !== circleId), ...(rows as CirclePost[])]);
}

// 起動時に共有サークル一覧を読み込む
useEffect(() => {
  if (!circlesUseDb) return;
  void reloadCircles();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

function createCircle(name: string, emoji: string, memberIds: string[], opts?: { isOfficial?: boolean; allowFans?: boolean; joinPolicy?: 'open' | 'approval'; visibility?: 'public' | 'followers' }): string {
  if (circlesUseDb) {
    // サーバー作成後、本IDでサークル詳細へ遷移（作成画面側は空IDでは遷移しない）
    void (async () => {
      const realId = await createCircleShared(name, emoji, opts?.isOfficial ?? false, opts?.joinPolicy ?? 'open', opts?.visibility ?? 'public');
      await reloadCircles();
      if (realId) { void reloadCirclePosts(realId); go('circle-detail', realId); }
      else { showToast(t('toast_circle_create_failed', lang)); }
    })();
    return '';
  }
  const id = `circle-${Date.now()}`;
  const newCircle: Circle = {
    id, name, emoji, memberIds: [me.id, ...memberIds], createdBy: me.id,
    isOfficial: opts?.isOfficial ?? false,
    allowFans: opts?.isOfficial ? (opts?.allowFans ?? false) : false,
    fanIds: [],
  };
  const next = [newCircle, ...circles];
  setCircles(next);
  localStorage.setItem('circles', JSON.stringify(next));
  return id;
}

function joinCircleH(circleId: string) {
  if (circlesUseDb) {
    const policy = ((circles.find((c) => c.id === circleId) as any)?.joinPolicy ?? 'open') as 'open' | 'approval';
    void (async () => {
      const res = await dbJoinCircle(circleId, policy);
      await reloadCircles();
      if (res === 'member') await reloadCirclePosts(circleId);
      showToast(res === 'pending' ? `✋ ${t('toast_circle_requested', lang)}` : res === 'member' ? `🎉 ${t('toast_circle_joined', lang)}` : t('toast_join_failed', lang));
    })();
    return;
  }
  // デモ：ローカルで参加
  const next = circles.map((c) => c.id === circleId && !c.memberIds.includes(me.id) ? { ...c, memberIds: [...c.memberIds, me.id] } : c);
  setCircles(next); localStorage.setItem('circles', JSON.stringify(next));
  showToast(`🎉 ${t('toast_circle_joined', lang)}`);
}

function approveCircleMemberH(circleId: string, atName: string) {
  void (async () => { await approveCircleMember(circleId, atName); await reloadCircles(); })();
  showToast(`✅ ${t('toast_join_approved', lang)}`);
}
function rejectCircleMemberH(circleId: string, atName: string) {
  void (async () => { await rejectCircleMember(circleId, atName); await reloadCircles(); })();
  showToast(t('toast_request_declined', lang));
}

function leaveCircleH(circleId: string) {
  if (circlesUseDb) {
    void (async () => { await dbLeaveCircle(circleId); await reloadCircles(); })();
    showToast(t('toast_circle_left', lang));
    return;
  }
  const next = circles.map((c) => c.id === circleId ? { ...c, memberIds: c.memberIds.filter((id) => id !== me.id) } : c);
  setCircles(next); localStorage.setItem('circles', JSON.stringify(next));
  showToast(t('toast_circle_left', lang));
}

function postToCircle(circleId: string, body: string, opts?: { audience?: 'members' | 'everyone'; kind?: 'talk' | 'vote' }) {
  if (circlesUseDb) {
    void (async () => { await createCirclePostShared(circleId, body, opts?.kind ?? 'talk'); await reloadCirclePosts(circleId); })();
    return;
  }
  const newPost: CirclePost = {
    id: `cp-${Date.now()}`, circleId, body,
    postedBy: me.id, postedByName: me.name, postedByAvatar: me.avatar,
    postedAt: new Date().toISOString(), replies: [],
    audience: opts?.audience ?? 'members',
    kind: opts?.kind ?? 'talk',
    votes: [],
  };
  const next = [newPost, ...circlePosts];
  setCirclePosts(next);
  localStorage.setItem('circlePosts', JSON.stringify(next));
}

function replyToCirclePost(postId: string, body: string) {
  if (circlesUseDb) {
    const cid = circlePosts.find((p) => p.id === postId)?.circleId;
    void (async () => { await addCircleReplyShared(postId, body); if (cid) await reloadCirclePosts(cid); })();
    return;
  }
  const next = circlePosts.map((p) => p.id === postId
    ? { ...p, replies: [...p.replies, { userId: me.id, userName: me.name, userAvatar: me.avatar, body, postedAt: new Date().toISOString() }] }
    : p);
  setCirclePosts(next);
  localStorage.setItem('circlePosts', JSON.stringify(next));
}

function voteInCirclePost(postId: string, targetId: string) {
  if (circlesUseDb) {
    const cid = circlePosts.find((p) => p.id === postId)?.circleId;
    void (async () => { await voteCircleShared(postId, targetId); if (cid) await reloadCirclePosts(cid); })();
    return;
  }
  const next = circlePosts.map((p) => {
    if (p.id !== postId) return p;
    const votes = p.votes ?? [];
    if (votes.some((v) => v.userId === me.id)) return p; // 1人1票
    return { ...p, votes: [...votes, { userId: me.id, targetId }] };
  });
  setCirclePosts(next);
  localStorage.setItem('circlePosts', JSON.stringify(next));
}

// ── 公認サークルのファン申請フロー（承認制） ────────────────
function updateCircles(next: Circle[]) {
  setCircles(next);
  localStorage.setItem('circles', JSON.stringify(next));
}

function applyAsFan(circleId: string) {
  updateCircles(circles.map((c) => {
    if (c.id !== circleId) return c;
    const pending = c.pendingFanIds ?? [];
    if (pending.includes(me.id) || c.fanIds?.includes(me.id)) return c;
    return { ...c, pendingFanIds: [...pending, me.id] };
  }));
  showToast(`🎫 ${t('toast_fan_requested', lang)}`);
}

function approveFan(circleId: string, userId: string) {
  updateCircles(circles.map((c) => {
    if (c.id !== circleId) return c;
    return {
      ...c,
      pendingFanIds: (c.pendingFanIds ?? []).filter((id) => id !== userId),
      fanIds: [...new Set([...(c.fanIds ?? []), userId])],
    };
  }));
  showToast(`✅ ${t('toast_fan_approved', lang)}`);
}

function rejectFan(circleId: string, userId: string) {
  updateCircles(circles.map((c) => {
    if (c.id !== circleId) return c;
    return { ...c, pendingFanIds: (c.pendingFanIds ?? []).filter((id) => id !== userId) };
  }));
  showToast(t('toast_application_declined', lang));
}

const [favoritePhotos, setFavoritePhotos] = useState<string[]>(() => {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem('favoritePhotos');
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
});

function updateFavoritePhotos(photos: string[]) {
  setFavoritePhotos(photos);
  localStorage.setItem('favoritePhotos', JSON.stringify(photos));
}

function createCommunityQuestion(title: string, description: string, answerType: 'free' | 'select' = 'free', answerOptions: string[] = []) {
  const newQuestion = {
    id: `official-${Date.now()}`,
    category: '公認ユーザー',
    title,
    description,
    sponsor: null,
    createdBy: me.id,
    createdByName: me.name,
    isOfficialQuestion: true,
    createdAt: new Date().toISOString(),
    answerType,
    answerOptions,
  };

  const next = [newQuestion, ...communityQuestions];
  setCommunityQuestions(next);
  localStorage.setItem('communityQuestions', JSON.stringify(next));
}

// プロフ帳一式（info＋BEST3＋今月のBEST3＋ひとことしつもん）を Supabase の book にまとめて保存。
// 各 update 関数は localStorage を先に更新してから呼ぶので、ここでは localStorage を正として組み立てる。
// （state はバッチ更新で直後は古い可能性があるため localStorage を参照する）
// ゲームデータ（コイン/所持スタンプ/背景/かけら/テーマ）を localStorage から組み立てる
function composeGameData(): Record<string, any> {
  const num = (k: string) => Number(localStorage.getItem(k) || '0');
  const arr = (k: string) => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } };
  return {
    coins: num('miri_coins'),
    packs: arr('miri_owned_packs'),
    gacha: arr('miri_gacha_stickers'),
    bgs: arr('miri_owned_bgs'),
    bg: localStorage.getItem('miri_equipped_bg') || null,
    shards: num('miri_bg_shards'),
    themes: arr('miri_owned_themes'),
    appTheme: localStorage.getItem('appTheme') || 'default',
    freeGacha: localStorage.getItem('miri_free_gacha_used') || null,
    // ── 報酬の重複防止ガード（端末クリア/再ログインでリセットさせない＝コイン無限増殖対策）──
    earnedFields: arr('miri_earned_fields'),
    profileMilestones: arr('miri_profile_milestones'),
    rewardedQids: arr('miri_rewarded_qids'),
    setupBonus: localStorage.getItem('miri_setup_bonus') || null,
    dailyLogin: localStorage.getItem('miri_daily_login') || null,
    loginStreak: num('miri_streak'),
    prAnswered: localStorage.getItem('miri_pr_answered') || null,
  };
}

// ゲームデータだけを保存（read-merge-write）。プロフ本文などは触らない。
function persistGame() {
  if (!dbReady()) return;
  try { void saveGameData(composeGameData()); } catch {}
}

// localStorage の最新内容から book を組んで1回保存する実体。
async function persistBookNow() {
  if (!dbReady()) return;
  try {
    const info = JSON.parse(localStorage.getItem('profileBookInfo') || '{}');
    const book: Record<string, any> = { ...info };
    const b3 = localStorage.getItem('best3');
    const mo = localStorage.getItem('miri_monthly_best3');
    const qs = localStorage.getItem('profileQuestions');
    if (b3) book.__best3 = JSON.parse(b3);
    if (mo) book.__monthly = JSON.parse(mo);
    if (qs) book.__questions = JSON.parse(qs);
    try {
      const vis = JSON.parse(localStorage.getItem('profileFieldVisibility') || '{}');
      if (vis && Object.keys(vis).length > 0) book.__visibility = vis;
    } catch {}
    // わたしのペン（書体・インク・大きさ）
    try { const pen = normalizePen(JSON.parse(localStorage.getItem('miri_pen') || 'null')); if (pen) book.__pen = pen; } catch {}
    // ゲーム系（コイン/所持スタンプ/背景/かけら/テーマ）も book に保存＝端末間で引き継ぎ
    book.__game = composeGameData();
    const ok = await saveProfileBook(book);
    if (ok) { try { localStorage.removeItem('miri_pending_profile_sync'); } catch {} }
    else onProfileSyncFailed();
  } catch { onProfileSyncFailed(); }
}

// persistBook の直列化。保存ボタンは onSave/onSaveBest3/… と複数ハンドラを連続で呼び、
// それぞれが persistBook を発火する。並行実行すると「古い内容で組んだ保存」が最後に
// 着地して新しい入力を上書きして消すレースが起きるため、呼び出しをキューで直列化する。
// 直列化により各 persistBookNow は「全 setItem 完了後の最新 localStorage」を読むので、
// どの保存も同じ完全な book を書き、最終状態が必ず正しくなる（チェーンは __persistChain）。
function persistBook(): Promise<void> {
  const run = __persistChain.then(() => persistBookNow());
  __persistChain = run.catch(() => {}); // 失敗してもチェーンを切らさない
  return run;
}

// 保存がサーバーへ届かなかったとき：未保存フラグを立て、はっきり通知する。
// セッション復帰時（マウント effect）に自動で再送する。二重トーストは避ける。
function onProfileSyncFailed() {
  let already = false;
  try {
    already = localStorage.getItem('miri_pending_profile_sync') === '1';
    localStorage.setItem('miri_pending_profile_sync', '1');
  } catch {}
  if (!already) showToast(`⚠️ ${t('toast_save_failed_relogin', lang)}`, 'error');
}

function updateProfileBookInfo(next: typeof defaultProfileBookInfo) {
  profileDirtyRef.current = true;  // 初回サーバー読込による上書きから編集を守る
  rewardNewlyFilledFields(next);   // 新しく埋めた項目にコイン付与
  checkProfileMilestones(next);    // 完成度の節目(25/50/75/100%)でジャックポット
  setProfileBookInfo(next);
  localStorage.setItem('profileBookInfo', JSON.stringify(next));
  persistBook(); // Supabase にも保存（永続化・端末間で引き継ぎ）
  syncIdentityToProfiles({ info: next }); // なまえ／ニックネーム変更を回答の著者名にも反映
}

// 完成度が節目(25/50/75/100%)に到達したら、まだ受け取っていないぶんだけ
// ボーナスコインを付与してお祝い演出を出す（重複取得なし＝ガードで保護）。
function checkProfileMilestones(next: typeof defaultProfileBookInfo) {
  try {
    const { pct } = profileCompletion(next);
    const reached: number[] = JSON.parse(localStorage.getItem('miri_profile_milestones') || '[]');
    const set = new Set<number>(reached);
    const newly = PROFILE_MILESTONES.filter((m) => pct >= m.pct && !set.has(m.pct));
    if (newly.length === 0) return;
    let bonus = 0;
    for (const m of newly) { set.add(m.pct); bonus += m.coins; addCoins(m.coins, `プロフィール${m.pct}%達成ボーナス`); }
    // 節目ガードはローカルに即時保存。サーバーへは coins 変化を検知する
    // デバウンス永続化(useEffect)が、確定後の残高とともに __game に保存する。
    localStorage.setItem('miri_profile_milestones', JSON.stringify([...set]));
    const top = newly[newly.length - 1];
    setCelebration({ pct: top.pct, coins: bonus, label: top.label, emoji: top.emoji, isComplete: top.pct >= 100 });
  } catch {}
}

// プロフィール帳の項目を「初めて」埋めたぶんだけコインを付与（重複取得なし）
function rewardNewlyFilledFields(next: typeof defaultProfileBookInfo) {
  try {
    const earned: string[] = JSON.parse(localStorage.getItem('miri_earned_fields') || '[]');
    const earnedSet = new Set(earned);
    let count = 0;
    for (const key of REWARDABLE_FIELDS) {
      const v = (next as any)[key];
      const token = 'book.' + key;
      if (typeof v === 'string' && v.trim() && !earnedSet.has(token)) {
        earnedSet.add(token);
        count++;
      }
    }
    if (count > 0) {
      localStorage.setItem('miri_earned_fields', JSON.stringify([...earnedSet]));
      addCoins(count * REWARD_PER_FIELD, 'プロフィール入力');
      const { pct } = profileCompletion(next);
      showToast(`✨ ${tf('toast_profile_coins', lang, { n: count * REWARD_PER_FIELD, pct })}`);
    }
  } catch {}
}

// ログアウト：Supabaseセッション破棄＋認証クッキー削除＋端末内のユーザーデータ全消去
async function logout() {
  try { await signOut(); } catch {}
  try {
    document.cookie = 'miri_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict';
  } catch {}
  try {
    // コイン・スタンプ・購入アイテム・通知・回答なども含め、前ユーザーの端末データを一掃。
    // （Supabaseに永続化したデータは残り、再ログインで復元される）
    localStorage.clear();
  } catch {}
  window.location.href = '/';
}

const [profileCustomFields, setProfileCustomFields] = useState<Record<string, string>>(() => {
  if (typeof window === 'undefined') return {};
  try {
    const saved = localStorage.getItem('profileCustomFields');
    return saved ? JSON.parse(saved) : {};
  } catch { return {}; }
});

function updateProfileCustomFields(next: Record<string, string>) {
  setProfileCustomFields(next);
  localStorage.setItem('profileCustomFields', JSON.stringify(next));
}

const [best3, setBest3] = useState(() => {
  if (typeof window === 'undefined') return defaultBest3;
  try { const saved = localStorage.getItem('best3'); return saved ? JSON.parse(saved) : defaultBest3; } catch { return defaultBest3; }
});

function updateBest3(next: typeof defaultBest3) {
  setBest3(next);
  localStorage.setItem('best3', JSON.stringify(next));
  persistBook();
}

// 今月のBEST3（固定テーマを毎月切替）。保存済みが今月のものでなければ空で開始。
const [monthlyBest3, setMonthlyBest3] = useState<MonthlyBest3>(() => {
  const { monthKey } = currentMonthInfo();
  if (typeof window !== 'undefined') {
    try {
      const s = JSON.parse(localStorage.getItem('miri_monthly_best3') || 'null');
      if (s && s.monthKey === monthKey && Array.isArray(s.items)) return s;
    } catch {}
  }
  return { monthKey, items: ['', '', ''] };
});

function updateMonthlyBest3(items: string[], episode?: string) {
  const { monthKey } = currentMonthInfo();
  // episode は引数優先。未指定なら今月の既存値を維持（別々に保存しても消えないように）。
  const prevEpisode =
    monthlyBest3 && monthlyBest3.monthKey === monthKey ? (monthlyBest3.episode ?? '') : '';
  const rec: MonthlyBest3 = { monthKey, items, episode: episode !== undefined ? episode : prevEpisode };
  setMonthlyBest3(rec);
  localStorage.setItem('miri_monthly_best3', JSON.stringify(rec));
  persistBook();
}

const [profileQuestions, setProfileQuestions] = useState(() => {
  if (typeof window === 'undefined') return defaultProfileQuestions;
  try { const saved = localStorage.getItem('profileQuestions'); return saved ? JSON.parse(saved) : defaultProfileQuestions; } catch { return defaultProfileQuestions; }
});

function updateProfileQuestions(next: typeof defaultProfileQuestions) {
  setProfileQuestions(next);
  localStorage.setItem('profileQuestions', JSON.stringify(next));
  persistBook();
}

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('profilebook_answers_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        // questionがないor壊れているデータを除外
        const valid = Array.isArray(parsed)
          ? parsed.filter((a: any) => a && a.question && a.question.category)
          : [];
        setAnswers(valid);
      }
    } catch { /* corrupted data — ignore */ }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('profilebook_answers_v2', JSON.stringify(answers));
  }, [answers]);

  // みんなの回答フィードを Supabase から読み込む（共有SNSの核）
  async function reloadFeed() {
    if (!dbReady()) return;
    try {
      const rows = await getFeed(100);
      if (!rows) return; // null(エラー)なら既存表示を維持
      setAnswers(rows.map(feedRowToAnswer));
      // リアクション集計（like＋絵文字スタンプ）と投稿者uuidを構築
      const uid = myUid ?? (await getCurrentUserId());
      const rs: Record<string, Record<string, { count: number; mine: boolean }>> = {};
      const authors: Record<string, string> = {};
      for (const r of rows) {
        authors[r.id] = r.user_id;
        const m: Record<string, { count: number; mine: boolean }> = {};
        for (const re of r.reactions ?? []) {
          const e = m[re.type] ?? { count: 0, mine: false };
          e.count++;
          if (uid && re.user_id === uid) e.mine = true;
          m[re.type] = e;
        }
        rs[r.id] = m;
      }
      // サーバーを正としつつ、直前に付けた楽観的リアクション（mine）がまだ
      // サーバーに反映されていない場合は消えないようマージする。
      setReactState((prev) => {
        const merged: Record<string, Record<string, { count: number; mine: boolean }>> = {};
        const ids = new Set([...Object.keys(rs), ...Object.keys(prev)]);
        ids.forEach((id) => {
          const server = rs[id] ?? {};
          const local = prev[id] ?? {};
          const types = new Set([...Object.keys(server), ...Object.keys(local)]);
          const m: Record<string, { count: number; mine: boolean }> = {};
          types.forEach((t) => {
            const s = server[t];
            const l = local[t];
            if (s) m[t] = { count: s.count, mine: s.mine || !!l?.mine };
            else if (l?.mine) m[t] = { count: Math.max(1, l.count), mine: true }; // 未反映の楽観更新を保持
          });
          if (Object.keys(m).length) merged[id] = m;
        });
        return merged;
      });
      setAnswerAuthorUid((prev) => ({ ...prev, ...authors }));
    } catch { /* ネットワーク等は無視（ローカル表示を維持） */ }
  }
  useEffect(() => { void reloadFeed(); }, []);

  // ── トースト ──────────────────────────────────────────────────
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  // プロフィール完成度の節目お祝いオーバーレイ
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  function showToast(message: string, type: ToastItem['type'] = 'success') {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  }
  function removeToast(id: number) {
    setToasts(prev => prev.filter(t => t.id !== id));
  }

  // ── 通知（実際のアクティビティを記録して通知欄に表示） ────────
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('miri_notifications') || '[]'); } catch { return []; }
  });

  function addNotification(icon: string, text: string, key?: string, vars?: Record<string, string | number>) {
    setNotifications((prev) => {
      const next = [{ id: Date.now() + Math.random(), icon, text, at: Date.now(), ...(key ? { key, vars } : {}) }, ...prev].slice(0, 50);
      localStorage.setItem('miri_notifications', JSON.stringify(next));
      return next;
    });
  }

  // 他ユーザーからの通知（Supabase）＋未読数
  const [serverNotifs, setServerNotifs] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  async function refreshNotifications() {
    if (!dbReady()) return;
    try {
      const [list, unread] = await Promise.all([getNotifications(50), getUnreadNotificationCount()]);
      setServerNotifs(list);
      setUnreadCount(unread);
    } catch {}
  }
  useEffect(() => { void refreshNotifications(); }, []);
  // 通知画面を開いたら取得＋既読化
  useEffect(() => {
    if (screen !== 'notifications') return;
    void (async () => {
      await refreshNotifications();
      if (dbReady()) { await markNotificationsRead(); setUnreadCount(0); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);
  // リアルタイム購読（新着通知を即反映）＋フォールバック（タブ復帰時に再取得）。
  // Realtime が未有効でも focus/visibility の再取得でバッジは追従する。
  useEffect(() => {
    if (!dbReady()) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    subscribeNotifications(() => { void refreshNotifications(); }).then((fn) => {
      if (cancelled) fn(); else cleanup = fn;
    });
    const onVisible = () => { if (document.visibilityState === 'visible') void refreshNotifications(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      cancelled = true;
      cleanup?.();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── ブックマーク ──────────────────────────────────────────────
  const [bookmarks, setBookmarks] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try { const saved = localStorage.getItem('miri_bookmarks'); return saved ? JSON.parse(saved) : []; } catch { return []; }
  });
  function toggleBookmark(id: string) {
    setBookmarks(prev => {
      const next = prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id];
      localStorage.setItem('miri_bookmarks', JSON.stringify(next));
      showToast(prev.includes(id) ? t('toast_bookmark_removed', lang) : `💾 ${t('toast_bookmark_saved', lang)}`);
      return next;
    });
  }

  // ── シェア ────────────────────────────────────────────────────
  function shareText(text: string) {
    if (navigator.share) {
      navigator.share({ text, url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => showToast(`📋 ${t('toast_copied', lang)}`));
    }
  }

  // ── オンボーディング完了 ──────────────────────────────────────
  function completeOnboarding() {
    localStorage.setItem('miri_onboarded', '1');
    setScreen('home');
  }

  function go(next: Screen, payload?: any) {
  setScreen(next);

  // ホーム/さがす/今日のお題に移動したらフィードを最新化（みんなの回答を反映）
  if (next === 'home' || next === 'search' || next === 'daily-question') { void reloadFeed(); }

  if (next === 'detail' && payload) {
    setSelectedAnswerId(payload);
  }

  if (next === 'diagnosis') {
    // payload は相手の @username（無ければ自分の回答登録モード）
    setDiagTarget(payload && typeof payload === 'string' ? payload : null);
  }

  if (next === 'create') {
    // お題を指定して開いたらそれを。指定なし（＋ボタン）は「今まだ回答していないお題」を既定に
    // （今日のお題が未回答ならそれ、済みなら未回答の先頭）。
    if (payload) {
      setSelectedQuestion(payload);
    } else {
      const dailyOk = dailyQuestion && !myAnsweredQids.has(dailyQuestion.id) ? dailyQuestion : null;
      const firstUnanswered = activeQuestions.find((q) => !myAnsweredQids.has(q.id));
      setSelectedQuestion(dailyOk ?? firstUnanswered ?? dailyQuestion ?? null);
    }
  }

  if (next === 'profile') {
    // payload は id文字列（例 '@lllfff'）または Profile オブジェクトのどちらでもよい
    const payloadObj = payload && typeof payload === 'object' ? (payload as Profile) : null;
    const rawId = payloadObj ? payloadObj.id : payload;
    const pid = rawId && rawId !== me.id ? rawId : null;
    setSelectedProfileId(pid);
    if (!pid) {
      setViewedProfile(null);
      setViewedProfileBook(null);
      setViewedProfileUid(null);
    } else {
      // 既に持っている情報があれば即時表示（スピナーで固まらない）。
      if (payloadObj) setViewedProfile(payloadObj);
      else setViewedProfile((cur) => (cur && cur.id === pid ? cur : null));
      setViewedProfileBook(null); // 別ユーザーを開くので一旦クリア
      setViewedProfileUid(null);
      // モックに居なければ Supabase から詳細を取得して差し替え（失敗しても即時表示は維持）。
      const inMock = [...profiles, ...followers].some((p) => p.id === pid);
      if (!inMock && dbReady()) {
        const username = String(pid).replace(/^@/, '');
        getProfileByUsername(username).then((row) => {
          if (!row) return;
          setViewedProfile(rowToMiniProfile(row));
          setViewedProfileUid((row as any).id ?? null); // フォロー用の uuid
          // book(jsonb) を info / BEST3 / 今月 / しつもん に分解して保持
          const b: any = row.book;
          if (b && typeof b === 'object') {
            const { __best3, __monthly, __questions, __visibility, __game, __choices, __perception, __pen, ...info } = b;
            setViewedProfileBook({ info, best3: __best3, monthly: __monthly, questions: __questions, visibility: __visibility, pen: normalizePen(__pen) });
          }
        }).catch(() => {});
      }
    }
  }

  if (next === 'diary-detail' && payload) {
    setSelectedDiaryId(payload);
    if (diaryUseDb) void reloadDiary();
  }
  if (next === 'diary-list' && diaryUseDb) void reloadDiary();

  if (next === 'blog-detail' && payload) {
    setSelectedBlogId(payload);
  }
  if (next === 'blog-list' && blogUseDb) void reloadBlog();

  if (next === 'circle-detail' && payload) {
    setSelectedCircleId(payload);
    if (circlesUseDb) void reloadCirclePosts(payload);
  }
  if (next === 'circles' && circlesUseDb) void reloadCircles();
}

  function postAnswer(draft: DraftAnswer) {
  const allQuestions = [...communityQuestions, ...localizedQuestions];

  const q =
    allQuestions.find((question) => question.id === draft.questionId) ||
    localizedQuestions[0];

  const id = `a-${Date.now()}`;

  const newAnswer: Answer = {
    id,
    question: q,
    body: `${draft.sticker} ${draft.body}`,
    user: { name: me.name, id: me.id, avatar: avatarUrl || me.avatar },
    reactions: { like: 0, same: 0, wakaru: 0, natsukashii: 0 },
  };

  // 既に同じお題へ回答済みなら「編集」（上書き）、無ければ新規追加。
  setAnswers((prev) => {
    const idx = prev.findIndex((a) => a.user.id === me.id && a.question?.id === q.id);
    if (idx >= 0) {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], body: newAnswer.body };
      return copy;
    }
    return [newAnswer, ...prev];
  });

  // Supabase に保存して共有（PR案件回答は共有対象外）。
  // 楽観的にローカル表示済み。保存結果を確認し、失敗（＝セッション切れ等）は明示的に通知する。
  if (dbReady() && !draft.questionId.startsWith('pr-')) {
    void upsertAnswer({
      question_key: q.id,
      question_title: q.title,
      question_category: (q as any).category ?? null,
      body: draft.body,
      sticker: draft.sticker,
      visibility: draft.visibility,
    }).then((saved) => {
      if (!saved) {
        // セッション切れ等で共有できなかった。黙って握りつぶさず再ログインを促す。
        showToast(`⚠️ ${t('toast_share_failed', lang)}`);
      } else {
        // 共有フィードをすぐ同期（他ユーザーの回答も取り込む）
        void reloadFeed();
      }
    });
  }

  // このお題に既に回答済みか（編集ならコインを配らない＝コイン増殖バグ対策）。
  // 端末に「報酬付与済みお題」を永続化して判定する（フィード再読込で消えても影響しない）。
  let alreadyRewarded = false;
  try {
    const key = 'miri_rewarded_qids';
    const set = new Set<string>(JSON.parse(localStorage.getItem(key) || '[]'));
    alreadyRewarded = set.has(q.id);
    if (!alreadyRewarded) { set.add(q.id); localStorage.setItem(key, JSON.stringify([...set])); }
  } catch {}

  // PR案件への回答かチェック
  if (draft.questionId.startsWith('pr-')) {
    if (!alreadyRewarded) {
      const reward = prQuestion.id === draft.questionId ? prQuestion.reward : 15;
      addCoins(reward, `PR案件回答（${prQuestion.brand}）`);
      showToast(`🎁 ${tf('toast_pr_bonus', lang, { n: reward })}`);
      addNotification('💼', `PR案件に回答して ${reward} コインもらいました`, 'notif_pr', { n: reward });
    } else {
      showToast(`✏️ ${t('toast_answer_updated', lang)}`);
    }
    markPRAnswered();
    setHasAnsweredPR(true);
  } else if (!alreadyRewarded) {
    addCoins(5, 'お題に回答');
    showToast(`🎁 ${tf('toast_answer_bonus', lang, { n: 5 })}`);
    addNotification('✍️', 'お題に回答して 5 コインもらいました', 'notif_answer', { n: 5 });
  } else {
    // 編集（2回目以降）はコインを配らない
    showToast(`✏️ ${t('toast_answer_updated', lang)}`);
  }

  return id;
}

  // リアクション（'like' または絵文字スタンプ）を独立トグル。Slack風に複数付けられる。
  function react(answerId: string, type: string) {
    const mine = !!reactState[answerId]?.[type]?.mine;
    const next = !mine;
    setReactState((s) => {
      const forAnswer = { ...(s[answerId] ?? {}) };
      const entry = { ...(forAnswer[type] ?? { count: 0, mine: false }) };
      entry.mine = next;
      entry.count = Math.max(0, entry.count + (next ? 1 : -1));
      if (entry.count === 0 && !entry.mine) delete forAnswer[type];
      else forAnswer[type] = entry;
      return { ...s, [answerId]: forAnswer };
    });
    // AnswerCard等のハート表示用に like カウントも同期
    if (type === 'like') {
      setAnswers((as) => as.map((a) => a.id === answerId
        ? { ...a, reactions: { ...a.reactions, like: Math.max(0, a.reactions.like + (next ? 1 : -1)) } }
        : a));
    }
    // Supabase 同期＋相手への通知（付けたときのみ）。ローカル生成の回答(a-...)は対象外。
    if (dbReady() && !answerId.startsWith('a-')) {
      void toggleReaction(answerId, type);
      if (next) {
        const author = answerAuthorUid[answerId];
        if (author) void createNotification(author, type === 'like' ? 'like' : 'sticker', { answerId, emoji: type === 'like' ? null : type });
      }
    }
  }

  const [diaryPages, setDiaryPages] = useState<DiaryPage[]>(initialDiaryPages);
  const [selectedDiaryId, setSelectedDiaryId] = useState<string>(initialDiaryPages[0]?.id ?? '');
  const [selectedBlogId, setSelectedBlogId] = useState<string>('');

  const selectedDiary = diaryPages.find((p) => p.id === selectedDiaryId) ?? diaryPages[0];

  const diaryUseDb = !isDev && dbReady();
  async function reloadDiary() {
    if (!diaryUseDb) return;
    const rows = await getDiaryPagesShared();
    setDiaryPages(rows as DiaryPage[]);
  }
  useEffect(() => { if (diaryUseDb) void reloadDiary(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function createDiaryPage(
    theme: string,
    description: string,
    firstEntryBody: string,
    firstPhotoUrl: string,
    visibility: 'public' | 'followers' | 'mentioned',
    mentionedUserIds: string[],
    firstMeta?: { title?: string; mood?: string; weather?: string; textColor?: string }
  ): string {
    if (diaryUseDb) {
      void (async () => {
        const realId = await createDiaryPageShared(theme, description, visibility, mentionedUserIds, (firstEntryBody.trim() || firstPhotoUrl) ? { body: firstEntryBody, photoUrl: firstPhotoUrl || undefined } : undefined);
        await reloadDiary();
        if (realId) go('diary-detail', realId);
        else showToast(t('toast_diary_create_failed', lang));
      })();
      return '';
    }
    const id = `diary-${Date.now()}`;
    const firstEntry: DiaryEntry | null = firstEntryBody.trim() || firstPhotoUrl
      ? {
          id: `entry-${Date.now()}`, authorId: me.id, authorName: me.name, authorAvatar: me.avatar,
          title: firstMeta?.title?.trim() || undefined,
          mood: firstMeta?.mood, weather: firstMeta?.weather,
          body: firstEntryBody.trim(), photoUrl: firstPhotoUrl || undefined,
          textColor: firstMeta?.textColor,
          likes: 0, likedByMe: false, comments: [],
          postedAt: new Date().toISOString(),
        }
      : null;
    const newPage: DiaryPage = {
      id,
      theme,
      description,
      createdBy: me.id,
      createdByName: me.name,
      createdByAvatar: me.avatar,
      createdAt: new Date().toISOString(),
      entries: firstEntry ? [firstEntry] : [],
      visibility,
      mentionedUserIds,
    };
    setDiaryPages((prev) => [newPage, ...prev]);
    return id;
  }

  type DiaryEntryInput = { body: string; photoUrl?: string; title?: string; mood?: string; weather?: string; textColor?: string };

  function addDiaryEntry(pageId: string, data: DiaryEntryInput) {
    if (diaryUseDb) {
      void (async () => { await addDiaryEntryShared(pageId, data.body, data.photoUrl); await reloadDiary(); })();
      return;
    }
    const entry: DiaryEntry = {
      id: `entry-${Date.now()}`,
      authorId: me.id,
      authorName: me.name,
      authorAvatar: me.avatar,
      title: data.title?.trim() || undefined,
      mood: data.mood,
      weather: data.weather,
      body: data.body,
      photoUrl: data.photoUrl || undefined,
      textColor: data.textColor,
      likes: 0,
      likedByMe: false,
      comments: [],
      postedAt: new Date().toISOString(),
    };
    setDiaryPages((prev) =>
      prev.map((p) => p.id === pageId ? { ...p, entries: [...p.entries, entry] } : p)
    );
  }

  function editDiaryEntry(pageId: string, entryId: string, data: DiaryEntryInput) {
    if (diaryUseDb) {
      void (async () => { await updateDiaryEntryShared(entryId, data.body, data.photoUrl); await reloadDiary(); })();
      return;
    }
    setDiaryPages((prev) =>
      prev.map((p) => p.id === pageId
        ? { ...p, entries: p.entries.map((e) => e.id === entryId
            ? { ...e, title: data.title?.trim() || undefined, mood: data.mood, weather: data.weather, body: data.body, photoUrl: data.photoUrl || undefined, textColor: data.textColor }
            : e) }
        : p
      )
    );
  }

  function toggleDiaryLike(pageId: string, entryId: string) {
    setDiaryPages((prev) =>
      prev.map((p) => p.id === pageId
        ? { ...p, entries: p.entries.map((e) => {
            if (e.id !== entryId) return e;
            const liked = !e.likedByMe;
            return { ...e, likedByMe: liked, likes: Math.max(0, (e.likes ?? 0) + (liked ? 1 : -1)) };
          }) }
        : p
      )
    );
  }

  function addDiaryComment(pageId: string, entryId: string, body: string) {
    const comment: DiaryComment = {
      id: `dc-${Date.now()}`,
      authorId: me.id,
      authorName: me.name,
      authorAvatar: me.avatar,
      body: body.trim(),
      postedAt: new Date().toISOString(),
    };
    setDiaryPages((prev) =>
      prev.map((p) => p.id === pageId
        ? { ...p, entries: p.entries.map((e) => e.id === entryId ? { ...e, comments: [...(e.comments ?? []), comment] } : e) }
        : p
      )
    );
  }

  function deleteDiaryEntry(pageId: string, entryId: string) {
    if (diaryUseDb) {
      void (async () => { await deleteDiaryEntryShared(entryId); await reloadDiary(); })();
      return;
    }
    setDiaryPages((prev) =>
      prev.map((p) => p.id === pageId ? { ...p, entries: p.entries.filter((e) => e.id !== entryId) } : p)
    );
  }

  // 通報：確認 → reports テーブルへ送信 → トースト。運営は Supabase で確認して手動対応。
  async function reportAnswer(answerId: string) {
    if (!dbReady()) { showToast(t('toast_report_prod_only', lang), 'error'); return; }
    if (!window.confirm(t('confirm_report', lang))) return;
    const ok = await submitReport('answer', answerId);
    showToast(ok ? t('toast_reported', lang) : t('toast_report_failed', lang), ok ? 'success' : 'error');
  }

  function reportDiaryEntry(pageId: string, entryId: string) {
    if (!dbReady()) return;
    void submitReport('diary', `${pageId}:${entryId}`);
  }

  // ── ブログ（個人記事）────────────────────────────────────────
  // 交換日記とは別機能。まずは端末内保存（localStorage）で永続化リスクなし。
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>(() => {
    if (typeof window === 'undefined') return [];
    try { const s = localStorage.getItem('miri_blog_posts'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const blogUseDb = !isDev && dbReady();
  function saveBlog(next: BlogPost[]) {
    setBlogPosts(next);
    try { localStorage.setItem('miri_blog_posts', JSON.stringify(next)); } catch {}
  }
  async function reloadBlog() {
    if (!blogUseDb) return;
    const rows = (await getBlogFeedShared(100)) as BlogPost[];
    setBlogPosts((prev) => {
      const dbIds = new Set(rows.map((r) => r.id));
      // 端末だけに存在する未同期の投稿（blog-...）は消さずに残す
      const localOnly = prev.filter((p) => String(p.id).startsWith('blog-') && !dbIds.has(p.id));
      // DBが一時的に空を返したときは、既存のDB由来投稿を保持（消失防止）
      const base = rows.length === 0 && prev.length > 0 ? prev.filter((p) => !String(p.id).startsWith('blog-')) : rows;
      const merged = [...base, ...localOnly];
      try { localStorage.setItem('miri_blog_posts', JSON.stringify(merged)); } catch {}
      return merged;
    });
  }
  useEffect(() => {
    if (!blogUseDb) return;
    void reloadBlog();
    // セッションのハイドレーション待ちで空振りすることがあるため数回リトライ
    const t1 = setTimeout(() => void reloadBlog(), 900);
    const t2 = setTimeout(() => void reloadBlog(), 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);
  // 投稿の「完了」を await できるように Promise を返す（演出＝投稿完了までスピナーを回すため）。
  async function createBlogPost(data: { title?: string; mood?: string; weather?: string; body: string; photoUrl?: string; textColor?: string; visibility: 'public' | 'followers' }): Promise<string> {
    if (blogUseDb) {
      const realId = await createBlogPostShared(data);
      if (realId) { await reloadBlog(); return realId; }
      // DB保存に失敗しても端末に残す（投稿が消えないように）
      const lid = `blog-${Date.now()}`;
      const lpost: BlogPost = {
        id: lid, authorId: me.id, authorName: me.name, authorAvatar: me.avatar,
        title: data.title?.trim() || undefined, mood: data.mood, weather: data.weather,
        body: data.body.trim(), photoUrl: data.photoUrl || undefined, textColor: data.textColor,
        visibility: data.visibility, likes: 0, likedByMe: false, comments: [],
        postedAt: new Date().toISOString(),
      };
      setBlogPosts((prev) => { const next = [lpost, ...prev]; try { localStorage.setItem('miri_blog_posts', JSON.stringify(next)); } catch {} return next; });
      showToast(t('toast_saved_offline', lang));
      return lid;
    }
    const id = `blog-${Date.now()}`;
    const post: BlogPost = {
      id, authorId: me.id, authorName: me.name, authorAvatar: me.avatar,
      title: data.title?.trim() || undefined, mood: data.mood, weather: data.weather,
      body: data.body.trim(), photoUrl: data.photoUrl || undefined, textColor: data.textColor,
      visibility: data.visibility, likes: 0, likedByMe: false, comments: [],
      postedAt: new Date().toISOString(),
    };
    saveBlog([post, ...blogPosts]);
    return id;
  }
  function toggleBlogLike(postId: string) {
    if (blogUseDb) {
      const author = blogPosts.find((p) => p.id === postId)?.authorId;
      // 楽観更新
      setBlogPosts((prev) => prev.map((p) => p.id === postId ? { ...p, likedByMe: !p.likedByMe, likes: Math.max(0, p.likes + (p.likedByMe ? -1 : 1)) } : p));
      void (async () => { await toggleBlogLikeShared(postId, author); await reloadBlog(); })();
      return;
    }
    saveBlog(blogPosts.map((p) => {
      if (p.id !== postId) return p;
      const liked = !p.likedByMe;
      return { ...p, likedByMe: liked, likes: Math.max(0, p.likes + (liked ? 1 : -1)) };
    }));
  }
  function addBlogComment(postId: string, body: string) {
    if (blogUseDb) {
      const author = blogPosts.find((p) => p.id === postId)?.authorId;
      void (async () => { await addBlogCommentShared(postId, body, author); await reloadBlog(); })();
      return;
    }
    const c: DiaryComment = { id: `bc-${Date.now()}`, authorId: me.id, authorName: me.name, authorAvatar: me.avatar, body: body.trim(), postedAt: new Date().toISOString() };
    saveBlog(blogPosts.map((p) => p.id === postId ? { ...p, comments: [...p.comments, c] } : p));
  }
  function deleteBlogPost(postId: string) {
    // まず画面から即消し（端末キャッシュも更新）→ DBからも削除
    setBlogPosts((prev) => { const next = prev.filter((p) => p.id !== postId); try { localStorage.setItem('miri_blog_posts', JSON.stringify(next)); } catch {} return next; });
    if (blogUseDb && !String(postId).startsWith('blog-')) {
      void (async () => { await deleteBlogPostShared(postId); await reloadBlog(); })();
    }
  }

  const current = useMemo(() => {

    if (screen === 'settings')
  return (
    <ProfileEditScreen
      go={go}
      profileBookInfo={profileBookInfo}
      best3={best3}
      monthlyBest3={monthlyBest3}
      onSaveMonthlyBest3={updateMonthlyBest3}
      profileQuestions={profileQuestions}
      onSave={updateProfileBookInfo}
      onSaveBest3={updateBest3}
      onSaveQuestions={updateProfileQuestions}
      avatarUrl={avatarUrl}
      onSaveAvatar={updateAvatarUrl}
      favoritePhotos={favoritePhotos}
      onSaveFavoritePhotos={updateFavoritePhotos}
      appTheme={appTheme}
      onChangeTheme={changeTheme}
      customFields={profileCustomFields}
      onSaveCustomFields={updateProfileCustomFields}
      fieldVisibility={fieldVisibility}
      onSaveVisibility={updateFieldVisibility}
      premiumContent={premiumContent}
      onSavePremiumContent={updatePremiumContent}
      lang={lang}
      onChangeLang={changeLang}
      notifyOdai={notifyOdai}
      onToggleNotifyOdai={toggleNotifyOdai}
      ownedBgIds={ownedBgIds}
      ownedThemeIds={ownedThemeIds}
      equippedBgId={equippedBgId}
      onEquipBg={equipBg}
      onLogout={logout}
      pen={myPen}
      onPenChange={updateMyPen}
    />
  );

  if (screen === 'official-question-create')
  return (
    <OfficialQuestionCreateScreen
      go={go}
      onCreate={createCommunityQuestion}
    />
  );
    
    if (screen === 'wallet') return <WalletScreen go={go} coins={coins} onCheckout={startCheckout} />;
    if (screen === 'circles') return <CirclesScreen go={go} circles={circles} circlePosts={circlePosts} />;
    if (screen === 'circle-create') return <CircleCreateScreen go={go} onCreate={createCircle} />;
    if (screen === 'circle-detail') {
      const circle = circles.find((c) => c.id === selectedCircleId);
      if (circle) return <CircleDetailScreen go={go} circle={circle} posts={circlePosts.filter((p) => p.circleId === circle.id)} onPost={postToCircle} onReply={replyToCirclePost} onVote={voteInCirclePost} onApplyFan={applyAsFan} onApproveFan={approveFan} onRejectFan={rejectFan} onJoin={joinCircleH} onLeave={leaveCircleH} onApprove={approveCircleMemberH} onReject={rejectCircleMemberH} />;
    }

   if (screen === 'daily-question')
  return (
    <DailyQuestionScreen
      go={go}
      question={dailyQuestion}
      dailyRecord={dailyRecord}
      onSubmit={submitDailyAnswer}
      answers={answers}
    />
  );

   if (screen === 'home')
  return (
    <HomeScreen
      go={go}
      answers={answers}
      communityQuestions={communityQuestions}
      diaryPages={diaryPages}
      blogPosts={blogPosts}
      circles={circles}
      circlePosts={circlePosts}
      dailyQuestion={dailyQuestion}
      hasAnsweredToday={dailyRecord !== null}
      prQuestion={prQuestion}
      hasAnsweredPR={hasAnsweredPR}
      translatedAnswerBodies={translatedAnswerBodies}
      isTranslating={isTranslating}
      likedIds={new Set(Object.entries(reactState).filter(([, r]) => (r as any).like?.mine).map(([id]) => id))}
      reactionsMap={reactState}
      onLike={(id) => react(id, 'like')}
      onReact={react}
      myStickers={getOwnedStickerEmojis(ownedPackIds, ownedGachaStickers)}
      unread={unreadCount}
      lang={lang}
    />
  );
    if (screen === 'diary-list') return <DiaryListScreen go={go} diaryPages={diaryPages} />;
    if (screen === 'diary-create') return <DiaryCreateScreen go={go} onCreate={createDiaryPage} />;
    if (screen === 'diary-detail' && selectedDiary)
      return (
        <DiaryDetailScreen
          go={go}
          page={selectedDiary}
          onAddEntry={addDiaryEntry}
          onEditEntry={editDiaryEntry}
          onDeleteEntry={deleteDiaryEntry}
          onReportEntry={reportDiaryEntry}
          onToggleLike={toggleDiaryLike}
          onAddComment={addDiaryComment}
          sharedMode={diaryUseDb}
        />
      );
    if (screen === 'blog-list') return <BlogListScreen go={go} posts={blogPosts} onDelete={deleteBlogPost} />;
    if (screen === 'blog-create') return <BlogCreateScreen go={go} onCreate={createBlogPost} />;
    if (screen === 'blog-detail') {
      const post = blogPosts.find((p) => p.id === selectedBlogId);
      if (post) return <BlogDetailScreen go={go} post={post} onToggleLike={toggleBlogLike} onAddComment={addBlogComment} onDelete={deleteBlogPost} />;
      return <BlogListScreen go={go} posts={blogPosts} onDelete={deleteBlogPost} />;
    }
    if (screen === 'search') return <SearchScreen go={go} answers={answers} myProfile={profileBookInfo} questionList={[...communityQuestions, ...localizedQuestions]} reactionsMap={reactState} likedIds={new Set(Object.entries(reactState).filter(([, r]) => (r as any).like?.mine).map(([id]) => id))} onLike={(id) => react(id, 'like')} onReact={react} myStickers={getOwnedStickerEmojis(ownedPackIds, ownedGachaStickers)} />;
    if (screen === 'create')
  return (
    <CreateScreen
      go={go}
      onPost={postAnswer}
      question={selectedQuestion}
      questionList={[...communityQuestions, ...activeQuestions].filter((q) => !myAnsweredQids.has(q.id) || q.id === selectedQuestion?.id)}
      onCreateDiary={(caption, photoUrl, _font, textColor, visibility, mentionedUserIds) =>
        createDiaryPage(caption.slice(0, 20) || '思い出の1ページ', '', caption, photoUrl, visibility, mentionedUserIds, { textColor })
      }
      ownedPackIds={ownedPackIds}
      ownedGachaStickers={ownedGachaStickers}
      pen={myPen}
      onPenChange={updateMyPen}
    />
  );
    if (screen === 'profile') {
      if (selectedProfileId) {
        const otherProfile = [...profiles, ...followers].find((p) => p.id === selectedProfileId)
          ?? (viewedProfile && viewedProfile.id === selectedProfileId ? viewedProfile : null);
        if (otherProfile) return <OtherProfileScreen go={go} profile={otherProfile} answers={answers} subscribedOfficials={subscribedOfficials} onToggleSubscription={toggleSubscription} myProfile={profileBookInfo} diaryPages={diaryPages} circles={circles} exchanged={exchangedProfiles.includes(otherProfile.id)} onExchange={exchangeProfileBook} supabaseBook={viewedProfileBook} targetUid={viewedProfileUid} onOpenBlog={(post) => { setBlogPosts((prev) => prev.some((x) => x.id === post.id) ? prev : [post, ...prev]); go('blog-detail', post.id); }} lang={lang} />;
        // Supabase から読み込み中
        return (
          <div className="flex min-h-[60vh] items-center justify-center">
            <span className="text-3xl animate-pulse">🎀</span>
          </div>
        );
      }
      return <ProfileScreen
        go={go}
        profileBookInfo={profileBookInfo}
        best3={best3}
        monthlyBest3={{ theme: currentMonthInfo().theme, label: currentMonthInfo().label, items: monthlyBest3.items, events: currentMonthInfo().events, episodeQ: currentMonthInfo().episodeQ, episode: monthlyBest3.episode }}
        profileQuestions={profileQuestions}
        avatarUrl={avatarUrl}
        favoritePhotos={favoritePhotos}
        customFields={profileCustomFields}
        equippedBg={getBgTheme(equippedBgId)}
        lang={lang}
        pen={myPen}
      />;
    }
    if (screen === 'onboarding') return <OnboardingScreen onDone={completeOnboarding} />;
    if (screen === 'detail' && selectedAnswer) return (
      <DetailScreen
        go={go}
        answer={selectedAnswer}
        onReact={react}
        reactions={reactState[selectedAnswer.id] ?? {}}
        authorUid={answerAuthorUid[selectedAnswer.id] ?? null}
        ownedPackIds={ownedPackIds}
        ownedGachaStickers={ownedGachaStickers}
        isBookmarked={bookmarks.includes(selectedAnswer.id)}
        onToggleBookmark={toggleBookmark}
        onShare={shareText}
        onReport={reportAnswer}
      />
    );
    if (screen === 'bookmarks') return (
      <BookmarksScreen go={go} answers={answers} bookmarks={bookmarks} onToggleBookmark={toggleBookmark} />
    );
    if (screen === 'notifications') return <NotificationsScreen go={go} notifications={notifications} serverNotifs={serverNotifs} />;
    if (screen === 'followers') return <FollowersScreen go={go} lang={lang} />;
    if (screen === 'mypage') return <MyPageScreen go={go} answers={answers} avatarUrl={avatarUrl} onGoBookmarks={() => go('bookmarks')} ownedStickerCount={ownedStickerCount} coins={coins} lang={lang} onLogout={logout} />;
    if (screen === 'shop') return (
      <ShopScreen
        go={go}
        coins={coins}
        ownedPackIds={ownedPackIds}
        ownedGachaStickers={ownedGachaStickers}
        onPurchasePack={purchasePack}
        onAddGachaStickers={addGachaStickers}
        onSpendCoins={spendCoins}
        ownedBgIds={ownedBgIds}
        equippedBgId={equippedBgId}
        onAddBg={addOwnedBg}
        onEquipBg={equipBg}
        ownedThemeIds={ownedThemeIds}
        onBuyTheme={buyTheme}
        bgShards={bgShards}
        onAddBgShards={addBgShards}
        onExchangeBg={exchangeBgTheme}
        lang={lang}
      />
    );

    if (screen === 'collab') return <CollabScreen go={go} />;
    if (screen === 'diagnosis') return <DiagnosisScreen go={go} target={diagTarget} />;

return <ProfileScreen
  go={go}
  profileBookInfo={profileBookInfo}
  best3={best3}
  monthlyBest3={{ theme: currentMonthInfo().theme, label: currentMonthInfo().label, items: monthlyBest3.items, events: currentMonthInfo().events, episodeQ: currentMonthInfo().episodeQ, episode: monthlyBest3.episode }}
  profileQuestions={profileQuestions}
  avatarUrl={avatarUrl}
  favoritePhotos={favoritePhotos}
  equippedBg={getBgTheme(equippedBgId)}
  pen={myPen}
/>;
 }, [
  myPen,
  screen,
  answers,
  selectedAnswer,
  selectedQuestion,
  profileBookInfo,
  best3,
  profileQuestions,
  communityQuestions,
  avatarUrl,
  favoritePhotos,
  diaryPages,
  selectedDiary,
  blogPosts,
  selectedBlogId,
  selectedProfileId,
  viewedProfile,
  viewedProfileBook,
  viewedProfileUid,
  reactState,
  serverNotifs,
  unreadCount,
  appTheme,
  circles,
  circlePosts,
  selectedCircleId,
  bookmarks,
  lang,
  coins,
  hasAnsweredPR,
  ownedBgIds,
  equippedBgId,
  exchangedProfiles,
  ownedThemeIds,
  bgShards,
  notifications,
]);

  const active = tabFromScreen(screen);

  return (
    <LangContext.Provider value={lang}>
      <DesktopShell active={active} currentScreen={screen} go={go} answers={answers} avatarUrl={avatarUrl} ownedStickerCount={ownedStickerCount} lang={lang} bgTheme={getBgTheme(equippedBgId)} translatedAnswerBodies={translatedAnswerBodies} unread={unreadCount}>{current}</DesktopShell>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      {celebration && <ProfileCelebration data={celebration} onClose={() => setCelebration(null)} />}
    </LangContext.Provider>
  );
}
