# 翻訳機能：実環境検証の進め方（2026-11-11 更新）

本番の翻訳機能は**オフのまま**です。次の操作は、それぞれ別途承認をいただいてから行います。
- 本番 Supabase への SQL 適用
- 本番の翻訳 API の有効化
- 本番の規約・ポリシーの差し替え
- 有料 API の利用

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
| `supabase/staging/00_mark_as_staging.sql` | 検証用の印（ユーザー 10 人超では付けない） | 検証用だけ |
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
