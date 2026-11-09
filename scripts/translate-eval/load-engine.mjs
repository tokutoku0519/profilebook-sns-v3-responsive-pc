// アプリの翻訳エンジン（TypeScript）を、そのまま手元の Node で使えるようにする（比較テスト・ワークスペースの確認用）。
// プロンプトや検証を別に書き写さず、本番と同じコードで試すため。外部には何も送らない（送るのは呼び出す側）。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const require = createRequire(path.join(root, 'package.json'));
const ts = require('typescript');

const FILES = {
  'i18nUi': 'src/lib/i18nUi.ts',
  'i18n': 'src/lib/i18n.ts',
  'shared': 'src/lib/translation/shared.ts',
  'config': 'src/lib/translation/server/config.ts',
  'engines': 'src/lib/translation/server/engines.ts',
  'pii': 'src/lib/translation/server/pii.ts',
};
const REWRITE = [
  [/from '\.\/i18nUi'/g, "from './i18nUi.mjs'"],
  [/from '@\/lib\/i18n'/g, "from './i18n.mjs'"],
  [/from '\.\.\/shared'/g, "from './shared.mjs'"],
  [/from '\.\/config'/g, "from './config.mjs'"],
  [/from '@anthropic-ai\/sdk'/g, `from '${pathToFileURL(require.resolve('@anthropic-ai/sdk')).href}'`],
];

export async function loadEngine() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'miri-engine-'));
  for (const [name, file] of Object.entries(FILES)) {
    let js = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    for (const [re, to] of REWRITE) js = js.replace(re, to);
    fs.writeFileSync(path.join(dir, `${name}.mjs`), js);
  }
  const load = (n) => import(pathToFileURL(path.join(dir, `${n}.mjs`)).href);
  return { engines: await load('engines'), config: await load('config'), pii: await load('pii'), shared: await load('shared') };
}
