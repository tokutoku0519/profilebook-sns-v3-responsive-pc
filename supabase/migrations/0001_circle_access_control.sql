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
-- 投票の相手が、その投稿のサークルのメンバーか
create or replace function public.circle_post_target_is_member(p_post uuid, p_target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.circle_posts p
      join public.circle_members m on m.circle_id = p.circle_id
     where p.id = p_post and m.user_id = p_target and coalesce(m.status, 'member') = 'member');
$$;
-- 参加するときの状態：承認制は「申請中」だけ（作成者は除く）。公開参加は「メンバー」でも「申請中」でもよい
create or replace function public.circle_join_status_ok(p_circle uuid, p_status text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
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
create policy "circles readable"   on public.circles for select using (public.circle_viewer_can_see(id));
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
