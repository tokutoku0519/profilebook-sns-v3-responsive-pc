-- ============================================================
-- セキュリティパッチ A（プロフィール帳 book を "本人しか読めない別テーブル" へ分離）
-- 目的：anon key で API を直接叩いても、他人の非公開項目・コイン残高・購入履歴を
--       読めなくする（DB直叩き対策）。他人へは公開分だけ関数経由で見せる。
--
-- 手順：
--   1) この SQL 全体を Supabase SQL Editor に貼って Run（テーブル作成・データ移行・関数作成）。
--   2) アプリが正常に動くことを確認（プロフィール表示・編集・コイン・診断）。
--   3) 最後の「STEP 3」の update を実行して、旧 profiles.book をクリア（漏えいを完全に閉じる）。
-- ※ 何度実行してもデータは消えません（STEP 3 を除く）。STEP 3 は確認後に1回だけ。
-- ============================================================

-- ── STEP 1: 分離先テーブル（本人しか読めない）──────────────
create table if not exists public.profile_book (
  id uuid primary key references public.profiles(id) on delete cascade,
  book jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
alter table public.profile_book enable row level security;
drop policy if exists "profile_book self select" on public.profile_book;
drop policy if exists "profile_book self insert" on public.profile_book;
drop policy if exists "profile_book self update" on public.profile_book;
create policy "profile_book self select" on public.profile_book for select using (auth.uid() = id);
create policy "profile_book self insert" on public.profile_book for insert with check (auth.uid() = id);
create policy "profile_book self update" on public.profile_book for update using (auth.uid() = id);

-- 既存ユーザーの book を移行（まだ無い行だけコピー）
insert into public.profile_book (id, book)
select id, coalesce(book, '{}'::jsonb) from public.profiles
on conflict (id) do nothing;

-- ── STEP 2: 他人に見せてよい book を返す関数（公開分のみ）──────
-- 本人＝全部／他人＝ __game・__purchases・__visibility と、非公開/フォロワー限定
-- 指定の項目を除いて返す（フォロワーはフォロワー限定項目も見える）。__choices は
-- 相性診断のため公開する。
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

-- サインアップ時に profile_book 行も作る（handle_new_user を更新）
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare base_name text;
begin
  base_name := coalesce(nullif(split_part(new.email,'@',1),''), left(new.id::text,8));
  insert into public.profiles (id, username, display_name, titles)
  values (new.id, base_name||'_'||left(new.id::text,4), base_name, array['pioneer']::text[])
  on conflict (id) do nothing;
  insert into public.profile_book (id, book) values (new.id, '{}'::jsonb)
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- STEP 3【アプリ動作を確認してから、1回だけ実行】
-- 旧 profiles.book をクリアして「直叩きでの漏えい」を完全に閉じる。
-- コメント（--）を外して実行してください。
-- ------------------------------------------------------------
-- update public.profiles set book = '{}'::jsonb;
