import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';
import * as model from '../lib/spatial-office/model.ts';

const source = ts.transpileModule(readFileSync(new URL('../app/api/spatial-office/handler.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function fixture({ inactive = false, outsider = false, storage = true } = {}) {
  const writes = [];
  const user = { id: outsider ? 99 : 1, email: 'me@example.com', username: 'Me' };
  const deps = {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '@/lib/clickup/users': { getAuthenticatedUser: async token => { if (token !== 'verified-session') throw new Error('Invalid'); return { user }; } },
    '@/lib/clickup/teams': { getAuthorizedTeams: async () => ({ teams: [{ id: '101', members: [{ user: { id: 1, email: 'me@example.com', username: 'Me' } }] }] }) },
    '@/lib/supabase/rest-client': { supabaseRest: { from: table => ({ select: async () => ({ data: table === 'app_user_roles' ? [{ email: 'me@example.com', status: inactive ? 'inactive' : 'active' }] : [], error: null }) }) } },
    '@/lib/supabase/admin-rest-client': { isSupabaseAdminConfigured: () => storage, supabaseAdminFetch: async (path, init) => {
      if (init?.method === 'POST') { writes.push(JSON.parse(init.body)); return new Response(null, { status: 204 }); }
      return Response.json([]);
    } },
    '@/lib/spatial-office/model': model,
  };
  const context = { exports: {}, require: name => { assert.ok(deps[name], `Unexpected dependency ${name}`); return deps[name]; }, crypto: webcrypto, TextEncoder, URL, process: { env: { NODE_ENV: 'production', CLICKUP_WORKSPACE_ID: '101' } } };
  vm.runInNewContext(source, context);
  const request = ({ token = 'verified-session', origin = 'https://office.example', avatar = model.defaultAvatar('1'), id = '99' } = {}) => ({
    url: 'https://office.example/api/spatial-office', headers: new Headers({ origin }),
    cookies: { get: key => key === 'clickup_access_token' && token ? { value: token } : { value: 'spoofed-owner' } },
    json: async () => ({ avatar, userId: id }),
  });
  return { ...context.exports, request, writes };
}
test('avatar writes derive ownership from verified token, ignoring client identity', async () => {
  const f = fixture(); const response = await f.PUT(f.request());
  assert.equal(response.status, 200);
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].key, 'spatial-avatar:101:1');
  assert.equal(f.writes[0].value.userId, undefined);
});
test('unverified sessions, inactive accounts and outsiders cannot save', async () => {
  for (const [options, input, status] of [[{}, { token: 'fake' }, 401], [{ inactive: true }, {}, 403], [{ outsider: true }, {}, 403]]) {
    const f = fixture(options); assert.equal((await f.PUT(f.request(input))).status, status); assert.equal(f.writes.length, 0);
  }
});
test('cross-origin and invalid avatar submissions are rejected before writes', async () => {
  const f = fixture();
  assert.equal((await f.PUT(f.request({ origin: 'https://attacker.example' }))).status, 403);
  assert.equal((await f.PUT(f.request({ avatar: { model: 'external' } }))).status, 400);
  assert.equal(f.writes.length, 0);
});
test('unavailable storage returns an explicit failure and never reports saved', async () => {
  const f = fixture({ storage: false });
  assert.equal((await f.PUT(f.request())).status, 503);
  const snapshot = await (await f.GET(f.request())).json();
  assert.equal(snapshot.avatarStorage, false);
  assert.equal(snapshot.viewerId, '1');
  assert.equal(f.writes.length, 0);
});
