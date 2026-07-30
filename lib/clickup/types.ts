export interface ClickUpUser {
  id: number;
  username: string;
  email: string;
  color: string;
  profilePicture: string | null;
  initials?: string;
  role?: number;
}

export interface ClickUpTeam {
  id: string;
  name: string;
  color: string;
  avatar: string | null;
  members: {
    user: ClickUpUser;
  }[];
}

export interface ClickUpSpace {
  id: string;
  name: string;
  private: boolean;
  color?: string;
  avatar?: string;
  statuses?: ClickUpStatus[];
}

export interface ClickUpFolder {
  id: string;
  name: string;
  orderindex: number;
  override_statuses: boolean;
  hidden: boolean;
  space: {
    id: string;
    name: string;
  };
  task_count: string;
  lists: ClickUpList[];
}

export interface ClickUpList {
  id: string;
  name: string;
  orderindex?: number;
  content?: string;
  status?: ClickUpStatus;
  priority?: ClickUpPriority;
  task_count?: number;
  folder?: {
    id: string;
    name: string;
  };
  space?: {
    id: string;
    name: string;
  };
}

export interface ClickUpStatus {
  id?: string;
  status: string;
  type: string;
  orderindex: number;
  color: string;
}

export interface ClickUpPriority {
  id: string;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  color: string;
  orderindex: string;
}

export interface ClickUpTag {
  name: string;
  tag_fg: string;
  tag_bg: string;
  creator?: number;
}

export interface ClickUpCustomField {
  id: string;
  name: string;
  type: string;
  type_config: Record<string, unknown>;
  date_created: string;
  hide_from_guests: boolean;
  value?: unknown;
  required?: boolean;
}

export interface ClickUpTask {
  id: string;
  custom_id?: string | null;
  name: string;
  text_content?: string;
  description?: string;
  status: ClickUpStatus;
  orderindex?: string;
  date_created: string;
  date_updated: string;
  date_closed?: string | null;
  date_done?: string | null;
  archived: boolean;
  creator: ClickUpUser;
  assignees: ClickUpUser[];
  watchers?: ClickUpUser[];
  checklists?: unknown[];
  tags: ClickUpTag[];
  parent?: string | null;
  priority?: ClickUpPriority | null;
  due_date?: string | null;
  start_date?: string | null;
  points?: number | null;
  time_estimate?: number | null;
  time_spent?: number | null;
  custom_fields?: ClickUpCustomField[];
  list: {
    id: string;
    name: string;
    access?: boolean;
  };
  folder?: {
    id: string;
    name: string;
    hidden?: boolean;
    access?: boolean;
  };
  space?: {
    id: string;
  };
  url: string;
}

export interface ClickUpComment {
  id: string;
  comment: Array<{
    text: string;
    attributes?: Record<string, unknown>;
  }>;
  comment_text: string;
  user: ClickUpUser;
  resolved: boolean;
  posted_at?: string;
  date?: string;
  date_created?: string;
  assignee?: ClickUpUser | null;
  assigned_by?: ClickUpUser | null;
  reactions?: Array<{
    reaction: string;
    date: string;
    user: ClickUpUser;
  }>;
}

export interface ClickUpChatMessage {
  id: string;
  channel_id: string;
  user: ClickUpUser;
  text: string;
  created_at: string;
  updated_at?: string;
  reply_count?: number;
  reactions?: Array<{
    emoji: string;
    count: number;
    users: number[];
  }>;
}

export interface ClickUpChatChannel {
  id: string;
  name: string;
  type: 'project' | 'division' | 'direct' | 'general';
  unread_count?: number;
  last_message?: string;
  last_message_at?: string;
  members_count?: number;
}

export interface ClickUpWebhook {
  id: string;
  userid: number;
  team_id: number;
  endpoint: string;
  client_id: string;
  events: string[];
  task_id?: string;
  list_id?: string;
  folder_id?: string;
  space_id?: string;
  health: {
    status: string;
    fail_count: number;
  };
  secret: string;
}

export interface CreateTaskInput {
  name: string;
  description?: string;
  assignees?: number[];
  tags?: string[];
  status?: string;
  priority?: number;
  due_date?: number;
  due_date_time?: boolean;
  time_estimate?: number;
  start_date?: number;
  start_date_time?: boolean;
  notify_all?: boolean;
  parent?: string;
  links_to?: string;
  custom_fields?: Array<{
    id: string;
    value: unknown;
  }>;
}

export interface UpdateTaskInput {
  name?: string;
  description?: string;
  status?: string;
  priority?: number | null;
  due_date?: number | null;
  due_date_time?: boolean;
  time_estimate?: number | null;
  start_date?: number | null;
  start_date_time?: boolean;
  assignees?: {
    add?: number[];
    rem?: number[];
  };
}
