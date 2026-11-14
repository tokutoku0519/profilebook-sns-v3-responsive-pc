#!/bin/bash
# 0001・0002 を、手元の PostgreSQL の「本番の形」のデータベースで確かめる（本番・検証用には接続しない）
#   使い方: PGHOST=127.0.0.1 PGPORT=5499 PGUSER=postgres supabase/tests/closed-test/run.sh <本番の形のテンプレート DB 名>
#   テンプレート：schema.sql → patch A → step3 → C → followers_reports → perception_votes → staging/align_with_production.sql を流したもの
#   ① 適用 → テスト（PASS / FAIL）　② 適用 → 取り消し → 形（schema_fingerprint）が適用前と同じか
set -e
D=$(cd "$(dirname "$0")" && pwd); ROOT=$(cd "$D/../../.." && pwd); T=${1:?テンプレート DB 名}
P="psql -X -q"
FP="$(cat "$ROOT/supabase/staging/schema_fingerprint.sql")"
$P -d postgres -c "drop database if exists ct_test" -c "create database ct_test template $T" >/dev/null
$P -d ct_test -c "grant usage on schema auth to anon, authenticated" >/dev/null
$P -d ct_test -v ON_ERROR_STOP=1 -f "$ROOT/supabase/migrations/0001_circle_access_control.sql" >/dev/null
$P -d ct_test -v ON_ERROR_STOP=1 -f "$ROOT/supabase/migrations/0002_comment_reaction_access_control.sql" >/dev/null
$P -d ct_test -f "$D/test_0001_0002.sql" 2>&1 | sed -e 's/^psql:[^ ]* NOTICE:  /  /' -e 's/^NOTICE:  /  /' | grep -E '^==|PASS|FAIL|ERROR'
echo '== 取り消し：適用 → 取り消し で、形が適用前と同じか'
$P -d postgres -c "drop database if exists ct_rb" -c "create database ct_rb template $T" >/dev/null
before=$($P -d ct_rb -Atc "$FP" | grep '^TOTAL')
$P -d ct_rb -v ON_ERROR_STOP=1 -f "$ROOT/supabase/migrations/0001_circle_access_control.sql" -f "$ROOT/supabase/migrations/0002_comment_reaction_access_control.sql" >/dev/null
mid=$($P -d ct_rb -Atc "$FP" | grep '^TOTAL')
$P -d ct_rb -v ON_ERROR_STOP=1 -f "$ROOT/supabase/migrations/0002_comment_reaction_access_control_rollback.sql" -f "$ROOT/supabase/migrations/0001_circle_access_control_rollback.sql" >/dev/null
after=$($P -d ct_rb -Atc "$FP" | grep '^TOTAL')
echo "  適用前 $before / 適用後 $mid / 取り消し後 $after"
[ "$before" = "$after" ] && echo "  PASS 取り消すと適用前と同じ形に戻る" || echo "  FAIL 取り消しても適用前と形が違う"
echo '== 2 回適用しても失敗しない'
$P -d ct_rb -v ON_ERROR_STOP=1 -f "$ROOT/supabase/migrations/0001_circle_access_control.sql" -f "$ROOT/supabase/migrations/0001_circle_access_control.sql" -f "$ROOT/supabase/migrations/0002_comment_reaction_access_control.sql" -f "$ROOT/supabase/migrations/0002_comment_reaction_access_control.sql" >/dev/null && echo "  PASS"
