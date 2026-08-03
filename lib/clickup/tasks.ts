import { clickUpFetch } from './client';
import { ClickUpTask, CreateTaskInput, UpdateTaskInput } from './types';

export interface GetTasksParams {
  archived?: boolean;
  page?: number;
  order_by?: string;
  reverse?: boolean;
  subtasks?: boolean;
  statuses?: string[];
  include_closed?: boolean;
  assignees?: string[];
  due_date_gt?: number;
  due_date_lt?: number;
  date_created_gt?: number;
  date_created_lt?: number;
  date_updated_gt?: number;
  date_updated_lt?: number;
}

export async function getTasks(listId: string, params: GetTasksParams = {}, token?: string): Promise<{ tasks: ClickUpTask[]; last_page: boolean }> {
  const query = new URLSearchParams();
  if (params.archived !== undefined) query.set('archived', String(params.archived));
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.order_by) query.set('order_by', params.order_by);
  if (params.reverse !== undefined) query.set('reverse', String(params.reverse));
  if (params.subtasks !== undefined) query.set('subtasks', String(params.subtasks));
  if (params.include_closed !== undefined) query.set('include_closed', String(params.include_closed));
  if (params.statuses) {
    params.statuses.forEach((status) => query.append('statuses[]', status));
  }
  if (params.assignees) {
    params.assignees.forEach((assignee) => query.append('assignees[]', assignee));
  }

  const queryString = query.toString() ? `?${query.toString()}` : '';
  return await clickUpFetch<{ tasks: ClickUpTask[]; last_page: boolean }>(`/list/${listId}/task${queryString}`, { token });
}

export async function getFilteredTeamTasks(teamId: string, params: GetTasksParams = {}, token?: string): Promise<{ tasks: ClickUpTask[]; last_page: boolean }> {
  const query = new URLSearchParams();
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.order_by) query.set('order_by', params.order_by);
  if (params.subtasks !== undefined) query.set('subtasks', String(params.subtasks));
  if (params.include_closed !== undefined) query.set('include_closed', String(params.include_closed));
  if (params.statuses) {
    params.statuses.forEach((status) => query.append('statuses[]', status));
  }

  const queryString = query.toString() ? `?${query.toString()}` : '';
  return await clickUpFetch<{ tasks: ClickUpTask[]; last_page: boolean }>(`/team/${teamId}/task${queryString}`, { token });
}

export async function getTaskById(taskId: string, token?: string): Promise<ClickUpTask> {
  return await clickUpFetch<ClickUpTask>(`/task/${taskId}?include_subtasks=true`, { token });
}

export async function createTask(listId: string, input: CreateTaskInput, token?: string): Promise<ClickUpTask> {
  return await clickUpFetch<ClickUpTask>(`/list/${listId}/task`, {
    method: 'POST',
    body: JSON.stringify(input),
    token,
  });
}

export async function updateTask(taskId: string, input: UpdateTaskInput, token?: string): Promise<ClickUpTask> {
  return await clickUpFetch<ClickUpTask>(`/task/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
    token,
  });
}

export async function deleteTask(taskId: string, token?: string): Promise<void> {
  await clickUpFetch<void>(`/task/${taskId}`, {
    method: 'DELETE',
    token,
  });
}
