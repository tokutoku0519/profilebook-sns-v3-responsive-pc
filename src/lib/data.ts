/**
 * 環境に応じてデータを切り替えるエントリポイント。
 * development: モックデータを使用（ダミーユーザー付き）
 * staging / production: 空配列（Supabaseから取得する）
 */
import { isDev } from './env';
import {
  answers as mockAnswers,
  profiles as mockProfiles,
  questions as mockQuestions,
} from './mock';

export const initialAnswers = isDev ? mockAnswers : [];
export const profiles = isDev ? mockProfiles : [];
export const questions = isDev ? mockQuestions : [];
