-- ============================================================
-- セキュリティパッチ A / STEP 3（旧 profiles.book のクリア）※1回だけ実行
-- ------------------------------------------------------------
-- 前提：security_patch_A.sql の STEP 1+2 を適用済みで、アプリが profile_book を
--       読み書きするデプロイになっていて、実機の動作確認が済んでいること。
--
-- 目的：旧 profiles.book を空にして、anon key での直叩き漏えいを完全に閉じる。
--       以後、他人の book はサーバー関数 get_visible_book（公開分のみ）経由でしか取れない。
--
-- 安全ガード：中身があり、かつその中身が profile_book に移行済みの行だけを空にする。
--            （profile_book 未移行の行は誤って消さない）
-- ============================================================
update public.profiles p
set book = '{}'::jsonb
where p.book <> '{}'::jsonb
  and exists (
    select 1 from public.profile_book pb
    where pb.id = p.id and pb.book <> '{}'::jsonb
  );

-- 実行後の確認（任意）：profiles 側が空・profile_book 側にデータ、が期待値
-- select
--   (select count(*) from public.profiles     where book <> '{}'::jsonb) as profiles_with_data,   -- 期待 0
--   (select count(*) from public.profile_book where book <> '{}'::jsonb) as profile_book_with_data; -- 期待 移行済み件数
