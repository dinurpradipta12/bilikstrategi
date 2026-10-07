import type { AttendanceSchedule } from '../attendance/schedule';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { applyAvatarAppearance } from './avatar-visual';
import { DESK_SURFACE_Y, ORNAMENTS, ROOM_LIGHTS, lightEnabled, ornamentFootprint, type LightMode, ornamentError, type Ornament } from './space';
import { AVATAR_ASSETS, AVATAR_MODELS, defaultAvatar, bubbleLabel, DESKS_PER_ROOM, deskPosition, memberHash, memberZone, travelPath, zonePosition, officeTime, type DeskLayout, type OfficeZone, type OfficeMember } from './model';

const CHARACTERS = [...AVATAR_MODELS];
const FURNITURE = [...new Set(['floor_wood_3m', 'floor_ivory_3m', 'wall_with_window_3m', 'office_desk', 'office_swivel_chair', 'laptop', 'coffee_mug', 'desk_plant', 'floor_plant', 'bookshelf', 'book_stack', 'sofa', 'side_table', 'area_rug', 'floor_lamp', 'pinboard', 'keyboard', 'drawer_cabinet', 'whiteboard', 'flower_vase', 'wood_chair', ...Object.keys(ORNAMENTS).filter(key=>!['round_meeting_table','coffee_machine','team_radio','window'].includes(key))])];
type CharacterBones = { hips?: THREE.Bone; spine?: THREE.Bone; head?: THREE.Bone; upperArms: Array<THREE.Bone | undefined>; lowerArms: Array<THREE.Bone | undefined>; upperLegs: Array<THREE.Bone | undefined>; lowerLegs: Array<THREE.Bone | undefined> };
type Rig = { root: THREE.Group; model: THREE.Group; mixer: THREE.AnimationMixer; actions: Map<string, THREE.AnimationAction>; action: string; bones: CharacterBones; mug: THREE.Group };
type Occupant = {
  member: OfficeMember; rig: Rig; slot: number; zone: OfficeZone; style: string;
  route: THREE.Vector3[]; label: HTMLButtonElement; bubble: HTMLSpanElement; name: HTMLSpanElement; offset: number;
};
export type ObjectMenuTarget = { id: string; x: number; y: number };
export type SceneOptions = { onSelect: (id: string) => void; onError: (message: string) => void; onReady: () => void; onSelectDesk: (slot: number) => void; onObjectMenu: (target: ObjectMenuTarget) => void; onSelectOrnament: (id: string) => void; onMoveOrnament: (id: string, x: number, z: number, y?: number) => void };

export class OfficeScene {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private resize: ResizeObserver;
  private templates = new Map<string, THREE.Group>();
  private characterClips = new Map<string, THREE.AnimationClip[]>();
  private occupants = new Map<string, Occupant>();
  private desks = new Map<number, THREE.Group>();
  private deskLabels = new Map<number, HTMLButtonElement>();
  private room = 0;
  private deskLayout: DeskLayout[] = [];
  private schedule?: AttendanceSchedule;
  private skyMinute = -1;
  private lights: Record<string,LightMode> = {};
  private blockedActivities = new Map<string,OfficeZone>();
  private roomLights = new Map<string,{light:THREE.PointLight;material:THREE.MeshStandardMaterial}>();
  private ambient = new THREE.HemisphereLight('#fff5e4', '#a3aaa3', 1.5);
  private sun = new THREE.DirectionalLight('#fff4df', 2);
  private textures = new Set<THREE.Texture>();
  private sign?: THREE.Mesh;
  private signTexture?: THREE.Texture;
  private panMode = false;
  private objectClick: { id:string; x:number; y:number } | null = null;
  private brand = { name: 'Bilik Strategi', logo: '/landscape.png' };
  private clouds = new THREE.Group();
  private stars = new THREE.Group();
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
  private receivedRoster = false;
  private roomLabels: { element: HTMLElement; position: THREE.Vector3 }[] = [];
  private doors: { group: THREE.Group; center: THREE.Vector3; rotate: boolean; travel: number; hold: number }[] = [];
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
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = true;
    this.controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    this.controls.minDistance = 9;
    this.controls.maxDistance = 85;
    this.controls.minPolarAngle = 0.35;
    this.controls.maxPolarAngle = Math.PI / 2;
    this.controls.minAzimuthAngle = -Infinity;
    this.controls.maxAzimuthAngle = Infinity;
    this.resetCamera();
    this.scene.add(this.ambient);
    const sun = this.sun;
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
      await Promise.all([
        ...CHARACTERS.map(async name => {
          const gltf = await loader.loadAsync(`/spatial-assets/${AVATAR_ASSETS[name]}.glb`);
          if (this.disposed) return;
          this.templates.set(name, gltf.scene); this.characterClips.set(name, gltf.animations); this.track(gltf.scene);
        }),
        ...FURNITURE.map(async name => {
        const gltf = await loader.loadAsync(`/spatial-assets/${name}.glb`);
        if (this.disposed) {
          gltf.scene.traverse(child => { if (child instanceof THREE.Mesh) { child.geometry.dispose(); for (const m of Array.isArray(child.material) ? child.material : [child.material]) m.dispose(); } });
          return;
        }
        // Furniture is static; merge vertex-coloured meshes to reduce draw calls.
        {
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
        }
      })]);
      if (this.disposed) return;
      this.buildRoom();
      this.loaded = true;
      this.setDeskLayout(this.deskLayout);
      this.setBrand(this.brand);
      this.setMembers(this.current);
      this.setOrnaments(this.ornaments, this.room, this.editMode, this.selectedOrnament);
      this.options.onReady();
    } catch {
      if (!this.disposed) this.options.onError('Aset kantor belum dapat dimuat. Coba muat ulang tampilan 3D.');
    }
  }

  private asset(name: string, x: number, z: number, y = 0, rotation = 0, parent: THREE.Object3D = this.scene) {
    if(name==='team_radio') {
      const group=new THREE.Group(); group.name='team-radio';
      const piece=(geometry:THREE.BufferGeometry,color:string,px:number,py:number,pz:number,rx=0)=>{const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:.55,metalness:.08}));mesh.position.set(px,py,pz);mesh.rotation.x=rx;group.add(mesh);this.track(mesh);return mesh;};
      piece(new THREE.BoxGeometry(.86,.58,.34),'#cfa574',0,.31,0);
      piece(new THREE.BoxGeometry(.72,.46,.025),'#3f4c48',0,.31,.183);
      for(const px of [-.235,.235]) {
        piece(new THREE.CylinderGeometry(.145,.145,.035,24),'#1e2927',px,.28,.205,Math.PI/2);
        piece(new THREE.CylinderGeometry(.09,.09,.042,20),'#71877d',px,.28,.225,Math.PI/2);
      }
      piece(new THREE.BoxGeometry(.22,.075,.025),'#8be1bb',0,.47,.205);
      for(const px of [-.07,0,.07]) piece(new THREE.BoxGeometry(.025,.04+Math.abs(px)*.22,.018),'#d7ffe9',px,.47,.222);
      for(const px of [-.31,.31]) piece(new THREE.CylinderGeometry(.035,.035,.035,16),'#e5d2a4',px,.53,.205,Math.PI/2);
      const antenna=piece(new THREE.CylinderGeometry(.012,.012,.62,8),'#5e6964',.29,.88,0);antenna.rotation.z=-.22;
      group.position.set(x,y,z);group.rotation.y=rotation;parent.add(group);return group;
    }
    if(name==='coffee_machine') {
      const group=new THREE.Group();
      for(const [w,h,d,cy,cz,color] of [[.44,.43,.32,.215,0,'#344c43'],[.3,.12,.08,.23,-.2,'#d8bd89']] as const) {
        const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color}));mesh.position.set(0,cy,cz);group.add(mesh);this.track(mesh);
      }
      group.position.set(x,y,z);group.rotation.y=rotation;parent.add(group);return group;
    }
    if(name==='round_meeting_table') {
      const group=new THREE.Group(); group.name='meeting-round-table';
      for(const [top,bottom,height,cy,color] of [[1.25,1.25,.12,.8,'#d5bd97'],[.28,.48,.72,.36,'#61756a']] as const) {
        const mesh=new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,height,40),new THREE.MeshStandardMaterial({color,roughness:.7}));mesh.position.y=cy;mesh.castShadow=true;group.add(mesh);this.track(mesh);
      }
      group.position.set(x,y,z);group.rotation.y=rotation;parent.add(group);return group;
    }
    if(name==='window') {
      const group=new THREE.Group(); group.name='custom-window';
      const piece=(w:number,h:number,d:number,px:number,py:number,pz:number,color:string,opacity=1)=>{
        const material=new THREE.MeshStandardMaterial({color,roughness:.34,metalness:.12,transparent:opacity<1,opacity,depthWrite:opacity===1});
        const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(px,py,pz);mesh.castShadow=opacity===1;mesh.receiveShadow=true;group.add(mesh);this.track(mesh);return mesh;
      };
      // Wall-mounted double pane with a dark green frame and center mullion.
      piece(1.9,.085,.15,0,.045,0,'#263f37'); piece(1.9,.085,.15,0,1.455,0,'#263f37');
      piece(.085,1.5,.15,-.9075,.75,0,'#263f37'); piece(.085,1.5,.15,.9075,.75,0,'#263f37');
      piece(.055,1.29,.12,0,.75,0,'#526f62');
      piece(.82,1.27,.035,-.44,.75,.025,'#b9e4e5',.34);piece(.82,1.27,.035,.44,.75,.025,'#b9e4e5',.34);
      group.position.set(x,y,z);group.rotation.y=rotation;parent.add(group);return group;
    }
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

  private wall(x: number, z: number, length: number, rotate = false, door = false, glazed = false, name = '') {
    const frame = glazed ? '#567267' : '#a39a87';
    const localBox = (along: number, y: number, normal: number, w: number, h: number, d: number, color: string, opacity = 1) =>
      this.box(x + (rotate ? normal : along), y, z + (rotate ? along : normal), rotate ? d : w, h, rotate ? w : d, color, opacity);
    const panel = (along: number, y: number, width: number, height: number) => {
      const mesh = localBox(along, y, 0, width, height, .075, glazed ? '#b8ddd7' : '#e6ddc9', glazed ? .19 : 1);
      mesh.userData.architecture = glazed ? 'glass' : 'wall'; return mesh;
    };
    localBox(0, 2.78, 0, length, .10, .12, frame);
    for (const side of [-1, 1]) localBox(side * length / 2, 1.4, 0, .07, 2.8, .12, frame);
    if (!door) { panel(0, 1.37, length - .05, 2.68); localBox(0, .08, 0, length, .16, .12, frame); return; }

    // A human-sized opening with jambs, lintel and a separate sliding leaf.
    // The leaf clears the entire opening; the wall above it remains stationary.
    const width = Math.min(1.45, length - .16), height = 2.3, sideWidth = (length - width) / 2;
    for (const side of [-1, 1]) {
      if (sideWidth > .08) panel(side * (width / 2 + sideWidth / 2), 1.37, sideWidth - .035, 2.68);
      localBox(side * (width / 2 + .015), height / 2, 0, .10, height, .20, '#465e56');
    }
    panel(0, 2.55, width, .36);
    localBox(0, height + .035, 0, width + .18, .13, .20, '#465e56');
    localBox(0, .025, 0, width, .035, .26, '#b4bdad');
    const group = new THREE.Group(); group.position.set(x, 0, z); group.name = `door-${name || this.doors.length}`; this.scene.add(group);
    const leafPart = (along: number, y: number, normal: number, w: number, h: number, d: number, color: string, opacity = 1) => {
      const mesh = localBox(along, y, normal, w, h, d, color, opacity);
      mesh.position.x -= x; mesh.position.z -= z; group.add(mesh); return mesh;
    };
    leafPart(0, 1.16, .15, width + .025, 2.26, .065, glazed ? '#a7d8cf' : '#92714f', glazed ? .27 : 1);
    for (const side of [-1, 1]) {
      leafPart(side * width / 2, 1.16, .15, .065, 2.26, .09, '#405b52');
      leafPart(width * .31, 1.12, .15 + side * .08, .045, .38, .045, '#f0ce88');
    }
    for (const y of [.055, 2.26]) leafPart(0, y, .15, width + .08, .065, .09, '#405b52');
    // Inset and plaque make a closed solid door recognizable from either side.
    if (!glazed) for (const side of [-1, 1]) {
      leafPart(0, 1.7, .15 + side * .036, width * .54, .45, .01, '#b8d2c5');
      leafPart(0, 1.31, .15 + side * .045, width * .66, .19, .016, '#344b44');
    }
    this.doors.push({ group, center: new THREE.Vector3(x, 0, z), rotate, travel: width + .14, hold: 0 });
    if (name) {
      const canvas = document.createElement('canvas'); const context = canvas.getContext?.('2d');
      if (context) {
        canvas.width = 512; canvas.height = 96; context.fillStyle = '#f7ebcd'; context.font = '600 42px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(name, 256, 48, 470);
        const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; this.textures.add(texture);
        for (const side of [-1, 1]) {
          const label = new THREE.Mesh(new THREE.PlaneGeometry(width * .61, .15), new THREE.MeshBasicMaterial({ map:texture, transparent:true, depthWrite:false, toneMapped:false }));
          label.position.set(rotate ? .15 + side * .059 : 0, 1.31, rotate ? 0 : .15 + side * .059);
          label.rotation.y = (rotate ? Math.PI / 2 : 0) + (side < 0 ? Math.PI : 0); group.add(label); this.track(label);
        }
      }
    }
  }

  private buildRoom() {
    for (const x of [-4.5, -1.5, 1.5, 4.5, 7.5, 10.5]) {
      for (const z of [-4.5, -1.5, 1.5, 4.5]) this.asset(x > 6 ? 'floor_ivory_3m' : 'floor_wood_3m', x, z);
      if(x<0) this.wall(x, -6, 3, false, x === -1.5 || x === 4.5, false, x === -1.5 ? 'MANAGER' : x === 4.5 ? 'PROJECT LEAD' : '');
      this.wall(x, 6, 3, false, x === 4.5, true, x===4.5?'ENTRANCE':'');
    }
    // Exterior glass joins align with room boundaries, with one uninterrupted
    // pane across the widened corridor (no remnant mullion at the old Z=-6 wall).
    this.wall(12,-10.5,6,true,false,true);
    this.wall(12,-6.25,2.5,true,false,true);
    this.wall(12,-1.75,6.5,true,false,true);
    this.wall(12,2.625,2.25,true,false,true);
    this.wall(12,4.5,1.5,true,true,true);
    this.wall(12,5.625,.75,true,false,true);
    this.wall(-6,0,12,true);
    this.wall(9,-5,6); // Lounge has no additional doorway into the corridor.
    this.wall(6, -2.625, 4.75, true); this.wall(6, 0.5, 1.5, true, true);
    this.wall(6, 2.15, 1.8, true); this.wall(6, 3.8, 1.5, true, true); this.wall(6, 5.275, 1.45, true);
    this.wall(9, 1.5, 6);
    // Wall headers provide the open-roof outline; no beams span removed walls.

    for (let slot = 0; slot < DESKS_PER_ROOM; slot++) {
      const p = deskPosition(slot), group = new THREE.Group();
      group.position.set(p.x, 0, p.z); group.rotation.y = p.rotation; this.scene.add(group); group.userData.ornamentId = `desk:${slot}`; this.desks.set(slot, group);
      const table = this.asset('office_desk', 0, 0, 0, 0, group); table.userData.tableSurface = true;
      this.asset('office_swivel_chair', 0, -0.62, 0, 0, group);
      this.asset('laptop', 0, 0.12, 0.78, Math.PI, group);
      this.asset('keyboard', 0, -0.27, 0.78, Math.PI, group);
      this.asset('coffee_mug', -0.48, 0.04, 0.78, 0, group);
      if(slot>=10) { this.asset('desk_lamp',-.5,.06,.78,0,group); this.asset('pen_cup',.5,.12,.78,0,group); }
      const label = document.createElement('button'); label.type = 'button'; label.className = 'office-desk-label';
      label.addEventListener('click', () => this.editMode ? this.options.onSelectOrnament(`desk:${this.room * DESKS_PER_ROOM + slot}`) : this.options.onSelectDesk(this.room * DESKS_PER_ROOM + slot));
      this.labels.appendChild(label); this.deskLabels.set(slot, label);
    }
    // Street, sidewalk and a planted pocket garden outside the glazed office.
    this.box(1, -0.18, 1, 48, 0.2, 36, '#c4d3b1');
    this.box(0, -0.055, 7, 44, 0.12, 2, '#dedbd0');
    this.box(0, -0.09, 10.5, 44, 0.08, 5, '#727d7c');
    for (let x = -20; x < 22; x += 3) this.box(x, -0.042, 10.5, 1.5, 0.01, 0.09, '#efe7c6');
    for (let z = 8.6; z < 12.5; z += 0.65) this.box(-4.5, -0.035, z, 2, 0.015, 0.32, '#fff9e8');
    this.box(15.5, -0.04, 0, 6.4, 0.12, 12, '#9fb881');
    this.box(15.5, 0.03, 1.9, 6.4, 0.08, 1.1, '#dfd8c4');
    this.box(15.5, 0.03, 4.7, 1.1, 0.08, 5.7, '#dfd8c4');
    for (const x of [-8, 20]) { this.box(x, 1.5, 7.3, 0.12, 3, 0.12, '#4f6660'); this.box(x, 3, 7.3, 0.6, 0.12, 0.6, '#f2e8ba'); }
    // Manager stays behind workspace. Project Lead moves back to free a
    // continuous corridor from the workspace to the meeting entrance.
    for(const x of [-4.5,-1.5]) {
      for(const z of [-10.5,-7.5]) this.asset('floor_wood_3m',x,z);
      this.wall(x,-12,3);
    }
    for(const x of [-6,0]) for(const z of [-10.5,-7.5]) this.wall(x,z,3,true);
    for(const x of [1.5,4.5]) {
      for(const z of [-12,-9]) this.asset('floor_wood_3m',x,z);
      this.wall(x,-13.5,3);
      this.wall(x,-7.5,3,false,x===4.5,false,x===4.5?'PROJECT LEAD':'');
    }
    this.wall(0,-12.75,1.5,true);
    this.wall(6,-10.5,6,true);
    for(const x of [1.5,4.5]) this.box(x,-.01,-6.75,3,.08,1.5,'#e4dfcf');
    for(const x of [7.5,10.5]) this.box(x,-.01,-6.25,3,.08,2.5,'#e4dfcf');
    for(const x of [7.5,10.5]) {
      for(const z of [-12,-9]) this.asset('floor_ivory_3m',x,z);
      this.wall(x,-13.5,3,false,false,true);
    }
    this.wall(9,-7.5,6,false,true,true,'MEETING');
    // Hollow metal neon-box casing: visible depth with an illuminated front rim.
    for (const x of [-2.9,2.9]) this.box(x,3.28,6.20,.13,.86,.30,'#172d28');
    for (const y of [2.85,3.71]) this.box(0,y,6.20,5.93,.13,.30,'#172d28');
    for (const x of [-2.45,2.45]) this.box(x,2.9,6.08,.09,.32,.1,'#172d28');
    const glow = new THREE.MeshBasicMaterial({color:'#7fffd4',toneMapped:false});
    const rim = (x:number,y:number,w:number,h:number) => { const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,.025),glow); mesh.position.set(x,y,6.36); this.scene.add(mesh); this.track(mesh); mesh.castShadow=false; };
    for (const x of [-2.86,2.86]) rim(x,3.28,.025,.78);
    for (const y of [2.89,3.67]) rim(0,y,5.7,.025);
    for(const [key,room] of Object.entries(ROOM_LIGHTS)) {
      const light=new THREE.PointLight('#ffe4b0',0,key==='workspace'?13:8,2); light.position.set(room.x,2.65,room.z);this.scene.add(light);
      const material=new THREE.MeshStandardMaterial({color:'#eee4c9',emissive:'#ffe4b0',emissiveIntensity:0});
      const fixture=new THREE.Mesh(new THREE.CylinderGeometry(.3,.46,.12,24),material);fixture.position.set(room.x,2.78,room.z);fixture.name=`lamp-${key}`;this.scene.add(fixture);this.track(fixture);
      this.roomLights.set(key,{light,material});
    }
    this.updateLights();
    // Light clouds and stars vary with the workspace's local clock.
    if (this.clouds && this.stars) {
      for (let i = 0; i < 7; i++) {
        const cloud = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 5), new THREE.MeshStandardMaterial({ color: '#fff8ec', transparent: true, opacity: .7 }));
        cloud.position.set(-14 + i*5, 9 + i%3, -12); cloud.scale.set(1.8,.3,.65); this.clouds.add(cloud); this.track(cloud);
      }
      for (let i = 0; i < 65; i++) {
        const star = new THREE.Mesh(new THREE.SphereGeometry(.035, 4, 3), new THREE.MeshBasicMaterial({ color: '#fff8de' }));
        star.position.set(Math.sin(i*13.7)*28, 10+(i%11)*1.1, Math.cos(i*8.3)*28); this.stars.add(star); this.track(star);
      }
      this.scene.add(this.clouds, this.stars);
    }
    for (const [text, x, z] of [['WORKSPACE', 0, -4], ['LOUNGE', 9, -4.5], ['PANTRY', 9, 2], ['OFFICE GARDEN', 15.5, -3], ['JALAN KANTOR', 7, 11.5], ['MEETING ROOM', 9, -12.8], ['WORKSPACE → MEETING',7.5,-6.25], ['MANAGER', -3, -6.7], ['PROJECT LEAD', 3, -8.2]] as const) {
      const element = document.createElement('span'); element.className = 'office-entry-label'; element.textContent = text;
      this.labels.appendChild(element); this.roomLabels.push({ element, position: new THREE.Vector3(x, 0.12, z) });
    }
  }

  setLights(lights:Record<string,LightMode>) { this.lights=lights; this.updateLights(); }
  private updateLights() {
    const night=officeTime(Date.now(),this.schedule).phase==='Malam';
    for(const [key,{light,material}] of this.roomLights) {
      const enabled=lightEnabled(this.lights[`${this.room}:${key}`],night);
      light.intensity=enabled?(key==='workspace'?24:15):0;material.emissiveIntensity=enabled?2:0;
    }
  }
  setEnvironment(schedule?: AttendanceSchedule) { this.schedule = schedule; this.skyMinute = -1; }
  setBrand(brand: { name: string; logo: string }) {
    this.brand = brand;
    if (!this.loaded) return;
    const canvas=document.createElement('canvas'); if (!canvas.getContext) return;
    canvas.width=1280; canvas.height=176;
    const context=canvas.getContext('2d'); if (!context) return;
    context.fillStyle='#071916'; context.fillRect(0,0,1280,176);
    context.fillStyle='#a6ffe1'; context.shadowColor='#63edc1'; context.shadowBlur=13;
    context.font='600 62px sans-serif'; context.textAlign='center'; context.textBaseline='middle';
    context.fillText(brand.name,640,91,1120);
    const texture=new THREE.CanvasTexture(canvas); texture.colorSpace=THREE.SRGBColorSpace; texture.wrapS=THREE.RepeatWrapping;
    if (this.sign) { const old=this.sign.material as THREE.MeshBasicMaterial; old.map?.dispose(); if(old.map) this.textures.delete(old.map); old.map=texture; old.needsUpdate=true; }
    else { this.sign=new THREE.Mesh(new THREE.PlaneGeometry(5.58,.7),new THREE.MeshBasicMaterial({map:texture,transparent:false,depthWrite:true,toneMapped:false,side:THREE.DoubleSide})); this.sign.position.set(0,3.28,6.37); this.scene.add(this.sign); this.track(this.sign); }
    this.signTexture=texture; this.textures.add(texture);
  }
  setPan(enabled: boolean) {
    this.panMode=enabled;
    this.controls.mouseButtons.LEFT=enabled ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
    this.controls.touches.ONE=enabled ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
  }
  private tint(object: THREE.Object3D, color = 'original') {
    if (object.userData.tint === color) return;
    object.userData.tint=color;
    object.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return;
      if (!child.userData.ownsTint) {
        child.material=Array.isArray(child.material) ? child.material.map(m=>m.clone()) : child.material.clone(); child.userData.ownsTint=true;
        for (const material of Array.isArray(child.material) ? child.material : [child.material]) this.materials.add(material);
      }
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) if (material instanceof THREE.MeshStandardMaterial) {material.userData.originalColor??=material.color.getHex();material.color.set(color==='original'?material.userData.originalColor:color);}
    });
  }
  private releaseTint(object: THREE.Object3D) {
    object.traverse(child => { if (child instanceof THREE.Mesh && child.userData.ownsTint) for(const material of Array.isArray(child.material) ? child.material : [child.material]) { material.dispose(); this.materials.delete(material); } });
  }
  setDeskLayout(layout: DeskLayout[] = []) {
    const changed = JSON.stringify(this.deskLayout) !== JSON.stringify(layout);
    this.deskLayout = layout;
    if (!this.loaded) return;
    for (const [slot, group] of this.desks) { const global = this.room * DESKS_PER_ROOM + slot, d = deskPosition(global, layout); group.visible=!d.removed; group.position.set(d.x,0,d.z); group.rotation.y = d.rotation; group.userData.ornamentId = `desk:${global}`; const table=group.children.find(child=>child.userData.tableSurface); if(table) this.tint(table,d.color); }
    if (changed) for (const occupant of this.occupants.values()) this.changeZone(occupant, occupant.zone);
  }
  setOrnaments(items: Ornament[], room: number, editing: boolean, selected: string) {
    const changed=JSON.stringify(this.ornaments)!==JSON.stringify(items);
    this.ornaments = items; this.room = room; this.updateLights(); this.setDeskLayout(this.deskLayout); this.editMode = editing; this.selectedOrnament = selected;
    if (!editing && this.dragging) { this.dragging = null; this.controls.enabled = true; }
    if (!this.loaded) return;
    const visible = items.filter(item => item.room === room), ids = new Set(visible.map(item => item.id));
    for (const [id, group] of this.decorations) if (!ids.has(id)) { this.releaseTint(group); this.scene.remove(group); this.decorations.delete(id); }
    let addedSelection=false;
    for (const item of visible) {
      let group = this.decorations.get(item.id);
      if (group && group.userData.asset !== item.asset) { this.releaseTint(group); this.scene.remove(group); this.decorations.delete(item.id); group = undefined; }
      if (!group) { if(item.id===selected) addedSelection=true; group = this.asset(item.asset, item.x, item.z); group.userData.ornamentId = item.id; group.userData.asset = item.asset; this.decorations.set(item.id, group); }
      group.scale.set(...(item.scale||[1,1,1])); group.position.set(item.x, item.y || 0, item.z); group.rotation.y = item.rotation; this.tint(group,item.color);
    }
    if(editing&&addedSelection) this.focusObject(selected);
    if(changed) this.blockedActivities.clear();
    if(changed) for(const occupant of this.occupants.values()) if(occupant.zone!=='desk'&&occupant.zone!=='exit') this.changeZone(occupant,this.activeZone(occupant.member,occupant.slot));
    const object = editing ? (selected.startsWith('desk:') ? this.desks.get(Number(selected.slice(5)) % DESKS_PER_ROOM) : this.decorations.get(selected)) : undefined;
    if (object) {
      if (!this.outline) { this.outline = new THREE.BoxHelper(object, '#d49745'); this.scene.add(this.outline); }
      this.outline.visible = true; this.outline.setFromObject(object);
      this.outline.material.color.set((!selected.startsWith('desk:') && ornamentError(items.find(item => item.id === selected)!, this.deskLayout)) ? '#db6c60' : '#d49745');
    } else if (this.outline) this.outline.visible = false;
  }
  private floorPoint(event: PointerEvent, height=0) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -height), new THREE.Vector3());
  }
  private pointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const point = this.floorPoint(event); if (!point) return;
    const hit = this.raycaster.intersectObjects([...this.decorations.values(), ...this.desks.values()].filter(group=>group.visible), true)[0];
    if (!hit) return;
    let object: THREE.Object3D | null = hit.object;
    while (object && !object.userData.ornamentId) object = object.parent;
    if (!object) return;
    this.objectClick={id:object.userData.ornamentId,x:event.clientX,y:event.clientY};
    if(!this.editMode) return;
    event.stopImmediatePropagation(); this.controls.enabled = false;
    this.dragging = { id: object.userData.ornamentId, dx: object.position.x - point.x, dz: object.position.z - point.z };
    this.renderer.domElement.setPointerCapture(event.pointerId); this.options.onSelectOrnament(this.dragging.id);
  };
  private pointerMove = (event: PointerEvent) => {
    if (this.objectClick && Math.hypot(event.clientX-this.objectClick.x,event.clientY-this.objectClick.y)>5) this.objectClick=null;
    if (!this.dragging || !this.editMode) return;
    if(this.objectClick) return;
    const floor = this.floorPoint(event); if (!floor) return;
    let point=floor,y=0;
    if(!this.dragging.id.startsWith('desk:')) {
      const surfaceHit=this.raycaster.intersectObjects([...this.desks.values()].filter(group=>group.visible),true).find(hit=>{
        let current:THREE.Object3D|null=hit.object;
        while(current){if(current.userData.tableSurface)return true;current=current.parent;}
        return false;
      });
      if(surfaceHit){point=surfaceHit.point;y=DESK_SURFACE_Y;}
    }
    event.stopImmediatePropagation();
    const x = Math.round((point.x + this.dragging.dx) * 4) / 4, z = Math.round((point.z + this.dragging.dz) * 4) / 4;
    this.options.onMoveOrnament(this.dragging.id, THREE.MathUtils.clamp(x, -18, 19), THREE.MathUtils.clamp(z, -13.5, 6),y);
  };
  private pointerUp = (event: PointerEvent) => {
    if (this.objectClick && event.type !== 'pointercancel' && Math.hypot(event.clientX-this.objectClick.x,event.clientY-this.objectClick.y)<=5) {
      const rect=this.renderer.domElement.getBoundingClientRect();
      this.options.onObjectMenu({id:this.objectClick.id,x:(event.clientX-rect.left)/rect.width*100,y:(event.clientY-rect.top)/rect.height*100});
    }
    this.objectClick=null;
    if (!this.dragging) return;
    event.stopImmediatePropagation(); this.dragging = null; this.controls.enabled = true;
    if (this.renderer.domElement.hasPointerCapture(event.pointerId)) this.renderer.domElement.releasePointerCapture(event.pointerId);
  };

  private rig(member: OfficeMember): Rig {
    const style = member.avatar || defaultAvatar(member.id);
    const model = cloneSkeleton(this.templates.get(style.model)!) as THREE.Group;
    model.scale.setScalar(1.35);
    const resources = applyAvatarAppearance(model, this.templates.get(style.hair)!, style);
    resources.materials.forEach(material => this.materials.add(material)); resources.geometries.forEach(geometry => this.geometries.add(geometry));
    const root = new THREE.Group(); root.add(model); this.scene.add(root);
    const head = model.getObjectByName('Head') as THREE.Bone | undefined;
    const mixer = new THREE.AnimationMixer(model), actions = new Map<string, THREE.AnimationAction>();
    for (const clip of this.characterClips.get(style.model) || []) actions.set(clip.name, mixer.clipAction(clip));
    const mug = this.asset('coffee_mug', 0.26, 0.3, 0.83, 0, root); mug.visible = false;
    mug.traverse(child => { child.userData.sharedTemplate = true; });
    const rig: Rig = {
      root, model, mixer, actions, action: '', mug, bones: {
        hips: model.getObjectByName('Hips') as THREE.Bone,
        spine: model.getObjectByName('Spine') as THREE.Bone,
        head,
        upperArms: [model.getObjectByName('UpperArm_L') as THREE.Bone, model.getObjectByName('UpperArm_R') as THREE.Bone],
        lowerArms: [model.getObjectByName('LowerArm_L') as THREE.Bone, model.getObjectByName('LowerArm_R') as THREE.Bone],
        upperLegs: [model.getObjectByName('UpperLeg_L') as THREE.Bone, model.getObjectByName('UpperLeg_R') as THREE.Bone],
        lowerLegs: [model.getObjectByName('LowerLeg_L') as THREE.Bone, model.getObjectByName('LowerLeg_R') as THREE.Bone],
      },
    };
    this.playAction(rig, 'Idle');
    return rig;
  }

  private playAction(rig: Rig, name: string) {
    if (rig.action === name) return;
    const next = rig.actions.get(name) || rig.actions.get('Idle');
    if (!next) return;
    rig.actions.get(rig.action)?.fadeOut(.16);
    next.reset().fadeIn(.16).play(); rig.action = name;
  }

  private loungeSeat(slot:number) {
    const available=this.ornaments.filter(o=>o.room===this.room&&o.asset==='sofa').sort((a,b)=>a.id.localeCompare(b.id));
    const assignments=new Map<number,{item:Ornament;side:number;offset:number}>(),occupied=new Set<string>();
    const loungeMembers=this.current.filter(({member})=>memberZone(member,Date.now())==='lounge').sort((a,b)=>a.slot-b.slot||a.member.id.localeCompare(b.member.id));
    for(const entry of loungeMembers) {
      const expected=zonePosition(entry.slot,'lounge',this.deskLayout);
      const seats=available.flatMap(item=>[-1,1].map(side=>{
        const angle=item.rotation,dx=side*.32*(item.scale?.[0]||1),dz=.28*(item.scale?.[2]||1);
        return {item,side,offset:dx,x:item.x+dx*Math.cos(angle)+dz*Math.sin(angle),z:item.z-dx*Math.sin(angle)+dz*Math.cos(angle)};
      })).filter(seat=>!occupied.has(`${seat.item.id}:${seat.side}`))
        .sort((a,b)=>Math.hypot(a.x-expected.x,a.z-expected.z)-Math.hypot(b.x-expected.x,b.z-expected.z)
          ||a.item.id.localeCompare(b.item.id)||a.side-b.side);
      const seat=seats[0];if(!seat) continue;
      occupied.add(`${seat.item.id}:${seat.side}`);assignments.set(entry.slot,seat);
    }
    return assignments.get(slot);
  }

  private chairSeat(slot:number,zone:'garden'|'meeting') {
    const prefix=zone==='meeting'?'meeting-chair-':'garden-chair-';
    const inZone=(item:Ornament)=>zone==='meeting'?item.x>6&&item.x<12&&item.z<-7.5:item.x>=12;
    const available=this.ornaments.filter(item=>item.room===this.room&&item.asset==='wood_chair'
      &&(item.id.startsWith(prefix)||inZone(item))).sort((a,b)=>a.id.localeCompare(b.id));
    const assignments=new Map<number,Ornament>(),used=new Set<string>();
    const members=this.current.filter(({member})=>memberZone(member,Date.now())===zone).sort((a,b)=>a.slot-b.slot||a.member.id.localeCompare(b.member.id));
    for(const entry of members) {
      const expected=zonePosition(entry.slot,zone,this.deskLayout);
      const item=available.filter(candidate=>!used.has(candidate.id)).sort((a,b)=>{
        return Math.hypot(a.x-expected.x,a.z-expected.z)-Math.hypot(b.x-expected.x,b.z-expected.z)||a.id.localeCompare(b.id);
      })[0];
      if(item){used.add(item.id);assignments.set(entry.slot,item);}
    }
    return assignments.get(slot);
  }

  private seatItem(slot:number,zone:OfficeZone) {
    const i=slot%DESKS_PER_ROOM;
    if(zone==='lounge') return this.loungeSeat(slot)?.item;
    if(zone==='meeting'||zone==='garden') return this.chairSeat(slot,zone);
    const prefix=zone==='pantry'?`pantry-counter-${Math.floor(i/4)}`:'';
    return this.ornaments.find(o=>o.room===this.room&&(o.id===prefix||o.id===`${prefix}-area-${this.room}`));
  }
  private activeZone(member:OfficeMember,slot:number):OfficeZone {
    const zone=memberZone(member,Date.now());
    if(member.status==='paused'&&zone==='lounge') {this.blockedActivities.delete(member.id);return zone;}
    if(this.blockedActivities.get(member.id)===zone) return 'desk';
    this.blockedActivities.delete(member.id);
    return ['lounge','garden','pantry','meeting'].includes(zone)&&!this.seatItem(slot,zone)?'desk':zone;
  }
  private destination(slot:number,zone:OfficeZone) {
    const item=this.seatItem(slot,zone);
    if(!item) {
      const destination=zonePosition(slot,zone,this.deskLayout);
      return zone==='desk'?{...destination,y:.22}:destination;
    }
    const i=slot%DESKS_PER_ROOM,lounge=this.loungeSeat(slot),loungeOffset=zone==='lounge'?lounge?.offset:0;
    // The sofa GLB's cushion is forward of its backrest after the asset's
    // Z-up conversion. Place the hips on the front half of the cushion so
    // the avatar's long back hair and torso clear the raised sofa back.
    const dx=zone==='lounge'?(loungeOffset||0):zone==='pantry'?((i%4)-1.5)*.4:0,dz=zone==='pantry'?-1:zone==='lounge'?.28*(item.scale?.[2]||1):0;
    const c=Math.cos(item.rotation),s=Math.sin(item.rotation);
    const seatBase=item.asset==='sofa'?.67:item.asset==='office_swivel_chair'?.56:item.asset==='wood_chair'?.51:0;
    const seatTop=seatBase*(item.scale?.[1]||1);
    const seatLift=zone==='lounge'||zone==='garden'||zone==='meeting'?seatTop-.419:0;
    return {x:item.x+dx*c+dz*s,z:item.z-dx*s+dz*c,rotation:item.rotation,y:(item.y||0)+seatLift};
  }
  private routeTo(slot:number,from:[number,number],zone:OfficeZone,fromSlot=slot):[number,number][]|null {
    // Leaving a rearranged meeting must navigate around the table before the door.
    if(zone!=='meeting'&&from[0]>6&&from[0]<12&&from[1]<-7.5) {
      const exit:[number,number]=[9,-8.1];
      const tail=this.walkRoom(from,exit,'meeting',[]);
      const onward=this.routeTo(slot,[9,-6.25],zone,fromSlot);
      return tail&&onward?[...tail,[9,-7.5],[9,-6.25],...onward]:null;
    }
    const path=travelPath(slot,from,zone,fromSlot,this.deskLayout);
    const seat=this.seatItem(slot,zone);if(!seat) return path;
    const end=this.destination(slot,zone),door: [number,number]=zone==='meeting'?[9,-8.1]:zone==='garden'?[12.6,4.5]:zone==='pantry'?[6.4,3.8]:[6.4,.5];
    const [xmin,xmax,zmin,zmax]=this.zoneBounds(zone);
    const inside=from[0]>xmin&&from[0]<xmax&&from[1]>zmin&&from[1]<zmax;
    const tail=this.walkRoom(inside?from:door,[end.x,end.z],zone,[seat.id]);
    if(!tail) return null;
    const entry=path.findIndex(([x,z])=>zone==='meeting'?x>6&&z<-7.5:zone==='garden'?x>=12:x>=6);
    return [...(inside?[]:path.slice(0,entry<0?0:entry)),...(inside?[]:[door]),...tail];
  }
  private zoneBounds(zone:OfficeZone) {
    return zone==='meeting'?[6,12,-13.5,-7.5]:zone==='garden'?[12.3,18.8,-6,6]:zone==='pantry'?[6,12,1.5,6]:[6,12,-5,1.5];
  }
  private walkRoom(from:[number,number],end:[number,number],zone:OfficeZone,ignore:string[]):[number,number][]|null {
    const [xmin,xmax,zmin,zmax]=this.zoneBounds(zone);
    const obstacles=this.ornaments.filter(o=>o.room===this.room&&o.asset!=='area_rug'&&!ignore.includes(o.id)&&(o.y||0)<1&&!(o.asset==='wood_chair'&&Math.hypot(o.x-from[0],o.z-from[1])<.6)).map(ornamentFootprint);
    const step=.25,key=(x:number,z:number)=>`${Math.round((x-xmin)/step)},${Math.round((z-zmin)/step)}`;
    const point=(k:string):[number,number]=>{const [x,z]=k.split(',').map(Number);return [xmin+x*step,zmin+z*step];};
    const free=(p:[number,number])=>p[0]>xmin+.12&&p[0]<xmax-.12&&p[1]>zmin+.12&&p[1]<zmax-.12&&!obstacles.some(b=>p[0]>b.xmin-.17&&p[0]<b.xmax+.17&&p[1]>b.zmin-.17&&p[1]<b.zmax+.17);
    const start=key(...from),target=key(...end),queue=[start],prev=new Map<string,string>();prev.set(start,'');
    for(let head=0;head<queue.length&&head<2500&&!prev.has(target);head++) {
      const p=point(queue[head]);for(const [dx,dz] of [[step,0],[-step,0],[0,step],[0,-step]]) {const next:[number,number]=[p[0]+dx,p[1]+dz],k=key(...next);if(prev.has(k)||(!free(next)&&k!==target)) continue;prev.set(k,queue[head]);queue.push(k);}
    }
    if(!prev.has(target)) return null;
    const tail:[number,number][]=[];for(let k=target;k&&k!==start;k=prev.get(k)!) tail.unshift(point(k));tail.push(end);
    return tail;
  }
  private changeZone(occupant: Occupant, zone: OfficeZone) {
    const p = occupant.rig.root.position;
    let route=this.routeTo(occupant.slot,[p.x,p.z],zone);
    if(!route&&zone==='lounge'&&occupant.member.status==='paused') {
      route=travelPath(occupant.slot,[p.x,p.z],'lounge',occupant.slot,this.deskLayout);
      const destination=this.destination(occupant.slot,'lounge');
      const last=route.at(-1);
      if(this.seatItem(occupant.slot,'lounge')&&(!last||Math.hypot(last[0]-destination.x,last[1]-destination.z)>.01)) route.push([destination.x,destination.z]);
    }
    if(!route) {this.blockedActivities.set(occupant.member.id,zone);zone='desk';}
    occupant.route=(route||travelPath(occupant.slot,[p.x,p.z],'desk',occupant.slot,this.deskLayout)).map(([x,z])=>new THREE.Vector3(x,0,z));
    occupant.zone = zone;
  }


  private makeOccupant(member: OfficeMember, slot: number) {
    const label = document.createElement('button');
    label.type = 'button'; label.className = 'office-avatar-label';
    label.addEventListener('click', () => this.options.onSelect(member.id));
    const bubble = document.createElement('span'); bubble.className = 'office-bubble';
    const name = document.createElement('span'); name.className = 'office-name';
    label.append(bubble, name); this.labels.appendChild(label);
    const occupant: Occupant = { member, rig: this.rig(member), slot, label, bubble, name, zone: this.activeZone(member,slot), style: JSON.stringify(member.avatar), route: [], offset: memberHash(member.id) % 24 };
    const p = this.destination(slot, occupant.zone);
    occupant.rig.root.position.set(p.x, 0, p.z); occupant.rig.root.rotation.y = p.rotation;
    return occupant;
  }

  setMembers(members: { member: OfficeMember; slot: number }[]) {
    const previous=this.current;
    this.current = members;
    if (!this.loaded) return;
    const arrivals=this.receivedRoster;
    if(members.length) this.receivedRoster=true;
    const ids = new Set(members.map(({ member }) => member.id));
    for (const [id, occupant] of this.occupants) {
      if (!ids.has(id)) { this.removeOccupant(id, occupant); }
    }
    for (const { member, slot } of members) {
      let occupant = this.occupants.get(member.id);
      if(member.presenceIdle&&member.status!=='paused') { if(occupant) this.removeOccupant(member.id,occupant); continue; }
      if(member.status==='offline') {
        if(occupant) { occupant.member=member; occupant.label.setAttribute('aria-label',`${member.name}, keluar kantor`); if(occupant.zone!=='exit') this.changeZone(occupant,'exit'); }
        continue;
      }
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
      if (!occupant) {
        occupant = this.makeOccupant(member, slot); this.occupants.set(member.id, occupant);
        if(arrivals && !previous.some(item=>item.member.id===member.id && item.member.status==='working' && !item.member.presenceIdle)) {
          const entrance=zonePosition(slot,'exit'); occupant.rig.root.position.set(entrance.x,0,entrance.z);
          this.changeZone(occupant,this.activeZone(member,slot));
        }
      }
      const previousSlot = occupant.slot;
      if (previousSlot !== slot) {
        const position = occupant.rig.root.position, zone = this.activeZone(member,slot);
        occupant.slot=slot;occupant.zone=zone;
        if(zone==='desk'||zone==='exit') occupant.route=travelPath(slot,[position.x,position.z],zone,previousSlot,this.deskLayout).map(([x,z])=>new THREE.Vector3(x,0,z));
        else this.changeZone(occupant,zone);
      }
      occupant.member = member; occupant.slot = slot; occupant.name.textContent = member.name;
      occupant.label.setAttribute('aria-label', member.status === 'paused' ? `${member.name}, sedang istirahat di lounge` : `${member.name}, sudah check-in`);
      const zone = this.activeZone(member,slot),destination=this.destination(slot,zone);
      const loungeSeatChanged=zone==='lounge'&&!occupant.route.length&&Math.hypot(occupant.rig.root.position.x-destination.x,occupant.rig.root.position.z-destination.z)>.08;
      if (zone !== occupant.zone || loungeSeatChanged || (zone==='meeting'&&previous.find(p=>p.member.id===member.id)?.member.activity?.seat!==member.activity?.seat)) this.changeZone(occupant, zone);
    }
  }

  private removeOccupant(id: string, occupant: Occupant) {
    occupant.rig.mixer.stopAllAction(); occupant.rig.mixer.uncacheRoot(occupant.rig.model);
    this.scene.remove(occupant.rig.root);
    occupant.rig.root.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return;
      // Merged rig parts are owned by this instance, template geometry is shared.
      if (!child.userData.sharedTemplate && !child.userData.sharedGeometry) { child.geometry.dispose(); this.geometries.delete(child.geometry); }
      if (!child.userData.sharedTemplate && !child.userData.sharedMaterial) for (const material of Array.isArray(child.material) ? child.material : [child.material]) { material.dispose(); this.materials.delete(material); }
    });
    occupant.label.remove(); this.occupants.delete(id);
  }

  setMotion(enabled: boolean) { this.moving = enabled; }
  select(id: string) { this.selected = id; }
  resetCamera() { this.camera.position.set(28, 33, 41); this.controls.target.set(0, 1.6, -1.5); this.controls.update(); }
  focusObject(id:string) {
    const object=id.startsWith('desk:')?this.desks.get(Number(id.slice(5))%DESKS_PER_ROOM):this.decorations.get(id);
    if(!object) return;
    const {x,z}=object.position;this.controls.target.set(x,.8,z);this.camera.position.set(x+5,8,z+10);this.controls.update();
  }
  frontView() { this.controls.target.set(0,1.6,0);this.camera.position.set(0,1.6,23);this.controls.update(); }
  focus(zone: OfficeZone | 'garden') { const x = zone === 'desk' ? 0 : zone === 'garden' ? 15.5 : 9, z = zone === 'pantry' ? 3.8 : zone === 'lounge' ? -2.5 : 0; this.controls.target.set(x, 1.6, z); this.camera.position.set(x + 5, 9, z + 9); this.controls.update(); }
  zoom(direction: number) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    offset.setLength(THREE.MathUtils.clamp(offset.length() * (direction > 0 ? 0.84 : 1.19), 9, 85));
    this.camera.position.copy(this.controls.target).add(offset); this.controls.update();
  }

  private placeLabel(element: HTMLElement, position: THREE.Vector3) {
    this.project.copy(position).project(this.camera);
    const inFrame = Math.abs(this.project.x) < 1.1 && Math.abs(this.project.y) < 1.1 && this.project.z < 1;
    element.style.visibility = inFrame ? 'visible' : 'hidden';
    const projectedLeft = (this.project.x * 0.5 + 0.5) * this.host.clientWidth;
    const projectedTop = (-this.project.y * 0.5 + 0.5) * this.host.clientHeight;
    if (element.classList.contains('office-avatar-label')) {
      const halfWidth = Math.min(element.offsetWidth / 2, this.host.clientWidth / 2 - 8);
      element.style.left = `${THREE.MathUtils.clamp(projectedLeft, halfWidth + 8, this.host.clientWidth - halfWidth - 8)}px`;
      element.style.top = `${THREE.MathUtils.clamp(projectedTop, element.offsetHeight + 8, this.host.clientHeight - 8)}px`;
      return;
    }
    element.style.left = `${projectedLeft}px`;
    element.style.top = `${projectedTop}px`;
  }

  private animate = (now: number) => this.animateFrame(now);
  private animateFrame(now: number) {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.animate);
    if (now - this.lastFrame < 1000 / 30 || document.hidden || !this.visible) return;
    const dt = Math.min((now - (this.lastFrame || now)) / 1000, 0.05);
    this.lastFrame = now;
    if (this.moving) this.time += dt;
    for (const [id, occupant] of this.occupants) {
      const { rig, member } = occupant;
      const zone = this.activeZone(member,occupant.slot); if (zone !== occupant.zone) this.changeZone(occupant, zone);
      const destination = this.destination(occupant.slot, occupant.zone);
      if (!this.moving && occupant.route.length) { rig.root.position.set(destination.x, 0, destination.z); occupant.route = []; }
      const next = occupant.route[0];
      if (next) {
        const delta = next.clone().sub(rig.root.position); delta.y = 0;
        const step = dt * 2.25;
        if (delta.length() <= step) { rig.root.position.copy(next); occupant.route.shift(); }
        else { rig.root.position.add(delta.normalize().multiplyScalar(step)); rig.root.rotation.y = Math.atan2(delta.x, delta.z); }
      }
      const settled = !occupant.route.length;
      if(settled && occupant.zone==='exit') { this.removeOccupant(id,occupant); continue; }
      const working = settled && occupant.zone === 'desk';
      const seated = settled && occupant.zone !== 'pantry' && (occupant.zone==='desk'||Boolean(this.seatItem(occupant.slot,occupant.zone)));
      rig.root.position.y = settled && 'y' in destination ? destination.y : 0;
      const t = this.time + occupant.offset;
      this.playAction(rig, settled ? 'Idle' : 'Walk');
      rig.mixer.update(this.moving ? dt : 0);
      if (seated) {
        if(rig.bones.hips) rig.bones.hips.rotation.x=.28;
        if(rig.bones.spine) rig.bones.spine.rotation.x=-.24;
        rig.bones.upperLegs.forEach(leg => { if (leg) leg.rotation.x = -1.46; });
        rig.bones.lowerLegs.forEach(leg => { if (leg) leg.rotation.x = 1.4; });
      }
      if (working) {
        const tap = this.moving ? Math.sin(t * 9) * .08 : 0;
        rig.bones.upperArms.forEach((arm, index) => { if (arm) {arm.rotation.x = -.95 + (index ? tap : -tap);arm.rotation.z=index?.7:-.7;} });
        rig.bones.lowerArms.forEach((arm, index) => { if (arm) {arm.rotation.x = -.1 + (index ? -tap : tap);arm.rotation.z=0;} });
        if (rig.bones.head) rig.bones.head.rotation.x = .08 + (this.moving ? Math.sin(t * 1.7) * .025 : 0);
      } else if(seated) {
        rig.bones.upperArms.forEach((arm,index)=>{if(arm){arm.rotation.x=-.3;arm.rotation.z=index?.65:-.65;}});
        rig.bones.lowerArms.forEach((arm,index)=>{if(arm){arm.rotation.x=-.4;arm.rotation.z=index?-.15:.15;}});
        if(rig.bones.head) rig.bones.head.rotation.x=-.03;
      }
      const coffee = settled && occupant.zone === 'pantry';
      const sip = coffee && this.moving ? Math.max(0, Math.sin(t * 0.9)) : 0;
      rig.mug.position.set(0.26, 0.83 + sip * 0.27, 0.3 - sip * 0.06);
      rig.mug.rotation.x = sip * 0.3;
      if (coffee && rig.bones.head) rig.bones.head.rotation.x = -sip * .08;
      rig.mug.visible = settled && occupant.zone === 'pantry';
      if (settled) rig.root.rotation.y = destination.rotation;
      const bubbleNow=Date.now(),chatActive=Boolean(member.chat&&bubbleNow>=member.chat.sentAt&&bubbleNow-member.chat.sentAt<15_000);
      const text = settled ? bubbleLabel(member, occupant.zone, this.moving||chatActive ? bubbleNow : 0) : '';
      if (occupant.bubble.textContent !== text) occupant.bubble.textContent = text;
      occupant.bubble.hidden = !text || (!chatActive && id !== this.selected && (!this.moving || (t + occupant.slot * 3) % 25 >= 5));
      occupant.bubble.dataset.chat=String(chatActive);
      occupant.label.dataset.zone = occupant.zone;
      occupant.label.dataset.walking = String(!settled);
      occupant.label.dataset.status = member.status;
      occupant.label.dataset.selected = String(id === this.selected);
      occupant.label.dataset.paused = String(member.status === 'paused');
      this.placeLabel(occupant.label, rig.root.position.clone().add(new THREE.Vector3(0, 1.7, 0)));
    }
    for (const [slot, label] of this.deskLabels) {
      const occupant = this.current.find(item => item.slot % DESKS_PER_ROOM === slot);
      const number = this.room * DESKS_PER_ROOM + slot + 1;
      label.hidden = true;
      const text = `${String(number).padStart(2, '0')}${occupant ? '' : ' + '}`;
      label.title = occupant ? `Meja ${number} · ${occupant.member.name}` : `Klaim meja ${number}`;
      if (label.textContent !== text) label.textContent = text;
      label.dataset.selected = String(occupant?.member.id === this.selected);
      label.dataset.vacant = String(!occupant);
      label.setAttribute('aria-label', `Meja ${number}, ${occupant ? `milik ${occupant.member.name}` : 'kosong, bisa diklaim'}`);
      const { x, z } = deskPosition(this.room * DESKS_PER_ROOM + slot, this.deskLayout); this.placeLabel(label, new THREE.Vector3(x, 0.88, z));
    }
    for (const label of this.roomLabels) this.placeLabel(label.element, label.position);
    this.updateDoors(dt);
    const minute = Math.floor(Date.now() / 60000);
    if (minute !== this.skyMinute) {
      this.skyMinute = minute;
      const time = officeTime(Date.now(), this.schedule), night = time.phase === 'Malam', warm = time.phase === 'Pagi' || time.phase === 'Sore';
      (this.scene.background as THREE.Color).set(night ? '#1e304a' : warm ? '#edd5ba' : '#dbe8ec');
      this.ambient.intensity = night ? .85 : 1.5; this.ambient.color.set(night ? '#bacfed' : '#fff5e4');
      this.sun.intensity = night ? .3 : warm ? 1.6 : 2;
      this.sun.color.set(night ? '#9caeef' : warm ? '#ffd5a0' : '#fff4df');
      this.sun.position.set(Math.cos((time.hour-6)/12*Math.PI)*14, night ? 8 : 8 + Math.sin((time.hour-6)/12*Math.PI)*7, 9);
      this.updateLights();
      this.stars.visible = night; this.clouds.visible = !night;
    }
    if (this.signTexture) this.signTexture.offset.x = this.moving ? (this.time * .035) % 1 : this.signTexture.offset.x;
    if (this.moving) this.clouds.position.x = Math.sin(this.time * .012) * 3;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  private updateDoors(dt: number) {
    for (const door of this.doors) {
      const nearby = [...this.occupants.values()].some(({rig, route}) => {
        const dx=rig.root.position.x-door.center.x, dz=rig.root.position.z-door.center.z;
        const across=Math.abs(door.rotate ? dx : dz), along=Math.abs(door.rotate ? dz : dx);
        return along < .95 && across < (route.length ? 2.1 : .7);
      });
      door.hold = nearby ? .65 : Math.max(0, door.hold-dt);
      const axis = door.rotate ? 'z' : 'x';
      door.group.position[axis] = THREE.MathUtils.damp(door.group.position[axis], door.center[axis] - (door.hold > 0 ? door.travel : 0), 12, dt);
    }
  }

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
    this.textures.forEach(texture => texture.dispose());
    this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove();
    this.labels.replaceChildren();
  }
}
