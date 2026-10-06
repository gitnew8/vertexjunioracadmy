-- Vertex Junior Academy
-- System Curriculum Manager

CREATE TABLE IF NOT EXISTS public.system_curriculum (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  student_class text NOT NULL,
  subject text NOT NULL,
  chapter text NOT NULL,

  topics text[] NOT NULL DEFAULT '{}',

  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT system_curriculum_unique
    UNIQUE (student_class, subject, chapter)
);

CREATE INDEX IF NOT EXISTS idx_system_curriculum_class
ON public.system_curriculum(student_class);

CREATE INDEX IF NOT EXISTS idx_system_curriculum_subject
ON public.system_curriculum(student_class, subject);

CREATE INDEX IF NOT EXISTS idx_system_curriculum_active
ON public.system_curriculum(is_active);

CREATE OR REPLACE FUNCTION public.touch_system_curriculum_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_system_curriculum_updated
ON public.system_curriculum;

CREATE TRIGGER trg_system_curriculum_updated
BEFORE UPDATE ON public.system_curriculum
FOR EACH ROW
EXECUTE FUNCTION public.touch_system_curriculum_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.system_curriculum
TO anon, authenticated;

ALTER TABLE public.system_curriculum ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system curriculum read"
ON public.system_curriculum;

DROP POLICY IF EXISTS "system curriculum write"
ON public.system_curriculum;

CREATE POLICY "system curriculum read"
ON public.system_curriculum
FOR SELECT
USING (true);

CREATE POLICY "system curriculum write"
ON public.system_curriculum
FOR ALL
USING (true)
WITH CHECK (true);
