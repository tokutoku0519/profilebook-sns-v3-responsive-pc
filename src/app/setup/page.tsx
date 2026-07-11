'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LANG_LIST, type Lang } from '@/lib/i18n';

const MAIN_LANGS = ['ja', 'en', 'ko', 'zh', 'zh-tw', 'id', 'th', 'vi', 'tl', 'ms'];

export default function SetupPage() {
  const router = useRouter();
  const [miriId, setMiriId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [address, setAddress] = useState('');
  const [lang, setLang] = useState<Lang>('ja');
  const [error, setError] = useState('');

  function validate(id: string) {
    return /^[a-zA-Z0-9_]{3,20}$/.test(id);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!validate(miriId)) {
      setError('IDは3〜20文字の英数字とアンダースコアのみ使えます');
      return;
    }
    if (!displayName.trim()) {
      setError('名前を入力してください');
      return;
    }
    try {
      localStorage.setItem('miri_username', miriId);
      localStorage.setItem('miri_displayname', displayName.trim());
      if (address.trim()) localStorage.setItem('miri_address', address.trim());
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
            <p className="mt-1 pl-2 text-[10px] font-bold text-muted">3〜20文字。プロフィールURLに使われます（例: miri.app/@{miriId || 'yourID'}）</p>
          </div>

          {/* 名前 */}
          <div>
            <label className="mb-1.5 block text-xs font-black text-ink">
              名前 <span className="text-pink">*</span>
            </label>
            <input
              type="text"
              placeholder="表示される名前"
              value={displayName}
              onChange={e => { setDisplayName(e.target.value); setError(''); }}
              maxLength={30}
              required
              className="h-12 w-full rounded-full border-2 border-purple/20 bg-base px-5 text-sm font-bold text-ink placeholder:text-muted focus:border-pink focus:outline-none"
            />
          </div>

          {/* アドレス */}
          <div>
            <label className="mb-1.5 block text-xs font-black text-ink">アドレス</label>
            <input
              type="text"
              placeholder="連絡先（LINE IDやメールなど）"
              value={address}
              onChange={e => setAddress(e.target.value)}
              maxLength={100}
              className="h-12 w-full rounded-full border-2 border-purple/20 bg-base px-5 text-sm font-bold text-ink placeholder:text-muted focus:border-pink focus:outline-none"
            />
          </div>

          {/* 言語 */}
          <div>
            <label className="mb-1.5 block text-xs font-black text-ink">言語</label>
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
            disabled={miriId.length < 3 || !displayName.trim()}
            className="h-12 w-full rounded-full bg-pink text-sm font-black text-white shadow-floating transition active:scale-[0.98] disabled:opacity-60"
          >
            はじめる →
          </button>
        </form>
      </div>
    </div>
  );
}
