# Miri セキュリティ状況（テスト公開向け）

Moltbook 事件（Supabase の anon key ＋ RLS 不足で全件読み書き取り放題）を教訓に、
同種の穴を点検・対応した記録。

## 結論
Moltbook の致命傷（①RLS が無い ②service_role 級の鍵がブラウザにある）は **Miri には無い**。
- 全 20 テーブルで RLS 有効。書き込みは基本「自分の行のみ」。
- 危険な鍵（`SUPABASE_SERVICE_ROLE_KEY` / `STRIPE_SECRET_KEY` / `TURNSTILE_SECRET_KEY`）は
  サーバー専用（`supabaseAdmin` / API ルートのみ）。ブラウザに出るのは anon key のみ（公開前提・RLS で守る設計）。
- Stripe Webhook は署名検証＋金額サーバー再計算＋冪等。XSS 面は `dangerouslySetInnerHTML`/`eval` 無しで低い。

## 対応済み（このコミット）
- **称号・公認バッジ・権限列の自己改ざん防止（DB層・回避不能）**
  - `profiles` に BEFORE UPDATE トリガー `protect_profile_privileged` を追加。
    一般ユーザー（authenticated）は `is_official` / `titles` を変更しても旧値に戻る。
    変更できるのは service_role（サーバー）と SQL Editor のみ。
  - 「先駆者」称号はサインアップ時トリガーで自動付与＋既存ユーザーはバックフィル（サーバー権威化）。
    クライアントからの titles 書き込み（旧 `grantPioneerIfEligible`）は廃止。
  - → anon key を直叩きしても「偽の公認アカウント」「偽の称号」を作れない。
- **他人のプロフィール book をアプリ経由で渡す際にサニタイズ**（`getProfileByUsername`）
  - 内部・機微キー（`__game`＝コイン/`__purchases`/`__choices`）と、非公開/フォロワー限定指定の
    項目を除去してから返す。

> ⚠️ 有効化には Supabase SQL Editor で `supabase/schema.sql` の再実行が必要（トリガー追加・バックフィル）。

## 残（要対応・データモデル変更やインフラ設定が必要／今回は未実施）
1. **プロフィール book の DB 直叩き読み取り**（教訓1・2の残り／最優先）
   - 現状 `profiles readable using(true)` のため、anon key で API を直接叩けば他人の生 `book`
     （非公開指定の項目含む）を取得可能。アプリ経由はサニタイズ済みだが、直叩きは防げていない。
   - 恒久対策：`book`（少なくとも `__game`/`__purchases`/`__choices` と非公開項目）を
     **self-only RLS の別テーブルへ分離**し、公開分は SECURITY DEFINER 関数/ビューで返す。
     ＝読み取り経路の書き換えを伴う中規模の移行。
2. **コインのサーバー権威化**（教訓の経済整合性）
   - 現状は獲得/消費がクライアント権威で、ユーザーが自分の `book.__game.coins` を直叩きで改変可能
     （自分の残高のみ・他人やデータ流出には無関係）。購入分のみサーバー権威（Webhook）。
   - 恒久対策：獲得/消費もサーバー検証（上記 book 分離とセットが自然）。
3. **UGC モデレーション**（法務・テイクダウン）
   - 通報・ブロック・管理削除・サーバー側 NG 判定が無い（NG ワードはクライアントのみ＝回避可能）。
   - 対策：`reports` テーブル＋通報ボタン＋管理フラグ／非表示。
4. **レート制限**（スパム/DoS）
   - 投稿・投票・通知・フィードバックに制限なし。通知は他人宛に量産可能。
   - 対策：Edge Middleware or DB トリガーでの頻度制限、通知の自己宛制限。
5. **アクセス監視（教訓5）**
   - アプリ側のアクセスログ無し。Supabase の Auth/API ログを有効化し、公開後 1 週間は毎日確認
     （知らないアクセス元・深夜の大量取得・1 人が全員分を取得、等）。
6. **フォロワー限定回答が実質公開**
   - RLS `answers readable using (visibility <> 'private' or ...)` のため followers 指定も読める。
7. **画像を data URI で DB 保存**（肥大・帯域・DoS）→ Supabase Storage へ。

## 法務（有料化・一般公開の前に）
- **特商法表記**：`/tokushoho` の【 】を実事業者情報に（有料コイン販売の法定表示・必須）。
- **未成年課金**：年齢確認・保護者同意・課金上限（未成年契約は取消可能）。
- **プライバシーポリシー整合**：全 book 公開の実態と開示のズレ、収集項目・第三者提供の記載確認。
- **規約同意の取得導線**：サインアップ時の明示同意。
- **アップロード画像の権利**（著作権・肖像権）＋削除フロー。

## 自分でできる Moltbook テスト
アカウント A・B を作り、B で一部を「非公開」に設定 → A のブラウザ DevTools で
`supabase.from('profiles').select('book').eq('username','<Bのid>')` を直接実行。
B の非公開項目が返ってきたら「残1」の状態（＝book 分離で塞ぐ）。
