# アクセス制御 SQL（0001・0002）のレビュー資料（2026-11-19）

> **状態：案・未適用。** 本番には適用していません。検証用（miri-staging）にも、まだ適用していません（適用はレビュー後に、ご自身の SQL Editor で）。
> この資料の SQL は、リポジトリの `supabase/migrations/` のファイルと同じものです（末尾の付録に全文）。

## 0. 先にお伝えすること（前回の提示からの変更 2 点）

| # | 変更 | 理由 |
|---|---|---|
| 1 | `circles` を読む方針を、「公開」「自分が作成者」は**行そのものの値で判定**するように変更 | 前回の案では、アプリのサークル作成（`insert ... returning` で作った行を読み返す）が**失敗する**ことが、今回のテストで分かりました（判定の関数からは、同じ命令で作った行がまだ見えないため）。修正前の案では新しいテストが FAIL、修正後は PASS を確認 |
| 2 | 判定の関数 2 つ（`circle_post_target_is_member`・`circle_join_status_ok`）に、「たずねる人がそのサークルを見られる・メンバーである」条件を追加 | public スキーマの関数は API（`/rest/v1/rpc/...`）から直接呼べるため、前回の案では、**メンバーでないサークルのメンバーや、見えないサークルの参加方式を調べられました**。方針から呼ぶときの結果は変わりません |

## 1. 変える方針・関数の一覧

**テーブル・列・データは変えません。** 変えるのは RLS の方針（ポリシー）と、方針から呼ぶ判定の関数だけです。

### 1-1. 0001 サークル

| テーブル | 方針 | 本番の今（2026-11-13 の読み取り） | 0001 のあと |
|---|---|---|---|
| circles | readable（読む） | `true`（**だれでも。ログインしていない人も**） | ログインしていて、公開 ／ 自分が作成者 ／ 作成者のフォロワー ／ 参加（申請中を含む）している |
| circles | insert own | `auth.uid() = created_by` | ＋ 公認のサークルは公認アカウントだけ |
| circles | update own | using だけ（あとから公認に変えられる） | ＋ with check で同じ条件 |
| circle_members | readable | `true`（**申請中もだれにでも見える**） | 自分の行 ／ 作成者 ／ 見えるサークルの承認済みメンバー |
| circle_members | join（参加） | `auth.uid() = user_id`（**承認制でも自分を「メンバー」で登録できる**） | ＋ 見えるサークルだけ ＋ 承認制は「申請中」だけ（作成者を除く） |
| circle_members | owner update（承認） | 作成者 | ＋ 状態は member / pending だけ |
| circle_posts | readable / insert | 参加者（**申請中を含む**） | 承認済みメンバーだけ |
| circle_replies | readable | 参加者（申請中を含む） | 承認済みメンバーだけ |
| circle_replies | insert | `auth.uid() = user_id`（**だれでも返信できる**） | 承認済みメンバーだけ |
| circle_votes | readable | 参加者（申請中を含む） | 承認済みメンバーだけ |
| circle_votes | insert | `auth.uid() = user_id`（**だれでも・だれにでも投票できる**） | 承認済みメンバーが、承認済みメンバーに |
| （変えない） | circles delete own・circle_members leave / owner delete・circle_posts delete | — | そのまま |

追加する関数（7 つ）：`circle_viewer_can_see(uuid)`・`circle_viewer_is_member(uuid)`・`circle_viewer_is_owner(uuid)`・`circle_post_viewer_is_member(uuid)`・`circle_post_target_is_member(uuid, uuid)`・`circle_join_status_ok(uuid, text)`・`viewer_is_official()`

### 1-2. 0002 コメント・リアクション・ブログ・日記

| テーブル | 方針 | 本番の今 | 0002 のあと |
|---|---|---|---|
| comments | readable | `true`（**フォロワー限定・非公開の回答へのコメントも、だれでも読める**） | その回答を読める人だけ（answers の方針に従う） |
| comments | insert own | 本人名義 | ＋ その回答を読める |
| reactions | readable / insert own | `true` / 本人名義 | comments と同じ |
| blog_comments | readable / insert own | `true` / 本人名義 | その記事を読める人だけ（blog_posts の方針に従う） |
| blog_likes | readable / insert own | `true` / 本人名義 | blog_comments と同じ |
| diary_page_mentions | readable | `true`（**だれが日記に招待されたか、だれでも読める**） | 招待された本人 ／ その日記を読める人 |
| diary_entries | update own | **なし**（編集が黙って失敗する不具合） | 本人だけ・日記を読める場合 |
| （変えない） | 各 delete own・diary の insert / delete | — | そのまま |

0002 は関数を追加しません（既存の `can_see_diary_page` を使います）。

## 2. 役割ごとの読み書き（0001・0002 のあと）

○ できる ／ × できない。「作成者」はサークル・回答・記事・日記を作った人。

| 操作 | ログインなし | 関係のない人 | 作成者のフォロワー | 申請中 | 承認済みメンバー | 作成者 |
|---|---|---|---|---|---|---|
| 公開サークルを見る・メンバー一覧 | × | ○ | ○ | ○ | ○ | ○ |
| フォロワー限定サークルを見る | × | × | ○ | ○ | ○ | ○ |
| ほかの人の「申請中」を見る | × | × | × | 自分だけ | × | ○ |
| サークルの投稿・返信・投票を読む | × | × | × | × | ○ | ○ |
| 投稿・返信する | × | × | × | × | ○ | ○ |
| 投票する（相手はメンバーだけ） | × | × | × | × | ○ | ○ |
| 自由参加のサークルに参加 | × | ○（見えるもの） | ○ | — | — | — |
| 承認制のサークルに参加 | × | 申請だけ | 申請だけ | — | — | ○（作成時） |
| 申請を承認する | × | × | × | × | × | ○ |
| 公認のサークルを作る | × | 公認アカウントだけ | ← | ← | ← | ← |
| 公開の回答・記事のコメント・リアクションを読む | ○ | ○ | ○ | | | ○ |
| フォロワー限定の回答・記事のコメントなどを読む | × | × | ○ | | | ○ |
| 非公開の回答のコメントを読む | × | × | × | | | ○ |
| コメント・リアクション・いいねを書く | × | 読めるものだけ | 読めるものだけ | | | ○ |
| 日記の招待先を読む | × | × | 日記を読めれば | | 招待された本人 ○ | ○ |
| 日記の自分の書きこみを編集 | × | 自分のものだけ | ← | | | ○ |

## 3. SECURITY DEFINER の安全性

| 確認したこと | 内容 |
|---|---|
| なぜ SECURITY DEFINER か | 方針の中から別のテーブル（circles ↔ circle_members）を読むと、方針どうしが互いを呼んで無限に循環する。関数の所有者（postgres）の権限で RLS を通らずに判定して、循環を防ぐ |
| 答える内容 | すべて **true / false だけ**。行の中身は返さない |
| だれについて答えるか | 「いまログインしている人（`auth.uid()`）」についてだけ。ほかの人について調べられる 2 つ（投票の相手・参加方式）は、**たずねる人がそのサークルのメンバー・見られる人の場合だけ**答える（0 章の変更 2） |
| search_path | すべて `set search_path = public` に固定。中のテーブル・関数はすべて `public.` `auth.` を付けて書いている（ほかのスキーマの同じ名前のものに置きかえられない） |
| 実行の権限 | `public` からすべて取り上げ、`anon`・`authenticated`・`service_role` にだけ実行を許可（方針の中で、読む人の役の権限で呼ばれるため必要） |
| API から直接呼ばれたら | `/rest/v1/rpc/circle_viewer_can_see` などとして呼べるが、上のとおり「自分が見られるか」が分かるだけ。テストで、メンバーでない人が直接呼んでも何も分からないことを確認 |
| 書きこみ | どの関数もデータを書かない（`stable`、select だけ） |

## 4. 取り消し SQL と、その限界

- `0002_..._rollback.sql` → `0001_..._rollback.sql` の順に実行（1 つずつのトランザクション）。方針を本番の 11-13 の定義に戻してから、関数を消します。
- **確認したこと**：手元の「本番の形」で、適用 → 取り消し のあと、スキーマの指紋（テーブル・列・RLS・方針・関数・トリガーの全体）が**適用前と完全に同じ**（`TOTAL|148|fb88fd17…`）。検証用の形（実アカウント入り）でも、取り消すと方針のハッシュが適用前と同じに戻り、確認 SQL の結果も適用前と同じ（22 件の不具合が再び出る）になりました。
- **限界**
  1. **取り消すと、不具合（限定の情報が読める・承認を回避できる）も元に戻ります。** 一時的な避難としてだけ使ってください。
  2. **適用中に書かれたデータは残ります**（例：日記の書きこみの編集、承認制への申請）。どれも取り消し後の方針でも正しいデータなので、問題は起きません。
  3. 取り消し SQL は「11-13 の本番の定義」を書き戻します。**それ以後に本番の方針が変わっていると、その変更も消えます。** 適用の直前に `supabase/staging/inspect_access_policies.sql`（読み取りだけ）で、本番が「適用前（2026-11-13 の本番と同じ）」であることを確かめてください。
  4. 適用**前**に（API で承認を回避するなどして）できてしまった不正なメンバーは、適用しても残ります。正規に承認されたメンバーと見分ける記録がないため、自動では消しません（クローズドテスト前の本番は利用者が少ないので、必要なら一覧を見て判断）。

## 5. 既存データ・動作への影響

| 対象 | 影響 |
|---|---|
| 既存データ | **変更・削除なし**（方針と関数だけ）。行数を適用前後で確認 |
| 認証・ログイン | なし（auth スキーマ・プロフィール・プロフ帳の方針は変えない） |
| フォロー | フォローの方針は変えない。フォローすると、相手のフォロワー限定サークルがすぐ見えるようになり、外すと（参加していなければ）見えなくなる |
| サークルの参加・作成・承認 | アプリの動き（作成＝作成者を member で登録、自由参加＝member、承認制＝pending、作成者の承認・却下、退会）はすべてそのまま通ることをテストで確認。**作成（insert ... returning）を含む**（0 章の変更 1） |
| 画面に見える変化 | ① ログインしていない人にサークルが出ない（アプリはログイン必須なので通常は変化なし）② 作成者以外には「申請中」の一覧が空になる ③ メンバーでない人の返信・メンバー以外への投票が失敗する（画面からは通常できない操作）④ **日記の書きこみの編集が、保存されるようになる**（以前は黙って失敗）⑤ 公開の回答・記事のコメントは、これまでどおりだれでも読める（`/b/` の公開ページも） |
| 速さ | 行ごとに小さな判定（主キー・外部キーでの検索）が加わる。クローズドテストの規模では問題にならない見込み |

## 6. 検証の結果

| 場所 | 内容 | 結果 |
|---|---|---|
| 手元の PostgreSQL 16・本番の形（`supabase/tests/closed-test/run.sh`） | 6 人の役（作成者・フォロワー・関係なし・メンバー・申請中・公認）で読み書き 45 項目 ＋ 取り消しで形が同じ ＋ 2 回適用しても失敗しない | **47 / 47 PASS** |
| 同上・前回の案の 0001 | サークル作成の読み返し | FAIL（今回の修正で直したことの確認） |
| 手元の「検証用の形」（00_mark_as_staging ＋ seed_test_data、Supabase と同じ `auth.uid()`）で `verify_0001_0002_access.sql` | **適用前**：alice / bob / carol / dave / anon で 45 項目 | **22 件が不具合として再現**（限定のコメントが読める、F が見える、承認の回避、申請中が見える、日記の編集が失敗 など） |
| 同上 | **適用後**：47 項目（関数を直接呼ぶ確認 2 件を含む） | **47 / 47 true** |
| 同上 | 2 回続けて実行 | 確認用のデータは何も残らない（サークル・回答の件数が実行前と同じ） |
| 同上 | 取り消し後 | 方針のハッシュ・確認結果とも適用前と同じ |

**本番の実データでは何も実行していません。** 実際の検証用 Supabase（miri-staging）での実行は、次の手順でお願いします。

## 7. 検証用（miri-staging）で確かめる手順

すべて**検証用プロジェクトの** SQL Editor で行います（本番のプロジェクトでないことを、画面左上のプロジェクト名で確認してください）。

1. `supabase/staging/inspect_access_policies.sql` を Run → `state` が「適用前（2026-11-13 の本番と同じ）」であること（違えば結果を共有してください。0 章の注意のとおり、PostgreSQL の版の違いでずれることがあります）
2. `supabase/staging/verify_0001_0002_access.sql` を Run → **適用前の結果**として保存（22 件が `ok = false` になるはず。不具合の再現）
3. `supabase/migrations/0001_circle_access_control.sql` を Run → `0002_comment_reaction_access_control.sql` を Run
4. もう一度 `verify_0001_0002_access.sql` を Run → **47 行すべて `ok = true`** なら合格
5. `inspect_access_policies.sql` → 「適用後（0001・0002 と同じ）」
6. （任意）取り消しの練習：`0002_..._rollback.sql` → `0001_..._rollback.sql` → 手順 1・2 と同じ結果に戻ることを確認 → もう一度 3 を適用
7. プレビュー（`claude/closed-test-1`、検証用 DB につないだもの）で、alice / bob / carol / dave に順にログインし、画面での確認（最終報告の「プレビューで確認する操作手順」）

`verify_0001_0002_access.sql` は、確認用のサークルなどを一時的に作り、最後にすべて取り消します。検証用の印がない・`@example.com` 以外のユーザーがいるデータベースでは、最初に止まります（本番では動きません）。

## 8. 本番に適用するとき（承認をいただいたあと）

1. 本番のバックアップを取る（Supabase の Database → Backups。無料プランで手動バックアップがない場合は、Table Editor から circles・circle_members・comments など対象テーブルを CSV で書き出し）
2. 本番で `inspect_access_policies.sql`（読み取りだけ）→「適用前」であること（または検証用の適用前と同じ policies_md5）
3. 0001 → 0002 を Run（どちらも 1 トランザクション。途中で失敗すれば何も変わらない）
4. 本番で `inspect_access_policies.sql` →「適用後」
5. 本番のアプリで、自分のアカウントでサークル一覧・回答のコメント・日記が今までどおり見えることを確認
6. 問題があれば、0002 → 0001 の取り消し SQL（4 章の限界に注意）

---

## 付録：SQL 全文

### `supabase/migrations/0001_circle_access_control.sql`

```sql
-- ============================================================
-- 0001 サークルのアクセス制御（クローズドテスト①の前に必須）【案・未適用】
--
-- 直すこと（本番の今の方針との差。本番の定義は 2026-11-13 の読み取り結果で確認）
--  1. フォロワー限定のサークルが、誰からでも（ログインしていない人からも）読める
--     → 公開・作成者・作成者のフォロワー・参加（申請中を含む）している人だけ。ログインしていない人は読めない
--  2. メンバー限定の投稿・返信・投票を、承認待ちの人も読める・書ける
--     → status = 'member' の人だけ
--  3. 承認制のサークルに、API から自分を「メンバー」として直接登録できる（承認の回避。リポジトリの新しい版にもある穴）
--     → 承認制では「申請中」でしか登録できない（作成者を除く）
--  4. 返信は、メンバーでなくても書ける → メンバーだけ
--  5. 投票の相手が、そのサークルのメンバーかを確かめていない → メンバーだけ
--  6. 公認バッジ付きのサークルを、だれでも作れる → 公認アカウントだけ
--  7. ほかの人の「申請中」がだれにでも見える → 本人と作成者だけ
--
-- 変えないもの：テーブル・列・データ（方針と判定の関数だけ）。参加・退会・作成者の承認・却下の動きは同じ。
-- 実行：Supabase の SQL Editor に全文を貼って Run（1 トランザクション。途中で失敗すれば何も変わらない）
-- 取り消し：0001_circle_access_control_rollback.sql（本番の今の定義に戻す）
-- 確かめ方：supabase/tests/closed-test/test_0001_0002.sql（手元の PostgreSQL）、適用後は schema_fingerprint.sql
-- ============================================================
begin;

-- ── 判定の関数（RLS の中から呼ぶ。SECURITY DEFINER で RLS を通らずに判定し、方針どうしの循環を防ぐ）
-- いずれも「いまログインしている人（auth.uid()）」についてだけ答える（ほかの人について調べることはできない）
create or replace function public.circle_viewer_can_see(p_circle uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.circles c
     where c.id = p_circle and (
       coalesce(c.visibility, 'public') = 'public'
       or c.created_by = auth.uid()
       or exists (select 1 from public.follows f where f.following_id = c.created_by and f.follower_id = auth.uid())
       or exists (select 1 from public.circle_members m where m.circle_id = c.id and m.user_id = auth.uid())));
$$;
create or replace function public.circle_viewer_is_member(p_circle uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.circle_members m
     where m.circle_id = p_circle and m.user_id = auth.uid() and coalesce(m.status, 'member') = 'member');
$$;
create or replace function public.circle_viewer_is_owner(p_circle uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (select 1 from public.circles c where c.id = p_circle and c.created_by = auth.uid());
$$;
create or replace function public.circle_post_viewer_is_member(p_post uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.circle_posts p
      join public.circle_members m on m.circle_id = p.circle_id
     where p.id = p_post and m.user_id = auth.uid() and coalesce(m.status, 'member') = 'member');
$$;
-- 投票の相手が、その投稿のサークルのメンバーか（たずねられるのは、そのサークルのメンバーだけ。
-- API から直接呼んで、見えないサークルのメンバーを調べることはできない）
create or replace function public.circle_post_target_is_member(p_post uuid, p_target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.circle_post_viewer_is_member(p_post) and exists (
    select 1 from public.circle_posts p
      join public.circle_members m on m.circle_id = p.circle_id
     where p.id = p_post and m.user_id = p_target and coalesce(m.status, 'member') = 'member');
$$;
-- 参加するときの状態：承認制は「申請中」だけ（作成者は除く）。公開参加は「メンバー」でも「申請中」でもよい
-- （見えないサークルについては常に false。API から直接呼んで、見えないサークルの参加方式を調べることはできない）
create or replace function public.circle_join_status_ok(p_circle uuid, p_status text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.circle_viewer_can_see(p_circle) and case
    when p_status = 'pending' then true
    when coalesce(p_status, 'member') = 'member' then exists (
      select 1 from public.circles c
       where c.id = p_circle and (coalesce(c.join_policy, 'open') = 'open' or c.created_by = auth.uid()))
    else false end;
$$;
-- 公認アカウントか（公認のサークルを作れるのは公認アカウントだけ）
create or replace function public.viewer_is_official()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_official, false));
$$;
do $$ declare f text; begin
  foreach f in array array['circle_viewer_can_see(uuid)', 'circle_viewer_is_member(uuid)', 'circle_viewer_is_owner(uuid)',
                           'circle_post_viewer_is_member(uuid)', 'circle_post_target_is_member(uuid, uuid)',
                           'circle_join_status_ok(uuid, text)', 'viewer_is_official()'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated, service_role', f);   -- 方針の中で使うため
  end loop;
end $$;

-- ── circles
drop policy if exists "circles readable"   on public.circles;
drop policy if exists "circles insert own" on public.circles;
drop policy if exists "circles update own" on public.circles;
-- 公開・自分が作成者は、行そのものの値で判定する（作成と同時に読み返す insert ... returning では、
-- 関数からはまだ新しい行が見えないため。アプリのサークル作成がこれを使う）。フォロワー・参加者は関数で判定
create policy "circles readable"   on public.circles for select using (
  auth.uid() is not null
  and (coalesce(visibility, 'public') = 'public' or created_by = auth.uid() or public.circle_viewer_can_see(id)));
create policy "circles insert own" on public.circles for insert
  with check (auth.uid() = created_by and (not coalesce(is_official, false) or public.viewer_is_official()));
create policy "circles update own" on public.circles for update using (auth.uid() = created_by)
  with check (auth.uid() = created_by and (not coalesce(is_official, false) or public.viewer_is_official()));
-- "circles delete own" は変えない

-- ── circle_members
drop policy if exists "circle_members readable"     on public.circle_members;
drop policy if exists "circle_members join"         on public.circle_members;
drop policy if exists "circle_members owner update" on public.circle_members;
create policy "circle_members readable" on public.circle_members for select using (
  user_id = auth.uid()
  or public.circle_viewer_is_owner(circle_id)
  or (coalesce(status, 'member') = 'member' and public.circle_viewer_can_see(circle_id)));
create policy "circle_members join" on public.circle_members for insert with check (
  auth.uid() = user_id and public.circle_viewer_can_see(circle_id) and public.circle_join_status_ok(circle_id, status));
create policy "circle_members owner update" on public.circle_members for update
  using (public.circle_viewer_is_owner(circle_id))
  with check (public.circle_viewer_is_owner(circle_id) and coalesce(status, 'member') in ('member', 'pending'));
-- "circle_members leave"（本人の退会）・"circle_members owner delete"（作成者の却下）は変えない

-- ── circle_posts
drop policy if exists "circle_posts readable" on public.circle_posts;
drop policy if exists "circle_posts insert"   on public.circle_posts;
create policy "circle_posts readable" on public.circle_posts for select using (public.circle_viewer_is_member(circle_id));
create policy "circle_posts insert"   on public.circle_posts for insert
  with check (auth.uid() = user_id and public.circle_viewer_is_member(circle_id));
-- "circle_posts delete"（本人の削除）は変えない

-- ── circle_replies
drop policy if exists "circle_replies readable" on public.circle_replies;
drop policy if exists "circle_replies insert"   on public.circle_replies;
create policy "circle_replies readable" on public.circle_replies for select using (public.circle_post_viewer_is_member(post_id));
create policy "circle_replies insert"   on public.circle_replies for insert
  with check (auth.uid() = user_id and public.circle_post_viewer_is_member(post_id));

-- ── circle_votes
drop policy if exists "circle_votes readable" on public.circle_votes;
drop policy if exists "circle_votes insert"   on public.circle_votes;
create policy "circle_votes readable" on public.circle_votes for select using (public.circle_post_viewer_is_member(post_id));
create policy "circle_votes insert"   on public.circle_votes for insert
  with check (auth.uid() = user_id and public.circle_post_viewer_is_member(post_id) and public.circle_post_target_is_member(post_id, target_id));

commit;
```

### `supabase/migrations/0002_comment_reaction_access_control.sql`

```sql
-- ============================================================
-- 0002 コメント・リアクション・いいね・日記の招待先のアクセス制御【案・未適用】
--
-- 直すこと（本番の今の方針との差）
--  1. お題の回答へのコメント・リアクションが、回答がフォロワー限定・非公開でも、だれでも（ログインしていない人も）読める
--     → その回答を読める人だけ（answers の方針にそのまま従う）。書くときも同じ
--  2. ブログ記事へのコメント・いいねが、記事がフォロワー限定でも、だれでも読める
--     → その記事を読める人だけ（blog_posts の方針に従う）。書くときも同じ
--  3. 日記にだれが招待されたか（diary_page_mentions）が、だれでも読める → その日記を読める人と、招待された本人だけ
--  4. 日記の書きこみ（diary_entries）を編集する方針がなく、編集が黙って失敗する → 本人だけが編集できる（不具合の修正）
--
-- 判定は、親（回答・記事・日記）の既存の方針をそのまま使う（読む人の権限で親を探し、見えなければ 0 件）。
-- 変えないもの：テーブル・列・データ。自分のコメント・いいねの削除。
-- 取り消し：0002_comment_reaction_access_control_rollback.sql
-- ============================================================
begin;

-- ── 回答へのコメント・リアクション
drop policy if exists "comments readable"   on public.comments;
drop policy if exists "comments insert own" on public.comments;
create policy "comments readable"   on public.comments for select using (
  exists (select 1 from public.answers a where a.id = comments.answer_id));
create policy "comments insert own" on public.comments for insert with check (
  auth.uid() = user_id and exists (select 1 from public.answers a where a.id = comments.answer_id));

drop policy if exists "reactions readable"   on public.reactions;
drop policy if exists "reactions insert own" on public.reactions;
create policy "reactions readable"   on public.reactions for select using (
  exists (select 1 from public.answers a where a.id = reactions.answer_id));
create policy "reactions insert own" on public.reactions for insert with check (
  auth.uid() = user_id and exists (select 1 from public.answers a where a.id = reactions.answer_id));

-- ── ブログ記事へのコメント・いいね
drop policy if exists "blog_comments readable"   on public.blog_comments;
drop policy if exists "blog_comments insert own" on public.blog_comments;
create policy "blog_comments readable"   on public.blog_comments for select using (
  exists (select 1 from public.blog_posts p where p.id = blog_comments.post_id));
create policy "blog_comments insert own" on public.blog_comments for insert with check (
  auth.uid() = user_id and exists (select 1 from public.blog_posts p where p.id = blog_comments.post_id));

drop policy if exists "blog_likes readable"   on public.blog_likes;
drop policy if exists "blog_likes insert own" on public.blog_likes;
create policy "blog_likes readable"   on public.blog_likes for select using (
  exists (select 1 from public.blog_posts p where p.id = blog_likes.post_id));
create policy "blog_likes insert own" on public.blog_likes for insert with check (
  auth.uid() = user_id and exists (select 1 from public.blog_posts p where p.id = blog_likes.post_id));

-- ── 日記の招待先・書きこみの編集
drop policy if exists "diary_mentions readable" on public.diary_page_mentions;
create policy "diary_mentions readable" on public.diary_page_mentions for select using (
  user_id = auth.uid() or public.can_see_diary_page(page_id));

drop policy if exists "diary_entries update own" on public.diary_entries;
create policy "diary_entries update own" on public.diary_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.can_see_diary_page(page_id));

commit;
```

### `supabase/migrations/0001_circle_access_control_rollback.sql`

```sql
-- ============================================================
-- 0001 の取り消し：サークルの方針を、本番の適用前の定義（2026-11-13 の読み取り結果）に戻す
-- データには触れない。方針を戻してから、判定の関数を消す。
-- ============================================================
begin;
drop policy if exists "circles readable"   on public.circles;
drop policy if exists "circles insert own" on public.circles;
drop policy if exists "circles update own" on public.circles;
create policy "circles readable"   on public.circles for select using (true);
create policy "circles insert own" on public.circles for insert with check (auth.uid() = created_by);
create policy "circles update own" on public.circles for update using (auth.uid() = created_by);

drop policy if exists "circle_members readable"     on public.circle_members;
drop policy if exists "circle_members join"         on public.circle_members;
drop policy if exists "circle_members owner update" on public.circle_members;
create policy "circle_members readable" on public.circle_members for select using (true);
create policy "circle_members join"     on public.circle_members for insert with check (auth.uid() = user_id);
create policy "circle_members owner update" on public.circle_members for update using (
  exists (select 1 from public.circles c where c.id = circle_members.circle_id and c.created_by = auth.uid()));

drop policy if exists "circle_posts readable" on public.circle_posts;
drop policy if exists "circle_posts insert"   on public.circle_posts;
create policy "circle_posts readable" on public.circle_posts for select using (
  exists (select 1 from public.circle_members m where m.circle_id = circle_posts.circle_id and m.user_id = auth.uid()));
create policy "circle_posts insert" on public.circle_posts for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.circle_members m where m.circle_id = circle_posts.circle_id and m.user_id = auth.uid()));

drop policy if exists "circle_replies readable" on public.circle_replies;
drop policy if exists "circle_replies insert"   on public.circle_replies;
create policy "circle_replies readable" on public.circle_replies for select using (
  exists (select 1 from public.circle_posts p join public.circle_members m on m.circle_id = p.circle_id
           where p.id = circle_replies.post_id and m.user_id = auth.uid()));
create policy "circle_replies insert" on public.circle_replies for insert with check (auth.uid() = user_id);

drop policy if exists "circle_votes readable" on public.circle_votes;
drop policy if exists "circle_votes insert"   on public.circle_votes;
create policy "circle_votes readable" on public.circle_votes for select using (
  exists (select 1 from public.circle_posts p join public.circle_members m on m.circle_id = p.circle_id
           where p.id = circle_votes.post_id and m.user_id = auth.uid()));
create policy "circle_votes insert" on public.circle_votes for insert with check (auth.uid() = user_id);

drop function if exists public.circle_viewer_can_see(uuid);
drop function if exists public.circle_viewer_is_member(uuid);
drop function if exists public.circle_viewer_is_owner(uuid);
drop function if exists public.circle_post_viewer_is_member(uuid);
drop function if exists public.circle_post_target_is_member(uuid, uuid);
drop function if exists public.circle_join_status_ok(uuid, text);
drop function if exists public.viewer_is_official();
commit;
```

### `supabase/migrations/0002_comment_reaction_access_control_rollback.sql`

```sql
-- ============================================================
-- 0002 の取り消し：本番の適用前の定義（2026-11-13 の読み取り結果）に戻す。データには触れない。
-- ============================================================
begin;
drop policy if exists "comments readable"   on public.comments;
drop policy if exists "comments insert own" on public.comments;
create policy "comments readable"   on public.comments for select using (true);
create policy "comments insert own" on public.comments for insert with check (auth.uid() = user_id);

drop policy if exists "reactions readable"   on public.reactions;
drop policy if exists "reactions insert own" on public.reactions;
create policy "reactions readable"   on public.reactions for select using (true);
create policy "reactions insert own" on public.reactions for insert with check (auth.uid() = user_id);

drop policy if exists "blog_comments readable"   on public.blog_comments;
drop policy if exists "blog_comments insert own" on public.blog_comments;
create policy "blog_comments readable"   on public.blog_comments for select using (true);
create policy "blog_comments insert own" on public.blog_comments for insert with check (auth.uid() = user_id);

drop policy if exists "blog_likes readable"   on public.blog_likes;
drop policy if exists "blog_likes insert own" on public.blog_likes;
create policy "blog_likes readable"   on public.blog_likes for select using (true);
create policy "blog_likes insert own" on public.blog_likes for insert with check (auth.uid() = user_id);

drop policy if exists "diary_mentions readable" on public.diary_page_mentions;
create policy "diary_mentions readable" on public.diary_page_mentions for select using (true);

drop policy if exists "diary_entries update own" on public.diary_entries;
commit;
```

### `supabase/staging/inspect_access_policies.sql`

```sql
-- ============================================================
-- 【読み取りだけ・本番でも検証用でも実行できる】0001・0002 が変える方針の「いまの形」を確かめる
--
-- 使い方：SQL Editor に全文を貼って Run。何も書きかえない。
-- 見かた：
--   ・state が「適用前（2026-11-13 の本番と同じ）」なら、0001・0002 の取り消し SQL でこの形に正確に戻せる
--   ・「適用後（0001・0002 と同じ）」なら適用済み
--   ・「どちらとも違う」なら、11-13 のあとに本番の方針が変わっている。適用せず、結果を共有してください
--     （取り消し SQL が、いまの本番の形に戻せない可能性があるため）
-- 期待する値は、手元の「本番の形」のデータベース（PostgreSQL 16）で計算したもの（policies_md5）。
-- PostgreSQL の版によって方針の文字列の書き方がわずかに変わり、同じ方針でも「どちらとも違う」になることがある。
-- そのときは、検証用（本番に合わせ済み・適用前）と本番の policies_md5 が同じかで判断する（同じなら本番も「適用前」の形）。
-- ============================================================
with pol as (
  select tablename, policyname, cmd, coalesce(qual, '') as qual, coalesce(with_check, '') as wc
    from pg_policies
   where schemaname = 'public'
     and tablename in ('circles', 'circle_members', 'circle_posts', 'circle_replies', 'circle_votes',
                       'comments', 'reactions', 'blog_comments', 'blog_likes', 'diary_page_mentions', 'diary_entries')
), h as (
  select count(*) as n, md5(string_agg(tablename || '|' || policyname || '|' || cmd || '|' || qual || '|' || wc, E'\n'
                                       order by tablename, policyname)) as policies_md5
    from pol
), fn as (
  select count(*) as n from pg_proc
   where pronamespace = 'public'::regnamespace
     and proname in ('circle_viewer_can_see', 'circle_viewer_is_member', 'circle_viewer_is_owner', 'circle_post_viewer_is_member',
                     'circle_post_target_is_member', 'circle_join_status_ok', 'viewer_is_official')
)
select h.n as policies, h.policies_md5, fn.n as helper_functions,
       case
         when h.policies_md5 = '5627ccf9fdae7ebf42989d2374edd2b3' and fn.n = 0 then '適用前（2026-11-13 の本番と同じ）'
         when h.policies_md5 = '2d2954f9a85a788c442fcc495860fcfc'  and fn.n = 7 then '適用後（0001・0002 と同じ）'
         else 'どちらとも違う（適用しないでください。結果を共有してください）'
       end as state
  from h, fn;
```

確認 SQL（`supabase/staging/verify_0001_0002_access.sql`）と手元のテスト（`supabase/tests/closed-test/`）は、リポジトリのファイルを参照してください。
