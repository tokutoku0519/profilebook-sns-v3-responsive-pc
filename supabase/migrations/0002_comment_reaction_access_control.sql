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
