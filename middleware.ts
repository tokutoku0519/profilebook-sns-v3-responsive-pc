import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // development 環境は認証不要
  if (process.env.NEXT_PUBLIC_APP_ENV === 'development') return NextResponse.next();
  // miri-test 環境のみ認証不要（テスト用）
  const host = request.headers.get('host') ?? '';
  if (host.includes('miri-test')) return NextResponse.next();

  const { pathname } = request.nextUrl;
  // 認証不要のルート
  if (
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/setup') ||
    pathname.startsWith('/terms') ||
    pathname.startsWith('/privacy')
  ) {
    return NextResponse.next();
  }

  // miri_auth クッキーで認証確認
  if (!request.cookies.has('miri_auth')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon\\.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
