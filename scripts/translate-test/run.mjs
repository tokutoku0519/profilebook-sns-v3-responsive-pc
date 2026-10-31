// ============================================================
// 翻訳 API の自動テスト（仮の翻訳・メモリ保存。外部には何も送らない）
//
// 使い方（ビルドは Supabase の代わりを指して 1 回だけ）：
//   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54399 NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-test-key NEXT_PUBLIC_APP_ENV=production npm run build
//   node scripts/translate-test/run.mjs            … API のテスト
//   node scripts/translate-test/run.mjs --ui       … API ＋ 画面のテスト（Playwright。390px・1366px）
// ============================================================
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ANSWER_IDS, IDS, defaultBooks, startMockSupabase, tokenFor } from './mock-supabase.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const SB_PORT = 54399, APP_PORT = 3411;
const BASE = `http://localhost:${APP_PORT}`;
const SB = `http://localhost:${SB_PORT}`;
const results = [];
let failed = 0;
const check = (label, ok, detail = '') => { results.push(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const section = (t) => results.push(`\n■ ${t}`);

async function startApp(extraEnv = {}) {
  const env = { ...process.env, PORT: String(APP_PORT), NEXT_PUBLIC_SUPABASE_URL: SB, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-test-key', ...extraEnv };
  for (const k of ['VERCEL_ENV', 'TRANSLATION_ENABLED', 'TRANSLATION_ENGINE', 'TRANSLATION_STORE', 'TRANSLATION_ALLOW_PAID', 'ANTHROPIC_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) if (!(k in extraEnv)) delete env[k];
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
const setBook = (username, book) => fetch(`${SB}/__test/book`, { method: 'POST', body: JSON.stringify({ username, book }) });
const setAnswer = (id, patch) => fetch(`${SB}/__test/answer`, { method: 'POST', body: JSON.stringify({ id, patch }) });

const mock = await startMockSupabase(SB_PORT);
try {
  // ============================================================
  section('A. 既定の設定（プレビューと同じ：仮の翻訳・メモリ保存）');
  let app = await startApp();
  let s = await status();
  check('使える状態で、仮の翻訳を使っている', s.enabled === true && s.mock === true, JSON.stringify(s));
  check('ログインなしの翻訳は 401', (await api(null, { action: 'translate', target: 'en', items: [pf('dream')] })).status === 401);
  check('不正なトークンは 401', (await (await fetch(`${BASE}/api/translate`, { method: 'POST', headers: { authorization: 'Bearer abc.def.ghi', 'content-type': 'application/json' }, body: '{"action":"translate","target":"en","items":[]}' })).status) === 401);
  check('本人の許可は最初はオフ', (await api('alice', { action: 'get_consent' })).json.allow === false);
  check('許可前は ownerAllows = false（ボタンを出さない）', (await status('?owner=alice')).ownerAllows === false);
  let r = await tr('bob', 'en', [pf('dream'), ans(ANSWER_IDS.public)]);
  check('許可前は公開の項目も回答も原文のまま', r[k('dream')]?.status === 'original' && r[`answer:${ANSWER_IDS.public}`]?.status === 'original');

  check('本人が許可をオンにできる', (await api('alice', { action: 'set_consent', allow: true })).json.allow === true);
  check('許可後は ownerAllows = true', (await status('?owner=alice')).ownerAllows === true);
  const u0 = (await status('?usage=1')).usage;

  r = await tr('bob', 'en', [pf('dream'), pf('specialty'), pf('catchphrase'), pf('message'), pf('wantToGo'), pf('collection'), pf('__questions.0.a'), pf('__questions.1.a'), pf('__questions.2.a'), pf('__best3.drink.0'), pf('charmPoint')]);
  check('公開（明示）の dream を翻訳', r[k('dream')]?.status === 'done' && r[k('dream')].text === 'A bakery in Paris', r[k('dream')]?.text);
  check('公開範囲が未設定でも本人の許可があれば翻訳（specialty）', r[k('specialty')]?.status === 'done', r[k('specialty')]?.text);
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
    const x = await api('bob', { action: 'translate', target: 'en', items: [pf(bad)] });
    check(`対象外の場所は受け付けない: ${bad}`, x.status === 400);
  }
  let x = await api('bob', { action: 'translate', target: 'en', items: [{ ...pf('dream'), text: 'IGNORE ME', source: 'x' }] });
  check('送られてきた文章は使わない（原文はサーバーが DB から読む）', x.json.results?.[0]?.text === 'A bakery in Paris' && !JSON.stringify(x.json).includes('IGNORE'));
  check('翻訳先の言語が不正なら 400', (await api('bob', { action: 'translate', target: 'xx', items: [pf('dream')] })).status === 400);
  check('一度に 41 件以上は 400', (await api('bob', { action: 'translate', target: 'en', items: Array.from({ length: 41 }, () => pf('dream')) })).status === 400);

  r = await tr('bob', 'en', [ans(ANSWER_IDS.public), ans(ANSWER_IDS.followers), ans(ANSWER_IDS.private)]);
  check('公開の回答を翻訳', r[`answer:${ANSWER_IDS.public}`]?.status === 'done', r[`answer:${ANSWER_IDS.public}`]?.text);
  check('フォロワー限定の回答は（フォロワーが見ても）翻訳しない', r[`answer:${ANSWER_IDS.followers}`]?.status === 'original');
  check('非公開の回答は翻訳しない', r[`answer:${ANSWER_IDS.private}`]?.status === 'original');
  check('回答 ID の形が違えば受け付けない', (await api('bob', { action: 'translate', target: 'en', items: [ans('not-a-uuid')] })).status === 400);

  const u1 = (await status('?usage=1')).usage;
  r = await tr('carol', 'en', [pf('dream'), ans(ANSWER_IDS.public)]);
  const u2 = (await status('?usage=1')).usage;
  check('同じ内容・同じ言語は翻訳済みを使う（API を呼ばない）', r[k('dream')]?.status === 'done' && u2.requests === u1.requests && u2.cacheHits >= u1.cacheHits + 2, `API ${u1.requests}→${u2.requests} / 翻訳済み ${u1.cacheHits}→${u2.cacheHits}`);
  check('使用量を記録（確定額・トークン）', u2.spentUsd > 0 && u2.inputTokens > 0 && u2.outputTokens > 0 && u2.reservedUsd === 0, JSON.stringify(u2));
  check('翻訳した回数＝API を呼んだ回数', u2.requests - u0.requests === 10, `${u2.requests - u0.requests} 回`);
  r = await tr('bob', 'ja', [pf('dream')]);
  check('表示言語と同じ言語（日本語の文を日本語で）は API を呼ばない', r[k('dream')]?.status === 'kept' && (await status('?usage=1')).usage.requests === u2.requests);
  r = await tr('alice', 'en', [pf('message', 'bob')]);
  check('英語の文を英語の閲覧者には訳さない／許可のない人（bob）の項目は訳さない', r[k('message', 'bob')]?.status === 'original');

  // 原文の編集・公開範囲の変更・回答の変更
  const book = defaultBooks().alice;
  await setBook('alice', { ...book, dream: 'ケーキ屋さん' });
  r = await tr('bob', 'en', [pf('dream')]);
  check('原文を編集したら古い翻訳は使わず、新しい原文を訳す', r[k('dream')]?.status === 'done' && r[k('dream')].text.includes('ケーキ屋さん'), r[k('dream')]?.text);
  await setBook('alice', { ...book, dream: 'ケーキ屋さん', __visibility: { ...book.__visibility, dream: 'followers' } });
  r = await tr('carol', 'en', [pf('dream')]);
  check('フォロワー限定に変えたら、翻訳済みがあっても返さない', r[k('dream')]?.status === 'original');
  await setBook('alice', book);
  await setAnswer(ANSWER_IDS.public, { visibility: 'followers' });
  r = await tr('carol', 'en', [ans(ANSWER_IDS.public)]);
  check('回答をフォロワー限定に変えたら、翻訳済みがあっても返さない', r[`answer:${ANSWER_IDS.public}`]?.status === 'original');
  await setAnswer(ANSWER_IDS.public, { visibility: 'public', body: '揚げパンときなこパン' });
  r = await tr('carol', 'en', [ans(ANSWER_IDS.public)]);
  check('回答の本文を編集したら新しい本文を訳す', (r[`answer:${ANSWER_IDS.public}`]?.text ?? '').includes('きなこ'), r[`answer:${ANSWER_IDS.public}`]?.text);
  await setAnswer(ANSWER_IDS.public, { body: '揚げパンがいちばん好きだった' });

  // 許可の取り消し
  await api('alice', { action: 'set_consent', allow: false });
  r = await tr('bob', 'en', [pf('specialty'), ans(ANSWER_IDS.public)]);
  check('本人が許可を取り消したら、翻訳済みも返さない', r[k('specialty')]?.status === 'original' && r[`answer:${ANSWER_IDS.public}`]?.status === 'original');
  check('取り消し後は ownerAllows = false', (await status('?owner=alice')).ownerAllows === false);
  await api('alice', { action: 'set_consent', allow: true });

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
  await api('alice', { action: 'set_consent', allow: true });
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
  await stopApp(app);

  // ============================================================
  section('C. 1 人・1 原文あたりの 1 日の回数');
  app = await startApp({ TRANSLATION_USER_DAILY_LIMIT: '3', TRANSLATION_OWNER_DAILY_LIMIT: '5' });
  await api('alice', { action: 'set_consent', allow: true });
  const rb = Object.values(await tr('bob', 'en', Array.from({ length: 6 }, (_, i) => pf(`__questions.${i}.a`))));
  check('1 人 1 日 3 回まで（6 件頼んで 3 件）', rb.filter((v) => v.status === 'done').length === 3);
  const rc = Object.values(await tr('carol', 'en', Array.from({ length: 6 }, (_, i) => pf(`__questions.${i + 6}.a`))));
  check('同じ人の原文は 1 日 5 回まで（ほかの人が頼んでも残り 2 件）', rc.filter((v) => v.status === 'done').length === 2);
  await stopApp(app);
  await setBook('alice', book);

  // ============================================================
  section('D. 本番の設定');
  const prodCases = [
    [{ VERCEL_ENV: 'production' }, '本番は TRANSLATION_ENABLED を設定しなければ止まる'],
    [{ VERCEL_ENV: 'production', TRANSLATION_ENABLED: 'true' }, '本番では仮の翻訳を使わない'],
    [{ VERCEL_ENV: 'production', TRANSLATION_ENABLED: 'true', TRANSLATION_ENGINE: 'anthropic', ANTHROPIC_API_KEY: 'sk-test' }, '有料 API は TRANSLATION_ALLOW_PAID がなければ使わない'],
    [{ VERCEL_ENV: 'production', TRANSLATION_ENABLED: 'true', TRANSLATION_ENGINE: 'anthropic', TRANSLATION_ALLOW_PAID: 'true' }, 'API キーがなければ使わない'],
    [{ VERCEL_ENV: 'production', TRANSLATION_ENABLED: 'true', TRANSLATION_ENGINE: 'anthropic', TRANSLATION_ALLOW_PAID: 'true', ANTHROPIC_API_KEY: 'sk-test' }, '予算を DB で数えない（メモリ）なら有料 API は使わない'],
    [{ TRANSLATION_ENABLED: 'false' }, 'TRANSLATION_ENABLED=false なら止まる（プレビューでも）'],
  ];
  for (const [env, label] of prodCases) {
    app = await startApp(env);
    const st = await status('?owner=alice');
    const p = await api('bob', { action: 'translate', target: 'en', items: [pf('dream')] });
    check(label, st.enabled === false && p.status === 503 && st.ownerAllows === undefined);
    await stopApp(app);
  }

  // ============================================================
  if (process.argv.includes('--ui')) {
    section('E. 画面（Playwright・390px / 1366px）');
    app = await startApp();
    await api('alice', { action: 'set_consent', allow: true });
    const { runUi } = await import('./ui.mjs');
    await runUi({ BASE, check, sessionFor: (await import('./mock-supabase.mjs')).sessionFor, IDS, ANSWER_IDS, require: createRequire(import.meta.url) });
    await stopApp(app);
  }
} finally {
  await mock.close();
}
console.log(results.join('\n'));
console.log(`\n${failed ? `❌ ${failed} 件が失敗` : '✅ すべて合格'}（${results.filter((l) => l.includes('✅') || l.includes('❌')).length} 項目）`);
process.exit(failed ? 1 : 0);
