export const questions = [
  // 平成
  { id: 'q1',  category: '平成', title: '小学生の頃、好きだった給食は？', sponsor: null },
  { id: 'q5',  category: '平成', title: '放課後によく行っていた場所は？', sponsor: null },
  { id: 'q6',  category: '平成', title: 'ハマっていたゲームやおもちゃは？', sponsor: null },
  { id: 'q7',  category: '平成', title: '集めていたシールやカードは？', sponsor: null },

  // 価値観
  { id: 'q2',  category: '価値観', title: '休日は家でだらだら派？外に出たい派？', sponsor: null },
  { id: 'q11', category: '価値観', title: '友達が多い派？少ない方が深い派？', sponsor: null },
  { id: 'q12', category: '価値観', title: '貯金派？使い切り派？', sponsor: null },
  { id: 'q13', category: '価値観', title: '朝型？夜型？', sponsor: null },
  { id: 'q15', category: '価値観', title: '「好きな人ができたとき、先に告白する」派？待つ派？', sponsor: null },

  // 恋愛
  { id: 'q16', category: '恋愛', title: '好きな人ができたとき、友達に言う？言わない？', sponsor: null },
  { id: 'q17', category: '恋愛', title: 'ときめいた瞬間ってどんなとき？', sponsor: null },
  { id: 'q18', category: '恋愛', title: '理想のデートスポットは？', sponsor: null },
  { id: 'q19', category: '恋愛', title: '「好きです」ってLINEで送れる派？直接言いたい派？', sponsor: null },

  // 定番
  { id: 'q4',  category: '定番', title: 'いま一番ハマっていることは？', sponsor: null },
  { id: 'q21', category: '定番', title: '無人島に1つだけ持っていくとしたら？', sponsor: null },

  // 深夜
  { id: 'q23', category: '深夜', title: '眠れない夜、何してる？', sponsor: null },
  { id: 'q24', category: '深夜', title: '深夜にひとりで聴きたくなる曲は？', sponsor: null },

  // コラボ
  { id: 'q3',  category: 'コラボ', title: '最近のごほうびタイム、何してる？', sponsor: 'mellow milk' },
  { id: 'q25', category: 'コラボ', title: '今年の夏、やりたいことは？', sponsor: null },
];

// 回答シードは id 参照で紐付ける（質問の増減でズレないように）
const qById = (id: string) => questions.find((q) => q.id === id)!;

export const answers = [
  {
    id: 'a1',
    question: qById('q1'),
    body: '揚げパン。口のまわり砂糖だらけにして、昼休みまでずっと幸せだった。',
    user: { name: 'まゆ', id: '@mayu_note', avatar: '🎀' },
    reactions: { like: 24, same: 11, wakaru: 18, natsukashii: 31 }
  },
  {
    id: 'a2',
    question: qById('q2'),
    body: '午前中だけ外に出て、午後は家で映画見るのがいちばん勝ち。',
    user: { name: 'Koki', id: '@koki', avatar: '📷' },
    reactions: { like: 15, same: 7, wakaru: 29, natsukashii: 3 }
  },
  {
    id: 'a3',
    question: qById('q4'),
    body: '昔のプロフィール帳っぽいSNSを作ること。シール帳感をどう入れるか悩み中。',
    user: { name: 'りん', id: '@rin_puri', avatar: '🌙' },
    reactions: { like: 41, same: 4, wakaru: 9, natsukashii: 12 }
  },
  {
    id: 'a4',
    question: qById('q5'),
    body: 'マックのポテト食べながら次の日の話してた。あの頃の時間は無限だった。',
    user: { name: 'はる', id: '@haru_cafe', avatar: '☕️' },
    reactions: { like: 19, same: 14, wakaru: 22, natsukashii: 38 }
  },
  {
    id: 'a5',
    question: qById('q15'),
    body: '絶対待つ。好きになった人にこそ、ちゃんと来てほしい。',
    user: { name: 'まゆ', id: '@mayu_note', avatar: '🎀' },
    reactions: { like: 33, same: 21, wakaru: 8, natsukashii: 2 }
  },
];

export const profiles = [
  { name: 'まゆ', id: '@mayu_note', avatar: '🎀', bio: '平成女児の残党。甘いものと夜散歩。', common: '揚げパン派' },
  { name: 'りん', id: '@rin_puri', avatar: '🌙', bio: '懐かしいものを集めています。', common: '夜型' },
  { name: 'なな', id: '@nana_7', avatar: '🧸', bio: 'シールと喫茶店が好き。', common: 'インドア派' }
];
