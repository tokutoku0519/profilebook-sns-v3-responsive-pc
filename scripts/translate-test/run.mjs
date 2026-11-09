// ============================================================
// 翻訳 API の自動テスト（仮の翻訳・メモリ保存。外部には何も送らない）
//
// 使い方（ビルドは Supabase の代わりを指して 1 回だけ）：
//   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54399 NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-test-key NEXT_PUBLIC_APP_ENV=production npm run build
//   node scripts/translate-test/run.mjs            … API のテスト
//   node scripts/translate-test/run.mjs --ui       … API ＋ 画面のテスト（Playwright。390px・1366px）
// ============================================================
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ANSWER_IDS, IDS, defaultBooks, startMockSupabase, tokenFor } from './mock-supabase.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const require = createRequire(import.meta.url);
const SB_PORT = 54399, APP_PORT = 3411;
const BASE = `http://localhost:${APP_PORT}`;
const SB = `http://localhost:${SB_PORT}`;
const CONSENT_VERSION = /CONSENT_VERSION\s*=\s*'([^']+)'/.exec(fs.readFileSync(path.join(root, 'src/lib/translation/consentText.ts'), 'utf8'))[1];
const results = [];
let failed = 0;
const check = (label, ok, detail = '') => { results.push(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const section = (t) => results.push(`\n■ ${t}`);

async function startApp(extraEnv = {}) {
  const env = { ...process.env, PORT: String(APP_PORT), NEXT_PUBLIC_SUPABASE_URL: SB, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-test-key', ...extraEnv };
  for (const k of ['VERCEL_ENV', 'TRANSLATION_ENABLED', 'TRANSLATION_ENGINE', 'TRANSLATION_STORE', 'TRANSLATION_ALLOW_PAID', 'ANTHROPIC_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
    'TRANSLATION_WORKSPACE_GEO', 'TRANSLATION_MOCK_GEO', 'TRANSLATION_MOCK_FAIL', 'TRANSLATION_MOCK_PREFLIGHT', 'ADMIN_NOTIFY_WEBHOOK_URL']) if (!(k in extraEnv)) delete env[k];
  const child = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '-p', String(APP_PORT)], { cwd: root, env, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`${BASE}/api/translate`); if (r.ok) return child; } catch {}
    await new Promise((ok) => setTimeout(ok, 500));
  }
  child.kill(); throw new Error('アプリのサーバーが起動しませんでした');
}
const stopApp = (child) => new Promise((ok) => { child.once('exit', ok); child.kill(); });

const api = async (who, body) => {
  const headers = { 'content-type': 'application/json', ...(who ? { authorization: `Bearer ${tokenFor(IDS[who])}` } : {}) };
  const r = await fetch(`${BASE}/api/translate`, { method: 'POST', headers, body: JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};
const status = async (q = '') => (await fetch(`${BASE}/api/translate${q}`)).json();
const pf = (path, owner = 'alice') => ({ kind: 'profile_field', owner, path });
const ans = (id) => ({ kind: 'answer', id });
const tr = async (who, target, items) => {
  const r = await api(who, { action: 'translate', target, items });
  return Object.fromEntries((r.json.results ?? []).map((x) => [x.key, x]));
};
const k = (path, owner = 'alice') => `profile:${owner}:${path}`;
const ak = (id) => `answer:${id}`;
const setBook = (username, book) => fetch(`${SB}/__test/book`, { method: 'POST', body: JSON.stringify({ username, book }) });
const setAnswer = (id, patch) => fetch(`${SB}/__test/answer`, { method: 'POST', body: JSON.stringify({ id, patch }) });
// 同意（翻訳してよい項目）
const items = (sections, answers = []) => [...sections.map((key) => ({ kind: 'profile_section', key })), ...answers.map((id) => ({ kind: 'answer', id }))];
const SECTIONS = ['dream', 'specialty', 'catchphrase', 'message', 'wantToGo', 'collection', 'charmPoint', '__questions', '__best3'];
const grant = (who, its, extra = {}) => api(who, { action: 'grant_consent', version: CONSENT_VERSION, locale: 'ja', birthYear: 1996, birthMonth: 4, items: its, ...extra });
const thisYear = Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Tokyo', year: 'numeric' }).format(new Date()));
const del = async (who, method = 'GET', body) => {
  const r = await fetch(`${BASE}/api/account-deletion`, { method, headers: { 'content-type': 'application/json', ...(who ? { authorization: `Bearer ${tokenFor(IDS[who])}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};
const records = async () => (await status('?usage=1')).records;

// ── 個人情報の伏せ字（サーバーの部品を直接確かめる。pii.ts は import なしの 1 ファイル）──
async function piiUnit() {
  const ts = require(path.join(root, 'node_modules/typescript'));
  const src = fs.readFileSync(path.join(root, 'src/lib/translation/server/pii.ts'), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
}

const mock = await startMockSupabase(SB_PORT);
try {
  // ============================================================
  section('0. 個人情報の伏せ字・送らない判定（サーバーの部品・架空の文で評価）');
  const { screenPersonalInfo, restoreMasked } = await piiUnit();
  const corpus = JSON.parse(fs.readFileSync(path.join(root, 'scripts/translate-test/pii-cases.json'), 'utf8'));
  const tally = {};
  const misses = [];
  for (const c of corpus.cases) {
    const r = screenPersonalInfo(c.text);
    const got = r.ok ? (r.tokens.length ? 'mask' : 'send') : r.reason;
    tally[c.expect] = tally[c.expect] ?? { ok: 0, n: 0 };
    tally[c.expect].n++;
    if (got === c.expect) tally[c.expect].ok++; else misses.push(`${c.text} → ${got}`);
  }
  for (const [k, v] of Object.entries(tally)) check(`判定「${k}」の評価文 ${v.n} 件`, v.ok === v.n, `${v.ok}/${v.n}`);
  check('誤検出・見落としなし（架空の文 ' + corpus.cases.length + ' 件）', misses.length === 0, misses.join(' / '));
  const m = screenPersonalInfo('Insta は @miri_fan_01、ブログは https://example.com/miri です');
  check('URL・@ID はランダムな記号に置きかえて送る（元の文字列は送らない）', m.ok && m.tokens.length === 2 && !/@miri_fan_01|example\.com/.test(m.text) && m.tokens.every((x) => /^⟦[0-9a-f]{4}\d+⟧$/.test(x.token)), m.ok ? m.text : '');
  const [t1, t2] = m.ok ? m.tokens.map((x) => x.token) : ['', ''];
  const mutated = {
    keep: `Insta ${t1}, blog ${t2}`, drop: `Insta ${t1}, blog`, duplicate: `Insta ${t1} ${t1}, blog ${t2}`,
    alter: `Insta ${t1.replace(/\d⟧$/, '9⟧')}, blog ${t2}`, half: `Insta ${t1.slice(0, -1)}, blog ${t2}`, extra: `Insta ${t1}, blog ${t2} ⟦ffff9⟧`, reorder: `blog ${t2}, Insta ${t1}`,
  };
  for (const c of corpus.restore) {
    const out = restoreMasked(mutated[c.mutate], m.ok ? m.tokens : []);
    const ok = c.expect === 'ok' ? out != null && out.includes('@miri_fan_01') && out.includes('https://example.com/miri') && !/[⟦⟧]/.test(out) : out === null;
    check(`伏せ字を戻す：${c.case} → ${c.expect === 'ok' ? '戻す' : '失敗にして原文を出す'}`, ok, String(out));
  }
  check('原文にもともと ⟦ ⟧ があれば送らない（戻すときに区別できないため）', !screenPersonalInfo('⟦これは記号⟧').ok);

  // ============================================================
  section('A. 既定の設定（プレビューと同じ：仮の翻訳・メモリ保存）');
  let app = await startApp();
  let s = await status();
  check('使える状態で、仮の翻訳を使っている', s.enabled === true && s.mock === true, JSON.stringify(s));
  check('ログインなしの翻訳は 401', (await api(null, { action: 'translate', target: 'en', items: [pf('dream')] })).status === 401);
  check('ログインなしの同意も 401', (await api(null, { action: 'grant_consent', version: CONSENT_VERSION, locale: 'ja', ageConfirmed16: true, items: items(['dream']) })).status === 401);
  check('不正なトークンは 401', (await (await fetch(`${BASE}/api/translate`, { method: 'POST', headers: { authorization: 'Bearer abc.def.ghi', 'content-type': 'application/json' }, body: '{"action":"translate","target":"en","items":[]}' })).status) === 401);
  let c = (await api('alice', { action: 'get_consent' })).json;
  check('本人の許可は最初はオフ（いまの版を返す）', c.allow === false && c.currentVersion === CONSENT_VERSION, JSON.stringify(c));
  check('許可前は ownerAllows = false（ボタンを出さない）', (await status('?owner=alice')).ownerAllows === false);
  let r = await tr('bob', 'en', [pf('dream'), ans(ANSWER_IDS.public)]);
  check('許可前は公開の項目も回答も原文のまま', r[k('dream')]?.status === 'original' && r[ak(ANSWER_IDS.public)]?.status === 'original');

  // 同意画面の候補
  const cands = (await api('alice', { action: 'list_candidates' })).json.candidates ?? [];
  const ckeys = cands.map((x) => (x.item.kind === 'answer' ? `answer:${x.item.id}` : x.item.key));
  check('候補にログインしていない人に見える項目・公開回答が出る', ['dream', 'specialty', 'catchphrase', 'message', '__questions', '__best3', ak(ANSWER_IDS.public), ak(ANSWER_IDS.daily)].every((x) => ckeys.includes(x)), ckeys.join(','));
  check('候補に出ない（フォロワー限定・非公開・名前・ニックネーム・限定公開の回答）', !['motto', 'hometown', 'name', 'nickname', ak(ANSWER_IDS.followers), ak(ANSWER_IDS.private)].some((x) => ckeys.includes(x)));
  check('候補の見本は 40 文字まで・ひとこと質問は回答を見せる', cands.every((x) => [...x.preview].length <= 41) && cands.find((x) => x.item.key === '__questions')?.preview.startsWith('夏🍉'));

  // 直接オンにはできない
  check('以前の「オン／オフだけ」の操作（set_consent）は受け付けない', (await api('alice', { action: 'set_consent', allow: true })).status === 400);
  let g;
  check('生まれた年月がなければ 400（年齢不明は許可しない）', (await grant('alice', items(['dream']), { birthYear: undefined, birthMonth: undefined })).status === 400);
  check('ブラウザの判定（ageConfirmed16: true）だけでは許可されない', (await grant('alice', items(['dream']), { birthYear: undefined, birthMonth: undefined, ageConfirmed16: true })).status === 400);
  g = await grant('dave', items(['dream']), { birthYear: thisYear + 1, birthMonth: 1 });
  check('未来の年は年齢不明として 400', g.status === 400 && g.json.reason === 'age_invalid', JSON.stringify(g.json));
  g = await grant('dave', items(['dream']), { birthYear: thisYear - 15, birthMonth: 1 });
  check('16 歳未満はサーバーで断る（409 age）', g.status === 409 && g.json.reason === 'age', JSON.stringify(g.json));
  g = await grant('dave', items(['dream']), { birthYear: 1990, birthMonth: 1 });
  check('16 歳未満と入力したあと、すぐに大人の年を入れ直しても断る（age_locked）', g.status === 409 && g.json.reason === 'age_locked', JSON.stringify(g.json));
  check('項目を選ばなければ 400', (await grant('alice', [])).status === 400);
  check('表示した言語が ja / en 以外なら 400', (await grant('alice', items(['dream']), { locale: 'fr' })).status === 400);
  g = await grant('alice', items(['dream']), { version: '2020-01-old' });
  check('古い版の説明への同意は受け付けない（409 old_version）', g.status === 409 && g.json.reason === 'old_version', JSON.stringify(g));
  g = await grant('alice', items(['dream', 'motto']));
  check('フォロワー限定の項目を含む同意は受け付けない（409 not_public）', g.status === 409 && g.json.reason === 'not_public');
  g = await grant('alice', items([], [ANSWER_IDS.followers]));
  check('フォロワー限定の回答は選べない', g.status === 409);
  g = await grant('alice', [{ kind: 'profile_section', key: '__game' }]);
  check('対象外のセクション（__game）は 400', g.status === 400);
  check('うまくいかなかった操作は記録を作らない', (await records()).consentEvents === 0);

  g = await grant('alice', items(SECTIONS, [ANSWER_IDS.public]));
  check('説明の版・言語・16 歳以上・項目がそろえば許可できる', g.status === 200 && g.json.ok === true, JSON.stringify(g));
  c = (await api('alice', { action: 'get_consent' })).json;
  check('本人の状態（allow・いまの版・選んだ項目）', c.allow && c.current && c.version === CONSENT_VERSION && c.items.length === SECTIONS.length + 1 && !!c.grantedAt);
  check('同意の記録を 1 件作る（生年月は残さない）', (await records()).consentEvents === 1 && (await records()).birthDataStored === false);
  check('許可後は ownerAllows = true', (await status('?owner=alice')).ownerAllows === true);
  const u0 = (await status('?usage=1')).usage;
  const rec0 = await records();

  r = await tr('bob', 'en', [pf('dream'), pf('specialty'), pf('catchphrase'), pf('message'), pf('wantToGo'), pf('collection'), pf('__questions.0.a'), pf('__questions.1.a'), pf('__questions.2.a'), pf('__best3.drink.0'), pf('charmPoint'), pf('favoriteFood')]);
  check('公開（明示）の dream を翻訳', r[k('dream')]?.status === 'done' && r[k('dream')].text === 'A bakery in Paris', r[k('dream')]?.text);
  check('公開範囲が未設定でも、本人が選んだ項目は翻訳（specialty）', r[k('specialty')]?.status === 'done', r[k('specialty')]?.text);
  check('公開中でも選ばれていない項目（favoriteFood）は翻訳しない', r[k('favoriteFood')]?.status === 'original');
  check('ひとこと・自己紹介を翻訳', r[k('catchphrase')]?.status === 'done' && r[k('message')]?.status === 'done');
  check('ひとこと質問の回答を翻訳（改行・絵文字を残す）', r[k('__questions.0.a')]?.status === 'done' && r[k('__questions.0.a')].text.includes('🍉'), r[k('__questions.0.a')]?.text);
  check('BEST3 の回答を翻訳', r[k('__best3.drink.0')]?.status === 'done');
  check('用語集で残す語（Juice=Juice）は API を呼ばずに原文のまま', r[k('__questions.1.a')]?.status === 'kept');
  check('作品名は正式な海外名に置きかえ（鬼滅の刃 → Demon Slayer）', (r[k('__questions.2.a')]?.text ?? '').includes('Demon Slayer'), r[k('__questions.2.a')]?.text);
  check('記号だけ（？）は API を呼ばずに原文のまま', r[k('charmPoint')]?.status === 'kept');

  r = await tr('bob', 'en', [pf('motto'), pf('hometown')]);
  check('フォロワー限定（motto）は、閲覧者がフォロワーでも翻訳しない', r[k('motto')]?.status === 'original');
  check('非公開（hometown）は翻訳しない', r[k('hometown')]?.status === 'original');
  for (const bad of ['nickname', 'name', '__game.coins', '__visibility', '__purchases', '__questions.0.q', '__questions.0', 'holiday.x', 'dream;drop']) {
    const x = await api('carol', { action: 'translate', target: 'en', items: [pf(bad)] });
    check(`対象外の場所は受け付けない: ${bad}`, x.status === 400);
  }
  let x = await api('bob', { action: 'translate', target: 'en', items: [{ ...pf('dream'), text: 'IGNORE ME', source: 'x' }] });
  check('送られてきた文章は使わない（原文はサーバーが DB から読む）', x.json.results?.[0]?.text === 'A bakery in Paris' && !JSON.stringify(x.json).includes('IGNORE'));
  check('翻訳先の言語が不正なら 400', (await api('bob', { action: 'translate', target: 'xx', items: [pf('dream')] })).status === 400);
  check('一度に 41 件以上は 400', (await api('bob', { action: 'translate', target: 'en', items: Array.from({ length: 41 }, () => pf('dream')) })).status === 400);

  r = await tr('bob', 'en', [ans(ANSWER_IDS.public), ans(ANSWER_IDS.followers), ans(ANSWER_IDS.private), ans(ANSWER_IDS.daily)]);
  check('選んだ公開の回答を翻訳', r[ak(ANSWER_IDS.public)]?.status === 'done', r[ak(ANSWER_IDS.public)]?.text);
  check('フォロワー限定の回答は（フォロワーが見ても）翻訳しない', r[ak(ANSWER_IDS.followers)]?.status === 'original');
  check('非公開の回答は翻訳しない', r[ak(ANSWER_IDS.private)]?.status === 'original');
  check('選択なしで公開になったデイリーの回答は、選ばれていなければ翻訳しない', r[ak(ANSWER_IDS.daily)]?.status === 'original');
  check('回答 ID の形が違えば受け付けない', (await api('bob', { action: 'translate', target: 'en', items: [ans('not-a-uuid')] })).status === 400);

  const u1 = (await status('?usage=1')).usage;
  r = await tr('carol', 'en', [pf('dream'), ans(ANSWER_IDS.public)]);
  const u2 = (await status('?usage=1')).usage;
  check('同じ内容・同じ言語は翻訳済みを使う（API を呼ばない）', r[k('dream')]?.status === 'done' && u2.requests === u1.requests && u2.cacheHits >= u1.cacheHits + 2, `API ${u1.requests}→${u2.requests} / 翻訳済み ${u1.cacheHits}→${u2.cacheHits}`);
  check('使用量を記録（確定額・トークン）', u2.spentUsd > 0 && u2.inputTokens > 0 && u2.outputTokens > 0 && u2.reservedUsd === 0, JSON.stringify(u2));
  check('翻訳した回数＝API を呼んだ回数', u2.requests - u0.requests === 10, `${u2.requests - u0.requests} 回`);
  let rec = await records();
  check('外国への送信の記録は、API を呼んだ回数と同じ（翻訳済み・送らない文は記録しない）', rec.provisions - rec0.provisions === u2.requests - u0.requests, `送信の記録 ${rec.provisions - rec0.provisions} 件`);
  check('送信の記録はすべて結果つき（completed）', (rec.provisionsByOutcome.completed ?? 0) === rec.provisions && !rec.provisionsByOutcome.sending, JSON.stringify(rec.provisionsByOutcome));
  check('費用の確保に個人の ID を持たない／回数制限の記録はある', rec.reservationsWithIds === 0 && rec.dailyRows > 0, JSON.stringify(rec));
  r = await tr('bob', 'ja', [pf('dream')]);
  check('表示言語と同じ言語（日本語の文を日本語で）は API を呼ばない', r[k('dream')]?.status === 'kept' && (await status('?usage=1')).usage.requests === u2.requests);
  r = await tr('alice', 'en', [pf('message', 'bob')]);
  check('英語の文を英語の閲覧者には訳さない／許可のない人（bob）の項目は訳さない', r[k('message', 'bob')]?.status === 'original');

  // 個人情報（ほかの人の情報を含みうる）
  const book = defaultBooks().alice;
  await setBook('alice', { ...book, message: 'メールは alice@example.com まで', catchphrase: '東京都渋谷区神宮前1丁目2-3 に住んでます', specialty: '持病があって通院しています', dream: 'ブログは https://example.com/miri です' });
  const uP = (await status('?usage=1')).usage;
  r = await tr('erin', 'en', [pf('message'), pf('catchphrase'), pf('specialty'), pf('dream')]);
  const uQ = (await status('?usage=1')).usage;
  check('メールアドレスを含む文は送らずに原文のまま（理由 personal）', r[k('message')]?.status === 'kept' && r[k('message')].reason === 'personal', JSON.stringify(r[k('message')]));
  check('住所らしい文は送らずに原文のまま', r[k('catchphrase')]?.status === 'kept' && r[k('catchphrase')].reason === 'personal');
  check('健康などを本人のこととして書いた文は送らずに原文のまま', r[k('specialty')]?.status === 'kept' && r[k('specialty')].reason === 'personal');
  check('URL は伏せ字で送り、訳文に元のまま戻す', r[k('dream')]?.status === 'done' && r[k('dream')].text.includes('https://example.com/miri'), r[k('dream')]?.text);
  check('送らなかった文は API を呼ばない（4 件中 1 件だけ呼ぶ）', uQ.requests - uP.requests === 1, `${uQ.requests - uP.requests} 回`);
  const cb = (await api('alice', { action: 'list_candidates' })).json.candidates ?? [];
  const bl = Object.fromEntries(cb.filter((x) => x.blocked).map((x) => [x.item.key ?? x.item.id, x.blocked]));
  check('本人の同意画面の候補に「翻訳されない理由」が付く（連絡先・住所・配慮が必要な内容）', bl.message === 'contact' && bl.catchphrase === 'address' && bl.specialty === 'sensitive' && !bl.dream, JSON.stringify(bl));
  check('候補にチェック用の全文（checkText）は含めない（見本は本人の文の先頭 40 文字だけ）', !JSON.stringify(cb).includes('checkText') && cb.every((x) => [...x.preview].length <= 41));

  // 原文の編集・公開範囲の変更・回答の変更
  await setBook('alice', { ...book, dream: 'ケーキ屋さん' });
  r = await tr('erin', 'en', [pf('dream')]);
  check('原文を編集したら古い翻訳は使わず、新しい原文を訳す', r[k('dream')]?.status === 'done' && r[k('dream')].text.includes('ケーキ屋さん'), r[k('dream')]?.text);
  await setBook('alice', { ...book, dream: 'ケーキ屋さん', __visibility: { ...book.__visibility, dream: 'followers' } });
  r = await tr('carol', 'en', [pf('dream')]);
  check('フォロワー限定に変えたら、翻訳済みがあっても返さない', r[k('dream')]?.status === 'original');
  await setBook('alice', book);
  r = await tr('carol', 'en', [pf('dream')]);
  check('公開に戻しても、本人が選び直すまで翻訳しない', r[k('dream')]?.status === 'original');
  await setAnswer(ANSWER_IDS.public, { visibility: 'followers' });
  r = await tr('carol', 'en', [ans(ANSWER_IDS.public)]);
  check('回答をフォロワー限定に変えたら、翻訳済みがあっても返さない', r[ak(ANSWER_IDS.public)]?.status === 'original');
  await setAnswer(ANSWER_IDS.public, { visibility: 'public', body: '揚げパンときなこパン' });
  r = await tr('carol', 'en', [ans(ANSWER_IDS.public)]);
  check('回答を公開に戻しても、選び直すまで翻訳しない', r[ak(ANSWER_IDS.public)]?.status === 'original');

  // 翻訳してよい項目を変える
  const ev0 = (await records()).consentEvents;
  g = await api('alice', { action: 'set_items', items: items(SECTIONS, [ANSWER_IDS.public, ANSWER_IDS.daily]) });
  check('項目を選び直せる（デイリーの回答も選べる）', g.status === 200 && g.json.ok === true, JSON.stringify(g));
  r = await tr('erin', 'en', [ans(ANSWER_IDS.public), ans(ANSWER_IDS.daily), pf('dream')]);
  check('選び直したら翻訳する（編集後の本文・デイリーの回答・dream）', (r[ak(ANSWER_IDS.public)]?.text ?? '').includes('きなこ') && r[ak(ANSWER_IDS.daily)]?.status === 'done' && r[k('dream')]?.status === 'done');
  await setAnswer(ANSWER_IDS.public, { body: '揚げパンがいちばん好きだった' });
  g = await api('alice', { action: 'set_items', items: items(SECTIONS.filter((x) => x !== 'catchphrase'), [ANSWER_IDS.public]) });
  r = await tr('erin', 'en', [pf('catchphrase'), ans(ANSWER_IDS.daily), pf('dream')]);
  check('外した項目（ひとこと・デイリーの回答）は翻訳済みも返さない', g.json.ok && r[k('catchphrase')]?.status === 'original' && r[ak(ANSWER_IDS.daily)]?.status === 'original' && r[k('dream')]?.status === 'done');
  check('項目の変更も記録する', (await records()).consentEvents === ev0 + 2);
  g = await api('alice', { action: 'set_items', items: items(['motto']) });
  check('項目の変更でも、公開でない項目は選べない', g.status === 409);
  g = await api('alice', { action: 'set_items', items: [] });
  check('項目を 0 件にはできない（やめるときは取り消し）', g.status === 400);

  // 許可の取り消し
  const recR = await records();
  check('取り消し', (await api('alice', { action: 'revoke_consent' })).json.ok === true);
  r = await tr('bob', 'en', [pf('specialty'), ans(ANSWER_IDS.public)]);
  check('取り消したら、翻訳済みも返さない', r[k('specialty')]?.status === 'original' && r[ak(ANSWER_IDS.public)]?.status === 'original');
  check('取り消し後は ownerAllows = false', (await status('?owner=alice')).ownerAllows === false);
  c = (await api('alice', { action: 'get_consent' })).json;
  check('取り消し後の本人の状態は allow = false・項目 0', c.allow === false && c.items.length === 0);
  rec = await records();
  check('法定の記録は残す（取り消しを 1 件追加・送信の記録は消さない）', rec.consentEvents === recR.consentEvents + 1 && rec.provisions === recR.provisions, JSON.stringify(rec));
  check('取り消し後の項目の変更は受け付けない', (await api('alice', { action: 'set_items', items: items(['dream']) })).status === 409);
  g = await grant('alice', items(SECTIONS, [ANSWER_IDS.public]));
  r = await tr('carol', 'en', [pf('specialty')]);
  check('もう一度許可すれば翻訳する（説明の確認から）', g.json.ok && r[k('specialty')]?.status === 'done');

  // 回数制限（1 分あたり）
  let limited = false;
  for (let i = 0; i < 35 && !limited; i++) limited = (await api('dave', { action: 'get_consent' })).status === 429;
  check('1 人が 1 分に 30 回を超えたら 429', limited);
  const writes = await (await fetch(`${SB}/__test/writes`)).json();
  check('Supabase には何も書き込んでいない（メモリ保存）', writes.length === 0, `${writes.length} 件`);
  await stopApp(app);

  // ============================================================
  section('B. 予算の上限（$0.0012。24 件すべてなら約 $0.0021）と同時アクセス');
  await setBook('alice', { ...book, __questions: Array.from({ length: 24 }, (_, i) => ({ q: `質問${i}`, a: `こたえ${i}です` })), __visibility: {} });
  app = await startApp({ TRANSLATION_MONTHLY_CAP_USD: '0.0012' });
  await grant('alice', items(['__questions']));
  const who = ['bob', 'carol', 'dave', 'erin'];
  const batches = await Promise.all(who.map((w, wi) => tr(w, 'en', Array.from({ length: 6 }, (_, i) => pf(`__questions.${wi * 6 + i}.a`)))));
  const all = batches.flatMap((b) => Object.values(b));
  const done = all.filter((v) => v.status === 'done').length;
  const u = (await status('?usage=1')).usage;
  check('4 人が同時に 24 件を頼んでも、上限を超えない', u.spentUsd + u.reservedUsd <= 0.0012 + 1e-9, `翻訳 ${done} 件・確定 $${u.spentUsd}・呼び出し中 $${u.reservedUsd}`);
  check('上限に達した分は原文のまま', all.filter((v) => v.status === 'original').length === 24 - done && done > 0 && done < 24, `原文 ${24 - done} 件`);
  const doneKey = all.find((v) => v.status === 'done')?.key;
  const again = await tr('erin', 'en', [pf(doneKey.split(':')[2])]);
  check('上限に達したあとも、翻訳済みは表示できる', Object.values(again)[0]?.status === 'done');
  check('送信の記録は、実際に API を呼んだ分だけ', (await records()).provisions === u.requests, `${(await records()).provisions} 件 / API ${u.requests} 回`);
  await stopApp(app);

  // ============================================================
  section('C. 1 人・1 原文あたりの 1 日の回数');
  app = await startApp({ TRANSLATION_USER_DAILY_LIMIT: '3', TRANSLATION_OWNER_DAILY_LIMIT: '5' });
  await grant('alice', items(['__questions']));
  const rb = Object.values(await tr('bob', 'en', Array.from({ length: 6 }, (_, i) => pf(`__questions.${i}.a`))));
  check('1 人 1 日 3 回まで（6 件頼んで 3 件）', rb.filter((v) => v.status === 'done').length === 3);
  const rc = Object.values(await tr('carol', 'en', Array.from({ length: 6 }, (_, i) => pf(`__questions.${i + 6}.a`))));
  check('同じ人の原文は 1 日 5 回まで（ほかの人が頼んでも残り 2 件）', rc.filter((v) => v.status === 'done').length === 2);
  await stopApp(app);
  await setBook('alice', book);

  // ============================================================
  section('F. 送信の記録（米国以外の応答・タイムアウト・やり直し・事前確認の失敗）');
  for (const [env, label, expect] of [
    [{ TRANSLATION_MOCK_GEO: 'eu' }, '応答の地域が us でない', 'geo'],
    [{ TRANSLATION_MOCK_GEO: '' , TRANSLATION_MOCK_FAIL: 'timeout' }, 'タイムアウト（届いたか分からない）', 'timeout'],
    [{ TRANSLATION_MOCK_FAIL: 'overloaded_once' }, '1 回目が 529（混雑）で、2 回目は成功', 'retry'],
    [{ TRANSLATION_MOCK_FAIL: 'error' }, 'API がエラーを返した（500。やり直さない）', 'error'],
    [{ TRANSLATION_MOCK_PREFLIGHT: 'fail' }, '送る前の確認（米国だけに制限されているか）に失敗', 'preflight'],
  ]) {
    app = await startApp(env);
    await grant('alice', items(SECTIONS));
    r = await tr('bob', 'en', [pf('dream')]);
    const rc = await records();
    const by = rc.provisionsByOutcome;
    if (expect === 'geo') {
      check(`${label}：訳文を使わず原文を表示`, r[k('dream')]?.status === 'original');
      check(`${label}：送った事実は記録に残す（geo_mismatch 1 件）`, by.geo_mismatch === 1 && rc.provisions === 1, JSON.stringify(by));
      check(`${label}：新しい翻訳を自動で止める（${rc.halted}）`, !!rc.halted && rc.halted.startsWith('geo_mismatch'));
      const again = await tr('carol', 'en', [pf('catchphrase')]);
      check(`${label}：止まったあとは送らない（記録も増えない）`, again[k('catchphrase')]?.status === 'original' && (await records()).provisions === 1);
      check(`${label}：同じ文を頼み直しても、保存されていない（キャッシュに入らない）`, (await tr('erin', 'en', [pf('dream')]))[k('dream')]?.status === 'original');
    } else if (expect === 'timeout') {
      check(`${label}：原文を表示`, r[k('dream')]?.status === 'original');
      check(`${label}：やり直しを含めて 2 回分を「unknown」で記録`, by.unknown === 2 && rc.provisions === 2, JSON.stringify(by));
      check(`${label}：使用量が分からないので精算せず、見込み額を確保したまま（少なく数えない）`, (await status('?usage=1')).usage.reservedUsd > 0);
    } else if (expect === 'retry') {
      check(`${label}：2 回目の結果で翻訳`, r[k('dream')]?.status === 'done');
      check(`${label}：1 回目（error_response）と 2 回目（completed）を別々に記録`, by.error_response === 1 && by.completed === 1 && rc.provisions === 2, JSON.stringify(by));
    } else if (expect === 'error') {
      check(`${label}：原文を表示・記録は 1 件（error_response）`, r[k('dream')]?.status === 'original' && by.error_response === 1 && rc.provisions === 1, JSON.stringify(by));
    } else {
      check(`${label}：送らない（送信の記録 0 件）・原文を表示`, r[k('dream')]?.status === 'original' && rc.provisions === 0, JSON.stringify(by));
      check(`${label}：新しい翻訳を止める（${rc.halted}）`, !!rc.halted);
    }
    await stopApp(app);
  }
  app = await startApp();
  await grant('alice', items(SECTIONS));
  const same = await Promise.all(['bob', 'carol', 'erin'].map((w) => api(w, { action: 'translate', target: 'ko', items: [pf('dream')] })));
  const recS = await records();
  check('同じ文・同じ言語を 3 人が同時に頼んでも、送るのは 1 回（送信の記録 1 件）', recS.provisions === 1, `${recS.provisions} 件 / ${same.map((x) => x.json.results?.[0]?.status).join(',')}`);
  await stopApp(app);

  // ============================================================
  section('G. 退会・データ削除の申請（/api/account-deletion）');
  app = await startApp({ ADMIN_NOTIFY_WEBHOOK_URL: `${SB}/__test/notify` });
  check('ログインなしは 401', (await del(null)).status === 401 && (await del(null, 'POST', { note: 'x' })).status === 401);
  let d = await del('carol');
  check('申請前は pending = false', d.status === 200 && d.json.pending === false, JSON.stringify(d.json));
  d = await del('carol', 'POST', { note: 'お願いします' });
  check('申請すると受付日時つきで pending', d.json.ok && d.json.pending && !!d.json.requestedAt && d.json.via === 'table', JSON.stringify(d.json));
  const d2 = await del('carol', 'POST', { note: 'もう一度' });
  check('受付中にもう一度押しても二重に作らない', d2.json.ok && mock.state.deletionRequests.filter((x) => x.user_id === IDS.carol).length === 1);
  check('GET で受付中と受付日時が分かる', (await del('carol')).json.pending === true);
  check('ほかの人には自分の申請しか見えない（RLS）', (await del('dave')).json.pending === false);
  check('申請の記録に本人の ID・名前・メモ、状態 received', mock.state.deletionRequests[0]?.user_id === IDS.carol && mock.state.deletionRequests[0]?.status === 'received');
  check('運営者への通知を送る（個人情報は含めない）', mock.state.notices.length >= 1 && !JSON.stringify(mock.state.notices).includes('carol') && !JSON.stringify(mock.state.notices).includes(IDS.carol));
  await fetch(`${SB}/__test/deletion-table`, { method: 'POST', body: JSON.stringify({ exists: false }) });
  d = await del('dave', 'POST', { note: '' });
  check('テーブルを適用する前の本番では、既存の feedback に記録する', d.json.ok && d.json.via === 'feedback' && mock.state.feedback.some((x) => x.user_id === IDS.dave && x.kind === 'account_deletion'), JSON.stringify(d.json));
  check('feedback でも受付中なら二重に作らない', (await del('dave', 'POST', {})).json.ok && mock.state.feedback.filter((x) => x.user_id === IDS.dave).length === 1);
  await fetch(`${SB}/__test/deletion-table`, { method: 'POST', body: JSON.stringify({ exists: true }) });
  await stopApp(app);
  mock.state.writes.length = 0;

  // ============================================================
  section('D. 本番の設定');
  const prodCases = [
    [{ VERCEL_ENV: 'production' }, '本番は TRANSLATION_ENABLED を設定しなければ止まる'],
    [{ VERCEL_ENV: 'production', TRANSLATION_ENABLED: 'true' }, '本番では仮の翻訳を使わない'],
    [{ VERCEL_ENV: 'production', TRANSLATION_ENABLED: 'true', TRANSLATION_ENGINE: 'anthropic', ANTHROPIC_API_KEY: 'sk-test' }, '有料 API は TRANSLATION_ALLOW_PAID がなければ使わない'],
    [{ VERCEL_ENV: 'production', TRANSLATION_ENABLED: 'true', TRANSLATION_ENGINE: 'anthropic', TRANSLATION_ALLOW_PAID: 'true' }, 'API キーがなければ使わない'],
    [{ VERCEL_ENV: 'production', TRANSLATION_ENABLED: 'true', TRANSLATION_ENGINE: 'anthropic', TRANSLATION_ALLOW_PAID: 'true', ANTHROPIC_API_KEY: 'sk-test' }, '予算・同意・記録を DB で持たない（メモリ）なら有料 API は使わない'],
    [{ VERCEL_ENV: 'production', TRANSLATION_ENABLED: 'true', TRANSLATION_ENGINE: 'anthropic', TRANSLATION_ALLOW_PAID: 'true', ANTHROPIC_API_KEY: 'sk-test', TRANSLATION_STORE: 'db', SUPABASE_SERVICE_ROLE_KEY: 'x' }, '翻訳専用ワークスペースが米国だけと確認した印（TRANSLATION_WORKSPACE_GEO=us）がなければ有料 API は使わない'],
    [{ VERCEL_ENV: 'production', TRANSLATION_ENABLED: 'true', TRANSLATION_MOCK_GEO: 'eu', TRANSLATION_MOCK_FAIL: 'error' }, '本番では仮の翻訳の失敗のまね（テスト用の変数）を使わない（そもそも仮の翻訳を使わない）'],
    [{ TRANSLATION_ENABLED: 'false' }, 'TRANSLATION_ENABLED=false なら止まる（プレビューでも）'],
  ];
  for (const [env, label] of prodCases) {
    app = await startApp(env);
    const st = await status('?owner=alice');
    const p = await api('bob', { action: 'translate', target: 'en', items: [pf('dream')] });
    const gc = await grant('alice', items(['dream']));
    check(label, st.enabled === false && p.status === 503 && gc.status === 503 && st.ownerAllows === undefined);
    await stopApp(app);
  }

  // ============================================================
  if (process.argv.includes('--ui')) {
    section('E. 画面（Playwright・390px / 1366px）');
    app = await startApp();
    const regrant = () => grant('alice', items(SECTIONS, [ANSWER_IDS.public]));
    await regrant();
    const { runUi } = await import('./ui.mjs');
    await runUi({ BASE, SB, check, sessionFor: (await import('./mock-supabase.mjs')).sessionFor, IDS, ANSWER_IDS, require, regrant, records, setBook, book, mock });
    await stopApp(app);
  }
} finally {
  await mock.close();
}
console.log(results.join('\n'));
console.log(`\n${failed ? `❌ ${failed} 件が失敗` : '✅ すべて合格'}（${results.filter((l) => l.includes('✅') || l.includes('❌')).length} 項目）`);
process.exit(failed ? 1 : 0);
