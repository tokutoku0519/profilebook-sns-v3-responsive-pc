'use client';
// ============================================================
// 「翻訳を見る／原文を見る」（公開プロフ帳の自由回答・公開回答）
//  ・ボタンが出るのは：翻訳が使える／書いた本人が翻訳を許可している／表示言語と原文の言語が違う文があるとき
//  ・押したときだけ翻訳する。原文は消さず、もう一度押すと原文に戻る
//  ・失敗・予算切れ・権限なしの項目は原文のまま
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { t, type Lang } from '@/lib/i18n';
import { differsFromViewer, keepWithoutEngine, type TranslateItem } from '@/lib/translation/shared';
import { fetchTranslateAvailability, getMyTranslationConsent, requestTranslations, setMyTranslationConsent } from '@/lib/translation/client';

export type TranslateCandidate = { item: TranslateItem; text: string };

/** 画面に渡す訳文のキー：プロフ帳は項目の場所（motto など）、回答は answer:<id> */
const displayKey = (it: TranslateItem) => (it.kind === 'answer' ? `answer:${it.id}` : it.path);
const resultKey = (it: TranslateItem) => (it.kind === 'answer' ? `answer:${it.id}` : `profile:${it.owner}:${it.path}`);

export type ContentTranslation = {
  visible: boolean;
  mock: boolean;
  showing: boolean;
  busy: boolean;
  notice: '' | 'unavailable' | 'login' | 'nothing';
  translated: Record<string, string> | undefined;
  toggle: () => void;
};

export function useContentTranslation(owner: string | null, lang: Lang, candidates: TranslateCandidate[]): ContentTranslation {
  // 表示言語と違う言語で、訳す意味のある文だけ（記号だけ・用語集で残す語だけの文はボタンを出す理由にしない）
  const usable = useMemo(() => candidates.filter((c) => c.text.trim() && differsFromViewer(c.text, lang) && !keepWithoutEngine(c.text)), [candidates, lang]);
  const sig = usable.map((c) => resultKey(c.item) + '\u0000' + c.text).join('\u0001');
  const [avail, setAvail] = useState<{ enabled: boolean; mock: boolean; ownerAllows?: boolean } | null>(null);
  const [map, setMap] = useState<Record<string, string> | null>(null);
  const [showing, setShowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<ContentTranslation['notice']>('');

  // 相手・言語・原文が変わったら、表示を原文に戻して取り直す
  useEffect(() => { setMap(null); setShowing(false); setNotice(''); }, [owner, lang, sig]);
  useEffect(() => {
    if (!owner || usable.length === 0) { setAvail(null); return; }
    let cancelled = false;
    fetchTranslateAvailability(owner).then((a) => { if (!cancelled) setAvail(a); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, usable.length > 0]);

  const visible = !!avail?.enabled && !!avail.ownerAllows && usable.length > 0;

  async function toggle() {
    if (busy) return;
    if (showing) { setShowing(false); return; }
    if (map) { setShowing(true); return; }
    setBusy(true); setNotice('');
    const res = await requestTranslations(lang, usable.map((c) => c.item));
    setBusy(false);
    if (!res) { setNotice('login'); return; }
    const byKey = new Map(res.results.map((r) => [r.key, r]));
    const next: Record<string, string> = {};
    for (const c of usable) {
      const r = byKey.get(resultKey(c.item));
      if (r?.status === 'done' && r.text) next[displayKey(c.item)] = r.text;
    }
    if (Object.keys(next).length === 0) {
      const anyKept = res.results.some((r) => r.status === 'kept');
      setNotice(anyKept ? 'nothing' : 'unavailable');
      return;
    }
    setMap(next);
    setShowing(true);
  }

  return { visible, mock: !!avail?.mock, showing, busy, notice, translated: showing && map ? map : undefined, toggle };
}

/** 翻訳ボタンと注記（プロフ帳の上・回答の下に置く） */
export function TranslateBar({ tr, lang, compact = false }: { tr: ContentTranslation; lang: Lang; compact?: boolean }) {
  if (!tr.visible) return null;
  const note = tr.notice === 'login' ? t('tr_login', lang) : tr.notice === 'unavailable' ? t('tr_unavailable', lang) : tr.notice === 'nothing' ? t('tr_nothing', lang) : '';
  return (
    <div className={compact ? 'mt-2' : 'flex flex-wrap items-center gap-x-3 gap-y-1'} data-translate-bar>
      <button
        type="button"
        onClick={tr.toggle}
        disabled={tr.busy}
        aria-pressed={tr.showing}
        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border-2 border-ink/15 bg-white px-3.5 py-1.5 text-[13px] font-black text-ink shadow-sm active:scale-[0.97] disabled:opacity-60"
      >
        <span aria-hidden>🌐</span>
        {tr.busy ? t('tr_loading', lang) : tr.showing ? t('tr_original', lang) : t('tr_show', lang)}
      </button>
      {tr.showing && (
        <span className="text-[11px] font-bold leading-snug text-muted">
          {tr.mock ? t('tr_mock_note', lang) : t('tr_ai_note', lang)}
        </span>
      )}
      {note && <span role="status" className="text-[11px] font-bold leading-snug text-muted">{note}</span>}
    </div>
  );
}

/** マイページ：自分の公開プロフ帳・公開回答の翻訳を許可するか（翻訳が使えるときだけ出す） */
export function TranslationConsentCard({ lang }: { lang: Lang }) {
  const [enabled, setEnabled] = useState(false);
  const [allow, setAllow] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetchTranslateAvailability().then(async (a) => {
      if (cancelled || !a.enabled) return;
      setEnabled(true);
      const v = await getMyTranslationConsent();
      if (!cancelled) setAllow(v);
    });
    return () => { cancelled = true; };
  }, []);
  if (!enabled || allow === null) return null;
  async function change(next: boolean) {
    setSaving(true); setSaved(false);
    const ok = await setMyTranslationConsent(next);
    setSaving(false);
    if (ok) { setAllow(next); setSaved(true); }
  }
  return (
    <section className="rounded-3xl bg-white p-4 shadow-card" data-translation-consent>
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-xl">🌐</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-ink">{t('tr_consent_title', lang)}</p>
          <p className="mt-1 text-[12px] font-bold leading-relaxed text-muted">{t('tr_consent_desc', lang)}</p>
          <p className="mt-1 text-[11px] font-bold leading-relaxed text-muted">{t('tr_consent_ext', lang)}</p>
        </div>
      </div>
      <label className="mt-3 flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-2xl bg-base px-3 py-2">
        <span className="text-[13px] font-black text-ink">{t('tr_consent_on', lang)}</span>
        <input
          type="checkbox"
          role="switch"
          checked={allow}
          disabled={saving}
          onChange={(e) => change(e.target.checked)}
          className="h-5 w-5 accent-[rgb(255_122_105)]"
        />
      </label>
      {saved && <p role="status" className="mt-2 text-[11px] font-bold text-muted">{t('tr_consent_saved', lang)}</p>}
    </section>
  );
}
