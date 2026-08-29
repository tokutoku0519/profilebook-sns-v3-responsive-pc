'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LANG_LIST, type Lang } from '@/lib/i18n';
import { saveProfileIdentity, isUsernameAvailable } from '@/lib/db';

const MAIN_LANGS = ['ja', 'en', 'ko', 'zh', 'zh-tw', 'id', 'th', 'vi', 'tl', 'ms'];

// 取得を禁止する予約語（大文字小文字は区別しない＝入力は小文字化される）
const RESERVED_IDS = new Set([
  'admin', 'administrator', 'miri', 'official', 'support', 'help', 'info',
  'login', 'signup', 'signin', 'logout', 'auth', 'api', 'root', 'system',
  'www', 'mail', 'contact', 'terms', 'privacy', 'setup', 'welcome',
  'me', 'user', 'users', 'account', 'accounts', 'settings', 'null', 'undefined',
]);

const ID_MIN = 3;
const ID_MAX = 20;

type IdStatus = 'idle' | 'invalid' | 'reserved' | 'checking' | 'available' | 'taken';

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

function readLS(key: string): string {
  if (typeof window === 'undefined') return '';
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}

export default function SetupPage() {
  const router = useRouter();
  // 既存ユーザーの「ID・表示名の変更」も兼ねるため、保存済みの値を初期表示する。
  const [miriId, setMiriId] = useState(() => readLS('miri_username'));
  const [displayName, setDisplayName] = useState(() => readLS('miri_displayname'));
  const [lastName, setLastName] = useState(() => readLS('miri_lastname'));
  const [firstName, setFirstName] = useState(() => readLS('miri_firstname'));
  const [lang, setLang] = useState<Lang>(() => detectBrowserLang());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [idStatus, setIdStatus] = useState<IdStatus>('idle');

  // 変更前の自分のID（編集時は自分のIDは「使用可」として扱う）
  const originalId = readLS('miri_username');

  function validateFormat(id: string) {
    return new RegExp(`^[a-z0-9_]{${ID_MIN},${ID_MAX}}$`).test(id);
  }

  // ID の空き確認（入力が止まってから Supabase に照会）
  useEffect(() => {
    const id = miriId;
    if (!id) { setIdStatus('idle'); return; }
    if (!validateFormat(id)) { setIdStatus('invalid'); return; }
    if (RESERVED_IDS.has(id)) { setIdStatus('reserved'); return; }
    if (id === originalId) { setIdStatus('available'); return; } // 自分の現在のIDはOK
    setIdStatus('checking');
    let cancelled = false;
    const timer = setTimeout(async () => {
      const ok = await isUsernameAvailable(id);
      if (!cancelled) setIdStatus(ok ? 'available' : 'taken');
    }, 450);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [miriId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!validateFormat(miriId)) {
      setError(`IDは${ID_MIN}〜${ID_MAX}文字の英数字とアンダースコアのみ使えます`);
      return;
    }
    if (RESERVED_IDS.has(miriId)) {
      setError('このIDは使えません（予約語）');
      return;
    }
    if (idStatus === 'taken') {
      setError('このIDは既に使われています。別のIDにしてください');
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
      setIdStatus('taken');
      setLoading(false);
      return;
    }

    // ローカルにも保存（アプリ内の表示・ルーティング用）。氏名は非公開なのでローカルのみ。
    try {
      localStorage.setItem('miri_username', miriId);
      localStorage.setItem('miri_displayname', displayName.trim());
      if (lastName.trim()) localStorage.setItem('miri_lastname', lastName.trim());
      else localStorage.removeItem('miri_lastname');
      if (firstName.trim()) localStorage.setItem('miri_firstname', firstName.trim());
      else localStorage.removeItem('miri_firstname');
      const full = `${lastName.trim()} ${firstName.trim()}`.trim();
      if (full) localStorage.setItem('miri_realname', full);
      localStorage.setItem('miri_lang', lang);
    } catch {}
    // 初回設定はオンボーディング（/welcome）へ。既にオンボード済み＝ID/名前の“編集”なら
    // アプリ（自分のプロフィール）に戻す（ようこそ画面に戻さない）。
    const onboarded = readLS('miri_onboarded') === '1';
    if (onboarded) router.push(`/${miriId}`);
    else router.push('/welcome');
  }

  // ID欄の下に出すステータス表示
  const idHint = (() => {
    switch (idStatus) {
      case 'checking':  return { text: '確認中…', cls: 'text-muted' };
      case 'available': return { text: '✓ このIDは使えます', cls: 'text-emerald-600' };
      case 'taken':     return { text: '✕ このIDは既に使われています', cls: 'text-red-500' };
      case 'reserved':  return { text: '✕ このIDは使えません（予約語）', cls: 'text-red-500' };
      case 'invalid':   return { text: `${ID_MIN}〜${ID_MAX}文字の英数字と _ のみ`, cls: 'text-red-500' };
      default:          return null;
    }
  })();

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
            <p className="mt-1 pl-2 text-[10px] font-bold text-muted">{ID_MIN}〜{ID_MAX}文字。URLに使われます（例: miri.app/@{miriId || 'yourID'}）</p>
            {idHint && <p className={`mt-1 pl-2 text-[10px] font-black ${idHint.cls}`}>{idHint.text}</p>}
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

          {/* 氏名（姓・名で分ける／非公開） */}
          <div>
            <label className="mb-1.5 block text-xs font-black text-ink">氏名</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="姓"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                maxLength={25}
                className="h-12 w-1/2 rounded-full border-2 border-purple/20 bg-base px-5 text-sm font-bold text-ink placeholder:text-muted focus:border-pink focus:outline-none"
              />
              <input
                type="text"
                placeholder="名"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                maxLength={25}
                className="h-12 w-1/2 rounded-full border-2 border-purple/20 bg-base px-5 text-sm font-bold text-ink placeholder:text-muted focus:border-pink focus:outline-none"
              />
            </div>
            <p className="mt-1 pl-2 text-[10px] font-bold text-muted">他のユーザーには公開されません（任意）</p>
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
            disabled={loading || miriId.length < ID_MIN || !displayName.trim() || idStatus === 'taken' || idStatus === 'reserved' || idStatus === 'invalid'}
            className="h-12 w-full rounded-full bg-pink text-sm font-black text-white shadow-floating transition active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? '...' : 'はじめる →'}
          </button>
        </form>
      </div>
    </div>
  );
}
