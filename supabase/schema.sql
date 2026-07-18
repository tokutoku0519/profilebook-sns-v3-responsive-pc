-- ============================================================
-- Miri MVP スキーマ（共有SNS＋永続化）
-- Supabase の SQL Editor に貼り付けて実行してください。
-- 何度でも再実行できるよう冪等（if not exists / drop ... if exists）に記述。
-- 対象: プロフィール / お題回答 / リアクション / コメント / フォロー
-- ============================================================

-- ── profiles：ユーザー本体＋プロフィール帳 ─────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  avatar_url text,
  cover_theme text default 'default',
  -- プロフィール帳の中身（nickname/birthday/mbti/hobby/best3/custom等）を
  -- まるごと JSON で持つ。アプリのデータ形をそのまま保存できる。
  book jsonb default '{}'::jsonb,
  is_official boolean default false,   -- 企業/公認アカウント
  titles text[] default '{}',          -- 称号（official / founder など）
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- 旧スキーマから移行する場合に不足カラムを追加（既存環境向け）
alter table public.profiles add column if not exists book jsonb default '{}'::jsonb;
alter table public.profiles add column if not exists is_official boolean default false;
alter table public.profiles add column if not exists titles text[] default '{}';
alter table public.profiles add column if not exists updated_at timestamptz default now();

-- ── answers：お題への回答（共有フィード） ─────────────────
-- お題はクライアント側の多言語定数（q1 / eq1 / official-... など）なので
-- uuid FK ではなく question_key(text) ＋ タイトルのスナップショットで保持する。
create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_key text not null,
  question_title text not null,
  question_category text,
  body text,
  sticker text,
  visibility text not null default 'public',  -- public / followers / private
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, question_key)
);
create index if not exists answers_created_idx on public.answers (created_at desc);
create index if not exists answers_question_idx on public.answers (question_key);

-- ── reactions：回答へのリアクション ──────────────────────
create table if not exists public.reactions (
  answer_id uuid not null references public.answers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('like','same','wakaru','natsukashii')),
  created_at timestamptz default now(),
  primary key (answer_id, user_id, type)
);

-- ── comments：回答へのコメント ──────────────────────────
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references public.answers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);
create index if not exists comments_answer_idx on public.comments (answer_id, created_at);

-- ── follows：フォロー関係 ───────────────────────────────
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, following_id),
  constraint no_self_follow check (follower_id <> following_id)
);

-- ============================================================
-- サインアップ時に profiles を自動作成するトリガー
-- username/display_name は仮値（メール先頭 or UUID先頭）。
-- 本番のID・表示名は /setup 画面でユーザーが更新する。
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base_name text;
begin
  base_name := coalesce(nullif(split_part(new.email, '@', 1), ''), left(new.id::text, 8));
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    -- username は unique 制約があるので UUID 先頭を足して衝突回避
    base_name || '_' || left(new.id::text, 4),
    base_name
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- RLS（行レベルセキュリティ）
-- ============================================================
alter table public.profiles  enable row level security;
alter table public.answers   enable row level security;
alter table public.reactions enable row level security;
alter table public.comments  enable row level security;
alter table public.follows   enable row level security;

-- profiles
drop policy if exists "profiles readable"   on public.profiles;
drop policy if exists "profiles insert own" on public.profiles;
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles readable"   on public.profiles for select using (true);
create policy "profiles insert own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles update own" on public.profiles for update using (auth.uid() = id);

-- answers（private は本人のみ。followers は当面 public 同様に表示し、
--            細かな絞り込みはアプリ側で実施）
drop policy if exists "answers readable"   on public.answers;
drop policy if exists "answers insert own" on public.answers;
drop policy if exists "answers update own" on public.answers;
drop policy if exists "answers delete own" on public.answers;
create policy "answers readable"   on public.answers for select using (visibility <> 'private' or auth.uid() = user_id);
create policy "answers insert own" on public.answers for insert with check (auth.uid() = user_id);
create policy "answers update own" on public.answers for update using (auth.uid() = user_id);
create policy "answers delete own" on public.answers for delete using (auth.uid() = user_id);

-- reactions
drop policy if exists "reactions readable"   on public.reactions;
drop policy if exists "reactions insert own" on public.reactions;
drop policy if exists "reactions delete own" on public.reactions;
create policy "reactions readable"   on public.reactions for select using (true);
create policy "reactions insert own" on public.reactions for insert with check (auth.uid() = user_id);
create policy "reactions delete own" on public.reactions for delete using (auth.uid() = user_id);

-- comments
drop policy if exists "comments readable"   on public.comments;
drop policy if exists "comments insert own" on public.comments;
drop policy if exists "comments delete own" on public.comments;
create policy "comments readable"   on public.comments for select using (true);
create policy "comments insert own" on public.comments for insert with check (auth.uid() = user_id);
create policy "comments delete own" on public.comments for delete using (auth.uid() = user_id);

-- follows
drop policy if exists "follows readable" on public.follows;
drop policy if exists "follows insert"   on public.follows;
drop policy if exists "follows delete"   on public.follows;
create policy "follows readable" on public.follows for select using (true);
create policy "follows insert"   on public.follows for insert with check (auth.uid() = follower_id);
create policy "follows delete"   on public.follows for delete using (auth.uid() = follower_id);
