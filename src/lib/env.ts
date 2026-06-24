export type AppEnv = 'development' | 'staging' | 'production';

export const appEnv: AppEnv =
  (process.env.NEXT_PUBLIC_APP_ENV as AppEnv) ?? 'development';

/** ダミーデータを表示するのは development のみ */
export const isDev = appEnv === 'development';
