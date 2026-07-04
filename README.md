# プロフィール帳SNS MVP

平成プロフィール帳 × シール帳 × SNS のWebアプリ雛形です。
現時点ではモックデータで6画面を切り替えられる状態です。
次のステップでSupabase認証・DB保存を接続します。

## 開き方

```bash
npm install
npm run dev
```

ブラウザで以下を開きます。

```txt
http://localhost:3000
```

## Supabaseを使う場合

1. Supabaseで新規プロジェクトを作成
2. `supabase/schema.sql` をSQL Editorで実行
3. `.env.example` を `.env.local` にコピー
4. SupabaseのURLとAnon Keyを入れる

```bash
cp .env.example .env.local
```

※ すでにschema.sqlを実行済みのプロジェクトは、schema.sql内の
「▼ 追加分: お問い合わせ & 退会」セクション以降だけをSQL Editorで再実行してください。

## 退会（アカウント削除）

- 設定画面（プロフィール編集）最下部の「アカウント」セクションから退会できます
- 確認モーダルで「退会」と入力すると、`delete_account()` RPC（security definer）が
  `auth.users` から本人のみを削除し、プロフィール・回答・フォロー等は外部キーの
  cascadeで連鎖削除されます
- 退会理由アンケート（任意・匿名）は `account_deletion_feedback` テーブルに保存されます

## お問い合わせ

- `/contact` ページから送信できます（ログイン不要。ログイン中はメール自動入力＆履歴表示）
- 送信内容は `inquiries` テーブルに保存されます（RLSにより本人のみ閲覧可能）
- 運営はSupabaseのTable Editorで `status`（open / in_progress / resolved / closed）と
  `admin_reply` を更新すると、ユーザーの `/contact` 画面の履歴に返信が表示されます

## 画面

- ホーム
- さがす
- 投稿
- プロフィール帳
- 回答詳細
- マイページ

PCで開くと左側の「画面切り替え」から各画面を確認できます。
スマホ幅で見ると実際のスマホWebアプリに近い見え方になります。

## 技術構成

- Next.js
- React
- TypeScript
- Tailwind CSS
- Supabase接続準備済み
