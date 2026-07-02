import type { Lang } from './i18n';

// ── SNSシェアターゲット（言語ごとに主要SNSを出し分け） ──────────

export type SharePlatformId =
  | 'line' | 'instagram' | 'x' | 'facebook' | 'whatsapp'
  | 'telegram' | 'vk' | 'weibo' | 'wechat' | 'red' | 'kakao' | 'zalo';

export type ShareKind =
  | 'url'    // Web共有URLを新規タブで開く（ワンタッチ投稿）
  | 'copy'   // リンクをコピーしてアプリ内で貼り付けてもらう（WeChat等、Web共有URL非対応）
  | 'image'; // シェア画像を端末の共有シート/保存経由で渡す（ストーリーズ・RED等）

export type SharePlatform = {
  id: SharePlatformId;
  label: string;
  color: string;            // ブランドカラー（ボタン背景）
  textColor?: string;       // 文字色（デフォルト白）
  kind: ShareKind;
  buildUrl?: (url: string, text: string) => string;
  hintKey?: 'hint_wechat' | 'hint_copied' | 'hint_image_saved';
};

export const SHARE_PLATFORMS: Record<SharePlatformId, SharePlatform> = {
  line: {
    id: 'line', label: 'LINE', color: '#06C755', kind: 'url',
    buildUrl: (url, text) =>
      `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  instagram: {
    id: 'instagram', label: 'Stories',
    color: 'linear-gradient(45deg,#f9ce34,#ee2a7b,#6228d7)', kind: 'image',
    hintKey: 'hint_image_saved',
  },
  x: {
    id: 'x', label: 'X', color: '#000000', kind: 'url',
    buildUrl: (url, text) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
  facebook: {
    id: 'facebook', label: 'Facebook', color: '#1877F2', kind: 'url',
    buildUrl: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  whatsapp: {
    id: 'whatsapp', label: 'WhatsApp', color: '#25D366', kind: 'url',
    buildUrl: (url, text) => `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
  },
  telegram: {
    id: 'telegram', label: 'Telegram', color: '#229ED9', kind: 'url',
    buildUrl: (url, text) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  vk: {
    id: 'vk', label: 'VK', color: '#0077FF', kind: 'url',
    buildUrl: (url, text) =>
      `https://vk.com/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`,
  },
  weibo: {
    id: 'weibo', label: '微博', color: '#E6162D', kind: 'url',
    buildUrl: (url, text) =>
      `https://service.weibo.com/share/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`,
  },
  wechat: {
    id: 'wechat', label: '微信', color: '#07C160', kind: 'copy', hintKey: 'hint_wechat',
  },
  red: {
    id: 'red', label: '小红书', color: '#FF2442', kind: 'image', hintKey: 'hint_image_saved',
  },
  kakao: {
    id: 'kakao', label: '카카오톡', color: '#FEE500', textColor: '#191919', kind: 'copy', hintKey: 'hint_copied',
  },
  zalo: {
    id: 'zalo', label: 'Zalo', color: '#0068FF', kind: 'copy', hintKey: 'hint_copied',
  },
};

// 言語ごとの表示SNS（初期設定言語の文化圏で主要なもの）
export const SHARE_TARGETS_BY_LANG: Record<Lang, SharePlatformId[]> = {
  ja:      ['line', 'instagram', 'x'],
  en:      ['instagram', 'x', 'whatsapp', 'facebook'],
  ko:      ['kakao', 'instagram', 'x'],
  zh:      ['wechat', 'red', 'weibo'],
  'zh-tw': ['line', 'instagram', 'facebook'],
  th:      ['line', 'instagram', 'facebook'],
  id:      ['whatsapp', 'instagram', 'x'],
  vi:      ['zalo', 'facebook', 'instagram'],
  tl:      ['facebook', 'instagram', 'whatsapp'],
  ms:      ['whatsapp', 'instagram', 'x'],
  es:      ['whatsapp', 'instagram', 'facebook'],
  pt:      ['whatsapp', 'instagram', 'facebook'],
  fr:      ['whatsapp', 'instagram', 'x'],
  de:      ['whatsapp', 'instagram', 'x'],
  it:      ['whatsapp', 'instagram', 'facebook'],
  ru:      ['telegram', 'vk', 'whatsapp'],
  ar:      ['whatsapp', 'instagram', 'x'],
  hi:      ['whatsapp', 'instagram', 'x'],
  tr:      ['whatsapp', 'instagram', 'x'],
  nl:      ['whatsapp', 'instagram', 'x'],
};

export function getShareTargets(lang: Lang): SharePlatform[] {
  const ids = SHARE_TARGETS_BY_LANG[lang] ?? SHARE_TARGETS_BY_LANG.en;
  return ids.map((id) => SHARE_PLATFORMS[id]);
}

// ── シェアモーダル用ミニ辞書（未定義言語は en にフォールバック） ──

type ShareDict = {
  sns_row_label: string;   // 「SNSでシェア」見出し
  share_text: string;      // シェア本文（%name 置換）
  hint_copied: string;     // リンクコピー後の案内
  hint_wechat: string;     // WeChat向け案内
  hint_image_saved: string;// 画像保存後の案内（ストーリーズ等）
  img_scan: string;        // 画像内QRラベル
  img_more: string;        // 画像内チラ見せの続き文言
};

const SHARE_DICT: Partial<Record<Lang, ShareDict>> = {
  ja: {
    sns_row_label: 'SNSでシェア',
    share_text: '%nameのMiriプロフィール帳',
    hint_copied: 'リンクをコピーしました！アプリに貼り付けてシェアしてね',
    hint_wechat: 'リンクをコピーしました！WeChatで貼り付けてシェアしてね',
    hint_image_saved: '画像を用意しました！ストーリーズや投稿に貼ってね',
    img_scan: 'QRで開く',
    img_more: 'つづきはMiriで',
  },
  en: {
    sns_row_label: 'Share to social',
    share_text: "%name's Miri profile book",
    hint_copied: 'Link copied! Paste it in the app to share',
    hint_wechat: 'Link copied! Paste it in WeChat to share',
    hint_image_saved: 'Image ready! Post it to your story or feed',
    img_scan: 'Scan to open',
    img_more: 'See more on Miri',
  },
  ko: {
    sns_row_label: 'SNS에 공유',
    share_text: '%name님의 Miri 프로필북',
    hint_copied: '링크를 복사했어요! 카카오톡에 붙여넣어 공유하세요',
    hint_wechat: '링크를 복사했어요! 앱에 붙여넣어 공유하세요',
    hint_image_saved: '이미지 준비 완료! 스토리에 올려보세요',
    img_scan: 'QR로 열기',
    img_more: '자세한 내용은 Miri에서',
  },
  zh: {
    sns_row_label: '分享到社交平台',
    share_text: '%name的Miri个人档案',
    hint_copied: '链接已复制！粘贴到应用里分享吧',
    hint_wechat: '链接已复制！去微信粘贴分享，或让对方扫二维码',
    hint_image_saved: '图片已准备好！发到小红书或朋友圈吧',
    img_scan: '扫码打开',
    img_more: '更多内容在Miri',
  },
  'zh-tw': {
    sns_row_label: '分享到社群',
    share_text: '%name的Miri個人檔案',
    hint_copied: '連結已複製！貼到應用程式裡分享吧',
    hint_wechat: '連結已複製！貼到WeChat分享吧',
    hint_image_saved: '圖片已準備好！發到限時動態吧',
    img_scan: '掃碼開啟',
    img_more: '更多內容在Miri',
  },
  th: {
    sns_row_label: 'แชร์ไปยังโซเชียล',
    share_text: 'โปรไฟล์ Miri ของ %name',
    hint_copied: 'คัดลอกลิงก์แล้ว! วางในแอปเพื่อแชร์',
    hint_wechat: 'คัดลอกลิงก์แล้ว! วางใน WeChat เพื่อแชร์',
    hint_image_saved: 'รูปพร้อมแล้ว! โพสต์ลงสตอรี่ได้เลย',
    img_scan: 'สแกนเพื่อเปิด',
    img_more: 'ดูต่อได้ที่ Miri',
  },
  vi: {
    sns_row_label: 'Chia sẻ lên mạng xã hội',
    share_text: 'Sổ hồ sơ Miri của %name',
    hint_copied: 'Đã sao chép liên kết! Dán vào Zalo để chia sẻ',
    hint_wechat: 'Đã sao chép liên kết! Dán vào ứng dụng để chia sẻ',
    hint_image_saved: 'Ảnh đã sẵn sàng! Đăng lên story nhé',
    img_scan: 'Quét để mở',
    img_more: 'Xem thêm trên Miri',
  },
  ru: {
    sns_row_label: 'Поделиться в соцсетях',
    share_text: 'Профиль Miri: %name',
    hint_copied: 'Ссылка скопирована! Вставьте её в приложение',
    hint_wechat: 'Ссылка скопирована! Вставьте её в WeChat',
    hint_image_saved: 'Картинка готова! Опубликуйте её в сторис',
    img_scan: 'Сканируй, чтобы открыть',
    img_more: 'Продолжение в Miri',
  },
};

export function shareT(key: keyof ShareDict, lang: Lang): string {
  return SHARE_DICT[lang]?.[key] ?? SHARE_DICT.en![key];
}

export function buildShareText(name: string, lang: Lang): string {
  return shareT('share_text', lang).replace('%name', name);
}
