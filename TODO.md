# Miri TODO

## ソーシャルログイン
- [x] Google ログイン（アプリ側実装済み。Supabase で Google プロバイダを有効化＋Client ID/Secret を設定、Google 側の承認済みリダイレクトURIに `https://<プロジェクトRef>.supabase.co/auth/v1/callback` を登録すれば有効）
- [ ] X（旧Twitter）ログイン（後回し）
- [ ] Facebook ログイン（後回し・メール権限で審査が要る場合あり）
- [ ] Apple ログイン（後回し・有料の Apple Developer 登録 年$99 が必須／設定が複雑。Web公開のみなら必須ではない）

## 決済（Stripe）本格有効化
- [ ] Stripe アカウント作成（まずテストモード）→ `STRIPE_SECRET_KEY`
- [ ] Webhook エンドポイント `https://<本番URL>/api/stripe/webhook`（イベント `checkout.session.completed`）→ `STRIPE_WEBHOOK_SECRET`
- [ ] Supabase `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Vercel に上記＋ `NEXT_PUBLIC_STRIPE_ENABLED=1` を設定 → 再デプロイ
- [ ] `/tokushoho`（特定商取引法ページ）の【 】を実際の事業者情報に記入
- [ ] テストカード `4242 4242 4242 4242` で疎通確認

## 独自ドメイン
- [ ] 正式ローンチ時に独自ドメイン取得（例 `heymiri.app` 等。`miri.app` は取得不可）→ Vercel 接続＋ `NEXT_PUBLIC_SITE_URL` 差し替え＋Supabase URL 更新

## コイン整合性（将来）
- [ ] 完全なサーバー権威化（獲得・消費のすべてをサーバー検証。現状は購入分のみサーバー権威）

## その他
- [ ] i18n：機械翻訳（自動）で当たりが悪い語は `src/lib/i18n.ts` の辞書に正式訳を追加すると優先される
