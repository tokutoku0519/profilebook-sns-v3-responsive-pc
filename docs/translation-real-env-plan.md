# 翻訳機能：実環境テストの準備と手順（2026-11-09）

本番の翻訳機能は**オフのまま**です。次の操作は、それぞれ承認をいただいてから行います。
- 本番 Supabase への SQL 適用
- 本番の翻訳 API の有効化
- 本番の規約・ポリシーの差し替え
- 有料 API の利用開始

---

## 0. おすすめの進め方（本番 DB を変えずに実環境で試す）

| 案 | 内容 | 良い点 | 注意点 |
|---|---|---|---|
| **A（おすすめ）検証用の Supabase プロジェクト** | 新しい Supabase プロジェクト（例：`miri-staging`）を作る。既存の SQL と翻訳の SQL を適用し、Vercel の Preview だけをそこにつなぐ | 本番 DB を一切変えずに、実際の Supabase（RLS・認証・関数）と実際の API で試せる | 既存のスキーマを同じにする手間がある（`supabase/` の SQL を順に流す）。テスト用のアカウントを作る |
| B 本番 DB に適用（止めたまま） | 本番に SQL を適用し、`enabled = false` のまま。Preview から本番 DB を使って試す | 本番と完全に同じ | **本番 DB の変更（要承認）**。テストの記録が本番に残る（法定の記録は期限まで消せない） |

以下は案 A を前提に書き、案 B で違う点は注記します。

---

## 1. 実際の Supabase のスキーマと SQL 案の比較

1. Supabase のダッシュボード → 本番プロジェクト → 左の **SQL Editor** → **New query**。
2. `supabase/check_existing_schema.sql` の全文を貼って **Run**。読み取りだけで、何も書きかえない。
3. 結果の表（23 行）をコピーして共有してください。確認すること：
   - `ok` がすべて `true`（`false` があれば適用しない）
   - `get_visible_book の定義の md5`：手元の Supabase 相当の環境では `db438c0404da164099340c14fddd810c`。違っても、空白や改行の差のことがある。その場合は次を実行して、結果の定義文を共有してください。
     ```sql
     select pg_get_functiondef('public.get_visible_book(text)'::regprocedure);
     ```
   - `answers.visibility` と `__visibility` の値が `public / followers / private` だけ
   - 翻訳のテーブル・関数がまだない
   - pg_cron が有効か（記録の自動削除に使う）
4. 手元の確認：同じ SQL を Supabase 相当の環境（PostgreSQL 16）で実行し、23 行すべて `true` だった。

---

## 2. バックアップとロールバックの方針

### 2-1. 適用の前
| 手順 | 場所・方法 |
|---|---|
| ① 自動バックアップがあるか確認 | Supabase → Project Settings（または Database）→ **Backups**。プランによって自動バックアップの有無・期間が違う（未確認。画面で確認） |
| ② 手元にバックアップを取る（念のため） | Supabase → **Connect**（またはProject Settings → Database）で接続文字列（URI）を確認し、手元の PC で `pg_dump "<接続文字列>" --schema=public -Fc -f miri-before-translation.dump` を実行。パスワードは接続文字列に含まれるので共有しない |
| ③ 影響範囲の確認 | 既存のテーブルは変更しない。`profile_book` と `answers` にトリガーを 1 つずつ追加するだけ（翻訳のキャッシュを消すトリガー。元の行は変えない） |
| ④ 時間帯 | アクセスの少ない時間。トリガーの追加でテーブルを一瞬ロックする |

### 2-2. 適用
1. SQL Editor で `supabase/proposal_content_translations.sql` を全文貼って Run（全体が 1 つのトランザクション。途中で失敗すれば何も変わらない）。
2. 続けて `supabase/proposal_account_deletion_requests.sql` を Run。
3. `supabase/verify_content_translations.sql` を Run → 17 行すべて `ok = true` を確認（手元では全行 true）。

### 2-3. ロールバック
| 状況 | 方法 |
|---|---|
| 翻訳を止めたいだけ | `update public.translation_settings set enabled = false;`（すぐ止まる）または Vercel の `TRANSLATION_ENABLED=false` |
| 翻訳のテーブル・関数を消したい | `supabase/rollback_content_translations.sql`。**一度でも外国に送ったあとは、先に記録を CSV で書き出す**（ファイルの「1. 記録の書き出し」） |
| 退会の申請テーブルを消したい | `supabase/proposal_account_deletion_requests.sql` の末尾の「取り消し」 |
| それでも直らない | ①のバックアップから戻す（最後の手段。翻訳以外のデータも戻るので、適用後に作られた投稿などが消える） |

手元で確認したこと：適用 → 取り消し → 翻訳のテーブル・関数・トリガーが 0 個。プロフィール・プロフ帳・回答は変化なし（中身のハッシュが同じ）。そのあと再適用して、確認の SQL がすべて true になった。

---

## 3. SQL の全文と検証用の SQL

| ファイル | 内容 | 書きこみ |
|---|---|---|
| `supabase/check_existing_schema.sql` | 適用前の確認（上の 1） | しない |
| `supabase/proposal_content_translations.sql` | 翻訳：テーブル 11・関数 23・トリガー 2 | する（要承認） |
| `supabase/proposal_account_deletion_requests.sql` | 退会の申請：テーブル 1・RLS・トリガー 1・関数 1 | する（要承認） |
| `supabase/verify_content_translations.sql` | 適用後の確認（17 項目） | しない |
| `supabase/rollback_content_translations.sql` | 取り消し | する（要承認） |
| `supabase/tests/translation/` | 手元の PostgreSQL でのテスト（191 項目、すべて合格） | 手元だけ |

適用後の自動削除の予約（pg_cron を有効にしてから、SQL Editor で 1 回だけ）：
```sql
select cron.schedule('miri-purge-translation-legal', '17 3 * * *', $$select public.purge_translation_legal_records()$$);
select cron.schedule('miri-purge-translation-cost',  '27 3 * * *', $$select public.purge_translation_cost_records()$$);
select cron.schedule('miri-purge-translation-cache', '37 3 * * *', $$select public.purge_translation_cache()$$);
select cron.schedule('miri-purge-deletion-requests', '47 3 * * *', $$select public.purge_account_deletion_requests()$$);
```

---

## 4. Anthropic の翻訳専用ワークスペースの設定

公式ドキュメント（Data residency）で確認したこと：
- `inference_geo` は `"us"` か `"global"`。`"us"` は料金 1.1 倍。
- Workspace geo は作成時に決め、あとで変えられない。いまは `"us"` だけ。
- `allowed_inference_geos` にない地域を指定した呼び出しはエラーになる。
- 設定は Console か Admin API の `data_residency`。

| # | 画面 | 操作 |
|---|---|---|
| 1 | https://platform.claude.com/settings/workspaces | **Create workspace** |
| 2 | Create workspace | 名前 `miri-translation`。**Workspace geo が US** であることを確認して作成 |
| 3 | 作ったワークスペースの設定（Data residency） | **Allowed inference geos を US だけ**、**Default inference geo を US** にする |
| 4 | 同じワークスペースの Limits | 月の上限（Spend limit）を **$10**（最初は $2 でもよい） |
| 5 | API keys | **そのワークスペースで** API キーを作る。キーはどこにも貼らず、手元と Vercel の環境変数にだけ入れる |
| 6 | 手元の PC | `ANTHROPIC_API_KEY=<キー> node scripts/translate-eval/check-workspace.mjs --confirm-paid`（**$0.0001 未満の課金あり・要承認**）。すべて OK なら次へ |
| 7 | Vercel | 7 章の環境変数 |

画面の名前（Data residency・Limits など）は、ドキュメントの記載から書いたもので、実際の Console の表示は未確認。違っていたら、画面の表示に合わせてください。

---

## 5. 実 API を使った少額の比較テストの計画（要承認）

| 項目 | 内容 |
|---|---|
| 実行 | `ANTHROPIC_API_KEY=<翻訳専用のキー> node scripts/translate-eval/run-eval.mjs --confirm-paid --max-usd 0.10` |
| 送るもの | `scripts/translate-eval/cases.json` の架空の文 24 件 × 4 言語（en・zh・ko・th）＝最大 96 件。利用者の文章は送らない |
| 本番と同じもの | エンジン・プロンプト・検証・個人情報のチェックは、アプリのコードをそのまま読み込む |
| 安全装置 | 送る前に preflight。地域が us でない応答があればその場で止める。実額が $0.10 を超えそうなら止める |
| 費用の見込み | 1 件 約 $0.0003〜0.0005 → 96 件で約 $0.03〜0.05（上限 $0.10） |
| 機械で見ること | すべて us／「原文のまま」が期待される文で原文のまま／検証の失敗の数／実額が見込み額以下／応答時間の中央値と 95% |
| 人が見ること | 結果の `.md` の「正しさ」「自然さ」を 1〜5 で採点（日本語と英語が分かる人） |
| 合格の目安 | すべて us・固有名詞の保持 100%・あいまいな短文で原文のまま 4/5 以上・自然さ平均 4 以上・中央値 2 秒以内・実額 ≦ 見込み |
| 結果の置き場所 | `scripts/translate-eval/results/`（git には入れない。共有するときは .md だけ） |

---

## 6. 実環境のテスト項目（案 A の検証用プロジェクト＋ Vercel Preview）

テスト用のアカウントを 4 つ使う：本人 A（翻訳を許可する人）、閲覧者 B（英語・A をフォロー）、閲覧者 C（英語・フォローしない）、未成年役 D。

| # | 分類 | 操作 | 期待 |
|---|---|---|---|
| 1 | 正常 | A：マイページ → 内容を確認して許可（項目を選ぶ・生年月・同意） | カードが「許可しています」。`translation_consent_events` に grant（年齢の区分つき・生年月なし） |
| 2 | 正常 | B：A のプロフ帳 → Show translation | 訳文。`translation_provision_log` に completed・reported_geo = us |
| 3 | 正常 | C：同じ項目を表示 | 翻訳済みを表示し、送信の記録は増えない |
| 4 | 他人の非公開 | A の項目を「フォロワー限定」にして、C が翻訳を頼む | 原文のまま。A の選択が外れる |
| 5 | 他人の非公開 | A の非公開の回答 ID を、C が API に直接送る（`curl` で `/api/translate`） | `original`。送信の記録なし |
| 6 | 公開範囲の変更 | 4 のあと公開に戻し、B が翻訳を頼む | 原文のまま（A が選び直すまで） |
| 7 | 同意の撤回 | A が取り消し → B が翻訳を頼む | 原文のまま。キャッシュ 0 件。記録（取り消し）は残る |
| 8 | 撤回の途中 | 翻訳中に A が取り消す（2 つのブラウザで同時に） | 保存されない |
| 9 | 年齢 | D：生年月に 15 歳になる年月 | 「16歳未満」。7 日間は大人の年でも許可できない |
| 10 | 年齢の回避 | D のトークンで `grant_consent` に `ageConfirmed16: true` だけを送る | 400 |
| 11 | 権限外 | ログインなし・他人のトークンで `/api/translate`・`/api/account-deletion` | 401。他人の申請は見えない |
| 12 | 権限外 | ブラウザのキー（anon）で翻訳のテーブルを読む（Supabase の API に直接） | 権限なし |
| 13 | 連絡先 | A の回答に架空の電話番号を書き、B が翻訳 | その文は原文のまま。「一部は翻訳していません」。A の同意画面に理由 |
| 14 | API の失敗 | Vercel の `ANTHROPIC_API_KEY` を一時的に無効なキーにする | 送る前の確認（preflight）で止まり、原文のまま。文章は送られないので送信の記録は作られない |
| 15 | 予算 | `translation_settings.monthly_cap_usd` を 0.001 に | 上限で止まり、翻訳済みは表示できる |
| 16 | 停止 | `translation_settings.enabled = false` | 新しい送信はすぐ止まる（送信の記録も作られない）。翻訳済みの表示は続く |
| 17 | 退会 | A：退会・データ削除を申請 | 「受付中」。通知が届く。運営者が削除 → 翻訳・許可は消え、法定の記録は残る |
| 18 | 版の変更 | `CONSENT_VERSION` を上げた Preview をデプロイ | 「説明が更新されました」。確認し直すまで翻訳しない |

自動テスト（モック）では、上の項目と、米国以外の応答・タイムアウト・やり直し・事前確認の失敗も確認済み（`npm run test:translate -- --ui`：202 項目）。

---

## 7. Vercel の環境変数

**Preview だけ**に設定する（Production には入れない）。

| 変数 | 値 | 備考 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`・`NEXT_PUBLIC_SUPABASE_ANON_KEY` | 検証用プロジェクトの値（案 A） | Preview だけ上書き |
| `SUPABASE_SERVICE_ROLE_KEY` | 検証用プロジェクトの値（案 A） | 案 B のときは本番の値になるので、テスト後すぐ消す |
| `TRANSLATION_STORE` | `db` | |
| `TRANSLATION_ENGINE` | `anthropic` | |
| `TRANSLATION_ALLOW_PAID` | `true` | 有料の利用（要承認） |
| `ANTHROPIC_API_KEY` | 翻訳専用ワークスペースのキー | Sensitive にする |
| `TRANSLATION_WORKSPACE_GEO` | `us` | 4 章の確認が OK のときだけ |
| `TRANSLATION_MONTHLY_CAP_USD` | `2` | テスト中は小さく |
| `ADMIN_NOTIFY_WEBHOOK_URL` | Slack・Discord の受信 URL（任意） | 退会の申請の通知 |

検証用プロジェクトでは、SQL Editor で `update public.translation_settings set enabled = true, monthly_cap_usd = 2;` を実行してから試す。
