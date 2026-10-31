\set QUIET on
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
  ('11111111-0000-4000-8000-000000000003', :A, 'd3', '秘密は？', 'ないしょ', 'private');

\echo '== 1. anon / authenticated からは使えない'
set role anon; set request.jwt.claims = '{"role":"anon"}';
do $$ declare t text; begin
  foreach t in array array['translation_settings','translation_consents','content_translations','translation_budget','translation_reservations','translation_daily'] loop
    begin execute format('select 1 from public.%I limit 1', t); raise notice 'FAIL anon が % を読めた', t;
    exception when insufficient_privilege then raise notice 'PASS anon は % を読めない', t; end;
  end loop;
end $$;
reset role;
set role authenticated; set request.jwt.claims = '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
do $$ declare f text; begin
  foreach f in array array[
    'select public.translatable_source(''profile_field'',''alice'',''dream'')',
    'select public.get_translation(''profile_field'',''alice'',''dream'',''en'')',
    'select public.claim_translation(''profile_field'',''alice'',''dream'',''en'',''x'')',
    'select public.release_translation(''profile_field'',''alice'',''dream'',''en'',md5(''x''))',
    'select public.store_translation(''profile_field'',''alice'',''dream'',''en'',md5(''x''),''done'',''x'',null,1,1,0)',
    'select public.reserve_translation(''bbbbbbbb-0000-4000-8000-000000000002''::uuid,''aaaaaaaa-0000-4000-8000-000000000001''::uuid,0.0004)',
    'select public.settle_translation(1,1,1)',
    'select public.set_translation_consent(''aaaaaaaa-0000-4000-8000-000000000001''::uuid, true)',
    'select public.get_translation_consent(''aaaaaaaa-0000-4000-8000-000000000001''::uuid)',
    'select public.owner_allows_translation(''alice'')',
    'insert into public.translation_consents values (''bbbbbbbb-0000-4000-8000-000000000002'', true, now())',
    'update public.translation_settings set enabled = true, monthly_cap_usd = 99999',
    'insert into public.content_translations (source_type, owner_id, source_path, source_hash, target_lang, engine) values (''profile_field'',''aaaaaaaa-0000-4000-8000-000000000001'',''dream'',md5(''x''),''en'',''x'')'] loop
    begin execute f; raise notice 'FAIL ログイン中のユーザーが実行できた: %', left(f, 70);
    exception when insufficient_privilege then raise notice 'PASS ログイン中のユーザーは実行できない: %', left(f, 70); end;
  end loop;
end $$;
reset role;

\echo '== 2. 本人の許可がないと何も取り出せない'
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
do $$ begin
  perform 1 from public.translatable_source('profile_field','alice','dream');
  raise notice '% 許可なし：公開の dream も取り出せない', case when found then 'FAIL' else 'PASS' end;
  perform 1 from public.translatable_source('answer', null, '11111111-0000-4000-8000-000000000001');
  raise notice '% 許可なし：公開の回答も取り出せない', case when found then 'FAIL' else 'PASS' end;
  raise notice '% 許可なし：owner_allows_translation = false', case when public.owner_allows_translation('alice') then 'FAIL' else 'PASS' end;
  perform public.set_translation_consent('aaaaaaaa-0000-4000-8000-000000000001', true);
  raise notice '% 許可したら owner_allows_translation = true', case when public.owner_allows_translation('alice') then 'PASS' else 'FAIL' end;
end $$;
reset role;

\echo '== 3. 取り出せる・取り出せない（許可あり）'
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
do $$ declare r record; p text; begin
  select * into r from public.translatable_source('profile_field','alice','dream');
  raise notice '% 公開の dream: % / 手がかり %', case when r.text_value = 'パン屋さん in Paris' and r.source_hash = md5('パン屋さん in Paris') then 'PASS' else 'FAIL' end, r.text_value, r.context;
  foreach p in array array['specialty','catchphrase','__questions.0.a','__best3.drink.0'] loop
    select * into r from public.translatable_source('profile_field','alice', p);
    raise notice '% 公開範囲が未設定でも本人の許可があれば取り出せる: % = % (%)', case when r.text_value is not null then 'PASS' else 'FAIL' end, p, r.text_value, r.context;
  end loop;
  foreach p in array array['motto','hometown','collection','name','nickname','__game','__game.coins','__visibility','__visibility.dream','__purchases','__choices.time','wantToGo','holiday','holiday.x','__questions.0.q','__questions.0','__best3.drink','dream;drop','a..b','', null] loop
    perform 1 from public.translatable_source('profile_field','alice', p);
    raise notice '% 取り出せない: %', case when found then 'FAIL' else 'PASS' end, coalesce(p, '(null)');
  end loop;
  select * into r from public.translatable_source('answer', null, '11111111-0000-4000-8000-000000000001');
  raise notice '% 公開の回答: % / 手がかり %', case when r.text_value = '揚げパン' then 'PASS' else 'FAIL' end, r.text_value, r.context;
  foreach p in array array['11111111-0000-4000-8000-000000000002','11111111-0000-4000-8000-000000000003','11111111-0000-4000-8000-000000000009','not-a-uuid'] loop
    perform 1 from public.translatable_source('answer', null, p);
    raise notice '% フォロワー限定・非公開・存在しない・形が違う回答は取り出せない: %', case when found then 'FAIL' else 'PASS' end, p;
  end loop;
  perform 1 from public.translatable_source('diary', 'alice', 'x');
  raise notice '% 対象外の種類（diary）は取り出せない', case when found then 'FAIL' else 'PASS' end;
  perform 1 from public.translatable_source('profile_field','bob','dream');
  raise notice '% 許可していない人（bob）の公開項目は取り出せない', case when found then 'FAIL' else 'PASS' end;
end $$;
reset role;
update public.translation_settings set require_explicit_public = true;
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
do $$ begin
  perform 1 from public.translatable_source('profile_field','alice','specialty');
  raise notice '% 厳しい設定（require_explicit_public）では未設定の項目は取り出せない', case when found then 'FAIL' else 'PASS' end;
  perform 1 from public.translatable_source('profile_field','alice','dream');
  raise notice '% 厳しい設定でも「公開」にした項目は取り出せる', case when found then 'PASS' else 'FAIL' end;
end $$;
reset role;
update public.translation_settings set require_explicit_public = false;
set role service_role; set request.jwt.claims = '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"service_role"}';
do $$ begin
  perform 1 from public.translatable_source('profile_field','alice','dream');
  raise notice '% ユーザーのトークン付きの呼び出しでは何も返さない', case when found then 'FAIL' else 'PASS' end;
end $$;
reset role;

\echo '== 4. 目印・保存・返却'
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
do $$ declare r record; ok boolean; n int; begin
  select * into r from public.claim_translation('profile_field','alice','dream','en','claude-haiku-5-5');
  raise notice '% 1 回目の目印は取れる', case when r.claimed then 'PASS' else 'FAIL' end;
  select * into r from public.claim_translation('profile_field','alice','dream','en','claude-haiku-5-5');
  raise notice '% 翻訳中は二重に取れない（available=%）', case when not r.claimed and r.available then 'PASS' else 'FAIL' end, r.available;
  ok := public.store_translation('profile_field','alice','dream','en', md5('パン屋さん in Paris'),'done','A bakery in Paris', array['Paris'], 800, 50, 0.000105);
  raise notice '% 保存できる', case when ok then 'PASS' else 'FAIL' end;
  select * into r from public.get_translation('profile_field','alice','dream','en');
  raise notice '% 翻訳済みを返す: %', case when r.available and r.translated_text = 'A bakery in Paris' then 'PASS' else 'FAIL' end, r.translated_text;
  select * into r from public.claim_translation('profile_field','alice','dream','en','claude-haiku-5-5');
  raise notice '% 翻訳済みには目印を取らない（API を呼ばない）', case when not r.claimed then 'PASS' else 'FAIL' end;
  ok := public.store_translation('profile_field','alice','dream','ko', md5('ちがう原文'),'done','x', null, 1, 1, 0);
  raise notice '% 原文と一致しない保存はしない', case when not ok then 'PASS' else 'FAIL' end;
  select * into r from public.get_translation('profile_field','alice','motto','en');
  raise notice '% フォロワー限定の項目は available=false', case when not r.available then 'PASS' else 'FAIL' end;
  select * into r from public.claim_translation('answer', null, '11111111-0000-4000-8000-000000000001','en','claude-haiku-5-5');
  ok := public.store_translation('answer', null, '11111111-0000-4000-8000-000000000001','en', md5('揚げパン'),'done','Fried bread', null, 1, 1, 0);
  select * into r from public.get_translation('answer', null, '11111111-0000-4000-8000-000000000001','en');
  raise notice '% 公開回答の翻訳を保存して返す: %', case when ok and r.translated_text = 'Fried bread' then 'PASS' else 'FAIL' end, r.translated_text;
  select cache_hits into n from public.translation_budget limit 1;
  raise notice '% 翻訳済みを返した回数を数える: %', case when n = 2 then 'PASS' else 'FAIL' end, n;
end $$;
reset role;
-- 翻訳中に原文が編集された（目印 → 編集 → 保存）
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
select claimed as "目印(ko)" from public.claim_translation('profile_field','alice','dream','ko','claude-haiku-5-5');
reset role;
update public.profile_book set book = jsonb_set(book, '{dream}', '"ケーキ屋さん"') where id = :A;
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
do $$ declare ok boolean; n int; begin
  ok := public.store_translation('profile_field','alice','dream','ko', md5('パン屋さん in Paris'),'done','파리의 빵집', null, 1, 1, 0);
  raise notice '% 翻訳中に原文が変わったら保存しない', case when not ok then 'PASS' else 'FAIL' end;
  select count(*) into n from public.content_translations where source_type = 'profile_field';
  raise notice '% 原文の編集で古い翻訳（en）と目印（ko）が消えている: 残り %', case when n = 0 then 'PASS' else 'FAIL' end, n;
end $$;
reset role;
-- 回答の編集・公開範囲の変更・削除
do $$ declare n int; begin
  update public.answers set body = '揚げパン（きなこ）' where id = '11111111-0000-4000-8000-000000000001';
  select count(*) into n from public.content_translations where source_type = 'answer';
  raise notice '% 回答の本文を編集したら、その回答の翻訳を消す: 残り %', case when n = 0 then 'PASS' else 'FAIL' end, n;
end $$;
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
select claimed as "目印(回答)" from public.claim_translation('answer', null, '11111111-0000-4000-8000-000000000001','en','x');
select public.store_translation('answer', null, '11111111-0000-4000-8000-000000000001','en', md5('揚げパン（きなこ）'),'done','Fried bread (kinako)', null, 1, 1, 0) as "保存";
reset role;
do $$ declare n int; begin
  update public.answers set visibility = 'followers' where id = '11111111-0000-4000-8000-000000000001';
  select count(*) into n from public.content_translations where source_type = 'answer';
  raise notice '% 回答をフォロワー限定にしたら、その翻訳を消す: 残り %', case when n = 0 then 'PASS' else 'FAIL' end, n;
  update public.answers set visibility = 'public' where id = '11111111-0000-4000-8000-000000000001';
end $$;
-- 公開範囲の変更（プロフ帳）
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
select claimed as "目印(en・新しい原文)" from public.claim_translation('profile_field','alice','dream','en','x');
select public.store_translation('profile_field','alice','dream','en', md5('ケーキ屋さん'),'done','A cake shop', null, 1, 1, 0) as "保存";
reset role;
update public.profile_book set book = jsonb_set(book, '{__visibility,dream}', '"followers"') where id = :A;
insert into public.content_translations (source_type, owner_id, source_path, source_hash, target_lang, status, translated_text, engine)
  values ('profile_field', :A, 'dream', md5('ケーキ屋さん'), 'en', 'done', 'A cake shop', 'x');
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
do $$ declare r record; begin
  select * into r from public.get_translation('profile_field','alice','dream','en');
  raise notice '% フォロワー限定に変えたあとは翻訳を返さない（行が残っていても）', case when not r.available and r.translated_text is null then 'PASS' else 'FAIL' end;
end $$;
reset role;
delete from public.content_translations;
update public.profile_book set book = jsonb_set(book, '{__visibility,dream}', '"public"') where id = :A;
-- 本人が許可を取り消す
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
select claimed as "目印" from public.claim_translation('profile_field','alice','dream','en','x');
select public.store_translation('profile_field','alice','dream','en', md5('ケーキ屋さん'),'done','A cake shop', null, 1, 1, 0) as "保存";
select claimed as "目印(回答)" from public.claim_translation('answer', null, '11111111-0000-4000-8000-000000000001','en','x');
select public.store_translation('answer', null, '11111111-0000-4000-8000-000000000001','en', md5('揚げパン（きなこ）'),'done','Fried bread', null, 1, 1, 0) as "保存";
do $$ declare n int; r record; begin
  perform public.set_translation_consent('aaaaaaaa-0000-4000-8000-000000000001', false);
  select count(*) into n from public.content_translations;
  raise notice '% 許可を取り消したら、その人の翻訳（プロフ帳・回答）をすべて消す: 残り %', case when n = 0 then 'PASS' else 'FAIL' end, n;
  select * into r from public.get_translation('profile_field','alice','dream','en');
  raise notice '% 取り消し後は available=false', case when not r.available then 'PASS' else 'FAIL' end;
  perform public.set_translation_consent('aaaaaaaa-0000-4000-8000-000000000001', true);
end $$;
reset role;
-- 関係ない編集・退会
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
select claimed as "目印" from public.claim_translation('profile_field','alice','dream','en','x');
select public.store_translation('profile_field','alice','dream','en', md5('ケーキ屋さん'),'done','A cake shop', null, 1, 1, 0) as "保存";
reset role;
do $$ declare n int; m int; begin
  update public.profile_book set book = jsonb_set(book, '{specialty}', '"口笛"') where id = 'aaaaaaaa-0000-4000-8000-000000000001';
  select count(*) into n from public.content_translations;
  raise notice '% 関係ない項目の編集では翻訳を消さない: 残り %', case when n = 1 then 'PASS' else 'FAIL' end, n;
  delete from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000001';
  select count(*) into m from public.content_translations;
  raise notice '% 退会（profiles の削除）で翻訳も消える: 残り %', case when m = 0 then 'PASS' else 'FAIL' end, m;
  select count(*) into m from public.translation_consents where user_id = 'aaaaaaaa-0000-4000-8000-000000000001';
  raise notice '% 退会で本人の許可も消える: 残り %', case when m = 0 then 'PASS' else 'FAIL' end, m;
end $$;

\echo '== 5. 予算'
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
do $$ declare r record; begin
  select * into r from public.reserve_translation('cccccccc-0000-4000-8000-000000000003','bbbbbbbb-0000-4000-8000-000000000002', 0.0004);
  raise notice '% 停止中（enabled = false）は確保しない: %', case when r.result = 'disabled' then 'PASS' else 'FAIL' end, r.result;
end $$;
reset role;
update public.translation_settings set enabled = true, monthly_cap_usd = 0.001;
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
do $$ declare r record; r1 bigint; a numeric; b public.translation_budget%rowtype; begin
  select * into r from public.reserve_translation('cccccccc-0000-4000-8000-000000000003','bbbbbbbb-0000-4000-8000-000000000002', 0.0004); r1 := r.reservation_id;
  raise notice '% 1 件目: %', case when r.result = 'ok' then 'PASS' else 'FAIL' end, r.result;
  select * into r from public.reserve_translation('cccccccc-0000-4000-8000-000000000003','bbbbbbbb-0000-4000-8000-000000000002', 0.0004);
  raise notice '% 2 件目: %', case when r.result = 'ok' then 'PASS' else 'FAIL' end, r.result;
  select * into r from public.reserve_translation('cccccccc-0000-4000-8000-000000000003','bbbbbbbb-0000-4000-8000-000000000002', 0.0004);
  raise notice '% 3 件目は上限（$0.001）を超えるので止める: %', case when r.result = 'budget' then 'PASS' else 'FAIL' end, r.result;
  a := public.settle_translation(r1, 800, 50, 0, 0);
  raise notice '% 使用量から実額を計算（800+50 トークン）: %', case when a = 0.000105 then 'PASS' else 'FAIL' end, a;
  raise notice '% 二重の精算はしない', case when public.settle_translation(r1, 800, 50) is null then 'PASS' else 'FAIL' end;
  select * into b from public.translation_budget where month = date_trunc('month', now() at time zone 'utc')::date;
  raise notice '% 確定 % / 呼び出し中 % / 入力 % / 出力 %', case when b.spent_usd = 0.000105 and b.reserved_usd = 0.0004 then 'PASS' else 'FAIL' end, b.spent_usd, b.reserved_usd, b.input_tokens, b.output_tokens;
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
  raise notice '% 放置された確保 % 件を見込み額で確定（確定 %、呼び出し中 %）', case when n = 2 and b.spent_usd = 0.000905 and b.reserved_usd = 0.0004 then 'PASS' else 'FAIL' end, n, b.spent_usd, b.reserved_usd;
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
insert into public.translation_reservations (month, user_id, owner_id, estimate_usd) values ('2026-09-01', :C, :B, 0.0004);
update public.translation_budget set reserved_usd = 0.0004 where month = '2026-09-01';
set role service_role; set request.jwt.claims = '{"role":"service_role"}';
do $$ declare b public.translation_budget%rowtype; begin
  perform public.settle_translation((select max(id) from public.translation_reservations), 1000, 100);
  select * into b from public.translation_budget where month = '2026-09-01';
  raise notice '% 9 月に確保した分は 9 月で精算（確定 %、呼び出し中 %）', case when b.spent_usd = 0.00015 and b.reserved_usd = 0 then 'PASS' else 'FAIL' end, b.spent_usd, b.reserved_usd;
end $$;
reset role;
