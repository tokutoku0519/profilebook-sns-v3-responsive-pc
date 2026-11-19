import { createClient } from '@supabase/supabase-js';
import { supabaseUrlOrNull } from './dbGuard';

// プレビューで検証用の印がなければ null（本番の DB につながない）
const supabaseUrl = supabaseUrlOrNull();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
