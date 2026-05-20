
CREATE TABLE public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  coaching_name TEXT NOT NULL,
  logo_url TEXT,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  student_name TEXT NOT NULL,
  student_class TEXT NOT NULL,
  roll_number TEXT NOT NULL,
  teacher_name TEXT,
  subjects JSONB NOT NULL DEFAULT '[]'::jsonb,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reports_code ON public.reports(code);
CREATE INDEX idx_reports_created_at ON public.reports(created_at DESC);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Public read (the app has no auth; reports shared by unique code)
CREATE POLICY "Anyone can view reports"
  ON public.reports FOR SELECT
  USING (true);

-- Public insert (teachers create from the app without login)
CREATE POLICY "Anyone can create reports"
  ON public.reports FOR INSERT
  WITH CHECK (true);

-- Public update/delete so teacher dashboard can manage reports without login
CREATE POLICY "Anyone can update reports"
  ON public.reports FOR UPDATE
  USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can delete reports"
  ON public.reports FOR DELETE
  USING (true);

-- Storage bucket for coaching logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public logo read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'logos');

CREATE POLICY "Public logo upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'logos');
