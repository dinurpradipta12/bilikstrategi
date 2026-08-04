import ProjectDetailClient from '@/components/projects/ProjectDetailClient';

export function generateStaticParams() {
  return [{ id: 'default' }];
}

export const dynamicParams = true;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return <ProjectDetailClient id={resolvedParams?.id} />;
}
