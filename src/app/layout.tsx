import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Miri — みんなのプロフィール帳SNS',
  description: '平成プロフィール帳 × シール帳 × SNS。お題に答えて、プロフ帳を交換しよう。',
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
  openGraph: {
    title: 'Miri — みんなのプロフィール帳SNS',
    description: '平成プロフィール帳 × シール帳 × SNS。お題に答えて、プロフ帳を交換しよう。',
    images: ['/icon.png'],
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Miri — みんなのプロフィール帳SNS',
    description: '平成プロフィール帳 × シール帳 × SNS。お題に答えて、プロフ帳を交換しよう。',
    images: ['/icon.png'],
  },
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#4F73E8" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Miri" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Klee+One&family=M+PLUS+Rounded+1c:wght@400;700&family=Zen+Kurenaido&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
