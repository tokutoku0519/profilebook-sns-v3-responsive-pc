import type { Lang } from './i18n';

export type LocaleQuestion = {
  id: string;
  category: string;
  title: string;
  sponsor: string | null;
};

// ───── Japanese (original) ─────
const questionsJa: LocaleQuestion[] = [
  { id: 'q1',  category: '平成',  title: '小学生の頃、好きだった給食は？', sponsor: null },
  { id: 'q5',  category: '平成',  title: '放課後によく行っていた場所は？', sponsor: null },
  { id: 'q6',  category: '平成',  title: 'ハマっていたゲームやおもちゃは？', sponsor: null },
  { id: 'q7',  category: '平成',  title: '集めていたシールやカードは？', sponsor: null },
  { id: 'q2',  category: '価値観', title: '休日は家でだらだら派？外に出たい派？', sponsor: null },
  { id: 'q11', category: '価値観', title: '友達が多い派？少ない方が深い派？', sponsor: null },
  { id: 'q12', category: '価値観', title: '貯金派？使い切り派？', sponsor: null },
  { id: 'q13', category: '価値観', title: '朝型？夜型？', sponsor: null },
  { id: 'q16', category: '恋愛',  title: '好きな人ができたとき、友達に言う？言わない？', sponsor: null },
  { id: 'q17', category: '恋愛',  title: 'ときめいた瞬間ってどんなとき？', sponsor: null },
  { id: 'q18', category: '恋愛',  title: '理想のデートスポットは？', sponsor: null },
  { id: 'q4',  category: '定番',  title: 'いま一番ハマっていることは？', sponsor: null },
  { id: 'q21', category: '定番',  title: '無人島に1つだけ持っていくとしたら？', sponsor: null },
  { id: 'q23', category: '深夜',  title: '眠れない夜、何してる？', sponsor: null },
  { id: 'q24', category: '深夜',  title: '深夜にひとりで聴きたくなる曲は？', sponsor: null },
  { id: 'q3',  category: 'コラボ', title: '最近のごほうびタイム、何してる？', sponsor: 'mellow milk' },
  { id: 'q25', category: '定番',  title: '今年の夏、やりたいことは？', sponsor: null },
];

// ───── English ─────
const questionsEn: LocaleQuestion[] = [
  { id: 'eq1',  category: 'Nostalgia', title: 'What was your favorite childhood TV show?', sponsor: null },
  { id: 'eq2',  category: 'Nostalgia', title: 'What game were you obsessed with as a kid?', sponsor: null },
  { id: 'eq3',  category: 'Nostalgia', title: 'What toy or collectible did you always want?', sponsor: null },
  { id: 'eq4',  category: 'Nostalgia', title: "What's the song that takes you back to your childhood?", sponsor: null },
  { id: 'eq5',  category: 'Values',    title: 'Home body or adventurer on weekends?', sponsor: null },
  { id: 'eq6',  category: 'Values',    title: 'Few close friends or lots of acquaintances?', sponsor: null },
  { id: 'eq7',  category: 'Values',    title: 'Saver or spender?', sponsor: null },
  { id: 'eq8',  category: 'Values',    title: 'Early bird or night owl?', sponsor: null },
  { id: 'eq9',  category: 'Values',    title: 'Do you confess your feelings first, or wait?', sponsor: null },
  { id: 'eq10', category: 'Romance',   title: 'Do you tell your friends when you like someone?', sponsor: null },
  { id: 'eq11', category: 'Romance',   title: 'When do you feel butterflies?', sponsor: null },
  { id: 'eq12', category: 'Romance',   title: "What's your ideal date spot?", sponsor: null },
  { id: 'eq13', category: 'Romance',   title: "What's your love language?", sponsor: null },
  { id: 'eq14', category: 'Basics',    title: "What are you most into right now?", sponsor: null },
  { id: 'eq16', category: 'Basics',    title: 'If you could only take one thing to a desert island, what would it be?', sponsor: null },
  { id: 'eq18', category: 'Basics',    title: "What's your guilty pleasure?", sponsor: null },
  { id: 'eq19', category: 'Basics',    title: "What's something you want to try this year?", sponsor: null },
  { id: 'eq20', category: 'Late Night','title': "What do you do when you can\\'t sleep?", sponsor: null },
  { id: 'eq21', category: 'Late Night', title: "Song you'd listen to alone late at night?", sponsor: null },
  { id: 'eq22', category: 'Basics',    title: "What\\'s your most-used emoji?", sponsor: null },
  { id: 'eq3c', category: 'Collab',    title: 'How do you treat yourself lately?', sponsor: 'mellow milk' },
];

// ───── Korean ─────
const questionsKo: LocaleQuestion[] = [
  { id: 'kq1',  category: '추억',   title: '어릴 때 좋아했던 TV 프로그램은?', sponsor: null },
  { id: 'kq2',  category: '추억',   title: '어릴 때 빠져 있던 게임이나 장난감은?', sponsor: null },
  { id: 'kq3',  category: '추억',   title: '모아 본 적 있는 굿즈나 카드는?', sponsor: null },
  { id: 'kq4',  category: '추억',   title: '첫 번째로 샀던 앨범이나 최애 아이돌은?', sponsor: null },
  { id: 'kq5',  category: '가치관', title: '주말에 집에서 쉬는 편? 밖에 나가는 편?', sponsor: null },
  { id: 'kq6',  category: '가치관', title: '친구 많은 편? 소수 깊은 편?', sponsor: null },
  { id: 'kq7',  category: '가치관', title: '저축파? 쓸 때 다 쓰는 파?', sponsor: null },
  { id: 'kq8',  category: '가치관', title: '아침형? 저녁형?', sponsor: null },
  { id: 'kq9',  category: '가치관', title: '좋아하는 사람 생기면 먼저 고백하는 편? 기다리는 편?', sponsor: null },
  { id: 'kq10', category: '연애',   title: '좋아하는 사람 생기면 친구한테 말해? 비밀로 해?', sponsor: null },
  { id: 'kq11', category: '연애',   title: '두근거렸던 순간은 언제야?', sponsor: null },
  { id: 'kq12', category: '연애',   title: '이상적인 데이트 코스는?', sponsor: null },
  { id: 'kq13', category: '연애',   title: '나의 러브 랭귀지는?', sponsor: null },
  { id: 'kq14', category: '기본',   title: '지금 가장 빠져 있는 건?', sponsor: null },
  { id: 'kq16', category: '기본',   title: '무인도에 딱 하나만 가져간다면?', sponsor: null },
  { id: 'kq18', category: '기본',   title: '올해 꼭 해보고 싶은 것은?', sponsor: null },
  { id: 'kq19', category: '심야',   title: '잠이 안 올 때 뭐 해?', sponsor: null },
  { id: 'kq20', category: '심야',   title: '혼자 밤에 듣고 싶은 노래는?', sponsor: null },
  { id: 'kq21', category: '기본',   title: '요즘 자주 쓰는 이모지는?', sponsor: null },
  { id: 'kq3c', category: '콜라보', title: '최근 나를 위한 선물 타임은?', sponsor: 'mellow milk' },
];

// ───── Chinese Simplified ─────
const questionsZh: LocaleQuestion[] = [
  { id: 'zhq1',  category: '回忆',  title: '小时候最喜欢看什么电视节目？', sponsor: null },
  { id: 'zhq2',  category: '回忆',  title: '小时候最痴迷的游戏或玩具是什么？', sponsor: null },
  { id: 'zhq3',  category: '回忆',  title: '曾经收集过什么卡片或周边？', sponsor: null },
  { id: 'zhq4',  category: '回忆',  title: '第一张买的专辑或最喜欢的歌手是？', sponsor: null },
  { id: 'zhq5',  category: '价值观', title: '周末宅家派还是出门派？', sponsor: null },
  { id: 'zhq6',  category: '价值观', title: '朋友多派还是交心少数派？', sponsor: null },
  { id: 'zhq7',  category: '价值观', title: '存钱派还是花光派？', sponsor: null },
  { id: 'zhq8',  category: '价值观', title: '早起派还是夜猫子？', sponsor: null },
  { id: 'zhq9',  category: '价值观', title: '喜欢一个人的时候，会主动表白还是等待？', sponsor: null },
  { id: 'zhq10', category: '恋爱',  title: '喜欢一个人会告诉朋友吗？', sponsor: null },
  { id: 'zhq11', category: '恋爱',  title: '什么时候会心动？', sponsor: null },
  { id: 'zhq12', category: '恋爱',  title: '理想的约会地点是哪里？', sponsor: null },
  { id: 'zhq13', category: '恋爱',  title: '你的爱情语言是什么？', sponsor: null },
  { id: 'zhq14', category: '基础',  title: '最近最迷什么？', sponsor: null },
  { id: 'zhq16', category: '基础',  title: '荒岛只能带一样东西，会带什么？', sponsor: null },
  { id: 'zhq18', category: '基础',  title: '今年一定要做的事是什么？', sponsor: null },
  { id: 'zhq19', category: '深夜',  title: '睡不着的时候会做什么？', sponsor: null },
  { id: 'zhq20', category: '深夜',  title: '一个人深夜想听的歌是？', sponsor: null },
  { id: 'zhq21', category: '基础',  title: '最常用的表情包是？', sponsor: null },
  { id: 'zhq3c', category: '合作',  title: '最近怎么犒劳自己的？', sponsor: 'mellow milk' },
];

// ───── Chinese Traditional ─────
const questionsZhTw: LocaleQuestion[] = [
  { id: 'twq1',  category: '回憶',  title: '小時候最喜歡看什麼電視節目？', sponsor: null },
  { id: 'twq2',  category: '回憶',  title: '小時候最著迷的遊戲或玩具是什麼？', sponsor: null },
  { id: 'twq3',  category: '回憶',  title: '曾經收集過什麼卡片或周邊？', sponsor: null },
  { id: 'twq4',  category: '回憶',  title: '第一張買的專輯或最喜歡的歌手是？', sponsor: null },
  { id: 'twq5',  category: '價值觀', title: '週末宅家派還是出門派？', sponsor: null },
  { id: 'twq6',  category: '價值觀', title: '朋友多派還是交心少數派？', sponsor: null },
  { id: 'twq7',  category: '價值觀', title: '存錢派還是花光派？', sponsor: null },
  { id: 'twq8',  category: '價值觀', title: '早起派還是夜貓子？', sponsor: null },
  { id: 'twq9',  category: '價值觀', title: '喜歡一個人的時候，會主動表白還是等待？', sponsor: null },
  { id: 'twq10', category: '戀愛',  title: '喜歡一個人會告訴朋友嗎？', sponsor: null },
  { id: 'twq11', category: '戀愛',  title: '什麼時候會心動？', sponsor: null },
  { id: 'twq12', category: '戀愛',  title: '理想的約會地點是哪裡？', sponsor: null },
  { id: 'twq13', category: '戀愛',  title: '你的愛情語言是什麼？', sponsor: null },
  { id: 'twq14', category: '基礎',  title: '最近最迷什麼？', sponsor: null },
  { id: 'twq16', category: '基礎',  title: '荒島只能帶一樣東西，會帶什麼？', sponsor: null },
  { id: 'twq18', category: '基礎',  title: '今年一定要做的事是什麼？', sponsor: null },
  { id: 'twq19', category: '深夜',  title: '睡不著的時候會做什麼？', sponsor: null },
  { id: 'twq20', category: '深夜',  title: '一個人深夜想聽的歌是？', sponsor: null },
  { id: 'twq21', category: '基礎',  title: '最常用的表情包是？', sponsor: null },
  { id: 'twq3c', category: '合作',  title: '最近怎麼犒勞自己的？', sponsor: 'mellow milk' },
];

// ───── Thai ─────
const questionsTh: LocaleQuestion[] = [
  { id: 'thq1',  category: 'ความทรงจำ', title: 'รายการทีวีที่ชอบตอนเด็กๆ คืออะไร?', sponsor: null },
  { id: 'thq2',  category: 'ความทรงจำ', title: 'เกมหรือของเล่นที่หลงใหลตอนเด็กคืออะไร?', sponsor: null },
  { id: 'thq3',  category: 'ความทรงจำ', title: 'เคยสะสมการ์ดหรือสติกเกอร์อะไรบ้าง?', sponsor: null },
  { id: 'thq4',  category: 'ความทรงจำ', title: 'อัลบั้มแรกที่ซื้อหรือศิลปินที่ชอบคือใคร?', sponsor: null },
  { id: 'thq5',  category: 'คุณค่า',     title: 'วันหยุดอยู่บ้านหรือออกไปเที่ยว?', sponsor: null },
  { id: 'thq6',  category: 'คุณค่า',     title: 'มีเพื่อนเยอะหรือน้อยแต่ลึก?', sponsor: null },
  { id: 'thq7',  category: 'คุณค่า',     title: 'ออมเงินหรือใช้จ่ายเต็มที่?', sponsor: null },
  { id: 'thq8',  category: 'คุณค่า',     title: 'ตื่นเช้าหรือนอนดึก?', sponsor: null },
  { id: 'thq9',  category: 'คุณค่า',     title: 'ชอบใครแล้วจะบอกก่อนหรือรอ?', sponsor: null },
  { id: 'thq10', category: 'ความรัก',   title: 'ชอบใครแล้วจะบอกเพื่อนไหม?', sponsor: null },
  { id: 'thq11', category: 'ความรัก',   title: 'เมื่อไหร่ที่รู้สึกหัวใจเต้นแรง?', sponsor: null },
  { id: 'thq12', category: 'ความรัก',   title: 'สถานที่เดทในฝันคือที่ไหน?', sponsor: null },
  { id: 'thq13', category: 'ความรัก',   title: 'ภาษารักของคุณคืออะไร?', sponsor: null },
  { id: 'thq14', category: 'ทั่วไป',    title: 'ตอนนี้หลงใหลอะไรมากที่สุด?', sponsor: null },
  { id: 'thq16', category: 'ทั่วไป',    title: 'ถ้าไปเกาะร้าง พาอะไรไปได้ชิ้นเดียว?', sponsor: null },
  { id: 'thq18', category: 'ทั่วไป',    title: 'ปีนี้อยากทำอะไรให้ได้?', sponsor: null },
  { id: 'thq19', category: 'ดึก',       title: 'นอนไม่หลับทำอะไร?', sponsor: null },
  { id: 'thq20', category: 'ดึก',       title: 'เพลงที่อยากฟังคนเดียวตอนดึกๆ?', sponsor: null },
  { id: 'thq21', category: 'ทั่วไป',    title: 'อิโมจิที่ใช้บ่อยที่สุดคืออะไร?', sponsor: null },
  { id: 'thq3c', category: 'คอลแลบ',   title: 'ช่วงนี้รางวัลให้ตัวเองคืออะไร?', sponsor: 'mellow milk' },
];

export function getQuestionsForLang(lang: Lang): LocaleQuestion[] {
  const all = (() => {
    switch (lang) {
      case 'ja': return questionsJa;
      case 'ko': return questionsKo;
      case 'zh': return questionsZh;
      case 'zh-tw': return questionsZhTw;
      case 'th': return questionsTh;
      default: return questionsEn;
    }
  })();
  // スポンサー付き（PR/コラボのサンプル）は通常のお題一覧には出さない。
  // データ自体は残してあるので、正式なPR案件を扱うときに再利用できる。
  return all.filter((q) => !q.sponsor);
}
