import test from 'node:test';
import assert from 'node:assert/strict';
import { spaceModel as space, loadTS } from './spatial-office-module-loader.mjs';
import { travelPath, zonePosition } from '../lib/spatial-office/model.ts';
const members = [{ id: '1' }, { id: '2' }, { id: '3' }];

test('ownership survives reload/reordering and roster removal frees only that desk', () => {
  let current = space.normalizeSpace(null, members);
  assert.equal(space.spaceCapacity(current, members.length), 10);
  current = space.claimDesk(current, '1', 9, members.length);
  assert.equal(current.claims['1'], 9);
  assert.equal(current.claims['2'], 1);
  assert.throws(() => space.claimDesk(current, '2', 9, 3), /sudah dimiliki/);
  assert.throws(() => space.claimDesk(current, '1', 10, 3), /tidak tersedia/);
  assert.throws(() => space.claimDesk(current, 'outsider', 8, 3), /bukan anggota/);
  const restored = space.normalizeSpace(JSON.parse(JSON.stringify(current)), [...members].reverse());
  assert.equal(restored.claims['1'], 9);
  assert.equal(restored.claims['2'], 1);
  const removed = space.normalizeSpace(restored, [{ id: '1' }, { id: '3' }, { id: '4' }]);
  assert.equal(removed.claims['1'], 9);
  assert.equal(removed.claims['3'], 2);
  assert.equal(removed.claims['4'], 0);
  assert.equal(removed.claims['2'], undefined);
});
test('11+ users receive additional areas without overlapping claims', () => {
  const people = Array.from({ length: 25 }, (_, i) => ({ id: String(i) }));
  const current = space.normalizeSpace(null, people);
  assert.equal(space.spaceCapacity(current, 25), 30);
  assert.equal(new Set(Object.values(current.claims)).size, 25);
});
test('ornaments allow saved garden/interior placement and reject walls, corridors and invalid assets', () => {
  assert.doesNotThrow(() => space.parseOrnaments(space.DEFAULT_ORNAMENTS, 1));
  const plant = { id: 'plant', asset: 'floor_plant', x: 15, z: -3, rotation: 0, room: 0 };
  assert.doesNotThrow(() => space.parseOrnaments([plant], 1));
  for (const patch of [{ x: 0, z: 0 }, { x: 6, z: 0.5 }, { x: 5, z: 3 }, { x: 50 }, { asset: '__proto__' }, { rotation: Infinity }, { room: 1 }]) {
    assert.throws(() => space.parseOrnaments([{ ...plant, ...patch }], 1));
  }
  assert.throws(() => space.parseOrnaments([plant, { ...plant, id: 'other' }], 1), /bertabrakan/);
  assert.throws(() => space.parseOrnaments([plant, plant], 1), /tidak valid/);
});
test('moving from any desk to another routes through aisles, including after mid-walk reversal', () => {
  for (let fromSlot = 0; fromSlot < 10; fromSlot++) for (let slot = 0; slot < 10; slot++) {
    const a = zonePosition(fromSlot, 'desk'), end = zonePosition(slot, 'desk');
    const path = travelPath(slot, [a.x, a.z], 'desk', fromSlot);
    if (fromSlot !== slot) assert.deepEqual(path.at(-1), [end.x, end.z]);
    let from = [a.x, a.z];
    for (const to of path) {
      assert.ok(Math.abs(from[0] - to[0]) < 1e-6 || Math.abs(from[1] - to[1]) < 1e-6);
      const midpoint = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
      assert.ok(Math.abs(midpoint[0]) > 3.7 || Math.abs(midpoint[1]) >= 1.15);
      const reversed = travelPath(fromSlot, midpoint, 'desk', slot);
      assert.deepEqual(reversed.at(-1) || midpoint, [a.x, a.z]);
      from = to;
    }
  }
});
function storeFixture(initial = null) {
  let row = initial ? structuredClone(initial) : null;
  const api = {
    isSupabaseAdminConfigured: () => true,
    supabaseAdminFetch: async (path, init) => {
      // Yield to interleave independent callers, just as network reads do.
      await Promise.resolve();
      if (!init?.method) return Response.json(row ? [{ value: structuredClone(row) }] : []);
      const next = JSON.parse(init.body).value;
      if (init.method === 'POST') {
        if (row) return Response.json([]);
        row = next; return Response.json([{ value: row }]);
      }
      const expected = Number(new URL(`https://db.example/${path}`).searchParams.get('value->>revision').slice(3));
      if (row.revision !== expected) return Response.json([]);
      row = next; return Response.json([{ value: row }]);
    },
  };
  return { ...loadTS('../lib/spatial-office/space-store.ts', { '@/lib/supabase/admin-rest-client': api, './space': space }), state: () => row };
}
test('simultaneous claims for one desk have exactly one winner (new and existing row)', async () => {
  for (const initial of [null, space.normalizeSpace(null, members)]) {
    const store = storeFixture(initial);
    const outcomes = await Promise.allSettled(['1', '2'].map(id => store.mutateOfficeSpace('team', members, current => space.claimDesk(current, id, 9, 3))));
    assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(Object.values(store.state().claims).filter(slot => slot === 9).length, 1);
  }
});
test('independent simultaneous claims both persist after conflict retry', async () => {
  const store = storeFixture(space.normalizeSpace(null, members));
  const outcomes = await Promise.allSettled([['1', 8], ['2', 9]].map(([id, slot]) => store.mutateOfficeSpace('team', members, current => space.claimDesk(current, id, slot, 3))));
  assert.ok(outcomes.every(result => result.status === 'fulfilled'));
  assert.equal(store.state().claims['1'], 8); assert.equal(store.state().claims['2'], 9);
});
test('layout save and desk claim preserve each other during concurrent updates', async () => {
  const store = storeFixture(space.normalizeSpace(null, members));
  const updates = await Promise.allSettled([
    store.mutateOfficeSpace('team', members, current => space.claimDesk(current, '1', 9, 3)),
    store.mutateOfficeSpace('team', members, current => ({ ...current, revision: current.revision + 1, layoutRevision: current.layoutRevision + 1, ornaments: [] })),
  ]);
  assert.ok(updates.every(result => result.status === 'fulfilled'));
  assert.equal(store.state().claims['1'], 9); assert.equal(store.state().ornaments.length, 0); assert.equal(store.state().layoutRevision, 1);
});

test('changing desk again before arriving still leaves the original chair through its aisle', () => {
  const original = zonePosition(0, 'desk');
  const secondClaim = travelPath(5, [original.x, original.z], 'desk', 9);
  const first = secondClaim[0];
  assert.equal(first[0], original.x);
  assert.equal(first[1], -2.2);
  const final = zonePosition(5, 'desk'); assert.deepEqual(secondClaim.at(-1), [final.x, final.z]);
});
