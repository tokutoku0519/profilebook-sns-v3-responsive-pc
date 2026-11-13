\set QUIET on
-- 説明の版は 'v1'（アプリの CONSENT_VERSION にあたる）。'v2' は「説明が改訂された」場合
\set A '''aaaaaaaa-0000-4000-8000-000000000001'''
\set B '''bbbbbbbb-0000-4000-8000-000000000002'''
\set C '''cccccccc-0000-4000-8000-000000000003'''
insert into public.profiles (id, username) values (:A,'alice'),(:B,'bob'),(:C,'carol');
insert into public.follows values (:B, :A);
insert into public.profile_book values (:A, jsonb_build_object(
  'name','山田ありす','nickname','ありす','catchphrase','よろしくね','motto','なんとかなる','dream','パン屋さん in Paris','specialty','指パッチン','hometown','大阪',
  'collection','香水','wantToGo', repeat('あ', 401),'holiday', jsonb_build_object('x','y'),
  '__questions', jsonb_build_array(jsonb_build_object('q','好きな季節は？','a','夏🍉')),
  '__best3', jsonb_build_object('drink', jsonb_build_array('ミルクティー','','')),
  '__visibility', jsonb_build_object('motto','followers','dream','public','hometown','private','collection','community','wantToGo','public','holiday','public'),
  '__game', jsonb_build_object('coins',500), '__purchases', jsonb_build_array('pi_x'), '__choices', jsonb_build_object('time','a'))),
  (:B, '{"dream":"ダイビング","__visibility":{"dream":"public"}}'), (:C, '{}');
insert into public.answers (id, user_id, question_key, question_title, body, visibility) values
  ('11111111-0000-4000-8000-000000000001', :A, 'd1', '小学校の給食で好きだったものは？', '揚げパン', 'public'),
  ('11111111-0000-4000-8000-000000000002', :A, 'd2', '休みの日は？', 'ずっと寝てる', 'followers'),
  ('11111111-0000-4000-8000-000000000003', :A, 'd3', '秘密は？', 'ないしょ', 'private'),
  ('11111111-0000-4000-8000-000000000004', :A, 'daily_2026-11-01', '今日のお題：朝ごはんは？', 'トースト', 'public'),  -- デイリー（選択なしで公開）
  ('11111111-0000-4000-8000-000000000005', :B, 'd1', '小学校の給食で好きだったものは？', 'カレー', 'public');

\echo '== 1. anon / authenticated からは使えない'
set role anon; set request.jwt.claims = '{"role":"anon"}';
do $$ declare t text; begin
  foreach t in array array['translation_settings','translation_consents','translation_item_permissions','translation_consent_events','translation_consent_notices',
                           'translation_provision_log','translation_send_log','content_translations','translation_budget','translation_reservations','translation_daily','translation_age_gate'] loop
    begin execute format('select 1 from public.%I limit 1', t); raise notice 'FAIL anon が % を読めた', t;
    exception when insufficient_privilege then raise notice 'PASS anon は % を読めない', t; end;
  end loop;
end $$;
reset role;
set role authenticated; set request.jwt.claims = '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
do $$ declare f text; begin
  foreach f in array array[
    'select public.translatable_source(''profile_field'',''alice'',''dream'',''v1'')',
    'select public.get_translation(''profile_field'',''alice'',''dream'',''en'',''v1'')',
    'select public.claim_translation(''profile_field'',''alice'',''dream'',''en'',''x'',''v1'')',
    'select public.release_translation(''profile_field'',''alice'',''dream'',''en'',md5(''x''))',
    'select public.store_translation(''profile_field'',''alice'',''dream'',''en'',md5(''x''),''done'',''x'',null,1,1,0,''v1'',null)',
    'select public.begin_translation_provision(''aaaaaaaa-0000-4000-8000-000000000001''::uuid,''profile_field'',''dream'',''en'',''us'',''m'',1,''v1'')',
    'select public.finish_translation_provision(1,''completed'',''us'',null,null)',
    'select public.halt_translation(''x'')',
    'select public.reserve_translation(''bbbbbbbb-0000-4000-8000-000000000002''::uuid,''aaaaaaaa-0000-4000-8000-000000000001''::uuid,0.0004)',
    'select public.settle_translation(1,1,1)',
    'select public.translation_candidates(''bbbbbbbb-0000-4000-8000-000000000002''::uuid)',
    'select public.grant_translation_consent(''aaaaaaaa-0000-4000-8000-000000000001''::uuid,''v1'',''ja'',null,null,2000,1,''[{"kind":"profile_section","key":"dream"}]'')',
    'select public.set_translation_items(''aaaaaaaa-0000-4000-8000-000000000001''::uuid,''v1'',''[{"kind":"profile_section","key":"dream"}]'')',
    'select public.revoke_translation_consent(''aaaaaaaa-0000-4000-8000-000000000001''::uuid)',
    'select public.get_translation_consent(''aaaaaaaa-0000-4000-8000-000000000001''::uuid,''v1'')',
    'select public.owner_allows_translation(''alice'',''v1'')',
    'select public.purge_translation_legal_records()',
    'select public.purge_translation_send_log()',
    'select public.purge_translation_cost_records()',
    'select public.purge_translation_cache()',
    'update public.translation_provision_log set outcome = ''completed''',
    'insert into public.translation_consents (user_id, allow, version) values (''bbbbbbbb-0000-4000-8000-000000000002'', true, ''v1'')',
    'insert into public.translation_item_permissions (owner_id, item_kind, item_key) values (''bbbbbbbb-0000-4000-8000-000000000002'',''profile_section'',''dream'')',
    'delete from public.translation_consent_events',
    'update public.translation_settings set enabled = true, monthly_cap_usd = 99999',
    'insert into public.content_translations (source_type, owner_id, source_path, source_hash, target_lang, engine) values (''profile_field'',''aaaaaaaa-0000-4000-8000-000000000001'',''dream'',md5(''x''),''en'',''x'')'] loop
    begin execute f; raise notice 'FAIL ログイン中のユーザーが実行できた: %', left(f, 70);
    exception when insufficient_privilege then raise notice 'PASS ログイン中のユーザーは実行できない: %', left(f, 70); end;
  end loop;
end $$;
reset role;

\echo '== 2. 同意画面の候補と、許可の確認'
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
do $$ declare ks text[]; r record; n int; ev public.translation_consent_events%rowtype; begin
  perform 1 from public.translatable_source('profile_field','alice','dream','v1');
  raise notice '% 許可なし：公開の dream も取り出せない', case when found then 'FAIL' else 'PASS' end;
  perform 1 from public.translatable_source('answer', null, '11111111-0000-4000-8000-000000000001','v1');
  raise notice '% 許可なし：公開の回答も取り出せない', case when found then 'FAIL' else 'PASS' end;
  raise notice '% 許可なし：owner_allows_translation = false', case when public.owner_allows_translation('alice','v1') then 'FAIL' else 'PASS' end;

  select array_agg(c.kind || ':' || c.item_key order by c.kind, c.item_key) into ks from public.translation_candidates('aaaaaaaa-0000-4000-8000-000000000001') c;
  raise notice '% 候補にログインしていない人に見える項目が出る: %',
    case when ks @> array['profile_section:dream','profile_section:catchphrase','profile_section:specialty','profile_section:__questions','profile_section:__best3',
                          'answer:11111111-0000-4000-8000-000000000001','answer:11111111-0000-4000-8000-000000000004'] then 'PASS' else 'FAIL' end, ks;
  raise notice '% 候補に出ない（フォロワー限定・非公開・コミュニティ限定・名前・ほかの人の回答）',
    case when ks && array['profile_section:motto','profile_section:hometown','profile_section:collection','profile_section:name',
                          'answer:11111111-0000-4000-8000-000000000002','answer:11111111-0000-4000-8000-000000000003','answer:11111111-0000-4000-8000-000000000005']
         then 'FAIL' else 'PASS' end;
  select * into r from public.translation_candidates('aaaaaaaa-0000-4000-8000-000000000001') c where c.item_key = '__questions';
  raise notice '% ひとこと質問の候補の見本は回答（%）', case when r.preview = '夏🍉' then 'PASS' else 'FAIL' end, r.preview;

  select * into r from public.grant_translation_consent('aaaaaaaa-0000-4000-8000-000000000001','v1','ja',repeat('a',64),'{"t":"notice"}'::jsonb,null,4,'[{"kind":"profile_section","key":"dream"}]');
  raise notice '% 生まれた年月がない（年齢不明）と許可しない: %', case when not r.ok and r.reason = 'age_invalid' then 'PASS' else 'FAIL' end, r.reason;
  select * into r from public.grant_translation_consent('aaaaaaaa-0000-4000-8000-000000000001','v1','ja',repeat('a',64),'{"t":"notice"}'::jsonb,2000,13,'[{"kind":"profile_section","key":"dream"}]');
  raise notice '% 月が 13 なら許可しない: %', case when not r.ok and r.reason = 'age_invalid' then 'PASS' else 'FAIL' end, r.reason;
  select * into r from public.grant_translation_consent('aaaaaaaa-0000-4000-8000-000000000001','v1','ja',repeat('a',64),'{"t":"notice"}'::jsonb,
    extract(year from now() at time zone 'Asia/Tokyo')::int + 1,1,'[{"kind":"profile_section","key":"dream"}]');
  raise notice '% 未来の年なら許可しない: %', case when not r.ok and r.reason = 'age_invalid' then 'PASS' else 'FAIL' end, r.reason;
  -- 誕生月が今月なら、まだ誕生日が来ていないとして数える（16 年前の今月生まれ → 15 歳）
  select * into r from public.grant_translation_consent('cccccccc-0000-4000-8000-000000000003','v1','ja',repeat('a',64),'{"t":"notice"}'::jsonb,
    extract(year from now() at time zone 'Asia/Tokyo')::int - 16, extract(month from now() at time zone 'Asia/Tokyo')::int,'[{"kind":"profile_section","key":"dream"}]');
  raise notice '% 16 年前の今月生まれは 15 歳として扱い、許可しない: %', case when not r.ok and r.reason = 'age' then 'PASS' else 'FAIL' end, r.reason;
  select count(*) into n from public.translation_age_gate where user_id = 'cccccccc-0000-4000-8000-000000000003' and locked_until > now() + interval '6 days';
  raise notice '% 16 歳未満と入力したら 7 日間は再入力できない（生年月は残さない）', case when n = 1 then 'PASS' else 'FAIL' end;
  select * into r from public.grant_translation_consent('cccccccc-0000-4000-8000-000000000003','v1','ja',repeat('a',64),'{"t":"notice"}'::jsonb,1990,1,'[{"kind":"profile_section","key":"dream"}]');
  raise notice '% すぐに大人の年を入れ直しても許可しない: %', case when not r.ok and r.reason = 'age_locked' then 'PASS' else 'FAIL' end, r.reason;
  select count(*) into n from information_schema.columns where table_schema = 'public' and table_name like 'translation%' and column_name ~ 'birth';
  raise notice '% 翻訳のテーブルに生年月の列はない', case when n = 0 then 'PASS' else 'FAIL' end;
  select * into r from public.grant_translation_consent('aaaaaaaa-0000-4000-8000-000000000001','v1','ja',repeat('a',64),'{"t":"notice"}'::jsonb,2000,4,'[]');
  raise notice '% 項目を選ばないと許可しない: %', case when not r.ok and r.reason = 'no_items' then 'PASS' else 'FAIL' end, r.reason;
  select * into r from public.grant_translation_consent('aaaaaaaa-0000-4000-8000-000000000001','v1','ja',repeat('a',64),'{"t":"notice"}'::jsonb,2000,4,'[{"kind":"profile_section","key":"dream"},{"kind":"profile_section","key":"motto"}]');
  raise notice '% フォロワー限定の項目を含むと許可しない: %', case when not r.ok and r.reason = 'not_public' then 'PASS' else 'FAIL' end, r.reason;
  select * into r from public.grant_translation_consent('aaaaaaaa-0000-4000-8000-000000000001','v1','ja',repeat('a',64),'{"t":"notice"}'::jsonb,2000,4,'[{"kind":"answer","id":"11111111-0000-4000-8000-000000000005"}]');
  raise notice '% ほかの人の回答は選べない: %', case when not r.ok and r.reason = 'not_public' then 'PASS' else 'FAIL' end, r.reason;
  select * into r from public.grant_translation_consent('aaaaaaaa-0000-4000-8000-000000000001','v1','ja',repeat('a',64),'{"t":"notice"}'::jsonb,2000,4,'[{"kind":"answer","id":"11111111-0000-4000-8000-000000000002"}]');
  raise notice '% フォロワー限定の回答は選べない: %', case when not r.ok and r.reason = 'not_public' then 'PASS' else 'FAIL' end, r.reason;
  select count(*) into n from public.translation_consent_events;
  raise notice '% 許可しなかった操作は記録を作らない: %', case when n = 0 then 'PASS' else 'FAIL' end, n;
  raise notice '% 許可しなかったので owner_allows_translation = false', case when public.owner_allows_translation('alice','v1') then 'FAIL' else 'PASS' end;

  select * into r from public.grant_translation_consent('aaaaaaaa-0000-4000-8000-000000000001','v1','ja',repeat('a',64),'{"t":"notice"}'::jsonb,2000,4,
    '[{"kind":"profile_section","key":"dream"},{"kind":"profile_section","key":"catchphrase"},{"kind":"profile_section","key":"__questions"},{"kind":"profile_section","key":"__best3"},{"kind":"answer","id":"11111111-0000-4000-8000-000000000001"}]');
  raise notice '% 説明の版・言語・16 歳以上・公開中の項目がそろえば許可できる', case when r.ok then 'PASS' else 'FAIL' end;
  select * into ev from public.translation_consent_events order by id desc limit 1;
  raise notice '% 同意の記録（版 %・言語 %・説明文のハッシュ・年齢確認 %・区分 %・項目 % 件・日時）', case when ev.action = 'grant' and ev.consent_version = 'v1' and ev.locale = 'ja'
    and ev.consent_text_sha256 = repeat('a',64) and ev.age_check = 'self_declared_16_plus' and ev.age_band = '18_plus' and jsonb_array_length(ev.scope) = 5 and ev.created_at is not null
    and ev.retain_until > now() + interval '2 years 11 months' then 'PASS' else 'FAIL' end,
    ev.consent_version, ev.locale, ev.age_check, ev.age_band, jsonb_array_length(ev.scope);
  select count(*) into n from public.translation_consent_notices where sha256 = repeat('a',64) and version = 'v1';
  raise notice '% 表示した説明の全文をハッシュと一緒に残す', case when n = 1 then 'PASS' else 'FAIL' end;
  select count(*) into n from public.translation_item_permissions where owner_id = 'aaaaaaaa-0000-4000-8000-000000000001';
  raise notice '% 選んだ項目を保存: % 件', case when n = 5 then 'PASS' else 'FAIL' end, n;
  raise notice '% 許可したら owner_allows_translation(v1) = true', case when public.owner_allows_translation('alice','v1') then 'PASS' else 'FAIL' end;
  raise notice '% 説明が改訂されたら（v2）確認し直すまで false', case when public.owner_allows_translation('alice','v2') then 'FAIL' else 'PASS' end;
  perform 1 from public.translatable_source('profile_field','alice','dream','v2');
  raise notice '% 説明が改訂されたら（v2）取り出せない', case when found then 'FAIL' else 'PASS' end;
  select * into r from public.get_translation_consent('aaaaaaaa-0000-4000-8000-000000000001','v1');
  raise notice '% 本人の状態（allow %・いまの版 %・項目 % 件）', case when r.allow and r.is_current and jsonb_array_length(r.items) = 5 then 'PASS' else 'FAIL' end, r.allow, r.is_current, jsonb_array_length(r.items);
  select * into r from public.get_translation_consent('aaaaaaaa-0000-4000-8000-000000000001','v2');
  raise notice '% 版が違えば is_current = false', case when r.allow and not r.is_current then 'PASS' else 'FAIL' end;
  select * into r from public.get_translation_consent('cccccccc-0000-4000-8000-000000000003','v1');
  raise notice '% 許可していない人は allow = false・項目 0', case when not r.allow and jsonb_array_length(r.items) = 0 then 'PASS' else 'FAIL' end;
end $$;
reset role;

\echo '== 3. 取り出せる・取り出せない（許可あり）'
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
do $$ declare r record; p text; begin
  select * into r from public.translatable_source('profile_field','alice','dream','v1');
  raise notice '% 選んだ公開の dream: % / 手がかり %', case when r.text_value = 'パン屋さん in Paris' and r.source_hash = md5('パン屋さん in Paris') then 'PASS' else 'FAIL' end, r.text_value, r.context;
  foreach p in array array['catchphrase','__questions.0.a','__best3.drink.0'] loop
    select * into r from public.translatable_source('profile_field','alice', p, 'v1');
    raise notice '% 公開範囲が未設定でも、本人が選んだ項目は取り出せる: % = % (%)', case when r.text_value is not null then 'PASS' else 'FAIL' end, p, r.text_value, r.context;
  end loop;
  perform 1 from public.translatable_source('profile_field','alice','specialty','v1');
  raise notice '% 公開中でも選ばれていない項目（specialty）は取り出せない', case when found then 'FAIL' else 'PASS' end;
  foreach p in array array['motto','hometown','collection','name','nickname','__game','__game.coins','__visibility','__visibility.dream','__purchases','__choices.time','wantToGo','holiday','holiday.x','__questions.0.q','__questions.0','__best3.drink','dream;drop','a..b','', null] loop
    perform 1 from public.translatable_source('profile_field','alice', p, 'v1');
    raise notice '% 取り出せない: %', case when found then 'FAIL' else 'PASS' end, coalesce(p, '(null)');
  end loop;
  select * into r from public.translatable_source('answer', null, '11111111-0000-4000-8000-000000000001','v1');
  raise notice '% 選んだ公開の回答: % / 手がかり %', case when r.text_value = '揚げパン' then 'PASS' else 'FAIL' end, r.text_value, r.context;
  perform 1 from public.translatable_source('answer', null, '11111111-0000-4000-8000-000000000004','v1');
  raise notice '% 選ばれていないデイリーの回答（選択なしで公開）は取り出せない', case when found then 'FAIL' else 'PASS' end;
  foreach p in array array['11111111-0000-4000-8000-000000000002','11111111-0000-4000-8000-000000000003','11111111-0000-4000-8000-000000000005','11111111-0000-4000-8000-000000000009','not-a-uuid'] loop
    perform 1 from public.translatable_source('answer', null, p, 'v1');
    raise notice '% フォロワー限定・非公開・許可していない人・存在しない・形が違う回答は取り出せない: %', case when found then 'FAIL' else 'PASS' end, p;
  end loop;
  perform 1 from public.translatable_source('diary', 'alice', 'x', 'v1');
  raise notice '% 対象外の種類（diary）は取り出せない', case when found then 'FAIL' else 'PASS' end;
  perform 1 from public.translatable_source('profile_field','bob','dream','v1');
  raise notice '% 許可していない人（bob）の公開項目は取り出せない', case when found then 'FAIL' else 'PASS' end;
end $$;
reset role;
set role service_role; set request.jwt.claims = '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"service_role"}';
do $$ begin
  perform 1 from public.translatable_source('profile_field','alice','dream','v1');
  raise notice '% ユーザーのトークン付きの呼び出しでは何も返さない（取り出し）', case when found then 'FAIL' else 'PASS' end;
  perform 1 from public.translation_candidates('aaaaaaaa-0000-4000-8000-000000000001');
  raise notice '% ユーザーのトークン付きの呼び出しでは何も返さない（候補）', case when found then 'FAIL' else 'PASS' end;
end $$;
reset role;

\echo '== 4. 目印・外国への送信の記録・保存・返却'
update public.translation_settings set enabled = true;   -- 送信の記録は、運営の停止スイッチがオンのときだけ作られる
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
do $$ declare r record; ok boolean; n int; pid bigint; pl public.translation_provision_log%rowtype; ev public.translation_consent_events%rowtype; begin
  select * into r from public.claim_translation('profile_field','alice','dream','en','claude-haiku-5-5','v1');
  raise notice '% 1 回目の目印は取れる', case when r.claimed then 'PASS' else 'FAIL' end;
  select * into r from public.claim_translation('profile_field','alice','dream','en','claude-haiku-5-5','v1');
  raise notice '% 翻訳中は二重に取れない（available=%）', case when not r.claimed and r.available then 'PASS' else 'FAIL' end, r.available;
  pid := public.begin_translation_provision('aaaaaaaa-0000-4000-8000-000000000001','profile_field','dream','en','global','m',1,'v1');
  raise notice '% 米国を指定しない送信は記録せず送らない', case when pid is null then 'PASS' else 'FAIL' end;
  pid := public.begin_translation_provision('aaaaaaaa-0000-4000-8000-000000000001','profile_field','dream','en','us','m',1,'v2');
  raise notice '% いまの版の許可がなければ記録せず送らない', case when pid is null then 'PASS' else 'FAIL' end;
  pid := public.begin_translation_provision('aaaaaaaa-0000-4000-8000-000000000001','profile_field','dream','en','us','claude-haiku-5-5',1,'v1');
  select * into pl from public.translation_provision_log where id = pid;
  raise notice '% 送る直前に「送信中」で記録する（送り先 %・場所 %・言語 %・指定 %・同意の旨 %・同意の記録 #%・保存期限 3 年）',
    case when pid is not null and pl.outcome = 'sending' and pl.recipient like 'Anthropic%United States%' and pl.source_path = 'dream' and pl.target_lang = 'en'
      and pl.requested_geo = 'us' and pl.consent_basis like '%art28%' and pl.consent_event_id is not null and pl.retain_until > now() + interval '2 years 11 months' then 'PASS' else 'FAIL' end,
    pl.recipient, pl.source_path, pl.target_lang, pl.requested_geo, pl.consent_basis, pl.consent_event_id;
  perform public.finish_translation_provision(pid, 'completed', 'us', 'req_test_1', null, 'wrkspc_test', 420);
  select * into pl from public.translation_provision_log where id = pid;
  raise notice '% 応答のあとに法定の記録へ結果を書く（completed・応答の地域 us）', case when pl.outcome = 'completed' and pl.reported_geo = 'us' and pl.completed_at is not null then 'PASS' else 'FAIL' end;
  select count(*) into n from public.translation_send_log s
   where s.provision_id = pid and s.request_id = 'req_test_1' and s.workspace_id = 'wrkspc_test' and s.latency_ms = 420 and s.model = 'claude-haiku-5-5' and s.attempt = 1
     and s.retain_until < now() + interval '14 months' and s.retain_until > now() + interval '12 months';
  raise notice '% 技術的な送信ログは別の表に（request-id・ワークスペース・時間・モデル・回数。13 か月）', case when n = 1 then 'PASS' else 'FAIL' end;
  select count(*) into n from information_schema.columns where table_name = 'translation_provision_log' and column_name in ('request_id','error_code','model','attempt','workspace_id','latency_ms');
  raise notice '% 法定の記録には技術的な項目を持たない', case when n = 0 then 'PASS' else 'FAIL' end;
  perform public.finish_translation_provision(pid, 'unknown', null, null, 'x');
  select * into pl from public.translation_provision_log where id = pid;
  raise notice '% 結果を書いたあとは書きかえない', case when pl.outcome = 'completed' then 'PASS' else 'FAIL' end;
  pid := public.begin_translation_provision('aaaaaaaa-0000-4000-8000-000000000001','profile_field','dream','ko','us','claude-haiku-5-5',1,'v1');
  perform public.finish_translation_provision(pid, 'geo_mismatch', 'eu', 'req_test_2', 'geo_mismatch');
  select count(*) into n from public.translation_provision_log where outcome = 'geo_mismatch' and reported_geo = 'eu';
  raise notice '% 米国以外で処理されたと返ってきても、送った事実の記録は残す（geo_mismatch）', case when n = 1 then 'PASS' else 'FAIL' end;
  pid := public.begin_translation_provision('aaaaaaaa-0000-4000-8000-000000000001','profile_field','dream','zh','us','claude-haiku-5-5',1,'v1');
  perform public.finish_translation_provision(pid, 'workspace_mismatch', 'us', 'req_test_3', 'workspace_mismatch', 'wrkspc_other', 300);
  select count(*) into n from public.translation_provision_log where id = pid and outcome = 'workspace_mismatch';
  raise notice '% 別のワークスペースから応答しても、送った事実の記録は残す（workspace_mismatch）', case when n = 1 then 'PASS' else 'FAIL' end;
  pid := public.begin_translation_provision('aaaaaaaa-0000-4000-8000-000000000001','profile_field','dream','th','us','claude-haiku-5-5',1,'v1');
  raise notice '% 結果が書かれないまま残った記録は「送信中」のまま（届いたか不明として扱う）', case when (select outcome from public.translation_provision_log where id = pid) = 'sending' then 'PASS' else 'FAIL' end;
  select * into ev from public.translation_consent_events where id = (select consent_event_id from public.translation_provision_log where id = pid);
  raise notice '% もとになった同意の記録の保存期限は、送信の記録の期限まで延びる', case when ev.retain_until >= (select retain_until from public.translation_provision_log where id = pid) - interval '1 minute' then 'PASS' else 'FAIL' end;
  perform public.halt_translation('geo_mismatch:eu');
  pid := public.begin_translation_provision('aaaaaaaa-0000-4000-8000-000000000001','profile_field','dream','fr','us','claude-haiku-5-5',1,'v1');
  raise notice '% 止めたら（米国以外での処理など）新しい送信の記録を作らず送らない（理由 %）', case when pid is null and not (select enabled from public.translation_settings) then 'PASS' else 'FAIL' end, (select halted_reason from public.translation_settings);
  select count(*) into n from information_schema.columns where table_name = 'translation_provision_log' and column_name in ('text_value','body','translated_text','source_text');
  raise notice '% 送信の記録に本文の列はない', case when n = 0 then 'PASS' else 'FAIL' end;
  ok := public.store_translation('profile_field','alice','dream','en', md5('パン屋さん in Paris'),'done','A bakery in Paris', array['Paris'], 800, 50, 0.000116, 'v1');
  raise notice '% 保存できる', case when ok then 'PASS' else 'FAIL' end;
  select * into r from public.get_translation('profile_field','alice','dream','en','v1');
  raise notice '% 翻訳済みを返す: %', case when r.available and r.translated_text = 'A bakery in Paris' then 'PASS' else 'FAIL' end, r.translated_text;
  select * into r from public.get_translation('profile_field','alice','dream','en','v2');
  raise notice '% 説明が改訂されたら翻訳済みも返さない', case when not r.available and r.translated_text is null then 'PASS' else 'FAIL' end;
  select * into r from public.claim_translation('profile_field','alice','dream','en','claude-haiku-5-5','v1');
  raise notice '% 翻訳済みには目印を取らない（API を呼ばない）', case when not r.claimed then 'PASS' else 'FAIL' end;
  ok := public.store_translation('profile_field','alice','dream','ko', md5('ちがう原文'),'done','x', null, 1, 1, 0, 'v1');
  raise notice '% 原文と一致しない保存はしない', case when not ok then 'PASS' else 'FAIL' end;
  select * into r from public.claim_translation('profile_field','alice','catchphrase','en','x','v1');
  ok := public.store_translation('profile_field','alice','catchphrase','en', md5('よろしくね'),'kept', null, null, null, null, 0, 'v1', 'personal');
  select * into r from public.get_translation('profile_field','alice','catchphrase','en','v1');
  raise notice '% 個人情報のチェックで送らなかった理由を残して返す（kept / %）', case when ok and r.status = 'kept' and r.kept_reason = 'personal' then 'PASS' else 'FAIL' end, r.kept_reason;
  delete from public.content_translations where source_path = 'catchphrase';
  select * into r from public.get_translation('profile_field','alice','motto','en','v1');
  raise notice '% フォロワー限定の項目は available=false', case when not r.available then 'PASS' else 'FAIL' end;
  select * into r from public.claim_translation('answer', null, '11111111-0000-4000-8000-000000000001','en','claude-haiku-5-5','v1');
  ok := public.store_translation('answer', null, '11111111-0000-4000-8000-000000000001','en', md5('揚げパン'),'done','Fried bread', null, 1, 1, 0, 'v1');
  select * into r from public.get_translation('answer', null, '11111111-0000-4000-8000-000000000001','en','v1');
  raise notice '% 公開回答の翻訳を保存して返す: %', case when ok and r.translated_text = 'Fried bread' then 'PASS' else 'FAIL' end, r.translated_text;
  select cache_hits into n from public.translation_budget limit 1;
  raise notice '% 翻訳済みを返した回数を数える: %', case when n = 3 then 'PASS' else 'FAIL' end, n;
end $$;
reset role;
-- 翻訳中に原文が編集された（目印 → 編集 → 保存）
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
select claimed as "目印(ko)" from public.claim_translation('profile_field','alice','dream','ko','claude-haiku-5-5','v1');
reset role;
update public.profile_book set book = jsonb_set(book, '{dream}', '"ケーキ屋さん"') where id = :A;
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
do $$ declare ok boolean; n int; begin
  ok := public.store_translation('profile_field','alice','dream','ko', md5('パン屋さん in Paris'),'done','파리의 빵집', null, 1, 1, 0, 'v1');
  raise notice '% 翻訳中に原文が変わったら保存しない', case when not ok then 'PASS' else 'FAIL' end;
  select count(*) into n from public.content_translations where source_type = 'profile_field';
  raise notice '% 原文の編集で古い翻訳（en）と目印（ko）が消えている: 残り %', case when n = 0 then 'PASS' else 'FAIL' end, n;
end $$;
reset role;

\echo '== 5. 編集・公開範囲の変更で、翻訳キャッシュと選んだ項目を消す'
do $$ declare n int; begin
  update public.answers set body = '揚げパン（きなこ）' where id = '11111111-0000-4000-8000-000000000001';
  select count(*) into n from public.content_translations where source_type = 'answer';
  raise notice '% 回答の本文を編集したら、その回答の翻訳を消す: 残り %', case when n = 0 then 'PASS' else 'FAIL' end, n;
  select count(*) into n from public.translation_item_permissions where item_key = '11111111-0000-4000-8000-000000000001';
  raise notice '% 本文の編集だけなら、選んだ状態は残る: %', case when n = 1 then 'PASS' else 'FAIL' end, n;
end $$;
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
select claimed as "目印(回答)" from public.claim_translation('answer', null, '11111111-0000-4000-8000-000000000001','en','x','v1');
select public.store_translation('answer', null, '11111111-0000-4000-8000-000000000001','en', md5('揚げパン（きなこ）'),'done','Fried bread (kinako)', null, 1, 1, 0, 'v1') as "保存";
reset role;
do $$ declare n int; m int; begin
  update public.answers set visibility = 'followers' where id = '11111111-0000-4000-8000-000000000001';
  select count(*) into n from public.content_translations where source_type = 'answer';
  select count(*) into m from public.translation_item_permissions where item_key = '11111111-0000-4000-8000-000000000001';
  raise notice '% 回答をフォロワー限定にしたら、翻訳と選んだ状態を消す: 翻訳 % / 選択 %', case when n = 0 and m = 0 then 'PASS' else 'FAIL' end, n, m;
  update public.answers set visibility = 'public' where id = '11111111-0000-4000-8000-000000000001';
end $$;
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
do $$ begin
  perform 1 from public.translatable_source('answer', null, '11111111-0000-4000-8000-000000000001','v1');
  raise notice '% 公開に戻しても、選び直すまで取り出せない', case when found then 'FAIL' else 'PASS' end;
end $$;
select claimed as "目印(en・新しい原文)" from public.claim_translation('profile_field','alice','dream','en','x','v1');
select public.store_translation('profile_field','alice','dream','en', md5('ケーキ屋さん'),'done','A cake shop', null, 1, 1, 0, 'v1') as "保存";
reset role;
-- プロフ帳の公開範囲の変更
do $$ declare n int; m int; begin
  update public.profile_book set book = jsonb_set(book, '{__visibility,dream}', '"followers"') where id = 'aaaaaaaa-0000-4000-8000-000000000001';
  select count(*) into n from public.content_translations where source_type = 'profile_field';
  select count(*) into m from public.translation_item_permissions where item_key = 'dream';
  raise notice '% dream をフォロワー限定にしたら、翻訳と選んだ状態を消す: 翻訳 % / 選択 %', case when n = 0 and m = 0 then 'PASS' else 'FAIL' end, n, m;
  select count(*) into m from public.translation_item_permissions where item_key = 'catchphrase';
  raise notice '% ほかのセクションの選択は残る: %', case when m = 1 then 'PASS' else 'FAIL' end, m;
end $$;
insert into public.content_translations (source_type, owner_id, source_path, source_hash, target_lang, status, translated_text, engine)
  values ('profile_field', :A, 'dream', md5('ケーキ屋さん'), 'en', 'done', 'A cake shop', 'x');
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
do $$ declare r record; begin
  select * into r from public.get_translation('profile_field','alice','dream','en','v1');
  raise notice '% フォロワー限定に変えたあとは翻訳を返さない（行が残っていても）', case when not r.available and r.translated_text is null then 'PASS' else 'FAIL' end;
end $$;
reset role;
delete from public.content_translations;
update public.profile_book set book = jsonb_set(book, '{__visibility,dream}', '"public"') where id = :A;

\echo '== 6. 翻訳してよい項目を変える'
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
do $$ declare r record; n int; begin
  perform 1 from public.translatable_source('profile_field','alice','dream','v1');
  raise notice '% dream を公開に戻しても、選び直すまで取り出せない', case when found then 'FAIL' else 'PASS' end;
  select * into r from public.set_translation_items('aaaaaaaa-0000-4000-8000-000000000001','v2','[{"kind":"profile_section","key":"dream"}]');
  raise notice '% 説明が改訂されたら、項目の変更の前に確認し直しが必要: %', case when not r.ok and r.reason = 'old_version' then 'PASS' else 'FAIL' end, r.reason;
  select * into r from public.set_translation_items('aaaaaaaa-0000-4000-8000-000000000001','v1','[{"kind":"profile_section","key":"motto"}]');
  raise notice '% 項目の変更でも、公開でない項目は選べない: %', case when not r.ok and r.reason = 'not_public' then 'PASS' else 'FAIL' end, r.reason;
  select * into r from public.set_translation_items('aaaaaaaa-0000-4000-8000-000000000001','v1',
    '[{"kind":"profile_section","key":"dream"},{"kind":"profile_section","key":"catchphrase"},{"kind":"profile_section","key":"specialty"},{"kind":"answer","id":"11111111-0000-4000-8000-000000000001"},{"kind":"answer","id":"11111111-0000-4000-8000-000000000004"}]');
  raise notice '% 選び直せる', case when r.ok then 'PASS' else 'FAIL' end;
  select * into r from public.translatable_source('answer', null, '11111111-0000-4000-8000-000000000004','v1');
  raise notice '% 選んだデイリーの回答は取り出せる: %', case when r.text_value = 'トースト' then 'PASS' else 'FAIL' end, r.text_value;
  select count(*) into n from public.translation_consent_events where action = 'scope_update';
  raise notice '% 項目の変更も記録する: %', case when n = 1 then 'PASS' else 'FAIL' end, n;
end $$;
select claimed as "目印 dream" from public.claim_translation('profile_field','alice','dream','en','x','v1');
select public.store_translation('profile_field','alice','dream','en', md5('ケーキ屋さん'),'done','A cake shop', null, 1, 1, 0, 'v1') as "保存";
select claimed as "目印 catchphrase" from public.claim_translation('profile_field','alice','catchphrase','en','x','v1');
select public.store_translation('profile_field','alice','catchphrase','en', md5('よろしくね'),'done','Nice to meet you', null, 1, 1, 0, 'v1') as "保存";
reset role;
do $$ declare n int; begin
  update public.profile_book set book = jsonb_set(book, '{__visibility,specialty}', '"public"') where id = 'aaaaaaaa-0000-4000-8000-000000000001';
  select count(*) into n from public.translation_item_permissions where item_key = 'specialty';
  raise notice '% 未設定から「公開」にしたセクションの選択は残る: %', case when n = 1 then 'PASS' else 'FAIL' end, n;
  select count(*) into n from public.content_translations;
  raise notice '% 公開範囲を変えたら、その人のプロフ帳の翻訳はいったん消す: 残り %', case when n = 0 then 'PASS' else 'FAIL' end, n;
end $$;
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
select claimed as "目印 dream" from public.claim_translation('profile_field','alice','dream','en','x','v1');
select public.store_translation('profile_field','alice','dream','en', md5('ケーキ屋さん'),'done','A cake shop', null, 1, 1, 0, 'v1') as "保存";
select claimed as "目印 catchphrase" from public.claim_translation('profile_field','alice','catchphrase','en','x','v1');
select public.store_translation('profile_field','alice','catchphrase','en', md5('よろしくね'),'done','Nice to meet you', null, 1, 1, 0, 'v1') as "保存";
do $$ declare r record; n int; begin
  select * into r from public.set_translation_items('aaaaaaaa-0000-4000-8000-000000000001','v1','[{"kind":"profile_section","key":"dream"},{"kind":"profile_section","key":"specialty"}]');
  select count(*) into n from public.content_translations where source_path = 'catchphrase';
  raise notice '% 外した項目（catchphrase）の翻訳を消す: 残り %', case when r.ok and n = 0 then 'PASS' else 'FAIL' end, n;
  select count(*) into n from public.content_translations where source_path = 'dream';
  raise notice '% 残した項目（dream）の翻訳は残る: %', case when n = 1 then 'PASS' else 'FAIL' end, n;
end $$;
reset role;
do $$ declare n int; begin
  update public.profile_book set book = jsonb_set(book, '{nickname}', '"ありすん"') where id = 'aaaaaaaa-0000-4000-8000-000000000001';
  select count(*) into n from public.content_translations;
  raise notice '% 関係ない項目の編集では翻訳を消さない: 残り %', case when n = 1 then 'PASS' else 'FAIL' end, n;
end $$;

\echo '== 7. 許可の取り消し'
update public.translation_settings set enabled = true, halted_reason = null;   -- 運営者が確認して再開した、という状態から
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
select claimed as "目印(ko・取り消し前)" from public.claim_translation('profile_field','alice','dream','ko','x','v1');
do $$ declare r record; ok boolean; n int; m int; begin
  perform public.revoke_translation_consent('aaaaaaaa-0000-4000-8000-000000000001');
  select count(*) into n from public.content_translations;
  raise notice '% 取り消したら、その人の翻訳をすべて消す: 残り %', case when n = 0 then 'PASS' else 'FAIL' end, n;
  select count(*) into n from public.translation_item_permissions where owner_id = 'aaaaaaaa-0000-4000-8000-000000000001';
  raise notice '% 選んだ項目も消す: 残り %', case when n = 0 then 'PASS' else 'FAIL' end, n;
  ok := public.store_translation('profile_field','alice','dream','ko', md5('ケーキ屋さん'),'done','케이크 가게', null, 1, 1, 0, 'v1');
  raise notice '% 取り消し前に始めた翻訳も保存しない', case when not ok then 'PASS' else 'FAIL' end;
  raise notice '% 取り消し後は送らない（送信の記録も作らない）', case when public.begin_translation_provision('aaaaaaaa-0000-4000-8000-000000000001','profile_field','dream','ko','us','m',1,'v1') is null then 'PASS' else 'FAIL' end;
  select * into r from public.get_translation('profile_field','alice','dream','en','v1');
  raise notice '% 取り消し後は available=false', case when not r.available then 'PASS' else 'FAIL' end;
  raise notice '% 取り消し後は owner_allows_translation = false', case when public.owner_allows_translation('alice','v1') then 'FAIL' else 'PASS' end;
  select count(*) into n from public.translation_consent_events where user_id = 'aaaaaaaa-0000-4000-8000-000000000001';
  select count(*) into m from public.translation_provision_log where owner_id = 'aaaaaaaa-0000-4000-8000-000000000001';
  raise notice '% 法定の記録は残る（同意・変更・取り消し % 件、送信 % 件）', case when n = 4 and m = 4 then 'PASS' else 'FAIL' end, n, m;
  select * into r from public.get_translation_consent('aaaaaaaa-0000-4000-8000-000000000001','v1');
  raise notice '% 本人の状態は allow = false', case when not r.allow then 'PASS' else 'FAIL' end;
  select * into r from public.grant_translation_consent('aaaaaaaa-0000-4000-8000-000000000001','v2','en',repeat('b',64),'{"t":"notice"}'::jsonb,2000,4,'[{"kind":"profile_section","key":"dream"}]');
  raise notice '% 改訂後の説明（v2・英語）で許可し直せる', case when r.ok and public.owner_allows_translation('alice','v2') and not public.owner_allows_translation('alice','v1') then 'PASS' else 'FAIL' end;
end $$;
select claimed as "目印" from public.claim_translation('profile_field','alice','dream','en','x','v2');
select public.store_translation('profile_field','alice','dream','en', md5('ケーキ屋さん'),'done','A cake shop', null, 1, 1, 0, 'v2') as "保存";
reset role;
-- 保存期限が過ぎても消さないもの：いまも有効な許可（v2）の同意の記録と、期限内の送信の記録が参照している同意の記録
update public.translation_consent_events set retain_until = now() - interval '1 day'
 where user_id = :A and not (action = 'grant' and consent_version = 'v2');
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
do $$ declare r record; n int; begin
  select * into r from public.purge_translation_legal_records();
  select count(*) into n from public.translation_consent_events where user_id = 'aaaaaaaa-0000-4000-8000-000000000001';
  raise notice '% 期限切れの履歴（項目の変更 2・取り消し 1）だけ消し、送信の裏づけ（v1 の同意）といまの許可（v2）の記録は残す（消した % 件・残り %）',
    case when r.consent_events = 3 and r.provisions = 0 and n = 2 then 'PASS' else 'FAIL' end, r.consent_events, n;
end $$;
reset role;

\echo '== 8. 退会と、法定の記録の保存期間'
do $$ declare n int; m int; begin
  delete from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000001';
  select count(*) into n from public.content_translations;
  raise notice '% 退会（profiles の削除）で翻訳も消える: 残り %', case when n = 0 then 'PASS' else 'FAIL' end, n;
  select count(*) into n from public.translation_consents where user_id = 'aaaaaaaa-0000-4000-8000-000000000001';
  select count(*) into m from public.translation_item_permissions where owner_id = 'aaaaaaaa-0000-4000-8000-000000000001';
  raise notice '% 退会で、いまの許可と選んだ項目も消える: % / %', case when n = 0 and m = 0 then 'PASS' else 'FAIL' end, n, m;
  select count(*) into n from public.translation_consent_events where user_id = 'aaaaaaaa-0000-4000-8000-000000000001';
  select count(*) into m from public.translation_provision_log where owner_id = 'aaaaaaaa-0000-4000-8000-000000000001';
  raise notice '% 退会しても、保存期限内の法定の記録は残る（同意 % 件、送信 % 件）', case when n = 2 and m = 4 then 'PASS' else 'FAIL' end, n, m;
end $$;
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
do $$ declare r record; begin
  select * into r from public.purge_translation_legal_records();
  raise notice '% 期限内のものは消さない（同意 %・送信 %）', case when r.consent_events = 0 and r.provisions = 0 then 'PASS' else 'FAIL' end, r.consent_events, r.provisions;
end $$;
reset role;
update public.translation_provision_log set retain_until = now() - interval '1 day';
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
do $$ declare r record; n int; begin
  select * into r from public.purge_translation_legal_records();
  select count(*) into n from public.translation_consent_events;
  raise notice '% 送信の記録は 1 件ごとの期限で消す（技術ログも一緒に消える）。参照がなくなった期限切れの同意の記録も消す（送信 %・同意 %・残り %）',
    case when r.provisions = 4 and r.consent_events = 1 and n = 1 and (select count(*) from public.translation_send_log) = 0 then 'PASS' else 'FAIL' end, r.provisions, r.consent_events, n;
end $$;
reset role;
update public.translation_consent_events set retain_until = now() - interval '1 day';
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
do $$ declare r record; n int; begin
  select * into r from public.purge_translation_legal_records();
  select count(*) into n from public.translation_consent_events;
  raise notice '% 退会後、期限が過ぎた同意の記録も消える（消した %・残り %）', case when r.consent_events = 1 and n = 0 then 'PASS' else 'FAIL' end, r.consent_events, n;
end $$;
reset role;
update public.translation_settings set enabled = false;
\echo '== 9. 費用の集計（個人の ID を持たない）と予算'
do $$ declare n int; begin
  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name in ('translation_budget','translation_reservations') and column_name in ('user_id','owner_id','subject_id');
  raise notice '% 費用の集計・確保の表に個人の ID の列はない', case when n = 0 then 'PASS' else 'FAIL' end;
end $$;
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
do $$ declare r record; begin
  select * into r from public.reserve_translation('cccccccc-0000-4000-8000-000000000003','bbbbbbbb-0000-4000-8000-000000000002', 0.0004);
  raise notice '% 停止中（enabled = false）は確保しない: %', case when r.result = 'disabled' then 'PASS' else 'FAIL' end, r.result;
end $$;
reset role;
update public.translation_settings set enabled = true, monthly_cap_usd = 0.001;
insert into public.translation_daily values ('user', :C, (now() at time zone 'utc')::date - 5, 3);
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
do $$ declare r record; r1 bigint; a numeric; n int; b public.translation_budget%rowtype; begin
  select * into r from public.reserve_translation('cccccccc-0000-4000-8000-000000000003','bbbbbbbb-0000-4000-8000-000000000002', 0.0004); r1 := r.reservation_id;
  raise notice '% 1 件目: %', case when r.result = 'ok' then 'PASS' else 'FAIL' end, r.result;
  select count(*) into n from public.translation_daily where day < (now() at time zone 'utc')::date - 1;
  raise notice '% 回数制限の記録（ID あり）は 2 日で消す: 古い行 %', case when n = 0 then 'PASS' else 'FAIL' end, n;
  select * into r from public.reserve_translation('cccccccc-0000-4000-8000-000000000003','bbbbbbbb-0000-4000-8000-000000000002', 0.0004);
  raise notice '% 2 件目: %', case when r.result = 'ok' then 'PASS' else 'FAIL' end, r.result;
  select * into r from public.reserve_translation('cccccccc-0000-4000-8000-000000000003','bbbbbbbb-0000-4000-8000-000000000002', 0.0004);
  raise notice '% 3 件目は上限（$0.001）を超えるので止める: %', case when r.result = 'budget' then 'PASS' else 'FAIL' end, r.result;
  a := public.settle_translation(r1, 800, 50, 0, 0);
  raise notice '% 使用量から実額を計算（800+50 トークン・米国内の推論 1.1 倍）: %', case when a = 0.000116 then 'PASS' else 'FAIL' end, a;
  raise notice '% 二重の精算はしない', case when public.settle_translation(r1, 800, 50) is null then 'PASS' else 'FAIL' end;
  select * into b from public.translation_budget where month = date_trunc('month', now() at time zone 'utc')::date;
  raise notice '% 確定 % / 呼び出し中 % / 入力 % / 出力 %', case when b.spent_usd = 0.000116 and b.reserved_usd = 0.0004 then 'PASS' else 'FAIL' end, b.spent_usd, b.reserved_usd, b.input_tokens, b.output_tokens;
  select * into r from public.reserve_translation('cccccccc-0000-4000-8000-000000000003','bbbbbbbb-0000-4000-8000-000000000002', 0.0004);
  raise notice '% 精算で空いた分は使える: %', case when r.result = 'ok' then 'PASS' else 'FAIL' end, r.result;
  select * into r from public.reserve_translation('cccccccc-0000-4000-8000-000000000003','bbbbbbbb-0000-4000-8000-000000000002', 0.5);
  raise notice '% 大きすぎる見込み額は受け付けない: %', case when r.result = 'bad_estimate' then 'PASS' else 'FAIL' end, r.result;
  select * into r from public.reserve_translation('cccccccc-0000-4000-8000-000000000003','bbbbbbbb-0000-4000-8000-000000000002', 0);
  raise notice '% 0 以下の見込み額は受け付けない: %', case when r.result = 'bad_estimate' then 'PASS' else 'FAIL' end, r.result;
end $$;
reset role;
update public.translation_reservations set created_at = now() - interval '20 minutes' where status = 'reserved';
update public.translation_settings set monthly_cap_usd = 10, daily_user_limit = 5, daily_owner_limit = 100;
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
do $$ declare r record; b public.translation_budget%rowtype; n int; begin
  select * into r from public.reserve_translation('cccccccc-0000-4000-8000-000000000003','bbbbbbbb-0000-4000-8000-000000000002', 0.0004);
  select * into b from public.translation_budget where month = date_trunc('month', now() at time zone 'utc')::date;
  select count(*) into n from public.translation_reservations where status = 'expired';
  raise notice '% 放置された確保 % 件を見込み額で確定（確定 %、呼び出し中 %）', case when n = 2 and b.spent_usd = 0.000916 and b.reserved_usd = 0.0004 then 'PASS' else 'FAIL' end, n, b.spent_usd, b.reserved_usd;
  select * into r from public.reserve_translation('cccccccc-0000-4000-8000-000000000003','bbbbbbbb-0000-4000-8000-000000000002', 0.0004);
  raise notice '% 1 人 1 日 5 回まで（5 回目）: %', case when r.result = 'ok' then 'PASS' else 'FAIL' end, r.result;
  select * into r from public.reserve_translation('cccccccc-0000-4000-8000-000000000003','bbbbbbbb-0000-4000-8000-000000000002', 0.0004);
  raise notice '% 6 回目は止める: %', case when r.result = 'user_limit' then 'PASS' else 'FAIL' end, r.result;
end $$;
reset role;
update public.translation_settings set daily_user_limit = 100, daily_owner_limit = 6;
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
do $$ declare r record; begin
  select * into r from public.reserve_translation('bbbbbbbb-0000-4000-8000-000000000002','bbbbbbbb-0000-4000-8000-000000000002', 0.0004);
  raise notice '% 同じ人の原文は 1 日 6 回まで（6 回目）: %', case when r.result = 'ok' then 'PASS' else 'FAIL' end, r.result;
  select * into r from public.reserve_translation('bbbbbbbb-0000-4000-8000-000000000002','bbbbbbbb-0000-4000-8000-000000000002', 0.0004);
  raise notice '% 7 回目は止める: %', case when r.result = 'owner_limit' then 'PASS' else 'FAIL' end, r.result;
end $$;
reset role;
insert into public.translation_budget (month) values ('2026-09-01');
insert into public.translation_reservations (month, estimate_usd) values ('2026-09-01', 0.0004);
update public.translation_budget set reserved_usd = 0.0004 where month = '2026-09-01';
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
do $$ declare b public.translation_budget%rowtype; begin
  perform public.settle_translation((select max(id) from public.translation_reservations), 1000, 100);
  select * into b from public.translation_budget where month = '2026-09-01';
  raise notice '% 9 月に確保した分は 9 月で精算（確定 %、呼び出し中 %）', case when b.spent_usd = 0.000165 and b.reserved_usd = 0 then 'PASS' else 'FAIL' end, b.spent_usd, b.reserved_usd;
end $$;
reset role;
-- ③ 費用・① キャッシュの削除は、② とは別の関数・別の条件
insert into public.translation_reservations (month, estimate_usd, status, created_at) values ('2026-09-01', 0.0004, 'settled', now() - interval '14 months');
insert into public.content_translations (source_type, owner_id, source_path, source_hash, target_lang, status, engine, updated_at)
  values ('profile_field', :B, 'dream', md5('x'), 'en', 'pending', 'x', now() - interval '2 days');
update public.translation_age_gate set locked_until = now() - interval '1 minute';
insert into public.translation_provision_log (owner_id, source_type, source_path, target_lang, requested_geo, outcome) values (:B, 'profile_field', 'dream', 'en', 'us', 'completed');
insert into public.translation_send_log (provision_id, model, request_id, retain_until)
  select id, 'm', 'req_old', now() - interval '1 day' from public.translation_provision_log where owner_id = :B;
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
do $$ declare r record; q record; n int; begin
  select * into r from public.purge_translation_cost_records();
  raise notice '% 費用：確保の明細は 13 か月で消す（%件）。月の合計は残す', case when r.reservations = 1 and (select count(*) from public.translation_budget) >= 2 then 'PASS' else 'FAIL' end, r.reservations;
  select * into q from public.purge_translation_cache();
  raise notice '% キャッシュ：翻訳中のまま 1 日たった行と、期限の過ぎた年齢の再入力制限を消す（% 件・% 件）', case when q.stale_rows = 1 and q.age_gates = 1 then 'PASS' else 'FAIL' end, q.stale_rows, q.age_gates;
  raise notice '% 技術的な送信ログは 13 か月で消す（% 件）', case when public.purge_translation_send_log() = 1 then 'PASS' else 'FAIL' end, 1;
  select count(*) into n from public.translation_provision_log;
  raise notice '% 費用・キャッシュ・技術ログの削除は法定の記録に触れない', case when n = 1 then 'PASS' else 'FAIL' end;
end $$;
reset role;

\echo '== 9b. すべて（今後のものを含む）の許可'
reset role;
insert into public.profiles (id, username) values ('ffffffff-0000-4000-8000-000000000006', 'emi');
insert into public.profile_book values ('ffffffff-0000-4000-8000-000000000006',
  '{"dream":"宇宙飛行士","specialty":"けん玉","motto":"一期一会","__visibility":{"dream":"public","specialty":"public","motto":"followers"}}');
insert into public.answers (id, user_id, question_key, question_title, body, visibility) values
  ('44444444-0000-4000-8000-000000000001', 'ffffffff-0000-4000-8000-000000000006', 'd1', '好きな季節は？', '秋', 'public'),
  ('44444444-0000-4000-8000-000000000002', 'ffffffff-0000-4000-8000-000000000006', 'd2', '休みの日は？', '釣り', 'followers');
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
do $$ declare r record; n int; ev public.translation_consent_events%rowtype; ok boolean; D uuid := 'ffffffff-0000-4000-8000-000000000006'; begin
  select * into r from public.grant_translation_consent(D,'v1','ja',repeat('c',64),'{"t":"notice"}'::jsonb,2015,1,'[]'::jsonb,'all');
  raise notice '% 「すべて」でも年齢の確認はする（16 歳未満は断る）', case when not r.ok and r.reason = 'age' then 'PASS' else 'FAIL' end;
  delete from public.translation_age_gate where user_id = D;
  select * into r from public.grant_translation_consent(D,'v1','ja',repeat('c',64),'{"t":"notice"}'::jsonb,2000,4,'[]'::jsonb,'xyz');
  raise notice '% 決まっていない範囲（xyz）は断る', case when not r.ok then 'PASS' else 'FAIL' end;
  select * into r from public.grant_translation_consent(D,'v1','ja',repeat('c',64),'{"t":"notice"}'::jsonb,2000,4,'[]'::jsonb,'all');
  raise notice '% 「すべて」は項目を選ばずに許可できる', case when r.ok then 'PASS' else 'FAIL' end;
  select * into ev from public.translation_consent_events where user_id = D order by id desc limit 1;
  raise notice '% 同意の記録に「すべて」と残る（scope_mode=all・項目は空）', case when ev.action = 'grant' and ev.scope_mode = 'all' and ev.scope = '[]'::jsonb then 'PASS' else 'FAIL' end;
  select count(*) into n from public.translation_item_permissions where owner_id = D;
  raise notice '% 項目の選択の行は作らない', case when n = 0 then 'PASS' else 'FAIL' end;
  raise notice '% owner_allows_translation = true', case when public.owner_allows_translation('emi','v1') then 'PASS' else 'FAIL' end;
  select * into r from public.get_translation_consent(D,'v1');
  raise notice '% 本人の状態に「すべて」が出る', case when r.allow and r.scope_mode = 'all' then 'PASS' else 'FAIL' end;
  raise notice '% 公開のプロフ帳の項目は翻訳できる（夢）', case when exists (select 1 from public.translatable_source('profile_field','emi','dream','v1')) then 'PASS' else 'FAIL' end;
  raise notice '% 公開の回答は翻訳できる', case when exists (select 1 from public.translatable_source('answer','emi','44444444-0000-4000-8000-000000000001','v1')) then 'PASS' else 'FAIL' end;
  raise notice '% 「すべて」でもフォロワー限定の項目は翻訳しない（座右の銘）', case when not exists (select 1 from public.translatable_source('profile_field','emi','motto','v1')) then 'PASS' else 'FAIL' end;
  raise notice '% 「すべて」でもフォロワー限定の回答は翻訳しない', case when not exists (select 1 from public.translatable_source('answer','emi','44444444-0000-4000-8000-000000000002','v1')) then 'PASS' else 'FAIL' end;
  raise notice '% 説明の版が変わったら止まる（v2）', case when not exists (select 1 from public.translatable_source('profile_field','emi','dream','v2')) then 'PASS' else 'FAIL' end;
end $$;
reset role;
-- 許可のあとに書いた回答（今日のお題など）
insert into public.answers (id, user_id, question_key, question_title, body, visibility) values
  ('44444444-0000-4000-8000-000000000003', 'ffffffff-0000-4000-8000-000000000006', 'daily_2026-11-13', '今日のお題：朝ごはんは？', 'おにぎり', 'public');
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
do $$ begin
  raise notice '% 許可のあとに書いた公開の回答も翻訳できる', case when exists (select 1 from public.translatable_source('answer','emi','44444444-0000-4000-8000-000000000003','v1')) then 'PASS' else 'FAIL' end;
  perform public.claim_translation('profile_field','emi','dream','en','x','v1');
  perform public.store_translation('profile_field','emi','dream','en', md5('宇宙飛行士'),'done','An astronaut', null, 1, 1, 0, 'v1');
  perform public.claim_translation('answer','emi','44444444-0000-4000-8000-000000000003','en','x','v1');
  perform public.store_translation('answer','emi','44444444-0000-4000-8000-000000000003','en', md5('おにぎり'),'done','Rice balls', null, 1, 1, 0, 'v1');
end $$;
reset role;
update public.profile_book set book = jsonb_set(book, '{__visibility,dream}', '"followers"') where id = 'ffffffff-0000-4000-8000-000000000006';
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
do $$ declare n int; begin
  select count(*) into n from public.content_translations where owner_id = 'ffffffff-0000-4000-8000-000000000006' and source_type = 'profile_field';
  raise notice '% 公開以外にしたら、その翻訳は消え、翻訳もしない', case when n = 0 and not exists (select 1 from public.translatable_source('profile_field','emi','dream','v1')) then 'PASS' else 'FAIL' end;
end $$;
reset role;
update public.profile_book set book = jsonb_set(book, '{__visibility,dream}', '"public"') where id = 'ffffffff-0000-4000-8000-000000000006';
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
do $$ declare r record; n int; ev public.translation_consent_events%rowtype; D uuid := 'ffffffff-0000-4000-8000-000000000006'; begin
  raise notice '% 「すべて」では、公開に戻した項目はまた翻訳できる（選び直しは不要）', case when exists (select 1 from public.translatable_source('profile_field','emi','dream','v1')) then 'PASS' else 'FAIL' end;
  -- 「選んだものだけ」に変える：公開の回答 1 件だけ
  select * into r from public.set_translation_items(D,'v1','[{"kind":"answer","id":"44444444-0000-4000-8000-000000000001"}]'::jsonb,'items');
  select * into ev from public.translation_consent_events where user_id = D order by id desc limit 1;
  raise notice '% 「選んだものだけ」に変えられる（記録は scope_update・items）', case when r.ok and ev.action = 'scope_update' and ev.scope_mode = 'items' then 'PASS' else 'FAIL' end;
  select count(*) into n from public.content_translations where owner_id = D and source_path = '44444444-0000-4000-8000-000000000003';
  raise notice '% 選ばなかった回答の翻訳は消える（「すべて」から変えたとき）', case when n = 0 then 'PASS' else 'FAIL' end;
  raise notice '% 選ばなかった項目・回答は翻訳しない', case when not exists (select 1 from public.translatable_source('profile_field','emi','dream','v1'))
    and not exists (select 1 from public.translatable_source('answer','emi','44444444-0000-4000-8000-000000000003','v1'))
    and exists (select 1 from public.translatable_source('answer','emi','44444444-0000-4000-8000-000000000001','v1')) then 'PASS' else 'FAIL' end;
  select * into r from public.set_translation_items(D,'v1',null,'all');
  raise notice '% 「すべて」に戻せる（項目なし）', case when r.ok and (select scope_mode from public.translation_consents where user_id = D) = 'all'
    and (select count(*) from public.translation_item_permissions where owner_id = D) = 0 then 'PASS' else 'FAIL' end;
  perform public.revoke_translation_consent(D);
  raise notice '% 取り消すと止まり、範囲は items に戻る', case when not public.owner_allows_translation('emi','v1')
    and (select scope_mode from public.translation_consents where user_id = D) = 'items'
    and not exists (select 1 from public.translatable_source('answer','emi','44444444-0000-4000-8000-000000000001','v1')) then 'PASS' else 'FAIL' end;
end $$;
reset role;
