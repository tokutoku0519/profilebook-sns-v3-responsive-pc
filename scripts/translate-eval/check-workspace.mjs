// ============================================================
// 翻訳専用ワークスペースが「米国だけ」に制限されているかを確かめる（運営者が手元で 1 回実行する）
//
//   ANTHROPIC_API_KEY=<翻訳専用ワークスペースのキー> node scripts/translate-eval/check-workspace.mjs --confirm-paid
//   （任意）ANTHROPIC_ADMIN_KEY=<管理キー> ANTHROPIC_WORKSPACE_ID=<wrkspc_...> を足すと、設定そのものも読む
//
// 確かめること（設定したとき・キーを替えたときに 1 回。アプリは毎回の応答で地域とワークスペースを照合するので、毎回の ping はしない）
//  1. inference_geo: "global" を指定した呼び出しが「エラーで断られる」（allowed_inference_geos が ["us"] だけ）
//     → エラーは課金されない。送る文は固定の「ping」
//  2. inference_geo: "us" の呼び出しの応答に usage.inference_geo = "us" が返り、anthropic-workspace-id が分かる
//     → これは課金される（入力・出力とも数トークン。$0.0001 未満）。送る文は固定の「ping」
//  3.（管理キーがあれば）Admin API でワークスペースの data_residency を表示する
// 利用者の文章は送らない。結果がすべて OK になったら、Vercel に TRANSLATION_WORKSPACE_GEO=us と
// TRANSLATION_WORKSPACE_ID=<表示された wrkspc_...> を設定してよい。
// ============================================================
import Anthropic from '@anthropic-ai/sdk';
import { loadEngine } from './load-engine.mjs';
// API キーは画面に出さない（環境変数から読むだけ）

if (!process.argv.includes('--confirm-paid')) {
  console.error('少額の課金（$0.0001 未満）がある確認です。実行してよければ --confirm-paid を付けてください。');
  process.exit(2);
}
const key = process.env.ANTHROPIC_API_KEY;
if (!key) { console.error('ANTHROPIC_API_KEY（翻訳専用ワークスペースのキー）を設定してください'); process.exit(2); }

const { config } = await loadEngine();
const cfg = { ...config.translationConfig({ ...process.env, TRANSLATION_ENABLED: 'true', NEXT_PUBLIC_SUPABASE_URL: 'x', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'x' }) };
const client = new Anthropic({ apiKey: key, maxRetries: 0, timeout: 15_000 });
const results = [];
const ok = (label, pass, detail = '') => { results.push({ label, pass, detail }); console.log(`${pass ? 'OK ' : 'NG '} ${label}${detail ? ` — ${detail}` : ''}`); };

// 1. global を断るか（allowed_inference_geos に global がない）
try {
  const r = await client.messages.create({ model: cfg.model, max_tokens: 1, inference_geo: 'global', messages: [{ role: 'user', content: 'ping' }] }).withResponse();
  ok('global を指定した呼び出しが断られる（ワークスペースが米国だけに制限されている）', false, `通ってしまった：workspace=${r.workspace_id} inference_geo=${r.data.usage.inference_geo}`);
} catch (e) {
  const geoErr = e instanceof Anthropic.APIError && e.status === 400 && /geo/i.test(e.message);
  ok('global を指定した呼び出しが断られる（ワークスペースが米国だけに制限されている）', geoErr, e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : String(e));
}

// 2. us の応答に inference_geo = us・ワークスペースの ID
let workspaceId = null;
try {
  const r = await client.messages.create({ model: cfg.model, max_tokens: 5, inference_geo: 'us', thinking: { type: 'disabled' }, messages: [{ role: 'user', content: 'ping' }] }).withResponse();
  workspaceId = r.workspace_id ?? null;
  ok('us を指定した応答の usage.inference_geo が us', r.data.usage.inference_geo === 'us', `inference_geo=${r.data.usage.inference_geo} / request-id=${r.request_id ?? ''} / model=${r.data.model}`);
  ok('応答のワークスペースの ID が分かる（Default Workspace ではないこと）', /^wrkspc_/.test(workspaceId ?? ''), `anthropic-workspace-id=${workspaceId}`);
  if (process.env.ANTHROPIC_WORKSPACE_ID) ok('応答のワークスペースが ANTHROPIC_WORKSPACE_ID と同じ', workspaceId === process.env.ANTHROPIC_WORKSPACE_ID);
} catch (e) {
  ok('us を指定した呼び出しが成功する', false, e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : String(e));
}

// 3. 管理キーがあれば、ワークスペースの設定を読む（data_residency：workspace_geo・allowed_inference_geos・default_inference_geo）
if (process.env.ANTHROPIC_ADMIN_KEY && process.env.ANTHROPIC_WORKSPACE_ID) {
  const r = await fetch(`https://api.anthropic.com/v1/organizations/workspaces/${process.env.ANTHROPIC_WORKSPACE_ID}`, {
    headers: { 'x-api-key': process.env.ANTHROPIC_ADMIN_KEY, 'anthropic-version': '2023-06-01' },
  });
  const j = await r.json().catch(() => ({}));
  const dr = j.data_residency ?? null;
  console.log('ワークスペースの設定（data_residency）:', JSON.stringify(dr));
  ok('Admin API：保存の地域が us', JSON.stringify(dr ?? {}).includes('"us"'), JSON.stringify(dr));
} else {
  console.log('（管理キーなし：Console の Settings → Workspaces → 翻訳専用ワークスペースで、Workspace geo = US と Allowed inference geos = US だけ、を目で確認してください）');
}

const allOk = results.every((r) => r.pass);
console.log(allOk
  ? `\n✅ 米国だけに制限されています。Vercel に TRANSLATION_WORKSPACE_GEO=us と TRANSLATION_WORKSPACE_ID=${workspaceId} を設定してよい状態です。`
  : '\n❌ 制限が確認できません。TRANSLATION_WORKSPACE_GEO・TRANSLATION_WORKSPACE_ID は設定しないでください。');
process.exit(allOk ? 0 : 1);
