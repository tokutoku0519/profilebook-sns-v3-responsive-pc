-- ============================================================
-- 【提案・未適用】退会・データ削除の申請（account_deletion_requests）
--
-- ★本番DBへの適用は承認後。★ 適用するまでは、アプリは既存の feedback（kind='account_deletion'）に記録する（従来どおり）。
-- 使う側：src/app/api/account-deletion/route.ts（本人のアクセストークンで書く。service_role は使わない）
--
-- feedback を使い続けない理由
--  ・受付・本人確認・処理中・完了の日時と状態を、意見・不具合の報告と分けて管理したい
--  ・受付中の申請を 1 人 1 件にして、二重の申請や見落としを防ぎたい
--  ・退会したあとも「いつ申請を受け、いつ削除したか」を一定期間残したい（user_id は外部キーで null になる）
--
-- 権限（RLS）
--  ・本人：自分の行を作る（状態は received だけ・運営者の欄は空のまま）／自分の行を読む。変更・削除はできない
--  ・運営者：Supabase の Table Editor・SQL Editor（RLS を通らない）で状態を進める
-- 既存のテーブルは変更しない。
-- ============================================================
begin;

create table if not exists public.account_deletion_requests (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references public.profiles(id) on delete set null,   -- 削除後は null（申請の事実は残す）
  username            text,                                                     -- 申請時点の名前（削除後に申請を特定するため）
  note                text check (char_length(note) <= 1000),
  status              text not null default 'received'
                        check (status in ('received','in_progress','completed','rejected','withdrawn')),
  requested_at        timestamptz not null default now(),
  identity_checked_at timestamptz,        -- 運営者が本人確認をした日時（登録メールへの確認など）
  completed_at        timestamptz,        -- 削除が終わった日時
  handled_note        text,               -- 運営者のメモ（削除した範囲・残した法定の記録など）
  retain_until        timestamptz         -- 完了・却下から 3 年（法務確認で確定）。purge で消す
);
create unique index if not exists account_deletion_requests_one_open
  on public.account_deletion_requests (user_id) where status in ('received','in_progress');
create index if not exists account_deletion_requests_open_idx
  on public.account_deletion_requests (requested_at) where status in ('received','in_progress');

alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from public, anon, authenticated;
grant select, insert on public.account_deletion_requests to authenticated;
grant all on public.account_deletion_requests to service_role;

drop policy if exists "deletion request insert own" on public.account_deletion_requests;
create policy "deletion request insert own" on public.account_deletion_requests for insert to authenticated
  with check (auth.uid() = user_id and status = 'received' and identity_checked_at is null and completed_at is null
              and handled_note is null and retain_until is null);
drop policy if exists "deletion request select own" on public.account_deletion_requests;
create policy "deletion request select own" on public.account_deletion_requests for select to authenticated
  using (auth.uid() = user_id);

-- 完了・却下にしたら、保存期限を自動で入れる
create or replace function public.account_deletion_requests_set_retention()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status in ('completed','rejected','withdrawn') and new.retain_until is null then
    new.retain_until := now() + interval '3 years';
    if new.status = 'completed' and new.completed_at is null then new.completed_at := now(); end if;
  end if;
  return new;
end;
$$;
revoke all on function public.account_deletion_requests_set_retention() from public, anon, authenticated;
drop trigger if exists account_deletion_requests_retention on public.account_deletion_requests;
create trigger account_deletion_requests_retention before update on public.account_deletion_requests
  for each row execute function public.account_deletion_requests_set_retention();

create or replace function public.purge_account_deletion_requests()
returns bigint
language sql security definer set search_path = public
as $$
  with d as (delete from public.account_deletion_requests where retain_until < now() returning 1) select count(*) from d;
$$;
revoke all on function public.purge_account_deletion_requests() from public, anon, authenticated;
grant execute on function public.purge_account_deletion_requests() to service_role;

commit;

-- ============================================================
-- 運営者の作業（SQL Editor）
-- ============================================================
-- ① 受付中の申請（古い順）。7 日を過ぎたものは overdue
-- select id, username, requested_at, status, now() - requested_at > interval '7 days' as overdue
--   from public.account_deletion_requests where status in ('received','in_progress') order by requested_at;
-- ② 本人確認をしたら
-- update public.account_deletion_requests set status = 'in_progress', identity_checked_at = now() where id = '<id>';
-- ③ 削除：Supabase の Authentication → Users でその人を削除（profiles 以下は外部キーで削除。法定の記録は残る）
-- ④ 完了にする（保存期限は自動で入る）
-- update public.account_deletion_requests set status = 'completed', handled_note = '<削除した範囲>' where id = '<id>';
-- 適用前の申請（feedback）：select * from public.feedback where kind = 'account_deletion' and status = 'new' order by created_at;

-- 取り消し
-- begin;
-- drop trigger if exists account_deletion_requests_retention on public.account_deletion_requests;
-- drop function if exists public.account_deletion_requests_set_retention();
-- drop function if exists public.purge_account_deletion_requests();
-- drop table if exists public.account_deletion_requests;
-- commit;
