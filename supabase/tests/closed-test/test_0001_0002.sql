-- ============================================================
-- 0001・0002 のテスト（手元の PostgreSQL。本番の形のデータベースに 0001・0002 を適用してから実行）
--   run.sh が、本番の形（schema → patch → 本番に合わせる）を作り、このファイルを流す
-- 結果は PASS / FAIL で表示する
-- ============================================================
\set QUIET on
-- 登場人物：A 作成者／B A のフォロワー／C 関係のない人／D 承認制サークルのメンバー／E 申請中／O 公認アカウント
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-00000000000a','ct-a@example.com'), ('b0000000-0000-4000-8000-00000000000b','ct-b@example.com'),
  ('c0000000-0000-4000-8000-00000000000c','ct-c@example.com'), ('d0000000-0000-4000-8000-00000000000d','ct-d@example.com'),
  ('e0000000-0000-4000-8000-00000000000e','ct-e@example.com'), ('f0000000-0000-4000-8000-00000000000f','ct-o@example.com');
insert into public.profiles (id, username, display_name) values
  ('a0000000-0000-4000-8000-00000000000a','ct_a','A'), ('b0000000-0000-4000-8000-00000000000b','ct_b','B'),
  ('c0000000-0000-4000-8000-00000000000c','ct_c','C'), ('d0000000-0000-4000-8000-00000000000d','ct_d','D'),
  ('e0000000-0000-4000-8000-00000000000e','ct_e','E'), ('f0000000-0000-4000-8000-00000000000f','ct_o','O')
on conflict (id) do nothing;
update public.profiles set is_official = true where id = 'f0000000-0000-4000-8000-00000000000f';
insert into public.follows (follower_id, following_id) values ('b0000000-0000-4000-8000-00000000000b','a0000000-0000-4000-8000-00000000000a');
-- サークル：P 公開・自由参加／F フォロワー限定・自由参加／Q 公開・承認制
insert into public.circles (id, name, created_by, join_policy, visibility) values
  ('11110000-0000-4000-8000-000000000001','P','a0000000-0000-4000-8000-00000000000a','open','public'),
  ('11110000-0000-4000-8000-000000000002','F','a0000000-0000-4000-8000-00000000000a','open','followers'),
  ('11110000-0000-4000-8000-000000000003','Q','a0000000-0000-4000-8000-00000000000a','approval','public');
insert into public.circle_members (circle_id, user_id, status) values
  ('11110000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-00000000000a','member'),
  ('11110000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-00000000000a','member'),
  ('11110000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-00000000000a','member'),
  ('11110000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-00000000000d','member'),
  ('11110000-0000-4000-8000-000000000003','e0000000-0000-4000-8000-00000000000e','pending');
insert into public.circle_posts (id, circle_id, user_id, body) values
  ('22220000-0000-4000-8000-000000000001','11110000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-00000000000a','Q の投稿'),
  ('22220000-0000-4000-8000-000000000002','11110000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-00000000000a','F の投稿');
insert into public.circle_replies (post_id, user_id, body) values ('22220000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-00000000000d','返信');
insert into public.circle_votes (post_id, user_id, target_id) values ('22220000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-00000000000d','a0000000-0000-4000-8000-00000000000a');
-- 回答・ブログ・日記
insert into public.answers (id, user_id, question_key, question_title, body, visibility) values
  ('33330000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-00000000000a','ct1','公開の質問','公開の回答','public'),
  ('33330000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-00000000000a','ct2','限定の質問','フォロワー限定の回答','followers'),
  ('33330000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-00000000000a','ct3','秘密','非公開の回答','private');
insert into public.comments (answer_id, user_id, body) values
  ('33330000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-00000000000a','公開へのコメント'),
  ('33330000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-00000000000a','限定へのコメント'),
  ('33330000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-00000000000a','非公開へのコメント');
insert into public.reactions (answer_id, user_id, type) values
  ('33330000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-00000000000a','like');
insert into public.blog_posts (id, user_id, body, visibility) values
  ('44440000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-00000000000a','公開の記事','public'),
  ('44440000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-00000000000a','フォロワー限定の記事','followers');
insert into public.blog_comments (post_id, user_id, body) values
  ('44440000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-00000000000a','公開記事へのコメント'),
  ('44440000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-00000000000a','限定記事へのコメント');
insert into public.blog_likes (post_id, user_id) values ('44440000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-00000000000a');
insert into public.diary_pages (id, created_by, theme, visibility) values
  ('55550000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-00000000000a','B と交換日記','mentioned');
insert into public.diary_page_mentions (page_id, user_id) values ('55550000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-00000000000b');
insert into public.diary_entries (id, page_id, user_id, body) values
  ('66660000-0000-4000-8000-000000000001','55550000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-00000000000b','B の書きこみ');

-- 人を切りかえる：select pg_temp.as_user('<uuid>') / pg_temp.as_anon()
create function pg_temp.as_user(u text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', u, false), set_config('request.jwt.claim.role', 'authenticated', false);
$$;
create function pg_temp.as_anon() returns void language sql as $$
  select set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claim.role', 'anon', false);
$$;
create function pg_temp.ok(c boolean, label text) returns void language plpgsql as $$
begin raise notice '% %', case when c then 'PASS' else 'FAIL' end, label; end $$;
grant execute on all functions in schema pg_temp to anon, authenticated;

\echo '== 0001 サークル：読む'
select pg_temp.as_anon(); set role anon;
select pg_temp.ok((select count(*) from public.circles where name in ('P','F','Q')) = 0, 'ログインしていない人はサークルを読めない');
select pg_temp.ok((select count(*) from public.circle_posts) = 0, 'ログインしていない人は投稿を読めない');
reset role;
select pg_temp.as_user('c0000000-0000-4000-8000-00000000000c'); set role authenticated;
select pg_temp.ok((select string_agg(name, ',' order by name) from public.circles where name in ('P','F','Q')) = 'P,Q', '関係のない人には公開の P・Q だけ（フォロワー限定の F は見えない）');
select pg_temp.ok((select count(*) from public.circle_members where circle_id = '11110000-0000-4000-8000-000000000002') = 0, '見えないサークル（F）のメンバー一覧は読めない');
select pg_temp.ok((select count(*) from public.circle_members where status = 'pending') = 0, 'ほかの人の「申請中」は読めない');
select pg_temp.ok((select count(*) from public.circle_members where circle_id = '11110000-0000-4000-8000-000000000003') = 2, '見えるサークル（Q）のメンバー（承認済みの 2 人）は読める');
select pg_temp.ok((select count(*) from public.circle_posts) = 0, 'メンバーでなければ投稿を読めない（API で直接読んでも 0 件）');
select pg_temp.ok((select count(*) from public.circle_replies) = 0 and (select count(*) from public.circle_votes) = 0, 'メンバーでなければ返信・投票を読めない');
reset role;
select pg_temp.as_user('b0000000-0000-4000-8000-00000000000b'); set role authenticated;
select pg_temp.ok((select count(*) from public.circles where name = 'F') = 1, '作成者のフォロワー（B）はフォロワー限定の F を見つけられる');
select pg_temp.ok((select count(*) from public.circle_posts where circle_id = '11110000-0000-4000-8000-000000000002') = 0, '見つけられても、参加するまで F の投稿は読めない');
reset role;
select pg_temp.as_user('e0000000-0000-4000-8000-00000000000e'); set role authenticated;
select pg_temp.ok((select count(*) from public.circles where name = 'Q') = 1, '申請中の人（E）はサークル Q を見られる');
select pg_temp.ok((select count(*) from public.circle_members where user_id = 'e0000000-0000-4000-8000-00000000000e') = 1, '申請中の人は自分の申請を読める');
select pg_temp.ok((select count(*) from public.circle_posts) = 0 and (select count(*) from public.circle_replies) = 0, '申請中の人はメンバー限定の投稿・返信を読めない');
reset role;
select pg_temp.as_user('d0000000-0000-4000-8000-00000000000d'); set role authenticated;
select pg_temp.ok((select count(*) from public.circle_posts where circle_id = '11110000-0000-4000-8000-000000000003') = 1
  and (select count(*) from public.circle_replies) = 1 and (select count(*) from public.circle_votes) = 1, 'メンバー（D）は投稿・返信・投票を読める');
reset role;
select pg_temp.as_user('a0000000-0000-4000-8000-00000000000a'); set role authenticated;
select pg_temp.ok((select count(*) from public.circle_members where status = 'pending') = 1, '作成者（A）は申請中の人を読める（承認のため）');
reset role;

\echo '== 0001 サークル：書く'
select pg_temp.as_user('c0000000-0000-4000-8000-00000000000c'); set role authenticated;
do $$ begin
  begin insert into public.circle_members (circle_id, user_id, status) values ('11110000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-00000000000c','member');
        perform pg_temp.ok(false, '承認制のサークルに、自分を「メンバー」として直接登録できない（承認の回避）');
  exception when insufficient_privilege then perform pg_temp.ok(true, '承認制のサークルに、自分を「メンバー」として直接登録できない（承認の回避）'); end;
  begin insert into public.circle_members (circle_id, user_id, status) values ('11110000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-00000000000c','member');
        perform pg_temp.ok(false, '見えないサークル（F）には参加できない');
  exception when insufficient_privilege then perform pg_temp.ok(true, '見えないサークル（F）には参加できない'); end;
  begin insert into public.circle_members (circle_id, user_id, status) values ('11110000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-00000000000b','member');
        perform pg_temp.ok(false, 'ほかの人を勝手に参加させられない');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'ほかの人を勝手に参加させられない'); end;
  begin insert into public.circle_posts (circle_id, user_id, body) values ('11110000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-00000000000c','x');
        perform pg_temp.ok(false, 'メンバーでなければ投稿できない');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'メンバーでなければ投稿できない'); end;
  begin insert into public.circle_replies (post_id, user_id, body) values ('22220000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-00000000000c','x');
        perform pg_temp.ok(false, 'メンバーでなければ返信できない');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'メンバーでなければ返信できない'); end;
  begin insert into public.circles (name, created_by, is_official) values ('偽の公認', 'c0000000-0000-4000-8000-00000000000c', true);
        perform pg_temp.ok(false, '公認アカウントでなければ公認のサークルを作れない');
  exception when insufficient_privilege then perform pg_temp.ok(true, '公認アカウントでなければ公認のサークルを作れない'); end;
end $$;
insert into public.circle_members (circle_id, user_id, status) values ('11110000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-00000000000c','pending');
select pg_temp.ok(true, '承認制のサークルには「申請中」で申し込める');
insert into public.circle_members (circle_id, user_id, status) values ('11110000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-00000000000c','member');
insert into public.circle_posts (circle_id, user_id, body) values ('11110000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-00000000000c','P に参加して投稿');
select pg_temp.ok(true, '自由参加のサークル（P）には参加でき、参加すれば投稿できる');
insert into public.circles (name, created_by, join_policy) values ('C のサークル', 'c0000000-0000-4000-8000-00000000000c', 'approval');
insert into public.circle_members (circle_id, user_id, status) select id, 'c0000000-0000-4000-8000-00000000000c', 'member' from public.circles where name = 'C のサークル';
select pg_temp.ok(true, '作成者は、自分の承認制サークルに「メンバー」として入れる（作成の流れ）');
reset role;
select pg_temp.as_user('e0000000-0000-4000-8000-00000000000e'); set role authenticated;
update public.circle_members set status = 'member' where user_id = 'e0000000-0000-4000-8000-00000000000e';
reset role;
select pg_temp.ok((select status from public.circle_members where user_id = 'e0000000-0000-4000-8000-00000000000e') = 'pending', '申請中の人は自分を承認済みにできない');
select pg_temp.as_user('d0000000-0000-4000-8000-00000000000d'); set role authenticated;
do $$ begin
  begin insert into public.circle_votes (post_id, user_id, target_id) values ('22220000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-00000000000d','e0000000-0000-4000-8000-00000000000e');
        perform pg_temp.ok(false, '投票の相手はサークルのメンバーだけ（申請中の人には投票できない）');
  exception when insufficient_privilege or unique_violation then perform pg_temp.ok(true, '投票の相手はサークルのメンバーだけ（申請中の人には投票できない）'); end;
end $$;
reset role;
select pg_temp.as_user('a0000000-0000-4000-8000-00000000000a'); set role authenticated;
update public.circle_members set status = 'member' where circle_id = '11110000-0000-4000-8000-000000000003' and user_id = 'e0000000-0000-4000-8000-00000000000e';
reset role;
select pg_temp.ok((select status from public.circle_members where user_id = 'e0000000-0000-4000-8000-00000000000e') = 'member', '作成者は申請を承認できる');
select pg_temp.as_user('f0000000-0000-4000-8000-00000000000f'); set role authenticated;
insert into public.circles (name, created_by, is_official) values ('公認のサークル', 'f0000000-0000-4000-8000-00000000000f', true);
select pg_temp.ok(true, '公認アカウントは公認のサークルを作れる');
reset role;

\echo '== 0002 コメント・リアクション・ブログ・日記'
select pg_temp.as_anon(); set role anon;
select pg_temp.ok((select string_agg(body, ',') from public.comments) = '公開へのコメント', 'ログインしていない人は公開の回答へのコメントだけ読める');
select pg_temp.ok((select count(*) from public.reactions) = 0, 'ログインしていない人は限定の回答へのリアクションを読めない');
select pg_temp.ok((select string_agg(body, ',') from public.blog_comments) = '公開記事へのコメント', 'ログインしていない人は公開記事へのコメントだけ読める（/b/ の公開ページ用）');
reset role;
select pg_temp.as_user('c0000000-0000-4000-8000-00000000000c'); set role authenticated;
select pg_temp.ok((select count(*) from public.comments where body in ('限定へのコメント','非公開へのコメント')) = 0, '関係のない人は、フォロワー限定・非公開の回答へのコメントを読めない');
select pg_temp.ok((select count(*) from public.blog_comments where body = '限定記事へのコメント') = 0 and (select count(*) from public.blog_likes) = 0, '関係のない人は、限定記事へのコメント・いいねを読めない');
select pg_temp.ok((select count(*) from public.diary_page_mentions) = 0, '関係のない人は、日記にだれが招待されたかを読めない');
do $$ begin
  begin insert into public.comments (answer_id, user_id, body) values ('33330000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-00000000000c','x');
        perform pg_temp.ok(false, '読めない回答にはコメントできない');
  exception when insufficient_privilege then perform pg_temp.ok(true, '読めない回答にはコメントできない'); end;
  begin insert into public.blog_likes (post_id, user_id) values ('44440000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-00000000000c');
        perform pg_temp.ok(false, '読めない記事にはいいねできない');
  exception when insufficient_privilege then perform pg_temp.ok(true, '読めない記事にはいいねできない'); end;
end $$;
insert into public.comments (answer_id, user_id, body) values ('33330000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-00000000000c','C のコメント');
select pg_temp.ok(true, '公開の回答にはコメントできる');
reset role;
select pg_temp.as_user('b0000000-0000-4000-8000-00000000000b'); set role authenticated;
select pg_temp.ok((select count(*) from public.comments where body = '限定へのコメント') = 1 and (select count(*) from public.comments where body = '非公開へのコメント') = 0, 'フォロワーはフォロワー限定の回答へのコメントを読める（非公開は読めない）');
select pg_temp.ok((select count(*) from public.blog_comments where body = '限定記事へのコメント') = 1 and (select count(*) from public.blog_likes) = 1, 'フォロワーは限定記事へのコメント・いいねを読める');
select pg_temp.ok((select count(*) from public.diary_page_mentions) = 1, '招待された本人は招待を読める');
update public.diary_entries set body = 'B が編集した' where id = '66660000-0000-4000-8000-000000000001';
reset role;
select pg_temp.ok((select body from public.diary_entries where id = '66660000-0000-4000-8000-000000000001') = 'B が編集した', '日記の書きこみを本人が編集できる（以前は黙って失敗していた）');
select pg_temp.as_user('c0000000-0000-4000-8000-00000000000c'); set role authenticated;
update public.diary_entries set body = 'C が書きかえ' where id = '66660000-0000-4000-8000-000000000001';
reset role;
select pg_temp.ok((select body from public.diary_entries where id = '66660000-0000-4000-8000-000000000001') = 'B が編集した', 'ほかの人の日記の書きこみは編集できない');
