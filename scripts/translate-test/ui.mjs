// 画面のテスト（run.mjs --ui から呼ぶ）。390px と 1366px で、
//  ・他人のプロフ帳：「翻訳を見る」→ 訳文、「原文を見る」→ 原文。名前・フォロワー限定の項目は原文のまま
//  ・回答の詳細：「翻訳を見る」
//  ・表示言語が日本語なら（日本語の文に）ボタンを出さない
//  ・マイページ：翻訳の許可の切り替え
export async function runUi({ BASE, check, sessionFor, IDS, require }) {
  let pw;
  try { pw = require('playwright'); } catch { pw = require(process.env.PW || '/opt/node-tools/node_modules/playwright'); }
  const browser = await pw.chromium.launch();
  const shots = process.env.TRANSLATE_TEST_SHOTS;
  const ctxFor = async (user, lang, viewport) => {
    const ctx = await browser.newContext({ viewport, isMobile: viewport.width < 800, hasTouch: viewport.width < 800 });
    await ctx.addCookies([{ name: 'miri_auth', value: '1', url: BASE }]);
    await ctx.addInitScript(([s, l, u]) => {
      localStorage.setItem('sb-localhost-auth-token', JSON.stringify(s));
      localStorage.setItem('miri_onboarded', '1');
      localStorage.setItem('miri_lang', l);
      localStorage.setItem('miri_username', u);
    }, [sessionFor(IDS[user]), lang, user]);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const external = new Set();
    ctx.on('request', (r) => { const h = new URL(r.url()).hostname; if (h !== 'localhost' && !/^fonts\.(googleapis|gstatic)\.com$/.test(h)) external.add(h); });
    return { ctx, page, errors, external };
  };
  const closeOverlays = async (page) => {
    for (let i = 0; i < 3; i++) {
      const ov = page.locator('div.fixed.inset-0[role="button"]');
      if (await ov.count()) { await ov.first().click({ position: { x: 8, y: 8 } }).catch(() => {}); await page.waitForTimeout(300); }
    }
  };
  const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

  for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 900 }]) {
    const W = viewport.width;
    // ── 英語の閲覧者（bob。alice をフォローしている）──
    const { ctx, page, errors, external } = await ctxFor('bob', 'en', viewport);
    await page.goto(`${BASE}/bob`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await closeOverlays(page);
    await page.getByText('ありす先生').first().click({ timeout: 15000 });
    const btn = page.getByRole('button', { name: /Show translation/ }).first();
    await btn.waitFor({ timeout: 15000 }).catch(() => {});
    check(`[${W}] 他人のプロフ帳に「Show translation」が出る`, await btn.isVisible().catch(() => false));
    check(`[${W}] 押す前は原文`, await page.getByText('パン屋さん in Paris').first().isVisible().catch(() => false));
    await btn.click().catch(() => {});
    await page.getByText('A bakery in Paris').first().waitFor({ timeout: 15000 }).catch(() => {});
    const body1 = await page.locator('body').innerText();
    check(`[${W}] 押すと訳文に切りかわる`, body1.includes('A bakery in Paris') && !body1.includes('パン屋さん in Paris'));
    check(`[${W}] 仮の翻訳である注記が出る`, body1.includes('Test translation'));
    check(`[${W}] ニックネームは訳さない`, body1.includes('ありす'));
    check(`[${W}] フォロワー限定の項目（motto）は原文のまま`, body1.includes('なんとかなる') && !body1.includes('[mock:en] なんとかなる'));
    check(`[${W}] Juice=Juice は原文のまま／鬼滅の刃は Demon Slayer`, body1.includes('Juice=Juice') && body1.includes('Demon Slayer'));
    if (shots) await page.screenshot({ path: `${shots}/profile_${W}_translated.png`, fullPage: true });
    await page.getByRole('button', { name: /See original/ }).first().click().catch(() => {});
    await page.waitForTimeout(500);
    const body2 = await page.locator('body').innerText();
    check(`[${W}] 「See original」で原文に戻る`, body2.includes('パン屋さん in Paris') && !body2.includes('A bakery in Paris'));
    check(`[${W}] 横はみ出しなし`, (await overflow(page)) <= 0);

    // 回答の詳細
    await page.getByText('揚げパンがいちばん好きだった').first().click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const dbtn = page.getByRole('button', { name: /Show translation/ }).first();
    await dbtn.waitFor({ timeout: 10000 }).catch(() => {});
    await dbtn.click().catch(() => {});
    await page.getByText('[mock:en] 揚げパンがいちばん好きだった').first().waitFor({ timeout: 10000 }).catch(() => {});
    check(`[${W}] 回答の詳細で「Show translation」→ 訳文`, await page.getByText('[mock:en] 揚げパンがいちばん好きだった').first().isVisible().catch(() => false));
    if (shots) await page.screenshot({ path: `${shots}/answer_${W}_translated.png`, fullPage: false });
    check(`[${W}] 回答の詳細も横はみ出しなし`, (await overflow(page)) <= 0);
    check(`[${W}] 外部への通信なし（Google Fonts 以外。翻訳サービスへの送信なし）`, external.size === 0, [...external].join(','));
    check(`[${W}] ページエラーなし`, errors.length === 0, errors.join(' | '));
    await ctx.close();

    // ── 日本語の閲覧者：日本語の文にはボタンを出さない ──
    const ja = await ctxFor('carol', 'ja', viewport);
    await ja.page.goto(`${BASE}/carol`, { waitUntil: 'networkidle' });
    await ja.page.waitForTimeout(1500);
    await closeOverlays(ja.page);
    await ja.page.getByText('ありす先生').first().click({ timeout: 15000 }).catch(() => {});
    await ja.page.getByText('パン屋さん in Paris').first().waitFor({ timeout: 15000 }).catch(() => {});
    await ja.page.waitForTimeout(1000);
    check(`[${W}] 日本語で見ているときは日本語の文に翻訳ボタンを出さない`, (await ja.page.locator('[data-translate-bar]').count()) === 0);
    await ja.ctx.close();

    // ── 書いた本人（alice）：マイページの許可の切り替え ──
    const me = await ctxFor('alice', 'en', viewport);
    await me.page.goto(`${BASE}/alice`, { waitUntil: 'networkidle' });
    await me.page.waitForTimeout(1500);
    await closeOverlays(me.page);
    await me.page.getByRole('button', { name: /^(Profile|My Page)$/ }).first().click().catch(() => {});
    const card = me.page.locator('[data-translation-consent]');
    await card.waitFor({ timeout: 10000 }).catch(() => {});
    check(`[${W}] マイページに翻訳の許可の切り替えが出る`, await card.isVisible().catch(() => false));
    const sw = card.getByRole('switch');
    const before = await sw.isChecked().catch(() => null);
    await sw.click().catch(() => {});
    await me.page.waitForTimeout(800);
    const after = await sw.isChecked().catch(() => null);
    check(`[${W}] 切り替えると保存される`, before === true && after === false && (await card.innerText()).includes('saved'), `${before}→${after}`);
    await sw.click().catch(() => {});
    await me.page.waitForTimeout(800);
    if (shots) await card.screenshot({ path: `${shots}/consent_${W}.png` }).catch(() => {});
    check(`[${W}] マイページも横はみ出しなし・ページエラーなし`, (await overflow(me.page)) <= 0 && me.errors.length === 0, me.errors.join(' | '));
    await me.ctx.close();
  }
  await browser.close();
}
