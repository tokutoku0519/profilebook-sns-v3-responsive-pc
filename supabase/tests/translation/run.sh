#!/bin/bash
# 翻訳の SQL 案（supabase/proposal_content_translations.sql）を、手元の PostgreSQL で確かめる。
# 本番の Supabase には接続しない。毎回 trtest というデータベースを作り直す。
#   使い方: PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres supabase/tests/translation/run.sh
#   base.sql … Supabase 相当の環境（anon / authenticated / service_role・auth.uid()・既定の権限付与・
#              profiles / profile_book / follows / answers・get_visible_book は security_patch_A.sql と同じ定義）
#   test.sql … 権限・取り出し・目印・保存・削除・予算の確認（結果は PASS / FAIL で表示）
set -e
D=$(cd "$(dirname "$0")" && pwd); ROOT=$(cd "$D/../../.." && pwd)
P="psql -X -q"
$P -d postgres -c "drop database if exists trtest" -c "create database trtest" >/dev/null
$P -d trtest -v ON_ERROR_STOP=1 -f "$D/base.sql" >/dev/null
$P -d trtest -v ON_ERROR_STOP=1 -f "$ROOT/supabase/proposal_content_translations.sql" >/dev/null
$P -d trtest -f "$D/test.sql" 2>&1 | sed -e 's/^psql:[^ ]* NOTICE:  /  /' -e 's/^NOTICE:  /  /' | grep -E '^==|PASS|FAIL|ERROR'
