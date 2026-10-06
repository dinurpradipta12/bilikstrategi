import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOfficeMembers, reconcileSeats, officePath, deskPosition, DESKS_PER_ROOM } from '../lib/spatial-office/model.ts';

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
  const stations = Array.from({ length: 10 }, (_, slot) => deskPosition(slot));
  assert.equal(new Set(stations.map(d => d.x)).size, 5);
  for (let pair = 0; pair < 5; pair++) {
    assert.equal(stations[pair * 2].x, stations[pair * 2 + 1].x);
    assert.equal(stations[pair * 2].rotation, 0);
    assert.equal(stations[pair * 2 + 1].rotation, Math.PI);
  }
  assert.equal(stations[2].x - stations[0].x, 1.4);
});
test('entry and exit corridors never cross the communal table', () => {
  for (let slot = 0; slot < DESKS_PER_ROOM; slot++) {
    const path = officePath(slot);
    assert.deepEqual(officePath(slot, true), [...path].reverse());
    for (let segment = 1; segment < path.length; segment++) {
      const [a, b] = [path[segment - 1], path[segment]];
      assert.ok(Math.abs(a[0]-b[0])<1e-6 || Math.abs(a[1]-b[1])<1e-6, 'corridors are axis aligned');
      for (let step = 0; step <= 20; step++) {
        const x = a[0] + (b[0] - a[0]) * step / 20;
        const z = a[1] + (b[1] - a[1]) * step / 20;
        assert.ok(Math.abs(x) > 3.7 || Math.abs(z) > 1, 'walk outside table plus body clearance');
      }
    }
  }
});

test('pantry follows accumulated work across reload, pause and resume', async () => {
  const { memberZone, workedSeconds } = await import('../lib/spatial-office/model.ts');
  const now = 1800000000000;
  const member = buildOfficeMembers(roster, [{ user_id: '1', check_in_timestamp: now - 60000, accumulated_seconds: 840 }])[0];
  assert.equal(workedSeconds(member, now), 900);
  assert.equal(memberZone(member, now - 1), 'desk');
  assert.equal(memberZone(JSON.parse(JSON.stringify(member)), now), 'pantry');
  assert.equal(memberZone(member, now + 60000), 'desk');
  assert.equal(memberZone({ ...member, status: 'paused' }, now), 'exit');
  assert.equal(memberZone({ ...member, status: 'offline' }, now), 'exit');
  assert.equal(workedSeconds({ ...member, status: 'paused' }, now + 900000), 840);
});
test('all zone routes and rapid reversals stay in corridors and use partition doors', async () => {
  const { zonePosition, travelPath } = await import('../lib/spatial-office/model.ts');
  for (let slot = 0; slot < DESKS_PER_ROOM; slot++) {
    for (const source of ['desk', 'lounge', 'pantry']) {
      for (const target of ['desk', 'lounge', 'pantry']) {
        const origin = zonePosition(slot, source), end = zonePosition(slot, target);
        let from = [origin.x, origin.z];
        const path = travelPath(slot, from, target);
        if (source !== target) assert.deepEqual(path.at(-1), [end.x, end.z]);
        for (const point of path) {
          assert.ok(Math.abs(point[0] - from[0]) < 1e-6 || Math.abs(point[1] - from[1]) < 1e-6);
          for (let step = 0; step <= 10; step++) {
            const x = from[0] + (point[0] - from[0]) * step / 10, z = from[1] + (point[1] - from[1]) * step / 10;
            assert.ok(Math.abs(x) > 3.7 || Math.abs(z) >= 1.15, 'route must clear shared workbench');
            if (Math.abs(x - 6) < 0.02) assert.ok(Math.abs(z - 0.5) < 0.7 || Math.abs(z - 3.8) < 0.7, 'cross partition only at door');
            const reverse = travelPath(slot, [x, z], source);
            assert.deepEqual(reverse.at(-1) || [x, z], [origin.x, origin.z]);
          }
          from = point;
        }
      }
    }
  }
});
test('typing hands touch the supplied keyboard with either desk orientation', async () => {
  const { typingHand, KEYBOARD_TOP, AVATAR_SCALE, deskPosition } = await import('../lib/spatial-office/model.ts');
  for (const slot of [0, 1]) for (const index of [0, 1]) for (const tap of [-0.015, 0, 0.015]) {
    const [x, y, z] = typingHand(index, 0.15, tap), desk = deskPosition(slot);
    assert.ok(Math.abs((z + 0.15 - 0.15) * AVATAR_SCALE - KEYBOARD_TOP) < 1e-10, 'bottom of hand touches key surface');
    const zWorld = desk.seatZ - y * AVATAR_SCALE * Math.cos(desk.rotation);
    assert.ok(Math.abs(zWorld - (desk.z - 0.27 * Math.cos(desk.rotation))) < 1e-10);
    assert.ok(Math.abs(x * AVATAR_SCALE) + 0.17 * AVATAR_SCALE < 0.265, 'hands fit on keyboard');
  }
});
test('bubble rotation uses assigned tasks and cannot invent completion', async () => {
  const { memberTasks, bubbleLabel } = await import('../lib/spatial-office/model.ts');
  const tasks = memberTasks(roster[0], [
    { task_name: 'Design header', status: 'in_progress', assignee_ids: ['1'] },
    { task_name: 'Review brief', status: 'in_review', raw_data: { assignee_emails: ['alya@example.com'] } },
    { task_name: 'Someone else', status: 'in_progress', assignee_ids: ['2'] },
    { task_name: 'Already done', status: 'completed', assignee_ids: ['1'] },
  ]);
  assert.deepEqual(tasks.map(task => task.name), ['Design header', 'Review brief']);
  const member = { id: '1', name: 'Alya', status: 'working', project: 'Website', tasks };
  const labels = Array.from({ length: 9 }, (_, i) => bubbleLabel(member, 'desk', i * 11000));
  assert.equal(new Set(labels).size, 9);
  assert.ok(labels.some(label => label.includes('Design header')));
  assert.ok(labels.every(label => !label.includes('Someone else') && !label.includes('Already done')));
});
test('avatar accepts only supplied models and palette and strips arbitrary identity fields', async () => {
  const { defaultAvatar, parseAvatar } = await import('../lib/spatial-office/model.ts');
  const avatar = defaultAvatar('1');
  assert.deepEqual(parseAvatar({ ...avatar, userId: 'someone-else' }), avatar);
  assert.equal(parseAvatar({ ...avatar, model: '../external.glb' }), null);
  assert.equal(parseAvatar({ ...avatar, shirtColor: 'url(external)' }), null);
});
