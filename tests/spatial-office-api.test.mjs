import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';
import { spaceModel } from './spatial-office-module-loader.mjs';
import * as model from '../lib/spatial-office/model.ts';

const source = ts.transpileModule(readFileSync(new URL('../app/api/spatial-office/handler.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function fixture({ inactive = false, outsider = false, storage = true, role = 'member' } = {}) {
  const writes = [];
  const spaceWrites = [];
  const user = { id: outsider ? 99 : 1, email: 'me@example.com', username: 'Me' };
  const deps = {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '@/lib/clickup/users': { getAuthenticatedUser: async token => { if (token !== 'verified-session') throw new Error('Invalid'); return { user }; } },
    '@/lib/clickup/teams': { getAuthorizedTeams: async () => ({ teams: [{ id: '101', members: [{ user: { id: 1, email: 'me@example.com', username: 'Me' } }] }] }) },
    '@/lib/supabase/rest-client': { supabaseRest: { from: table => ({ select: async () => ({ data: table === 'app_user_roles' ? [{ email: 'me@example.com', status: inactive ? 'inactive' : 'active', role }] : [], error: null }) }) } },
    '@/lib/supabase/admin-rest-client': { isSupabaseAdminConfigured: () => storage, supabaseAdminFetch: async (path, init) => {
      if (init?.method === 'POST') { writes.push(JSON.parse(init.body)); return new Response(null, { status: 204 }); }
      return Response.json([]);
    } },
    '@/lib/spatial-office/model': model,
    '@/lib/spatial-office/space': spaceModel,
    '@/lib/spatial-office/space-store': {
      readOfficeSpace: async (_team, members) => ({ space: spaceModel.normalizeSpace(null, members), ready: storage }),
      mutateOfficeSpace: async (_team, members, mutate) => { const next = mutate(spaceModel.normalizeSpace(null, members)); spaceWrites.push(next); return next; },
    },
  };
  const context = { exports: {}, require: name => { assert.ok(deps[name], `Unexpected dependency ${name}`); return deps[name]; }, crypto: webcrypto, TextEncoder, URL, process: { env: { NODE_ENV: 'production', CLICKUP_WORKSPACE_ID: '101' } } };
  vm.runInNewContext(source, context);
  const request = ({ token = 'verified-session', origin = 'https://office.example', avatar = model.defaultAvatar('1'), id = '99', action = { type: 'claim', slot: 9 } } = {}) => ({
    url: 'https://office.example/api/spatial-office', headers: new Headers({ origin }),
    cookies: { get: key => key === 'clickup_access_token' && token ? { value: token } : { value: 'spoofed-owner' } },
    json: async () => ({ avatar, userId: id }),
    text: async () => JSON.stringify({ ...action, userId: id, isAdmin: true }),
  });
  return { ...context.exports, request, writes, spaceWrites };
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

test('members may claim only their own desk; client userId is ignored', async () => {
  const f = fixture();
  assert.equal((await f.PATCH(f.request())).status, 200);
  assert.equal(f.spaceWrites[0].claims['1'], 9);
  assert.equal(f.spaceWrites[0].claims['99'], undefined);
});
test('ordinary members cannot edit ornaments even with forged admin fields/cookies', async () => {
  const f = fixture();
  const snapshot = await (await f.GET(f.request())).json();
  assert.equal(snapshot.canEditOffice, false);
  assert.equal((await f.PATCH(f.request({ action: { type: 'layout', ornaments: [], layoutRevision: 0 } }))).status, 403);
  assert.equal(f.spaceWrites.length, 0);
});
test('database admin/owner role can edit; stale layout revisions and invalid positions are rejected', async () => {
  for (const role of ['admin', 'owner']) {
    const f = fixture({ role });
    assert.equal((await (await f.GET(f.request())).json()).canEditOffice, true);
    assert.equal((await f.PATCH(f.request({ action: { type: 'layout', ornaments: [], layoutRevision: 0 } }))).status, 200);
    assert.equal(f.spaceWrites[0].layoutRevision, 1);
    assert.equal((await f.PATCH(f.request({ action: { type: 'layout', ornaments: [], layoutRevision: 99 } }))).status, 409);
    assert.equal((await f.PATCH(f.request({ action: { type: 'layout', layoutRevision: 0, ornaments: [{ id: 'plant', asset: 'floor_plant', x: 0, z: 0, rotation: 0, room: 0 }] } }))).status, 409);
    assert.equal(f.spaceWrites.length, 1);
  }
});
test('office mutations reject unauthorized sessions, outside origins and missing storage', async () => {
  for (const [options, input, status] of [[{}, { token: 'fake' }, 401], [{ inactive: true }, {}, 403], [{ outsider: true }, {}, 403], [{ storage: false }, {}, 503], [{}, { origin: 'https://attacker.example' }, 403]]) {
    const f = fixture(options); assert.equal((await f.PATCH(f.request(input))).status, status); assert.equal(f.spaceWrites.length, 0);
  }
});

test('activity is scoped to verified user and invalid destinations never write', async () => {
  const f = fixture();
  assert.equal((await f.PATCH(f.request({ action:{ type:'activity', zone:'garden' }, id:'99' }))).status,200);
  assert.equal(f.spaceWrites[0].activities['1'].zone,'garden');
  assert.equal(f.spaceWrites[0].activities['99'],undefined);
  assert.equal((await f.PATCH(f.request({ action:{ type:'activity', zone:'external' } }))).status,409);
});
test('desk transforms require a database admin role and are checked for collisions', async () => {
  const action={ type:'layout', layoutRevision:0, ornaments:[], desks:[{ slot:0, x:-4.6, z:-2.2, rotation:0 }] };
  const member=fixture(), admin=fixture({ role:'admin' });
  assert.equal((await member.PATCH(member.request({ action }))).status,403);
  assert.equal((await admin.PATCH(admin.request({ action }))).status,200);
  assert.equal(admin.spaceWrites[0].desks[0].x,-4.6);
  assert.equal((await admin.PATCH(admin.request({ action:{ ...action, desks:[{ slot:0,x:0,z:0,rotation:0 }] } }))).status,409);
});
