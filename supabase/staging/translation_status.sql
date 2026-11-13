-- ============================================================
-- 【読み取りだけ・検証用】翻訳の記録をまとめて見る（アプリでの確認の各ステップのあとに実行）
--
-- ・1 行目の「set transaction read only」で、書きこみは一切できない。
-- ・ユーザーは username（test_alice など）で表示する。訳文は先頭 40 文字だけ。
-- ・SQL Editor は最後の結果しか表示しないので、1 つの表（section・at・detail）にまとめている。
-- ============================================================
set transaction read only;
with
u as (select id, username from public.profiles),
s as (
  select 1 as ord, '1 設定' as section, updated_at as at,
         format('enabled=%s / 停止の理由=%s / 月の上限=$%s', enabled, coalesce(halted_reason, 'なし'), monthly_cap_usd) as detail
    from public.translation_settings
  union all
  select 2, '2 許可の状態', c.updated_at,
         format('%s：許可=%s / 版=%s', coalesce(u.username, '(退会)'), c.allow, coalesce(c.version, '-'))
    from public.translation_consents c left join u on u.id = c.user_id
  union all
  select 3, '3 翻訳してよい項目', p.created_at,
         format('%s：%s / %s', coalesce(u.username, '(退会)'), p.item_kind, p.item_key)
    from public.translation_item_permissions p left join u on u.id = p.owner_id
  union all
  select 4, '4 許可・取り消しの記録', e.created_at,
         format('%s：%s / 年齢=%s / 版=%s / 項目=%s', coalesce(u.username, '(退会)'), e.action, coalesce(e.age_band, '-'),
                coalesce(e.consent_version, '-'), e.scope::text)
    from (select * from public.translation_consent_events order by created_at desc limit 15) e left join u on u.id = e.user_id
  union all
  select 5, '5 送信の記録（法定）＋技術ログ', l.sent_at,
         format('#%s %s：%s %s → %s / 結果=%s / 地域=%s / 同意#%s / モデル=%s / 何回目=%s / エラー=%s',
                l.id, coalesce(u.username, '(退会)'), l.source_type, l.source_path, l.target_lang, l.outcome,
                coalesce(l.reported_geo, '-'), coalesce(l.consent_event_id::text, '-'), coalesce(t.model, '-'),
                coalesce(t.attempt::text, '-'), coalesce(t.error_code, 'なし'))
    from (select * from public.translation_provision_log order by sent_at desc limit 20) l
    left join public.translation_send_log t on t.provision_id = l.id
    left join u on u.id = l.owner_id
  union all
  select 6, '6 保存された翻訳', c.updated_at,
         format('%s：%s %s → %s / %s%s / %s', coalesce(u.username, '(退会)'), c.source_type, c.source_path, c.target_lang, c.status,
                coalesce(' (' || c.kept_reason || ')', ''), coalesce(left(c.translated_text, 40), '-'))
    from (select * from public.content_translations order by updated_at desc limit 20) c left join u on u.id = c.owner_id
  union all
  select 7, '7 年齢による再入力の制限', g.locked_until,
         format('%s：%s まで', coalesce(u.username, '(退会)'), to_char(g.locked_until at time zone 'Asia/Tokyo', 'YYYY-MM-DD HH24:MI'))
    from public.translation_age_gate g left join u on u.id = g.user_id
  union all
  select 8, '8 予算（今月）', b.updated_at,
         format('使った額=$%s / 確保中=$%s / 送信=%s 回 / 翻訳済みの再利用=%s 回', b.spent_usd, b.reserved_usd, b.requests, b.cache_hits)
    from public.translation_budget b where b.month = date_trunc('month', now() at time zone 'Asia/Tokyo')::date
)
select section, to_char(at at time zone 'Asia/Tokyo', 'MM-DD HH24:MI:SS') as "日時（日本）", detail
  from s order by ord, at desc nulls last;
