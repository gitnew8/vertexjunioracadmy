
CREATE SEQUENCE IF NOT EXISTS public.payment_receipt_seq START 1001;

CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL,
  fee_id uuid,
  receipt_no text NOT NULL UNIQUE DEFAULT ('INV-' || nextval('public.payment_receipt_seq')),
  amount numeric(10,2) NOT NULL DEFAULT 0,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  paid_month text NOT NULL DEFAULT to_char(now(), 'Mon YYYY'),
  payment_method text NOT NULL DEFAULT 'cash',
  status text NOT NULL DEFAULT 'paid',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER SEQUENCE public.payment_receipt_seq OWNED BY public.payments.receipt_no;

CREATE INDEX idx_payments_student ON public.payments(student_id);
CREATE INDEX idx_payments_date ON public.payments(payment_date DESC);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view payments" ON public.payments FOR SELECT USING (true);
CREATE POLICY "Anyone can insert payments" ON public.payments FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update payments" ON public.payments FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete payments" ON public.payments FOR DELETE USING (true);

CREATE TRIGGER payments_touch_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
