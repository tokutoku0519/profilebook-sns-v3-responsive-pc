import Stripe from 'stripe';

// サーバー専用。STRIPE_SECRET_KEY 未設定なら null（＝決済無効）で安全に動く。
const key = process.env.STRIPE_SECRET_KEY;
export const stripe = key ? new Stripe(key) : null;

// クライアントに公開してよいのは「有効かどうか」のフラグのみ（NEXT_PUBLIC_）。
// シークレットキーは絶対にクライアントへ渡さない。
export const stripeConfigured = !!key;
