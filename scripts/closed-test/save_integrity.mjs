// ============================================================
// プロフ帳の保存のテスト（データ消失の修正の確認）
//
// 仮の Supabase は、本物と同じ「条件付きの更新」（book->>__rev が読んだときと同じ行だけを書きかえる）を行う。
// 使い方：NEXT_PUBLIC_APP_ENV=production NEXT_PUBLIC_SUPABASE_URL=http://mock.supabase.test NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-test-key
//         で build → next start -p 3401 → PW=<playwright の index.js> node scripts/closed-test/save_integrity.mjs
// ============================================================
const _pw = await import(process.env.PW); const { chromium } = _pw.chromium ? _pw : _pw.default;
const BASE = 'http://localhost:3401';
const SB = 'http://mock.supabase.test';
const ME = '11111111-1111-4111-8111-111111111111';
const now = new Date().toISOString();
const meRow = { id: ME, username: 'me_user', display_name: 'わたし', avatar_url: null, is_official: false, titles: ['pioneer'], updated_at: now };
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 86400;
const jwt = `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub: ME, role: 'authenticated', exp, aud: 'authenticated' })}.sig`;
const session = { access_token: jwt, token_type: 'bearer', expires_in: 86400, expires_at: exp, refresh_token: 'r', user: { id: ME, aud: 'authenticated', role: 'authenticated', email: 'me@example.com', app_metadata: {}, user_metadata: {}, created_at: now } };

const FULL = {
  nickname: 'もとのにっくねーむ', dream: 'パン屋さん', motto: 'なんとかなる', hometown: '大阪',
  __questions: [{ q: '好きな季節は？', a: '夏' }], __best3: { drink: ['ラムネ', 'ミルクティー', ''] },
  __visibility: { motto: 'followers' }, __choices: { time: 'a' }, __purchases: ['pi_x'],
  // ボーナス（デイリーログイン・初期設定・項目の入力）は受け取り済みにしておく（コインの増減をテストの対象にしないため）
  __game: { coins: 120, gacha: ['s1', 's2'], themes: ['retro'], setupBonus: '1', dailyLogin: new Date().toDateString(), loginStreak: 1,
            earnedFields: ['book.nickname', 'book.dream', 'book.motto', 'book.hometown'] }, __rev: 'rev-0',
};
const S = { book: null, writes: [], patches: 0, hold: false, held: [], fail: false, raceOnce: null };
const results = []; let failed = 0;
const check = (label, ok, detail = '') => { results.push(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const browser = await chromium.launch();

async function newPage(viewport = { width: 1366, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addCookies([{ name: 'miri_auth', value: '1', url: BASE }]);
  await ctx.addInitScript((s) => {
    if (!sessionStorage.getItem('__init')) {
      sessionStorage.setItem('__init', '1');
      localStorage.setItem('sb-mock-auth-token', JSON.stringify(s));
      localStorage.setItem('miri_onboarded', '1');
      localStorage.setItem('miri_username', 'me_user');
      localStorage.setItem('miri_lang', 'ja');
    }
  }, session);
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, body: '' }));
  await ctx.route(`${SB}/**`, async (route) => {
    const req = route.request(); const url = new URL(req.url()); const p = url.pathname; const q = decodeURIComponent(url.search); const m = req.method();
    const obj = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    const json = (st, b) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: b === undefined ? '' : JSON.stringify(b) });
    if (p.startsWith('/auth/v1/user')) return json(200, session.user);
    if (p.startsWith('/auth/v1/')) return json(200, {});
    if (p === '/rest/v1/profiles') return obj ? json(200, meRow) : json(200, [meRow]);
    if (p === '/rest/v1/profile_book') {
      if (m === 'GET') {
        if (S.fail) return json(500, { message: 'down' });
        if (S.hold) await new Promise((ok) => S.held.push(ok));
        const row = S.book ? { book: structuredClone(S.book) } : null;
        return obj ? (row ? json(200, row) : json(406, { code: 'PGRST116' })) : json(200, row ? [row] : []);
      }
      if (m === 'PATCH') {
        S.patches++;
        if (S.raceOnce) { const f = S.raceOnce; S.raceOnce = null; f(S.book); }    // 読んだあと・書く前に、ほかの端末が書いた
        const body = JSON.parse(req.postData() || '{}');
        const mm = q.match(/book->>__rev=(?:eq\.([^&]+)|is\.null)/);
        if (!mm) return json(400, { message: 'no rev condition' });               // 条件なしの上書きは受け付けない（テストで検出する）
        const want = mm[1] ?? null; const have = S.book?.__rev ?? null;
        if (want !== have) return json(200, []);                                   // 条件に合わない＝0 件
        S.book = body.book; S.writes.push(structuredClone(body.book));
        return json(200, [{ id: ME }]);
      }
      if (m === 'POST') return json(409, { code: '23505', message: 'duplicate' });
    }
    if (m === 'GET' || m === 'HEAD') return obj ? json(406, { code: 'PGRST116' }) : json(200, []);
    return json(201, undefined);
  });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  return { ctx, page, errs };
}
async function open(page) { await page.goto(`${BASE}/me_user`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500); }
async function openEditor(page) {
  await page.locator('aside').first().getByRole('button', { name: /マイページ/ }).first().click();
  await page.waitForTimeout(800);
  const toProf = page.getByText(/プロフ帳を見る|プロフィール帳を見る|わたしのプロフ帳/).first(); if (await toProf.count()) { await toProf.click(); await page.waitForTimeout(1000); }
  await page.getByRole('button', { name: /編集する/ }).first().click(); await page.waitForTimeout(1200);
}
const nickname = (page) => page.locator('#pe-basic input').nth(2);
async function inputWithValue(page, scope, value) {
  const inputs = page.locator(`${scope} input`);
  for (let i = 0; i < await inputs.count(); i++) if ((await inputs.nth(i).inputValue().catch(() => '')) === value) return inputs.nth(i);
  return null;
}
const save = async (page) => { await page.getByRole('navigation', { name: '編集する項目' }).getByRole('button', { name: '✓ 保存' }).click(); };
const kept = (keys) => keys.filter((k) => JSON.stringify(S.book?.[k]) !== JSON.stringify(FULL[k]));
const reset = () => { S.book = structuredClone(FULL); S.writes = []; S.patches = 0; S.hold = false; S.held = []; S.fail = false; S.raceOnce = null; };
const OTHERS = ['dream', 'motto', 'hometown', '__questions', '__best3', '__visibility', '__choices', '__purchases'];

// 1. 再現テスト：最初の読みこみの前に編集して保存
reset(); S.hold = true;
{
  const { ctx, page, errs } = await newPage();
  await open(page); await openEditor(page);
  await nickname(page).fill('あたらしいにっくねーむ');
  await save(page); await page.waitForTimeout(2500);
  check('1-a 読みこみが終わるまで、サーバーへ書かない', S.writes.length === 0 && S.patches === 0, `書きこみ ${S.writes.length} 回`);
  S.hold = false; S.held.splice(0).forEach((ok) => ok());
  await page.waitForTimeout(5000);
  check('1-b 読みこみのあと、ニックネームだけが保存される', S.book.nickname === 'あたらしいにっくねーむ', S.book.nickname);
  check('1-c ほかの項目（夢・座右の銘・出身地・ひとこと質問・BEST3・公開範囲・しんだん・購入記録）は消えない', kept(OTHERS).length === 0, kept(OTHERS).join(', ') || 'なし');
  check('1-d コイン（120）とガチャの所持品は変わらない', S.book.__game?.coins === 120 && JSON.stringify(S.book.__game?.gacha) === JSON.stringify(['s1', 's2']), JSON.stringify(S.book.__game));
  check('1-e 書きこみはすべて「読んだときの印」を条件にしている（条件なしの上書きはない）', S.writes.every((w) => typeof w.__rev === 'string' && w.__rev !== 'rev-0'));
  check('1-f ページエラーなし', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

// 2. ふつうの編集 → 保存 → 再読み込み
reset();
{
  const { ctx, page } = await newPage();
  await open(page); await openEditor(page);
  const dream = await inputWithValue(page, '#pe-about', 'パン屋さん');
  await dream?.fill('宇宙飛行士');
  await save(page); await page.waitForTimeout(3000);
  check('2-a 編集した夢が保存される', S.book.dream === '宇宙飛行士', S.book.dream);
  check('2-b ほかの項目・コインは変わらない', kept(OTHERS.filter((k) => k !== 'dream')).length === 0 && S.book.__game?.coins === 120);
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000);
  await openEditor(page);
  check('2-c 再読み込みしても、保存した夢が出る', !!(await inputWithValue(page, '#pe-about', '宇宙飛行士')));
  await ctx.close();
}

// 3. 別の端末が別の項目を変えたあとに保存
reset();
{
  const { ctx, page } = await newPage();
  await open(page); await openEditor(page);
  S.book = { ...S.book, hometown: '東京', __best3: { drink: ['コーラ', '', ''] }, __rev: 'rev-other' };   // 別の端末の保存
  await nickname(page).fill('こっちのにっくねーむ');
  await save(page); await page.waitForTimeout(3000);
  check('3 別の端末の変更（出身地・BEST3）を消さずに、この端末の変更（ニックネーム）を保存', S.book.nickname === 'こっちのにっくねーむ' && S.book.hometown === '東京' && S.book.__best3.drink[0] === 'コーラ', JSON.stringify({ n: S.book.nickname, h: S.book.hometown, b: S.book.__best3 }));
  await ctx.close();
}

// 4. 同じ項目を別の端末も変えていた
reset();
{
  const { ctx, page } = await newPage();
  await open(page); await openEditor(page);
  S.book = { ...S.book, nickname: 'よその端末', __rev: 'rev-other' };
  await nickname(page).fill('この端末');
  await save(page); await page.waitForTimeout(1500);
  const toast = await page.getByText('ほかの端末での変更も取りこんで保存しました').count();
  check('4 同じ項目は、あとから保存したこの端末の内容になり、「取りこんで保存しました」と知らせる', S.book.nickname === 'この端末' && toast > 0, `${S.book.nickname} / 知らせ ${toast}`);
  await ctx.close();
}

// 5. 読んでから書くまでの間に、別の端末が書いた（データベースの条件で 0 件 → 読み直してやり直す）
reset();
{
  const { ctx, page } = await newPage();
  await open(page); await openEditor(page);
  S.raceOnce = (b) => { S.book = { ...b, motto: '一期一会', __rev: 'rev-race' }; };
  await nickname(page).fill('きょうそう');
  await save(page); await page.waitForTimeout(3500);
  check('5 書きこみがぶつかったら読み直してやり直し、両方の変更が残る', S.book.nickname === 'きょうそう' && S.book.motto === '一期一会' && S.patches >= 2, `PATCH ${S.patches} 回`);
  await ctx.close();
}

// 6. 最初の読みこみに失敗 → 保存しない・知らせる
reset(); S.fail = true;
{
  const { ctx, page } = await newPage();
  await open(page); await page.waitForTimeout(3500);
  await openEditor(page);
  await nickname(page).fill('しっぱい');
  await save(page); await page.waitForTimeout(2500);
  const toast = await page.getByText(/保存できませんでした|読みこめなかった/).count();
  check('6 読みこみに失敗した画面では保存しない（サーバーは元のまま）・失敗を知らせる', S.patches === 0 && S.book.nickname === FULL.nickname && toast > 0, `PATCH ${S.patches} / 知らせ ${toast}`);
  await ctx.close();
}

// 7. 編集画面を開いたあとに読みこみが届く（まだ触っていない項目は新しい内容になり、古い値で消さない）
reset(); S.hold = true;
{
  const { ctx, page } = await newPage();
  await open(page); await openEditor(page);
  S.hold = false; S.held.splice(0).forEach((ok) => ok());
  await page.waitForTimeout(3000);
  check('7-a 開いたあとに届いた内容が、触っていない項目に出る（出身地＝大阪）', !!(await inputWithValue(page, '#pe-basic', '大阪')));
  await nickname(page).fill('あとからへんしゅう');
  await save(page); await page.waitForTimeout(3000);
  check('7-b 保存しても、ほかの項目・コインは消えない', S.book.nickname === 'あとからへんしゅう' && kept(OTHERS).length === 0 && S.book.__game?.coins === 120, kept(OTHERS).join(', ') || 'なし');
  await ctx.close();
}

// 8. 公開範囲の変更
reset();
{
  const { ctx, page } = await newPage();
  await open(page); await openEditor(page);
  // 出身地は基本情報の最後の項目なので、基本情報の最後の公開範囲チップが出身地のもの
  await page.locator('#pe-basic button[aria-label]').last().click({ timeout: 5000 }).catch(() => {});
  await save(page); await page.waitForTimeout(3000);
  check('8 公開範囲の変更（出身地）が保存され、ほかの公開範囲（座右の銘＝フォロワー限定）は残る', S.book.__visibility?.hometown && S.book.__visibility.hometown !== 'public' && S.book.__visibility.motto === 'followers', JSON.stringify(S.book.__visibility));
  check('8-b ほかの項目・コインは変わらない', kept(OTHERS.filter((k) => k !== '__visibility')).length === 0 && S.book.__game?.coins === 120);
  await ctx.close();
}

// 9. 何も変えずに保存
reset();
{
  const { ctx, page } = await newPage();
  await open(page); await openEditor(page);
  const before = S.writes.length;
  await save(page); await page.waitForTimeout(2500);
  check('9 何も変えずに保存しても、プロフ帳は書きかえない', S.writes.filter((w) => w.nickname !== undefined).length === before && kept(OTHERS).length === 0, `書きこみ ${S.writes.length - before} 回`);
  await ctx.close();
}

await browser.close();
console.log(results.join('\n'));
console.log(`\n${failed ? `❌ ${failed} 件が失敗` : '✅ すべて合格'}（${results.length} 項目）`);
process.exit(failed ? 1 : 0);
