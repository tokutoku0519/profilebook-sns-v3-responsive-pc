// 再現テスト：サーバーからの最初の読みこみが終わる前に編集して保存すると、プロフ帳のほかの項目とコインが消えるか（2026-11-14 に再現）
// 使い方：NEXT_PUBLIC_APP_ENV=production NEXT_PUBLIC_SUPABASE_URL=http://mock.supabase.test NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-test-key で build → next start -p 3401 → PW=<playwright の index.js> node scripts/closed-test/repro_save_before_load.mjs <出力先>
const _pw = await import(process.env.PW); const { chromium } = _pw.chromium ? _pw : _pw.default;
const OUT = process.argv[2];
const BASE = 'http://localhost:3401';
const SB = 'http://mock.supabase.test';
const ME = '11111111-1111-4111-8111-111111111111';
const TARGET = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333';
const OPTIONS = ['おっとり系','元気・明るい','クール・落ち着き','ちょっと不思議','真面目','天然','ふわふわ','ツンデレ','好奇心旺盛','マイペース','リーダー気質','聞き上手'];
const now = new Date().toISOString();
const meRow = { id: ME, username: 'me_user', display_name: 'わたし', avatar_url: null, book: {}, is_official: false, titles: ['pioneer'], updated_at: now };
const targetRow = { id: TARGET, username: 'target_user', display_name: 'ターゲット', avatar_url: null, book: { name: 'たーげっと', nickname: 'たげ', birthday: '7月7日', bloodType: 'O型', mbti: 'INFP', hometown: '大阪', favoriteFood: 'たこ焼き', dislikeFood: 'ピーマン', favoriteColor: '水色・白', favoriteCharacter: 'キティ', favoriteSubject: '国語', dislikeSubject: '', motto: 'なんとかなる', dream: 'パン屋さん', specialty: 'けん玉', __best3: { drink: ['ラムネ', '', ''], game: ['テトリス', 'ぷよぷよ', ''] }, __questions: [{ q: '好きな季節は？', a: '夏' }, { q: '朝ごはんは？', a: '' }], __pen: { v: 1, font: 'retro', ink: 'green', size: 'l' } }, is_official: true, titles: ['pioneer', 'founder', 'official'], updated_at: now };
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 86400;
const jwt = `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub: ME, role: 'authenticated', exp, aud: 'authenticated' })}.sig`;
const session = { access_token: jwt, token_type: 'bearer', expires_in: 86400, expires_at: exp, refresh_token: 'r', user: { id: ME, aud: 'authenticated', role: 'authenticated', email: 'me@example.com', app_metadata: {}, user_metadata: {}, created_at: now } };

const FULL = { nickname: 'もとのにっくねーむ', dream: 'パン屋さん', motto: 'なんとかなる', hometown: '大阪', __questions: [{ q: '好きな季節は？', a: '夏' }], __best3: { drink: ['ラムネ', 'ミルクティー', ''] }, __visibility: { motto: 'followers' }, __choices: { time: 'a' }, __purchases: ['pi_x'], __game: { coins: 120 } };
const SERVER = { book: structuredClone(FULL), writes: [] };
let HOLD = true; const held = [];   // 最初の読みこみ（profile_book の GET）を止めておく
const R = []; const log = (k, v) => R.push(`${k}: ${v}`);
const browser = await chromium.launch();

// db: 'missing' | 'final' | 'old'
async function newCtx({ db = 'final', viewport = { width: 390, height: 844 }, mobile = true, lang = 'ja', theme = null, friends = false } = {}) {
  const votes = [{ target_id: TARGET, voter_id: OTHER, category: 'personality', value: '天然' }]; // 他人の既存票1件
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 2 });
  await ctx.addCookies([{ name: 'miri_auth', value: '1', url: BASE }]);
  await ctx.addInitScript(([s, l, t]) => {
    localStorage.setItem('sb-mock-auth-token', JSON.stringify(s));
    localStorage.setItem('miri_onboarded', '1');
    localStorage.setItem('miri_lang', l);
    if (t) localStorage.setItem('appTheme', t);
  }, [session, lang, theme]);
  await ctx.route(`${SB}/**`, async (route) => {
    const req = route.request(); const url = new URL(req.url()); const p = url.pathname; const q = decodeURIComponent(url.search); const m = req.method();
    const obj = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    const json = (s, b, h = {}) => route.fulfill({ status: s, contentType: 'application/json', headers: { 'content-range': '0-0/0', ...h }, body: b === undefined ? '' : JSON.stringify(b) });
    const one = (row) => (row ? json(200, row) : json(406, { code: 'PGRST116', message: 'no rows' }));
    const tableMissing = () => json(404, { code: 'PGRST205', message: "Could not find the table 'public.perception_votes' in the schema cache" });
    if (p.startsWith('/auth/v1/user')) return json(200, session.user);
    if (p.startsWith('/auth/v1/')) return json(200, {});
    if (p === '/rest/v1/rpc/get_visible_book') return json(200, targetRow.book);
    if (p === '/rest/v1/rpc/get_perception_summary') {
      if (db !== 'final') return json(404, { code: 'PGRST202', message: 'Could not find the function public.get_perception_summary' });
      const body = JSON.parse(req.postData() || '{}');
      const agg = {};
      for (const v of votes.filter((x) => x.target_id === body.target)) { agg[v.value] ??= { value: v.value, votes: 0, mine: false }; agg[v.value].votes++; if (v.voter_id === ME) agg[v.value].mine = true; }
      return json(200, Object.values(agg).sort((a, b) => b.votes - a.votes));
    }
    if (p === '/rest/v1/perception_votes') {
      if (db === 'missing') return tableMissing();
      if (m === 'GET') {
        let rows = votes.filter((v) => q.includes(`target_id=eq.${v.target_id}`));
        if (db === 'final') rows = rows.filter((v) => v.voter_id === ME); // RLS：自分の票のみ
        return json(200, rows.map((v) => ({ voter_id: v.voter_id, value: v.value })));
      }
      if (m === 'PATCH') {
        const body = JSON.parse(req.postData() || '{}');
        if (db === 'final' && !OPTIONS.includes(body.value)) return json(400, { code: '23514', message: 'check constraint' });
        const hit = votes.filter((v) => v.voter_id === ME && q.includes(`target_id=eq.${v.target_id}`));
        hit.forEach((v) => Object.assign(v, body)); return json(200, hit.map((v) => ({ target_id: v.target_id })));
      }
      if (m === 'POST') {
        const r = JSON.parse(req.postData() || '{}');
        if (r.voter_id !== ME) return json(403, { code: '42501', message: 'rls' });
        if (votes.some((v) => v.target_id === r.target_id && v.voter_id === r.voter_id)) return json(409, { code: '23505', message: 'dup' });
        votes.push({ category: 'personality', ...r }); return json(201, undefined);
      }
      if (m === 'DELETE') { for (let i = votes.length - 1; i >= 0; i--) if (votes[i].voter_id === ME) votes.splice(i, 1); return json(204, undefined); }
    }
    if (p === '/rest/v1/profiles') {
      if (q.includes(`id=eq.${ME}`)) return obj ? one(meRow) : json(200, [meRow]);
      if (q.includes('username=eq.target_user')) return obj ? one(targetRow) : json(200, [targetRow]);
      if (q.includes('id=in.')) return json(200, [meRow, targetRow]);
      return obj ? one(null) : json(200, []);
    }
    if (p === '/rest/v1/friendships' && m === 'GET') { const row = friends ? { requester_id: ME, addressee_id: TARGET, status: 'accepted' } : null; return obj ? one(row) : json(200, row ? [row] : []); }
    if (p === '/rest/v1/profile_book') {
      if (m === 'PATCH' || m === 'POST') { const b = JSON.parse(req.postData() || '{}'); if (b.book) { SERVER.book = b.book; SERVER.writes.push(b.book); } return json(200, [{ id: ME }]); }
      if (HOLD) { await new Promise((ok) => held.push(ok)); }
      return obj ? one({ book: SERVER.book }) : json(200, [{ book: SERVER.book }]);
    }
    if (p === '/rest/v1/answers' && m === 'GET' && q.includes('neq.private')) {
      return json(200, Array.from({ length: 6 }, (_, i) => ({ id: 'a' + i, user_id: TARGET, question_key: 'd' + (i + 1), question_title: 'お題その' + (i + 1), question_category: '子ども・平成', body: '回答テキスト' + i, sticker: null, visibility: 'public', created_at: now })));
    }
    if (m === 'GET' || m === 'HEAD') return obj ? one(null) : json(200, []);
    return json(201, undefined);
  });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE}/me_user`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000);
  await page.waitForTimeout(2200);
  return { ctx, page, errs, votes };
}
async function openTarget(page) {
  await page.getByText('ターゲット').first().click({ timeout: 10000 });
  await page.waitForTimeout(2200);
  return page.locator('section', { hasText: 'どんな人？' }).first();
}
const leak = async (page) => /PGRST|schema cache|relation |violates|permission denied|TypeError/.test(await page.locator('body').innerText());





for (const [vp, mobile, nm] of [[{ width: 1366, height: 900 }, false, 'pc']]) {
  SERVER.book = structuredClone(FULL); SERVER.writes.length = 0; HOLD = true;
  const { ctx, page, errs } = await newCtx({ db: 'final', viewport: vp, mobile });
  await page.locator('aside').first().getByRole('button', { name: /マイページ/ }).first().click();
  await page.waitForTimeout(1000);
  const toProf = page.getByText(/プロフ帳を見る|プロフィール帳を見る|わたしのプロフ帳/).first(); if (await toProf.count()) { await toProf.click(); await page.waitForTimeout(1200); }
  await page.getByRole('button', { name: /編集する/ }).first().click(); await page.waitForTimeout(1500);
  log('読みこみ中（止めている GET の数）', held.length);
  await page.locator('#pe-basic input').nth(2).fill('あたらしいにっくねーむ');
  const nav = page.getByRole('navigation', { name: '編集する項目' });
  HOLD = false;                                   // 保存のための読みこみは止めない
  await nav.getByRole('button', { name: '✓ 保存' }).click(); await page.waitForTimeout(2500);
  held.splice(0).forEach((ok) => ok());           // 最初の読みこみをあとから返す
  await page.waitForTimeout(2500);
  const last = SERVER.writes.at(-1) ?? {};
  log('保存の回数', SERVER.writes.length);
  log('保存後のサーバーのニックネーム', SERVER.book.nickname);
  const lost = ['dream', 'motto', 'hometown', '__questions', '__best3', '__visibility'].filter((k) => !(k in SERVER.book) || JSON.stringify(SERVER.book[k]) !== JSON.stringify(FULL[k]));
  log('保存後に消えた・変わった項目', lost.join(', ') || 'なし');
  log('コイン', JSON.stringify(SERVER.book.__game?.coins));
  log('ページエラー', errs.join(' / ') || 'なし');
  await ctx.close();
}
await browser.close();
console.log(R.join('\n'));
