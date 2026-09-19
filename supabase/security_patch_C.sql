-- ============================================================
-- セキュリティパッチ C（称号・公認バッジの自己改ざん防止＋先駆者の自動付与）
-- これだけを Supabase の SQL Editor に貼って Run すればOK。
-- 既存テーブル・データには一切触れません（何度実行しても安全）。
-- ============================================================

-- サインアップ時に profiles を自動作成＋「先駆者」称号を自動付与
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base_name text;
begin
  base_name := coalesce(nullif(split_part(new.email, '@', 1), ''), left(new.id::text, 8));
  insert into public.profiles (id, username, display_name, titles)
  values (
    new.id,
    base_name || '_' || left(new.id::text, 4),
    base_name,
    array['pioneer']::text[]
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 権限列の保護：一般ユーザーは is_official / titles を書き換え不可（旧値へ戻す）
create or replace function public.protect_profile_privileged()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is not null and coalesce(auth.role(), '') = 'authenticated' then
    new.is_official := old.is_official;
    new.titles := old.titles;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_privileged_trg on public.profiles;
create trigger protect_profile_privileged_trg
  before update on public.profiles
  for each row execute function public.protect_profile_privileged();

-- 既存ユーザーへ「先駆者」称号をバックフィル
update public.profiles
set titles = array(select distinct e from unnest(coalesce(titles, array[]::text[]) || array['pioneer']) e)
where not ('pioneer' = any(coalesce(titles, array[]::text[])));
