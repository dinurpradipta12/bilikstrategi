import { AgencyProject } from '@/lib/types/agency';

export function uniqueProjectsByReference(projects: AgencyProject[]) {
  return projects.filter((project, index, source) => {
    return source.findIndex((candidate) => candidate.id === project.id) === index;
  });
}
