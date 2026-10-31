'use client';
import { useEffect } from 'react';
import { translateText } from './translator';
import type { Lang } from './i18n';
import { findProperNames, onProperNamesChange, properNamesVersion } from './properNames';

// 画面全体を一括で言語対応するためのフック。
// アプリ内でハードコードされた日本語テキスト（t() を通していないUI文字列）を、
// レンダリング後のDOMを走査して自動翻訳し、元の日本語→翻訳のキャッシュは
// translator 側で localStorage に保存される（2回目以降は即時）。
//
// 方針：
//  - 【外部へ送るのはアプリの固定文言だけ】ソースに書かれた日本語の一覧（fixedText.generated.json。
//    ビルド前に scripts/gen-fixed-text.mjs で作る）に完全一致する文字列だけを翻訳サービスへ送る。
//    ユーザーが書いた回答・日記・コメント・名前などは一覧に無いので、公開・非公開を問わず送らない（原文のまま表示）。
//  - 日本語（ひら・カタ・漢字・半角カナ）を含むテキストノードだけを対象。
//  - <input>/<textarea>/contentEditable/script/style、[data-noauto] 配下は除外。
//  - ユーザーが書いた文章（.prof-hand / .pen-text / [data-user]）は翻訳しない。名前や回答を
//    機械翻訳すると、ローマ字化（例：「きほん」→ Kihon）や意味の違う文になるため。
//  - ユーザーの名前（properNames に集めた表示名・ニックネーム）は訳さない。名前だけの文字列はそのまま、
//    文章の中の名前は目印に置きかえて訳し、元の名前に戻す（とっくん → Gekkun のような誤訳を防ぐ）。
//  - 翻訳キー化した画面（プロフ帳・プロフィール編集）は data-noauto でまるごと除外している。
//  - 自分で書き換えた結果（＝翻訳済み・非日本語）は再処理しない（無限ループ回避）。
//  - MutationObserver で画面遷移後の新規ノードも追従。
//  - lang==='ja' のときは元の日本語へ戻す。

const JA_RE = /[぀-ヿ㐀-鿿ｦ-ﾟ]/;
// ひらがなだけの短い語は、翻訳APIが訳の代わりにローマ字を返すことがある（きほん→Kihon、すき・きらい→Suki-Kai）。
// そういう結果は採用せず、元の日本語のまま残す（機械的なローマ字化を翻訳の代わりにしない）。
const HIRAGANA_ONLY = /^[ぁ-ゖー・、。！？\s]+$/;
// 促音（っ）の重ね子音（tokkun, kitte など）もローマ字として扱う。
const ROMAJI_LIKE = /^(?:[kgsztdhbpcfjr](?=[kgsztdhbpcfjr]))?(?:(?:(?:[kgsztdnhbpmyrwfjc]|sh|ch|ts|ky|gy|ny|hy|by|py|my|ry|j)?[aiueo]|n|[-\s'])(?:[kgsztdhbpcfjr](?=[kgsztdhbpcfjr]))?)+$/i;
function looksLikeRomaji(orig: string, tr: string): boolean {
  return HIRAGANA_ONLY.test(orig.trim()) && ROMAJI_LIKE.test(tr.trim().replace(/[!?.,]/g, ''));
}
// 固定文言の一覧（日本語以外を表示するときだけ読み込む）
let fixedText: Set<string> | null = null;
let fixedLoading: Promise<Set<string>> | null = null;
function loadFixedText(): Promise<Set<string>> {
  if (fixedText) return Promise.resolve(fixedText);
  fixedLoading ??= import('./fixedText.generated.json').then((m) => {
    const list = ((m as { default?: string[] }).default ?? (m as unknown as string[])) as string[];
    fixedText = new Set(list);
    return fixedText;
  });
  return fixedLoading;
}
const normText = (s: string) => s.replace(/\s+/g, ' ').trim();
/** アプリの固定文言か（＝外部の翻訳サービスへ送ってよいか） */
function isFixedText(s: string): boolean {
  return !!fixedText && fixedText.has(normText(s));
}

// テキストノード → { orig: 元の日本語, applied: 最後に自分で書き込んだ文字列 }
const reg = new WeakMap<Text, { orig: string; applied: string; names?: number }>();

function isSkippable(node: Text): boolean {
  let el: HTMLElement | null = node.parentElement;
  while (el) {
    const tag = el.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'OPTION') return true;
    if (el.isContentEditable) return true;
    if (el.hasAttribute('data-noauto') || el.hasAttribute('data-user')) return true;
    if (el.classList.contains('prof-hand') || el.classList.contains('pen-text')) return true;
    el = el.parentElement;
  }
  return false;
}

export function useAutoTranslateUI(lang: Lang) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let disposed = false;
    const inflight = new WeakSet<Text>();

    function process(node: Text) {
      if (disposed || !node.isConnected) return;
      const cur = node.nodeValue ?? '';
      const entry = reg.get(node);

      // このノードの「元の日本語」を確定する
      let orig: string;
      if (entry) {
        if (cur !== entry.applied && cur !== entry.orig) {
          // 内容が別物に差し替わった（画面遷移など）→ 新規として捉え直す
          if (!JA_RE.test(cur)) { reg.delete(node); return; }
          orig = cur;
          reg.set(node, { orig, applied: '' });
        } else {
          orig = entry.orig;
        }
      } else {
        if (!JA_RE.test(cur)) return;
        orig = cur;
        reg.set(node, { orig, applied: '' });
      }

      if (isSkippable(node)) return;

      // 名前の一覧が増えたあとに、名前を含む訳がすでに書き込まれていたら、元に戻して訳し直す
      const nv = properNamesVersion();
      const pre = reg.get(node)!;
      if (pre.names !== nv) {
        if (pre.applied && pre.applied !== orig && findProperNames(orig)) { node.nodeValue = orig; reg.set(node, { orig, applied: '', names: nv }); }
        else reg.set(node, { ...pre, names: nv });
      }

      if (lang === 'ja') {
        if (cur !== orig) { node.nodeValue = orig; reg.set(node, { orig, applied: orig }); }
        return;
      }

      const e = reg.get(node)!;
      // すでに翻訳済み（自分の書き込み）ならスキップ（名前を戻した訳は日本語を含むので orig との違いで判定）
      if (cur === e.applied && e.applied !== '' && e.applied !== orig) return;
      if (inflight.has(node)) return;
      if (orig.length > 480) return; // API上限対策
      // 固定文言でなければ送らない（ユーザーの文章・名前・組み立てた文は原文のまま）
      if (!isFixedText(orig)) { if (cur !== orig) node.nodeValue = orig; reg.set(node, { orig, applied: orig, names: e.names }); return; }

      // 名前だけの文字列は訳さない。文章の中の名前は目印に置きかえて訳す。
      const names = findProperNames(orig);
      if (names?.kind === 'only') { if (cur !== orig) node.nodeValue = orig; reg.set(node, { orig, applied: orig, names: e.names }); return; }
      const source = names?.kind === 'mixed' ? names.masked : orig;

      inflight.add(node);
      translateText(source, lang).then((tr) => {
        inflight.delete(node);
        if (disposed || !node.isConnected) return;
        if ((node.nodeValue ?? '') !== orig) return; // 間に内容が変わっていたら中断
        const keep = () => reg.set(node, { orig, applied: orig, names: e.names });
        if (!tr || tr === source || JA_RE.test(tr) || looksLikeRomaji(orig, tr)) { keep(); return; }
        let out = tr;
        if (names?.kind === 'mixed') {
          // 目印がそのまま1回ずつ残っているときだけ採用し、元の名前に戻す（崩れていたら日本語のまま）
          if (names.tokens.some((tk) => out.split(tk).length !== source.split(tk).length)) { keep(); return; }
          names.tokens.forEach((tk, i) => { out = out.split(tk).join(names.values[i]); });
        }
        node.nodeValue = out;
        reg.set(node, { orig, applied: out, names: e.names });
      }).catch(() => { inflight.delete(node); });
    }

    function walk(root: Node) {
      const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const list: Text[] = [];
      let n = tw.nextNode();
      while (n) { list.push(n as Text); n = tw.nextNode(); }
      for (const t of list) process(t);
    }

    // 固定文言の一覧を読み込んでから画面を走査する（読み込み前は何も送らない）
    if (lang === 'ja') walk(document.body);
    else loadFixedText().then(() => { if (!disposed) walk(document.body); }).catch(() => {});
    // 名前が増えたら（Supabase から読み込んだ直後など）、画面を見直して名前の誤訳を戻す
    const offNames = onProperNamesChange(() => { if (!disposed) walk(document.body); });

    // 画面遷移・再レンダリングで増えたテキストを追従（マイクロタスクでまとめる）
    let scheduled = false;
    const pending: Text[] = [];
    const flush = () => {
      scheduled = false;
      const batch = pending.splice(0, pending.length);
      for (const t of batch) process(t);
    };
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'characterData' && m.target.nodeType === 3) pending.push(m.target as Text);
        m.addedNodes.forEach((an) => {
          if (an.nodeType === 3) pending.push(an as Text);
          else if (an.nodeType === 1) {
            const tw = document.createTreeWalker(an, NodeFilter.SHOW_TEXT);
            let x = tw.nextNode();
            while (x) { pending.push(x as Text); x = tw.nextNode(); }
          }
        });
      }
      if (pending.length && !scheduled) { scheduled = true; queueMicrotask(flush); }
    });
    obs.observe(document.body, { childList: true, characterData: true, subtree: true });

    return () => { disposed = true; obs.disconnect(); offNames(); };
  }, [lang]);
}
