// ============================================================
// 端末に保存した利用者のデータの扱い（ログイン・ログアウト・利用者の切りかえ）
//
// ・端末の保存領域は「サーバーの内容の写し」と「端末の設定」。利用者ごとのデータは、別の人に残してはいけない。
// ・ログインしたとき：前にこの端末を使っていた人（miri_last_uid）と同じなら、何も消さない。
//   違う人（または、だれが使っていたか分からない）なら、利用者ごとのデータをすべて消す。
// ・ログアウトしたとき：利用者ごとのデータをすべて消す。
// ・どちらの場合も、端末の設定（表示言語）とログインの鍵（sb-*。新しくログインした人のもの）は残す。
// ============================================================
export const LAST_UID_KEY = 'miri_last_uid';
/** 利用者が替わっても残す、端末の設定 */
const DEVICE_KEYS = new Set(['miri_lang']);

/** 利用者ごとの端末のデータをすべて消す（端末の設定とログインの鍵は残す） */
export function clearUserLocalData(keepSession = true): void {
  try {
    for (const k of Object.keys(localStorage)) {
      if (DEVICE_KEYS.has(k)) continue;
      if (keepSession && k.startsWith('sb-')) continue;
      localStorage.removeItem(k);
    }
  } catch {}
  try { sessionStorage.clear(); } catch {}
}

/** ログインした直後に呼ぶ。前の利用者と違えば、その人のデータを消してから、いまの利用者を記録する */
export function prepareLocalForUser(uid: string | null | undefined): void {
  if (!uid) return;
  try {
    const prev = localStorage.getItem(LAST_UID_KEY);
    if (prev !== uid) clearUserLocalData();
    localStorage.setItem(LAST_UID_KEY, uid);
  } catch {}
}

/** ログアウトのとき。利用者ごとのデータと、ログインの鍵も消す */
export function clearOnLogout(): void {
  clearUserLocalData(false);
}
