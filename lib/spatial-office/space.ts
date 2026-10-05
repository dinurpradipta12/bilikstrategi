import { DESKS_PER_ROOM, zonePath, type OfficeMember } from './model';

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
export type OfficeSpace = { revision: number; layoutRevision: number; claims: Record<string, number>; ornaments: Ornament[] };
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
  return { revision: Number.isSafeInteger(raw.revision) && raw.revision! >= 0 ? raw.revision! : 0, layoutRevision: Number.isSafeInteger(raw.layoutRevision) && raw.layoutRevision! >= 0 ? raw.layoutRevision! : 0, claims, ornaments: Array.isArray(raw.ornaments) ? raw.ornaments : DEFAULT_ORNAMENTS.map(item => ({ ...item })) };
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
export function ornamentError(item: Ornament): string {
  const size = ORNAMENTS[item.asset];
  const cos = Math.abs(Math.cos(item.rotation)), sin = Math.abs(Math.sin(item.rotation));
  const rx = (size.width * cos + size.depth * sin) / 2, rz = (size.width * sin + size.depth * cos) / 2;
  const garden = item.x - rx >= 12.4 && item.x + rx <= 18.6;
  if (item.z - rz < -5.7 || item.z + rz > 5.7 || (!garden && (item.x - rx < -5.7 || item.x + rx > 11.7))) return 'Tempatkan ornamen di dalam kantor atau taman.';
  if (garden) return '';
  if (Math.abs(item.x - 6) < rx + 0.18 || (item.x > 6 && Math.abs(item.z - 1.5) < rz + 0.18)) return 'Ornamen tidak boleh menembus dinding atau pintu.';
  if (item.asset === 'area_rug') return '';
  if (Math.abs(item.x) < 3.7 + rx && Math.abs(item.z) < 1.65 + rz) return 'Area meja dan kursi harus tetap kosong.';
  for (let slot = 0; slot < DESKS_PER_ROOM; slot++) for (const zone of ['desk', 'lounge', 'pantry'] as const) {
    const path = zonePath(slot, zone);
    for (let i = 1; i < path.length; i++) if (segmentDistance(item.x, item.z, path[i - 1], path[i]) < Math.max(rx, rz) + 0.38) return 'Sisakan lorong untuk jalur karakter.';
  }
  for (const [x, z] of [[7, -4.7], [9, -4.7], [11, -4.7], [7, -1.4], [11, -1.4]]) if (Math.abs(item.x - x) < rx + 1 && Math.abs(item.z - z) < rz + 0.5) return 'Posisi bertabrakan dengan sofa lounge.';
  if (item.x > 6.4 && item.z + rz > 5.15) return 'Posisi bertabrakan dengan meja pantry.';
  return '';
}
export function parseOrnaments(value: unknown, rooms: number): Ornament[] {
  if (!Array.isArray(value) || value.length > 60) throw new Error('Maksimum 60 ornamen per kantor.');
  const ids = new Set<string>();
  const items = value.map(input => {
    if (!input || typeof input !== 'object') throw new Error('Data ornamen tidak valid.');
    const item = input as Ornament;
    if (typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(item.id) || ids.has(item.id) || !Object.hasOwn(ORNAMENTS, item.asset) || ![item.x, item.z, item.rotation].every(v => typeof v === 'number' && Number.isFinite(v)) || Math.abs(item.rotation) > Math.PI * 2 + 0.01 || !Number.isInteger(item.room) || item.room < 0 || item.room >= rooms) throw new Error('Data ornamen tidak valid.');
    ids.add(item.id);
    const clean: Ornament = { id: item.id, asset: item.asset, x: item.x, z: item.z, rotation: item.rotation, room: item.room };
    const error = ornamentError(clean); if (error) throw new Error(error);
    return clean;
  });
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j];
    if (a.room !== b.room || a.asset === 'area_rug' || b.asset === 'area_rug') continue;
    if (Math.hypot(a.x - b.x, a.z - b.z) < (Math.max(ORNAMENTS[a.asset].width, ORNAMENTS[a.asset].depth) + Math.max(ORNAMENTS[b.asset].width, ORNAMENTS[b.asset].depth)) / 2) throw new Error('Dua ornamen saling bertabrakan. Geser salah satunya.');
  }
  return items;
}
