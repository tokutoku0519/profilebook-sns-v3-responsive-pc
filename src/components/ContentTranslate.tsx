'use client';
// ============================================================
// 「翻訳を見る／原文を見る」（公開プロフ帳の自由回答・公開回答）
//  ・ボタンが出るのは：翻訳が使える／書いた本人が翻訳を許可している／表示言語と原文の言語が違う文があるとき
//  ・押したときだけ翻訳する。原文は消さず、もう一度押すと原文に戻る
//  ・失敗・予算切れ・権限なしの項目は原文のまま
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { t, type Lang } from '@/lib/i18n';
import { consentItemKey, differsFromViewer, keepWithoutEngine, type ConsentCandidate, type ConsentItem, type TranslateItem } from '@/lib/translation/shared';
import { ageFrom, CONSENT_TEXT, CONSENT_VERSION, consentLocaleFor, MIN_CONSENT_AGE } from '@/lib/translation/consentText';
import {
  fetchTranslateAvailability, getMyTranslationConsent, grantTranslationConsent, listConsentCandidates, requestTranslations,
  revokeTranslationConsent, setTranslationItems, type MyConsent,
} from '@/lib/translation/client';

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

/** マイページ：自分の公開プロフ帳・公開回答の翻訳の許可（翻訳が使えるときだけ出す）。
 *  直接オンにはできない。説明（外国の名称・制度・事業者の措置・保存期間・取り消し方法など）と項目の選択、
 *  年齢の確認、同意のチェックを経て許可する。説明は日本語と英語で表示する。 */
export function TranslationConsentCard({ lang }: { lang: Lang }) {
  const T = CONSENT_TEXT[consentLocaleFor(lang)];
  const [enabled, setEnabled] = useState(false);
  const [state, setState] = useState<MyConsent | null>(null);
  const [sheet, setSheet] = useState<null | 'grant' | 'edit'>(null);
  const [notice, setNotice] = useState('');
  const reload = async () => setState(await getMyTranslationConsent());
  useEffect(() => {
    let cancelled = false;
    fetchTranslateAvailability().then(async (a) => {
      if (cancelled || !a.enabled) return;
      setEnabled(true);
      const v = await getMyTranslationConsent();
      if (!cancelled) setState(v);
    });
    return () => { cancelled = true; };
  }, []);
  if (!enabled || !state) return null;
  const on = state.allow && state.current;
  const date = state.grantedAt ? new Date(state.grantedAt).toLocaleDateString(lang === 'ja' ? 'ja-JP' : undefined) : '';
  async function revoke() {
    if (!window.confirm(T.revokeConfirm)) return;
    const r = await revokeTranslationConsent();
    setNotice(r.ok ? T.revoked : T.failed);
    await reload();
  }
  return (
    <section className="rounded-3xl bg-white p-4 shadow-card" data-translation-consent data-state={on ? 'on' : state.allow ? 'reconfirm' : 'off'}>
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-xl">🌐</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-ink">{T.cardTitle}</p>
          <p className="mt-1 text-[12px] font-bold leading-relaxed text-muted">
            {on ? T.cardOn(state.version ?? '', date, state.items.length) : state.allow ? T.cardReconfirm : T.cardOff}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {!on && (
          <button type="button" onClick={() => setSheet('grant')} className="min-h-[40px] rounded-full bg-ink px-4 text-[13px] font-black text-white active:scale-[0.97]">
            {state.allow ? T.cardReview : T.cardOpen}
          </button>
        )}
        {on && (
          <>
            <button type="button" onClick={() => setSheet('edit')} className="min-h-[40px] rounded-full border-2 border-ink/15 bg-white px-4 text-[13px] font-black text-ink active:scale-[0.97]">{T.cardEditItems}</button>
            <button type="button" onClick={() => setSheet('grant')} className="min-h-[40px] rounded-full border-2 border-ink/15 bg-white px-4 text-[13px] font-black text-ink active:scale-[0.97]">{T.cardReview}</button>
            <button type="button" onClick={revoke} className="min-h-[40px] rounded-full border-2 border-red-200 bg-white px-4 text-[13px] font-black text-red-500 active:scale-[0.97]">{T.cardRevoke}</button>
          </>
        )}
      </div>
      {notice && <p role="status" className="mt-2 text-[11px] font-bold text-muted">{notice}</p>}
      {sheet && (
        <ConsentSheet
          lang={lang}
          mode={sheet}
          current={state.allow ? state.items : []}
          onClose={() => setSheet(null)}
          onDone={async (msg) => { setSheet(null); setNotice(msg); await reload(); }}
        />
      )}
    </section>
  );
}

function ConsentSheet({ lang, mode, current, onClose, onDone }: {
  lang: Lang; mode: 'grant' | 'edit'; current: ConsentItem[]; onClose: () => void; onDone: (msg: string) => void;
}) {
  const locale = consentLocaleFor(lang);
  const T = CONSENT_TEXT[locale];
  const [candidates, setCandidates] = useState<ConsentCandidate[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(current.map(consentItemKey)));
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { listConsentCandidates().then((c) => setCandidates(c ?? [])); }, []);
  const age = year && month ? ageFrom(Number(year), Number(month)) : null;
  const ageOk = mode === 'edit' || (age != null && age >= MIN_CONSENT_AGE);
  const chosen = (candidates ?? []).filter((c) => picked.has(consentItemKey(c.item))).map((c) => c.item);
  const canSubmit = !busy && chosen.length > 0 && ageOk && (mode === 'edit' || agree);
  const toggle = (k: string) => setPicked((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const labelOf = (c: ConsentCandidate) => (c.item.kind === 'answer' ? `${T.answerLabel}${c.question ? `「${c.question}」` : ''}` : T.sectionLabels[c.item.key] ?? c.item.key);

  async function submit() {
    setBusy(true); setError('');
    const r = mode === 'edit' ? await setTranslationItems(chosen) : await grantTranslationConsent(CONSENT_VERSION, locale, chosen);
    setBusy(false);
    if (r.ok) onDone(T.saved); else setError(T.failed);
  }

  // 画面の下のタブバーより手前に出すため、body の直下に出す（マイページの中に置くと、スマホで許可ボタンがタブバーに隠れる）
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true" aria-label={T.title} data-consent-sheet>
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl">
        <div className="overflow-y-auto px-5 pb-4 pt-5">
          <p className="text-base font-black text-ink">{mode === 'edit' ? T.itemsHeading : T.title}</p>
          <p className="mt-1 text-[11px] font-bold text-muted">{CONSENT_VERSION}{T.languageNote ? ` · ${T.languageNote}` : ''}</p>
          {mode === 'grant' && (
            <>
              <p className="mt-3 text-[13px] font-bold leading-relaxed text-ink">{T.lead}</p>
              {T.sections.map((sec) => (
                <div key={sec.h} className="mt-3">
                  <p className="text-[13px] font-black text-ink">{sec.h}</p>
                  {sec.body.map((b, i) => <p key={i} className="mt-0.5 break-words text-[12px] font-bold leading-relaxed text-muted">{b}</p>)}
                </div>
              ))}
              <a href="/privacy" target="_blank" rel="noreferrer" className="mt-3 inline-block text-[12px] font-black text-pink underline">{T.policyLink}</a>
            </>
          )}

          <div className="mt-4 rounded-2xl bg-base p-3">
            <p className="text-[13px] font-black text-ink">{T.itemsHeading}</p>
            <p className="mt-0.5 text-[11px] font-bold leading-relaxed text-muted">{T.itemsHelp}</p>
            {candidates == null ? null : candidates.length === 0 ? (
              <p className="mt-2 text-[12px] font-bold text-muted">{T.itemsEmpty}</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {candidates.map((c) => {
                  const k = consentItemKey(c.item);
                  return (
                    <li key={k}>
                      <label className="flex min-h-[44px] cursor-pointer items-start gap-2 rounded-xl bg-white px-3 py-2">
                        <input type="checkbox" checked={picked.has(k)} onChange={() => toggle(k)} className="mt-0.5 h-4 w-4 shrink-0" data-item={k} />
                        <span className="min-w-0">
                          <span className="block text-[12px] font-black text-ink">{labelOf(c)}</span>
                          <span className="block break-words text-[11px] font-bold text-muted">{c.preview}</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {mode === 'grant' && (
            <>
              <div className="mt-4 rounded-2xl bg-base p-3">
                <p className="text-[13px] font-black text-ink">{T.ageHeading}</p>
                <p className="mt-0.5 text-[11px] font-bold leading-relaxed text-muted">{T.ageHelp}</p>
                <div className="mt-2 flex gap-2">
                  <label className="flex-1 text-[11px] font-bold text-muted">{T.ageYear}
                    <select value={year} onChange={(e) => setYear(e.target.value)} className="mt-1 block w-full rounded-xl border-2 border-ink/10 bg-white px-2 py-2 text-[13px] text-ink" data-age-year>
                      <option value="">—</option>
                      {Array.from({ length: 100 }, (_, i) => thisYear - i).map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </label>
                  <label className="w-24 text-[11px] font-bold text-muted">{T.ageMonth}
                    <select value={month} onChange={(e) => setMonth(e.target.value)} className="mt-1 block w-full rounded-xl border-2 border-ink/10 bg-white px-2 py-2 text-[13px] text-ink" data-age-month>
                      <option value="">—</option>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </label>
                </div>
                {age != null && age < MIN_CONSENT_AGE && <p role="alert" className="mt-2 text-[12px] font-black text-red-500">{T.ageUnder}</p>}
              </div>
              <label className="mt-4 flex cursor-pointer items-start gap-2">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" data-agree />
                <span className="text-[12px] font-black leading-relaxed text-ink">{T.agree}</span>
              </label>
            </>
          )}
          {error && <p role="alert" className="mt-2 text-[12px] font-bold text-red-500">{error}</p>}
        </div>
        <div className="flex gap-2 border-t border-ink/10 px-5 py-3">
          <button type="button" onClick={onClose} className="min-h-[44px] flex-1 rounded-full border-2 border-ink/15 bg-white text-[13px] font-black text-ink">{T.cancel}</button>
          <button type="button" onClick={submit} disabled={!canSubmit} className="min-h-[44px] flex-1 rounded-full bg-ink text-[13px] font-black text-white disabled:opacity-40" data-consent-submit>
            {mode === 'edit' ? T.saveItems : T.grant}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
