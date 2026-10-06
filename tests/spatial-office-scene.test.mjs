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
  assert.equal(engine.desks.size, 10); assert.equal(engine.deskLabels.size, 10);
  engine.setMembers([{ member: alice, slot: 0 }]);
  const first = engine.occupants.get('1'), p = model.zonePosition(0, 'desk');
  assert.equal(first.route.length, 0); assert.equal(first.rig.root.position.x, p.x); assert.equal(first.rig.root.position.z, p.z);
  engine.setMembers([{ member: { ...alice }, slot: 0 }]); assert.equal(engine.occupants.get('1').rig, first.rig);
  engine.setMembers([{ member: { ...alice, status: 'paused' }, slot: 0 }]);
  assert.equal(first.zone, 'lounge'); assert.ok(first.route.length > 0);
});
test('claiming another desk retains position and schedules movement, then roster deletion removes avatar only', () => {
  const engine = office(); engine.setMembers([{ member: alice, slot: 0 }]);
  const person = engine.occupants.get('1'), initial = person.rig.root.position.clone();
  engine.setMembers([{ member: alice, slot: 9 }]);
  assert.deepEqual(person.rig.root.position.toArray(), initial.toArray());
  const end = model.zonePosition(9, 'desk'); assert.equal(person.route.at(-1).x, end.x); assert.equal(person.route.at(-1).z, end.z);
  engine.setMembers([]); assert.equal(engine.occupants.size, 0); assert.equal(engine.desks.size, 10);
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

test('sleep pose stays still across frames, shows zzz and hides numbers and offline bubbles', () => {
  const engine=office();
  Object.assign(engine,{schedule:{timezone:'Asia/Makassar',days:[]},visible:true,time:0,lastFrame:0,moving:true,skyMinute:Math.floor(Date.now()/60000),clouds:new THREE.Group(),camera:new THREE.PerspectiveCamera(),project:new THREE.Vector3(),host:{clientWidth:1024,clientHeight:768},controls:{update(){}},renderer:{render(){}}});
  engine.setMembers([{member:{...alice,status:'offline'},slot:0}]);
  const person=engine.occupants.get('1');
  const pose=()=>[...person.rig.body.position.toArray(),...person.rig.head.rotation.toArray(),...person.rig.hands.flatMap(hand=>hand.position.toArray()),...person.rig.legs.flatMap(leg=>leg.rotation.toArray())];
  engine.animateFrame(1000); const before=pose(); engine.animateFrame(1800);
  assert.deepEqual(pose(),before); assert.equal(person.sleep.hidden,false); assert.equal(person.bubble.hidden,true);
  assert.equal(person.zone,'bedroom'); assert.ok(person.rig.root.position.x < -6);
  assert.ok([...engine.deskLabels.values()].every(label=>label.hidden));
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
