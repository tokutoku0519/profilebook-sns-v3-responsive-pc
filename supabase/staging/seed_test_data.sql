-- ============================================================
-- 【検証用プロジェクトだけで実行】テスト用アカウントの架空のデータ
--
-- 前提
--  1. 00_mark_as_staging.sql を実行済み（印がなければ何もせずに止まる）
--  2. Supabase の Authentication → Users → Add user で、次の 4 人を「Auto Confirm User」にチェックして作成済み
--       miri-test-alice@example.com（翻訳を許可する本人）
--       miri-test-bob@example.com  （英語で見る人・alice をフォロー）
--       miri-test-carol@example.com（英語で見る人・フォローしない）
--       miri-test-dave@example.com （16 歳未満の役）
--     パスワードは検証用のものを使い、本番のパスワードを使い回さない。example.com は例示用に予約されたドメイン
--
-- 本番のデータはコピーしない。名前・文章・連絡先はすべて架空（電話番号は架空の形式だけ）。
-- 何度実行しても同じ状態になる（上書き）。
-- ============================================================
do $$
declare a uuid; b uuid; c uuid; d uuid;
begin
  if to_regclass('public._miri_environment') is null then
    raise exception '検証用の印がありません。本番では実行しないでください（00_mark_as_staging.sql を先に）';
  end if;
  if not exists (select 1 from public._miri_environment where name = 'staging') then
    raise exception '検証用の印がありません。本番では実行しないでください（00_mark_as_staging.sql を先に）';
  end if;
  if exists (select 1 from auth.users where email is null or lower(email) not like '%@example.com') then
    raise exception 'テスト用（@example.com）以外のユーザーがいます。このデータベースでは実行しません';
  end if;
  select id into a from auth.users where email = 'miri-test-alice@example.com';
  select id into b from auth.users where email = 'miri-test-bob@example.com';
  select id into c from auth.users where email = 'miri-test-carol@example.com';
  select id into d from auth.users where email = 'miri-test-dave@example.com';
  if a is null or b is null or c is null or d is null then
    raise exception 'テスト用の 4 人のアカウントがそろっていません（Authentication → Users → Add user で作成）';
  end if;

  -- サインアップ時のトリガーが作った profiles を、分かりやすい名前に変える
  update public.profiles set username = 'test_alice', display_name = 'テストありす' where id = a;
  update public.profiles set username = 'test_bob',   display_name = 'Test Bob'     where id = b;
  update public.profiles set username = 'test_carol', display_name = 'Test Carol'   where id = c;
  update public.profiles set username = 'test_dave',  display_name = 'テストでいぶ' where id = d;

  insert into public.profile_book (id, book) values
    (a, jsonb_build_object(
      'nickname', 'ありす', 'catchphrase', 'よろしくね', 'message', '平成のプロフ帳が大好きです',
      'dream', 'パン屋さん in Paris', 'specialty', '指パッチン', 'motto', 'なんとかなる', 'hometown', '大阪',
      'wantToGo', 'ヨーロッパ', 'collection', '香水', 'favoriteFood', '揚げパン',
      'charmPoint', '電話は 090-0000-0000（テスト用の架空の番号）',
      '__questions', jsonb_build_array(jsonb_build_object('q','好きな季節は？','a','夏🍉 花火大会が最高'),
                                       jsonb_build_object('q','好きな芸能人は？','a','Juice=Juice'),
                                       jsonb_build_object('q','好きなアニメは？','a','鬼滅の刃')),
      '__best3', jsonb_build_object('drink', jsonb_build_array('ミルクティー','','')),
      '__visibility', jsonb_build_object('motto','followers','hometown','private','dream','public'))),
    (b, '{"nickname":"Bob","message":"Hello from Bob"}'::jsonb),
    (c, '{}'::jsonb),
    (d, '{"nickname":"でいぶ","dream":"サッカー選手"}'::jsonb)
  on conflict (id) do update set book = excluded.book;

  delete from public.answers where user_id in (a, b, c, d) and question_key like 'test_%';
  insert into public.answers (user_id, question_key, question_title, body, visibility) values
    (a, 'test_public',    '小学校の給食で好きだったものは？', '揚げパンがいちばん好きだった', 'public'),
    (a, 'test_followers', '休みの日は？',                     'ずっと寝てる',                 'followers'),
    (a, 'test_private',   '秘密は？',                         'ないしょ',                     'private'),
    (a, 'test_daily',     '今日のお題：朝ごはんは？',         'トーストと牛乳',               'public'),
    (d, 'test_public',    '好きな教科は？',                   '体育',                         'public');

  insert into public.follows (follower_id, following_id) values (b, a) on conflict do nothing;
  raise notice '架空のデータを入れました：test_alice / test_bob / test_carol / test_dave';
end $$;
select p.username, p.display_name, (select count(*) from public.answers x where x.user_id = p.id) as answers
  from public.profiles p where p.username like 'test\_%' order by p.username;
