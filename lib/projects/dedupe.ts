import { AgencyProject } from '@/lib/mock/data';

function projectText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : value == null ? fallback : String(value);
}

function normalizeProjectName(value: unknown) {
  return projectText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function projectReference(project: AgencyProject) {
  return projectText(project.clickup_list_id || project.id).trim();
}

export function uniqueProjectsByReference(projects: AgencyProject[]) {
  return projects.filter((project, index, source) => {
    const reference = projectReference(project);
    return source.findIndex((candidate) => candidate.id === project.id || (reference && projectReference(candidate) === reference)) === index;
  });
}

export function projectsRepresentSameEntity(appProject: AgencyProject, clickupProject: AgencyProject) {
  const appListId = projectText(appProject.clickup_list_id).trim();
  const clickupListId = projectText(clickupProject.clickup_list_id || clickupProject.id).trim();
  if (appListId && clickupListId && appListId === clickupListId) return true;
  if (projectText(appProject.id).trim() === projectText(clickupProject.id).trim()) return true;

  const appUsesPlaceholderReference = !appListId || appListId === projectText(appProject.id).trim();
  return appUsesPlaceholderReference && normalizeProjectName(appProject.name) !== '' && normalizeProjectName(appProject.name) === normalizeProjectName(clickupProject.name);
}

export function mergeAppProjectWithClickUp(appProject: AgencyProject, clickupProject: AgencyProject): AgencyProject {
  const appHasTaskSummary = appProject.total_tasks > 0;
  return {
    ...clickupProject,
    ...appProject,
    id: appProject.id,
    clickup_list_id: projectText(clickupProject.clickup_list_id || clickupProject.id || appProject.clickup_list_id),
    total_tasks: appHasTaskSummary ? appProject.total_tasks : clickupProject.total_tasks,
    completed_tasks: appHasTaskSummary ? appProject.completed_tasks : clickupProject.completed_tasks,
    overdue_tasks: appHasTaskSummary ? appProject.overdue_tasks : clickupProject.overdue_tasks,
    progress_percentage: appHasTaskSummary ? appProject.progress_percentage : clickupProject.progress_percentage,
  };
}

/** Keep one application project per ClickUp List and use ClickUp as enrichment. */
export function mergeProjectSources(appProjects: AgencyProject[], clickupProjects: AgencyProject[]) {
  const canonicalAppProjects = uniqueProjectsByReference(appProjects);
  const canonicalClickUpProjects = uniqueProjectsByReference(clickupProjects);
  const matchedClickUpIds = new Set<string>();

  const mergedProjects = canonicalAppProjects.map((appProject) => {
    const clickupProject = canonicalClickUpProjects.find((candidate) => projectsRepresentSameEntity(appProject, candidate));
    if (!clickupProject) return appProject;

    matchedClickUpIds.add(projectText(clickupProject.id || clickupProject.clickup_list_id));
    return mergeAppProjectWithClickUp(appProject, clickupProject);
  });

  const clickupOnlyProjects = canonicalClickUpProjects.filter(
    (clickupProject) => !matchedClickUpIds.has(projectText(clickupProject.id || clickupProject.clickup_list_id)),
  );

  return [...mergedProjects, ...clickupOnlyProjects];
}
