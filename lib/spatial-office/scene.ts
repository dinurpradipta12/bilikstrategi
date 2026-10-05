import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { bubbleLabel, deskPosition, memberHash, type OfficeMember } from './model';

const CHARACTERS = ['operations', 'research', 'copywriter', 'designer', 'qa', 'analyst', 'hr', 'finance'];
const FURNITURE = ['floor_wood_3m', 'floor_ivory_3m', 'wall_with_window_3m', 'office_desk', 'office_swivel_chair', 'laptop', 'coffee_mug', 'desk_plant', 'floor_plant', 'bookshelf', 'book_stack', 'sofa', 'side_table', 'area_rug', 'floor_lamp', 'pinboard'];
const ENTRY = new THREE.Vector3(-5.5, 0, 4.75);
const AISLE_Z = 4.75;
type Rig = { root: THREE.Group; body: THREE.Group; head: THREE.Group; arms: THREE.Group[]; legs: THREE.Group[] };
type Occupant = {
  member: OfficeMember; rig: Rig; slot: number; phase: 'entering' | 'seated' | 'leaving';
  route: THREE.Vector3[]; label: HTMLButtonElement; bubble: HTMLSpanElement; name: HTMLSpanElement; offset: number;
};
export type SceneOptions = { onSelect: (id: string) => void; onError: (message: string) => void; onReady: () => void };

export class OfficeScene {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private resize: ResizeObserver;
  private templates = new Map<string, THREE.Group>();
  private occupants = new Map<string, Occupant>();
  private desks = new Map<string, THREE.Group>();
  private deskLabels = new Map<string, HTMLButtonElement>();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private disposed = false;
  private loaded = false;
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
    this.controls.maxDistance = 29;
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
    Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, far: 40 });
    sun.shadow.bias = -0.001;
    sun.shadow.normalBias = 0.04;
    this.scene.add(sun);
    this.resize = new ResizeObserver(() => this.resizeCanvas());
    this.resize.observe(host);
    this.observer = new IntersectionObserver(([entry]) => { this.visible = entry.isIntersecting; });
    this.observer.observe(host);
    this.resizeCanvas();
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

  private buildRoom() {
    for (let x = -3; x <= 3; x += 3) {
      for (let z = -4.5; z <= 4.5; z += 3) this.asset('floor_wood_3m', x, z);
      this.asset('wall_with_window_3m', x, -6);
    }
    for (const z of [-4.5, -1.5, 1.5]) this.asset('wall_with_window_3m', -4.5, z, 0, Math.PI / 2);
    // A real gap on the left is the entrance; no walking through a decorative door.
    this.asset('floor_ivory_3m', -6, 4.5);
    this.asset('floor_plant', -3.8, -5.4);
    this.asset('floor_plant', 3.8, 5.2);
    this.asset('floor_plant', -3.9, 3.1);
    this.asset('sofa', -2, -5.35);
    this.asset('side_table', -0.55, -5.25);
    this.asset('coffee_mug', -0.55, -5.25, 0.59);
    this.asset('bookshelf', 2.45, -5.6);
    this.asset('book_stack', 2.45, -5.55, 1.08);
    this.asset('floor_lamp', 3.6, -5.35);
    this.asset('pinboard', 0.1, -5.9, 0.8);
    const entry = document.createElement('span');
    entry.className = 'office-entry-label';
    entry.textContent = 'MASUK / KELUAR';
    entry.dataset.entry = 'true';
    this.labels.appendChild(entry);
  }

  private rig(member: OfficeMember): Rig {
    const raw = this.templates.get(CHARACTERS[memberHash(member.id) % CHARACTERS.length])!.clone(true);
    const body = new THREE.Group();
    const head = new THREE.Group();
    head.position.set(0, 0, 1.76);
    const arms = [-1, 1].map(side => { const pivot = new THREE.Group(); pivot.position.set(side * 0.50, 0, 1.50); return pivot; });
    const legs = [-1, 1].map(side => { const pivot = new THREE.Group(); pivot.position.set(side * 0.22, 0, 0.86); return pivot; });
    body.add(head, ...arms, ...legs);
    // Source meshes have baked coordinates and identity transforms. Move each
    // named part to a joint without mutating shared GLB geometry or other users.
    const parts: THREE.Mesh[] = [];
    raw.traverse(child => { if (child instanceof THREE.Mesh) parts.push(child); });
    for (const mesh of parts) {
      let pivot = body;
      if (/^(sleeve|hand)_/.test(mesh.name)) pivot = arms[mesh.name.endsWith('_L') ? 0 : 1];
      else if (/^(leg|shoe)_/.test(mesh.name)) pivot = legs[mesh.name.endsWith('_L') ? 0 : 1];
      else if (/^(head|ear_|eye|cheek|nose|mouth|hair|fringe|curl|top_curl|glasses|bob_|earcup|headphone|beret|cap_|long_hair|pink_pigtail)/.test(mesh.name)) pivot = head;
      mesh.userData.sharedTemplate = true;
      mesh.position.sub(pivot.position);
      pivot.add(mesh);
    }
    // Merge each articulated group separately: keep six joints, fewer draw calls.
    for (const pivot of [body, head, ...arms, ...legs]) {
      const meshes = pivot.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh);
      const transformed = meshes.map(mesh => { mesh.updateMatrix(); return mesh.geometry.clone().applyMatrix4(mesh.matrix); });
      const merged = mergeGeometries(transformed);
      transformed.forEach(geometry => geometry.dispose());
      if (merged) {
        meshes.forEach(mesh => pivot.remove(mesh));
        const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
        const mesh = new THREE.Mesh(merged, material); mesh.castShadow = true; mesh.receiveShadow = true;
        pivot.add(mesh); this.geometries.add(merged); this.materials.add(material);
      }
    }
    const converted = new THREE.Group();
    converted.rotation.x = -Math.PI / 2;
    converted.scale.setScalar(0.53);
    converted.add(body);
    const root = new THREE.Group(); root.add(converted); this.scene.add(root);
    return { root, body, head, arms, legs };
  }

  private route(slot: number, leaving: boolean) {
    const desk = deskPosition(slot);
    const seat = new THREE.Vector3(desk.x, 0, desk.z - 0.88);
    const path = [ENTRY.clone(), new THREE.Vector3(0, 0, AISLE_Z), new THREE.Vector3(0, 0, seat.z), seat];
    return leaving ? path.reverse() : path;
  }

  private makeOccupant(member: OfficeMember, slot: number) {
    const label = document.createElement('button');
    label.type = 'button'; label.className = 'office-avatar-label';
    label.addEventListener('click', () => this.options.onSelect(member.id));
    const bubble = document.createElement('span'); bubble.className = 'office-bubble';
    const name = document.createElement('span'); name.className = 'office-name';
    label.append(bubble, name); this.labels.appendChild(label);
    const occupant: Occupant = { member, rig: this.rig(member), slot, label, bubble, name, phase: 'entering', route: this.route(slot, false), offset: memberHash(member.id) % 24 };
    occupant.rig.root.position.copy(ENTRY);
    return occupant;
  }

  setMembers(members: { member: OfficeMember; slot: number }[]) {
    this.current = members;
    if (!this.loaded) return;
    const ids = new Set(members.map(({ member }) => member.id));
    for (const [id, desk] of this.desks) {
      if (!ids.has(id)) { this.scene.remove(desk); this.desks.delete(id); this.deskLabels.get(id)?.remove(); this.deskLabels.delete(id); }
    }
    for (const [id, occupant] of this.occupants) {
      if (!ids.has(id)) { this.removeOccupant(id, occupant); }
    }
    for (const { member, slot } of members) {
      const position = deskPosition(slot);
      if (!this.desks.has(member.id)) {
        const group = new THREE.Group();
        this.scene.add(group);
        group.position.set(position.x, 0, position.z);
        this.asset('office_desk', 0, 0, 0, 0, group);
        this.asset('office_swivel_chair', 0, -0.88, 0, 0, group);
        this.asset('laptop', 0, -0.02, 0.78, Math.PI, group);
        this.asset('coffee_mug', -0.48, 0.04, 0.78, 0, group);
        this.asset('desk_plant', 0.49, -0.14, 0.78, 0, group).scale.setScalar(0.7);
        this.desks.set(member.id, group);
        const label = document.createElement('button'); label.type = 'button'; label.className = 'office-desk-label';
        label.addEventListener('click', () => this.options.onSelect(member.id));
        this.labels.appendChild(label); this.deskLabels.set(member.id, label);
      }
      this.deskLabels.get(member.id)!.textContent = member.name;
      this.desks.get(member.id)!.position.set(position.x, 0, position.z);
      let occupant = this.occupants.get(member.id);
      if (member.status !== 'offline') {
        if (!occupant) { occupant = this.makeOccupant(member, slot); this.occupants.set(member.id, occupant); }
        else if (occupant.phase === 'leaving' || occupant.slot !== slot) {
          // Reverse safely via the aisle if a user checks in while still exiting.
          occupant.phase = 'entering';
          occupant.route = [new THREE.Vector3(0, 0, occupant.rig.root.position.z), ...this.route(slot, false).slice(2)];
        }
      } else if (occupant && occupant.phase !== 'leaving') {
        occupant.phase = 'leaving';
        occupant.route = [new THREE.Vector3(0, 0, occupant.rig.root.position.z), new THREE.Vector3(0, 0, AISLE_Z), ENTRY.clone()];
      }
      if (occupant) {
        occupant.member = member; occupant.slot = slot;
        occupant.name.textContent = member.name;
        occupant.label.setAttribute('aria-label', `${member.name}, ${member.status === 'paused' ? 'istirahat' : member.status === 'offline' ? 'keluar kantor' : 'sudah check-in'}`);
      }
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
  resetCamera() { this.camera.position.set(10.1, 11.55, 14.55); this.controls.target.set(-0.25, 0.4, 0); this.controls.update(); }
  zoom(direction: number) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    offset.setLength(THREE.MathUtils.clamp(offset.length() * (direction > 0 ? 0.84 : 1.19), 9, 29));
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
      const phase = occupant.phase;
      if (phase !== 'seated') {
        if (!this.moving) {
          if (phase === 'leaving') { this.removeOccupant(id, occupant); continue; }
          rig.root.position.copy(this.route(occupant.slot, false).at(-1)!);
          occupant.route = []; occupant.phase = 'seated';
        } else {
          const next = occupant.route[0];
          if (next) {
            const delta = next.clone().sub(rig.root.position); delta.y = 0;
            const step = dt * 2.25;
            if (delta.length() <= step) { rig.root.position.copy(next); occupant.route.shift(); }
            else {
              rig.root.position.add(delta.normalize().multiplyScalar(step));
              rig.root.rotation.y = Math.atan2(delta.x, delta.z);
            }
          } else if (phase === 'leaving') { this.removeOccupant(id, occupant); continue; }
          else occupant.phase = 'seated';
        }
      }
      const seated = occupant.phase === 'seated';
      const working = seated && member.status === 'working';
      const t = this.time + occupant.offset;
      rig.body.position.z = seated ? 0.15 : this.moving ? Math.abs(Math.sin(t * 8)) * 0.045 : 0;
      rig.head.rotation.x = working && this.moving ? 0.045 + Math.sin(t * 1.7) * 0.025 : 0;
      rig.head.rotation.z = seated && this.moving ? Math.sin(t * 0.6) * 0.045 : 0;
      rig.arms.forEach((arm, index) => { arm.rotation.x = seated ? (working ? -1.1 : -0.2) + (working && this.moving ? Math.sin(t * 9 + index * Math.PI) * 0.085 : 0) : Math.sin(t * 8 + index * Math.PI) * 0.35; });
      rig.legs.forEach((leg, index) => { leg.rotation.x = seated ? -1.12 : Math.sin(t * 8 + index * Math.PI) * 0.4; });
      if (seated) rig.root.rotation.y = 0;
      occupant.bubble.textContent = seated ? bubbleLabel(member) : occupant.phase === 'leaving' ? '👋 Selesai bekerja' : '🚶 Menuju meja';
      const bubbleVisible = !seated || id === this.selected || (this.moving && (t % 16 < 4));
      occupant.bubble.hidden = !bubbleVisible;
      occupant.label.dataset.selected = String(id === this.selected);
      occupant.label.dataset.paused = String(member.status === 'paused');
      this.placeLabel(occupant.label, rig.root.position.clone().add(new THREE.Vector3(0, 1.86, 0)));
    }
    for (const { member, slot } of this.current) {
      const label = this.deskLabels.get(member.id);
      if (!label) continue;
      label.hidden = this.occupants.has(member.id);
      label.dataset.selected = String(member.id === this.selected);
      const { x, z } = deskPosition(slot);
      this.placeLabel(label, new THREE.Vector3(x, 0.84, z));
    }
    const entry = this.labels.querySelector<HTMLElement>('[data-entry]');
    if (entry) this.placeLabel(entry, new THREE.Vector3(-5.6, 0.05, 5.3));
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resize.disconnect(); this.observer.disconnect(); this.controls.dispose();
    this.renderer.domElement.removeEventListener('webglcontextlost', this.contextLost);
    this.geometries.forEach(geometry => geometry.dispose());
    this.materials.forEach(material => material.dispose());
    this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove();
    this.labels.replaceChildren();
  }
}
