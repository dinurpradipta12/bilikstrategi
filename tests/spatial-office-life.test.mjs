import test from 'node:test';
import assert from 'node:assert/strict';
import { officeTime, memberZone, bubbleLabel, zonePosition, deskPosition, travelPath } from '../lib/spatial-office/model.ts';
import { spaceModel } from './spatial-office-module-loader.mjs';
const member = { id: 'a', name: 'Alya', status: 'paused', project: 'Website' };
const at = s => Date.parse(s);
test('schedule and timezone control light, not avatar attendance; active overtime is preserved', () => {
  const morning = at('2026-10-06T01:00:00Z'), night = at('2026-10-06T14:00:00Z');
  assert.equal(officeTime(morning).clock, '09:00:00');
  assert.equal(officeTime(morning).phase, 'Pagi');
  assert.equal(officeTime(night).phase, 'Malam');
  assert.equal(memberZone(member, morning), 'lounge');
  assert.equal(memberZone(member, night), 'lounge');
  assert.equal(memberZone({ ...member, status: 'working' }, night), 'desk');
  assert.equal(memberZone({ ...member, status: 'offline' }, at('2026-10-10T01:00:00Z')), 'exit');
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
  assert.equal(memberZone({ ...active, status:'offline' }, now), 'exit');
  assert.equal(spaceModel.setActivity(space, 'a', 'auto').activities.a, undefined);
  assert.throws(() => spaceModel.setActivity(space, 'unknown', 'garden'));
});
test('offline/sleeping bubbles are empty and each leisure area has varied conversation', () => {
  assert.equal(bubbleLabel({ ...member, status:'offline' }), '');
  assert.equal(bubbleLabel(member, 'exit'), '');
  for (const zone of ['pantry','garden','lounge']) assert.equal(new Set(Array.from({ length:4 }, (_, i) => bubbleLabel({...member,status:'working'}, zone, i*11000))).size, 4);
});
test('member chat overrides automatic bubbles briefly, including during a pause',()=>{
  const now=100_000,chat={text:'Ada yang bisa bantu review?',sentAt:now-1_000};
  assert.equal(bubbleLabel({...member,chat},'lounge',now),chat.text);
  assert.equal(bubbleLabel({...member,status:'working',chat},'desk',now),chat.text);
  assert.equal(bubbleLabel({...member,chat},'lounge',now+15_000),'');
  assert.equal(bubbleLabel({...member,status:'offline',chat},'exit',now),'');
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
test('exit and garden paths use the front and side glass doors', () => {
  for (let slot=0;slot<10;slot++) {
    const bed=travelPath(slot,[5,.5],'exit'); assert.ok(bed.some(p=>p[0]===4.5&&p[1]===6));
    const garden=travelPath(slot,[5,.5],'garden'); assert.ok(garden.some(p=>p[0]===12&&p[1]===4.5));
    assert.ok(new Set(['exit','garden'].map(zone => JSON.stringify(zonePosition(slot,zone)))).size===2);
  }
});

test('saved layouts gain private offices once, preserving claims and user edits', () => {
  const old={revision:7,layoutRevision:3,claims:{a:4},ornaments:[{id:'plant-front',asset:'floor_plant',x:-5,z:4.8,rotation:0,room:0}]};
  const upgraded=spaceModel.normalizeSpace(old,[member]);
  assert.equal(upgraded.claims.a,4); assert.equal(upgraded.revision,7); assert.equal(upgraded.version,8);
  assert.equal(upgraded.ornaments.filter(o=>o.id==='manager-desk').length,0);
  const saved={...upgraded,ornaments:upgraded.ornaments.filter(o=>o.id!=='manager-art')};
  assert.equal(spaceModel.normalizeSpace(saved,[member]).ornaments.some(o=>o.id==='manager-art'),false);
  assert.doesNotThrow(()=>spaceModel.parseOrnaments(upgraded.ornaments,1));
});

test('doorway upgrade only moves untouched default obstacles and protects both sides of entrances', () => {
  const old={version:2,claims:{a:4},ornaments:[
    {id:'shelf-back',asset:'bookshelf',x:-2,z:-5.4,rotation:0,room:0},
    {id:'lamp-back',asset:'floor_lamp',x:4.5,z:-5.2,rotation:0,room:0},
  ]};
  const upgraded=spaceModel.normalizeSpace(old,[member]);
  assert.deepEqual(Array.from(upgraded.ornaments.slice(0,2),o=>o.x),[-3.6,.5]);
  assert.equal(upgraded.claims.a,4); assert.ok(upgraded.ornaments.length>2);
  const customized={...old,ornaments:[{...old.ornaments[0],x:-4}]};
  assert.equal(spaceModel.normalizeSpace(customized,[member]).ornaments[0].x,-4);
  for(const [x,z] of [[-1.5,-5.4],[-1.5,-6.6],[4.5,-7],[4.5,-8.3],[9,-6.5],[9,-7.8]]) {
    assert.throws(()=>spaceModel.parseOrnaments([{id:'blocked-door',asset:'floor_plant',x,z,rotation:0,room:0}],1),/pintu|dinding|lorong/);
  }
  assert.doesNotThrow(()=>spaceModel.parseOrnaments(upgraded.ornaments,1));
});
test('private desks accept ownership and preserve transforms while rejecting exits and other rooms',()=>{
  const base=spaceModel.normalizeSpace(null,[member,{id:'b'}]);
  const manager=spaceModel.claimDesk(base,'a',10,2),lead=spaceModel.claimDesk(manager,'b',11,2);
  assert.equal(lead.claims.a,10); assert.equal(lead.claims.b,11);
  const desks=spaceModel.moveDesk(lead.desks,10,{x:-2.5,color:'#394c68'},1,lead.ornaments);
  assert.equal(desks[0].x,-2.5);
  assert.doesNotThrow(()=>spaceModel.parseOrnaments(lead.ornaments,1,desks));
  assert.throws(()=>spaceModel.moveDesk(desks,10,{x:3},1,lead.ornaments));
  for(const patch of [{color:'url(secret)'},{y:Infinity},{y:-1},{y:20}]) assert.throws(()=>spaceModel.parseOrnaments([{...base.ornaments.find(o=>o.id==='manager-art'),...patch}],1));
  assert.doesNotThrow(()=>spaceModel.parseOrnaments([{id:'meeting-light',asset:'floor_lamp',x:6.5,z:-13,rotation:0,room:0}],1));
});
test('version 4 migrates old desk ownership in later areas exactly once and preserves private desk edits',()=>{
  const old={version:3,revision:8,layoutRevision:5,claims:{a:10,b:19},desks:[{slot:10,x:-4.6,z:-2.2,rotation:0}],ornaments:[{id:'manager-desk',asset:'office_desk',x:-2.5,z:-9,rotation:0,color:'#394c68',room:0}]};
  const next=spaceModel.normalizeSpace(old,[member,{id:'b'}]);
  assert.equal(next.claims.a,12); assert.equal(next.claims.b,21);
  assert.equal(next.desks.find(d=>d.slot===12).x,-4.6);
  assert.equal(next.desks.find(d=>d.slot===10).color,'#394c68');
  assert.equal(next.desks.find(d=>d.slot===11).removed,true);
  assert.deepEqual(spaceModel.normalizeSpace(next,[member,{id:'b'}]),next);
});
