-- ============================================================
-- 【取り消し】supabase/proposal_content_translations.sql で追加したものを消す
--
-- ・原文（profile_book・answers）・プロフィール・認証・課金のデータには触れない（翻訳のテーブル・関数・トリガーだけ）。
-- ・② 法定の記録（translation_consent_events・translation_provision_log）も消える。
--   本番で一度でも外国への送信をしたあとは、先に「1. 記録の書き出し」を実行して CSV を保存してから、「2. 削除」を実行する。
-- ・翻訳を止めるだけなら、これは使わない：update public.translation_settings set enabled = false;
-- ============================================================

-- 1. 記録の書き出し（SQL Editor で実行し、結果を CSV で保存する）
-- select * from public.translation_consent_events order by id;
-- select * from public.translation_provision_log order by id;
-- select * from public.translation_consent_notices;

-- 2. 削除
begin;
drop trigger if exists answers_purge_translations on public.answers;
drop trigger if exists profile_book_purge_translations on public.profile_book;
drop function if exists public.purge_answer_translations();
drop function if exists public.purge_profile_translations();
drop function if exists public.purge_translation_cache();
drop function if exists public.purge_translation_cost_records();
drop function if exists public.purge_translation_legal_records();
drop function if exists public.owner_allows_translation(text, text);
drop function if exists public.get_translation_consent(uuid, text);
drop function if exists public.revoke_translation_consent(uuid);
drop function if exists public.set_translation_items(uuid, text, jsonb);
drop function if exists public.grant_translation_consent(uuid, text, text, text, jsonb, integer, integer, jsonb);
drop function if exists public.translation_replace_items(uuid, jsonb, bigint);
drop function if exists public.translation_items_valid(uuid, jsonb);
drop function if exists public.translation_candidates(uuid);
drop function if exists public.settle_translation(bigint, integer, integer, integer, integer);
drop function if exists public.reserve_translation(uuid, uuid, numeric);
drop function if exists public.halt_translation(text);
drop function if exists public.finish_translation_provision(bigint, text, text, text, text);
drop function if exists public.begin_translation_provision(uuid, text, text, text, text, text, integer, text);
drop function if exists public.store_translation(text, text, text, text, text, text, text, text[], integer, integer, numeric, text, text);
drop function if exists public.release_translation(text, text, text, text, text);
drop function if exists public.claim_translation(text, text, text, text, text, text);
drop function if exists public.get_translation(text, text, text, text, text);
drop function if exists public.translatable_source(text, text, text, text);
drop function if exists public.translation_first_text(jsonb);
drop function if exists public.translation_consent_current(uuid, text);
drop table if exists public.translation_age_gate;
drop table if exists public.translation_daily;
drop table if exists public.translation_reservations;
drop table if exists public.translation_budget;
drop table if exists public.content_translations;
drop table if exists public.translation_provision_log;
drop table if exists public.translation_consent_notices;
drop table if exists public.translation_consent_events;
drop table if exists public.translation_item_permissions;
drop table if exists public.translation_consents;
drop table if exists public.translation_settings;
commit;
