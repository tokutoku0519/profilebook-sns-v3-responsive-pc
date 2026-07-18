// ============================================================
// Miri データアクセス層（Supabase）
// 共有SNS＋永続化のMVP：プロフィール / 回答 / リアクション / コメント / フォロー
// すべてブラウザ側の supabase クライアント（@/lib/supabase）を利用する。
// supabase 未設定（null）の場合は安全に空を返す or 何もしない。
// ============================================================
import { supabase } from './supabase';

export type ProfileRow = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  cover_theme: string | null;
  book: Record<string, any>;
  is_official: boolean;
  titles: string[];
};

export type AnswerRow = {
  id: string;
  user_id: string;
  question_key: string;
  question_title: string;
  question_category: string | null;
  body: string | null;
  sticker: string | null;
  visibility: 'public' | 'followers' | 'private';
  created_at: string;
  // join
  profile?: Pick<ProfileRow, 'id' | 'username' | 'display_name' | 'avatar_url' | 'titles' | 'is_official'>;
  reactions?: { type: string; user_id: string }[];
};

export type CommentRow = {
  id: string;
  answer_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profile?: Pick<ProfileRow, 'username' | 'display_name' | 'avatar_url'>;
};

export const dbReady = () => !!supabase;

// ── 認証中ユーザー ────────────────────────────────────────
export async function getCurrentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

// ── プロフィール ──────────────────────────────────────────
export async function getMyProfile(): Promise<ProfileRow | null> {
  if (!supabase) return null;
  const uid = await getCurrentUserId();
  if (!uid) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).single();
  if (error) return null;
  return data as ProfileRow;
}

export async function getProfileByUsername(username: string): Promise<ProfileRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('username', username).single();
  if (error) return null;
  return data as ProfileRow;
}

/** プロフィール帳（book）を保存 */
export async function saveProfileBook(book: Record<string, any>): Promise<boolean> {
  if (!supabase) return false;
  const uid = await getCurrentUserId();
  if (!uid) return false;
  const { error } = await supabase
    .from('profiles')
    .update({ book, updated_at: new Date().toISOString() })
    .eq('id', uid);
  return !error;
}

/** ID・表示名・アバターなどの基本情報を保存（/setup で使用） */
export async function saveProfileIdentity(fields: {
  username?: string;
  display_name?: string;
  avatar_url?: string | null;
  cover_theme?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'not_configured' };
  const uid = await getCurrentUserId();
  if (!uid) return { ok: false, error: 'not_authenticated' };
  const { error } = await supabase
    .from('profiles')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', uid);
  if (error) {
    // username の unique 衝突など
    return { ok: false, error: error.code === '23505' ? 'username_taken' : error.message };
  }
  return { ok: true };
}

// ── 回答（お題への回答） ─────────────────────────────────
export async function upsertAnswer(a: {
  question_key: string;
  question_title: string;
  question_category?: string | null;
  body: string;
  sticker?: string | null;
  visibility?: 'public' | 'followers' | 'private';
}): Promise<AnswerRow | null> {
  if (!supabase) return null;
  const uid = await getCurrentUserId();
  if (!uid) return null;
  const { data, error } = await supabase
    .from('answers')
    .upsert(
      {
        user_id: uid,
        question_key: a.question_key,
        question_title: a.question_title,
        question_category: a.question_category ?? null,
        body: a.body,
        sticker: a.sticker ?? null,
        visibility: a.visibility ?? 'public',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,question_key' }
    )
    .select('*')
    .single();
  if (error) return null;
  return data as AnswerRow;
}

/** みんなの回答フィード（新着順）。profile とリアクションを同時取得。 */
export async function getFeed(limit = 50): Promise<AnswerRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('answers')
    .select(
      'id,user_id,question_key,question_title,question_category,body,sticker,visibility,created_at,' +
        'profile:profiles(id,username,display_name,avatar_url,titles,is_official),' +
        'reactions(type,user_id)'
    )
    .neq('visibility', 'private')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as unknown as AnswerRow[];
}

/** 特定ユーザーの回答一覧 */
export async function getAnswersByUser(userId: string): Promise<AnswerRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('answers')
    .select('id,user_id,question_key,question_title,question_category,body,sticker,visibility,created_at,reactions(type,user_id)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data ?? []) as unknown as AnswerRow[];
}

// ── リアクション ─────────────────────────────────────────
/** リアクションをトグル（付いていれば外す／無ければ付ける）。付与後の状態を返す。 */
export async function toggleReaction(answerId: string, type: string): Promise<'added' | 'removed' | null> {
  if (!supabase) return null;
  const uid = await getCurrentUserId();
  if (!uid) return null;
  const { data: existing } = await supabase
    .from('reactions')
    .select('answer_id')
    .eq('answer_id', answerId)
    .eq('user_id', uid)
    .eq('type', type)
    .maybeSingle();
  if (existing) {
    const { error } = await supabase
      .from('reactions')
      .delete()
      .eq('answer_id', answerId)
      .eq('user_id', uid)
      .eq('type', type);
    return error ? null : 'removed';
  }
  const { error } = await supabase.from('reactions').insert({ answer_id: answerId, user_id: uid, type });
  return error ? null : 'added';
}

// ── コメント ────────────────────────────────────────────
export async function getComments(answerId: string): Promise<CommentRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('comments')
    .select('id,answer_id,user_id,body,created_at,profile:profiles(username,display_name,avatar_url)')
    .eq('answer_id', answerId)
    .order('created_at', { ascending: true });
  if (error) return [];
  return (data ?? []) as unknown as CommentRow[];
}

export async function addComment(answerId: string, body: string): Promise<CommentRow | null> {
  if (!supabase) return null;
  const uid = await getCurrentUserId();
  if (!uid) return null;
  const { data, error } = await supabase
    .from('comments')
    .insert({ answer_id: answerId, user_id: uid, body })
    .select('id,answer_id,user_id,body,created_at')
    .single();
  if (error) return null;
  return data as CommentRow;
}

// ── フォロー ────────────────────────────────────────────
export async function follow(userId: string): Promise<boolean> {
  if (!supabase) return false;
  const uid = await getCurrentUserId();
  if (!uid || uid === userId) return false;
  const { error } = await supabase.from('follows').insert({ follower_id: uid, following_id: userId });
  return !error;
}

export async function unfollow(userId: string): Promise<boolean> {
  if (!supabase) return false;
  const uid = await getCurrentUserId();
  if (!uid) return false;
  const { error } = await supabase.from('follows').delete().eq('follower_id', uid).eq('following_id', userId);
  return !error;
}

export async function getFollowingIds(): Promise<string[]> {
  if (!supabase) return [];
  const uid = await getCurrentUserId();
  if (!uid) return [];
  const { data, error } = await supabase.from('follows').select('following_id').eq('follower_id', uid);
  if (error) return [];
  return (data ?? []).map((r: any) => r.following_id);
}
