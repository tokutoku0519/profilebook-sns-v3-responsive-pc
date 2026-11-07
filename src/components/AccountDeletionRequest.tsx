'use client';
// ============================================================
// マイページ：退会・データ削除の申請（運営者に申請し、運営者が確認して削除する）
// 削除の対象と、法令に基づいて一定期間保存する記録を分けて説明する。
// 申請は既存の feedback テーブルに kind='account_deletion' で記録する（テーブルの構造は変えない）。
// ============================================================
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { t, type Lang } from '@/lib/i18n';
import { submitAccountDeletionRequest } from '@/lib/db';

export function AccountDeletionRequest({ lang }: { lang: Lang }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<'' | 'done' | 'failed'>('');

  async function send() {
    setBusy(true);
    const ok = await submitAccountDeletionRequest(note);
    setBusy(false);
    setResult(ok ? 'done' : 'failed');
    if (ok) { setOpen(false); setNote(''); }
  }

  return (
    <section data-account-deletion>
      <button
        type="button"
        onClick={() => { setOpen(true); setResult(''); }}
        className="flex w-full items-center justify-between rounded-[24px] border-2 border-ink/10 bg-white px-5 py-4 text-left shadow-card transition active:scale-[0.98]"
      >
        <span className="text-sm font-black text-ink">{t('del_title', lang)}</span>
        <span className="text-xs font-black text-muted">→</span>
      </button>
      {result === 'done' && <p role="status" className="mt-2 px-2 text-[12px] font-bold text-muted">{t('del_done', lang)}</p>}
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
            {result === 'failed' && <p role="alert" className="mt-2 text-[12px] font-bold text-red-500">{t('del_failed', lang)}</p>}
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
