import { NextRequest, NextResponse } from 'next/server';
import { supabaseRest as supabase } from '@/lib/supabase/rest-client';
import { isSuperuserEmail } from '@/lib/auth/app-role';

export const runtime = 'edge';

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || `workspace-${Date.now()}`;
}

function getRequestUser(req: NextRequest) {
  const name = req.cookies.get('clickup_user_name')?.value || 'Pengguna';
  const email = req.cookies.get('clickup_user_email')?.value || '';
  const avatar =
    req.cookies.get('clickup_user_avatar')?.value ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=24324A&color=fff`;
  const id = req.cookies.get('clickup_user_id')?.value || email || name.toLowerCase().replace(/\s+/g, '-');

  return { id: String(id), name, email, avatar };
}

async function ensureDefaultWorkspace(user = { id: '', name: 'Pengguna', email: '', avatar: '' }) {
  const existingWorkspace = await supabase
    .from('app_workspaces')
    .select('owner_user_id,owner_email')
    .eq('id', 'bilik-strategi')
    .maybeSingle();

  const defaultWorkspace = {
    id: 'bilik-strategi',
    name: 'Bilik Strategi Workspace',
    slug: 'bilik-strategi',
    owner_user_id: existingWorkspace.data?.owner_user_id || (isSuperuserEmail(user.email) ? user.id : null),
    owner_email: existingWorkspace.data?.owner_email || 'snllabsarchive@gmail.com',
    clickup_workspace_id: process.env.CLICKUP_WORKSPACE_ID || process.env.CLICKUP_TEAM_ID || '90182855619',
    clickup_space_id: process.env.CLICKUP_SPACE_ID || null,
    clickup_sync_enabled: true,
    clickup_sync_status: 'configured',
  };

  await supabase.from('app_workspaces').upsert(defaultWorkspace, { onConflict: 'id' });
  if (user.id) {
    await supabase.from('app_workspace_members').upsert(
      {
        workspace_id: defaultWorkspace.id,
        user_id: user.id,
        user_name: user.name,
        user_email: user.email,
        user_avatar: user.avatar,
        role: isSuperuserEmail(user.email) ? 'owner' : 'member',
        status: 'active',
      },
      { onConflict: 'workspace_id,user_id' }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = getRequestUser(req);
    await ensureDefaultWorkspace(user);

    const { data, error } = await supabase
      .from('app_workspaces')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ workspaces: data || [], current_workspace_id: req.cookies.get('app_workspace_id')?.value || 'bilik-strategi' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal mengambil workspace app' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = getRequestUser(req);
    const body = await req.json();
    const name = String(body.name || '').trim();
    if (!name) {
      return NextResponse.json({ error: 'Nama workspace wajib diisi' }, { status: 400 });
    }

    const slug = slugify(name);
    const workspace = {
      id: `ws_${slug}_${Date.now()}`,
      name,
      slug,
      owner_user_id: user.id,
      owner_email: user.email,
      clickup_workspace_id: body.clickup_workspace_id || null,
      clickup_space_id: body.clickup_space_id || null,
      clickup_sync_enabled: Boolean(body.clickup_sync_enabled),
      clickup_sync_status: body.clickup_sync_enabled ? 'pending_configuration' : 'not_configured',
    };

    const { data, error } = await supabase.from('app_workspaces').insert(workspace).select('*').single();
    if (error) throw error;

    await supabase.from('app_workspace_members').upsert(
      {
        workspace_id: data.id,
        user_id: user.id,
        user_name: user.name,
        user_email: user.email,
        user_avatar: user.avatar,
        role: 'owner',
        status: 'active',
      },
      { onConflict: 'workspace_id,user_id' }
    );

    const response = NextResponse.json({ workspace: data });
    response.cookies.set('app_workspace_id', data.id, { path: '/' });
    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal membuat workspace app' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = String(body.workspace_id || '').trim();
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id wajib diisi' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('app_workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: 'Workspace tidak ditemukan' }, { status: 404 });
    }

    const response = NextResponse.json({ workspace: data });
    response.cookies.set('app_workspace_id', data.id, { path: '/' });
    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal memilih workspace app' }, { status: 500 });
  }
}
