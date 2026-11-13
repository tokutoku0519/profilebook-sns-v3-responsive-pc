-- ============================================================
-- 【提案・未適用】自由回答の翻訳：同意・記録・キャッシュ・予算（Phase B）
--
-- ★本番DBへの適用は承認後。このファイルは設計レビュー用です。★
-- 設計の説明：docs/translation-phase-b-review.md ／ ポリシー案：docs/privacy-policy-translation-draft.md
-- 使う側のコード：src/lib/translation/server/store.ts（DbStore）
-- テスト：supabase/tests/translation/run.sh（手元の PostgreSQL。本番には接続しない）
--
-- 翻訳してよいのは、次をすべて満たすときだけ
--  1. 書いた本人が、いまの版の説明（アプリの CONSENT_VERSION）を確認して許可している（translation_consents）
--     → 説明の版が変わったら、確認し直すまで新しい翻訳も翻訳済みの表示も止める
--  2. 本人がその項目を「公開して翻訳してよい」と選んでいる（translation_item_permissions）
--     プロフ帳はセクション（motto・__questions など）ごと、回答は 1 件ごと。
--     公開範囲が未設定の項目や、選択なしで公開になった回答（デイリーのお題など）は、選ばれていなければ対象外
--     ただし本人が「すべて（今後のものを含む）」を選んだとき（translation_consents.scope_mode = 'all'）は、
--     項目の選択を使わず、そのとき公開しているすべての項目・回答（あとから書いたものを含む）が対象。3・4 はそのまま確かめる
--  3. いまも「ログインしていない人」に見える（既存の get_visible_book と answers.visibility = 'public' で判定）
--  4. 翻訳してよい項目・場所の形・文字数の上限
--
-- データを 3 種類に分ける（保存期間と削除の決まりが違うため）
--  ① 翻訳キャッシュ：content_translations
--     原文の編集・公開範囲の変更・選択の解除・許可の取り消し・退会で削除
--  ② 法定の記録：translation_consent_events（同意・項目の変更・撤回の履歴）、translation_provision_log（外国への送信の記録）
--     翻訳キャッシュとは別に保存する。退会しても保存期間内は残す（外部キーにしない）。
--     1 行ごとに保存期限（retain_until）と根拠（retention_basis）を持ち、purge_translation_legal_records() で期限後に消す。
--      ・技術的な送信ログ（request-id・ワークスペース・エラー・時間）は translation_send_log に分け、13 か月で消す
--      ・送信の記録：送信 1 回ごとに作る（「送信中」→ 結果）。期限＝送信日から 3 年（個人情報保護委員会規則 21 条の
--        「提供の都度作成する記録」の期間と理解。原文未確認・要法務確認）
--      ・同意の記録：送信の記録の「本人の同意を得ている旨」を裏づける。期限＝作成から 3 年、かつ、その同意に基づく
--        送信の記録の期限まで延長。いまも有効な同意の履歴は消さない
--  ③ 費用の集計：translation_budget・translation_reservations（個人の ID を持たない）。確保の明細は 13 か月で消す
--     translation_daily（回数制限）だけ ID を持ち、2 日で消す（purge_translation_cost_records()）
--  ※ 翻訳キャッシュの中途半端な行（翻訳中・失敗）は 1 日で消す（purge_translation_cache()）
--
-- 権限
--  ・テーブルは RLS 有効・ポリシーなし。anon / authenticated の権限を外す。読み書きはサーバー（service_role）だけ
--  ・関数も service_role だけが実行できる。service_role は RLS を通らないので、判定はすべて関数の中で行う
--  ・ユーザーのトークン付き（auth.uid() あり）で呼ばれた判定関数は何も返さない（閲覧者の権限を持ち込まない）
--
-- 既存のテーブル（profiles・profile_book・answers）の列やデータは変更しない。トリガーを 1 つずつ追加するだけ。
-- 実行方法：Supabase の SQL Editor に貼って Run（全体が 1 トランザクション）。
-- 取り消し：いちばん下の「ROLLBACK（取り消し）」を別タブで実行。
-- ============================================================
begin;

-- 以前の案の関数のうち、引数・戻り値が変わったもの（検証用 DB に前の版を適用していた場合だけ。初めて適用するときは何もしない）
drop function if exists public.translation_replace_items(uuid, jsonb, bigint);
drop function if exists public.grant_translation_consent(uuid, text, text, text, jsonb, integer, integer, jsonb);
drop function if exists public.set_translation_items(uuid, text, jsonb);
drop function if exists public.get_translation_consent(uuid, text);

-- ── 1. 設定（1 行だけ）──────────────────────────────────────
create table if not exists public.translation_settings (
  id                         boolean primary key default true check (id),
  enabled                    boolean not null default false,   -- 運営の停止スイッチ（false で新しい翻訳を止める）
  monthly_target_usd         numeric(10,4) not null default 5,
  monthly_cap_usd            numeric(10,4) not null default 10 check (monthly_cap_usd >= 0),
  daily_user_limit           integer not null default 30,
  daily_owner_limit          integer not null default 60,
  profile_fields             text[] not null default array[      -- 翻訳してよいセクション（src/lib/translation/shared.ts と同じ）
                               'catchphrase','message','hometown',
                               'favoriteFood','dislikeFood','favoriteColor','favoriteCharacter',
                               'specialty','holiday','wantToGo','collection','motto','charmPoint','dream',
                               '__questions','__best3','__monthly'],
  max_field_chars            integer not null default 400,
  max_answer_chars           integer not null default 600,
  max_estimate_usd           numeric(10,6) not null default 0.002,
  -- 料金（米ドル / 100 万トークン）。Claude Haiku 5.5 の公式料金 × 米国内での推論（inference_geo: us）の 1.1 倍
  price_input_per_mtok       numeric(10,4) not null default 0.11,
  price_output_per_mtok      numeric(10,4) not null default 0.55,
  price_cache_read_per_mtok  numeric(10,4) not null default 0.011,
  price_cache_write_per_mtok numeric(10,4) not null default 0.1375,
  legal_record_retention     interval not null default interval '3 years',  -- ② の保存期間（法務確認で確定）
  cost_record_retention      interval not null default interval '13 months', -- ③ 確保の明細の保存期間
  age_retry                  interval not null default interval '7 days',   -- 16 歳未満と入力したあと、再入力できるまで
  halted_reason              text,                                          -- 自動で止めた理由（米国以外での処理など）。再開は運営者が確認して null に戻す
  updated_at                 timestamptz not null default now()
);
insert into public.translation_settings (id) values (true) on conflict (id) do nothing;

-- ── 2. 本人の許可（いまの状態）と選んだ項目 ─────────────────────────
create table if not exists public.translation_consents (
  user_id       uuid primary key references public.profiles(id) on delete cascade,
  allow         boolean not null default false,
  version       text,                    -- 同意した説明の版
  granted_at    timestamptz,
  last_event_id bigint,                  -- いまの状態を作った履歴（translation_consent_events.id）
  scope_mode    text not null default 'items' check (scope_mode in ('items','all')),  -- items：選んだ項目だけ／all：公開中のすべて（今後のものを含む）
  updated_at    timestamptz not null default now()
);
alter table public.translation_consents add column if not exists scope_mode text not null default 'items' check (scope_mode in ('items','all'));
create table if not exists public.translation_item_permissions (
  owner_id         uuid not null references public.profiles(id) on delete cascade,
  item_kind        text not null check (item_kind in ('profile_section','answer')),
  item_key         text not null,        -- profile_section：セクション名（motto・__questions など）／answer：回答の id
  consent_event_id bigint,
  created_at       timestamptz not null default now(),
  primary key (owner_id, item_kind, item_key)
);

-- ── 3. ② 法定の記録（翻訳キャッシュとは別。退会後も保存期間内は残す）─────────────
create table if not exists public.translation_consent_events (
  id                  bigint generated always as identity primary key,
  user_id             uuid not null,     -- 外部キーにしない（退会後も記録として残す）
  action              text not null check (action in ('grant','scope_update','revoke')),
  consent_version     text,
  consent_text_sha256 text check (consent_text_sha256 ~ '^[0-9a-f]{64}$'),  -- 表示した説明文のハッシュ（サーバーが計算）
  locale              text check (locale in ('ja','en')),
  age_check           text check (age_check in ('self_declared_16_plus')),  -- 将来：保護者の同意（'guardian_consent'）を追加
  age_band            text check (age_band in ('16_17','18_plus')),         -- 生年月は残さず、区分だけ
  scope               jsonb not null default '[]'::jsonb,                   -- 選んだ項目の一覧（scope_mode = 'all' のときは空）
  scope_mode          text check (scope_mode in ('items','all')),            -- all：公開中のすべて（今後のものを含む）に同意した。取り消しは null
  created_at          timestamptz not null default now(),
  retain_until        timestamptz not null default now() + interval '3 years',
  retention_basis     text not null default 'consent_evidence'
);
alter table public.translation_consent_events add column if not exists scope_mode text check (scope_mode in ('items','all'));
-- 同意の前に表示した説明の全文（ハッシュから文面を確かめられるように。個人情報は含まない）
create table if not exists public.translation_consent_notices (
  sha256        text primary key check (sha256 ~ '^[0-9a-f]{64}$'),
  version       text not null,
  locale        text not null check (locale in ('ja','en')),
  notice        jsonb not null,
  first_used_at timestamptz not null default now()
);
create index if not exists translation_consent_events_user_idx on public.translation_consent_events (user_id, created_at);
create table if not exists public.translation_provision_log (
  id               bigint generated always as identity primary key,
  owner_id         uuid not null,        -- 書いた本人（外部キーにしない）
  source_type      text not null check (source_type in ('profile_field','answer')),
  source_path      text not null,        -- 送った項目の場所（本文は保存しない）
  target_lang      text not null,
  recipient        text not null default 'Anthropic, PBC (United States)',
  consent_basis    text not null default 'apppi_art28_1_consent',  -- 本人の同意を得ている旨（28 条 1 項）
  consent_event_id bigint,               -- もとになった同意の記録
  requested_geo    text not null check (requested_geo = 'us'),     -- 指定した推論の地域
  reported_geo     text,                 -- 応答に書かれた推論の地域（応答がなければ null）
  -- sending：送る直前に作った（そのまま残ったら「届いたか分からない」として扱う）／completed：応答あり・米国
  -- geo_mismatch：応答はあったが米国と確認できない／workspace_mismatch：翻訳専用ワークスペース以外から応答（どちらも結果は使わない）
  -- error_response：API がエラー／unknown：タイムアウトなど
  outcome          text not null default 'sending'
                     check (outcome in ('sending','completed','geo_mismatch','workspace_mismatch','error_response','unknown')),
  sent_at          timestamptz not null default now(),
  completed_at     timestamptz,
  retain_until     timestamptz not null default now() + interval '3 years',
  retention_basis  text not null default 'ppc_rule21_per_provision_3y'
);
-- 技術的な送信ログ（法定の記録とは別の目的：障害の調査・費用の照合・Anthropic への問い合わせ）。13 か月で消す。
-- 法定の記録（translation_provision_log）の 1 行に、0 か 1 行が対応する。本文・個人の ID は持たない
create table if not exists public.translation_send_log (
  provision_id  bigint primary key references public.translation_provision_log(id) on delete cascade,
  model         text not null,
  attempt       smallint not null default 1 check (attempt between 1 and 5),
  request_id    text,                 -- Anthropic の request-id
  workspace_id  text,                 -- 応答の anthropic-workspace-id
  error_code    text,
  latency_ms    integer,
  created_at    timestamptz not null default now(),
  retain_until  timestamptz not null default now() + interval '13 months'
);
create index if not exists translation_provision_log_owner_idx on public.translation_provision_log (owner_id, sent_at);

-- ── 4. ① 翻訳キャッシュ ────────────────────────────────────
create table if not exists public.content_translations (
  id               bigint generated always as identity primary key,
  source_type      text not null check (source_type in ('profile_field','answer')),
  owner_id         uuid not null references public.profiles(id) on delete cascade,
  source_path      text not null,
  source_hash      text not null check (source_hash ~ '^[0-9a-f]{32}$'),
  audience         text not null default 'public' check (audience in ('public')),
  target_lang      text not null check (target_lang in
                     ('ja','en','ko','zh','zh-tw','id','th','vi','tl','ms','es','pt','fr','de','it','ru','ar','hi','tr','nl')),
  status           text not null default 'pending' check (status in ('pending','done','kept','failed')),
  kept_reason      text check (kept_reason in ('same_lang','no_engine','model','personal')),
  translated_text  text check (char_length(translated_text) <= 3000),
  kept_terms       text[] not null default '{}',
  engine           text not null,
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

-- ── 5. ③ 費用の集計（個人の ID を持たない）・回数制限（2 日で消す）───────────────
create table if not exists public.translation_budget (
  month              date primary key,
  spent_usd          numeric(12,6) not null default 0,
  reserved_usd       numeric(12,6) not null default 0,
  requests           integer not null default 0,
  cache_hits         integer not null default 0,
  input_tokens       bigint not null default 0,
  output_tokens      bigint not null default 0,
  cache_read_tokens  bigint not null default 0,
  cache_write_tokens bigint not null default 0,
  updated_at         timestamptz not null default now()
);
create table if not exists public.translation_reservations (
  id           bigint generated always as identity primary key,
  month        date not null references public.translation_budget(month),
  estimate_usd numeric(12,6) not null check (estimate_usd > 0),
  actual_usd   numeric(12,6),
  status       text not null default 'reserved' check (status in ('reserved','settled','expired')),
  created_at   timestamptz not null default now(),
  settled_at   timestamptz
);
create index if not exists translation_reservations_open_idx on public.translation_reservations (created_at) where status = 'reserved';
-- 16 歳未満と入力した人が、すぐに別の年を入れて回避するのを防ぐ（生年月は残さない。期限が過ぎたら消す）
create table if not exists public.translation_age_gate (
  user_id      uuid primary key references public.profiles(id) on delete cascade,
  locked_until timestamptz not null
);
create table if not exists public.translation_daily (
  subject_type text not null check (subject_type in ('user','owner')),
  subject_id   uuid not null,
  day          date not null,
  count        integer not null default 0,
  primary key (subject_type, subject_id, day)
);

do $$ declare t text; begin
  foreach t in array array['translation_settings','translation_consents','translation_item_permissions','translation_consent_events',
                           'translation_consent_notices','translation_provision_log','translation_send_log','content_translations','translation_budget',
                           'translation_reservations','translation_daily','translation_age_gate'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- ── 6. 判定の部品 ──────────────────────────────────────────
-- 本人がいまの版で許可しているか
create or replace function public.translation_consent_current(p_user uuid, p_current_version text)
returns bigint   -- いまの状態を作った履歴の id（許可していなければ null）
language sql stable security definer set search_path = public
as $$
  select c.last_event_id from public.translation_consents c
   where c.user_id = p_user and c.allow and c.version = p_current_version
$$;

-- セクション・配列などから、候補として見せる最初の文字列
create or replace function public.translation_first_text(v jsonb)
returns text language plpgsql immutable set search_path = public
as $$
declare e jsonb; k text; t text;
begin
  if v is null then return null; end if;
  if jsonb_typeof(v) = 'string' then return nullif(btrim(v #>> '{}'), ''); end if;
  if jsonb_typeof(v) = 'array' then
    for e in select * from jsonb_array_elements(v) loop
      t := public.translation_first_text(case when jsonb_typeof(e) = 'object' and e ? 'a' then e -> 'a' else e end);
      if t is not null then return t; end if;
    end loop;
    return null;
  end if;
  if jsonb_typeof(v) = 'object' then
    for k, e in select * from jsonb_each(v) loop
      if k = 'monthKey' then continue; end if;
      t := public.translation_first_text(e);
      if t is not null then return t; end if;
    end loop;
  end if;
  return null;
end;
$$;

-- 翻訳してよい原文を返す（0 行なら翻訳しない）
create or replace function public.translatable_source(p_type text, p_owner text, p_path text, p_current_version text)
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
  if auth.uid() is not null then return; end if;
  select * into s from public.translation_settings where id;
  if not found then return; end if;

  if p_type = 'answer' then
    if p_path is null or p_path !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return; end if;
    select * into a from public.answers x where x.id = p_path::uuid;
    if not found or a.visibility is distinct from 'public' then return; end if;
    if public.translation_consent_current(a.user_id, p_current_version) is null then return; end if;
    if (select c.scope_mode from public.translation_consents c where c.user_id = a.user_id) is distinct from 'all'
       and not exists (select 1 from public.translation_item_permissions ip
                        where ip.owner_id = a.user_id and ip.item_kind = 'answer' and ip.item_key = p_path) then return; end if;
    if a.body is null or btrim(a.body) = '' or char_length(a.body) > s.max_answer_chars then return; end if;
    owner_id := a.user_id; text_value := a.body; source_hash := md5(a.body); context := left(a.question_title, 200);
    return next; return;
  end if;

  if p_type <> 'profile_field' then return; end if;
  if p_path is null or p_path !~ '^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z0-9_]+){0,3}$' then return; end if;
  parts := string_to_array(p_path, '.');
  top := parts[1];
  if not (top = any (s.profile_fields)) then return; end if;
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
  if public.translation_consent_current(tgt, p_current_version) is null then return; end if;
  if (select c.scope_mode from public.translation_consents c where c.user_id = tgt) is distinct from 'all'
     and not exists (select 1 from public.translation_item_permissions ip
                      where ip.owner_id = tgt and ip.item_kind = 'profile_section' and ip.item_key = top) then return; end if;
  select pb.book into raw from public.profile_book pb where pb.id = tgt;
  if raw is null then return; end if;
  vis := raw -> '__visibility' ->> top;
  if vis is not null and vis <> 'public' then return; end if;
  visible := public.get_visible_book(p_owner);
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

-- ── 7. 翻訳キャッシュの取得・目印・保存 ──────────────────────────────
create or replace function public.get_translation(p_type text, p_owner text, p_path text, p_lang text, p_current_version text)
returns table (available boolean, status text, translated_text text, kept_reason text)
language plpgsql security definer set search_path = public
as $$
declare src record; ct record;
begin
  select * into src from public.translatable_source(p_type, p_owner, p_path, p_current_version);
  if not found then available := false; return next; return; end if;
  select x.status, x.translated_text, x.kept_reason into ct from public.content_translations x
    where x.source_type = p_type and x.owner_id = src.owner_id and x.source_path = p_path
      and x.target_lang = p_lang and x.source_hash = src.source_hash and x.status in ('done','kept');
  available := true;
  if found then
    status := ct.status; translated_text := ct.translated_text; kept_reason := ct.kept_reason;
    insert into public.translation_budget (month, cache_hits)
    values (date_trunc('month', (now() at time zone 'utc'))::date, 1)
    on conflict (month) do update set cache_hits = public.translation_budget.cache_hits + 1, updated_at = now();
  end if;
  return next;
end;
$$;

create or replace function public.claim_translation(p_type text, p_owner text, p_path text, p_lang text, p_engine text, p_current_version text)
returns table (claimed boolean, available boolean, owner_id uuid, text_value text, source_hash text, context text)
language plpgsql security definer set search_path = public
as $$
declare src record; got bigint;
begin
  select * into src from public.translatable_source(p_type, p_owner, p_path, p_current_version);
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

create or replace function public.release_translation(p_type text, p_owner text, p_path text, p_lang text, p_hash text)
returns void
language sql security definer set search_path = public
as $$
  delete from public.content_translations x
   where x.source_type = p_type and x.source_path = p_path and x.target_lang = p_lang
     and x.source_hash = p_hash and x.status = 'pending'
     and (p_type = 'answer' or x.owner_id = (select p.id from public.profiles p where p.username = p_owner));
$$;

-- 保存の瞬間にも、許可・選んだ項目・公開範囲・原文を確かめる（取り消し後・公開をやめた後は保存しない）
create or replace function public.store_translation(
  p_type text, p_owner text, p_path text, p_lang text, p_hash text,
  p_status text, p_text text, p_kept_terms text[], p_input integer, p_output integer, p_cost numeric, p_current_version text,
  p_kept_reason text default null)
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
  select * into src from public.translatable_source(p_type, p_owner, p_path, p_current_version);
  if not found or src.source_hash <> p_hash then
    perform public.release_translation(p_type, p_owner, p_path, p_lang, p_hash);
    return false;
  end if;
  update public.content_translations x
    set status = p_status, translated_text = case when p_status = 'done' then p_text end,
        kept_terms = coalesce(p_kept_terms, '{}'), input_tokens = p_input, output_tokens = p_output,
        cost_usd = p_cost, kept_reason = case when p_status = 'kept' then p_kept_reason end, updated_at = now()
    where x.source_type = p_type and x.owner_id = src.owner_id and x.source_path = p_path
      and x.target_lang = p_lang and x.source_hash = p_hash and x.status = 'pending';
  return found;
end;
$$;

-- ── 8. ② 外国にある第三者への提供の記録 ─────────────────────────────
-- 送る直前に「送信中」で作る。許可が取り消されていた・米国指定でない・止まっているときは作らず（null）、送らない。
-- 送った事実は消さない：結果は finish_translation_provision で書き足すだけ。結果が書かれないまま残った行は「届いたか不明」。
create or replace function public.begin_translation_provision(
  p_owner uuid, p_type text, p_path text, p_lang text, p_requested_geo text, p_model text, p_attempt integer, p_current_version text)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare ev bigint; g bigint; s public.translation_settings%rowtype; keep interval; pid bigint;
begin
  if p_requested_geo is distinct from 'us' then return null; end if;
  select * into s from public.translation_settings where id;
  if not found or not s.enabled or s.halted_reason is not null then return null; end if;
  keep := s.legal_record_retention;
  perform 1 from public.translation_consents c where c.user_id = p_owner for share;
  ev := public.translation_consent_current(p_owner, p_current_version);
  if ev is null then return null; end if;
  insert into public.translation_provision_log (owner_id, source_type, source_path, target_lang, consent_event_id, requested_geo, retain_until)
  values (p_owner, p_type, p_path, p_lang, ev, p_requested_geo, now() + keep)
  returning id into pid;
  insert into public.translation_send_log (provision_id, model, attempt)
  values (pid, left(p_model, 60), greatest(1, least(coalesce(p_attempt, 1), 5)));
  -- もとになった同意の記録（いまの許可を作った grant から、いまの状態まで）の保存期限を、この送信の記録の期限まで延ばす
  select max(e.id) into g from public.translation_consent_events e where e.user_id = p_owner and e.action = 'grant' and e.id <= ev;
  update public.translation_consent_events e set retain_until = greatest(e.retain_until, now() + keep)
   where e.user_id = p_owner and e.id between coalesce(g, ev) and ev;
  return pid;
end;
$$;

-- 法定の記録には結果と地域だけ、技術的な送信ログには request-id・ワークスペース・エラー・時間を書く
create or replace function public.finish_translation_provision(p_id bigint, p_outcome text, p_reported_geo text, p_request_id text, p_error text,
                                                               p_workspace_id text default null, p_latency_ms integer default null)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.translation_provision_log
     set outcome = p_outcome, reported_geo = left(p_reported_geo, 20), completed_at = now()
   where id = p_id and outcome = 'sending' and p_outcome in ('completed','geo_mismatch','workspace_mismatch','error_response','unknown');
  if found then
    update public.translation_send_log
       set request_id = left(p_request_id, 100), workspace_id = left(p_workspace_id, 60), error_code = left(p_error, 60),
           latency_ms = greatest(0, least(p_latency_ms, 600000))
     where provision_id = p_id;
  end if;
end;
$$;

-- 新しい翻訳を止める（米国以外での処理・事前確認の失敗）。再開は運営者が原因を確かめてから：
--   update public.translation_settings set enabled = true, halted_reason = null, updated_at = now();
create or replace function public.halt_translation(p_reason text)
returns void
language sql security definer set search_path = public
as $$
  update public.translation_settings set enabled = false, halted_reason = coalesce(halted_reason, left(p_reason, 200)), updated_at = now() where id;
$$;

-- ── 9. ③ 予算の確保と精算（費用の記録に個人の ID を持たない）──────────────────
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
  select * into b from public.translation_budget where month = m for update;   -- この月の行をロック（1 件ずつ判定）
  delete from public.translation_daily where day < d - 1;                       -- 回数制限の記録は 2 日で消す
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

  insert into public.translation_reservations (month, estimate_usd) values (m, p_estimate_usd) returning id into reservation_id;
  update public.translation_budget set reserved_usd = reserved_usd + p_estimate_usd, requests = requests + 1, updated_at = now()
    where month = m;
  result := 'ok'; return next;
end;
$$;

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
    where month = r.month;
  update public.translation_reservations set status = 'settled', actual_usd = actual, settled_at = now() where id = r.id;
  return actual;
end;
$$;

-- ── 10. 本人の許可・選んだ項目（サーバーがアクセストークンで本人を確かめてから呼ぶ）──────────
-- 同意画面に出す候補：いまログインしていない人に見えていて、中身のあるセクションと公開回答
create or replace function public.translation_candidates(p_user uuid)
returns table (kind text, item_key text, preview text, question text, check_text text)
language plpgsql stable security definer set search_path = public
as $$
declare s public.translation_settings%rowtype; uname text; visible jsonb; vis jsonb; k text; t text;
begin
  if auth.uid() is not null then return; end if;
  select * into s from public.translation_settings where id;
  select p.username into uname from public.profiles p where p.id = p_user;
  if uname is null then return; end if;
  visible := public.get_visible_book(uname);
  select coalesce(pb.book -> '__visibility', '{}'::jsonb) into vis from public.profile_book pb where pb.id = p_user;
  foreach k in array s.profile_fields loop
    if coalesce(vis ->> k, 'public') <> 'public' then continue; end if;   -- 公開以外（コミュニティ限定など）は候補にしない
    t := public.translation_first_text(visible -> k);
    if t is not null then
      -- check_text：サーバーが個人情報のチェックにかけて「翻訳されない理由」を本人に示すため（ブラウザには返さない）
      kind := 'profile_section'; item_key := k; preview := left(t, 60); question := null; check_text := left((visible -> k)::text, 4000);
      return next;
    end if;
  end loop;
  return query select 'answer'::text, a.id::text, left(a.body, 60), left(a.question_title, 60), left(coalesce(a.question_title, '') || E'\n' || a.body, 4000)
    from public.answers a
   where a.user_id = p_user and a.visibility = 'public' and a.body is not null and btrim(a.body) <> ''
   order by a.created_at desc limit 100;
end;
$$;

-- 選んだ項目がすべて候補の中にあるか（候補にない＝公開でない・本人のものでない → 拒否）
create or replace function public.translation_items_valid(p_user uuid, p_items jsonb)
returns boolean
language sql stable security definer set search_path = public
as $$
  select jsonb_typeof(p_items) = 'array' and jsonb_array_length(p_items) between 1 and 150
     and not exists (
       select 1 from jsonb_array_elements(p_items) e
        where not exists (
          select 1 from public.translation_candidates(p_user) c
           where c.kind = e ->> 'kind' and c.item_key = coalesce(e ->> 'key', e ->> 'id')))
$$;

-- 翻訳の対象を置きかえる
--  all：項目の選択は使わない（公開中のすべて・今後のものを含む）。翻訳キャッシュはそのまま使える
--  items：選んだ項目だけ。選んでいない項目の翻訳キャッシュは消す（前が all だった場合も含む）
create or replace function public.translation_replace_items(p_user uuid, p_mode text, p_items jsonb, p_event bigint)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.translation_item_permissions where owner_id = p_user;
  if p_mode = 'all' then
    update public.translation_consents set scope_mode = 'all' where user_id = p_user;
    return;
  end if;
  delete from public.content_translations ct
   where ct.owner_id = p_user
     and not exists (select 1 from jsonb_array_elements(p_items) e
                      where (ct.source_type = 'answer' and e ->> 'kind' = 'answer' and e ->> 'id' = ct.source_path)
                         or (ct.source_type = 'profile_field' and e ->> 'kind' = 'profile_section' and e ->> 'key' = split_part(ct.source_path, '.', 1)));
  insert into public.translation_item_permissions (owner_id, item_kind, item_key, consent_event_id)
  select p_user, e ->> 'kind', coalesce(e ->> 'key', e ->> 'id'), p_event from jsonb_array_elements(p_items) e
  on conflict do nothing;
  update public.translation_consents set scope_mode = 'items' where user_id = p_user;
end;
$$;

-- 許可。年齢は SQL でも計算し直す（日本時間・誕生月は月末生まれとして少なめに数える）。生まれた年月は保存しない。
-- 16 歳未満なら一定期間（age_retry）再入力できないようにする。年齢不明（形がおかしい・未来）は許可しない
create or replace function public.grant_translation_consent(p_user uuid, p_version text, p_locale text, p_text_sha256 text,
                                                           p_notice jsonb, p_birth_year integer, p_birth_month integer, p_items jsonb,
                                                           p_scope_mode text default 'items')
returns table (ok boolean, reason text)
language plpgsql security definer set search_path = public
as $$
declare ev bigint; jst timestamp := now() at time zone 'Asia/Tokyo'; y int; m int; age int; band text; s public.translation_settings%rowtype;
begin
  if auth.uid() is not null then ok := false; reason := 'forbidden'; return next; return; end if;
  select * into s from public.translation_settings where id;
  if exists (select 1 from public.translation_age_gate g where g.user_id = p_user and g.locked_until > now()) then
    ok := false; reason := 'age_locked'; return next; return;
  end if;
  y := extract(year from jst); m := extract(month from jst);
  if p_birth_year is null or p_birth_month is null or p_birth_month not between 1 and 12
     or p_birth_year < y - 120 or p_birth_year > y or (p_birth_year = y and p_birth_month > m) then
    ok := false; reason := 'age_invalid'; return next; return;
  end if;
  age := y - p_birth_year - case when m <= p_birth_month then 1 else 0 end;
  if age < 16 then
    insert into public.translation_age_gate (user_id, locked_until) values (p_user, now() + s.age_retry)
    on conflict (user_id) do update set locked_until = excluded.locked_until;
    ok := false; reason := 'age'; return next; return;
  end if;
  band := case when age >= 18 then '18_plus' else '16_17' end;
  if p_scope_mode is null or p_scope_mode not in ('items','all') then ok := false; reason := 'no_items'; return next; return; end if;
  if p_scope_mode = 'items' then
    if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then ok := false; reason := 'no_items'; return next; return; end if;
    if not public.translation_items_valid(p_user, p_items) then ok := false; reason := 'not_public'; return next; return; end if;
  end if;
  if p_notice is not null and p_text_sha256 is not null then
    insert into public.translation_consent_notices (sha256, version, locale, notice) values (p_text_sha256, p_version, p_locale, p_notice)
    on conflict (sha256) do nothing;
  end if;
  insert into public.translation_consent_events (user_id, action, consent_version, consent_text_sha256, locale, age_check, age_band, scope, scope_mode, retain_until)
  values (p_user, 'grant', p_version, p_text_sha256, p_locale, 'self_declared_16_plus', band,
          case when p_scope_mode = 'all' then '[]'::jsonb else p_items end, p_scope_mode, now() + s.legal_record_retention) returning id into ev;
  insert into public.translation_consents (user_id, allow, version, granted_at, last_event_id, updated_at)
  values (p_user, true, p_version, now(), ev, now())
  on conflict (user_id) do update set allow = true, version = excluded.version, granted_at = now(), last_event_id = ev, updated_at = now();
  perform public.translation_replace_items(p_user, p_scope_mode, p_items, ev);
  ok := true; return next;
end;
$$;

create or replace function public.set_translation_items(p_user uuid, p_current_version text, p_items jsonb, p_scope_mode text default 'items')
returns table (ok boolean, reason text)
language plpgsql security definer set search_path = public
as $$
declare ev bigint; cv text;
begin
  if auth.uid() is not null then ok := false; reason := 'forbidden'; return next; return; end if;
  if public.translation_consent_current(p_user, p_current_version) is null then ok := false; reason := 'old_version'; return next; return; end if;
  if p_scope_mode is null or p_scope_mode not in ('items','all') then ok := false; reason := 'no_items'; return next; return; end if;
  if p_scope_mode = 'items' then
    if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then ok := false; reason := 'no_items'; return next; return; end if;
    if not public.translation_items_valid(p_user, p_items) then ok := false; reason := 'not_public'; return next; return; end if;
  end if;
  select version into cv from public.translation_consents where user_id = p_user;
  insert into public.translation_consent_events (user_id, action, consent_version, scope, scope_mode)
  values (p_user, 'scope_update', cv, case when p_scope_mode = 'all' then '[]'::jsonb else p_items end, p_scope_mode) returning id into ev;
  update public.translation_consents set last_event_id = ev, updated_at = now() where user_id = p_user;
  perform public.translation_replace_items(p_user, p_scope_mode, p_items, ev);
  ok := true; return next;
end;
$$;

-- 取り消し：選んだ項目と翻訳キャッシュは消す。② の記録（取り消しの履歴を含む）は残す
create or replace function public.revoke_translation_consent(p_user uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare ev bigint;
begin
  if auth.uid() is not null then return; end if;
  insert into public.translation_consent_events (user_id, action) values (p_user, 'revoke') returning id into ev;
  update public.translation_consents set allow = false, scope_mode = 'items', last_event_id = ev, updated_at = now() where user_id = p_user;
  delete from public.translation_item_permissions where owner_id = p_user;
  delete from public.content_translations where owner_id = p_user;
end;
$$;

create or replace function public.get_translation_consent(p_user uuid, p_current_version text)
returns table (allow boolean, version text, is_current boolean, granted_at timestamptz, items jsonb, scope_mode text)
language sql stable security definer set search_path = public
as $$
  select coalesce(c.allow, false), c.version, coalesce(c.allow and c.version = p_current_version, false), c.granted_at,
         coalesce((select jsonb_agg(case when ip.item_kind = 'answer' then jsonb_build_object('kind','answer','id',ip.item_key)
                                         else jsonb_build_object('kind','profile_section','key',ip.item_key) end)
                     from public.translation_item_permissions ip where ip.owner_id = p_user), '[]'::jsonb),
         coalesce(c.scope_mode, 'items')
    from (select p_user as uid) x left join public.translation_consents c on c.user_id = x.uid
$$;

create or replace function public.owner_allows_translation(p_username text, p_current_version text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
      join public.translation_consents c on c.user_id = p.id and c.allow and c.version = p_current_version
     where p.username = p_username
       and (c.scope_mode = 'all' or exists (select 1 from public.translation_item_permissions ip where ip.owner_id = p.id)))
$$;

-- ── 保存・削除の条件は 3 種類で分ける（Supabase の pg_cron などで 1 日 1 回ずつ）──────────────
-- ② 法定の記録：1 行ごとの保存期限（retain_until）を過ぎたものだけ消す。
--   ただし、いまも有効な許可のもとになっている同意の履歴は消さない（このあとの送信の裏づけになるため）
create or replace function public.purge_translation_legal_records()
returns table (consent_events bigint, provisions bigint)
language plpgsql security definer set search_path = public
as $$
begin
  with d as (delete from public.translation_provision_log where retain_until < now() returning 1)
  select count(*) into provisions from d;
  with d as (
    delete from public.translation_consent_events e
     where e.retain_until < now()
       and not exists (select 1 from public.translation_provision_log p where p.consent_event_id = e.id and p.retain_until >= now())
       and not exists (
         select 1 from public.translation_consents c
          where c.user_id = e.user_id and c.allow
            and e.id >= coalesce((select max(g.id) from public.translation_consent_events g
                                   where g.user_id = e.user_id and g.action = 'grant' and g.id <= c.last_event_id), c.last_event_id))
     returning 1)
  select count(*) into consent_events from d;
  return next;
end;
$$;
-- 技術的な送信ログ：13 か月（法定の記録より先に消える。法定の記録が消えると一緒に消える）
create or replace function public.purge_translation_send_log()
returns bigint
language sql security definer set search_path = public
as $$
  with d as (delete from public.translation_send_log where retain_until < now() returning 1) select count(*) from d;
$$;
-- ③ 費用の集計：回数制限の記録（ID あり）は 2 日、確保の明細（ID なし）は 13 か月。月の合計は残す
create or replace function public.purge_translation_cost_records()
returns table (daily_rows bigint, reservations bigint)
language plpgsql security definer set search_path = public
as $$
declare keep interval;
begin
  select cost_record_retention into keep from public.translation_settings where id;
  with d as (delete from public.translation_daily where day < (now() at time zone 'utc')::date - 1 returning 1) select count(*) into daily_rows from d;
  with d as (delete from public.translation_reservations where status <> 'reserved' and created_at < now() - keep returning 1) select count(*) into reservations from d;
  return next;
end;
$$;
-- ① 翻訳キャッシュ：完成した翻訳は「原文の編集・公開範囲の変更・選択の解除・取り消し・退会」で消える（トリガーと関数）。
--   ここでは、翻訳中・失敗のまま 1 日たった行と、期限の過ぎた年齢の再入力制限を消す
create or replace function public.purge_translation_cache()
returns table (stale_rows bigint, age_gates bigint)
language plpgsql security definer set search_path = public
as $$
begin
  with d as (delete from public.content_translations where status in ('pending','failed') and updated_at < now() - interval '1 day' returning 1) select count(*) into stale_rows from d;
  with d as (delete from public.translation_age_gate where locked_until < now() returning 1) select count(*) into age_gates from d;
  return next;
end;
$$;

do $$ declare f text; begin
  foreach f in array array[
    'translation_consent_current(uuid, text)', 'translation_first_text(jsonb)', 'translatable_source(text, text, text, text)',
    'get_translation(text, text, text, text, text)', 'claim_translation(text, text, text, text, text, text)',
    'release_translation(text, text, text, text, text)',
    'store_translation(text, text, text, text, text, text, text, text[], integer, integer, numeric, text, text)',
    'begin_translation_provision(uuid, text, text, text, text, text, integer, text)',
    'finish_translation_provision(bigint, text, text, text, text, text, integer)', 'halt_translation(text)', 'reserve_translation(uuid, uuid, numeric)',
    'settle_translation(bigint, integer, integer, integer, integer)', 'translation_candidates(uuid)',
    'translation_items_valid(uuid, jsonb)', 'translation_replace_items(uuid, text, jsonb, bigint)',
    'grant_translation_consent(uuid, text, text, text, jsonb, integer, integer, jsonb, text)', 'set_translation_items(uuid, text, jsonb, text)',
    'revoke_translation_consent(uuid)', 'get_translation_consent(uuid, text)', 'owner_allows_translation(text, text)',
    'purge_translation_legal_records()', 'purge_translation_send_log()', 'purge_translation_cost_records()', 'purge_translation_cache()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- ── 11. 原文の編集・公開範囲の変更・削除で、翻訳キャッシュと選んだ項目を消す ───────────────
-- プロフ帳：公開以外（フォロワー限定・非公開など）にしたセクションは、選択も外す（公開に戻しても、選び直すまで訳さない）。
--           公開範囲が変わったら、その人のプロフ帳の翻訳キャッシュはすべて削除。文字列が変わった項目の翻訳も削除。
-- 回答：本文・公開範囲が変わったら翻訳キャッシュを削除。公開以外にした・削除したら選択も外す。
create or replace function public.purge_profile_translations()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare k text;
begin
  if tg_op = 'DELETE' then
    delete from public.content_translations where source_type = 'profile_field' and owner_id = old.id;
    delete from public.translation_item_permissions where owner_id = old.id and item_kind = 'profile_section';
    return old;
  end if;
  if new.book is not distinct from old.book then return new; end if;
  if (old.book -> '__visibility') is distinct from (new.book -> '__visibility') then
    delete from public.content_translations where source_type = 'profile_field' and owner_id = new.id;
    for k in select key from jsonb_object_keys(coalesce(old.book -> '__visibility', '{}'::jsonb) || coalesce(new.book -> '__visibility', '{}'::jsonb)) as t(key) loop
      if (old.book -> '__visibility' ->> k) is distinct from (new.book -> '__visibility' ->> k)
         and coalesce(new.book -> '__visibility' ->> k, 'public') <> 'public' then   -- 公開以外になったセクションだけ選択を外す
        delete from public.translation_item_permissions where owner_id = new.id and item_kind = 'profile_section' and item_key = k;
      end if;
    end loop;
  else
    delete from public.content_translations ct
      where ct.source_type = 'profile_field' and ct.owner_id = new.id
        and md5(coalesce(new.book #>> string_to_array(ct.source_path, '.'), '')) <> ct.source_hash;
  end if;
  return new;
end;
$$;
-- 回答：本文が変わった → 翻訳キャッシュを削除。公開範囲が変わった・削除された → 選択も外す
create or replace function public.purge_answer_translations()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'DELETE' or new.body is distinct from old.body or new.visibility is distinct from old.visibility then
    delete from public.content_translations where source_type = 'answer' and source_path = old.id::text;
  end if;
  if tg_op = 'DELETE' or new.visibility is distinct from 'public' then
    delete from public.translation_item_permissions where item_kind = 'answer' and item_key = old.id::text;
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
-- 退会（アカウント削除）時の扱い
--  ・auth.users を削除 → profiles が削除 → 外部キーで translation_consents・translation_item_permissions・
--    content_translations が削除される（① と「いまの状態」）
--  ・② 法定の記録（translation_consent_events・translation_provision_log）は残り、保存期間後に purge で消える
--  ・③ 費用の集計に個人の ID はない。translation_daily は 2 日で消える
-- ============================================================

-- ============================================================
-- 使用状況・記録の確認（Supabase の SQL Editor で実行。画面には出さない）。検証用の SQL は supabase/verify_content_translations.sql
-- ============================================================
-- select month, spent_usd, reserved_usd, requests, cache_hits, input_tokens, output_tokens from public.translation_budget order by month desc;
-- select action, consent_version, age_band, created_at, retain_until from public.translation_consent_events where user_id = '<uuid>' order by created_at;
-- select source_type, source_path, target_lang, recipient, requested_geo, reported_geo, outcome, sent_at, retain_until
--   from public.translation_provision_log where owner_id = '<uuid>' order by sent_at;
-- 技術的な送信ログ：select p.sent_at, p.outcome, s.request_id, s.workspace_id, s.error_code, s.latency_ms
--   from public.translation_provision_log p left join public.translation_send_log s on s.provision_id = p.id order by p.sent_at desc limit 50;
-- 止まっているか：select enabled, halted_reason from public.translation_settings;
-- 停止：update public.translation_settings set enabled = false, updated_at = now();
-- 取り消し（テーブル・関数の削除）：supabase/rollback_content_translations.sql
