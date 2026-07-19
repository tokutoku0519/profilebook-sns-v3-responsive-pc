'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LANG_LIST, type Lang } from '@/lib/i18n';
import { saveProfileIdentity } from '@/lib/db';

const MAIN_LANGS = ['ja', 'en', 'ko', 'zh', 'zh-tw', 'id', 'th', 'vi', 'tl', 'ms'];

function detectBrowserLang(): Lang {
  if (typeof window === 'undefined') return 'ja';
  const nav = (navigator.languages?.[0] ?? navigator.language ?? 'ja').toLowerCase();
  if (nav.startsWith('ja')) return 'ja';
  if (nav.startsWith('ko')) return 'ko';
  if (nav.startsWith('zh-tw') || nav.startsWith('zh-hant')) return 'zh-tw';
  if (nav.startsWith('zh')) return 'zh';
  if (nav.startsWith('id')) return 'id';
  if (nav.startsWith('th')) return 'th';
  if (nav.startsWith('vi')) return 'vi';
  if (nav.startsWith('fil') || nav.startsWith('tl')) return 'tl';
  if (nav.startsWith('ms')) return 'ms';
  if (nav.startsWith('es')) return 'es';
  if (nav.startsWith('pt')) return 'pt';
  if (nav.startsWith('fr')) return 'fr';
  if (nav.startsWith('de')) return 'de';
  if (nav.startsWith('it')) return 'it';
  if (nav.startsWith('ru')) return 'ru';
  if (nav.startsWith('ar')) return 'ar';
  if (nav.startsWith('hi')) return 'hi';
  if (nav.startsWith('tr')) return 'tr';
  if (nav.startsWith('nl')) return 'nl';
  return 'en';
}

export default function SetupPage() {
  const router = useRouter();
  const [miriId, setMiriId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [realName, setRealName] = useState('');
  const [lang, setLang] = useState<Lang>(() => detectBrowserLang());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function validate(id: string) {
    return /^[a-zA-Z0-9_]{3,20}$/.test(id);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!validate(miriId)) {
      setError('IDは3〜20文字の英数字とアンダースコアのみ使えます');
      return;
    }
    if (!displayName.trim()) {
      setError('表示名を入力してください');
      return;
    }
    setLoading(true);

    // Supabase のプロフィール（ID・表示名）を保存。
    // 未認証や未設定（＝①デモ等）のときは best-effort で先へ進む。
    const res = await saveProfileIdentity({ username: miriId, display_name: displayName.trim() });
    if (!res.ok && res.error === 'username_taken') {
      setError('このIDは既に使われています。別のIDにしてください');
      setLoading(false);
      return;
    }

    // ローカルにも保存（アプリ内の表示・ルーティング用）
    try {
      localStorage.setItem('miri_username', miriId);
      localStorage.setItem('miri_displayname', displayName.trim());
      if (realName.trim()) localStorage.setItem('miri_realname', realName.trim());
      localStorage.setItem('miri_lang', lang);
    } catch {}
    router.push('/welcome');
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-base px-6 gap-8">
      <div className="flex flex-col items-center gap-3">
        <img src="/icon.png" alt="Miri" className="h-20 w-20 rounded-[24px] shadow-card" />
        <p className="text-2xl font-black text-ink">はじめての設定</p>
        <p className="text-sm font-bold text-muted">あとから変更できます</p>
      </div>

      <div className="w-full max-w-sm rounded-[32px] bg-white p-8 shadow-card">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">

          {/* ID */}
          <div>
            <label className="mb-1.5 block text-xs font-black text-ink">
              ID <span className="text-pink">*</span>
            </label>
            <div className="flex h-12 w-full items-center rounded-full border-2 border-purple/20 bg-base px-5 focus-within:border-pink">
              <span className="text-sm font-bold text-muted">@</span>
              <input
                type="text"
                placeholder="miriid（英数字・_）"
                value={miriId}
                onChange={e => { setMiriId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')); setError(''); }}
                maxLength={20}
                required
                className="flex-1 bg-transparent pl-1 text-sm font-bold text-ink placeholder:text-muted focus:outline-none"
              />
            </div>
            <p className="mt-1 pl-2 text-[10px] font-bold text-muted">3〜20文字。URLに使われます（例: miri.app/@{miriId || 'yourID'}）</p>
          </div>

          {/* 表示名 */}
          <div>
            <label className="mb-1.5 block text-xs font-black text-ink">
              表示名 <span className="text-pink">*</span>
            </label>
            <input
              type="text"
              placeholder="みんなに見える名前"
              value={displayName}
              onChange={e => { setDisplayName(e.target.value); setError(''); }}
              maxLength={30}
              required
              className="h-12 w-full rounded-full border-2 border-purple/20 bg-base px-5 text-sm font-bold text-ink placeholder:text-muted focus:border-pink focus:outline-none"
            />
          </div>

          {/* 氏名 */}
          <div>
            <label className="mb-1.5 block text-xs font-black text-ink">氏名</label>
            <input
              type="text"
              placeholder="本名（非公開）"
              value={realName}
              onChange={e => setRealName(e.target.value)}
              maxLength={50}
              className="h-12 w-full rounded-full border-2 border-purple/20 bg-base px-5 text-sm font-bold text-ink placeholder:text-muted focus:border-pink focus:outline-none"
            />
            <p className="mt-1 pl-2 text-[10px] font-bold text-muted">他のユーザーには公開されません</p>
          </div>

          {/* 言語 */}
          <div>
            <label className="mb-1.5 block text-xs font-black text-ink">
              言語
              <span className="ml-2 text-[10px] font-bold text-muted normal-case">端末の言語を自動検出しました</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {LANG_LIST.filter(l => MAIN_LANGS.includes(l.id)).map(l => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setLang(l.id)}
                  className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-bold transition ${lang === l.id ? 'bg-pink text-white shadow-floating' : 'bg-base text-muted hover:bg-pink/10'}`}
                >
                  <span>{l.flag}</span>
                  <span>{l.name}</span>
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-center text-xs font-bold text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading || miriId.length < 3 || !displayName.trim()}
            className="h-12 w-full rounded-full bg-pink text-sm font-black text-white shadow-floating transition active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? '...' : 'はじめる →'}
          </button>
        </form>
      </div>
    </div>
  );
}
