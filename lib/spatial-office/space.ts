import { DESKS_PER_ROOM, zonePath, deskPosition, deskCorridor, type DeskLayout, type OfficeMember } from './model';

export const ORNAMENTS = {
  floor_plant: { label: 'Tanaman besar', width: 0.65, depth: 0.65 },
  floor_lamp: { label: 'Lampu lantai', width: 0.58, depth: 0.58 },
  bookshelf: { label: 'Rak buku', width: 1.04, depth: 0.42 },
  whiteboard: { label: 'Papan tulis', width: 1.76, depth: 0.6 },
  side_table: { label: 'Meja dekorasi', width: 0.72, depth: 0.72 },
  flower_vase: { label: 'Vas bunga', width: 0.5, depth: 0.5 },
  area_rug: { label: 'Karpet', width: 2, depth: 1.35 },
} as const;
export type Ornament = { id: string; asset: keyof typeof ORNAMENTS; x: number; z: number; rotation: number; room: number };
export type OfficeSpace = { revision: number; layoutRevision: number; claims: Record<string, number>; ornaments: Ornament[]; desks: DeskLayout[]; activities: Record<string, NonNullable<OfficeMember["activity"]>> };
export const DEFAULT_ORNAMENTS: Ornament[] = [
  { id: 'plant-back', asset: 'floor_plant', x: -5, z: -5, rotation: 0, room: 0 },
  { id: 'shelf-back', asset: 'bookshelf', x: -2, z: -5.4, rotation: 0, room: 0 },
  { id: 'lamp-back', asset: 'floor_lamp', x: 4.5, z: -5.2, rotation: 0, room: 0 },
  { id: 'plant-front', asset: 'floor_plant', x: -5, z: 4.8, rotation: 0, room: 0 },
  { id: 'rug-lounge', asset: 'area_rug', x: 9, z: -3, rotation: 0, room: 0 },
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
  return { revision: Number.isSafeInteger(raw.revision) && raw.revision! >= 0 ? raw.revision! : 0, layoutRevision: Number.isSafeInteger(raw.layoutRevision) && raw.layoutRevision! >= 0 ? raw.layoutRevision! : 0, claims, desks: Array.isArray(raw.desks) ? raw.desks : [], activities: Object.fromEntries(sorted.flatMap(m => { const a = raw.activities?.[m.id]; return a && ['garden', 'pantry', 'lounge'].includes(a.zone) && Number.isFinite(a.until) ? [[m.id, a]] : []; })), ornaments: Array.isArray(raw.ornaments) ? raw.ornaments : DEFAULT_ORNAMENTS.map(item => ({ ...item })) };
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
export function ornamentError(item: Ornament, desks: DeskLayout[] = []): string {
  const size = ORNAMENTS[item.asset];
  const cos = Math.abs(Math.cos(item.rotation)), sin = Math.abs(Math.sin(item.rotation));
  const rx = (size.width * cos + size.depth * sin) / 2, rz = (size.width * sin + size.depth * cos) / 2;
  const garden = item.x - rx >= 12.4 && item.x + rx <= 18.6;
  if (item.z - rz < -5.7 || item.z + rz > 5.7 || (!garden && (item.x - rx < -5.7 || item.x + rx > 11.7))) return 'Tempatkan ornamen di dalam kantor atau taman.';
  if (garden) return '';
  if (Math.abs(item.x - 6) < rx + 0.18 || (item.x > 6 && Math.abs(item.z - 1.5) < rz + 0.18)) return 'Ornamen tidak boleh menembus dinding atau pintu.';
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
  if (!Array.isArray(value) || value.length > 60) throw new Error('Maksimum 60 ornamen per kantor.');
  const ids = new Set<string>();
  const items = value.map(input => {
    if (!input || typeof input !== 'object') throw new Error('Data ornamen tidak valid.');
    const item = input as Ornament;
    if (typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(item.id) || ids.has(item.id) || !Object.hasOwn(ORNAMENTS, item.asset) || ![item.x, item.z, item.rotation].every(v => typeof v === 'number' && Number.isFinite(v)) || Math.abs(item.rotation) > Math.PI * 2 + 0.01 || !Number.isInteger(item.room) || item.room < 0 || item.room >= rooms) throw new Error('Data ornamen tidak valid.');
    ids.add(item.id);
    const clean: Ornament = { id: item.id, asset: item.asset, x: item.x, z: item.z, rotation: item.rotation, room: item.room };
    const error = ornamentError(clean, desks); if (error) throw new Error(error);
    return clean;
  });
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j];
    if (a.room !== b.room || a.asset === 'area_rug' || b.asset === 'area_rug') continue;
    if (Math.hypot(a.x - b.x, a.z - b.z) < (Math.max(ORNAMENTS[a.asset].width, ORNAMENTS[a.asset].depth) + Math.max(ORNAMENTS[b.asset].width, ORNAMENTS[b.asset].depth)) / 2) throw new Error('Dua ornamen saling bertabrakan. Geser salah satunya.');
  }
  return items;
}

export function parseDesks(value: unknown, rooms: number): DeskLayout[] {
  if (!Array.isArray(value) || value.length > rooms * 10) throw new Error('Denah meja tidak valid.');
  const used = new Set<number>();
  const desks: DeskLayout[] = value.map(d => {
    if (!d || !Number.isInteger(d.slot) || d.slot < 0 || d.slot >= rooms * 10 || used.has(d.slot) || ![d.x, d.z, d.rotation].every(n => typeof n === 'number' && Number.isFinite(n)) || Math.abs(d.rotation) > Math.PI * 2 + .01) throw new Error('Posisi meja tidak valid.');
    used.add(d.slot);
    return { slot: d.slot, x: d.x, z: d.z, rotation: d.rotation };
  });
  for (const room of new Set(desks.map(d => Math.floor(d.slot / 10)))) {
    const poses = Array.from({ length: 10 }, (_, i) => deskPosition(room * 10 + i, desks));
    // Separating-axis check for each desk + chair footprint, including rotation.
    const corners = poses.map(d => [[-.65,-1.15],[.65,-1.15],[.65,.36],[-.65,.36]].map(([x,z]) => [d.x + x*Math.cos(d.rotation)+z*Math.sin(d.rotation), d.z-x*Math.sin(d.rotation)+z*Math.cos(d.rotation)]));
    for (let i = 0; i < 10; i++) {
      if (corners[i].some(([x,z]) => x < -5.5 || x > 4.4 || z < -5.5 || z > 5.5)) throw new Error('Meja harus berada di ruang kerja dan tidak menutup lorong pintu.');
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
