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
