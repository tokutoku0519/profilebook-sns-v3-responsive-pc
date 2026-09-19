import { supabaseAdmin } from './supabaseAdmin';

// 決済を検証済みのサーバー処理からのみ呼ぶ、コイン付与のサーバー権限実装。
// coins は profiles.book.__game.coins に加算。purchaseKey（Stripe セッションID等）で冪等化し、
// Webhook が再送されても二重付与しない（book.__purchases に記録して照合）。
export async function creditCoins(
  userId: string,
  amount: number,
  purchaseKey: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (!supabaseAdmin) return { ok: false, reason: 'admin_not_configured' };
  if (!userId || !Number.isFinite(amount) || amount <= 0 || !purchaseKey) {
    return { ok: false, reason: 'bad_args' };
  }
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('book')
    .eq('id', userId)
    .maybeSingle();
  if (error) return { ok: false, reason: 'read_failed' };

  const book: Record<string, any> = (data?.book && typeof data.book === 'object') ? data.book : {};
  const purchases: string[] = Array.isArray(book.__purchases) ? book.__purchases : [];
  if (purchases.includes(purchaseKey)) return { ok: true, reason: 'already_credited' }; // 冪等

  const game: Record<string, any> = (book.__game && typeof book.__game === 'object') ? book.__game : {};
  const current = typeof game.coins === 'number' ? game.coins : 0;
  game.coins = current + amount;
  book.__game = game;
  book.__purchases = [...purchases, purchaseKey].slice(-200); // 直近200件だけ保持

  const { error: upErr } = await supabaseAdmin
    .from('profiles')
    .update({ book, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (upErr) return { ok: false, reason: 'write_failed' };
  return { ok: true };
}
