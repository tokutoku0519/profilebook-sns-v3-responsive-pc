import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cloudflare Turnstile のトークンをサーバー側で検証する。
// TURNSTILE_SECRET_KEY 未設定なら success:true で素通り（キー投入前でもログイン可能）。
export async function POST(req: NextRequest) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return NextResponse.json({ success: true, skipped: true });

  let token = '';
  try { token = ((await req.json()) as any)?.token ?? ''; } catch {}
  if (!token) return NextResponse.json({ success: false }, { status: 400 });

  const form = new URLSearchParams();
  form.set('secret', secret);
  form.set('response', token);
  const ip = req.headers.get('cf-connecting-ip') || (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
  if (ip) form.set('remoteip', ip);

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    const data = (await res.json()) as { success?: boolean };
    return NextResponse.json({ success: !!data.success });
  } catch {
    return NextResponse.json({ success: false }, { status: 502 });
  }
}
