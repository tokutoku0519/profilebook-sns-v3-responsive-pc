-- ============================================================
-- 性格投票（perception_votes）作成パッチ【最終版・レビュー用】
--
-- 何をするか
--   1) 投票テーブル public.perception_votes を新規作成（既にあれば作らない）
--   2) RLS を有効化し、「自分の票だけ」読み書きできるポリシーを設定
--   3) 列単位の権限で、更新できるのは value（選んだ性格）だけに制限
--   4) 集計専用の関数 get_perception_summary を作成
--      → 他人には「票数」と「自分が入れたか」だけを返し、誰が投票したかは返さない
--
-- 既存テーブル・既存データには一切変更を加えません（profiles への外部キーを張るだけ）。
-- 何度実行しても同じ状態になります（冪等）。全体を1つのトランザクションで実行し、
-- 途中で失敗した場合は何も変更されません。
--
-- 実行前の確認：select to_regclass('public.perception_votes');  → NULL なら未作成
-- ============================================================
begin;

-- ── 1) テーブル ───────────────────────────────────────────
create table if not exists public.perception_votes (
  id         uuid primary key default gen_random_uuid(),
  target_id  uuid not null references public.profiles(id) on delete cascade, -- 投票される人
  voter_id   uuid not null references public.profiles(id) on delete cascade, -- 投票した人
  category   text not null default 'personality',
  value      text not null,
  created_at timestamptz not null default now(),
  -- 1人が同じ相手に入れられるのはカテゴリごとに1票（付け替えは UPDATE）
  constraint perception_votes_one_vote unique (target_id, voter_id, category),
  -- 自分自身への投票は DB レベルでも不可
  constraint perception_votes_not_self check (voter_id <> target_id),
  -- 現在のカテゴリは「性格」のみ
  constraint perception_votes_category check (category in ('personality')),
  -- 選べる値はアプリの選択肢12個のみ（任意の文字列の書き込みを防ぐ）
  constraint perception_votes_value check (value in (
    'おっとり系','元気・明るい','クール・落ち着き','ちょっと不思議','真面目','天然',
    'ふわふわ','ツンデレ','好奇心旺盛','マイペース','リーダー気質','聞き上手'
  ))
);
-- 集計（相手ごと）用。1人1票の一意制約の索引とは別に、target+category で引く
create index if not exists perception_target_idx on public.perception_votes (target_id, category);

-- ── 2) RLS ────────────────────────────────────────────────
alter table public.perception_votes enable row level security;

drop policy if exists "perception readable"     on public.perception_votes;
drop policy if exists "perception select own"   on public.perception_votes;
drop policy if exists "perception insert own"   on public.perception_votes;
drop policy if exists "perception update own"   on public.perception_votes;
drop policy if exists "perception delete own"   on public.perception_votes;

-- 読める行：自分が入れた票だけ（他人の票の voter_id は読めない＝投票は匿名）
create policy "perception select own" on public.perception_votes
  for select to authenticated using (auth.uid() = voter_id);
-- 追加：自分名義の票だけ、自分以外の人へ
create policy "perception insert own" on public.perception_votes
  for insert to authenticated with check (auth.uid() = voter_id and voter_id <> target_id);
-- 変更：自分の票だけ（変更後も自分の票のまま）
create policy "perception update own" on public.perception_votes
  for update to authenticated
  using (auth.uid() = voter_id) with check (auth.uid() = voter_id and voter_id <> target_id);
-- 取り消し：自分の票だけ
create policy "perception delete own" on public.perception_votes
  for delete to authenticated using (auth.uid() = voter_id);

-- ── 3) テーブル権限（RLS の手前の二重の守り）─────────────
-- 未ログイン(anon)はテーブルを直接触れない。ログイン済みも UPDATE は value 列だけ。
revoke all on public.perception_votes from anon;
revoke all on public.perception_votes from authenticated;
grant select, insert, delete on public.perception_votes to authenticated;
grant update (value) on public.perception_votes to authenticated;

-- ── 4) 集計関数（誰が投票したかは返さない）──────────────
-- 戻り値：選択肢ごとの票数と、「閲覧者自身がその選択肢に入れているか」
create or replace function public.get_perception_summary(target uuid, cat text default 'personality')
returns table (value text, votes bigint, mine boolean)
language sql
stable
security definer
set search_path = public
as $$
  select v.value,
         count(*)::bigint                                         as votes,
         coalesce(bool_or(v.voter_id = auth.uid()), false)         as mine
  from public.perception_votes v
  where v.target_id = target and v.category = cat
  group by v.value
  order by count(*) desc, v.value;
$$;
revoke all on function public.get_perception_summary(uuid, text) from public;
grant execute on function public.get_perception_summary(uuid, text) to anon, authenticated;

commit;
