// 画面のテスト（run.mjs --ui から呼ぶ）。390px と 1366px で、
//  ・他人のプロフ帳：「翻訳を見る」→ 訳文、「原文を見る」→ 原文。名前・フォロワー限定の項目は原文のまま
//  ・回答の詳細：「翻訳を見る」
//  ・表示言語が日本語なら（日本語の文に）ボタンを出さない
//  ・マイページ：翻訳の許可（取り消し → 説明・項目・年齢・同意のチェック → 許可）と、退会・データ削除の申請
export async function runUi({ BASE, SB, check, sessionFor, IDS, require, regrant, records, setBook, book }) {
  // 特技に電話番号（架空）を入れておく：閲覧者には「一部は翻訳していません」、本人の同意画面には理由が出るはず
  await setBook('alice', { ...book, specialty: '指パッチン 電話は 090-1234-5678' });
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
    check(`[${W}] 連絡先を含む文は翻訳せず、「一部は翻訳していません」と知らせる（分類は出さない）`,
      body1.includes('090-1234-5678') && (await page.locator('[data-translate-privacy]').count()) > 0 && !/phone|health|電話/i.test(await page.locator('[data-translate-privacy]').first().innerText().catch(() => '')));
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

    // ── 書いた本人（alice）：マイページの許可（直接オンにはできない。説明・項目・年齢・同意のチェック）──
    const me = await ctxFor('alice', 'en', viewport);
    me.page.on('dialog', (d) => d.accept());
    await me.page.goto(`${BASE}/alice`, { waitUntil: 'networkidle' });
    await me.page.waitForTimeout(1500);
    await closeOverlays(me.page);
    await me.page.getByRole('button', { name: /^(Profile|My Page)$/ }).first().click().catch(() => {});
    const card = me.page.locator('[data-translation-consent]');
    await card.waitFor({ timeout: 10000 }).catch(() => {});
    check(`[${W}] マイページに翻訳の許可のカードが出る（許可中）`, (await card.getAttribute('data-state').catch(() => null)) === 'on');
    check(`[${W}] 許可のカードにスイッチはない（直接オンにできない）`, (await card.getByRole('switch').count()) === 0);
    const ev0 = (await records()).consentEvents;
    await card.locator('button').nth(2).click().catch(() => {});      // 取り消す（確認ダイアログは OK）
    await me.page.waitForTimeout(800);
    check(`[${W}] 取り消すと「許可していない」に戻る`, (await card.getAttribute('data-state').catch(() => null)) === 'off');
    await card.locator('button').first().click().catch(() => {});      // 内容を確認して許可する
    const sheet = me.page.locator('[data-consent-sheet]');
    await sheet.waitFor({ timeout: 10000 }).catch(() => {});
    const st = await sheet.innerText().catch(() => '');
    check(`[${W}] 説明に送り先の国名・事業者・米国の制度・取り消し方法が出る`, /United States/.test(st) && /Anthropic/.test(st) && /withdraw|revoke|stop/i.test(st), st.slice(0, 80));
    const submit = sheet.locator('[data-consent-submit]');
    await sheet.locator('[data-item="profile:dream"]').waitFor({ timeout: 10000 }).catch(() => {});
    check(`[${W}] 候補に公開の項目が出て、フォロワー限定の項目は出ない`, (await sheet.locator('[data-item="profile:dream"]').count()) === 1 && (await sheet.locator('[data-item="profile:motto"]').count()) === 0);
    check(`[${W}] 本人には「連絡先を含むため翻訳されません」と理由を出す`, (await sheet.locator('[data-blocked="contact"]').count()) === 1);
    check(`[${W}] 最初は何も選ばれておらず、許可ボタンは押せない`, (await sheet.locator('input[data-item]:checked').count()) === 0 && (await submit.isDisabled()));
    await sheet.locator('[data-item="profile:dream"]').check().catch(() => {});
    const y = new Date().getFullYear();
    await sheet.locator('[data-age-year]').selectOption(String(y - 10)).catch(() => {});
    await sheet.locator('[data-age-month]').selectOption('1').catch(() => {});
    check(`[${W}] 16 歳未満なら注意が出て、許可できない`, (await sheet.getByRole('alert').count()) > 0 && (await submit.isDisabled()));
    await sheet.locator('[data-age-year]').selectOption(String(y - 30)).catch(() => {});
    check(`[${W}] 同意のチェックがなければ許可できない`, await submit.isDisabled());
    await sheet.locator('[data-agree]').check().catch(() => {});
    check(`[${W}] 項目・年齢・同意のチェックがそろうと許可できる`, !(await submit.isDisabled()));
    check(`[${W}] 説明の画面も横はみ出しなし`, (await overflow(me.page)) <= 0);
    if (shots) await me.page.screenshot({ path: `${shots}/consent_sheet_${W}.png` }).catch(() => {});
    await submit.click().catch(() => {});
    await me.page.waitForTimeout(1000);
    check(`[${W}] 許可すると「許可中」になり、同意・取り消しの記録が増える`, (await card.getAttribute('data-state').catch(() => null)) === 'on' && (await records()).consentEvents === ev0 + 2);
    if (shots) await card.screenshot({ path: `${shots}/consent_${W}.png` }).catch(() => {});

    // 退会・データ削除の申請（1 回目の画面幅で申請し、2 回目の画面幅では「受付中」が表示されることを確かめる）
    const del = me.page.locator('[data-account-deletion]');
    await del.waitFor({ timeout: 5000 }).catch(() => {});
    await me.page.waitForTimeout(500);
    if (W === 390) {
      await del.locator('button').first().click().catch(() => {});
      const ddlg = me.page.getByRole('dialog');
      await ddlg.waitFor({ timeout: 5000 }).catch(() => {});
      const dt = await ddlg.innerText().catch(() => '');
      check(`[${W}] 退会の申請画面に、消すもの・法令で残す記録・Anthropic 側の扱いの説明が出る`, dt.length > 100 && /Anthropic/.test(dt), dt.slice(0, 60));
      await me.page.locator('[data-deletion-submit]').click().catch(() => {});
      await me.page.waitForTimeout(1000);
      const writes = await (await fetch(`${SB}/__test/writes`)).json();
      check(`[${W}] 申請は本人のトークンで account_deletion_requests に記録し、「受付中（受付日）」を表示`,
        writes.some((w) => w.p === '/rest/v1/account_deletion_requests') && (await del.getAttribute('data-state')) === 'pending' && /Received on|受付日/.test(await del.innerText()));
    } else {
      check(`[${W}] 開き直しても「受付中」を表示し、二重に申請できない`, (await del.getAttribute('data-state')) === 'pending' && (await me.page.locator('[data-deletion-submit]').count()) === 0);
    }
    check(`[${W}] マイページも横はみ出しなし・ページエラーなし`, (await overflow(me.page)) <= 0 && me.errors.length === 0, me.errors.join(' | '));
    await me.ctx.close();
    await regrant();   // 次の画面幅のテストのために、元の項目で許可し直す
  }
  await browser.close();
  await setBook('alice', book);
}
