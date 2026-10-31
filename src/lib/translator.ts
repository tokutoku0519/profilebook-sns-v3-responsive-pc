// ============================================================
// 固定文言の翻訳（MyMemory）。使うのは useAutoTranslateUI だけで、送るのはアプリの固定文言だけ。
// ユーザーが書いた文章をここへ渡さないこと（自由回答の翻訳はサーバー側の翻訳APIで行う）。
// ============================================================
const memCache = new Map<string, string>();
// v2：固定文言だけを保存する。以前のキャッシュにはユーザーの文章の訳が含まれていた可能性があるので消す
const STORAGE_KEY = 'miri_trans_cache_v2';
const OLD_STORAGE_KEY = 'miri_trans_cache';
if (typeof window !== 'undefined') { try { localStorage.removeItem(OLD_STORAGE_KEY); } catch {} }

const LANG_TO_ISO: Record<string, string> = {
  en: 'en', ko: 'ko', zh: 'zh-CN', 'zh-tw': 'zh-TW',
  id: 'id', th: 'th', vi: 'vi', ms: 'ms',
  es: 'es', pt: 'pt', fr: 'fr', de: 'de', it: 'it',
  ru: 'ru', ar: 'ar', hi: 'hi', tr: 'tr', nl: 'nl',
  tl: 'tl',
};

function loadCache(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'); } catch { return {}; }
}

function setCache(key: string, value: string) {
  memCache.set(key, value);
  if (typeof window === 'undefined') return;
  try {
    const store = loadCache();
    store[key] = value;
    const entries = Object.entries(store);
    const trimmed = entries.length > 800 ? Object.fromEntries(entries.slice(-800)) : store;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {}
}

function getFromCache(key: string): string | undefined {
  if (memCache.has(key)) return memCache.get(key);
  const store = loadCache();
  if (store[key]) { memCache.set(key, store[key]); return store[key]; }
  return undefined;
}

// 同一文字列の同時リクエストを1本化（画面一括翻訳で同じ語が何度も走るのを防ぐ）
const inflight = new Map<string, Promise<string>>();
// 同時実行数を絞る（APIレート制限・端末負荷対策）
let active = 0;
const waitQueue: (() => void)[] = [];
const MAX_CONCURRENT = 4;
function acquire(): Promise<void> {
  return new Promise((res) => {
    if (active < MAX_CONCURRENT) { active++; res(); }
    else waitQueue.push(() => { active++; res(); });
  });
}
function release() {
  active--;
  const next = waitQueue.shift();
  if (next) next();
}

export async function translateText(text: string, targetLang: string, sourceLang = 'ja'): Promise<string> {
  if (!text.trim() || sourceLang === targetLang) return text;
  const key = `${sourceLang}|${targetLang}|${text}`;
  const cached = getFromCache(key);
  if (cached) return cached;
  const running = inflight.get(key);
  if (running) return running;

  const src = LANG_TO_ISO[sourceLang] || sourceLang;
  const tgt = LANG_TO_ISO[targetLang] || targetLang;
  const p = (async () => {
    await acquire();
    try {
      const res = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${src}|${tgt}`
      );
      const data = await res.json();
      const result = (data.responseData?.translatedText ?? text) as string;
      setCache(key, result);
      return result;
    } catch {
      return text;
    } finally {
      release();
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}
