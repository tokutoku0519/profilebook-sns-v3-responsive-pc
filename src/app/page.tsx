'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Bell, Bookmark, Home, Plus, Search, Settings, Share2, ShoppingBag, UserRound } from 'lucide-react';
import { ToastContainer, ToastItem } from '@/components/Toast';
import { BottomTab, type TabKey } from '@/components/BottomTab';
import { AnswerCard, ProfileCard, QuestionCard, SectionHeader } from '@/components/Cards';
import { RetroEmojiPicker, RetroFlower, RetroHeart, RetroMiniStar, RetroNote, RetroRibbon, RetroStar, RetroText, insertRetroCode } from '@/components/RetroEmoji';
import { answers as initialAnswers, profiles, questions } from '@/lib/mock';

type Screen = 'home' | 'search' | 'create' | 'profile' | 'detail' | 'mypage' | 'notifications' | 'followers' | 'settings' | 'official-question-create' | 'diary-list' | 'diary-detail' | 'diary-create' | 'circles' | 'circle-detail' | 'circle-create' | 'shop' | 'onboarding' | 'bookmarks';
type Question = (typeof questions)[number];
type Answer = (typeof initialAnswers)[number];
type Profile = (typeof profiles)[number];

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
const followers = [
  { name: 'まゆ', id: '@mayu_note', avatar: '🎀', bio: '平成女児の残党。甘いものと夜散歩。', common: '揚げパン派' },
  { name: 'りん', id: '@rin_puri', avatar: '🌙', bio: '懐かしいものを集めています。', common: '夜型' },
  { name: 'なな', id: '@nana_7', avatar: '🧸', bio: 'シールと喫茶店が好き。', common: 'インドア派' },
  { name: 'はる', id: '@haru_cafe', avatar: '☕️', bio: '喫茶店と散歩が好き。', common: 'カフェ巡り派' },
  { name: 'ゆい', id: '@yui_book', avatar: '📚', bio: 'プロフィール帳世代です。', common: '文房具好き' },
  { name: 'あかり', id: '@akari_28', avatar: '🍒', bio: 'かわいいもの収集中。', common: 'シール派' },
];

const defaultProfileBookInfo = {
  name: 'Koki',
  nickname: 'こうき',
  birthday: '5月19日',
  bloodType: 'A型',
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

const defaultBest3 = {
  tv: ['水曜日のダウンタウン', 'あちこちオードリー', 'YouTube'],
  food: ['オムライス', '揚げパン', '喫茶店のプリン'],
  places: ['喫茶店', 'ライブハウス', '海沿いの街'],
  music: ['宇多田ヒカル', '椎名林檎', 'Superfly'],
};

const defaultProfileQuestions = [
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

type ProfileBook = {
  info: Omit<typeof defaultProfileBookInfo, 'attribute' | 'activity'> & { attribute?: string; activity?: string };
  best3: { tv: string[]; food: string[]; places: string[]; music: string[] };
  questions: Array<{ q: string; a: string }>;
  themeColor: 'pink' | 'purple' | 'blue' | 'green' | 'orange';
};

const mockProfileBooks: Record<string, ProfileBook> = {
  '@mayu_note': {
    themeColor: 'pink',
    info: {
      name: 'まゆ', nickname: 'まゆにゃん', birthday: '3月3日（ひな祭り！）',
      bloodType: 'B型', mbti: 'ISFJ', hometown: '神奈川',
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
  },
  '@rin_puri': {
    themeColor: 'purple',
    info: {
      name: 'りん', nickname: 'りんりん', birthday: '11月11日（ポッキーの日！）',
      bloodType: 'A型', mbti: 'INFP', hometown: '京都',
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
  },
  '@nana_7': {
    themeColor: 'blue',
    info: {
      name: 'なな', nickname: 'なな・7ちゃん', birthday: '7月7日（七夕！）',
      bloodType: 'O型', mbti: 'ESFP', hometown: '大阪',
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
      bloodType: 'AB型', mbti: 'ISFP', hometown: '神戸',
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
      bloodType: 'A型', mbti: 'INTJ', hometown: '埼玉',
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
      bloodType: 'B型', mbti: 'ESFJ', hometown: '福岡',
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
};

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
  { id: 'default',    name: 'ピンク',       emoji: '🌸', preview: '#F58DB2' },
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

// プロフィールの共通点フィールド定義（マッチングに使用）
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

const initialDiaryPages: DiaryPage[] = [
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
];

const initialCircles: Circle[] = [
  { id: 'circle-1', name: 'ダンスサークル', emoji: '🕺', memberIds: ['@koki', '@mayu_note', '@nana_7', '@akari_28'], createdBy: '@koki' },
  { id: 'circle-2', name: '写真好き集まれ', emoji: '📸', memberIds: ['@koki', '@rin_puri', '@haru_cafe'], createdBy: '@rin_puri' },
  { id: 'circle-3', name: '深夜散歩部', emoji: '🌙', memberIds: ['@koki', '@haru_cafe', '@yui_book', '@rin_puri'], createdBy: '@koki' },
];

const initialCirclePosts: CirclePost[] = [
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
];

function tabFromScreen(screen: Screen): TabKey {
  if (screen === 'search') return 'search';
  if (screen === 'create') return 'create';
  if (screen === 'mypage' || screen === 'followers' || screen === 'settings' || screen === 'official-question-create' || screen === 'shop') return 'mypage';
  if (screen === 'notifications') return 'notifications';
  if (screen === 'diary-list' || screen === 'diary-detail' || screen === 'diary-create') return 'home';
  if (screen === 'circles' || screen === 'circle-detail' || screen === 'circle-create') return 'home';
  return 'home';
}

function Phone({ children, active, go }: { children: React.ReactNode; active: TabKey; go: (s: Screen) => void }) {
  return (
    <main className="relative mx-auto h-[844px] w-full max-w-[390px] overflow-hidden bg-base text-ink shadow-2xl shadow-purple/10 sm:rounded-[36px] sm:border sm:border-white/70 lg:mx-0 lg:h-[calc(100vh-48px)] lg:max-w-none lg:rounded-[32px]">
      <div className="h-full overflow-y-auto pb-28 lg:pb-8">{children}</div>
      <div className="lg:hidden"><BottomTab active={active} onChange={(key) => go(key === 'notifications' ? 'notifications' : key)} /></div>
    </main>
  );
}

function DesktopNav({ active, go }: { active: TabKey; go: (s: Screen) => void }) {
  const items: { key: TabKey; label: string; icon: any; screen: Screen }[] = [
    { key: 'home', label: 'ホーム', icon: Home, screen: 'home' },
    { key: 'search', label: 'さがす', icon: Search, screen: 'search' },
    { key: 'create', label: 'お題に答える', icon: Plus, screen: 'create' },
    { key: 'notifications', label: '通知', icon: Bell, screen: 'notifications' },
    { key: 'mypage', label: 'マイページ', icon: UserRound, screen: 'mypage' }
  ];
  return (
    <aside className="hidden h-[calc(100vh-48px)] w-[260px] shrink-0 rounded-[32px] border border-white/70 bg-white/80 p-5 shadow-card backdrop-blur lg:block">
      <div className="mb-8 flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-pink shadow-card overflow-hidden"><img src="/icon.png" alt="Miri" className="h-full w-full object-cover" /></div><div><p className="flex items-center gap-1.5 text-xl font-black">Miri<RetroMiniStar /></p><p className="text-xs font-bold text-muted">Profile Book SNS</p></div></div>
      <nav className="space-y-2">
        {items.map((item) => { const Icon = item.icon; const isActive = active === item.key; return (
          <button key={item.key} onClick={() => go(item.screen)} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black transition ${isActive ? 'bg-pink text-white shadow-floating' : 'text-muted hover:bg-pink/10 hover:text-ink'}`}>
            <Icon size={20} />{item.label}
          </button>
        ); })}
      </nav>
      <div className="mt-4 space-y-2">
        <button
          onClick={() => go('shop')}
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black text-muted transition hover:bg-pink/10 hover:text-ink"
        >
          <ShoppingBag size={20} />ショップ
        </button>
        <button
          onClick={() => go('circles')}
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black text-muted transition hover:bg-pink/10 hover:text-ink"
        >
          <span className="text-base">🔒</span>サークル
        </button>
        <button
          onClick={() => go('followers')}
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black text-muted transition hover:bg-pink/10 hover:text-ink"
        >
          <UserRound size={20} />フォロー中
        </button>
        <button
          onClick={() => go('settings')}
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black text-muted transition hover:bg-pink/10 hover:text-ink"
        >
          <Settings size={20} />設定・プロフ編集
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

function RightRail({ answers, go, avatarUrl }: { answers: Answer[]; go: (s: Screen, answerId?: string) => void; avatarUrl: string }) {
  const myAnswers = answers.filter((a) => a.user.id === me.id);
  return (
    <aside className="hidden h-[calc(100vh-48px)] w-[320px] shrink-0 overflow-y-auto rounded-[32px] border border-white/70 bg-white/70 p-5 shadow-card backdrop-blur xl:block">
      <section className="cursor-pointer rounded-[28px] bg-white p-4 shadow-card transition hover:bg-pink/5 active:scale-[0.99]" onClick={() => go('profile')}>
        <div className="flex items-center gap-3"><div className="grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-pink/15 text-2xl">{avatarUrl ? <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" /> : me.avatar}</div><div><p className="font-black">{me.name}</p><p className="text-xs font-bold text-muted">{me.id}</p></div></div>
        <div className="mt-4 grid grid-cols-3 rounded-3xl bg-base p-3 text-center text-xs font-bold">
          <div><p className="text-lg text-ink">{myAnswers.length}</p>回答</div>
          <button onClick={(e) => { e.stopPropagation(); go('followers'); }} className="hover:text-pinkStrong transition"><p className="text-lg text-ink">38</p>フォロワー</button>
          <div><p className="text-lg text-ink">8</p>シール</div>
        </div>
      </section>
      <section className="mt-5 rounded-[28px] bg-white p-4 shadow-card">
        <SectionHeader title="人気の回答" />
        <div className="space-y-3">{answers.slice(0,3).map((answer) => <button key={answer.id} onClick={() => go('detail', answer.id)} className="block w-full rounded-2xl bg-base p-3 text-left text-xs font-bold leading-5 hover:bg-pink/10"><span className="text-pinkStrong">{answer.question.category}</span><br />{answer.body.slice(0,42)}...</button>)}</div>
      </section>
      <section className="mt-5 rounded-[28px] bg-white p-4 shadow-card">
        <SectionHeader title="おすすめユーザー" />
        <div className="space-y-3">{profiles.slice(0,3).map((profile) => <button key={profile.id} onClick={() => go('profile', profile.id)} className="flex w-full items-center gap-3 rounded-2xl bg-base p-3 text-left hover:bg-pink/10"><span className="grid h-10 w-10 place-items-center rounded-full bg-white text-xl">{profile.avatar}</span><span><b className="text-sm">{profile.name}</b><br /><span className="text-xs text-muted">{profile.common}</span></span></button>)}</div>
      </section>
    </aside>
  );
}

function DesktopShell({ children, active, go, answers, avatarUrl }: { children: React.ReactNode; active: TabKey; go: (s: Screen, answerId?: string) => void; answers: Answer[]; avatarUrl: string }) {
  return (
    <div className="min-h-screen bg-purple/25 p-0 sm:p-8 lg:p-6">
      <div className="mx-auto flex max-w-[1280px] gap-5">
        <DesktopNav active={active} go={go} />
        <div className="min-w-0 flex-1"><Phone active={active} go={go}>{children}</Phone></div>
        <RightRail answers={answers} go={go} avatarUrl={avatarUrl} />
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

function HomeScreen({
  go,
  answers,
  communityQuestions,
  diaryPages,
  circles,
  circlePosts,
}: {
  go: (s: Screen, payload?: any) => void;
  answers: Answer[];
  communityQuestions: any[];
  diaryPages: DiaryPage[];
  circles: Circle[];
  circlePosts: CirclePost[];
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
      <button
        key={q.id}
        onClick={() => go('create', q)}
        className="w-full rounded-[24px] bg-white p-4 text-left shadow-card active:scale-[0.99]"
      >
        <div className="mb-2 flex items-center gap-2">
          <OfficialBadge />
          <span className="text-xs font-black text-muted">
            {q.createdByName} が作成
          </span>
        </div>

        <p className="text-base font-black text-ink">
          {q.title}
        </p>

        <p className="mt-1 text-xs font-bold text-muted">
          {q.description}
        </p>
      </button>
    ))}
  </section>
)}

        <section className="relative">
          <span className="pointer-events-none absolute -right-1 -top-3 z-10"><RetroStar /></span>
          <SectionHeader title="今日のお題" action="答える" onAction={() => go('create')} />
          <button onClick={() => go('create')} className="block w-full text-left"><QuestionCard question={questions[0]} hero /></button>
        </section>
        <section className="relative">
          <span className="pointer-events-none absolute right-20 -top-2 z-10"><RetroNote /></span>
          <SectionHeader title="いま盛り上がってる回答" action="もっと見る" onAction={() => go('search')} />
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
            {answers.map((answer) => (
              <button key={answer.id} onClick={() => go('detail', answer.id)} className="min-w-[288px] text-left transition active:scale-[0.98]">
                <AnswerCard answer={answer} />
              </button>
            ))}
          </div>
        </section>
        <section>
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-lg font-black text-ink"><RetroHeart scale={0.85} />交換日記</h2>
            <button onClick={() => go('diary-list')} className="text-xs font-black text-pink">もっと見る</button>
          </div>
          <div className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-2">
            {diaryPages.slice(0, 5).map((page) => (
              <button key={page.id} onClick={() => go('diary-detail', page.id)} className="min-w-[220px] rounded-[24px] bg-gradient-to-br from-pink/10 via-white to-purple/10 p-4 text-left shadow-card active:scale-[0.98]">
                <p className="font-black text-ink">{page.theme}</p>
                <p className="mt-1 line-clamp-2 text-xs font-bold text-muted">{page.description}</p>
                <p className="mt-3 text-xs font-black text-pink">✍ {page.entries.length}件の書き込み</p>
              </button>
            ))}
            <button onClick={() => go('diary-create')} className="grid min-w-[110px] place-items-center rounded-[24px] border border-dashed border-pink/40 bg-white px-4 text-sm font-black text-pink shadow-card active:scale-[0.98]">
              ＋ 作る
            </button>
          </div>
        </section>
        {circles.length > 0 && (
          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-ink">🔒 サークル</h2>
              <button onClick={() => go('circles')} className="text-xs font-black text-pink">すべて見る</button>
            </div>
            <div className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-2">
              {circles.map((c) => {
                const latest = circlePosts.filter((p) => p.circleId === c.id).slice(-1)[0];
                return (
                  <button key={c.id} onClick={() => go('circle-detail', c.id)}
                    className="min-w-[200px] rounded-[24px] bg-gradient-to-br from-purple/10 via-white to-pink/10 p-4 text-left shadow-card active:scale-[0.98]">
                    <p className="text-2xl">{c.emoji}</p>
                    <p className="mt-1 font-black text-ink">{c.name}</p>
                    <p className="mt-0.5 text-[11px] font-bold text-muted">{c.memberIds.length}人</p>
                    {latest && <p className="mt-2 line-clamp-1 text-xs font-bold text-muted">「{latest.body.slice(0, 18)}…」</p>}
                  </button>
                );
              })}
              <button onClick={() => go('circle-create')}
                className="grid min-w-[100px] place-items-center rounded-[24px] border border-dashed border-pink/40 bg-white px-4 text-sm font-black text-pink shadow-card active:scale-[0.98]">
                ＋ 作る
              </button>
            </div>
          </section>
        )}
        <section className="relative">
          <span className="pointer-events-none absolute -right-1 -top-3 z-10"><RetroFlower /></span>
          <SectionHeader title="新着プロフィール帳" action="見る" onAction={() => go('search')} />
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
            {profiles.map((profile) => (
              <button key={profile.id} onClick={() => go('profile', profile.id)} className="text-left transition active:scale-[0.98]">
                <ProfileCard profile={profile} />
              </button>
            ))}
          </div>
        </section>
        <section>
          <SectionHeader title="今週のコラボお題" />
          <button onClick={() => go('create')} className="block w-full text-left"><QuestionCard question={questions[2]} /></button>
        </section>
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
  const filteredAnswers = answers.filter((a) => `${a.body} ${a.question.title} ${a.user.name}`.toLowerCase().includes(query.toLowerCase()));
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
          <button onClick={() => setMode('person')} className={`rounded-full py-2 ${mode === 'person' ? 'bg-pink text-white' : 'text-muted'}`}>人</button>
          <button onClick={() => setMode('question')} className={`rounded-full py-2 ${mode === 'question' ? 'bg-pink text-white' : 'text-muted'}`}>お題</button>
          <button onClick={() => setMode('match')} className={`rounded-full py-2 ${mode === 'match' ? 'bg-pink text-white' : 'text-muted'}`}>共通点</button>
        </div>

        {mode === 'match' ? (
          <div className="mt-4 space-y-4 pb-8">
            <p className="text-xs font-bold text-muted">あなたのプロフィールと共通点がある人を自動で探しています ✨</p>
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
                <span className="rounded-full bg-pink/10 px-3 py-2 text-xs font-black text-pink">見る</span>
              </button>
            ))}
            <div className="rounded-[24px] bg-cream/60 px-4 py-3 text-xs font-bold text-muted">
              💡 血液型・MBTIなどを設定で選択すると共通点が見つかりやすくなります
            </div>
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              {['平成', '給食', '夜型', 'インドア', '推し活', '恋愛観'].map((tag) => (
                <button key={tag} onClick={() => setQuery(tag)} className="rounded-full bg-white px-3 py-2 text-xs font-bold text-muted shadow-card">#{tag}</button>
              ))}
            </div>
            <section className="mt-6 space-y-3">
              <SectionHeader title={mode === 'answer' ? '回答を探す' : mode === 'person' ? '人を探す' : 'お題を探す'} />
              {mode === 'answer' && filteredAnswers.map((answer) => <button key={answer.id} onClick={() => go('detail', answer.id)} className="block w-full text-left"><AnswerCard answer={answer} /></button>)}
              {mode === 'person' && <div className="grid grid-cols-2 gap-3">{filteredProfiles.map((profile) => <button key={profile.id} onClick={() => go('profile', profile.id)} className="text-left"><ProfileCard profile={profile} /></button>)}</div>}
              {mode === 'question' && filteredQuestions.map((question) => <button key={question.id} onClick={() => go('create')} className="block w-full text-left"><QuestionCard question={question} /></button>)}
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

function CreateScreen({
  go,
  onPost,
  question,
  onCreateDiary,
}: {
  go: (s: Screen, payload?: any) => void;
  onPost: (draft: DraftAnswer) => string;
  question?: any;
  onCreateDiary: (caption: string, photoUrl: string, font: string, textColor: string, visibility: 'public' | 'followers' | 'mentioned', mentionedUserIds: string[]) => string;
}) {
  const [createMode, setCreateMode] = useState<'question' | 'diary'>('question');

  // --- お題モード ---
  const [draft, setDraft] = useState<DraftAnswer>({
    questionId: question?.id || questions[0].id,
    body: '',
    sticker: '🎀',
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
    questions[0];

  const canPost = draft.body.trim().length > 0;

  function submit() {
    if (!canPost) return;
    const id = onPost(draft);
    setDraft({ questionId: question?.id || questions[0].id, body: '', sticker: '🎀', visibility: 'public' });
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
            <section className="rounded-[28px] bg-white p-4 shadow-card">
              <label className="mb-2 block text-sm font-bold">答えるお題</label>
              <select value={draft.questionId} onChange={(e) => setDraft({ ...draft, questionId: e.target.value })} className="w-full rounded-2xl border border-purple-100 bg-base p-3 text-sm font-bold outline-none">
                {questions.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
              </select>
            </section>
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
                  <textarea ref={bodyRef} value={draft.body} maxLength={160} onChange={(e) => setDraft({ ...draft, body: e.target.value })} className="notebook-lines mt-2 h-44 w-full resize-none rounded-3xl border border-pink/20 bg-pink-50/40 p-4 leading-8 outline-none focus:border-pink" placeholder="ここにプロフィール帳みたいに書いてね" />
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
              <SectionHeader title="デコる" />
              <div className="flex gap-2">
                {['🎀','⭐️','🧸','💿','🌈','📎'].map((s) => <button key={s} onClick={() => setDraft({ ...draft, sticker: s })} className={`grid h-12 w-12 place-items-center rounded-2xl text-xl ${draft.sticker === s ? 'bg-pink text-white' : 'bg-purple/10'}`}>{s}</button>)}
              </div>
            </section>
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

function ProfileBookContent({
  info,
  best3,
  questions,
  answers,
  avatarEmoji,
  avatarUrl,
  userId,
  themeColor = 'pink',
  favoritePhotos,
  customFields = {},
  onGoDetail,
}: {
  info: typeof defaultProfileBookInfo;
  best3: { tv: string[]; food: string[]; places: string[]; music: string[] };
  questions: Array<{ q: string; a: string }>;
  answers: Answer[];
  avatarEmoji: string;
  avatarUrl?: string;
  userId: string;
  themeColor?: string;
  favoritePhotos?: string[];
  customFields?: Record<string, string>;
  onGoDetail?: (id: string) => void;
}) {
  const grad = THEME_GRADIENT[themeColor] ?? THEME_GRADIENT.pink;
  const accent = THEME_ACCENT[themeColor] ?? THEME_ACCENT.pink;
  const bg = THEME_BG[themeColor] ?? THEME_BG.pink;
  const medals = ['🥇', '🥈', '🥉'];
  const lifeStageDef = LIFE_STAGE_DEFS.find((a) => a.id === info.attribute);
  const activityDef  = ACTIVITY_DEFS.find((a) => a.id === info.activity);

  return (
    <div className="space-y-4 px-4 pt-3 pb-28">

      {/* ── 表紙カード ── */}
      <section className={`relative overflow-hidden rounded-[32px] border border-purple/10 bg-gradient-to-br ${grad} p-5 shadow-card`}>
        <div className="absolute right-4 top-4 rotate-6 rounded-xl bg-white/80 px-3 py-1 text-[10px] font-black text-pink shadow-sm tracking-widest">
          ✿ PROFILE ✿
        </div>
        <div className="flex items-center gap-4">
          <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-white/60 text-4xl shadow-inner ring-2 ring-white">
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
        <div className="mt-4 rounded-2xl bg-white/70 px-4 py-2.5 text-xs font-bold text-ink leading-relaxed">
          ✉ {info.message}
        </div>
      </section>

      {/* ── きほんじょうほう ── */}
      <section className="rounded-[28px] bg-white p-5 shadow-card">
        <ProfSectionHeader icon="☆" title="きほんじょうほう" theme={themeColor} />
        <ProfileLine label="なまえ" value={info.name} />
        <ProfileLine label="ニックネーム" value={info.nickname} />
        <ProfileLine label="たんじょうび" value={info.birthday} />
        <ProfileLine label="けつえきがた" value={info.bloodType} />
        <ProfileLine label="MBTI" value={info.mbti} />
        <ProfileLine label="出身地" value={info.hometown} />
      </section>

      {/* ── すきなもの ── */}
      <section className="rounded-[28px] bg-white p-5 shadow-card">
        <ProfSectionHeader icon="♡" title="すきなもの・きらいなもの" theme={themeColor} />
        <ProfileLine label="好きな食べ物" value={info.favoriteFood} />
        <ProfileLine label="きらいな食べ物" value={info.dislikeFood} />
        <ProfileLine label="好きな色" value={info.favoriteColor} />
        {(lifeStageDef?.showSubjectFields ?? true) && (
          <>
            <ProfileLine label="好きな教科" value={info.favoriteSubject} />
            <ProfileLine label="苦手な教科" value={info.dislikeSubject} />
          </>
        )}
        <ProfileLine label="好きなキャラ" value={info.favoriteCharacter} />
        <ProfileLine label="好きな音楽" value={info.favoriteMusic} />
        <ProfileLine label="好きなテレビ" value={info.favoriteTv} />
        <ProfileLine label="好きな芸能人" value={info.favoriteArtist} />
        <ProfileLine label="好きな漫画" value={info.favoriteManga} />
        <ProfileLine label="好きなゲーム" value={info.favoriteGame} />
      </section>

      {/* ── わたしのこと ── */}
      <section className="rounded-[28px] bg-white p-5 shadow-card">
        <ProfSectionHeader icon="✿" title="わたしのこと" theme={themeColor} />
        <ProfileLine label="趣味" value={info.hobby} />
        <ProfileLine label="特技" value={info.specialty} />
        <ProfileLine label="性格" value={info.personality} />
        <ProfileLine label="口ぐせ" value={info.catchphrase} />
        <ProfileLine label="チャームポイント" value={info.charmPoint} />
        <ProfileLine label="将来のゆめ" value={info.dream} />
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
        <ProfSectionHeader icon="💬" title="ひとことしつもん" theme={themeColor} />
        <div className="space-y-0">
          {questions.map((item, i) => (
            <div key={item.q} className={`py-3 ${i < questions.length - 1 ? 'border-b border-dashed border-purple/15' : ''}`}>
              <p className={`text-[11px] font-black ${accent}`}>Q{i + 1}. {item.q}</p>
              <p className="mt-1 text-sm font-bold text-ink leading-relaxed">➜ {item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── お気に入り写真 ── */}
      {favoritePhotos && favoritePhotos.length > 0 && (
        <section className="rounded-[28px] bg-white p-5 shadow-card">
          <ProfSectionHeader icon="📷" title="お気に入り写真" theme={themeColor} />
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
          <ProfSectionHeader icon="📝" title="さいきんのかいとう" theme={themeColor} />
          <div className="space-y-2">
            {answers.slice(0, 3).map((answer) => (
              <button
                key={answer.id}
                onClick={() => onGoDetail(answer.id)}
                className={`w-full rounded-2xl ${bg} p-3 text-left active:scale-[0.99]`}
              >
                <p className={`text-[11px] font-black ${accent}`}>
                  {typeof answer.question === 'string' ? answer.question : answer.question.title}
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
}: {
  go: (s: Screen, payload?: any) => void;
  profile: Profile;
  answers: Answer[];
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

  return (
    <>
      <AppHeader title={`${profile.name}のプロフ帳`} back onBack={() => go('home')} onBell={() => go('notifications')} />
      <div className="px-4 pt-2">
        <button
          onClick={() => setIsFollowing((v) => !v)}
          className={`h-11 w-full rounded-full text-sm font-black shadow-card active:scale-[0.98] transition ${
            isFollowing
              ? 'bg-base text-pink ring-2 ring-pink'
              : 'bg-pink text-white'
          }`}
        >
          {isFollowing ? '✓ フォロー中' : 'フォローする ＋'}
        </button>
      </div>
      <ProfileBookContent
        info={info}
        best3={best3}
        questions={questions}
        answers={theirAnswers}
        avatarEmoji={profile.avatar}
        userId={profile.id}
        themeColor={themeColor}
        onGoDetail={(id) => go('detail', id)}
      />
    </>
  );
}

function ProfileScreen({
  go,
  answers,
  profileBookInfo,
  best3,
  profileQuestions,
  avatarUrl,
  favoritePhotos,
  customFields,
}: {
  go: (s: Screen, answerId?: string) => void;
  answers: Answer[];
  profileBookInfo: typeof defaultProfileBookInfo;
  best3: typeof defaultBest3;
  profileQuestions: typeof defaultProfileQuestions;
  avatarUrl: string;
  favoritePhotos: string[];
  customFields?: Record<string, string>;
}) {
  const myAnswers = answers.filter((a) => a.user.id === me.id);
  return (
    <>
      <AppHeader title="わたしのプロフ帳" back onBack={() => go('home')} onBell={() => go('notifications')} />
      <div className="flex gap-2 px-4 pt-2">
        <button
          onClick={() => go('settings')}
          className="flex-1 rounded-full bg-white py-3 text-sm font-black text-pink shadow-card active:scale-[0.99]"
        >
          ✏️ 編集する
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
      <ProfileBookContent
        info={profileBookInfo}
        best3={best3}
        questions={profileQuestions}
        answers={myAnswers}
        avatarEmoji="🎀"
        avatarUrl={avatarUrl || undefined}
        userId="@koki"
        themeColor="pink"
        favoritePhotos={favoritePhotos}
        customFields={customFields}
        onGoDetail={(id) => go('detail', id)}
      />
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
}) {
  const [form, setForm] = useState(profileBookInfo);
  const [best3Form, setBest3Form] = useState(best3);
  const [questionsForm, setQuestionsForm] = useState(profileQuestions);
  const [localAvatarUrl, setLocalAvatarUrl] = useState(avatarUrl);
  const [localPhotos, setLocalPhotos] = useState<string[]>(favoritePhotos);
  const [localCustomFields, setLocalCustomFields] = useState<Record<string, string>>(customFields);

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

      <div className="space-y-4 px-4 pt-3 pb-28">

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
        <button
          onClick={() => {
            onSave(form);
            onSaveBest3(best3Form);
            onSaveQuestions(questionsForm);
            onSaveAvatar(localAvatarUrl);
            onSaveFavoritePhotos(localPhotos);
            onSaveCustomFields(localCustomFields);
            go('profile');
          }}
          className="w-full rounded-[24px] bg-pink px-5 py-4 text-base font-black text-white shadow-card active:scale-[0.99]"
        >
          保存してプロフィール帳に反映
        </button>
      </div>
    </>
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
      <div className="space-y-4 px-4 pt-3 pb-28">
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
            onClick={() => onShare(`「${answer.question.title}」\n\n${answer.body}\n\n— ${answer.user.name} on Miri`)}
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
          <div className="space-y-2">{comments.map((c, i) => <p key={i} className="rounded-2xl bg-pink-50 p-3 text-sm">{c}</p>)}</div>
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

function MyPageScreen({ go, answers, avatarUrl, onGoBookmarks }: { go: (s: Screen, answerId?: string) => void; answers: Answer[]; avatarUrl: string; onGoBookmarks: () => void }) {
  const [tab, setTab] = useState<'answers' | 'saved' | 'drafts'>('answers');
  const myAnswers = answers.filter((a) => a.user.id === me.id);
  return (
    <>
      <AppHeader title="マイページ" onBell={() => go('notifications')} />
      <div className="space-y-5 px-4 pt-3">
        <section
  onClick={() => go('profile')}
  className="cursor-pointer rounded-[32px] bg-white p-5 shadow-card transition active:scale-[0.99]"
>
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-4">
      <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-pink/10 text-2xl">
        {avatarUrl ? <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" /> : '📷'}
      </div>
      <div>
        <p className="text-xl font-black text-ink">Koki</p>
        <p className="text-sm font-bold text-muted">@koki</p>
      </div>
    </div>
    <span className="text-xs font-black text-pink">プロフィール帳を見る</span>
  </div>

  <div className="mt-5 grid grid-cols-4 rounded-[24px] bg-pink/5 p-4 text-center text-sm font-black text-ink">
    <div>
      <p className="text-xl">{myAnswers.length}</p>
      <p>回答</p>
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
      <p className="text-[11px]">フォロー中</p>
    </button>
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        go('followers');
      }}
      className="rounded-2xl transition hover:bg-white/70 active:scale-[0.98]"
    >
      <p className="text-xl">38</p>
      <p className="text-[11px]">フォロワー</p>
    </button>
    <div>
      <p className="text-xl">8</p>
      <p>シール</p>
    </div>
  </div>
</section>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onGoBookmarks}
            className="flex items-center gap-3 rounded-[24px] bg-white p-4 shadow-card transition active:scale-[0.98]"
          >
            <span className="grid h-10 w-10 place-items-center rounded-full bg-pink/15 text-pink">
              <Bookmark size={18} />
            </span>
            <div className="text-left">
              <p className="text-sm font-black text-ink">ブックマーク</p>
              <p className="text-xs font-bold text-muted">保存した回答</p>
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
              <p className="text-sm font-black text-ink">ショップ</p>
              <p className="text-xs font-bold text-muted">テーマ・シール</p>
            </div>
          </button>
        </div>

      </div>
    </>
  );
}

function ProfileLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-end gap-3 border-b border-dashed border-purple/25 py-2">
      <div className="w-28 shrink-0 text-sm font-black text-ink">
        ♡ {label}
      </div>
      <div className="min-w-0 flex-1 text-sm font-bold text-pink">
        {value}
      </div>
    </div>
  );
}

function FollowersScreen({ go }: { go: (s: Screen, payload?: any) => void }) {
  const [tab, setTab] = useState<'following' | 'followers'>('following');

  const mockFollowersList = [...followers].reverse();

  return (
    <>
      <AppHeader title="フォロー" back onBack={() => go('mypage')} onBell={() => go('notifications')} />
      <div className="space-y-4 px-4 pt-3">
        {/* タブ */}
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-base p-1">
          <button
            onClick={() => setTab('following')}
            className={`rounded-xl py-2 text-sm font-black transition ${tab === 'following' ? 'bg-white shadow-card text-pink' : 'text-muted'}`}
          >
            フォロー中 {followers.length}
          </button>
          <button
            onClick={() => setTab('followers')}
            className={`rounded-xl py-2 text-sm font-black transition ${tab === 'followers' ? 'bg-white shadow-card text-pink' : 'text-muted'}`}
          >
            フォロワー 38
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
      <div className="space-y-4 px-4 pt-3 pb-28">
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
      <div className="space-y-4 px-4 pt-3 pb-28">

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
      <div className="space-y-4 px-4 pt-3 pb-28">
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
          return (
            <button key={c.id} onClick={() => go('circle-detail', c.id)}
              className="flex w-full items-start gap-4 rounded-[28px] bg-white p-4 text-left shadow-card active:scale-[0.98]">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-purple/10 text-3xl">{c.emoji}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-black text-ink">{c.name}</p>
                  <span className="rounded-full bg-pink/10 px-2 py-0.5 text-[10px] font-black text-pink">🔒</span>
                </div>
                <p className="mt-0.5 text-xs text-muted">{members.length + 1}人・{posts.length}件のお題</p>
                <div className="mt-2 flex gap-1">
                  {[{ avatar: me.avatar }, ...members].slice(0, 5).map((m, i) => (
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
  go, circle, posts, onPost,
}: {
  go: (s: Screen, payload?: any) => void;
  circle: Circle;
  posts: CirclePost[];
  onPost: (circleId: string, body: string) => void;
}) {
  const [newQ, setNewQ] = useState('');
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const newQRef = useRef<HTMLTextAreaElement>(null);
  const members = followers.filter((f) => circle.memberIds.includes(f.id));

  return (
    <>
      <AppHeader title={`${circle.emoji} ${circle.name}`} back onBack={() => go('circles')} onBell={() => go('notifications')} />
      <div className="space-y-4 px-4 pt-3 pb-28">
        <section className="rounded-[24px] bg-white p-4 shadow-card">
          <p className="mb-3 text-xs font-black text-muted">メンバー {members.length + 1}人</p>
          <div className="flex flex-wrap gap-3">
            {[{ id: me.id, name: me.name, avatar: me.avatar }, ...members].map((m) => (
              <div key={m.id} className="flex flex-col items-center gap-1">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-pink/10 text-xl">{m.avatar}</div>
                <p className="text-[10px] font-bold text-muted">{m.name}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[24px] bg-white p-4 shadow-card">
          <p className="mb-2 text-sm font-black text-ink">🔒 お題を書く</p>
          <RetroEmojiPicker onInsert={(code) => insertRetroCode(newQRef, code, setNewQ)} />
          <textarea ref={newQRef} value={newQ} onChange={(e) => setNewQ(e.target.value)} maxLength={100} rows={2}
            placeholder="サークル内だけのお題を書いてね（100文字以内）"
            className="mt-2 w-full resize-none rounded-2xl border border-purple/15 bg-base px-4 py-3 text-sm font-bold text-ink outline-none focus:border-pink" />
          {newQ && (
            <div className="mt-2 rounded-2xl border border-purple/20 bg-white px-4 py-3">
              <p className="mb-1 text-[10px] font-bold text-muted">プレビュー</p>
              <p className="min-h-[1.5rem] text-sm font-bold leading-7 text-ink"><RetroText text={newQ} /></p>
            </div>
          )}
          <button disabled={!newQ.trim()} onClick={() => { onPost(circle.id, newQ.trim()); setNewQ(''); }}
            className="mt-3 h-11 w-full rounded-full bg-pink text-sm font-black text-white shadow-card disabled:opacity-40 active:scale-[0.98]">
            投稿する
          </button>
        </section>

        {posts.length === 0 ? (
          <EmptyState text="まだお題がありません。最初のお題を書いてみよう！" />
        ) : posts.map((p) => (
          <div key={p.id} className="rounded-[24px] bg-white p-4 shadow-card">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-lg">{p.postedByAvatar}</span>
              <span className="text-xs font-black text-ink">{p.postedByName}</span>
              <span className="ml-auto rounded-full bg-pink/10 px-2 py-0.5 text-[10px] font-black text-pink">🔒 サークル限定</span>
            </div>
            <p className="mb-3 text-sm font-black text-ink"><RetroText text={p.body} /></p>
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
            {replyTargetId === p.id ? (
              <div className="mt-3 flex gap-2">
                <input value={replyText} onChange={(e) => setReplyText(e.target.value)} maxLength={80}
                  placeholder="返信を書く…"
                  className="flex-1 rounded-full border border-purple/15 bg-base px-4 py-2 text-xs font-bold outline-none focus:border-pink" />
                <button onClick={() => { setReplyTargetId(null); setReplyText(''); }}
                  className="rounded-full bg-pink px-4 py-2 text-xs font-black text-white">送る</button>
              </div>
            ) : (
              <button onClick={() => setReplyTargetId(p.id)}
                className="mt-2 text-xs font-black text-pink">
                ↩ 返信する
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function CircleCreateScreen({
  go, onCreate,
}: {
  go: (s: Screen, payload?: any) => void;
  onCreate: (name: string, emoji: string, memberIds: string[]) => string;
}) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🔒');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  return (
    <>
      <AppHeader title="サークルを作る" back onBack={() => go('circles')} onBell={() => go('notifications')} />
      <div className="space-y-4 px-4 pt-3 pb-28">
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

        <div className="rounded-2xl bg-purple/5 px-4 py-3 text-xs font-bold leading-5 text-muted">
          🔒 サークル内のお題はメンバーだけに表示されます
        </div>

        <button disabled={!name.trim()}
          onClick={() => { const id = onCreate(name.trim(), emoji, selectedMembers); go('circle-detail', id); }}
          className="h-14 w-full rounded-full bg-pink text-base font-black text-white shadow-floating disabled:opacity-40 active:scale-[0.98]">
          {emoji} サークルを作る ({selectedMembers.length + 1}人)
        </button>
      </div>
    </>
  );
}

// ===================== /サークル画面 =====================

// ===================== ショップ画面 =====================

type ShopCategory = 'theme' | 'sticker' | 'deco' | 'font';

const SHOP_ITEMS: Record<ShopCategory, { id: string; name: string; preview: string; price: number; owned: boolean }[]> = {
  theme: [
    { id: 'sakura', name: '🌸 さくら夜', preview: 'from-pink-200 via-rose-100 to-purple-100', price: 120, owned: false },
    { id: 'ocean', name: '🌊 ディープオーシャン', preview: 'from-blue-200 via-cyan-100 to-sky-100', price: 150, owned: false },
    { id: 'galaxy', name: '🌌 ギャラクシー', preview: 'from-indigo-300 via-purple-200 to-pink-200', price: 200, owned: false },
    { id: 'autumn', name: '🍂 もみじ', preview: 'from-orange-200 via-amber-100 to-yellow-100', price: 120, owned: false },
    { id: 'rainbow', name: '🌈 レインボー', preview: 'from-pink-200 via-yellow-100 to-green-100', price: 180, owned: false },
    { id: 'mist', name: '🌙 ミスティパープル', preview: 'from-violet-300 via-purple-200 to-fuchsia-100', price: 150, owned: false },
  ],
  sticker: [
    { id: 'ribbon', name: '🎀 リボンパック', preview: '🎀🎗️💝🎁🎀🎗️', price: 100, owned: false },
    { id: 'glitter', name: '✨ キラキラセット', preview: '✨⭐💫🌟✨⭐', price: 150, owned: false },
    { id: 'cat', name: '🐱 ねこセット', preview: '🐱😸🐾🌸🐱😺', price: 120, owned: false },
    { id: 'flower', name: '🌸 お花セット', preview: '🌸🌺🌼🌻🌹💐', price: 100, owned: false },
    { id: 'heart', name: '💕 ハートセット', preview: '💕💖💗💓💞💝', price: 80, owned: false },
    { id: 'butterfly', name: '🦋 ちょうちょセット', preview: '🦋🌺🌸🍃🦋🌼', price: 100, owned: false },
  ],
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
  { key: 'theme', label: 'テーマ', emoji: '🎨' },
  { key: 'sticker', label: 'シール', emoji: '🌟' },
  { key: 'deco', label: 'デコ', emoji: '✨' },
  { key: 'font', label: 'フォント', emoji: '🔤' },
];

function ShopScreen({ go }: { go: (s: Screen) => void }) {
  const [tab, setTab] = useState<ShopCategory>('theme');
  const items = SHOP_ITEMS[tab];

  return (
    <>
      <AppHeader title="ショップ" back onBack={() => go('mypage')} onBell={() => go('notifications')} />

      {/* プレミアムバナー */}
      <div className="mx-4 mt-3 rounded-[28px] bg-gradient-to-r from-pink to-purple p-5 shadow-floating">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-black text-white/70">Miriプレミアム</p>
            <p className="mt-0.5 text-xl font-black text-white">全アイテムが使い放題</p>
            <p className="mt-1 text-xs font-bold text-white/80">テーマ・シール・デコ・フォントをすべて解放</p>
            <button className="mt-4 rounded-full bg-white px-5 py-2 text-sm font-black text-pinkStrong shadow-card active:scale-[0.98]">
              今すぐ始める — ¥480 / 月
            </button>
          </div>
          <div className="flex flex-col items-end gap-3 pl-2 pt-1">
            <RetroStar scale={1.4} />
            <RetroRibbon scale={1.1} />
          </div>
        </div>
      </div>

      {/* カテゴリタブ */}
      <div className="mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {SHOP_CATEGORY_LABELS.map(({ key, label, emoji }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-black transition ${
              tab === key ? 'bg-pink text-white shadow-card' : 'bg-white text-muted shadow-card hover:bg-pink/10'
            }`}
          >
            <span>{emoji}</span>{label}
          </button>
        ))}
      </div>

      {/* アイテムグリッド */}
      <div className="grid grid-cols-2 gap-3 px-4 pb-8 pt-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-[24px] bg-white p-4 shadow-card">
            {/* プレビュー */}
            <div className={`mb-3 flex h-20 items-center justify-center rounded-2xl bg-gradient-to-br ${
              tab === 'theme' ? item.preview : 'from-pink/10 to-purple/10'
            } text-center text-2xl font-black leading-snug`}>
              {tab !== 'theme' ? item.preview : <span className="text-xs font-black text-ink/60">プレビュー</span>}
            </div>
            <p className="text-sm font-black text-ink">{item.name}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs font-black text-pinkStrong">¥{item.price}</span>
              <button
                disabled
                className="rounded-full bg-base px-3 py-1.5 text-[11px] font-black text-muted ring-1 ring-pink/20"
              >
                🔒 準備中
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* フッター注記 */}
      <p className="px-6 pb-6 text-center text-[11px] font-bold text-muted">
        購入機能は近日公開予定です。お楽しみに！
      </p>
    </>
  );
}

// ===================== /ショップ画面 =====================

function NotificationsScreen({ go }: { go: (s: Screen) => void }) {
  return (
    <>
      <AppHeader title="通知" />
      <div className="space-y-3 px-4 pt-3">
        {[['🎀','まゆさんがあなたの回答に「わかる」しました'],['💬','りんさんがコメントしました'],['⭐️','新しいコラボお題が追加されました']].map(([icon, text]) => <div key={text} className="flex gap-3 rounded-[24px] bg-white p-4 shadow-card"><span className="grid h-10 w-10 place-items-center rounded-full bg-pink/15">{icon}</span><p className="text-sm font-bold leading-6">{text}</p></div>)}
        <button onClick={() => go('home')} className="mt-4 h-12 w-full rounded-full bg-pink text-sm font-black text-white">ホームに戻る</button>
      </div>
    </>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-[28px] bg-white p-8 text-center text-sm font-bold text-muted shadow-card">{text}</div>;
}

// ── オンボーディング画面 ────────────────────────────────────────
function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const steps = [
    { emoji: '📖', title: 'お題に答えよう', desc: '毎日届くお題に、プロフィール帳みたいに答えてね。' },
    { emoji: '🎀', title: 'プロフ帳を作ろう', desc: '自分だけのプロフィール帳をデコって、個性を見せよう。' },
    { emoji: '✨', title: 'つながろう', desc: '共通点のある人をみつけて、日記を一緒に書こう。' },
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
      <div className="space-y-3 px-4 pt-3 pb-28">
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
const [selectedQuestion, setSelectedQuestion] = useState<any>(null);

  const [screen, setScreen] = useState<Screen>(() => {
    if (typeof window === 'undefined') return 'home';
    return localStorage.getItem('miri_onboarded') ? 'home' : 'onboarding';
  });
  const [selectedAnswerId, setSelectedAnswerId] = useState(initialAnswers[0].id);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answer[]>(initialAnswers);
  const selectedAnswer = answers.find((a) => a.id === selectedAnswerId) || answers[0];
  

  const [profileBookInfo, setProfileBookInfo] = useState(() => {
  if (typeof window === 'undefined') return defaultProfileBookInfo;
  const saved = localStorage.getItem('profileBookInfo');
  return saved ? { ...defaultProfileBookInfo, ...JSON.parse(saved) } : defaultProfileBookInfo;
});

const [communityQuestions, setCommunityQuestions] = useState(() => {
  if (typeof window === 'undefined') return [];
  const saved = localStorage.getItem('communityQuestions');
  return saved ? JSON.parse(saved) : [];
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
  const saved = localStorage.getItem('circles');
  return saved ? JSON.parse(saved) : initialCircles;
});
const [circlePosts, setCirclePosts] = useState<CirclePost[]>(() => {
  if (typeof window === 'undefined') return initialCirclePosts;
  const saved = localStorage.getItem('circlePosts');
  return saved ? JSON.parse(saved) : initialCirclePosts;
});
const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null);

function createCircle(name: string, emoji: string, memberIds: string[]): string {
  const id = `circle-${Date.now()}`;
  const newCircle: Circle = { id, name, emoji, memberIds: [me.id, ...memberIds], createdBy: me.id };
  const next = [newCircle, ...circles];
  setCircles(next);
  localStorage.setItem('circles', JSON.stringify(next));
  return id;
}

function postToCircle(circleId: string, body: string) {
  const newPost: CirclePost = {
    id: `cp-${Date.now()}`, circleId, body,
    postedBy: me.id, postedByName: me.name, postedByAvatar: me.avatar,
    postedAt: new Date().toISOString(), replies: [],
  };
  const next = [newPost, ...circlePosts];
  setCirclePosts(next);
  localStorage.setItem('circlePosts', JSON.stringify(next));
}

const [favoritePhotos, setFavoritePhotos] = useState<string[]>(() => {
  if (typeof window === 'undefined') return [];
  const saved = localStorage.getItem('favoritePhotos');
  return saved ? JSON.parse(saved) : [];
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
}

const [profileCustomFields, setProfileCustomFields] = useState<Record<string, string>>(() => {
  if (typeof window === 'undefined') return {};
  const saved = localStorage.getItem('profileCustomFields');
  return saved ? JSON.parse(saved) : {};
});

function updateProfileCustomFields(next: Record<string, string>) {
  setProfileCustomFields(next);
  localStorage.setItem('profileCustomFields', JSON.stringify(next));
}

const [best3, setBest3] = useState(() => {
  if (typeof window === 'undefined') return defaultBest3;
  const saved = localStorage.getItem('best3');
  return saved ? JSON.parse(saved) : defaultBest3;
});

function updateBest3(next: typeof defaultBest3) {
  setBest3(next);
  localStorage.setItem('best3', JSON.stringify(next));
}

const [profileQuestions, setProfileQuestions] = useState(() => {
  if (typeof window === 'undefined') return defaultProfileQuestions;
  const saved = localStorage.getItem('profileQuestions');
  return saved ? JSON.parse(saved) : defaultProfileQuestions;
});

function updateProfileQuestions(next: typeof defaultProfileQuestions) {
  setProfileQuestions(next);
  localStorage.setItem('profileQuestions', JSON.stringify(next));
}

  useEffect(() => {
    const saved = window.localStorage.getItem('profilebook_answers_v2');
    if (saved) setAnswers(JSON.parse(saved));
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

  // ── ブックマーク ──────────────────────────────────────────────
  const [bookmarks, setBookmarks] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem('miri_bookmarks');
    return saved ? JSON.parse(saved) : [];
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
  const allQuestions = [...communityQuestions, ...questions];

  const q =
    allQuestions.find((question) => question.id === draft.questionId) ||
    questions[0];

  const id = `a-${Date.now()}`;

  const newAnswer: Answer = {
    id,
    question: q,
    body: `${draft.sticker} ${draft.body}`,
    user: { name: me.name, id: me.id, avatar: me.avatar },
    reactions: { like: 0, same: 0, wakaru: 0, natsukashii: 0 },
  };

  setAnswers((prev) => [newAnswer, ...prev]);
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
    />
  );

  if (screen === 'official-question-create')
  return (
    <OfficialQuestionCreateScreen
      go={go}
      onCreate={createCommunityQuestion}
    />
  );
    
    if (screen === 'circles') return <CirclesScreen go={go} circles={circles} circlePosts={circlePosts} />;
    if (screen === 'circle-create') return <CircleCreateScreen go={go} onCreate={createCircle} />;
    if (screen === 'circle-detail') {
      const circle = circles.find((c) => c.id === selectedCircleId);
      if (circle) return <CircleDetailScreen go={go} circle={circle} posts={circlePosts.filter((p) => p.circleId === circle.id)} onPost={postToCircle} />;
    }

   if (screen === 'home')
  return (
    <HomeScreen
      go={go}
      answers={answers}
      communityQuestions={communityQuestions}
      diaryPages={diaryPages}
      circles={circles}
      circlePosts={circlePosts}
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
    />
  );
    if (screen === 'profile') {
      if (selectedProfileId) {
        const otherProfile = [...profiles, ...followers].find((p) => p.id === selectedProfileId);
        if (otherProfile) return <OtherProfileScreen go={go} profile={otherProfile} answers={answers} />;
      }
      return <ProfileScreen
        go={go}
        answers={answers}
        profileBookInfo={profileBookInfo}
        best3={best3}
        profileQuestions={profileQuestions}
        avatarUrl={avatarUrl}
        favoritePhotos={favoritePhotos}
        customFields={profileCustomFields}
      />;
    }
    if (screen === 'onboarding') return <OnboardingScreen onDone={completeOnboarding} />;
    if (screen === 'detail') return (
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
    if (screen === 'notifications') return <NotificationsScreen go={go} />;
    if (screen === 'followers') return <FollowersScreen go={go} />;
    if (screen === 'mypage') return <MyPageScreen go={go} answers={answers} avatarUrl={avatarUrl} onGoBookmarks={() => go('bookmarks')} />;
    if (screen === 'shop') return <ShopScreen go={go} />;

return <ProfileScreen
  go={go}
  answers={answers}
  profileBookInfo={profileBookInfo}
  best3={best3}
  profileQuestions={profileQuestions}
  avatarUrl={avatarUrl}
  favoritePhotos={favoritePhotos}
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
]);

  const active = tabFromScreen(screen);

  return (
    <>
      <DesktopShell active={active} go={go} answers={answers} avatarUrl={avatarUrl}>{current}</DesktopShell>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
