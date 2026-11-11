# Anthropic：米国限定の翻訳専用ワークスペースの作り方と運用

- この手順は**まだ実行していません**。有料の呼び出しは、追加の承認をいただいてから行います。
- 公式ドキュメントで確認したこと（platform.claude.com。2026-11-11 に原文で確認）
  - Data residency
    - `inference_geo` は `"us"` か `"global"`（既定は global）。`"us"` は料金 1.1 倍。
    - 応答の `usage.inference_geo` に、実際に推論した地域が入る。
    - Workspace geo は作成のときに決め、あとから変えられない。いまは `"us"` だけ。
    - ワークスペースの `allowed_inference_geos` にない地域を指定した呼び出しは、エラーになる。
    - `default_inference_geo` は、指定を省いたときの地域。
    - これらは Console か Admin API の `data_residency` で設定する。
  - Workspaces
    - すべての応答に `anthropic-workspace-id` ヘッダーが付く。
    - ワークスペース単位のキーは、そのワークスペースの中でしか使えない。
    - ワークスペースの上限は **Workspaces の画面 → Spend limits**（Default Workspace には設定できない）。
    - ワークスペースを archive すると、そのキーはすべて数秒で無効になる（元に戻せない）。
  - Usage and Cost Analytics API
    - `GET /v1/organizations/analytics/usage`・`/cost`（beta、管理キーが必要）。
    - `group_by[]=inference_geo`・`workspace_id`・`api_key_id` で集計できる。
    - データは通常 4 時間以内（最長 24 時間）に反映。

---

## 1. ワークスペースを作る（Workspace geo の確認）

| # | 画面 | 操作 |
|---|---|---|
| 1 | https://platform.claude.com/settings/workspaces | **Create workspace** |
| 2 | Create workspace | 名前 `miri-translation`。**Workspace geo が US** であることを確認して作成（あとから変えられない） |
| 3 | ワークスペースの一覧 | 作ったワークスペースの ID（`wrkspc_...`）を控える |

## 2. 推論の地域を米国に限る（allowed_inference_geos・default_inference_geo）

| # | 画面 | 操作 |
|---|---|---|
| 1 | Workspaces → `miri-translation` を選ぶ → 設定の画面（Data residency） | **Allowed inference geos：US だけ**（Global のチェックを外す） |
| 2 | 同じ画面 | **Default inference geo：US** |
| 3 | 保存 | ― |

画面の名前は、ドキュメントの「Console で設定できる」という記載から書いたものです。実際の表示は未確認なので、違っていれば画面の表示に合わせてください。

管理キー（Admin API key）をお持ちなら、設定を API で読むこともできます。管理キーは強い権限があるので、作らなくても進められます。

## 3. 翻訳専用の API キーを発行する

| # | 画面 | 操作 |
|---|---|---|
| 1 | https://platform.claude.com/settings/keys（API keys） | **Create key** |
| 2 | Workspace | **`miri-translation` を選ぶ**（Default を選ばない） |
| 3 | 名前 | `miri-translation-staging-YYYYMMDD`（用途と日付が分かる名前） |
| 4 | 有効期限を設定できる場合 | テスト用は 30 日など短く |
| 5 | 表示されたキー | **その場で 4 章の場所に保存**（あとから再表示できない） |

## 4. API キーを安全に保存する

| 置き場所 | 方法 | してはいけないこと |
|---|---|---|
| パスワード管理アプリ（1Password・Bitwarden など） | 元の 1 か所として保存 | チャット・メール・メモアプリ・スクリーンショットに貼る |
| Vercel | **Settings → Environment Variables** → `ANTHROPIC_API_KEY` を追加。Environment は **Preview だけ**、Git Branch を指定、**Sensitive** をオン | Production に入れる（本番の有効化は別途承認） |
| 手元の PC（スクリプトの実行時だけ） | ターミナルで `read -s ANTHROPIC_API_KEY && export ANTHROPIC_API_KEY`（画面に出ない・履歴に残らない） | `.env` ファイルをリポジトリに置く・コマンドに直接書く |
| Git・Issue・PR | 置かない | ― |

- アプリはキーをサーバーの中でだけ使い、ブラウザには送りません（ビルド前の検査 `check:no-external-translate` で確認）。
- ログにもキーを出しません。

## 5. 予算と使用量の監視

| 何を | どこで | 設定・見方 |
|---|---|---|
| ワークスペースの月の上限 | Workspaces → `miri-translation` → **Spend limits** | テスト中は Console で設定できる最小の額（$1 など）。通知のしきい値も設定する。最小額は未確認 |
| アプリの上限（もう 1 段） | Vercel の `TRANSLATION_MONTHLY_CAP_USD` と DB の `translation_settings.monthly_cap_usd` | テスト中は `0.10` |
| 使用量（画面） | Console の **Usage**・**Cost**（ワークスペースで絞り込み） | 1 日 1 回見る |
| 使用量（アプリの記録） | 検証用 DB で `select * from public.translation_budget;` | 見込み額で先に確保し、実額で精算する |
| 地域ごとの使用量 | Usage and Cost Analytics API の `group_by[]=inference_geo&workspace_ids[]=wrkspc_...`（管理キーが必要・任意） | `us` 以外が 0 であること |

## 6. inference_geo の実測（3 段階）

1. **設定のあと 1 回**：`scripts/translate-eval/check-workspace.mjs --confirm-paid`（$0.0001 未満）。
   - `global` を指定した呼び出しが断られることを確かめる（エラーなので課金なし）。
   - `us` の応答の `usage.inference_geo = "us"` と、`anthropic-workspace-id` を確かめる。
   - 表示されたワークスペースの ID を、Vercel の `TRANSLATION_WORKSPACE_ID` に入れる。
2. **比較テストの全件**：`run-eval.mjs` が、すべての応答の地域とワークスペースを照合する。1 件でも違えば、その場で止まる。
3. **アプリの毎回の応答**：
   - `usage.inference_geo` と `anthropic-workspace-id` を照合する。
   - 違えば訳文を使わず、送った事実を記録し（`geo_mismatch` / `workspace_mismatch`）、翻訳を自動で止める。
   - 結果は検証用 DB の `translation_provision_log.reported_geo` と `translation_send_log.workspace_id` に残る。

### 毎回の ping はやめました
以前の実装は、1 時間ごと（サーバーの起動ごと）に `global` を指定した確認の呼び出しをしていました。これをやめ、余分な API の呼び出しをなくしました。代わりに次の 4 つで、米国以外での推論を防ぎ、検出します。

| 層 | 何をするか | 防ぐ・見つけるもの |
|---|---|---|
| ① ワークスペースの制限 | `allowed_inference_geos = ["us"]`。ほかの地域の指定は API がエラーにする | 米国以外での推論（設定で防ぐ） |
| ② リクエストでの指定 | 毎回 `inference_geo: "us"` | 既定の global での推論 |
| ③ 応答の地域の確認 | 毎回 `usage.inference_geo = "us"` | ①②が効かなかった場合（結果を使わず停止） |
| ④ 応答のワークスペースの確認 | 毎回 `anthropic-workspace-id = TRANSLATION_WORKSPACE_ID` | 別のワークスペースのキーの取り違え（①が効かない状態）を検出して停止 |

ping は「①が設定されているか」を送る前に確かめるものでした。①は設定のときに 1 回確かめれば変わりません。③④は毎回の応答で無料で確かめられるので、ping がなくても安全性は下がらないと判断しました。

残る弱点：④は応答を受け取ってから気づくので、取り違えたキーで送った最初の 1 件は送られてしまいます（記録には残ります）。これは、キーを Vercel に入れるときに check-workspace で確かめる運用で防ぎます。

## 7. テスト後のキーの停止・ローテーション

| 場面 | 操作 |
|---|---|
| テストが終わった | Console の API keys → `miri-translation-staging-...` → **Disable**（または Delete）。Vercel の Preview の `ANTHROPIC_API_KEY` も削除 |
| キーが漏れたかもしれない | ① すぐに Console でそのキーを Disable ② 検証用 DB で `update public.translation_settings set enabled = false;` ③ Console の Usage で、そのキーの使用量に心当たりのないものがないか見る ④ 新しいキーを発行して入れ替え |
| 定期的な入れ替え（本番の運用後。例：90 日ごと） | ① 新しいキーを同じワークスペースで発行 ② Vercel の値を新しいキーに替えて再デプロイ ③ アプリが動くこと（送信の記録が completed）を確かめる ④ 古いキーを Disable |
| 管理キーでの停止（任意） | Admin API の `api_keys.update(<key id>, status="inactive")` |
| ワークスペースごと使わなくなった | Workspaces → archive（そのワークスペースのキーはすべて無効になる。元に戻せない） |
