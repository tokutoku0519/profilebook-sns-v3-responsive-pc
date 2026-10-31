// ============================================================
// 翻訳の保存先・権限の確認・予算（サーバー専用）
//
// MemoryStore（プレビュー・手元・自動テスト）
//   ・原文は「ログインしていない人」として Supabase から読む（anon キー・トークンなし）。
//     → 画面と同じ RLS・get_visible_book の判定を通った内容しか読めない＝フォロワー限定・非公開は物理的に読めない
//   ・翻訳・本人の許可・予算はサーバーのメモリに置く（DB は書きかえない。再起動で消える）
// DbStore（本番。supabase/proposal_content_translations.sql を適用したあと）
//   ・判定・保存・予算はすべて SQL の関数（service_role だけが実行できる）で行う
// どちらも「返すたびに権限を確かめる」「原文が変わった翻訳は使わない」「予算を確保してから呼ぶ」を守る。
// ============================================================
import { createHash } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isTranslatableProfilePath, type TranslateItem } from '../shared';
import { costUsd, type TranslationConfig, type Usage } from './config';

export type Source = { ownerId: string; text: string; hash: string; context?: string };
export type Cached = { status: 'done' | 'kept'; text?: string };
export type SaveInput = { status: 'done' | 'kept' | 'failed'; text?: string; keptTerms: string[]; usage: Usage | null; costUsd: number };
export type ReserveResult = { result: 'ok' | 'disabled' | 'budget' | 'user_limit' | 'owner_limit' | 'bad_estimate' | 'error'; id?: string };
export type UsageReport = { month: string; spentUsd: number; reservedUsd: number; requests: number; cacheHits: number; inputTokens: number; outputTokens: number; capUsd: number; targetUsd: number };

export interface TranslationStore {
  /** 権限を確かめてから翻訳済みを返す。null：翻訳済みなし／'unavailable'：今は翻訳してよい内容ではない */
  getCached(it: TranslateItem, lang: string): Promise<Cached | null | 'unavailable'>;
  /** 翻訳中の目印を取る。取れたら原文（権限を確かめた上で DB から読んだもの）を返す */
  claim(it: TranslateItem, lang: string, engine: string): Promise<{ claimed: true; source: Source } | { claimed: false; reason: 'unavailable' | 'busy' }>;
  release(it: TranslateItem, lang: string, hash: string): Promise<void>;
  /** 保存する瞬間にも原文と権限を確かめる。変わっていたら保存しない（false） */
  save(it: TranslateItem, lang: string, hash: string, r: SaveInput): Promise<boolean>;
  reserve(userId: string, ownerId: string, estimateUsd: number): Promise<ReserveResult>;
  settle(id: string, usage: Usage): Promise<number | null>;
  getConsent(userId: string): Promise<boolean>;
  setConsent(userId: string, allow: boolean): Promise<void>;
  ownerAllows(username: string): Promise<boolean>;
  usage(): Promise<UsageReport | null>;
}

export const md5 = (s: string) => createHash('md5').update(s, 'utf8').digest('hex');
const monthOf = (d = new Date()) => d.toISOString().slice(0, 7) + '-01';
const dayOf = (d = new Date()) => d.toISOString().slice(0, 10);
const MAX_FIELD_CHARS = 400;
const MAX_ANSWER_CHARS = 600;

// 翻訳の手がかり（AI に渡す質問文）。項目名は日本語で渡す
const FIELD_CONTEXT: Record<string, string> = {
  catchphrase: 'ひとこと', message: '自己紹介', hometown: '出身地', favoriteFood: '好きな食べもの', dislikeFood: '苦手な食べもの',
  favoriteColor: '好きな色', favoriteCharacter: '好きなキャラクター', specialty: '特技', holiday: '休日の過ごし方',
  wantToGo: '行ってみたい場所', collection: '集めているもの', motto: '座右の銘', charmPoint: 'チャームポイント', dream: '将来の夢',
};
const BEST3_CONTEXT: Record<string, string> = { drink: '飲みもの', tv: 'テレビ番組', artist: 'アーティスト', movie: '映画', book: '本・マンガ', game: 'ゲーム', hobby: '趣味' };
function profileContext(book: Record<string, any>, path: string): string | undefined {
  const p = path.split('.');
  if (p[0] === '__questions') { const q = book.__questions?.[Number(p[1])]?.q; return typeof q === 'string' ? q.slice(0, 200) : undefined; }
  if (p[0] === '__best3') return `好きな${BEST3_CONTEXT[p[1]] ?? p[1]} ベスト3`;
  if (p[0] === '__monthly') return p[1] === 'episode' ? '今月のエピソード' : '今月のベスト3';
  return FIELD_CONTEXT[p[0]];
}
const at = (obj: any, path: string) => path.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);

// ============================================================
// MemoryStore
// ============================================================
type MemRow = { status: 'pending' | 'done' | 'kept' | 'failed'; text?: string; keptTerms: string[]; at: number };
type MemReservation = { id: string; month: string; estimate: number; actual?: number; status: 'reserved' | 'settled' | 'expired'; createdAt: number };

export class MemoryStore implements TranslationStore {
  private anon: SupabaseClient;
  private rows = new Map<string, MemRow>();              // `${type}|${owner}|${path}|${lang}|${hash}`
  private consents = new Map<string, boolean>();         // user id → 許可
  private reservations = new Map<string, MemReservation>();
  private months = new Map<string, { spent: number; reserved: number; requests: number; cacheHits: number; input: number; output: number }>();
  private daily = new Map<string, number>();             // `user|id|day` / `owner|id|day`
  private seq = 0;

  constructor(private cfg: TranslationConfig, url: string, anonKey: string, private now = () => Date.now()) {
    this.anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  private month(m = monthOf(new Date(this.now()))) {
    if (!this.months.has(m)) this.months.set(m, { spent: 0, reserved: 0, requests: 0, cacheHits: 0, input: 0, output: 0 });
    return this.months.get(m)!;
  }

  /** 原文を「ログインしていない人」として読み、翻訳してよいかを確かめる */
  private async resolve(it: TranslateItem): Promise<Source | null> {
    if (it.kind === 'profile_field') {
      if (!isTranslatableProfilePath(it.path)) return null;
      const { data: prof } = await this.anon.from('profiles').select('id').eq('username', it.owner).maybeSingle();
      const ownerId = (prof as { id?: string } | null)?.id;
      if (!ownerId || !this.consents.get(ownerId)) return null;
      const { data: book } = await this.anon.rpc('get_visible_book', { target: it.owner });
      if (!book || typeof book !== 'object') return null;
      const top = it.path.split('.')[0];
      if (!(top in (book as object))) return null;                       // 未ログインの人には見えない項目
      const v = at(book, it.path);
      if (typeof v !== 'string' || !v.trim() || [...v].length > MAX_FIELD_CHARS) return null;
      return { ownerId, text: v, hash: md5(v), context: profileContext(book as Record<string, any>, it.path) };
    }
    const { data: a } = await this.anon.from('answers').select('id,user_id,question_title,body,visibility').eq('id', it.id).eq('visibility', 'public').maybeSingle();
    const row = a as { user_id?: string; question_title?: string; body?: string; visibility?: string } | null;
    if (!row || row.visibility !== 'public' || !row.user_id || !this.consents.get(row.user_id)) return null;
    if (typeof row.body !== 'string' || !row.body.trim() || [...row.body].length > MAX_ANSWER_CHARS) return null;
    return { ownerId: row.user_id, text: row.body, hash: md5(row.body), context: row.question_title?.slice(0, 200) };
  }

  private key(it: TranslateItem, ownerId: string, lang: string, hash: string) {
    return it.kind === 'answer' ? `answer|${ownerId}|${it.id}|${lang}|${hash}` : `profile_field|${ownerId}|${it.path}|${lang}|${hash}`;
  }

  async getCached(it: TranslateItem, lang: string) {
    const src = await this.resolve(it);
    if (!src) return 'unavailable' as const;
    const row = this.rows.get(this.key(it, src.ownerId, lang, src.hash));
    if (!row || (row.status !== 'done' && row.status !== 'kept')) return null;
    this.month().cacheHits++;
    return { status: row.status, text: row.text };
  }

  async claim(it: TranslateItem, lang: string) {
    const src = await this.resolve(it);
    if (!src) return { claimed: false as const, reason: 'unavailable' as const };
    const k = this.key(it, src.ownerId, lang, src.hash);
    const row = this.rows.get(k);
    if (row && (row.status === 'done' || row.status === 'kept')) return { claimed: false as const, reason: 'busy' as const };
    if (row && this.now() - row.at < 120_000) return { claimed: false as const, reason: 'busy' as const };
    this.rows.set(k, { status: 'pending', keptTerms: [], at: this.now() });
    return { claimed: true as const, source: src };
  }

  async release(it: TranslateItem, lang: string, hash: string) {
    for (const [k, row] of this.rows) if (row.status === 'pending' && k.endsWith(`|${lang}|${hash}`) && k.includes(it.kind === 'answer' ? `|${it.id}|` : `|${it.path}|`)) this.rows.delete(k);
  }

  async save(it: TranslateItem, lang: string, hash: string, r: SaveInput) {
    const src = await this.resolve(it);
    const k = src ? this.key(it, src.ownerId, lang, hash) : '';
    if (!src || src.hash !== hash) { await this.release(it, lang, hash); return false; }
    const row = this.rows.get(k);
    if (!row || row.status !== 'pending') return false;
    this.rows.set(k, { status: r.status, text: r.status === 'done' ? r.text : undefined, keptTerms: r.keptTerms, at: this.now() });
    return true;
  }

  async reserve(userId: string, ownerId: string, estimate: number): Promise<ReserveResult> {
    // JavaScript は 1 つずつ実行されるので、この関数の中は await をはさまず一度に判定・確保する（同時アクセスでも超えない）
    if (!(estimate > 0) || estimate > this.cfg.maxEstimateUsd) return { result: 'bad_estimate' };
    const now = this.now();
    for (const r of this.reservations.values()) {
      if (r.status === 'reserved' && now - r.createdAt > 15 * 60_000) {      // 精算されないまま 15 分 → 見込み額で確定
        r.status = 'expired'; r.actual = r.estimate;
        const m = this.month(r.month); m.reserved -= r.estimate; m.spent += r.estimate;
      }
    }
    const mk = monthOf(new Date(now));
    const m = this.month(mk);
    if (m.spent + m.reserved + estimate > this.cfg.monthlyCapUsd + 1e-12) return { result: 'budget' };
    const d = dayOf(new Date(now));
    const uk = `user|${userId}|${d}`, ok = `owner|${ownerId}|${d}`;
    if ((this.daily.get(uk) ?? 0) >= this.cfg.userDailyLimit) return { result: 'user_limit' };
    if ((this.daily.get(ok) ?? 0) >= this.cfg.ownerDailyLimit) return { result: 'owner_limit' };
    this.daily.set(uk, (this.daily.get(uk) ?? 0) + 1);
    this.daily.set(ok, (this.daily.get(ok) ?? 0) + 1);
    const id = `r${++this.seq}`;
    this.reservations.set(id, { id, month: mk, estimate, status: 'reserved', createdAt: now });
    m.reserved += estimate; m.requests++;
    return { result: 'ok', id };
  }

  async settle(id: string, usage: Usage) {
    const r = this.reservations.get(id);
    if (!r || r.status !== 'reserved') return null;
    const actual = costUsd(this.cfg, usage);
    const m = this.month(r.month);                        // 確保した月で精算する
    m.reserved -= r.estimate; m.spent += actual; m.input += usage.input + usage.cacheRead + usage.cacheWrite; m.output += usage.output;
    r.status = 'settled'; r.actual = actual;
    return actual;
  }

  async getConsent(userId: string) { return !!this.consents.get(userId); }
  async setConsent(userId: string, allow: boolean) {
    this.consents.set(userId, allow);
    // 許可を取り消したら、その人の翻訳をすべて消す
    if (!allow) for (const k of [...this.rows.keys()]) if (k.split('|')[1] === userId) this.rows.delete(k);
  }
  async ownerAllows(username: string) {
    const { data } = await this.anon.from('profiles').select('id').eq('username', username).maybeSingle();
    const id = (data as { id?: string } | null)?.id;
    return !!id && !!this.consents.get(id);
  }
  async usage(): Promise<UsageReport> {
    const mk = monthOf(new Date(this.now()));
    const m = this.month(mk);
    return { month: mk, spentUsd: round6(m.spent), reservedUsd: round6(m.reserved), requests: m.requests, cacheHits: m.cacheHits, inputTokens: m.input, outputTokens: m.output, capUsd: this.cfg.monthlyCapUsd, targetUsd: this.cfg.monthlyTargetUsd };
  }
}
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

// ============================================================
// DbStore（SQL の関数を呼ぶだけ。判定は SQL 側）
// ============================================================
export class DbStore implements TranslationStore {
  constructor(private admin: SupabaseClient, private cfg: TranslationConfig) {}
  private args(it: TranslateItem, lang: string) {
    return it.kind === 'answer'
      ? { p_type: 'answer', p_owner: null, p_path: it.id, p_lang: lang }
      : { p_type: 'profile_field', p_owner: it.owner, p_path: it.path, p_lang: lang };
  }
  async getCached(it: TranslateItem, lang: string): Promise<Cached | null | 'unavailable'> {
    const { data, error } = await this.admin.rpc('get_translation', this.args(it, lang));
    if (error) return 'unavailable' as const;
    const row = (data as Array<{ available: boolean; status: string | null; translated_text: string | null }>)?.[0];
    if (!row?.available) return 'unavailable' as const;
    if (row.status !== 'done' && row.status !== 'kept') return null;
    return { status: row.status, text: row.translated_text ?? undefined };
  }
  async claim(it: TranslateItem, lang: string, engine: string) {
    const { data, error } = await this.admin.rpc('claim_translation', { ...this.args(it, lang), p_engine: engine });
    const row = (data as Array<{ claimed: boolean; available: boolean; owner_id: string; text_value: string; source_hash: string; context: string | null }>)?.[0];
    if (error || !row?.available) return { claimed: false as const, reason: 'unavailable' as const };
    if (!row.claimed) return { claimed: false as const, reason: 'busy' as const };
    return { claimed: true as const, source: { ownerId: row.owner_id, text: row.text_value, hash: row.source_hash, context: row.context ?? undefined } };
  }
  async release(it: TranslateItem, lang: string, hash: string) {
    await this.admin.rpc('release_translation', { ...this.args(it, lang), p_hash: hash });
  }
  async save(it: TranslateItem, lang: string, hash: string, r: SaveInput) {
    const { data, error } = await this.admin.rpc('store_translation', {
      ...this.args(it, lang), p_hash: hash, p_status: r.status, p_text: r.text ?? null, p_kept_terms: r.keptTerms,
      p_input: r.usage?.input ?? null, p_output: r.usage?.output ?? null, p_cost: r.costUsd,
    });
    return !error && data === true;
  }
  async reserve(userId: string, ownerId: string, estimate: number): Promise<ReserveResult> {
    const { data, error } = await this.admin.rpc('reserve_translation', { p_user: userId, p_owner: ownerId, p_estimate_usd: estimate });
    const row = (data as Array<{ result: ReserveResult['result']; reservation_id: number | null }>)?.[0];
    if (error || !row) return { result: 'error' };
    return { result: row.result, id: row.reservation_id != null ? String(row.reservation_id) : undefined };
  }
  async settle(id: string, u: Usage) {
    const { data, error } = await this.admin.rpc('settle_translation', { p_reservation_id: Number(id), p_input: u.input, p_output: u.output, p_cache_read: u.cacheRead, p_cache_write: u.cacheWrite });
    return error || data == null ? null : Number(data);
  }
  async getConsent(userId: string) {
    const { data } = await this.admin.rpc('get_translation_consent', { p_user: userId });
    return data === true;
  }
  async setConsent(userId: string, allow: boolean) {
    await this.admin.rpc('set_translation_consent', { p_user: userId, p_allow: allow });
  }
  async ownerAllows(username: string) {
    const { data } = await this.admin.rpc('owner_allows_translation', { p_username: username });
    return data === true;
  }
  async usage(): Promise<UsageReport | null> {
    const mk = monthOf();
    const { data } = await this.admin.from('translation_budget').select('*').eq('month', mk).maybeSingle();
    const b = data as Record<string, number> | null;
    return {
      month: mk, spentUsd: Number(b?.spent_usd ?? 0), reservedUsd: Number(b?.reserved_usd ?? 0), requests: Number(b?.requests ?? 0),
      cacheHits: Number(b?.cache_hits ?? 0), inputTokens: Number(b?.input_tokens ?? 0), outputTokens: Number(b?.output_tokens ?? 0),
      capUsd: this.cfg.monthlyCapUsd, targetUsd: this.cfg.monthlyTargetUsd,
    };
  }
}
