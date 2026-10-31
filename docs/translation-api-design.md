# 自由回答の翻訳 API 設計（Phase B 案）

状態：**設計のみ・未実装**。外部 API への送信、DB の追加、課金開始は承認後に行う。
SQL 案：`supabase/proposal_content_translations.sql`（未適用。ローカルの PostgreSQL 16 で適用・権限・トリガー・取り消しを確認済み）

## 1. 対象と原則

- Phase B の対象：**公開プロフィールの自由回答**（`profile_book.book` の文字列項目のうち、公開範囲が「未設定」または `public` のもの）。
  - 例：`myBoom`、`motto`、`__questions.3.a`、`__best3.drink.0`、`__monthly.episode`
  - フォロワー限定・非公開の項目、日記・ブログ・コメント・サークルは対象外（Phase C 以降）
- 原文は変更しない。翻訳は `content_translations` に置き、表示を切り替えるだけ。
- **クライアントは文章を送らない**。送るのは「種類・ユーザー名・項目の場所・翻訳先の言語」だけ。原文はサーバーが DB から取り出す。
- 翻訳は**ボタンを押したときだけ**（自動では訳さない）。
- 失敗・予算切れ・停止中は**原文を表示**。

## 2. 処理の流れ（`POST /api/translate`）

```
リクエスト  { kind: "profile_field", owner: "<username>", path: "__questions.3.a", target: "en" }
ヘッダー    Authorization: Bearer <Supabase のアクセストークン>（ログイン必須：回数制限と悪用防止のため）

1. 停止スイッチ：環境変数 TRANSLATION_ENABLED が "true" 以外 → { status: "disabled" }（画面は原文のまま）
2. 入力の検査：kind は許可リスト、path は ^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z0-9_]+){0,3}$、target は 20 言語のどれか
3. ログイン確認：supabaseAdmin.auth.getUser(token)
4. 原文の取り出し＋閲覧権限の確認：rpc('public_profile_field', { target_username, field_path })
     → 公開項目でなければ 0 行 → { status: "unavailable" }（翻訳しない・キャッシュも返さない）
5. キャッシュ：md5(原文) と (kind, owner_id, path, target, hash) で content_translations を検索
     → done / kept があれば返す（count_translation_cache_hit）。※ 4 で毎回公開範囲を確認してから返す
6. 事前判定（API を呼ばない）：
     ・空白・記号・絵文字・数字だけ／1 文字だけ → kept（原文のまま）
     ・翻訳先と同じ言語（例：日本語の文字を含まない文で target が en）→ kept
     ・用語集の「訳さない語」と完全一致（例：Juice=Juice）→ kept
7. 予算の確保：rpc('reserve_translation', { p_user, p_estimate_usd })
     → 'disabled' / 'budget' / 'user_limit' なら原文を返す
8. 重複防止：content_translations に status='pending' で INSERT … ON CONFLICT DO NOTHING
     → 入れられなかった（他の人が翻訳中）なら { status: "pending" }（数秒後に再取得）
9. Claude Haiku 5.5 で翻訳（下の「プロンプト」）
10. 検証：JSON として読める／改行の数が同じ／絵文字とデコ記号（[♥] など）が残っている／
     kept_terms が訳文にそのまま含まれる／ローマ字化していない → だめなら status='failed'（原文を表示）
11. 保存（done / kept / failed）と精算：rpc('settle_translation', 見込み額, 実額, 入力・出力トークン)
12. 返す前にもう一度 4 と同じ確認（翻訳中に非公開へ変わった場合に返さない）
```

返り値：`{ status: "done" | "kept" | "original" | "pending" | "disabled" | "budget" | "unavailable", text?: string, keptTerms?: string[] }`

### 画面
- 翻訳できる項目の下に小さく「翻訳を見る」（閲覧者の言語が日本語以外で、原文に日本語が含まれるときだけ）
- 押すと訳文に切り替え、「AI による翻訳 · 原文を見る」を表示。もう一度で原文へ
- `kept` のときは「この語句は原文のままです」と出し、原文を表示

## 3. Claude Haiku 5.5 の呼び出し

- モデル：`claude-haiku-5-5`（環境変数 `TRANSLATION_MODEL` で変更可能）
- `thinking: { type: "disabled" }`、`output_config: { effort: "low", format: { type: "json_schema", … } }`
  （Haiku 5.5 は思考が既定でオン。思考の分も出力料金になるため、翻訳では止める。止められるのは effort が high 以下のとき）
- `max_tokens: 512`
- 出力の形（構造化出力で固定）
  ```json
  { "decision": "translated" | "kept_original", "translation": "…", "kept_terms": ["Juice=Juice"] }
  ```
- system（固定。512 トークン以上になる見込みなのでプロンプトキャッシュが効く）
  - 「{原文の言語} から {翻訳先} へ、ユーザーのプロフィール帳の回答を訳す。訳文だけを JSON で返す」
  - 訳さないもの：人名、@ で始まる ID、アーティスト・グループ名、曲名、作品名（映画・ドラマ・アニメ・漫画・ゲーム）、
    商品名・ブランド名、地名、コミュニティ名。正式な海外名称が広く使われているものだけ置きかえてよい（例：鬼滅の刃 → Demon Slayer）。
    **迷ったら原文のまま**。推測で別の作品名・人名にしない
  - 若者言葉・略語・造語：意味がはっきりしていれば自然な訳、分からなければ `kept_original`
  - ローマ字にしない（翻訳の代わりにしない）。説明や注釈を足さない
  - 改行・絵文字・デコ記号（`[♥]` など）はそのまま残す
- user：`<question>{質問文}</question><answer>{回答}</answer>`
  - 質問文があると「嵐」がアーティストか天気かを判断できる（公式の質問は ID から日本語を取る）
- 用語集：`translation_glossary`（運営が管理。Phase B では JSON ファイルで開始）に一致した語だけを system の末尾に追記

## 4. 費用の試算（Claude Haiku 5.5・公式料金）

公式料金（2026-10 時点、platform.claude.com/docs/en/about-claude/pricing）：
入力 $0.10 / 100万トークン、出力 $0.50 / 100万トークン、キャッシュ読み取り $0.01、キャッシュ書き込み（5分）$0.125。
1 リクエストのプロンプトが 10万トークンを超えると高い料金（Phase B では起こらない大きさ）。

前提（1 回の翻訳）
| 項目 | トークン |
|---|---|
| system（ルール・出力の形） | 700 |
| 質問＋回答＋囲み | 100（回答は平均 25 文字程度） |
| 出力（JSON） | 50 |

| ケース | 1 回の費用 |
|---|---|
| プロンプトキャッシュなし | 800×$0.10/M + 50×$0.50/M = **$0.000105** |
| プロンプトキャッシュあり（読み取り） | 700×$0.01/M + 100×$0.10/M + 50×$0.50/M = **$0.000042** |
| キャッシュ書き込み（5分以上あいたとき） | 700×$0.125/M + 100×$0.10/M + 50×$0.50/M = **$0.000123** |

月の試算（利用が少ない試験運用ではキャッシュが切れやすいので「キャッシュなし」で見積もる）
| 想定 | 翻訳ボタン/月 | 翻訳キャッシュ率 | API 呼び出し | 月額 |
|---|---|---|---|---|
| 小（1日 200 回） | 6,000 | 30% | 4,200 | 約 $0.44 |
| 中（1日 1,000 回） | 30,000 | 40% | 18,000 | 約 $1.89 |
| 目標 $5 で処理できる量 | — | — | 約 47,000 | $5 |
| 上限 $10 で処理できる量 | — | — | 約 95,000 | $10 |

予算の確保は多めに見積もる：入力 1,400 トークン＋出力 512 トークン（max_tokens）＝ **1 回 $0.0004** を確保し、実額で精算。

※ トークン数は Haiku 5.5 のトークナイザーで実測していない推定。比較テストで実測して更新する。応答速度も未計測（比較テストで計測）。

## 5. 上限の守り方（二重）

1. **Miri 側（主）**：`reserve_translation` が月の行をロックし、「確定額＋実行中の見込み額＋今回の見込み額」が上限を超えるなら呼ばない。
   見込み額は最大値で確保するため、Miri の集計上は上限を超えない。上限に達したら新しい翻訳は止まり、翻訳済みのキャッシュは使える。
   停止は `translation_settings.enabled = false`（DB）または環境変数 `TRANSLATION_ENABLED=false`（再デプロイ）。
2. **Anthropic 側（予備）**：翻訳専用のワークスペースを作り、そのワークスペースに月 $10 の支出上限を設定する
   （既定のワークスペースには設定できない）。上限に達すると API は 400（`invalid_request_error`）を返し、Miri は原文を表示する。
   - 制約：上限への到達の判定が請求の集計とどれだけずれるかは公式に明記がない。厳密な上限は Miri 側で守り、Anthropic 側は最後の安全装置とする。
   - 利用状況：Claude Console の Usage ページ（ワークスペース別）と、`translation_budget` テーブル（月別の費用・回数・キャッシュ数）。

## 6. 環境変数

| 名前 | 置き場所 | 内容 |
|---|---|---|
| `ANTHROPIC_API_KEY` | Vercel（サーバーのみ・暗号化） | 翻訳専用ワークスペースのキー。`NEXT_PUBLIC_` を付けない |
| `TRANSLATION_ENABLED` | Vercel | `true` のときだけ新しい翻訳を行う（既定 `false`） |
| `TRANSLATION_MODEL` | Vercel | 既定 `claude-haiku-5-5` |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel（既存） | サーバーが原文・翻訳表を読むため |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel（既存） | — |
| `GOOGLE_CLOUD_PROJECT` / 認証情報 | 比較テストの手元だけ | Google Cloud Translation との比較用。本番には置かない |

月の上限・1 人 1 日の回数は DB（`translation_settings`）で管理し、再デプロイなしで変えられるようにする。

## 7. データの扱い（Anthropic、公式ドキュメントで確認できた範囲）

- API の入力・出力は、明示的な許可なしにモデルの学習に使われない。
- Claude Haiku 5.5 は 30 日保存が必須の「Covered Models」ではない。
- 安全性の自動判定で問題とされた内容は、最長 2 年保存されることがある。
- Batch API は 29 日保存（Phase B では使わない）。
- 標準の保存期間の詳細（privacy.claude.com の商用データ保存ポリシー）は、この作業環境から閲覧できず**未確認**。契約前に確認が必要。
- 送るのは公開項目の文字列と質問文だけ。名前・ID・メールなどは送らない。

プライバシーポリシーには現在、翻訳サービス（外国の事業者を含む）への提供・委託の記載がない。導入前に追記の要否を確認する。

## 8. 比較テスト（Haiku 5.5 と専用翻訳サービス）

- 翻訳エンジンを差し替えられる形にする：
  ```ts
  interface TranslationEngine {
    id: string; // 'claude-haiku-5-5' | 'google-v3' …
    translate(input: { text: string; question?: string; source: Lang; target: Lang; glossary: GlossaryEntry[] }):
      Promise<{ decision: 'translated' | 'kept_original'; text: string; keptTerms: string[]; inputTokens?: number; outputTokens?: number; latencyMs: number }>;
  }
  ```
- テスト用の文：`scripts/translate-eval/cases.json`（短い回答・作品名・人名・若者言葉・略語・改行・絵文字）
- 実行（承認後・手元のみ）：各エンジンで全件を訳し、訳文・判断・応答時間・費用を CSV に出す
- 評価：日本語・英語・中国語・韓国語・タイ語の話者が 1〜5 で採点（正しさ／自然さ／固有名詞の保持／勝手な推測をしていないか）
- 合格の目安：固有名詞の保持 100%、意味が曖昧な短文で「原文のまま」を選べる、平均の自然さ 4 以上

## 9. 段階

- Phase A（実施中）：MyMemory へのユーザー文章の送信停止、固定文言の翻訳キー化、公式のお題の共通 ID
- Phase B（承認後）：SQL 適用 → API とボタン → 試験運用（月 $5 目標・$10 上限）
- Phase C：日記・ブログ・コメント・サークル（公開のもの）。限定公開は権限の設計が完成してから
- そのほか：言語別の表示名（`profiles.display_names jsonb`、本人だけが設定）、公認クリエイターの限定質問や趣味別テンプレートも同じ仕組みで訳す
