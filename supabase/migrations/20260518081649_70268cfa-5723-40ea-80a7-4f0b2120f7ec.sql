
-- 1. students table updates
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS course text;

-- Allow admin operations (app is admin-password gated)
DROP POLICY IF EXISTS "Anyone can update students" ON public.students;
CREATE POLICY "Anyone can update students" ON public.students
  FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can delete students" ON public.students;
CREATE POLICY "Anyone can delete students" ON public.students
  FOR DELETE USING (true);

-- 2. fees table
CREATE TABLE IF NOT EXISTS public.fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  cycle_label text NOT NULL DEFAULT to_char(now(), 'Mon YYYY'),
  total_fee numeric(10,2) NOT NULL DEFAULT 0,
  paid_amount numeric(10,2) NOT NULL DEFAULT 0,
  last_payment_date date,
  due_amount numeric(10,2) GENERATED ALWAYS AS (GREATEST(total_fee - paid_amount, 0)) STORED,
  payment_status text GENERATED ALWAYS AS (
    CASE
      WHEN paid_amount >= total_fee AND total_fee > 0 THEN 'paid'
      WHEN paid_amount > 0 AND paid_amount < total_fee THEN 'partial'
      ELSE 'due'
    END
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fees_student_id_idx ON public.fees(student_id);

ALTER TABLE public.fees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view fees" ON public.fees;
CREATE POLICY "Anyone can view fees" ON public.fees FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert fees" ON public.fees;
CREATE POLICY "Anyone can insert fees" ON public.fees FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update fees" ON public.fees;
CREATE POLICY "Anyone can update fees" ON public.fees
  FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can delete fees" ON public.fees;
CREATE POLICY "Anyone can delete fees" ON public.fees FOR DELETE USING (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS fees_touch_updated_at ON public.fees;
CREATE TRIGGER fees_touch_updated_at
BEFORE UPDATE ON public.fees
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. activity view
CREATE OR REPLACE VIEW public.student_activity AS
SELECT
  s.id,
  s.name,
  s.student_class,
  s.roll_number,
  s.login_number,
  s.status,
  s.course,
  s.created_at,
  EXISTS (
    SELECT 1 FROM public.reports r
    WHERE r.roll_number = s.roll_number
      AND r.created_at > now() - interval '30 days'
  ) AS is_active_30d
FROM public.students s;
