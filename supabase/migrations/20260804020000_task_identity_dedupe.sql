-- Remove duplicate app/ClickUp rows created before task re-keying was fixed.
WITH ranked_tasks AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(NULLIF(raw_data->>'id', ''), clickup_task_id)
      ORDER BY
        CASE WHEN COALESCE(clickup_task_id, '') LIKE 'app-%' THEN 0 ELSE 1 END DESC,
        last_synced_at DESC,
        id DESC
    ) AS row_number
  FROM public.task_cache
)
DELETE FROM public.task_cache AS tasks
USING ranked_tasks
WHERE tasks.id = ranked_tasks.id
  AND ranked_tasks.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_task_cache_raw_identity_unique
  ON public.task_cache ((raw_data->>'id'));
