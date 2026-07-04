import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        // Arialに日本語グリフは無いため、英数字のみArial・日本語は游ゴシック
        // （無い環境ではNoto Sans JP / Noto Sans）で描画される
        sans: [
          'Arial',
          '"Yu Gothic"',
          'YuGothic',
          '"Noto Sans JP"',
          '"Noto Sans"',
          'sans-serif',
        ],
      },
      colors: {
        base:      'rgb(var(--color-base)      / <alpha-value>)',
        ink:       'rgb(var(--color-ink)       / <alpha-value>)',
        muted:     'rgb(var(--color-muted)     / <alpha-value>)',
        pink:      'rgb(var(--color-pink)      / <alpha-value>)',
        pinkStrong:'rgb(var(--color-pink-strong)/<alpha-value>)',
        purple:    'rgb(var(--color-purple)    / <alpha-value>)',
        cream:     'rgb(var(--color-cream)     / <alpha-value>)',
        mint:      'rgb(var(--color-mint)      / <alpha-value>)',
      },
      boxShadow: {
        card:     '0 4px 16px rgba(156, 125, 173, 0.10)',
        floating: '0 8px 24px rgba(156, 125, 173, 0.14)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
};
export default config;
