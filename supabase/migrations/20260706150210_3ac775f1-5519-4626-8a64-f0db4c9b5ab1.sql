
-- Add pricing to tests
ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_price numeric,
  ADD COLUMN IF NOT EXISTS is_free boolean NOT NULL DEFAULT true;

-- Reward rules (gift ladder)
CREATE TABLE IF NOT EXISTS public.reward_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  min_tests int NOT NULL DEFAULT 10,
  min_score_percent int NOT NULL DEFAULT 80,
  cycle_days int NOT NULL DEFAULT 30,
  stock int NOT NULL DEFAULT 0,
  image_url text,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reward_rules TO anon, authenticated;
GRANT ALL ON public.reward_rules TO service_role;

ALTER TABLE public.reward_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read reward_rules" ON public.reward_rules FOR SELECT USING (true);
CREATE POLICY "public write reward_rules" ON public.reward_rules FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER trg_reward_rules_updated
  BEFORE UPDATE ON public.reward_rules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Reward claims
CREATE TABLE IF NOT EXISTS public.reward_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES public.reward_rules(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  tests_count int NOT NULL DEFAULT 0,
  avg_score int NOT NULL DEFAULT 0,
  notes text,
  earned_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, rule_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reward_claims TO anon, authenticated;
GRANT ALL ON public.reward_claims TO service_role;

ALTER TABLE public.reward_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read reward_claims" ON public.reward_claims FOR SELECT USING (true);
CREATE POLICY "public write reward_claims" ON public.reward_claims FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER trg_reward_claims_updated
  BEFORE UPDATE ON public.reward_claims
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- App settings (T&C etc.)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read app_settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "public write app_settings" ON public.app_settings FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER trg_app_settings_updated
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed default T&C and toggle
INSERT INTO public.app_settings (key, value) VALUES
  ('reward_system_enabled', 'true'::jsonb),
  ('terms_and_conditions', '"1. Gifts are subject to limited stock availability.\n2. One student = one reward per cycle.\n3. Fake attempts or cheating will result in reward cancellation.\n4. Admin''s decision is final and binding.\n5. Gifts are non-transferable.\n6. Rewards are earned only when all conditions (test count + minimum score) are met within the reward cycle.\n7. School reserves the right to modify rules at any time."'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Seed sample reward rules
INSERT INTO public.reward_rules (title, min_tests, min_score_percent, cycle_days, stock, sort_order, description) VALUES
  ('Brand New Pen', 10, 90, 30, 100, 1, 'Complete 10 tests with 90%+ average'),
  ('Notebook', 25, 85, 30, 50, 2, 'Complete 25 tests with 85%+ average'),
  ('School Bag', 50, 80, 60, 20, 3, 'Complete 50 tests with 80%+ average'),
  ('Free Course / T-Shirt', 100, 75, 90, 10, 4, 'Complete 100 tests with 75%+ average')
ON CONFLICT DO NOTHING;
