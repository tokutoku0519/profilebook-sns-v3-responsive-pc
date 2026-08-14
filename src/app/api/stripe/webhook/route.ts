import { NextResponse, type NextRequest } from 'next/server';
import { stripe } from '@/lib/stripe';
import { creditCoins } from '@/lib/serverCoins';
import { getCoinPackage, coinTotal } from '@/lib/coinPackages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Stripe Webhook：決済完了を署名検証し、サーバー権限でコインを付与する（冪等）。
// Vercel の環境変数 STRIPE_WEBHOOK_SECRET が必要。Stripe ダッシュボードで
// エンドポイント https://<ドメイン>/api/stripe/webhook を登録して取得する。
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  const sig = req.headers.get('stripe-signature') ?? '';
  const raw = await req.text(); // 署名検証には生ボディが必要

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch {
    return NextResponse.json({ error: 'bad_signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any;
    if (session.payment_status === 'paid') {
      const userId: string | undefined = session.metadata?.userId ?? session.client_reference_id ?? undefined;
      // 金額はクライアント由来のメタデータを信用せず、パッケージ定義から再計算する。
      const pkg = getCoinPackage(session.metadata?.packageId ?? '');
      const amount = pkg ? coinTotal(pkg) : Number(session.metadata?.coins ?? 0);
      if (userId && amount > 0) {
        await creditCoins(userId, amount, session.id); // session.id で二重付与を防止
      }
    }
  }

  return NextResponse.json({ received: true });
}
