-- ============================================================
-- 【提案・未適用】自由回答の翻訳キャッシュ（Phase B：公開プロフィールの自由回答だけ）
--
-- ★本番DBへの適用は承認後。このファイルは設計レビュー用です。★
--
-- 方針
--  - 原文（profile_book.book）は一切変更しない。翻訳は別テーブルに置く。
--  - クライアントから任意の文章は受け取らない。サーバー（service_role）が
--    「ユーザー名＋項目の場所」から原文を取り出し、公開範囲を確認してから翻訳する。
--  - 翻訳テーブル・予算テーブルは anon / authenticated から一切読めない・書けない
--    （RLS 有効＋ポリシーなし＋権限剥奪）。読み書きはサーバーの service_role だけ。
--  - Phase B は「誰でも見られる項目（公開範囲が public／未設定）」だけを対象にする。
--    フォロワー限定・非公開の項目は翻訳しない（関数が原文を返さない）。
--  - 原文が変わった・公開範囲が変わった・原文が消えた → 翻訳を自動で削除する（トリガー／外部キー）。
--
-- 実行方法：Supabase の SQL Editor に貼って Run（全体が 1 トランザクション）。
-- 取り消し：いちばん下の「ROLLBACK（取り消し）」を別タブで実行。
-- ============================================================
begin;

-- ── 1. 翻訳キャッシュ ─────────────────────────────────────────
create table if not exists public.content_translations (
  id               bigint generated always as identity primary key,
  -- 何の文章か（Phase B は profile_field だけ。Phase C で answer / diary_entry などを追加）
  source_type      text not null check (source_type in ('profile_field')),
  owner_id         uuid not null references public.profiles(id) on delete cascade,  -- 原文の持ち主。退会で翻訳も消える
  source_path      text not null check (source_path ~ '^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z0-9_]+){0,3}$'),
                   -- 例：myBoom / motto / __questions.3.a / __best3.drink.0 / __monthly.episode
  source_hash      text not null check (source_hash ~ '^[0-9a-f]{32}$'),  -- md5(原文)。原文が変わると一致しなくなる
  source_lang      text,                                                   -- 判定した原文の言語（ja など）
  target_lang      text not null check (target_lang in
                     ('ja','en','ko','zh','zh-tw','id','th','vi','tl','ms','es','pt','fr','de','it','ru','ar','hi','tr','nl')),
  status           text not null default 'pending'
                     check (status in ('pending','done','kept','failed')),
                     -- pending：翻訳中（同時に同じ翻訳を頼まないための目印）
                     -- done：翻訳あり／kept：訳さない判断（固有名詞・短文・意味不明）／failed：失敗（原文を表示）
  translated_text  text check (char_length(translated_text) <= 2000),
  kept_terms       text[] not null default '{}',     -- 訳さずに残した固有名詞（検証用）
  engine           text not null,                     -- 例：claude-haiku-5-5
  input_tokens     integer,
  output_tokens    integer,
  cost_usd         numeric(12,6),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- 同じ原文・同じ言語の翻訳は 1 行だけ（重複翻訳の防止）
  constraint content_translations_unique unique (source_type, owner_id, source_path, target_lang, source_hash),
  constraint content_translations_done_has_text check (status <> 'done' or translated_text is not null)
);
create index if not exists content_translations_owner_idx   on public.content_translations (owner_id);
create index if not exists content_translations_pending_idx on public.content_translations (created_at) where status = 'pending';

alter table public.content_translations enable row level security;
-- ポリシーを作らない＝ anon / authenticated からは 0 行。念のため権限も外す（service_role は RLS を通らない）
revoke all on public.content_translations from anon, authenticated;

-- ── 2. 予算（月ごと）・利用者ごとの回数・設定 ─────────────────────
create table if not exists public.translation_settings (
  id                 boolean primary key default true check (id),   -- 1 行だけ
  enabled            boolean not null default false,                -- 運営の停止スイッチ（false で新しい翻訳を止める）
  monthly_cap_usd    numeric(10,4) not null default 10,             -- 月の上限（これを超える見込みなら呼ばない）
  daily_user_limit   integer not null default 30,                   -- 1 人 1 日あたりの新規翻訳回数
  updated_at         timestamptz not null default now()
);
insert into public.translation_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.translation_budget (
  month          date primary key,                       -- その月の 1 日（UTC）
  spent_usd      numeric(12,6) not null default 0,       -- 確定した費用（API の usage から計算）
  reserved_usd   numeric(12,6) not null default 0,       -- 実行中の見込み費用（上限側で多めに見積もる）
  requests       integer not null default 0,             -- API を呼んだ回数
  cache_hits     integer not null default 0,             -- 翻訳キャッシュで返した回数
  input_tokens   bigint  not null default 0,
  output_tokens  bigint  not null default 0,
  updated_at     timestamptz not null default now()
);

create table if not exists public.translation_user_daily (
  user_id   uuid not null references public.profiles(id) on delete cascade,
  day       date not null,
  requests  integer not null default 0,
  primary key (user_id, day)
);

alter table public.translation_settings   enable row level security;
alter table public.translation_budget     enable row level security;
alter table public.translation_user_daily enable row level security;
revoke all on public.translation_settings, public.translation_budget, public.translation_user_daily from anon, authenticated;

-- ── 3. 原文の取り出し（公開項目だけ）─────────────────────────────
-- 指定ユーザーの profile_book から、誰でも見られる項目の文字列を 1 つ返す。
-- 内部キー・フォロワー限定・非公開・空・長すぎる値は返さない（＝翻訳しない）。
create or replace function public.public_profile_field(target_username text, field_path text)
returns table (owner_id uuid, text_value text)
language plpgsql stable security definer set search_path = public
as $$
declare
  tgt uuid;
  b   jsonb;
  top text := split_part(field_path, '.', 1);
  v   text;
begin
  if field_path !~ '^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z0-9_]+){0,3}$' then return; end if;
  if top in ('__game','__purchases','__visibility','__choices','__perception','__pen') then return; end if;
  select p.id into tgt from public.profiles p where p.username = target_username;
  if tgt is null then return; end if;
  select pb.book into b from public.profile_book pb where pb.id = tgt;
  if b is null then return; end if;
  -- get_visible_book と同じ公開範囲の考え方。Phase B は「未設定 or public」だけ
  if coalesce(b->'__visibility'->>top, 'public') <> 'public' then return; end if;
  if jsonb_typeof(b #> string_to_array(field_path, '.')) <> 'string' then return; end if;
  v := b #>> string_to_array(field_path, '.');
  if v is null or btrim(v) = '' or char_length(v) > 400 then return; end if;
  owner_id := tgt; text_value := v;
  return next;
end;
$$;
revoke all on function public.public_profile_field(text, text) from public, anon, authenticated;
grant execute on function public.public_profile_field(text, text) to service_role;

-- ── 4. 予算の確保と精算（同時実行でも上限を超えないよう、月の行をロックして判定）─────
-- 返り値：'ok' / 'disabled'（停止中） / 'budget'（今月の上限） / 'user_limit'（今日の回数上限）
create or replace function public.reserve_translation(p_user uuid, p_estimate_usd numeric)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  s  public.translation_settings%rowtype;
  m  date := date_trunc('month', (now() at time zone 'utc'))::date;
  b  public.translation_budget%rowtype;
  u  integer;
begin
  select * into s from public.translation_settings where id;
  if not found or not s.enabled then return 'disabled'; end if;
  insert into public.translation_budget (month) values (m) on conflict (month) do nothing;
  select * into b from public.translation_budget where month = m for update;   -- この月の行をロック
  if b.spent_usd + b.reserved_usd + p_estimate_usd > s.monthly_cap_usd then return 'budget'; end if;
  insert into public.translation_user_daily (user_id, day) values (p_user, (now() at time zone 'utc')::date)
    on conflict (user_id, day) do nothing;
  select requests into u from public.translation_user_daily
    where user_id = p_user and day = (now() at time zone 'utc')::date for update;
  if u >= s.daily_user_limit then return 'user_limit'; end if;
  update public.translation_user_daily set requests = requests + 1
    where user_id = p_user and day = (now() at time zone 'utc')::date;
  update public.translation_budget
    set reserved_usd = reserved_usd + p_estimate_usd, requests = requests + 1, updated_at = now()
    where month = m;
  return 'ok';
end;
$$;

-- API 呼び出し後に、見込み額を外して実額を足す（失敗時は p_actual_usd = 0）
create or replace function public.settle_translation(p_estimate_usd numeric, p_actual_usd numeric, p_input integer, p_output integer)
returns void
language plpgsql security definer set search_path = public
as $$
declare m date := date_trunc('month', (now() at time zone 'utc'))::date;
begin
  update public.translation_budget
    set reserved_usd = greatest(0, reserved_usd - p_estimate_usd),
        spent_usd = spent_usd + p_actual_usd,
        input_tokens = input_tokens + coalesce(p_input, 0),
        output_tokens = output_tokens + coalesce(p_output, 0),
        updated_at = now()
    where month = m;
end;
$$;

create or replace function public.count_translation_cache_hit()
returns void
language sql security definer set search_path = public
as $$
  insert into public.translation_budget (month, cache_hits)
  values (date_trunc('month', (now() at time zone 'utc'))::date, 1)
  on conflict (month) do update set cache_hits = public.translation_budget.cache_hits + 1, updated_at = now();
$$;

revoke all on function public.reserve_translation(uuid, numeric) from public, anon, authenticated;
revoke all on function public.settle_translation(numeric, numeric, integer, integer) from public, anon, authenticated;
revoke all on function public.count_translation_cache_hit() from public, anon, authenticated;
grant execute on function public.reserve_translation(uuid, numeric) to service_role;
grant execute on function public.settle_translation(numeric, numeric, integer, integer) to service_role;
grant execute on function public.count_translation_cache_hit() to service_role;

-- ── 5. 原文の変更・公開範囲の変更で翻訳を消す ─────────────────────
-- ・公開範囲（__visibility）が変わったら、その人の翻訳をすべて削除（公開→非公開の取り残しを防ぐ）
-- ・項目の文字列が変わった・消えた翻訳だけ削除（原文の md5 が保存値と違う）
create or replace function public.purge_profile_translations()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.content_translations where source_type = 'profile_field' and owner_id = old.id;
    return old;
  end if;
  if new.book is not distinct from old.book then return new; end if;
  if (old.book->'__visibility') is distinct from (new.book->'__visibility') then
    delete from public.content_translations where source_type = 'profile_field' and owner_id = new.id;
  else
    delete from public.content_translations ct
      where ct.source_type = 'profile_field' and ct.owner_id = new.id
        and md5(coalesce(new.book #>> string_to_array(ct.source_path, '.'), '')) <> ct.source_hash;
  end if;
  return new;
end;
$$;
drop trigger if exists profile_book_purge_translations on public.profile_book;
create trigger profile_book_purge_translations
  after update or delete on public.profile_book
  for each row execute function public.purge_profile_translations();

-- 途中で止まった pending を片付ける（任意：Supabase の pg_cron などで 1 日 1 回）
-- delete from public.content_translations where status = 'pending' and created_at < now() - interval '10 minutes';

commit;

-- ============================================================
-- 適用後の確認（任意）
-- ============================================================
-- 1) anon / authenticated から読めないこと（期待：permission denied もしくは 0 行）
--    set role anon;          select count(*) from public.content_translations; reset role;
--    set role authenticated; select count(*) from public.content_translations; reset role;
-- 2) 公開項目だけ取り出せること
--    select * from public.public_profile_field('<username>', 'myBoom');      -- 公開なら 1 行
--    select * from public.public_profile_field('<username>', '__visibility'); -- 0 行
-- 3) 停止スイッチ
--    select public.reserve_translation('<uuid>', 0.001);  -- enabled=false の間は 'disabled'

-- ============================================================
-- ROLLBACK（取り消し）— 翻訳キャッシュと予算の記録が消えます（原文には影響なし）
-- ============================================================
-- begin;
-- drop trigger if exists profile_book_purge_translations on public.profile_book;
-- drop function if exists public.purge_profile_translations();
-- drop function if exists public.count_translation_cache_hit();
-- drop function if exists public.settle_translation(numeric, numeric, integer, integer);
-- drop function if exists public.reserve_translation(uuid, numeric);
-- drop function if exists public.public_profile_field(text, text);
-- drop table if exists public.translation_user_daily;
-- drop table if exists public.translation_budget;
-- drop table if exists public.translation_settings;
-- drop table if exists public.content_translations;
-- commit;
