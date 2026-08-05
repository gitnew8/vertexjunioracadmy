CREATE TABLE public.visual_papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  student_class text NOT NULL,
  subject text NOT NULL DEFAULT 'General',
  instructions text,
  pages jsonb NOT NULL DEFAULT '[]'::jsonb,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visual_papers TO anon, authenticated;
GRANT ALL ON public.visual_papers TO service_role;
ALTER TABLE public.visual_papers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view visual_papers" ON public.visual_papers FOR SELECT USING (true);
CREATE POLICY "Anyone can insert visual_papers" ON public.visual_papers FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update visual_papers" ON public.visual_papers FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete visual_papers" ON public.visual_papers FOR DELETE USING (true);
CREATE TRIGGER visual_papers_touch BEFORE UPDATE ON public.visual_papers
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.visual_hotspots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id uuid NOT NULL REFERENCES public.visual_papers(id) ON DELETE CASCADE,
  page_index int NOT NULL DEFAULT 0,
  group_key text NOT NULL,
  kind text NOT NULL DEFAULT 'tap',
  label text,
  x numeric NOT NULL,
  y numeric NOT NULL,
  w numeric NOT NULL,
  h numeric NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,
  match_key text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visual_hotspots TO anon, authenticated;
GRANT ALL ON public.visual_hotspots TO service_role;
ALTER TABLE public.visual_hotspots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view visual_hotspots" ON public.visual_hotspots FOR SELECT USING (true);
CREATE POLICY "Anyone can insert visual_hotspots" ON public.visual_hotspots FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update visual_hotspots" ON public.visual_hotspots FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete visual_hotspots" ON public.visual_hotspots FOR DELETE USING (true);
CREATE INDEX idx_visual_hotspots_paper ON public.visual_hotspots(paper_id, page_index);

CREATE TABLE public.visual_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id uuid NOT NULL REFERENCES public.visual_papers(id) ON DELETE CASCADE,
  student_name text NOT NULL,
  student_class text NOT NULL,
  roll_number text,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  correct_count int NOT NULL DEFAULT 0,
  wrong_count int NOT NULL DEFAULT 0,
  total_questions int NOT NULL DEFAULT 0,
  percentage numeric NOT NULL DEFAULT 0,
  time_taken_sec int NOT NULL DEFAULT 0,
  grade text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visual_attempts TO anon, authenticated;
GRANT ALL ON public.visual_attempts TO service_role;
ALTER TABLE public.visual_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view visual_attempts" ON public.visual_attempts FOR SELECT USING (true);
CREATE POLICY "Anyone can insert visual_attempts" ON public.visual_attempts FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update visual_attempts" ON public.visual_attempts FOR UPDATE USING (true) WITH CHECK (true);
CREATE INDEX idx_visual_attempts_paper ON public.visual_attempts(paper_id);