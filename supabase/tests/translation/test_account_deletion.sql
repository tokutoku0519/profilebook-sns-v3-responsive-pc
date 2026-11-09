\set QUIET on
-- 退会・データ削除の申請（supabase/proposal_account_deletion_requests.sql）の権限と動き
insert into public.profiles (id, username) values ('dddddddd-0000-4000-8000-000000000004','dave'),('eeeeeeee-0000-4000-8000-000000000005','erin');

\echo '== 10. 退会・データ削除の申請'
set role authenticated; set request.jwt.claims = '{"sub":"dddddddd-0000-4000-8000-000000000004","role":"authenticated"}';
do $$ begin
  insert into public.account_deletion_requests (user_id, username, note) values ('dddddddd-0000-4000-8000-000000000004', 'dave', 'お願いします');
  raise notice 'PASS 本人は自分の申請を作れる';
  begin insert into public.account_deletion_requests (user_id, username) values ('dddddddd-0000-4000-8000-000000000004', 'dave');
        raise notice 'FAIL 受付中の申請を二重に作れた';
  exception when unique_violation then raise notice 'PASS 受付中の申請は 1 人 1 件'; end;
  begin insert into public.account_deletion_requests (user_id, username) values ('eeeeeeee-0000-4000-8000-000000000005', 'erin');
        raise notice 'FAIL ほかの人の名義で申請できた';
  exception when insufficient_privilege then raise notice 'PASS ほかの人の名義では申請できない'; end;
  begin insert into public.account_deletion_requests (user_id, username, status) values ('dddddddd-0000-4000-8000-000000000004', 'dave', 'completed');
        raise notice 'FAIL 自分で「完了」の申請を作れた';
  exception when insufficient_privilege or unique_violation then raise notice 'PASS 状態や運営者の欄は自分では入れられない'; end;
end $$;
do $$ begin
  begin update public.account_deletion_requests set status = 'completed'; raise notice 'FAIL 本人が申請を書きかえられた';
  exception when insufficient_privilege then raise notice 'PASS 本人は申請を書きかえられない（権限なし）'; end;
  begin delete from public.account_deletion_requests; raise notice 'FAIL 本人が申請を消せた';
  exception when insufficient_privilege then raise notice 'PASS 本人は申請を消せない（権限なし）'; end;
end $$;
reset role;
set role authenticated; set request.jwt.claims = '{"sub":"eeeeeeee-0000-4000-8000-000000000005","role":"authenticated"}';
do $$ declare n int; begin
  select count(*) into n from public.account_deletion_requests;
  raise notice '% ほかの人の申請は見えない（% 件）', case when n = 0 then 'PASS' else 'FAIL' end, n;
end $$;
reset role;
set role anon; set request.jwt.claims = '{"role":"anon"}';
do $$ begin
  perform 1 from public.account_deletion_requests;
  raise notice 'FAIL ログインしていない人が申請を読めた';
exception when insufficient_privilege then raise notice 'PASS ログインしていない人は読めない';
end $$;
reset role;
-- 運営者の作業（RLS を通らない）
do $$ declare r public.account_deletion_requests%rowtype; begin
  update public.account_deletion_requests set status = 'in_progress', identity_checked_at = now() where username = 'dave';
  update public.account_deletion_requests set status = 'completed', handled_note = 'profiles 以下を削除・法定の記録は保存' where username = 'dave';
  select * into r from public.account_deletion_requests where username = 'dave';
  raise notice '% 完了にすると、完了日時と保存期限（3 年）が入る', case when r.completed_at is not null and r.retain_until > now() + interval '2 years 11 months' then 'PASS' else 'FAIL' end;
  delete from public.profiles where id = 'dddddddd-0000-4000-8000-000000000004';
  select * into r from public.account_deletion_requests where username = 'dave';
  raise notice '% 退会（削除）しても申請の記録は残る（user_id は空になる）', case when r.id is not null and r.user_id is null then 'PASS' else 'FAIL' end;
  update public.account_deletion_requests set retain_until = now() - interval '1 day';
  raise notice '% 保存期限が過ぎたら消せる（% 件）', case when public.purge_account_deletion_requests() = 1 then 'PASS' else 'FAIL' end, 1;
end $$;
