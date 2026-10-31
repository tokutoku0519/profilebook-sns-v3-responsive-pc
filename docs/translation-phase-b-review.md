# 自由回答の翻訳（Phase B）実装と最終レビュー資料

## 状態
- **実装済み**：API・画面・予算制御・自動テスト。
- **外部の翻訳 API**：実接続は無効。テスト用の仮の翻訳（外部へは何も送らない）で動く。
- **未実施**：本番 DB への SQL 適用、Anthropic API の有料利用、本番での有効化。いずれも承認後に行う。

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

### 公開範囲が未設定のとき（原則は拒否）
- 書いた本人がマイページで「翻訳を許可する」をオンにしていなければ、何も翻訳しない。初期値はオフ。
- 本人の許可があれば、公開範囲が未設定の項目は画面の表示と同じく公開として扱う。ひとこと質問・BEST3 には公開範囲の設定がないため、この扱いが必要。
- より厳しくする設定もある。`translation_settings.require_explicit_public = true` にすると、未設定の項目は許可があっても拒否する。
- 本人の許可は、外部の翻訳サービスへ送ることへの同意（プライバシーポリシーの改訂案）も兼ねる。

---

## 2. 仕組み

```
ブラウザ ──「種類・ユーザー名・項目の場所／回答 ID・翻訳先の言語」だけ──▶ /api/translate（ログイン必須）
                                                                  │
                         原文はサーバーが DB から読む（送られた文章は使わない）
                                                                  ▼
  権限を確認して翻訳済みを返す → 翻訳中の目印 → API を呼ばない判定 → 予算の確保 → 翻訳
  → 使用量で精算 → 検証 → 保存（保存の瞬間にも権限を確認） → もう一度権限を確認して返す
```

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
| `src/components/ContentTranslate.tsx` | 「翻訳を見る／原文を見る」ボタン・マイページの許可の切り替え |
| `src/app/[username]/page.tsx` | 他人のプロフ帳と回答の詳細にボタン、マイページに許可の切り替え、プロフ帳の表示を訳文に置きかえ（原文のデータは変更なし） |
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
| 公開範囲が未設定 | 本人の許可がなければ拒否。許可があれば公開として扱う（厳しい設定も可） | SQL・API とも合格 |
| 明示的に公開された文章だけにできるか | `require_explicit_public = true` でできる。ただし、ひとこと質問・BEST3 には公開範囲の設定がないので対象外になる | SQL で合格 |
| 非公開・フォロワー限定・コミュニティ限定 | どれも翻訳しない。閲覧者がフォロワーでも同じ。原文は「ログインしていない人」として読む | SQL・API・画面とも合格 |
| service_role は RLS を通らない | 判定はすべて SECURITY DEFINER の関数の中で行う（取り出し・返却・保存のたび）。ユーザーのトークン付きで呼ばれたら何も返さない | SQL で合格 |
| 関数の実行権限 | 10 の関数と 2 つのトリガー関数は PUBLIC・anon・authenticated から外し、service_role だけに付ける。`search_path` は固定 | SQL で合格（anon・ログイン中のユーザーから 13 種類の操作がすべて拒否） |
| 翻訳キャッシュが別ユーザーに渡らないか | 対象は誰でも見られる公開の内容の訳だけ。返すたびに公開範囲・本人の許可・原文の一致を確かめるので、非公開にした後・取り消した後・編集した後の訳は返らない | SQL・API とも合格 |
| 退会・原文の編集・削除・公開範囲の変更・許可の取り消し | 退会：外部キーで削除。プロフ帳の編集：その項目の訳を削除。公開範囲の変更：その人のプロフ帳の訳をすべて削除。回答の編集・公開範囲の変更・削除：その回答の訳を削除。許可の取り消し：その人の訳をすべて削除。翻訳中に変わった場合は保存しない | SQL・API とも合格 |
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
  - 見込み額 ＝（1,300 ＋ 文字数×3）トークン × $0.10/M ＋ 400 トークン × $0.50/M
  - 400 文字で約 $0.00045。上限は $0.002 で、それを超える見込みは受け付けない。
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
| 新しいテーブル（6） | `translation_settings`・`translation_consents`・`content_translations`・`translation_budget`・`translation_reservations`・`translation_daily` |
| 新しい関数（12） | `translatable_source`・`get_translation`・`claim_translation`・`release_translation`・`store_translation`・`reserve_translation`・`settle_translation`・`set_translation_consent`・`get_translation_consent`・`owner_allows_translation`、トリガー用 2 つ（`purge_profile_translations`・`purge_answer_translations`）、既存の `get_visible_book` を中で使う |
| 権限 | RLS 有効・ポリシーなし・anon/authenticated の権限を外す・関数は service_role だけ |
| 初期値 | `enabled = false`（適用しただけでは翻訳しない）、上限 $10・目安 $5、1 人 1 日 30 件、1 原文 1 日 60 件 |
| 取り消し | ファイル末尾の ROLLBACK。翻訳・許可・予算の記録だけが消え、原文・回答は残る |

**確認結果**：手元の PostgreSQL 16（Supabase 相当の環境）で 94 項目すべて合格。
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
   - そのワークスペースの月の上限を $10 に設定する（Limits / Spend limits）。
   - そのワークスペースで API キーを発行する。
2. **比較テスト（手元・少額）**
   - API キーを手元の環境変数にだけ置き、`scripts/translate-eval/cases.json` の 24 文×4 言語を Haiku 5.5 で訳す。
   - 費用の見込みは約 $0.01。応答時間・トークン数・費用を記録し、人が採点する（評価方法は 8 章）。
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
- タイムアウト 15 秒・再試行 1 回
- `refusal`・`max_tokens` で止まったとき、JSON が壊れているときは失敗として原文を表示
- 公式の SDK（`@anthropic-ai/sdk`）を使い、ブラウザ側からは読み込めないようにビルド前に確認している

---

## 7. データの扱い（Anthropic）

- API の入力・出力は、受信または生成から 30 日以内に自動削除される（標準）。
  - 例外：利用規約違反の調査（最長 2 年）、Files API、ゼロデータ保持の契約。
  - 今回使うのは Messages API とプロンプトキャッシュだけで、Batch API・Files API は使わない。
- 明示的な許可なしに学習に使われない。Claude Haiku 5.5 は 30 日保存が必須の「Covered Models」ではない。
- 送るのは原文と質問文と言語だけ。名前・ID・メール・アクセストークン・閲覧者の情報は送らない。
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

| テスト | 内容 | 結果 |
|---|---|---|
| `npm run test:translate -- --ui` | API 58 項目＋画面 34 項目（390px・1366px） | 92 項目すべて合格 |
| `supabase/tests/translation/run.sh` | SQL 94 項目（手元の PostgreSQL 16） | すべて合格 |
| 既存の回帰テスト（Unit 1〜4・ログインと表示） | 本番設定のビルド | 前の版と同じ結果 |

`npm run test:translate` は、Supabase の代わりのサーバーを指してビルドしたあとに実行する。手順はファイルの先頭に書いてある。

モックと本物の区別：
- 翻訳は仮の翻訳、Supabase は代わりのサーバー、SQL は手元の PostgreSQL で確認した。
- 本物の Supabase・Anthropic API では、まだ何も確認していない。

---

## 10. 本番反映までの残りの作業

1. プレビューで実際に操作して確認（2 アカウント：許可をオンにする人と、英語で見る人）。
2. 比較テストの実施と結果の評価（API キーの発行と少額の利用の承認が必要）。
3. プライバシーポリシー・利用規約の改訂（法律の専門家の確認）。マイページの説明に送信先とポリシーへのリンクを加える。
4. 本番 DB への SQL の適用（承認が必要）。
5. プレビューで実際の翻訳（Haiku 5.5）を確認し、使用量の記録と上限での停止を確かめる。
6. 本番の環境変数の設定と有効化（承認が必要）。最初は `monthly_cap_usd` を小さめ（例：$2）にして様子を見る。
7. 今後の拡張
   - 日記・ブログ・コメント・サークル（Phase C）。
   - 限定公開・コミュニティ限定・サブスク限定（閲覧者ごとに権限を確かめる関数を `source_type` ごとに追加）。
   - 趣味別プロフィール帳・公認ユーザーの独自質問。
