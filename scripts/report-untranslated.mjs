// ============================================================
// 翻訳キーを通していない日本語の固定文言を、画面（関数・コンポーネント）ごとに数える（npm run report:untranslated）
//
// 画面の自動翻訳（MyMemory）は廃止したので、ここに出る文言は日本語以外の表示でも日本語のまま出る。
// 翻訳キー（t / tf / tv）に置き換えたら件数が減る。`--list` で文言も表示。
//
// 数えないもの：t()/tf()/tv()/L() などの引数（キーや選択肢ラベル）、console.*、開発用デモのデータ
// （`isDev ? … : …` の開発用の側、demo*/mock* という名前の定義）、オブジェクトのキー、import。
// ※ 目安。データとして保存する値（例：カテゴリ名の日本語）も数えるので、0 にする必要はない。
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const require = createRequire(path.join(root, 'package.json'));
const ts = require('typescript');

const JP = /[ぁ-ゖァ-ヺ一-龯々]/;
const SKIP_CALLS = new Set(['t', 'tf', 'tv', 'L', 'console', 'localizeQuestion', 'questionText', 'require', 'import']);
const LIST = process.argv.includes('--list');

function listFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(p));
    else if (/\.tsx$/.test(e.name)) out.push(p);
  }
  return out;
}
const files = [...listFiles(path.join(root, 'src/app')), ...listFiles(path.join(root, 'src/components'))];

const calleeName = (expr) => {
  while (ts.isPropertyAccessExpression(expr)) expr = expr.expression;
  return ts.isIdentifier(expr) ? expr.text : '';
};

const byScreen = new Map();
let total = 0;
for (const file of files) {
  const rel = path.relative(root, file);
  const src = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hit = (owner, text, node) => {
    const v = text.replace(/\s+/g, ' ').trim();
    if (!v || !JP.test(v)) return;
    const key = `${rel} ${owner}`;
    if (!byScreen.has(key)) byScreen.set(key, []);
    byScreen.get(key).push(`${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1}: ${v.slice(0, 60)}`);
    total++;
  };
  const visit = (node, owner) => {
    if (ts.isImportDeclaration(node)) return;
    if (ts.isConditionalExpression(node) && ts.isIdentifier(node.condition) && node.condition.text === 'isDev') { visit(node.whenFalse, owner); return; }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && /^(demo|mock|DEMO|MOCK)/.test(node.name.text)) return;
    if (ts.isCallExpression(node) && SKIP_CALLS.has(calleeName(node.expression))) return;
    if (ts.isPropertyAssignment(node)) { visit(node.initializer, owner); return; } // キーは数えない
    // 画面の単位：トップレベルの function / const Xxx = …
    let next = owner;
    if (ts.isFunctionDeclaration(node) && node.name && node.parent === sf) next = node.name.text;
    if (ts.isVariableStatement(node) && node.parent === sf) next = node.declarationList.declarations[0]?.name.getText(sf) ?? owner;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) hit(next, node.text, node);
    else if (ts.isTemplateExpression(node)) { hit(next, node.head.text, node); node.templateSpans.forEach((sp) => hit(next, sp.literal.text, sp)); }
    else if (ts.isJsxText(node)) hit(next, node.text, node);
    ts.forEachChild(node, (c) => visit(c, next));
  };
  visit(sf, '(top)');
}

const rows = [...byScreen.entries()].sort((a, b) => b[1].length - a[1].length);
console.log(`翻訳キーを通していない日本語の固定文言（目安）：${total} 件 / ${rows.length} か所`);
for (const [k, list] of rows) {
  console.log(`${String(list.length).padStart(5)}  ${k}`);
  if (LIST) list.forEach((l) => console.log(`         ${l}`));
}
