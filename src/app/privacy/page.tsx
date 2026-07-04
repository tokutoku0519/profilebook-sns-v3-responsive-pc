import type { Metadata } from 'next';
import Link from 'next/link';
import { TERMS_VERSION, TERMS_ENACTED_AT } from '@/lib/terms';

export const metadata: Metadata = {
  title: 'プライバシーポリシー — Miri',
  description: 'Miri（みんなのプロフィール帳SNS）のプライバシーポリシーです。',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] bg-white p-6 shadow-card">
      <h2 className="mb-3 text-base font-black text-ink">{title}</h2>
      <div className="space-y-3 text-sm font-bold leading-7 text-muted">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-base px-4 pb-16 pt-10">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="mb-6 text-center">
          <p className="text-2xl font-black text-ink">プライバシーポリシー</p>
          <p className="mt-1 text-xs font-bold text-muted">
            Miri（みんなのプロフィール帳SNS）
          </p>
        </div>

        <Section title="1. 基本方針">
          <p>
            Miri運営者（以下「当社」といいます）は、当社が提供するサービス「Miri」（以下「本サービス」といいます）における利用者（以下「ユーザー」といいます）の個人情報を、個人情報の保護に関する法律（以下「個人情報保護法」といいます）その他の関係法令・ガイドラインを遵守し、本ポリシーに従って適切に取り扱います。
          </p>
        </Section>

        <Section title="2. 取得する情報">
          <p>当社は、次の情報を取得します。</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>登録情報：メールアドレス、パスワード（暗号化して保存）、ニックネーム、誕生日、その他ユーザーがプロフィール帳に登録した情報</li>
            <li>投稿情報：お題・PR質問への回答、日記、コメント、画像その他ユーザーが投稿したコンテンツ</li>
            <li>利用情報：本サービスの利用履歴（回答履歴、ポイント履歴、閲覧・操作ログ等）</li>
            <li>端末・接続情報：端末の種類、OS、ブラウザの種類、IPアドレス、Cookieその他の識別子</li>
          </ol>
        </Section>

        <Section title="3. 利用目的">
          <p>当社は、取得した情報を次の目的で利用します。</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>本サービスの提供・維持・運営（本人確認、アカウント管理を含みます）</li>
            <li>本サービスの改善、新機能・新サービスの企画・開発</li>
            <li>PR質問（スポンサー企業の依頼による質問）の運営、およびスポンサー企業への広告効果・回答結果の報告</li>
            <li>回答データ等を集計・分析した統計情報・匿名加工情報の作成、ならびに市場調査・マーケティングリサーチ・データリサーチのための利用および第三者への提供</li>
            <li>ポイント等の特典の付与・管理</li>
            <li>お知らせ・キャンペーン等のご案内、お問い合わせへの対応</li>
            <li>利用規約に違反する行為への対応、不正利用の防止</li>
            <li>利用規約・本ポリシーの変更等の通知</li>
          </ol>
        </Section>

        <Section title="4. 第三者提供">
          <ol className="list-decimal space-y-1 pl-5">
            <li>当社は、次の場合を除き、あらかじめ本人の同意を得ることなく、個人データを第三者に提供しません。①法令に基づく場合、②人の生命・身体・財産の保護のために必要で本人の同意を得ることが困難な場合、③その他個人情報保護法が認める場合。</li>
            <li>
              PR質問への回答その他の回答データをスポンサー企業等に提供する場合、当社は原則として、<span className="text-ink">特定の個人を識別できない統計情報または匿名加工情報に加工したうえで</span>提供します。
            </li>
            <li>
              特定の個人を識別できる形式で回答データ等をスポンサー企業等に提供する必要が生じた場合は、提供先・提供する情報の項目等を明示したうえで、あらかじめ本人の同意を取得します。
            </li>
          </ol>
        </Section>

        <Section title="5. 統計情報・匿名加工情報の取扱い">
          <ol className="list-decimal space-y-1 pl-5">
            <li>当社は、回答データ等を集計・分析し、特定の個人を識別できない統計情報を作成して、スポンサー企業その他の第三者（マーケティング・データリサーチを行う企業等を含みます）に提供することがあります。</li>
            <li>当社が匿名加工情報を作成する場合、個人情報保護法および関連規則の定めに従い、①作成する匿名加工情報に含まれる個人に関する情報の項目の公表、②第三者提供時の提供項目・提供方法の公表および提供先への匿名加工情報である旨の明示、③加工方法等に関する情報の安全管理措置、④本人を識別するための照合の禁止、を遵守します。</li>
          </ol>
        </Section>

        <Section title="6. 委託">
          <p>
            当社は、利用目的の達成に必要な範囲で、個人データの取扱いの全部または一部を第三者（クラウドサービス・データベースサービスの提供事業者等を含みます）に委託することがあります。この場合、当社は、委託先を適切に選定し、必要かつ適切な監督を行います。
          </p>
        </Section>

        <Section title="7. 安全管理措置">
          <p>
            当社は、個人データの漏えい、滅失または毀損の防止その他個人データの安全管理のため、アクセス制御、通信の暗号化、パスワードのハッシュ化その他必要かつ適切な措置を講じます。安全管理措置の具体的な内容については、下記のお問い合わせ窓口までご照会ください。
          </p>
        </Section>

        <Section title="8. 保存期間">
          <p>
            当社は、利用目的の達成に必要な範囲で個人データを保存し、退会等により保存の必要がなくなった場合には、法令上保存が義務付けられる場合を除き、遅滞なく消去します。ただし、統計情報・匿名加工情報として加工済みのデータは、特定の個人を識別できないため、引き続き利用することがあります。
          </p>
        </Section>

        <Section title="9. 開示・訂正・利用停止等の請求">
          <p>
            ユーザーは、当社に対し、個人情報保護法の定めに従い、保有個人データの開示、訂正・追加・削除、利用停止・消去、第三者提供の停止、および第三者提供記録の開示を請求することができます。請求を希望される場合は、下記のお問い合わせ窓口までご連絡ください。本人確認のうえ、法令に従い対応します。
          </p>
        </Section>

        <Section title="10. Cookie等の利用">
          <p>
            本サービスは、ログイン状態の維持、利便性の向上、利用状況の把握のためにCookieおよびローカルストレージ等の技術を使用します。ブラウザの設定によりCookieを無効化できますが、その場合、本サービスの一部の機能が利用できなくなることがあります。
          </p>
        </Section>

        <Section title="11. 未成年者の個人情報">
          <p>
            未成年者が本サービスを利用する場合、あらかじめ親権者等の法定代理人の同意を得たうえで、個人情報を提供していただくようお願いします。
          </p>
        </Section>

        <Section title="12. 本ポリシーの改定">
          <p>
            当社は、法令の改正、事業内容の変更等に応じて、本ポリシーを改定することがあります。重要な変更を行う場合は、本サービス上での表示その他適切な方法により周知します。法令上ユーザーの同意が必要となる変更については、あらためて同意を取得します。
          </p>
        </Section>

        <Section title="13. 事業者情報・お問い合わせ窓口">
          <p>
            個人情報の取扱いに関するお問い合わせ・ご請求は、以下の窓口までお願いします。
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>事業者名：Miri運営者【正式な事業者名称を記載してください】</li>
            <li>所在地：【所在地を記載してください】</li>
            <li>お問い合わせ：【メールアドレスまたはフォームURLを記載してください】</li>
          </ul>
        </Section>

        <div className="rounded-[28px] bg-white p-6 text-center shadow-card">
          <p className="text-xs font-bold text-muted">
            {TERMS_ENACTED_AT} 制定（Version {TERMS_VERSION}）
          </p>
        </div>

        <div className="pt-4 text-center">
          <Link href="/terms" className="mr-6 text-sm font-black text-pink">利用規約</Link>
          <Link href="/" className="text-sm font-black text-pink">← Miri にもどる</Link>
        </div>
      </div>
    </main>
  );
}
