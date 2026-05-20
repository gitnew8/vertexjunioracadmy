
CREATE TABLE public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  student_class TEXT NOT NULL,
  roll_number TEXT NOT NULL,
  login_number TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_students_login_number ON public.students(login_number);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can register a student"
ON public.students
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Anyone can view students"
ON public.students
FOR SELECT
TO public
USING (true);
