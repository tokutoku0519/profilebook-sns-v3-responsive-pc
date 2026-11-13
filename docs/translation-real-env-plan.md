# 翻訳機能：実環境検証の進め方（2026-11-11 更新）

本番の翻訳機能は**オフのまま**です。次の操作は、それぞれ別途承認をいただいてから行います。
- 本番 Supabase への SQL 適用
- 本番の翻訳 API の有効化
- 本番の規約・ポリシーの差し替え
- 有料 API の利用

## 進み具合（2026-11-11）
- [x] 段階 1：本番のスキーマの確認（26 行すべて true）
- [x] 段階 2：検証用 Supabase（`miri-staging`）。本番の今の形に合わせ（形の比較で違いは profiles の列の順番と検証用の印だけ）、翻訳の SQL・退会の申請の SQL を適用。**実際の Supabase で verify 18 項目・smoke 23 項目がすべて true**
- [x] Vercel の Preview（このブランチだけ）を検証用 DB につなぐ（2026-11-13。ログイン確認・本番に検証環境の表示が出ないことも確認）
- [ ] 仮の翻訳（無料）で、アプリと検証用 DB の組み合わせを確認（`docs/translation-staging-mock-check.md`）
- [ ] 段階 3：Anthropic のワークスペース
- [ ] 段階 4：実 API の少額テスト（要承認）

## 全体の流れ

| 段階 | 内容 | 本番への影響 | 承認 | 手順書 |
|---|---|---|---|---|
| 1 | 本番のスキーマの確認（読み取りだけ） | なし（`set transaction read only` で書きこみ不可） | 不要（ご自身で実行） | 下の 1 章 |
| 2 | 検証用 Supabase の準備（架空のデータ） | なし | 不要（検証用のプロジェクトだけ） | `docs/staging-supabase-setup.md` |
| 3 | Anthropic の翻訳専用ワークスペース | なし | キーの発行まで不要 | `docs/anthropic-workspace-setup.md` |
| 4 | 実 API の少額テスト（上限 $0.10） | なし | **要承認（有料）** | `docs/translation-real-api-test-plan.md` |
| 5 | 本番 DB への適用（翻訳はオフのまま） | あり | **要承認** | 下の 2 章 |
| 6 | 規約・ポリシーの確定と差し替え・本番の有効化 | あり | **要承認** | `docs/legal/`・`docs/translation-phase-b-review.md` 10 章 |

---

## 1. 本番のスキーマの確認（読み取りだけ）

Supabase のダッシュボード → 本番のプロジェクト → 左の **SQL Editor** → **New query** に `supabase/check_existing_schema.sql` の全文を貼って **Run** してください。結果の表（26 行）を共有いただければ、互換性を判断します。

| 結果 | 意味 | この案への影響 |
|---|---|---|
| 1〜3：profiles・profile_book・answers の列 | 翻訳の SQL が使う列があるか | false なら適用しない（SQL を直す） |
| 4・5：公開範囲の値 | `public / followers / private` 以外がないか | ほかの値があれば、翻訳の判定（公開以外は対象外）は安全側に動く。候補の出し方を確認する |
| 10〜14：get_visible_book | 定義の要点と md5 | md5 が手元（`db438c0404da164099340c14fddd810c`）と違えば、定義文（`select pg_get_functiondef('public.get_visible_book(text)'::regprocedure);`）を共有いただく |
| 20・21：翻訳のテーブル・関数がまだない | 名前のぶつかり | false なら、既存のものを確認してから |
| 22・48：既存のトリガー | 追加するトリガーとの関係 | 情報 |
| 30〜33：feedback | 退会の申請（テーブルを適用する前の受け皿） | 32 が false（kind に制約がある）なら、申請は新しいテーブルを先に適用する |
| 40〜47：拡張機能・ロール・件数 | 動かすための前提 | pg_cron がなければ、自動削除の予約の前に有効にする |

### 本番の確認結果（2026-11-11 実行・共有いただいたもの）
- **26 行すべて true。翻訳の SQL 案はそのまま適用できる形**です。
- get_visible_book の md5 は手元と同じ（`db438c04…`）。本番の定義はリポジトリと同じ。
- 翻訳のテーブル・関数はまだない（名前のぶつかりなし）。profile_book・answers にトリガーはない。
- 公開範囲の値は public・private だけ（ほかの値なし）。
- feedback で退会の申請を受けられる（kind の制約なし・本人だけ insert/select）。
- **pg_cron が未有効**。本番に適用するとき（要承認）に、Database → Extensions で有効にしてから、自動削除の予約をする。
- PostgreSQL は **17.11**。手元のテストは 16 なので、検証用の Supabase（同じ 17 系）での確認で差がないことを確かめる。
- 時刻帯は UTC。年齢は Asia/Tokyo で計算しているので影響なし。
- ユーザーは 2 人。**人数では本番と検証用を見分けられない**ので、検証用の印の条件を「@example.com 以外のユーザーが 1 人でもいれば付けない」に変えた（本番では必ず止まる）。

### 本番と検証用の形の比較（2026-11-11・schema_fingerprint.sql）
検証用は、リポジトリの SQL（schema → patch A → step3 → C → followers_reports → perception_votes）で作った。手元で同じ順に流した結果と、検証用の結果は完全に一致した（PostgreSQL 16 と 17 で差なし）。

| 違い | 原因（手元で照合） | 翻訳のテストへの影響 | 本番への影響（既存） |
|---|---|---|---|
| サークル 5 つの方針（circles・circle_posts の閲覧と投稿・circle_replies・circle_votes の閲覧） | 本番は **schema.sql の前の版**（承認待ちの判定・フォロワー限定サークルの判定がない版）と一致 | なし | **本番では、フォロワー限定のサークルが誰からも見え、承認待ちの人もメンバー限定の投稿を読める可能性**。直すかは別途判断（本番の変更なので要承認） |
| follows・profiles に古い名前の方針が 3 つずつ（中身は今の方針と同じ） | 以前の SQL の名残 | なし | なし（同じ条件の重複） |
| profile_book self update | 本番は with check なし | なし | なし（PostgreSQL は using を with check にも使うので同じ動き） |
| handle_new_user・protect_profile_privileged | リポジトリのどの版とも一致しない。本番の定義を確認した（`staging/inspect_prod_diff.sql`）：handle_new_user は**称号（先駆者）も profile_book も作らない古い版**。protect は書き方だけ違い、動きは同じ | 検証用を本番に合わせた（`staging/align_with_production.sql`） | 新しく登録した人に「先駆者」の称号が付かない（リポジトリの patch C の意図と違う）。直すかは別途判断 |
| profiles の列 | 本番にだけ `bio` 列がある（アプリは使っていない）。列の順番も違う | なし。検証用にも bio を足した | なし |

補足：align の前の検証用の handle_new_user は patch C の版（登録時に profile_book の行を作らない）。patch A の版（作る）のあとに patch C・schema.sql を流すと、この版に戻る。アプリは保存のときに profile_book を作り直すので大きな問題はないが、本番で schema.sql や patch C を流し直すときは注意。

本番に合わせた検証用（手元で同じ形を作って確認）で、翻訳の SQL・退会の申請の SQL を適用 → verify 18 項目・smoke 23 項目がすべて true。

**読み取りだけであることの確認**
- 1 行目の `set transaction read only;` により、この実行の中では書きこみがエラーになる（手元で、同じ形で書きこみが拒否されることを確認済み）。
- 本文は `WITH ... SELECT` 1 つだけ。
- 結果に利用者の文章・メールアドレスは出ない（件数と、公開範囲の値の種類だけ）。

---

## 2. 本番 DB に適用するとき（段階 5・要承認）の、バックアップとロールバック

| 手順 | 場所・方法 |
|---|---|
| ① 自動バックアップの確認 | Supabase → **Database → Backups**（プランによって有無・期間が違う） |
| ② 手元にスキーマとデータのバックアップ | **Connect** で接続文字列を確認し、手元で `pg_dump "<接続文字列>" --schema=public -Fc -f miri-before-translation.dump`。接続文字列（パスワードを含む）は共有しない |
| ③ 直前にもう一度、読み取りの確認 | `check_existing_schema.sql` と `staging/schema_fingerprint.sql`（検証用と同じ形か） |
| ④ 適用 | `proposal_content_translations.sql` → `proposal_account_deletion_requests.sql`（どちらも 1 つのトランザクション。途中で失敗すれば何も変わらない） |
| ⑤ 確認 | `verify_content_translations.sql`（18 項目すべて true）。`enabled = false` のまま |
| 翻訳だけ止める | `update public.translation_settings set enabled = false;` |
| 取り消す | `rollback_content_translations.sql`（一度でも外国へ送ったあとは、先に記録を CSV で書き出す） |
| 最後の手段 | ②のバックアップから戻す（適用後の投稿なども戻るので、原則使わない） |

手元で確認したこと：
- 適用 → 取り消し → 翻訳のテーブル・関数・トリガーが 0 個になる。
- プロフィール・プロフ帳・回答は変化なし。
- 再適用して、確認の SQL がすべて true になる。

---

## 3. SQL の一覧

| ファイル | 内容 | 書きこみ |
|---|---|---|
| `supabase/check_existing_schema.sql` | 本番の確認（26 項目） | しない（read only） |
| `supabase/staging/schema_fingerprint.sql` | 本番と検証用の形の比較 | しない（read only） |
| `supabase/staging/inspect_candidate_project.sql` | 既存のプロジェクト（デモ用など）を検証用に使えるかの確認 | しない（read only） |
| `supabase/staging/00_mark_as_staging.sql` | 検証用の印（@example.com 以外のユーザーが 1 人でもいれば付けない） | 検証用だけ |
| `supabase/staging/seed_test_data.sql` | 架空のデータ（印がなければ止まる） | 検証用だけ |
| `supabase/staging/smoke_test_translation.sql` | 動作確認 23 項目（実行後に何も残らない） | 検証用だけ（取り消される） |
| `supabase/proposal_content_translations.sql` | 翻訳：テーブル 12・関数 24・トリガー 2 | する（要承認） |
| `supabase/proposal_account_deletion_requests.sql` | 退会の申請：テーブル 1・RLS・トリガー 1・関数 1 | する（要承認） |
| `supabase/verify_content_translations.sql` | 適用後の確認（18 項目） | しない |
| `supabase/rollback_content_translations.sql` | 取り消し | する（要承認） |
| `supabase/tests/translation/` | 手元の PostgreSQL でのテスト（197 項目） | 手元だけ |

自動削除の予約（pg_cron を有効にしてから、適用したデータベースで 1 回だけ）：
```sql
select cron.schedule('miri-purge-translation-legal',  '17 3 * * *', $$select public.purge_translation_legal_records()$$);
select cron.schedule('miri-purge-translation-sendlog','22 3 * * *', $$select public.purge_translation_send_log()$$);
select cron.schedule('miri-purge-translation-cost',   '27 3 * * *', $$select public.purge_translation_cost_records()$$);
select cron.schedule('miri-purge-translation-cache',  '37 3 * * *', $$select public.purge_translation_cache()$$);
select cron.schedule('miri-purge-deletion-requests',  '47 3 * * *', $$select public.purge_account_deletion_requests()$$);
```

---

## 4. 本番と検証用 DB の切り替え

`docs/staging-supabase-setup.md` 6 章のとおり、Vercel の環境変数だけで切り替えます。コードは同じです。

| | Production | Preview（このブランチだけ） |
|---|---|---|
| Supabase の 3 つの値 | 本番（いまのまま） | 検証用 |
| `NEXT_PUBLIC_DB_LABEL` | なし | `staging`（画面に「検証環境」と表示） |
| 翻訳の変数 | なし（翻訳はオフ） | 実 API テストのときだけ（`docs/translation-real-api-test-plan.md` 4 章） |

取り違えを防ぐしくみ（コードとテストで確認済み）：
- プレビューで DB に書く設定は、検証用の印がなければ翻訳を止める。
- 本番に検証用の印があれば翻訳を止める。
- 検証用の SQL は、検証用の印のないデータベースでは止まる。
