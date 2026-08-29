# Miri TODO

---
## 🔧 セットアップ待ち（あなたの作業＝コード外／キー・設定）
コードは実装済み。以下は Vercel / Supabase / Cloudflare / Stripe 側の設定で有効化するもの。

### ① テスト公開の基本（最優先）
- [ ] Vercel: Deployment Protection → **Vercel Authentication を OFF**（一般公開）
- [ ] Vercel: 短い本番エイリアス（例 `miriapp.vercel.app`）を Production に割当
- [ ] Vercel env: `NEXT_PUBLIC_SITE_URL=https://miriapp.vercel.app` / `NEXT_PUBLIC_APP_ENV=production` / `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` → 再デプロイ
- [ ] Supabase: Authentication → URL Configuration（Site URL ＋ Redirect URLs `https://miriapp.vercel.app/**`）
- [ ] Supabase: `supabase/schema.sql` を実行（`feedback`・`perception_votes` テーブル・`profiles.titles`・`__choices` 保存に必要。再実行してもデータは消えない）

### ② Google ログイン
- [ ] Google Cloud: OAuth クライアント作成 → Client ID / Secret、承認済みリダイレクトURI `https://<Ref>.supabase.co/auth/v1/callback`、同意画面を Publish
- [ ] Supabase: Authentication → Google を ON ＋ Client ID/Secret 貼付

### ③ Cloudflare Turnstile（ボット対策・ドメイン不要）
- [ ] Cloudflare → Turnstile でウィジェット作成（Hostname に `miriapp.vercel.app`）→ Site/Secret Key
- [ ] Vercel env: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` → 再デプロイ

### ④ 決済（Stripe）本格有効化
- [ ] Stripe（テストモード）: `STRIPE_SECRET_KEY`、Webhook `https://<本番URL>/api/stripe/webhook`（`checkout.session.completed`）→ `STRIPE_WEBHOOK_SECRET`
- [ ] Supabase `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Vercel env: 上記＋ `NEXT_PUBLIC_STRIPE_ENABLED=1` → 再デプロイ
- [ ] `/tokushoho`（特商法ページ）の【 】を実際の事業者情報に記入
- [ ] テストカード `4242 4242 4242 4242` で疎通確認

### ⑤ 独自ドメイン＋Cloudflare WAF/DDoS（ローンチ時）
- [ ] 独自ドメイン取得（例 `heymiri.app`。`miri.app` は取得不可）
- [ ] Cloudflare にサイト追加 → DNS を Vercel へ（`CNAME → cname.vercel-dns.com`、初回グレー雲で検証→発行後オレンジ雲）
- [ ] Cloudflare: SSL/TLS を **Full (Strict)**、Bot Fight Mode / WAF / Rate limiting を設定
- [ ] Vercel Firewall で **Cloudflare 以外の直接アクセスを制限**（オリジンバイパス対策）
- [ ] `NEXT_PUBLIC_SITE_URL` と Supabase Auth URL を独自ドメインに更新

### ⑥ Creator Kit（営業前）
- [ ] `/creator-kit` の問い合わせ先メール・Figma/Canva テンプレのリンクを実値に差し替え

---
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

## 企業コラボ（Miri Creator Kit）
- [x] Creator Kit 紹介ページ `/creator-kit`（※問い合わせ先メール・Figma/Canvaテンプレのリンクは要記入）
- [x] フェーズ2：ブランド枠（`brandCampaigns.ts`）＋「🤝 コラボ」画面
- [ ] フェーズ3：提出ポータル＋審査UI（Supabase提出テーブル＋Storageアップロード＋管理画面で承認→即公開）※ブランド数が増えたら
- [ ] Figma/Canva の素材テンプレ本体（スタンプ512×512 / 背景1080×1920 / 質問カード）を作成・配布

## 将来のバージョンアップで追加したい機能（未着手・アイデア段階）
- [ ] **脳内メーカー的なもの**：ユーザー名や回答から「頭の中」を言葉/絵文字で埋めた画像を生成する遊び。既存の共有カード（Canvas）基盤と相性が良い。SNS拡散フック。
- [ ] **シール帳機能**：課金/無料でもらったシールを自分のボードに自由に貼り付け、他の人からも見られる。どうぶつの森の島／ポケモン的に「自分の世界観」を共有できる。既存のスタンプ所持（`STICKER_PACKS`/所持データ）とプロフィールに接続する想定。
- [ ] **二択クイズ演出（100人に聞きました風）**：『ともだちコレクション』の「100人に聞きました」的な二択クイズ演出。みんなの回答の多数派を当てる遊び。既存のお題／選択式回答（select型）データと相性が良い。集計→ドラムロール→結果発表の演出をつけたい。
- [ ] **親友クイズ（相互プロフ当てクイズ）**：親密度（なかよし度）が上限になった関係の人同士で、相手のプロフィールを当てるクイズ。例：「親友なのに何問わかる？」→ Kokiについて「好きな飲み物は？／行きたい国は？／苦手な食べ物は？／最近ハマってるものは？」など約10問 → 結果「あなたはKokiのことを70%知っていました」→ シェア → 「○○はあなたのことを何%知ってる？」へ相互に誘導。既存の親密度/フレンド関係＋プロフ項目＋共有カード基盤に接続する想定。バズ・相互送客フックとして強い。
- [ ] **毎日のお題の回答割合＆ランキング（翌日発表）**：その日のお題の回答を集計し、割合とランキングを翌日に投稿。例：8/16「子供の頃、一番好きだったお菓子は？」→ 翌日「1位 ねるねるねるね／2位 たまごっちグミ／3位 コアラのマーチ …」。既存のデイリーお題＋回答データを集計。※ある程度ユーザーが増えてから（母数が必要）。集計バッチ or 集計クエリ＋結果表示面が要る。
- [x] **他己紹介アンケート（性格）v1**：相手のプロフィールで性格を「みんなで投票」して教えてあげる仕組みを実装（`perception_votes` テーブル／投票UI／集計表示／自分のプロフに「みんなが選ぶわたしの性格」）。※有効化には `supabase/schema.sql` の再実行が必要（`perception_votes` 追加）。
- [ ] **他己紹介アンケート（口ぐせ・チャームポイント等・自由記述）**：他人が「〇〇が言いがち」等を自由記述で投稿→本人承認で掲載する仕組み。承認フロー＋不適切投稿対策（通報/非表示）が必要なので次段。性格v1（投票）と同じ `perception` 基盤に、自由記述＋承認カラムを足す想定。
- [ ] **プロフ項目の重複整理（すきなもの単体 ↔ BEST3）**：`好きな食べ物/テレビ/音楽/漫画/ゲーム/趣味`（単体1つ）が BEST3（食べ物/テレビ/アーティスト/漫画・本/ゲーム/趣味）とかぶっている。単体欄は「色・教科・苦手・キャラ」などBEST3にしにくいものだけ残し、かぶる分野はBEST3へ一本化する。※既存データの移行に注意（単体→BEST3の1位へ寄せる等）。
- [ ] **GIFを所定の位置に置くと絵文字（スタンプ）に追加される仕組み**：指定フォルダ（例 `public/stickers/` 等）にGIF画像を入れるだけで、アプリのスタンプ／絵文字ピッカーに自動で追加される仕組み。素材の追加運用をコード変更なしで回せるようにする。既存のスタンプ基盤（`STICKER_PACKS`／`RetroEmoji`／リアクション・スタンプピッカー）に接続する想定。実装案：①ビルド時に所定フォルダを走査してスタンプ一覧を自動生成（マニフェスト化）、または②Supabase Storage にアップロードしたGIFを一覧取得してピッカーへ。アニメGIFの表示対応（`<img>`）、サイズ・命名規則、カテゴリ分け、企業コラボ枠（Creator Kit）のスタンプ配布とも共通化できると良い。

- [x] **プロフ項目ごとの公開範囲 v1（表示上）**：名前・出身地など項目ごとに「公開／フォロワー限定／非公開」を設定（編集画面「🔒 公開設定」）。表示側で閲覧者との関係（フォロー有無）に応じて出し分け。`book.__visibility` に保存。※現状は"表示上の出し分け"で、完全秘匿ではない（下記v2）。
- [ ] **プロフ公開範囲 v2（本当の秘匿）**：非公開/フォロワー限定の項目を公開テーブル（`profiles.book`）から分離し、サーバー側で閲覧権限を判定して返す（RLSや専用API）。現状はクライアント表示制御のため、APIを直接叩けば読めてしまう点の解消。

### 趣味別サブプロフ ＆ オーディエンス別出し分け（マルチプロフィール）
背景：昔のTwitterは趣味ごとにアカウントを使い分けていた（音楽／ゲーム／スポーツ等）が、使い分けが面倒。1アカウント内で「趣味ごとのサブプロフ」を持てるようにし、相手によって出し分けたい。
- [ ] **趣味用サブプロフ（1アカウント複数プロフ帳）**：通常プロフとは別に、趣味テーマごとのサブプロフ帳を複数作れる（例：野球観戦用／アイドル応援用）。データは `profiles.book` とは別テーブル（例 `sub_profiles`：owner_id・テーマ名・タグ・book(jsonb)・公開範囲）に持たせる想定。
- [ ] **オーディエンス別の出し分け**：閲覧者の属性（興味タグ・フォロー文脈・所属サークル等）に応じて、見せるサブプロフを切り替える。例：野球好きには野球観戦プロフ、アイドル好きにはアイドル応援プロフ。実装案＝各サブプロフに「対象タグ」を付け、閲覧者の興味タグとマッチしたものを表示／本人が手動で「この人にはこれを見せる」を選べるモードも。プライバシー設計（誰にどれを見せたか）に注意。
- [ ] **サブプロフの発見動線（フォロー外にも）**：フォロワー内で見せ合うだけでなく、趣味タグ単位の「新着プロフィール」としてフォロー外にも露出（＝同じ趣味の新しい人と出会う導線）。既存の検索／おすすめユーザー基盤に、趣味タグでの新着フィードを追加する想定。

### 期間限定「別プロフ帳」イベント
- [ ] **期間限定イベント用プロフ帳**：初期設定の通常プロフとは別に、イベント期間だけ作れる特別なプロフ帳（お題・テンプレがイベント仕様）。参加すると**特別な背景・絵文字などの報酬**がもらえる。既存の背景ガチャ／スタンプ所持・称号・`brandCampaigns`（イベント枠）基盤と接続。実装＝イベント定義（期間・テンプレ・報酬）＋参加状態＋報酬付与。企業コラボ（Creator Kit）ともつなげられる。

### 心理テスト ＆ 他己評価の集計可視化
- [ ] **他己評価の集計を円グラフでプロフ内表示**：性格・口ぐせなどを他人が評価（基本は自由記述）→ 似た意見をまとめて集計し、自分のプロフィール内で**円グラフ等で可視化**。既存の他己紹介v1（`perception_votes` の投票集計）の発展形。自由記述の名寄せ（表記ゆれの集約）とグラフ表示面が要る。
- [ ] **心理テスト機能（MBTI／ラブタイプ等）**：設問に答えると結果タイプが出る心理テストをアプリ内に用意し、結果をプロフィールに表示・シェアできる。例：MBTI風16タイプ、恋愛タイプ診断など。既存の一致率しんだん（二択）UI・共有カード基盤と相性が良い。設問セット＋判定ロジック＋結果表示/シェアが要る。バズ・拡散フックとして強い。

## その他
- [ ] i18n：機械翻訳（自動）で当たりが悪い語は `src/lib/i18n.ts` の辞書に正式訳を追加すると優先される
