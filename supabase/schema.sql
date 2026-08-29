-- ============================================================
-- Miri MVP スキーマ（共有SNS＋永続化）＝【安全版・これだけを使うこと】
-- Supabase の SQL Editor に貼り付けて実行してください。
-- 何度でも再実行できるよう冪等（if not exists / drop ... if exists）に記述。
-- 対象: プロフィール / お題回答 / リアクション / コメント / フォロー /
--       なかよし / 通知 /（末尾）通知のリアルタイム配信
--
-- ⚠️⚠️ 絶対に守ること ⚠️⚠️
--   このファイルには「drop table」は一切ありません。何度実行しても
--   回答・リアクション・コメントは消えません。
--   もし別の場所に "drop table ... cascade" が入った古いSQLがあっても、
--   それは【使わない・実行しない】でください。データが全部消えます。
--   SQLを流したいときは、必ずこのファイルの中身だけを使ってください。
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

-- ⚠️ 重要：このスキーマは「何度でも安全に再実行できる（冪等）」ことを保証する。
-- 以前ここにあった drop table (answers/reactions/comments) cascade は、
-- 再実行で既存の回答データを消してしまうため削除した。破壊的な操作は行わない。
-- 構造変更が必要な場合は個別の alter table add column if not exists で行うこと。

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

-- ── reactions：回答へのリアクション（like＋任意の絵文字スタンプ） ──
create table if not exists public.reactions (
  answer_id uuid not null references public.answers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,   -- 'like' または絵文字（😆❤️🔥 など）
  created_at timestamptz default now(),
  primary key (answer_id, user_id, type)
);
-- 旧スキーマの type 制約（4種のみ）を撤廃して絵文字スタンプを許可
alter table public.reactions drop constraint if exists reactions_type_check;

-- ── comments：回答へのコメント ──────────────────────────
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references public.answers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);
create index if not exists comments_answer_idx on public.comments (answer_id, created_at);

-- ── follows：フォロー関係（片思いOK・投稿を追う） ──────────
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, following_id),
  constraint no_self_follow check (follower_id <> following_id)
);

-- ── friendships：なかよし（承認制のプロフ帳交換） ──────────
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',   -- pending / accepted
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(requester_id, addressee_id),
  constraint no_self_friend check (requester_id <> addressee_id)
);

-- ── notifications：相手に関わる行動の通知 ────────────────
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,  -- 受信者
  actor_id uuid references public.profiles(id) on delete cascade,           -- 行動した人
  type text not null,   -- like / sticker / comment / follow / friend_request / friend_accept
  answer_id uuid,
  emoji text,
  body text,
  read boolean default false,
  created_at timestamptz default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

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
alter table public.friendships   enable row level security;
alter table public.notifications enable row level security;

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

-- friendships（当事者だけが読める。申請は本人、承認は受け手のみ）
drop policy if exists "friendships readable" on public.friendships;
drop policy if exists "friendships insert"   on public.friendships;
drop policy if exists "friendships update"   on public.friendships;
drop policy if exists "friendships delete"   on public.friendships;
create policy "friendships readable" on public.friendships for select using (auth.uid() = requester_id or auth.uid() = addressee_id);
create policy "friendships insert"   on public.friendships for insert with check (auth.uid() = requester_id);
create policy "friendships update"   on public.friendships for update using (auth.uid() = addressee_id);
create policy "friendships delete"   on public.friendships for delete using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- notifications（受信者だけが読む・既読にできる。作成は行動者のみ）
drop policy if exists "notifications readable" on public.notifications;
drop policy if exists "notifications insert"   on public.notifications;
drop policy if exists "notifications update"   on public.notifications;
create policy "notifications readable" on public.notifications for select using (auth.uid() = user_id);
create policy "notifications insert"   on public.notifications for insert with check (auth.uid() = actor_id);
create policy "notifications update"   on public.notifications for update using (auth.uid() = user_id);

-- ============================================================
-- 通知のリアルタイム配信（バッジを即時更新）
-- すでに追加済みでもエラーにならないよう DO ブロックで冪等化。
-- ※ これはテーブルを配信対象に加えるだけで、データは一切消さない。
-- ============================================================
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when others then null;  -- 既に追加済みなどの場合は何もしない
end $$;

-- ============================================================
-- コミュニティ（サークル）＝共有コミュニティ
-- 参加制（誰でも参加＝メンバー）。投稿は「トーク」と「メンバー投票」。
-- すべて create table if not exists なので再実行してもデータは消えない。
-- ============================================================
create table if not exists public.circles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text default '🔒',
  created_by uuid not null references public.profiles(id) on delete cascade,
  is_official boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.circle_members (
  circle_id uuid not null references public.circles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (circle_id, user_id)
);

create table if not exists public.circle_posts (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  kind text not null default 'talk',   -- talk / vote
  created_at timestamptz default now()
);
create index if not exists circle_posts_circle_idx on public.circle_posts (circle_id, created_at desc);

create table if not exists public.circle_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.circle_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);
create index if not exists circle_replies_post_idx on public.circle_replies (post_id, created_at);

create table if not exists public.circle_votes (
  post_id uuid not null references public.circle_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (post_id, user_id)   -- 1人1票
);

alter table public.circles         enable row level security;
alter table public.circle_members  enable row level security;
alter table public.circle_posts    enable row level security;
alter table public.circle_replies  enable row level security;
alter table public.circle_votes    enable row level security;

-- circles：誰でも発見できる。作成・編集・削除は作成者のみ。
drop policy if exists "circles readable"   on public.circles;
drop policy if exists "circles insert own" on public.circles;
drop policy if exists "circles update own" on public.circles;
drop policy if exists "circles delete own" on public.circles;
create policy "circles readable"   on public.circles for select using (true);
create policy "circles insert own" on public.circles for insert with check (auth.uid() = created_by);
create policy "circles update own" on public.circles for update using (auth.uid() = created_by);
create policy "circles delete own" on public.circles for delete using (auth.uid() = created_by);

-- circle_members：一覧は誰でも見える。参加・退会は本人のみ。
drop policy if exists "circle_members readable" on public.circle_members;
drop policy if exists "circle_members join"     on public.circle_members;
drop policy if exists "circle_members leave"    on public.circle_members;
create policy "circle_members readable" on public.circle_members for select using (true);
create policy "circle_members join"     on public.circle_members for insert with check (auth.uid() = user_id);
create policy "circle_members leave"    on public.circle_members for delete using (auth.uid() = user_id);

-- circle_posts：閲覧・投稿ともメンバーのみ（🔒 メンバー限定）。削除は本人。
drop policy if exists "circle_posts readable" on public.circle_posts;
drop policy if exists "circle_posts insert"   on public.circle_posts;
drop policy if exists "circle_posts delete"   on public.circle_posts;
create policy "circle_posts readable" on public.circle_posts for select using (
  exists (select 1 from public.circle_members m where m.circle_id = circle_posts.circle_id and m.user_id = auth.uid())
);
create policy "circle_posts insert" on public.circle_posts for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.circle_members m where m.circle_id = circle_posts.circle_id and m.user_id = auth.uid())
);
create policy "circle_posts delete" on public.circle_posts for delete using (auth.uid() = user_id);

-- circle_replies：メンバーのみ閲覧・投稿。
drop policy if exists "circle_replies readable" on public.circle_replies;
drop policy if exists "circle_replies insert"   on public.circle_replies;
create policy "circle_replies readable" on public.circle_replies for select using (
  exists (
    select 1 from public.circle_posts p
    join public.circle_members m on m.circle_id = p.circle_id
    where p.id = circle_replies.post_id and m.user_id = auth.uid()
  )
);
create policy "circle_replies insert" on public.circle_replies for insert with check (auth.uid() = user_id);

-- circle_votes：メンバーのみ閲覧・投票（1人1票）。
drop policy if exists "circle_votes readable" on public.circle_votes;
drop policy if exists "circle_votes insert"   on public.circle_votes;
create policy "circle_votes readable" on public.circle_votes for select using (
  exists (
    select 1 from public.circle_posts p
    join public.circle_members m on m.circle_id = p.circle_id
    where p.id = circle_votes.post_id and m.user_id = auth.uid()
  )
);
create policy "circle_votes insert" on public.circle_votes for insert with check (auth.uid() = user_id);

-- ── サークルの参加方式（公開／承認制）＋メンバー状態（member/pending） ──
-- 追加カラム（非破壊）。既存行は join_policy='open' / status='member' 扱い。
alter table public.circles add column if not exists join_policy text default 'open';   -- open / approval
alter table public.circle_members add column if not exists status text default 'member'; -- member / pending

-- 作成者は自分のサークルのメンバー行を承認（update）・却下（delete）できる
drop policy if exists "circle_members owner update" on public.circle_members;
drop policy if exists "circle_members owner delete" on public.circle_members;
create policy "circle_members owner update" on public.circle_members for update using (
  exists (select 1 from public.circles c where c.id = circle_members.circle_id and c.created_by = auth.uid())
);
create policy "circle_members owner delete" on public.circle_members for delete using (
  exists (select 1 from public.circles c where c.id = circle_members.circle_id and c.created_by = auth.uid())
);

-- 投稿/返信/投票の「メンバー限定」判定を status='member' 限定に更新（承認待ちは閲覧不可）
drop policy if exists "circle_posts readable" on public.circle_posts;
drop policy if exists "circle_posts insert"   on public.circle_posts;
create policy "circle_posts readable" on public.circle_posts for select using (
  exists (select 1 from public.circle_members m where m.circle_id = circle_posts.circle_id and m.user_id = auth.uid() and coalesce(m.status,'member') = 'member')
);
create policy "circle_posts insert" on public.circle_posts for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.circle_members m where m.circle_id = circle_posts.circle_id and m.user_id = auth.uid() and coalesce(m.status,'member') = 'member')
);

drop policy if exists "circle_replies readable" on public.circle_replies;
create policy "circle_replies readable" on public.circle_replies for select using (
  exists (
    select 1 from public.circle_posts p
    join public.circle_members m on m.circle_id = p.circle_id
    where p.id = circle_replies.post_id and m.user_id = auth.uid() and coalesce(m.status,'member') = 'member'
  )
);

drop policy if exists "circle_votes readable" on public.circle_votes;
create policy "circle_votes readable" on public.circle_votes for select using (
  exists (
    select 1 from public.circle_posts p
    join public.circle_members m on m.circle_id = p.circle_id
    where p.id = circle_votes.post_id and m.user_id = auth.uid() and coalesce(m.status,'member') = 'member'
  )
);

-- ── サークルの公開範囲（全体／フォロワー限定） ──────────────────
-- visibility='followers' のサークルは「作成者をフォローしている人」だけが発見できる。
alter table public.circles add column if not exists visibility text default 'public'; -- public / followers

drop policy if exists "circles readable" on public.circles;
create policy "circles readable" on public.circles for select using (
  coalesce(visibility,'public') = 'public'
  or created_by = auth.uid()
  or exists (select 1 from public.follows f where f.following_id = circles.created_by and f.follower_id = auth.uid())
  or exists (select 1 from public.circle_members m where m.circle_id = circles.id and m.user_id = auth.uid())
);

-- ============================================================
-- ブログ（個人記事）＝共有。公開範囲: public / followers。
-- すべて create table if not exists なので再実行しても消えない。
-- ============================================================
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  mood text,
  weather text,
  body text not null,
  photo_url text,
  text_color text,
  visibility text not null default 'public',   -- public / followers
  created_at timestamptz default now()
);
create index if not exists blog_posts_created_idx on public.blog_posts (created_at desc);

create table if not exists public.blog_likes (
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);

create table if not exists public.blog_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);
create index if not exists blog_comments_post_idx on public.blog_comments (post_id, created_at);

alter table public.blog_posts    enable row level security;
alter table public.blog_likes    enable row level security;
alter table public.blog_comments enable row level security;

-- posts: public は全員／followers は「作成者をフォローしている人」＋本人。書込は本人。
drop policy if exists "blog_posts readable"   on public.blog_posts;
drop policy if exists "blog_posts insert own" on public.blog_posts;
drop policy if exists "blog_posts update own" on public.blog_posts;
drop policy if exists "blog_posts delete own" on public.blog_posts;
create policy "blog_posts readable" on public.blog_posts for select using (
  coalesce(visibility,'public') = 'public'
  or user_id = auth.uid()
  or exists (select 1 from public.follows f where f.following_id = blog_posts.user_id and f.follower_id = auth.uid())
);
create policy "blog_posts insert own" on public.blog_posts for insert with check (auth.uid() = user_id);
create policy "blog_posts update own" on public.blog_posts for update using (auth.uid() = user_id);
create policy "blog_posts delete own" on public.blog_posts for delete using (auth.uid() = user_id);

-- likes / comments: 閲覧は全員、書込は本人のみ。
drop policy if exists "blog_likes readable"   on public.blog_likes;
drop policy if exists "blog_likes insert own" on public.blog_likes;
drop policy if exists "blog_likes delete own" on public.blog_likes;
create policy "blog_likes readable"   on public.blog_likes for select using (true);
create policy "blog_likes insert own" on public.blog_likes for insert with check (auth.uid() = user_id);
create policy "blog_likes delete own" on public.blog_likes for delete using (auth.uid() = user_id);

drop policy if exists "blog_comments readable"   on public.blog_comments;
drop policy if exists "blog_comments insert own" on public.blog_comments;
drop policy if exists "blog_comments delete own" on public.blog_comments;
create policy "blog_comments readable"   on public.blog_comments for select using (true);
create policy "blog_comments insert own" on public.blog_comments for insert with check (auth.uid() = user_id);
create policy "blog_comments delete own" on public.blog_comments for delete using (auth.uid() = user_id);

-- ============================================================
-- 交換日記（共有・複数人で1冊）＝Supabase化
-- 公開範囲: public / followers / mentioned（特定の人）。
-- 招待は diary_page_mentions。エントリはシンプル（本文＋写真）。
-- すべて create table if not exists なので再実行しても消えない。
-- ============================================================
create table if not exists public.diary_pages (
  id uuid primary key default gen_random_uuid(),
  theme text not null,
  description text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  visibility text not null default 'followers',   -- public / followers / mentioned
  created_at timestamptz default now()
);
create index if not exists diary_pages_created_idx on public.diary_pages (created_at desc);

create table if not exists public.diary_page_mentions (
  page_id uuid not null references public.diary_pages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (page_id, user_id)
);

create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.diary_pages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text,
  photo_url text,
  created_at timestamptz default now()
);
create index if not exists diary_entries_page_idx on public.diary_entries (page_id, created_at);

alter table public.diary_pages         enable row level security;
alter table public.diary_page_mentions enable row level security;
alter table public.diary_entries       enable row level security;

-- 閲覧可否（このページを見られるか）を判定する関数（RLSの重複を避ける）
create or replace function public.can_see_diary_page(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.diary_pages p where p.id = pid and (
      p.visibility = 'public'
      or p.created_by = auth.uid()
      or (p.visibility = 'followers' and exists (select 1 from public.follows f where f.following_id = p.created_by and f.follower_id = auth.uid()))
      or (p.visibility = 'mentioned' and exists (select 1 from public.diary_page_mentions dm where dm.page_id = p.id and dm.user_id = auth.uid()))
      or exists (select 1 from public.diary_entries e where e.page_id = p.id and e.user_id = auth.uid())
    )
  );
$$;

-- pages：閲覧は can_see_diary_page、作成/編集/削除は作成者。
drop policy if exists "diary_pages readable"   on public.diary_pages;
drop policy if exists "diary_pages insert own" on public.diary_pages;
drop policy if exists "diary_pages update own" on public.diary_pages;
drop policy if exists "diary_pages delete own" on public.diary_pages;
create policy "diary_pages readable"   on public.diary_pages for select using (public.can_see_diary_page(id));
create policy "diary_pages insert own" on public.diary_pages for insert with check (auth.uid() = created_by);
create policy "diary_pages update own" on public.diary_pages for update using (auth.uid() = created_by);
create policy "diary_pages delete own" on public.diary_pages for delete using (auth.uid() = created_by);

-- mentions：閲覧は誰でも（誰が招待されたか）。追加/削除はページ作成者のみ。
drop policy if exists "diary_mentions readable" on public.diary_page_mentions;
drop policy if exists "diary_mentions insert"   on public.diary_page_mentions;
drop policy if exists "diary_mentions delete"   on public.diary_page_mentions;
create policy "diary_mentions readable" on public.diary_page_mentions for select using (true);
create policy "diary_mentions insert"   on public.diary_page_mentions for insert with check (
  exists (select 1 from public.diary_pages p where p.id = page_id and p.created_by = auth.uid())
);
create policy "diary_mentions delete"   on public.diary_page_mentions for delete using (
  exists (select 1 from public.diary_pages p where p.id = page_id and p.created_by = auth.uid())
);

-- entries：ページを見られる人は閲覧可。書込は「見られる人」かつ本人。削除は本人orページ作成者。
drop policy if exists "diary_entries readable" on public.diary_entries;
drop policy if exists "diary_entries insert"   on public.diary_entries;
drop policy if exists "diary_entries delete"   on public.diary_entries;
create policy "diary_entries readable" on public.diary_entries for select using (public.can_see_diary_page(page_id));
create policy "diary_entries insert"   on public.diary_entries for insert with check (
  auth.uid() = user_id and public.can_see_diary_page(page_id)
);
create policy "diary_entries delete"   on public.diary_entries for delete using (
  auth.uid() = user_id
  or exists (select 1 from public.diary_pages p where p.id = page_id and p.created_by = auth.uid())
);

-- ============================================================
-- テスターからのフィードバック（意見・要望・不具合報告）＝直接投稿用の窓口。
-- 本人は自分の投稿を作成・閲覧できる。全体の閲覧・集計は運営が
-- Supabase の Table Editor（service role）で行う。
-- create table if not exists なので再実行しても消えない。
-- ============================================================
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  username text,
  kind text not null default 'bug',   -- bug / request / question
  body text not null,
  status text not null default 'new', -- new / triaged / fixed / done / wontfix
  created_at timestamptz default now()
);
create index if not exists feedback_created_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;

-- 投稿は本人のみ／閲覧も本人の投稿だけ（全体の閲覧は運営が service role で行う）。
drop policy if exists "feedback insert own" on public.feedback;
drop policy if exists "feedback select own" on public.feedback;
create policy "feedback insert own" on public.feedback for insert with check (auth.uid() = user_id);
create policy "feedback select own" on public.feedback for select using (auth.uid() = user_id);

-- ============================================================
-- 他己紹介アンケート（性格などを“他人が投票”して埋める）。
-- 1人の対象(target)に対し、投票者(voter)はカテゴリごとに1票（付け替え可）。
-- 全員が集計を閲覧でき、各自は自分の票のみ作成・変更・削除できる。
-- create table if not exists なので再実行しても消えない。
-- ============================================================
create table if not exists public.perception_votes (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references public.profiles(id) on delete cascade,
  voter_id  uuid not null references public.profiles(id) on delete cascade,
  category  text not null default 'personality',
  value     text not null,
  created_at timestamptz default now(),
  unique (target_id, voter_id, category)
);
create index if not exists perception_target_idx on public.perception_votes (target_id, category);

alter table public.perception_votes enable row level security;

drop policy if exists "perception readable"    on public.perception_votes;
drop policy if exists "perception insert own"   on public.perception_votes;
drop policy if exists "perception update own"   on public.perception_votes;
drop policy if exists "perception delete own"   on public.perception_votes;
-- 集計は全員が閲覧可。ただし自分自身への投票は不可（with check で voter<>target）。
create policy "perception readable"  on public.perception_votes for select using (true);
create policy "perception insert own" on public.perception_votes for insert with check (auth.uid() = voter_id and voter_id <> target_id);
create policy "perception update own" on public.perception_votes for update using (auth.uid() = voter_id);
create policy "perception delete own" on public.perception_votes for delete using (auth.uid() = voter_id);
