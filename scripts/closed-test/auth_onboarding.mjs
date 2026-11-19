// ============================================================
// ログイン・ログアウト・利用者の切りかえ・はじめての案内のテスト
// 仮の Supabase は、複数のアカウントのログインと、アカウントごとのプロフ帳（条件付きの更新つき）を持つ。
// 使い方：NEXT_PUBLIC_APP_ENV=production NEXT_PUBLIC_SUPABASE_URL=http://mock.supabase.test NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-test-key
//         で build → next start -p 3401 → PW=<playwright の index.js> node scripts/closed-test/auth_onboarding.mjs
// ============================================================
const _pw = await import(process.env.PW); const { chromium } = _pw.chromium ? _pw : _pw.default;
const BASE = 'http://localhost:3401';
const SB = 'http://mock.supabase.test';
const NEW = new Date().toISOString();
const OLD = '2026-07-01T00:00:00Z';
const U = {
  a: { id: 'aaaaaaaa-1111-4111-8111-111111111111', email: 'a@example.com', username: 'user_a', created_at: NEW },
  b: { id: 'bbbbbbbb-1111-4111-8111-111111111111', email: 'b@example.com', username: 'user_b', created_at: NEW },
  c: { id: 'cccccccc-1111-4111-8111-111111111111', email: 'c@example.com', username: 'user_c', created_at: NEW },
  old: { id: 'dddddddd-1111-4111-8111-111111111111', email: 'old@example.com', username: 'user_old', created_at: OLD },
};
const byEmail = (e) => Object.values(U).find((u) => u.email === e);
const byId = (id) => Object.values(U).find((u) => u.id === id);
const BOOKS = {};   // id → book
for (const u of Object.values(U)) BOOKS[u.id] = { nickname: `${u.username} のにっくねーむ`, __game: { coins: 10, setupBonus: '1', dailyLogin: new Date().toDateString(), loginStreak: 1 }, __rev: 'r0' };
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 86400;
const userObj = (u) => ({ id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, app_metadata: {}, user_metadata: {}, created_at: u.created_at });
const tokenFor = (u) => `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub: u.id, role: 'authenticated', exp, aud: 'authenticated' })}.sig`;
const sessionFor = (u) => ({ access_token: tokenFor(u), token_type: 'bearer', expires_in: 86400, expires_at: exp, refresh_token: 'r-' + u.id, user: userObj(u) });
const subOf = (auth) => { try { return JSON.parse(Buffer.from((auth || '').replace('Bearer ', '').split('.')[1], 'base64url').toString()).sub; } catch { return null; } };

const results = []; let failed = 0;
const check = (label, ok, detail = '') => { results.push(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const browser = await chromium.launch();

async function newCtx() {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  // 「Miriへようこそ」が一瞬でも出たかを記録する（ちらつきの確認）
  await ctx.addInitScript(() => {
    const seen = () => { if (document.body && /Miriへようこそ/.test(document.body.textContent || '')) sessionStorage.setItem('__sawIntro', '1'); };
    new MutationObserver(seen).observe(document, { subtree: true, childList: true, characterData: true });
  });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, body: '' }));
  await ctx.route(`${SB}/**`, async (route) => {
    const req = route.request(); const url = new URL(req.url()); const p = url.pathname; const q = decodeURIComponent(url.search); const m = req.method();
    const obj = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    const json = (st, b) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: b === undefined ? '' : JSON.stringify(b) });
    const me = byId(subOf(req.headers()['authorization']));
    if (p === '/auth/v1/token') {
      const body = JSON.parse(req.postData() || '{}');
      const u = body.email ? byEmail(body.email) : null;
      return u ? json(200, sessionFor(u)) : json(400, { error: 'invalid_grant' });
    }
    if (p === '/auth/v1/logout') return json(204);
    if (p.startsWith('/auth/v1/user')) return me ? json(200, userObj(me)) : json(401, { message: 'no' });
    if (p.startsWith('/auth/v1/')) return json(200, {});
    if (p === '/rest/v1/profiles') {
      const idm = q.match(/id=eq\.([0-9a-f-]+)/); const um = q.match(/username=eq\.([^&]+)/);
      const u = idm ? byId(idm[1]) : um ? Object.values(U).find((x) => x.username === um[1]) : null;
      const row = u ? { id: u.id, username: u.username, display_name: u.username, avatar_url: null, is_official: false, titles: [], updated_at: NEW } : null;
      if (m !== 'GET') return json(200, row ? [row] : []);
      return obj ? (row ? json(200, row) : json(406, { code: 'PGRST116' })) : json(200, row ? [row] : []);
    }
    if (p === '/rest/v1/profile_book') {
      const idm = q.match(/id=eq\.([0-9a-f-]+)/); const id = idm?.[1];
      if (m === 'GET') { const row = id && BOOKS[id] ? { book: structuredClone(BOOKS[id]) } : null; return obj ? (row ? json(200, row) : json(406, { code: 'PGRST116' })) : json(200, row ? [row] : []); }
      if (m === 'PATCH') {
        if (!me || id !== me.id) return json(200, []);                                       // 本人の行だけ（RLS）
        const mm = q.match(/book->>__rev=(?:eq\.([^&]+)|is\.null)/); if (!mm) return json(400, {});
        if ((mm[1] ?? null) !== (BOOKS[id].__rev ?? null)) return json(200, []);
        BOOKS[id] = JSON.parse(req.postData() || '{}').book; return json(200, [{ id }]);
      }
    }
    if (m === 'GET' || m === 'HEAD') return obj ? json(406, { code: 'PGRST116' }) : json(200, []);
    return json(201, undefined);
  });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  return { ctx, page, errs };
}
async function login(page, u) {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(800);
  await page.evaluate(() => sessionStorage.removeItem('__sawIntro'));
  const tab = page.getByRole('button', { name: /^ログイン$/ }); if (await tab.count() > 1) await tab.first().click();
  await page.getByPlaceholder('メールアドレス').fill(u.email);
  await page.getByPlaceholder(/パスワード/).fill('secret123');
  await page.locator('button[type="submit"]').click();
  await page.waitForFunction(() => /^\/user_/.test(location.pathname) || !!document.querySelector('[data-welcome="intro"]'), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
}
async function loginViaLoginPage(page, u) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(800);
  const tab = page.getByRole('button', { name: /^ログイン$/ }); if (await tab.count() > 1) await tab.first().click();
  await page.getByPlaceholder(/メール/).first().fill(u.email);
  await page.getByPlaceholder(/パスワード/).first().fill('secret123');
  await page.locator('button[type="submit"]').click();
  await page.waitForFunction(() => /^\/user_/.test(location.pathname) || !!document.querySelector('[data-welcome="intro"]'), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
}
const intro = (page) => page.locator('[data-welcome="intro"]').count();
const sawIntro = (page) => page.evaluate(() => sessionStorage.getItem('__sawIntro') === '1');
const keys = (page) => page.evaluate(() => Object.keys(localStorage));
async function logout(page) {
  await page.locator('aside').first().getByRole('button', { name: /マイページ|My Page|Profile/ }).first().click(); await page.waitForTimeout(1000);
  await page.getByRole('button', { name: /ログアウト|Log out/ }).first().click(); await page.waitForTimeout(2000);
}

// 1. 新しいアカウント A：案内が 1 回出る → スキップで記録
{
  const { ctx, page, errs } = await newCtx();
  await login(page, U.a);
  check('1-a 新しいアカウントは、ログイン後に案内が出る', (await intro(page)) === 1);
  await page.locator('[data-welcome-skip]').click(); await page.waitForTimeout(2500);
  check('1-b スキップでアプリへ進み、アカウントに完了が記録される', /^\/user_a/.test(new URL(page.url()).pathname) && !!BOOKS[U.a.id].__game?.onboardedAt, BOOKS[U.a.id].__game?.onboardedAt ?? 'なし');
  // A の端末データを作る（表示言語・ブックマーク・写真の写し）
  await page.evaluate(() => { localStorage.setItem('miri_lang', 'en'); localStorage.setItem('miri_bookmarks', '["a-bookmark"]'); localStorage.setItem('avatarUrl', 'data:image/a'); });
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500);

  // 2. ログアウト → 端末に A のデータが残らない（表示言語は残す）
  await logout(page);
  const k = await keys(page);
  check('2-a ログアウトすると、A の端末データ（ブックマーク・写真・ユーザー名・ログインの鍵）が残らない', !k.some((x) => ['miri_bookmarks', 'avatarUrl', 'miri_username', 'miri_last_uid'].includes(x) || x.startsWith('sb-')), k.join(','));
  check('2-b 表示言語は残る', (await page.evaluate(() => localStorage.getItem('miri_lang'))) === 'en');

  // 3. 同じ A でもう一度ログイン → 案内は出ない・一瞬も出ない
  await login(page, U.a);
  check('3 同じ人がログインし直しても、案内は出ない（一瞬も表示しない）', (await intro(page)) === 0 && !(await sawIntro(page)) && /^\/user_a/.test(new URL(page.url()).pathname), new URL(page.url()).pathname);
  check('3-b 表示言語を保つ', (await page.evaluate(() => localStorage.getItem('miri_lang'))) === 'en');

  // 4. A の端末データがある状態で、ログアウトせずに B がログイン（/login から）
  await page.evaluate(() => { localStorage.setItem('miri_bookmarks', '["a-bookmark"]'); localStorage.setItem('avatarUrl', 'data:image/a'); localStorage.setItem('miri_book_dirty', '["nickname"]'); localStorage.setItem('profileBookInfo', '{"nickname":"A の写し"}'); });
  await loginViaLoginPage(page, U.b);
  const vals = await page.evaluate(() => ({ bm: localStorage.getItem('miri_bookmarks'), av: localStorage.getItem('avatarUrl'), dirty: localStorage.getItem('miri_book_dirty'), info: localStorage.getItem('profileBookInfo'), last: localStorage.getItem('miri_last_uid') }));
  check('4-a 別の人（B）がログインすると、A の端末データ（ブックマーク・写真・未送信の編集）が消える', vals.bm === null && vals.av === null && vals.dirty === null && !(vals.info ?? '').includes('A の写し'), JSON.stringify(vals));
  check('4-b 端末の持ち主が B に替わる', vals.last === U.b.id);
  check('4-c B のプロフ帳に、A の未送信の編集は書かれない', BOOKS[U.b.id].nickname === 'user_b のにっくねーむ', BOOKS[U.b.id].nickname);
  check('4-d ページエラーなし', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

// 5. 別のブラウザ（空の端末）で A → 案内は出ない（アカウントの記録）
{
  const { ctx, page } = await newCtx();
  await login(page, U.a);
  check('5 別の端末でログインしても、案内は出ない（アカウントに記録があるため）', (await intro(page)) === 0 && !(await sawIntro(page)));
  // 6. マイページから案内を見直す（記録は変えない）
  const before = BOOKS[U.a.id].__game.onboardedAt;
  await page.locator('aside').first().getByRole('button', { name: /マイページ|My Page|Profile/ }).first().click(); await page.waitForTimeout(1000);
  await page.locator('[data-replay-intro]').click(); await page.waitForTimeout(2000);
  check('6-a マイページの「使い方をもう一度見る」で案内が出る', (await intro(page)) === 1);
  await page.locator('[data-welcome-skip]').click(); await page.waitForTimeout(2000);
  check('6-b 見直しのあとはアプリに戻り、記録は変わらない', /^\/user_a/.test(new URL(page.url()).pathname) && BOOKS[U.a.id].__game.onboardedAt === before);
  await ctx.close();
}

// 7. 既存のアカウント（作成日が古い・記録なし）→ 案内は出ない
{
  const { ctx, page } = await newCtx();
  await login(page, U.old);
  check('7 既存のアカウント（この仕組みより前に作成）には、記録がなくても案内を出さない', (await intro(page)) === 0 && !(await sawIntro(page)) && /^\/user_old/.test(new URL(page.url()).pathname));
  await ctx.close();
}

// 8. 新しいアカウント C：最後まで見る → 記録
{
  const { ctx, page } = await newCtx();
  await login(page, U.c);
  for (let i = 0; i < 3; i++) { await page.locator('[data-welcome-next]').click(); await page.waitForTimeout(400); }
  await page.waitForTimeout(2000);
  check('8 最後まで見ても完了が記録され、アプリへ進む', !!BOOKS[U.c.id].__game?.onboardedAt && /^\/user_c/.test(new URL(page.url()).pathname));
  // 9. 記録のあと、ゲームのデータの保存（コインなど）でも記録は消えない
  await page.waitForTimeout(3000);
  check('9 その後のゲームのデータの保存でも、完了の記録は消えない', !!BOOKS[U.c.id].__game?.onboardedAt, JSON.stringify(BOOKS[U.c.id].__game));
  await ctx.close();
}

await browser.close();
console.log(results.join('\n'));
console.log(`\n${failed ? `❌ ${failed} 件が失敗` : '✅ すべて合格'}（${results.length} 項目）`);
process.exit(failed ? 1 : 0);
