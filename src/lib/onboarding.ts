// ============================================================
// はじめての案内（オンボーディング）：新しく作ったアカウントの、最初の 1 回だけ
//
// 完了の記録：アカウントのプロフ帳の内部データ book.__game.onboardedAt（ISO の日時）。
//   ほかの人には見えない（get_visible_book は __game を返さない）。新しい列・テーブルは使わない。
//   端末ではなくアカウントに残すので、別の端末・ログインし直しでも、もう出ない。
// 既存のアカウントの判定：アカウントの作成日時（Supabase Auth の created_at）が ONBOARDING_SINCE より前なら、
//   記録がなくても出さない（既存の利用者に、いまさら案内を出さないため）。
// スキップしても「完了」として記録する。マイページから見直せる（見直しは記録を変えない）。
// ============================================================
import { supabase } from './supabase';
import { patchMyBook } from './db';

/** この日時より後に作られたアカウントだけに案内を出す（この仕組みを入れた日） */
export const ONBOARDING_SINCE = '2026-11-19T00:00:00Z';
export const ONBOARDED_LS = 'miri_onboarded_at';

/** 案内を出すべきか（ログイン中のアカウントについて） */
export async function needsOnboarding(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) return false;
    if (!user.created_at || new Date(user.created_at).getTime() < new Date(ONBOARDING_SINCE).getTime()) return false;
    const { data: row, error } = await supabase.from('profile_book').select('book').eq('id', user.id).maybeSingle();
    if (error) return false;                          // 読めないときは出さない（出しすぎより安全側）
    const done = (row as any)?.book?.__game?.onboardedAt;
    return !done;
  } catch { return false; }
}

/** 案内を終えた（スキップを含む）ことを、アカウントに記録する */
export async function markOnboarded(): Promise<boolean> {
  const at = new Date().toISOString();
  try { localStorage.setItem(ONBOARDED_LS, at); } catch {}
  const r = await patchMyBook((server) => {
    const game = server.__game && typeof server.__game === 'object' ? server.__game : {};
    if (game.onboardedAt) return null;                // すでに記録あり（書かない）
    return { __game: { ...game, onboardedAt: at } };
  });
  return r.ok || (!r.ok && r.reason === 'guarded');
}
