import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/siteUrl';

// 公開ブログ記事（/b/*）はクロール許可。ログイン後のアプリ画面はインデックス不要。
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: ['/', '/b/'], disallow: ['/setup', '/welcome', '/auth/'] },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
