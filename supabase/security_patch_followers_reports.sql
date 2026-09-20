-- ============================================================
-- セキュリティパッチ：①フォロワー限定回答のRLS厳格化 ＋ ②通報(reports)テーブル
-- Supabase SQL Editor に貼って Run（冪等・データは消えません）。
-- ============================================================

-- ① 回答の閲覧ポリシーを厳格化
--   公開=誰でも / 本人=常に / フォロワー限定=作者をフォローしている人だけ / 非公開=本人のみ
drop policy if exists "answers readable" on public.answers;
create policy "answers readable" on public.answers for select using (
  visibility = 'public'
  or auth.uid() = user_id
  or (visibility = 'followers' and exists (
        select 1 from public.follows f
        where f.following_id = answers.user_id and f.follower_id = auth.uid()
      ))
);

-- ② 通報（最小構成）：誰でも自分名義で通報でき、閲覧は本人のぶんのみ。
--    運営は SQL Editor / service_role で reports を確認して手動対応する。
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null,               -- answer / blog / diary / comment / profile
  target_id   text not null,               -- 対象のID（文字列で保持）
  reason      text default '',
  status      text not null default 'open', -- open / handled
  created_at  timestamptz default now()
);
create index if not exists reports_status_idx on public.reports (status, created_at);

alter table public.reports enable row level security;
drop policy if exists "reports insert own" on public.reports;
drop policy if exists "reports select own" on public.reports;
create policy "reports insert own" on public.reports for insert with check (auth.uid() = reporter_id);
create policy "reports select own" on public.reports for select using (auth.uid() = reporter_id);

-- 運営用：未対応の通報を見る例
--   select * from public.reports where status = 'open' order by created_at desc;
-- 対応済みにする例
--   update public.reports set status = 'handled' where id = '<report id>';
