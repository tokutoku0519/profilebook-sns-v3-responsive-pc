-- ============================================================
-- 性格投票（perception_votes）の作成・権限パッチ（冪等・データは消えません）
--
-- まず確認：テーブルがあるか？
--   select to_regclass('public.perception_votes');
--   → NULL なら未作成。下を丸ごと Run してください。
--   → perception_votes と出れば作成済み。下を流しても安全です（ポリシーを最新化）。
-- ============================================================
create table if not exists public.perception_votes (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references public.profiles(id) on delete cascade,
  voter_id  uuid not null references public.profiles(id) on delete cascade,
  category  text not null default 'personality',
  value     text not null,
  created_at timestamptz default now(),
  unique (target_id, voter_id, category)   -- 1人1票（重複投票防止）
);
create index if not exists perception_target_idx on public.perception_votes (target_id, category);

alter table public.perception_votes enable row level security;

drop policy if exists "perception readable"  on public.perception_votes;
drop policy if exists "perception insert own" on public.perception_votes;
drop policy if exists "perception update own" on public.perception_votes;
drop policy if exists "perception delete own" on public.perception_votes;
-- 集計は全員が閲覧可。自分の票だけ作成・変更・削除でき、自分自身への投票は不可。
create policy "perception readable"   on public.perception_votes for select using (true);
create policy "perception insert own" on public.perception_votes for insert with check (auth.uid() = voter_id and voter_id <> target_id);
create policy "perception update own" on public.perception_votes for update
  using (auth.uid() = voter_id) with check (auth.uid() = voter_id and voter_id <> target_id);
create policy "perception delete own" on public.perception_votes for delete using (auth.uid() = voter_id);
