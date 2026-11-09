# 自由回答の翻訳（Phase B）実装と最終レビュー資料

## 状態
- **実装済み**：API・画面・予算制御・自動テスト。
- **外部の翻訳 API**：実接続は無効。テスト用の仮の翻訳（外部へは何も送らない）で動く。
- **未実施**：本番 DB への SQL 適用、Anthropic API の有料利用、本番での有効化。いずれも承認後に行う。
- **2026-11-09 更新（実環境テスト前の最終修正）**：詳しくは `docs/translation-final-review.md`・`docs/translation-real-env-plan.md`。
  - 送信の記録を「送信中 → 結果（completed / geo_mismatch / error_response / unknown）」にした。
  - 送る前に、ワークスペースが米国だけに制限されていることを確認する（preflight）。
  - 年齢はサーバーで確認し、生年月は保存しない。16 歳未満と入力したら 7 日間は再入力できない。
  - 記録ごとに保存期限を持たせた。
  - 退会の申請を専用のテーブル（案）＋通知にした。
  - 連絡先を含む文は送らない。要配慮の内容の判定を 3 段階にした。
  - テスト：SQL 191 項目・API と画面 202 項目、すべて合格。
- **2026-11-07 更新（法務上の一次判断を反映）**
  - 同意画面（直接オンにできない）、項目の選択、16 歳未満の制限、説明の版、同意・送信の記録を追加した。
  - 個人情報の伏せ字と送らない判定、`inference_geo: "us"` の指定、費用の記録から ID の除去、退会・データ削除の申請も追加した。

関連ファイル：
- SQL 案：`supabase/proposal_content_translations.sql`（未適用）
- SQL のテスト：`supabase/tests/translation/`
- プライバシーポリシー・利用規約の改訂案：`docs/privacy-policy-translation-draft.md`
- 比較テスト用の文：`scripts/translate-eval/cases.json`

---

## 1. 翻訳の対象

| 対象（公開のものだけ） | 場所 |
|---|---|
| ひとこと・自己紹介 | `catchphrase`・`message` |
| 基本情報の自由回答 | `hometown` |
| 好きなもの・嫌いなもの | `favoriteFood`・`dislikeFood`・`favoriteColor`・`favoriteCharacter` |
| わたしのこと | `specialty`・`holiday`・`wantToGo`・`collection`・`motto`・`charmPoint`・`dream` |
| BEST3 | `__best3.<分類>.<0-2>`、今月のBEST3 は `__monthly.items.<0-2>`・`__monthly.episode` |
| ひとこと質問の回答 | `__questions.<n>.a`（質問文は訳さない。訳すときの手がかりとして使う） |
| 公開されたお題への回答 | `answers`（`visibility = 'public'`） |

**翻訳しないもの**
- 表示名・氏名・ニックネーム・アカウント ID・誕生日・血液型・MBTI・性別・選択式の項目
- 非公開・フォロワー限定・コミュニティ限定（今後増える公開範囲を含む）
- 日記・ブログ・コメント

翻訳してよい項目と場所の形は `src/lib/translation/shared.ts` と SQL の両方で同じに定義し、どちらでも検査する。

### 本人が選んだ項目だけ（未設定・選択なしの公開は、選ばれなければ対象外）
- 書いた本人が同意画面で説明を確認し、**翻訳してよい項目を選んで**許可していなければ、何も翻訳しない。初期値は「許可しない」。
- 同意画面には「いまログインしていない人に見えている項目と回答」だけが出る。最初は何も選ばれていない。
  - 選ぶ単位：プロフ帳はセクション、回答は 1 件ごと。
- 本人が選んだことを「公開して翻訳してよい」という明示の選択として扱う。
  - そのため、公開範囲が未設定の項目、ひとこと質問・BEST3、選択なしで公開になるデイリーの回答も、**選ばれたときだけ**翻訳する。
- 公開でなくなった項目は、選択を自動で外す。公開に戻しても、選び直すまで翻訳しない。
- v1 の `require_explicit_public` 設定は不要になったので削除した。
- 詳しくは `docs/privacy-policy-translation-draft.md` の 3 章・6 章。

---

## 2. 仕組み

```
ブラウザ ──「種類・ユーザー名・項目の場所／回答 ID・翻訳先の言語」だけ──▶ /api/translate（ログイン必須）
                                                                  │
                         原文はサーバーが DB から読む（送られた文章は使わない）
                                                                  ▼
  権限（本人の許可・いまの説明の版・選んだ項目・公開範囲）を確認して翻訳済みを返す → 翻訳中の目印
  → API を呼ばない判定 → 個人情報の伏せ字／送らない判定 → 予算の確保 → 送信の記録（許可がいまも有効か確認）
  → 翻訳（inference_geo: us） → 使用量で精算 → 検証 → 伏せ字を戻す → 保存（保存の瞬間にも権限を確認）
  → もう一度権限を確認して返す
```

- **個人情報の伏せ字**（`src/lib/translation/server/pii.ts`）
  - メール・URL・電話番号・10〜11 桁の数字・郵便番号・@ID は `⟦1⟧` のような記号に置きかえてから送り、訳文で元に戻す。
  - 記号が訳文から消えていたら失敗として原文を表示する。
- **送らない判定**：住所らしい文、健康・信条・犯罪歴などに関わる語を含む文は、送らずに「原文のまま」とする。
- 自動の判定なので、完全ではない。そのため、ポリシーと同意画面で「すべてを見つけられるとは限らない」と説明している。

- 「翻訳を見る」を押したときだけ翻訳する。もう一度押すと原文に戻る。原文は変えない。
- 翻訳ボタンは、次の 3 つがそろったときだけ出す。
  1. 翻訳が使える
  2. 書いた本人が許可している
  3. 表示言語と原文の言語がはっきり違う文がある
- 失敗・予算切れ・権限なし・回数制限のときは原文のまま表示し、「いまは翻訳できません」と出す。
- 名前・作品名・ブランド名は用語集で守る（`GLOSSARY`）。
  - 「残す語」（Juice=Juice・嵐・米津玄師・ぴえん・草など）は訳さない。
  - 正式な海外名がある作品・ブランドは置きかえる（鬼滅の刃 → Demon Slayer、スタバ → Starbucks など）。
- 意味があいまいな短い文は訳さない。
  - 記号・絵文字だけの文、かなや英字 1 文字の文、用語集の残す語と完全一致する文は、API を呼ばずに「原文のまま」とする。
  - それ以外も、AI が迷ったときは `kept_original` を選ぶようにプロンプトで指示している。
- 同じ原文・同じ言語の翻訳は保存して使い回す。

### 実装したファイル

| ファイル | 内容 |
|---|---|
| `src/lib/translation/shared.ts` | 翻訳してよい項目・場所の形・送られた値の検査（文章は捨てる）・言語の見分け・用語集 |
| `src/lib/translation/server/config.ts` | 環境変数・安全側の既定値・見込み額と実額の計算 |
| `src/lib/translation/server/engines.ts` | 仮の翻訳（mock）と Claude Haiku 5.5（公式 SDK）。結果の検証（改行・絵文字・デコ記号・残す語） |
| `src/lib/translation/server/store.ts` | MemoryStore（プレビュー・テスト）と DbStore（本番。SQL の関数を呼ぶ） |
| `src/lib/translation/server/service.ts` | 処理の流れ（上の図） |
| `src/app/api/translate/route.ts` | API（ログイン確認・入力の検査・回数制限） |
| `src/lib/translation/client.ts` | ブラウザからの呼び出し |
| `src/lib/translation/consentText.ts` | 同意画面の説明（日本語・英語）・説明の版・年齢の計算 |
| `src/lib/translation/server/pii.ts` | 個人情報の伏せ字・送らない判定 |
| `src/components/ContentTranslate.tsx` | 「翻訳を見る／原文を見る」ボタン・マイページの許可のカードと同意画面（body の直下に表示） |
| `src/components/AccountDeletionRequest.tsx` | マイページの「退会・データ削除を申請する」（既存の `feedback` に記録） |
| `src/app/[username]/page.tsx` | 他人のプロフ帳と回答の詳細にボタン、マイページに許可のカードと退会の申請、プロフ帳の表示を訳文に置きかえ（原文のデータは変更なし） |
| `scripts/check-no-external-translate.mjs` | Anthropic の SDK とサーバー専用の翻訳コードを、ブラウザ側から読み込んでいないかをビルド前に確認 |
| `scripts/translate-test/` | 自動テスト（Supabase の代わりのサーバー＋API＋画面） |

既存のプロフィール・回答・投稿・認証・課金の処理は変更していない。表示する文字列を訳文に差しかえる部分だけ追加した。

### 動く条件（安全側の既定）

| 環境 | 何も設定しないとき | 実際の翻訳（有料）を使う条件 |
|---|---|---|
| 本番（`VERCEL_ENV=production`） | **止まっている**。ボタンも許可の切り替えも出ない | 次の 5 つがすべてそろったとき：`TRANSLATION_ENABLED=true`、`TRANSLATION_ENGINE=anthropic`、`TRANSLATION_ALLOW_PAID=true`、`ANTHROPIC_API_KEY`、`TRANSLATION_STORE=db`（＋`SUPABASE_SERVICE_ROLE_KEY`） |
| プレビュー・手元 | 仮の翻訳＋メモリ保存で動く。外部へ送らず、DB にも書かない | 同上 |

- 本番では仮の翻訳を使わない。
- 有料 API は、予算を DB で数えるとき（`TRANSLATION_STORE=db`）しか使わない。メモリ保存では関数のインスタンスごとに数えるため、上限を守れない。

---

## 3. 権限の設計と確認結果

| 確認したいこと | 設計 | 確認 |
|---|---|---|
| 直接オンにできないか | 許可には、説明の版・表示した言語・16 歳以上の確認・1 件以上の項目が必要。以前の「オン／オフ」の操作は受け付けない | API・画面とも合格 |
| 明示的に公開を選んだものだけか | 本人が同意画面で選んだ項目だけ。未設定・デイリーの回答も、選ばれなければ翻訳しない | SQL・API とも合格 |
| 説明の版が変わったら | 確認し直すまで、新しい翻訳も翻訳済みの表示も止める | SQL で合格（API は古い版の同意を 409） |
| 非公開・フォロワー限定・コミュニティ限定 | どれも翻訳しない。閲覧者がフォロワーでも同じ。原文は「ログインしていない人」として読む | SQL・API・画面とも合格 |
| service_role は RLS を通らない | 判定はすべて SECURITY DEFINER の関数の中で行う（取り出し・返却・保存のたび）。ユーザーのトークン付きで呼ばれたら何も返さない | SQL で合格 |
| 関数の実行権限 | 19 の関数と 2 つのトリガー関数は PUBLIC・anon・authenticated から外し、service_role だけに付ける。`search_path` は固定 | SQL で合格（anon は 9 つのテーブルを読めない。ログイン中のユーザーから 20 種類の操作がすべて拒否） |
| 翻訳キャッシュが別ユーザーに渡らないか | 対象は誰でも見られる公開の内容の訳だけ。返すたびに公開範囲・本人の許可・原文の一致を確かめるので、非公開にした後・取り消した後・編集した後の訳は返らない | SQL・API とも合格 |
| 退会・原文の編集・削除・公開範囲の変更・許可の取り消し | 退会：外部キーで翻訳・許可・選んだ項目を削除（法定の記録は残す）。プロフ帳の編集：その項目の訳を削除。公開範囲の変更：その人のプロフ帳の訳をすべて削除し、公開以外にしたセクションの選択を外す。回答の編集：その回答の訳を削除。回答を公開以外にした・削除した：訳と選択を削除。項目を外した：その項目の訳を削除。許可の取り消し：その人の訳と選択をすべて削除。翻訳中に変わった・取り消した場合は保存しない | SQL・API とも合格 |
| 取り消し後に送らない | 送る直前に、許可がいまも有効かを確かめて送信の記録を作る。作れなければ送らない | SQL・API とも合格 |
| 費用の記録に個人の ID を残さない | `translation_budget`・`translation_reservations` に ID の列なし。回数制限（`translation_daily`）だけ ID を持ち、2 日で消す | SQL・API とも合格 |
| クライアントから任意の文章を送らせない | 送られた値は決まった形（種類・ユーザー名・場所／回答 ID）だけを取り出し、ほかは捨てる | API で合格（送った文章は結果に出ない） |
| 不正利用・過剰な費用 | 下の 7 点 | API で合格 |

**不正利用・過剰な費用への対策**
1. ログイン必須。
2. 1 人 1 分 30 回・同じ回線 1 分 120 回。
3. 1 人 1 日 30 件の新規翻訳。
4. 同じ人の原文は 1 日 60 件まで（編集を繰り返して費用を増やすのを防ぐ）。
5. 月の上限。
6. 翻訳済みは API を呼ばない。
7. 1 回 40 件・400 文字（回答は 600 文字）まで。

---

## 4. 予算（月の目標 $5・上限 $10）

### 同時アクセスでも超えない
- 呼び出す前に、最大でかかる額（見込み額）を確保する。
  - 見込み額 ＝（1,300 ＋ 文字数×3）トークン × $0.11/M ＋ 400 トークン × $0.55/M
    - Haiku 5.5 の料金 × 米国内での推論（`inference_geo: "us"`）の 1.1 倍。
  - 400 文字で約 $0.0005。上限は $0.002 で、それを超える見込みは受け付けない。
- 「確定額＋呼び出し中の見込み額＋今回の見込み額」が上限を超えるなら呼ばない。
  - DB では、月の行を `FOR UPDATE` でロックして 1 件ずつ判定する。
  - メモリでは、確保の判定を await をはさまず一度に行う。

### 実際の使用量で計測
- API の応答の `usage` にある 4 種類のトークン数（入力・出力・キャッシュ読み取り・キャッシュ書き込み）と、DB の料金表から実額を計算して精算する。
- 応答がない（タイムアウトなど）ときは精算しない。15 分後に見込み額を全額使ったとみなして確定する（少なく数えない）。
- 確保した月で精算するので、月をまたいでもずれない。

### 上限に達したとき
- 新しい翻訳だけを止める。翻訳済みは表示でき、それ以外は原文。
- 停止の方法：`translation_settings.enabled = false`（DB）、または `TRANSLATION_ENABLED=false`（再デプロイ）。

### 使用量の見方
- 本番：SQL Editor で `translation_budget` を見る（クエリは SQL ファイルの末尾）。
- プレビュー：`/api/translate?usage=1`（本番では返さない）。
- Claude Console の Usage でも見られる。

### 確認結果
- SQL：上限ちょうど 10 件分の予算に 40 件を同時に送ると、通ったのは 10 件で、確保額は上限ちょうど。
- API：4 人が同時に 24 件を頼むと、上限 $0.0012 に対して 10 件だけ翻訳（確定 $0.000877）。残りは原文で、翻訳済みは上限後も表示できた。

### Anthropic 側の予備の上限
- 翻訳専用のワークスペースを作り、月 $10 の上限を設定する。
- 既定のワークスペースには設定できない。到達時は API がエラーを返し、Miri は原文を表示する。

---

## 5. SQL の最終確認事項（`supabase/proposal_content_translations.sql`）

| 区分 | 内容 |
|---|---|
| 変更する既存のもの | 既存のテーブル・列・関数・データは変更しない。`profile_book` と `answers` にトリガーを 1 つずつ追加するだけ（翻訳を消すだけ。元の行は変えない） |
| 新しいテーブル（9） | 設定：`translation_settings`／いまの状態：`translation_consents`・`translation_item_permissions`／② 法定の記録：`translation_consent_events`・`translation_provision_log`（外部キーなし）／① 翻訳キャッシュ：`content_translations`／③ 費用：`translation_budget`・`translation_reservations`（ID なし）・`translation_daily`（2 日で消す） |
| 新しい関数（19） | 判定：`translation_consent_current`・`translation_first_text`・`translatable_source`／翻訳：`get_translation`・`claim_translation`・`release_translation`・`store_translation`／記録：`record_translation_provision`・`purge_expired_translation_records`／予算：`reserve_translation`・`settle_translation`／本人の操作：`translation_candidates`・`translation_items_valid`・`translation_replace_items`・`grant_translation_consent`・`set_translation_items`・`revoke_translation_consent`・`get_translation_consent`・`owner_allows_translation`。トリガー用 2 つ（`purge_profile_translations`・`purge_answer_translations`）。既存の `get_visible_book` を中で使う |
| 権限 | RLS 有効・ポリシーなし・anon/authenticated の権限を外す・関数は service_role だけ |
| 初期値 | `enabled = false`（適用しただけでは翻訳しない）、上限 $10・目安 $5、1 人 1 日 30 件、1 原文 1 日 60 件、料金は米国内の推論（1.1 倍）、法定の記録の保存期間 3 年（仮） |
| 記録の削除 | `purge_expired_translation_records()` を 1 日 1 回（pg_cron など）。送信の記録は 1 件ごとに 3 年、同意の履歴は最後の同意・取り消し・送信から 3 年 |
| 取り消し | ファイル末尾の ROLLBACK。翻訳・許可・記録・予算のテーブルだけが消え、原文・回答は残る。**一度でも外国へ送ったあとは、法定の記録を別に保存してから実行する** |

**確認結果**：手元の PostgreSQL 16（Supabase 相当の環境）で 156 項目すべて合格。
- 取り消し後に残ったテーブル・関数・トリガー：0。
- 原文（`profile_book`・`answers`）は変化なし。
- 再適用も成功。

**適用前にお願いしたいこと**
- 本番の `get_visible_book`・`answers` の定義が `security_patch_A.sql`・`schema.sql` と同じか、SQL Editor で確認する。
- 適用はアクセスの少ない時間に行う。トリガーの追加は一瞬だが、テーブルを短くロックする。

---

## 6. API キー発行後の接続手順（承認後）

1. **Anthropic Console**
   - 翻訳専用のワークスペース（例：`miri-translation`）を作る。
   - そのワークスペースのデータの保存地域（Workspace geo）が US であることを確認する。
   - 許可する推論の地域（`allowed_inference_geos`）を `["us"]` に制限する。
   - そのワークスペースの月の上限を $10 に設定する（Limits / Spend limits）。
   - そのワークスペースで API キーを発行する。
2. **比較テスト（手元・少額）**
   - API キーを手元の環境変数にだけ置き、`scripts/translate-eval/cases.json` の 24 文×4 言語を Haiku 5.5 で訳す。
   - 費用の見込みは約 $0.01。応答時間・トークン数・費用を記録し、人が採点する（評価方法は 8 章）。
   - **応答の `usage.inference_geo` が `us` であることを確認する**（Miri は `us` 以外を失敗として扱う）。
3. **本番 DB**：SQL を適用する（承認後）。`enabled` は `false` のまま。
4. **Vercel のプレビュー環境に設定**（本番にはまだ設定しない）

   | 変数 | 値 |
   |---|---|
   | `ANTHROPIC_API_KEY` | 発行したキー（暗号化・Preview のみ） |
   | `TRANSLATION_ENGINE` | `anthropic` |
   | `TRANSLATION_ALLOW_PAID` | `true` |
   | `TRANSLATION_STORE` | `db` |
   | `SUPABASE_SERVICE_ROLE_KEY` | 既存 |

5. **プレビューで実際の翻訳を確認**
   - 確認前に `update translation_settings set enabled = true` を実行する。
   - 確認すること：訳の品質、使用量が `translation_budget` に記録されること、上限で止まること。
6. **本番に同じ変数＋`TRANSLATION_ENABLED=true` を設定**（承認後）。
7. **止めるとき**：`translation_settings.enabled = false`（すぐ止まる）または `TRANSLATION_ENABLED=false`（再デプロイ）。

Claude Haiku 5.5 の呼び出し設定（`engines.ts`）：
- モデル `claude-haiku-5-5`
- 思考 `disabled`
- `effort: low`
- 構造化出力（JSON スキーマ）
- `max_tokens: 400`
- system にプロンプトキャッシュ
- `inference_geo: "us"`（応答の `usage.inference_geo` が `us` 以外なら失敗）
- タイムアウト 15 秒・再試行 1 回
- `refusal`・`max_tokens` で止まったとき、JSON が壊れているときは失敗として原文を表示
- 公式の SDK（`@anthropic-ai/sdk`）を使い、ブラウザ側からは読み込めないようにビルド前に確認している

---

## 7. データの扱い（Anthropic）

- API の入力・出力は、受信または生成から 30 日以内に自動削除される（標準）。
  - 例外：利用規約違反の調査（最長 2 年）、Files API、ゼロデータ保持の契約。
  - 今回使うのは Messages API とプロンプトキャッシュだけで、Batch API・Files API は使わない。
- 明示的な許可なしに学習に使われない。Claude Haiku 5.5 は 30 日保存が必須の「Covered Models」ではない。
- 送るのは原文（伏せ字にしたもの）と質問文と言語だけ。名前・ID・メール・アクセストークン・閲覧者の情報は送らない。
- 公式ドキュメント（API and data retention）では、既定では保存しない（Covered Models を除く）、法令上必要な場合と安全性の判定で問題とされた場合は最長 2 年、とされている。ポリシーでは両方を踏まえ「保存されないか、保存されても原則 30 日以内」と書いた。
- 保存期間の公式ページ（privacy.claude.com）は、この作業環境から開けなかった（検索結果で確認）。契約前に直接確認すること。

---

## 8. 少額の比較テストと評価の方法（実装前に提示）

- **対象**：`cases.json` の 24 文 × 翻訳先 4 言語（en・zh・ko・th）＝ 96 件。中心は日本語→英語。
- **エンジン**：Claude Haiku 5.5（6 章の設定）と Google Cloud Translation（Basic）。
- **費用**：Haiku は約 $0.01（再実行を含めても $0.10 以下）。Google は無料枠内。
- **機械で判定すること**
  - 固有名詞が残っているか。
  - 「原文のまま」が期待される文で `kept_original` を選んだか。
  - 改行・絵文字・デコ記号が残っているか。
  - 説明や注釈を足していないか。
  - ローマ字化していないか。
  - 応答時間の中央値と、95% の応答が収まる時間。
- **人が判定すること**：日本語と英語がわかる人が、どちらのエンジンかを伏せて 1〜5 で採点する（正しさ・自然さ）。
- **合格の目安**
  - 固有名詞の保持 100%。
  - あいまいな短文で原文のままを選べる（5 件中 4 件以上）。
  - 日本語→英語の自然さが平均 4 以上。
  - 応答時間の中央値 2 秒以内。
  - 実額が見込み額以下。

---

## 9. 自動テスト

| テスト | 内容 | 結果（2026-11-07） |
|---|---|---|
| `npm run test:translate -- --ui` | 伏せ字の部品 6 項目、API 92 項目、画面 58 項目（390px・1366px）。画面では同意画面・年齢・同意のチェック・取り消し・退会の申請も確認 | 156 項目すべて合格 |
| `supabase/tests/translation/run.sh` | SQL 156 項目（手元の PostgreSQL 16）。権限・候補・同意の検証・版・取り出し・送信の記録・編集・公開範囲・項目の変更・取り消し・退会・記録の保存期間・費用 | すべて合格 |
| 既存の回帰テスト（Unit 1〜4・ログインと表示） | 本番設定のビルド | 前の版と同じ結果 |

`npm run test:translate` は、Supabase の代わりのサーバーを指してビルドしたあとに実行する。手順はファイルの先頭に書いてある。

モックと本物の区別：
- 翻訳は仮の翻訳、Supabase は代わりのサーバー、SQL は手元の PostgreSQL で確認した。
- 本物の Supabase・Anthropic API では、まだ何も確認していない。

テストで見つけて直したこと：
- スマホで、同意画面と退会の申請画面の下のボタンがタブバーに隠れて押せなかった。body の直下に表示するように直した。
- メモリ保存で、回答をフォロワー限定にしたとき、その回答の選択が外れていなかった。SQL のトリガーと同じ動作に直した。
- 同意の履歴を作成日から 3 年で消すと、送信を続けている人の、もとになった同意の記録まで消えてしまう。そのため「最後の同意・取り消し・送信から 3 年」に直した。

---

## 10. 本番有効化までの手順（すべてそろうまで有効にしない）

**前提条件**
1. プライバシーポリシー・利用規約の確定（法律の専門家の確認。`docs/privacy-policy-translation-draft.md` 10 章の論点）。確定した文言で同意画面の版を上げる（`-draft` を外す）。
2. 同意画面と記録の実装（済み）。法務確認で項目・保存期間を確定する。
3. 明示的な公開の確認（済み：本人が項目を選ぶ方式）。
4. API の権限（済み：ログイン必須・service_role だけの関数・回数と予算の制限）。
5. 翻訳キャッシュと記録の保存期間の確定（初期値 3 年は仮）。`purge_expired_translation_records()` を 1 日 1 回動かす設定（pg_cron など）。
6. 米国での処理の確認：Workspace geo・`allowed_inference_geos`・応答の `usage.inference_geo`。
7. 未成年者の扱いの確定（いまは 16 歳未満・未入力は不可）。
8. Supabase・Vercel の処理地域の確認と、ポリシー「7. 安全管理措置」への反映。
9. SQL のレビュー（本番の `get_visible_book`・`answers` の定義と一致するか）。
10. 本番に近い環境でのテスト（Supabase のステージング、または本番 DB に適用後 `enabled = false` のまま、プレビューで確認）。

**手順**（各段階で承認をいただく）
1. Anthropic Console の設定（6 章 1）と、手元での少額の比較テスト（`usage.inference_geo` の確認を含む）。
2. 本番 DB に SQL を適用（`enabled = false` のまま）。適用後に `select public.owner_allows_translation('x', 'v')` などで関数があることを確かめる。
3. Vercel の Preview に翻訳の変数を設定し、実際の Supabase と Anthropic で確認する。
   - 確認すること：同意 → 翻訳 → 取り消し、記録の作成、上限での停止、伏せ字。
   - 本番の service_role キーを Preview に入れる場合は、確認後すぐに外す。
4. ポリシー・規約の本番の文面を差しかえる（`src/app/privacy`・`src/app/terms`）。
5. 本番の環境変数を設定し、`TRANSLATION_ENABLED=true` と `translation_settings.enabled = true` にする。最初は `monthly_cap_usd` を小さめ（例：$2）にする。
6. 運営者の作業を決めておく
   - 退会・データ削除の申請（`feedback` の `kind = 'account_deletion'`）を確認し、本人確認のうえ Supabase の Authentication から削除する。
   - 本人からの開示請求に、`translation_consent_events`・`translation_provision_log` を ID で抽出して応じる。

**今後の拡張**
- 保護者の同意による許可（16 歳未満）。
- 日記・ブログ・コメント・サークル（Phase C）。
- 限定公開・コミュニティ限定・サブスク限定（閲覧者ごとに権限を確かめる関数を `source_type` ごとに追加）。
- 趣味別プロフィール帳・公認ユーザーの独自質問。
