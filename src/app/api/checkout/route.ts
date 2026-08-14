import { NextResponse, type NextRequest } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getCoinPackage, coinTotal } from '@/lib/coinPackages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// コイン購入の Stripe Checkout セッションを作成して URL を返す。
// 認証は「ブラウザが渡す Supabase アクセストークン（Bearer）」で行う。
export async function POST(req: NextRequest) {
  if (!stripe || !supabaseAdmin) {
    return NextResponse.json({ error: 'payment_not_configured' }, { status: 503 });
  }

  let body: any = {};
  try { body = await req.json(); } catch {}
  const pkg = getCoinPackage(String(body?.packageId ?? ''));
  if (!pkg) return NextResponse.json({ error: 'invalid_package' }, { status: 400 });

  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  const user = userData?.user;
  if (userErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // 戻り先は本人のアプリ画面（username を取得して success_url を組む）。
  let username = '';
  try {
    const { data: prof } = await supabaseAdmin.from('profiles').select('username').eq('id', user.id).maybeSingle();
    username = (prof as any)?.username ?? '';
  } catch {}
  const origin = req.headers.get('origin') ?? new URL(req.url).origin;
  const appPath = username ? `/${username}` : '/';
  const total = coinTotal(pkg);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'jpy',
          unit_amount: pkg.price, // JPY はゼロ小数通貨（そのままの整数）
          product_data: { name: `Miri ${total.toLocaleString()}コイン` },
        },
      }],
      // 付与はメタデータを信用せず、Webhook 側で packageId から再計算する。
      metadata: { userId: user.id, packageId: pkg.id, coins: String(total) },
      client_reference_id: user.id,
      success_url: `${origin}${appPath}?checkout=success`,
      cancel_url: `${origin}${appPath}?checkout=cancel`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    return NextResponse.json({ error: 'stripe_error', message: e?.message ?? '' }, { status: 500 });
  }
}
