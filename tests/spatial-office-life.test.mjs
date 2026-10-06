import test from 'node:test';
import assert from 'node:assert/strict';
import { officeTime, memberZone, bubbleLabel, zonePosition, deskPosition, travelPath } from '../lib/spatial-office/model.ts';
import { spaceModel } from './spatial-office-module-loader.mjs';
const member = { id: 'a', name: 'Alya', status: 'paused', project: 'Website' };
const at = s => Date.parse(s);
test('schedule and timezone decide lounge/bedroom; active overtime is preserved', () => {
  const morning = at('2026-10-06T01:00:00Z'), night = at('2026-10-06T14:00:00Z');
  assert.equal(officeTime(morning).clock, '09:00:00');
  assert.equal(officeTime(morning).phase, 'Pagi');
  assert.equal(officeTime(night).phase, 'Malam');
  assert.equal(memberZone(member, morning), 'lounge');
  assert.equal(memberZone(member, night), 'bedroom');
  assert.equal(memberZone({ ...member, status: 'working' }, night), 'desk');
  assert.equal(memberZone({ ...member, status: 'offline' }, at('2026-10-10T01:00:00Z')), 'bedroom');
  const schedule = { timezone: 'Asia/Makassar', days: [{ day: 2, isWorking: true, startTime: '22:00', endTime: '06:00' }] };
  assert.equal(officeTime(at('2026-10-06T19:00:00Z'), schedule).inShift, true);
  assert.equal(officeTime(at('2026-10-06T22:00:00Z'), schedule).inShift, false);
});
test('coffee, garden and manual activities expire without modifying attendance', () => {
  const now = at('2026-10-06T02:00:00Z');
  for (const [seconds, zone] of [[899,'desk'],[900,'pantry'],[960,'desk'],[1800,'garden'],[1920,'desk']]) assert.equal(memberZone({ ...member, status:'working', accumulatedSeconds: seconds }, now), zone);
  let space = spaceModel.normalizeSpace(null, [member, { id: 'b' }]);
  space = spaceModel.setActivity(space, 'a', 'garden', now);
  assert.equal(space.activities.a.until, now + 300000); assert.equal(space.activities.b, undefined);
  const active = { ...member, status:'working', activity: space.activities.a };
  assert.equal(memberZone(active, now), 'garden'); assert.equal(memberZone(active, now+300001), 'desk');
  assert.equal(memberZone({ ...active, status:'offline' }, now), 'lounge');
  assert.equal(spaceModel.setActivity(space, 'a', 'auto').activities.a, undefined);
  assert.throws(() => spaceModel.setActivity(space, 'unknown', 'garden'));
});
test('offline/sleeping bubbles are empty and each leisure area has varied conversation', () => {
  assert.equal(bubbleLabel({ ...member, status:'offline' }), '');
  assert.equal(bubbleLabel(member, 'bedroom'), '');
  for (const zone of ['pantry','garden','lounge']) assert.equal(new Set(Array.from({ length:4 }, (_, i) => bubbleLabel(member, zone, i*11000))).size, 4);
});
test('movable desks reject blocked layouts; seat, keyboard and route follow saved orientation', () => {
  const layout = spaceModel.parseDesks([{ slot:0, x:-4.6, z:-2.2, rotation:0 }], 1);
  const d = deskPosition(0, layout), p = zonePosition(0, 'desk', layout);
  assert.equal(p.x, -4.6); assert.ok(Math.abs(p.z+2.98)<1e-9);
  const route = travelPath(0, [5,.5], 'desk', 0, layout); assert.deepEqual(route.at(-1), [p.x,p.z]);
  assert.ok(Math.abs(p.z+.51-(d.z-.27))<1e-9, 'hand stays on keyboard after desk move');
  assert.throws(() => spaceModel.parseDesks([{ slot:0, x:0, z:0, rotation:0 }],1), /bertabrakan/);
  assert.throws(() => spaceModel.parseDesks([{ slot:0, x:5, z:0, rotation:0 }],1), /lorong/);
  assert.throws(() => spaceModel.parseDesks([{ slot:0, x:NaN, z:0, rotation:0 }],1));
  assert.throws(() => spaceModel.parseOrnaments([{ id:'blocked', asset:'floor_plant',room:0,x:-4.6,z:-2.2,rotation:0 }],1,layout), /meja/);
});
test('new bedroom and garden paths share only actual entrances', () => {
  for (let slot=0;slot<10;slot++) {
    const bed=travelPath(slot,[5,.5],'bedroom'); assert.ok(bed.some(p=>p[0]===-6&&p[1]===4.5));
    const garden=travelPath(slot,[5,.5],'garden'); assert.ok(garden.some(p=>p[0]===12&&p[1]===4.5));
    assert.ok(new Set(['bedroom','garden'].map(zone => JSON.stringify(zonePosition(slot,zone)))).size===2);
  }
});

test('saved layouts gain private offices once, preserving claims and user edits', () => {
  const old={revision:7,layoutRevision:3,claims:{a:4},ornaments:[{id:'plant-front',asset:'floor_plant',x:-5,z:4.8,rotation:0,room:0}]};
  const upgraded=spaceModel.normalizeSpace(old,[member]);
  assert.equal(upgraded.claims.a,4); assert.equal(upgraded.revision,7); assert.equal(upgraded.version,2);
  assert.equal(upgraded.ornaments.filter(o=>o.id==='manager-desk').length,1);
  const saved={...upgraded,ornaments:upgraded.ornaments.filter(o=>o.id!=='manager-art')};
  assert.equal(spaceModel.normalizeSpace(saved,[member]).ornaments.some(o=>o.id==='manager-art'),false);
  assert.doesNotThrow(()=>spaceModel.parseOrnaments(upgraded.ornaments,1));
});
test('library validates colors/heights and private desk peripherals follow movement', () => {
  const base=spaceModel.DEFAULT_ORNAMENTS;
  const moved=spaceModel.updateOrnament(base,'manager-desk',{x:-2.5,color:'#394c68'});
  assert.equal(moved.find(o=>o.id==='manager-laptop').x,-2.5);
  assert.equal(moved.find(o=>o.id==='manager-chair').x,-2.5);
  assert.equal(moved.find(o=>o.id==='manager-shelf').x,-5);
  assert.doesNotThrow(()=>spaceModel.parseOrnaments(moved,1));
  for(const patch of [{color:'url(secret)'},{y:Infinity},{y:-1},{y:20}]) assert.throws(()=>spaceModel.parseOrnaments([{...base.find(o=>o.id==='manager-desk'),...patch}],1));
  assert.equal(Object.keys(spaceModel.ORNAMENTS).length,30);
  assert.doesNotThrow(()=>spaceModel.parseOrnaments([{id:'bedroom-light',asset:'floor_lamp',x:-17,z:-5,rotation:0,room:0,color:'#cfaa77'}],1));
});
