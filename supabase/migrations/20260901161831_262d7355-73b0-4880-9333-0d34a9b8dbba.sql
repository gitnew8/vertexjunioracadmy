
-- ============ TABLES ============
CREATE TABLE IF NOT EXISTS public.student_fee_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL UNIQUE REFERENCES public.students(id) ON DELETE CASCADE,
  monthly_fee numeric(12,2) NOT NULL CHECK (monthly_fee >= 0),
  start_month int NOT NULL CHECK (start_month BETWEEN 1 AND 12),
  start_year int NOT NULL CHECK (start_year BETWEEN 2000 AND 2100),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_fee_settings TO anon, authenticated;
GRANT ALL ON public.student_fee_settings TO service_role;
ALTER TABLE public.student_fee_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view fee settings" ON public.student_fee_settings FOR SELECT USING (true);
CREATE POLICY "Anyone can insert fee settings" ON public.student_fee_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update fee settings" ON public.student_fee_settings FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete fee settings" ON public.student_fee_settings FOR DELETE USING (true);
CREATE TRIGGER trg_sfs_touch BEFORE UPDATE ON public.student_fee_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.monthly_fee_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  year int NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  expected_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (expected_amount >= 0),
  paid_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  due_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (due_amount >= 0),
  status text NOT NULL DEFAULT 'due' CHECK (status IN ('due','partial','paid')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, month, year)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_fee_records TO anon, authenticated;
GRANT ALL ON public.monthly_fee_records TO service_role;
ALTER TABLE public.monthly_fee_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view monthly fee records" ON public.monthly_fee_records FOR SELECT USING (true);
CREATE POLICY "Anyone can insert monthly fee records" ON public.monthly_fee_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update monthly fee records" ON public.monthly_fee_records FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete monthly fee records" ON public.monthly_fee_records FOR DELETE USING (true);
CREATE TRIGGER trg_mfr_touch BEFORE UPDATE ON public.monthly_fee_records FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS idx_mfr_student ON public.monthly_fee_records(student_id, year, month);

CREATE SEQUENCE IF NOT EXISTS public.fee_receipt_seq START 1;
GRANT USAGE, SELECT ON SEQUENCE public.fee_receipt_seq TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.fee_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  receipt_no text NOT NULL UNIQUE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_date date NOT NULL DEFAULT current_date,
  payment_mode text NOT NULL DEFAULT 'cash' CHECK (payment_mode IN ('cash','upi','bank','other')),
  transaction_id text,
  notes text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','void')),
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_payments TO anon, authenticated;
GRANT ALL ON public.fee_payments TO service_role;
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view fee payments" ON public.fee_payments FOR SELECT USING (true);
CREATE POLICY "Anyone can insert fee payments" ON public.fee_payments FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update fee payments" ON public.fee_payments FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete fee payments" ON public.fee_payments FOR DELETE USING (true);
CREATE TRIGGER trg_fp_touch BEFORE UPDATE ON public.fee_payments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS idx_fp_student ON public.fee_payments(student_id, payment_date DESC);

CREATE TABLE IF NOT EXISTS public.fee_payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.fee_payments(id) ON DELETE CASCADE,
  record_id uuid NOT NULL REFERENCES public.monthly_fee_records(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payment_id, record_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_payment_allocations TO anon, authenticated;
GRANT ALL ON public.fee_payment_allocations TO service_role;
ALTER TABLE public.fee_payment_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view fee allocations" ON public.fee_payment_allocations FOR SELECT USING (true);
CREATE POLICY "Anyone can insert fee allocations" ON public.fee_payment_allocations FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update fee allocations" ON public.fee_payment_allocations FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete fee allocations" ON public.fee_payment_allocations FOR DELETE USING (true);
CREATE INDEX IF NOT EXISTS idx_fpa_record ON public.fee_payment_allocations(record_id);

CREATE TABLE IF NOT EXISTS public.fee_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid,
  payment_id uuid,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.fee_audit_log TO anon, authenticated;
GRANT ALL ON public.fee_audit_log TO service_role;
ALTER TABLE public.fee_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view fee audit" ON public.fee_audit_log FOR SELECT USING (true);
CREATE POLICY "Anyone can insert fee audit" ON public.fee_audit_log FOR INSERT WITH CHECK (true);

-- ============ CORE FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.fee_next_receipt_no()
RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT 'VJA-' || lpad(nextval('public.fee_receipt_seq')::text, 5, '0');
$$;

CREATE OR REPLACE FUNCTION public.fee_recalc_student(p_student uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.monthly_fee_records m
  SET paid_amount = COALESCE(a.total, 0),
      due_amount = GREATEST(m.expected_amount - COALESCE(a.total, 0), 0),
      status = CASE
        WHEN COALESCE(a.total,0) <= 0 THEN 'due'
        WHEN COALESCE(a.total,0) >= m.expected_amount THEN 'paid'
        ELSE 'partial' END
  FROM (SELECT id FROM public.monthly_fee_records WHERE student_id = p_student) ids
  LEFT JOIN (
    SELECT al.record_id, SUM(al.amount) AS total
    FROM public.fee_payment_allocations al
    JOIN public.fee_payments p ON p.id = al.payment_id AND p.status = 'active'
    GROUP BY al.record_id
  ) a ON a.record_id = ids.id
  WHERE m.id = ids.id;
END; $$;

-- create missing monthly rows from settings start month through a given month/year
CREATE OR REPLACE FUNCTION public.fee_ensure_months(p_student uuid, p_through_month int, p_through_year int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; cur date; last date;
BEGIN
  SELECT * INTO s FROM public.student_fee_settings WHERE student_id = p_student;
  IF NOT FOUND OR NOT s.active THEN RETURN; END IF;
  cur := make_date(s.start_year, s.start_month, 1);
  last := make_date(p_through_year, p_through_month, 1);
  WHILE cur <= last LOOP
    INSERT INTO public.monthly_fee_records (student_id, month, year, expected_amount, due_amount, status)
    VALUES (p_student, EXTRACT(MONTH FROM cur)::int, EXTRACT(YEAR FROM cur)::int, s.monthly_fee, s.monthly_fee, 'due')
    ON CONFLICT (student_id, month, year) DO NOTHING;
    cur := cur + interval '1 month';
  END LOOP;
  PERFORM public.fee_recalc_student(p_student);
END; $$;

CREATE OR REPLACE FUNCTION public.fee_set_settings(
  p_student uuid, p_monthly_fee numeric, p_start_month int, p_start_year int
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE now_d date := date_trunc('month', current_date)::date;
BEGIN
  INSERT INTO public.student_fee_settings (student_id, monthly_fee, start_month, start_year)
  VALUES (p_student, p_monthly_fee, p_start_month, p_start_year)
  ON CONFLICT (student_id) DO UPDATE
    SET monthly_fee = EXCLUDED.monthly_fee,
        start_month = EXCLUDED.start_month,
        start_year = EXCLUDED.start_year,
        active = true;
  -- historical months keep their amount; only untouched future months follow the new fee
  UPDATE public.monthly_fee_records m
  SET expected_amount = p_monthly_fee
  WHERE m.student_id = p_student
    AND make_date(m.year, m.month, 1) > now_d
    AND m.paid_amount = 0;
  PERFORM public.fee_ensure_months(p_student, EXTRACT(MONTH FROM now_d)::int, EXTRACT(YEAR FROM now_d)::int);
  INSERT INTO public.fee_audit_log(student_id, action, details)
  VALUES (p_student, 'set_settings', jsonb_build_object('monthly_fee', p_monthly_fee, 'start_month', p_start_month, 'start_year', p_start_year));
END; $$;

-- allocate a payment amount across target months (or oldest dues, then future months)
CREATE OR REPLACE FUNCTION public.fee_allocate(p_payment uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pay record; s record; remaining numeric; r record; take numeric; nxt date;
BEGIN
  SELECT * INTO pay FROM public.fee_payments WHERE id = p_payment;
  IF pay.status <> 'active' THEN RETURN; END IF;
  DELETE FROM public.fee_payment_allocations WHERE payment_id = p_payment;
  PERFORM public.fee_recalc_student(pay.student_id);
  remaining := pay.amount;

  FOR r IN
    SELECT m.id, GREATEST(m.expected_amount - m.paid_amount, 0) AS due
    FROM public.monthly_fee_records m
    WHERE m.student_id = pay.student_id AND m.expected_amount > m.paid_amount
    ORDER BY m.year, m.month
  LOOP
    EXIT WHEN remaining <= 0;
    take := LEAST(remaining, r.due);
    IF take > 0 THEN
      INSERT INTO public.fee_payment_allocations(payment_id, record_id, amount) VALUES (p_payment, r.id, take);
      remaining := remaining - take;
      PERFORM public.fee_recalc_student(pay.student_id);
    END IF;
  END LOOP;

  -- advance payment: create future months and allocate
  SELECT * INTO s FROM public.student_fee_settings WHERE student_id = pay.student_id;
  IF FOUND AND s.monthly_fee > 0 THEN
    WHILE remaining > 0 LOOP
      SELECT COALESCE(MAX(make_date(year, month, 1)), make_date(s.start_year, s.start_month, 1) - interval '1 month')
        INTO nxt FROM public.monthly_fee_records WHERE student_id = pay.student_id;
      nxt := (nxt + interval '1 month')::date;
      INSERT INTO public.monthly_fee_records(student_id, month, year, expected_amount, due_amount)
      VALUES (pay.student_id, EXTRACT(MONTH FROM nxt)::int, EXTRACT(YEAR FROM nxt)::int, s.monthly_fee, s.monthly_fee)
      ON CONFLICT (student_id, month, year) DO NOTHING;
      SELECT m.id, GREATEST(m.expected_amount - m.paid_amount, 0) AS due INTO r
      FROM public.monthly_fee_records m
      WHERE m.student_id = pay.student_id AND m.month = EXTRACT(MONTH FROM nxt)::int AND m.year = EXTRACT(YEAR FROM nxt)::int;
      EXIT WHEN r.due <= 0;
      take := LEAST(remaining, r.due);
      INSERT INTO public.fee_payment_allocations(payment_id, record_id, amount) VALUES (p_payment, r.id, take);
      remaining := remaining - take;
      PERFORM public.fee_recalc_student(pay.student_id);
    END LOOP;
  END IF;

  PERFORM public.fee_recalc_student(pay.student_id);
END; $$;

-- allocate only to explicitly selected months
CREATE OR REPLACE FUNCTION public.fee_allocate_targets(p_payment uuid, p_record_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pay record; remaining numeric; r record; take numeric;
BEGIN
  SELECT * INTO pay FROM public.fee_payments WHERE id = p_payment;
  DELETE FROM public.fee_payment_allocations WHERE payment_id = p_payment;
  PERFORM public.fee_recalc_student(pay.student_id);
  remaining := pay.amount;
  FOR r IN
    SELECT m.id, GREATEST(m.expected_amount - m.paid_amount, 0) AS due
    FROM public.monthly_fee_records m
    WHERE m.id = ANY(p_record_ids) AND m.student_id = pay.student_id
    ORDER BY m.year, m.month
  LOOP
    EXIT WHEN remaining <= 0;
    take := LEAST(remaining, r.due);
    IF take > 0 THEN
      INSERT INTO public.fee_payment_allocations(payment_id, record_id, amount) VALUES (p_payment, r.id, take);
      remaining := remaining - take;
      PERFORM public.fee_recalc_student(pay.student_id);
    END IF;
  END LOOP;
  IF remaining > 0 THEN
    PERFORM public.fee_allocate_overflow(p_payment, remaining);
  END IF;
  PERFORM public.fee_recalc_student(pay.student_id);
END; $$;

CREATE OR REPLACE FUNCTION public.fee_allocate_overflow(p_payment uuid, p_remaining numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pay record; remaining numeric := p_remaining; r record; take numeric;
BEGIN
  SELECT * INTO pay FROM public.fee_payments WHERE id = p_payment;
  FOR r IN
    SELECT m.id, GREATEST(m.expected_amount - m.paid_amount, 0) AS due
    FROM public.monthly_fee_records m
    WHERE m.student_id = pay.student_id AND m.expected_amount > m.paid_amount
    ORDER BY m.year, m.month
  LOOP
    EXIT WHEN remaining <= 0;
    take := LEAST(remaining, r.due);
    IF take > 0 THEN
      INSERT INTO public.fee_payment_allocations(payment_id, record_id, amount)
      VALUES (p_payment, r.id, take)
      ON CONFLICT (payment_id, record_id) DO UPDATE SET amount = public.fee_payment_allocations.amount + EXCLUDED.amount;
      remaining := remaining - take;
      PERFORM public.fee_recalc_student(pay.student_id);
    END IF;
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.fee_record_payment(
  p_student uuid, p_amount numeric, p_date date, p_mode text,
  p_transaction_id text DEFAULT NULL, p_notes text DEFAULT NULL,
  p_record_ids uuid[] DEFAULT NULL
) RETURNS public.fee_payments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pay public.fee_payments;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be greater than zero'; END IF;
  INSERT INTO public.fee_payments(student_id, receipt_no, amount, payment_date, payment_mode, transaction_id, notes)
  VALUES (p_student, public.fee_next_receipt_no(), p_amount, COALESCE(p_date, current_date), COALESCE(p_mode,'cash'), p_transaction_id, p_notes)
  RETURNING * INTO pay;
  IF p_record_ids IS NULL OR array_length(p_record_ids,1) IS NULL THEN
    PERFORM public.fee_allocate(pay.id);
  ELSE
    PERFORM public.fee_allocate_targets(pay.id, p_record_ids);
  END IF;
  INSERT INTO public.fee_audit_log(student_id, payment_id, action, details)
  VALUES (p_student, pay.id, 'payment_created', jsonb_build_object('amount', p_amount, 'mode', p_mode, 'date', p_date));
  SELECT * INTO pay FROM public.fee_payments WHERE id = pay.id;
  RETURN pay;
END; $$;

CREATE OR REPLACE FUNCTION public.fee_edit_payment(
  p_payment uuid, p_amount numeric, p_date date, p_mode text,
  p_transaction_id text DEFAULT NULL, p_notes text DEFAULT NULL
) RETURNS public.fee_payments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pay public.fee_payments; old public.fee_payments; targets uuid[];
BEGIN
  SELECT * INTO old FROM public.fee_payments WHERE id = p_payment;
  IF old.status = 'void' THEN RAISE EXCEPTION 'Cannot edit a reversed payment'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be greater than zero'; END IF;
  SELECT array_agg(record_id) INTO targets FROM public.fee_payment_allocations WHERE payment_id = p_payment;
  UPDATE public.fee_payments
  SET amount = p_amount, payment_date = COALESCE(p_date, payment_date), payment_mode = COALESCE(p_mode, payment_mode),
      transaction_id = p_transaction_id, notes = p_notes
  WHERE id = p_payment RETURNING * INTO pay;
  IF targets IS NULL THEN PERFORM public.fee_allocate(p_payment);
  ELSE PERFORM public.fee_allocate_targets(p_payment, targets); END IF;
  INSERT INTO public.fee_audit_log(student_id, payment_id, action, details)
  VALUES (old.student_id, p_payment, 'payment_edited', jsonb_build_object('old_amount', old.amount, 'new_amount', p_amount));
  RETURN pay;
END; $$;

CREATE OR REPLACE FUNCTION public.fee_void_payment(p_payment uuid, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pay public.fee_payments;
BEGIN
  SELECT * INTO pay FROM public.fee_payments WHERE id = p_payment;
  UPDATE public.fee_payments SET status = 'void', voided_at = now(), void_reason = p_reason WHERE id = p_payment;
  DELETE FROM public.fee_payment_allocations WHERE payment_id = p_payment;
  PERFORM public.fee_recalc_student(pay.student_id);
  INSERT INTO public.fee_audit_log(student_id, payment_id, action, details)
  VALUES (pay.student_id, p_payment, 'payment_reversed', jsonb_build_object('amount', pay.amount, 'reason', p_reason));
END; $$;

GRANT EXECUTE ON FUNCTION public.fee_next_receipt_no(), public.fee_recalc_student(uuid),
  public.fee_ensure_months(uuid,int,int), public.fee_set_settings(uuid,numeric,int,int),
  public.fee_allocate(uuid), public.fee_allocate_targets(uuid,uuid[]), public.fee_allocate_overflow(uuid,numeric),
  public.fee_record_payment(uuid,numeric,date,text,text,text,uuid[]),
  public.fee_edit_payment(uuid,numeric,date,text,text,text),
  public.fee_void_payment(uuid,text) TO anon, authenticated, service_role;

-- ============ MIGRATE LEGACY DATA (non-destructive) ============
DO $mig$
DECLARE f record; p record; d date; rec_id uuid; newpay uuid;
BEGIN
  FOR f IN SELECT * FROM public.fees WHERE student_id IN (SELECT id FROM public.students) ORDER BY created_at LOOP
    BEGIN
      d := to_date(regexp_replace(lower(f.cycle_label), '([a-z])([0-9])', '\1 \2'), 'Mon YYYY');
    EXCEPTION WHEN OTHERS THEN d := date_trunc('month', f.created_at)::date; END;
    INSERT INTO public.student_fee_settings(student_id, monthly_fee, start_month, start_year)
    VALUES (f.student_id, f.total_fee, EXTRACT(MONTH FROM d)::int, EXTRACT(YEAR FROM d)::int)
    ON CONFLICT (student_id) DO NOTHING;
    INSERT INTO public.monthly_fee_records(student_id, month, year, expected_amount, due_amount)
    VALUES (f.student_id, EXTRACT(MONTH FROM d)::int, EXTRACT(YEAR FROM d)::int, f.total_fee, f.total_fee)
    ON CONFLICT (student_id, month, year) DO NOTHING;
  END LOOP;

  FOR p IN SELECT * FROM public.payments WHERE student_id IN (SELECT id FROM public.students) ORDER BY created_at LOOP
    IF EXISTS (SELECT 1 FROM public.fee_payments WHERE receipt_no = p.receipt_no) THEN CONTINUE; END IF;
    INSERT INTO public.fee_payments(student_id, receipt_no, amount, payment_date, payment_mode, notes, created_at)
    VALUES (
      p.student_id, p.receipt_no, p.amount, p.payment_date,
      CASE WHEN lower(p.payment_method) IN ('cash','upi','bank','other') THEN lower(p.payment_method)
           WHEN lower(p.payment_method) IN ('bank transfer','banktransfer','neft') THEN 'bank'
           ELSE 'other' END,
      p.notes, p.created_at)
    RETURNING id INTO newpay;
    BEGIN
      d := to_date(regexp_replace(lower(p.paid_month), '([a-z])([0-9])', '\1 \2'), 'Mon YYYY');
    EXCEPTION WHEN OTHERS THEN d := date_trunc('month', p.payment_date)::date; END;
    SELECT id INTO rec_id FROM public.monthly_fee_records
    WHERE student_id = p.student_id AND month = EXTRACT(MONTH FROM d)::int AND year = EXTRACT(YEAR FROM d)::int;
    IF rec_id IS NOT NULL THEN
      PERFORM public.fee_allocate_targets(newpay, ARRAY[rec_id]);
    ELSE
      PERFORM public.fee_allocate(newpay);
    END IF;
  END LOOP;

  FOR f IN SELECT DISTINCT student_id FROM public.student_fee_settings LOOP
    PERFORM public.fee_ensure_months(f.student_id, EXTRACT(MONTH FROM current_date)::int, EXTRACT(YEAR FROM current_date)::int);
  END LOOP;
END $mig$;
