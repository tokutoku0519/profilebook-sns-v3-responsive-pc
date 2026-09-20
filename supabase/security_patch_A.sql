-- ============================================================
-- セキュリティパッチ A（プロフィール帳 book を "本人しか読めない別テーブル" へ分離）
-- 目的：anon key で API を直接叩いても、他人の非公開項目・コイン残高・購入履歴を
--       読めなくする（DB直叩き対策）。他人へは公開分だけ関数経由で見せる。
--
-- ★実施順（この順番を必ず守る）★
--   1) この SQL（STEP 1 + STEP 2）を Supabase SQL Editor に貼って Run。
--      → profile_book テーブル作成・現在の profiles.book を移行/最新化・公開関数作成。
--      （何度実行してもデータは消えません。STEP 3 は含みません）
--   2) 新しいアプリ（profile_book を読み書きする版）が Vercel にデプロイされるのを待つ。
--   3) 実機で動作確認（プロフィール保存→再読込で残る／コイン／他人プロフィール表示／診断）。
--   4) 問題なければ、いちばん下の「STEP 3」のコメント（--）を外して1回だけ Run。
--      → 旧 profiles.book を空にして、直叩きでの漏えいを完全に閉じる。
-- ※ STEP 3 は「3) の確認が取れてから」。順番を守らないとデータが消えます。
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
-- update は using（既存行）＋ with check（新しい行）両方を本人限定に（upsert 対応）
create policy "profile_book self update" on public.profile_book for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- 既存ユーザーの book を profile_book へ移行／最新化。
-- profiles.book を「現在の正」として反映する（本文がある場合のみ上書き。空での上書きはしない）。
insert into public.profile_book (id, book, updated_at)
select id, coalesce(book, '{}'::jsonb), now() from public.profiles
on conflict (id) do update
  set book = excluded.book, updated_at = now()
  where excluded.book is not null and excluded.book <> '{}'::jsonb;

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
-- ★このファイル内で流すのではなく、専用ファイル security_patch_A_step3.sql を
--   新しいクエリタブに貼って1回だけ Run すること（移行処理の再実行を避けるため）。
-- ============================================================
