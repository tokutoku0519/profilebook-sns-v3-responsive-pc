-- ============================================================
-- 【検証用プロジェクトだけで実行】検証用を、本番の今の形に合わせる
--
-- schema_fingerprint.sql の比較（2026-11-11）で本番と違ったところを、本番と同じ定義にする。
-- 本番の定義は、本番で読み取りだけの SQL（check_existing_schema.sql・inspect_prod_diff.sql・
-- schema_fingerprint.sql）で確かめたもの。リポジトリの新しい版ではなく、本番の今の版に合わせる。
--
--  1. profiles に bio 列（本番にだけある。アプリは使っていない）
--  2. handle_new_user：本番の版（登録時に profiles だけを作る。称号・profile_book は作らない）
--  3. protect_profile_privileged：本番の版（動きはリポジトリと同じ。書き方だけ違う）
--  4. サークルの方針 5 つ：本番の版（schema.sql の前の版）
--  5. follows・profiles の古い名前の方針 6 つ（本番にだけある。中身は今の方針と同じ）
--  6. profile_book self update：本番の版（with check なし）
--
-- ・検証用の印がない、または @example.com 以外のユーザーがいるデータベースでは、何もせずに止まる。
-- ・全体を 1 つのブロックで実行するので、途中で止まれば何も変わらない。
-- ・合わせたあとも profiles の列の「順番」だけは本番と違う（列の順番は作り直さないと変えられない。動きには影響しない）。
-- ============================================================
do $outer$
begin
  if to_regclass('public._miri_environment') is null then
    raise exception '検証用の印がありません。本番では実行しないでください';
  end if;
  if not exists (select 1 from public._miri_environment where name = 'staging') then
    raise exception '検証用の印がありません。本番では実行しないでください';
  end if;
  if exists (select 1 from auth.users where email is null or lower(email) not like '%@example.com') then
    raise exception 'テスト用（@example.com）以外のユーザーがいます。このデータベースでは実行しません';
  end if;

  -- 1. bio 列
  alter table public.profiles add column if not exists bio text;

  -- 2. handle_new_user（本番の定義と 1 文字も違わないように書いている）
  execute $sql$CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare base_name text;
begin
  base_name := coalesce(nullif(split_part(new.email, '@', 1), ''), left(new.id::text, 8));
  insert into public.profiles (id, username, display_name)
  values (new.id, base_name || '_' || left(new.id::text, 4), base_name)
  on conflict (id) do nothing;
  return new;
end; $function$$sql$;

  -- 3. protect_profile_privileged
  execute $sql$CREATE OR REPLACE FUNCTION public.protect_profile_privileged()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is not null and coalesce(auth.role(),'') = 'authenticated' then
    new.is_official := old.is_official;
    new.titles := old.titles;
  end if;
  return new;
end; $function$$sql$;

  -- 4. サークルの方針（本番の版）
  drop policy if exists "circles readable" on public.circles;
  create policy "circles readable" on public.circles for select using (true);
  drop policy if exists "circle_posts readable" on public.circle_posts;
  drop policy if exists "circle_posts insert"   on public.circle_posts;
  create policy "circle_posts readable" on public.circle_posts for select using (
    exists (select 1 from public.circle_members m where m.circle_id = circle_posts.circle_id and m.user_id = auth.uid())
  );
  create policy "circle_posts insert" on public.circle_posts for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.circle_members m where m.circle_id = circle_posts.circle_id and m.user_id = auth.uid())
  );
  drop policy if exists "circle_replies readable" on public.circle_replies;
  create policy "circle_replies readable" on public.circle_replies for select using (
    exists (
      select 1 from public.circle_posts p
      join public.circle_members m on m.circle_id = p.circle_id
      where p.id = circle_replies.post_id and m.user_id = auth.uid()
    )
  );
  drop policy if exists "circle_votes readable" on public.circle_votes;
  create policy "circle_votes readable" on public.circle_votes for select using (
    exists (
      select 1 from public.circle_posts p
      join public.circle_members m on m.circle_id = p.circle_id
      where p.id = circle_votes.post_id and m.user_id = auth.uid()
    )
  );

  -- 5. 古い名前の方針（本番にだけある）
  drop policy if exists "follows are readable" on public.follows;
  drop policy if exists "users can follow"     on public.follows;
  drop policy if exists "users can unfollow"   on public.follows;
  create policy "follows are readable" on public.follows for select using (true);
  create policy "users can follow"     on public.follows for insert with check (auth.uid() = follower_id);
  create policy "users can unfollow"   on public.follows for delete using (auth.uid() = follower_id);
  drop policy if exists "profiles are readable"       on public.profiles;
  drop policy if exists "users can insert own profile" on public.profiles;
  drop policy if exists "users can update own profile" on public.profiles;
  create policy "profiles are readable"        on public.profiles for select using (true);
  create policy "users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
  create policy "users can update own profile" on public.profiles for update using (auth.uid() = id);

  -- 6. profile_book self update（本番の版）
  drop policy if exists "profile_book self update" on public.profile_book;
  create policy "profile_book self update" on public.profile_book for update using (auth.uid() = id);
end $outer$;

select '本番に合わせました。schema_fingerprint.sql をもう一度実行して、本番と比べてください' as result;
