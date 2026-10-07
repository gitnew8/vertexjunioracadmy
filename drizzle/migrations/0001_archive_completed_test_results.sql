CREATE TABLE public.student_test_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL UNIQUE,
  student_id uuid NOT NULL,
  test_id uuid NOT NULL,
  student_name text NOT NULL,
  roll_number text NOT NULL,
  student_class text NOT NULL,
  test_title text NOT NULL,
  subject text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  time_taken_sec integer NOT NULL DEFAULT 0,
  submitted_at timestamptz NOT NULL,
  result_status text NOT NULL DEFAULT 'auto_released',
  risk_label text NOT NULL DEFAULT 'low',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.student_test_results TO anon, authenticated;
GRANT ALL ON public.student_test_results TO service_role;

ALTER TABLE public.student_test_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view student_test_results"
ON public.student_test_results FOR SELECT USING (true);

CREATE INDEX idx_student_test_results_student_date
ON public.student_test_results (student_id, submitted_at DESC);
CREATE INDEX idx_student_test_results_test
ON public.student_test_results (test_id);
CREATE INDEX idx_student_test_results_class
ON public.student_test_results (student_class);

CREATE OR REPLACE FUNCTION public.archive_completed_test_result()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.student_test_results (
    attempt_id, student_id, test_id, student_name, roll_number, student_class,
    test_title, subject, score, total, time_taken_sec, submitted_at,
    result_status, risk_label
  )
  SELECT
    NEW.id, NEW.student_id, NEW.test_id, s.name, s.roll_number, s.student_class,
    t.title, t.subject, NEW.score, NEW.total, NEW.time_taken_sec, NEW.submitted_at,
    NEW.result_status, NEW.risk_label
  FROM public.tests t
  JOIN public.students s ON s.id = NEW.student_id
  WHERE t.id = NEW.test_id
  ON CONFLICT (attempt_id) DO UPDATE SET
    score = EXCLUDED.score,
    total = EXCLUDED.total,
    time_taken_sec = EXCLUDED.time_taken_sec,
    submitted_at = EXCLUDED.submitted_at,
    result_status = EXCLUDED.result_status,
    risk_label = EXCLUDED.risk_label;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_archive_completed_test_result
AFTER INSERT OR UPDATE OF submitted_at ON public.test_attempts
FOR EACH ROW
WHEN (NEW.submitted_at IS NOT NULL)
EXECUTE FUNCTION public.archive_completed_test_result();

INSERT INTO public.student_test_results (
  attempt_id, student_id, test_id, student_name, roll_number, student_class,
  test_title, subject, score, total, time_taken_sec, submitted_at,
  result_status, risk_label
)
SELECT
  a.id, a.student_id, a.test_id, s.name, s.roll_number, s.student_class,
  t.title, t.subject, a.score, a.total, a.time_taken_sec, a.submitted_at,
  a.result_status, a.risk_label
FROM public.test_attempts a
JOIN public.tests t ON t.id = a.test_id
JOIN public.students s ON s.id = a.student_id
WHERE a.submitted_at IS NOT NULL
ON CONFLICT (attempt_id) DO NOTHING;