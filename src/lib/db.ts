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

/**
 * 現在のログインユーザーの profiles 行が存在することを保証する。
 * 無ければ作成して返す（トリガー導入前に作られた旧アカウント対策）。
 * profiles 行が無いと answers の外部キー制約で回答保存が失敗するため重要。
 */
export async function ensureProfile(): Promise<ProfileRow | null> {
  if (!supabase) return null;
  const { data: sess } = await supabase.auth.getSession();
  const user = sess.session?.user;
  if (!user) return null;
  const { data: existing } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  if (existing) return existing as ProfileRow;
  // 行が無い＝旧アカウント等。フォールバックのID/表示名で作成する。
  const base =
    (user.email?.split('@')[0] || 'user').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() || 'user';
  const username = `${base}_${user.id.slice(0, 4)}`;
  const { data: created, error } = await supabase
    .from('profiles')
    .insert({ id: user.id, username, display_name: base })
    .select('*')
    .single();
  if (error) return null;
  return created as ProfileRow;
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

/**
 * ゲームデータ（コイン/スタンプ/背景/かけら等）だけを book.__game に保存する。
 * サーバーの現在の book を読んでから __game のみ差し替えるので、
 * プロフィール本文や BEST3 など他の項目を消してしまう心配がない。
 */
export async function saveGameData(game: Record<string, any>): Promise<boolean> {
  if (!supabase) return false;
  const uid = await getCurrentUserId();
  if (!uid) return false;
  const { data } = await supabase.from('profiles').select('book').eq('id', uid).maybeSingle();
  const book: Record<string, any> = (data?.book && typeof data.book === 'object') ? data.book : {};
  book.__game = game;
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
  const payload = {
    user_id: uid,
    question_key: a.question_key,
    question_title: a.question_title,
    question_category: a.question_category ?? null,
    body: a.body,
    sticker: a.sticker ?? null,
    visibility: a.visibility ?? 'public',
    updated_at: new Date().toISOString(),
  };
  const doUpsert = () =>
    supabase!
      .from('answers')
      .upsert(payload, { onConflict: 'user_id,question_key' })
      .select('*')
      .single();

  let { data, error } = await doUpsert();
  // profiles 行欠落（外部キー違反 23503）等で失敗した場合はプロフィールを作って一度だけ再試行
  if (error) {
    await ensureProfile();
    ({ data, error } = await doUpsert());
  }
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
  // 埋め込み結合は失敗することがあるため、コメントとプロフィールを別クエリで取得して結合する。
  const { data, error } = await supabase
    .from('comments')
    .select('id,answer_id,user_id,body,created_at')
    .eq('answer_id', answerId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  const rows = data as any[];
  if (rows.length === 0) return [];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: profs } = await supabase
    .from('profiles')
    .select('id,username,display_name,avatar_url')
    .in('id', userIds);
  const profMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
  return rows.map((r) => ({ ...r, profile: profMap.get(r.user_id) })) as CommentRow[];
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

/** 自分をフォローしている人（フォロワー）の一覧（プロフィール付き） */
export async function getFollowers(): Promise<ProfileRow[]> {
  if (!supabase) return [];
  const uid = await getCurrentUserId();
  if (!uid) return [];
  const { data } = await supabase.from('follows').select('follower_id').eq('following_id', uid);
  const ids = (data ?? []).map((r: any) => r.follower_id);
  if (ids.length === 0) return [];
  const { data: profs } = await supabase
    .from('profiles')
    .select('id,username,display_name,avatar_url,cover_theme,book,is_official,titles')
    .in('id', ids);
  return (profs ?? []) as ProfileRow[];
}

/** 相手が自分をフォローしているか（相互フォロー判定用） */
export async function isFollowedBy(otherUid: string): Promise<boolean> {
  if (!supabase) return false;
  const uid = await getCurrentUserId();
  if (!uid) return false;
  const { data } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', otherUid)
    .eq('following_id', uid)
    .maybeSingle();
  return !!data;
}

/** 自分がフォローしている人の一覧（プロフィール付き） */
export async function getFollowing(): Promise<ProfileRow[]> {
  if (!supabase) return [];
  const ids = await getFollowingIds();
  if (ids.length === 0) return [];
  const { data: profs } = await supabase
    .from('profiles')
    .select('id,username,display_name,avatar_url,cover_theme,book,is_official,titles')
    .in('id', ids);
  return (profs ?? []) as ProfileRow[];
}

/** なかよし成立（accepted）の相手 uuid 一覧 */
export async function getFriendIds(): Promise<string[]> {
  if (!supabase) return [];
  const uid = await getCurrentUserId();
  if (!uid) return [];
  const { data } = await supabase
    .from('friendships')
    .select('requester_id,addressee_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`);
  return (data ?? []).map((r: any) => (r.requester_id === uid ? r.addressee_id : r.requester_id));
}

/** フォロー中・フォロワーの件数 */
export async function getFollowCounts(): Promise<{ following: number; followers: number }> {
  if (!supabase) return { following: 0, followers: 0 };
  const uid = await getCurrentUserId();
  if (!uid) return { following: 0, followers: 0 };
  const [a, b] = await Promise.all([
    supabase.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', uid),
    supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', uid),
  ]);
  return { following: a.count ?? 0, followers: b.count ?? 0 };
}

// ── なかよし（承認制のプロフ帳交換） ─────────────────────
export type FriendStatus = 'none' | 'pending_out' | 'pending_in' | 'friends';

/** 相手との「なかよし」状態を返す */
export async function getFriendStatus(otherUid: string): Promise<FriendStatus> {
  if (!supabase) return 'none';
  const uid = await getCurrentUserId();
  if (!uid || uid === otherUid) return 'none';
  const { data } = await supabase
    .from('friendships')
    .select('requester_id,addressee_id,status')
    .or(`and(requester_id.eq.${uid},addressee_id.eq.${otherUid}),and(requester_id.eq.${otherUid},addressee_id.eq.${uid})`)
    .maybeSingle();
  if (!data) return 'none';
  if (data.status === 'accepted') return 'friends';
  return data.requester_id === uid ? 'pending_out' : 'pending_in';
}

/** なかよし申請を送る */
export async function requestFriend(otherUid: string): Promise<boolean> {
  if (!supabase) return false;
  const uid = await getCurrentUserId();
  if (!uid || uid === otherUid) return false;
  const { error } = await supabase.from('friendships').insert({ requester_id: uid, addressee_id: otherUid, status: 'pending' });
  return !error;
}

/** 受け取った申請を承認する */
export async function acceptFriend(otherUid: string): Promise<boolean> {
  if (!supabase) return false;
  const uid = await getCurrentUserId();
  if (!uid) return false;
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('requester_id', otherUid)
    .eq('addressee_id', uid);
  return !error;
}

/** なかよし解除／申請取り消し */
export async function removeFriend(otherUid: string): Promise<boolean> {
  if (!supabase) return false;
  const uid = await getCurrentUserId();
  if (!uid) return false;
  const { error } = await supabase
    .from('friendships')
    .delete()
    .or(`and(requester_id.eq.${uid},addressee_id.eq.${otherUid}),and(requester_id.eq.${otherUid},addressee_id.eq.${uid})`);
  return !error;
}

/** 承認待ちの受信申請一覧（申請者プロフィール付き） */
export async function getIncomingFriendRequests(): Promise<ProfileRow[]> {
  if (!supabase) return [];
  const uid = await getCurrentUserId();
  if (!uid) return [];
  const { data } = await supabase.from('friendships').select('requester_id').eq('addressee_id', uid).eq('status', 'pending');
  const ids = (data ?? []).map((r: any) => r.requester_id);
  if (ids.length === 0) return [];
  const { data: profs } = await supabase
    .from('profiles')
    .select('id,username,display_name,avatar_url,cover_theme,book,is_official,titles')
    .in('id', ids);
  return (profs ?? []) as ProfileRow[];
}

// ── 通知 ────────────────────────────────────────────────
export type NotificationRow = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: string;
  answer_id: string | null;
  emoji: string | null;
  body: string | null;
  read: boolean;
  created_at: string;
  actor?: Pick<ProfileRow, 'username' | 'display_name' | 'avatar_url'>;
};

/** 相手へ通知を作成（自分自身へは作らない）。best-effort。 */
export async function createNotification(
  recipientUid: string,
  type: string,
  extra?: { answerId?: string | null; emoji?: string | null; body?: string | null }
): Promise<void> {
  if (!supabase || !recipientUid) return;
  const uid = await getCurrentUserId();
  if (!uid || uid === recipientUid) return;
  try {
    await supabase.from('notifications').insert({
      user_id: recipientUid,
      actor_id: uid,
      type,
      answer_id: extra?.answerId ?? null,
      emoji: extra?.emoji ?? null,
      body: extra?.body ?? null,
    });
  } catch {}
}

/** 自分宛の通知一覧（行動者プロフィール付き） */
export async function getNotifications(limit = 50): Promise<NotificationRow[]> {
  if (!supabase) return [];
  const uid = await getCurrentUserId();
  if (!uid) return [];
  const { data } = await supabase
    .from('notifications')
    .select('id,user_id,actor_id,type,answer_id,emoji,body,read,created_at')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(limit);
  const rows = (data ?? []) as any[];
  if (rows.length === 0) return [];
  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))];
  const { data: profs } = actorIds.length
    ? await supabase.from('profiles').select('id,username,display_name,avatar_url').in('id', actorIds)
    : { data: [] as any[] };
  const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
  return rows.map((r) => ({ ...r, actor: map.get(r.actor_id) })) as NotificationRow[];
}

/** 未読件数 */
export async function getUnreadNotificationCount(): Promise<number> {
  if (!supabase) return 0;
  const uid = await getCurrentUserId();
  if (!uid) return 0;
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', uid)
    .eq('read', false);
  return count ?? 0;
}

/** すべて既読にする */
export async function markNotificationsRead(): Promise<void> {
  if (!supabase) return;
  const uid = await getCurrentUserId();
  if (!uid) return;
  try { await supabase.from('notifications').update({ read: true }).eq('user_id', uid).eq('read', false); } catch {}
}
