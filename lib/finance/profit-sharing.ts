/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase and ClickUp payloads are normalized defensively in this calculation boundary. */

export type ProfitShareSetting = {
  id?: string;
  workspace_id?: string;
  project_key: string;
  month_key: string;
  project_name: string;
  client_name: string;
  agreed_service_value: number | null;
  operational_deduction_percent: number;
  tax_percent: number;
  other_deduction_amount: number;
  team_share_percent: number;
  task_weight_percent: number;
  completion_weight_percent: number;
  hours_weight_percent: number;
  allocation_mode: 'automatic' | 'manual';
  member_share_overrides: Record<string, number>;
  notes: string;
};

export type ProfitShareMemberIdentity = {
  id?: string;
  name: string;
  email: string;
  avatar?: string;
  role?: string;
};

export type ProfitShareMemberAllocation = {
  key: string;
  name: string;
  email: string;
  avatar: string;
  role: string;
  tasks_assigned: number;
  tasks_completed: number;
  completion_percent: number;
  hours: number;
  contribution_percent: number;
  fee_amount: number;
};

export type ProjectProfitShareRow = {
  project_key: string;
  project_name: string;
  client_name: string;
  project_status: string;
  configured: boolean;
  revenue_source: 'manual' | 'finance' | 'invoice' | 'quote' | 'project' | 'none';
  service_value: number;
  recorded_expense: number;
  operational_deduction: number;
  tax_deduction: number;
  other_deduction: number;
  total_deduction: number;
  net_profit: number;
  team_fee_pool: number;
  company_retained: number;
  tasks_total: number;
  tasks_completed: number;
  completion_percent: number;
  labor_hours: number;
  member_source: 'project_team' | 'task_assignees';
  manual_share_total: number;
  setting: ProfitShareSetting;
  allocations: ProfitShareMemberAllocation[];
};

type ProfitShareInput = {
  month: string;
  entries: any[];
  settings: ProfitShareSetting[];
  members: ProfitShareMemberIdentity[];
  salaries?: Array<{ user_email?: string; display_name?: string }>;
  operational: {
    clients?: any[];
    projects?: any[];
    tasks?: any[];
    invoices?: any[];
    quotes?: any[];
    attendanceLogs?: any[];
    profitabilitySettings?: any[];
    projectMeta?: any[];
  };
};

type ProjectCandidate = {
  key: string;
  aliases: string[];
  name: string;
  clientName: string;
  status: string;
  projectValue: number;
};

function text(value: unknown, fallback = '') {
  return String(value ?? fallback).trim();
}

function number(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampPercent(value: unknown, fallback = 0) {
  return Math.min(100, Math.max(0, number(value, fallback)));
}

function normalize(value: unknown) {
  return text(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function memberKey(member: ProfitShareMemberIdentity) {
  return text(member.email).toLowerCase() || text(member.id) || normalize(member.name);
}

function membersMatch(left: ProfitShareMemberIdentity, right: ProfitShareMemberIdentity) {
  const leftId = text(left.id);
  const rightId = text(right.id);
  const leftEmail = text(left.email).toLowerCase();
  const rightEmail = text(right.email).toLowerCase();
  return Boolean(
    (leftId && rightId && leftId === rightId) ||
    (leftEmail && rightEmail && leftEmail === rightEmail) ||
    (normalize(left.name) && normalize(left.name) === normalize(right.name))
  );
}

function looseMatch(left: unknown, right: unknown) {
  const a = normalize(left);
  const b = normalize(right);
  return Boolean(a && b && (a === b || (a.length >= 5 && b.includes(a)) || (b.length >= 5 && a.includes(b))));
}

function monthOf(value: unknown) {
  return text(value).match(/^(\d{4}-\d{2})/)?.[1] || '';
}

function rawTask(task: any) {
  return task?.raw_data || task?.raw || {};
}

function completedTask(task: any) {
  const directStatus = task?.status;
  const status = text(
    typeof directStatus === 'string'
      ? directStatus
      : directStatus?.status || rawTask(task)?.status?.status || rawTask(task)?.status
  ).toLowerCase();
  return status.includes('complete') || status.includes('closed') || status.includes('done') || status === 'selesai';
}

function taskProjectValues(task: any) {
  const raw = rawTask(task);
  return [
    task?.project_id,
    task?.project_name,
    raw?.project_id,
    raw?.project_name,
    raw?.list?.id,
    raw?.list?.name,
    raw?.folder?.id,
    raw?.folder?.name,
    raw?.space?.id,
    raw?.space?.name,
  ].filter(Boolean);
}

function taskAssignees(task: any): ProfitShareMemberIdentity[] {
  const raw = rawTask(task);
  const values = [
    ...(Array.isArray(task?.assignees) ? task.assignees : []),
    ...(Array.isArray(raw?.assignees) ? raw.assignees : []),
  ];
  return values.map((item: any) => ({
    id: text(item?.id),
    name: text(item?.username || item?.name || item?.email, 'Anggota'),
    email: text(item?.email).toLowerCase(),
    avatar: text(item?.profilePicture || item?.profile_picture || item?.avatar),
  }));
}

function memberMatchesTask(task: any, member: ProfitShareMemberIdentity) {
  const raw = rawTask(task);
  const memberId = text(member.id);
  const memberName = normalize(member.name);
  const memberEmail = text(member.email).toLowerCase();
  const ids = [
    ...(Array.isArray(task?.assignee_ids) ? task.assignee_ids : []),
    ...(Array.isArray(raw?.assignee_ids) ? raw.assignee_ids : []),
    ...(Array.isArray(task?.assignees) ? task.assignees.map((item: any) => item?.id) : []),
    ...(Array.isArray(raw?.assignees) ? raw.assignees.map((item: any) => item?.id) : []),
  ].map((value) => text(value));
  const identities = [
    ...(Array.isArray(task?.assignee_names) ? task.assignee_names : []),
    ...(Array.isArray(raw?.assignee_names) ? raw.assignee_names : []),
    ...(Array.isArray(task?.assignees) ? task.assignees : []),
    ...(Array.isArray(raw?.assignees) ? raw.assignees : []),
  ].map((item: any) => normalize(item?.username || item?.name || item?.email || item));
  return Boolean(
    (memberId && ids.includes(memberId)) ||
    (memberEmail && identities.includes(normalize(memberEmail))) ||
    (memberName && identities.some((identity) => identity === memberName || (memberName.length >= 4 && identity.includes(memberName))))
  );
}

function taskTrackedHours(task: any) {
  const raw = rawTask(task);
  const direct = number(task?.time_tracked_hours ?? raw?.time_tracked_hours ?? task?.tracked_hours ?? raw?.tracked_hours);
  if (direct > 0) return direct;
  const milliseconds = number(task?.time_spent ?? raw?.time_spent);
  return milliseconds > 0 ? milliseconds / 3_600_000 : 0;
}

function attendanceHours(log: any) {
  const direct = number(log?.regular_hours ?? log?.hours_worked ?? log?.total_hours ?? log?.duration_hours);
  return Math.max(0, direct + number(log?.overtime_hours));
}

function attendanceMatchesMember(log: any, member: ProfitShareMemberIdentity) {
  const identity = normalize(log?.email || log?.user_email || log?.user_name || log?.full_name);
  const email = normalize(member.email);
  const name = normalize(member.name);
  return Boolean(identity && ((email && identity === email) || (name && (identity === name || (name.length >= 4 && identity.includes(name))))));
}

function documentTotal(record: any) {
  const data = record?.data || {};
  if (Number.isFinite(Number(data.total))) return Math.max(0, number(data.total));
  const items = Array.isArray(data.items) ? data.items : [];
  const subtotal = items.reduce((sum: number, item: any) => {
    return sum + Math.max(0, number(item?.quantity, 1)) * Math.max(0, number(item?.unitPrice ?? item?.unit_price));
  }, 0);
  const discount = subtotal * clampPercent(data.discountPercent ?? data.discount_percent) / 100;
  const taxable = Math.max(0, subtotal - discount);
  return taxable + taxable * clampPercent(data.taxPercent ?? data.tax_percent) / 100;
}

function documentProjectHint(record: any) {
  const data = record?.data || {};
  return text(data.projectName || data.project_name || data.project || record?.project_name);
}

function documentClientHint(record: any) {
  const data = record?.data || {};
  return text(data.clientName || data.client_name || data.customerName || record?.customer_name);
}

function documentMonth(record: any) {
  const data = record?.data || {};
  return monthOf(data.invoiceDate || data.issueDate || data.quoteDate || data.createdAt || record?.created_at);
}

function projectForValues(values: unknown[], projects: ProjectCandidate[]) {
  const normalizedValues = values.map(normalize).filter(Boolean);
  if (!normalizedValues.length) return undefined;
  const exact = projects.find((project) => {
    const identities = [project.key, project.name, ...project.aliases].map(normalize).filter(Boolean);
    return normalizedValues.some((value) => identities.includes(value));
  });
  if (exact) return exact;
  return projects
    .filter((project) => normalizedValues.some((value) => looseMatch(value, project.name)))
    .sort((left, right) => normalize(right.name).length - normalize(left.name).length)[0];
}

function documentProjectKey(record: any, projects: ProjectCandidate[]) {
  const projectHint = documentProjectHint(record);
  if (projectHint) return projectForValues([projectHint], projects)?.key || '';
  const clientHint = documentClientHint(record);
  if (!clientHint) return '';
  const clientMatches = projects.filter((candidate) => looseMatch(candidate.clientName, clientHint));
  return clientMatches.length === 1 ? clientMatches[0].key : '';
}

function settingFor(project: ProjectCandidate, month: string, settings: ProfitShareSetting[]) {
  return settings.find((setting) => monthOf(setting.month_key) === month && (
    project.aliases.includes(text(setting.project_key)) || normalize(setting.project_name) === normalize(project.name)
  ));
}

function defaultSetting(project: ProjectCandidate, month: string): ProfitShareSetting {
  return {
    project_key: project.key,
    month_key: `${month}-01`,
    project_name: project.name,
    client_name: project.clientName,
    agreed_service_value: null,
    operational_deduction_percent: 0,
    tax_percent: 0,
    other_deduction_amount: 0,
    team_share_percent: 30,
    task_weight_percent: 40,
    completion_weight_percent: 30,
    hours_weight_percent: 30,
    allocation_mode: 'automatic',
    member_share_overrides: {},
    notes: '',
  };
}

function mergeMembers(input: ProfitShareInput, projectTasks: any[], projectMembers: ProfitShareMemberIdentity[]) {
  const referenceMembers: ProfitShareMemberIdentity[] = [
    ...input.members,
    ...(input.salaries || []).map((salary) => ({
      name: text(salary.display_name, text(salary.user_email).split('@')[0]),
      email: text(salary.user_email).toLowerCase(),
    })),
    ...projectTasks.flatMap(taskAssignees),
  ];
  const map = new Map<string, ProfitShareMemberIdentity>();
  const add = (member: ProfitShareMemberIdentity) => {
    const name = text(member.name, member.email?.split('@')[0] || 'Anggota');
    const email = text(member.email).toLowerCase();
    const key = memberKey({ ...member, name, email });
    if (!key) return;
    const existing = map.get(key);
    map.set(key, {
      id: text(member.id || existing?.id),
      name: name || existing?.name || 'Anggota',
      email: email || existing?.email || '',
      avatar: text(member.avatar || existing?.avatar),
      role: text(member.role || existing?.role),
    });
  };

  if (projectMembers.length) {
    projectMembers.forEach((projectMember) => {
      const reference = referenceMembers.find((member) => membersMatch(projectMember, member));
      add({
        id: text(projectMember.id || reference?.id),
        name: text(projectMember.name || reference?.name, 'Anggota'),
        email: text(projectMember.email || reference?.email).toLowerCase(),
        avatar: text(projectMember.avatar || reference?.avatar),
        role: text(projectMember.role || reference?.role),
      });
    });
  } else {
    referenceMembers.forEach(add);
  }
  return Array.from(map.values());
}

function projectMembersByProject(input: ProfitShareInput, projects: ProjectCandidate[]) {
  const result = new Map<string, ProfitShareMemberIdentity[]>();
  (input.operational.projectMeta || []).forEach((row) => {
    const meta = row?.meta || {};
    const project = projectForValues([
      row?.project_id,
      meta?.projectId,
      meta?.project_id,
      meta?.clickupListId,
      meta?.clickup_list_id,
      meta?.name,
      meta?.projectName,
    ], projects);
    const teamMembers = Array.isArray(meta?.teamMembers)
      ? meta.teamMembers
      : Array.isArray(meta?.team_members)
        ? meta.team_members
        : [];
    if (!project || !teamMembers.length) return;

    const map = new Map<string, ProfitShareMemberIdentity>();
    teamMembers.forEach((member: any) => {
      const normalized: ProfitShareMemberIdentity = {
        id: text(member?.id || member?.user_id),
        name: text(member?.name || member?.username || member?.email, 'Anggota'),
        email: text(member?.email).toLowerCase(),
        avatar: text(member?.avatar_url || member?.avatar || member?.profilePicture || member?.profile_picture),
        role: text(member?.role || member?.job_title || member?.position),
      };
      const key = memberKey(normalized);
      if (!key) return;
      const existing = map.get(key);
      map.set(key, existing ? {
        id: text(normalized.id || existing.id),
        name: text(normalized.name || existing.name, 'Anggota'),
        email: text(normalized.email || existing.email).toLowerCase(),
        avatar: text(normalized.avatar || existing.avatar),
        role: text(normalized.role || existing.role),
      } : normalized);
    });
    result.set(project.key, Array.from(map.values()));
  });
  return result;
}

function buildProjects(input: ProfitShareInput) {
  const map = new Map<string, ProjectCandidate>();
  const clients = new Map((input.operational.clients || []).map((client: any) => [text(client?.id), client]));
  const add = (source: any, fallbackName = '') => {
    const name = text(source?.name || source?.project_name || fallbackName);
    if (!name || normalize(name) === normalize('Bilik Strategi Workspace')) return;
    const explicitProjectId = (source?.name ? source?.id : '') || source?.project_key || source?.project_id || source?.clickup_list_id || source?.clickup_folder_id || source?.clickup_space_id;
    const key = text(explicitProjectId, `name:${normalize(name)}`);
    const sourceAliases = [
      key,
      source?.project_key,
      source?.project_id,
      source?.clickup_list_id,
      source?.clickup_folder_id,
      source?.clickup_space_id,
      source?.name ? source?.id : '',
    ].map((value) => text(value)).filter(Boolean);
    const client = clients.get(text(source?.client_id));
    const existing = map.get(key) || Array.from(map.values()).find((item) => (
      sourceAliases.some((alias) => item.aliases.includes(alias)) || normalize(item.name) === normalize(name)
    ));
    const candidate: ProjectCandidate = {
      key: existing?.key || key,
      aliases: Array.from(new Set([...(existing?.aliases || []), ...sourceAliases, existing?.key || key])),
      name: existing?.name || name,
      clientName: text(source?.client_name || source?.customer_name || client?.company_name || client?.name || existing?.clientName, 'Internal / belum diatur'),
      status: text(source?.status || existing?.status, 'active'),
      projectValue: Math.max(0, number(source?.revenue_override ?? source?.deal_value ?? source?.service_value ?? source?.project_value ?? existing?.projectValue)),
    };
    map.set(candidate.key, candidate);
  };

  (input.operational.projects || []).forEach((project) => add(project));
  (input.operational.profitabilitySettings || []).forEach((setting) => add(setting, setting?.project_name));
  input.settings.forEach((setting) => add(setting, setting.project_name));
  input.entries.filter((entry) => monthOf(entry?.entry_date) === input.month).forEach((entry) => add(entry, entry?.project_name));
  (input.operational.attendanceLogs || [])
    .filter((log) => monthOf(log?.date || log?.attendance_date || log?.created_at) === input.month)
    .forEach((log) => add(log, log?.project_name || log?.selected_project));
  (input.operational.tasks || []).forEach((task) => {
    const raw = rawTask(task);
    const explicitName = text(task?.project_name || raw?.project_name || raw?.folder?.name || raw?.list?.name);
    if (explicitName) add({
      project_name: explicitName,
      project_id: task?.project_id || raw?.project_id,
      clickup_list_id: raw?.list?.id,
      clickup_folder_id: raw?.folder?.id,
      clickup_space_id: raw?.space?.id,
    }, explicitName);
  });
  return Array.from(map.values());
}

export function calculateProjectProfitShares(input: ProfitShareInput): ProjectProfitShareRow[] {
  const projects = buildProjects(input);
  const projectMembers = projectMembersByProject(input, projects);
  const monthEntries = input.entries.filter((entry) => monthOf(entry?.entry_date) === input.month && entry?.status !== 'cancelled');
  const attendance = (input.operational.attendanceLogs || []).filter((log) => monthOf(log?.date || log?.attendance_date || log?.created_at) === input.month);
  const tasks = input.operational.tasks || [];
  const invoices = input.operational.invoices || [];
  const quotes = input.operational.quotes || [];
  const entryProjects = new Map(monthEntries.map((entry) => [entry, projectForValues([entry?.project_name], projects)?.key || '']));
  const taskProjects = new Map(tasks.map((task) => [task, projectForValues(taskProjectValues(task), projects)?.key || '']));
  const attendanceProjects = new Map(attendance.map((log) => [log, projectForValues([log?.project_name || log?.selected_project], projects)?.key || '']));
  const invoiceProjects = new Map(invoices.map((invoice) => [invoice, documentProjectKey(invoice, projects)]));
  const quoteProjects = new Map(quotes.map((quote) => [quote, documentProjectKey(quote, projects)]));

  return projects.map((project) => {
    const savedSetting = settingFor(project, input.month, input.settings);
    const setting: ProfitShareSetting = {
      ...defaultSetting(project, input.month),
      ...(savedSetting || {}),
      allocation_mode: savedSetting?.allocation_mode === 'manual' ? 'manual' : 'automatic',
      member_share_overrides: savedSetting?.member_share_overrides && typeof savedSetting.member_share_overrides === 'object'
        ? savedSetting.member_share_overrides
        : {},
    };
    const projectEntries = monthEntries.filter((entry) => entryProjects.get(entry) === project.key);
    const financeRevenue = projectEntries
      .filter((entry) => entry?.entry_type === 'revenue' && ['deal', 'paid'].includes(text(entry?.status).toLowerCase()))
      .reduce((sum, entry) => sum + Math.max(0, number(entry?.amount)), 0);
    const recordedExpense = projectEntries
      .filter((entry) => entry?.entry_type === 'expense')
      .reduce((sum, entry) => sum + Math.max(0, number(entry?.amount)), 0);
    const invoiceRevenue = invoices
      .filter((invoice) => documentMonth(invoice) === input.month && text(invoice?.status).toLowerCase() === 'paid' && invoiceProjects.get(invoice) === project.key)
      .reduce((sum, invoice) => sum + documentTotal(invoice), 0);
    const quoteRevenue = quotes
      .filter((quote) => documentMonth(quote) === input.month && text(quote?.status).toLowerCase() === 'accepted' && quoteProjects.get(quote) === project.key)
      .reduce((sum, quote) => sum + documentTotal(quote), 0);

    const hasManualValue = setting.agreed_service_value !== null && setting.agreed_service_value !== undefined;
    const serviceValue = hasManualValue
      ? Math.max(0, number(setting.agreed_service_value))
      : financeRevenue > 0
        ? financeRevenue
        : invoiceRevenue > 0
          ? invoiceRevenue
          : quoteRevenue > 0
            ? quoteRevenue
            : project.projectValue;
    const revenueSource: ProjectProfitShareRow['revenue_source'] = hasManualValue
      ? 'manual'
      : financeRevenue > 0
        ? 'finance'
        : invoiceRevenue > 0
          ? 'invoice'
          : quoteRevenue > 0
            ? 'quote'
            : project.projectValue > 0
              ? 'project'
              : 'none';

    const operationalDeduction = serviceValue * clampPercent(setting.operational_deduction_percent) / 100;
    const taxDeduction = serviceValue * clampPercent(setting.tax_percent) / 100;
    const otherDeduction = Math.max(0, number(setting.other_deduction_amount));
    const totalDeduction = recordedExpense + operationalDeduction + taxDeduction + otherDeduction;
    const netProfit = serviceValue - totalDeduction;
    const teamFeePool = Math.max(0, netProfit) * clampPercent(setting.team_share_percent, 30) / 100;

    const projectTasks = tasks.filter((task) => taskProjects.get(task) === project.key);
    const configuredProjectMembers = projectMembers.get(project.key) || [];
    const memberSource: ProjectProfitShareRow['member_source'] = configuredProjectMembers.length ? 'project_team' : 'task_assignees';
    const members = mergeMembers(input, projectTasks, configuredProjectMembers);
    const rawAllocations = members.map((member) => {
      const memberTasks = projectTasks.filter((task) => memberMatchesTask(task, member));
      const completed = memberTasks.filter(completedTask).length;
      const memberAttendance = attendance.filter((log) => attendanceProjects.get(log) === project.key && attendanceMatchesMember(log, member));
      const loggedHours = memberAttendance.reduce((sum, log) => sum + attendanceHours(log), 0);
      const taskHours = memberTasks.reduce((sum, task) => sum + taskTrackedHours(task), 0);
      return {
        member,
        assigned: memberTasks.length,
        completed,
        completion: memberTasks.length ? completed / memberTasks.length : 0,
        hours: loggedHours > 0 ? loggedHours : taskHours,
      };
    }).filter((item) => configuredProjectMembers.length > 0 || item.assigned > 0 || item.hours > 0);

    const totalCompletedCredit = rawAllocations.reduce((sum, item) => sum + item.completed, 0);
    const totalAssignedCredit = rawAllocations.reduce((sum, item) => sum + item.assigned, 0);
    const totalCompletionScore = rawAllocations.reduce((sum, item) => sum + item.completion, 0);
    const totalHours = rawAllocations.reduce((sum, item) => sum + item.hours, 0);
    const taskBase = totalCompletedCredit > 0 ? totalCompletedCredit : totalAssignedCredit;
    const taskWeight = taskBase > 0 ? clampPercent(setting.task_weight_percent, 40) : 0;
    const completionWeight = totalCompletionScore > 0 ? clampPercent(setting.completion_weight_percent, 30) : 0;
    const hoursWeight = totalHours > 0 ? clampPercent(setting.hours_weight_percent, 30) : 0;
    const availableWeight = taskWeight + completionWeight + hoursWeight;

    const automaticScores = rawAllocations.map((item) => {
      if (availableWeight <= 0) return rawAllocations.length ? 1 / rawAllocations.length : 0;
      const taskValue = totalCompletedCredit > 0 ? item.completed : item.assigned;
      return (
        (taskWeight / availableWeight) * (taskBase > 0 ? taskValue / taskBase : 0) +
        (completionWeight / availableWeight) * (totalCompletionScore > 0 ? item.completion / totalCompletionScore : 0) +
        (hoursWeight / availableWeight) * (totalHours > 0 ? item.hours / totalHours : 0)
      );
    });
    const manualShares = rawAllocations.map((item) => clampPercent(setting.member_share_overrides[memberKey(item.member)]));
    const manualShareTotal = manualShares.reduce((sum, share) => sum + share, 0);
    const scores = setting.allocation_mode === 'manual' && manualShareTotal > 0
      ? manualShares.map((share) => share / manualShareTotal)
      : automaticScores;
    const scoreTotal = scores.reduce((sum, score) => sum + score, 0) || 1;
    let allocatedFee = 0;
    const allocations = rawAllocations.map((item, index): ProfitShareMemberAllocation => {
      const contribution = scores[index] / scoreTotal;
      const fee = index === rawAllocations.length - 1 ? Math.max(0, teamFeePool - allocatedFee) : Math.max(0, teamFeePool * contribution);
      allocatedFee += fee;
      return {
        key: text(item.member.email || item.member.id || normalize(item.member.name)),
        name: item.member.name,
        email: item.member.email,
        avatar: text(item.member.avatar),
        role: text(item.member.role),
        tasks_assigned: item.assigned,
        tasks_completed: item.completed,
        completion_percent: item.assigned ? (item.completed / item.assigned) * 100 : 0,
        hours: item.hours,
        contribution_percent: contribution * 100,
        fee_amount: fee,
      };
    }).sort((a, b) => b.fee_amount - a.fee_amount || a.name.localeCompare(b.name));

    const tasksCompleted = projectTasks.filter(completedTask).length;
    return {
      project_key: project.key,
      project_name: project.name,
      client_name: text(setting.client_name || project.clientName, 'Internal / belum diatur'),
      project_status: project.status,
      configured: Boolean(savedSetting),
      revenue_source: revenueSource,
      service_value: serviceValue,
      recorded_expense: recordedExpense,
      operational_deduction: operationalDeduction,
      tax_deduction: taxDeduction,
      other_deduction: otherDeduction,
      total_deduction: totalDeduction,
      net_profit: netProfit,
      team_fee_pool: teamFeePool,
      company_retained: netProfit - teamFeePool,
      tasks_total: projectTasks.length,
      tasks_completed: tasksCompleted,
      completion_percent: projectTasks.length ? (tasksCompleted / projectTasks.length) * 100 : 0,
      labor_hours: totalHours,
      member_source: memberSource,
      manual_share_total: manualShareTotal,
      setting,
      allocations,
    };
  }).sort((a, b) => b.service_value - a.service_value || a.project_name.localeCompare(b.project_name));
}
