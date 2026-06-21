const memCache = new Map<string, string>();
const STORAGE_KEY = 'miri_trans_cache';

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

export async function translateText(text: string, targetLang: string, sourceLang = 'ja'): Promise<string> {
  if (!text.trim() || sourceLang === targetLang) return text;
  const key = `${sourceLang}|${targetLang}|${text}`;
  const cached = getFromCache(key);
  if (cached) return cached;

  const src = LANG_TO_ISO[sourceLang] || sourceLang;
  const tgt = LANG_TO_ISO[targetLang] || targetLang;
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
  }
}

// Translate an array of texts, throttling to avoid rate limit
export async function translateBatch(
  texts: string[],
  targetLang: string,
  sourceLang = 'ja',
  delayMs = 150
): Promise<string[]> {
  const results: string[] = [];
  for (const text of texts) {
    results.push(await translateText(text, targetLang, sourceLang));
    if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
  }
  return results;
}
