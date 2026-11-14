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
