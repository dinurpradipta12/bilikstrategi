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

export const MOCK_USERS: AgencyUser[] = [
  {
    id: 'usr-001',
    clickup_id: 9001,
    full_name: 'Satria Wijaya',
    email: 'satria@bilikstrategi.com',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    role: 'owner',
    status: 'active',
    capacity_hours: 40,
    assigned_tasks_count: 5,
    completed_tasks_count: 18,
    overdue_tasks_count: 0,
    hours_tracked: 34,
    hours_estimated: 38,
    workload_status: 'balanced',
  },
  {
    id: 'usr-002',
    clickup_id: 9002,
    full_name: 'Anisa Rahmawati',
    email: 'anisa@bilikstrategi.com',
    avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
    role: 'admin',
    status: 'active',
    capacity_hours: 40,
    assigned_tasks_count: 7,
    completed_tasks_count: 24,
    overdue_tasks_count: 1,
    hours_tracked: 39,
    hours_estimated: 40,
    workload_status: 'balanced',
  },
  {
    id: 'usr-003',
    clickup_id: 9003,
    full_name: 'Dimas Pratama',
    email: 'dimas@bilikstrategi.com',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    role: 'team_lead',
    status: 'active',
    capacity_hours: 40,
    assigned_tasks_count: 12,
    completed_tasks_count: 31,
    overdue_tasks_count: 2,
    hours_tracked: 46,
    hours_estimated: 42,
    workload_status: 'high',
  },
  {
    id: 'usr-004',
    clickup_id: 9004,
    full_name: 'Clara Bella',
    email: 'clara@bilikstrategi.com',
    avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80',
    role: 'member',
    status: 'active',
    capacity_hours: 40,
    assigned_tasks_count: 15,
    completed_tasks_count: 20,
    overdue_tasks_count: 3,
    hours_tracked: 48,
    hours_estimated: 40,
    workload_status: 'over_capacity',
  },
  {
    id: 'usr-005',
    clickup_id: 9005,
    full_name: 'Rizky Ramadhan',
    email: 'rizky@bilikstrategi.com',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
    role: 'member',
    status: 'active',
    capacity_hours: 40,
    assigned_tasks_count: 8,
    completed_tasks_count: 15,
    overdue_tasks_count: 1,
    hours_tracked: 32,
    hours_estimated: 36,
    workload_status: 'balanced',
  },
  {
    id: 'usr-006',
    clickup_id: 9006,
    full_name: 'Nabila Syakieb',
    email: 'nabila@bilikstrategi.com',
    avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80',
    role: 'member',
    status: 'active',
    capacity_hours: 40,
    assigned_tasks_count: 4,
    completed_tasks_count: 12,
    overdue_tasks_count: 0,
    hours_tracked: 22,
    hours_estimated: 25,
    workload_status: 'low',
  },
  {
    id: 'usr-007',
    clickup_id: 9007,
    full_name: 'Fajar Nugraha',
    email: 'fajar@bilikstrategi.com',
    avatar_url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=150&q=80',
    role: 'member',
    status: 'active',
    capacity_hours: 40,
    assigned_tasks_count: 9,
    completed_tasks_count: 19,
    overdue_tasks_count: 1,
    hours_tracked: 36,
    hours_estimated: 38,
    workload_status: 'balanced',
  },
  {
    id: 'usr-008',
    clickup_id: 9008,
    full_name: 'Budi Santoso (Klien)',
    email: 'budi@nusantararetail.co.id',
    avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80',
    role: 'client',
    status: 'active',
    capacity_hours: 0,
    assigned_tasks_count: 0,
    completed_tasks_count: 0,
    overdue_tasks_count: 0,
    hours_tracked: 0,
    hours_estimated: 0,
    workload_status: 'low',
  },
];

export const MOCK_CLIENTS: AgencyClient[] = [
  {
    id: 'cli-001',
    name: 'Budi Santoso',
    company_name: 'Nusantara Retail Group',
    email: 'budi@nusantararetail.co.id',
    phone: '+62 812-3456-7890',
    industry: 'Retail & E-commerce',
    status: 'active',
    start_date: '2026-01-15',
    account_manager_id: 'usr-002',
    logo_url: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?auto=format&fit=crop&w=100&q=80',
    clickup_folder_id: 'fold_101',
    notes: 'Klien retainer tahunan untuk kampanye digital 50 cabang retail.',
    active_projects_count: 2,
    completed_projects_count: 3,
    total_tasks_count: 42,
    overall_progress: 78,
    recent_feedback: 'Desain visual campaign promo kemerdekaan sangat memuaskan!',
  },
  {
    id: 'cli-002',
    name: 'Dewi Lestari',
    company_name: 'Kopi Senja Indonesia',
    email: 'dewi@kopisenja.id',
    phone: '+62 818-9876-5432',
    industry: 'Food & Beverage',
    status: 'active',
    start_date: '2026-02-01',
    account_manager_id: 'usr-003',
    logo_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=100&q=80',
    clickup_folder_id: 'fold_102',
    notes: 'Retainer media sosial harian & Reels viral.',
    active_projects_count: 1,
    completed_projects_count: 4,
    total_tasks_count: 35,
    overall_progress: 85,
    recent_feedback: 'Interaksi Reels minggu ini naik 140%. Good job team!',
  },
  {
    id: 'cli-003',
    name: 'Rian Ardianto',
    company_name: 'TechVision Global',
    email: 'rian@techvision.io',
    phone: '+62 817-1122-3344',
    industry: 'Technology & SaaS',
    status: 'active',
    start_date: '2026-03-10',
    account_manager_id: 'usr-001',
    logo_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=100&q=80',
    clickup_folder_id: 'fold_103',
    notes: 'Peluncuran produk SaaS B2B AI Analytics.',
    active_projects_count: 2,
    completed_projects_count: 1,
    total_tasks_count: 28,
    overall_progress: 60,
    recent_feedback: 'Perlu percepatan pembuatan landing page.',
  },
  {
    id: 'cli-004',
    name: 'Maya Putri',
    company_name: 'GlowSkin Cosmetic',
    email: 'maya@glowskin.co.id',
    phone: '+62 813-5566-7788',
    industry: 'Beauty & Lifestyle',
    status: 'active',
    start_date: '2026-04-05',
    account_manager_id: 'usr-002',
    logo_url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=100&q=80',
    clickup_folder_id: 'fold_104',
    notes: 'Influencer activation & TikTok Shop livestream branding.',
    active_projects_count: 2,
    completed_projects_count: 0,
    total_tasks_count: 20,
    overall_progress: 45,
    recent_feedback: 'Mohon update daftar influencer pilihan.',
  },
  {
    id: 'cli-005',
    name: 'Hendra Gunawan',
    company_name: 'Finansial Kuat Group',
    email: 'hendra@finansialkuat.com',
    phone: '+62 819-0011-2233',
    industry: 'Finance & FinTech',
    status: 'lead',
    start_date: '2026-06-20',
    account_manager_id: 'usr-003',
    logo_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=100&q=80',
    clickup_folder_id: 'fold_105',
    notes: 'Prospek rebranding korporat & campaign edukasi investasi.',
    active_projects_count: 1,
    completed_projects_count: 0,
    total_tasks_count: 8,
    overall_progress: 25,
  },
];

export const MOCK_PROJECTS: AgencyProject[] = [
  {
    id: 'prj-001',
    client_id: 'cli-001',
    client_name: 'Nusantararetail Group',
    name: 'Nusantara Grand Campaign 2026',
    description: 'Peluncuran promo nasional, OOH billboard, dan video iklan TVC.',
    status: 'in_progress',
    clickup_space_id: 'sp_9001',
    clickup_folder_id: 'fold_101',
    clickup_list_id: 'list_1001',
    team_lead_id: 'usr-003',
    team_lead_name: 'Dimas Pratama',
    member_ids: ['usr-003', 'usr-004', 'usr-005', 'usr-007'],
    start_date: '2026-06-01',
    due_date: '2026-08-31',
    total_tasks: 14,
    completed_tasks: 9,
    overdue_tasks: 1,
    progress_percentage: 64,
  },
  {
    id: 'prj-002',
    client_id: 'cli-002',
    client_name: 'Kopi Senja Indonesia',
    name: 'Kopi Senja Social Media Retainer Q3',
    description: 'Konten feed IG 30 post/bulan, 15 TikTok Reels, & Community engagement.',
    status: 'in_progress',
    clickup_space_id: 'sp_9001',
    clickup_folder_id: 'fold_102',
    clickup_list_id: 'list_1002',
    team_lead_id: 'usr-002',
    team_lead_name: 'Anisa Rahmawati',
    member_ids: ['usr-002', 'usr-004', 'usr-006'],
    start_date: '2026-07-01',
    due_date: '2026-09-30',
    total_tasks: 12,
    completed_tasks: 8,
    overdue_tasks: 0,
    progress_percentage: 67,
  },
  {
    id: 'prj-003',
    client_id: 'cli-003',
    client_name: 'TechVision Global',
    name: 'TechVision B2B SaaS Launch',
    description: 'Desain UI/UX landing page, sales deck PDF, & Meta Ads campaign.',
    status: 'in_progress',
    clickup_space_id: 'sp_9002',
    clickup_folder_id: 'fold_103',
    clickup_list_id: 'list_1003',
    team_lead_id: 'usr-003',
    team_lead_name: 'Dimas Pratama',
    member_ids: ['usr-003', 'usr-005', 'usr-007'],
    start_date: '2026-05-15',
    due_date: '2026-08-15',
    total_tasks: 10,
    completed_tasks: 5,
    overdue_tasks: 2,
    progress_percentage: 50,
  },
  {
    id: 'prj-004',
    client_id: 'cli-004',
    client_name: 'GlowSkin Cosmetic',
    name: 'GlowSkin Viral TikTok Campaign',
    description: 'Aktivasi 20 Influencer beauty & TikTok Challenge #GlowEveryday.',
    status: 'planning',
    clickup_space_id: 'sp_9002',
    clickup_folder_id: 'fold_104',
    clickup_list_id: 'list_1004',
    team_lead_id: 'usr-002',
    team_lead_name: 'Anisa Rahmawati',
    member_ids: ['usr-002', 'usr-006', 'usr-007'],
    start_date: '2026-08-01',
    due_date: '2026-10-31',
    total_tasks: 8,
    completed_tasks: 2,
    overdue_tasks: 0,
    progress_percentage: 25,
  },
  {
    id: 'prj-005',
    client_id: 'cli-001',
    client_name: 'Nusantara Retail Group',
    name: 'Nusantara Mobile App UI Overhaul',
    description: 'Redesain antarmuka aplikasi belanja mobile.',
    status: 'in_progress',
    clickup_space_id: 'sp_9001',
    clickup_folder_id: 'fold_101',
    clickup_list_id: 'list_1005',
    team_lead_id: 'usr-001',
    team_lead_name: 'Satria Wijaya',
    member_ids: ['usr-001', 'usr-004', 'usr-005'],
    start_date: '2026-07-10',
    due_date: '2026-09-10',
    total_tasks: 9,
    completed_tasks: 3,
    overdue_tasks: 1,
    progress_percentage: 33,
  },
  {
    id: 'prj-006',
    client_id: 'cli-005',
    client_name: 'Finansial Kuat Group',
    name: 'Finansial Kuat Brand Identity Pitch',
    description: 'Penyusunan proposal rebranding, logo concept, & brand book draft.',
    status: 'planning',
    clickup_space_id: 'sp_9003',
    clickup_folder_id: 'fold_105',
    clickup_list_id: 'list_1006',
    team_lead_id: 'usr-003',
    team_lead_name: 'Dimas Pratama',
    member_ids: ['usr-003', 'usr-004'],
    start_date: '2026-07-20',
    due_date: '2026-08-20',
    total_tasks: 6,
    completed_tasks: 1,
    overdue_tasks: 0,
    progress_percentage: 16,
  },
  {
    id: 'prj-007',
    client_id: 'cli-003',
    client_name: 'TechVision Global',
    name: 'TechVision Video Explainer 3D',
    description: 'Video animasi 3D durasi 90 detik tentang arsitektur data SaaS.',
    status: 'completed',
    clickup_space_id: 'sp_9002',
    clickup_folder_id: 'fold_103',
    clickup_list_id: 'list_1007',
    team_lead_id: 'usr-001',
    team_lead_name: 'Satria Wijaya',
    member_ids: ['usr-001', 'usr-005'],
    start_date: '2026-05-01',
    due_date: '2026-06-30',
    total_tasks: 7,
    completed_tasks: 7,
    overdue_tasks: 0,
    progress_percentage: 100,
  },
  {
    id: 'prj-008',
    client_id: 'cli-002',
    client_name: 'Kopi Senja Indonesia',
    name: 'Kopi Senja Outlet Launching Promo',
    description: 'Event offline & kampanye geotargeting Instagram Ads.',
    status: 'completed',
    clickup_space_id: 'sp_9001',
    clickup_folder_id: 'fold_102',
    clickup_list_id: 'list_1008',
    team_lead_id: 'usr-002',
    team_lead_name: 'Anisa Rahmawati',
    member_ids: ['usr-002', 'usr-006'],
    start_date: '2026-04-01',
    due_date: '2026-05-31',
    total_tasks: 8,
    completed_tasks: 8,
    overdue_tasks: 0,
    progress_percentage: 100,
  },
];

export const MOCK_TASKS: AgencyTask[] = [
  {
    id: 'tsk-001',
    clickup_task_id: 'cu-869101',
    project_id: 'prj-001',
    project_name: 'Nusantara Grand Campaign 2026',
    task_name: 'Finalisasi Visual Key Visual Billboard 3D',
    description: 'Membuat render Key Visual Billboard 3D ukuran 4x8 meter untuk titik lokasi Gatot Subroto.',
    status: 'in_progress',
    priority: 'urgent',
    assignee_ids: ['usr-004', 'usr-005'],
    assignee_names: ['Clara Bella', 'Rizky Ramadhan'],
    assignee_avatars: [
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
    ],
    start_date: '2026-07-25T09:00:00Z',
    due_date: '2026-07-30T17:00:00Z',
    tags: ['Design', '3D', 'Urgent'],
    custom_fields: [
      { name: 'Channel', value: 'Outdoor/OOH' },
      { name: 'Platform Format', value: 'Billboard 4x8m' },
    ],
    time_estimate_hours: 16,
    time_tracked_hours: 12,
    subtask_count: 3,
    comments_count: 4,
    clickup_url: 'https://app.clickup.com/t/869101',
    clickup_updated_at: '2026-07-30T08:30:00Z',
    created_at: '2026-07-25T09:00:00Z',
  },
  {
    id: 'tsk-002',
    clickup_task_id: 'cu-869102',
    project_id: 'prj-001',
    project_name: 'Nusantara Grand Campaign 2026',
    task_name: 'Produksi Video Storyboard TVC Promo',
    description: 'Menyusun naskah voiceover dan storyboard 15 adegan promo kemerdekaan.',
    status: 'to_do',
    priority: 'high',
    assignee_ids: ['usr-003'],
    assignee_names: ['Dimas Pratama'],
    assignee_avatars: ['https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80'],
    start_date: '2026-07-28T09:00:00Z',
    due_date: '2026-08-02T17:00:00Z',
    tags: ['Copywriting', 'Video'],
    custom_fields: [{ name: 'Channel', value: 'Broadcast TV' }],
    time_estimate_hours: 10,
    time_tracked_hours: 2,
    subtask_count: 2,
    comments_count: 1,
    clickup_url: 'https://app.clickup.com/t/869102',
    clickup_updated_at: '2026-07-29T11:20:00Z',
    created_at: '2026-07-28T09:00:00Z',
  },
  {
    id: 'tsk-003',
    clickup_task_id: 'cu-869103',
    project_id: 'prj-002',
    project_name: 'Kopi Senja Social Media Retainer Q3',
    task_name: 'Kalender Konten Instagram Bulan Agustus',
    description: 'Ideasi 30 tema feeds & copy caption Instagram termasuk promo Kemerdekaan RI.',
    status: 'in_review',
    priority: 'high',
    assignee_ids: ['usr-006'],
    assignee_names: ['Nabila Syakieb'],
    assignee_avatars: ['https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80'],
    start_date: '2026-07-20T09:00:00Z',
    due_date: '2026-07-29T17:00:00Z',
    tags: ['Content Strategy', 'Social Media'],
    custom_fields: [{ name: 'Channel', value: 'Instagram' }],
    time_estimate_hours: 12,
    time_tracked_hours: 11,
    subtask_count: 5,
    comments_count: 6,
    clickup_url: 'https://app.clickup.com/t/869103',
    clickup_updated_at: '2026-07-29T16:45:00Z',
    created_at: '2026-07-20T09:00:00Z',
  },
  {
    id: 'tsk-004',
    clickup_task_id: 'cu-869104',
    project_id: 'prj-003',
    project_name: 'TechVision B2B SaaS Launch',
    task_name: 'UI Design Landing Page Mobile Responsive',
    description: 'Pembuatan komponen UI Figma untuk halaman Pricing & Hero Banner.',
    status: 'in_progress',
    priority: 'urgent',
    assignee_ids: ['usr-004'],
    assignee_names: ['Clara Bella'],
    assignee_avatars: ['https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80'],
    start_date: '2026-07-22T09:00:00Z',
    due_date: '2026-07-28T17:00:00Z',
    tags: ['UI/UX', 'Figma', 'Overdue'],
    custom_fields: [{ name: 'Deliverable', value: 'Figma Prototype' }],
    time_estimate_hours: 20,
    time_tracked_hours: 22,
    subtask_count: 4,
    comments_count: 8,
    clickup_url: 'https://app.clickup.com/t/869104',
    clickup_updated_at: '2026-07-30T09:10:00Z',
    created_at: '2026-07-22T09:00:00Z',
  },
  {
    id: 'tsk-005',
    clickup_task_id: 'cu-869105',
    project_id: 'prj-002',
    project_name: 'Kopi Senja Social Media Retainer Q3',
    task_name: 'Editing Video TikTok Reels "Behind The Scene Barista"',
    description: 'Editing durasi 45 detik dengan musik trending & animasi caption.',
    status: 'completed',
    priority: 'normal',
    assignee_ids: ['usr-007'],
    assignee_names: ['Fajar Nugraha'],
    assignee_avatars: ['https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=150&q=80'],
    start_date: '2026-07-26T09:00:00Z',
    due_date: '2026-07-29T17:00:00Z',
    tags: ['Video Editing', 'TikTok'],
    custom_fields: [{ name: 'Channel', value: 'TikTok' }],
    time_estimate_hours: 6,
    time_tracked_hours: 5,
    subtask_count: 1,
    comments_count: 2,
    clickup_url: 'https://app.clickup.com/t/869105',
    clickup_updated_at: '2026-07-29T14:30:00Z',
    created_at: '2026-07-26T09:00:00Z',
  },
  {
    id: 'tsk-006',
    clickup_task_id: 'cu-869106',
    project_id: 'prj-004',
    project_name: 'GlowSkin Viral TikTok Campaign',
    task_name: 'Outreach & Negosiasi Rate Card 20 Influencer Beauty',
    description: 'Menghubungi talent agency & menyepakati paket video review.',
    status: 'to_do',
    priority: 'high',
    assignee_ids: ['usr-002'],
    assignee_names: ['Anisa Rahmawati'],
    assignee_avatars: ['https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80'],
    start_date: '2026-08-01T09:00:00Z',
    due_date: '2026-08-07T17:00:00Z',
    tags: ['Influencer', 'PR'],
    custom_fields: [{ name: 'Target Influencer', value: '20 Macro & Micro' }],
    time_estimate_hours: 15,
    time_tracked_hours: 3,
    subtask_count: 3,
    comments_count: 0,
    clickup_url: 'https://app.clickup.com/t/869106',
    clickup_updated_at: '2026-07-30T07:00:00Z',
    created_at: '2026-07-30T07:00:00Z',
  },
  {
    id: 'tsk-007',
    clickup_task_id: 'cu-869107',
    project_id: 'prj-005',
    project_name: 'Nusantara Mobile App UI Overhaul',
    task_name: 'User Journey Mapping & Wireframe Checkout Flow',
    description: 'Memetakan tahapan checkout 1-click & integrasi payment gateway.',
    status: 'in_progress',
    priority: 'normal',
    assignee_ids: ['usr-001', 'usr-004'],
    assignee_names: ['Satria Wijaya', 'Clara Bella'],
    assignee_avatars: [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80',
    ],
    start_date: '2026-07-27T09:00:00Z',
    due_date: '2026-08-03T17:00:00Z',
    tags: ['Mobile App', 'UX'],
    custom_fields: [{ name: 'Platform', value: 'iOS / Android' }],
    time_estimate_hours: 14,
    time_tracked_hours: 8,
    subtask_count: 2,
    comments_count: 3,
    clickup_url: 'https://app.clickup.com/t/869107',
    clickup_updated_at: '2026-07-30T08:15:00Z',
    created_at: '2026-07-27T09:00:00Z',
  },
  {
    id: 'tsk-008',
    clickup_task_id: 'cu-869108',
    project_id: 'prj-003',
    project_name: 'TechVision B2B SaaS Launch',
    task_name: 'Penulisan Copy Sales Deck 15 Halaman',
    description: 'Menyusun narasi value proposition, case study, dan ROI calculator.',
    status: 'revision',
    priority: 'high',
    assignee_ids: ['usr-003'],
    assignee_names: ['Dimas Pratama'],
    assignee_avatars: ['https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80'],
    start_date: '2026-07-24T09:00:00Z',
    due_date: '2026-07-28T17:00:00Z',
    tags: ['Copywriting', 'Sales Deck', 'Overdue'],
    custom_fields: [{ name: 'Format', value: 'PDF Presentation' }],
    time_estimate_hours: 10,
    time_tracked_hours: 12,
    subtask_count: 2,
    comments_count: 5,
    clickup_url: 'https://app.clickup.com/t/869108',
    clickup_updated_at: '2026-07-30T09:00:00Z',
    created_at: '2026-07-24T09:00:00Z',
  },
];

export const MOCK_CHANNELS: AgencyChatChannel[] = [
  {
    id: 'ch-001',
    name: '📢 General Agency Announce',
    type: 'general',
    unread_count: 2,
    last_message: 'Pengingat: Weekly Sync tim jam 14:00 siang ini.',
    last_message_at: '2026-07-30T09:00:00Z',
    members_count: 8,
  },
  {
    id: 'ch-002',
    name: '🚀 Project Nusantara Retail',
    type: 'project',
    unread_count: 0,
    last_message: 'Visual Billboard 3D sudah di-update di ClickUp.',
    last_message_at: '2026-07-30T08:45:00Z',
    members_count: 5,
  },
  {
    id: 'ch-003',
    name: '🎨 Design & Creative Squad',
    type: 'division',
    unread_count: 4,
    last_message: 'Asset 3D Kopi Senja siap di-render di GPU server.',
    last_message_at: '2026-07-30T09:15:00Z',
    members_count: 4,
  },
  {
    id: 'ch-004',
    name: '⚡ TechVision SaaS Launch',
    type: 'project',
    unread_count: 1,
    last_message: 'Feedback klien untuk Sales Deck sudah masuk.',
    last_message_at: '2026-07-30T09:05:00Z',
    members_count: 4,
  },
  {
    id: 'ch-005',
    name: '☕ Kopi Senja Team',
    type: 'project',
    unread_count: 0,
    last_message: 'Reels kemarin tembus 50k views!',
    last_message_at: '2026-07-29T18:20:00Z',
    members_count: 3,
  },
];

export const MOCK_CHAT_MESSAGES: Record<string, AgencyChatMessage[]> = {
  'ch-001': [
    {
      id: 'msg-101',
      channel_id: 'ch-001',
      user_id: 'usr-001',
      user_name: 'Satria Wijaya',
      user_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
      text: 'Selamat pagi tim Bilik Strategi! Jangan lupa periksa task priority minggu ini.',
      created_at: '2026-07-30T08:00:00Z',
      reactions: [{ emoji: '🔥', count: 5 }],
    },
    {
      id: 'msg-102',
      channel_id: 'ch-001',
      user_id: 'usr-002',
      user_name: 'Anisa Rahmawati',
      user_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
      text: 'Siap Pak Satria. Kampanye Nusantara dan GlowSkin sudah disesuaikan jadwalnya.',
      created_at: '2026-07-30T08:15:00Z',
    },
    {
      id: 'msg-103',
      channel_id: 'ch-001',
      user_id: 'usr-003',
      user_name: 'Dimas Pratama',
      user_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
      text: 'Pengingat: Weekly Sync tim jam 14:00 siang ini.',
      created_at: '2026-07-30T09:00:00Z',
      reactions: [{ emoji: '👍', count: 4 }],
    },
  ],
  'ch-002': [
    {
      id: 'msg-201',
      channel_id: 'ch-002',
      user_id: 'usr-004',
      user_name: 'Clara Bella',
      user_avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80',
      text: 'Visual Billboard 3D sudah di-update di ClickUp. Budi dari pihak klien minta penyesuaian warna brand.',
      created_at: '2026-07-30T08:45:00Z',
    },
  ],
  'ch-003': [
    {
      id: 'msg-301',
      channel_id: 'ch-003',
      user_id: 'usr-005',
      user_name: 'Rizky Ramadhan',
      user_avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
      text: 'Asset 3D Kopi Senja siap di-render di GPU server.',
      created_at: '2026-07-30T09:15:00Z',
    },
  ],
};

export const MOCK_NOTIFICATIONS: AgencyNotification[] = [
  {
    id: 'nt-001',
    user_id: 'usr-001',
    type: 'task_overdue',
    title: 'Task Overdue!',
    message: 'Task "UI Design Landing Page Mobile Responsive" telah melewati deadline (28 Juli 2026).',
    entity_type: 'task',
    entity_id: 'tsk-004',
    is_read: false,
    created_at: '2026-07-30T08:30:00Z',
  },
  {
    id: 'nt-002',
    user_id: 'usr-001',
    type: 'new_comment',
    title: 'Komentar Baru',
    message: 'Clara Bella memberikan komentar pada "Finalisasi Visual Key Visual Billboard 3D".',
    entity_type: 'task',
    entity_id: 'tsk-001',
    is_read: false,
    created_at: '2026-07-30T09:00:00Z',
  },
  {
    id: 'nt-003',
    user_id: 'usr-001',
    type: 'status_changed',
    title: 'Status Berubah',
    message: 'Task "Editing Video TikTok Reels" diubah ke status Completed.',
    entity_type: 'task',
    entity_id: 'tsk-005',
    is_read: true,
    created_at: '2026-07-29T14:30:00Z',
  },
];

export const MOCK_ACTIVITY_LOGS: AgencyActivityLog[] = [
  {
    id: 'act-001',
    user_id: 'usr-004',
    user_name: 'Clara Bella',
    user_avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80',
    action: 'UPDATE_TASK',
    entity_type: 'Task',
    entity_id: 'tsk-001',
    entity_name: 'Finalisasi Visual Key Visual Billboard 3D',
    old_value: 'Status: To Do',
    new_value: 'Status: In Progress',
    source: 'ClickUp Webhook',
    timestamp: '2026-07-30T08:30:00Z',
  },
  {
    id: 'act-002',
    user_id: 'usr-007',
    user_name: 'Fajar Nugraha',
    user_avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=150&q=80',
    action: 'CHANGE_STATUS',
    entity_type: 'Task',
    entity_id: 'tsk-005',
    entity_name: 'Editing Video TikTok Reels',
    old_value: 'In Review',
    new_value: 'Completed',
    source: 'Bilik Workspace App',
    timestamp: '2026-07-29T14:30:00Z',
  },
  {
    id: 'act-003',
    user_id: 'usr-001',
    user_name: 'Satria Wijaya',
    user_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    action: 'CONNECT_CLICKUP',
    entity_type: 'Workspace',
    entity_id: 'team_90001122',
    entity_name: 'Bilik Strategi Workspace',
    new_value: 'Connected via Personal Token',
    source: 'Settings Page',
    timestamp: '2026-07-28T10:00:00Z',
  },
];
