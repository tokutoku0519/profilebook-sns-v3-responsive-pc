# 検証用 Supabase プロジェクトの準備（本番のデータを使わない実環境テスト）

- 目的：本番の Supabase を変えずに、実際の Supabase（認証・RLS・関数）で翻訳機能を確かめる。
- この文書の SQL は**まだどこにも適用していません**。全文を確認してから、ご自身で SQL Editor に貼って実行してください。
- 手元の PostgreSQL 16（Supabase 相当の環境）で、下の手順 4〜7 を通して確認済みです。
  - 検証用の印がないデータベースでは、架空データの投入と動作確認の SQL が止まります。
  - 動作確認は 23 項目すべて合格し、確認のための書きこみは何も残りませんでした。

---

## 1. 新しい Supabase プロジェクトを作る

| # | 画面 | 操作 |
|---|---|---|
| 1 | https://supabase.com/dashboard → **New project** | Organization は本番と同じでよい |
| 2 | Project name | `miri-staging`（本番と見分けがつく名前） |
| 3 | Database password | 本番と**別の**パスワード（パスワード管理アプリに保存） |
| 4 | Region | 本番と同じ地域を選ぶ（動きをそろえるため）。検証用には架空のデータしか入れないので、地域による個人情報の問題はない |
| 5 | Plan | Free でよい（自動バックアップは不要。壊れたら作り直す） |
| 6 | 作成後 | **Project Settings → API**（画面によっては「API Keys」）で、Project URL・anon key・service_role key を控える（service_role key は Vercel の Preview にだけ入れる。チャットや Git には貼らない） |

> 画面の名前は Supabase の改訂で変わることがあります（supabase.com はこの作業環境から開けず、最新の画面は未確認）。

---

## 2. 既存のテーブル・RLS・関数を移す（本番のデータはコピーしない）

本番と同じ「形」だけを、リポジトリの SQL から作ります。データは移しません。

SQL Editor（左のメニュー → **SQL Editor** → **New query**）で、次の順に 1 つずつ全文を貼って **Run**：

| 順 | ファイル | 内容 |
|---|---|---|
| 1 | `supabase/schema.sql` | プロフィール・回答・フォロー・通知・サークル・ブログ・日記・feedback・性格投票・通報など（drop table なし） |
| 2 | `supabase/security_patch_A.sql` | `profile_book`（本人だけ）と `get_visible_book` |
| 3 | `supabase/security_patch_A_step3.sql` | 旧 `profiles.book` の片づけ（空のデータベースでは何も起きない） |
| 4 | `supabase/security_patch_C.sql` | 称号・公認バッジの保護 |
| 5 | `supabase/security_patch_followers_reports.sql` | フォロワー限定の回答の RLS・通報 |
| 6 | `supabase/patch_perception_votes.sql` | 性格投票 |
| 7 | `supabase/staging/00_mark_as_staging.sql` | **検証用の印**（ユーザーが 10 人を超えるデータベースでは付けない） |

### 本番と同じ形になったかの確認（どちらも読み取りだけ）
1. 本番と検証用の両方で `supabase/staging/schema_fingerprint.sql` を実行し、結果を CSV でダウンロードして比べる。
   - 本番でだけ違う行があれば、リポジトリの SQL にない変更が本番にある。その場合は、共有いただければ差分を SQL にします。
   - 検証用にだけある `_miri_environment` は無視してよい。
2. 検証用で `supabase/check_existing_schema.sql` を実行し、本番の結果と同じになることを確かめる。

### 認証の設定（プレビューでログインできるように）
- **Authentication → URL Configuration**
  - Site URL：プレビューの URL（例：`https://<プロジェクト名>-git-<ブランチ名>-<チーム>.vercel.app`）
  - Redirect URLs：上の URL と `https://*-<チーム>.vercel.app/**`
- **Authentication → Sign In / Providers**：本番と同じ（メール・パスワード）。メールの確認は、テスト用のアカウントを「Auto Confirm」で作るので不要。

---

## 3. テスト用のアカウントと架空のデータ

1. **Authentication → Users → Add user → Create new user** で、次の 4 人を作る。**Auto Confirm User にチェック**を入れる。

   | メール | 役 |
   |---|---|
   | `miri-test-alice@example.com` | 翻訳を許可する本人 |
   | `miri-test-bob@example.com` | 英語で見る人（alice をフォロー） |
   | `miri-test-carol@example.com` | 英語で見る人（フォローしない） |
   | `miri-test-dave@example.com` | 16 歳未満の役 |

   - `example.com` は例示用に予約されたドメインなので、メールはどこにも届かない。
   - パスワードは検証用のものにする。
2. SQL Editor で `supabase/staging/seed_test_data.sql` を実行する。
   - 入るのは架空のプロフ帳・回答（公開・フォロワー限定・非公開・デイリー）・フォローだけ。
   - 本番のデータは使わない。電話番号も架空の形式だけ。

---

## 4. 翻訳の SQL を適用する

1. `supabase/proposal_content_translations.sql`（テーブル 12・関数 24・トリガー 2）
2. `supabase/proposal_account_deletion_requests.sql`（退会の申請）
3. `supabase/verify_content_translations.sql` → すべて `ok = true`（18 項目）

## 5. 適用後の動作確認（データは残らない）

`supabase/staging/smoke_test_translation.sql` → 結果の 23 行がすべて `ok = true` なら合格。

確認する内容：
- 候補・許可・年齢（16 歳未満・7 日間の再入力制限）。
- 取り出せる・取り出せない（フォロワー限定・未選択のデイリー・版の違い）。
- 送信の記録（法定の記録と技術ログ）・保存と返却。
- 公開範囲の変更・取り消し。
- 権限（anon・ログイン中のユーザー・退会の申請の RLS）。

関数の中で最後にわざとエラーを起こして書きこみを取り消すので、実行後に何も残りません（手元で確認済み）。

---

## 6. アプリとのつなぎ方（本番と検証用の切り替え）

切り替えは **Vercel の環境変数だけ**で行います。コードは同じです。

| 変数 | Production（本番） | Preview（検証用。ブランチを限定） |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 本番の URL（いまのまま） | 検証用の Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 本番（いまのまま） | 検証用の anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | 本番（いまのまま。決済で使用中） | 検証用の service_role key |
| `NEXT_PUBLIC_DB_LABEL` | 設定しない | `staging` |
| `NEXT_PUBLIC_APP_ENV` | `production`（いまのまま） | `production`（ダミーデータを出さないため） |

Vercel → プロジェクト → **Settings → Environment Variables** → 変数を追加し、Environment で **Preview** だけを選び、**Git Branch** に `claude/miri-delta-login-fix-tbw4wc` を指定します。こうすると、ほかのブランチのプレビューと本番には影響しません。

取り違えを防ぐしくみ（コードで実装済み）：
- `NEXT_PUBLIC_DB_LABEL=staging` のビルドでは、画面の上に「検証環境（検証用データベース）」と表示する。
- プレビューで翻訳の記録を DB に書く設定（`TRANSLATION_STORE=db`）は、`NEXT_PUBLIC_DB_LABEL=staging` がなければ翻訳を止める。プレビューから本番 DB に書かないため。
- 本番に `NEXT_PUBLIC_DB_LABEL=staging` があれば、翻訳を止める。
- 検証用の SQL（架空データ・動作確認）は、検証用の印がないデータベースでは止まる。

環境変数を変えたら、そのブランチのプレビューを**再デプロイ**します（Deployments → 該当のデプロイ → Redeploy）。`NEXT_PUBLIC_` で始まる変数はビルドのときに埋めこまれるためです。

---

## 7. 問題が起きたときの復旧

| 状況 | 方法 |
|---|---|
| 翻訳を止めたい | 検証用の SQL Editor で `update public.translation_settings set enabled = false;`（すぐ止まる） |
| 自動で止まった（米国以外・別のワークスペースの応答） | `select halted_reason from public.translation_settings;` で理由を見る。原因を直したあと `update public.translation_settings set enabled = true, halted_reason = null;` |
| 翻訳のテーブルだけ作り直したい | `supabase/rollback_content_translations.sql` → 手順 4 からやり直す |
| テストのデータを作り直したい | `seed_test_data.sql` をもう一度（上書き） |
| 検証用のデータベースがおかしくなった | プロジェクトを削除して作り直す（Project Settings → General → Delete project）。本番のデータは入っていないので失うものはない |
| プレビューが本番 DB を見ている気がする | 画面上部の「検証環境」の表示を確認。表示がなければ Preview の環境変数とブランチの指定を見直し、再デプロイ |
| 本番に何か起きた | このテストでは本番に一切書かないので、本番の復旧は不要（本番 DB への適用は別途承認のとき。`docs/translation-real-env-plan.md` のバックアップ手順） |
