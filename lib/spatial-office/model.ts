export type OfficeMember = {
  id: string;
  name: string;
  status: 'working' | 'paused' | 'offline';
  project: string;
  startedAt?: number;
  accumulatedSeconds?: number;
  tasks?: OfficeTask[];
  avatar?: AvatarStyle;
};
export type OfficeSnapshot = { members: OfficeMember[]; syncedAt: string; viewerId?: string; avatarStorage?: boolean };
export type RosterMember = { id: string; name: string; email: string; aliases?: string[] };
export type SessionRow = {
  user_id?: unknown; user_email?: unknown; user_name?: unknown;
  is_paused?: unknown; selected_project?: unknown; project_name?: unknown;
  check_in_timestamp?: unknown; accumulated_seconds?: unknown; updated_at?: unknown;
};

const normalized = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase('en-US');

// Legacy attendance has names only. Never match a substring or a duplicated name.
export function buildOfficeMembers(roster: RosterMember[], sessions: SessionRow[]): OfficeMember[] {
  const nameOwners = new Map<string, Set<string>>();
  for (const member of roster) {
    for (const name of [member.name, ...(member.aliases ?? [])]) {
      const key = normalized(name);
      if (key) nameOwners.set(key, new Set([...(nameOwners.get(key) ?? []), member.id]));
    }
  }
  const matches = new Map<string, SessionRow>();
  for (const session of sessions) {
    const email = normalized(session.user_email);
    const id = normalized(session.user_id);
    const name = normalized(session.user_name);
    const owner = id ? roster.find(m => normalized(m.id) === id)
      : email ? roster.find(m => normalized(m.email) === email)
        : nameOwners.get(name)?.size === 1 ? roster.find(m => nameOwners.get(name)!.has(m.id)) : undefined;
    if (!owner) continue;
    const previous = matches.get(owner.id);
    const time = (row: SessionRow) => Date.parse(String(row.updated_at ?? '')) || Number(row.check_in_timestamp) || 0;
    if (!previous || time(session) >= time(previous)) matches.set(owner.id, session);
  }
  return roster.map(member => {
    const session = matches.get(member.id);
    return {
      id: member.id, name: member.name,
      status: session ? session.is_paused === true ? 'paused' : 'working' : 'offline',
      startedAt: session ? timestamp(session.check_in_timestamp) : 0,
      accumulatedSeconds: session ? Math.max(0, Number(session.accumulated_seconds) || 0) : 0,
      project: session ? String(session.project_name || session.selected_project || '').trim().slice(0, 100) : '',
    };
  });
}

// Keep a member's desk across check-ins, checkouts and roster refreshes. New members
// fill vacant slots; removing one member never moves everybody else's desk.
export function reconcileSeats(previous: ReadonlyMap<string, number>, members: OfficeMember[]) {
  const ids = new Set(members.map(member => member.id));
  const seats = new Map([...previous].filter(([id]) => ids.has(id)));
  const occupied = new Set(seats.values());
  for (const member of [...members].sort((a, b) => a.id.localeCompare(b.id))) {
    if (seats.has(member.id)) continue;
    let slot = 0;
    while (occupied.has(slot)) slot++;
    seats.set(member.id, slot);
    occupied.add(slot);
  }
  return seats;
}
export const DESKS_PER_ROOM = 6;
export function deskPosition(slot: number) {
  const index = slot % DESKS_PER_ROOM;
  // Three adjoining stations on each side of a shared, continuous workbench.
  const side = index % 2 === 0 ? -1 : 1;
  return {
    x: (Math.floor(index / 2) - 1) * 1.4,
    z: side * 0.375,
    rotation: side === -1 ? 0 : Math.PI,
    seatZ: side * 1.155,
    aisleZ: side * 2.2,
  };
}
export function officePath(slot: number, leaving = false): Array<[number, number]> {
  const desk = deskPosition(slot);
  const path: Array<[number, number]> = [[-5.5, 3.5], [-3.15, 3.5], [-3.15, desk.aisleZ], [desk.x, desk.aisleZ], [desk.x, desk.seatZ]];
  return leaving ? path.reverse() : path;
}
export function memberHash(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}
export function statusLabel(member: OfficeMember) {
  return member.status === 'paused' ? 'Sedang istirahat' : member.status === 'offline' ? 'Belum check-in' : 'Sudah check-in';
}
export const AVATAR_MODELS = ['operations', 'research', 'copywriter', 'designer', 'qa', 'analyst', 'hr', 'finance'] as const;
export const AVATAR_COLORS = ['original', '#3d302b', '#c58d51', '#d78296', '#759484', '#8795bd', '#b2a0c5', '#e9debd'] as const;
export type AvatarStyle = { model: typeof AVATAR_MODELS[number]; hair: typeof AVATAR_MODELS[number]; hairColor: typeof AVATAR_COLORS[number]; shirtColor: typeof AVATAR_COLORS[number]; glasses: boolean };
export type OfficeTask = { name: string; status: string };
export type OfficeZone = 'desk' | 'lounge' | 'pantry';
export function defaultAvatar(id: string): AvatarStyle {
  const model = AVATAR_MODELS[memberHash(id) % AVATAR_MODELS.length];
  return { model, hair: model, hairColor: 'original', shirtColor: 'original', glasses: model === 'designer' };
}
export function parseAvatar(value: unknown): AvatarStyle | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as AvatarStyle;
  if (!AVATAR_MODELS.includes(v.model) || !AVATAR_MODELS.includes(v.hair) || !AVATAR_COLORS.includes(v.hairColor) || !AVATAR_COLORS.includes(v.shirtColor) || typeof v.glasses !== 'boolean') return null;
  return { model: v.model, hair: v.hair, hairColor: v.hairColor, shirtColor: v.shirtColor, glasses: v.glasses };
}
function timestamp(value: unknown) { const n = Number(value); return Number.isFinite(n) && n > 0 ? n : Date.parse(String(value ?? '')) || 0; }
export function workedSeconds(member: OfficeMember, now: number) {
  return Math.max(0, member.accumulatedSeconds || 0) + (member.status === 'working' && member.startedAt ? Math.max(0, now - member.startedAt) / 1000 : 0);
}
// 15 minutes at the desk, then a 60-second ambient coffee visit. Attendance is untouched.
export function memberZone(member: OfficeMember, now: number): OfficeZone {
  if (member.status !== 'working') return 'lounge';
  return workedSeconds(member, now) % 960 >= 900 ? 'pantry' : 'desk';
}
export function zonePosition(slot: number, zone: OfficeZone) {
  const i = slot % DESKS_PER_ROOM;
  if (zone === 'desk') { const d = deskPosition(slot); return { x: d.x, z: d.seatZ, rotation: d.rotation }; }
  if (zone === 'pantry') return { x: 5.8 + Math.floor(i / 2) * 1.6, z: i % 2 ? 3.6 : 2.3, rotation: i % 2 ? Math.PI : 0 };
  return { x: (i < 4 ? 6 : 9) + (i % 2 ? 0.4 : -0.4), z: i < 2 ? -3.35 : i < 4 ? -0.4 : -3.35, rotation: i >= 2 && i < 4 ? Math.PI : 0 };
}
// Each zone connects through one door to the same clear corridor on the right.
export function zonePath(slot: number, zone: OfficeZone): Array<[number, number]> {
  const p = zonePosition(slot, zone);
  if (zone === 'desk') { const d = deskPosition(slot); return [[3.4, 0.5], [3.4, d.aisleZ], [d.x, d.aisleZ], [p.x, p.z]]; }
  if (zone === 'pantry') return [[3.4, 0.5], [3.4, 3], [4.5, 3], [5, 3], [p.x, 3], [p.x, p.z]];
  return [[3.4, 0.5], [4.5, 0.5], [7.5, 0.5], [7.5, -1.8], [p.x, -1.8], [p.x, p.z]];
}
// Find a corridor route from the actual position, including rapid direction changes.
export function travelPath(slot: number, from: [number, number], target: OfficeZone): Array<[number, number]> {
  type Point = [number, number];
  const nodes = new Map<string, Point>(), edges = new Map<string, Set<string>>();
  const key = (p: Point) => p.join(',');
  const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const segments: [Point, Point][] = [];
  for (const zone of ['desk', 'lounge', 'pantry'] as const) {
    const path = zonePath(slot, zone);
    for (const p of path) { nodes.set(key(p), p); if (!edges.has(key(p))) edges.set(key(p), new Set()); }
    for (let i = 1; i < path.length; i++) { const a = path[i - 1], b = path[i]; edges.get(key(a))!.add(key(b)); edges.get(key(b))!.add(key(a)); segments.push([a, b]); }
  }
  const end = zonePath(slot, target).at(-1)!;
  const costs = new Map<string, number>([[key(end), 0]]), next = new Map<string, string>(), pending = new Set(nodes.keys());
  while (pending.size) {
    const current = [...pending].sort((a, b) => (costs.get(a) ?? Infinity) - (costs.get(b) ?? Infinity))[0];
    pending.delete(current);
    for (const neighbor of edges.get(current)!) {
      const cost = (costs.get(current) ?? Infinity) + distance(nodes.get(current)!, nodes.get(neighbor)!);
      if (cost < (costs.get(neighbor) ?? Infinity)) { costs.set(neighbor, cost); next.set(neighbor, current); }
    }
  }
  let nearest = Infinity, shortest = Infinity, start = key(end), projected: Point = from;
  for (const [a, b] of segments) {
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((from[0] - a[0]) * dx + (from[1] - a[1]) * dz) / (dx * dx + dz * dz)));
    const p: Point = [a[0] + dx * t, a[1] + dz * t], offPath = distance(from, p);
    for (const endpoint of [a, b]) {
      const cost = distance(p, endpoint) + costs.get(key(endpoint))!;
      if (offPath < nearest - 1e-6 || (Math.abs(offPath - nearest) < 1e-6 && cost < shortest)) { nearest = offPath; shortest = cost; start = key(endpoint); projected = p; }
    }
  }
  const route: Point[] = [projected, nodes.get(start)!];
  while (next.has(start)) { start = next.get(start)!; route.push(nodes.get(start)!); }
  return route.filter((point, i) => distance(point, i ? route[i - 1] : from) > 1e-6);
}
export const KEYBOARD_TOP = 0.78 + 0.063;
export const AVATAR_SCALE = 0.53;
export function typingHand(index: number, bodyLift: number, tap = 0): [number, number, number] {
  return [(index ? 1 : -1) * 0.24 + tap, -0.51 / AVATAR_SCALE, (KEYBOARD_TOP + 0.15 * AVATAR_SCALE) / AVATAR_SCALE - bodyLift];
}

export function bubbleLabel(member: OfficeMember, zone: OfficeZone = 'desk', now = Date.now()) {
  let lines: string[];
  if (member.status === 'offline') lines = ['Belum check-in · ruang tunggu', 'Offline · meja tetap tersedia'];
  else if (member.status === 'paused') lines = ['Presensi dijeda · sedang istirahat', member.project ? `Jeda dari ${member.project}` : 'Istirahat di lounge', 'Sesi kerja sedang dijeda'];
  else if (zone === 'pantry') lines = ['☕ Membuat kopi · animasi pantry', 'Mengambil minuman sebelum kembali ke meja', member.project ? `Jeda kopi · ${member.project}` : 'Mengisi ulang energi'];
  else {
    lines = (member.tasks || []).map(task => `${/revision|revisi/i.test(task.status) ? 'Perlu revisi' : /review/i.test(task.status) ? 'Dalam review' : /progress|proses/i.test(task.status) ? 'Dalam progres' : 'Tugas terjadwal'}: ${task.name}`);
    if (member.project) lines.push(`Project presensi: ${member.project}`, `Sesi kerja untuk ${member.project}`);
    if (!lines.length) lines = ['Sesi kerja berlangsung', 'Sudah check-in · belum memilih project'];
  }
  return lines[(Math.floor(now / 8000) + memberHash(member.id)) % lines.length].slice(0, 150);
}
export type TaskRow = { task_name?: string; status?: string; assignee_ids?: unknown[]; raw_data?: { assignee_emails?: string[]; task_name?: string; name?: string } };
export function memberTasks(member: RosterMember, tasks: TaskRow[]): OfficeTask[] {
  return tasks.filter(task => !/complete|closed|done|selesai/i.test(task.status || '') &&
    (task.assignee_ids?.length ? task.assignee_ids.some(id => String(id) === member.id) : task.raw_data?.assignee_emails?.some(email => normalized(email) === normalized(member.email))))
    .slice(0, 8).map(task => ({ name: String(task.task_name || task.raw_data?.task_name || task.raw_data?.name || 'Tugas').slice(0, 100), status: String(task.status || 'to_do').slice(0, 40) }));
}
