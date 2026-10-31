// ============================================================
// 外部の翻訳サービスへ送るコードが入っていないかを確かめる（npm run check:no-external-translate / ビルド前に自動実行）
//
// 画面の自動翻訳（MyMemory）は廃止した。ブラウザで動くコードから翻訳サービスへ文字を送ると、
// ユーザーの文章が外へ出るおそれがあるため、見つかったらビルドを止める。
//  - 翻訳サービスの接続先（MyMemory・Google・DeepL・Microsoft など）：src のどこにも書かない
//  - Anthropic（Claude）の API：サーバー専用の場所（src/app/api/・src/lib/translation/server/）の中だけ
//  - サーバー専用の翻訳コード（src/lib/translation/server/）は、src/app/api/ と同じ場所の中からしか読み込まない
// ============================================================
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const FORBIDDEN = [
  /mymemory\.translated\.net/i,
  /translat(e|ion)\.googleapis\.com/i,
  /api(-free)?\.deepl\.com/i,
  /microsofttranslator\.com/i,
  /libretranslate/i,
  /papago/i,
];
const SERVER_ONLY = [/api\.anthropic\.com/i, /@anthropic-ai\/sdk/];

function listFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(p));
    else if (/\.(tsx?|jsx?|mjs|json)$/.test(e.name)) out.push(p);
  }
  return out;
}

const problems = [];
for (const file of listFiles(path.join(root, 'src'))) {
  const rel = path.relative(root, file);
  const src = fs.readFileSync(file, 'utf8');
  for (const re of FORBIDDEN) if (re.test(src)) problems.push(`${rel}: 外部の翻訳サービス（${re.source}）`);
  const serverOnly = [path.join('src', 'app', 'api') + path.sep, path.join('src', 'lib', 'translation', 'server') + path.sep].some((d) => rel.startsWith(d));
  if (!serverOnly) {
    for (const re of SERVER_ONLY) if (re.test(src)) problems.push(`${rel}: Anthropic の API はサーバー専用の場所（src/app/api/・src/lib/translation/server/）の中だけで使えます`);
    if (/translation\/server/.test(src)) problems.push(`${rel}: サーバー専用の翻訳コード（translation/server）をブラウザ側から読み込んでいます`);
  }
}
if (problems.length) {
  console.error('✗ 外部の翻訳サービスへ送るコードがあります');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}
console.log('✓ ブラウザ側のコードに外部の翻訳サービスへの送信はありません');
