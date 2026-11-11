// ============================================================
// 実 API（Claude Haiku 5.5・米国内の推論）を使った少額の比較テスト（承認後に、運営者が手元で実行する）
//
//   ANTHROPIC_API_KEY=<翻訳専用ワークスペースのキー> ANTHROPIC_WORKSPACE_ID=<wrkspc_...> node scripts/translate-eval/run-eval.mjs --confirm-paid [--max-usd 0.10] [--langs en,zh,ko,th]
//
// ・送るのは scripts/translate-eval/cases.json の架空の文だけ（利用者の文章は使わない）
// ・本番と同じエンジン・プロンプト・検証・個人情報のチェックを使う（scripts/translate-eval/load-engine.mjs）
// ・先に check-workspace.mjs で確認したワークスペースの ID（ANTHROPIC_WORKSPACE_ID）を渡す。毎回の応答で地域とワークスペースを照合する
// ・応答の inference_geo が us でなければ、その時点で止める
// ・実額が --max-usd（既定 $0.10）を超えそうなら止める。見込みは 96 件で約 $0.01〜0.05
// ・結果：scripts/translate-eval/results/<日時>.json と .md（訳文・判定・トークン・費用・応答時間）。人の採点欄つき
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { loadEngine } from './load-engine.mjs';

const arg = (name, d) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : d; };
if (!process.argv.includes('--confirm-paid')) { console.error('有料の API を使います。承認を得てから --confirm-paid を付けて実行してください。'); process.exit(2); }
const key = process.env.ANTHROPIC_API_KEY;
if (!key) { console.error('ANTHROPIC_API_KEY を設定してください'); process.exit(2); }
const maxUsd = Number(arg('--max-usd', '0.10'));

const here = path.dirname(new URL(import.meta.url).pathname);
const spec = JSON.parse(fs.readFileSync(path.join(here, 'cases.json'), 'utf8'));
const langs = (arg('--langs', spec.target_langs.join(','))).split(',');
const { engines, config, pii, shared } = await loadEngine();
const wsId = process.env.ANTHROPIC_WORKSPACE_ID;
if (!/^wrkspc_/.test(wsId ?? '')) { console.error('ANTHROPIC_WORKSPACE_ID（check-workspace.mjs で表示された wrkspc_...）を設定してください。1 件も送っていません。'); process.exit(2); }
const cfg = config.translationConfig({ ...process.env, TRANSLATION_ENABLED: 'true', NEXT_PUBLIC_SUPABASE_URL: 'x', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'x', TRANSLATION_WORKSPACE_ID: wsId });
const engine = engines.anthropicEngine(cfg, key);

const rows = [];
let spent = 0;
outer: for (const lang of langs) {
  for (const c of spec.cases) {
    const est = config.estimateUsd(cfg, [...c.answer].length + [...(c.question ?? '')].length);
    if (spent + est > maxUsd) { console.log(`上限 $${maxUsd} に達するので止めます`); break outer; }
    const row = { id: c.id, lang, question: c.question, answer: c.answer, expect: c.expect, note: c.note ?? '' };
    const screened = pii.screenPersonalInfo(c.answer);
    if (!screened.ok) { rows.push({ ...row, status: 'kept_personal', reason: screened.reason }); continue; }
    if (shared.keepWithoutEngine(c.answer)) { rows.push({ ...row, status: 'kept_no_engine' }); continue; }
    const t0 = Date.now();
    const out = await engine.translate({ text: screened.text, context: c.question, source: 'ja', target: lang, glossary: shared.glossaryHits(screened.text) });
    const ms = Date.now() - t0;
    if (out.transport !== 'unknown' && out.workspaceId !== wsId) {
      rows.push({ ...row, status: 'failed:workspace_mismatch', ms, workspaceId: out.workspaceId });
      console.error(`翻訳専用ワークスペース以外（${out.workspaceId}）から応答があったので止めます`); break outer;
    }
    const cost = out.usage ? config.costUsd(cfg, out.usage) : est;
    spent += cost;
    if (!out.ok) {
      rows.push({ ...row, status: `failed:${out.error}`, ms, cost, geo: out.inferenceGeo ?? null, requestId: out.requestId });
      if (out.error === 'geo_mismatch') { console.error('米国以外で処理された応答があったので止めます'); break outer; }
      continue;
    }
    const checked = engines.validateResult(screened.text, out);
    const restored = checked.status === 'done' ? pii.restoreMasked(checked.text, screened.tokens) : null;
    rows.push({ ...row, status: checked.status, problem: checked.problem, text: restored ?? checked.text, keptTerms: out.keptTerms, ms, cost, estimate: est, usage: out.usage, geo: out.inferenceGeo, workspaceId: out.workspaceId, requestId: out.requestId });
    process.stdout.write('.');
  }
}

// 集計
const done = rows.filter((r) => r.ms != null);
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const p95 = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * 0.95))] : 0; };
const keepCases = rows.filter((r) => r.expect === 'keep');
const summary = {
  total: rows.length, called: done.length, spentUsd: Number(spent.toFixed(6)),
  allUs: done.every((r) => r.geo === 'us'),
  allInWorkspace: done.every((r) => r.workspaceId === wsId),
  keptOriginalWhenExpected: `${keepCases.filter((r) => r.status === 'kept' || r.status.startsWith('kept_')).length}/${keepCases.length}`,
  validationFailures: rows.filter((r) => r.status === 'failed').length,
  costWithinEstimate: done.every((r) => r.estimate == null || r.cost <= r.estimate),
  latencyMedianMs: med(done.map((r) => r.ms)), latencyP95Ms: p95(done.map((r) => r.ms)),
};
const outDir = path.join(here, 'results');
fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
fs.writeFileSync(path.join(outDir, `${stamp}.json`), JSON.stringify({ model: cfg.model, inferenceGeo: cfg.inferenceGeo, summary, rows }, null, 2));
const md = [
  `# 翻訳の比較テスト（${cfg.model}・inference_geo=${cfg.inferenceGeo}）`, '',
  '| 項目 | 結果 |', '|---|---|', ...Object.entries(summary).map(([k, v]) => `| ${k} | ${v} |`), '',
  '| id | 言語 | 原文 | 期待 | 結果 | 訳文 | 地域 | ms | $ | 正しさ(1-5) | 自然さ(1-5) |', '|---|---|---|---|---|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.id} | ${r.lang} | ${r.answer.replace(/\n/g, ' ')} | ${r.expect} | ${r.status} | ${(r.text ?? '').replace(/\n/g, ' ').replace(/\|/g, '/')} | ${r.geo ?? ''} | ${r.ms ?? ''} | ${r.cost?.toFixed?.(6) ?? ''} |  |  |`),
].join('\n');
fs.writeFileSync(path.join(outDir, `${stamp}.md`), md);
console.log('\n', summary, `\n結果：scripts/translate-eval/results/${stamp}.md`);
