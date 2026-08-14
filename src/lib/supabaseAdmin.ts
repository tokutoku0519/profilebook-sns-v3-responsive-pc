import { createClient } from '@supabase/supabase-js';

// サーバー専用の Supabase クライアント（service role）。RLSを迂回してコインを付与するため、
// Webhook など「決済を検証したサーバー処理」からのみ使う。絶対にクライアントへ渡さない。
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin =
  url && serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;
