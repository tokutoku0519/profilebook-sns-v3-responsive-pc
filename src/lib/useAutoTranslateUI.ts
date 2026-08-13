'use client';
import { useEffect } from 'react';
import { translateText } from './translator';
import type { Lang } from './i18n';

// 画面全体を一括で言語対応するためのフック。
// アプリ内でハードコードされた日本語テキスト（t() を通していないUI文字列）を、
// レンダリング後のDOMを走査して自動翻訳し、元の日本語→翻訳のキャッシュは
// translator 側で localStorage に保存される（2回目以降は即時）。
//
// 方針：
//  - 日本語（ひら・カタ・漢字・半角カナ）を含むテキストノードだけを対象。
//  - <input>/<textarea>/contentEditable/script/style、[data-noauto] 配下は除外。
//  - 自分で書き換えた結果（＝翻訳済み・非日本語）は再処理しない（無限ループ回避）。
//  - MutationObserver で画面遷移後の新規ノードも追従。
//  - lang==='ja' のときは元の日本語へ戻す。

const JA_RE = /[぀-ヿ㐀-鿿ｦ-ﾟ]/;
// テキストノード → { orig: 元の日本語, applied: 最後に自分で書き込んだ文字列 }
const reg = new WeakMap<Text, { orig: string; applied: string }>();

function isSkippable(node: Text): boolean {
  let el: HTMLElement | null = node.parentElement;
  while (el) {
    const tag = el.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'OPTION') return true;
    if (el.isContentEditable) return true;
    if (el.hasAttribute('data-noauto')) return true;
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

      if (lang === 'ja') {
        if (cur !== orig) { node.nodeValue = orig; reg.set(node, { orig, applied: orig }); }
        return;
      }

      const e = reg.get(node)!;
      // すでに翻訳済み（自分の書き込み）ならスキップ
      if (cur === e.applied && e.applied !== '' && !JA_RE.test(e.applied)) return;
      if (inflight.has(node)) return;
      if (orig.length > 480) return; // API上限対策

      inflight.add(node);
      translateText(orig, lang).then((tr) => {
        inflight.delete(node);
        if (disposed || !node.isConnected) return;
        if ((node.nodeValue ?? '') !== orig) return; // 間に内容が変わっていたら中断
        if (!tr || tr === orig || JA_RE.test(tr)) { reg.set(node, { orig, applied: orig }); return; }
        node.nodeValue = tr;
        reg.set(node, { orig, applied: tr });
      }).catch(() => { inflight.delete(node); });
    }

    function walk(root: Node) {
      const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const list: Text[] = [];
      let n = tw.nextNode();
      while (n) { list.push(n as Text); n = tw.nextNode(); }
      for (const t of list) process(t);
    }

    walk(document.body);

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

    return () => { disposed = true; obs.disconnect(); };
  }, [lang]);
}
