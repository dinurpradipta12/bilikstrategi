import { NextRequest, NextResponse } from 'next/server';
import { supabaseRest as supabase } from '@/lib/supabase/rest-client';
import { publishProjectAssignments, publishProjectEvent } from '@/lib/notifications/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ProjectMetaPayload = Record<string, unknown>;

const globalProjectMetaStore = new Map<string, ProjectMetaPayload>();

function normalizeProjectId(value: string | null | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'Unknown error');
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = normalizeProjectId(searchParams.get('projectId'));

  if (!projectId) {
    return NextResponse.json({ error: 'projectId wajib diisi' }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from('project_meta')
      .select('project_id, meta, updated_at')
      .eq('project_id', projectId)
      .maybeSingle();

    if (!error && data) {
      globalProjectMetaStore.set(projectId, data.meta);
      return NextResponse.json(
        { projectId, meta: data.meta, updated_at: data.updated_at },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (error) {
      console.warn('[Project Meta API] Supabase read error, fallback to memory:', error.message);
    }
  } catch (error: unknown) {
    console.warn('[Project Meta API] Supabase read exception, fallback to memory:', getErrorMessage(error));
  }

  return NextResponse.json(
    { projectId, meta: globalProjectMetaStore.get(projectId) || null },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const projectId = normalizeProjectId(body.projectId || body.project_id);
    const meta = body.meta as unknown;

    if (!projectId) {
      return NextResponse.json({ error: 'projectId wajib diisi' }, { status: 400 });
    }

    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
      return NextResponse.json({ error: 'meta wajib berupa object' }, { status: 400 });
    }

    const projectMeta = meta as ProjectMetaPayload;
    const updatedAt = new Date().toISOString();
    const notificationSilent = body.notification_silent === true;
    let previousMemberEmails: string[] = [];

    if (!notificationSilent) {
      try {
        const previous = await supabase
          .from('project_meta')
          .select('meta')
          .eq('project_id', projectId)
          .maybeSingle();
        const previousMembers = previous.data?.meta?.teamMembers;
        previousMemberEmails = Array.isArray(previousMembers)
          ? previousMembers
              .map((member: any) => String(member?.email || '').trim().toLowerCase())
              .filter(Boolean)
          : [];
      } catch {
        // Treat an unreadable previous snapshot as a first assignment save.
      }
    }

    globalProjectMetaStore.set(projectId, projectMeta);

    try {
      const { error } = await supabase
        .from('project_meta')
        .upsert(
          {
            project_id: projectId,
            meta: projectMeta,
            updated_at: updatedAt,
          },
          { onConflict: 'project_id' }
        );

      if (error) {
        console.warn('[Project Meta API] Supabase upsert error:', error.message);
        return NextResponse.json({
          success: true,
          projectId,
          meta: projectMeta,
          warning: error.message,
        });
      }

      if (!notificationSilent) {
        const projectName = String(projectMeta.name || projectMeta.title || projectId);
        const memberEmails = Array.isArray(projectMeta.teamMembers)
          ? projectMeta.teamMembers
              .map((member: any) => member?.email)
              .filter((email): email is string => typeof email === 'string' && email.trim().length > 0)
          : [];
        const newlyAssignedEmails = memberEmails.filter((email) => !previousMemberEmails.includes(email.toLowerCase()));
        await publishProjectEvent(req, {
          type: 'project_meta_updated',
          title: 'Detail project diperbarui',
          message: `Detail dan informasi project "${projectName}" diperbarui.`,
          projectId,
          projectName,
          token: updatedAt,
          excludeRecipientEmails: newlyAssignedEmails,
          payload: { fields: Object.keys(projectMeta) },
        }).catch((publishError) => {
          console.warn('[Project Meta API] Notification publish failed:', publishError);
        });

        await publishProjectAssignments(req, {
          projectId,
          projectName,
          recipientEmails: newlyAssignedEmails,
        }).catch((publishError) => {
          console.warn('[Project Meta API] Project assignment notification failed:', publishError);
        });
      }
    } catch (error: unknown) {
      console.warn('[Project Meta API] Supabase upsert exception:', getErrorMessage(error));
      return NextResponse.json({
        success: true,
        projectId,
        meta: projectMeta,
        warning: getErrorMessage(error) || 'Supabase meta sync skipped',
      });
    }

    return NextResponse.json({ success: true, projectId, meta: projectMeta });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) || 'Gagal menyimpan metadata project' }, { status: 500 });
  }
}
