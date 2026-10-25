import { createClient } from '@supabase/supabase-js';
import { collectProperNames } from './properNames';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// データベース（REST）の応答に含まれるユーザー名を、画面の自動翻訳から守る一覧へ登録する。
// 応答そのものは変えずに、写しを読むだけ（失敗しても通信には影響しない）。
const fetchCollectingNames: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  try {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (typeof window !== 'undefined' && res.ok && url.includes('/rest/v1/') && (res.headers.get('content-type') ?? '').includes('json')) {
      res.clone().json().then(collectProperNames).catch(() => {});
    }
  } catch {}
  return res;
};

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, { global: { fetch: fetchCollectingNames } })
  : null;
