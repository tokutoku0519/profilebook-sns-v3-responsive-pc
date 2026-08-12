// 公開URL（サイトマップ・記事リンク用）。NEXT_PUBLIC_SITE_URL があれば優先、
// なければ Vercel の割り当てドメイン、いずれも無ければ本番エイリアス。
export function siteUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'https://miriapp.vercel.app';
}
