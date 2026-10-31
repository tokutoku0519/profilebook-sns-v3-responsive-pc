-- ============================================================
-- 【提案・未適用】自由回答の翻訳キャッシュ・本人の許可・予算管理（Phase B）
--
-- ★本番DBへの適用は承認後。このファイルは設計レビュー用です。★
-- 設計の説明：docs/translation-phase-b-review.md
-- 使う側のコード：src/lib/translation/server/store.ts（DbStore）
--
-- 翻訳してよいもの（すべて満たすときだけ）
--  1. 書いた本人が「翻訳を許可する」をオンにしている（translation_consents）
--  2. 公開のもの
--     ・プロフ帳：ログインしていない人に見える項目（既存の get_visible_book と同じ判定）で、
--       公開範囲が public または未設定。未設定は 1 の本人の許可があるときだけ（許可がなければ拒否）。
--       require_explicit_public = true にすると、未設定は許可があっても拒否する
--     ・お題への回答：answers.visibility = 'public'
--  3. 翻訳してよい項目（自由に書く欄。名前・ニックネーム・ID・誕生日・血液型・MBTI・性別などは入れない）、
--     決まった形の場所、文字数の上限以内
-- フォロワー限定・非公開・今後増える公開範囲（コミュニティ限定など）は、すべて対象外。
--
-- 権限
--  ・テーブルは RLS 有効・ポリシーなし。anon / authenticated の権限は外す。読み書きはサーバー（service_role）だけ
--  ・関数も service_role だけが実行できる。service_role は RLS を通らないので、判定はすべて関数の中で行う
--  ・原文の取り出し・翻訳済みの返却・保存のどれも、その場で公開範囲と本人の許可を確かめる
--  ・ユーザーのトークン付き（auth.uid() あり）で呼ばれたら何も返さない（閲覧者の権限を持ち込まない）
--
-- 実行方法：Supabase の SQL Editor に貼って Run（全体が 1 トランザクション）。
-- 取り消し：いちばん下の「ROLLBACK（取り消し）」を別タブで実行（原文・回答には影響なし）。
-- ============================================================
begin;

-- ── 1. 設定（1 行だけ。再デプロイなしで変えられる）──────────────────
create table if not exists public.translation_settings (
  id                         boolean primary key default true check (id),
  enabled                    boolean not null default false,   -- 運営の停止スイッチ（false で新しい翻訳を止める。翻訳済みは返す）
  monthly_target_usd         numeric(10,4) not null default 5,  -- 目安（超えたら運営に知らせる。止めはしない）
  monthly_cap_usd            numeric(10,4) not null default 10 check (monthly_cap_usd >= 0), -- 上限（超える見込みなら呼ばない）
  daily_user_limit           integer not null default 30,       -- 1 人が 1 日に頼める新規翻訳の回数
  daily_owner_limit          integer not null default 60,       -- 1 人の原文が 1 日に新しく翻訳される回数（編集を繰り返す悪用の防止）
  require_explicit_public    boolean not null default false,    -- true：公開範囲を「公開」にした項目だけ（未設定は許可があっても拒否）
  profile_fields             text[] not null default array[      -- 翻訳してよい項目（src/lib/translation/shared.ts と同じ）
                               'catchphrase','message','hometown',
                               'favoriteFood','dislikeFood','favoriteColor','favoriteCharacter',
                               'specialty','holiday','wantToGo','collection','motto','charmPoint','dream',
                               '__questions','__best3','__monthly'],
  max_field_chars            integer not null default 400,
  max_answer_chars           integer not null default 600,
  max_estimate_usd           numeric(10,6) not null default 0.002, -- 1 回の見込み額の上限（計算ミスで大きく確保しない）
  -- 料金（米ドル / 100 万トークン）。Claude Haiku 5.5 の公式料金。変わったらここを更新する
  price_input_per_mtok       numeric(10,4) not null default 0.10,
  price_output_per_mtok      numeric(10,4) not null default 0.50,
  price_cache_read_per_mtok  numeric(10,4) not null default 0.01,
  price_cache_write_per_mtok numeric(10,4) not null default 0.125,
  updated_at                 timestamptz not null default now()
);
insert into public.translation_settings (id) values (true) on conflict (id) do nothing;

-- ── 2. 本人の許可 ───────────────────────────────────────────
create table if not exists public.translation_consents (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  allow      boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ── 3. 翻訳キャッシュ ─────────────────────────────────────────
create table if not exists public.content_translations (
  id               bigint generated always as identity primary key,
  -- 何の文章か。増やすときは check・原文を取り出す関数・削除のトリガーを一緒に追加する
  source_type      text not null check (source_type in ('profile_field','answer')),
  owner_id         uuid not null references public.profiles(id) on delete cascade,  -- 原文の持ち主。退会で翻訳も消える
  source_path      text not null,              -- profile_field：motto / __questions.3.a など。answer：回答の id
  source_hash      text not null check (source_hash ~ '^[0-9a-f]{32}$'),  -- md5(原文)。原文が変わると一致しなくなる
  -- 翻訳したときの公開範囲。今は public だけ。限定公開を足すときは、返すたびに閲覧者を確かめる関数を必ず通す
  audience         text not null default 'public' check (audience in ('public')),
  target_lang      text not null check (target_lang in
                     ('ja','en','ko','zh','zh-tw','id','th','vi','tl','ms','es','pt','fr','de','it','ru','ar','hi','tr','nl')),
  status           text not null default 'pending' check (status in ('pending','done','kept','failed')),
                   -- pending：翻訳中（同じ翻訳を二重に頼まない目印）／done：翻訳あり／
                   -- kept：訳さない判断（固有名詞・あいまいな短文・同じ言語）／failed：失敗（原文を表示）
  translated_text  text check (char_length(translated_text) <= 3000),
  kept_terms       text[] not null default '{}',
  engine           text not null,              -- 例：claude-haiku-5-5
  input_tokens     integer,
  output_tokens    integer,
  cost_usd         numeric(12,6),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint content_translations_unique unique (source_type, owner_id, source_path, target_lang, source_hash),
  constraint content_translations_path_check check (
    (source_type = 'profile_field' and source_path ~ '^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z0-9_]+){0,3}$')
    or (source_type = 'answer' and source_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')),
  constraint content_translations_done_has_text check (status <> 'done' or translated_text is not null)
);
create index if not exists content_translations_owner_idx on public.content_translations (owner_id);
create index if not exists content_translations_answer_idx on public.content_translations (source_path) where source_type = 'answer';

-- ── 4. 予算（月ごと）・確保の記録・1 日の回数 ─────────────────────
create table if not exists public.translation_budget (
  month              date primary key,                     -- その月の 1 日（UTC）
  spent_usd          numeric(12,6) not null default 0,     -- 確定した費用（API の使用量から計算）
  reserved_usd       numeric(12,6) not null default 0,     -- 呼び出し中の見込み額の合計
  requests           integer not null default 0,           -- API を呼ぶために確保した回数
  cache_hits         integer not null default 0,           -- 翻訳済みを返した回数（API を呼ばない）
  input_tokens       bigint not null default 0,
  output_tokens      bigint not null default 0,
  cache_read_tokens  bigint not null default 0,
  cache_write_tokens bigint not null default 0,
  updated_at         timestamptz not null default now()
);

create table if not exists public.translation_reservations (
  id           bigint generated always as identity primary key,
  month        date not null references public.translation_budget(month),
  user_id      uuid not null,                              -- 翻訳を頼んだ人（退会しても費用の記録は残す）
  owner_id     uuid not null,                              -- 原文の持ち主
  estimate_usd numeric(12,6) not null check (estimate_usd > 0),
  actual_usd   numeric(12,6),
  status       text not null default 'reserved' check (status in ('reserved','settled','expired')),
               -- expired：精算されないまま 15 分たった（サーバーが途中で落ちたなど）→ 見込み額を全額使ったとみなす
  created_at   timestamptz not null default now(),
  settled_at   timestamptz
);
create index if not exists translation_reservations_open_idx on public.translation_reservations (created_at) where status = 'reserved';

create table if not exists public.translation_daily (
  subject_type text not null check (subject_type in ('user','owner')),
  subject_id   uuid not null,
  day          date not null,
  count        integer not null default 0,
  primary key (subject_type, subject_id, day)
);

alter table public.translation_settings     enable row level security;
alter table public.translation_consents     enable row level security;
alter table public.content_translations     enable row level security;
alter table public.translation_budget       enable row level security;
alter table public.translation_reservations enable row level security;
alter table public.translation_daily        enable row level security;
-- ポリシーは作らない（anon / authenticated からは 0 行）。Supabase は新しいテーブルに既定で権限を付けるので外す
revoke all on public.translation_settings, public.translation_consents, public.content_translations,
              public.translation_budget, public.translation_reservations, public.translation_daily
  from public, anon, authenticated;
grant all on public.translation_settings, public.translation_consents, public.content_translations,
             public.translation_budget, public.translation_reservations, public.translation_daily
  to service_role;

-- ── 5. 原文の取り出し（翻訳してよいものだけ）─────────────────────────
-- p_type = 'profile_field'：p_owner = ユーザー名、p_path = 項目の場所
-- p_type = 'answer'       ：p_owner は使わない、p_path = 回答の id
-- 返す：持ち主・原文・md5・手がかり（AI に渡す質問文）。翻訳してよくなければ 0 行。
create or replace function public.translatable_source(p_type text, p_owner text, p_path text)
returns table (owner_id uuid, text_value text, source_hash text, context text)
language plpgsql stable security definer set search_path = public
as $$
declare
  s       public.translation_settings%rowtype;
  tgt     uuid;
  raw     jsonb;
  visible jsonb;
  parts   text[];
  top     text;
  vis     text;
  v       text;
  a       public.answers%rowtype;
begin
  if auth.uid() is not null then return; end if;          -- 閲覧者の権限を持ち込まない（サーバーの service_role からだけ）
  select * into s from public.translation_settings where id;
  if not found then return; end if;

  if p_type = 'answer' then
    if p_path is null or p_path !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return; end if;
    select * into a from public.answers x where x.id = p_path::uuid;
    if not found or a.visibility is distinct from 'public' then return; end if;
    if not exists (select 1 from public.translation_consents c where c.user_id = a.user_id and c.allow) then return; end if;
    if a.body is null or btrim(a.body) = '' or char_length(a.body) > s.max_answer_chars then return; end if;
    owner_id := a.user_id; text_value := a.body; source_hash := md5(a.body); context := left(a.question_title, 200);
    return next; return;
  end if;

  if p_type <> 'profile_field' then return; end if;
  if p_path is null or p_path !~ '^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z0-9_]+){0,3}$' then return; end if;
  parts := string_to_array(p_path, '.');
  top := parts[1];
  if not (top = any (s.profile_fields)) then return; end if;
  -- 場所の形（src/lib/translation/shared.ts の isTranslatableProfilePath と同じ）
  if top = '__questions' then
    if not (array_length(parts, 1) = 3 and parts[2] ~ '^\d{1,2}$' and parts[3] = 'a') then return; end if;
  elsif top = '__best3' then
    if not (array_length(parts, 1) = 3 and parts[2] ~ '^[a-z]{1,20}$' and parts[3] ~ '^\d$') then return; end if;
  elsif top = '__monthly' then
    if not ((array_length(parts, 1) = 2 and parts[2] = 'episode') or (array_length(parts, 1) = 3 and parts[2] = 'items' and parts[3] ~ '^\d$')) then return; end if;
  elsif array_length(parts, 1) <> 1 then return;
  end if;

  select p.id into tgt from public.profiles p where p.username = p_owner;
  if tgt is null then return; end if;
  if not exists (select 1 from public.translation_consents c where c.user_id = tgt and c.allow) then return; end if;
  select pb.book into raw from public.profile_book pb where pb.id = tgt;
  if raw is null then return; end if;
  vis := raw -> '__visibility' ->> top;
  if vis is not null and vis <> 'public' then return; end if;
  if vis is null and s.require_explicit_public then return; end if;
  visible := public.get_visible_book(p_owner);              -- 未ログインの人に見える内容（auth.uid() は null）
  if visible is null or not (visible ? top) then return; end if;
  if jsonb_typeof(visible #> parts) is distinct from 'string' then return; end if;
  v := visible #>> parts;
  if v is null or btrim(v) = '' or char_length(v) > s.max_field_chars then return; end if;
  owner_id := tgt; text_value := v; source_hash := md5(v);
  context := case
    when top = '__questions' then left(visible #>> array['__questions', parts[2], 'q'], 200)
    when top = '__best3' then '好きな' || parts[2] || ' ベスト3'
    when top = '__monthly' then case when parts[2] = 'episode' then '今月のエピソード' else '今月のベスト3' end
    else top end;
  return next;
end;
$$;

-- ── 6. 翻訳済みを返す（返すたびに公開範囲・本人の許可・原文の一致を確かめる）──────────
-- available = false：今は翻訳してよいものではない（翻訳済みがあっても返さない）
create or replace function public.get_translation(p_type text, p_owner text, p_path text, p_lang text)
returns table (available boolean, status text, translated_text text)
language plpgsql security definer set search_path = public
as $$
declare src record; ct record;
begin
  select * into src from public.translatable_source(p_type, p_owner, p_path);
  if not found then available := false; return next; return; end if;
  select x.status, x.translated_text into ct from public.content_translations x
    where x.source_type = p_type and x.owner_id = src.owner_id and x.source_path = p_path
      and x.target_lang = p_lang and x.source_hash = src.source_hash and x.status in ('done','kept');
  available := true;
  if found then
    status := ct.status; translated_text := ct.translated_text;
    insert into public.translation_budget (month, cache_hits)
    values (date_trunc('month', (now() at time zone 'utc'))::date, 1)
    on conflict (month) do update set cache_hits = public.translation_budget.cache_hits + 1, updated_at = now();
  end if;
  return next;
end;
$$;

-- ── 7. 翻訳中の目印（同じ原文・同じ言語を二重に頼まない）────────────────
-- claimed = true：この呼び出しが翻訳してよい（原文を返す）。2 分以上前の pending・failed は取り直せる
create or replace function public.claim_translation(p_type text, p_owner text, p_path text, p_lang text, p_engine text)
returns table (claimed boolean, available boolean, owner_id uuid, text_value text, source_hash text, context text)
language plpgsql security definer set search_path = public
as $$
declare src record; got bigint;
begin
  select * into src from public.translatable_source(p_type, p_owner, p_path);
  if not found then claimed := false; available := false; return next; return; end if;
  insert into public.content_translations as ct (source_type, owner_id, source_path, source_hash, target_lang, status, engine)
  values (p_type, src.owner_id, p_path, src.source_hash, p_lang, 'pending', p_engine)
  on conflict on constraint content_translations_unique do update
    set status = 'pending', engine = excluded.engine, updated_at = now()
    where ct.status in ('pending','failed') and ct.updated_at < now() - interval '2 minutes'
  returning ct.id into got;
  claimed := got is not null; available := true;
  owner_id := src.owner_id; text_value := src.text_value; source_hash := src.source_hash; context := src.context;
  return next;
end;
$$;

-- 予算が取れなかったときなどに目印を外す
create or replace function public.release_translation(p_type text, p_owner text, p_path text, p_lang text, p_hash text)
returns void
language sql security definer set search_path = public
as $$
  delete from public.content_translations x
   where x.source_type = p_type and x.source_path = p_path and x.target_lang = p_lang
     and x.source_hash = p_hash and x.status = 'pending'
     and (p_type = 'answer' or x.owner_id = (select p.id from public.profiles p where p.username = p_owner));
$$;

-- ── 8. 翻訳の保存（保存する瞬間にも、原文・公開範囲・本人の許可が変わっていないか確かめる）────
-- 元の行（profile_book・answers）を FOR SHARE で押さえ、同時に起きた編集・公開範囲の変更と順番をそろえる。
-- 変わっていたら保存せず、目印を消して false を返す（画面は原文のまま）。
create or replace function public.store_translation(
  p_type text, p_owner text, p_path text, p_lang text, p_hash text,
  p_status text, p_text text, p_kept_terms text[], p_input integer, p_output integer, p_cost numeric)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare src record; tgt uuid;
begin
  if p_status not in ('done','kept','failed') then return false; end if;
  if p_type = 'answer' and p_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select x.user_id into tgt from public.answers x where x.id = p_path::uuid for share;
  elsif p_type = 'profile_field' then
    select p.id into tgt from public.profiles p where p.username = p_owner;
    perform 1 from public.profile_book pb where pb.id = tgt for share;
  end if;
  if tgt is null then return false; end if;
  perform 1 from public.translation_consents c where c.user_id = tgt for share;
  select * into src from public.translatable_source(p_type, p_owner, p_path);
  if not found or src.source_hash <> p_hash then
    perform public.release_translation(p_type, p_owner, p_path, p_lang, p_hash);
    return false;
  end if;
  update public.content_translations x
    set status = p_status, translated_text = case when p_status = 'done' then p_text end,
        kept_terms = coalesce(p_kept_terms, '{}'), input_tokens = p_input, output_tokens = p_output,
        cost_usd = p_cost, updated_at = now()
    where x.source_type = p_type and x.owner_id = src.owner_id and x.source_path = p_path
      and x.target_lang = p_lang and x.source_hash = p_hash and x.status = 'pending';
  return found;
end;
$$;

-- ── 9. 予算の確保（同時に何件来ても上限を超えない）──────────────────────
-- result：'ok' / 'disabled'（停止中）/ 'budget'（今月の上限）/ 'user_limit' / 'owner_limit' / 'bad_estimate'
-- 月の行を FOR UPDATE でロックするので、確保は 1 件ずつ順番に判定される。
-- 「確定額＋呼び出し中の見込み額＋今回の見込み額」が上限を超えるなら確保しない。
create or replace function public.reserve_translation(p_user uuid, p_owner uuid, p_estimate_usd numeric)
returns table (result text, reservation_id bigint)
language plpgsql security definer set search_path = public
as $$
declare
  s   public.translation_settings%rowtype;
  m   date := date_trunc('month', (now() at time zone 'utc'))::date;
  d   date := (now() at time zone 'utc')::date;
  b   public.translation_budget%rowtype;
  st  record;
  n   integer;
begin
  select * into s from public.translation_settings where id;
  if not found or not s.enabled then result := 'disabled'; return next; return; end if;
  if p_estimate_usd is null or p_estimate_usd <= 0 or p_estimate_usd > s.max_estimate_usd then
    result := 'bad_estimate'; return next; return;
  end if;
  insert into public.translation_budget (month) values (m) on conflict (month) do nothing;
  select * into b from public.translation_budget where month = m for update;   -- この月の行をロック

  -- 精算されないまま 15 分たった確保は、見込み額を全額使ったとみなして確定する（少なく数えない）
  for st in
    update public.translation_reservations r set status = 'expired', actual_usd = r.estimate_usd, settled_at = now()
      where r.status = 'reserved' and r.created_at < now() - interval '15 minutes'
      returning r.month, r.estimate_usd
  loop
    update public.translation_budget
      set reserved_usd = greatest(0, reserved_usd - st.estimate_usd), spent_usd = spent_usd + st.estimate_usd, updated_at = now()
      where month = st.month;
  end loop;
  select * into b from public.translation_budget where month = m;

  if b.spent_usd + b.reserved_usd + p_estimate_usd > s.monthly_cap_usd then result := 'budget'; return next; return; end if;

  insert into public.translation_daily (subject_type, subject_id, day) values ('user', p_user, d), ('owner', p_owner, d)
    on conflict do nothing;
  select count into n from public.translation_daily where subject_type = 'user' and subject_id = p_user and day = d for update;
  if n >= s.daily_user_limit then result := 'user_limit'; return next; return; end if;
  select count into n from public.translation_daily where subject_type = 'owner' and subject_id = p_owner and day = d for update;
  if n >= s.daily_owner_limit then result := 'owner_limit'; return next; return; end if;
  update public.translation_daily set count = count + 1
    where day = d and ((subject_type = 'user' and subject_id = p_user) or (subject_type = 'owner' and subject_id = p_owner));

  insert into public.translation_reservations (month, user_id, owner_id, estimate_usd)
    values (m, p_user, p_owner, p_estimate_usd) returning id into reservation_id;
  update public.translation_budget set reserved_usd = reserved_usd + p_estimate_usd, requests = requests + 1, updated_at = now()
    where month = m;
  result := 'ok'; return next;
end;
$$;

-- ── 10. 精算（API の応答に入っている使用量から実額を計算）────────────────────
-- API を呼ばなかった・エラーで課金されなかった → 使用量 0 で精算（実額 0）。
-- 応答が返らず使用量が分からない（タイムアウトなど）→ 精算しない。15 分後に見込み額で確定する。
-- 返り値：実額（すでに精算・確定済みなら null）
create or replace function public.settle_translation(p_reservation_id bigint, p_input integer, p_output integer,
                                                     p_cache_read integer default 0, p_cache_write integer default 0)
returns numeric
language plpgsql security definer set search_path = public
as $$
declare s public.translation_settings%rowtype; r public.translation_reservations%rowtype; actual numeric(12,6);
begin
  select * into s from public.translation_settings where id;
  select * into r from public.translation_reservations where id = p_reservation_id for update;
  if not found or r.status <> 'reserved' then return null; end if;
  actual := (coalesce(p_input, 0)       * s.price_input_per_mtok
           + coalesce(p_output, 0)      * s.price_output_per_mtok
           + coalesce(p_cache_read, 0)  * s.price_cache_read_per_mtok
           + coalesce(p_cache_write, 0) * s.price_cache_write_per_mtok) / 1000000;
  perform 1 from public.translation_budget where month = r.month for update;
  update public.translation_budget
    set reserved_usd = greatest(0, reserved_usd - r.estimate_usd), spent_usd = spent_usd + actual,
        input_tokens = input_tokens + coalesce(p_input, 0), output_tokens = output_tokens + coalesce(p_output, 0),
        cache_read_tokens = cache_read_tokens + coalesce(p_cache_read, 0),
        cache_write_tokens = cache_write_tokens + coalesce(p_cache_write, 0), updated_at = now()
    where month = r.month;                               -- 確保した月で精算（月をまたいでもずれない）
  update public.translation_reservations set status = 'settled', actual_usd = actual, settled_at = now() where id = r.id;
  return actual;
end;
$$;

-- ── 11. 本人の許可 ─────────────────────────────────────────
-- サーバーがアクセストークンで本人を確かめてから呼ぶ。取り消したら、その人の翻訳をすべて消す
create or replace function public.set_translation_consent(p_user uuid, p_allow boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.translation_consents (user_id, allow, updated_at) values (p_user, p_allow, now())
  on conflict (user_id) do update set allow = excluded.allow, updated_at = now();
  if not p_allow then delete from public.content_translations where owner_id = p_user; end if;
end;
$$;
create or replace function public.get_translation_consent(p_user uuid)
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce((select allow from public.translation_consents where user_id = p_user), false) $$;
create or replace function public.owner_allows_translation(p_username text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select c.allow from public.profiles p join public.translation_consents c on c.user_id = p.id
                    where p.username = p_username), false)
$$;

-- 関数はすべて service_role だけが実行できる（Supabase は新しい関数に既定で実行権限を付けるので外す）
revoke all on function public.translatable_source(text, text, text) from public, anon, authenticated;
revoke all on function public.get_translation(text, text, text, text) from public, anon, authenticated;
revoke all on function public.claim_translation(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.release_translation(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.store_translation(text, text, text, text, text, text, text, text[], integer, integer, numeric) from public, anon, authenticated;
revoke all on function public.reserve_translation(uuid, uuid, numeric) from public, anon, authenticated;
revoke all on function public.settle_translation(bigint, integer, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.set_translation_consent(uuid, boolean) from public, anon, authenticated;
revoke all on function public.get_translation_consent(uuid) from public, anon, authenticated;
revoke all on function public.owner_allows_translation(text) from public, anon, authenticated;
grant execute on function public.translatable_source(text, text, text) to service_role;
grant execute on function public.get_translation(text, text, text, text) to service_role;
grant execute on function public.claim_translation(text, text, text, text, text) to service_role;
grant execute on function public.release_translation(text, text, text, text, text) to service_role;
grant execute on function public.store_translation(text, text, text, text, text, text, text, text[], integer, integer, numeric) to service_role;
grant execute on function public.reserve_translation(uuid, uuid, numeric) to service_role;
grant execute on function public.settle_translation(bigint, integer, integer, integer, integer) to service_role;
grant execute on function public.set_translation_consent(uuid, boolean) to service_role;
grant execute on function public.get_translation_consent(uuid) to service_role;
grant execute on function public.owner_allows_translation(text) to service_role;

-- ── 12. 原文の編集・公開範囲の変更・削除で翻訳を消す ─────────────────────
-- プロフ帳：公開範囲（__visibility）が変わった → その人のプロフ帳の翻訳をすべて削除
--           項目の文字列が変わった・消えた → その項目の翻訳だけ削除（原文の md5 が保存値と違う）
--           行が消えた → その人のプロフ帳の翻訳をすべて削除（退会は profiles の外部キーでも消える）
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
  if (old.book -> '__visibility') is distinct from (new.book -> '__visibility') then
    delete from public.content_translations where source_type = 'profile_field' and owner_id = new.id;
  else
    delete from public.content_translations ct
      where ct.source_type = 'profile_field' and ct.owner_id = new.id
        and md5(coalesce(new.book #>> string_to_array(ct.source_path, '.'), '')) <> ct.source_hash;
  end if;
  return new;
end;
$$;
-- 回答：本文・公開範囲が変わった・削除された → その回答の翻訳をすべて削除
create or replace function public.purge_answer_translations()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'DELETE' or new.body is distinct from old.body or new.visibility is distinct from old.visibility then
    delete from public.content_translations where source_type = 'answer' and source_path = old.id::text;
  end if;
  return coalesce(new, old);
end;
$$;
revoke all on function public.purge_profile_translations() from public, anon, authenticated;
revoke all on function public.purge_answer_translations() from public, anon, authenticated;
drop trigger if exists profile_book_purge_translations on public.profile_book;
create trigger profile_book_purge_translations
  after update or delete on public.profile_book
  for each row execute function public.purge_profile_translations();
drop trigger if exists answers_purge_translations on public.answers;
create trigger answers_purge_translations
  after update or delete on public.answers
  for each row execute function public.purge_answer_translations();

commit;

-- ============================================================
-- 使用状況の確認（Supabase の SQL Editor で実行。画面には出さない）
-- ============================================================
-- select month, spent_usd, reserved_usd, requests, cache_hits, input_tokens, output_tokens,
--        cache_read_tokens, cache_write_tokens,
--        round(cache_hits::numeric / nullif(cache_hits + requests, 0) * 100, 1) as cache_hit_pct
--   from public.translation_budget order by month desc;
-- select status, count(*), sum(estimate_usd), sum(actual_usd) from public.translation_reservations
--   where month = date_trunc('month', now() at time zone 'utc')::date group by status;
-- 停止：update public.translation_settings set enabled = false, updated_at = now();

-- ============================================================
-- ROLLBACK（取り消し）— 翻訳キャッシュ・本人の許可・予算の記録が消えます（原文・回答には影響なし）
-- ============================================================
-- begin;
-- drop trigger if exists answers_purge_translations on public.answers;
-- drop trigger if exists profile_book_purge_translations on public.profile_book;
-- drop function if exists public.purge_answer_translations();
-- drop function if exists public.purge_profile_translations();
-- drop function if exists public.owner_allows_translation(text);
-- drop function if exists public.get_translation_consent(uuid);
-- drop function if exists public.set_translation_consent(uuid, boolean);
-- drop function if exists public.settle_translation(bigint, integer, integer, integer, integer);
-- drop function if exists public.reserve_translation(uuid, uuid, numeric);
-- drop function if exists public.store_translation(text, text, text, text, text, text, text, text[], integer, integer, numeric);
-- drop function if exists public.release_translation(text, text, text, text, text);
-- drop function if exists public.claim_translation(text, text, text, text, text);
-- drop function if exists public.get_translation(text, text, text, text);
-- drop function if exists public.translatable_source(text, text, text);
-- drop table if exists public.translation_daily;
-- drop table if exists public.translation_reservations;
-- drop table if exists public.translation_budget;
-- drop table if exists public.content_translations;
-- drop table if exists public.translation_consents;
-- drop table if exists public.translation_settings;
-- commit;
