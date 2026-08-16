// ============================================================
// Miri データアクセス層（Supabase）
// 共有SNS＋永続化のMVP：プロフィール / 回答 / リアクション / コメント / フォロー
// すべてブラウザ側の supabase クライアント（@/lib/supabase）を利用する。
// supabase 未設定（null）の場合は安全に空を返す or 何もしない。
// ============================================================
import { supabase } from './supabase';
import { isPioneerAccount, registerUserTitles } from './titles';

// DBから読んだ profiles の称号を、画面表示用に "@username" キーで登録する。
function registerProfileTitles(p?: { username?: string | null; titles?: string[] | null } | null): void {
  if (!p?.username) return;
  registerUserTitles('@' + p.username, p.titles ?? []);
}

// テスト公開以降に登録した本人アカウントに「先駆者」称号を一度だけ付与する（自分の行のみ）。
async function grantPioneerIfEligible(row: ProfileRow | null): Promise<ProfileRow | null> {
  if (!supabase || !row) return row;
  const titles = Array.isArray(row.titles) ? row.titles : [];
  if (titles.includes('pioneer')) return row;
  const { data: sess } = await supabase.auth.getSession();
  const user = sess.session?.user;
  if (!user || user.id !== row.id) return row; // 付与できるのは自分の行だけ（RLS前提）
  if (!isPioneerAccount(user.created_at)) return row;
  const next = [...titles, 'pioneer'];
  const { error } = await supabase.from('profiles').update({ titles: next }).eq('id', row.id);
  if (error) return row;
  return { ...row, titles: next };
}

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

// ── 一致率しんだん（相性診断）の回答 book.__choices ────────────
/** 自分の二択回答を book.__choices に保存（他項目は消さない read-merge-write）。 */
export async function saveMyChoices(choices: Record<string, string>): Promise<boolean> {
  if (!supabase) return false;
  const uid = await getCurrentUserId();
  if (!uid) return false;
  const { data } = await supabase.from('profiles').select('book').eq('id', uid).maybeSingle();
  const book: Record<string, any> = (data?.book && typeof data.book === 'object') ? data.book : {};
  book.__choices = choices;
  const { error } = await supabase.from('profiles').update({ book, updated_at: new Date().toISOString() }).eq('id', uid);
  return !error;
}
/** 自分の二択回答を取得。 */
export async function getMyChoices(): Promise<Record<string, string>> {
  if (!supabase) return {};
  const uid = await getCurrentUserId();
  if (!uid) return {};
  const { data } = await supabase.from('profiles').select('book').eq('id', uid).maybeSingle();
  return ((data?.book as any)?.__choices ?? {}) as Record<string, string>;
}
/** 指定ユーザー（username）の二択回答を取得。 */
export async function getUserChoices(username: string): Promise<Record<string, string>> {
  if (!supabase) return {};
  const { data } = await supabase.from('profiles').select('book').eq('username', username.replace(/^@/, '')).maybeSingle();
  return ((data?.book as any)?.__choices ?? {}) as Record<string, string>;
}

/** テスターのフィードバック（意見・要望・不具合）を feedback テーブルへ投稿。 */
export async function submitFeedback(kind: 'bug' | 'request' | 'question', body: string): Promise<boolean> {
  if (!supabase) return false;
  const uid = await getCurrentUserId();
  if (!uid) return false;
  let username = '';
  try {
    const { data } = await supabase.from('profiles').select('username').eq('id', uid).maybeSingle();
    username = (data as any)?.username ?? '';
  } catch {}
  const { error } = await supabase.from('feedback').insert({ user_id: uid, username, kind, body: body.trim() });
  return !error;
}

/** 現在のアクセストークン（サーバーAPIへ Bearer で渡す用）。無ければ null。 */
export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
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
  const row = await grantPioneerIfEligible(data as ProfileRow);
  registerProfileTitles(row);
  return row;
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
  if (existing) {
    const row = await grantPioneerIfEligible(existing as ProfileRow);
    registerProfileTitles(row);
    return row;
  }
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
  const row = await grantPioneerIfEligible(created as ProfileRow);
  registerProfileTitles(row);
  return row;
}

export async function getProfileByUsername(username: string): Promise<ProfileRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('username', username).single();
  if (error) return null;
  const row = await grantPioneerIfEligible(data as ProfileRow);
  registerProfileTitles(row);
  return row;
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
// ゲームデータが「実質空（コイン0・所持なし）」か判定
function isEmptyGame(g: any): boolean {
  if (!g || typeof g !== 'object') return true;
  return (g.coins ?? 0) === 0
    && (g.shards ?? 0) === 0
    && !(Array.isArray(g.packs) && g.packs.length)
    && !(Array.isArray(g.gacha) && g.gacha.length)
    && !(Array.isArray(g.bgs) && g.bgs.length)
    && !(Array.isArray(g.themes) && g.themes.length)
    && !g.bg;
}

export async function saveGameData(game: Record<string, any>): Promise<boolean> {
  if (!supabase) return false;
  const uid = await getCurrentUserId();
  if (!uid) return false;
  const { data } = await supabase.from('profiles').select('book').eq('id', uid).maybeSingle();
  const book: Record<string, any> = (data?.book && typeof data.book === 'object') ? data.book : {};
  // 安全網：ローカルが「空」なのにサーバーに中身がある場合は上書きしない。
  // （再ログイン直後などに復元前の空データで誤って消してしまう事故を防ぐ）
  if (isEmptyGame(game) && !isEmptyGame(book.__game)) return false;
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
  for (const p of (profRes.data ?? []) as any[]) registerProfileTitles(p); // フィードの著者バッジ用
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
  const rows = (res.data ?? []) as ProfileRow[];
  for (const p of rows) registerProfileTitles(p);
  return rows;
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

/**
 * 自分宛ての新着通知をリアルタイム購読する。返り値は購読解除関数。
 * ※ Supabase 側で notifications テーブルを Realtime publication に追加しておくと
 *   即時に届く（未設定でも購読自体は失敗せず、フォールバックの再取得で拾える）。
 */
export async function subscribeNotifications(onInsert: (row: NotificationRow) => void): Promise<() => void> {
  if (!supabase) return () => {};
  const uid = await getCurrentUserId();
  if (!uid) return () => {};
  const channel = supabase
    .channel(`notif:${uid}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
      (payload: any) => { try { onInsert(payload.new as NotificationRow); } catch {} }
    )
    .subscribe();
  return () => { try { supabase!.removeChannel(channel); } catch {} };
}

// ── コミュニティ（サークル）＝共有 ─────────────────────────────
// アプリ内では従来どおり id を '@username' で扱うため、uuid ⇔ @username を
// このデータ層で相互変換して、画面側の変更を最小限にする。
async function profilesByIds(ids: string[]): Promise<Map<string, any>> {
  if (!supabase || ids.length === 0) return new Map();
  const uniq = [...new Set(ids.filter(Boolean))];
  if (uniq.length === 0) return new Map();
  const { data } = await supabase.from('profiles').select('id,username,display_name,avatar_url').in('id', uniq);
  return new Map((data ?? []).map((p: any) => [p.id, p]));
}
const atName = (p?: any) => (p ? '@' + p.username : '@unknown');
const avatarOf = (p?: any) => (p?.avatar_url && !String(p.avatar_url).startsWith('http') ? p.avatar_url : '📷');

/** 全サークル（発見用）。memberIds/members は '@username' 形式。承認制の pending も含む。 */
export async function getCirclesShared(): Promise<any[]> {
  if (!supabase) return [];
  const myUid = await getCurrentUserId();
  const { data: circles } = await supabase.from('circles').select('*').order('created_at', { ascending: false });
  if (!circles || circles.length === 0) return [];
  const { data: mems } = await supabase.from('circle_members').select('circle_id,user_id,status');
  const profs = await profilesByIds([...(mems ?? []).map((m: any) => m.user_id), ...circles.map((c: any) => c.created_by)]);
  const isMember = (m: any) => (m.status ?? 'member') === 'member';
  return circles.map((c: any) => {
    const memRows = (mems ?? []).filter((m: any) => m.circle_id === c.id);
    const toProfile = (m: any) => { const p = profs.get(m.user_id); return { id: atName(p), name: p?.display_name || p?.username || 'ユーザー', avatar: avatarOf(p) }; };
    const members = memRows.filter(isMember).map(toProfile);
    const pendingMembers = memRows.filter((m: any) => (m.status ?? 'member') === 'pending').map(toProfile);
    const myRow = myUid ? memRows.find((m: any) => m.user_id === myUid) : undefined;
    const myStatus = myRow ? (myRow.status ?? 'member') : 'none';   // member / pending / none
    return {
      id: c.id,
      name: c.name,
      emoji: c.emoji || '🔒',
      createdBy: atName(profs.get(c.created_by)),
      isOfficial: !!c.is_official,
      joinPolicy: (c.join_policy === 'approval' ? 'approval' : 'open') as 'open' | 'approval',
      visibility: (c.visibility === 'followers' ? 'followers' : 'public') as 'public' | 'followers',
      memberIds: members.map((x: any) => x.id),
      members,
      pendingMembers,
      myStatus,
    };
  });
}

export async function createCircleShared(name: string, emoji: string, isOfficial: boolean, joinPolicy: 'open' | 'approval' = 'open', visibility: 'public' | 'followers' = 'public'): Promise<string | null> {
  if (!supabase) return null;
  const uid = await getCurrentUserId();
  if (!uid) return null;
  const { data, error } = await supabase.from('circles').insert({ name, emoji, created_by: uid, is_official: isOfficial, join_policy: joinPolicy, visibility }).select('id').single();
  if (error || !data) return null;
  await supabase.from('circle_members').insert({ circle_id: data.id, user_id: uid, status: 'member' });
  return data.id as string;
}

/** 参加。open は即メンバー、approval は pending（承認待ち）で登録。返り値は登録した status。 */
export async function joinCircle(circleId: string, policy: 'open' | 'approval' = 'open'): Promise<'member' | 'pending' | null> {
  if (!supabase) return null;
  const uid = await getCurrentUserId();
  if (!uid) return null;
  const status = policy === 'approval' ? 'pending' : 'member';
  const { error } = await supabase.from('circle_members').insert({ circle_id: circleId, user_id: uid, status });
  if (error) return null;
  // 作成者に通知（承認制＝リクエスト／公開＝参加）
  try {
    const { data: c } = await supabase.from('circles').select('created_by,name').eq('id', circleId).maybeSingle();
    if (c && (c as any).created_by) {
      await createNotification((c as any).created_by, status === 'pending' ? 'circle_request' : 'circle_join', { body: (c as any).name ?? null });
    }
  } catch {}
  return status;
}

export async function leaveCircle(circleId: string): Promise<boolean> {
  if (!supabase) return false;
  const uid = await getCurrentUserId();
  if (!uid) return false;
  const { error } = await supabase.from('circle_members').delete().eq('circle_id', circleId).eq('user_id', uid);
  return !error;
}

/** 作成者：承認待ちを承認（status='member' に更新）。target は '@username'。 */
export async function approveCircleMember(circleId: string, targetAtName: string): Promise<boolean> {
  if (!supabase) return false;
  const uname = targetAtName.replace(/^@/, '');
  const { data: tp } = await supabase.from('profiles').select('id').eq('username', uname).maybeSingle();
  if (!tp) return false;
  const { error } = await supabase.from('circle_members').update({ status: 'member' }).eq('circle_id', circleId).eq('user_id', (tp as any).id);
  if (error) return false;
  // 承認された本人へ通知
  try {
    const { data: c } = await supabase.from('circles').select('name').eq('id', circleId).maybeSingle();
    await createNotification((tp as any).id, 'circle_accept', { body: (c as any)?.name ?? null });
  } catch {}
  return true;
}

/** 作成者：承認待ちを却下（行を削除）。target は '@username'。 */
export async function rejectCircleMember(circleId: string, targetAtName: string): Promise<boolean> {
  if (!supabase) return false;
  const uname = targetAtName.replace(/^@/, '');
  const { data: tp } = await supabase.from('profiles').select('id').eq('username', uname).maybeSingle();
  if (!tp) return false;
  const { error } = await supabase.from('circle_members').delete().eq('circle_id', circleId).eq('user_id', (tp as any).id);
  return !error;
}

/** サークルの投稿（返信・投票つき）。id は '@username' 形式で返す。 */
export async function getCirclePostsShared(circleId: string): Promise<any[]> {
  if (!supabase) return [];
  const { data: posts } = await supabase.from('circle_posts').select('*').eq('circle_id', circleId).order('created_at', { ascending: true });
  if (!posts || posts.length === 0) return [];
  const ids = posts.map((p: any) => p.id);
  const [{ data: replies }, { data: votes }] = await Promise.all([
    supabase.from('circle_replies').select('*').in('post_id', ids),
    supabase.from('circle_votes').select('*').in('post_id', ids),
  ]);
  const uids = [
    ...posts.map((p: any) => p.user_id),
    ...(replies ?? []).map((r: any) => r.user_id),
    ...(votes ?? []).flatMap((v: any) => [v.user_id, v.target_id]),
  ];
  const profs = await profilesByIds(uids);
  return posts.map((p: any) => {
    const pr = profs.get(p.user_id);
    return {
      id: p.id,
      circleId: p.circle_id,
      body: p.body,
      kind: p.kind || 'talk',
      audience: 'members' as const,
      postedBy: atName(pr),
      postedByName: pr?.display_name || 'ユーザー',
      postedByAvatar: avatarOf(pr),
      postedAt: p.created_at,
      replies: (replies ?? [])
        .filter((r: any) => r.post_id === p.id)
        .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map((r: any) => {
          const rp = profs.get(r.user_id);
          return { userId: atName(rp), userName: rp?.display_name || 'ユーザー', userAvatar: avatarOf(rp), body: r.body, postedAt: r.created_at };
        }),
      votes: (votes ?? [])
        .filter((v: any) => v.post_id === p.id)
        .map((v: any) => ({ userId: atName(profs.get(v.user_id)), targetId: atName(profs.get(v.target_id)) })),
    };
  });
}

export async function createCirclePostShared(circleId: string, body: string, kind: 'talk' | 'vote'): Promise<boolean> {
  if (!supabase) return false;
  const uid = await getCurrentUserId();
  if (!uid) return false;
  const { error } = await supabase.from('circle_posts').insert({ circle_id: circleId, user_id: uid, body, kind });
  return !error;
}

export async function addCircleReplyShared(postId: string, body: string): Promise<boolean> {
  if (!supabase) return false;
  const uid = await getCurrentUserId();
  if (!uid) return false;
  const { error } = await supabase.from('circle_replies').insert({ post_id: postId, user_id: uid, body });
  return !error;
}

/** 投票（1人1票）。target は '@username' で受け取り uuid に解決して保存。 */
export async function voteCircleShared(postId: string, targetAtName: string): Promise<boolean> {
  if (!supabase) return false;
  const uid = await getCurrentUserId();
  if (!uid) return false;
  const uname = targetAtName.replace(/^@/, '');
  const { data: tp } = await supabase.from('profiles').select('id').eq('username', uname).maybeSingle();
  if (!tp) return false;
  const { error } = await supabase.from('circle_votes').insert({ post_id: postId, user_id: uid, target_id: (tp as any).id });
  return !error;
}

// ── ブログ（個人記事）＝共有 ─────────────────────────────────
/** ブログのフィード（自分＋公開＋フォロー先のフォロワー限定）。id は '@username' 形式。 */
export async function getBlogFeedShared(limit = 100): Promise<any[]> {
  if (!supabase) return [];
  const myUid = await getCurrentUserId();
  const { data: posts } = await supabase.from('blog_posts').select('*').order('created_at', { ascending: false }).limit(limit);
  if (!posts || posts.length === 0) return [];
  const ids = posts.map((p: any) => p.id);
  const [{ data: likes }, { data: comments }] = await Promise.all([
    supabase.from('blog_likes').select('post_id,user_id').in('post_id', ids),
    supabase.from('blog_comments').select('*').in('post_id', ids),
  ]);
  const uids = [
    ...posts.map((p: any) => p.user_id),
    ...(comments ?? []).map((c: any) => c.user_id),
  ];
  const profs = await profilesByIds(uids);
  return posts.map((p: any) => {
    const pr = profs.get(p.user_id);
    const postLikes = (likes ?? []).filter((l: any) => l.post_id === p.id);
    return {
      id: p.id,
      authorId: atName(pr),
      authorName: pr?.display_name || 'ユーザー',
      authorAvatar: avatarOf(pr),
      title: p.title || undefined,
      mood: p.mood || undefined,
      weather: p.weather || undefined,
      body: p.body,
      photoUrl: p.photo_url || undefined,
      textColor: p.text_color || undefined,
      visibility: (p.visibility === 'followers' ? 'followers' : 'public') as 'public' | 'followers',
      likes: postLikes.length,
      likedByMe: !!myUid && postLikes.some((l: any) => l.user_id === myUid),
      comments: (comments ?? [])
        .filter((c: any) => c.post_id === p.id)
        .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map((c: any) => { const cp = profs.get(c.user_id); return { id: c.id, authorId: atName(cp), authorName: cp?.display_name || 'ユーザー', authorAvatar: avatarOf(cp), body: c.body, postedAt: c.created_at }; }),
      postedAt: p.created_at,
    };
  });
}

export async function createBlogPostShared(data: { title?: string; mood?: string; weather?: string; body: string; photoUrl?: string; textColor?: string; visibility: 'public' | 'followers' }): Promise<string | null> {
  if (!supabase) return null;
  const uid = await getCurrentUserId();
  if (!uid) return null;
  const { data: row, error } = await supabase.from('blog_posts').insert({
    user_id: uid, title: data.title ?? null, mood: data.mood ?? null, weather: data.weather ?? null,
    body: data.body, photo_url: data.photoUrl ?? null, text_color: data.textColor ?? null, visibility: data.visibility,
  }).select('id').single();
  if (error || !row) return null;
  return (row as any).id as string;
}

/** いいねをトグル。付けたときは投稿者へ通知。返り値は「付けたか」。 */
export async function toggleBlogLikeShared(postId: string, authorAtName?: string): Promise<boolean | null> {
  if (!supabase) return null;
  const uid = await getCurrentUserId();
  if (!uid) return null;
  const { data: existing } = await supabase.from('blog_likes').select('post_id').eq('post_id', postId).eq('user_id', uid).maybeSingle();
  if (existing) {
    await supabase.from('blog_likes').delete().eq('post_id', postId).eq('user_id', uid);
    return false;
  }
  const { error } = await supabase.from('blog_likes').insert({ post_id: postId, user_id: uid });
  if (error) return null;
  // 投稿者へ通知
  try {
    const uname = (authorAtName ?? '').replace(/^@/, '');
    if (uname) {
      const { data: ap } = await supabase.from('profiles').select('id').eq('username', uname).maybeSingle();
      if (ap) await createNotification((ap as any).id, 'blog_like', { answerId: postId });
    }
  } catch {}
  return true;
}

export async function addBlogCommentShared(postId: string, body: string, authorAtName?: string): Promise<boolean> {
  if (!supabase) return false;
  const uid = await getCurrentUserId();
  if (!uid) return false;
  const { error } = await supabase.from('blog_comments').insert({ post_id: postId, user_id: uid, body });
  if (error) return false;
  try {
    const uname = (authorAtName ?? '').replace(/^@/, '');
    if (uname) {
      const { data: ap } = await supabase.from('profiles').select('id').eq('username', uname).maybeSingle();
      if (ap) await createNotification((ap as any).id, 'blog_comment', { answerId: postId, body });
    }
  } catch {}
  return true;
}

export async function deleteBlogPostShared(postId: string): Promise<boolean> {
  if (!supabase) return false;
  const uid = await getCurrentUserId();
  if (!uid) return false;
  const { error } = await supabase.from('blog_posts').delete().eq('id', postId).eq('user_id', uid);
  return !error;
}

// ── 交換日記（共有）─────────────────────────────────────────
/** 見られる交換日記ページ一覧（エントリ・招待つき）。id は '@username' 形式。 */
export async function getDiaryPagesShared(): Promise<any[]> {
  if (!supabase) return [];
  const { data: pages } = await supabase.from('diary_pages').select('*').order('created_at', { ascending: false });
  if (!pages || pages.length === 0) return [];
  const ids = pages.map((p: any) => p.id);
  const [{ data: entries }, { data: mentions }] = await Promise.all([
    supabase.from('diary_entries').select('*').in('page_id', ids),
    supabase.from('diary_page_mentions').select('*').in('page_id', ids),
  ]);
  const uids = [
    ...pages.map((p: any) => p.created_by),
    ...(entries ?? []).map((e: any) => e.user_id),
    ...(mentions ?? []).map((m: any) => m.user_id),
  ];
  const profs = await profilesByIds(uids);
  return pages.map((p: any) => {
    const owner = profs.get(p.created_by);
    const pageEntries = (entries ?? [])
      .filter((e: any) => e.page_id === p.id)
      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((e: any) => {
        const ep = profs.get(e.user_id);
        return { id: e.id, authorId: atName(ep), authorName: ep?.display_name || 'ユーザー', authorAvatar: avatarOf(ep), body: e.body || '', photoUrl: e.photo_url || undefined, postedAt: e.created_at, likes: 0, likedByMe: false, comments: [] };
      });
    const mentionIds = (mentions ?? []).filter((m: any) => m.page_id === p.id).map((m: any) => atName(profs.get(m.user_id)));
    return {
      id: p.id,
      theme: p.theme,
      description: p.description || '',
      createdBy: atName(owner),
      createdByName: owner?.display_name || 'ユーザー',
      createdByAvatar: avatarOf(owner),
      createdAt: p.created_at,
      entries: pageEntries,
      visibility: (['public', 'followers', 'mentioned'].includes(p.visibility) ? p.visibility : 'followers') as 'public' | 'followers' | 'mentioned',
      mentionedUserIds: mentionIds,
    };
  });
}

export async function createDiaryPageShared(
  theme: string, description: string,
  visibility: 'public' | 'followers' | 'mentioned',
  mentionAtNames: string[],
  firstEntry?: { body: string; photoUrl?: string },
): Promise<string | null> {
  if (!supabase) return null;
  const uid = await getCurrentUserId();
  if (!uid) return null;
  const { data: page, error } = await supabase.from('diary_pages').insert({ theme, description: description || null, created_by: uid, visibility }).select('id').single();
  if (error || !page) return null;
  const pageId = (page as any).id as string;
  // 招待（'@username' → uuid）
  if (visibility === 'mentioned' && mentionAtNames.length > 0) {
    const unames = mentionAtNames.map((a) => a.replace(/^@/, ''));
    const { data: profs } = await supabase.from('profiles').select('id,username').in('username', unames);
    const rows = (profs ?? []).map((pr: any) => ({ page_id: pageId, user_id: pr.id }));
    if (rows.length) await supabase.from('diary_page_mentions').insert(rows);
    // 招待された人へ通知
    try { for (const pr of (profs ?? [])) await createNotification((pr as any).id, 'diary_invite', { body: theme }); } catch {}
  }
  if (firstEntry && (firstEntry.body.trim() || firstEntry.photoUrl)) {
    await supabase.from('diary_entries').insert({ page_id: pageId, user_id: uid, body: firstEntry.body.trim() || null, photo_url: firstEntry.photoUrl || null });
  }
  return pageId;
}

export async function addDiaryEntryShared(pageId: string, body: string, photoUrl?: string): Promise<boolean> {
  if (!supabase) return false;
  const uid = await getCurrentUserId();
  if (!uid) return false;
  const { error } = await supabase.from('diary_entries').insert({ page_id: pageId, user_id: uid, body: body.trim() || null, photo_url: photoUrl || null });
  return !error;
}

export async function updateDiaryEntryShared(entryId: string, body: string, photoUrl?: string): Promise<boolean> {
  if (!supabase) return false;
  const uid = await getCurrentUserId();
  if (!uid) return false;
  const { error } = await supabase.from('diary_entries').update({ body: body.trim() || null, photo_url: photoUrl || null }).eq('id', entryId).eq('user_id', uid);
  return !error;
}

export async function deleteDiaryEntryShared(entryId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('diary_entries').delete().eq('id', entryId);
  return !error;
}

/** 指定ユーザーのブログ記事（自分に見える公開範囲のもの）。username で指定。 */
export async function getBlogPostsByUserShared(username: string): Promise<any[]> {
  if (!supabase) return [];
  const uname = username.replace(/^@/, '');
  const { data: prof } = await supabase.from('profiles').select('id,username,display_name,avatar_url').eq('username', uname).maybeSingle();
  if (!prof) return [];
  const myUid = await getCurrentUserId();
  const { data: posts } = await supabase.from('blog_posts').select('*').eq('user_id', (prof as any).id).order('created_at', { ascending: false });
  if (!posts || posts.length === 0) return [];
  const ids = posts.map((p: any) => p.id);
  const [{ data: likes }, { data: comments }] = await Promise.all([
    supabase.from('blog_likes').select('post_id,user_id').in('post_id', ids),
    supabase.from('blog_comments').select('*').in('post_id', ids),
  ]);
  const cprofs = await profilesByIds((comments ?? []).map((c: any) => c.user_id));
  const authorAt = atName(prof);
  return posts.map((p: any) => {
    const postLikes = (likes ?? []).filter((l: any) => l.post_id === p.id);
    return {
      id: p.id, authorId: authorAt, authorName: (prof as any).display_name || (prof as any).username, authorAvatar: avatarOf(prof),
      title: p.title || undefined, mood: p.mood || undefined, weather: p.weather || undefined,
      body: p.body, photoUrl: p.photo_url || undefined, textColor: p.text_color || undefined,
      visibility: (p.visibility === 'followers' ? 'followers' : 'public'),
      likes: postLikes.length, likedByMe: !!myUid && postLikes.some((l: any) => l.user_id === myUid),
      comments: (comments ?? []).filter((c: any) => c.post_id === p.id).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map((c: any) => { const cp = cprofs.get(c.user_id); return { id: c.id, authorId: atName(cp), authorName: cp?.display_name || 'ユーザー', authorAvatar: avatarOf(cp), body: c.body, postedAt: c.created_at }; }),
      postedAt: p.created_at,
    };
  });
}
