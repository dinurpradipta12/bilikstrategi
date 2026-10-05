export type OfficeMember = {
  id: string;
  name: string;
  status: 'working' | 'paused' | 'offline';
  project: string;
};
export type OfficeSnapshot = { members: OfficeMember[]; syncedAt: string };
export type RosterMember = { id: string; name: string; email: string; aliases?: string[] };
export type SessionRow = {
  user_id?: unknown; user_email?: unknown; user_name?: unknown;
  is_paused?: unknown; selected_project?: unknown; project_name?: unknown;
  check_in_timestamp?: unknown; updated_at?: unknown;
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
  return { x: index % 2 === 0 ? -2.15 : 2.15, z: -3.3 + Math.floor(index / 2) * 2.9 };
}
export function memberHash(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}
export function statusLabel(member: OfficeMember) {
  return member.status === 'paused' ? 'Sedang istirahat' : member.status === 'offline' ? 'Belum check-in' : 'Sudah check-in';
}
export function bubbleLabel(member: OfficeMember) {
  if (member.status === 'paused') return '☕ Sedang istirahat';
  return member.project ? `💻 ${member.project}` : '💻 Sesi kerja berlangsung';
}
