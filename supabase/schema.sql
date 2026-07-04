-- Supabase SQL Editorで実行するMVP用スキーマ
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  bio text,
  avatar_url text,
  cover_theme text default 'pink-note',
  created_at timestamptz default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null default '定番',
  answer_type text not null default 'text',
  choices jsonb,
  is_sponsored boolean default false,
  sponsor_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  body text,
  selected_choices jsonb,
  decoration jsonb default '{}'::jsonb,
  visibility text default 'public',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, question_id)
);

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key(follower_id, following_id),
  constraint no_self_follow check (follower_id <> following_id)
);

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references public.answers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('like','same','wakaru','natsukashii')),
  created_at timestamptz default now(),
  unique(answer_id, user_id, type)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references public.answers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.questions enable row level security;
alter table public.answers enable row level security;
alter table public.follows enable row level security;
alter table public.reactions enable row level security;
alter table public.comments enable row level security;

create policy "profiles are readable" on public.profiles for select using (true);
create policy "users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "users can update own profile" on public.profiles for update using (auth.uid() = id);

create policy "questions are readable" on public.questions for select using (true);

create policy "public answers are readable" on public.answers for select using (visibility = 'public' or auth.uid() = user_id);
create policy "users can insert own answers" on public.answers for insert with check (auth.uid() = user_id);
create policy "users can update own answers" on public.answers for update using (auth.uid() = user_id);

create policy "follows are readable" on public.follows for select using (true);
create policy "users can follow" on public.follows for insert with check (auth.uid() = follower_id);
create policy "users can unfollow" on public.follows for delete using (auth.uid() = follower_id);

create policy "reactions are readable" on public.reactions for select using (true);
create policy "users can react" on public.reactions for insert with check (auth.uid() = user_id);
create policy "users can remove own reactions" on public.reactions for delete using (auth.uid() = user_id);

create policy "comments are readable" on public.comments for select using (true);
create policy "users can comment" on public.comments for insert with check (auth.uid() = user_id);

-- ============================================================
-- ▼ 追加分: お問い合わせ & 退会（アカウント削除）
--   既にschema.sqlを実行済みのプロジェクトは、この行から下だけを
--   SQL Editorで実行すればOKです。
-- ============================================================

-- ── お問い合わせ ──────────────────────────────────────────────
-- user_id はログイン中なら自動で紐付け。退会後も対応できるよう
-- ユーザー削除時は null にして問い合わせ自体は残す。
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  category text not null default 'other'
    check (category in ('bug','account','deletion','feature','report','other')),
  body text not null check (char_length(body) between 1 and 2000),
  status text not null default 'open'
    check (status in ('open','in_progress','resolved','closed')),
  admin_reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.inquiries enable row level security;

-- ログイン前のユーザーも問い合わせできるよう、user_id無しの投稿も許可
create policy "users can create inquiries" on public.inquiries
  for insert with check (user_id is null or auth.uid() = user_id);
-- 自分の問い合わせ（と運営からの返信）だけ閲覧可能
create policy "users can read own inquiries" on public.inquiries
  for select using (auth.uid() = user_id);

-- ── 退会時のアンケート（任意・匿名） ─────────────────────────
create table if not exists public.account_deletion_feedback (
  id uuid primary key default gen_random_uuid(),
  reason text,
  detail text,
  created_at timestamptz not null default now()
);

alter table public.account_deletion_feedback enable row level security;

create policy "authenticated can leave deletion feedback"
  on public.account_deletion_feedback
  for insert to authenticated with check (true);

-- ── 退会（アカウント削除）RPC ─────────────────────────────────
-- クライアント(anonキー)からは auth.users を直接削除できないため、
-- security definer 関数経由で「自分自身のみ」を削除する。
-- auth.users の削除により profiles → answers / follows / reactions /
-- comments が外部キーのcascadeで連鎖削除され、inquiries.user_id は
-- null になる（問い合わせ対応履歴として本文は残る）。
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_account() from public;
grant execute on function public.delete_account() to authenticated;
