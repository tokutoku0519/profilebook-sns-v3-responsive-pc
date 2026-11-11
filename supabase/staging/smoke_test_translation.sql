-- ============================================================
-- 【検証用プロジェクトだけで実行】翻訳の SQL の動作確認（実行後、データは何も残らない）
--
-- 前提：00_mark_as_staging.sql・seed_test_data.sql・proposal_content_translations.sql（＋ proposal_account_deletion_requests.sql）を適用済み
-- 使い方：SQL Editor に全文を貼って Run。結果の表（check・ok・detail）で ok がすべて true なら合格。
--
-- しくみ：確認の処理を 1 つの関数の中で行い、最後にわざとエラーを起こして、関数の中の書きこみをすべて取り消す
--         （同意・翻訳・送信の記録・年齢の再入力制限など、何も残らない）。結果だけを表で返す。
-- 本番では動かない：検証用の印（_miri_environment）がなければ、最初にエラーで止まる。
-- ============================================================
create or replace function pg_temp.miri_smoke()
returns table (check_name text, ok boolean, detail text)
language plpgsql
as $$
declare
  res jsonb := '[]'::jsonb;
  a uuid; b uuid; d uuid; ans_pub uuid; ans_fol uuid; ans_daily uuid;
  v text := 'smoke-v1';
  r record; n int; pid bigint; ks text[];
  procedure_ok boolean;
begin
  if to_regclass('public._miri_environment') is null then raise exception '検証用の印がありません。本番では実行しないでください'; end if;
  if not exists (select 1 from public._miri_environment where name = 'staging') then raise exception '検証用の印がありません。本番では実行しないでください'; end if;
  if exists (select 1 from auth.users where email is null or lower(email) not like '%@example.com') then raise exception 'テスト用（@example.com）以外のユーザーがいます。このデータベースでは実行しません'; end if;
  select id into a from public.profiles where username = 'test_alice';
  select id into b from public.profiles where username = 'test_bob';
  select id into d from public.profiles where username = 'test_dave';
  if a is null or b is null or d is null then raise exception 'seed_test_data.sql を先に実行してください'; end if;
  select id into ans_pub   from public.answers where user_id = a and question_key = 'test_public';
  select id into ans_fol   from public.answers where user_id = a and question_key = 'test_followers';
  select id into ans_daily from public.answers where user_id = a and question_key = 'test_daily';

  begin  -- ここから下の書きこみは、最後にすべて取り消す
    update public.translation_settings set enabled = true, halted_reason = null;

    -- 1. 同意画面の候補
    select array_agg(c.kind || ':' || c.item_key) into ks from public.translation_candidates(a) c;
    res := res || jsonb_build_array(jsonb_build_object('c', '候補に公開の dream・ひとこと質問・公開回答が出る',
      'ok', ks @> array['profile_section:dream','profile_section:__questions','answer:' || ans_pub], 'd', array_length(ks, 1)::text || ' 件'));
    res := res || jsonb_build_array(jsonb_build_object('c', '候補にフォロワー限定・非公開・限定公開の回答が出ない',
      'ok', not (ks && array['profile_section:motto','profile_section:hometown','answer:' || ans_fol]), 'd', ''));

    -- 2. 許可（年齢は SQL で計算）
    select * into r from public.grant_translation_consent(a, v, 'ja', repeat('a', 64), '{"t":"smoke"}'::jsonb, 1996, 4,
      jsonb_build_array(jsonb_build_object('kind','profile_section','key','dream'), jsonb_build_object('kind','profile_section','key','__questions'),
                        jsonb_build_object('kind','answer','id', ans_pub::text)));
    res := res || jsonb_build_array(jsonb_build_object('c', '大人の生年月・公開中の項目で許可できる', 'ok', r.ok, 'd', coalesce(r.reason, '')));
    select * into r from public.grant_translation_consent(a, v, 'ja', repeat('a', 64), '{"t":"smoke"}'::jsonb, 1996, 4,
      jsonb_build_array(jsonb_build_object('kind','answer','id', ans_fol::text)));
    res := res || jsonb_build_array(jsonb_build_object('c', 'フォロワー限定の回答は選べない', 'ok', not r.ok and r.reason = 'not_public', 'd', coalesce(r.reason, '')));
    select * into r from public.grant_translation_consent(d, v, 'ja', repeat('a', 64), '{"t":"smoke"}'::jsonb,
      extract(year from now() at time zone 'Asia/Tokyo')::int - 10, 1, jsonb_build_array(jsonb_build_object('kind','profile_section','key','dream')));
    res := res || jsonb_build_array(jsonb_build_object('c', '16 歳未満は許可しない', 'ok', not r.ok and r.reason = 'age', 'd', coalesce(r.reason, '')));
    select * into r from public.grant_translation_consent(d, v, 'ja', repeat('a', 64), '{"t":"smoke"}'::jsonb, 1990, 1,
      jsonb_build_array(jsonb_build_object('kind','profile_section','key','dream')));
    res := res || jsonb_build_array(jsonb_build_object('c', '続けて大人の年を入れても許可しない（7 日間）', 'ok', not r.ok and r.reason = 'age_locked', 'd', coalesce(r.reason, '')));
    select count(*) into n from information_schema.columns where table_schema = 'public' and table_name like 'translation%' and column_name ~ 'birth';
    res := res || jsonb_build_array(jsonb_build_object('c', '生年月を保存する列がない', 'ok', n = 0, 'd', ''));

    -- 3. 取り出せる・取り出せない
    perform 1 from public.translatable_source('profile_field', 'test_alice', 'dream', v);
    res := res || jsonb_build_array(jsonb_build_object('c', '選んだ公開の dream は取り出せる', 'ok', found, 'd', ''));
    perform 1 from public.translatable_source('profile_field', 'test_alice', 'motto', v);
    res := res || jsonb_build_array(jsonb_build_object('c', 'フォロワー限定の motto は取り出せない', 'ok', not found, 'd', ''));
    perform 1 from public.translatable_source('answer', null, ans_daily::text, v);
    res := res || jsonb_build_array(jsonb_build_object('c', '選んでいないデイリーの回答は取り出せない', 'ok', not found, 'd', ''));
    perform 1 from public.translatable_source('profile_field', 'test_alice', 'dream', 'other-version');
    res := res || jsonb_build_array(jsonb_build_object('c', '説明の版が違えば取り出せない', 'ok', not found, 'd', ''));

    -- 4. 目印・送信の記録・保存・返却
    select * into r from public.claim_translation('profile_field', 'test_alice', 'dream', 'en', 'claude-haiku-5-5', v);
    res := res || jsonb_build_array(jsonb_build_object('c', '翻訳中の目印を取れる', 'ok', r.claimed, 'd', ''));
    pid := public.begin_translation_provision(a, 'profile_field', 'dream', 'en', 'us', 'claude-haiku-5-5', 1, v);
    res := res || jsonb_build_array(jsonb_build_object('c', '送る直前に法定の送信の記録を作る', 'ok', pid is not null, 'd', ''));
    perform public.finish_translation_provision(pid, 'completed', 'us', 'req_smoke', null, 'wrkspc_smoke', 100);
    select count(*) into n from public.translation_provision_log p join public.translation_send_log s on s.provision_id = p.id
     where p.id = pid and p.outcome = 'completed' and p.reported_geo = 'us' and s.request_id = 'req_smoke';
    res := res || jsonb_build_array(jsonb_build_object('c', '結果を法定の記録と技術的な送信ログに分けて書く', 'ok', n = 1, 'd', ''));
    res := res || jsonb_build_array(jsonb_build_object('c', '保存できる', 'ok',
      public.store_translation('profile_field', 'test_alice', 'dream', 'en', md5('パン屋さん in Paris'), 'done', 'A bakery in Paris', null, 1, 1, 0, v), 'd', ''));
    select * into r from public.get_translation('profile_field', 'test_alice', 'dream', 'en', v);
    res := res || jsonb_build_array(jsonb_build_object('c', '翻訳済みを返す', 'ok', r.translated_text = 'A bakery in Paris', 'd', coalesce(r.translated_text, '')));

    -- 5. 公開範囲の変更（既存のトリガーと一緒に動くか）
    update public.profile_book set book = jsonb_set(book, '{__visibility,dream}', '"followers"') where id = a;
    select * into r from public.get_translation('profile_field', 'test_alice', 'dream', 'en', v);
    select count(*) into n from public.translation_item_permissions where owner_id = a and item_key = 'dream';
    res := res || jsonb_build_array(jsonb_build_object('c', 'フォロワー限定に変えたら翻訳を返さず、選択も外れる', 'ok', not r.available and n = 0, 'd', ''));

    -- 6. 取り消し
    perform public.revoke_translation_consent(a);
    select count(*) into n from public.content_translations where owner_id = a;
    res := res || jsonb_build_array(jsonb_build_object('c', '取り消したら翻訳を消し、送らない', 'ok',
      n = 0 and public.begin_translation_provision(a, 'profile_field', 'dream', 'en', 'us', 'm', 1, v) is null, 'd', ''));
    select count(*) into n from public.translation_consent_events where user_id = a;
    res := res || jsonb_build_array(jsonb_build_object('c', '法定の記録（同意・取り消し）は残る', 'ok', n >= 2, 'd', n::text || ' 件'));

    -- 7. 権限（ブラウザのキー・ログイン中のユーザーからは使えない）
    procedure_ok := false;
    begin
      execute 'set local role anon';
      perform 1 from public.translation_provision_log limit 1;
    exception when insufficient_privilege then procedure_ok := true;
    end;
    execute 'reset role';
    res := res || jsonb_build_array(jsonb_build_object('c', 'ログインしていない人（anon）は送信の記録を読めない', 'ok', procedure_ok, 'd', ''));
    procedure_ok := false;
    begin
      perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
      execute 'set local role authenticated';
      perform public.grant_translation_consent(b, v, 'ja', null, null, 1990, 1, '[]'::jsonb);
    exception when insufficient_privilege then procedure_ok := true;
    end;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    res := res || jsonb_build_array(jsonb_build_object('c', 'ログイン中のユーザーは同意の関数を直接実行できない', 'ok', procedure_ok, 'd', ''));
    if to_regclass('public.account_deletion_requests') is not null then
      procedure_ok := false;
      begin
        perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
        execute 'set local role authenticated';
        execute format('insert into public.account_deletion_requests (user_id, username) values (%L, %L)', a, 'test_alice');
      exception when insufficient_privilege then procedure_ok := true;
      end;
      execute 'reset role';
      perform set_config('request.jwt.claims', '', true);
      res := res || jsonb_build_array(jsonb_build_object('c', '退会の申請：ほかの人の名義では作れない（RLS）', 'ok', procedure_ok, 'd', ''));
    end if;

    raise exception 'miri_smoke_rollback';   -- ここまでの書きこみをすべて取り消す
  exception when raise_exception then
    if sqlerrm <> 'miri_smoke_rollback' then raise; end if;
  end;

  -- 取り消せたことの確認（同意の記録が増えていない）
  select count(*) into n from public.translation_consent_events where consent_version = v;
  res := res || jsonb_build_array(jsonb_build_object('c', '確認のための書きこみは何も残っていない', 'ok', n = 0, 'd', ''));
  return query select e ->> 'c', (e ->> 'ok')::boolean, e ->> 'd' from jsonb_array_elements(res) e;
end;
$$;
select * from pg_temp.miri_smoke();
