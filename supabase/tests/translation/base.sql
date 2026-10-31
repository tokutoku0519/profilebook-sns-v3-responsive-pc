-- Supabase 相当の環境（supabase/tests/translation/run.sh から使う。本番には流さない）
-- Supabase 相当（ロール・auth.uid()・既定の権限付与・profiles/profile_book/follows・get_visible_book は security_patch_A と同じ）
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
create table public.profiles (id uuid primary key, username text unique not null, display_name text, book jsonb);
create table public.profile_book (id uuid primary key references public.profiles(id) on delete cascade, book jsonb not null default '{}'::jsonb);
create table public.follows (follower_id uuid references public.profiles(id) on delete cascade, following_id uuid references public.profiles(id) on delete cascade, primary key (follower_id, following_id));
alter table public.profile_book enable row level security;
create policy self_only on public.profile_book for all using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.get_visible_book(target text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  tgt uuid;
  viewer uuid := auth.uid();
  b jsonb;
  vis jsonb;
  is_follower boolean := false;
  k text;
  result jsonb := '{}'::jsonb;
begin
  select id into tgt from public.profiles where username = target;
  if tgt is null then return '{}'::jsonb; end if;
  select book into b from public.profile_book where id = tgt;
  if b is null then select book into b from public.profiles where id = tgt; end if; -- 移行前フォールバック
  if b is null then return '{}'::jsonb; end if;
  if viewer = tgt then return b; end if;  -- 本人は全部
  vis := coalesce(b->'__visibility', '{}'::jsonb);
  if viewer is not null then
    select exists(select 1 from public.follows f where f.following_id = tgt and f.follower_id = viewer) into is_follower;
  end if;
  for k in select jsonb_object_keys(b) loop
    if k in ('__game','__purchases','__visibility') then continue; end if;
    if (vis->>k) = 'private' then continue; end if;
    if (vis->>k) = 'followers' and not is_follower then continue; end if;
    result := result || jsonb_build_object(k, b->k);
  end loop;
  return result;
end;
$$;
grant execute on function public.get_visible_book(text) to anon, authenticated;

-- answers（schema.sql と同じ列・RLS）
create table public.answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_key text not null, question_title text not null, question_category text, body text, sticker text,
  visibility text not null default 'public', created_at timestamptz default now(), updated_at timestamptz default now(),
  unique(user_id, question_key));
alter table public.answers enable row level security;
create policy "answers readable" on public.answers for select using (
  visibility = 'public' or auth.uid() = user_id
  or (visibility = 'followers' and exists (select 1 from public.follows f where f.following_id = answers.user_id and f.follower_id = auth.uid())));
