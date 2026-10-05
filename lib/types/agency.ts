export interface AgencyUser {
  id: string;
  clickup_id: number;
  full_name: string;
  email: string;
  avatar_url: string;
  role: 'owner' | 'admin' | 'team_lead' | 'member' | 'client';
  status: 'active' | 'inactive';
  capacity_hours: number;
  assigned_tasks_count: number;
  completed_tasks_count: number;
  overdue_tasks_count: number;
  hours_tracked: number;
  hours_estimated: number;
  workload_status: 'low' | 'balanced' | 'high' | 'over_capacity';
}

export interface AgencyClient {
  id: string;
  name: string;
  company_name: string;
  email: string;
  phone: string;
  industry: string;
  status: 'active' | 'lead' | 'archived';
  start_date: string;
  account_manager_id: string;
  logo_url: string;
  clickup_folder_id: string;
  notes: string;
  active_projects_count: number;
  completed_projects_count: number;
  total_tasks_count: number;
  overall_progress: number;
  recent_feedback?: string;
}

export interface AgencyProject {
  id: string;
  client_id: string;
  client_name: string;
  name: string;
  description: string;
  status: 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
  clickup_space_id: string;
  clickup_folder_id: string;
  clickup_list_id: string;
  team_lead_id: string;
  team_lead_name: string;
  member_ids: string[];
  start_date: string;
  due_date: string;
  total_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  progress_percentage: number;
}

export interface AgencyTask {
  id: string;
  clickup_task_id: string;
  project_id: string;
  project_name: string;
  task_name: string;
  description: string;
  status: 'to_do' | 'in_progress' | 'in_review' | 'revision' | 'completed';
  priority: 'urgent' | 'high' | 'normal' | 'low';
  assignee_ids: string[];
  assignee_names: string[];
  assignee_avatars: string[];
  assignee_emails?: string[];
  start_date: string;
  due_date: string;
  tags: string[];
  custom_fields: { name: string; value: string }[];
  time_estimate_hours: number;
  time_tracked_hours: number;
  parent_id?: string | null;
  subtask_count: number;
  comments_count: number;
  clickup_url: string;
  clickup_updated_at: string;
  created_at: string;
}

export interface AgencyComment {
  id: string;
  task_id: string;
  user_id: string;
  user_name: string;
  user_avatar: string;
  comment_text: string;
  created_at: string;
  reply_to_id?: string;
  attachments?: { name: string; url: string }[];
}

export interface AgencyChatMessage {
  id: string;
  channel_id: string;
  user_id: string;
  user_name: string;
  user_avatar: string;
  text: string;
  created_at: string;
  reactions?: { emoji: string; count: number }[];
}

export interface AgencyChatChannel {
  id: string;
  name: string;
  type: 'project' | 'division' | 'direct' | 'general';
  unread_count: number;
  last_message: string;
  last_message_at: string;
  members_count: number;
}

export interface AgencyNotification {
  id: string;
  user_id: string;
  type: 'task_created' | 'task_assigned' | 'status_changed' | 'deadline_approaching' | 'task_overdue' | 'new_comment' | 'mention' | 'new_message';
  title: string;
  message: string;
  entity_type: string;
  entity_id: string;
  is_read: boolean;
  created_at: string;
}

export interface AgencyActivityLog {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar: string;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  old_value?: string;
  new_value?: string;
  source: string;
  timestamp: string;
}

// -------------------------------------------------------------
// REALISTIC MOCK DATASET
// -------------------------------------------------------------
