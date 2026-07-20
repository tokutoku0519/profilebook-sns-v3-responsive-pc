'use client';

import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
import { ArrowLeft, Bell, Bookmark, Home, LogOut, Plus, Search, Settings, Share2, ShoppingBag, UserRound } from 'lucide-react';
import { ToastContainer, ToastItem } from '@/components/Toast';
import { BottomTab, type TabKey } from '@/components/BottomTab';
import { AnswerCard, ProfileCard, QuestionCard, SectionHeader, TitleBadge } from '@/components/Cards';
import { RetroEmojiPicker, RetroFlower, RetroHeart, RetroMiniStar, RetroNote, RetroRibbon, RetroStar, RetroText, insertRetroCode } from '@/components/RetroEmoji';
import { initialAnswers, profiles, questions } from '@/lib/data';
import { isDev } from '@/lib/env';
import { getQuestionsForLang } from '@/lib/localeQuestions';
import { getGenderOptions } from '@/lib/localeConfig';
import { translateText } from '@/lib/translator';
import { getUserTitles, TITLE_DEFS } from '@/lib/titles';
import { STICKER_PACKS, draw10Gacha, drawGacha, RARITY_COLOR, type StickerItem, type StickerPack } from '@/lib/stickerPacks';
import { t, LANG_LIST, type Lang } from '@/lib/i18n';
import { getShareTargets, shareT, buildShareText, type SharePlatform } from '@/lib/shareTargets';
import { getTodaysPRQuestion, hasAnsweredPRToday, markPRAnswered, type PRQuestion } from '@/lib/prQuestions';
import { BG_THEMES, BG_GACHA_COST, SHARD_EXCHANGE_COST, COLOR_THEMES, drawBgGacha, getBgTheme, type BgTheme } from '@/lib/bgThemes';
import { ThemeArt, CoinIcon, ShardIcon } from '@/components/ThemeArt';
import { dbReady, getMyProfile, saveProfileBook, signOut } from '@/lib/db';

type Screen = 'home' | 'search' | 'create' | 'profile' | 'detail' | 'mypage' | 'notifications' | 'followers' | 'settings' | 'official-question-create' | 'diary-list' | 'diary-detail' | 'diary-create' | 'circles' | 'circle-detail' | 'circle-create' | 'shop' | 'onboarding' | 'bookmarks' | 'daily-question' | 'wallet';
type Question = (typeof questions)[number];
type Answer = (typeof initialAnswers)[number];
type Profile = (typeof profiles)[number];

// アプリ内アクティビティの通知（localStorage 永続化）
type AppNotification = { id: number; icon: string; text: string; at: number };

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

type DiaryEntry = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  body: string;
  photoUrl?: string;
  font?: string;
  textColor?: string;
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
  attribute: 'highschool',
  activity: '',
};
// 本番（=②）は空欄スタート（新規ユーザーが自分で埋める）。
const emptyProfileBookInfo: typeof demoProfileBookInfo = {
  name: '', nickname: '', birthday: '', bloodType: '', gender: '', mbti: '', hometown: '',
  favoriteFood: '', dislikeFood: '', favoriteColor: '', favoriteSubject: '', dislikeSubject: '',
  hobby: '', charmPoint: '', dream: '', favoriteCharacter: '', favoriteMusic: '', favoriteTv: '',
  favoriteArtist: '', favoriteManga: '', favoriteGame: '', specialty: '', personality: '',
  catchphrase: '', message: '', attribute: 'highschool', activity: '',
};
const defaultProfileBookInfo = isDev ? demoProfileBookInfo : emptyProfileBookInfo;

const defaultBest3 = isDev ? {
  tv: ['水曜日のダウンタウン', 'あちこちオードリー', 'YouTube'],
  food: ['オムライス', '揚げパン', '喫茶店のプリン'],
  places: ['喫茶店', 'ライブハウス', '海沿いの街'],
  music: ['宇多田ヒカル', '椎名林檎', 'Superfly'],
} : {
  tv: ['', '', ''],
  food: ['', '', ''],
  places: ['', '', ''],
  music: ['', '', ''],
};

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
// 本番はお題（q）はそのまま・回答（a）だけ空にして新規ユーザーに埋めてもらう。
const defaultProfileQuestions = isDev
  ? demoProfileQuestions
  : demoProfileQuestions.map((x) => ({ q: x.q, a: '' }));

type PremiumSection = {
  price: number;
  description: string;
  questions: Array<{ q: string; a: string }>;
  note: string;
};

type ProfileBook = {
  info: Omit<typeof defaultProfileBookInfo, 'attribute' | 'activity'> & { attribute?: string; activity?: string };
  best3: { tv: string[]; food: string[]; places: string[]; music: string[] };
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

const DIARY_FONTS = [
  { label: 'ふつう',    value: 'inherit' },
  { label: '丸文字',    value: "'M PLUS Rounded 1c', sans-serif" },
  { label: '手書き',    value: "'Klee One', cursive" },
  { label: 'ゆるふわ',  value: "'Zen Kurenaido', cursive" },
] as const;

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

const BLOOD_TYPE_OPTIONS = ['A型', 'B型', 'O型', 'AB型'];
const MBTI_OPTIONS = ['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'];
const SUBJECT_OPTIONS = ['国語','数学','英語','理科','社会','体育','音楽','美術','家庭科','技術','現代文','古文','漢文','化学','物理','生物','地理','歴史','倫理','情報'];
const PERSONALITY_OPTIONS = ['おっとり系','元気・明るい','クール・落ち着き','ちょっと不思議','真面目','天然','ふわふわ','ツンデレ','好奇心旺盛','マイペース','リーダー気質','聞き上手'];

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

function tabFromScreen(screen: Screen): TabKey {
  if (screen === 'search') return 'search';
  if (screen === 'create') return 'create';
  if (screen === 'mypage' || screen === 'followers' || screen === 'settings' || screen === 'official-question-create' || screen === 'shop' || screen === 'wallet') return 'mypage';
  if (screen === 'notifications') return 'notifications';
  if (screen === 'diary-list' || screen === 'diary-detail' || screen === 'diary-create') return 'home';
  if (screen === 'circles' || screen === 'circle-detail' || screen === 'circle-create') return 'home';
  return 'home';
}

function Phone({ children, active, go, lang, bgTheme = null }: { children: React.ReactNode; active: TabKey; go: (s: Screen) => void; lang: Lang; bgTheme?: BgTheme | null }) {
  return (
    <main className="relative mx-auto h-dvh w-full max-w-[390px] overflow-hidden bg-base text-ink shadow-2xl shadow-purple/10 sm:h-[844px] sm:max-h-[calc(100dvh-4rem)] sm:rounded-[36px] sm:border sm:border-white/70 lg:mx-0 lg:h-[calc(100vh-48px)] lg:max-h-none lg:max-w-none lg:rounded-[32px]">
      {/* 装備中テーマをアプリ全体の背景に敷く（上に薄い白で読みやすさを確保） */}
      {bgTheme && (
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <SceneBackground theme={bgTheme} subtle />
          <div className="absolute inset-0 bg-white/40" />
        </div>
      )}
      <div className="relative z-10 h-full overflow-y-auto pb-32 lg:pb-8">{children}</div>
      <div className="relative z-20 lg:hidden"><BottomTab active={active} onChange={(key) => go(key === 'notifications' ? 'notifications' : key)} lang={lang} /></div>
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
  return (
    <aside className="hidden h-[calc(100vh-48px)] w-[260px] shrink-0 rounded-[32px] border border-white/70 bg-white/80 p-5 shadow-card backdrop-blur lg:block">
      <div className="mb-8 flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-pink shadow-card overflow-hidden"><img src="/icon.png" alt="Miri" className="h-full w-full object-cover" /></div><div><p className="flex items-center gap-1.5 text-xl font-black">Miri<RetroMiniStar /></p><p className="text-xs font-bold text-muted">Profile Book SNS</p></div></div>
      <nav className="space-y-2">
        {items.map((item) => { const Icon = item.icon; const isActive = !inSecondary && active === item.key; return (
          <button key={item.key} onClick={() => go(item.screen)} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black transition ${isActive ? 'bg-pink text-white shadow-floating' : 'text-muted hover:bg-pink/10 hover:text-ink'}`}>
            <Icon size={20} />{t(item.labelKey, lang)}
          </button>
        ); })}
      </nav>
      <div className="mt-4 space-y-2">
        <button onClick={() => go('shop')} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black transition ${currentScreen === 'shop' ? 'bg-pink/15 text-ink' : 'text-muted hover:bg-pink/10 hover:text-ink'}`}>
          <ShoppingBag size={20} />{t('nav_shop', lang)}
        </button>
        <button onClick={() => go('circles')} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black transition ${currentScreen === 'circles' ? 'bg-pink/15 text-ink' : 'text-muted hover:bg-pink/10 hover:text-ink'}`}>
          <span className="text-base">🔒</span>{t('nav_circles', lang)}
        </button>
        <button onClick={() => go('followers')} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black transition ${currentScreen === 'followers' ? 'bg-pink/15 text-ink' : 'text-muted hover:bg-pink/10 hover:text-ink'}`}>
          <UserRound size={20} />{t('nav_following', lang)}
        </button>
        <button onClick={() => go('settings')} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black transition ${currentScreen === 'settings' ? 'bg-pink/15 text-ink' : 'text-muted hover:bg-pink/10 hover:text-ink'}`}>
          <Settings size={20} />{t('nav_settings', lang)}
        </button>
      </div>
      <div className="mt-6 rounded-[24px] bg-cream p-4 text-xs font-bold leading-6">
        投稿・検索・リアクション・コメントが動くPC対応版です。次はSupabase保存に進めます。
      </div>
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
  return (
    <aside className="hidden h-[calc(100vh-48px)] w-[320px] shrink-0 overflow-y-auto rounded-[32px] border border-white/70 bg-white/70 p-5 shadow-card backdrop-blur xl:block">
      <section className="cursor-pointer rounded-[28px] bg-white p-4 shadow-card transition hover:bg-pink/5 active:scale-[0.99]" onClick={() => go('profile')}>
        <div className="flex items-center gap-3"><div className="grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-pink/15 text-2xl">{avatarUrl ? <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" /> : me.avatar}</div><div><p className="font-black">{me.name}</p><p className="text-xs font-bold text-muted">{me.id}</p></div></div>
        <div className="mt-4 grid grid-cols-3 rounded-3xl bg-base p-3 text-center text-xs font-bold">
          <div><p className="text-lg text-ink">{myAnswers.length}</p>{t('tab_create', lang)}</div>
          <button onClick={(e) => { e.stopPropagation(); go('followers'); }} className="hover:text-pinkStrong transition"><p className="text-lg text-ink">{followers.length}</p>{t('btn_following', lang)}</button>
          <button onClick={(e) => { e.stopPropagation(); go('shop'); }} className="hover:text-pinkStrong transition"><p className="text-lg text-ink">{ownedStickerCount}</p>{t('nav_shop', lang)}</button>
        </div>
      </section>
      <section className="mt-5 rounded-[28px] bg-white p-4 shadow-card">
        <SectionHeader title={t('feed_popular', lang)} />
        <div className="space-y-3">{answers.slice(0,3).map((answer) => <button key={answer.id} onClick={() => go('detail', answer.id)} className="block w-full rounded-2xl bg-base p-3 text-left text-xs font-bold leading-5 hover:bg-pink/10"><span className="text-pinkStrong">{answer.question?.category}</span><br />{(translatedAnswerBodies[answer.id] ?? answer.body).slice(0,42)}...</button>)}</div>
      </section>
      <section className="mt-5 rounded-[28px] bg-white p-4 shadow-card">
        <SectionHeader title={t('feed_suggested', lang)} />
        <div className="space-y-3">{profiles.slice(0,3).map((profile) => <button key={profile.id} onClick={() => go('profile', profile.id)} className="flex w-full items-center gap-3 rounded-2xl bg-base p-3 text-left hover:bg-pink/10"><span className="grid h-10 w-10 place-items-center rounded-full bg-white text-xl">{profile.avatar}</span><span><b className="text-sm">{profile.name}</b><br /><span className="text-xs text-muted">{profile.common}</span></span></button>)}</div>
      </section>
    </aside>
  );
}

function DesktopShell({ children, active, currentScreen, go, answers, avatarUrl, ownedStickerCount, lang, bgTheme = null, translatedAnswerBodies = {} }: { children: React.ReactNode; active: TabKey; currentScreen?: Screen; go: (s: Screen, answerId?: string) => void; answers: Answer[]; avatarUrl: string; ownedStickerCount: number; lang: Lang; bgTheme?: BgTheme | null; translatedAnswerBodies?: Record<string, string> }) {
  return (
    <div className="min-h-screen bg-purple/25 p-0 sm:p-8 lg:p-6">
      <div className="mx-auto flex max-w-[1280px] gap-5">
        <DesktopNav active={active} go={go} lang={lang} currentScreen={currentScreen} />
        <div className="min-w-0 flex-1"><Phone active={active} go={go} lang={lang} bgTheme={bgTheme}>{children}</Phone></div>
        <RightRail answers={answers} go={go} avatarUrl={avatarUrl} ownedStickerCount={ownedStickerCount} lang={lang} translatedAnswerBodies={translatedAnswerBodies} />
      </div>
    </div>
  );
}

function AppHeader({ title = 'Miri', back = false, onBack, onBell }: { title?: string; back?: boolean; onBack?: () => void; onBell?: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between bg-base/90 px-4 pt-2 backdrop-blur">
      <button onClick={back ? onBack : undefined} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-card">
        {back ? <ArrowLeft size={20} /> : <img src="/icon.png" alt="Miri" className="h-8 w-8 rounded-xl object-cover" />}
      </button>
      <h1 className="text-lg font-black tracking-tight">{title}</h1>
      <button onClick={onBell} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-card"><Bell size={19} /></button>
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
  circles,
  circlePosts,
  dailyQuestion,
  hasAnsweredToday,
  prQuestion,
  hasAnsweredPR,
  translatedAnswerBodies,
  isTranslating,
  lang = 'ja',
}: {
  go: (s: Screen, payload?: any) => void;
  answers: Answer[];
  communityQuestions: any[];
  diaryPages: DiaryPage[];
  circles: Circle[];
  circlePosts: CirclePost[];
  dailyQuestion: Question;
  hasAnsweredToday: boolean;
  prQuestion: PRQuestion;
  hasAnsweredPR: boolean;
  translatedAnswerBodies: Record<string, string>;
  isTranslating: boolean;
  lang?: Lang;
}) {
  return (
    <>
      <AppHeader onBell={() => go('notifications')} />
      <div className="space-y-6 px-4 pt-3">
{communityQuestions.length > 0 && (
  <section className="space-y-3">
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-black text-ink">
        公認ユーザーのお題
      </h2>

      <button onClick={() => go('search')} className="text-xs font-black text-pink">
        もっと見る
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
            {q.createdByName} が作成
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
            title="今日のお題"
            action={hasAnsweredToday ? '回答済み ✅' : '答える'}
            onAction={() => go('daily-question')}
          />
          <button onClick={() => go('daily-question')} className="block w-full text-left">
            <div className="relative overflow-hidden rounded-[28px] bg-white p-4 shadow-card active:scale-[0.98] transition">
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-full bg-base px-2 py-0.5 text-[10px] font-black text-muted">📅 毎日更新</span>
              </div>
              <p className="text-base font-black text-ink leading-relaxed pr-2">{dailyQuestion?.title}</p>
              <div className="mt-3 flex items-center gap-2">
                {hasAnsweredToday ? (
                  <span className="rounded-full bg-pink/10 px-3 py-1 text-[10px] font-black text-pink">🔓 みんなの回答を見る</span>
                ) : (
                  <span className="rounded-full bg-purple/10 px-3 py-1 text-[10px] font-black text-purple">🔒 答えるとみんなの回答が見えます</span>
                )}
              </div>
            </div>
          </button>
        </section>
        {/* ── PR案件 ──（一旦非表示：SHOW_PR_QUESTIONS で切替） */}
        {SHOW_PR_QUESTIONS && (
        <section>
          <div className="flex items-center mb-3">
            <h2 className="text-lg font-black text-ink">💼 PR案件</h2>
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
            <p className="text-sm font-black text-ink leading-relaxed">{prQuestion.question}</p>
            <p className="mt-2 text-[10px] font-bold text-ink/60">
              {hasAnsweredPR ? '✅ 本日分回答済み' : '答えるとコインがもらえます'}
            </p>
          </button>
        </section>
        )}

        <section className="relative">
          <span className="pointer-events-none absolute right-20 -top-2 z-10"><RetroNote /></span>
          <SectionHeader title={t('sec_trending', lang)} action={t('btn_see_more', lang)} onAction={() => go('search')} />
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
            {isTranslating && (
              <p className="w-full text-center text-xs font-bold text-muted py-2">🌐 翻訳中...</p>
            )}
            {answers.map((answer) => (
              <button key={answer.id} onClick={() => go('detail', answer.id)} className="min-w-[288px] text-left transition active:scale-[0.98]">
                <AnswerCard answer={answer} translatedBody={translatedAnswerBodies[answer.id]} />
              </button>
            ))}
          </div>
        </section>
        <section>
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-lg font-black text-ink"><RetroHeart scale={0.85} />{t('sec_diary', lang)}</h2>
            <button onClick={() => go('diary-list')} className="text-xs font-black text-pink">{t('btn_see_more', lang)}</button>
          </div>
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
        {circles.length > 0 && (
          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-ink">🔒 {t('nav_circles', lang)}</h2>
              <button onClick={() => go('circles')} className="text-xs font-black text-pink">{t('btn_see_all', lang)}</button>
            </div>
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
              <button onClick={() => go('circle-create')}
                className="grid min-w-[100px] place-items-center rounded-[24px] border border-dashed border-pink/40 bg-white px-4 text-sm font-black text-pink shadow-card active:scale-[0.98]">
                {t('btn_create', lang)}
              </button>
            </div>
          </section>
        )}
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
    </>
  );
}

function SearchScreen({ go, answers, myProfile }: {
  go: (s: Screen, payload?: any) => void;
  answers: Answer[];
  myProfile: typeof defaultProfileBookInfo;
}) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'answer' | 'person' | 'question' | 'match'>('answer');
  // 回答タブでお題を選んで絞り込むためのお題ID（'' = すべてのお題）
  const [selectedOdaiId, setSelectedOdaiId] = useState('');
  const filteredAnswers = answers.filter((a) =>
    `${a.body} ${a.question?.title ?? ''} ${a.user.name}`.toLowerCase().includes(query.toLowerCase())
    && (!selectedOdaiId || a.question?.id === selectedOdaiId)
  );
  const filteredProfiles = profiles.filter((p) => `${p.name} ${p.id} ${p.bio} ${p.common}`.toLowerCase().includes(query.toLowerCase()));
  const filteredQuestions = questions.filter((q) => `${q.title} ${q.category}`.toLowerCase().includes(query.toLowerCase()));

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
      <AppHeader title="さがす" back onBack={() => go('home')} onBell={() => go('notifications')} />
      <div className="px-4 pt-3">
        <div className="flex items-center gap-2 rounded-full border border-purple-100 bg-white px-4 py-3 shadow-card">
          <Search size={20} className="text-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="回答・お題・ユーザーを検索" />
        </div>
        <div className="mt-4 grid grid-cols-4 rounded-full bg-white p-1 text-center text-xs font-bold shadow-card">
          <button onClick={() => setMode('answer')} className={`rounded-full py-2 ${mode === 'answer' ? 'bg-pink text-white' : 'text-muted'}`}>回答</button>
          <button onClick={() => setMode('question')} className={`rounded-full py-2 ${mode === 'question' ? 'bg-pink text-white' : 'text-muted'}`}>お題</button>
          <button onClick={() => setMode('person')} className={`rounded-full py-2 ${mode === 'person' ? 'bg-pink text-white' : 'text-muted'}`}>なかま</button>
          <button onClick={() => setMode('match')} className={`rounded-full py-2 ${mode === 'match' ? 'bg-pink text-white' : 'text-muted'}`}>共通点</button>
        </div>

        {mode === 'match' ? (
          <div className="mt-4 space-y-4 pb-8">
            <p className="text-xs font-bold text-muted">プロフ帳の共通点から、仲良くなれそうな人をさがしているよ 🍀</p>
            {matches.length === 0 ? (
              <div className="rounded-[28px] bg-white p-8 text-center text-sm font-bold text-muted shadow-card">
                共通点のある人が見つかりませんでした。<br />プロフィールを編集すると増えます！
              </div>
            ) : matches.map(({ profile, field, value }) => (
              <button key={profile.id} onClick={() => go('profile', profile.id)}
                className="flex w-full items-center gap-3 rounded-[24px] bg-white p-4 text-left shadow-card active:scale-[0.98]">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-pink/15 text-2xl">{profile.avatar}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-ink">{profile.name}</p>
                  <p className="text-xs font-bold text-muted">{profile.id}</p>
                  <p className="mt-1 text-xs font-bold text-pink">✨ {field}が一緒：{value}</p>
                </div>
                <span className="rounded-full bg-pink/10 px-3 py-2 text-xs font-black text-pink">プロフ帳</span>
              </button>
            ))}
            <div className="rounded-[24px] bg-cream/60 px-4 py-3 text-xs font-bold text-muted">
              💡 血液型・MBTIなどを設定で選択すると共通点が見つかりやすくなります
            </div>
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              {['平成', '給食', '夜型', 'インドア', '推し活', '放課後'].map((tag) => (
                <button key={tag} onClick={() => setQuery(tag)} className="rounded-full bg-white px-3 py-2 text-xs font-bold text-muted shadow-card">#{tag}</button>
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
                      const q = questions.find((x) => x.id === qid);
                      if (q) go('create', q);
                    } else {
                      setSelectedOdaiId(qid);
                    }
                  }}
                  className="w-full rounded-2xl border border-purple-100 bg-white p-3 text-sm font-bold text-ink outline-none shadow-card"
                >
                  <option value="">{mode === 'answer' ? 'すべてのお題' : 'お題を選んで答える…'}</option>
                  {questions.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
                </select>
              </div>
            )}

            <section className="mt-6 space-y-3">
              <SectionHeader title={mode === 'answer' ? '回答を探す' : mode === 'person' ? 'なかまを探す' : 'お題を探す'} />
              {mode === 'answer' && filteredAnswers.map((answer) => <button key={answer.id} onClick={() => go('detail', answer.id)} className="block w-full text-left"><AnswerCard answer={answer} /></button>)}
              {mode === 'person' && <div className="grid grid-cols-2 gap-3">{filteredProfiles.map((profile) => <button key={profile.id} onClick={() => go('profile', profile.id)} className="text-left"><ProfileCard profile={profile} /></button>)}</div>}
              {mode === 'question' && filteredQuestions.map((question) => <button key={question.id} onClick={() => go('create', question)} className="block w-full text-left"><QuestionCard question={question} /></button>)}
              {((mode === 'answer' && filteredAnswers.length === 0) || (mode === 'person' && filteredProfiles.length === 0) || (mode === 'question' && filteredQuestions.length === 0)) && (
                <div className="rounded-[28px] bg-white p-8 text-center text-sm font-bold text-muted shadow-card">見つかりませんでした。別の言葉で探してみてね。</div>
              )}
            </section>
          </>
        )}
      </div>
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
                <span className="text-3xl">{s.emoji}</span>
                <span className="text-[9px] font-bold text-muted leading-tight text-center">{s.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-2xl mb-2">🎭</p>
            <p className="text-sm font-black text-ink">スタンプがありません</p>
            <p className="text-xs font-bold text-muted">ショップでスタンプを入手しよう</p>
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
  onCreateDiary,
  ownedPackIds,
  ownedGachaStickers,
}: {
  go: (s: Screen, payload?: any) => void;
  onPost: (draft: DraftAnswer) => string;
  question?: any;
  onCreateDiary: (caption: string, photoUrl: string, font: string, textColor: string, visibility: 'public' | 'followers' | 'mentioned', mentionedUserIds: string[]) => string;
  ownedPackIds: string[];
  ownedGachaStickers: string[];
}) {
  const [createMode, setCreateMode] = useState<'question' | 'diary'>('question');
  const [showStickerPicker, setShowStickerPicker] = useState(false);

  // --- お題モード ---
  const _fallbackQ = questions[0] ?? getQuestionsForLang('ja')[0];
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

  const selectedQuestion =
    question ||
    questions.find((q) => q.id === draft.questionId) ||
    _fallbackQ;

  const canPost = draft.body.trim().length > 0;

  function submit() {
    if (!canPost) return;
    const id = onPost(draft);
    setDraft({ questionId: question?.id || _fallbackQ.id, body: '', sticker: '🎀', visibility: 'public' });
    go('detail', id);
  }

  // --- 日記モード ---
  const [diaryCaption, setDiaryCaption] = useState('');
  const [diaryCaptionPhoto, setDiaryCaptionPhoto] = useState('');
  const [diaryNgError, setDiaryNgError] = useState(false);
  const [diaryFont, setDiaryFont] = useState<string>(DIARY_FONTS[0].value);
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
    const id = onCreateDiary(diaryCaption.trim(), diaryCaptionPhoto, diaryFont, diaryColor, diaryVisibility, diaryMentionedIds);
    setDiaryCaption('');
    setDiaryCaptionPhoto('');
    setDiaryNgError(false);
    setDiaryVisibility('followers');
    setDiaryMentionedIds([]);
    go('diary-detail', id);
  }

  return (
    <>
      <AppHeader title="書き込む" back onBack={() => go('home')} onBell={() => go('notifications')} />
      <div className="space-y-4 px-4 pt-3 pb-8">

        {/* モード切替タブ */}
        <div className="grid grid-cols-2 gap-1 rounded-full bg-white p-1 text-xs font-bold shadow-card">
          <button
            onClick={() => setCreateMode('question')}
            className={`rounded-full py-2.5 transition ${createMode === 'question' ? 'bg-pink text-white shadow-sm' : 'text-muted'}`}
          >
            ✏️ お題に答える
          </button>
          <button
            onClick={() => setCreateMode('diary')}
            className={`rounded-full py-2.5 transition ${createMode === 'diary' ? 'bg-pink text-white shadow-sm' : 'text-muted'}`}
          >
            📖 日記に書く
          </button>
        </div>

        {/* ── お題モード ── */}
        {createMode === 'question' && (
          <>
            {/* 特定のお題を指定して来た場合（PR・公認お題など）はドロップダウンを出さず、
                そのお題1件だけを表示（質問が二重に見えるのを防ぐ）。
                フリー作成時のみ、答えるお題を選べるドロップダウンを表示する。 */}
            {!question && (
              <section className="rounded-[28px] bg-white p-4 shadow-card">
                <label className="mb-2 block text-sm font-bold">答えるお題</label>
                <select value={draft.questionId} onChange={(e) => setDraft({ ...draft, questionId: e.target.value })} className="w-full rounded-2xl border border-purple-100 bg-base p-3 text-sm font-bold outline-none">
                  {questions.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
                </select>
              </section>
            )}
            <QuestionCard question={selectedQuestion} />
            <section className="rounded-[28px] border border-purple-100 bg-white p-4 shadow-card">
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-sm font-bold">あなたの回答</label>
                {selectedQuestion?.answerType !== 'select' && (
                  <span className="text-xs font-bold text-muted">{draft.body.length}/160</span>
                )}
              </div>
              {selectedQuestion?.answerType === 'select' && Array.isArray(selectedQuestion?.answerOptions) && selectedQuestion.answerOptions.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {selectedQuestion.answerOptions.map((opt: string) => (
                    <button key={opt} type="button"
                      onClick={() => setDraft({ ...draft, body: opt })}
                      className={`rounded-2xl py-4 text-sm font-black transition ${draft.body === opt ? 'bg-pink text-white shadow-card' : 'bg-base text-ink hover:bg-pink/10'}`}>
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <RetroEmojiPicker onInsert={(code) => insertRetroCode(bodyRef, code, (v) => setDraft((prev) => ({ ...prev, body: v })))} />
                  <textarea ref={bodyRef} value={draft.body} maxLength={160} onChange={(e) => setDraft({ ...draft, body: e.target.value })} className="notebook-lines mt-2 h-44 w-full resize-none rounded-3xl border border-pink/20 bg-blue-50/40 p-4 leading-8 outline-none focus:border-pink" placeholder="ここにプロフィール帳みたいに書いてね" />
                  {draft.body && (
                    <div className="mt-2 rounded-2xl border border-purple/20 bg-white px-4 py-3">
                      <p className="mb-1 text-[10px] font-bold text-muted">プレビュー</p>
                      <p className="notebook-lines min-h-[2rem] rounded-xl px-2 py-1 text-base font-medium leading-8 text-ink">
                        <RetroText text={draft.body} />
                      </p>
                    </div>
                  )}
                </>
              )}
            </section>
            <section className="rounded-[28px] bg-white p-4 shadow-card">
              <SectionHeader title="スタンプ" />
              <div className="flex items-center gap-3">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-pink/10 text-3xl">{draft.sticker}</span>
                <button
                  onClick={() => setShowStickerPicker(true)}
                  className="flex-1 rounded-full border-2 border-dashed border-pink/30 py-3 text-sm font-black text-pink hover:bg-pink/5 active:scale-[0.98]"
                >
                  🎭 スタンプを変える
                </button>
              </div>
            </section>
            {showStickerPicker && (
              <StickerPickerPanel
                ownedPackIds={ownedPackIds}
                ownedGachaStickers={ownedGachaStickers}
                onSelect={(s) => setDraft({ ...draft, sticker: s.emoji })}
                onClose={() => setShowStickerPicker(false)}
              />
            )}
            <section className="rounded-[28px] bg-white p-4 shadow-card">
              <label className="mb-2 block text-sm font-bold">公開範囲</label>
              <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                {[['public','全体公開'],['followers','フォロワー'],['private','非公開']].map(([key,label]) => <button key={key} onClick={() => setDraft({ ...draft, visibility: key as DraftAnswer['visibility'] })} className={`rounded-full py-3 ${draft.visibility === key ? 'bg-purple text-white' : 'bg-base text-muted'}`}>{label}</button>)}
              </div>
            </section>
            <button onClick={submit} disabled={!canPost} className={`h-14 w-full rounded-full text-base font-black text-white shadow-floating transition ${canPost ? 'bg-pink active:scale-[0.98]' : 'bg-muted/30'}`}>投稿する</button>
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
                  <span className="text-sm font-bold text-muted">写真を追加</span>
                  <span className="text-xs text-muted/60">タップして選ぶ</span>
                </div>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleDiaryCaptionPhoto} />
            </label>

            {/* フォント選択 */}
            <section className="rounded-[28px] bg-white p-4 shadow-card">
              <p className="mb-2 text-xs font-black text-muted">フォント</p>
              <div className="flex gap-2 flex-wrap">
                {DIARY_FONTS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setDiaryFont(f.value)}
                    style={{ fontFamily: f.value === 'inherit' ? undefined : f.value }}
                    className={`rounded-full px-4 py-2 text-sm transition ${diaryFont === f.value ? 'bg-pink text-white shadow-sm' : 'bg-base text-ink'}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <p className="mt-3 mb-2 text-xs font-black text-muted">文字色</p>
              <div className="flex gap-2 flex-wrap">
                {DIARY_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setDiaryColor(c.value)}
                    title={c.label}
                    className={`h-8 w-8 rounded-full transition ${diaryColor === c.value ? 'ring-2 ring-offset-2 ring-pink scale-110' : ''}`}
                    style={{ backgroundColor: c.bg }}
                  />
                ))}
              </div>
            </section>

            {/* 公開範囲 */}
            <section className="rounded-[28px] bg-white p-4 shadow-card">
              <p className="mb-2 text-xs font-black text-muted">書き込める相手</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ['followers', '👥', 'フォロワー'],
                  ['mentioned', '✉️', '特定の人'],
                  ['public',    '🌍', '全体'],
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
                    招待するフォロワーを選んでね（{diaryMentionedIds.length}人選択中）
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
                          {selected ? '✓ 招待中' : '招待する'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* コメント入力 */}
            <section className="rounded-[28px] border border-purple/15 bg-white p-4 shadow-card">
              {diaryNgError && (
                <p className="mb-2 rounded-2xl bg-pink/10 px-3 py-2 text-xs font-black text-pink">
                  不適切な言葉が含まれています。書き直してね。
                </p>
              )}
              <textarea
                value={diaryCaption}
                onChange={(e) => { setDiaryCaption(e.target.value); if (diaryNgError) setDiaryNgError(false); }}
                maxLength={200}
                rows={3}
                placeholder="コメントを書く…（200文字以内）"
                style={{ fontFamily: diaryFont === 'inherit' ? undefined : diaryFont, color: diaryColor }}
                className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted/50"
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs font-bold text-muted">{diaryCaption.length}/200</span>
                <button
                  onClick={submitDiary}
                  disabled={!diaryCanSubmit}
                  className="rounded-full bg-pink px-6 py-2 text-sm font-black text-white disabled:opacity-40 active:scale-[0.98] transition"
                >
                  投稿する
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

function ProfSectionHeader({ icon, title, theme }: { icon: string; title: string; theme: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-base">{icon}</span>
      <span className={`text-sm font-black ${THEME_ACCENT[theme] ?? 'text-pink'}`}>{title}</span>
      <div className="flex-1 border-b border-dashed border-purple/20" />
    </div>
  );
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

function ProfileBookContent({
  info,
  best3,
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
}: {
  info: typeof defaultProfileBookInfo;
  best3: { tv: string[]; food: string[]; places: string[]; music: string[] };
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
}) {
  const grad = THEME_GRADIENT[themeColor] ?? THEME_GRADIENT.pink;
  const accent = THEME_ACCENT[themeColor] ?? THEME_ACCENT.pink;
  const bg = THEME_BG[themeColor] ?? THEME_BG.pink;

  const [translatedQA, setTranslatedQA] = useState<Array<{q:string;a:string}> | null>(null);
  useEffect(() => {
    if (lang === 'ja') { setTranslatedQA(null); return; }
    let cancelled = false;
    (async () => {
      const pairs: Array<{q:string;a:string}> = [];
      for (const item of questions) {
        if (cancelled) break;
        const q = await translateText(item.q, lang);
        const a = await translateText(item.a, lang);
        pairs.push({ q, a });
      }
      if (!cancelled) setTranslatedQA(pairs);
    })();
    return () => { cancelled = true; };
  }, [lang, questions]);

  const TRANSLATE_FIELDS = [
    'favoriteFood','dislikeFood','favoriteColor','favoriteSubject','dislikeSubject',
    'favoriteCharacter','favoriteMusic','favoriteTv','favoriteArtist','favoriteManga',
    'favoriteGame','hobby','specialty','personality','catchphrase','charmPoint','dream',
    'message','hometown',
  ] as const;
  const [translatedInfo, setTranslatedInfo] = useState<Partial<typeof info>>({});
  useEffect(() => {
    if (lang === 'ja') { setTranslatedInfo({}); return; }
    let cancelled = false;
    (async () => {
      const result: Partial<typeof info> = {};
      for (const key of TRANSLATE_FIELDS) {
        if (cancelled) break;
        const val = info[key as keyof typeof info] as string;
        if (val) result[key as keyof typeof info] = await translateText(val, lang) as any;
      }
      if (!cancelled) setTranslatedInfo(result);
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, info.favoriteFood, info.dislikeFood]);
  const medals = ['🥇', '🥈', '🥉'];
  const lifeStageDef = LIFE_STAGE_DEFS.find((a) => a.id === info.attribute);
  const activityDef  = ACTIVITY_DEFS.find((a) => a.id === info.activity);

  return (
    <div className="space-y-4 px-4 pt-3 pb-32">

      {/* ── 表紙カード ── */}
      <section className={`relative overflow-hidden rounded-[32px] border border-purple/10 ${bgTheme ? '' : `bg-gradient-to-br ${grad}`} p-5 shadow-card`}>
        {bgTheme && <SceneBackground theme={bgTheme} />}
        <div className="absolute right-4 top-4 rotate-6 rounded-xl bg-white/80 px-3 py-1 text-[10px] font-black text-pink shadow-sm tracking-widest">
          ✿ PROFILE ✿
        </div>
        <div className="relative flex items-center gap-4">
          <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-full bg-white/60 text-5xl shadow-inner ring-2 ring-white">
            {avatarUrl
              ? <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
              : avatarEmoji}
          </div>
          <div className="min-w-0">
            <p className="text-xl font-black text-ink leading-tight">{info.name}</p>
            <p className="text-xs font-bold text-muted">{info.nickname} / {userId}</p>
            <p className={`mt-2 inline-block rounded-full bg-white/80 px-3 py-1 text-xs font-bold ${accent}`}>
              {info.catchphrase}
            </p>
          </div>
        </div>
        {/* ひとこと帯 */}
        <div className="relative mt-4 rounded-2xl bg-white/70 px-4 py-2.5 text-xs font-bold text-ink leading-relaxed">
          ✉ {translatedInfo.message ?? info.message}
        </div>
        {bgTheme && (
          <div className="relative mt-2 flex justify-end">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[9px] font-black text-muted">{bgTheme.floaters[0] && <ThemeArt art={bgTheme.floaters[0].art} size={12} />}{bgTheme.name}</span>
          </div>
        )}
      </section>

      {/* ── きほんじょうほう ── */}
      <section className="rounded-[28px] bg-white p-5 shadow-card">
        <ProfSectionHeader icon="☆" title={t('sec_basic', lang)} theme={themeColor} />
        <ProfileLine label={t('field_name', lang)} value={info.name} />
        <ProfileLine label={t('field_nickname', lang)} value={info.nickname} />
        <ProfileLine label={t('field_birthday', lang)} value={info.birthday} />
        {t('show_bloodType', lang) === 'true' && <ProfileLine label={t('field_bloodType', lang)} value={info.bloodType} />}
        {info.gender && <ProfileLine label={t('field_gender', lang)} value={info.gender} />}
        <ProfileLine label={t('field_mbti', lang)} value={info.mbti} />
        <ProfileLine label={t('field_hometown', lang)} value={translatedInfo.hometown ?? info.hometown} />
      </section>

      {/* ── すきなもの ── */}
      <section className="rounded-[28px] bg-white p-5 shadow-card">
        <ProfSectionHeader icon="♡" title={t('sec_likes', lang)} theme={themeColor} />
        <ProfileLine label={t('field_favoriteFood', lang)} value={translatedInfo.favoriteFood ?? info.favoriteFood} />
        <ProfileLine label={t('field_dislikeFood', lang)} value={translatedInfo.dislikeFood ?? info.dislikeFood} />
        <ProfileLine label={t('field_favoriteColor', lang)} value={translatedInfo.favoriteColor ?? info.favoriteColor} />
        {(lifeStageDef?.showSubjectFields ?? true) && (
          <>
            <ProfileLine label={t('field_favoriteSubject', lang)} value={translatedInfo.favoriteSubject ?? info.favoriteSubject} />
            <ProfileLine label={t('field_dislikeSubject', lang)} value={translatedInfo.dislikeSubject ?? info.dislikeSubject} />
          </>
        )}
        <ProfileLine label={t('field_favoriteCharacter', lang)} value={translatedInfo.favoriteCharacter ?? info.favoriteCharacter} />
        <ProfileLine label={t('field_favoriteMusic', lang)} value={translatedInfo.favoriteMusic ?? info.favoriteMusic} />
        <ProfileLine label={t('field_favoriteTv', lang)} value={translatedInfo.favoriteTv ?? info.favoriteTv} />
        <ProfileLine label={t('field_favoriteArtist', lang)} value={translatedInfo.favoriteArtist ?? info.favoriteArtist} />
        <ProfileLine label={t('field_favoriteManga', lang)} value={translatedInfo.favoriteManga ?? info.favoriteManga} />
        <ProfileLine label={t('field_favoriteGame', lang)} value={translatedInfo.favoriteGame ?? info.favoriteGame} />
      </section>

      {/* ── わたしのこと ── */}
      <section className="rounded-[28px] bg-white p-5 shadow-card">
        <ProfSectionHeader icon="✿" title={t('sec_about', lang)} theme={themeColor} />
        <ProfileLine label={t('field_hobby', lang)} value={translatedInfo.hobby ?? info.hobby} />
        <ProfileLine label={t('field_specialty', lang)} value={translatedInfo.specialty ?? info.specialty} />
        <ProfileLine label={t('field_personality', lang)} value={translatedInfo.personality ?? info.personality} />
        <ProfileLine label={t('field_catchphrase', lang)} value={translatedInfo.catchphrase ?? info.catchphrase} />
        <ProfileLine label={t('field_charmPoint', lang)} value={translatedInfo.charmPoint ?? info.charmPoint} />
        <ProfileLine label={t('field_dream', lang)} value={translatedInfo.dream ?? info.dream} />
      </section>

      {/* ── ライフステージ専用セクション ── */}
      {lifeStageDef && lifeStageDef.fields.some((f) => customFields[f.key]) && (
        <section className="rounded-[28px] bg-white p-5 shadow-card">
          <ProfSectionHeader icon={lifeStageDef.emoji} title={lifeStageDef.sectionTitle} theme={themeColor} />
          {lifeStageDef.fields.map((f) =>
            customFields[f.key] ? (
              <ProfileLine key={f.key} label={f.label} value={customFields[f.key]} />
            ) : null
          )}
        </section>
      )}

      {/* ── 特技・活動セクション ── */}
      {activityDef && activityDef.fields.some((f) => customFields[f.key]) && (
        <section className="rounded-[28px] bg-white p-5 shadow-card">
          <ProfSectionHeader icon={activityDef.emoji} title={activityDef.sectionTitle} theme={themeColor} />
          {activityDef.fields.map((f) =>
            customFields[f.key] ? (
              <ProfileLine key={f.key} label={f.label} value={customFields[f.key]} />
            ) : null
          )}
        </section>
      )}

      {/* ── BEST3 ── */}
      <section className="rounded-[28px] bg-white p-5 shadow-card">
        <ProfSectionHeader icon="★" title="すきなもの BEST3" theme={themeColor} />
        {([
          ['テレビ・YouTube', best3.tv],
          ['食べもの', best3.food],
          ['場所', best3.places],
          ['音楽', best3.music],
        ] as [string, string[]][]).map(([label, items]) => (
          <div key={label} className="mb-3">
            <p className={`mb-1.5 text-xs font-black ${accent}`}>▶ {label}</p>
            <div className="space-y-1 pl-1">
              {items.map((item, i) => (
                <p key={item} className="text-sm font-bold text-ink">{medals[i]} {item}</p>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* ── ひとことしつもん ── */}
      <section className="rounded-[28px] bg-white p-5 shadow-card">
        <ProfSectionHeader icon="💬" title={t('sec_qa', lang)} theme={themeColor} />
        {translatedQA === null && lang !== 'ja' && (
          <p className="text-center text-xs font-bold text-muted py-2">🌐 {t('msg_translating', lang)}</p>
        )}
        <div className="space-y-0">
          {(translatedQA ?? questions).map((item, i) => (
            <div key={i} className={`py-3 ${i < questions.length - 1 ? 'border-b border-dashed border-purple/15' : ''}`}>
              <p className={`text-[11px] font-black ${accent}`}>Q{i + 1}. {item.q}</p>
              <p className="mt-1 text-sm font-bold text-ink leading-relaxed">➜ {item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── お気に入り写真 ── */}
      {favoritePhotos && favoritePhotos.length > 0 && (
        <section className="rounded-[28px] bg-white p-5 shadow-card">
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
        <section className="rounded-[28px] bg-white p-5 shadow-card">
          <ProfSectionHeader icon="📝" title={t('sec_recent_answers', lang)} theme={themeColor} />
          <div className="space-y-2">
            {answers.slice(0, 3).map((answer) => (
              <button
                key={answer.id}
                onClick={() => onGoDetail(answer.id)}
                className={`w-full rounded-2xl ${bg} p-3 text-left active:scale-[0.99]`}
              >
                <p className={`text-[11px] font-black ${accent}`}>
                  {typeof answer.question === 'string' ? answer.question : answer.question?.title}
                </p>
                <p className="mt-1 text-sm font-bold text-ink leading-relaxed">{answer.body}</p>
              </button>
            ))}
          </div>
        </section>
      )}

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
  lang?: Lang;
}) {
  const alreadyFollowing = followers.some((f) => f.id === profile.id);
  const [isFollowing, setIsFollowing] = useState(alreadyFollowing);

  const book = mockProfileBooks[profile.id];
  const theirAnswers = answers.filter((a) => a.user.id === profile.id);
  const info = {
    ...(book?.info ?? {
      ...defaultProfileBookInfo,
      name: profile.name,
      nickname: profile.name,
      message: profile.bio,
      catchphrase: `「${profile.common}」`,
    }),
    attribute: book?.info?.attribute ?? 'highschool',
    activity: book?.info?.activity ?? '',
  };
  const best3 = book?.best3 ?? { tv: [], food: [], places: [], music: [] };
  const questions = book?.questions ?? [];
  const themeColor = book?.themeColor ?? 'pink';
  const premium = book?.premium;
  const isSubscribed = subscribedOfficials.includes(profile.id) || (me.isOfficial && book?.isOfficial === true);

  // ── なかよし度：プロフ帳の共通点＋いっしょの行動から算出 ──
  const commonPoints = useMemo(() => {
    if (!myProfile || !book?.info) return [] as { label: string; value: string }[];
    const result: { label: string; value: string }[] = [];
    for (const { key, label } of MATCH_FIELDS) {
      const mine = myProfile[key]?.trim();
      const theirs = book.info[key]?.trim();
      if (mine && theirs && mine === theirs) result.push({ label, value: mine });
    }
    return result;
  }, [myProfile, book]);
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
  const friendActions: { label: string; done: boolean }[] = [
    { label: '🎀 なかよし登録', done: isFollowing },
    { label: '📖 プロフ帳を交換した', done: exchanged },
    { label: '📔 いっしょに日記を書いた', done: wroteDiaryTogether },
    { label: '🔒 おなじサークル', done: inSameCircle },
  ];
  const friendLevel = Math.min(5, commonPoints.length + friendActions.filter((a) => a.done).length);
  const FRIEND_LEVEL_LABELS = ['はじめまして', 'かおみしり', 'ともだち', 'なかよし', 'だいのなかよし', 'しんゆう'];

  return (
    <>
      <AppHeader title={`${profile.name}のプロフ帳`} back onBack={() => go('home')} onBell={() => go('notifications')} />
      <div className="flex gap-2 px-4 pt-2">
        <button
          onClick={() => setIsFollowing((v) => !v)}
          className={`h-11 flex-1 rounded-full text-sm font-black shadow-card active:scale-[0.98] transition ${
            isFollowing
              ? 'bg-base text-pink ring-2 ring-pink'
              : 'bg-pink text-white'
          }`}
        >
          {isFollowing ? '🎀 なかよし登録中' : '🎀 なかよくなる'}
        </button>
        <button
          onClick={() => { if (!exchanged) onExchange?.(profile.id); }}
          disabled={exchanged}
          className={`h-11 flex-1 rounded-full text-sm font-black shadow-card active:scale-[0.98] transition ${
            exchanged
              ? 'bg-base text-purple ring-2 ring-purple/40'
              : 'bg-purple text-white'
          }`}
        >
          {exchanged ? '📖 交換ずみ' : '📖 プロフ帳を交換'}
        </button>
      </div>

      {/* なかよし度 */}
      <div className="px-4 pt-3">
        <section className="rounded-[24px] bg-white p-4 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-sm font-black text-ink">🍀 なかよし度</p>
            <p className="text-xs font-black text-pink">{FRIEND_LEVEL_LABELS[friendLevel]}</p>
          </div>
          <div className="mt-2 flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className={`text-xl transition ${i < friendLevel ? '' : 'opacity-20 grayscale'}`}>💗</span>
            ))}
          </div>
          {/* なかよしアクションの内訳 */}
          <div className="mt-3 flex flex-wrap gap-2">
            {commonPoints.map((c) => (
              <span key={c.label} className="rounded-full bg-pink/10 px-3 py-1 text-[10px] font-black text-pink">
                ✨ {c.label}が一緒：{c.value}
              </span>
            ))}
            {friendActions.map((a) => (
              <span key={a.label}
                className={`rounded-full px-3 py-1 text-[10px] font-black ${a.done ? 'bg-purple/10 text-purple' : 'bg-base text-muted opacity-60'}`}>
                {a.done ? '✓ ' : ''}{a.label}
              </span>
            ))}
          </div>
          {friendLevel < 5 && (
            <p className="mt-2 text-[10px] font-bold text-muted">
              プロフ帳を交換したり、いっしょに日記を書いたりするとなかよし度が上がるよ
            </p>
          )}
        </section>
      </div>

      {/* 称号バッジ */}
      {(() => {
        const titles = getUserTitles(profile.id);
        if (titles.length === 0) return null;
        const hasFounder = titles.includes('founder');
        return (
          <div className="space-y-2 px-4 pt-3">
            <div className="flex flex-wrap gap-2">
              {titles.map((t) => <TitleBadge key={t} type={t} userId={profile.id} />)}
            </div>
            {hasFounder && (
              <div className="rounded-[20px] bg-zinc-900 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xs font-black text-amber-400 tracking-widest">激レア</span>
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-black text-amber-400">ULTRA RARE</span>
                </div>
                <p className="text-xs font-bold leading-5 text-zinc-400">{TITLE_DEFS.founder.description}</p>
              </div>
            )}
          </div>
        );
      })()}

      <ProfileBookContent
        info={info}
        best3={best3}
        questions={questions}
        answers={theirAnswers}
        avatarEmoji={profile.avatar}
        userId={profile.id}
        themeColor={themeColor}
        onGoDetail={(id) => go('detail', id)}
        lang={lang}
      />

      {/* ── プレミアムコンテンツ ── */}
      {premium && (
        <div className="px-4 pb-10">
          <div className="overflow-hidden rounded-[32px] shadow-card">
            {/* ヘッダー */}
            <div className="bg-gradient-to-r from-amber-400 to-orange-400 p-5">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-xl">✨</span>
                <p className="font-black text-white">プレミアムコンテンツ</p>
                {isSubscribed && (
                  <span className="rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-black text-white">購入済み</span>
                )}
              </div>
              <p className="text-xs font-bold text-white/80">{premium.description}</p>
              {!isSubscribed && (
                <p className="mt-1 text-[10px] font-bold text-white/60"><CoinIcon size={12} /> 200コイン · 一度解除すればずっと読めます</p>
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
                  <p className="mb-1 text-base font-black text-ink"><CoinIcon size={15} /> 200コインで解除</p>
                  <p className="mb-5 text-xs font-bold text-muted">一度解除すればずっと読めます</p>
                  <button
                    onClick={() => onToggleSubscription(profile.id)}
                    className="rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-8 py-3 text-sm font-black text-white shadow-floating active:scale-[0.98] transition"
                  >
                    <CoinIcon size={14} /> コインで解除する
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
                    <p className="mb-2 text-xs font-black text-amber-600">✉ {profile.name}からのメッセージ</p>
                    <p className="text-sm font-bold text-ink leading-6">{premium.note}</p>
                  </div>
                )}
                <button
                  onClick={() => onToggleSubscription(profile.id)}
                  className="text-xs font-bold text-muted underline"
                >
                  購入を取り消す
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ProfileScreen({
  go,
  profileBookInfo,
  best3,
  profileQuestions,
  avatarUrl,
  favoritePhotos,
  customFields,
  equippedBg = null,
  lang = 'ja',
}: {
  go: (s: Screen, answerId?: string) => void;
  profileBookInfo: typeof defaultProfileBookInfo;
  best3: typeof defaultBest3;
  profileQuestions: typeof defaultProfileQuestions;
  avatarUrl: string;
  favoritePhotos: string[];
  customFields?: Record<string, string>;
  equippedBg?: BgTheme | null;
  lang?: Lang;
}) {
  const [showShare, setShowShare] = useState(false);
  return (
    <>
      <AppHeader title={t('header_profile', lang)} back onBack={() => go('home')} onBell={() => go('notifications')} />
      <div className="flex gap-2 px-4 pt-2">
        <button
          onClick={() => go('settings')}
          className="flex-1 rounded-full bg-white py-3 text-sm font-black text-pink shadow-card active:scale-[0.99]"
        >
          ✏️ 編集する
        </button>
        <button
          onClick={() => setShowShare(true)}
          className="rounded-full bg-white px-4 py-3 text-sm font-black text-muted shadow-card active:scale-[0.99]"
        >
          <Share2 size={17} />
        </button>
        {me.isOfficial && (
          <button
            onClick={() => go('official-question-create')}
            className="flex-1 rounded-full bg-blue-50 py-3 text-sm font-black text-blue-500 shadow-card active:scale-[0.99]"
          >
            ✓ お題を作る
          </button>
        )}
      </div>

      {/* 自分の称号バッジ */}
      {(() => {
        const titles = getUserTitles(me.id);
        if (titles.length === 0) return null;
        return (
          <div className="flex flex-wrap gap-2 px-4 pt-3">
            {titles.map((t) => <TitleBadge key={t} type={t} userId={me.id} />)}
          </div>
        );
      })()}

      <ProfileBookContent
        info={profileBookInfo}
        best3={best3}
        questions={profileQuestions}
        answers={[]}
        avatarEmoji="🎀"
        avatarUrl={avatarUrl || undefined}
        userId="@koki"
        themeColor="pink"
        bgTheme={equippedBg}
        favoritePhotos={favoritePhotos}
        customFields={customFields}
        lang={lang}
      />

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
}: {
  go: (s: Screen) => void;
  profileBookInfo: typeof defaultProfileBookInfo;
  best3: typeof defaultBest3;
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
}) {
  const [form, setForm] = useState(profileBookInfo);
  const [best3Form, setBest3Form] = useState(best3);
  const [questionsForm, setQuestionsForm] = useState(profileQuestions);
  const [localAvatarUrl, setLocalAvatarUrl] = useState(avatarUrl);
  const [localPhotos, setLocalPhotos] = useState<string[]>(favoritePhotos);
  const [localCustomFields, setLocalCustomFields] = useState<Record<string, string>>(customFields);
  const [premiumForm, setPremiumForm] = useState<PremiumSection>(premiumContent);
  const [showShare, setShowShare] = useState(false);

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setLocalAvatarUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
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

  return (
    <>
      <AppHeader title="プロフィール編集" back onBack={() => go('profile')} onBell={() => go('notifications')} />

      <div className="space-y-4 px-4 pt-3 pb-32">

        {/* ===== 言語設定 ===== */}
        <section className="rounded-[32px] bg-white p-5 shadow-card">
          <p className="mb-1 text-base font-black text-ink">🌐 言語 / Language</p>
          <p className="mb-4 text-xs font-bold text-muted">プロフィール項目名とタブが切り替わります（20言語対応）</p>
          <div className="grid grid-cols-4 gap-2">
            {LANG_LIST.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => onChangeLang(l.id)}
                className={`flex flex-col items-center gap-1 rounded-2xl py-2.5 px-1 text-center transition ${lang === l.id ? 'bg-pink/10 ring-2 ring-pink' : 'bg-base hover:bg-pink/5'}`}
              >
                <span className="text-xl">{l.flag}</span>
                <span className={`text-[9px] font-black leading-tight ${lang === l.id ? 'text-pink' : 'text-muted'}`}>{l.name}</span>
              </button>
            ))}
          </div>
        </section>

        {/* ===== テーマカラー ===== */}
        <section className="rounded-[32px] bg-white p-5 shadow-card">
          <p className="mb-1 text-base font-black text-ink">🎨 テーマカラー</p>
          <p className="mb-4 text-xs font-bold text-muted">アプリ全体の色と背景を変えられます</p>
          <div className="grid grid-cols-4 gap-3">
            {APP_THEMES.map((t) => {
              const isActive = appTheme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onChangeTheme(t.id)}
                  className={`flex flex-col items-center gap-1 rounded-2xl p-2 transition ${isActive ? 'bg-pink/10 ring-2 ring-pink' : 'hover:bg-base'}`}
                >
                  <span
                    className="h-10 w-10 rounded-full shadow-inner"
                    style={{ background: t.preview }}
                  />
                  <span className="text-[10px] font-black text-ink leading-tight">{t.emoji}</span>
                  <span className="text-[10px] font-bold text-muted leading-tight">{t.name}</span>
                </button>
              );
            })}
          </div>

          {/* ── 手に入れた背景テーマ（ガチャ・ショップ購入分） ── */}
          <div className="mt-6 border-t border-dashed border-pink/20 pt-5">
            <p className="mb-1 text-sm font-black text-ink">🖼 手に入れた背景テーマ</p>
            <p className="mb-3 text-[11px] font-bold text-muted">ガチャ・ショップでゲットしたテーマ。アプリ全体の背景に反映されます</p>
            {(() => {
              const ownedThemes = [
                ...BG_THEMES.filter((t) => ownedBgIds.includes(t.id)),
                ...COLOR_THEMES.filter((t) => ownedThemeIds.includes(t.id)),
              ];
              if (ownedThemes.length === 0) {
                return (
                  <button
                    type="button"
                    onClick={() => go('shop')}
                    className="w-full rounded-2xl border-2 border-dashed border-pink/30 py-4 text-xs font-black text-pink hover:bg-pink/5"
                  >
                    まだ持っていないよ。ショップでゲットしよう！ →
                  </button>
                );
              }
              return (
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => onEquipBg(null)}
                    className={`overflow-hidden rounded-2xl text-left transition ${!equippedBgId ? 'ring-2 ring-pink' : 'opacity-80 hover:opacity-100'}`}
                  >
                    <div className="grid h-16 place-items-center bg-base text-[10px] font-black text-muted">なし</div>
                    <p className="bg-white px-2 py-1.5 text-[10px] font-black text-ink">ノーマル</p>
                  </button>
                  {ownedThemes.map((t) => {
                    const equipped = equippedBgId === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onEquipBg(equipped ? null : t.id)}
                        className={`overflow-hidden rounded-2xl text-left transition ${equipped ? 'ring-2 ring-pink' : 'opacity-80 hover:opacity-100'}`}
                      >
                        <div className="relative h-16 overflow-hidden">
                          <SceneBackground theme={t} scale={0.55} />
                          {equipped && (
                            <span className="absolute right-1 top-1 rounded-full bg-pink px-1.5 py-0.5 text-[8px] font-black text-white">使用中</span>
                          )}
                        </div>
                        <p className="truncate bg-white px-2 py-1.5 text-[10px] font-black text-ink">{t.name}</p>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </section>

        <section className="rounded-[32px] bg-white p-5 shadow-card">
          <p className="mb-3 text-sm font-black text-muted">アイコン画像</p>
          <div className="flex items-center gap-4">
            <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-pink/20 text-4xl shadow-inner">
              {localAvatarUrl ? (
                <img src={localAvatarUrl} alt="avatar" className="h-full w-full object-cover" />
              ) : (
                '🎀'
              )}
            </div>
            <label className="cursor-pointer rounded-2xl bg-pink/10 px-4 py-3 text-sm font-black text-pink active:scale-[0.99]">
              画像を選ぶ
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </label>
            {localAvatarUrl && (
              <button type="button" onClick={() => setLocalAvatarUrl('')} className="text-xs font-black text-muted">
                削除
              </button>
            )}
          </div>
        </section>

        <section className="rounded-[32px] bg-white p-5 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-black text-muted">お気に入り写真（{localPhotos.length}/10）</p>
            {localPhotos.length < 10 && (
              <label className="cursor-pointer rounded-full bg-pink/10 px-3 py-2 text-xs font-black text-pink active:scale-[0.99]">
                ＋ 追加
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleAddPhotos} />
              </label>
            )}
          </div>
          {localPhotos.length === 0 ? (
            <label className="flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-pink/30 bg-pink/5 p-8 text-xs font-bold text-muted">
              タップして写真を追加（最大10枚）
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleAddPhotos} />
            </label>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {localPhotos.map((photo, index) => (
                <div key={index} className="relative aspect-square overflow-hidden rounded-2xl">
                  <img src={photo} alt={`photo-${index}`} className="h-full w-full object-cover" />
                  <div className="absolute bottom-0 left-0 right-0 flex gap-1 p-1">
                    <label className="flex-1 cursor-pointer rounded-lg bg-white/80 py-1 text-center text-[10px] font-black text-ink backdrop-blur-sm">
                      差替
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleReplacePhoto(index, e)} />
                    </label>
                    <button type="button" onClick={() => handleDeletePhoto(index)} className="flex-1 rounded-lg bg-pink/80 py-1 text-[10px] font-black text-white backdrop-blur-sm">
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ===== ステップ1: 立場（ライフステージ）===== */}
        <section className="rounded-[32px] bg-white p-5 shadow-card">
          <p className="mb-1 text-base font-black text-ink">① 立場を選んでね</p>
          <p className="mb-4 text-xs font-bold text-muted">どれかひとつ（選ぶと表示項目が変わります）</p>
          <div className="grid grid-cols-2 gap-2">
            {LIFE_STAGE_DEFS.map((ls) => (
              <button
                key={ls.id}
                type="button"
                onClick={() => {
                  update('attribute', ls.id);
                  setLocalCustomFields((prev) => {
                    const next: Record<string, string> = {};
                    ACTIVITY_DEFS.find((a) => a.id === form.activity)?.fields.forEach((f) => {
                      if (prev[f.key]) next[f.key] = prev[f.key];
                    });
                    return next;
                  });
                }}
                className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${
                  form.attribute === ls.id
                    ? 'bg-pink text-white shadow-card'
                    : 'bg-base text-muted hover:bg-pink/10 hover:text-ink'
                }`}
              >
                <span>{ls.emoji}</span>
                <span className="text-left leading-tight">{ls.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* ===== ステップ2: 特技・活動（任意）===== */}
        <section className="rounded-[32px] bg-white p-5 shadow-card">
          <p className="mb-1 text-base font-black text-ink">② 特技・活動（あれば）</p>
          <p className="mb-4 text-xs font-bold text-muted">ライフステージに関係なく選べます</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                update('activity', '');
                setLocalCustomFields((prev) => {
                  const next: Record<string, string> = {};
                  LIFE_STAGE_DEFS.find((ls) => ls.id === form.attribute)?.fields.forEach((f) => {
                    if (prev[f.key]) next[f.key] = prev[f.key];
                  });
                  return next;
                });
              }}
              className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${
                !form.activity
                  ? 'bg-purple text-white shadow-card'
                  : 'bg-base text-muted hover:bg-purple/10 hover:text-ink'
              }`}
            >
              <span>✗</span>
              <span>なし</span>
            </button>
            {ACTIVITY_DEFS.map((act) => (
              <button
                key={act.id}
                type="button"
                onClick={() => {
                  update('activity', act.id);
                  setLocalCustomFields((prev) => {
                    const next: Record<string, string> = {};
                    LIFE_STAGE_DEFS.find((ls) => ls.id === form.attribute)?.fields.forEach((f) => {
                      if (prev[f.key]) next[f.key] = prev[f.key];
                    });
                    act.fields.forEach((f) => {
                      if (prev[f.key]) next[f.key] = prev[f.key];
                    });
                    return next;
                  });
                }}
                className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${
                  form.activity === act.id
                    ? 'bg-purple text-white shadow-card'
                    : 'bg-base text-muted hover:bg-purple/10 hover:text-ink'
                }`}
              >
                <span>{act.emoji}</span>
                <span className="text-left leading-tight">{act.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-[32px] bg-white p-5 shadow-card">
          <p className="text-xl font-black text-ink">基本プロフィールを編集</p>
          <p className="mt-1 text-xs font-bold text-muted">
            保存するとプロフィール帳に上書き反映されます
          </p>
        </section>

        <section className="space-y-3 rounded-[32px] bg-white p-5 shadow-card">
          <EditField label="なまえ" value={form.name} onChange={(v) => update('name', v)} />
          <EditField label="ニックネーム" value={form.nickname} onChange={(v) => update('nickname', v)} />
          <EditField label="たん生日" value={form.birthday} onChange={(v) => update('birthday', v)} />
          <SelectField label="血液型" value={form.bloodType} onChange={(v) => update('bloodType', v)} options={BLOOD_TYPE_OPTIONS} columns={4} />
          <SelectField label={t('field_gender', lang)} value={form.gender ?? ''} onChange={(v) => update('gender' as any, v)} options={getGenderOptions(lang)} columns={2} />
          <SelectField label="MBTI" value={form.mbti} onChange={(v) => update('mbti', v)} options={MBTI_OPTIONS} columns={4} />
          <EditField label="出身地" value={form.hometown} onChange={(v) => update('hometown', v)} />
          <EditField label="好きな食べ物" value={form.favoriteFood} onChange={(v) => update('favoriteFood', v)} />
          <EditField label="きらいな食べ物" value={form.dislikeFood} onChange={(v) => update('dislikeFood', v)} />
          <EditField label="好きな色" value={form.favoriteColor} onChange={(v) => update('favoriteColor', v)} />
          {(LIFE_STAGE_DEFS.find((ls) => ls.id === form.attribute)?.showSubjectFields ?? true) && (
            <>
              <SelectField label="好きな教科" value={form.favoriteSubject} onChange={(v) => update('favoriteSubject', v)} options={SUBJECT_OPTIONS} columns={3} />
              <SelectField label="苦手な教科" value={form.dislikeSubject} onChange={(v) => update('dislikeSubject', v)} options={SUBJECT_OPTIONS} columns={3} />
            </>
          )}
          <EditField label="好きなキャラクター" value={form.favoriteCharacter} onChange={(v) => update('favoriteCharacter', v)} />
          <EditField label="好きな音楽" value={form.favoriteMusic} onChange={(v) => update('favoriteMusic', v)} />
          <EditField label="好きなテレビ" value={form.favoriteTv} onChange={(v) => update('favoriteTv', v)} />
          <EditField label="好きな芸能人" value={form.favoriteArtist} onChange={(v) => update('favoriteArtist', v)} />
          <EditField label="好きな漫画" value={form.favoriteManga} onChange={(v) => update('favoriteManga', v)} />
          <EditField label="好きなゲーム" value={form.favoriteGame} onChange={(v) => update('favoriteGame', v)} />
          <EditField label="趣味" value={form.hobby} onChange={(v) => update('hobby', v)} />
          <EditField label="特技" value={form.specialty} onChange={(v) => update('specialty', v)} />
          <SelectField label="性格" value={form.personality} onChange={(v) => update('personality', v)} options={PERSONALITY_OPTIONS} columns={3} />
          <EditField label="口ぐせ" value={form.catchphrase} onChange={(v) => update('catchphrase', v)} />
          <EditField label="チャームポイント" value={form.charmPoint} onChange={(v) => update('charmPoint', v)} />
          <EditField label="将来の夢" value={form.dream} onChange={(v) => update('dream', v)} />
          <EditField label="ひとこと" value={form.message} onChange={(v) => update('message', v)} />
        </section>

        {/* ===== ライフステージ専用フィールド ===== */}
        {(() => {
          const lsDef = LIFE_STAGE_DEFS.find((ls) => ls.id === form.attribute);
          if (!lsDef || lsDef.fields.length === 0) return null;
          return (
            <section className="space-y-3 rounded-[32px] bg-white p-5 shadow-card">
              <p className="text-base font-black text-ink">{lsDef.emoji} {lsDef.sectionTitle}</p>
              {lsDef.fields.map((f) =>
                f.type === 'select' && f.options ? (
                  <SelectField key={f.key} label={f.label} value={localCustomFields[f.key] ?? ''} onChange={(v) => setLocalCustomFields((prev) => ({ ...prev, [f.key]: v }))} options={f.options} columns={f.options.length <= 4 ? f.options.length : 3} />
                ) : (
                  <EditField key={f.key} label={f.label} value={localCustomFields[f.key] ?? ''} onChange={(v) => setLocalCustomFields((prev) => ({ ...prev, [f.key]: v }))} />
                )
              )}
            </section>
          );
        })()}

        {/* ===== 特技・活動専用フィールド ===== */}
        {(() => {
          const actDef = ACTIVITY_DEFS.find((a) => a.id === form.activity);
          if (!actDef) return null;
          return (
            <section className="space-y-3 rounded-[32px] bg-white p-5 shadow-card">
              <p className="text-base font-black text-ink">{actDef.emoji} {actDef.sectionTitle}</p>
              {actDef.fields.map((f) =>
                f.type === 'select' && f.options ? (
                  <SelectField key={f.key} label={f.label} value={localCustomFields[f.key] ?? ''} onChange={(v) => setLocalCustomFields((prev) => ({ ...prev, [f.key]: v }))} options={f.options} columns={f.options.length <= 4 ? f.options.length : 3} />
                ) : (
                  <EditField key={f.key} label={f.label} value={localCustomFields[f.key] ?? ''} onChange={(v) => setLocalCustomFields((prev) => ({ ...prev, [f.key]: v }))} />
                )
              )}
            </section>
          );
        })()}
<section className="space-y-5 rounded-[32px] bg-white p-5 shadow-card">
  <p className="text-xl font-black text-ink">すきなもの BEST3</p>

  <Best3EditBlock
    title="好きなテレビ・YouTube"
    items={best3Form.tv}
    onChange={(next) =>
      setBest3Form((prev) => ({
        ...prev,
        tv: next,
      }))
    }
  />

  <Best3EditBlock
    title="好きな食べ物"
    items={best3Form.food}
    onChange={(next) =>
      setBest3Form((prev) => ({
        ...prev,
        food: next,
      }))
    }
  />

  <Best3EditBlock
    title="好きな場所"
    items={best3Form.places}
    onChange={(next) =>
      setBest3Form((prev) => ({
        ...prev,
        places: next,
      }))
    }
  />

  <Best3EditBlock
    title="好きな音楽"
    items={best3Form.music}
    onChange={(next) =>
      setBest3Form((prev) => ({
        ...prev,
        music: next,
      }))
    }
  />
</section>
<section className="space-y-4 rounded-[32px] bg-white p-5 shadow-card">
  <p className="text-xl font-black text-ink">ひとことしつもん</p>

  {questionsForm.map((item, index) => (

    
    
    
    <div key={index} className="space-y-2 rounded-2xl bg-cream/20 p-4">
      <EditField
        label={`質問 ${index + 1}`}
        value={item.q}
        onChange={(v) => {
          const next = [...questionsForm];
          next[index].q = v;
          setQuestionsForm(next);
        }}
      />

      <EditField
        label="回答"
        value={item.a}
        onChange={(v) => {
          const next = [...questionsForm];
          next[index].a = v;
          setQuestionsForm(next);
        }}
      />

      <div className="flex items-center justify-between">
  <p className="text-sm font-black text-ink">質問 {index + 1}</p>
  <button
    type="button"
    onClick={() =>
      setQuestionsForm((prev) => prev.filter((_, i) => i !== index))
    }
    className="text-xs font-black text-pink"
  >
    削除
  </button>
</div>
    </div>
  ))}

  <button
  type="button"
  onClick={() =>
    setQuestionsForm((prev) => [
      ...prev,
      { q: '新しい質問', a: '' },
    ])
  }
  className="w-full rounded-2xl border border-dashed border-pink/40 bg-pink/5 px-4 py-3 text-sm font-black text-pink active:scale-[0.99]"
>
  ＋ 質問を追加する
</button>
</section>
        {/* ===== プレミアム設定（公認ユーザーのみ） ===== */}
        {me.isOfficial && (
          <section className="space-y-4 rounded-[32px] border-2 border-amber-100 bg-white p-5 shadow-card">
            <div>
              <p className="text-base font-black text-ink">✨ プレミアム設定</p>
              <p className="mt-1 text-xs font-bold text-muted">購入者だけが見られる特別コンテンツを設定できます（買い切り）</p>
            </div>
            <EditField
              label="紹介文（購入ページに表示）"
              value={premiumForm.description}
              onChange={(v) => setPremiumForm((p) => ({ ...p, description: v }))}
            />
            <div className="flex items-center gap-3">
              <label className="shrink-0 text-xs font-bold text-muted">販売価格（円）</label>
              <input
                type="number"
                min={0}
                value={premiumForm.price}
                onChange={(e) => setPremiumForm((p) => ({ ...p, price: Number(e.target.value) || 480 }))}
                className="w-full rounded-2xl border border-amber-200 bg-amber-50/40 px-4 py-2 text-sm font-bold outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-black text-ink">プレミアムQ&A</p>
              {premiumForm.questions.map((item, i) => (
                <div key={i} className="mb-3 space-y-2 rounded-2xl bg-amber-50 p-4">
                  <EditField
                    label={`質問 ${i + 1}`}
                    value={item.q}
                    onChange={(v) => {
                      const next = [...premiumForm.questions];
                      next[i] = { ...next[i], q: v };
                      setPremiumForm((p) => ({ ...p, questions: next }));
                    }}
                  />
                  <EditField
                    label="回答"
                    value={item.a}
                    onChange={(v) => {
                      const next = [...premiumForm.questions];
                      next[i] = { ...next[i], a: v };
                      setPremiumForm((p) => ({ ...p, questions: next }));
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setPremiumForm((p) => ({ ...p, questions: p.questions.filter((_, j) => j !== i) }))}
                    className="text-xs font-black text-pink"
                  >
                    削除
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setPremiumForm((p) => ({ ...p, questions: [...p.questions, { q: '', a: '' }] }))}
                className="w-full rounded-2xl border border-dashed border-amber-300 bg-amber-50 py-3 text-sm font-black text-amber-500 active:scale-[0.99]"
              >
                ＋ 質問を追加する
              </button>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-muted">購入者へのメッセージ</label>
              <textarea
                value={premiumForm.note}
                onChange={(e) => setPremiumForm((p) => ({ ...p, note: e.target.value }))}
                rows={3}
                maxLength={300}
                className="w-full resize-none rounded-3xl border border-amber-200 bg-amber-50/40 p-4 text-sm font-bold outline-none focus:border-amber-400 leading-6"
                placeholder="購入してくれた人へひとこと..."
              />
            </div>
          </section>
        )}

        {/* ── 通知設定 ── */}
        <section className="rounded-[32px] bg-white p-5 shadow-card">
          <p className="mb-1 text-base font-black text-ink">🔔 通知設定</p>
          <p className="mb-4 text-xs font-bold text-muted">ブラウザ通知の許可が必要です</p>
          <label className="flex cursor-pointer items-center justify-between rounded-2xl bg-base px-4 py-3.5">
            <div>
              <p className="text-sm font-black text-ink">今日のお題を通知</p>
              <p className="text-xs font-bold text-muted">毎日お題が届いたら即お知らせ</p>
            </div>
            <div
              onClick={() => onToggleNotifyOdai(!notifyOdai)}
              className={`relative h-7 w-12 rounded-full transition-colors ${notifyOdai ? 'bg-pink' : 'bg-zinc-200'}`}
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${notifyOdai ? 'translate-x-6' : 'translate-x-1'}`} />
            </div>
          </label>
          {notifyOdai && (
            <p className="mt-2 text-center text-[11px] font-bold text-pink">✓ 通知オン — 毎日のお題をお知らせします</p>
          )}
        </section>

        {/* ── シェア ── */}
        <section className="rounded-[32px] bg-white p-5 shadow-card">
          <p className="mb-1 text-base font-black text-ink">📤 プロフィールをシェア</p>
          <p className="mb-4 text-xs font-bold text-muted">QRコードや画像でプロフィールを友達にシェアできます</p>
          <button
            onClick={() => setShowShare(true)}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-pink to-purple py-3.5 text-sm font-black text-white shadow-card active:scale-[0.98]"
          >
            <Share2 size={16} />シェア・QRコードを表示
          </button>
        </section>

        <button
          onClick={() => {
            onSave(form);
            onSaveBest3(best3Form);
            onSaveQuestions(questionsForm);
            onSaveAvatar(localAvatarUrl);
            onSaveFavoritePhotos(localPhotos);
            onSaveCustomFields(localCustomFields);
            if (me.isOfficial) onSavePremiumContent(premiumForm);
            go('profile');
          }}
          className="w-full rounded-[24px] bg-pink px-5 py-4 text-base font-black text-white shadow-card active:scale-[0.99]"
        >
          保存してプロフィール帳に反映
        </button>

        <button
          type="button"
          onClick={onLogout}
          className="mt-2 w-full rounded-[24px] border-2 border-red-200 bg-white px-5 py-4 text-base font-black text-red-500 active:scale-[0.99]"
        >
          ログアウト
        </button>
      </div>

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
    </>
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
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [imageGenerated, setImageGenerated] = useState(false);
  const [snsHint, setSnsHint] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qrIncludedRef = useRef(false);
  const pendingImageShareRef = useRef<SharePlatform | null>(null);
  const shareUrl = typeof window !== 'undefined' ? window.location.origin : 'https://miri-delta.vercel.app';
  const shareText = buildShareText(name, lang);
  const snsTargets = getShareTargets(lang);

  // canvas は tab='image' になった後レンダリングされるので useEffect で生成する
  useEffect(() => {
    if (tab === 'image' && !imageGenerated) {
      handleGenerateImage();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

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

  function drawCard(imgEl?: HTMLImageElement, qrEl?: HTMLImageElement) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 横型レイアウト：左上アイコン＋名前 / 左下プロフのチラ見せ / 右に大きなQR
    const W = 1200, H = 630;
    canvas.width = W;
    canvas.height = H;

    // 背景グラデーション（Miri Blue 基調）
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#EAF1FF');
    bg.addColorStop(1, '#F1EBFF');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // ホワイトカード
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    canvasRoundRect(ctx, 28, 28, W - 56, H - 56, 44);
    ctx.fill();

    // ── 左上：アバター円 ──
    const cx = 165, cy = 165, r = 85;
    const avatarBg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r + 14);
    avatarBg.addColorStop(0, '#DCE7FF');
    avatarBg.addColorStop(1, '#EAE0FF');
    ctx.fillStyle = avatarBg;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 14, 0, Math.PI * 2);
    ctx.fill();

    if (imgEl) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(imgEl, cx - r, cy - r, r * 2, r * 2);
      ctx.restore();
    } else {
      ctx.font = '80px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(avatar, cx, cy);
    }

    // ── アイコンの右：名前＋ID＋口ぐせ ──
    ctx.fillStyle = '#1F2C56';
    ctx.font = 'bold 56px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(truncateStr(name, 10), 290, 155);
    ctx.fillStyle = '#8A93AD';
    ctx.font = '30px sans-serif';
    ctx.fillText(userId, 290, 205);
    if (info.catchphrase) {
      ctx.fillStyle = '#4F73E8';
      ctx.font = 'italic bold 32px serif';
      ctx.fillText(truncateStr(info.catchphrase, 18), 290, 252);
    }

    // ── 左下：自己紹介シート風のプロフ抜粋（チラ見せ） ──
    const boxX = 64, boxY = 285, boxW = 560, boxH = 250;
    ctx.fillStyle = 'rgba(79,115,232,0.06)';
    canvasRoundRect(ctx, boxX, boxY, boxW, boxH, 28);
    ctx.fill();
    ctx.strokeStyle = 'rgba(79,115,232,0.28)';
    ctx.lineWidth = 3;
    canvasRoundRect(ctx, boxX, boxY, boxW, boxH, 28);
    ctx.stroke();

    // 「PROFILE」タグシール
    ctx.fillStyle = '#4F73E8';
    canvasRoundRect(ctx, boxX + 26, boxY - 18, 168, 36, 18);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('♡ PROFILE', boxX + 26 + 84, boxY + 8);

    // プロフィール帳の定番項目（空欄は飛ばして先頭4つ・ゆったり配置）
    const sheetFields = ([
      ['field_nickname', info.nickname],
      ['field_birthday', info.birthday],
      ['field_mbti', info.mbti],
      ['field_favoriteFood', info.favoriteFood],
      ['field_hobby', info.hobby],
      ['field_favoriteMusic', info.favoriteMusic],
      ['field_favoriteCharacter', info.favoriteCharacter],
      ['field_dream', info.dream],
    ] as [string, string][]).filter(([, v]) => v).slice(0, 4);

    const cellW = 250, cellH = 90;
    sheetFields.forEach(([key, val], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = boxX + 40 + col * (cellW + 20);
      const y = boxY + 66 + row * cellH;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#4F73E8';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(truncateStr(t(key, lang), 9), x, y);
      ctx.fillStyle = '#1F2C56';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(truncateStr(val, 8), x, y + 38);
      // 記入欄っぽい点線
      ctx.strokeStyle = 'rgba(79,115,232,0.35)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(x, y + 50);
      ctx.lineTo(x + cellW - 20, y + 50);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // 最終行をフェードアウトして「続きがある」チラ見せ感を出す
    const fade = ctx.createLinearGradient(0, boxY + boxH - 120, 0, boxY + boxH);
    fade.addColorStop(0, 'rgba(255,255,255,0)');
    fade.addColorStop(1, 'rgba(255,255,255,0.97)');
    ctx.fillStyle = fade;
    canvasRoundRect(ctx, boxX + 2, boxY + 2, boxW - 4, boxH - 4, 26);
    ctx.fill();
    ctx.fillStyle = '#4F73E8';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`… ${shareT('img_more', lang)} 👀`, boxX + boxW, H - 42);

    // ── 右：大きなQRコード ──
    const qrPanelX = 660, qrPanelY = 64, qrPanelW = 476, qrPanelH = 502;
    ctx.fillStyle = '#ffffff';
    canvasRoundRect(ctx, qrPanelX, qrPanelY, qrPanelW, qrPanelH, 32);
    ctx.fill();
    ctx.strokeStyle = 'rgba(79,115,232,0.4)';
    ctx.lineWidth = 4;
    canvasRoundRect(ctx, qrPanelX, qrPanelY, qrPanelW, qrPanelH, 32);
    ctx.stroke();

    if (qrEl) {
      const qrSize = 400;
      ctx.drawImage(qrEl, qrPanelX + (qrPanelW - qrSize) / 2, qrPanelY + 30, qrSize, qrSize);
    }
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8A93AD';
    ctx.fillText(shareT('img_scan', lang), qrPanelX + qrPanelW / 2, qrPanelY + qrPanelH - 30);

    // ブランディング：Miri Blue のロゴチップ（白抜き Miri）でブランド準拠に
    const logoW = 152, logoH = 60, logoX = 64, logoY = H - 92;
    ctx.fillStyle = '#4F73E8';
    canvasRoundRect(ctx, logoX, logoY, logoW, logoH, 18);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Miri', logoX + logoW / 2, logoY + logoH / 2 + 2);
    ctx.textBaseline = 'alphabetic';

    qrIncludedRef.current = !!qrEl;
    setImageGenerated(true);
  }

  function handleGenerateImage() {
    setImageGenerated(false);
    const doDraw = (avatarImg?: HTMLImageElement, qrImg?: HTMLImageElement) =>
      drawCard(avatarImg, qrImg);

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
            <div className="relative w-full max-w-[400px]">
              <canvas
                ref={canvasRef}
                className="w-full rounded-2xl shadow-card"
                style={{ aspectRatio: '1200/630' }}
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
function EditField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black text-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-2xl border border-purple/15 bg-cream/20 px-4 py-3 text-sm font-bold text-ink outline-none focus:border-pink"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  columns = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  columns?: number;
}) {
  return (
    <div>
      <span className="text-xs font-black text-muted">{label}</span>
      <div className={`mt-2 grid gap-2`} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(value === opt ? '' : opt)}
            className={`rounded-2xl py-2 text-xs font-black transition ${
              value === opt
                ? 'bg-pink text-white shadow-card'
                : 'bg-base text-muted hover:bg-pink/10 hover:text-ink'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function Best3EditBlock({
  title,
  items,
  onChange,
}: {
  title: string;
  items: string[];
  onChange: (next: string[]) => void;
}) {
  const safeItems = [items[0] || '', items[1] || '', items[2] || ''];

  const updateItem = (index: number, value: string) => {
    const next = [...safeItems];
    next[index] = value;
    onChange(next);
  };

  return (
    <div className="space-y-3 rounded-3xl bg-cream/20 p-4">
      <p className="text-sm font-black text-muted">{title}</p>

      {safeItems.map((item, index) => (
        <label key={index} className="flex items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-pink text-sm font-black text-white">
            {index + 1}
          </span>
          <input
            value={item}
            onChange={(e) => updateItem(index, e.target.value)}
            placeholder={`${index + 1}位を入力`}
            className="w-full rounded-2xl border border-purple/15 bg-white px-4 py-3 text-sm font-bold text-ink outline-none focus:border-pink"
          />
        </label>
      ))}
    </div>
  );
}

function DetailScreen({
  go, answer, onReact, isBookmarked, onToggleBookmark, onShare,
}: {
  go: (s: Screen) => void;
  answer: Answer;
  onReact: (answerId: string, type: keyof Answer['reactions'], prev: keyof Answer['reactions'] | null) => void;
  isBookmarked: boolean;
  onToggleBookmark: (id: string) => void;
  onShare: (text: string) => void;
}) {
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState(['これ完全にわかる、揚げパンの日だけ給食楽しみだった。']);
  const [reacted, setReacted] = useState<keyof Answer['reactions'] | null>(null);

  function react(type: keyof Answer['reactions']) {
    const prev = reacted;
    const next = prev === type ? null : type;
    setReacted(next);
    onReact(answer.id, type, prev);
  }

  function addComment() {
    if (!comment.trim()) return;
    setComments([comment.trim(), ...comments]);
    setComment('');
  }

  return (
    <>
      <AppHeader title="回答詳細" back onBack={() => go('home')} onBell={() => go('notifications')} />
      <div className="space-y-5 px-4 pt-3">
        <AnswerCard answer={answer} detail />

        {/* リアクション */}
        <div className="grid grid-cols-4 gap-2">
          {(['like','same','wakaru','natsukashii'] as const).map((type) => (
            <button key={type} onClick={() => react(type)}
              className={`rounded-full py-3 text-xs font-black shadow-card transition ${reacted === type ? 'bg-pink text-white' : 'bg-white'}`}>
              {type === 'like' ? '♡ すき' : type === 'same' ? '同じ' : type === 'wakaru' ? 'わかる' : '懐かしい'}
            </button>
          ))}
        </div>

        {/* シェア・ブックマーク */}
        <div className="flex gap-3">
          <button
            onClick={() => onShare(`「${answer.question?.title ?? ''}」\n\n${answer.body}\n\n— ${answer.user.name} on Miri`)}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white py-3 text-sm font-black text-muted shadow-card transition active:scale-[0.98]"
          >
            <Share2 size={16} />シェア
          </button>
          <button
            onClick={() => onToggleBookmark(answer.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-sm font-black shadow-card transition active:scale-[0.98] ${isBookmarked ? 'bg-pink text-white' : 'bg-white text-muted'}`}
          >
            <Bookmark size={16} fill={isBookmarked ? 'currentColor' : 'none'} />
            {isBookmarked ? '保存済み' : 'ブックマーク'}
          </button>
        </div>

        <section className="rounded-[28px] bg-white p-4 shadow-card">
          <SectionHeader title="コメント" />
          <div className="mb-3 flex gap-2">
            <input value={comment} onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addComment()}
              placeholder="コメントする" className="min-w-0 flex-1 rounded-full bg-base px-4 py-3 text-sm outline-none" />
            <button onClick={addComment} className="rounded-full bg-pink px-4 text-xs font-black text-white">送信</button>
          </div>
          <div className="space-y-2">{comments.map((c, i) => <p key={i} className="rounded-2xl bg-blue-50 p-3 text-sm">{c}</p>)}</div>
        </section>

        <section>
          <SectionHeader title="同じ回答の人" action="もっと見る" />
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">{profiles.map((profile) => <ProfileCard key={profile.id} profile={profile} />)}</div>
        </section>
        <button onClick={() => go('create')} className="h-14 w-full rounded-full bg-pink text-base font-black text-white shadow-floating">このお題に答える</button>
      </div>
    </>
  );
}

function MyPageScreen({ go, answers, avatarUrl, onGoBookmarks, ownedStickerCount, coins, lang, onLogout }: { go: (s: Screen, answerId?: string) => void; answers: Answer[]; avatarUrl: string; onGoBookmarks: () => void; ownedStickerCount: number; coins: number; lang: Lang; onLogout: () => void }) {
  const [tab, setTab] = useState<'answers' | 'saved' | 'drafts'>('answers');
  const myAnswers = answers.filter((a) => a.user.id === me.id);
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
      <p className="text-xl">{followers.length}</p>
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
      <p className="text-xl">{followers.length}</p>
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
            <p className="text-sm font-black text-red-500">ログアウト</p>
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

      </div>
    </>
  );
}

function ProfileLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-dashed border-purple/25 py-2">
      <div className="w-28 shrink-0 text-sm font-black text-ink">
        ♡ {label}
      </div>
      <div className="min-w-0 flex-1 text-sm font-bold text-pink">
        {value}
      </div>
    </div>
  );
}

function FollowersScreen({ go, lang = 'ja' }: { go: (s: Screen, payload?: any) => void; lang?: Lang }) {
  const [tab, setTab] = useState<'following' | 'followers'>('following');

  const mockFollowersList = [...followers].reverse();

  return (
    <>
      <AppHeader title={t('header_follow', lang)} back onBack={() => go('mypage')} onBell={() => go('notifications')} />
      <div className="space-y-4 px-4 pt-3">
        {/* タブ */}
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-base p-1">
          <button
            onClick={() => setTab('following')}
            className={`rounded-xl py-2 text-sm font-black transition ${tab === 'following' ? 'bg-white shadow-card text-pink' : 'text-muted'}`}
          >
            {t('btn_following', lang)} {followers.length}
          </button>
          <button
            onClick={() => setTab('followers')}
            className={`rounded-xl py-2 text-sm font-black transition ${tab === 'followers' ? 'bg-white shadow-card text-pink' : 'text-muted'}`}
          >
            {t('label_followers_tab', lang)} {followers.length}
          </button>
        </div>

        <section className="space-y-3">
          {(tab === 'following' ? followers : mockFollowersList).map((person) => (
            <button
              key={person.id}
              onClick={() => go('profile', person.id)}
              className="flex w-full items-center gap-3 rounded-[24px] bg-white p-4 text-left shadow-card transition active:scale-[0.98]"
            >
              <div className="grid h-12 w-12 place-items-center rounded-full bg-pink/15 text-2xl">
                {person.avatar}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-black">{person.name}</p>
                <p className="text-xs font-bold text-muted">{person.id}</p>
                <p className="mt-1 truncate text-xs text-muted">{person.bio}</p>
              </div>
              <span className="rounded-full bg-purple/10 px-3 py-2 text-xs font-black text-purple">
                {person.common}
              </span>
            </button>
          ))}
        </section>
      </div>
    </>
  );
}

function DiaryListScreen({
  go,
  diaryPages,
}: {
  go: (s: Screen, payload?: any) => void;
  diaryPages: DiaryPage[];
}) {
  return (
    <>
      <AppHeader title="交換日記" back onBack={() => go('home')} onBell={() => go('notifications')} />
      <div className="space-y-4 px-4 pt-3 pb-32">
        <button
          onClick={() => go('diary-create')}
          className="flex w-full items-center justify-center gap-2 rounded-[24px] bg-pink px-5 py-4 text-sm font-black text-white shadow-floating active:scale-[0.99]"
        >
          ＋ 新しい日記を作る
        </button>
        <p className="px-1 text-xs font-bold text-muted">
          フォロワーだけが書き込める交換日記です。みんなで一冊の日記を作ってね。
        </p>
        {diaryPages.length === 0 && (
          <div className="rounded-[28px] bg-white p-8 text-center text-sm font-bold text-muted shadow-card">
            まだ日記がないよ。最初の一冊を作ってみて！
          </div>
        )}
        {diaryPages.map((page) => (
          <button
            key={page.id}
            onClick={() => go('diary-detail', page.id)}
            className="w-full rounded-[28px] bg-white p-5 text-left shadow-card active:scale-[0.99]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-black text-ink">{page.theme}</p>
                <p className="mt-1 text-xs font-bold leading-5 text-muted">{page.description}</p>
              </div>
              <span className="shrink-0 rounded-full bg-pink/10 px-3 py-1 text-xs font-black text-pink">
                {page.entries.length}件
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">{page.createdByAvatar}</span>
                <span className="text-xs font-bold text-muted">{page.createdByName} が作成</span>
              </div>
              <span className={`rounded-full px-2 py-1 text-[10px] font-black ${
                page.visibility === 'public' ? 'bg-blue-50 text-blue-500' :
                page.visibility === 'followers' ? 'bg-base text-muted' :
                'bg-purple/10 text-purple'
              }`}>
                {page.visibility === 'public' ? '🌍 全体' : page.visibility === 'followers' ? '👥 フォロワー' : '✉️ 招待制'}
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
}: {
  go: (s: Screen) => void;
  page: DiaryPage;
  onAddEntry: (pageId: string, body: string, photoUrl?: string) => void;
  onEditEntry: (pageId: string, entryId: string, body: string, photoUrl?: string) => void;
  onDeleteEntry: (pageId: string, entryId: string) => void;
  onReportEntry: (pageId: string, entryId: string) => void;
}) {
  const [body, setBody] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [ngError, setNgError] = useState(false);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const diaryBodyRef = useRef<HTMLTextAreaElement>(null);

  const today = new Date().toDateString();
  const todaysMyEntry = page.entries.find(
    (e) => e.authorId === me.id && new Date(e.postedAt).toDateString() === today
  ) ?? null;

  useEffect(() => {
    if (todaysMyEntry) {
      setBody(todaysMyEntry.body);
      setPhotoUrl(todaysMyEntry.photoUrl ?? '');
    } else {
      setBody('');
      setPhotoUrl('');
    }
    setNgError(false);
  }, [page.id]);

  const canWrite =
    page.visibility === 'public' ||
    page.visibility === 'followers' ||
    page.createdBy === me.id ||
    page.mentionedUserIds.includes(me.id);

  const canSubmit = canWrite && body.trim().length > 0 && !containsNgWord(body);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function submit() {
    if (containsNgWord(body)) { setNgError(true); return; }
    if (!canWrite) return;
    if (todaysMyEntry) {
      onEditEntry(page.id, todaysMyEntry.id, body.trim(), photoUrl || undefined);
    } else {
      onAddEntry(page.id, body.trim(), photoUrl || undefined);
      setBody('');
      setPhotoUrl('');
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
        <section className="rounded-[32px] border border-pink/20 bg-gradient-to-br from-pink/15 via-white to-purple/15 p-5 shadow-card">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-full bg-white/80 px-3 py-1 text-[10px] font-black text-muted shadow-sm">{visibilityLabel}</span>
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
        {page.entries.map((entry, index) => (
          <section
            key={entry.id}
            className={`rounded-[28px] bg-white p-4 shadow-card ${index % 2 === 1 ? 'ml-6' : 'mr-6'}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{entry.authorAvatar}</span>
                <div>
                  <p className="text-sm font-black text-ink">{entry.authorName}</p>
                  <p className="text-[10px] font-bold text-muted">
                    {new Date(entry.postedAt).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                {canDeleteEntry(entry) && (
                  <button
                    onClick={() => setConfirmDeleteId(entry.id)}
                    className="rounded-full bg-pink/10 px-2 py-1 text-[10px] font-black text-pink"
                  >
                    削除
                  </button>
                )}
                {reportedIds.has(entry.id) ? (
                  <span className="rounded-full bg-base px-2 py-1 text-[10px] font-bold text-muted">報告済</span>
                ) : (
                  <button
                    onClick={() => {
                      onReportEntry(page.id, entry.id);
                      setReportedIds((prev) => new Set([...prev, entry.id]));
                    }}
                    className="rounded-full bg-base px-2 py-1 text-[10px] font-black text-muted"
                  >
                    報告
                  </button>
                )}
              </div>
            </div>
            <p className="mt-3 text-sm font-bold leading-6 text-ink"><RetroText text={entry.body} /></p>
            {entry.photoUrl && (
              <div className="mt-3 overflow-hidden rounded-2xl">
                <img src={entry.photoUrl} alt="entry photo" className="w-full object-cover" />
              </div>
            )}
          </section>
        ))}

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
            {ngError && (
              <p className="mb-2 rounded-2xl bg-pink/10 px-3 py-2 text-xs font-black text-pink">
                不適切な言葉が含まれています。書き直してね。
              </p>
            )}
            {photoUrl && (
              <div className="relative mb-3 inline-block">
                <img src={photoUrl} alt="preview" className="h-24 w-24 rounded-2xl object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotoUrl('')}
                  className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-pink text-[10px] font-black text-white shadow"
                >
                  ✕
                </button>
              </div>
            )}
            <RetroEmojiPicker onInsert={(code) => insertRetroCode(diaryBodyRef, code, setBody)} />
            <textarea
              ref={diaryBodyRef}
              value={body}
              onChange={(e) => { setBody(e.target.value); if (ngError) setNgError(false); }}
              maxLength={200}
              rows={3}
              placeholder="あの頃の思い出を書いてね（200文字以内）"
              className="mt-2 w-full resize-none rounded-2xl border border-purple/15 bg-cream/20 px-4 py-3 text-sm font-bold text-ink outline-none focus:border-pink"
            />
            {body && (
              <div className="mt-2 rounded-2xl border border-purple/20 bg-white px-4 py-3">
                <p className="mb-1 text-[10px] font-bold text-muted">プレビュー</p>
                <p className="min-h-[1.5rem] text-sm font-bold leading-7 text-ink"><RetroText text={body} /></p>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-muted">{body.length}/200</span>
                <label className="cursor-pointer rounded-full bg-pink/10 px-3 py-1 text-xs font-black text-pink">
                  📷
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                </label>
              </div>
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
  onCreate: (theme: string, description: string, firstEntryBody: string, firstPhotoUrl: string, visibility: 'public' | 'followers' | 'mentioned', mentionedUserIds: string[]) => string;
}) {
  const [theme, setTheme] = useState('');
  const [description, setDescription] = useState('');
  const [firstEntryBody, setFirstEntryBody] = useState('');
  const [firstPhotoUrl, setFirstPhotoUrl] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'mentioned'>('followers');
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);

  const canCreate = theme.trim().length > 0 && (visibility === 'followers' || mentionedUserIds.length > 0);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setFirstPhotoUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  }

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
              {followers.map((f) => {
                const selected = mentionedUserIds.includes(f.id);
                return (
                  <button
                    key={f.id}
                    onClick={() => toggleMention(f.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${selected ? 'bg-purple/10' : 'bg-base'}`}
                  >
                    <span className="text-xl">{f.avatar}</span>
                    <span className="flex-1 text-sm font-black text-ink">{f.name}</span>
                    <span className={`text-xs font-black ${selected ? 'text-purple' : 'text-muted'}`}>
                      {selected ? '✓ 招待中' : '招待する'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* 最初の書き込み（任意） */}
        <section className="rounded-[32px] bg-white p-5 shadow-card">
          <p className="mb-1 font-black text-ink">最初の書き込み <span className="text-xs font-bold text-muted">（任意）</span></p>
          <p className="mb-3 text-xs font-bold text-muted">日記を作ったあと、自分の思い出を最初に残せます</p>
          <textarea
            value={firstEntryBody}
            onChange={(e) => setFirstEntryBody(e.target.value)}
            maxLength={200}
            rows={3}
            placeholder="最初のひとことを書いてもいいよ（200文字以内）"
            className="w-full resize-none rounded-2xl border border-purple/15 bg-cream/20 px-4 py-3 text-sm font-bold text-ink outline-none focus:border-pink"
          />
          <div className="mt-3">
            {firstPhotoUrl ? (
              <div className="relative inline-block">
                <img src={firstPhotoUrl} alt="preview" className="h-24 w-24 rounded-2xl object-cover" />
                <button
                  type="button"
                  onClick={() => setFirstPhotoUrl('')}
                  className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-pink text-[10px] font-black text-white shadow"
                >
                  ✕
                </button>
              </div>
            ) : (
              <label className="cursor-pointer rounded-2xl bg-pink/10 px-4 py-2 text-xs font-black text-pink active:scale-[0.99]">
                📷 写真を追加する
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              </label>
            )}
          </div>
        </section>

        <div className="rounded-2xl bg-purple/5 px-4 py-3 text-xs font-bold leading-5 text-muted">
          ⚠️ 誹謗中傷・個人情報の書き込みは禁止です。違反した書き込みは作成者が削除できます。
        </div>

        <button
          disabled={!canCreate}
          onClick={() => {
            const id = onCreate(theme.trim(), description.trim(), firstEntryBody, firstPhotoUrl, visibility, mentionedUserIds);
            go('diary-detail', id);
          }}
          className="h-14 w-full rounded-full bg-pink text-base font-black text-white shadow-floating disabled:opacity-40 active:scale-[0.98]"
        >
          日記を作ってまわす ✉️
        </button>
      </div>
    </>
  );
}

// ===================== サークル画面 =====================

const CIRCLE_EMOJIS = ['🔒','🎭','📸','⚾','🎸','📚','🎨','💃','🏃','🌙','🍕','🎮','🎵','🐾','🌸'];

function CirclesScreen({
  go, circles, circlePosts,
}: { go: (s: Screen, payload?: any) => void; circles: Circle[]; circlePosts: CirclePost[] }) {
  return (
    <>
      <AppHeader title="サークル" back onBack={() => go('home')} onBell={() => go('notifications')} />
      <div className="space-y-4 px-4 pt-3 pb-32">
        <button onClick={() => go('circle-create')}
          className="flex w-full items-center justify-center gap-2 rounded-[24px] bg-pink px-5 py-4 text-sm font-black text-white shadow-floating active:scale-[0.99]">
          🔒 新しいサークルを作る
        </button>
        {circles.length === 0 ? (
          <div className="rounded-[28px] bg-white p-8 text-center text-sm font-bold text-muted shadow-card">
            まだサークルがありません<br />仲間だけのお題を作ってみよう！
          </div>
        ) : circles.map((c) => {
          const posts = circlePosts.filter((p) => p.circleId === c.id);
          const members = followers.filter((f) => c.memberIds.includes(f.id));
          const iAmMember = c.memberIds.includes(me.id);
          const memberCount = members.length + (iAmMember ? 1 : 0);
          const fanCount = c.fanIds?.length ?? 0;
          return (
            <button key={c.id} onClick={() => go('circle-detail', c.id)}
              className="flex w-full items-start gap-4 rounded-[28px] bg-white p-4 text-left shadow-card active:scale-[0.98]">
              <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-3xl ${c.isOfficial ? 'bg-amber-100' : 'bg-purple/10'}`}>{c.emoji}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-black text-ink">{c.name}</p>
                  {c.isOfficial ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-600">⭐ 公認</span>
                  ) : (
                    <span className="rounded-full bg-pink/10 px-2 py-0.5 text-[10px] font-black text-pink">🔒</span>
                  )}
                  {c.isOfficial && !iAmMember && c.fanIds?.includes(me.id) && (
                    <span className="rounded-full bg-pink/10 px-2 py-0.5 text-[10px] font-black text-pink">🎫 ファン参加中</span>
                  )}
                  {c.createdBy === me.id && (c.pendingFanIds?.length ?? 0) > 0 && (
                    <span className="rounded-full bg-pink px-2 py-0.5 text-[10px] font-black text-white">🔔 申請{c.pendingFanIds?.length}</span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  メンバー{memberCount}人{c.isOfficial && c.allowFans ? `・ファン${fanCount}人` : ''}・{posts.length}件のお題
                </p>
                <div className="mt-2 flex gap-1">
                  {(iAmMember ? [{ avatar: me.avatar }, ...members] : members).slice(0, 5).map((m, i) => (
                    <span key={i} className="text-base">{m.avatar}</span>
                  ))}
                </div>
              </div>
            </button>
          );
        })}
        <p className="text-center text-xs font-bold text-muted">🔒 サークル内のお題はメンバーだけに表示されます</p>
      </div>
    </>
  );
}

function CircleDetailScreen({
  go, circle, posts, onPost, onReply, onVote, onApplyFan, onApproveFan, onRejectFan,
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
}) {
  const [newQ, setNewQ] = useState('');
  const [newKind, setNewKind] = useState<'talk' | 'vote'>('talk');
  const [newAudience, setNewAudience] = useState<'members' | 'everyone'>('members');
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const newQRef = useRef<HTMLTextAreaElement>(null);
  const members = followers.filter((f) => circle.memberIds.includes(f.id));
  const iAmMember = circle.memberIds.includes(me.id);
  const iAmFan = !iAmMember && (circle.fanIds?.includes(me.id) ?? false);
  const fanJoinable = circle.isOfficial && circle.allowFans;
  const iAmOwner = circle.createdBy === me.id;
  const iAmPending = !iAmMember && !iAmFan && (circle.pendingFanIds?.includes(me.id) ?? false);
  const pendingFans = followers.filter((f) => circle.pendingFanIds?.includes(f.id));
  // 投票の候補（サークルメンバー全員）
  const voteCandidates = [
    ...(iAmMember ? [{ id: me.id, name: me.name, avatar: me.avatar }] : []),
    ...members,
  ];

  return (
    <>
      <AppHeader title={`${circle.emoji} ${circle.name}`} back onBack={() => go('circles')} onBell={() => go('notifications')} />
      <div className="space-y-4 px-4 pt-3 pb-32">
        <section className="rounded-[24px] bg-white p-4 shadow-card">
          <div className="mb-3 flex items-center gap-2">
            <p className="text-xs font-black text-muted">メンバー {members.length + (iAmMember ? 1 : 0)}人</p>
            {circle.isOfficial && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-600">⭐ 公認サークル</span>
            )}
            {fanJoinable && (
              <span className="rounded-full bg-pink/10 px-2 py-0.5 text-[10px] font-black text-pink">🎫 ファン {circle.fanIds?.length ?? 0}人</span>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {(iAmMember ? [{ id: me.id, name: me.name, avatar: me.avatar }, ...members] : members).map((m) => (
              <div key={m.id} className="flex flex-col items-center gap-1">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-pink/10 text-xl">{m.avatar}</div>
                <p className="text-[10px] font-bold text-muted">{m.name}</p>
              </div>
            ))}
          </div>
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

        {posts.length === 0 ? (
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
  onCreate: (name: string, emoji: string, memberIds: string[], opts?: { isOfficial?: boolean; allowFans?: boolean }) => string;
}) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🔒');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [isOfficial, setIsOfficial] = useState(false);
  const [allowFans, setAllowFans] = useState(false);

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
          onClick={() => { const id = onCreate(name.trim(), emoji, selectedMembers, { isOfficial, allowFans }); go('circle-detail', id); }}
          className="h-14 w-full rounded-full bg-pink text-base font-black text-white shadow-floating disabled:opacity-40 active:scale-[0.98]">
          {emoji} サークルを作る ({selectedMembers.length + 1}人)
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

  function handleDraw(pack: StickerPack, count: 1 | 10) {
    if (pack.acquisition.type !== 'gacha') return;
    const cost = pack.acquisition.coinCost * count;
    if (coins < cost) return;
    onSpendCoins(cost);
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
        <button className="rounded-full bg-amber-400 px-4 py-2 text-xs font-black text-zinc-900 shadow-card active:scale-[0.98]">
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
                          <p className="text-sm font-black text-ink">{pack.name}</p>
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
                          {s.emoji}
                        </span>
                      ))}
                      {pack.stickers.length > 8 && <span className="grid h-8 w-8 place-items-center rounded-xl bg-base text-[10px] font-black text-muted">+{pack.stickers.length - 8}</span>}
                    </button>
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
                    <p className="truncate text-xs font-black text-ink">{t.name}</p>
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
                        <p className="flex items-center gap-1 text-xs font-black text-ink">{t.floaters[0] && <ThemeArt art={t.floaters[0].art} size={14} />}{t.name}</p>
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
                  <p className="text-sm font-black text-ink">{item.name}</p>
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
                <p className="text-sm font-black text-ink">{item.name}</p>
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
                <p className="font-black text-ink">{detailPack.name}</p>
                <p className="text-xs font-bold text-muted">{detailPack.creator}</p>
              </div>
              <button onClick={() => setDetailPack(null)} className="ml-auto text-xl text-muted">✕</button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {detailPack.stickers.map((s) => (
                <div key={s.id} className="flex flex-col items-center gap-1 rounded-2xl bg-base p-2">
                  <span className={`text-3xl ${detailPack.acquisition.type === 'gacha' && !ownedGachaStickers.includes(s.id) ? 'opacity-30' : ''}`}>{s.emoji}</span>
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
                  <span className={gachaResult.length === 1 ? 'text-6xl' : 'text-2xl'}>{r.sticker.emoji}</span>
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
                {bgResult.theme.name}
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
  return (
    <div className="flex items-center gap-3 rounded-[20px] bg-white p-3 shadow-card">
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl ${owned ? 'bg-pink/10' : 'bg-base'}`}>{pack.thumbnail}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-black text-ink">{pack.name}</p>
          {pack.isNew && <span className="rounded-full bg-pink px-1.5 py-0.5 text-[9px] font-black text-white">NEW</span>}
          {pack.collab && <span className="rounded-full bg-purple/15 px-1.5 py-0.5 text-[9px] font-black text-purple">コラボ</span>}
        </div>
        <p className="text-[11px] font-bold text-muted">{pack.creator}</p>
        <button onClick={onDetail} className="mt-1 flex gap-0.5">
          {pack.stickers.slice(0, 6).map((s) => <span key={s.id} className="text-base">{s.emoji}</span>)}
        </button>
      </div>
      {action}
    </div>
  );
}

// ===================== /ショップ画面 =====================

function notificationTimeAgo(at: number): string {
  const diff = Date.now() - at;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'たった今';
  if (min < 60) return `${min}分前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}時間前`;
  return `${Math.floor(hour / 24)}日前`;
}

function NotificationsScreen({ go, notifications = [] }: { go: (s: Screen) => void; notifications?: AppNotification[] }) {
  return (
    <>
      <AppHeader title="通知" />
      <div className="space-y-3 px-4 pt-3">
        {notifications.length === 0 && (
          <div className="flex gap-3 rounded-[24px] bg-white p-4 shadow-card">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-pink/15">🎀</span>
            <p className="text-sm font-bold leading-6">Miriへようこそ！お題に答えたりガチャを引くと、ここにお知らせが届くよ</p>
          </div>
        )}
        {notifications.map((n) => (
          <div key={n.id} className="flex gap-3 rounded-[24px] bg-white p-4 shadow-card">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-pink/15">{n.icon}</span>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-6">{n.text}</p>
              <p className="text-[10px] font-bold text-muted">{notificationTimeAgo(n.at)}</p>
            </div>
          </div>
        ))}
        <button onClick={() => go('home')} className="mt-4 h-12 w-full rounded-full bg-pink text-sm font-black text-white">ホームに戻る</button>
      </div>
    </>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-[28px] bg-white p-8 text-center text-sm font-bold text-muted shadow-card">{text}</div>;
}

// ── コインウォレット画面 ────────────────────────────────────────
const COIN_PACKAGES = [
  { coins: 100,  price: 120,  bonus: 0,   popular: false },
  { coins: 500,  price: 480,  bonus: 50,  popular: true  },
  { coins: 1000, price: 980,  bonus: 200, popular: false },
  { coins: 3000, price: 2800, bonus: 800, popular: false },
];

function WalletScreen({ go, coins, onPurchaseCoins }: { go: (s: Screen) => void; coins: number; onPurchaseCoins: (amount: number) => void }) {
  const history: Array<{ amount: number; reason: string; date: string }> = (() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('miri_coin_history') || '[]'); } catch { return []; }
  })();

  const earnMethods = [
    { icon: '🌅', label: 'デイリーログイン', reward: '+3', desc: '毎日ログインするだけ' },
    { icon: '✍', label: 'お題に回答', reward: '+5', desc: '回答を投稿するたびに' },
    { icon: '💼', label: 'PR案件に回答', reward: '+15〜20', desc: '毎日ホームに1問掲載' },
    { icon: '🔥', label: '7日連続ログイン', reward: '+20', desc: 'ストリークボーナス' },
    { icon: '👋', label: '友達を招待', reward: '+50', desc: '近日実装予定' },
  ];

  return (
    <>
      <AppHeader title="コインウォレット" back onBack={() => go('mypage')} />
      <div className="space-y-4 px-4 pt-3 pb-32">
        {/* 残高 */}
        <section className="rounded-[32px] bg-gradient-to-br from-amber-400 to-orange-400 p-6 shadow-card text-white text-center">
          <p className="text-sm font-black opacity-80">コイン残高</p>
          <p className="mt-1 text-5xl font-black"><CoinIcon size={42} /> {coins.toLocaleString()}</p>
          <p className="mt-2 text-xs font-bold opacity-70">コインを使ってプレミアムコンテンツやシールをゲット！</p>
        </section>

        {/* コイン購入 */}
        <section className="rounded-[28px] bg-white p-5 shadow-card">
          <p className="mb-1 text-sm font-black text-ink">💳 コインを購入する</p>
          <p className="mb-4 text-xs font-bold text-muted">※ 現在はテスト購入（実際の決済は発生しません）</p>
          <div className="space-y-2">
            {COIN_PACKAGES.map((pkg) => (
              <button
                key={pkg.coins}
                onClick={() => onPurchaseCoins(pkg.coins + pkg.bonus)}
                className={`flex w-full items-center justify-between rounded-2xl px-4 py-3.5 transition active:scale-[0.98] ${pkg.popular ? 'bg-gradient-to-r from-amber-400 to-orange-400 shadow-card' : 'bg-base hover:bg-amber-50'}`}
              >
                <div className="flex items-center gap-2 text-left">
                  <CoinIcon size={22} />
                  <div>
                    <p className={`text-sm font-black ${pkg.popular ? 'text-white' : 'text-ink'}`}>
                      {pkg.coins.toLocaleString()}コイン
                      {pkg.bonus > 0 && <span className={`ml-1.5 text-[10px] ${pkg.popular ? 'text-white/80' : 'text-green-500'}`}>+{pkg.bonus}ボーナス</span>}
                    </p>
                    {pkg.popular && <span className="rounded-full bg-white/25 px-2 py-0.5 text-[9px] font-black text-white">人気 No.1</span>}
                  </div>
                </div>
                <span className={`text-base font-black ${pkg.popular ? 'text-white' : 'text-amber-500'}`}>¥{pkg.price.toLocaleString()}</span>
              </button>
            ))}
          </div>
        </section>

        {/* 使い道 */}
        <section className="rounded-[28px] bg-white p-5 shadow-card">
          <p className="mb-3 text-sm font-black text-ink">💎 コインの使い道</p>
          <div className="space-y-2">
            {[
              { icon: '🔒', label: 'プレミアムプロフィール解除', cost: '200' },
              { icon: '🎰', label: 'シールガチャ（1回）', cost: '30〜50' },
              { icon: '🎨', label: 'テーマスキン', cost: '80〜120' },
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
          <p className="mb-3 text-sm font-black text-ink"><CoinIcon size={15} /> コインの稼ぎ方</p>
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
            <p className="mb-3 text-sm font-black text-ink">📋 履歴</p>
            <div className="space-y-2">
              {history.slice(0, 20).map((item, i) => (
                <div key={i} className="flex items-center justify-between border-b border-dashed border-purple/15 py-2 last:border-0">
                  <div>
                    <p className="text-sm font-bold text-ink">{item.reason}</p>
                    <p className="text-[10px] font-bold text-muted">{new Date(item.date).toLocaleDateString('ja-JP')}</p>
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
    </>
  );
}

// ── オンボーディング画面 ────────────────────────────────────────
function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const steps = [
    { emoji: '📖', title: 'お題に答えよう', desc: '毎日届くお題に、プロフィール帳みたいに答えてね。' },
    { emoji: '🎀', title: 'プロフ帳を作ろう', desc: '自分だけのプロフィール帳をデコって、個性を見せよう。' },
    { emoji: '🍀', title: 'なかよくなろう', desc: '共通点をみつけたら、プロフ帳を交換したり日記をいっしょに書いたり。すこしずつ仲良くなろう。' },
  ];
  const [step, setStep] = useState(0);
  const isLast = step === steps.length - 1;

  return (
    <div className="flex h-full flex-col items-center justify-between bg-base px-6 pb-12 pt-16">
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
            <span key={i} className={`h-2 rounded-full transition-all ${i === step ? 'w-6 bg-pink' : 'w-2 bg-purple/20'}`} />
          ))}
        </div>
      </div>

      <div className="w-full space-y-3">
        <button
          onClick={() => isLast ? onDone() : setStep(s => s + 1)}
          className="h-14 w-full rounded-full bg-pink text-base font-black text-white shadow-floating active:scale-[0.98] transition"
        >
          {isLast ? 'はじめる ✨' : 'つぎへ →'}
        </button>
        {!isLast && (
          <button onClick={onDone} className="w-full py-2 text-sm font-black text-muted">
            スキップ
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
  dailyRecord: { date: string; body: string } | null;
  onSubmit: (body: string) => void;
  answers: Answer[];
}) {
  const [body, setBody] = useState('');
  const [ngError, setNgError] = useState(false);
  const revealed = dailyRecord !== null;
  const othersAnswers = answers.filter((a) => a.user.id !== me.id);

  function submit() {
    if (containsNgWord(body)) { setNgError(true); return; }
    if (!body.trim()) return;
    onSubmit(body.trim());
    setBody('');
    setNgError(false);
  }

  return (
    <>
      <AppHeader title="今日のお題" back onBack={() => go('home')} onBell={() => go('notifications')} />
      <div className="space-y-4 px-4 pt-3 pb-32">

        {/* 問題カード */}
        <section className="overflow-hidden rounded-[32px] border border-pink/20 bg-gradient-to-br from-pink/15 via-white to-purple/15 p-5 shadow-card">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-full bg-pink/10 px-3 py-1 text-[10px] font-black text-pink">📅 今日のお題</span>
            <span className="rounded-full bg-base px-3 py-1 text-[10px] font-black text-muted">{question?.category}</span>
          </div>
          <p className="text-lg font-black text-ink leading-relaxed">{question?.title}</p>
        </section>

        {!revealed ? (
          <>
            <section className="rounded-[28px] bg-white p-5 shadow-card">
              <p className="mb-3 text-sm font-black text-ink">✍️ あなたの回答</p>
              <div className="mb-4 rounded-2xl bg-purple/5 px-4 py-3">
                <p className="text-xs font-bold text-muted">🔒 回答するとみんなの答えが見えます</p>
              </div>
              <textarea
                value={body}
                onChange={(e) => { setBody(e.target.value); setNgError(false); }}
                maxLength={200}
                rows={4}
                className="w-full resize-none rounded-3xl border border-pink/20 bg-blue-50/40 p-4 text-sm font-bold outline-none focus:border-pink leading-7"
                placeholder="ここに書いてね..."
              />
              <div className="mt-1 flex items-center justify-between">
                <span className={`text-xs font-bold ${ngError ? 'text-red-500' : 'text-transparent'}`}>
                  この内容は投稿できません
                </span>
                <span className="text-xs font-bold text-muted">{body.length}/200</span>
              </div>
            </section>
            <button
              onClick={submit}
              disabled={!body.trim()}
              className={`h-14 w-full rounded-full text-base font-black text-white shadow-floating transition ${body.trim() ? 'bg-pink active:scale-[0.98]' : 'bg-muted/30'}`}
            >
              回答してみんなの答えを見る 🔓
            </button>
          </>
        ) : (
          <>
            {/* 自分の回答 */}
            <section className="rounded-[28px] border-2 border-pink/30 bg-white p-5 shadow-card">
              <div className="mb-3">
                <span className="rounded-full bg-pink/10 px-3 py-1 text-[10px] font-black text-pink">✅ あなたの回答</span>
              </div>
              <p className="text-sm font-bold text-ink leading-6">{dailyRecord.body}</p>
            </section>

            {/* みんなの回答 */}
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-ink">みんなの回答</h2>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-muted shadow-card">{othersAnswers.length}件</span>
            </div>
            {othersAnswers.length === 0 ? (
              <div className="rounded-[28px] bg-white p-8 text-center text-sm font-bold text-muted shadow-card">
                まだ誰も答えていないよ、一番乗り！
              </div>
            ) : (
              <div className="space-y-3">
                {othersAnswers.map((answer) => (
                  <button
                    key={answer.id}
                    onClick={() => go('detail', answer.id)}
                    className="w-full rounded-[28px] bg-white p-4 text-left shadow-card transition active:scale-[0.98]"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-pink/10 text-lg">{answer.user.avatar}</span>
                      <div>
                        <p className="text-sm font-black text-ink">{answer.user.name}</p>
                        <p className="text-[10px] font-bold text-muted">{answer.user.id}</p>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-ink leading-6">{answer.body}</p>
                    <div className="mt-3 flex gap-4">
                      {(['like','same','wakaru','natsukashii'] as const).map((k) => (
                        <span key={k} className="text-xs font-bold text-muted">
                          {k === 'like' ? '💗' : k === 'same' ? '✋' : k === 'wakaru' ? '😭' : '🥹'} {answer.reactions[k]}
                        </span>
                      ))}
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
  const saved = answers.filter(a => bookmarks.includes(a.id));
  return (
    <>
      <AppHeader title="ブックマーク" back onBack={() => go('mypage')} onBell={() => go('notifications')} />
      <div className="space-y-3 px-4 pt-3 pb-32">
        {saved.length === 0 ? (
          <div className="mt-10 flex flex-col items-center gap-4 text-center">
            <span className="text-5xl">🔖</span>
            <p className="font-black text-ink">保存した回答がここに表示されます</p>
            <p className="text-sm font-bold text-muted">回答詳細のブックマークボタンで保存できます</p>
          </div>
        ) : saved.map(answer => (
          <button key={answer.id} onClick={() => go('detail', answer.id)}
            className="block w-full text-left">
            <AnswerCard answer={answer} />
          </button>
        ))}
      </div>
    </>
  );
}

export default function Page() {
  const [ready, setReady] = useState(isDev);

  useEffect(() => {
    if (isDev) return;
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

  const localizedQuestions = useMemo(() => getQuestionsForLang(lang), [lang]);

  const [translatedAnswerBodies, setTranslatedAnswerBodies] = useState<Record<string, string>>({});
  const [isTranslating, setIsTranslating] = useState(false);

  // 言語切り替え時にフィード上の回答を自動翻訳
  useEffect(() => {
    if (lang === 'ja') { setTranslatedAnswerBodies({}); return; }
    let cancelled = false;
    setIsTranslating(true);
    (async () => {
      const targets = initialAnswers.slice(0, 12);
      const pairs: [string, string][] = [];
      for (const a of targets) {
        if (cancelled) break;
        const txt = await translateText(a.body, lang);
        pairs.push([a.id, txt]);
      }
      if (!cancelled) {
        setTranslatedAnswerBodies(Object.fromEntries(pairs));
        setIsTranslating(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

const [selectedQuestion, setSelectedQuestion] = useState<any>(null);

  const [screen, setScreen] = useState<Screen>(() => {
    if (typeof window === 'undefined') return 'home';
    return localStorage.getItem('miri_onboarded') ? 'home' : 'onboarding';
  });
  const [selectedAnswerId, setSelectedAnswerId] = useState(initialAnswers[0]?.id ?? '');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answer[]>(initialAnswers);
  const selectedAnswer = answers.find((a) => a.id === selectedAnswerId) || answers[0];

  // ── 今日のお題（言語に応じて切り替わる）────────────────────────
  const dailyQuestion = useMemo(() => {
    const today = new Date().toDateString();
    let h = 0;
    for (let i = 0; i < today.length; i++) h = Math.imul(31, h) + today.charCodeAt(i) | 0;
    return localizedQuestions[Math.abs(h) % localizedQuestions.length];
  }, [localizedQuestions]);

  const [dailyRecord, setDailyRecord] = useState<{ date: string; body: string } | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const s = localStorage.getItem('miri_daily_answer');
      if (!s) return null;
      const r = JSON.parse(s) as { date: string; body: string };
      return r.date === new Date().toISOString().slice(0, 10) ? r : null;
    } catch { return null; }
  });

  function submitDailyAnswer(body: string) {
    const record = { date: new Date().toISOString().slice(0, 10), body };
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

  // ── ログインユーザーのSupabaseプロフィールを読み込み、me・プロフィール帳へ反映 ──
  // （production で Supabase が設定されているときのみ。dev/未設定では従来どおり）
  const [, setMeVersion] = useState(0);
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

    // ② Supabase から正式なプロフィールを読み込んで上書き（あれば）
    if (!dbReady()) return;
    let cancelled = false;
    (async () => {
      const p = await getMyProfile();
      if (cancelled || !p) return;
      me.id = '@' + p.username;
      me.name = p.display_name;
      me.isOfficial = !!p.is_official;
      // プロフィール帳を Supabase から復元（端末を変えても引き継ぐ）
      if (p.book && typeof p.book === 'object' && Object.keys(p.book).length > 0) {
        setProfileBookInfo((prev: typeof defaultProfileBookInfo) => ({ ...prev, ...(p.book as any) }));
      }
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
  setAvatarUrl(url);
  if (url) localStorage.setItem('avatarUrl', url);
  else localStorage.removeItem('avatarUrl');
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
    if (typeof window === 'undefined') return 500;
    const s = localStorage.getItem('miri_coins');
    return s ? Number(s) : 500;
  });

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
    if (theme) addNotification('🎠', `新しい背景「${theme.name}」をゲットしました！`);
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
    showToast(`✨ かけらで「${theme.name}」と交換しました！`);
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
    if (!spendCoins(item.price)) { showToast('コインがたりないよ 🥲'); return; }
    setOwnedThemeIds((prev) => {
      const next = [...prev, id];
      localStorage.setItem('miri_owned_themes', JSON.stringify(next));
      return next;
    });
    showToast(`「${item.name}」を購入しました！`);
    addNotification('🎨', `カラーテーマ「${item.name}」を購入しました`);
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
    showToast('📖 プロフ帳を交換しました！なかよし度アップ 💗');
  }

  function purchasePack(packId: string) {
    setOwnedPackIds((prev) => {
      const next = [...prev, packId];
      localStorage.setItem('miri_owned_packs', JSON.stringify(next));
      return next;
    });
    showToast('✨ スタンプを購入しました！');
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

  // ── 通知設定 ────────────────────────────────────────────────
  const [notifyOdai, setNotifyOdai] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('miri_notify_odai') === 'true';
  });

  function toggleNotifyOdai(val: boolean) {
    if (val) {
      if (typeof Notification === 'undefined' || Notification.permission === 'denied') {
        showToast('通知がブロックされています。ブラウザの設定から許可してください。');
        return;
      }
      Notification.requestPermission().then((perm) => {
        const granted = perm === 'granted';
        setNotifyOdai(granted);
        localStorage.setItem('miri_notify_odai', String(granted));
        if (!granted) showToast('通知の許可が必要です。ブラウザ設定で許可してください。');
        else showToast('🔔 お題通知をオンにしました');
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
    new Notification('✿ Miri — 今日のお題', { body: dailyQuestion?.title ?? '', tag: 'miri-daily' });
    localStorage.setItem('miri_last_notified_odai', today);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifyOdai, dailyQuestion]);

  // デイリーログインボーナス
  useEffect(() => {
    const today = new Date().toDateString();
    const last = localStorage.getItem('miri_daily_login');
    if (last === today) return;
    localStorage.setItem('miri_daily_login', today);
    const streak = parseInt(localStorage.getItem('miri_streak') || '0') + 1;
    localStorage.setItem('miri_streak', String(streak));
    const bonus = streak >= 7 ? 20 : 0;
    const total = 3 + bonus;
    addCoins(total, streak >= 7 ? `7日連続ログイン（${streak}日目）` : 'デイリーログイン');
    setTimeout(() => {
      showToast(`🎁 +${total}コイン デイリーログインボーナス！${streak >= 7 ? `（${streak}日連続！）` : ''}`);
      addNotification('🎁', `デイリーログインボーナスで ${total} コインもらいました${streak >= 7 ? `（${streak}日連続！）` : ''}`);
    }, 800);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      showToast('コインが足りません（200枚必要）');
      return;
    }
    setSubscribedOfficials((prev) => {
      const next = [...prev, userId];
      localStorage.setItem('miri_subscribed_officials', JSON.stringify(next));
      return next;
    });
    showToast('✨ プレミアムコンテンツが解放されました！');
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

function createCircle(name: string, emoji: string, memberIds: string[], opts?: { isOfficial?: boolean; allowFans?: boolean }): string {
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

function postToCircle(circleId: string, body: string, opts?: { audience?: 'members' | 'everyone'; kind?: 'talk' | 'vote' }) {
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
  const next = circlePosts.map((p) => p.id === postId
    ? { ...p, replies: [...p.replies, { userId: me.id, userName: me.name, userAvatar: me.avatar, body, postedAt: new Date().toISOString() }] }
    : p);
  setCirclePosts(next);
  localStorage.setItem('circlePosts', JSON.stringify(next));
}

function voteInCirclePost(postId: string, targetId: string) {
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
  showToast('🎫 ファン参加を申請しました！承認をまってね');
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
  showToast('✅ ファン参加を承認しました');
}

function rejectFan(circleId: string, userId: string) {
  updateCircles(circles.map((c) => {
    if (c.id !== circleId) return c;
    return { ...c, pendingFanIds: (c.pendingFanIds ?? []).filter((id) => id !== userId) };
  }));
  showToast('申請を見送りました');
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

function updateProfileBookInfo(next: typeof defaultProfileBookInfo) {
  setProfileBookInfo(next);
  localStorage.setItem('profileBookInfo', JSON.stringify(next));
  // Supabase にも保存（永続化・端末間で引き継ぎ）。best-effort。
  if (dbReady()) { void saveProfileBook(next as any); }
}

// ログアウト：Supabaseセッション破棄＋認証クッキー削除＋端末内のユーザーデータ消去
async function logout() {
  try { await signOut(); } catch {}
  try {
    document.cookie = 'miri_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict';
  } catch {}
  try {
    // 次のユーザーに前のユーザーのプロフィール等が残らないよう消す
    [
      'miri_username', 'miri_displayname', 'miri_realname', 'miri_lastname', 'miri_firstname',
      'profileBookInfo', 'best3', 'profileQuestions', 'profileCustomFields',
      'avatarUrl', 'favoritePhotos', 'miri_onboarded',
    ].forEach((k) => localStorage.removeItem(k));
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
}

const [profileQuestions, setProfileQuestions] = useState(() => {
  if (typeof window === 'undefined') return defaultProfileQuestions;
  try { const saved = localStorage.getItem('profileQuestions'); return saved ? JSON.parse(saved) : defaultProfileQuestions; } catch { return defaultProfileQuestions; }
});

function updateProfileQuestions(next: typeof defaultProfileQuestions) {
  setProfileQuestions(next);
  localStorage.setItem('profileQuestions', JSON.stringify(next));
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

  // ── トースト ──────────────────────────────────────────────────
  const [toasts, setToasts] = useState<ToastItem[]>([]);
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

  function addNotification(icon: string, text: string) {
    setNotifications((prev) => {
      const next = [{ id: Date.now() + Math.random(), icon, text, at: Date.now() }, ...prev].slice(0, 50);
      localStorage.setItem('miri_notifications', JSON.stringify(next));
      return next;
    });
  }

  // ── ブックマーク ──────────────────────────────────────────────
  const [bookmarks, setBookmarks] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try { const saved = localStorage.getItem('miri_bookmarks'); return saved ? JSON.parse(saved) : []; } catch { return []; }
  });
  function toggleBookmark(id: string) {
    setBookmarks(prev => {
      const next = prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id];
      localStorage.setItem('miri_bookmarks', JSON.stringify(next));
      showToast(prev.includes(id) ? 'ブックマークを解除しました' : '💾 ブックマークに保存しました');
      return next;
    });
  }

  // ── シェア ────────────────────────────────────────────────────
  function shareText(text: string) {
    if (navigator.share) {
      navigator.share({ text, url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => showToast('📋 クリップボードにコピーしました'));
    }
  }

  // ── オンボーディング完了 ──────────────────────────────────────
  function completeOnboarding() {
    localStorage.setItem('miri_onboarded', '1');
    setScreen('home');
  }

  function go(next: Screen, payload?: any) {
  setScreen(next);

  if (next === 'detail' && payload) {
    setSelectedAnswerId(payload);
  }

  if (next === 'create' && payload) {
    setSelectedQuestion(payload);
  }

  if (next === 'profile') {
    setSelectedProfileId(payload && payload !== me.id ? payload : null);
  }

  if (next === 'diary-detail' && payload) {
    setSelectedDiaryId(payload);
  }

  if (next === 'circle-detail' && payload) {
    setSelectedCircleId(payload);
  }
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
    user: { name: me.name, id: me.id, avatar: me.avatar },
    reactions: { like: 0, same: 0, wakaru: 0, natsukashii: 0 },
  };

  setAnswers((prev) => [newAnswer, ...prev]);

  // PR案件への回答かチェック
  if (draft.questionId.startsWith('pr-')) {
    const reward = prQuestion.id === draft.questionId ? prQuestion.reward : 15;
    addCoins(reward, `PR案件回答（${prQuestion.brand}）`);
    markPRAnswered();
    setHasAnsweredPR(true);
    showToast(`🎁 +${reward}コイン PR案件ボーナス獲得！`);
    addNotification('💼', `PR案件に回答して ${reward} コインもらいました`);
  } else {
    addCoins(5, 'お題に回答');
    showToast('🎁 +5コイン 回答ボーナス！');
    addNotification('✍️', 'お題に回答して 5 コインもらいました');
  }

  return id;
}

  function react(answerId: string, type: keyof Answer['reactions'], prev: keyof Answer['reactions'] | null) {
    setAnswers((answers) => answers.map((a) => {
      if (a.id !== answerId) return a;
      const r = { ...a.reactions };
      if (prev) r[prev] = Math.max(0, r[prev] - 1);     // 前のリアクションを -1
      if (type !== prev) r[type] = r[type] + 1;         // 新しいリアクションを +1（トグル解除時はスキップ）
      return { ...a, reactions: r };
    }));
  }

  const [diaryPages, setDiaryPages] = useState<DiaryPage[]>(initialDiaryPages);
  const [selectedDiaryId, setSelectedDiaryId] = useState<string>(initialDiaryPages[0]?.id ?? '');

  const selectedDiary = diaryPages.find((p) => p.id === selectedDiaryId) ?? diaryPages[0];

  function createDiaryPage(
    theme: string,
    description: string,
    firstEntryBody: string,
    firstPhotoUrl: string,
    visibility: 'public' | 'followers' | 'mentioned',
    mentionedUserIds: string[],
    font?: string,
    textColor?: string
  ): string {
    const id = `diary-${Date.now()}`;
    const firstEntry: DiaryEntry | null = firstEntryBody.trim() || firstPhotoUrl
      ? { id: `entry-${Date.now()}`, authorId: me.id, authorName: me.name, authorAvatar: me.avatar, body: firstEntryBody.trim(), photoUrl: firstPhotoUrl || undefined, font, textColor, postedAt: new Date().toISOString() }
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

  function addDiaryEntry(pageId: string, body: string, photoUrl?: string, font?: string, textColor?: string) {
    const entry: DiaryEntry = {
      id: `entry-${Date.now()}`,
      authorId: me.id,
      authorName: me.name,
      authorAvatar: me.avatar,
      body,
      photoUrl: photoUrl || undefined,
      font,
      textColor,
      postedAt: new Date().toISOString(),
    };
    setDiaryPages((prev) =>
      prev.map((p) => p.id === pageId ? { ...p, entries: [...p.entries, entry] } : p)
    );
  }

  function editDiaryEntry(pageId: string, entryId: string, body: string, photoUrl?: string) {
    setDiaryPages((prev) =>
      prev.map((p) => p.id === pageId
        ? { ...p, entries: p.entries.map((e) => e.id === entryId ? { ...e, body, photoUrl: photoUrl || undefined } : e) }
        : p
      )
    );
  }

  function deleteDiaryEntry(pageId: string, entryId: string) {
    setDiaryPages((prev) =>
      prev.map((p) => p.id === pageId ? { ...p, entries: p.entries.filter((e) => e.id !== entryId) } : p)
    );
  }

  function reportDiaryEntry(_pageId: string, _entryId: string) {
    // 実装時はサーバーへ報告を送る。現状はUI側で「報告済み」表示のみ。
  }

  const current = useMemo(() => {

    if (screen === 'settings')
  return (
    <ProfileEditScreen
      go={go}
      profileBookInfo={profileBookInfo}
      best3={best3}
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
    />
  );

  if (screen === 'official-question-create')
  return (
    <OfficialQuestionCreateScreen
      go={go}
      onCreate={createCommunityQuestion}
    />
  );
    
    if (screen === 'wallet') return <WalletScreen go={go} coins={coins} onPurchaseCoins={(amount) => { addCoins(amount, 'コイン購入'); addNotification('💳', `コインを ${amount} 枚購入しました`); }} />;
    if (screen === 'circles') return <CirclesScreen go={go} circles={circles} circlePosts={circlePosts} />;
    if (screen === 'circle-create') return <CircleCreateScreen go={go} onCreate={createCircle} />;
    if (screen === 'circle-detail') {
      const circle = circles.find((c) => c.id === selectedCircleId);
      if (circle) return <CircleDetailScreen go={go} circle={circle} posts={circlePosts.filter((p) => p.circleId === circle.id)} onPost={postToCircle} onReply={replyToCirclePost} onVote={voteInCirclePost} onApplyFan={applyAsFan} onApproveFan={approveFan} onRejectFan={rejectFan} />;
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
      circles={circles}
      circlePosts={circlePosts}
      dailyQuestion={dailyQuestion}
      hasAnsweredToday={dailyRecord !== null}
      prQuestion={prQuestion}
      hasAnsweredPR={hasAnsweredPR}
      translatedAnswerBodies={translatedAnswerBodies}
      isTranslating={isTranslating}
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
        />
      );
    if (screen === 'search') return <SearchScreen go={go} answers={answers} myProfile={profileBookInfo} />;
    if (screen === 'create')
  return (
    <CreateScreen
      go={go}
      onPost={postAnswer}
      question={selectedQuestion}
      onCreateDiary={(caption, photoUrl, font, textColor, visibility, mentionedUserIds) =>
        createDiaryPage(caption.slice(0, 20) || '思い出の1ページ', '', caption, photoUrl, visibility, mentionedUserIds, font, textColor)
      }
      ownedPackIds={ownedPackIds}
      ownedGachaStickers={ownedGachaStickers}
    />
  );
    if (screen === 'profile') {
      if (selectedProfileId) {
        const otherProfile = [...profiles, ...followers].find((p) => p.id === selectedProfileId);
        if (otherProfile) return <OtherProfileScreen go={go} profile={otherProfile} answers={answers} subscribedOfficials={subscribedOfficials} onToggleSubscription={toggleSubscription} myProfile={profileBookInfo} diaryPages={diaryPages} circles={circles} exchanged={exchangedProfiles.includes(otherProfile.id)} onExchange={exchangeProfileBook} lang={lang} />;
      }
      return <ProfileScreen
        go={go}
        profileBookInfo={profileBookInfo}
        best3={best3}
        profileQuestions={profileQuestions}
        avatarUrl={avatarUrl}
        favoritePhotos={favoritePhotos}
        customFields={profileCustomFields}
        equippedBg={getBgTheme(equippedBgId)}
        lang={lang}
      />;
    }
    if (screen === 'onboarding') return <OnboardingScreen onDone={completeOnboarding} />;
    if (screen === 'detail' && selectedAnswer) return (
      <DetailScreen
        go={go}
        answer={selectedAnswer}
        onReact={react}
        isBookmarked={bookmarks.includes(selectedAnswer.id)}
        onToggleBookmark={toggleBookmark}
        onShare={shareText}
      />
    );
    if (screen === 'bookmarks') return (
      <BookmarksScreen go={go} answers={answers} bookmarks={bookmarks} onToggleBookmark={toggleBookmark} />
    );
    if (screen === 'notifications') return <NotificationsScreen go={go} notifications={notifications} />;
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

return <ProfileScreen
  go={go}
  profileBookInfo={profileBookInfo}
  best3={best3}
  profileQuestions={profileQuestions}
  avatarUrl={avatarUrl}
  favoritePhotos={favoritePhotos}
  equippedBg={getBgTheme(equippedBgId)}
/>;
 }, [
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
  selectedProfileId,
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
    <>
      <DesktopShell active={active} currentScreen={screen} go={go} answers={answers} avatarUrl={avatarUrl} ownedStickerCount={ownedStickerCount} lang={lang} bgTheme={getBgTheme(equippedBgId)} translatedAnswerBodies={translatedAnswerBodies}>{current}</DesktopShell>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
