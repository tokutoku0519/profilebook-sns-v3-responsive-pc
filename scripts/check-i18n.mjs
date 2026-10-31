// ============================================================
// 翻訳キーの機械チェック（npm run check:i18n）
//
// 1. src/lib/i18nUi.ts の各行が 20 言語ぶん揃っているか（空欄・{n} などの差し込み漏れ）
// 2. プロフィール編集・プロフ帳・他人のプロフ帳・ペン道具で使っているキーが、
//    20 言語すべてで「その言語の訳」を持っているか（英語/日本語へのフォールバックになっていないか）
// 3. 画面の文言の訳の品質（UI_QUALITY）と公式のお題の訳の数・品質を表示（キーが揃っていることとは別）
//
// 1 と 2 に問題があれば終了コード 1。3 は表示だけ。
// ※ ここで分かるのは「キーと訳が揃っているか」まで。訳の自然さ・正しさは人の確認が必要。
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const require = createRequire(path.join(root, 'package.json'));
const ts = require('typescript');

function load(file, exportsList) {
  const src = fs.readFileSync(path.join(root, file), 'utf8').replace(/^import .*$/gm, '');
  const js = ts.transpileModule(`${src}\nmodule.exports = { ${exportsList} };`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const m = { exports: {} };
  new Function('module', 'exports', 'require', js)(m, m.exports, require);
  return m.exports;
}

const { dict } = load('src/lib/i18n.ts', 'dict');
const { __I18N_RAW } = load('src/lib/i18nUi.ts', '__I18N_RAW');
const { LANGS, RAW, RAW_VALUES, UI_QUALITY } = __I18N_RAW;

// 訳が「空」でよいキー（例：血液型の「型」は英語などでは付けない）
const EMPTY_OK = new Set(['blood_suffix']);

const errors = [];
const QSTAT = [];
const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

// ── 1. 行の形 ──
for (const [table, rows] of [['RAW', RAW], ['RAW_VALUES', RAW_VALUES]]) {
  for (const [key, row] of Object.entries(rows)) {
    if (row.length !== LANGS.length) errors.push(`${table}.${key}: ${row.length} 言語（${LANGS.length} 必要）`);
    row.forEach((v, i) => {
      if (v === undefined || v === null) errors.push(`${table}.${key}: ${LANGS[i]} がありません`);
      else if (v === '' && !EMPTY_OK.has(key)) errors.push(`${table}.${key}: ${LANGS[i]} が空です`);
      else if (vars(v) !== vars(row[0])) errors.push(`${table}.${key}: ${LANGS[i]} の差し込み {…} が日本語と違います（${vars(v) || 'なし'} / ${vars(row[0]) || 'なし'}）`);
    });
  }
}

// ── 2. 使っているキーが 20 言語で揃っているか ──
const FILES = [
  'src/app/[username]/page.tsx',
  'src/components/DecoToolbar.tsx',
  'src/components/Cards.tsx',
  'src/components/BottomTab.tsx',
];
// 公式のお題：英語の訳が全IDにあるか（ほかの言語は段階的に追加）
{
  const { QUESTION_TEXT, QUESTION_QUALITY } = load('src/lib/questionI18n.ts', 'QUESTION_TEXT, QUESTION_QUALITY');
  const ja = [...fs.readFileSync(path.join(root, 'src/lib/localeQuestions.ts'), 'utf8').matchAll(/id: '(d\d+)'/g)].map((m) => m[1]);
  for (const l of LANGS) {
    if (l === 'ja') continue;
    const have = ja.filter((id) => QUESTION_TEXT[l]?.[id]).length;
    QSTAT.push(`${l}:${have}/${ja.length}${QUESTION_QUALITY[l] ? `(${QUESTION_QUALITY[l].status})` : ''}`);
  }
  const missingEn = ja.filter((id) => !QUESTION_TEXT.en?.[id]);
  if (missingEn.length) errors.push(`公式のお題の英訳がないID: ${missingEn.join(' ')}`);
}
// テンプレートで組み立てるキーの展開（id の一覧は各定義と同じ）
const EXPAND = {
  'best3_${cat.key}': ['drink', 'tv', 'artist', 'movie', 'book', 'game', 'hobby'],
  'theme_${th.id}': ['default', 'lavender', 'soda', 'herb', 'peach', 'strawberry', 'banana', 'night'],
  'mbti_${ax.a}': ['E', 'N', 'T', 'J'],
  'mbti_${ax.b}': ['I', 'S', 'F', 'P'],
  'pen_font_${f.id}': ['futsu', 'garakei', 'maru', 'tegaki', 'yurufuwa', 'hime', 'decome', 'pop', 'retro', 'hoso'],
  'pen_desc_${f.id}': ['futsu', 'garakei', 'maru', 'tegaki', 'yurufuwa', 'hime', 'decome', 'pop', 'retro', 'hoso'],
  'pen_use_${f.use}': ['body', 'title', 'both'],
  'pen_size_${s.id}': ['s', 'm', 'l'],
  'pen_ink_${c.id}': ['navy', 'pink', 'purple', 'blue', 'green', 'red', 'brown', 'orange'],
  'tool_${tl.id}': ['pen', 'marker', 'sticker', 'deco'],
  'fl_level_${n}': ['0', '1', '2', '3', '4', '5'],
  'title_${type}': ['official', 'founder', 'pioneer'],
  'mtheme_${m}': Array.from({ length: 12 }, (_, i) => String(i)),
  'tab_${key}': ['stamp', 'theme', 'deco', 'font'],
};
const used = new Set(Array.from({ length: 10 }, (_, i) => `pq_${i + 1}`));
for (const f of FILES) {
  const src = fs.readFileSync(path.join(root, f), 'utf8');
  for (const m of src.matchAll(/\b(?:t|L|tf)\(\s*'([a-zA-Z0-9_]+)'/g)) used.add(m[1]);
  // t() を通さずに渡しているキー（通知の msg('sn_…')、addNotification(…, 'notif_…')、データの key: 'tag_…' など）
  for (const m of src.matchAll(/'((?:sn|notif|tag)_[a-z0-9_]+)'/g)) used.add(m[1]);
  for (const m of src.matchAll(/\b(?:t|L|tf)\(\s*`([^`]+)`/g)) {
    const k = m[1];
    if (!k.includes('${')) { used.add(k); continue; }
    if (!EXPAND[k]) { errors.push(`${f}: 展開できないキー \`${k}\`（scripts/check-i18n.mjs の EXPAND に追加してください）`); continue; }
    const prefix = k.slice(0, k.indexOf('${'));
    EXPAND[k].forEach((id) => used.add(prefix + id));
  }
}
const own = (key, lang) => dict[lang]?.[key] ?? (RAW[key] ? RAW[key][LANGS.indexOf(lang)] : undefined);
const fallbackByLang = Object.fromEntries(LANGS.map((l) => [l, []]));
for (const key of [...used].sort()) {
  if (own(key, 'ja') === undefined) { errors.push(`キー ${key} がどこにもありません`); continue; }
  for (const l of LANGS) if (own(key, l) === undefined) fallbackByLang[l].push(key);
}

// ── 3. 翻訳キーを通していない日本語は npm run report:untranslated で画面ごとに数える ──

// ── 結果 ──
console.log(`言語: ${LANGS.length} / 固定文言キー: ${Object.keys(RAW).length} / 選択肢ラベル: ${Object.keys(RAW_VALUES).length} / 画面で使用中のキー: ${used.size}`);
console.log(`\n[画面の文言の訳の品質（キーが揃っていることとは別）] ${LANGS.map((l) => `${l}:${UI_QUALITY?.[l] ?? '?'}`).join(' ')}\n  ※ source=原文／reviewed=開発側で確認（ネイティブ以外）／native=ネイティブ確認済み／draft=未確認`);
console.log(`\n[公式のお題（日本語 366 問）の訳の数] ${QSTAT.join(' ')}\n  ※ 訳がない言語は 英語 → 日本語 の順で表示。品質：draft=未確認／reviewed=確認済み（ネイティブ以外）／native=ネイティブ確認済み`);
console.log('\n[言語ごとの「自分の訳がない」キー数（英語→日本語へフォールバック）]');
for (const l of LANGS) {
  const list = fallbackByLang[l];
  console.log(`  ${l.padEnd(6)} ${String(list.length).padStart(3)}${list.length ? '  ' + list.join(' ') : ''}`);
  if (list.length) errors.push(`${l}: ${list.length} キーに自分の訳がありません`);
}
console.log('\n[翻訳キーを通していない日本語] npm run report:untranslated で画面ごとに確認できます');
if (errors.length) {
  console.log(`\n✗ ${errors.length} 件の問題`);
  errors.forEach((e) => console.log('  - ' + e));
  process.exit(1);
}
console.log('\n✓ 20 言語すべてで、使用中のキーに訳があります（訳の品質は別途確認が必要）');
