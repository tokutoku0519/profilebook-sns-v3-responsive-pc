export type AppEnv = 'development' | 'production';

export const appEnv: AppEnv =
  (process.env.NEXT_PUBLIC_APP_ENV as AppEnv) ?? 'development';

/** ダミーデータを表示するのは development のみ */
export const isDev = appEnv === 'development';

/**
 * ログイン不要（認証バイパス）で開けるホスト。
 * デモ・テスト用の Vercel ドメインはログインを経由せずアプリを表示する。
 */
export function isAuthBypassHost(host: string): boolean {
  return host.includes('miri-test') || host.includes('miri-delta');
}
