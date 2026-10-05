import { isSupabaseAdminConfigured, supabaseAdminFetch } from '@/lib/supabase/admin-rest-client';
import { normalizeSpace, type OfficeSpace } from './space';
import type { OfficeMember } from './model';

const spaceKey = (teamId: string) => `spatial-space:${teamId}:v1`;
const query = (teamId: string) => `app_settings?select=value&key=eq.${encodeURIComponent(spaceKey(teamId))}`;
export async function readOfficeSpace(teamId: string, members: Pick<OfficeMember, 'id'>[]) {
  if (!isSupabaseAdminConfigured()) return { space: normalizeSpace(null, members), ready: false };
  try {
    const response = await supabaseAdminFetch(query(teamId));
    if (!response.ok) throw new Error('Storage unavailable');
    const rows = await response.json();
    return { space: normalizeSpace(rows[0]?.value, members), ready: true };
  } catch { return { space: normalizeSpace(null, members), ready: false }; }
}
// Compare-and-swap is evaluated by Postgres on the JSON revision. Two claims
// cannot both win the same revision, including when the row is first created.
export async function mutateOfficeSpace(teamId: string, members: Pick<OfficeMember, 'id'>[], mutate: (space: OfficeSpace) => OfficeSpace) {
  if (!isSupabaseAdminConfigured()) throw new Error('Penyimpanan kantor belum terhubung.');
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await supabaseAdminFetch(query(teamId));
    if (!response.ok) throw new Error('Penyimpanan kantor belum tersedia.');
    const rows = await response.json();
    const current = normalizeSpace(rows[0]?.value, members);
    const next = mutate(current);
    const body = JSON.stringify({ key: spaceKey(teamId), value: next, updated_at: new Date().toISOString() });
    const result = rows.length ? await supabaseAdminFetch(`${query(teamId)}&value->>revision=eq.${current.revision}`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' }, body,
    }) : await supabaseAdminFetch('app_settings?on_conflict=key', {
      method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' }, body,
    });
    if (!result.ok) throw new Error('Perubahan kantor belum tersimpan.');
    const updated = await result.json();
    if (Array.isArray(updated) && updated.length) return next;
  }
  throw new Error('Kantor baru diperbarui anggota lain. Sinkronkan lalu coba kembali.');
}
