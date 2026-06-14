export const questions = [
  { id: 'q1', category: '平成', title: '小学生の頃、好きだった給食は？', sponsor: null },
  { id: 'q2', category: '価値観', title: '休日は家でだらだら派？外に出たい派？', sponsor: null },
  { id: 'q3', category: 'コラボ', title: '最近のごほうびタイム、何してる？', sponsor: 'mellow milk' },
  { id: 'q4', category: '定番', title: 'いま一番ハマっていることは？', sponsor: null }
];

export const answers = [
  {
    id: 'a1',
    question: questions[0],
    body: '揚げパン。口のまわり砂糖だらけにして、昼休みまでずっと幸せだった。',
    user: { name: 'まゆ', id: '@mayu_note', avatar: '🎀' },
    reactions: { like: 24, same: 11, wakaru: 18, natsukashii: 31 }
  },
  {
    id: 'a2',
    question: questions[1],
    body: '午前中だけ外に出て、午後は家で映画見るのがいちばん勝ち。',
    user: { name: 'Koki', id: '@koki', avatar: '📷' },
    reactions: { like: 15, same: 7, wakaru: 29, natsukashii: 3 }
  },
  {
    id: 'a3',
    question: questions[3],
    body: '昔のプロフィール帳っぽいSNSを作ること。シール帳感をどう入れるか悩み中。',
    user: { name: 'りん', id: '@rin_puri', avatar: '🌙' },
    reactions: { like: 41, same: 4, wakaru: 9, natsukashii: 12 }
  }
];

export const profiles = [
  { name: 'まゆ', id: '@mayu_note', avatar: '🎀', bio: '平成女児の残党。甘いものと夜散歩。', common: '揚げパン派' },
  { name: 'りん', id: '@rin_puri', avatar: '🌙', bio: '懐かしいものを集めています。', common: '夜型' },
  { name: 'なな', id: '@nana_7', avatar: '🧸', bio: 'シールと喫茶店が好き。', common: 'インドア派' }
];
