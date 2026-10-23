#!/usr/bin/env node
// Miri 独自の色トークン（tailwind.config.ts で 1 色の CSS 変数として定義）に
// Tailwind の段階番号（-50〜-900）を付けたクラスを検出する。
//   例）from-pink-500 / border-purple-100 → 生成されない（色が付かない・透明になる）
//   正）from-pink / border-purple/15     → トークンにそのまま／透明度で指定する
//   固定色が必要な場合（ガチャ背景など、色そのものが商品）は from-[#fbcfe8] のように任意値で指定する
// 使い方: npm run check:colors   （違反があれば一覧を出して終了コード 1）
import fs from 'node:fs';
import path from 'node:path';

const TOKENS = ['pink', 'purple', 'base', 'ink', 'muted', 'cream', 'mint', 'pinkStrong'];
const UTIL = '(?:bg|from|via|to|text|ring|ring-offset|border|border-[trblxy]|shadow|fill|stroke|outline|decoration|divide|placeholder|accent|caret)';
const re = new RegExp(`(?<![\\w-])(?:[a-z-]+:)*${UTIL}-(?:${TOKENS.join('|')})-\\d{2,3}(?:/\\d+)?(?![\\w-])`, 'g');

const root = path.resolve(process.argv[2] ?? 'src');
const hits = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx?|jsx?|mdx)$/.test(e.name)) {
      fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
        for (const m of line.matchAll(re)) hits.push(`${path.relative(process.cwd(), p)}:${i + 1}  ${m[0]}`);
      });
    }
  }
})(root);

if (hits.length) {
  console.error(`✗ 生成されない色クラスが ${hits.length} 件あります（Miri の色トークンに段階番号は付けられません）:`);
  for (const h of hits) console.error('  ' + h);
  process.exit(1);
}
console.log('✓ 生成されない色クラスはありません');
