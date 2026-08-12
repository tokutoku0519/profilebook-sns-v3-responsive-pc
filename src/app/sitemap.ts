import type { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabase';
import { siteUrl } from '@/lib/siteUrl';

export const dynamic = 'force-dynamic';

// 公開ブログ記事をサイトマップに載せて検索インデックスを促す。
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const entries: MetadataRoute.Sitemap = [{ url: `${base}/`, changeFrequency: 'daily', priority: 0.8 }];
  try {
    if (supabase) {
      const { data } = await supabase
        .from('blog_posts')
        .select('id,created_at,visibility')
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .limit(1000);
      for (const row of (data ?? []) as { id: string; created_at: string }[]) {
        entries.push({ url: `${base}/b/${row.id}`, lastModified: new Date(row.created_at), changeFrequency: 'weekly', priority: 0.6 });
      }
    }
  } catch { /* Supabase未設定時などは記事なしでOK */ }
  return entries;
}
