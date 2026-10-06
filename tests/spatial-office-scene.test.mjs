import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as model from '../lib/spatial-office/model.ts';
import { spaceModel, loadTS } from './spatial-office-module-loader.mjs';

class Element {
  children = []; dataset = {}; style = {}; textContent = ''; hidden = false;
  append(...items) { this.children.push(...items); }
  appendChild(item) { this.children.push(item); }
  addEventListener() {}
  setAttribute() {}
  remove() {}
}
const { OfficeScene } = loadTS('../lib/spatial-office/scene.ts', {
  three: THREE, 'three/addons/loaders/GLTFLoader.js': { GLTFLoader }, 'three/addons/controls/OrbitControls.js': { OrbitControls },
  'three/addons/utils/BufferGeometryUtils.js': { mergeGeometries }, './model': model, './space': spaceModel,
}, { document: { createElement: () => new Element() }, requestAnimationFrame:()=>0 });
const templates = new Map();
for (const asset of new Set([...model.AVATAR_MODELS, ...Object.keys(spaceModel.ORNAMENTS), 'floor_wood_3m', 'floor_ivory_3m', 'wall_with_window_3m', 'office_desk', 'office_swivel_chair', 'laptop', 'keyboard', 'coffee_mug', 'pinboard', 'sofa', 'drawer_cabinet', 'wood_chair'])) {
  const bytes = await readFile(new URL(`../src/Char-assets/${asset}.glb`, import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  templates.set(asset, gltf.scene);
}
function office() {
  const engine = Object.create(OfficeScene.prototype);
  Object.assign(engine, { scene: new THREE.Scene(), labels: new Element(), templates, desks: new Map(), deskLabels: new Map(), occupants: new Map(), geometries: new Set(), materials: new Set(), roomLabels: [], doors: [], decorations: new Map(), ornaments: [], current: [], room: 0, deskLayout: [], schedule: { timezone: 'Asia/Makassar', days: Array.from({ length: 7 }, (_, day) => ({ day, isWorking: true, startTime: '00:00', endTime: '00:00' })) }, loaded: false, outline: null, options: { onSelect() {}, onSelectDesk() {} } });
  engine.buildRoom(); engine.loaded = true; return engine;
}
const alice = { id: '1', name: 'Alya', status: 'working', project: 'Design' };
test('first snapshot seats existing workers immediately; snapshots retain the same rig', () => {
  const engine = office();
  assert.equal(engine.desks.size, 12); assert.equal(engine.deskLabels.size, 12);
  engine.setMembers([{ member: alice, slot: 0 }]);
  const first = engine.occupants.get('1'), p = model.zonePosition(0, 'desk');
  assert.equal(first.route.length, 0); assert.equal(first.rig.root.position.x, p.x); assert.equal(first.rig.root.position.z, p.z);
  engine.setMembers([{ member: { ...alice }, slot: 0 }]); assert.equal(engine.occupants.get('1').rig, first.rig);
  engine.setMembers([{ member: { ...alice, status: 'paused' }, slot: 0 }]);
  assert.equal(engine.occupants.size,0);
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

function animation(engine) {
  Object.assign(engine,{visible:true,time:0,lastFrame:0,moving:true,skyMinute:Math.floor(Date.now()/60000),clouds:new THREE.Group(),camera:new THREE.PerspectiveCamera(),project:new THREE.Vector3(),host:{clientWidth:1024,clientHeight:768},controls:{update(){}},renderer:{render(){}}});
}
test('initial offline, paused and idle members stay outside; a new check-in enters through front glass',()=>{
  const engine=office(); animation(engine);
  engine.setMembers([{member:{...alice,status:'offline'},slot:0},{member:{...alice,id:'2',status:'paused'},slot:1},{member:{...alice,id:'3',presenceIdle:true},slot:2}]);
  assert.equal(engine.occupants.size,0);
  engine.setMembers([{member:alice,slot:0}]);
  const person=engine.occupants.get('1');
  assert.equal(person.rig.root.position.z,8);
  assert.ok(person.route.some(p=>p.x===4.5&&p.z===6));
  const route=person.route; engine.setMembers([{member:{...alice},slot:0}]); assert.equal(person.route,route);
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
