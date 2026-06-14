import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'プロフィール帳SNS',
  description: '平成プロフィール帳 × シール帳 × SNS のMVPプロトタイプ'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
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
