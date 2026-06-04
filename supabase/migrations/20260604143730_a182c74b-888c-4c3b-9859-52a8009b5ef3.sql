CREATE TABLE public.study_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_class text NOT NULL,
  subject text NOT NULL,
  chapter text NOT NULL,
  title text NOT NULL,
  description text,
  teacher_name text,
  file_url text NOT NULL,
  file_path text,
  file_type text NOT NULL,
  file_size_bytes bigint,
  source text NOT NULL DEFAULT 'upload',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_materials TO anon, authenticated;
GRANT ALL ON public.study_materials TO service_role;

ALTER TABLE public.study_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view study_materials" ON public.study_materials FOR SELECT USING (true);
CREATE POLICY "Anyone can insert study_materials" ON public.study_materials FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update study_materials" ON public.study_materials FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete study_materials" ON public.study_materials FOR DELETE USING (true);

CREATE TRIGGER study_materials_touch BEFORE UPDATE ON public.study_materials
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_study_materials_class ON public.study_materials(student_class);
CREATE INDEX idx_study_materials_lookup ON public.study_materials(student_class, subject, chapter);

-- Storage policies for study-materials bucket (bucket created via storage tool)
CREATE POLICY "Anyone can read study materials" ON storage.objects FOR SELECT USING (bucket_id = 'study-materials');
CREATE POLICY "Anyone can upload study materials" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'study-materials');
CREATE POLICY "Anyone can update study materials" ON storage.objects FOR UPDATE USING (bucket_id = 'study-materials');
CREATE POLICY "Anyone can delete study materials" ON storage.objects FOR DELETE USING (bucket_id = 'study-materials');