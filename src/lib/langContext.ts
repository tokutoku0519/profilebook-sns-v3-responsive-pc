'use client';
// アプリ全体の表示言語。画面ごとに lang を受け渡さなくても useLang() で読める。
// （プロフィール編集のように、画面の中だけ別の言語を使う箇所は従来どおり props/EditLangContext）
import { createContext, useContext } from 'react';
import type { Lang } from './i18n';

export const LangContext = createContext<Lang>('ja');
export const useLang = () => useContext(LangContext);
