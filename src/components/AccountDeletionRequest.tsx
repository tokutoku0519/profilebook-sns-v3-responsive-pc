'use client';
// ============================================================
// マイページ：退会・データ削除の申請（運営者に申請し、運営者が確認して削除する）
// 削除の対象と、法令に基づいて一定期間保存する記録を分けて説明する。
// 申請はサーバー（/api/account-deletion）が本人のトークンで記録する。受付中の申請があれば「受付中」と表示し、二重に送らない。
// ============================================================
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { t, type Lang } from '@/lib/i18n';
import { getAccountDeletionRequest, submitAccountDeletionRequest, type DeletionRequestState } from '@/lib/db';

export function AccountDeletionRequest({ lang }: { lang: Lang }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [state, setState] = useState<DeletionRequestState | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAccountDeletionRequest().then((s) => { if (!cancelled) setState(s); });
    return () => { cancelled = true; };
  }, []);

  async function send() {
    setBusy(true); setFailed(false);
    const r = await submitAccountDeletionRequest(note);
    setBusy(false);
    if (r) { setState(r); setOpen(false); setNote(''); } else setFailed(true);
  }
  const date = state?.requestedAt ? new Date(state.requestedAt).toLocaleDateString(lang === 'ja' ? 'ja-JP' : undefined) : '';

  return (
    <section data-account-deletion data-state={state?.pending ? 'pending' : 'none'}>
      {state?.pending ? (
        <div className="rounded-[24px] border-2 border-ink/10 bg-white px-5 py-4 shadow-card" role="status">
          <p className="text-sm font-black text-ink">{t('del_title', lang)}</p>
          <p className="mt-1 text-[12px] font-bold text-muted">{t('del_pending', lang)}{date ? (lang === 'ja' ? `（${t('del_requested_on', lang)}：${date}）` : ` (${t('del_requested_on', lang)}: ${date})`) : ''}</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { setOpen(true); setFailed(false); }}
          className="flex w-full items-center justify-between rounded-[24px] border-2 border-ink/10 bg-white px-5 py-4 text-left shadow-card transition active:scale-[0.98]"
        >
          <span className="text-sm font-black text-ink">{t('del_title', lang)}</span>
          <span className="text-xs font-black text-muted">→</span>
        </button>
      )}
      {/* 画面の下のタブバーより手前に出すため、body の直下に出す */}
      {open && createPortal(
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true" aria-label={t('del_title', lang)}>
          <div className="w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl">
            <p className="text-base font-black text-ink">{t('del_title', lang)}</p>
            <p className="mt-2 text-[13px] font-bold leading-relaxed text-ink">{t('del_desc', lang)}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[12px] font-bold leading-relaxed text-muted">
              <li>{t('del_what', lang)}</li>
              <li>{t('del_keep', lang)}</li>
              <li>{t('del_anthropic', lang)}</li>
            </ul>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder={t('del_note_ph', lang)}
              className="mt-3 w-full rounded-2xl border-2 border-ink/10 bg-base p-3 text-[13px] text-ink"
            />
            {failed && <p role="alert" className="mt-2 text-[12px] font-bold text-red-500">{t('del_failed', lang)}</p>}
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => setOpen(false)} className="min-h-[44px] flex-1 rounded-full border-2 border-ink/15 bg-white text-[13px] font-black text-ink">{t('btn_cancel', lang)}</button>
              <button type="button" onClick={send} disabled={busy} className="min-h-[44px] flex-1 rounded-full bg-red-500 text-[13px] font-black text-white disabled:opacity-50" data-deletion-submit>{t('del_submit', lang)}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
}
