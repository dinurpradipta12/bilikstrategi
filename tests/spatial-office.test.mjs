import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOfficeMembers, reconcileSeats, officePath, deskPosition } from '../lib/spatial-office/model.ts';

const roster = [
  { id: '1', name: 'Alya Putri', email: 'alya@example.com', aliases: ['Alya'] },
  { id: '2', name: 'Bima', email: 'bima@example.com' },
];
test('check-in, pause, checkout follow authoritative snapshots', () => {
  assert.deepEqual(buildOfficeMembers(roster, [{ user_name: ' Alya ', selected_project: 'Website', is_paused: false }]).map(m => m.status), ['working', 'offline']);
  assert.equal(buildOfficeMembers(roster, [{ user_email: 'ALYA@example.com', is_paused: true }])[0].status, 'paused');
  assert.deepEqual(buildOfficeMembers(roster, []).map(m => m.status), ['offline', 'offline']);
});
test('identity must match exactly; unknown email never falls back to a name', () => {
  const sessions = [{ user_name: 'Aly' }, { user_email: 'other@example.com', user_name: 'Bima' }];
  assert.ok(buildOfficeMembers(roster, sessions).every(m => m.status === 'offline'));
});
test('duplicate legacy names cannot occupy either desk', () => {
  const duplicate = [...roster, { id: '3', name: 'Alya', email: 'other@example.com' }];
  assert.ok(buildOfficeMembers(duplicate, [{ user_name: 'Alya' }]).every(m => m.status === 'offline'));
});
test('latest duplicate session wins and removed users are absent', () => {
  const result = buildOfficeMembers(roster.slice(0, 1), [
    { user_name: 'Alya', is_paused: false, updated_at: '2026-10-05T02:00:00Z' },
    { user_name: 'Alya', is_paused: true, updated_at: '2026-10-05T03:00:00Z' },
    { user_name: 'Bima', is_paused: false },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].status, 'paused');
});
test('desk stays fixed on checkout, removal, insertion and reordered roster', () => {
  const members = buildOfficeMembers(roster, []);
  const initial = reconcileSeats(new Map(), members);
  const removed = reconcileSeats(initial, members.slice(1));
  assert.equal(removed.get('2'), initial.get('2'));
  assert.equal(removed.has('1'), false);
  const newcomer = { id: '0', name: 'New member', status: 'working', project: '' };
  const next = reconcileSeats(removed, [newcomer, ...members.slice(1)]);
  assert.equal(next.get('2'), initial.get('2'));
  assert.equal(next.get('0'), initial.get('1'));
  assert.deepEqual(reconcileSeats(next, [...members.slice(1), newcomer]), next);
});
test('all members receive unique desks beyond the first room', () => {
  const members = Array.from({ length: 25 }, (_, i) => ({ id: String(i), name: `Member ${i}`, status: 'offline', project: '' }));
  const seats = reconcileSeats(new Map(), members);
  assert.equal(seats.size, 25);
  assert.equal(new Set(seats.values()).size, 25);
});

test('coworking desks join end to end with opposite seats facing inward', () => {
  const stations = Array.from({ length: 6 }, (_, slot) => deskPosition(slot));
  assert.equal(new Set(stations.map(d => d.x)).size, 3);
  for (let pair = 0; pair < 3; pair++) {
    assert.equal(stations[pair * 2].x, stations[pair * 2 + 1].x);
    assert.equal(stations[pair * 2].rotation, 0);
    assert.equal(stations[pair * 2 + 1].rotation, Math.PI);
  }
  assert.equal(stations[2].x - stations[0].x, 1.4);
});
test('entry and exit corridors never cross the communal table', () => {
  for (let slot = 0; slot < 6; slot++) {
    const path = officePath(slot);
    assert.deepEqual(officePath(slot, true), [...path].reverse());
    for (let segment = 1; segment < path.length; segment++) {
      const [a, b] = [path[segment - 1], path[segment]];
      assert.ok(a[0] === b[0] || a[1] === b[1], 'corridors are axis aligned');
      for (let step = 0; step <= 20; step++) {
        const x = a[0] + (b[0] - a[0]) * step / 20;
        const z = a[1] + (b[1] - a[1]) * step / 20;
        assert.ok(Math.abs(x) > 2.35 || Math.abs(z) > 1, 'walk outside table plus body clearance');
      }
    }
  }
});
