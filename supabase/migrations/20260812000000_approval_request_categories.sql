-- Expand Approval Center with clearly separated work and operational requests.
-- The approval category itself is derived from request_type in the application,
-- while this constraint keeps the accepted database values explicit.

ALTER TABLE public.app_approval_requests
  DROP CONSTRAINT IF EXISTS app_approval_requests_request_type_check;

ALTER TABLE public.app_approval_requests
  ADD CONSTRAINT app_approval_requests_request_type_check CHECK (
    request_type IN (
      'daily_activity',
      'script',
      'strategy',
      'deliverable',
      'work_other',
      'leave',
      'overtime',
      'kpi',
      'general'
    )
  );

UPDATE public.app_approval_requests
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
  'approval_category',
  CASE
    WHEN request_type IN ('daily_activity', 'script', 'strategy', 'deliverable', 'work_other') THEN 'work'
    ELSE 'operational'
  END
)
WHERE metadata->>'approval_category' IS DISTINCT FROM CASE
  WHEN request_type IN ('daily_activity', 'script', 'strategy', 'deliverable', 'work_other') THEN 'work'
  ELSE 'operational'
END;

NOTIFY pgrst, 'reload schema';
