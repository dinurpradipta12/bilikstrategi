import { DESKS_PER_ROOM, zonePath, deskPosition, deskCorridor, type DeskLayout, type OfficeMember } from './model';

export const ORNAMENTS = {
  office_desk: { label: 'Meja kantor', category: 'Furnitur', width:1.4,depth:.75,height:.78 },
  meeting_table: { label: 'Meja meeting', category: 'Furnitur', width:2.3,depth:1.1,height:.8 },
  office_swivel_chair: { label: 'Kursi kantor', category: 'Furnitur', width:.7,depth:.7,height:1.18 },
  wood_chair: { label: 'Kursi kayu', category: 'Furnitur', width:.58,depth:.61,height:1.22 },
  round_stool: { label: 'Bangku', category: 'Furnitur', width:.6,depth:.6,height:.7 },
  sofa: { label: 'Sofa', category: 'Furnitur', width:1.9,depth:.76,height:1.19 },
  drawer_cabinet: { label: 'Laci dokumen', category: 'Furnitur', width:.9,depth:.48,height:1.44 },
  bookshelf: { label: 'Rak buku', category: 'Furnitur', width:1.04,depth:.42,height:1.94 },
  side_table: { label: 'Meja dekorasi', category: 'Furnitur', width:.72,depth:.72,height:.59 },
  room_divider: { label: 'Partisi portabel', category: 'Furnitur', width:1.4,depth:.4,height:1.6 },
  whiteboard: { label: 'Papan tulis', category: 'Kantor', width:1.76,depth:.23,height:1.7 },
  pinboard: { label: 'Papan catatan', category: 'Kantor', width:1.2,depth:.09,height:1.27 },
  laptop: { label: 'Laptop', category: 'Perangkat meja', width:.65,depth:.45,height:.48 },
  monitor: { label: 'Monitor', category: 'Perangkat meja', width:.8,depth:.26,height:1.15 },
  keyboard: { label: 'Keyboard', category: 'Perangkat meja', width:.53,depth:.18,height:.07 },
  mouse: { label: 'Mouse', category: 'Perangkat meja', width:.13,depth:.2,height:.08 },
  desk_lamp: { label: 'Lampu meja', category: 'Perangkat meja', width:.35,depth:.34,height:.84 },
  coffee_mug: { label: 'Cangkir kopi', category: 'Perangkat meja', width:.25,depth:.18,height:.21 },
  book_stack: { label: 'Tumpukan buku', category: 'Perangkat meja', width:.46,depth:.27,height:.35 },
  pen_cup: { label: 'Tempat pena', category: 'Perangkat meja', width:.18,depth:.18,height:.34 },
  desk_plant: { label: 'Tanaman meja', category: 'Tanaman', width:.35,depth:.35,height:.53 },
  floor_plant: { label: 'Tanaman besar', category: 'Tanaman', width:.65,depth:.65,height:.96 },
  flower_vase: { label: 'Vas bunga', category: 'Tanaman', width:.5,depth:.5,height:.73 },
  cactus: { label: 'Kaktus', category: 'Tanaman', width:.42,depth:.42,height:.68 },
  floor_lamp: { label: 'Lampu lantai', category: 'Dekorasi', width:.58,depth:.58,height:1.78 },
  framed_art: { label: 'Lukisan', category: 'Dekorasi', width:.7,depth:.1,height:1.1 },
  area_rug: { label: 'Karpet', category: 'Dekorasi', width:2,depth:1.35,height:.04 },
  cushion: { label: 'Bantal', category: 'Dekorasi', width:.56,depth:.56,height:.23 },
  storage_box: { label: 'Kotak penyimpanan', category: 'Dekorasi', width:.58,depth:.42,height:.48 },
  trash_bin: { label: 'Tempat sampah', category: 'Dekorasi', width:.36,depth:.36,height:.42 },
} as const;

// Actual supplied GLB bounds after Z-up conversion: min/max X, Z and Y.
// Some wall decorations are asymmetric about their origin.
export const ORNAMENT_BOUNDS: Record<keyof typeof ORNAMENTS, readonly number[]> = {
  office_desk: [-0.7,0.7,-0.375,0.375,0,0.775],
  meeting_table: [-1.185,1.185,-0.55,0.55,0,0.785],
  office_swivel_chair: [-0.3525,0.365,-0.3498,0.3498,0,1.175],
  wood_chair: [-0.29,0.29,-0.31,0.27,0.02,1.23],
  round_stool: [-0.27,0.3244,-0.2853,0.2853,-0.0064,0.695],
  sofa: [-0.91,0.91,-0.395,0.39,0,1.19],
  drawer_cabinet: [-0.45,0.45,-0.23,0.282,0,1.44],
  bookshelf: [-0.525,0.525,-0.21,0.21,0,1.935],
  side_table: [-0.36,0.36,-0.36,0.36,0,0.585],
  room_divider: [-0.7,0.6625,-0.2,0.2,0,1.58],
  whiteboard: [-0.8825,0.8825,-0.045,0.21,0.005,1.7025],
  pinboard: [-0.6,0.6,-0.025,0.08,0.425,1.275],
  laptop: [-0.325,0.325,-0.215,0.215,0.0175,0.465],
  monitor: [-0.4,0.4,-0.14,0.12,0.255,1.15],
  keyboard: [-0.265,0.265,-0.09,0.09,-0.0005,0.063],
  mouse: [-0.065,0.065,-0.1,0.1,-0.01,0.08],
  desk_lamp: [-0.27,0.16,-0.17,0.17,0,0.84],
  coffee_mug: [-0.09,0.2018,-0.09,0.09,0,0.21],
  book_stack: [-0.185,0.275,-0.135,0.148,0.0075,0.3375],
  pen_cup: [-0.09,0.09,-0.09,0.09,0,0.3828],
  desk_plant: [-0.2172,0.2466,-0.1922,0.2658,0,0.5365],
  floor_plant: [-0.3744,0.4438,-0.3314,0.4583,0,0.925],
  flower_vase: [-0.2683,0.297,-0.2897,0.2897,0.02,0.695],
  cactus: [-0.21,0.21,-0.15,0.15,0,0.66],
  floor_lamp: [-0.29,0.29,-0.29,0.29,0,1.77],
  framed_art: [-0.35,0.46,-0.025,0.053,0.16,1.1],
  area_rug: [-1,1,-0.675,0.675,-0.0005,0.039],
  cushion: [-0.28,0.28,-0.28,0.28,0,0.24],
  storage_box: [-0.29,0.29,-0.21,0.21,0,0.4725],
  trash_bin: [-0.18,0.18,-0.18,0.18,0.005,0.42],
};
export type Ornament = { id: string; asset: keyof typeof ORNAMENTS; x: number; z: number; y?: number; color?: string; rotation: number; room: number };
export type OfficeSpace = { version: number; revision: number; layoutRevision: number; claims: Record<string, number>; ornaments: Ornament[]; desks: DeskLayout[]; activities: Record<string, NonNullable<OfficeMember["activity"]>> };
export const OBJECT_COLORS = ['original', '#52684e', '#394c68', '#cfaa77', '#b68c92', '#efe7d5', '#59545a'] as const;
export function validObjectColor(color: unknown) { return color === undefined || color === 'original' || (typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color)); }
const privateOffice = (name: string, x: number): Ornament[] => [
  { id:`${name}-desk`, asset:'office_desk', x, z:-9, rotation:0, room:0 },
  { id:`${name}-chair`, asset:'office_swivel_chair', x, z:-10, rotation:0, room:0 },
  { id:`${name}-guest`, asset:'wood_chair', x, z:-7.75, rotation:Math.PI, room:0 },
  { id:`${name}-laptop`, asset:'laptop', x, z:-8.87, y:.78, rotation:Math.PI, room:0 },
  { id:`${name}-keyboard`, asset:'keyboard', x, z:-9.27, y:.78, rotation:Math.PI, room:0 },
  { id:`${name}-lamp`, asset:'desk_lamp', x:x-.5, z:-8.94, y:.78, rotation:0, room:0 },
  { id:`${name}-pen`, asset:'pen_cup', x:x+.5, z:-8.88, y:.78, rotation:0, room:0 },
  { id:`${name}-shelf`, asset:'bookshelf', x:x-2, z:-10.7, rotation:0, room:0 },
  { id:`${name}-cabinet`, asset:'drawer_cabinet', x:x-2, z:-8.7, rotation:0, room:0 },
  { id:`${name}-plant`, asset:'floor_plant', x:x-2, z:-7, rotation:0, room:0 },
  { id:`${name}-art`, asset:'framed_art', x, z:-11.6, y:.9, rotation:0, room:0 },
  { id:`${name}-rug`, asset:'area_rug', x, z:-9, rotation:0, room:0 },
];
export const EXECUTIVE_ORNAMENTS = [...privateOffice('manager', -3), ...privateOffice('lead', 3)];
export const DEFAULT_ORNAMENTS: Ornament[] = [
  { id:'plant-back', asset:'floor_plant', x:-5, z:-5, rotation:0, room:0 },
  { id:'shelf-back', asset:'bookshelf', x:-3.6, z:-5.4, rotation:0, room:0 },
  { id:'lamp-back', asset:'floor_lamp', x:.5, z:-5.2, rotation:0, room:0 },
  { id:'plant-front', asset:'floor_plant', x:-5, z:2.8, rotation:0, room:0 },
  { id:'rug-lounge', asset:'area_rug', x:9, z:-3, rotation:0, room:0 },
  ...EXECUTIVE_ORNAMENTS,
];
export function spaceCapacity(space: OfficeSpace, count: number) {
  return Math.max(DESKS_PER_ROOM, Math.ceil(count / DESKS_PER_ROOM) * DESKS_PER_ROOM, Math.ceil((Math.max(-1, ...Object.values(space.claims)) + 1) / DESKS_PER_ROOM) * DESKS_PER_ROOM);
}
export function normalizeSpace(value: unknown, members: Pick<OfficeMember, 'id'>[]): OfficeSpace {
  const raw = value && typeof value === 'object' ? value as Partial<OfficeSpace> : {};
  const claims: Record<string, number> = {};
  const taken = new Set<number>();
  const sorted = [...members].sort((a, b) => a.id.localeCompare(b.id));
  for (const member of sorted) {
    const slot = raw.claims?.[member.id];
    if (Number.isInteger(slot) && slot! >= 0 && slot! < 1000 && !taken.has(slot!)) { claims[member.id] = slot!; taken.add(slot!); }
  }
  // Existing/new roster members get a free desk; saved ownership takes precedence.
  for (const member of sorted) {
    if (claims[member.id] !== undefined) continue;
    let slot = 0; while (taken.has(slot)) slot++;
    claims[member.id] = slot; taken.add(slot);
  }
  const ornaments = Array.isArray(raw.ornaments) ? raw.ornaments.map(item => {
    if ((raw.version || 0) < 2 && item.id === 'plant-front' && item.x === -5 && item.z === 4.8) return { ...item, z:2.8 };
    if ((raw.version || 0) < 3 && item.rotation === 0) {
      if (item.id === 'shelf-back' && item.x === -2 && item.z === -5.4) return { ...item, x:-3.6 };
      if (item.id === 'lamp-back' && item.x === 4.5 && item.z === -5.2) return { ...item, x:.5 };
    }
    return item;
  }) : DEFAULT_ORNAMENTS.map(item => ({ ...item }));
  if (Array.isArray(raw.ornaments) && (raw.version || 0) < 2) for (const item of EXECUTIVE_ORNAMENTS) if (!ornaments.some(o => o.id === item.id)) ornaments.push({ ...item });
  return { version:3, revision: Number.isSafeInteger(raw.revision) && raw.revision! >= 0 ? raw.revision! : 0, layoutRevision: Number.isSafeInteger(raw.layoutRevision) && raw.layoutRevision! >= 0 ? raw.layoutRevision! : 0, claims, desks: Array.isArray(raw.desks) ? raw.desks : [], activities: Object.fromEntries(sorted.flatMap(m => { const a = raw.activities?.[m.id]; return a && ['garden', 'pantry', 'lounge'].includes(a.zone) && Number.isFinite(a.until) ? [[m.id, a]] : []; })), ornaments };
}
export function claimDesk(space: OfficeSpace, userId: string, slot: unknown, count: number): OfficeSpace {
  if (!Object.hasOwn(space.claims, userId)) throw new Error('Anda bukan anggota kantor ini.');
  if (typeof slot !== 'number' || !Number.isInteger(slot) || slot < 0 || slot >= spaceCapacity(space, count)) throw new Error('Meja tidak tersedia di area ini.');
  if (Object.entries(space.claims).some(([id, desk]) => id !== userId && desk === slot)) throw new Error('Meja ini sudah dimiliki anggota lain. Pilih meja kosong.');
  return { ...space, revision: space.revision + 1, claims: { ...space.claims, [userId]: slot } };
}
function segmentDistance(x: number, z: number, a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
}
export function ornamentFootprint(item: Ornament) {
  const [xmin,xmax,zmin,zmax,ymin,ymax] = ORNAMENT_BOUNDS[item.asset];
  const c=Math.cos(item.rotation),s=Math.sin(item.rotation);
  const corners=[[xmin,zmin],[xmax,zmin],[xmax,zmax],[xmin,zmax]].map(([x,z])=>[item.x+x*c+z*s,item.z-x*s+z*c]);
  const xs=corners.map(p=>p[0]),zs=corners.map(p=>p[1]);
  return { corners, xmin:Math.min(...xs), xmax:Math.max(...xs), zmin:Math.min(...zs), zmax:Math.max(...zs), ymin:(item.y||0)+ymin, ymax:(item.y||0)+ymax };
}
const placementRoom = (item: Pick<Ornament,'x'|'z'>) => {
  if(item.x < -6) return [-18,-6,-6,6];
  if(item.z < -6) return item.x < 0 ? [-6,0,-12,-6] : [0,6,-12,-6];
  if(item.x > 12) return [12.3,18.8,-6,6];
  if(item.x > 6) return item.z < 1.5 ? [6,12,-6,1.5] : [6,12,1.5,6];
  return [-6,6,-6,6];
};
export const isWallOrnament = (item: Ornament) => item.asset==='framed_art'||item.asset==='pinboard';
// Keep the full GLB footprint on the room-facing surface, including rotation.
// Call with the previous position so dragging cannot jump through a partition.
export function snapOrnament(item: Ornament, previous: Ornament = item, attach = false): Ornament {
  const [xmin,xmax,zmin,zmax]=placementRoom(previous), gap=.075;
  const next={...item};
  if(xmin!==12.3 && (attach || isWallOrnament(item))) {
    const walls=[{distance:Math.abs(item.z-zmin),axis:'z',edge:zmin,rotation:0,sign:1},
      {distance:Math.abs(item.x-xmin),axis:'x',edge:xmin,rotation:Math.PI/2,sign:1},
      {distance:Math.abs(item.x-xmax),axis:'x',edge:xmax,rotation:Math.PI*1.5,sign:-1},
      {distance:Math.abs(item.z-zmax),axis:'z',edge:zmax,rotation:Math.PI,sign:-1}].sort((a,b)=>a.distance-b.distance);
    const wall=walls[0];
    if(attach || wall.distance<.65) {
      next.rotation=wall.rotation;
      if(isWallOrnament(next) && next.y===undefined) next.y=.9;
      const b=ornamentFootprint(next);
      if(wall.axis==='x') next.x+=wall.edge+wall.sign*gap-(wall.sign>0?b.xmin:b.xmax);
      else next.z+=wall.edge+wall.sign*gap-(wall.sign>0?b.zmin:b.zmax);
    }
  }
  const b=ornamentFootprint(next);
  next.x+=Math.max(0,xmin+gap-b.xmin)-Math.max(0,b.xmax-xmax+gap);
  next.z+=Math.max(0,zmin+gap-b.zmin)-Math.max(0,b.zmax-zmax+gap);
  if(next.y!==undefined) next.y=Math.max(0,Math.min(next.y,2,2.7-ORNAMENT_BOUNDS[next.asset][5]));
  return next;
}
export function ornamentError(item: Ornament, desks: DeskLayout[] = []): string {
  const b=ornamentFootprint(item), rx=(b.xmax-b.xmin)/2,rz=(b.zmax-b.zmin)/2;
  const center={...item,x:(b.xmin+b.xmax)/2,z:(b.zmin+b.zmax)/2};
  const [xmin,xmax,zmin,zmax]=placementRoom(item),gap=.074;
  if(b.xmin<xmin+gap||b.xmax>xmax-gap||b.zmin<zmin+gap||b.zmax>zmax-gap) return 'Objek menembus dinding atau keluar ruangan. Geser ke sisi dalam atau gunakan Tempel ke dinding.';
  if(b.ymax>2.701) return 'Objek terlalu tinggi. Turunkan agar tetap di bawah bagian atas dinding.';
  item=center;
  if (item.asset !== 'area_rug') for (const [x,z,rotated] of [[-1.5,-6,0],[4.5,-6,0],[-6,4.5,1],[4.5,6,0],[12,4.5,1]]) {
    const along = rotated ? Math.abs(item.z-z) : Math.abs(item.x-x), across = rotated ? Math.abs(item.x-x) : Math.abs(item.z-z);
    if (along < .8 + (rotated ? rz : rx) && across < 1.05 + (rotated ? rx : rz)) return 'Sisakan bukaan dan jalur masuk pintu.';
  }
  const garden = xmin===12.3;
  const privateRoom = zmax===-6;
  if (privateRoom) return '';
  const bedroom=xmin===-18;
  if (bedroom) {
    if (item.asset === 'area_rug') return '';
    if (Math.abs(item.z-.5)<rz+.4 || (Math.abs(item.x+7)<rx+.4 && item.z+rz>.5)) return 'Sisakan lorong kamar tidur.';
    for(let i=0;i<10;i++) if(Math.abs(item.x-(-16.5+i%5*1.95))<rx+.7 && Math.abs(item.z-(i<5?-3:2.5))<rz+1.05) return 'Posisi bertabrakan dengan tempat tidur.';
    return '';
  }
  if (garden) {
    if (item.asset !== 'area_rug') {
      if (Math.abs(item.z-1.9) < rz+.55 || Math.abs(item.z+1.2) < rz+.35 || (item.x-rx<12.85 && item.z+rz> -1.5)) return 'Sisakan jalur taman.';
      for (let i=0;i<5;i++) for (const z of [0,-2.4]) if (Math.abs(item.x-(13.5+i*1.05))<rx+.4 && Math.abs(item.z-z)<rz+.4) return 'Sisakan kursi taman.';
    }
    return '';
  }
  if(isWallOrnament(item) && b.ymin>=.65 && Math.min(b.xmin-xmin,xmax-b.xmax,b.zmin-zmin,zmax-b.zmax)<.16) return '';
  if (item.asset === 'area_rug') return '';
  for (let i = 0; i < 10; i++) { const d = deskPosition(item.room * 10 + i, desks); const dx = item.x - d.x, dz = item.z - d.z; if (Math.abs(dx * Math.cos(d.rotation) - dz * Math.sin(d.rotation)) < .7 + Math.max(rx, rz) && Math.abs(dx * Math.sin(d.rotation) + dz * Math.cos(d.rotation) + .35) < 1 + Math.max(rx, rz)) return 'Area meja dan kursi harus tetap kosong.'; }
  for (let slot = 0; slot < DESKS_PER_ROOM; slot++) for (const zone of ['desk', 'lounge', 'pantry', 'garden', 'bedroom'] as const) {
    const path = zonePath(item.room * 10 + slot, zone, desks);
    for (let i = 1; i < path.length; i++) if (segmentDistance(item.x, item.z, path[i - 1], path[i]) < Math.max(rx, rz) + 0.38) return 'Sisakan lorong untuk jalur karakter.';
  }
  for (const [x, z] of [[7, -4.7], [9, -4.7], [11, -4.7], [7, -1.4], [11, -1.4]]) if (Math.abs(item.x - x) < rx + 1 && Math.abs(item.z - z) < rz + 0.5) return 'Posisi bertabrakan dengan sofa lounge.';
  if (item.x > 6.4 && item.z + rz > 5.15) return 'Posisi bertabrakan dengan meja pantry.';
  return '';
}
export function parseOrnaments(value: unknown, rooms: number, desks: DeskLayout[] = []): Ornament[] {
  if (!Array.isArray(value) || value.length > 120) throw new Error('Maksimum 120 objek per kantor.');
  const ids = new Set<string>();
  const items = value.map(input => {
    if (!input || typeof input !== 'object') throw new Error('Data ornamen tidak valid.');
    const item = input as Ornament;
    if (typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(item.id) || ids.has(item.id) || !Object.hasOwn(ORNAMENTS, item.asset) || !validObjectColor(item.color) || (item.y !== undefined && (typeof item.y !== 'number' || !Number.isFinite(item.y) || item.y < 0 || item.y > 2)) || ![item.x, item.z, item.rotation].every(v => typeof v === 'number' && Number.isFinite(v)) || Math.abs(item.rotation) > Math.PI * 2 + 0.01 || !Number.isInteger(item.room) || item.room < 0 || item.room >= rooms) throw new Error('Data ornamen tidak valid.');
    ids.add(item.id);
    const clean: Ornament = { id: item.id, asset: item.asset, x: item.x, z: item.z, rotation: item.rotation, room: item.room, ...(item.y !== undefined ? { y:item.y } : {}), ...(item.color ? { color:item.color } : {}) };
    const error = ornamentError(clean, desks); if (error) throw new Error(`${ORNAMENTS[item.asset].label} (X ${item.x.toFixed(2)}, Z ${item.z.toFixed(2)}): ${error}`);
    return clean;
  });
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j];
    if (a.room !== b.room || a.asset === 'area_rug' || b.asset === 'area_rug') continue;
    const ba=ornamentFootprint(a),bb=ornamentFootprint(b);
    if(ba.ymax<=bb.ymin+.015||bb.ymax<=ba.ymin+.015) continue;
    const separate=[a.rotation,b.rotation].flatMap(r=>[[Math.cos(r),-Math.sin(r)],[Math.sin(r),Math.cos(r)]]).some(([x,z])=>{
      const pa=ba.corners.map(p=>p[0]*x+p[1]*z),pb=bb.corners.map(p=>p[0]*x+p[1]*z);
      return Math.max(...pa)<=Math.min(...pb)+.015||Math.max(...pb)<=Math.min(...pa)+.015;
    });
    if(!separate) throw new Error(`${ORNAMENTS[a.asset].label} (X ${a.x.toFixed(2)}, Z ${a.z.toFixed(2)}) bertabrakan dengan ${ORNAMENTS[b.asset].label} (X ${b.x.toFixed(2)}, Z ${b.z.toFixed(2)}). Geser salah satunya.`);
  }
  return items;
}

export function parseDesks(value: unknown, rooms: number): DeskLayout[] {
  if (!Array.isArray(value) || value.length > rooms * 10) throw new Error('Denah meja tidak valid.');
  const used = new Set<number>();
  const desks: DeskLayout[] = value.map(d => {
    if (!d || !Number.isInteger(d.slot) || d.slot < 0 || d.slot >= rooms * 10 || used.has(d.slot) || ![d.x, d.z, d.rotation].every(n => typeof n === 'number' && Number.isFinite(n)) || Math.abs(d.rotation) > Math.PI * 2 + .01 || !validObjectColor(d.color)) throw new Error('Posisi meja tidak valid.');
    used.add(d.slot);
    return { slot: d.slot, x: d.x, z: d.z, rotation: d.rotation, ...(d.color ? { color:d.color } : {}) };
  });
  for (const room of new Set(desks.map(d => Math.floor(d.slot / 10)))) {
    const poses = Array.from({ length: 10 }, (_, i) => deskPosition(room * 10 + i, desks));
    // Separating-axis check for each desk + chair footprint, including rotation.
    const corners = poses.map(d => [[-.65,-1.15],[.65,-1.15],[.65,.36],[-.65,.36]].map(([x,z]) => [d.x + x*Math.cos(d.rotation)+z*Math.sin(d.rotation), d.z-x*Math.sin(d.rotation)+z*Math.cos(d.rotation)]));
    for (let i = 0; i < 10; i++) {
      if (corners[i].some(([x,z]) => x < -5.5 || x > 4.4 || z < -5.5 || z > 3.8)) throw new Error('Meja harus berada di ruang kerja dan tidak menutup lorong pintu.');
      for (let j = 0; j < i; j++) {
        const separate = [poses[i].rotation, poses[j].rotation].flatMap(r => [[Math.cos(r),-Math.sin(r)],[Math.sin(r),Math.cos(r)]]).some(([x,z]) => {
          const a = corners[i].map(p => p[0]*x+p[1]*z), b = corners[j].map(p => p[0]*x+p[1]*z);
          return Math.max(...a) <= Math.min(...b) + .025 || Math.max(...b) <= Math.min(...a) + .025;
        });
        if (!separate) throw new Error('Meja atau kursi saling bertabrakan. Beri ruang di antaranya.');
      }
      if (!deskCorridor(room * 10 + i, desks).length) throw new Error('Meja ini menutup jalur duduk. Sisakan lorong di belakang kursi.');
    }
  }
  return desks;
}
export function setActivity(space: OfficeSpace, viewerId: string, zone: unknown, now = Date.now()): OfficeSpace {
  if (!Object.hasOwn(space.claims, viewerId)) throw new Error('Anda bukan anggota kantor ini.');
  if (!['auto', 'garden', 'pantry', 'lounge'].includes(String(zone))) throw new Error('Aktivitas tidak valid.');
  const activities = { ...space.activities };
  if (zone === 'auto') delete activities[viewerId];
  else activities[viewerId] = { zone: zone as 'garden' | 'pantry' | 'lounge', until: now + 5 * 60_000 };
  return { ...space, activities, revision: space.revision + 1 };
}

// The supplied private desk sets move as a unit; detached decorations remain independent.
export function updateOrnament(items: Ornament[], id: string, patch: Partial<Ornament>): Ornament[] {
  const parent=items.find(o=>o.id===id); if(!parent) return items;
  const next={...parent,...patch}, prefix=id==='manager-desk' ? 'manager' : id==='lead-desk' ? 'lead' : '';
  const angle=next.rotation-parent.rotation, c=Math.cos(angle), s=Math.sin(angle);
  return items.map(item=>{
    if(item.id===id) return next;
    if(!prefix || !['chair','laptop','keyboard','lamp','pen'].some(part=>item.id===`${prefix}-${part}`)) return item;
    const dx=item.x-parent.x,dz=item.z-parent.z;
    return {...item,x:next.x+dx*c+dz*s,z:next.z-dx*s+dz*c,y:(item.y||0)+(next.y||0)-(parent.y||0),rotation:(item.rotation+angle+Math.PI*2)%(Math.PI*2)};
  });
}

export function moveOrnament(items: Ornament[], id: string, patch: Partial<Ornament>, rooms: number, desks: DeskLayout[], attach = false) {
  const previous=items.find(item=>item.id===id); if(!previous) return items;
  const next=snapOrnament({...previous,...patch},previous,attach);
  return parseOrnaments(updateOrnament(items,id,next),rooms,desks);
}

export function moveDesk(desks: DeskLayout[], slot: number, patch: Partial<DeskLayout>, rooms: number, ornaments: Ornament[]) {
  const previous=deskPosition(slot,desks);
  const next=parseDesks([...desks.filter(d=>d.slot!==slot),{slot,x:previous.x,z:previous.z,rotation:previous.rotation,color:previous.color,...patch}],rooms);
  parseOrnaments(ornaments,rooms,next);
  return next;
}
