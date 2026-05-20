
CREATE TABLE public.tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  student_class text NOT NULL,
  subject text NOT NULL,
  chapter text,
  language text NOT NULL DEFAULT 'en',
  time_limit_min int NOT NULL DEFAULT 30,
  total_marks int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.test_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  q_no int NOT NULL,
  section text NOT NULL,
  question text NOT NULL,
  options jsonb,
  correct_answer text NOT NULL,
  marks int NOT NULL DEFAULT 1,
  difficulty text NOT NULL DEFAULT 'medium',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_test_questions_test ON public.test_questions(test_id);

CREATE TABLE public.test_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  time_taken_sec int NOT NULL DEFAULT 0,
  score int NOT NULL DEFAULT 0,
  total int NOT NULL DEFAULT 0,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (test_id, student_id)
);
CREATE INDEX idx_test_attempts_test ON public.test_attempts(test_id);
CREATE INDEX idx_test_attempts_student ON public.test_attempts(student_id);

ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tests" ON public.tests FOR SELECT USING (true);
CREATE POLICY "Anyone can insert tests" ON public.tests FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update tests" ON public.tests FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete tests" ON public.tests FOR DELETE USING (true);

CREATE POLICY "Anyone can view test_questions" ON public.test_questions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert test_questions" ON public.test_questions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update test_questions" ON public.test_questions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete test_questions" ON public.test_questions FOR DELETE USING (true);

CREATE POLICY "Anyone can view test_attempts" ON public.test_attempts FOR SELECT USING (true);
CREATE POLICY "Anyone can insert test_attempts" ON public.test_attempts FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update test_attempts" ON public.test_attempts FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete test_attempts" ON public.test_attempts FOR DELETE USING (true);

CREATE TRIGGER trg_tests_touch BEFORE UPDATE ON public.tests
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
