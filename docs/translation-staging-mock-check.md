# 検証環境での確認（仮の翻訳・無料）

- 目的：アプリ（このブランチのプレビュー）と検証用 DB（`miri-staging`）を組み合わせて、翻訳の許可・送信の記録・保存・取り消しが、画面から操作したとおりに DB に残るかを確かめる。
- 翻訳は**仮の翻訳**（`[mock:en] …` などを返す）。外部には何も送らず、費用はかからない。
- 記録には送り先として Anthropic の名前が入るが、技術ログの「モデル」が `mock` なので、実 API の記録と区別できる。
- 各ステップのあとに、検証用の SQL Editor で `supabase/staging/translation_status.sql`（読み取りだけ）を実行して、記録を見る。

## 0. 準備

| # | どこで | 操作 |
|---|---|---|
| 1 | Vercel → Settings → Environment Variables → Add Environment Variable | Type **Config**、Key `TRANSLATION_STORE`、Value `db`、Environments **Preview・このブランチだけ** → Save |
| 2 | Vercel → Deployments → このブランチの最新 → ⋯ → Redeploy | ― |
| 3 | Supabase（**左上が miri-staging であることを確認**）→ SQL Editor | 下の「翻訳を有効にする」を実行 |
| 4 | ブラウザ | **ふつうのウィンドウ = alice（日本語）**、**シークレットウィンドウ（または別のブラウザ）= bob（英語）**。表示言語はブラウザごとに保存されるので、2 人を同じウィンドウで切りかえない |
| 5 | bob のウィンドウ | bob でログイン → **設定・プロフ編集** → いちばん上の **ことば / Language** → **English** |

翻訳を有効にする（検証用だけ。印がなければ止まる）：
```sql
do $$ begin
  if to_regclass('public._miri_environment') is null then raise exception '検証用の印がありません'; end if;
  update public.translation_settings set enabled = true, halted_reason = null;
end $$;
```

## 1. 確認の順番

| # | 誰が | 操作 | 画面で期待すること | `translation_status.sql` で期待すること |
|---|---|---|---|---|
| 1 | alice | マイページ → 翻訳の許可のカード → 説明を確認 → 項目を選ぶ（**夢・自己紹介・ひとこと質問・チャームポイント・座右の銘・出身地・公開の回答**。座右の銘と出身地は、選んでも公開範囲で止まることを 5 で確かめるため。選べない表示なら、それも結果として控える）→ 生年月 **1996 年 4 月** → 同意にチェック → 許可 | 「許可しています」の表示 | 2：alice 許可=true。3：選んだ項目。4：grant / 年齢=18_plus（生年月はどこにも出ない） |
| 2 | bob | 左のメニューの **Following**（フォロー中）→ ありす（@test_alice）を開く → プロフィールの上の方の **Show translation**（URL の末尾を変えても相手のページは開かない） | 夢が「A bakery in Paris」、ほかは `[mock:en] …`。「AI による翻訳」の表示。原文に戻せる | 5：completed / 地域=us / 同意#（1 の記録の番号）/ モデル=mock。6：done |
| 3 | bob | ページを再読み込み → もう一度 Show translation | 同じ訳文 | 5：**送信の記録が増えない**。8：翻訳済みの再利用が増える |
| 4 | bob | チャームポイント（架空の電話番号を含む） | その文は原文のまま。「一部は翻訳していません」 | 5：charmPoint の送信の記録が**ない** |
| 5 | bob | 座右の銘（フォロワー限定）・出身地（非公開） | 翻訳の対象にならない（出身地は表示もされない） | 5：motto・hometown の送信の記録が**ない** |
| 6 | alice | 回答の「休みの日は？」（フォロワー限定）・「秘密は？」（非公開） | bob の画面で Show translation の対象にならない | 5：その回答の送信の記録が**ない** |
| 7 | dave | dave でログイン（シークレットウィンドウを使い回すならログアウトしてから）→ マイページ → 翻訳の許可 → 生年月を **15 歳**になる年月 → 許可 | 「16 歳未満のため…」で許可できない。続けて大人の年月を入れても 7 日間は許可できない | 2・3：dave の許可なし。7：dave の制限が 7 日後まで（生年月は出ない） |
| 8 | alice | マイページ → 翻訳の許可を**取り消す** | 「許可していません」 | 2：許可=false。3：alice の項目が**消える**。4：revoke。6：alice の翻訳が**消える**。5：それまでの送信の記録は**残る** |
| 9 | bob | ありすのページを開き直す | Show translation が出ない（または押しても原文のまま） | 5：送信の記録が増えない |
| 10 | 運営 | alice がもう一度許可したあと、SQL Editor で `update public.translation_settings set enabled = false;`（検証用）→ bob が翻訳を頼む | 原文のまま | 1：enabled=f。5：増えない。確認のあと、0 の「翻訳を有効にする」で戻す |

## 2. 結果の共有

- 各ステップの画面の様子（気になったところだけでよい）と、最後の `translation_status.sql` の結果を共有してください。
- 期待と違うところがあれば、その場で止めて、そのステップの番号と画面・SQL の結果を共有してください。

## 3. この確認のあと

- 実 API のテスト（`docs/translation-real-api-test-plan.md` 段階 2）では、この確認で済んだ項目は繰り返さず、Anthropic との接続（地域・ワークスペース・費用・エラー）に絞る。
- 仮の翻訳の記録と予算の数字は、実 API のテストの前に、検証用 DB で区別できるようにする（モデル=mock で見分ける。必要なら検証用だけで片づける SQL を用意する）。
