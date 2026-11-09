// ============================================================
// 翻訳の許可（外国にある第三者への提供への同意）の説明文 — 版つき
//
// ・個人情報保護法 28 条 2 項（施行規則 17 条 2 項）で同意の前に示す情報：外国の名称／その国の制度／提供先の措置
//   ＋ 送る内容・送るとき・保存期間・取り消し方法・年齢・ほかの人の情報
// ・文言を変えたら CONSENT_VERSION を上げる。許可していた人は、新しい版を確認するまで新しい送信を止める。
// ・同意の記録には「版」と「表示した文言のハッシュ」を残す（ハッシュはサーバーがこの定義から計算する）。
// ・法務レビュー前の案（版の末尾が -draft）。公開前に文言を確定して版を上げる。
// ・説明は日本語と英語で用意する（ほかの言語の表示では英語を出す）。
// ============================================================
import type { Lang } from '@/lib/i18n';

export const CONSENT_VERSION = '2026-11-v2-draft';
export type ConsentLocale = 'ja' | 'en';
export const consentLocaleFor = (lang: Lang): ConsentLocale => (lang === 'ja' ? 'ja' : 'en');

/** 外国の制度について、個人情報保護委員会が公表している情報。個別のページの URL は作業環境から確認できなかったため、
 *  確実なトップページと資料名を示す（「外国における個人情報の保護に関する制度等の調査」） */
export const PPC_FOREIGN_SYSTEMS_URL = 'https://www.ppc.go.jp/';
export const PPC_FOREIGN_SYSTEMS_TITLE_JA = '個人情報保護委員会のウェブサイトで公表されている「外国における個人情報の保護に関する制度等の調査」（アメリカ）';
export const PPC_FOREIGN_SYSTEMS_TITLE_EN = 'the survey of foreign personal information protection systems (United States) published on the website of Japan\'s Personal Information Protection Commission';
export const ANTHROPIC_DPA_URL = 'https://www.anthropic.com/legal/data-processing-addendum';
export const ANTHROPIC_TERMS_URL = 'https://www.anthropic.com/legal/commercial-terms';

/** 翻訳を許可できる年齢（法定年齢の断定ではなく、運営上の暫定措置） */
export const MIN_CONSENT_AGE = 16;
/** 16 歳未満と入力したあと、もう一度入力できるまでの日数（すぐに別の年を入れて回避するのを防ぐ。生年月は保存しない） */
export const AGE_RETRY_DAYS = 7;

export type ConsentSection = { h: string; body: string[] };
export type ConsentText = {
  title: string;
  lead: string;
  sections: ConsentSection[];
  itemsHeading: string;
  itemsHelp: string;
  itemsEmpty: string;
  ageHeading: string;
  ageHelp: string;
  ageYear: string;
  ageMonth: string;
  ageUnder: string;
  ageLocked: string;
  ageInvalid: string;
  agree: string;
  grant: string;
  cancel: string;
  languageNote: string;
  policyLink: string;
  // マイページのカード
  cardTitle: string;
  cardOff: string;
  cardOpen: string;
  cardOn: (version: string, date: string, count: number) => string;
  cardReconfirm: string;
  cardEditItems: string;
  cardReview: string;
  cardRevoke: string;
  revokeConfirm: string;
  saveItems: string;
  saved: string;
  revoked: string;
  failed: string;
  sectionLabels: Record<string, string>;
  answerLabel: string;
  /** 本人向け：この項目は翻訳されない理由（候補の一覧に出す） */
  blocked: Record<'contact' | 'address' | 'sensitive', string>;
};

export const CONSENT_TEXT: Record<ConsentLocale, ConsentText> = {
  ja: {
    title: '翻訳を許可する前に確認してください',
    lead: 'ほかの言語で見ている人が「翻訳を見る」を押したとき、あなたが選んだ公開中の回答を、AIで翻訳して表示します。翻訳のため、回答の文章が外国の事業者に送られます。',
    sections: [
      { h: '送り先（外国の名称）', body: ['Anthropic, PBC（アメリカ合衆国）。翻訳には同社のAIモデル（Claude）を使います。', '翻訳の処理（推論）はアメリカ国内の設備に限る設定にしています。Anthropic側でデータを保存する地域もアメリカです。'] },
      { h: '送る内容', body: ['翻訳する回答の文章、その質問文、翻訳先の言語、翻訳の指示（固有名詞の扱いなど）。', '名前・ユーザーID・メールアドレスなどの登録情報や、翻訳を見た人の情報は付けません。', 'ただし、文章の中に名前などが書かれていれば、それも送られます。', 'メールアドレス・電話番号・郵便番号・住所・LINEのIDなどの連絡先を含む文章と、健康・信条などの配慮が必要な内容を自分や身近な人のこととして書いた文章は、送らずに原文のまま表示します。URLとSNSのID（@で始まるもの）は伏せ字にしてから送ります。自動の判定のため、すべてを見つけられるとは限りません。'] },
      { h: '送らないもの', body: ['フォロワー限定・非公開にした内容、あなたが翻訳の対象に選んでいない項目・回答、日記・ブログ・コメント。'] },
      { h: '送るとき', body: ['ほかの言語の人が「翻訳を見る」を押したとき。同じ文章を同じ言語に翻訳した結果があるときは送りません。翻訳に失敗したときは、改めて送ることがあります。'] },
      { h: 'アメリカの個人情報保護制度', body: ['アメリカには、日本の個人情報保護法のように民間事業者全般を対象とする包括的な連邦法はなく、分野ごとの連邦法や州法で個人情報が保護されています。そのため、本人の権利（開示・削除の請求など）や事業者の義務が日本と異なる場合があります。', `詳しくは、${PPC_FOREIGN_SYSTEMS_TITLE_JA}をご覧ください：${PPC_FOREIGN_SYSTEMS_URL}`] },
      { h: 'Anthropicが講じている措置', body: ['Anthropicは、Miriとの契約（利用規約・データ処理補足契約）で、次のことを定めています：Miriの指示の範囲でだけ処理する／送られた内容をAIの学習に使わない／保存時と通信時に暗号化する／再委託先を公表し、追加の前に通知する／本人からの請求への対応に協力する。', `契約：${ANTHROPIC_TERMS_URL} ・ ${ANTHROPIC_DPA_URL}`] },
      { h: 'Anthropicでの保存', body: ['Anthropicの公表している方針では、送られた文章と翻訳結果は、保存されないか、保存される場合でも原則30日以内に削除されます。', 'ただし、法令上必要な場合や、利用ルールに反するおそれがあると自動判定された場合は、最長2年保存されることがあります。Miriから個別に削除を指示することはできません。'] },
      { h: 'Miriでの保存と記録', body: ['翻訳結果は、同じ文章の翻訳に使い回すためMiriのデータベースに保存します。元の回答は変更しません。回答の編集・削除、公開範囲の変更、許可の取り消し、アカウントの削除のときに削除します。', 'あなたが許可・項目の変更・取り消しをした記録（日時・説明文の版・年齢の区分）と、翻訳のために送った記録（日時・送った項目・送り先・処理した地域。送信の結果が分からなかったときも含む）は、法令に基づく記録として、翻訳結果とは別に一定期間保存します。'] },
      { h: '取り消し方法', body: ['マイページの「プロフ帳と回答の翻訳」から、いつでも取り消せます。取り消した後は送りません。Miriに保存した翻訳結果は削除します。', 'すでにAnthropicに送った文章は、上の「Anthropicでの保存」に従って削除されます。取り消しても、すぐには削除されません。'] },
      { h: 'ほかの人の情報', body: ['回答にほかの人の名前・連絡先・写真など、その人を特定できる情報を書かないでください。'] },
    ],
    itemsHeading: '翻訳してよい項目を選んでください',
    itemsHelp: 'いま公開されている項目と回答だけが表示されます。選んだ項目は「公開して翻訳してよい」とあなたが確認したものとして扱います。あとから増やしたり減らしたりできます。',
    itemsEmpty: '翻訳できる公開中の項目・回答がありません。',
    ageHeading: '年齢の確認',
    ageHelp: '16歳未満の方と、生まれた年月を入力しない方は、いまは翻訳を許可できません（保護者の同意の仕組みは準備中です）。生まれた年月はサーバーで年齢の確認だけに使い、保存しません（記録には「16〜17歳」「18歳以上」の区分だけを残します）。',
    ageYear: '生まれた年',
    ageMonth: '月',
    ageUnder: '16歳未満のため、いまは翻訳を許可できません。',
    ageLocked: '16歳未満と入力されたため、しばらくのあいだ翻訳の許可はできません。',
    ageInvalid: '生まれた年月を正しく選んでください。',
    agree: '上の内容を確認し、選んだ項目を翻訳のために外国の事業者（Anthropic・アメリカ）へ送ることに同意します',
    grant: '許可する',
    cancel: 'やめる',
    languageNote: '',
    policyLink: 'プライバシーポリシー（翻訳機能）',
    cardTitle: 'プロフ帳と回答の翻訳',
    cardOff: 'ほかの言語で見ている人が「翻訳を見る」を押したとき、あなたが選んだ公開中の回答をAIで翻訳します。翻訳のため、回答の文章がアメリカの事業者（Anthropic）に送られます。いまは許可していません。',
    cardOpen: '内容を確認して許可する',
    cardOn: (v, d, n) => `許可しています（説明 ${v} に ${d} 同意・${n} 件を選択）。翻訳のため、選んだ回答の文章が Anthropic（アメリカ）に送られます。`,
    cardReconfirm: '説明が更新されました。もう一度確認するまで、新しい翻訳は止めています。',
    cardEditItems: '翻訳する項目を変える',
    cardReview: '説明を確認する',
    cardRevoke: '許可を取り消す',
    revokeConfirm: '取り消すと、以後は送られません。Miriに保存した翻訳は削除します。すでにAnthropicに送った文章は、Anthropicの方針に従って削除されます（すぐには削除されません）。取り消しますか？',
    saveItems: '選んだ項目で保存',
    saved: '保存しました',
    revoked: '翻訳の許可を取り消しました',
    failed: '保存できませんでした。公開範囲が変わった項目がないか確認して、もう一度お試しください。',
    sectionLabels: {
      catchphrase: 'ひとこと', message: '自己紹介', hometown: '出身地', favoriteFood: '好きな食べもの', dislikeFood: '苦手な食べもの',
      favoriteColor: '好きな色', favoriteCharacter: '好きなキャラクター', specialty: '特技', holiday: '休日の過ごし方', wantToGo: '行ってみたい場所',
      collection: '集めているもの', motto: '座右の銘', charmPoint: 'チャームポイント', dream: '将来の夢',
      __questions: 'ひとこと質問の回答', __best3: 'すきなもの BEST3', __monthly: '今月のBEST3・エピソード',
    },
    answerLabel: 'お題への回答',
    blocked: {
      contact: '連絡先（メール・電話番号・LINEのIDなど）を含むため、翻訳されません',
      address: '住所らしい内容を含むため、翻訳されません',
      sensitive: '健康・信条など配慮が必要な内容を含むため、翻訳されません',
    },
  },
  en: {
    title: 'Please read before allowing translation',
    lead: 'When someone viewing in another language taps "Show translation", your selected public answers are translated by AI. To translate them, the text of your answers is sent to a company outside Japan.',
    sections: [
      { h: 'Recipient (country)', body: ['Anthropic, PBC (United States). Its AI model (Claude) is used for translation.', 'Translation processing (inference) is restricted to facilities in the United States. Anthropic also stores data in the United States.'] },
      { h: 'What is sent', body: ['The text of the answer, its question, the target language, and translation instructions (such as how to handle names).', 'Your name, user ID, email address, and information about who viewed the translation are not attached.', 'If the text itself contains names, they are sent too.', 'Text containing contact details (email addresses, phone numbers, postal codes, addresses, LINE IDs and similar), and text describing sensitive matters such as health or beliefs about yourself or people close to you, is not sent and stays in the original. URLs and social media handles (starting with @) are masked before sending. Detection is automatic and cannot catch everything.'] },
      { h: 'What is not sent', body: ['Followers-only or private content, items or answers you have not selected for translation, diaries, blogs, and comments.'] },
      { h: 'When it is sent', body: ['When someone taps "Show translation". If the same text was already translated into the same language, nothing is sent. If translation fails, the text may be sent again.'] },
      { h: 'Privacy law in the United States', body: ['The United States has no comprehensive federal law covering all private businesses like Japan\'s Act on the Protection of Personal Information. Personal information is protected by sector-specific federal laws and state laws, so your rights (such as requesting access or deletion) and the company\'s obligations may differ from Japan.', `For details, see ${PPC_FOREIGN_SYSTEMS_TITLE_EN}: ${PPC_FOREIGN_SYSTEMS_URL}`] },
      { h: 'Measures taken by Anthropic', body: ['In its contract with Miri (Commercial Terms and Data Processing Addendum), Anthropic commits to: process data only on Miri\'s instructions; not use the content to train AI models; encrypt data at rest and in transit; publish its subprocessors and give notice before adding new ones; and help respond to requests from individuals.', `Contract: ${ANTHROPIC_TERMS_URL} · ${ANTHROPIC_DPA_URL}`] },
      { h: 'Storage at Anthropic', body: ['Under Anthropic\'s published policy, the text and translation are either not stored or, if stored, deleted within 30 days in principle.', 'However, they may be kept for up to 2 years where required by law or where automated systems flag a possible violation of its usage rules. Miri cannot instruct Anthropic to delete them individually.'] },
      { h: 'Storage and records at Miri', body: ['Translations are stored in Miri\'s database so the same text can be reused. Your original answer is not changed. Translations are deleted when you edit or delete the answer, change its visibility, withdraw permission, or delete your account.', 'Records of when you allowed, changed or withdrew permission (date, notice version and age group) and of what was sent for translation (date, item, recipient and processing region, including sends whose outcome was unknown) are kept separately from translations for a set period as records required by law.'] },
      { h: 'How to withdraw', body: ['You can withdraw at any time under "Translation of your profile book and answers" on My Page. After that, nothing is sent and translations stored by Miri are deleted.', 'Text already sent to Anthropic is deleted under "Storage at Anthropic" above; withdrawing does not delete it immediately.'] },
      { h: 'Other people\'s information', body: ['Please do not write other people\'s names, contact details, photos or anything else that identifies them in your answers.'] },
    ],
    itemsHeading: 'Choose what may be translated',
    itemsHelp: 'Only items and answers that are currently public are listed. Selecting an item means you confirm it is public and may be translated. You can change this later.',
    itemsEmpty: 'You have no public items or answers that can be translated.',
    ageHeading: 'Age check',
    ageHelp: 'Users under 16, and users who do not enter their birth year and month, cannot allow translation for now (parental consent is not available yet). Your birth year and month are checked on our server only for this purpose and are not stored (only the age group "16-17" or "18 or older" is recorded).',
    ageYear: 'Birth year',
    ageMonth: 'Month',
    ageUnder: 'You cannot allow translation because you are under 16.',
    ageLocked: 'Because an age under 16 was entered, translation cannot be allowed for a while.',
    ageInvalid: 'Please select a valid birth year and month.',
    agree: 'I have read the above and agree that my selected items are sent to a company outside Japan (Anthropic, United States) for translation',
    grant: 'Allow',
    cancel: 'Cancel',
    languageNote: 'This notice is shown in Japanese and English.',
    policyLink: 'Privacy Policy (translation)',
    cardTitle: 'Translation of your profile book and answers',
    cardOff: 'When someone viewing in another language taps "Show translation", your selected public answers are translated by AI. To do this, the text is sent to a company in the United States (Anthropic). Translation is currently not allowed.',
    cardOpen: 'Review and allow',
    cardOn: (v, d, n) => `Allowed (agreed to notice ${v} on ${d}; ${n} selected). To translate them, the text of your selected answers is sent to Anthropic (United States).`,
    cardReconfirm: 'The notice has been updated. New translations are paused until you review it again.',
    cardEditItems: 'Change what may be translated',
    cardReview: 'Review the notice',
    cardRevoke: 'Withdraw permission',
    revokeConfirm: 'After withdrawing, nothing will be sent and translations stored by Miri will be deleted. Text already sent to Anthropic is deleted under Anthropic\'s policy (not immediately). Withdraw?',
    saveItems: 'Save selection',
    saved: 'Saved',
    revoked: 'Translation permission withdrawn',
    failed: 'Could not save. Check whether the visibility of any item has changed, then try again.',
    sectionLabels: {
      catchphrase: 'A few words', message: 'About me', hometown: 'Hometown', favoriteFood: 'Favorite food', dislikeFood: 'Least favorite food',
      favoriteColor: 'Favorite color', favoriteCharacter: 'Favorite character', specialty: 'Special skill', holiday: 'How I spend days off', wantToGo: 'Places I want to visit',
      collection: 'Things I collect', motto: 'Motto', charmPoint: 'Charm point', dream: 'Dream',
      __questions: 'Mini Q&A answers', __best3: 'My top 3 favorites', __monthly: 'This month\'s top 3 and episode',
    },
    answerLabel: 'Topic answer',
    blocked: {
      contact: 'Not translated because it contains contact details (email, phone number, LINE ID, etc.)',
      address: 'Not translated because it appears to contain an address',
      sensitive: 'Not translated because it contains sensitive matters such as health or beliefs',
    },
  },
};

/** 日本時間の年・月（サーバーの時刻帯や端末の設定に左右されないように） */
export function jstYearMonth(now = new Date()): { y: number; m: number } {
  const d = new Date(now.getTime() + 9 * 3600_000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
}
/** 生まれた年月から満年齢（日本時間）。日が分からないので、誕生月は「月末生まれ」として少なめに数える。
 *  形がおかしい・未来の年月は null（年齢不明として扱う） */
export function ageFrom(year: number, month: number, now = new Date()): number | null {
  const { y, m } = jstYearMonth(now);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 || year < y - 120 || year > y || (year === y && month > m)) return null;
  let age = y - year;
  if (m <= month) age--;
  return age;
}
/** 同意の記録に残す年齢の区分（生年月そのものは残さない）。16 歳未満は区分なし（許可できない） */
export type AgeBand = '16_17' | '18_plus';
export const ageBandOf = (age: number): AgeBand | null => (age >= 18 ? '18_plus' : age >= MIN_CONSENT_AGE ? '16_17' : null);
