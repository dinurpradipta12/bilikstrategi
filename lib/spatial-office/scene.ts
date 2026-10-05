import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ornamentError, type Ornament } from './space';
import { AVATAR_MODELS, defaultAvatar, bubbleLabel, DESKS_PER_ROOM, deskPosition, memberHash, memberZone, travelPath, typingHand, zonePosition, type OfficeZone, type OfficeMember } from './model';

const CHARACTERS = [...AVATAR_MODELS];
const FURNITURE = ['floor_wood_3m', 'floor_ivory_3m', 'wall_with_window_3m', 'office_desk', 'office_swivel_chair', 'laptop', 'coffee_mug', 'desk_plant', 'floor_plant', 'bookshelf', 'book_stack', 'sofa', 'side_table', 'area_rug', 'floor_lamp', 'pinboard', 'keyboard', 'drawer_cabinet', 'whiteboard', 'flower_vase', 'wood_chair'];
type Rig = { root: THREE.Group; body: THREE.Group; head: THREE.Group; arms: THREE.Group[]; hands: THREE.Group[]; mug: THREE.Group; legs: THREE.Group[] };
type Occupant = {
  member: OfficeMember; rig: Rig; slot: number; zone: OfficeZone; style: string;
  route: THREE.Vector3[]; label: HTMLButtonElement; bubble: HTMLSpanElement; name: HTMLSpanElement; offset: number;
};
export type SceneOptions = { onSelect: (id: string) => void; onError: (message: string) => void; onReady: () => void; onSelectDesk: (slot: number) => void; onSelectOrnament: (id: string) => void; onMoveOrnament: (id: string, x: number, z: number) => void };

export class OfficeScene {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private resize: ResizeObserver;
  private templates = new Map<string, THREE.Group>();
  private occupants = new Map<string, Occupant>();
  private desks = new Map<number, THREE.Group>();
  private deskLabels = new Map<number, HTMLButtonElement>();
  private room = 0;
  private decorations = new Map<string, THREE.Group>();
  private ornaments: Ornament[] = [];
  private editMode = false;
  private selectedOrnament = '';
  private dragging: { id: string; dx: number; dz: number } | null = null;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private outline: THREE.BoxHelper | null = null;
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private disposed = false;
  private loaded = false;
  private roomLabels: { element: HTMLElement; position: THREE.Vector3 }[] = [];
  private doors: { group: THREE.Group; center: THREE.Vector3 }[] = [];
  private current: { member: OfficeMember; slot: number }[] = [];
  private raf = 0;
  private lastFrame = 0;
  private time = 0;
  private moving = true;
  private selected = '';
  private project = new THREE.Vector3();
  private visible = true;
  private observer: IntersectionObserver;
  private contextLost = (event: Event) => { event.preventDefault(); this.options.onError('Tampilan 3D terhenti. Muat ulang tampilan atau gunakan daftar tim.'); };

  constructor(private host: HTMLElement, private labels: HTMLElement, private options: SceneOptions) {
    this.scene.background = new THREE.Color('#eeeae3');
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.setAttribute('aria-label', 'Kantor 3D. Seret untuk memutar; gunakan tombol kamera untuk memperbesar. Daftar anggota tersedia setelah tampilan ini.');
    this.renderer.domElement.setAttribute('role', 'img');
    this.renderer.domElement.addEventListener('webglcontextlost', this.contextLost);
    host.appendChild(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 9;
    this.controls.maxDistance = 65;
    this.controls.minPolarAngle = 0.35;
    this.controls.maxPolarAngle = 1.2;
    this.controls.minAzimuthAngle = -Math.PI * 0.46;
    this.controls.maxAzimuthAngle = Math.PI * 0.46;
    this.resetCamera();
    this.scene.add(new THREE.HemisphereLight('#fff5e4', '#a3aaa3', 1.5));
    const sun = new THREE.DirectionalLight('#fff4df', 2);
    sun.position.set(-6, 12, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 15, bottom: -15, far: 40 });
    sun.shadow.bias = -0.001;
    sun.shadow.normalBias = 0.04;
    this.scene.add(sun);
    this.resize = new ResizeObserver(() => this.resizeCanvas());
    this.resize.observe(host);
    this.observer = new IntersectionObserver(([entry]) => { this.visible = entry.isIntersecting; });
    this.observer.observe(host);
    this.resizeCanvas();
    this.renderer.domElement.addEventListener('pointerdown', this.pointerDown, true);
    this.renderer.domElement.addEventListener('pointermove', this.pointerMove, true);
    this.renderer.domElement.addEventListener('pointerup', this.pointerUp, true);
    this.renderer.domElement.addEventListener('pointercancel', this.pointerUp, true);
    void this.load();
    this.raf = requestAnimationFrame(this.animate);
  }

  private resizeCanvas() {
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    if (!width || !height) return;
    this.camera.aspect = width / height;
    // Preserve the full room on portrait screens; zoom controls remain available.
    this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(35) / 2) * Math.max(1, 1.45 / this.camera.aspect)));
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private track(object: THREE.Object3D) {
    object.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return;
      this.geometries.add(child.geometry);
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) this.materials.add(material);
      child.castShadow = true;
      child.receiveShadow = true;
    });
  }

  private async load() {
    const loader = new GLTFLoader();
    try {
      await Promise.all([...CHARACTERS, ...FURNITURE].map(async name => {
        const gltf = await loader.loadAsync(`/spatial-assets/${name}.glb`);
        if (this.disposed) {
          gltf.scene.traverse(child => { if (child instanceof THREE.Mesh) { child.geometry.dispose(); for (const m of Array.isArray(child.material) ? child.material : [child.material]) m.dispose(); } });
          return;
        }
        // Furniture is static; merge vertex-coloured meshes to reduce draw calls.
        if (FURNITURE.includes(name)) {
          gltf.scene.updateMatrixWorld(true);
          const geometries: THREE.BufferGeometry[] = [];
          gltf.scene.traverse(child => {
            if (child instanceof THREE.Mesh) geometries.push(child.geometry.clone().applyMatrix4(child.matrixWorld));
          });
          const merged = mergeGeometries(geometries);
          geometries.forEach(geometry => geometry.dispose());
          if (merged) {
            const group = new THREE.Group();
            group.add(new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })));
            this.templates.set(name, group);
            this.track(group);
          } else {
            this.templates.set(name, gltf.scene); this.track(gltf.scene);
          }
          if (merged) gltf.scene.traverse(child => { if (child instanceof THREE.Mesh) { child.geometry.dispose(); for (const m of Array.isArray(child.material) ? child.material : [child.material]) m.dispose(); } });
        } else { this.templates.set(name, gltf.scene); this.track(gltf.scene); }
      }));
      if (this.disposed) return;
      this.buildRoom();
      this.loaded = true;
      this.setMembers(this.current);
      this.setOrnaments(this.ornaments, this.room, this.editMode, this.selectedOrnament);
      this.options.onReady();
    } catch {
      if (!this.disposed) this.options.onError('Aset kantor belum dapat dimuat. Coba muat ulang tampilan 3D.');
    }
  }

  private asset(name: string, x: number, z: number, y = 0, rotation = 0, parent: THREE.Object3D = this.scene) {
    const model = this.templates.get(name)!.clone(true);
    model.rotation.x = -Math.PI / 2;
    const group = new THREE.Group();
    group.add(model);
    group.position.set(x, y, z);
    group.rotation.y = rotation;
    parent.add(group);
    return group;
  }

  private box(x: number, y: number, z: number, w: number, h: number, d: number, color: string, opacity = 1) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.7, transparent: opacity < 1, opacity, depthWrite: opacity === 1 }));
    mesh.position.set(x, y, z); this.scene.add(mesh); this.track(mesh); mesh.castShadow = opacity === 1;
    return mesh;
  }

  private glass(x: number, z: number, length: number, rotate = false, door = false) {
    const frame = '#718b81';
    this.box(x, 2.78, z, rotate ? 0.08 : length, 0.10, rotate ? length : 0.08, frame);
    for (const side of [-1, 1]) this.box(x + (rotate ? 0 : side * length / 2), 1.4, z + (rotate ? side * length / 2 : 0), 0.07, 2.8, 0.07, frame);
    const panel = this.box(x, 1.37, z, rotate ? 0.045 : length - 0.05, 2.68, rotate ? length - 0.05 : 0.045, '#a7c6ba', 0.13);
    if (door) {
      const group = new THREE.Group(); group.position.set(x, 0, z); this.scene.add(group);
      panel.position.x -= x; panel.position.z -= z; group.add(panel);
      this.doors.push({ group, center: new THREE.Vector3(x, 0, z) });
    } else this.box(x, 0.08, z, rotate ? 0.08 : length, 0.16, rotate ? length : 0.08, frame);
  }

  private buildRoom() {
    for (const x of [-4.5, -1.5, 1.5, 4.5, 7.5, 10.5]) {
      for (const z of [-4.5, -1.5, 1.5, 4.5]) this.asset(x > 6 ? 'floor_ivory_3m' : 'floor_wood_3m', x, z);
      this.asset('wall_with_window_3m', x, -6); this.glass(x, 6, 3);
    }
    for (const z of [-4.5, -1.5, 1.5, 4.5]) {
      if (z < 4.5) this.asset('wall_with_window_3m', -6, z, 0, Math.PI / 2); else this.glass(-6, z, 3, true, true);
      this.glass(12, z, 3, true);
    }
    this.glass(6, -3.125, 5.75, true); this.glass(6, 0.5, 1.5, true, true);
    this.glass(6, 2.15, 1.8, true); this.glass(6, 3.8, 1.5, true, true); this.glass(6, 5.275, 1.45, true);
    this.glass(9, 1.5, 6);
    this.box(3, 2.87, 0, 18, 0.035, 12, '#d9e3da', 0.025);
    for (const x of [-6, 6, 12]) this.box(x, 2.84, 0, 0.09, 0.10, 12, '#799084');
    this.asset('pinboard', 0, -5.9, 0.8);
    for (let slot = 0; slot < DESKS_PER_ROOM; slot++) {
      const p = deskPosition(slot), group = new THREE.Group();
      group.position.set(p.x, 0, p.z); group.rotation.y = p.rotation; this.scene.add(group); this.desks.set(slot, group);
      this.asset('office_desk', 0, 0, 0, 0, group);
      this.asset('office_swivel_chair', 0, -0.78, 0, 0, group);
      this.asset('laptop', 0, 0.12, 0.78, Math.PI, group);
      this.asset('keyboard', 0, -0.27, 0.78, Math.PI, group);
      this.asset('coffee_mug', -0.48, 0.04, 0.78, 0, group);
      const label = document.createElement('button'); label.type = 'button'; label.className = 'office-desk-label';
      label.addEventListener('click', () => this.options.onSelectDesk(this.room * DESKS_PER_ROOM + slot));
      this.labels.appendChild(label); this.deskLabels.set(slot, label);
    }
    for (const [x, z] of [[7, -4.7], [9, -4.7], [11, -4.7], [7, -1.4], [11, -1.4]]) this.asset('sofa', x, z);
    for (const x of [7.2, 9, 10.8]) {
      const cabinet = this.asset('drawer_cabinet', x, 5.6); cabinet.scale.set(1.8, 0.65, 1);
      this.asset('coffee_mug', x - 0.25, 5.55, 0.94);
    }
    this.box(10.8, 1.15, 5.55, 0.44, 0.43, 0.32, '#344c43');
    this.box(10.8, 1.16, 5.37, 0.30, 0.12, 0.06, '#d8bd89');
    // Street, sidewalk and a planted pocket garden outside the glazed office.
    this.box(5, -0.18, 2, 36, 0.2, 27, '#c4d3b1');
    this.box(4.5, -0.055, 7, 31, 0.12, 2, '#dedbd0');
    this.box(4.5, -0.09, 10.5, 31, 0.08, 5, '#727d7c');
    for (let x = -10; x < 20; x += 3) this.box(x, -0.042, 10.5, 1.5, 0.01, 0.09, '#efe7c6');
    for (let z = 8.6; z < 12.5; z += 0.65) this.box(-4.5, -0.035, z, 2, 0.015, 0.32, '#fff9e8');
    this.box(15.5, -0.04, 0, 6.4, 0.12, 12, '#9fb881');
    this.box(15.5, 0.03, 1.9, 6.4, 0.08, 1.1, '#dfd8c4');
    this.box(15.5, 0.03, 4.15, 1.1, 0.08, 3.4, '#dfd8c4');
    for (const [x, z] of [[13.2, -4.8], [17.5, -4.8], [17.5, 0], [17.5, 4.8]]) this.asset('floor_plant', x, z).scale.setScalar(2.3);
    this.asset('sofa', 14.5, -1.2); this.asset('side_table', 16, -1.2);
    for (const x of [-8, 20]) { this.box(x, 1.5, 7.3, 0.12, 3, 0.12, '#4f6660'); this.box(x, 3, 7.3, 0.6, 0.12, 0.6, '#f2e8ba'); }
    for (const [text, x, z] of [['WORKSPACE · 10 MEJA', 0, -4], ['LOUNGE', 9, -5.6], ['PANTRY', 9, 2], ['OFFICE GARDEN', 15.5, -3], ['BILIK STREET', 7, 11.5]] as const) {
      const element = document.createElement('span'); element.className = 'office-entry-label'; element.textContent = text;
      this.labels.appendChild(element); this.roomLabels.push({ element, position: new THREE.Vector3(x, 0.12, z) });
    }
  }

  setOrnaments(items: Ornament[], room: number, editing: boolean, selected: string) {
    this.ornaments = items; this.room = room; this.editMode = editing; this.selectedOrnament = selected;
    if (!editing && this.dragging) { this.dragging = null; this.controls.enabled = true; }
    if (!this.loaded) return;
    const visible = items.filter(item => item.room === room), ids = new Set(visible.map(item => item.id));
    for (const [id, group] of this.decorations) if (!ids.has(id)) { this.scene.remove(group); this.decorations.delete(id); }
    for (const item of visible) {
      let group = this.decorations.get(item.id);
      if (group && group.userData.asset !== item.asset) { this.scene.remove(group); this.decorations.delete(item.id); group = undefined; }
      if (!group) { group = this.asset(item.asset, item.x, item.z); group.userData.ornamentId = item.id; group.userData.asset = item.asset; this.decorations.set(item.id, group); }
      group.position.set(item.x, 0, item.z); group.rotation.y = item.rotation;
    }
    const object = editing ? this.decorations.get(selected) : undefined;
    if (object) {
      if (!this.outline) { this.outline = new THREE.BoxHelper(object, '#d49745'); this.scene.add(this.outline); }
      this.outline.visible = true; this.outline.setFromObject(object);
      this.outline.material.color.set(ornamentError(items.find(item => item.id === selected)!) ? '#db6c60' : '#d49745');
    } else if (this.outline) this.outline.visible = false;
  }
  private floorPoint(event: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
  }
  private pointerDown = (event: PointerEvent) => {
    if (!this.editMode || event.button !== 0) return;
    const point = this.floorPoint(event); if (!point) return;
    const hit = this.raycaster.intersectObjects([...this.decorations.values()], true)[0];
    if (!hit) return;
    let object: THREE.Object3D | null = hit.object;
    while (object && !object.userData.ornamentId) object = object.parent;
    if (!object) return;
    event.stopImmediatePropagation(); this.controls.enabled = false;
    this.dragging = { id: object.userData.ornamentId, dx: object.position.x - point.x, dz: object.position.z - point.z };
    this.renderer.domElement.setPointerCapture(event.pointerId); this.options.onSelectOrnament(this.dragging.id);
  };
  private pointerMove = (event: PointerEvent) => {
    if (!this.dragging || !this.editMode) return;
    const point = this.floorPoint(event); if (!point) return;
    event.stopImmediatePropagation();
    const x = Math.round((point.x + this.dragging.dx) * 4) / 4, z = Math.round((point.z + this.dragging.dz) * 4) / 4;
    this.options.onMoveOrnament(this.dragging.id, THREE.MathUtils.clamp(x, -5.5, 18.5), THREE.MathUtils.clamp(z, -5.5, 5.5));
  };
  private pointerUp = (event: PointerEvent) => {
    if (!this.dragging) return;
    event.stopImmediatePropagation(); this.dragging = null; this.controls.enabled = true;
    if (this.renderer.domElement.hasPointerCapture(event.pointerId)) this.renderer.domElement.releasePointerCapture(event.pointerId);
  };

  private rig(member: OfficeMember): Rig {
    const style = member.avatar || defaultAvatar(member.id);
    const body = new THREE.Group();
    const head = new THREE.Group(); head.position.set(0, 0, 1.76);
    const arms = [-1, 1].map(() => new THREE.Group());
    const hands = [-1, 1].map(() => new THREE.Group());
    const legs = [-1, 1].map(side => { const pivot = new THREE.Group(); pivot.position.set(side * 0.22, 0, 0.86); return pivot; });
    body.add(head, ...arms, ...hands, ...legs);
    const hair = /^(hair|fringe|curl|top_curl|bob_|long_hair|pink_pigtail)/;
    const accessory = /^(glasses|earcup|headphone|beret|cap_)/;
    const parts: THREE.Mesh[] = [];
    this.templates.get(style.model)!.traverse(child => { if (child instanceof THREE.Mesh && !hair.test(child.name) && !accessory.test(child.name)) parts.push(child.clone()); });
    this.templates.get(style.hair)!.traverse(child => { if (child instanceof THREE.Mesh && (hair.test(child.name) || (accessory.test(child.name) && !child.name.startsWith('glasses')))) parts.push(child.clone()); });
    if (style.glasses) this.templates.get('designer')!.traverse(child => { if (child instanceof THREE.Mesh && child.name.startsWith('glasses')) parts.push(child.clone()); });
    for (const mesh of parts) {
      mesh.geometry = mesh.geometry.clone();
      const color = hair.test(mesh.name) ? style.hairColor : /shirt|sleeve/.test(mesh.name) ? style.shirtColor : 'original';
      if (color !== 'original') {
        const rgb = new THREE.Color(color); const attr = mesh.geometry.getAttribute('color');
        if (attr) for (let i = 0; i < attr.count; i++) attr.setXYZ(i, rgb.r, rgb.g, rgb.b);
      }
      let pivot = body;
      if (/^(sleeve|hand)_/.test(mesh.name)) {
        pivot = (mesh.name.startsWith('hand') ? hands : arms)[mesh.name.endsWith('_L') ? 0 : 1];
        mesh.geometry.computeBoundingBox(); mesh.geometry.translate(...mesh.geometry.boundingBox!.getCenter(new THREE.Vector3()).negate().toArray());
      } else {
        if (/^(leg|shoe)_/.test(mesh.name)) pivot = legs[mesh.name.endsWith('_L') ? 0 : 1];
        else if (/^(head|ear_|eye|cheek|nose|mouth|glasses)/.test(mesh.name) || hair.test(mesh.name) || accessory.test(mesh.name)) pivot = head;
        mesh.position.sub(pivot.position);
      }
      pivot.add(mesh);
    }
    for (const pivot of [body, head, ...arms, ...hands, ...legs]) {
      const meshes = pivot.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh);
      if (!meshes.length) continue;
      const transformed = meshes.map(mesh => { mesh.updateMatrix(); return mesh.geometry.clone().applyMatrix4(mesh.matrix); });
      const merged = mergeGeometries(transformed);
      transformed.forEach(geometry => geometry.dispose());
      if (merged) {
        meshes.forEach(mesh => { pivot.remove(mesh); mesh.geometry.dispose(); });
        const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
        const mesh = new THREE.Mesh(merged, material); mesh.castShadow = true; mesh.receiveShadow = true;
        pivot.add(mesh); this.geometries.add(merged); this.materials.add(material);
      } else meshes.forEach(mesh => { mesh.userData.sharedTemplate = true; this.geometries.add(mesh.geometry); });
    }
    const converted = new THREE.Group(); converted.rotation.x = -Math.PI / 2; converted.scale.setScalar(0.53); converted.add(body);
    const root = new THREE.Group(); root.add(converted); this.scene.add(root);
    const mug = this.asset('coffee_mug', 0.26, 0.3, 0.83, 0, root); mug.visible = false;
    mug.traverse(child => { child.userData.sharedTemplate = true; });
    return { root, body, head, arms, hands, legs, mug };
  }

  private changeZone(occupant: Occupant, zone: OfficeZone) {
    const p = occupant.rig.root.position;
    occupant.route = travelPath(occupant.slot, [p.x, p.z], zone).map(([x, z]) => new THREE.Vector3(x, 0, z));
    occupant.zone = zone;
  }


  private makeOccupant(member: OfficeMember, slot: number) {
    const label = document.createElement('button');
    label.type = 'button'; label.className = 'office-avatar-label';
    label.addEventListener('click', () => this.options.onSelect(member.id));
    const bubble = document.createElement('span'); bubble.className = 'office-bubble';
    const name = document.createElement('span'); name.className = 'office-name';
    label.append(bubble, name); this.labels.appendChild(label);
    const occupant: Occupant = { member, rig: this.rig(member), slot, label, bubble, name, zone: memberZone(member, Date.now()), style: JSON.stringify(member.avatar), route: [], offset: memberHash(member.id) % 24 };
    const p = zonePosition(slot, occupant.zone);
    occupant.rig.root.position.set(p.x, 0, p.z); occupant.rig.root.rotation.y = p.rotation;
    return occupant;
  }

  setMembers(members: { member: OfficeMember; slot: number }[]) {
    this.current = members;
    if (!this.loaded) return;
    const ids = new Set(members.map(({ member }) => member.id));
    for (const [id, occupant] of this.occupants) {
      if (!ids.has(id)) { this.removeOccupant(id, occupant); }
    }
    for (const { member, slot } of members) {
      let occupant = this.occupants.get(member.id);
      if (occupant && occupant.style !== JSON.stringify(member.avatar)) {
        const position = occupant.rig.root.position.clone(), rotation = occupant.rig.root.rotation.y;
        this.removeOccupant(member.id, occupant);
        const replacement = this.makeOccupant(member, slot);
        replacement.rig.root.position.copy(position); replacement.rig.root.rotation.y = rotation;
        replacement.zone = occupant.zone; replacement.route = occupant.route; replacement.slot = occupant.slot;
        occupant = replacement; this.occupants.set(member.id, occupant);
      }
      // First snapshot (including returning to this dashboard) restores the seat.
      // Only an observed status/timer change walks to another zone.
      if (!occupant) { occupant = this.makeOccupant(member, slot); this.occupants.set(member.id, occupant); }
      const previousSlot = occupant.slot;
      if (previousSlot !== slot) {
        const position = occupant.rig.root.position, zone = memberZone(member, Date.now());
        occupant.route = travelPath(slot, [position.x, position.z], zone, previousSlot).map(([x, z]) => new THREE.Vector3(x, 0, z)); occupant.zone = zone;
      }
      occupant.member = member; occupant.slot = slot; occupant.name.textContent = member.name;
      occupant.label.setAttribute('aria-label', `${member.name}, ${member.status === 'paused' ? 'istirahat' : member.status === 'offline' ? 'offline di lounge' : 'sudah check-in'}`);
      const zone = memberZone(member, Date.now()); if (zone !== occupant.zone) this.changeZone(occupant, zone);
    }
  }

  private removeOccupant(id: string, occupant: Occupant) {
    this.scene.remove(occupant.rig.root);
    occupant.rig.root.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return;
      // Merged rig parts are owned by this instance, template geometry is shared.
      if (!child.userData.sharedTemplate) {
        child.geometry.dispose(); this.geometries.delete(child.geometry);
        for (const material of Array.isArray(child.material) ? child.material : [child.material]) { material.dispose(); this.materials.delete(material); }
      }
    });
    occupant.label.remove(); this.occupants.delete(id);
  }

  setMotion(enabled: boolean) { this.moving = enabled; }
  select(id: string) { this.selected = id; }
  resetCamera() { this.camera.position.set(23, 23, 31); this.controls.target.set(5, 0.4, 1.8); this.controls.update(); }
  focus(zone: OfficeZone | 'garden') { const x = zone === 'desk' ? 0 : zone === 'garden' ? 15.5 : 9, z = zone === 'pantry' ? 3.8 : zone === 'lounge' ? -2.5 : 0; this.controls.target.set(x, 0.5, z); this.camera.position.set(x + 5, 9, z + 9); this.controls.update(); }
  zoom(direction: number) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    offset.setLength(THREE.MathUtils.clamp(offset.length() * (direction > 0 ? 0.84 : 1.19), 9, 65));
    this.camera.position.copy(this.controls.target).add(offset); this.controls.update();
  }

  private placeLabel(element: HTMLElement, position: THREE.Vector3) {
    this.project.copy(position).project(this.camera);
    const inFrame = Math.abs(this.project.x) < 1.1 && Math.abs(this.project.y) < 1.1 && this.project.z < 1;
    element.style.visibility = inFrame ? 'visible' : 'hidden';
    element.style.left = `${(this.project.x * 0.5 + 0.5) * this.host.clientWidth}px`;
    element.style.top = `${(-this.project.y * 0.5 + 0.5) * this.host.clientHeight}px`;
  }

  private animate = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.animate);
    if (now - this.lastFrame < 1000 / 30 || document.hidden || !this.visible) return;
    const dt = Math.min((now - (this.lastFrame || now)) / 1000, 0.05);
    this.lastFrame = now;
    if (this.moving) this.time += dt;
    for (const [id, occupant] of this.occupants) {
      const { rig, member } = occupant;
      const zone = memberZone(member, Date.now()); if (zone !== occupant.zone) this.changeZone(occupant, zone);
      const destination = zonePosition(occupant.slot, occupant.zone);
      if (!this.moving && occupant.route.length) { rig.root.position.set(destination.x, 0, destination.z); occupant.route = []; }
      const next = occupant.route[0];
      if (next) {
        const delta = next.clone().sub(rig.root.position); delta.y = 0;
        const step = dt * 2.25;
        if (delta.length() <= step) { rig.root.position.copy(next); occupant.route.shift(); }
        else { rig.root.position.add(delta.normalize().multiplyScalar(step)); rig.root.rotation.y = Math.atan2(delta.x, delta.z); }
      }
      const settled = !occupant.route.length;
      const working = settled && occupant.zone === 'desk';
      const seated = settled && occupant.zone !== 'pantry';
      const t = this.time + occupant.offset;
      rig.body.position.z = seated ? 0.15 : this.moving ? Math.abs(Math.sin(t * 8)) * (settled ? 0.005 : 0.045) : 0;
      rig.head.rotation.x = working && this.moving ? 0.045 + Math.sin(t * 1.7) * 0.025 : 0;
      rig.head.rotation.z = seated && this.moving ? Math.sin(t * 0.6) * 0.045 : 0;
      const coffee = settled && occupant.zone === 'pantry';
      const sip = coffee && this.moving ? Math.max(0, Math.sin(t * 0.9)) : 0;
      rig.mug.position.set(0.26, 0.83 + sip * 0.27, 0.3 - sip * 0.06);
      rig.mug.rotation.x = sip * 0.3;
      if (coffee) rig.head.rotation.x = -sip * 0.05;
      rig.hands.forEach((hand, index) => {
        const side = index ? 1 : -1;
        // Keyboard top = 0.843m. Hands are 0.15 source-units high: their
        // lower surface stays on the keys, while lateral motion suggests typing.
        const tap = working && this.moving ? Math.sin(t * 9 + index * Math.PI) * 0.015 : 0;
        if (working) hand.position.set(...typingHand(index, rig.body.position.z, tap));
        else hand.position.set(side * 0.57, settled && occupant.zone === 'pantry' ? -0.5 : seated ? -0.32 : Math.sin(t * 8 + index * Math.PI) * 0.17, settled && occupant.zone === 'pantry' ? 1.58 : 0.95);
        if (coffee && index === 1) hand.position.set(0.26 / 0.53, -rig.mug.position.z / 0.53, (rig.mug.position.y + 0.035) / 0.53 - rig.body.position.z);
        const shoulder = new THREE.Vector3(side * 0.5, 0, 1.5);
        const delta = hand.position.clone().sub(shoulder);
        rig.arms[index].position.copy(shoulder).add(hand.position).multiplyScalar(0.5);
        rig.arms[index].quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), delta.clone().normalize());
        rig.arms[index].scale.set(0.72, 0.72, delta.length() / 0.74);
      });
      rig.legs.forEach((leg, index) => { leg.rotation.x = seated ? -1.12 : settled ? 0 : Math.sin(t * 8 + index * Math.PI) * 0.4; });
      rig.mug.visible = settled && occupant.zone === 'pantry';
      if (settled) rig.root.rotation.y = destination.rotation;
      const text = settled ? bubbleLabel(member, occupant.zone, this.moving ? Date.now() : 0) : occupant.zone === 'desk' ? 'Menuju meja kerja' : occupant.zone === 'lounge' ? 'Menuju ruang istirahat' : 'Menuju pantry · animasi kopi';
      if (occupant.bubble.textContent !== text) occupant.bubble.textContent = text;
      occupant.bubble.hidden = settled && id !== this.selected && (!this.moving || t % 16 >= 4);
      occupant.label.dataset.zone = occupant.zone;
      occupant.label.dataset.walking = String(!settled);
      occupant.label.dataset.status = member.status;
      occupant.label.dataset.selected = String(id === this.selected);
      occupant.label.dataset.paused = String(member.status === 'paused');
      this.placeLabel(occupant.label, rig.root.position.clone().add(new THREE.Vector3(0, 1.86, 0)));
    }
    for (const [slot, label] of this.deskLabels) {
      const occupant = this.current.find(item => item.slot % DESKS_PER_ROOM === slot);
      const number = this.room * DESKS_PER_ROOM + slot + 1;
      label.hidden = this.editMode;
      const text = `${String(number).padStart(2, '0')}${occupant ? '' : ' + '}`;
      label.title = occupant ? `Meja ${number} · ${occupant.member.name}` : `Klaim meja ${number}`;
      if (label.textContent !== text) label.textContent = text;
      label.dataset.selected = String(occupant?.member.id === this.selected);
      label.dataset.vacant = String(!occupant);
      label.setAttribute('aria-label', `Meja ${number}, ${occupant ? `milik ${occupant.member.name}` : 'kosong, bisa diklaim'}`);
      const { x, z } = deskPosition(slot); this.placeLabel(label, new THREE.Vector3(x, 0.88, z));
    }
    for (const label of this.roomLabels) this.placeLabel(label.element, label.position);
    for (const door of this.doors) {
      const open = [...this.occupants.values()].some(occupant => occupant.route.length && occupant.rig.root.position.distanceTo(door.center) < 1.7);
      door.group.position.z = THREE.MathUtils.damp(door.group.position.z, door.center.z + (open ? 1.5 : 0), 9, dt);
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resize.disconnect(); this.observer.disconnect(); this.controls.dispose();
    this.renderer.domElement.removeEventListener('webglcontextlost', this.contextLost);
    this.renderer.domElement.removeEventListener('pointerdown', this.pointerDown, true);
    this.renderer.domElement.removeEventListener('pointermove', this.pointerMove, true);
    this.renderer.domElement.removeEventListener('pointerup', this.pointerUp, true);
    this.renderer.domElement.removeEventListener('pointercancel', this.pointerUp, true);
    this.outline?.geometry.dispose(); this.outline?.material.dispose();
    this.geometries.forEach(geometry => geometry.dispose());
    this.materials.forEach(material => material.dispose());
    this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove();
    this.labels.replaceChildren();
  }
}
