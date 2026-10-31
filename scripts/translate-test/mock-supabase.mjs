// ============================================================
// 翻訳テスト用の Supabase の代わり（HTTP サーバー。ブラウザとアプリのサーバーの両方から使う）
//
// 本物と同じ判定を再現するもの：
//  ・get_visible_book（supabase/security_patch_A.sql と同じ：本人は全部／内部キーは除く／private は除く／
//    followers はフォロワーだけ。トークンなし＝ログインしていない人）
//  ・answers の読み取り RLS（public／本人／followers はフォロワーだけ）
//  ・profile_book は本人だけ
// アクセストークンは署名なしの JWT（sub＝ユーザー ID）。auth/v1/user はその sub のユーザーを返す。
// テスト用の操作：POST /__test/book {username, book} ・ POST /__test/answer {id, patch} ・ GET /__test/writes
// ============================================================
import http from 'node:http';

export const IDS = {
  alice: 'aaaaaaaa-0000-4000-8000-000000000001',
  bob: 'bbbbbbbb-0000-4000-8000-000000000002',
  carol: 'cccccccc-0000-4000-8000-000000000003',
  dave: 'dddddddd-0000-4000-8000-000000000004',
  erin: 'eeeeeeee-0000-4000-8000-000000000005',
};
export const ANSWER_IDS = {
  public: '11111111-0000-4000-8000-000000000001',
  followers: '11111111-0000-4000-8000-000000000002',
  private: '11111111-0000-4000-8000-000000000003',
};

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
export function tokenFor(userId) {
  const exp = Math.floor(Date.now() / 1000) + 86400;
  return `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub: userId, role: 'authenticated', exp, aud: 'authenticated' })}.sig`;
}
export function sessionFor(userId, email = 'test@example.com') {
  const exp = Math.floor(Date.now() / 1000) + 86400;
  return { access_token: tokenFor(userId), token_type: 'bearer', expires_in: 86400, expires_at: exp, refresh_token: 'r', user: { id: userId, aud: 'authenticated', role: 'authenticated', email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } };
}

export function defaultBooks() {
  return {
    alice: {
      name: '山田ありす', nickname: 'ありす', catchphrase: 'よろしくね', message: '平成のプロフ帳が大好きです',
      motto: 'なんとかなる', dream: 'パン屋さん in Paris', specialty: '指パッチン', hometown: '大阪',
      wantToGo: 'ヨーロッパ', collection: '香水', charmPoint: '？', favoriteFood: '揚げパン',
      __questions: [{ q: '好きな季節は？', a: '夏🍉 花火大会が最高' }, { q: '好きな芸能人は？', a: 'Juice=Juice' }, { q: '好きなアニメは？', a: '鬼滅の刃' }],
      __best3: { drink: ['ミルクティー', '', ''] },
      __visibility: { motto: 'followers', hometown: 'private', dream: 'public' },
      __game: { coins: 500 }, __purchases: ['pi_x'], __choices: { time: 'a' },
    },
    bob: { nickname: 'Bob', message: 'Hello from Bob' },
    carol: {}, dave: {}, erin: {},
  };
}

export function startMockSupabase(port) {
  const now = new Date().toISOString();
  const state = {
    profiles: Object.keys(IDS).map((u) => ({ id: IDS[u], username: u, display_name: u === 'alice' ? 'ありす先生' : u, avatar_url: null, is_official: false, titles: [], updated_at: now })),
    books: defaultBooks(),
    follows: [{ follower_id: IDS.bob, following_id: IDS.alice }],
    answers: [
      { id: ANSWER_IDS.public, user_id: IDS.alice, question_key: 'd1', question_title: '小学校の給食で好きだったものは？', question_category: '子ども・平成', body: '揚げパンがいちばん好きだった', sticker: null, visibility: 'public', created_at: now },
      { id: ANSWER_IDS.followers, user_id: IDS.alice, question_key: 'd2', question_title: '休みの日は？', question_category: '価値観', body: 'ずっと寝てる', sticker: null, visibility: 'followers', created_at: now },
      { id: ANSWER_IDS.private, user_id: IDS.alice, question_key: 'd3', question_title: '秘密は？', question_category: '価値観', body: 'ないしょ', sticker: null, visibility: 'private', created_at: now },
    ],
    writes: [],
  };
  const userByName = (n) => state.profiles.find((p) => p.username === n);
  const viewerOf = (req) => {
    const h = req.headers.authorization || '';
    const tok = h.startsWith('Bearer ') ? h.slice(7) : '';
    try { const p = JSON.parse(Buffer.from(tok.split('.')[1] || '', 'base64url').toString()); return p.sub || null; } catch { return null; }
  };
  const isFollower = (viewer, owner) => state.follows.some((f) => f.follower_id === viewer && f.following_id === owner);
  // supabase/security_patch_A.sql の get_visible_book と同じ判定
  const visibleBook = (username, viewer) => {
    const p = userByName(username);
    if (!p) return {};
    const b = state.books[username] || {};
    if (viewer === p.id) return b;
    const vis = b.__visibility || {};
    const out = {};
    for (const k of Object.keys(b)) {
      if (['__game', '__purchases', '__visibility'].includes(k)) continue;
      if (vis[k] === 'private') continue;
      if (vis[k] === 'followers' && !(viewer && isFollower(viewer, p.id))) continue;
      out[k] = b[k];
    }
    return out;
  };
  const canReadAnswer = (a, viewer) => a.visibility === 'public' || a.user_id === viewer || (a.visibility === 'followers' && viewer && isFollower(viewer, a.user_id));
  // PostgREST の簡単なフィルター（eq / neq / in）
  const filt = (rows, params) => rows.filter((r) => {
    for (const [k, v] of params) {
      if (['select', 'order', 'limit', 'offset', 'or'].includes(k)) continue;
      const m = /^(eq|neq|in)\.(.*)$/.exec(v);
      if (!m) continue;
      const val = r[k] == null ? '' : String(r[k]);
      if (m[1] === 'eq' && val !== m[2]) return false;
      if (m[1] === 'neq' && val === m[2]) return false;
      if (m[1] === 'in' && !m[2].replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, '')).includes(val)) return false;
    }
    return true;
  });

  const server = http.createServer(async (req, res) => {
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-headers', '*');
    res.setHeader('access-control-allow-methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS,HEAD');
    res.setHeader('access-control-expose-headers', 'content-range');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    const url = new URL(req.url, `http://localhost:${port}`);
    const p = url.pathname;
    let body = '';
    for await (const c of req) body += c;
    const json = (s, b) => { res.writeHead(s, { 'content-type': 'application/json', 'content-range': '0-0/0' }); res.end(b === undefined ? '' : JSON.stringify(b)); };
    const single = (req.headers.accept || '').includes('vnd.pgrst.object');
    const send = (rows) => (single ? (rows[0] ? json(200, rows[0]) : json(406, { code: 'PGRST116', message: 'no rows' })) : json(200, rows));
    const viewer = viewerOf(req);

    if (p === '/__test/book') { const b = JSON.parse(body); state.books[b.username] = b.book; return json(200, {}); }
    if (p === '/__test/answer') { const b = JSON.parse(body); Object.assign(state.answers.find((a) => a.id === b.id), b.patch); return json(200, {}); }
    if (p === '/__test/writes') return json(200, state.writes);
    if (p === '/__test/reset') { state.books = defaultBooks(); return json(200, {}); }

    if (p === '/auth/v1/user') {
      const u = state.profiles.find((x) => x.id === viewer);
      return u ? json(200, sessionFor(u.id).user) : json(401, { message: 'invalid token' });
    }
    if (p === '/auth/v1/token') return json(200, sessionFor(IDS.bob));
    if (p.startsWith('/auth/v1/')) return json(200, {});

    if (req.method !== 'GET' && req.method !== 'HEAD' && p.startsWith('/rest/v1/') && !p.startsWith('/rest/v1/rpc/get_visible_book')) state.writes.push({ m: req.method, p, body });

    if (p === '/rest/v1/rpc/get_visible_book') return json(200, visibleBook(JSON.parse(body || '{}').target, viewer));
    if (p === '/rest/v1/profiles' && req.method === 'GET') {
      // 本物の profiles には book 列もある（移行前の名残）。ここでは公開分だけを入れておく
      return send(filt(state.profiles, url.searchParams).map((r) => ({ ...r, book: visibleBook(r.username, viewer) })));
    }
    if (p === '/rest/v1/profile_book' && req.method === 'GET') {
      const me = state.profiles.find((x) => x.id === viewer);
      return send(me ? [{ id: me.id, book: state.books[me.username] || {} }] : []);
    }
    if (p === '/rest/v1/answers' && req.method === 'GET') {
      const rows = filt(state.answers.filter((a) => canReadAnswer(a, viewer)), url.searchParams);
      return send(rows);
    }
    if (req.method === 'GET' || req.method === 'HEAD') return send([]);
    return json(201, undefined);
  });
  return new Promise((ok) => server.listen(port, () => ok({ server, state, close: () => new Promise((d) => server.close(d)) })));
}
