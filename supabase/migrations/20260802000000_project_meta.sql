CREATE TABLE IF NOT EXISTS public.project_meta (
    project_id TEXT PRIMARY KEY,
    meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_meta_updated_at ON public.project_meta(updated_at DESC);

ALTER TABLE public.project_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read project_meta" ON public.project_meta;
DROP POLICY IF EXISTS "Allow public insert project_meta" ON public.project_meta;
DROP POLICY IF EXISTS "Allow public update project_meta" ON public.project_meta;
DROP POLICY IF EXISTS "Allow public delete project_meta" ON public.project_meta;

CREATE POLICY "Allow public read project_meta" ON public.project_meta FOR SELECT USING (true);
CREATE POLICY "Allow public insert project_meta" ON public.project_meta FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update project_meta" ON public.project_meta FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete project_meta" ON public.project_meta FOR DELETE USING (true);

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.project_meta;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
END $$;
