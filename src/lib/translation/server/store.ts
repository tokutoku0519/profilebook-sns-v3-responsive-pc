// ============================================================
// 翻訳の保存先・権限の確認・同意・記録・予算（サーバー専用）
//
// 3 種類のデータを分けて持つ（保存期間と削除の決まりが違うため）
//  ① 翻訳キャッシュ（content_translations）… 原文の編集・公開範囲の変更・許可の取り消し・退会で削除
//  ② 法定の記録（translation_consent_events・translation_provision_log）… 同意・取り消し・外国への送信の記録。
//     翻訳キャッシュとは別に、法令で決まった期間保存する（退会しても期間内は残す。保存期間は法務確認）
//  ③ 費用の集計（translation_budget・translation_reservations）… 個人を識別する ID を持たない。
//     回数制限のための 1 日の回数（translation_daily）だけ ID を持ち、2 日で消す
//
// 翻訳してよいのは、次をすべて満たすときだけ：
//  ・書いた本人が、いまの版の説明を確認して許可している（版が変わったら、確認し直すまで止める）
//  ・その項目（プロフ帳はセクション、回答は 1 件ごと）を、本人が「公開して翻訳してよい」と選んでいる
//    （未設定の公開範囲や、選択なしで公開になった回答は、選ばれていなければ対象外）
//  ・いまも「ログインしていない人」に見える（フォロワー限定・非公開は物理的に読めない）
//
// MemoryStore：プレビュー・手元・自動テスト用（DB に書かない。再起動で消える）
// DbStore    ：本番用（supabase/proposal_content_translations.sql の関数を呼ぶだけ。判定は SQL 側）
// ============================================================
import { createHash } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  consentItemKey, isTranslatableProfilePath, permissionKeyOf, TRANSLATABLE_PROFILE_FIELDS,
  type ConsentCandidate, type ConsentItem, type KeptReason, type TranslateItem,
} from '../shared';
import { ageBandOf, ageFrom, AGE_RETRY_DAYS, CONSENT_TEXT, CONSENT_VERSION, MIN_CONSENT_AGE, type AgeBand, type ConsentLocale } from '../consentText';
import { costUsd, type TranslationConfig, type Usage } from './config';

export type Source = { ownerId: string; text: string; hash: string; context?: string };
export type Cached = { status: 'done' | 'kept'; text?: string; keptReason?: KeptReason | null };
export type SaveInput = { status: 'done' | 'kept' | 'failed'; text?: string; keptTerms: string[]; usage: Usage | null; costUsd: number; keptReason?: KeptReason };
export type ReserveResult = { result: 'ok' | 'disabled' | 'budget' | 'user_limit' | 'owner_limit' | 'bad_estimate' | 'error'; id?: string };
export type UsageReport = { month: string; spentUsd: number; reservedUsd: number; requests: number; cacheHits: number; inputTokens: number; outputTokens: number; capUsd: number; targetUsd: number };
export type ConsentState = { allow: boolean; version: string | null; current: boolean; grantedAt: string | null; items: ConsentItem[] };
/** 生まれた年月はサーバー（と SQL）で年齢の確認にだけ使い、保存しない。記録には年齢の区分だけを残す */
export type GrantInput = { version: string; locale: ConsentLocale; birthYear: number; birthMonth: number; items: ConsentItem[] };
export type GrantResult = { ok: true } | { ok: false; reason: 'old_version' | 'age' | 'age_locked' | 'age_invalid' | 'no_items' | 'not_public' };
/** 外国への送信の記録。送る直前に「送信中」で作り、結果が分かったら書きかえる（送った事実は消さない） */
export type ProvisionStart = { ownerId: string; item: TranslateItem; lang: string; requestedGeo: string; model: string; attempt: number };
/** completed：応答あり・米国で処理／geo_mismatch：応答はあったが米国と確認できない（結果は使わない）／
 *  workspace_mismatch：翻訳専用ワークスペース以外から応答（キーの取り違え。結果は使わない）／
 *  error_response：API がエラーを返した／unknown：タイムアウトなどで届いたか分からない（sending のまま残ったものも同じ扱い） */
export type ProvisionOutcome = 'completed' | 'geo_mismatch' | 'workspace_mismatch' | 'error_response' | 'unknown';
/** 法定の記録（outcome・reportedGeo）と、技術的な送信ログ（requestId・errorCode・workspaceId・latencyMs）に分けて書く */
export type ProvisionFinish = { outcome: ProvisionOutcome; reportedGeo: string | null; requestId?: string; errorCode?: string; workspaceId?: string | null; latencyMs?: number };
/** 同意画面の候補（checkText はサーバーの中だけで使う。個人情報のチェックにかけて blocked を付けたら捨てる） */
export type CandidateRow = ConsentCandidate & { checkText?: string };
/** 記録の件数（プレビュー・テストの確認用。本番は SQL Editor で見る） */
export type RecordCounts = {
  consentEvents: number; provisions: number; provisionsByOutcome: Record<string, number>; dailyRows: number; reservationsWithIds: number;
  ageLocks: number; halted: string | null; birthDataStored: boolean;
  sendLog?: number; sendLogWithRequestId?: number; legalRecordHasTechFields?: boolean;
};

export interface TranslationStore {
  getCached(it: TranslateItem, lang: string): Promise<Cached | null | 'unavailable'>;
  claim(it: TranslateItem, lang: string, engine: string): Promise<{ claimed: true; source: Source } | { claimed: false; reason: 'unavailable' | 'busy' }>;
  release(it: TranslateItem, lang: string, hash: string): Promise<void>;
  save(it: TranslateItem, lang: string, hash: string, r: SaveInput): Promise<boolean>;
  reserve(userId: string, ownerId: string, estimateUsd: number): Promise<ReserveResult>;
  settle(id: string, usage: Usage): Promise<number | null>;
  /** 外国にある第三者への提供の記録を「送信中」で作る（文章そのものは残さない）。許可がない・止まっているときは null（送らない） */
  beginProvision(p: ProvisionStart): Promise<string | null>;
  /** 送信の結果を書く（送信中の記録だけ。記録そのものは消さない） */
  finishProvision(id: string, f: ProvisionFinish): Promise<void>;
  /** 新しい翻訳を止める（米国以外で処理された・事前確認に失敗したとき）。再開は運営者が DB の設定で行う */
  halt(reason: string): Promise<void>;
  getConsent(userId: string): Promise<ConsentState>;
  candidates(userId: string): Promise<CandidateRow[]>;
  grantConsent(userId: string, g: GrantInput): Promise<GrantResult>;
  setConsentItems(userId: string, items: ConsentItem[]): Promise<GrantResult>;
  revokeConsent(userId: string): Promise<void>;
  ownerAllows(username: string): Promise<boolean>;
  usage(): Promise<UsageReport | null>;
  recordCounts(): Promise<RecordCounts | null>;
}

export const md5 = (s: string) => createHash('md5').update(s, 'utf8').digest('hex');
/** 同意の記録に残す「表示した説明文」のハッシュ。クライアントの申告ではなく、サーバーが持つ文面から計算する */
/** 同意の前に表示した説明（版ごと・言語ごと）。ハッシュと一緒に DB に残し、どの文面に同意したかを後から確かめられるようにする */
export const consentNotice = (version: string, locale: ConsentLocale) => {
  const T = CONSENT_TEXT[locale];
  return { version, locale, notice: { title: T.title, lead: T.lead, sections: T.sections, itemsHelp: T.itemsHelp, ageHelp: T.ageHelp, agree: T.agree } };
};
export const consentTextSha256 = (version: string, locale: ConsentLocale) =>
  createHash('sha256').update(JSON.stringify(consentNotice(version, locale)), 'utf8').digest('hex');

const monthOf = (d = new Date()) => d.toISOString().slice(0, 7) + '-01';
const dayOf = (d = new Date()) => d.toISOString().slice(0, 10);
const MAX_FIELD_CHARS = 400;
const MAX_ANSWER_CHARS = 600;
const PREVIEW = 40;
const clip = (s: string) => ([...s].length > PREVIEW ? [...s].slice(0, PREVIEW).join('') + '…' : s);

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
/** セクションの中身から、候補として見せる最初の文字列 */
function firstText(v: unknown): string | null {
  if (typeof v === 'string') return v.trim() ? v : null;
  if (Array.isArray(v)) { for (const x of v) { const t = firstText(x && typeof x === 'object' && 'a' in (x as object) ? (x as any).a : x); if (t) return t; } return null; }
  if (v && typeof v === 'object') { for (const [k, x] of Object.entries(v)) { if (k === 'monthKey') continue; const t = firstText(x); if (t) return t; } }
  return null;
}

/** セクションの中の文字列をすべてつなぐ（同意画面で、個人情報のチェックにかけるため） */
function allText(v: unknown): string {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(allText).join('\n');
  if (v && typeof v === 'object') return Object.entries(v).filter(([k]) => k !== 'monthKey').map(([, x]) => allText(x)).join('\n');
  return '';
}

// ============================================================
// MemoryStore
// ============================================================
type MemRow = { status: 'pending' | 'done' | 'kept' | 'failed'; text?: string; keptTerms: string[]; at: number; keptReason?: KeptReason };
type MemReservation = { id: string; month: string; estimate: number; actual?: number; status: 'reserved' | 'settled' | 'expired'; createdAt: number };
type MemConsent = { allow: boolean; version: string; grantedAt: string; items: Map<string, ConsentItem>; eventId: number };
type MemEvent = { id: number; userId: string; action: 'grant' | 'revoke' | 'scope_update'; version: string | null; textSha256: string | null; locale: string | null; ageCheck: string | null; ageBand: AgeBand | null; scope: string[]; at: string };
type MemProvision = {
  id: string; ownerId: string; sourceType: string; sourcePath: string; lang: string; recipient: string; requestedGeo: string; reportedGeo: string | null;
  outcome: 'sending' | ProvisionOutcome; consentEventId: number | null; at: string; completedAt?: string;
};
/** 技術的な送信ログ（法定の記録とは別。原因の調査・費用の照合用。13 か月で消す） */
type MemSendLog = { provisionId: string; model: string; attempt: number; requestId?: string; errorCode?: string; workspaceId?: string | null; latencyMs?: number; at: string };

export class MemoryStore implements TranslationStore {
  private anon: SupabaseClient;
  private rows = new Map<string, MemRow>();              // ① 翻訳キャッシュ `${type}|${owner}|${path}|${lang}|${hash}`
  private consents = new Map<string, MemConsent>();      // 本人の許可（いまの状態）
  private events: MemEvent[] = [];                       // ② 同意・取り消しの記録
  private provisions: MemProvision[] = [];               // ② 外国への送信の記録（法定）
  private sendLog: MemSendLog[] = [];                    // 技術的な送信ログ（法定の記録とは別）
  private reservations = new Map<string, MemReservation>(); // ③ 費用（ID を持たない）
  private months = new Map<string, { spent: number; reserved: number; requests: number; cacheHits: number; input: number; output: number }>();
  private daily = new Map<string, number>();             // ③ 回数制限 `user|id|day`（2 日で消す）
  private ageLocks = new Map<string, number>();          // 16 歳未満と入力した人の、再入力できるまでの時刻（生年月は残さない）
  private halted: string | null = null;
  private seq = 0;

  constructor(private cfg: TranslationConfig, url: string, anonKey: string, private now = () => Date.now()) {
    this.anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  private month(m = monthOf(new Date(this.now()))) {
    if (!this.months.has(m)) this.months.set(m, { spent: 0, reserved: 0, requests: 0, cacheHits: 0, input: 0, output: 0 });
    return this.months.get(m)!;
  }
  private currentConsent(userId: string): MemConsent | null {
    const c = this.consents.get(userId);
    return c && c.allow && c.version === CONSENT_VERSION ? c : null;
  }
  private async usernameOf(userId: string): Promise<string | null> {
    const { data } = await this.anon.from('profiles').select('username').eq('id', userId).maybeSingle();
    return (data as { username?: string } | null)?.username ?? null;
  }

  /** 原文を「ログインしていない人」として読み、本人の許可・選んだ項目・公開範囲を確かめる */
  private async resolve(it: TranslateItem): Promise<Source | null> {
    if (it.kind === 'profile_field') {
      if (!isTranslatableProfilePath(it.path)) return null;
      const { data: prof } = await this.anon.from('profiles').select('id').eq('username', it.owner).maybeSingle();
      const ownerId = (prof as { id?: string } | null)?.id;
      const consent = ownerId ? this.currentConsent(ownerId) : null;
      if (!ownerId || !consent || !consent.items.has(permissionKeyOf(it))) return null;
      const { data: book } = await this.anon.rpc('get_visible_book', { target: it.owner });
      const top = it.path.split('.')[0];
      if (!book || typeof book !== 'object' || !(top in (book as object))) {
        consent.items.delete(permissionKeyOf(it));        // 公開でなくなったら選択も外す（公開に戻しても、選び直すまで訳さない）
        this.purgeOwner(ownerId, (k) => k.split('|')[2].split('.')[0] === top && k.startsWith('profile_field|'));
        return null;
      }
      const v = at(book, it.path);
      if (typeof v !== 'string' || !v.trim() || [...v].length > MAX_FIELD_CHARS) return null;
      return { ownerId, text: v, hash: md5(v), context: profileContext(book as Record<string, any>, it.path) };
    }
    const { data: a } = await this.anon.from('answers').select('id,user_id,question_title,body,visibility').eq('id', it.id).maybeSingle();
    const row = a as { user_id?: string; question_title?: string; body?: string; visibility?: string } | null;
    if (!row?.user_id) {
      // ログインしていない人から読めない（フォロワー限定・非公開・削除）→ その回答の選択を外し、翻訳も消す
      // （SQL ではトリガーが同じことをする。公開に戻しても、選び直すまで訳さない）
      for (const [uid, c] of this.consents) if (c.items.delete(permissionKeyOf(it))) this.purgeOwner(uid, (k) => k.startsWith(`answer|${uid}|${it.id}|`));
      return null;
    }
    const consent = this.currentConsent(row.user_id);
    if (!consent || !consent.items.has(permissionKeyOf(it))) return null;
    if (row.visibility !== 'public') {
      consent.items.delete(permissionKeyOf(it));
      this.purgeOwner(row.user_id, (k) => k.startsWith(`answer|${row.user_id}|${it.id}|`));
      return null;
    }
    if (typeof row.body !== 'string' || !row.body.trim() || [...row.body].length > MAX_ANSWER_CHARS) return null;
    return { ownerId: row.user_id, text: row.body, hash: md5(row.body), context: row.question_title?.slice(0, 200) };
  }

  private key(it: TranslateItem, ownerId: string, lang: string, hash: string) {
    return it.kind === 'answer' ? `answer|${ownerId}|${it.id}|${lang}|${hash}` : `profile_field|${ownerId}|${it.path}|${lang}|${hash}`;
  }
  private purgeOwner(ownerId: string, match: (k: string) => boolean = () => true) {
    for (const k of [...this.rows.keys()]) if (k.split('|')[1] === ownerId && match(k)) this.rows.delete(k);
  }

  async getCached(it: TranslateItem, lang: string) {
    const src = await this.resolve(it);
    if (!src) return 'unavailable' as const;
    const row = this.rows.get(this.key(it, src.ownerId, lang, src.hash));
    if (!row || (row.status !== 'done' && row.status !== 'kept')) return null;
    this.month().cacheHits++;
    return { status: row.status, text: row.text, keptReason: row.keptReason ?? null };
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
    // 保存の瞬間にも、許可・選んだ項目・公開範囲・原文が変わっていないか確かめる（取り消し後は保存しない）
    const src = await this.resolve(it);
    if (!src || src.hash !== hash) { await this.release(it, lang, hash); return false; }
    const k = this.key(it, src.ownerId, lang, hash);
    const row = this.rows.get(k);
    if (!row || row.status !== 'pending') return false;
    this.rows.set(k, { status: r.status, text: r.status === 'done' ? r.text : undefined, keptTerms: r.keptTerms, at: this.now(), keptReason: r.status === 'kept' ? r.keptReason : undefined });
    return true;
  }

  async reserve(userId: string, ownerId: string, estimate: number): Promise<ReserveResult> {
    // 確保の判定は await をはさまず一度に行う（同時アクセスでも上限を超えない）
    if (this.halted) return { result: 'disabled' };
    if (!(estimate > 0) || estimate > this.cfg.maxEstimateUsd) return { result: 'bad_estimate' };
    const now = this.now();
    for (const r of this.reservations.values()) {
      if (r.status === 'reserved' && now - r.createdAt > 15 * 60_000) {      // 精算されないまま 15 分 → 見込み額で確定
        r.status = 'expired'; r.actual = r.estimate;
        const m = this.month(r.month); m.reserved -= r.estimate; m.spent += r.estimate;
      }
    }
    const d = dayOf(new Date(now));
    const old = dayOf(new Date(now - 2 * 86_400_000));
    for (const k of [...this.daily.keys()]) if (k.slice(-10) < old) this.daily.delete(k);   // 回数制限の記録は 2 日で消す
    const mk = monthOf(new Date(now));
    const m = this.month(mk);
    if (m.spent + m.reserved + estimate > this.cfg.monthlyCapUsd + 1e-12) return { result: 'budget' };
    const uk = `user|${userId}|${d}`, ok = `owner|${ownerId}|${d}`;
    if ((this.daily.get(uk) ?? 0) >= this.cfg.userDailyLimit) return { result: 'user_limit' };
    if ((this.daily.get(ok) ?? 0) >= this.cfg.ownerDailyLimit) return { result: 'owner_limit' };
    this.daily.set(uk, (this.daily.get(uk) ?? 0) + 1);
    this.daily.set(ok, (this.daily.get(ok) ?? 0) + 1);
    const id = `r${++this.seq}`;
    this.reservations.set(id, { id, month: mk, estimate, status: 'reserved', createdAt: now });   // 費用の記録に ID は持たない
    m.reserved += estimate; m.requests++;
    return { result: 'ok', id };
  }

  async settle(id: string, usage: Usage) {
    const r = this.reservations.get(id);
    if (!r || r.status !== 'reserved') return null;
    const actual = costUsd(this.cfg, usage);
    const m = this.month(r.month);
    m.reserved -= r.estimate; m.spent += actual; m.input += usage.input + usage.cacheRead + usage.cacheWrite; m.output += usage.output;
    r.status = 'settled'; r.actual = actual;
    return actual;
  }

  async beginProvision(p: ProvisionStart) {
    const c = this.currentConsent(p.ownerId);
    if (!c || p.requestedGeo !== 'us' || this.halted) return null;          // 許可がない・米国指定でない・止まっている → 送らない
    const id = `p${++this.seq}`;
    this.provisions.push({
      id, ownerId: p.ownerId, sourceType: p.item.kind === 'answer' ? 'answer' : 'profile_field',
      sourcePath: p.item.kind === 'answer' ? p.item.id : p.item.path, lang: p.lang,
      recipient: 'Anthropic, PBC (United States)', requestedGeo: p.requestedGeo, reportedGeo: null,
      outcome: 'sending', consentEventId: c.eventId, at: new Date(this.now()).toISOString(),
    });
    this.sendLog.push({ provisionId: id, model: p.model, attempt: p.attempt, at: new Date(this.now()).toISOString() });
    return id;
  }
  async finishProvision(id: string, f: ProvisionFinish) {
    const row = this.provisions.find((x) => x.id === id);
    if (!row || row.outcome !== 'sending') return;
    Object.assign(row, { outcome: f.outcome, reportedGeo: f.reportedGeo, completedAt: new Date(this.now()).toISOString() });
    const log = this.sendLog.find((x) => x.provisionId === id);
    if (log) Object.assign(log, { requestId: f.requestId, errorCode: f.errorCode, workspaceId: f.workspaceId, latencyMs: f.latencyMs });
  }
  async halt(reason: string) { this.halted = this.halted ?? reason; }

  async getConsent(userId: string): Promise<ConsentState> {
    const c = this.consents.get(userId);
    if (!c || !c.allow) return { allow: false, version: null, current: false, grantedAt: null, items: [] };
    return { allow: true, version: c.version, current: c.version === CONSENT_VERSION, grantedAt: c.grantedAt, items: [...c.items.values()] };
  }

  async candidates(userId: string): Promise<CandidateRow[]> {
    const username = await this.usernameOf(userId);
    if (!username) return [];
    const out: CandidateRow[] = [];
    const { data: book } = await this.anon.rpc('get_visible_book', { target: username });   // 未ログインの人に見える内容だけ
    if (book && typeof book === 'object') {
      for (const key of TRANSLATABLE_PROFILE_FIELDS) {
        const v = (book as Record<string, unknown>)[key];
        const t = firstText(v);
        if (t) out.push({ item: { kind: 'profile_section', key }, preview: clip(t), checkText: allText(v).slice(0, 4000) });
      }
    }
    const { data: answers } = await this.anon.from('answers').select('id,question_title,body,visibility').eq('user_id', userId).eq('visibility', 'public').limit(100);
    for (const a of (answers as Array<{ id: string; question_title?: string; body?: string; visibility?: string }> | null) ?? []) {
      if (a.visibility === 'public' && typeof a.body === 'string' && a.body.trim()) out.push({ item: { kind: 'answer', id: a.id }, preview: clip(a.body), question: a.question_title?.slice(0, 60), checkText: a.body.slice(0, 4000) });
    }
    return out;
  }

  private async validItems(userId: string, items: ConsentItem[]): Promise<ConsentItem[] | null> {
    const allowed = new Set((await this.candidates(userId)).map((c) => consentItemKey(c.item)));
    return items.every((i) => allowed.has(consentItemKey(i))) ? items : null;
  }

  async grantConsent(userId: string, g: GrantInput): Promise<GrantResult> {
    if (g.version !== CONSENT_VERSION) return { ok: false, reason: 'old_version' };
    // 年齢はサーバーで計算する（ブラウザの判定は信用しない）。16 歳未満と入力されたら、しばらく再入力できない
    const lockedUntil = this.ageLocks.get(userId);
    if (lockedUntil && lockedUntil > this.now()) return { ok: false, reason: 'age_locked' };
    const age = ageFrom(g.birthYear, g.birthMonth, new Date(this.now()));
    if (age == null) return { ok: false, reason: 'age_invalid' };
    const band = ageBandOf(age);
    if (age < MIN_CONSENT_AGE || !band) { this.ageLocks.set(userId, this.now() + AGE_RETRY_DAYS * 86_400_000); return { ok: false, reason: 'age' }; }
    if (!g.items.length) return { ok: false, reason: 'no_items' };
    const items = await this.validItems(userId, g.items);
    if (!items) return { ok: false, reason: 'not_public' };
    const at = new Date(this.now()).toISOString();
    const ev: MemEvent = { id: ++this.seq, userId, action: 'grant', version: g.version, textSha256: consentTextSha256(g.version, g.locale), locale: g.locale, ageCheck: 'self_declared_16_plus', ageBand: band, scope: items.map(consentItemKey), at };
    this.events.push(ev);
    this.consents.set(userId, { allow: true, version: g.version, grantedAt: at, items: new Map(items.map((i) => [consentItemKey(i), i])), eventId: ev.id });
    return { ok: true };
  }

  async setConsentItems(userId: string, items: ConsentItem[]): Promise<GrantResult> {
    const c = this.currentConsent(userId);
    if (!c) return { ok: false, reason: 'old_version' };
    if (!items.length) return { ok: false, reason: 'no_items' };
    const valid = await this.validItems(userId, items);
    if (!valid) return { ok: false, reason: 'not_public' };
    const keep = new Set(valid.map(consentItemKey));
    // 外した項目の翻訳は消す
    for (const k of [...c.items.keys()]) if (!keep.has(k)) {
      c.items.delete(k);
      const [kind, id] = k.split(':');
      this.purgeOwner(userId, (rk) => (kind === 'answer' ? rk.startsWith(`answer|${userId}|${id}|`) : rk.startsWith('profile_field|') && rk.split('|')[2].split('.')[0] === id));
    }
    for (const i of valid) c.items.set(consentItemKey(i), i);
    const ev: MemEvent = { id: ++this.seq, userId, action: 'scope_update', version: c.version, textSha256: null, locale: null, ageCheck: null, ageBand: null, scope: [...keep], at: new Date(this.now()).toISOString() };
    this.events.push(ev);
    c.eventId = ev.id;
    return { ok: true };
  }

  async revokeConsent(userId: string) {
    this.consents.delete(userId);
    this.purgeOwner(userId);                                                  // ① 翻訳キャッシュは削除
    this.events.push({ id: ++this.seq, userId, action: 'revoke', version: null, textSha256: null, locale: null, ageCheck: null, ageBand: null, scope: [], at: new Date(this.now()).toISOString() }); // ② 記録は残す
  }

  async ownerAllows(username: string) {
    const { data } = await this.anon.from('profiles').select('id').eq('username', username).maybeSingle();
    const id = (data as { id?: string } | null)?.id;
    const c = id ? this.currentConsent(id) : null;
    return !!c && c.items.size > 0;
  }

  async usage(): Promise<UsageReport> {
    const mk = monthOf(new Date(this.now()));
    const m = this.month(mk);
    return { month: mk, spentUsd: round6(m.spent), reservedUsd: round6(m.reserved), requests: m.requests, cacheHits: m.cacheHits, inputTokens: m.input, outputTokens: m.output, capUsd: this.cfg.monthlyCapUsd, targetUsd: this.cfg.monthlyTargetUsd };
  }
  async recordCounts(): Promise<RecordCounts> {
    const byOutcome: Record<string, number> = {};
    for (const p of this.provisions) byOutcome[p.outcome] = (byOutcome[p.outcome] ?? 0) + 1;
    return {
      consentEvents: this.events.length, provisions: this.provisions.length, provisionsByOutcome: byOutcome, dailyRows: this.daily.size, reservationsWithIds: 0,
      sendLog: this.sendLog.length, sendLogWithRequestId: this.sendLog.filter((x) => x.requestId).length,
      legalRecordHasTechFields: this.provisions.some((x) => 'requestId' in x || 'errorCode' in x),
      ageLocks: [...this.ageLocks.values()].filter((t) => t > this.now()).length, halted: this.halted,
      // 生年月を残していないことの確認（記録のどこにも birth の項目がない）
      birthDataStored: JSON.stringify(this.events).includes('birth'),
    };
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
  /** 判定する関数には、いまの説明の版を渡す（版が違う許可では翻訳しない） */
  private vargs(it: TranslateItem, lang: string) {
    return { ...this.args(it, lang), p_current_version: CONSENT_VERSION };
  }
  async getCached(it: TranslateItem, lang: string): Promise<Cached | null | 'unavailable'> {
    const { data, error } = await this.admin.rpc('get_translation', this.vargs(it, lang));
    if (error) return 'unavailable';
    const row = (data as Array<{ available: boolean; status: string | null; translated_text: string | null; kept_reason: KeptReason | null }>)?.[0];
    if (!row?.available) return 'unavailable';
    if (row.status !== 'done' && row.status !== 'kept') return null;
    return { status: row.status, text: row.translated_text ?? undefined, keptReason: row.kept_reason };
  }
  async claim(it: TranslateItem, lang: string, engine: string) {
    const { data, error } = await this.admin.rpc('claim_translation', { ...this.vargs(it, lang), p_engine: engine });
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
      ...this.vargs(it, lang), p_hash: hash, p_status: r.status, p_text: r.text ?? null, p_kept_terms: r.keptTerms,
      p_input: r.usage?.input ?? null, p_output: r.usage?.output ?? null, p_cost: r.costUsd,
      p_kept_reason: r.status === 'kept' ? r.keptReason ?? null : null,
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
  async beginProvision(p: ProvisionStart) {
    const { data, error } = await this.admin.rpc('begin_translation_provision', {
      p_owner: p.ownerId, p_type: p.item.kind === 'answer' ? 'answer' : 'profile_field',
      p_path: p.item.kind === 'answer' ? p.item.id : p.item.path, p_lang: p.lang, p_requested_geo: p.requestedGeo,
      p_model: p.model, p_attempt: p.attempt, p_current_version: CONSENT_VERSION,
    });
    return error || data == null ? null : String(data);
  }
  async finishProvision(id: string, f: ProvisionFinish) {
    await this.admin.rpc('finish_translation_provision', {
      p_id: Number(id), p_outcome: f.outcome, p_reported_geo: f.reportedGeo, p_request_id: f.requestId ?? null, p_error: f.errorCode ?? null,
      p_workspace_id: f.workspaceId ?? null, p_latency_ms: f.latencyMs ?? null,
    });
  }
  async halt(reason: string) {
    await this.admin.rpc('halt_translation', { p_reason: reason });
  }
  async getConsent(userId: string): Promise<ConsentState> {
    const { data } = await this.admin.rpc('get_translation_consent', { p_user: userId, p_current_version: CONSENT_VERSION });
    const row = (data as Array<{ allow: boolean; version: string | null; is_current: boolean; granted_at: string | null; items: ConsentItem[] | null }>)?.[0];
    if (!row?.allow) return { allow: false, version: null, current: false, grantedAt: null, items: [] };
    return { allow: true, version: row.version, current: row.is_current, grantedAt: row.granted_at, items: row.items ?? [] };
  }
  async candidates(userId: string): Promise<CandidateRow[]> {
    const { data } = await this.admin.rpc('translation_candidates', { p_user: userId });
    return ((data as Array<{ kind: string; item_key: string; preview: string; question: string | null; check_text: string | null }>) ?? []).map((r) => ({
      item: (r.kind === 'answer' ? { kind: 'answer', id: r.item_key } : { kind: 'profile_section', key: r.item_key }) as ConsentItem,
      preview: clip(r.preview), question: r.question ?? undefined, checkText: r.check_text ?? undefined,
    }));
  }
  async grantConsent(userId: string, g: GrantInput): Promise<GrantResult> {
    if (g.version !== CONSENT_VERSION) return { ok: false, reason: 'old_version' };
    // 生まれた年月は SQL の中でも年齢を計算し直すために渡すだけ（SQL も保存しない）
    const { data, error } = await this.admin.rpc('grant_translation_consent', {
      p_user: userId, p_version: g.version, p_locale: g.locale, p_text_sha256: consentTextSha256(g.version, g.locale),
      p_notice: consentNotice(g.version, g.locale), p_birth_year: g.birthYear, p_birth_month: g.birthMonth, p_items: g.items,
    });
    const row = (data as Array<{ ok: boolean; reason: string | null }>)?.[0];
    if (error || !row) return { ok: false, reason: 'not_public' };
    return row.ok ? { ok: true } : { ok: false, reason: (row.reason as Exclude<GrantResult, { ok: true }>['reason']) ?? 'not_public' };
  }
  async setConsentItems(userId: string, items: ConsentItem[]): Promise<GrantResult> {
    const { data, error } = await this.admin.rpc('set_translation_items', { p_user: userId, p_current_version: CONSENT_VERSION, p_items: items });
    const row = (data as Array<{ ok: boolean; reason: string | null }>)?.[0];
    if (error || !row) return { ok: false, reason: 'not_public' };
    return row.ok ? { ok: true } : { ok: false, reason: (row.reason as Exclude<GrantResult, { ok: true }>['reason']) ?? 'not_public' };
  }
  async revokeConsent(userId: string) {
    await this.admin.rpc('revoke_translation_consent', { p_user: userId });
  }
  async ownerAllows(username: string) {
    const { data } = await this.admin.rpc('owner_allows_translation', { p_username: username, p_current_version: CONSENT_VERSION });
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
  async recordCounts(): Promise<RecordCounts | null> { return null; }
}
