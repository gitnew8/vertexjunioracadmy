
CREATE TABLE public.reading_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid,
  student_name text NOT NULL,
  student_class text NOT NULL,
  language text NOT NULL DEFAULT 'en',
  book_name text NOT NULL,
  audio_path text NOT NULL,
  duration_sec integer NOT NULL DEFAULT 0,
  transcript text,
  ai_analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  teacher_feedback text,
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reading_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reading_sessions TO anon;
GRANT ALL ON public.reading_sessions TO service_role;

ALTER TABLE public.reading_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reading_sessions" ON public.reading_sessions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert reading_sessions" ON public.reading_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update reading_sessions" ON public.reading_sessions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete reading_sessions" ON public.reading_sessions FOR DELETE USING (true);

CREATE TRIGGER reading_sessions_touch BEFORE UPDATE ON public.reading_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Storage policies on reading-audio bucket (allow public upload/read consistent with other app patterns)
CREATE POLICY "reading-audio anon read" ON storage.objects FOR SELECT USING (bucket_id = 'reading-audio');
CREATE POLICY "reading-audio anon insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'reading-audio');
CREATE POLICY "reading-audio anon update" ON storage.objects FOR UPDATE USING (bucket_id = 'reading-audio') WITH CHECK (bucket_id = 'reading-audio');
CREATE POLICY "reading-audio anon delete" ON storage.objects FOR DELETE USING (bucket_id = 'reading-audio');
