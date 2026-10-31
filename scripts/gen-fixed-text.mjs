// ============================================================
// アプリのソースに書かれた日本語の固定文言の一覧を作る（npm run gen:fixed-text / ビルド前に自動実行）
//
// 画面の自動翻訳（useAutoTranslateUI）は、この一覧に「完全一致」する文字列だけを外部の翻訳サービスへ送る。
// ユーザーが書いた文章（回答・日記・コメント・名前など）はソースに無いので一覧に入らず、送られない。
//
// 対象：src/app・src/components の画面コードと、公式コンテンツの定義（src/lib のうち下の LIB_FILES）。
// 開発用デモのダミーデータは含めない（src/lib/mock.ts、`isDev ? … : …` の開発用の側、demo*/mock* という名前の定義）。
// ダミーの名前や回答は、実在ユーザーの文章と同じ形をしているため。
// 出力：src/lib/fixedText.generated.json（文字列の配列。並びは安定）
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const require = createRequire(path.join(root, 'package.json'));
const ts = require('typescript');

const JP = /[ぁ-ゖァ-ヺ一-龯々]/;
const LIB_FILES = ['stickerPacks.ts', 'bgThemes.ts', 'titles.ts', 'prQuestions.ts', 'brandCampaigns.ts', 'choiceQuiz.ts', 'coinPackages.ts', 'terms.ts', 'localeConfig.ts'];

function listFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(p));
    else if (/\.(tsx?|jsx?)$/.test(e.name)) out.push(p);
  }
  return out;
}

// React と同じ規則で JSX のテキストを整える（行ごとに前後の空白を落として空白1つでつなぐ）
const jsxText = (s) => s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join(' ');
const norm = (s) => s.replace(/\s+/g, ' ').trim();

const found = new Set();
const add = (s) => { const v = norm(s); if (v && JP.test(v) && v.length <= 480) found.add(v); };

const files = [
  ...listFiles(path.join(root, 'src/app')),
  ...listFiles(path.join(root, 'src/components')),
  ...LIB_FILES.map((f) => path.join(root, 'src/lib', f)).filter((f) => fs.existsSync(f)),
];
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (node) => {
    // 開発用デモのデータは飛ばす
    if (ts.isConditionalExpression(node) && ts.isIdentifier(node.condition) && node.condition.text === 'isDev') { visit(node.whenFalse); return; }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && /^(demo|mock)/.test(node.name.text)) return;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) add(node.text);
    else if (ts.isTemplateExpression(node)) {
      // `${name}さん…` のような組み立て文は、組み立て後の文字列が一覧に無いので送られない（部分だけ記録しても一致しない）
      add(node.head.text);
      node.templateSpans.forEach((sp) => add(sp.literal.text));
    } else if (ts.isJsxText(node)) add(jsxText(node.text));
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

const list = [...found].sort();
const out = path.join(root, 'src/lib/fixedText.generated.json');
const next = JSON.stringify(list) + '\n';
const check = process.argv.includes('--check');
if (check) {
  const cur = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  if (cur !== next) { console.error('fixedText.generated.json が古いです。npm run gen:fixed-text を実行してください'); process.exit(1); }
  console.log(`固定文言の一覧は最新です（${list.length} 件）`);
} else {
  fs.writeFileSync(out, next);
  console.log(`固定文言 ${list.length} 件 → ${path.relative(root, out)}`);
}
