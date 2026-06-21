import type { Lang } from './i18n';

export type LocaleConfig = {
  genderOptions: string[];
};

export const LOCALE_CONFIG: Record<Lang, LocaleConfig> = {
  ja:    { genderOptions: ['男性', '女性', 'ノンバイナリー', 'その他', '答えたくない'] },
  ko:    { genderOptions: ['남성', '여성', '논바이너리', '기타', '밝히고 싶지 않음'] },
  zh:    { genderOptions: ['男', '女', '非二元性别', '其他', '不方便透露'] },
  'zh-tw': { genderOptions: ['男', '女', '非二元性別', '其他', '不方便透露'] },
  th:    { genderOptions: ['ชาย', 'หญิง', 'เพศที่สาม', 'กะเทย', 'ทอม', 'ดี้', 'เกย์', 'เลสเบี้ยน', 'ทรานส์เจนเดอร์', 'ไบเซ็กชวล', 'ไม่ระบุ', 'อื่นๆ'] },
  id:    { genderOptions: ['Laki-laki', 'Perempuan', 'Non-biner', 'Lainnya', 'Tidak ingin menyebutkan'] },
  vi:    { genderOptions: ['Nam', 'Nữ', 'Phi nhị phân', 'Khác', 'Không muốn tiết lộ'] },
  tl:    { genderOptions: ['Lalaki', 'Babae', 'Non-binary', 'Bakla', 'Tomboy', 'Iba pa', 'Ayaw sabihin'] },
  ms:    { genderOptions: ['Lelaki', 'Perempuan', 'Bukan-biner', 'Lain-lain', 'Tidak mahu nyatakan'] },
  en:    { genderOptions: ['Male', 'Female', 'Non-binary', 'Genderfluid', 'Transgender', 'Prefer not to say'] },
  es:    { genderOptions: ['Hombre', 'Mujer', 'No binario', 'Fluido de género', 'Transgénero', 'Prefiero no decirlo'] },
  pt:    { genderOptions: ['Homem', 'Mulher', 'Não-binário', 'Gênero fluido', 'Transgênero', 'Prefiro não dizer'] },
  fr:    { genderOptions: ['Homme', 'Femme', 'Non-binaire', 'Fluide', 'Transgenre', 'Préfère ne pas dire'] },
  de:    { genderOptions: ['Männlich', 'Weiblich', 'Nicht-binär', 'Genderfluid', 'Transgender', 'Möchte nicht angeben'] },
  it:    { genderOptions: ['Uomo', 'Donna', 'Non-binario', 'Genere fluido', 'Transgender', 'Preferisco non dirlo'] },
  ru:    { genderOptions: ['Мужской', 'Женский', 'Небинарный', 'Гендерфлюид', 'Трансгендер', 'Не хочу указывать'] },
  ar:    { genderOptions: ['ذكر', 'أنثى', 'غير ثنائي', 'أخرى', 'أفضل عدم الإفصاح'] },
  hi:    { genderOptions: ['पुरुष', 'महिला', 'नॉन-बाइनरी', 'तृतीय लिंग', 'अन्य', 'नहीं बताना चाहते'] },
  tr:    { genderOptions: ['Erkek', 'Kadın', 'İkili olmayan', 'Diğer', 'Belirtmek istemiyorum'] },
  nl:    { genderOptions: ['Man', 'Vrouw', 'Non-binair', 'Genderfluid', 'Transgender', 'Zeg ik liever niet'] },
};

export function getGenderOptions(lang: Lang): string[] {
  return LOCALE_CONFIG[lang]?.genderOptions ?? LOCALE_CONFIG.en.genderOptions;
}
