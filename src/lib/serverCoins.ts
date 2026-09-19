import { supabaseAdmin } from './supabaseAdmin';

// 決済を検証済みのサーバー処理からのみ呼ぶ、コイン付与のサーバー権限実装。
// coins は profile_book.book.__game.coins に加算（アプリと同じ格納先）。
// purchaseKey（Stripe セッションID等）で冪等化し、Webhook 再送でも二重付与しない
// （book.__purchases に記録して照合）。
export async function creditCoins(
  userId: string,
  amount: number,
  purchaseKey: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (!supabaseAdmin) return { ok: false, reason: 'admin_not_configured' };
  if (!userId || !Number.isFinite(amount) || amount <= 0 || !purchaseKey) {
    return { ok: false, reason: 'bad_args' };
  }
  // 現在の book を profile_book から読む（行が無ければ旧 profiles.book にフォールバック）
  const { data: pb, error: pbErr } = await supabaseAdmin
    .from('profile_book')
    .select('book')
    .eq('id', userId)
    .maybeSingle();
  if (pbErr) return { ok: false, reason: 'read_failed' };

  let book: Record<string, any>;
  if (pb && pb.book && typeof pb.book === 'object') {
    book = pb.book as Record<string, any>;
  } else {
    const { data: p, error: pErr } = await supabaseAdmin
      .from('profiles')
      .select('book')
      .eq('id', userId)
      .maybeSingle();
    if (pErr) return { ok: false, reason: 'read_failed' };
    book = (p?.book && typeof p.book === 'object') ? (p.book as Record<string, any>) : {};
  }

  const purchases: string[] = Array.isArray(book.__purchases) ? book.__purchases : [];
  if (purchases.includes(purchaseKey)) return { ok: true, reason: 'already_credited' }; // 冪等

  const game: Record<string, any> = (book.__game && typeof book.__game === 'object') ? book.__game : {};
  const current = typeof game.coins === 'number' ? game.coins : 0;
  game.coins = current + amount;
  book.__game = game;
  book.__purchases = [...purchases, purchaseKey].slice(-200); // 直近200件だけ保持

  // profile_book へ upsert（行が無くても作成される）
  const { error: upErr } = await supabaseAdmin
    .from('profile_book')
    .upsert({ id: userId, book, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (upErr) return { ok: false, reason: 'write_failed' };
  return { ok: true };
}
