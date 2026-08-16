// ============================================================
//  企業コラボ・キャンペーン登録所（Miri Creator Kit のバックエンド最小版）
//
//  1ブランドのコラボは「スタンプ / 背景 / PR質問」を横断して束ねる。
//  実アイテムは既存の配列に追記して作る（下記の各ファイル）：
//    - スタンプ  … src/lib/stickerPacks.ts の STICKER_PACKS に collab:true で追記
//    - 背景      … src/lib/bgThemes.ts の BG_THEMES に追記
//    - PR質問    … src/lib/prQuestions.ts の PR_QUESTIONS に追記
//  そのうえで、このファイルの BRAND_CAMPAIGNS に「どのIDが1ブランド分か」を
//  ブランド情報・公開状態・掲載期間つきで登録する。
//
//  ■ 掲載の流れ（審査→公開）
//    企業から素材受領 → 上記配列にアイテム追記 → ここに campaign を追記
//    → status を 'published' にして main へ push（デプロイで即公開）。
//    掲載終了は status を 'ended' にするか endAt を過去日時にするだけ。
// ============================================================
import { STICKER_PACKS, type StickerPack } from './stickerPacks';
import { BG_THEMES, type BgTheme } from './bgThemes';
import { PR_QUESTIONS, type PRQuestion } from './prQuestions';

export type BrandCampaign = {
  id: string;
  brand: string;          // ブランド／企業名
  logo: string;           // ロゴ（絵文字 or 画像URL）
  color: string;          // アクセントカラー（#hex）
  blurb: string;          // ひとこと紹介
  status: 'draft' | 'published' | 'ended';
  startAt?: string;       // 掲載開始（ISO）。未指定なら即時
  endAt?: string;         // 掲載終了（ISO）。未指定なら無期限
  stickerPackId?: string; // STICKER_PACKS の id
  bgThemeId?: string;     // BG_THEMES の id
  prQuestionId?: string;  // PR_QUESTIONS の id
};

// ← 各コラボはここに追記する（例として自社ショーケースを1件掲載）
export const BRAND_CAMPAIGNS: BrandCampaign[] = [
  {
    id: 'campaign-miri-showcase',
    brand: 'Miri',
    logo: '🎀',
    color: '#EC4899',
    blurb: 'コラボ掲載のサンプル。御社のスタンプ・背景・お題をここに並べられます。',
    status: 'published',
    stickerPackId: 'miri-basic',
    bgThemeId: 'bg-umi',
    prQuestionId: 'pr-1',
  },
];

export function isCampaignLive(c: BrandCampaign, now = Date.now()): boolean {
  if (c.status !== 'published') return false;
  if (c.startAt && Date.parse(c.startAt) > now) return false;
  if (c.endAt && Date.parse(c.endAt) < now) return false;
  return true;
}

export function activeBrandCampaigns(now = Date.now()): BrandCampaign[] {
  return BRAND_CAMPAIGNS.filter((c) => isCampaignLive(c, now));
}

export type CampaignAssets = {
  sticker: StickerPack | null;
  bg: BgTheme | null;
  pr: PRQuestion | null;
};

// キャンペーンに紐づく実アイテムを既存配列から解決する
export function campaignAssets(c: BrandCampaign): CampaignAssets {
  return {
    sticker: c.stickerPackId ? (STICKER_PACKS.find((p) => p.id === c.stickerPackId) ?? null) : null,
    bg: c.bgThemeId ? (BG_THEMES.find((b) => b.id === c.bgThemeId) ?? null) : null,
    pr: c.prQuestionId ? (PR_QUESTIONS.find((q) => q.id === c.prQuestionId) ?? null) : null,
  };
}
