// ============================================================
// プレビュー（Vercel の Preview）が本番のデータベースにつながらないようにする安全装置
//
// ・プレビューでは、検証用 DB の印（NEXT_PUBLIC_DB_LABEL=staging）があるときだけ Supabase の URL を返す。
//   印がなければ、Supabase には一切つながない（画面は「設定がない」状態で動く）。
// ・本番（Production）と手元の開発には影響しない。
// ・プレビューかどうかは、ブラウザでは NEXT_PUBLIC_VERCEL_ENV（Vercel のシステム環境変数を公開する設定が必要）、
//   サーバーでは VERCEL_ENV で判断する。
// ============================================================
export function isPreviewDeploy(): boolean {
  return (process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV) === 'preview';
}

/** この配信で使ってよい Supabase の URL。プレビューで検証用の印がなければ null（つながない） */
export function supabaseUrlOrNull(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || null;
  if (!url) return null;
  if (isPreviewDeploy() && process.env.NEXT_PUBLIC_DB_LABEL !== 'staging') return null;
  return url;
}
