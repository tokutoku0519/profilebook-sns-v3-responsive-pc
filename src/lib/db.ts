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

// ── サインアウト ──────────────────────────────────────────
export async function signOut(): Promise<void> {
  if (!supabase) return;
  try { await supabase.auth.signOut(); } catch {}
}

// ── 認証中ユーザー ────────────────────────────────────────
export async function getCurrentUserId(): Promise<string | null> {
  if (!supabase) return null;
  // getSession はローカルの保存済みセッションを確実に返す（getUser はネットワーク検証で
  // 起動直後にレースしやすい）。期限切れなら supabase-js が自動リフレッシュを試みる。
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

/** 有効な Supabase セッションがあるか（自動ログインでも期限切れなら false）。 */
export async function hasValidSession(): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  return !!data.session?.user?.id;
}

// ── ID（username）の空き確認 ─────────────────────────────
/** username が使用可能か（未使用なら true）。未設定/エラー時は true（送信時に最終判定）。 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  if (!supabase) return true;
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  if (error) return true;
  return !data;
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

// 回答行に profile とリアクションを付与する（埋め込み結合に頼らず別クエリでマージ）。
async function attachProfilesAndReactions(rows: any[]): Promise<AnswerRow[]> {
  if (!supabase || rows.length === 0) return rows as AnswerRow[];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const answerIds = rows.map((r) => r.id);
  const [profRes, reactRes] = await Promise.all([
    supabase.from('profiles').select('id,username,display_name,avatar_url,titles,is_official').in('id', userIds),
    supabase.from('reactions').select('answer_id,type,user_id').in('answer_id', answerIds),
  ]);
  const profMap = new Map((profRes.data ?? []).map((p: any) => [p.id, p]));
  const reactByAnswer = new Map<string, { type: string; user_id: string }[]>();
  for (const r of (reactRes.data ?? []) as any[]) {
    const arr = reactByAnswer.get(r.answer_id) ?? [];
    arr.push({ type: r.type, user_id: r.user_id });
    reactByAnswer.set(r.answer_id, arr);
  }
  return rows.map((r) => ({
    ...r,
    profile: profMap.get(r.user_id) as any,
    reactions: reactByAnswer.get(r.id) ?? [],
  })) as AnswerRow[];
}

/** みんなの回答フィード（新着順）。エラー時は null（呼び出し側で既存表示を維持できる）。 */
export async function getFeed(limit = 50): Promise<AnswerRow[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('answers')
    .select('id,user_id,question_key,question_title,question_category,body,sticker,visibility,created_at')
    .neq('visibility', 'private')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return null;
  return attachProfilesAndReactions(data);
}

/** 自分の、あるお題への既存回答（編集用の前入力に使う）。無ければ null。 */
export async function getMyAnswer(questionKey: string): Promise<AnswerRow | null> {
  if (!supabase) return null;
  const uid = await getCurrentUserId();
  if (!uid) return null;
  const { data, error } = await supabase
    .from('answers')
    .select('id,user_id,question_key,question_title,question_category,body,sticker,visibility,created_at')
    .eq('user_id', uid)
    .eq('question_key', questionKey)
    .maybeSingle();
  if (error || !data) return null;
  return data as AnswerRow;
}

/** ユーザー検索（username / display_name / プロフ帳のニックネームの部分一致）。 */
export async function searchProfiles(query: string, limit = 20): Promise<ProfileRow[]> {
  if (!supabase) return [];
  const safe = query.trim().replace(/[,()%*]/g, '');
  if (!safe) return [];
  const cols = 'id,username,display_name,avatar_url,cover_theme,book,is_official,titles';
  // ニックネーム（book->>nickname）も含めて検索。JSONBフィルタが使えない場合は簡易検索にフォールバック。
  let res = await supabase
    .from('profiles')
    .select(cols)
    .or(`username.ilike.%${safe}%,display_name.ilike.%${safe}%,book->>nickname.ilike.%${safe}%`)
    .limit(limit);
  if (res.error) {
    res = await supabase
      .from('profiles')
      .select(cols)
      .or(`username.ilike.%${safe}%,display_name.ilike.%${safe}%`)
      .limit(limit);
  }
  return (res.data ?? []) as ProfileRow[];
}

/** 特定ユーザーの回答一覧 */
export async function getAnswersByUser(userId: string): Promise<AnswerRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('answers')
    .select('id,user_id,question_key,question_title,question_category,body,sticker,visibility,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return attachProfilesAndReactions(data);
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
