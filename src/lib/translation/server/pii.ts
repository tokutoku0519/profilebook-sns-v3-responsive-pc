// ============================================================
// 外部の翻訳サービスへ送る前の個人情報のチェック（サーバー専用）
//
// 方針（安全側）
//  ・送らない（翻訳せず原文のまま）
//    - 連絡先：メールアドレス・電話番号・郵便番号・LINE などの ID の書きこみ（contact）
//    - 住所：都道府県＋市区町村＋番地、丁目＋番地、部屋番号など（address）
//    - 要配慮個人情報にかかわる内容（sensitive）
//      * 強い語（病名・前科・障害の種類・性的指向の告白など）は、それだけで送らない
//      * 弱い語（病院・宗教・国籍・犯罪など）は、本人や身近な人のこととして書かれているとき
//        （私・母・友達・〜さん などが近くにある）だけ送らない。ドラマ・映画・ごっこ などの話題は送る
//  ・伏せ字にして送る：URL・SNS の @ID → ⟦k3f⟧ のようなランダムな記号に置きかえ、訳文で元に戻す
//    （記号がちょうど 1 回ずつ残っていなければ失敗として原文を出す。AI が記号を変えても誤って戻さない）
//  ・判定は全角・半角をそろえて（NFKC）から行う（「０９０−１２３４−５６７８」も見つける）
// 目的は「本人や第三者の個人情報を外へ出す量を減らす」こと。完全な検出は保証しない（ポリシーにもそう書く）。
// 評価：scripts/translate-test/pii-cases.json（架空の文だけ）
// ============================================================
import { randomBytes } from 'node:crypto';

export type BlockReason = 'contact' | 'address' | 'sensitive';
export type Screened =
  | { ok: true; text: string; tokens: Array<{ token: string; value: string }> }
  | { ok: false; reason: BlockReason };

// 全角・半角をそろえ、漢数字（〇一二…九。3 文字以上続くときだけ）を数字に、数字のあいだのいろいろな横棒（− ー ‐ – など）を「-」にそろえる
const KANJI_DIGIT: Record<string, string> = { '〇': '0', '零': '0', '一': '1', '二': '2', '三': '3', '四': '4', '五': '5', '六': '6', '七': '7', '八': '8', '九': '9' };
const nfkc = (s: string) => s.normalize('NFKC')
  .replace(/[〇零一二三四五六七八九](?:[\s\-ー－−]?[〇零一二三四五六七八九]){2,}/g, (m) => m.replace(/[〇零一二三四五六七八九]/g, (c) => KANJI_DIGIT[c]))
  .replace(/(?<=\d)\s?[‐‑‒–—―−ーｰ－]\s?(?=\d)/g, '-');

// ── 連絡先（見つけたら送らない）────────────────────────────────
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/;
// 「alice at example dot com」「アットマーク」のような書き方
const EMAIL_SPELLED = /[A-Za-z0-9._%+-]{2,}\s*(?:\(at\)|\[at\]|\sat\s|アット(?:マーク)?|あっと)\s*[A-Za-z0-9-]{2,}\s*(?:\(dot\)|\[dot\]|\sdot\s|ドット|どっと|\.)\s*[A-Za-z]{2,}/i;
// 電話番号：0 から始まる 10〜11 桁、または +81。区切り（- 空白 括弧 ． 「の」）を許す。数字だけ数えて判定する
const PHONE_CANDIDATE = /(?<![\d])(?:\+81[\s-]?|0)[\s\-().の]?\d(?:[\s\-().の]?\d){8,11}(?![\d])/g;
const POSTAL = /(?:〒\s?\d{3}-?\d{4}|(?<![\d-])\d{3}-\d{4}(?![\d-]))/;
const MESSENGER_ID = /(?:LINE|ライン|らいん|カカオ|kakao|wechat|ウィーチャット|discord|ディスコ|telegram|テレグラム|skype)\s*(?:ID|ＩＤ|アイディー|id)?\s*[:：は]?\s*[A-Za-z0-9._-]{3,}/i;
// SNS のアカウント名（@ なし）：「インスタ: miri_fan」「X は miri123」など。名前の前に SNS 名と区切りがあるときだけ
const SNS_HANDLE = /(?:インスタ(?:グラム)?|instagram|insta|ツイッター|twitter|tiktok|ティックトック|threads|スレッズ|youtube|ユーチューブ|(?<![A-Za-z])X)\s*(?:の)?\s*(?:ID|ＩＤ|アカ(?:ウント)?|垢)?\s*[:：は]\s*[A-Za-z0-9._]{3,30}/i;
// カード番号・マイナンバー・口座番号など、区切りを含めて 12〜19 桁の数字の並び（電話番号より長い）
const LONG_NUMBER = /(?<![\d])\d(?:[\s-]?\d){11,18}(?![\d])/;

function hasPhone(t: string): boolean {
  for (const m of t.match(PHONE_CANDIDATE) ?? []) {
    const digits = m.replace(/\D/g, '');
    if (m.startsWith('+81') ? digits.length >= 11 && digits.length <= 12 : digits.length >= 10 && digits.length <= 11) return true;
  }
  return false;
}

// ── 住所（見つけたら送らない）──────────────────────────────────
const PREF = '(?:東京都|北海道|(?:京都|大阪)府|(?:青森|岩手|宮城|秋田|山形|福島|茨城|栃木|群馬|埼玉|千葉|神奈川|新潟|富山|石川|福井|山梨|長野|岐阜|静岡|愛知|三重|滋賀|兵庫|奈良|和歌山|鳥取|島根|岡山|広島|山口|徳島|香川|愛媛|高知|福岡|佐賀|長崎|熊本|大分|宮崎|鹿児島|沖縄)県)';
const ADDRESS_RULES: RegExp[] = [
  new RegExp(`${PREF}\\S{0,12}?[市区町村郡]\\S{0,20}?\\d{1,4}\\s?(?:丁目|番地?|号|-|－)`),          // 東京都渋谷区神宮前1丁目 / 横浜市中区1-2
  /[市区町村]\S{0,12}?\d{1,4}\s?丁目\s?\d{1,4}/,                                                  // 〜区3丁目5
  /[市区町村]\S{0,12}?\d{1,4}-\d{1,4}(?:-\d{1,4})?/,                                               // 〜町1-2-3
  /\d{1,4}\s?番地\s?\d{0,4}/,                                                                       // 12番地
  /\S{1,20}(?:マンション|ハイツ|アパート|荘|コーポ|レジデンス|ビル)\s?\d{1,4}\s?(?:号室|号|階)/,     // 〜マンション203号室
  /\d{2,4}\s?号室/,
  /\S{1,15}(?:小学校?|中学校?|高校|高等学校|学園|学院)\s?の?\s?\d\s?年\s?\d{1,2}\s?組/,                  // 〇〇中学の2年3組（学校とクラスで本人が分かる）
];

// ── 要配慮の内容 ───────────────────────────────────────────
// ① それだけで送らない：前科・出自・手帳・生活保護・信仰や党への所属の表明など、話題として出ることが少なく、出れば本人などの情報である語
const SENSITIVE_ALWAYS = /(障害者手帳|療育手帳|精神障害者保健福祉手帳|前科|犯罪歴|逮捕歴|服役|執行猶予|少年院|被差別部落|部落出身|生活保護を受|生活保護受給|性同一性障害|カミングアウト|余命|HIV陽性|中絶|不妊治療|持病|闘病中|服薬中|投薬中|抗うつ薬|精神科に|心療内科に|(?:創価学会|エホバ|統一教会|幸福の科学|天理教|立正佼成会)(?:の|に|を)?(?:信者|会員|入信|入会)|党員です|支持政党は|入信し|改宗し|洗礼を受け)/i;
// ② 病名・障害・性的指向など：本人などのこととして書かれているとき（「です」「と診断」などが続く、または私・母・〜さん などが近くにある）
const SENSITIVE_CONDITION = /(うつ病|鬱病|躁うつ|双極性障害|統合失調症|発達障害|ADHD|自閉症|自閉スペクトラム|アスペルガー|パニック障害|適応障害|摂食障害|拒食症|過食症|強迫性障害|PTSD|てんかん|認知症|精神障害|知的障害|身体障害|白血病|癌|(?<![ぁ-ん])がん(?![ばぼぶべ張])|HIV|エイズ|性病|同性愛者?|ゲイ|レズビアン|バイセクシャル|トランスジェンダー|LGBT)/gi;
const DISCLOSURE_AFTER = /^.{0,4}(です|だよ|だった|でした|と診断|持ち|になっ|を患|が悪化|で通院|で入院|の薬|と言われ|の治療|がある|が見つか|を公表)/;
// ③ 一般的な語：本人などのこととして書かれているとき（私・母・友達・〜さん などが近くにある）だけ
const SENSITIVE_WEAK = /(病気|病院|通院|入院|手術|診断|障害|障がい|妊娠|宗教|信仰|国籍|人種|犯罪|逮捕|被害届|政党|選挙で|薬を飲|治療|リハビリ|性別)/g;
const PERSONAL = /(私|わたし|あたし|僕|ぼく|俺|おれ|自分|うちの(?:母|父|親|家族|子)|母|父|ママ|パパ|姉|兄|妹|弟|祖母|祖父|おばあちゃん|おじいちゃん|家族|親|夫|妻|旦那|嫁|彼氏|彼女|友達|友人|親友|息子|娘|子ども|子供|さん|くん|君|ちゃん|先輩|後輩|先生|クラスの)/;
// 話題・作品の中の語（病院ごっこ・犯罪ドラマ・宗教画・LGBT映画など）は数えない
const FICTION_AFTER = /^.{0,3}(ドラマ|映画|アニメ|漫画|マンガ|まんが|小説|ゲーム|ごっこ|ニュース|番組|もの|系|画|建築|史|学|の歴史|の授業|の勉強|ミステリー|サスペンス|について|に関する|の本|フレンドリー|の理解)/;

function personalNear(t: string, i: number, len: number): boolean {
  return PERSONAL.test(t.slice(Math.max(0, i - 12), i) + t.slice(i + len, i + len + 12));
}
function sensitive(t: string): boolean {
  if (SENSITIVE_ALWAYS.test(t)) return true;
  for (const m of t.matchAll(SENSITIVE_CONDITION)) {
    const i = m.index ?? 0, after = t.slice(i + m[0].length);
    if (FICTION_AFTER.test(after)) continue;
    if (DISCLOSURE_AFTER.test(after) || personalNear(t, i, m[0].length)) return true;
  }
  for (const m of t.matchAll(SENSITIVE_WEAK)) {
    const i = m.index ?? 0, after = t.slice(i + m[0].length);
    if (FICTION_AFTER.test(after)) continue;
    if (personalNear(t, i, m[0].length)) return true;
  }
  return false;
}

// ── 伏せ字にして送るもの ──────────────────────────────────────
const MASKS: RegExp[] = [
  /(?:https?:\/\/|www\.)[^\s　]+/gi,                     // URL
  /(?<![A-Za-z0-9_@.])@[A-Za-z0-9_.]{2,30}/g,             // SNS の @ID
];
const TOKEN_RE = /⟦[^⟦⟧]*⟧/g;

export function screenPersonalInfo(text: string): Screened {
  const t = nfkc(text);
  if (EMAIL.test(t) || EMAIL_SPELLED.test(t) || hasPhone(t) || POSTAL.test(t) || MESSENGER_ID.test(t) || SNS_HANDLE.test(t) || LONG_NUMBER.test(t)) return { ok: false, reason: 'contact' };
  if (ADDRESS_RULES.some((re) => re.test(t))) return { ok: false, reason: 'address' };
  if (sensitive(t)) return { ok: false, reason: 'sensitive' };
  // 原文にもともと ⟦ ⟧ があると、戻すときに区別できないので送らない（ふつうは使われない記号）
  if (/[⟦⟧]/.test(text)) return { ok: false, reason: 'contact' };
  const tokens: Array<{ token: string; value: string }> = [];
  let out = text;
  for (const re of MASKS) {
    out = out.replace(re, (m) => {
      const token = `⟦${randomBytes(2).toString('hex')}${tokens.length}⟧`;
      tokens.push({ token, value: m });
      return token;
    });
  }
  return { ok: true, text: out, tokens };
}

/** 訳文の伏せ字を元に戻す。次のときは null（翻訳失敗として原文を出す）
 *  ・どれかの記号がちょうど 1 回ずつ残っていない（消えた・増えた・書きかえられた）
 *  ・知らない記号や、⟦ ⟧ の片方だけが残っている */
export function restoreMasked(translated: string, tokens: Array<{ token: string; value: string }>): string | null {
  const known = new Map(tokens.map((x) => [x.token, x.value]));
  const found = translated.match(TOKEN_RE) ?? [];
  if (found.length !== tokens.length) return null;
  const seen = new Set<string>();
  for (const f of found) {
    if (!known.has(f) || seen.has(f)) return null;
    seen.add(f);
  }
  const replaced = translated.replace(TOKEN_RE, (m) => known.get(m)!);
  // 記号を取り除いたあとに ⟦ ⟧ が残っていれば、記号がこわれている
  if (/[⟦⟧]/.test(translated.replace(TOKEN_RE, ''))) return null;
  return replaced;
}
