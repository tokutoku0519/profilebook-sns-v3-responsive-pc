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
