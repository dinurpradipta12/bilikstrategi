export type ContentIndicator = 'is_brand_relevant' | 'is_applied';

export type ContentReference = {
  id: string;
  workspace_id: string;
  platform: string;
  pillar: string;
  content_url: string;
  description: string;
  insight: string;
  is_brand_relevant: boolean;
  is_applied: boolean;
  created_by_email: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
};

export type ContentIdea = {
  id: string;
  workspace_id: string;
  headline: string;
  pillar: string;
  reference_id: string | null;
  notes: string;
  is_brand_relevant: boolean;
  is_applied: boolean;
  created_by_email: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
};

export type ContentIdeasViewer = {
  email: string;
  name: string;
};

export type ContentIdeasResponse = {
  storage_ready: boolean;
  viewer: ContentIdeasViewer;
  references: ContentReference[];
  ideas: ContentIdea[];
  error?: string;
};

export const CONTENT_PLATFORM_OPTIONS = [
  'Instagram',
  'TikTok',
  'YouTube',
  'LinkedIn',
  'X / Twitter',
  'Facebook',
  'Pinterest',
  'Lainnya',
] as const;

export const CONTENT_PILLAR_SUGGESTIONS = [
  'Edukasi',
  'Inspirasi',
  'Hiburan',
  'Promosi',
  'Engagement',
  'Behind the Scenes',
  'Testimoni',
] as const;
