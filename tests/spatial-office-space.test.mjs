import test from 'node:test';
import assert from 'node:assert/strict';
import { spaceModel as space, loadTS } from './spatial-office-module-loader.mjs';
import { travelPath, zonePosition } from '../lib/spatial-office/model.ts';
const members = [{ id: '1' }, { id: '2' }, { id: '3' }];

test('ownership survives reload/reordering and roster removal frees only that desk', () => {
  let current = space.normalizeSpace(null, members);
  assert.equal(space.spaceCapacity(current, members.length), 12);
  current = space.claimDesk(current, '1', 9, members.length);
  assert.equal(current.claims['1'], 9);
  assert.equal(current.claims['2'], 1);
  assert.throws(() => space.claimDesk(current, '2', 9, 3), /sudah dimiliki/);
  assert.throws(() => space.claimDesk(current, '1', 12, 3), /tidak tersedia/);
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
  assert.equal(space.spaceCapacity(current, 25), 36);
  assert.equal(new Set(Object.values(current.claims)).size, 25);
});
test('team assignment swaps occupied desks and rejects nonmembers or unavailable desks', () => {
  const initial=space.normalizeSpace(null,members);
  const swapped=space.assignDesk(initial,'1',1,3);
  assert.deepEqual({...swapped.claims},{'1':1,'2':0,'3':2});
  const free=space.assignDesk(swapped,'1',9,3);
  assert.equal(free.claims['1'],9); assert.equal(free.claims['2'],0);
  assert.equal(free.layoutRevision,initial.layoutRevision);
  for(const [id,slot] of [['outsider',8],['1',NaN],['1',12]]) assert.throws(()=>space.assignDesk(free,id,slot,3));
  const removed=space.removeDesk(free,8,3);
  assert.throws(()=>space.assignDesk(removed,'1',8,3),/tidak tersedia/);
});
test('desk deletion relocates its owner and survives reload and roster additions', () => {
  const initial=space.normalizeSpace(null,members),removed=space.removeDesk(initial,0,3);
  assert.equal(removed.claims['1'],3); assert.equal(removed.claims['2'],1);
  assert.equal(removed.layoutRevision,1); assert.equal(removed.desks[0].removed,true);
  const restored=space.normalizeSpace(JSON.parse(JSON.stringify(removed)),[...members,{id:'4'}]);
  assert.equal(restored.claims['1'],3); assert.equal(restored.claims['4'],4);
  assert.throws(()=>space.claimDesk(restored,'1',0,4),/dihapus/);
  assert.doesNotThrow(()=>space.parseDesks(restored.desks,1));
  const shown=space.moveDesk(restored.desks,0,{removed:false},1,restored.ornaments);
  assert.equal(shown[0].removed,undefined);
  assert.equal(space.claimDesk({...restored,desks:shown},'1',0,4).claims['1'],0);
});
test('a fully occupied office cannot delete a desk and empty deletions retain their area', () => {
  const full=space.normalizeSpace(null,Array.from({length:12},(_,i)=>({id:String(i)})));
  assert.throws(()=>space.removeDesk(full,0,12),/Semua meja terisi/);
  assert.equal(full.desks.length,0); assert.equal(new Set(Object.values(full.claims)).size,12);
  const empty=space.normalizeSpace({desks:[{slot:19,x:2,z:1,rotation:0,removed:true}]},[]);
  assert.equal(space.spaceCapacity(empty,0),24);
});
test('ornaments allow saved garden/interior placement and reject walls, corridors and invalid assets', () => {
  assert.doesNotThrow(() => space.parseOrnaments(space.DEFAULT_ORNAMENTS, 1));
  const plant = { id: 'plant', asset: 'floor_plant', x: 15, z: -5, rotation: 0, room: 0 };
  assert.doesNotThrow(() => space.parseOrnaments([plant], 1));
  for (const patch of [{ x: 0, z: 0 }, { x: 6, z: 0.5 }, { x: 5, z: 3 }, { x: 50 }, { asset: '__proto__' }, { rotation: Infinity }, { room: 1 }]) {
    assert.throws(() => space.parseOrnaments([{ ...plant, ...patch }], 1));
  }
  assert.throws(() => space.parseOrnaments([plant, { ...plant, id: 'other' }], 1), /bertabrakan/);
  assert.throws(() => space.parseOrnaments([plant, plant], 1), /tidak valid/);
});

test('wall snapping uses the asymmetric asset footprint on all four solid walls', () => {
  for(const asset of ['framed_art','pinboard','bookshelf']) for(const [x,z,axis,edge,side] of [[-3,-11.5,'z',-12,1],[-5.5,-9,'x',-6,1],[-.5,-9,'x',0,-1],[-3,-6.5,'z',-6,-1]]) {
    const item={id:'wall-item',asset,x,z,y:asset==='bookshelf'?0:.9,rotation:Math.PI/4,room:0};
    const snapped=space.snapOrnament(item,item,true),b=space.ornamentFootprint(snapped);
    assert.ok(Math.abs(b[`${axis}${side>0?'min':'max'}`]-(edge+side*.075))<.00001);
    assert.doesNotThrow(()=>space.parseOrnaments([snapped],1,[{slot:10,x:-3,z:-9,rotation:0,removed:true}]));
    const inside={...snapped,[axis]:snapped[axis]-side*.1};
    assert.throws(()=>space.parseOrnaments([inside],1),/dinding/);
  }
});

test('invalid movement cannot replace a valid draft; dragging clamps to the current room', () => {
  const initial=space.DEFAULT_ORNAMENTS.map(o=>({...o}));
  assert.throws(()=>space.moveOrnament(initial,'shelf-back',{x:0,z:0},1,[]),/Rak buku.*meja/);
  assert.equal(initial.find(o=>o.id==='shelf-back').x,-3.6);
  const moved=space.moveOrnament(initial,'shelf-back',{z:-30},1,[]);
  const shelf=moved.find(o=>o.id==='shelf-back');
  assert.ok(space.ornamentFootprint(shelf).zmin>=-5.926);
  assert.doesNotThrow(()=>space.parseOrnaments(moved,1));
  assert.throws(()=>space.moveDesk([],0,{x:0,z:0},1,initial),/bertabrakan/);
});

test('rotated thin objects use their oriented bounds rather than oversized bounding boxes',()=>{
  const a={id:'screen-a',asset:'room_divider',x:-4,z:-4,rotation:Math.PI/4,room:0};
  const b={...a,id:'screen-b',x:-3.55,z:-3.55};
  assert.doesNotThrow(()=>space.parseOrnaments([a,b],1));
  assert.throws(()=>space.parseOrnaments([a,{...b,x:-4,z:-4}],1),/bertabrakan/);
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

test('wall-mounted layout is persisted and read back without losing position, rotation or height',async()=>{
  const store=storeFixture(space.normalizeSpace(null,members));
  const saved=await store.mutateOfficeSpace('team',members,current=>{
    const ornaments=space.moveOrnament(current.ornaments,'manager-art',{},1,current.desks,true);
    return {...current,ornaments,layoutRevision:current.layoutRevision+1,revision:current.revision+1};
  });
  const restored=await store.readOfficeSpace('team',members);
  assert.equal(restored.ready,true);
  assert.deepEqual(JSON.parse(JSON.stringify(restored.space)),JSON.parse(JSON.stringify(saved)));
  assert.doesNotThrow(()=>space.parseOrnaments(restored.space.ornaments,1));
});
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
test('concurrent deletion and claim never leave an owner on a removed desk',async()=>{
  for(const reverse of [false,true]) {
    const store=storeFixture(space.normalizeSpace(null,members));
    const actions=[current=>space.removeDesk(current,9,3),current=>space.claimDesk(current,'1',9,3)];
    if(reverse) actions.reverse();
    await Promise.allSettled(actions.map(action=>store.mutateOfficeSpace('team',members,action)));
    const saved=store.state();
    assert.ok(saved.desks.some(d=>d.slot===9&&d.removed));
    assert.ok(!Object.values(saved.claims).includes(9));
    assert.equal(new Set(Object.values(saved.claims)).size,3);
  }
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

test('new furnishing migration seeds every area once and preserves removals, claims and lighting',()=>{
  const members=Array.from({length:14},(_,i)=>({id:String(i)}));
  const old=space.normalizeSpace({version:4,claims:{'0':10},ornaments:space.DEFAULT_ORNAMENTS.map(o=>o.id.startsWith('lead-')?{...o,z:o.z+1.5}:o),revision:8},members);
  assert.equal(old.version,7);assert.equal(old.claims['0'],10);
  assert.ok(old.ornaments.some(o=>o.room===1&&o.asset==='whiteboard'));
  assert.doesNotThrow(()=>space.parseOrnaments(old.ornaments,2));
  const edited={...old,ornaments:old.ornaments.filter(o=>o.id!=='meeting-chair-0'),lights:{'0:meeting':'off'}};
  const reloaded=space.normalizeSpace(edited,members);
  assert.ok(!reloaded.ornaments.some(o=>o.id==='meeting-chair-0'));assert.equal(reloaded.lights['0:meeting'],'off');
});
test('all furnished objects are valid and supported tabletop objects follow a moved counter',()=>{
  const base=space.normalizeSpace(null,[{id:'a'}]);
  assert.doesNotThrow(()=>space.parseOrnaments(base.ornaments,1));
  const counter=base.ornaments.find(o=>o.id==='pantry-counter-1');
  const next=space.moveOrnament(base.ornaments,counter.id,{z:5.4},1,[]);
  assert.ok(Math.abs(next.find(o=>o.id==='pantry-mug-1').z-5.35)<1e-8);
  assert.ok(Math.abs(next.find(o=>o.id==='pantry-coffee-machine').z-5.3)<1e-8);
  const board=space.moveOrnament(next,'workspace-board',{z:-2.2},1,[]);
  assert.equal(board.find(o=>o.id==='workspace-board').z,-2.2);
});
test('lighting automatic and manual modes are bounded to existing office areas',()=>{
  const base=space.normalizeSpace(null,[{id:'a'}]);
  assert.equal(space.lightEnabled(undefined,true),true);assert.equal(space.lightEnabled('auto',false),false);
  assert.equal(space.lightEnabled('on',false),true);assert.equal(space.lightEnabled('off',true),false);
  const saved=space.applySharedAction(base,{type:'light',key:'0:meeting',mode:'on'},'a',false);
  assert.equal(saved.lights['0:meeting'],'on');
  for(const action of [{type:'light',key:'99:meeting',mode:'on'},{type:'light',key:'0:unknown',mode:'on'},{type:'light',key:'0:meeting',mode:'bad'}]) assert.throws(()=>space.applySharedAction(base,action,'a',true));
});
test('sticky notes enforce ownership, version conflict, board existence and text limits',()=>{
  const base=space.normalizeSpace(null,[{id:'a'},{id:'b'}]);
  const action={type:'note',id:'note-a',boardId:'workspace-board',text:'Review konsep besok',color:'yellow',expectedRevision:0,authorId:'b'};
  const first=space.applySharedAction(base,action,'a',false);
  assert.equal(first.notes[0].authorId,'a');
  assert.throws(()=>space.applySharedAction(first,{...action,expectedRevision:1,text:'Changed'},'b',false),/penulis/);
  const updated=space.applySharedAction(first,{...action,expectedRevision:1,text:'Updated'},'a',false);
  assert.throws(()=>space.applySharedAction(updated,{...action,expectedRevision:1},'a',false),/berubah/);
  assert.equal(space.applySharedAction(updated,{...action,expectedRevision:2,remove:true},'b',true).notes.length,0);
  assert.throws(()=>space.applySharedAction(base,{...action,boardId:'missing'},'a',true));
  assert.throws(()=>space.applySharedAction(base,{...action,text:'x'.repeat(501)},'a',true));
  assert.equal(space.normalizeSpace(updated,[{id:'a'},{id:'b'}]).notes[0].text,'Updated');
});

test('corridor migrations move Project Lead as a room, widen the lounge passage and keep notes',()=>{
  const prior={version:5,revision:9,layoutRevision:2,claims:{a:11},desks:[{slot:11,x:3,z:-9,rotation:0}],furnishedRooms:[0],lights:{'0:meeting':'off'},notes:[{id:'n',boardId:'board',authorId:'a',text:'Keep',color:'blue',revision:8}],ornaments:[{id:'lead-art',asset:'framed_art',x:3,z:-11.6,y:.9,rotation:0,room:0},{id:'lounge-sofa-0',asset:'sofa',x:7,z:-4.4,rotation:0,room:0}]};
  const next=space.normalizeSpace(prior,[{id:'a'}]);
  assert.equal(next.claims.a,11);assert.equal(next.desks[0].z,-10.5);assert.equal(next.ornaments[0].z,-13.1);
  assert.equal(next.ornaments[1].z,-4);assert.equal(next.lights['0:meeting'],'off');assert.equal(next.notes[0].text,'Keep');
  assert.deepEqual(space.normalizeSpace(next,[{id:'a'}]),next);
  assert.doesNotThrow(()=>space.parseOrnaments(next.ornaments,1,next.desks));
  assert.throws(()=>space.parseOrnaments([{id:'blocked',asset:'sofa',room:0,x:9,z:-5.5,rotation:0}],1),/dinding|lorong/);
  const moved=space.normalizeSpace({version:3,ornaments:[{id:'old-meeting-art',asset:'framed_art',x:-11.8,z:-2,y:.9,rotation:Math.PI/2,room:0}]},[]).ornaments.find(o=>o.id==='old-meeting-art');
  assert.ok(moved.x>6&&moved.z<-7.5);
});

test('meeting assigns unique existing seats per office, reports full capacity and releases expired seats',()=>{
  const roster=Array.from({length:7},(_,i)=>({id:`a${i}`}));let current=space.normalizeSpace(null,roster);
  for(let i=0;i<6;i++) current=space.setActivity(current,`a${i}`,'meeting',1000);
  assert.equal(new Set(Object.values(current.activities).map(a=>a.seat)).size,6);
  assert.throws(()=>space.setActivity(current,'a6','meeting',2000),/penuh/);
  current=space.setActivity(current,'a0','desk',2000);
  current=space.setActivity(current,'a6','meeting',2000);assert.equal(current.activities.a6.seat,0);
  const later=space.setActivity(current,'a0','meeting',901001);assert.equal(later.activities.a0.seat,1);
  const reloaded=space.normalizeSpace(current,roster);assert.equal(reloaded.activities.a6.zone,'meeting');assert.equal(reloaded.activities.a6.seat,0);
});


test('layout draft removes multiple desks atomically, keeps edits and never revives deleted ornaments',()=>{
  const base=space.normalizeSpace(null,members),removed=[0,1,5].map(slot=>({...zonePosition(slot,'desk'),slot,removed:true}));
  const next=space.applyLayout(base,{layoutRevision:0,desks:removed,ornaments:base.ornaments.filter(o=>o.id!=='plant-front')},3);
  for(const slot of Object.values(next.claims)) assert.ok(![0,1,5].includes(slot));
  assert.equal(new Set(Object.values(next.claims)).size,3);
  const restored=space.normalizeSpace(next,members);assert.ok(!restored.ornaments.some(o=>o.id==='plant-front'));
  assert.deepEqual(restored.claims,next.claims);
  const all=Array.from({length:12},(_,slot)=>({...zonePosition(slot,'desk'),slot,removed:true}));
  assert.throws(()=>space.applyLayout(base,{layoutRevision:0,desks:all,ornaments:[]},3),/meja kosong/);
  assert.equal(base.claims['1'],0);
});

test('normalization releases meeting reservations when the member pauses or becomes idle',()=>{
  const base=space.normalizeSpace(null,members);
  const next=space.setActivity(space.setActivity(base,'1','meeting',1000),'2','meeting',1000);
  const normalized=space.normalizeSpace(next,[{id:'1',status:'paused'},{id:'2',status:'working',presenceIdle:true},{id:'3',status:'working'}]);
  assert.equal(Object.keys(normalized.activities).length,0);
});
