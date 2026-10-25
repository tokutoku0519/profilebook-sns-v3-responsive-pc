'use client';
// ============================================================
// 固有名詞（ユーザーの表示名・ニックネーム）の一覧
//
// 画面の自動翻訳（useAutoTranslateUI）は、ここにある名前を訳さない。
// 名前を機械翻訳すると「とっくん → Gekkun」のような誤ったローマ字・別の語になるため、
// 名前はどの言語でも書いたとおりに表示する。
//
// 名前の集め方：
//  - Supabase から返ってきた行（profiles の display_name、プロフ帳の nickname / name）
//    → supabase.ts の fetch でまとめて拾う（画面ごとに書き足さなくてよい）
//  - 画面の状態にある名前（自分・デモ用ユーザー・回答の著者など）→ addProperNames()
// ============================================================

const names = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;

const norm = (s: unknown) => (typeof s === 'string' ? s.trim() : '');

export function addProperNames(list: Iterable<unknown>) {
  let added = false;
  for (const raw of list) {
    const n = norm(raw).replace(/^@/, '');
    if (!n || n.length > 40 || names.has(n)) continue;
    names.add(n);
    added = true;
  }
  if (added) {
    version++;
    listeners.forEach((fn) => fn());
  }
}

export const properNamesVersion = () => version;

export function onProperNamesChange(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Supabase の応答（JSON）から名前を拾う。profiles 行・プロフ帳（book）のどちらにも対応。 */
export function collectProperNames(json: unknown) {
  const found: string[] = [];
  const visit = (v: unknown, depth: number) => {
    if (!v || typeof v !== 'object' || depth > 6) return;
    if (Array.isArray(v)) { for (const x of v.slice(0, 500)) visit(x, depth + 1); return; }
    const o = v as Record<string, unknown>;
    if (typeof o.display_name === 'string') found.push(o.display_name);
    if (o.book && typeof o.book === 'object') {
      const b = o.book as Record<string, unknown>;
      found.push(b.nickname as string, b.name as string);
    }
    for (const k of Object.keys(o)) if (k !== 'book' && o[k] && typeof o[k] === 'object') visit(o[k], depth + 1);
  };
  visit(json, 0);
  addProperNames(found);
}

const HONORIFIC = '(?:さん|ちゃん|くん|君|様|さま|氏|たん|っち)?';
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const HIRA = /[ぁ-ゖ]/;
// 名前のあとに続いてよいひらがな（助詞・敬称の頭）。これ以外のひらがなが続くと、普通の語の一部とみなす（まゆ｜げ）
const AFTER_OK = /[のがはをにとへもでやかよねさちくた]/;
// 名前の前にあってよいひらがな（助詞）
const BEFORE_OK = /[のがはをにとへもでやかよね]/;
/** 語の切れ目にある name だけを token に置きかえる（後読みの正規表現は古い Safari で使えないので手で調べる） */
function maskWord(text: string, name: string, token: string) {
  let out = '';
  let i = 0;
  for (let at = text.indexOf(name); at !== -1; at = text.indexOf(name, at + name.length)) {
    const before = text[at - 1] ?? '';
    const after = text[at + name.length] ?? '';
    const inWord = (HIRA.test(name[0]) && HIRA.test(before) && !BEFORE_OK.test(before)) || (HIRA.test(name[name.length - 1]) && HIRA.test(after) && !AFTER_OK.test(after));
    if (inWord) continue;
    out += text.slice(i, at) + token;
    i = at + name.length;
  }
  return out + text.slice(i);
}

// 調べるための正規表現と並びは、名前が増えたときだけ作り直す
let cache: { v: number; only: RegExp | null; long: string[] } = { v: -1, only: null, long: [] };
function lookup() {
  if (cache.v !== version) {
    const all = [...names].sort((a, b) => b.length - a.length);
    cache = {
      v: version,
      only: all.length ? new RegExp(`^(?:${all.map(escapeRe).join('|')})${HONORIFIC}$`) : null,
      long: all.filter((n) => n.length >= 2),
    };
  }
  return cache;
}

/**
 * 文字列の中の名前を調べる。
 *  - 'only'：名前（＋さん・くん など）だけの文字列 → 訳さない
 *  - 'mixed'：文章の中に名前がある → 名前を目印に置きかえて訳し、あとで元の名前に戻す
 *  - null：名前は含まれない
 */
export function findProperNames(text: string): { kind: 'only' } | { kind: 'mixed'; masked: string; tokens: string[]; values: string[] } | null {
  const { only, long } = lookup();
  if (!only) return null;
  const stripped = text.trim().replace(/^[@＠✎✉🎀📖⏳✅\s]+/u, '');
  if (only.test(stripped)) return { kind: 'only' };
  // 文章の中：長い名前から順に置きかえる（短い名前が長い名前の一部を食べないように）。
  // 1文字の名前は普通の語と見分けられないので、文章の中では扱わない（名前だけの文字列なら上で守る）。
  const sorted = long.filter((n) => text.includes(n));
  if (!sorted.length) return null;
  let masked = text;
  const tokens: string[] = [];
  const values: string[] = [];
  for (const n of sorted) {
    const token = `Zq${tokens.length}x`; // 訳されにくい目印
    const next = maskWord(masked, n, token);
    if (next === masked) continue;
    masked = next;
    tokens.push(token);
    values.push(n);
  }
  return tokens.length ? { kind: 'mixed', masked, tokens, values } : null;
}
