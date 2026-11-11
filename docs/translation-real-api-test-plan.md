# 実 API テストの詳しい計画（予算の上限 $0.10・追加の承認後に実行）

- 対象：Claude Haiku 5.5（`claude-haiku-5-5`）。推論は米国内（`inference_geo: "us"`、料金は標準の 1.1 倍）。
- **実際の呼び出しは、承認をいただいてから**行います。いまは手順とスクリプトの準備だけです。
- 送るのは架空の文だけです。利用者の文章、本番のデータは使いません。

## 1. 予算の割り当て（合計 $0.10 以下）

| 段階 | 内容 | 上限 | 見込み | 止め方 |
|---|---|---|---|---|
| 0 | ワークスペースの確認（`check-workspace.mjs`） | ― | $0.0001 未満（「ping」2 回。うち 1 回はエラーで課金なし） | ― |
| 1 | 比較テスト（`run-eval.mjs --max-usd 0.06`） | $0.06 | $0.02〜0.05（24 文 × 4 言語 = 96 件。1 件 約 $0.0002〜0.0005） | スクリプトが実額を足し上げて止める |
| 2 | 検証用の環境でアプリを通した確認 | $0.03 | $0.01 以下（20〜40 件） | アプリの上限 `TRANSLATION_MONTHLY_CAP_USD=0.03`、DB の `monthly_cap_usd = 0.03` |
| 予備 | ― | $0.01 | ― | ― |
| 最後の歯止め | Anthropic のワークスペースの月の上限（Spend limits） | Console で設定できる最小の額 | ― | Anthropic が API をエラーにする |

> 1 件の見込み：入力 約 1,300 トークン（そのうち system の約 1,000 はキャッシュが効けば 1/10）× $0.11/100 万 ＋ 出力 約 50 トークン × $0.55/100 万。
> アプリは最大の額（出力 400 トークン）で先に確保するので、少なく数えることはありません。

## 2. 段階 0：ワークスペースの確認

```
read -s ANTHROPIC_API_KEY && export ANTHROPIC_API_KEY
node scripts/translate-eval/check-workspace.mjs --confirm-paid
```

| 合格の条件 | 不合格なら |
|---|---|
| global の指定が「地域」に関するエラーで断られる | Allowed inference geos を US だけにする（`docs/anthropic-workspace-setup.md` 2 章） |
| us の応答の `usage.inference_geo` が `us` | 先に進まない（Anthropic に問い合わせ。request-id を控える） |
| 応答の `anthropic-workspace-id` が `wrkspc_...`（作ったワークスペース） | キーを作り直す（Default Workspace のキーになっている） |

## 3. 段階 1：比較テスト

```
export ANTHROPIC_WORKSPACE_ID=wrkspc_...   # 段階 0 で表示された ID
node scripts/translate-eval/run-eval.mjs --confirm-paid --max-usd 0.06
```

- 本番と同じエンジン・プロンプト・検証・個人情報のチェックを、アプリのコードからそのまま読み込みます。
- 結果は `scripts/translate-eval/results/<日時>.md` と `.json` に出ます。Git には入れません。共有するときは `.md` だけにしてください。

| 見ること | 合格の目安 |
|---|---|
| すべての応答の地域が us・ワークスペースが同じ（allUs・allInWorkspace） | 100%（1 件でも違えばスクリプトが止まる） |
| 固有名詞を残す・正式名に置きかえる（Juice=Juice、鬼滅の刃 → Demon Slayer など） | 100% |
| あいまいな短い文で「原文のまま」を選ぶ（keptOriginalWhenExpected） | 5 件中 4 件以上 |
| 検証の失敗（改行・絵文字・デコ記号・長さ） | 0〜2 件 |
| 実額が見込み額以下（costWithinEstimate） | すべて |
| 応答時間 | 中央値 2 秒以内・95% が 5 秒以内 |
| 人の採点（正しさ・自然さ 1〜5） | 日本語 → 英語の自然さが平均 4 以上 |

## 4. 段階 2：検証用の環境でアプリを通した確認

### 前提
- 検証用 Supabase の準備が済んでいる（`docs/staging-supabase-setup.md`）。
- Vercel の Preview（このブランチだけ）に、次を設定して再デプロイする。
  - 検証用 Supabase の 3 つの値
  - `NEXT_PUBLIC_DB_LABEL=staging`
  - `TRANSLATION_STORE=db`
  - `TRANSLATION_ENGINE=anthropic`
  - `TRANSLATION_ALLOW_PAID=true`
  - `ANTHROPIC_API_KEY`
  - `TRANSLATION_WORKSPACE_GEO=us`
  - `TRANSLATION_WORKSPACE_ID=wrkspc_...`
  - `TRANSLATION_MONTHLY_CAP_USD=0.03`
- 検証用の SQL Editor で `update public.translation_settings set enabled = true, monthly_cap_usd = 0.03;`。

### 確認項目（正常系と異常系）

| # | 分類 | 操作 | 期待 | 記録で確かめること |
|---|---|---|---|---|
| 1 | 正常 | alice：マイページ → 内容を確認して許可（項目を選ぶ・1996 年 4 月・同意） | 「許可しています」 | `translation_consent_events`：grant・`age_band = '18_plus'`・生年月の列なし |
| 2 | 正常 | bob（英語）：alice のプロフ帳 → Show translation | 訳文と「AIによる翻訳」の表示 | `translation_provision_log`：completed・`reported_geo = 'us'`。`translation_send_log`：request-id・ワークスペース |
| 3 | 正常 | carol：同じ項目を表示 | 翻訳済みを表示 | 送信の記録が増えない |
| 4 | 連絡先 | alice の charmPoint（架空の電話番号）を翻訳対象にして、bob が表示 | その文は原文のまま。「一部は翻訳していません」 | 送信の記録が増えない。alice の同意画面に理由 |
| 5 | 他人の非公開 | carol のトークンで `/api/translate` に alice の非公開の回答 ID を送る（ブラウザの開発者ツール、または `curl`） | `original` | 送信の記録なし |
| 6 | 公開範囲の変更 | alice が dream を「フォロワー限定」に → carol が翻訳を頼む → 公開に戻す → もう一度 | どちらも原文のまま（選び直すまで） | `translation_item_permissions` から dream が消える |
| 7 | 同意の撤回 | alice が取り消す → bob が翻訳を頼む | 原文のまま | キャッシュ 0 件・revoke の記録・それまでの送信の記録は残る |
| 8 | 撤回と送信が同時 | 2 つのブラウザで、bob の「翻訳を見る」と alice の「取り消す」をほぼ同時に押す | 訳文は保存されない（表示されても再読み込みで消える） | 送信の記録は「送信の直前に許可があった」もの（consent_event_id つき）だけ |
| 9 | 年齢 | dave：生年月に 15 歳になる年月 | 「16歳未満のため…」。続けて大人の年でも 7 日間は許可できない | `translation_age_gate` に 1 行（生年月なし） |
| 10 | 年齢の回避 | dave のトークンで `grant_consent` に `ageConfirmed16: true` だけを送る | 400 | ― |
| 11 | 権限外 | ログインなし・他人のトークンで `/api/translate`（grant_consent など）・`/api/account-deletion` | 401。他人の申請は見えない | ― |
| 12 | 権限外 | ブラウザの anon key で、Supabase の REST API から `translation_provision_log` を読む | 権限なしのエラー | ― |
| 13 | API の失敗 | Vercel の `ANTHROPIC_API_KEY` を一時的に無効な文字列にして再デプロイ → bob が翻訳 | 原文のまま | 送信の記録：error_response（401）。翻訳は止まらない（キーを戻せば再開） |
| 14 | 予算 | 上限 $0.03 に達するまで、いくつかの言語で翻訳を頼む（または `monthly_cap_usd` を 0.0005 に） | 上限で新しい翻訳が止まり、翻訳済みは表示 | `translation_budget` の確定額＋呼び出し中 ≦ 上限 |
| 15 | 停止 | `enabled = false` | 新しい送信はすぐ止まる | 送信の記録が増えない |
| 16 | 退会 | alice：退会・データ削除を申請 → 運営者が Authentication で alice を削除 | 「受付中」→ 削除後、翻訳・許可は消える | 法定の記録・申請の記録は残る（user_id は空） |
| 17 | 版の変更 | `CONSENT_VERSION` を上げたプレビューをデプロイ | 「説明が更新されました」。確認し直すまで翻訳しない | ― |
| 18 | 地域・ワークスペースの不一致 | （実 API では起こせないので、モックで確認済み） | 訳文を使わず停止・記録は残る | ― |

### 段階 2 のあとに見る SQL（検証用 DB）
```sql
select outcome, reported_geo, count(*) from public.translation_provision_log group by 1, 2;                -- すべて us・completed など
select p.sent_at, p.outcome, s.request_id, s.workspace_id, s.error_code, s.latency_ms
  from public.translation_provision_log p left join public.translation_send_log s on s.provision_id = p.id order by p.sent_at desc limit 50;
select * from public.translation_budget;                                                                  -- 実額
select enabled, halted_reason from public.translation_settings;                                           -- 止まっていないか
```
Anthropic の Console の Usage（`miri-translation` で絞り込み）の件数・金額と、アプリの記録が合っていることも確かめます。反映には最長 24 時間かかります。

## 5. 中止の条件（その場で止めて報告する）
- 地域が us でない応答、ワークスペースが違う応答が 1 件でもあった（アプリは自動で止まる）。
- 実額が見込み額を超えた。
- 個人情報のチェックで止まるはずの文が送られた。
- 他人の非公開の内容が送られた・表示された。
- Console の使用量とアプリの記録が大きく食い違う。

## 6. テストのあと
- Vercel の Preview から `ANTHROPIC_API_KEY`・`TRANSLATION_ALLOW_PAID` を外す。
- Console でテスト用のキーを Disable にする（`docs/anthropic-workspace-setup.md` 7 章）。
- 検証用 DB は残してよい（架空のデータだけ）。不要ならプロジェクトごと削除する。
- 結果（比較テストの `.md`、上の SQL の結果）を共有いただければ、本番の有効化の判断材料にまとめます。
