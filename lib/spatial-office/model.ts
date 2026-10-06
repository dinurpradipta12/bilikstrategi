import type { AttendanceSchedule } from '../attendance/schedule';

export type OfficeMember = {
  id: string;
  name: string;
  status: 'working' | 'paused' | 'offline';
  project: string;
  presenceIdle?: boolean;
  startedAt?: number;
  accumulatedSeconds?: number;
  tasks?: OfficeTask[];
  avatar?: AvatarStyle;
  activity?: { zone: 'garden' | 'pantry' | 'lounge'; until: number };
};
export type OfficeSnapshot = { viewerRole?: string; canEditOffice?: boolean; space?: import('./space').OfficeSpace; spaceStorage?: boolean; members: OfficeMember[]; syncedAt: string; viewerId?: string; avatarStorage?: boolean };
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
export const DESKS_PER_ROOM = 12;
export const WORKSPACE_DESKS = 10;
export function deskLabel(slot: number) {
  const i=slot%DESKS_PER_ROOM;
  return i===10?'Meja Manager':i===11?'Meja Project Lead':`Meja ${Math.floor(slot/DESKS_PER_ROOM)*10+i+1}`;
}
export function deskBounds(slot: number) {
  const i=slot%DESKS_PER_ROOM;
  return i===10?[-5.5,-.5,-11.5,-6.8]:i===11?[.5,5.5,-13,-8.3]:[-5.5,4.4,-5.5,3.8];
}
export type DeskLayout = { slot: number; x: number; z: number; rotation: number; color?: string; removed?: boolean };
export function deskPosition(slot: number, layout: DeskLayout[] = []) {
  const index = slot % DESKS_PER_ROOM;
  // Five adjoining stations on each side of a shared, continuous workbench.
  const side = index % 2 === 0 ? -1 : 1;
  const custom = layout.find(d => d.slot === slot);
  const x = custom?.x ?? (index>=10?(index===10?-3:3):(Math.floor(index / 2) - 2) * 1.4), z = custom?.z ?? (index>=10?(index===11?-10.5:-9):side * .375);
  const rotation = custom?.rotation ?? (index>=10?0:side === -1 ? 0 : Math.PI);
  return { x, z, rotation, removed:custom?.removed===true, color: custom?.color || 'original', seatX: x - Math.sin(rotation) * .78, seatZ: z - Math.cos(rotation) * .78, aisleX: x - Math.sin(rotation) * 1.825, aisleZ: z - Math.cos(rotation) * 1.825 };
}
export function officePath(slot: number, leaving = false): Array<[number, number]> {
  const path: Array<[number, number]> = [...zonePath(slot,'exit').reverse(),...zonePath(slot,'desk').slice(1)];
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
export type OfficeZone = 'desk' | 'lounge' | 'pantry' | 'garden' | 'exit';
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
// These destinations illustrate office life; they never write attendance records.
let timeCache: { second: number; schedule?: AttendanceSchedule; value: ReturnType<typeof calculateOfficeTime> } | undefined;
export function officeTime(now: number, schedule?: AttendanceSchedule) {
  const second = Math.floor(now / 1000);
  if (timeCache?.second === second && timeCache.schedule === schedule) return timeCache.value;
  const value = calculateOfficeTime(now, schedule); timeCache = { second, schedule, value }; return value;
}
function calculateOfficeTime(now: number, schedule?: AttendanceSchedule) {
  let timezone = schedule?.timezone || 'Asia/Makassar';
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }); } catch { timezone = 'Asia/Makassar'; }
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(p => [p.type, p.value]));
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  const hour = Number(parts.hour), minute = hour * 60 + Number(parts.minute);
  const days = schedule?.days || Array.from({ length: 7 }, (_, day) => ({ day, isWorking: day > 0 && day < 6, startTime: '08:30', endTime: '17:30' }));
  const minutes = (t: string) => Number(t.split(':')[0]) * 60 + Number(t.split(':')[1]);
  const today = days.find(d => d.day === day), previous = days.find(d => d.day === (day + 6) % 7);
  const inShift = Boolean(today?.isWorking && (minutes(today.startTime) < minutes(today.endTime) ? minute >= minutes(today.startTime) && minute < minutes(today.endTime) : minute >= minutes(today.startTime))) || Boolean(previous?.isWorking && minutes(previous.endTime) <= minutes(previous.startTime) && minute < minutes(previous.endTime));
  const phase = hour < 5 || hour >= 18 ? 'Malam' : hour < 11 ? 'Pagi' : hour < 16 ? 'Siang' : 'Sore';
  return { timezone, hour: hour + Number(parts.minute) / 60, inShift, phase, clock: `${parts.hour}:${parts.minute}:${parts.second}` };
}
export function memberZone(member: OfficeMember, now: number): OfficeZone {
  // Attendance, not the clock or browser activity, controls visibility.
  if (member.status !== 'working' || member.presenceIdle) return 'exit';
  if (member.activity && member.activity.until > now) return member.activity.zone;
  const cycle = workedSeconds(member, now) % 1920;
  if (cycle >= 1800) return 'garden';
  return cycle >= 900 && cycle < 960 ? 'pantry' : 'desk';
}
export function zonePosition(slot: number, zone: OfficeZone, layout: DeskLayout[] = []) {
  const i = slot % DESKS_PER_ROOM;
  if (zone === 'desk') { const d = deskPosition(slot, layout); return { x: d.seatX, z: d.seatZ, rotation: d.rotation }; }
  if (zone === 'exit') return { x:4.5,z:8,rotation:0 };
  if (zone === 'garden') return { x: 13.25 + Math.floor(i / 2) * .95, z: i % 2 ? -2.4 : 0, rotation: i % 2 ? 0 : Math.PI };
  if (zone === 'pantry') return { x: 6.8 + Math.floor(i / 2) * .92, z: i % 2 ? 4.5 : 3.1, rotation: i % 2 ? Math.PI : 0 };
  const sofa = Math.floor(i / 2);
  return { x: (7 + (sofa % 3) * 2) + (i % 2 ? 0.4 : -0.4), z: sofa < 3 ? -4.55 : -1.25, rotation: 0 };
}
// Walkable grid in the workspace, excluding desk surfaces and other chairs.
const corridorCache = new Map<string, Array<[number, number]>>();
export function deskCorridor(slot: number, layout: DeskLayout[]): Array<[number, number]> {
  const key = `${slot}:${JSON.stringify(layout)}`;
  const cached = corridorCache.get(key); if (cached) return cached;
  const path = calculateDeskCorridor(slot, layout);
  if (corridorCache.size > 100) corridorCache.clear(); corridorCache.set(key, path); return path;
}
function calculateDeskCorridor(slot: number, layout: DeskLayout[]): Array<[number, number]> {
  const target = deskPosition(slot, layout), room = Math.floor(slot / DESKS_PER_ROOM);
  const grid = .25, key = (x: number, z: number) => `${x},${z}`;
  const end: [number, number] = [Math.round(target.aisleX / grid), Math.round(target.aisleZ / grid)];
  const privateDesk=slot%DESKS_PER_ROOM>=WORKSPACE_DESKS;
  const door=slot%DESKS_PER_ROOM===10?-1.5:4.5;
  const [xmin,xmax,zmin,zmax]=privateDesk?deskBounds(slot):[-5.5,5.5,-5.5,5.5];
  const doorZ=slot%DESKS_PER_ROOM===11?-7.5:-6;
  const start: [number, number] = privateDesk?[door/grid,(doorZ-.75)/grid]:[20,2];
  const prefix: Array<[number,number]>=privateDesk?[[5,.5],[5,-4.3],[door,-4.3],[door,doorZ]]:[];
  const blocked = (x: number, z: number) => {
    if (x*grid<xmin||x*grid>xmax||z*grid<zmin||z*grid>zmax) return true;
    for (let i = 0; i < DESKS_PER_ROOM; i++) {
      const d = deskPosition(room * DESKS_PER_ROOM + i, layout), dx = x * grid - d.x, dz = z * grid - d.z;
      if(d.removed) continue;
      const u = dx * Math.cos(d.rotation) - dz * Math.sin(d.rotation), v = dx * Math.sin(d.rotation) + dz * Math.cos(d.rotation);
      if (Math.abs(u) < .86 && Math.abs(v) < .58) return true;
      if (room * DESKS_PER_ROOM + i !== slot && Math.hypot(x * grid - d.seatX, z * grid - d.seatZ) < .52) return true;
    }
    return false;
  };
  const queue: Array<[number, number]> = [start], parents = new Map<string, [number, number] | null>([[key(...start), null]]);
  for (let n = 0; n < queue.length; n++) {
    const p = queue[n];
    if (p[0] === end[0] && p[1] === end[1]) {
      const path: Array<[number, number]> = []; let node: [number, number] | null = p;
      while (node) { path.push([node[0] * grid, node[1] * grid]); node = parents.get(key(...node))!; }
      return [...prefix,...path.reverse().filter((point, i, all) => !i || i === all.length - 1 || (all[i-1][0] !== all[i+1][0] && all[i-1][1] !== all[i+1][1])), [target.aisleX, target.aisleZ], [target.seatX, target.seatZ]];
    }
    for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const next: [number, number] = [p[0] + dx, p[1] + dz];
      if (!parents.has(key(...next)) && !blocked(...next)) { parents.set(key(...next), p); queue.push(next); }
    }
  }
  return [];
}
// All destinations use the shared corridor and the two partition doors.
export function zonePath(slot: number, zone: OfficeZone, layout: DeskLayout[] = []): Array<[number, number]> {
  const p = zonePosition(slot, zone, layout);
  if (zone === 'exit') return [[5,.5],[5,4.5],[4.5,4.5],[4.5,6],[4.5,7],[p.x,p.z]];
  if (zone === 'garden') return [[5,.5],[5,3.8],[6,3.8],[11,3.8],[11,4.5],[12,4.5],[15.5,4.5],[15.5,1.9],[12.5,1.9],[12.5,-1.2],[p.x,-1.2],[p.x,p.z]];
  if (zone === 'desk' && (slot%DESKS_PER_ROOM>=WORKSPACE_DESKS || layout.some(d => Math.floor(d.slot / DESKS_PER_ROOM) === Math.floor(slot / DESKS_PER_ROOM)))) return deskCorridor(slot, layout);
  if (zone === 'desk') { const d = deskPosition(slot); return [[5, 0.5], [5, d.aisleZ], [d.x, d.aisleZ], [p.x, p.z]]; }
  if (zone === 'pantry') return [[5, 0.5], [5, 3.8], [6, 3.8], [p.x, 3.8], [p.x, p.z]];
  const aisle = slot % DESKS_PER_ROOM < 6 ? -3.1 : 0;
  return [[5, 0.5], [6, 0.5], [9, 0.5], [9, aisle], [p.x, aisle], [p.x, p.z]];
}
// Find a corridor route from the actual position, including rapid direction changes.
type Point = [number,number];
type TravelGraph={nodes:Map<string,Point>;segments:[Point,Point][];costs:Map<string,number>;next:Map<string,string>;end:Point};
const travelGraphCache=new Map<string,TravelGraph>();
const pathKey=(p:Point)=>p.join(',');
const pathDistance=(a:Point,b:Point)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function buildTravelGraph(slot:number,target:OfficeZone,fromSlot:number,layout:DeskLayout[]):TravelGraph|null {
  const key=pathKey,distance=pathDistance;
  const nodes = new Map<string, Point>(), edges = new Map<string, Set<string>>();
  const segments: [Point, Point][] = [];
  for (const sourceSlot of new Set([slot, fromSlot, ...Array.from({ length: DESKS_PER_ROOM }, (_, i) => Math.floor(slot / DESKS_PER_ROOM) * DESKS_PER_ROOM + i)])) for (const zone of ['desk', 'lounge', 'pantry', 'garden', 'exit'] as const) {
    const path = zonePath(sourceSlot, zone, layout);
    for (const p of path) { nodes.set(key(p), p); if (!edges.has(key(p))) edges.set(key(p), new Set()); }
    for (let i = 1; i < path.length; i++) { const a = path[i - 1], b = path[i]; edges.get(key(a))!.add(key(b)); edges.get(key(b))!.add(key(a)); segments.push([a, b]); }
  }
  const end = zonePath(slot, target, layout).at(-1)!;
  if (!end) return null;
  const costs = new Map<string, number>([[key(end), 0]]), next = new Map<string, string>(), pending = new Set(nodes.keys());
  while (pending.size) {
    const current = [...pending].sort((a, b) => (costs.get(a) ?? Infinity) - (costs.get(b) ?? Infinity))[0];
    pending.delete(current);
    for (const neighbor of edges.get(current)!) {
      const cost = (costs.get(current) ?? Infinity) + distance(nodes.get(current)!, nodes.get(neighbor)!);
      if (cost < (costs.get(neighbor) ?? Infinity)) { costs.set(neighbor, cost); next.set(neighbor, current); }
    }
  }
  return {nodes,segments,costs,next,end};
}
export function travelPath(slot: number, from: Point, target: OfficeZone, fromSlot = slot, layout: DeskLayout[] = []): Point[] {
  const cacheKey=`${slot}:${fromSlot}:${target}:${JSON.stringify(layout)}`;
  let graph=travelGraphCache.get(cacheKey);
  if(!graph) {
    const computed=buildTravelGraph(slot,target,fromSlot,layout); if(!computed) return [];
    if(travelGraphCache.size>=120) travelGraphCache.clear();
    travelGraphCache.set(cacheKey,computed); graph=computed;
  }
  const {nodes,segments,costs,next,end}=graph,key=pathKey,distance=pathDistance;
  let nearest = Infinity, shortest = Infinity, start = key(end), projected: Point = from;
  for (const [a, b] of segments) {
    const dx = b[0] - a[0], dz = b[1] - a[1];
    if (!dx && !dz) continue;
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
  if (member.status !== 'working' || member.presenceIdle || zone === 'exit') return '';
  const lines = zone === 'pantry' ? ['Ada yang mau kopi juga?', 'Kopi dulu, yuk. Setelah ini lanjut lagi.', 'Mau teh atau kopi hari ini?', 'Aroma kopinya enak, ya.']
    : zone === 'garden' ? ['Enak juga duduk di taman.', 'Cari udara segar sebentar, yuk.', 'Ada ide baru yang mau dibahas?', 'Teduh sekali di sini.']
    : zone === 'lounge' ? ['Istirahat sebentar, yuk.', 'Bagaimana kabar kalian hari ini?', 'Nanti kita lanjut ngobrol setelah rehat.', 'Ada rekomendasi makan siang?']
    : [...(member.tasks || []).flatMap(task => [`Aku lanjut ${task.name}, ya.`, `Ada masukan untuk ${task.name}?`]), ...(member.project ? [`Yuk, bahas ide untuk ${member.project}.`, `Aku fokus ke ${member.project} dulu, ya.`] : []), 'Sebentar, aku catat idenya dulu.', 'Kalau ada yang perlu dibahas, kabari ya.', 'Kita cek detailnya bersama nanti, ya.'];
  return lines[(Math.floor(now / 11000) + memberHash(member.id)) % lines.length].slice(0, 150);
}
export type TaskRow = { task_name?: string; status?: string; assignee_ids?: unknown[]; raw_data?: { assignee_emails?: string[]; task_name?: string; name?: string } };
export function memberTasks(member: RosterMember, tasks: TaskRow[]): OfficeTask[] {
  return tasks.filter(task => !/complete|closed|done|selesai/i.test(task.status || '') &&
    (task.assignee_ids?.length ? task.assignee_ids.some(id => String(id) === member.id) : task.raw_data?.assignee_emails?.some(email => normalized(email) === normalized(member.email))))
    .slice(0, 8).map(task => ({ name: String(task.task_name || task.raw_data?.task_name || task.raw_data?.name || 'Tugas').slice(0, 100), status: String(task.status || 'to_do').slice(0, 40) }));
}
