-- ============================================================
-- 【検証用プロジェクトだけで実行】0001・0002（アクセス制御）の確認を、検証用の実アカウントで行う
--
-- 前提：00_mark_as_staging.sql・seed_test_data.sql を実行済み（test_alice / test_bob / test_carol / test_dave）
-- 使い方：SQL Editor に全文を貼って Run。結果の表（no・check・ok・detail）を見る。
--   ・0001・0002 の「適用前」に流すと、いまの不具合（限定の情報が読める・承認を回避できる など）が ok = false で出る
--   ・「適用後」に流して、ok がすべて true なら合格
-- 登場人物（実アカウント）：
--   alice＝サークル・回答・記事・日記の作成者／bob＝alice のフォロワー・承認制サークルに申請中・日記に招待された人
--   carol＝関係のない人／dave＝承認制サークルのメンバー／anon＝ログインしていない人
-- しくみ：確認用のサークル・投稿・コメントなどを一時的に作り、各人に切りかえて（RLS が効く authenticated / anon の役で）
--         読み書きを試し、最後にわざとエラーを起こして、作ったものをすべて取り消す（何も残らない）。
-- 本番では動かない：検証用の印（_miri_environment）がない、または @example.com 以外のユーザーがいれば、最初に止まる。
-- ============================================================
create or replace function pg_temp.miri_access_check()
returns table (no int, check_name text, ok boolean, detail text)
language plpgsql
as $$
declare
  res jsonb := '[]'::jsonb;
  a uuid; b uuid; c uuid; d uuid;
  cp uuid := gen_random_uuid(); cf uuid := gen_random_uuid(); cq uuid := gen_random_uuid();   -- サークル P 公開／F フォロワー限定／Q 承認制
  pq uuid := gen_random_uuid(); pq2 uuid := gen_random_uuid(); pq3 uuid := gen_random_uuid(); pf uuid := gen_random_uuid();  -- 投稿
  ans_pub uuid := gen_random_uuid(); ans_fol uuid := gen_random_uuid(); ans_prv uuid := gen_random_uuid();
  bp_pub uuid := gen_random_uuid(); bp_fol uuid := gen_random_uuid();
  dp uuid := gen_random_uuid(); de uuid := gen_random_uuid();
  ours uuid[]; newc uuid;
  denied boolean; n int; s text;
  applied1 boolean; applied2 boolean;
begin
  if to_regclass('public._miri_environment') is null or not exists (select 1 from public._miri_environment where name = 'staging') then
    raise exception '検証用の印がありません。本番では実行しないでください';
  end if;
  if exists (select 1 from auth.users where email is null or lower(email) not like '%@example.com') then
    raise exception 'テスト用（@example.com）以外のユーザーがいます。このデータベースでは実行しません';
  end if;
  select id into a from public.profiles where username = 'test_alice';
  select id into b from public.profiles where username = 'test_bob';
  select id into c from public.profiles where username = 'test_carol';
  select id into d from public.profiles where username = 'test_dave';
  if a is null or b is null or c is null or d is null then raise exception 'seed_test_data.sql を先に実行してください'; end if;
  ours := array[cp, cf, cq];
  applied1 := to_regprocedure('public.circle_viewer_can_see(uuid)') is not null;
  applied2 := exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'comments' and policyname = 'comments readable' and qual <> 'true');
  res := res || jsonb_build_object('c', '（情報）0001 の適用', 'ok', applied1, 'd', case when applied1 then '適用済み' else '未適用（不具合の再現として結果を見る）' end);
  res := res || jsonb_build_object('c', '（情報）0002 の適用', 'ok', applied2, 'd', case when applied2 then '適用済み' else '未適用（不具合の再現として結果を見る）' end);

  begin  -- ここから下の書きこみは、最後にすべて取り消す
    -- ── 確認用のデータ（管理者として作る。RLS は通らない）
    insert into public.follows (follower_id, following_id) values (b, a) on conflict do nothing;
    delete from public.follows where follower_id = c and following_id = a;
    delete from public.follows where follower_id = d and following_id = a;
    update public.profiles set is_official = false where id = c;
    insert into public.circles (id, name, created_by, join_policy, visibility) values
      (cp, '__確認P', a, 'open', 'public'), (cf, '__確認F', a, 'open', 'followers'), (cq, '__確認Q', a, 'approval', 'public');
    insert into public.circle_members (circle_id, user_id, status) values
      (cp, a, 'member'), (cf, a, 'member'), (cq, a, 'member'), (cq, d, 'member'), (cq, b, 'pending');
    insert into public.circle_posts (id, circle_id, user_id, body) values
      (pq, cq, a, 'Q の投稿'), (pq2, cq, a, 'Q の投稿 2'), (pq3, cq, a, 'Q の投稿 3'), (pf, cf, a, 'F の投稿');
    insert into public.circle_replies (post_id, user_id, body) values (pq, d, 'Q への返信');
    insert into public.circle_votes (post_id, user_id, target_id) values (pq, d, a);
    insert into public.answers (id, user_id, question_key, question_title, body, visibility) values
      (ans_pub, a, '__ac_pub', '確認', '公開の回答', 'public'),
      (ans_fol, a, '__ac_fol', '確認', 'フォロワー限定の回答', 'followers'),
      (ans_prv, a, '__ac_prv', '確認', '非公開の回答', 'private');
    insert into public.comments (answer_id, user_id, body) values
      (ans_pub, a, '__公開へのコメント'), (ans_fol, a, '__限定へのコメント'), (ans_prv, a, '__非公開へのコメント');
    insert into public.reactions (answer_id, user_id, type) values (ans_fol, a, 'like');
    insert into public.blog_posts (id, user_id, body, visibility) values (bp_pub, a, '公開の記事', 'public'), (bp_fol, a, 'フォロワー限定の記事', 'followers');
    insert into public.blog_comments (post_id, user_id, body) values (bp_pub, a, '__公開記事へのコメント'), (bp_fol, a, '__限定記事へのコメント');
    insert into public.blog_likes (post_id, user_id) values (bp_fol, a);
    insert into public.diary_pages (id, created_by, theme, visibility) values (dp, a, '__確認の交換日記', 'mentioned');
    insert into public.diary_page_mentions (page_id, user_id) values (dp, b);
    insert into public.diary_entries (id, page_id, user_id, body) values (de, dp, b, 'bob の書きこみ');

    -- ── ログインしていない人（anon）
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    perform set_config('request.jwt.claim.sub', '', true);
    execute 'set local role anon';
    res := res || jsonb_build_object('c', 'anon：サークルを読めない', 'ok', (select count(*) from public.circles where id = any(ours)) = 0, 'd', '');
    res := res || jsonb_build_object('c', 'anon：サークルの投稿を読めない', 'ok', (select count(*) from public.circle_posts where circle_id = any(ours)) = 0, 'd', '');
    select string_agg(body, ',' order by body) into s from public.comments where answer_id in (ans_pub, ans_fol, ans_prv);
    res := res || jsonb_build_object('c', 'anon：公開の回答へのコメントだけ読める', 'ok', s = '__公開へのコメント', 'd', coalesce(s, '0 件'));
    res := res || jsonb_build_object('c', 'anon：限定の回答へのリアクションを読めない', 'ok', (select count(*) from public.reactions where answer_id = ans_fol) = 0, 'd', '');
    select string_agg(body, ',' order by body) into s from public.blog_comments where post_id in (bp_pub, bp_fol);
    res := res || jsonb_build_object('c', 'anon：公開記事へのコメントだけ読める（/b/ の公開ページ用）', 'ok', s = '__公開記事へのコメント', 'd', coalesce(s, '0 件'));
    execute 'reset role';

    -- ── carol（関係のない人）
    perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', c::text, true);
    execute 'set local role authenticated';
    select string_agg(name, ',' order by name) into s from public.circles where id = any(ours);
    res := res || jsonb_build_object('c', 'carol：公開のサークル P・Q だけ見える（フォロワー限定の F は見えない）', 'ok', s = '__確認P,__確認Q', 'd', coalesce(s, '0 件'));
    res := res || jsonb_build_object('c', 'carol：見えないサークル F のメンバー一覧を読めない', 'ok', (select count(*) from public.circle_members where circle_id = cf) = 0, 'd', '');
    res := res || jsonb_build_object('c', 'carol：ほかの人（bob）の「申請中」を読めない', 'ok', (select count(*) from public.circle_members where circle_id = cq and status = 'pending') = 0, 'd', '');
    select count(*) into n from public.circle_members where circle_id = cq;
    res := res || jsonb_build_object('c', 'carol：見えるサークル Q のメンバー（承認済みの 2 人）は読める', 'ok', n = 2, 'd', n || ' 人');
    res := res || jsonb_build_object('c', 'carol：メンバーでないサークルの投稿・返信・投票を読めない', 'ok',
      (select count(*) from public.circle_posts where circle_id = any(ours)) + (select count(*) from public.circle_replies where post_id in (pq, pq2, pf))
      + (select count(*) from public.circle_votes where post_id in (pq, pq2, pf)) = 0, 'd', '');
    res := res || jsonb_build_object('c', 'carol：フォロワー限定・非公開の回答へのコメントを読めない', 'ok', (select count(*) from public.comments where answer_id in (ans_fol, ans_prv)) = 0, 'd', '');
    res := res || jsonb_build_object('c', 'carol：限定記事へのコメント・いいねを読めない', 'ok',
      (select count(*) from public.blog_comments where post_id = bp_fol) + (select count(*) from public.blog_likes where post_id = bp_fol) = 0, 'd', '');
    res := res || jsonb_build_object('c', 'carol：日記にだれが招待されたかを読めない', 'ok', (select count(*) from public.diary_page_mentions where page_id = dp) = 0, 'd', '');
    if applied1 then
      execute 'select public.circle_post_target_is_member($1, $2)' into denied using pq, a;
      res := res || jsonb_build_object('c', 'carol：判定の関数を API から直接呼んでも、メンバーでないサークルのメンバーは調べられない', 'ok', not denied, 'd', '');
      execute 'select public.circle_join_status_ok($1, ''member'')' into denied using cf;
      res := res || jsonb_build_object('c', 'carol：判定の関数を API から直接呼んでも、見えないサークル F の参加方式は調べられない', 'ok', not denied, 'd', '');
    end if;
    denied := false; begin insert into public.circle_members (circle_id, user_id, status) values (cq, c, 'member'); exception when insufficient_privilege then denied := true; end;
    res := res || jsonb_build_object('c', 'carol：承認制のサークル Q に自分を「メンバー」として直接登録できない（承認の回避）', 'ok', denied, 'd', '');
    denied := false; begin insert into public.circle_members (circle_id, user_id, status) values (cf, c, 'member'); exception when insufficient_privilege then denied := true; end;
    res := res || jsonb_build_object('c', 'carol：見えないサークル F に参加できない', 'ok', denied, 'd', '');
    denied := false; begin insert into public.circle_members (circle_id, user_id, status) values (cp, d, 'member'); exception when insufficient_privilege then denied := true; end;
    res := res || jsonb_build_object('c', 'carol：ほかの人（dave）を勝手に参加させられない', 'ok', denied, 'd', '');
    denied := false; begin insert into public.circle_posts (circle_id, user_id, body) values (cp, c, 'x'); exception when insufficient_privilege then denied := true; end;
    res := res || jsonb_build_object('c', 'carol：メンバーでなければ投稿できない', 'ok', denied, 'd', '');
    denied := false; begin insert into public.circle_replies (post_id, user_id, body) values (pq, c, 'x'); exception when insufficient_privilege then denied := true; end;
    res := res || jsonb_build_object('c', 'carol：メンバーでなければ返信できない', 'ok', denied, 'd', '');
    denied := false; begin insert into public.circles (name, created_by, is_official) values ('__偽の公認', c, true); exception when insufficient_privilege then denied := true; end;
    res := res || jsonb_build_object('c', 'carol：公認アカウントでなければ公認のサークルを作れない', 'ok', denied, 'd', '');
    denied := false; begin insert into public.comments (answer_id, user_id, body) values (ans_fol, c, 'x'); exception when insufficient_privilege then denied := true; end;
    res := res || jsonb_build_object('c', 'carol：読めない回答にはコメントできない', 'ok', denied, 'd', '');
    denied := false; begin insert into public.blog_likes (post_id, user_id) values (bp_fol, c); exception when insufficient_privilege then denied := true; end;
    res := res || jsonb_build_object('c', 'carol：読めない記事にはいいねできない', 'ok', denied, 'd', '');
    denied := true; begin
      insert into public.circle_members (circle_id, user_id, status) values (cp, c, 'member');
      insert into public.circle_posts (circle_id, user_id, body) values (cp, c, 'P に参加して投稿');
      insert into public.comments (answer_id, user_id, body) values (ans_pub, c, '__carol のコメント') returning id into newc;   -- アプリのコメントは returning で読み返す
      if newc is null then denied := false; end if;
    exception when insufficient_privilege then denied := false; end;
    res := res || jsonb_build_object('c', 'carol：自由参加の P には参加・投稿でき、公開の回答にコメントして読み返せる（ふつうの操作は通る）', 'ok', denied, 'd', '');
    newc := null; begin
      insert into public.circles (name, created_by, join_policy, visibility) values ('__確認carol', c, 'open', 'followers') returning id into newc;
    exception when insufficient_privilege then newc := null; end;
    res := res || jsonb_build_object('c', 'carol：サークルを作って、すぐ読み返せる（アプリの作成は insert ... returning。フォロワー限定でも）', 'ok', newc is not null, 'd', '');
    update public.diary_entries set body = 'carol が書きかえ' where id = de;
    execute 'reset role';
    res := res || jsonb_build_object('c', 'carol：ほかの人の日記の書きこみを編集できない', 'ok', (select body from public.diary_entries where id = de) = 'bob の書きこみ', 'd', '');

    -- ── bob（alice のフォロワー・Q に申請中・日記に招待された人）
    perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', b::text, true);
    execute 'set local role authenticated';
    res := res || jsonb_build_object('c', 'bob：フォロワー限定のサークル F を見つけられる', 'ok', (select count(*) from public.circles where id = cf) = 1, 'd', '');
    res := res || jsonb_build_object('c', 'bob：見つけられても、参加するまで F の投稿は読めない', 'ok', (select count(*) from public.circle_posts where circle_id = cf) = 0, 'd', '');
    res := res || jsonb_build_object('c', 'bob：自分の申請（申請中）を読める', 'ok', (select count(*) from public.circle_members where circle_id = cq and user_id = b) = 1, 'd', '');
    res := res || jsonb_build_object('c', 'bob：申請中はメンバー限定の投稿・返信・投票を読めない', 'ok',
      (select count(*) from public.circle_posts where circle_id = cq) + (select count(*) from public.circle_replies where post_id = pq)
      + (select count(*) from public.circle_votes where post_id = pq) = 0, 'd', '');
    denied := false; begin insert into public.circle_posts (circle_id, user_id, body) values (cq, b, 'x'); exception when insufficient_privilege then denied := true; end;
    res := res || jsonb_build_object('c', 'bob：申請中は投稿できない', 'ok', denied, 'd', '');
    update public.circle_members set status = 'member' where circle_id = cq and user_id = b;
    select count(*) into n from public.comments where answer_id = ans_fol and user_id = a;   -- alice が書いた 1 件
    res := res || jsonb_build_object('c', 'bob：フォロワー限定の回答へのコメントは読める', 'ok', n = 1, 'd', n || ' 件');
    res := res || jsonb_build_object('c', 'bob：非公開の回答へのコメントは読めない', 'ok', (select count(*) from public.comments where answer_id = ans_prv) = 0, 'd', '');
    res := res || jsonb_build_object('c', 'bob：限定記事へのコメント・いいねを読める', 'ok',
      (select count(*) from public.blog_comments where post_id = bp_fol and user_id = a) = 1 and (select count(*) from public.blog_likes where post_id = bp_fol and user_id = a) = 1, 'd', '');
    res := res || jsonb_build_object('c', 'bob：招待された日記の招待を読める', 'ok', (select count(*) from public.diary_page_mentions where page_id = dp) = 1, 'd', '');
    update public.diary_entries set body = 'bob が編集した' where id = de;
    execute 'reset role';
    res := res || jsonb_build_object('c', 'bob：自分を承認済みにできない', 'ok', (select status from public.circle_members where circle_id = cq and user_id = b) = 'pending', 'd', '');
    s := (select body from public.diary_entries where id = de);
    res := res || jsonb_build_object('c', 'bob：自分の日記の書きこみを編集できる（以前は黙って失敗）', 'ok', s = 'bob が編集した', 'd', s);

    -- ── dave（Q のメンバー）
    perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', d::text, true);
    execute 'set local role authenticated';
    res := res || jsonb_build_object('c', 'dave：メンバーは投稿・返信・投票を読める', 'ok',
      (select count(*) from public.circle_posts where circle_id = cq and user_id = a) = 3 and (select count(*) from public.circle_replies where post_id = pq and user_id = d) = 1
      and (select count(*) from public.circle_votes where post_id = pq and user_id = d) = 1, 'd', '');
    denied := false; begin insert into public.circle_votes (post_id, user_id, target_id) values (pq2, d, b); exception when insufficient_privilege then denied := true; end;
    res := res || jsonb_build_object('c', 'dave：投票の相手はメンバーだけ（申請中の bob には投票できない）', 'ok', denied, 'd', '');
    denied := true; begin
      insert into public.circle_votes (post_id, user_id, target_id) values (pq3, d, a);   -- 上の確認とは別の投稿（1 投稿 1 票のため）
      insert into public.circle_replies (post_id, user_id, body) values (pq2, d, 'メンバーの返信');
      insert into public.circle_posts (circle_id, user_id, body) values (cq, d, 'メンバーの投稿');
    exception when insufficient_privilege then denied := false; end;
    res := res || jsonb_build_object('c', 'dave：メンバーは投稿・返信・メンバーへの投票ができる（ふつうの操作は通る）', 'ok', denied, 'd', '');
    execute 'reset role';

    -- ── alice（作成者）
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', a::text, true);
    execute 'set local role authenticated';
    res := res || jsonb_build_object('c', 'alice：作成者は申請中の人を読める（承認のため）', 'ok', (select count(*) from public.circle_members where circle_id = cq and status = 'pending') = 1, 'd', '');
    res := res || jsonb_build_object('c', 'alice：自分のサークル 3 つ・自分の回答へのコメントをすべて読める', 'ok',
      (select count(*) from public.circles where id = any(ours)) = 3 and (select count(*) from public.comments where answer_id in (ans_pub, ans_fol, ans_prv)) >= 3, 'd', '');
    update public.circle_members set status = 'member' where circle_id = cq and user_id = b;
    execute 'reset role';
    res := res || jsonb_build_object('c', 'alice：作成者は申請を承認できる', 'ok', (select status from public.circle_members where circle_id = cq and user_id = b) = 'member', 'd', '');

    -- ── 承認されたあとの bob
    perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', b::text, true);
    execute 'set local role authenticated';
    res := res || jsonb_build_object('c', 'bob：承認されると Q の投稿を読める', 'ok', (select count(*) from public.circle_posts where circle_id = cq) >= 2, 'd', '');
    execute 'reset role';

    perform set_config('request.jwt.claims', '', true);
    perform set_config('request.jwt.claim.sub', '', true);
    raise exception 'miri_access_rollback';   -- ここまでの書きこみをすべて取り消す
  exception when raise_exception then
    if sqlerrm <> 'miri_access_rollback' then raise; end if;
  end;

  -- 取り消せたことの確認
  select count(*) into n from public.circles where name like '\_\_確認%' or name = '__偽の公認';
  res := res || jsonb_build_object('c', '確認のための書きこみは何も残っていない', 'ok', n = 0 and not exists (select 1 from public.answers where question_key like '\_\_ac\_%'), 'd', '');
  return query select (row_number() over ())::int, e ->> 'c', (e ->> 'ok')::boolean, e ->> 'd' from jsonb_array_elements(res) e;
end;
$$;
select * from pg_temp.miri_access_check();
