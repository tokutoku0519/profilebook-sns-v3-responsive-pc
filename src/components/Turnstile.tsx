'use client';
import { useEffect, useRef } from 'react';

// Cloudflare Turnstile（ボット対策）ウィジェット。
// NEXT_PUBLIC_TURNSTILE_SITE_KEY 未設定なら何も描画せず、検証もスキップされる（安全に無効化）。
declare global {
  interface Window { turnstile?: any }
}

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
export const TURNSTILE_ENABLED = !!TURNSTILE_SITE_KEY;

const SCRIPT_ID = 'cf-turnstile-script';

export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let cancelled = false;

    const render = () => {
      if (cancelled || !ref.current || !window.turnstile || widgetId.current !== null) return;
      try {
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token: string) => onToken(token),
          'error-callback': () => onToken(''),
          'expired-callback': () => onToken(''),
          theme: 'light',
        });
      } catch { /* 既にレンダー済み等は無視 */ }
    };

    if (window.turnstile) {
      render();
    } else if (!document.getElementById(SCRIPT_ID)) {
      const s = document.createElement('script');
      s.id = SCRIPT_ID;
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true; s.defer = true;
      s.onload = render;
      document.head.appendChild(s);
    } else {
      const timer = setInterval(() => { if (window.turnstile) { clearInterval(timer); render(); } }, 200);
      setTimeout(() => clearInterval(timer), 6000);
    }

    return () => {
      cancelled = true;
      try { if (widgetId.current !== null) window.turnstile?.remove(widgetId.current); } catch {}
      widgetId.current = null;
    };
  }, [onToken]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={ref} className="flex justify-center" />;
}

/** 検証失敗後などにウィジェットをリセット（新しいトークンを取り直す）。 */
export function resetTurnstile() {
  try { window.turnstile?.reset(); } catch {}
}
