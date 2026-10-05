import { NextRequest, NextResponse } from 'next/server';
import { getServerWorkspaceContext } from '@/lib/auth/server-workspace-context';
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { readTeamBranding } from '@/lib/branding/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

function detectedImage(bytes: Uint8Array) {
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) {
    return { mime: 'image/png', extension: 'png' };
  }
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    return { mime: 'image/jpeg', extension: 'jpg' };
  }
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') {
    return { mime: 'image/webp', extension: 'webp' };
  }
  return null;
}

export async function POST(req: NextRequest) {
  const context = await getServerWorkspaceContext(req);
  if (!context.identity.id || !context.isActive || !context.canManage) {
    return NextResponse.json({ error: 'Hanya Owner atau Admin yang dapat mengunggah logo.' }, { status: 403 });
  }

  try {
    const form = await req.formData();
    const kind = form.get('kind');
    const file = form.get('file');
    if ((kind !== 'logo' && kind !== 'icon') || !(file instanceof File)) {
      return NextResponse.json({ error: 'Jenis gambar atau file tidak valid.' }, { status: 400 });
    }
    if (file.size < 1 || file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ukuran gambar maksimal 2 MB.' }, { status: 400 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const image = detectedImage(bytes);
    if (!image || file.type !== image.mime) {
      return NextResponse.json({ error: 'Gunakan PNG, JPG, atau WebP.' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const path = `${kind}-${crypto.randomUUID()}.${image.extension}`;
    const { error } = await admin.storage.from('team-branding').upload(path, bytes, {
      contentType: image.mime,
      upsert: false,
      cacheControl: '31536000',
    });
    if (error) throw new Error(error.message);
    const { data } = admin.storage.from('team-branding').getPublicUrl(path);
    const { error: updateError } = await admin.from('team_branding').update({
      [kind === 'logo' ? 'logo_url' : 'icon_url']: data.publicUrl,
      updated_by: context.identity.id,
      updated_at: new Date().toISOString(),
    }).eq('id', true);
    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({ branding: await readTeamBranding() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Gagal mengunggah gambar.' }, { status: 400 });
  }
}
