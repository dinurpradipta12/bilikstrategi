import ProjectDetailClient from '@/components/projects/ProjectDetailClient';

// Project ids are created at runtime and can be UUIDs from Supabase. Keep
// this page as a dynamic Edge route so Cloudflare does not return 404 for a
// project that did not exist when the build ran.
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return <ProjectDetailClient id={resolvedParams?.id} />;
}
