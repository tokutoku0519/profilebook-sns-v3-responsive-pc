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
