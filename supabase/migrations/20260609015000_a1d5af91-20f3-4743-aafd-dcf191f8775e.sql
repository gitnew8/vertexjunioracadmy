
CREATE TABLE public.live_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subject text,
  student_class text NOT NULL,
  room_code text NOT NULL UNIQUE,
  teacher_name text,
  scheduled_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_classes TO anon, authenticated;
GRANT ALL ON public.live_classes TO service_role;
ALTER TABLE public.live_classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read live_classes" ON public.live_classes FOR SELECT USING (true);
CREATE POLICY "anyone insert live_classes" ON public.live_classes FOR INSERT WITH CHECK (true);
CREATE POLICY "anyone update live_classes" ON public.live_classes FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "anyone delete live_classes" ON public.live_classes FOR DELETE USING (true);

CREATE TABLE public.class_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.live_classes(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  student_name text,
  student_class text,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz
);
CREATE INDEX class_attendance_class_idx ON public.class_attendance(class_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_attendance TO anon, authenticated;
GRANT ALL ON public.class_attendance TO service_role;
ALTER TABLE public.class_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read attendance" ON public.class_attendance FOR SELECT USING (true);
CREATE POLICY "anyone insert attendance" ON public.class_attendance FOR INSERT WITH CHECK (true);
CREATE POLICY "anyone update attendance" ON public.class_attendance FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "anyone delete attendance" ON public.class_attendance FOR DELETE USING (true);
