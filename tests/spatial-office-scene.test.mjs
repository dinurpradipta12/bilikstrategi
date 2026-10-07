import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import * as model from '../lib/spatial-office/model.ts';
import * as avatarVisual from '../lib/spatial-office/avatar-visual.ts';
import { spaceModel, loadTS } from './spatial-office-module-loader.mjs';

class Element {
  children = []; dataset = {}; style = {}; textContent = ''; hidden = false; className = ''; offsetWidth = 180; offsetHeight = 70;
  classList = { contains: name => this.className.split(/\s+/).includes(name) };
  append(...items) { this.children.push(...items); }
  appendChild(item) { this.children.push(item); }
  addEventListener() {}
  setAttribute() {}
  remove() {}
}
const { OfficeScene } = loadTS('../lib/spatial-office/scene.ts', {
  three: THREE, 'three/addons/loaders/GLTFLoader.js': { GLTFLoader }, 'three/addons/controls/OrbitControls.js': { OrbitControls },
  'three/addons/utils/BufferGeometryUtils.js': { mergeGeometries }, './model': model, './space': spaceModel,
  'three/addons/utils/SkeletonUtils.js': { clone: cloneSkeleton },
  './avatar-visual': avatarVisual,
}, { document: { createElement: () => new Element() }, requestAnimationFrame:()=>0 });
const templates = new Map();
const characterClips = new Map();
for (const asset of new Set([...model.AVATAR_MODELS, ...Object.keys(spaceModel.ORNAMENTS).filter(k=>!['round_meeting_table','coffee_machine','team_radio'].includes(k)), 'floor_wood_3m', 'floor_ivory_3m', 'wall_with_window_3m', 'office_desk', 'office_swivel_chair', 'laptop', 'keyboard', 'coffee_mug', 'pinboard', 'sofa', 'drawer_cabinet', 'wood_chair'])) {
  const path = model.AVATAR_MODELS.includes(asset) ? model.AVATAR_ASSETS[asset] : asset;
  const bytes = await readFile(new URL(`../src/Char-assets/${path}.glb`, import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  templates.set(asset, gltf.scene);
  if (model.AVATAR_MODELS.includes(asset)) characterClips.set(asset, gltf.animations);
}
function office() {
  const engine = Object.create(OfficeScene.prototype);
  Object.assign(engine, { scene: new THREE.Scene(), camera:new THREE.PerspectiveCamera(), controls:{target:new THREE.Vector3(),update(){}}, labels: new Element(), templates, characterClips, desks: new Map(), deskLabels: new Map(), occupants: new Map(), geometries: new Set(), materials: new Set(), blockedActivities:new Map(), lights:{}, roomLights:new Map(), roomLabels: [], doors: [], decorations: new Map(), ornaments: [], current: [], room: 0, deskLayout: [], schedule: { timezone: 'Asia/Makassar', days: Array.from({ length: 7 }, (_, day) => ({ day, isWorking: true, startTime: '00:00', endTime: '00:00' })) }, loaded: false, outline: null, options: { onSelect() {}, onSelectDesk() {} } });
  engine.buildRoom(); engine.loaded = true; engine.setOrnaments(spaceModel.normalizeSpace(null,[]).ornaments,0,false,''); return engine;
}
const alice = { id: '1', name: 'Alya', status: 'working', project: 'Design' };
test('first snapshot seats existing workers immediately; snapshots retain the same rig', () => {
  const engine = office();
  assert.equal(engine.desks.size, 12); assert.equal(engine.deskLabels.size, 12);
  engine.setMembers([{ member: alice, slot: 0 }]);
  const first = engine.occupants.get('1'), p = model.zonePosition(0, 'desk');
  assert.equal(first.route.length, 0); assert.equal(first.rig.root.position.x, p.x); assert.equal(first.rig.root.position.z, p.z);
  assert.equal(first.rig.action, 'Idle'); assert.ok(first.rig.model.getObjectByName('Hips'));
  assert.ok(first.rig.actions.has('Walk')); assert.ok(first.rig.model.children.some(child => child.type === 'SkinnedMesh' || child.children.some(node => node.type === 'SkinnedMesh')));
  engine.setMembers([{ member: { ...alice }, slot: 0 }]); assert.equal(engine.occupants.get('1').rig, first.rig);
  engine.setMembers([{ member: { ...alice, status: 'paused', presenceIdle:true }, slot: 0 }]);
  assert.equal(engine.occupants.size,1);assert.equal(first.zone,'lounge');assert.ok(first.route.length>0);
});
test('glasses use the supplied rig eye line instead of the mouth line', () => {
  const engine = office(), avatar = { ...model.defaultAvatar('doctor'), model: 'doctor', hair: 'doctor', glasses: true };
  engine.setMembers([{ member: { ...alice, avatar }, slot: 0 }]);
  const head = engine.occupants.get('1').rig.model.getObjectByName('Head');
  const frames = head.children.filter(child => child.geometry?.type === 'TorusGeometry');
  assert.equal(frames.length, 2);
  assert.ok(frames.every(frame => frame.position.y === .155 && frame.position.z === .242));
});
test('boy and girl styles select trousers or skirt and replace the dotted mouth with a smile', () => {
  const materialMesh = (root, name) => {
    let result;
    root.traverse(child => {
      if (!result && child.isSkinnedMesh && (Array.isArray(child.material) ? child.material : [child.material]).some(material => material.name === name)) result = child;
    });
    return result;
  };
  const studentWithBoyStyle = cloneSkeleton(templates.get('student'));
  avatarVisual.applyAvatarAppearance(studentWithBoyStyle, templates.get('boy'), { ...model.defaultAvatar('student-boy'), model: 'student', hair: 'boy' });
  assert.equal(materialMesh(studentWithBoyStyle, 'pants').geometry, materialMesh(templates.get('boy'), 'pants').geometry);
  assert.equal(materialMesh(studentWithBoyStyle, 'mouth').visible, false);
  assert.ok(studentWithBoyStyle.getObjectByName('AvatarSmile'));

  const studentWithGirlStyle = cloneSkeleton(templates.get('student'));
  avatarVisual.applyAvatarAppearance(studentWithGirlStyle, templates.get('girl'), { ...model.defaultAvatar('student-girl'), model: 'student', hair: 'girl' });
  assert.equal(materialMesh(studentWithGirlStyle, 'pants').geometry, materialMesh(templates.get('girl'), 'pants').geometry);
});
test('claiming another desk retains position and schedules movement, then roster deletion removes avatar only', () => {
  const engine = office(); engine.setMembers([{ member: alice, slot: 0 }]);
  const person = engine.occupants.get('1'), initial = person.rig.root.position.clone();
  engine.setMembers([{ member: alice, slot: 9 }]);
  assert.deepEqual(person.rig.root.position.toArray(), initial.toArray());
  const end = model.zonePosition(9, 'desk'); assert.equal(person.route.at(-1).x, end.x); assert.equal(person.route.at(-1).z, end.z);
  engine.setMembers([]); assert.equal(engine.occupants.size, 0); assert.equal(engine.desks.size, 12);
});
test('removed desks hide the complete furniture kit and can be restored',()=>{
  const engine=office(),p=model.deskPosition(0);
  engine.setDeskLayout([{slot:0,x:p.x,z:p.z,rotation:p.rotation,removed:true}]);
  assert.equal(engine.desks.get(0).visible,false);
  assert.equal(engine.desks.get(1).visible,true);
  engine.setDeskLayout([]);
  assert.equal(engine.desks.get(0).visible,true);
});
test('ornament draft move/rotate/add/remove/cancel reconcile without mutating templates', () => {
  const engine = office(), base = spaceModel.DEFAULT_ORNAMENTS;
  const original = templates.get('floor_plant').position.clone();
  engine.setOrnaments(base, 0, false, ''); assert.equal(engine.decorations.size, base.length);
  const next = base.map(item => item.id === 'plant-back' ? { ...item, x: 15, rotation: Math.PI / 2 } : item);
  engine.setOrnaments(next, 0, true, 'plant-back');
  assert.equal(engine.decorations.get('plant-back').position.x, 15); assert.equal(engine.decorations.get('plant-back').rotation.y, Math.PI / 2); assert.equal(engine.outline.visible, true);
  engine.setOrnaments([], 0, true, ''); assert.equal(engine.decorations.size, 0);
  engine.setOrnaments(base, 0, false, ''); assert.equal(engine.decorations.get('plant-back').position.x, -5); assert.equal(engine.outline.visible, false);
  assert.deepEqual(templates.get('floor_plant').position.toArray(), original.toArray());
});
test('workspace radio is rendered as a selectable procedural object',()=>{
  const engine=office(),radio=engine.decorations.get('workspace-radio');
  assert.ok(radio);assert.equal(radio.name,'team-radio');
  assert.equal(radio.userData.ornamentId,'workspace-radio');
});

function animation(engine) {
  Object.assign(engine,{visible:true,time:0,lastFrame:0,moving:true,skyMinute:Math.floor(Date.now()/60000),clouds:new THREE.Group(),camera:new THREE.PerspectiveCamera(),project:new THREE.Vector3(),host:{clientWidth:1024,clientHeight:768},controls:{update(){}},renderer:{render(){}}});
}
test('initial paused members rest in the lounge while offline and idle members stay outside',()=>{
  const engine=office(); animation(engine);
  engine.setMembers([{member:{...alice,status:'offline'},slot:0},{member:{...alice,id:'2',status:'paused'},slot:1},{member:{...alice,id:'3',presenceIdle:true},slot:2}]);
  assert.equal(engine.occupants.size,1);assert.equal(engine.occupants.get('2').zone,'lounge');
  engine.setMembers([{member:alice,slot:0}]);
  const person=engine.occupants.get('1');
  assert.equal(person.rig.root.position.z,8);
  assert.ok(person.route.some(p=>p.x===4.5&&p.z===6));
  const route=person.route; engine.setMembers([{member:{...alice},slot:0}]); assert.equal(person.route,route);
});
test('a paused manager walks out of the private office and reaches a lounge sofa',()=>{
  const engine=office();engine.setMembers([{member:alice,slot:10}]);const person=engine.occupants.get('1');
  engine.setMembers([{member:{...alice,status:'paused'},slot:10}]);
  assert.equal(person.zone,'lounge');assert.ok(person.route.length);assert.ok(person.route.some(p=>p.x===-1.5&&p.z===-6));
  assert.ok(person.route.at(-1).x>6);
});
test('checkout walks through front glass then disappears; fresh snapshot does not replay departure',()=>{
  const engine=office(); animation(engine); engine.setMembers([{member:alice,slot:10}]);
  engine.setMembers([{member:{...alice,status:'offline'},slot:10}]);
  const person=engine.occupants.get('1');
  assert.equal(person.zone,'exit'); assert.ok(person.route.some(p=>p.x===-1.5&&p.z===-6));
  assert.ok(person.route.some(p=>p.x===4.5&&p.z===6));
  for(let f=1;f<800;f++) engine.animateFrame(f*50);
  assert.equal(engine.occupants.size,0);
  engine.setMembers([{member:{...alice,status:'offline'},slot:10}]); assert.equal(engine.occupants.size,0);
  assert.ok(engine.scene.getObjectByName('meeting-round-table'));
  assert.ok(!engine.roomLabels.some(l=>l.element.textContent?.includes('TIDUR')));
});
test('checkout followed by quick check-in reverses the current route without teleporting',()=>{
  const engine=office(); engine.setMembers([{member:alice,slot:11}]);
  engine.setMembers([{member:{...alice,status:'offline'},slot:11}]);
  const person=engine.occupants.get('1'),position=person.rig.root.position.clone();
  engine.setMembers([{member:alice,slot:11}]);
  assert.deepEqual(person.rig.root.position.toArray(),position.toArray()); assert.equal(person.zone,'desk');
});
test('object coloring owns its material and does not recolor another object or GLB template', () => {
  const engine=office();
  const a={id:'a',asset:'floor_plant',x:-5,z:-5,rotation:0,room:0},b={...a,id:'b',x:15};
  engine.setOrnaments([a,b],0,true,'a');
  const mesh=group=>{let result; group.traverse(child=>{if(child instanceof THREE.Mesh) result=child;});return result;};
  const first=mesh(engine.decorations.get('a')),second=mesh(engine.decorations.get('b')),original=mesh(templates.get('floor_plant'));
  const color=second.material.color.getHexString(), originalColor=original.material.color.getHexString();
  engine.setOrnaments([{...a,color:'#394c68'},b],0,true,'a');
  assert.equal(first.material.color.getHexString(),'394c68'); assert.equal(second.material.color.getHexString(),color); assert.equal(original.material.color.getHexString(),originalColor);
});

test('wall attachment clears the real supplied GLB on every wall orientation',()=>{
  const engine=office();
  for(const asset of ['framed_art','pinboard','bookshelf']) for(const [x,z,axis,edge,side] of [[-3,-11.5,'z',-12,1],[-5.5,-9,'x',-6,1],[-.5,-9,'x',0,-1],[-3,-6.5,'z',-6,-1]]) {
    const item={id:'mounted',asset,x,z,y:asset==='bookshelf'?0:.9,rotation:0,room:0};
    const snapped=spaceModel.snapOrnament(item,item,true);
    engine.setOrnaments([snapped],0,true,'mounted');
    const box=new THREE.Box3().setFromObject(engine.decorations.get('mounted'));
    assert.ok(Math.abs((side>0?box.min[axis]:box.max[axis])-(edge+side*.075))<.0001,`${asset} penetrates wall ${axis}/${side}`);
  }
});

test('doors visibly clear the whole opening, stay open during passage and close after avatar leaves', () => {
  const engine=office();
  for(const name of ['MANAGER','PROJECT LEAD','MEETING']) assert.ok(engine.doors.some(d=>d.group.name===`door-${name}`));
  engine.setMembers([{member:alice,slot:0}]);
  const person=engine.occupants.get('1');
  for(const door of engine.doors) {
    person.rig.root.position.copy(door.center); person.rig.root.position[door.rotate?'x':'z']+=1.8;
    person.route=[door.center.clone()];
    for(let frame=0;frame<30;frame++) engine.updateDoors(.05);
    const axis=door.rotate?'z':'x';
    assert.ok(Math.abs(door.group.position[axis]-door.center[axis])>door.travel-.01);
    const bounds=new THREE.Box3().setFromObject(door.group);
    assert.ok(bounds.max[axis]<door.center[axis]-.65,'leaf still blocks opening');
    person.rig.root.position.copy(door.center); person.route=[];
    for(let frame=0;frame<30;frame++) engine.updateDoors(.05);
    assert.ok(door.hold>0,'door closes on stationary avatar in doorway');
    const direction=new THREE.Vector3(door.rotate?1:0,0,door.rotate?0:1);
    const origin=door.center.clone().addScaledVector(direction,-.5); origin.y=1;
    engine.scene.updateMatrixWorld(true);
    const ray=new THREE.Raycaster(origin,direction,0,1);
    assert.equal(ray.intersectObjects(engine.scene.children.filter(object=>object!==person.rig.root),true).length,0,'wall geometry seals the opening');
    person.rig.root.position.set(25,0,25);
    for(let frame=0;frame<60;frame++) engine.updateDoors(.05);
    assert.ok(Math.abs(door.group.position[axis]-door.center[axis])<.001,'door never closes');
  }
});

test('meeting sits beside Project Lead with a glazed exterior and continuous workspace corridor; every room has a controllable light',()=>{
  const engine=office();
  assert.equal(engine.decorations.get('meeting-round-table').position.x,9);
  assert.equal(engine.decorations.get('meeting-round-table').position.z,-10.75);
  assert.ok(!engine.doors.some(d=>d.center.x===9&&d.center.z>=-6&&d.center.z<=-5));assert.ok(engine.doors.some(d=>d.center.x===9&&d.center.z===-7.5));
  assert.ok(engine.scene.children.some(o=>o.userData.architecture==='glass'&&o.position.z===-13.5));
  const blocker=new THREE.Box3();
  for(const node of engine.scene.children.filter(o=>o.userData.architecture)) {blocker.setFromObject(node);assert.ok(!blocker.containsPoint(new THREE.Vector3(6,1,-6.75)),'corridor must cross X=6 without a wall');assert.ok(!blocker.containsPoint(new THREE.Vector3(4.5,1,-6)),'workspace must open into the corridor');}
  assert.ok(engine.scene.children.some(o=>o.userData.architecture==='wall'&&o.position.x===9&&o.position.z===-5),'lounge wall leaves a 2.5m corridor');
  assert.equal(engine.roomLights.size,7);
  engine.setLights({'0:meeting':'off','0:manager':'on'});
  assert.equal(engine.roomLights.get('meeting').light.intensity,0);assert.ok(engine.roomLights.get('manager').light.intensity>0);
});
test('lounge and garden seats follow moved furniture; missing seats return avatars to their desks',()=>{
  const engine=office(),items=spaceModel.normalizeSpace(null,[]).ornaments;
  const moved=items.map(o=>o.id==='lounge-sofa-0'?{...o,x:7.2,z:-4.3,rotation:Math.PI/2}:o);
  engine.setOrnaments(moved,0,false,'');
  const m={...alice,activity:{zone:'lounge',until:Date.now()+300000}};
  engine.setMembers([{member:m,slot:0}]);const p=engine.occupants.get('1');
  const destination=engine.destination(0,'lounge');
  assert.equal(engine.loungeSeat(0).offset,0);
  assert.ok(Math.abs(p.rig.root.position.x-destination.x)<1e-8);assert.equal(p.rig.root.rotation.y,Math.PI/2);
  const route=engine.routeTo(0,[5,.5],'lounge');assert.ok(route?.length);assert.ok(Math.abs(route.at(-1)[0]-destination.x)<1e-8);
  engine.setOrnaments(moved.filter(o=>o.id!=='lounge-sofa-0'),0,false,'');assert.equal(p.zone,'desk');
});

test('paused attendance always leaves the desk and uses another lounge sofa when its assigned sofa was removed',()=>{
  const engine=office(),items=spaceModel.normalizeSpace(null,[]).ornaments;
  engine.setOrnaments(items.filter(o=>o.id!=='lounge-sofa-5'),0,false,'');
  engine.setMembers([{member:{...alice,status:'working'},slot:10}]);const person=engine.occupants.get('1');
  engine.routeTo=()=>null;
  engine.setMembers([{member:{...alice,status:'paused'},slot:10}]);
  assert.equal(person.zone,'lounge');assert.ok(person.route.length);assert.notEqual(engine.seatItem(10,'lounge'),undefined);
  const destination=engine.destination(10,'lounge'),last=person.route.at(-1);
  assert.deepEqual([last.x,last.z],[destination.x,destination.z]);
  engine.setOrnaments(items.filter(o=>!o.id.startsWith('lounge-sofa-')),0,false,'');
  assert.equal(person.zone,'lounge');assert.ok(person.route.length);
});

test('paused avatars use separate sofa seats and sit at the cushion height',()=>{
  const engine=office(),items=spaceModel.normalizeSpace(null,[]).ornaments;animation(engine);
  engine.setOrnaments(items.filter(o=>o.id!=='lounge-sofa-5'),0,false,'');
  engine.setMembers([{member:{...alice,id:'10',status:'paused'},slot:10},{member:{...alice,id:'11',status:'paused'},slot:11}]);
  const first=engine.occupants.get('10'),second=engine.occupants.get('11'),a=engine.destination(10,'lounge'),b=engine.destination(11,'lounge');
  assert.notDeepEqual([a.x,a.z],[b.x,b.z]);assert.ok(engine.seatItem(10,'lounge'));assert.ok(engine.seatItem(11,'lounge'));
  assert.equal(engine.loungeSeat(10).offset,0);assert.equal(engine.loungeSeat(11).offset,0);
  engine.animateFrame(50);
  assert.ok(Math.abs(first.rig.root.position.y-(.67-.419))<1e-8);assert.ok(Math.abs(second.rig.root.position.y-(.67-.419))<1e-8);
  const hips=new THREE.Vector3();first.rig.model.getObjectByName('Hips').getWorldPosition(hips);
  assert.ok(hips.y>.66&&hips.y<.68,`hips should meet the sofa cushion surface, received ${hips.y}`);
  assert.equal(first.rig.bones.hips.rotation.x,.28);assert.equal(first.rig.bones.spine.rotation.x,-.24);
  assert.equal(first.rig.bones.upperArms[0].rotation.z,-.65);assert.equal(first.rig.bones.upperArms[1].rotation.z,.65);

  const desk=office();animation(desk);desk.setMembers([{member:alice,slot:0}]);desk.animateFrame(50);
  const worker=desk.occupants.get('1');worker.rig.model.getObjectByName('Hips').getWorldPosition(hips);
  assert.equal(worker.rig.root.position.y,.14);assert.ok(hips.y>.55&&hips.y<.6,`desk hips should rest at chair height, received ${hips.y}`);
  assert.equal(worker.rig.bones.upperArms[0].rotation.z,-.12);assert.equal(worker.rig.bones.upperArms[1].rotation.z,.12);

  const shared=office();shared.setMembers([{member:{...alice,id:'0',status:'paused'},slot:0},{member:{...alice,id:'1',status:'paused'},slot:1}]);
  assert.equal(shared.loungeSeat(0).item.id,shared.loungeSeat(1).item.id);
  assert.deepEqual(new Set([shared.loungeSeat(0).offset,shared.loungeSeat(1).offset]),new Set([-.32,.32]));
});


test('corridor glazing has no old mullion and no suspended beam across its workspace opening',()=>{
  const engine=office();
  for(const node of engine.scene.children) {
    if(!(node instanceof THREE.Mesh)) continue;
    const bounds=new THREE.Box3().setFromObject(node);
    assert.ok(!bounds.containsPoint(new THREE.Vector3(6,2.84,-5.7)),'no beam on removed partition');
    if(node.material instanceof THREE.MeshStandardMaterial&&!node.material.transparent) assert.ok(!bounds.containsPoint(new THREE.Vector3(12,1.4,-6)),'no opaque mullion at obsolete room edge');
  }
  assert.ok(engine.scene.children.some(o=>o.userData.architecture==='glass'&&o.position.x===12&&o.position.z===-6.25));
});

test('every meeting seat routes through the workspace corridor and the meeting door in both directions',()=>{
  const engine=office();
  for(let seat=0;seat<6;seat++) {
    const member={...alice,activity:{zone:'meeting',seat,until:Date.now()+900000}};
    engine.setMembers([{member,slot:0}]);
    const destination=engine.destination(0,'meeting');
    const enter=engine.routeTo(0,[5,.5],'meeting');
    assert.ok(enter?.length,`seat ${seat} reachable`);
    assert.ok(enter.some(([x,z])=>x===9&&z===-7.5),`seat ${seat} uses door`);
    assert.deepEqual(Array.from(enter.at(-1)),[destination.x,destination.z]);
    const exit=engine.routeTo(0,[destination.x,destination.z],'exit');
    assert.ok(exit?.some(([x,z])=>x===9&&z===-7.5));
    assert.ok(exit?.some(([x,z])=>x===4.5&&z===6));
    const table=spaceModel.ornamentFootprint(engine.ornaments.find(o=>o.id==='meeting-round-table'));
    for(const [x,z] of [...enter,...exit]) assert.ok(!(x>table.xmin&&x<table.xmax&&z>table.zmin&&z<table.zmax),'route must not pass through round table');
  }
});
test('front camera sits at eye level and looks horizontally toward the office',()=>{
  const engine=office();engine.camera=new THREE.PerspectiveCamera();engine.controls={target:new THREE.Vector3(),update(){}};
  engine.frontView();
  assert.equal(engine.camera.position.y,1.6);assert.equal(engine.controls.target.y,1.6);
  const offset=engine.camera.position.clone().sub(engine.controls.target);
  assert.equal(new THREE.Spherical().setFromVector3(offset).phi,Math.PI/2);
  assert.ok(engine.camera.position.z>6);
});
