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
  foreach t in array array['translation_settings','translation_consents','translation_item_permissions','translation_consent_events',
                           'translation_provision_log','content_translations','translation_budget','translation_reservations','translation_daily'] loop
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
    'select public.store_translation(''profile_field'',''alice'',''dream'',''en'',md5(''x''),''done'',''x'',null,1,1,0,''v1'')',
    'select public.record_translation_provision(''aaaaaaaa-0000-4000-8000-000000000001''::uuid,''profile_field'',''dream'',''en'',''us'',''v1'')',
    'select public.reserve_translation(''bbbbbbbb-0000-4000-8000-000000000002''::uuid,''aaaaaaaa-0000-4000-8000-000000000001''::uuid,0.0004)',
    'select public.settle_translation(1,1,1)',
    'select public.translation_candidates(''bbbbbbbb-0000-4000-8000-000000000002''::uuid)',
    'select public.grant_translation_consent(''aaaaaaaa-0000-4000-8000-000000000001''::uuid,''v1'',''ja'',null,''self_declared_16_plus'',''[{"kind":"profile_section","key":"dream"}]'')',
    'select public.set_translation_items(''aaaaaaaa-0000-4000-8000-000000000001''::uuid,''v1'',''[{"kind":"profile_section","key":"dream"}]'')',
    'select public.revoke_translation_consent(''aaaaaaaa-0000-4000-8000-000000000001''::uuid)',
    'select public.get_translation_consent(''aaaaaaaa-0000-4000-8000-000000000001''::uuid,''v1'')',
    'select public.owner_allows_translation(''alice'',''v1'')',
    'select public.purge_expired_translation_records()',
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

  select * into r from public.grant_translation_consent('aaaaaaaa-0000-4000-8000-000000000001','v1','ja',repeat('a',64),'unknown','[{"kind":"profile_section","key":"dream"}]');
  raise notice '% 16 歳以上の確認がないと許可しない: %', case when not r.ok and r.reason = 'age' then 'PASS' else 'FAIL' end, r.reason;
  select * into r from public.grant_translation_consent('aaaaaaaa-0000-4000-8000-000000000001','v1','ja',repeat('a',64),'self_declared_16_plus','[]');
  raise notice '% 項目を選ばないと許可しない: %', case when not r.ok and r.reason = 'no_items' then 'PASS' else 'FAIL' end, r.reason;
  select * into r from public.grant_translation_consent('aaaaaaaa-0000-4000-8000-000000000001','v1','ja',repeat('a',64),'self_declared_16_plus','[{"kind":"profile_section","key":"dream"},{"kind":"profile_section","key":"motto"}]');
  raise notice '% フォロワー限定の項目を含むと許可しない: %', case when not r.ok and r.reason = 'not_public' then 'PASS' else 'FAIL' end, r.reason;
  select * into r from public.grant_translation_consent('aaaaaaaa-0000-4000-8000-000000000001','v1','ja',repeat('a',64),'self_declared_16_plus','[{"kind":"answer","id":"11111111-0000-4000-8000-000000000005"}]');
  raise notice '% ほかの人の回答は選べない: %', case when not r.ok and r.reason = 'not_public' then 'PASS' else 'FAIL' end, r.reason;
  select * into r from public.grant_translation_consent('aaaaaaaa-0000-4000-8000-000000000001','v1','ja',repeat('a',64),'self_declared_16_plus','[{"kind":"answer","id":"11111111-0000-4000-8000-000000000002"}]');
  raise notice '% フォロワー限定の回答は選べない: %', case when not r.ok and r.reason = 'not_public' then 'PASS' else 'FAIL' end, r.reason;
  select count(*) into n from public.translation_consent_events;
  raise notice '% 許可しなかった操作は記録を作らない: %', case when n = 0 then 'PASS' else 'FAIL' end, n;
  raise notice '% 許可しなかったので owner_allows_translation = false', case when public.owner_allows_translation('alice','v1') then 'FAIL' else 'PASS' end;

  select * into r from public.grant_translation_consent('aaaaaaaa-0000-4000-8000-000000000001','v1','ja',repeat('a',64),'self_declared_16_plus',
    '[{"kind":"profile_section","key":"dream"},{"kind":"profile_section","key":"catchphrase"},{"kind":"profile_section","key":"__questions"},{"kind":"profile_section","key":"__best3"},{"kind":"answer","id":"11111111-0000-4000-8000-000000000001"}]');
  raise notice '% 説明の版・言語・16 歳以上・公開中の項目がそろえば許可できる', case when r.ok then 'PASS' else 'FAIL' end;
  select * into ev from public.translation_consent_events order by id desc limit 1;
  raise notice '% 同意の記録（版 %・言語 %・説明文のハッシュ・年齢確認 %・項目 % 件・日時）', case when ev.action = 'grant' and ev.consent_version = 'v1' and ev.locale = 'ja'
    and ev.consent_text_sha256 = repeat('a',64) and ev.age_check = 'self_declared_16_plus' and jsonb_array_length(ev.scope) = 5 and ev.created_at is not null then 'PASS' else 'FAIL' end,
    ev.consent_version, ev.locale, ev.age_check, jsonb_array_length(ev.scope);
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
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
do $$ declare r record; ok boolean; n int; pl public.translation_provision_log%rowtype; begin
  select * into r from public.claim_translation('profile_field','alice','dream','en','claude-haiku-5-5','v1');
  raise notice '% 1 回目の目印は取れる', case when r.claimed then 'PASS' else 'FAIL' end;
  select * into r from public.claim_translation('profile_field','alice','dream','en','claude-haiku-5-5','v1');
  raise notice '% 翻訳中は二重に取れない（available=%）', case when not r.claimed and r.available then 'PASS' else 'FAIL' end, r.available;
  ok := public.record_translation_provision('aaaaaaaa-0000-4000-8000-000000000001','profile_field','dream','en','global','v1');
  raise notice '% 推論の場所が us でなければ記録せず送らない', case when not ok then 'PASS' else 'FAIL' end;
  ok := public.record_translation_provision('aaaaaaaa-0000-4000-8000-000000000001','profile_field','dream','en','us','v2');
  raise notice '% いまの版の許可がなければ記録せず送らない', case when not ok then 'PASS' else 'FAIL' end;
  ok := public.record_translation_provision('aaaaaaaa-0000-4000-8000-000000000001','profile_field','dream','en','us','v1');
  raise notice '% 送る直前に記録する', case when ok then 'PASS' else 'FAIL' end;
  select * into pl from public.translation_provision_log order by id desc limit 1;
  raise notice '% 送信の記録（送り先 %・場所 %・言語 %・推論 %・同意の記録 #%・日時）', case when pl.recipient like 'Anthropic%United States%' and pl.source_path = 'dream'
    and pl.target_lang = 'en' and pl.inference_geo = 'us' and pl.consent_event_id is not null and pl.sent_at is not null then 'PASS' else 'FAIL' end,
    pl.recipient, pl.source_path, pl.target_lang, pl.inference_geo, pl.consent_event_id;
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
  select * into r from public.get_translation('profile_field','alice','motto','en','v1');
  raise notice '% フォロワー限定の項目は available=false', case when not r.available then 'PASS' else 'FAIL' end;
  select * into r from public.claim_translation('answer', null, '11111111-0000-4000-8000-000000000001','en','claude-haiku-5-5','v1');
  ok := public.store_translation('answer', null, '11111111-0000-4000-8000-000000000001','en', md5('揚げパン'),'done','Fried bread', null, 1, 1, 0, 'v1');
  select * into r from public.get_translation('answer', null, '11111111-0000-4000-8000-000000000001','en','v1');
  raise notice '% 公開回答の翻訳を保存して返す: %', case when ok and r.translated_text = 'Fried bread' then 'PASS' else 'FAIL' end, r.translated_text;
  select cache_hits into n from public.translation_budget limit 1;
  raise notice '% 翻訳済みを返した回数を数える: %', case when n = 2 then 'PASS' else 'FAIL' end, n;
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
  ok := public.record_translation_provision('aaaaaaaa-0000-4000-8000-000000000001','profile_field','dream','ko','us','v1');
  raise notice '% 取り消し後は送らない（送信の記録も作らない）', case when not ok then 'PASS' else 'FAIL' end;
  select * into r from public.get_translation('profile_field','alice','dream','en','v1');
  raise notice '% 取り消し後は available=false', case when not r.available then 'PASS' else 'FAIL' end;
  raise notice '% 取り消し後は owner_allows_translation = false', case when public.owner_allows_translation('alice','v1') then 'FAIL' else 'PASS' end;
  select count(*) into n from public.translation_consent_events where user_id = 'aaaaaaaa-0000-4000-8000-000000000001';
  select count(*) into m from public.translation_provision_log where owner_id = 'aaaaaaaa-0000-4000-8000-000000000001';
  raise notice '% 法定の記録は残る（同意・変更・取り消し % 件、送信 % 件）', case when n = 4 and m = 1 then 'PASS' else 'FAIL' end, n, m;
  select * into r from public.get_translation_consent('aaaaaaaa-0000-4000-8000-000000000001','v1');
  raise notice '% 本人の状態は allow = false', case when not r.allow then 'PASS' else 'FAIL' end;
  select * into r from public.grant_translation_consent('aaaaaaaa-0000-4000-8000-000000000001','v2','en',repeat('b',64),'self_declared_16_plus','[{"kind":"profile_section","key":"dream"}]');
  raise notice '% 改訂後の説明（v2・英語）で許可し直せる', case when r.ok and public.owner_allows_translation('alice','v2') and not public.owner_allows_translation('alice','v1') then 'PASS' else 'FAIL' end;
end $$;
select claimed as "目印" from public.claim_translation('profile_field','alice','dream','en','x','v2');
select public.store_translation('profile_field','alice','dream','en', md5('ケーキ屋さん'),'done','A cake shop', null, 1, 1, 0, 'v2') as "保存";
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
  raise notice '% 退会しても、保存期間内の法定の記録は残る（同意など % 件、送信 % 件）', case when n = 5 and m = 1 then 'PASS' else 'FAIL' end, n, m;
  update public.translation_consent_events set created_at = now() - interval '3 years 1 day' where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' and action = 'grant';
  update public.translation_provision_log set sent_at = now() - interval '3 years 1 day';
end $$;
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
do $$ declare r record; n int; begin
  select * into r from public.purge_expired_translation_records();
  select count(*) into n from public.translation_consent_events;
  raise notice '% 送信の記録は 1 件ごとに保存期間（3 年）で消す／最近の同意・取り消しがある人の履歴は、古い同意も残す（同意 % 件・送信 % 件・残り %）', case when r.consent_events = 0 and r.provisions = 1 and n = 5 then 'PASS' else 'FAIL' end, r.consent_events, r.provisions, n;
end $$;
reset role;
update public.translation_consent_events set created_at = now() - interval '3 years 1 day';
insert into public.translation_provision_log (owner_id, source_type, source_path, target_lang, inference_geo, sent_at)
  values (:A, 'profile_field', 'dream', 'en', 'us', now() - interval '1 year');
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
do $$ declare r record; n int; begin
  select * into r from public.purge_expired_translation_records();
  select count(*) into n from public.translation_consent_events;
  raise notice '% 保存期間内の送信がある人は、もとになった古い同意の記録も残す（同意 % 件・残り %）', case when r.consent_events = 0 and n = 5 then 'PASS' else 'FAIL' end, r.consent_events, n;
end $$;
reset role;
update public.translation_provision_log set sent_at = now() - interval '3 years 1 day';
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
do $$ declare r record; n int; begin
  select * into r from public.purge_expired_translation_records();
  select count(*) into n from public.translation_consent_events;
  raise notice '% 最後の同意・取り消し・送信から保存期間を過ぎたら、その人の履歴をまとめて消す（同意 % 件・送信 % 件・残り %）', case when r.consent_events = 5 and r.provisions = 1 and n = 0 then 'PASS' else 'FAIL' end, r.consent_events, r.provisions, n;
end $$;
reset role;
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
