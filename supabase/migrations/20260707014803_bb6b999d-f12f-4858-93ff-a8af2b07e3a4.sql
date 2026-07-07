
-- Exam security settings singleton
CREATE TABLE public.exam_security_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL UNIQUE DEFAULT 'default',
  fullscreen_required boolean NOT NULL DEFAULT true,
  tab_switch_limit integer NOT NULL DEFAULT 3,
  camera_required boolean NOT NULL DEFAULT false,
  camera_snapshot_interval_sec integer NOT NULL DEFAULT 30,
  mic_monitoring boolean NOT NULL DEFAULT false,
  ai_behavior_tracking boolean NOT NULL DEFAULT true,
  randomize_questions boolean NOT NULL DEFAULT true,
  randomize_options boolean NOT NULL DEFAULT true,
  per_question_timer_sec integer NOT NULL DEFAULT 0,
  allow_skip boolean NOT NULL DEFAULT true,
  block_copy_paste boolean NOT NULL DEFAULT true,
  block_screenshot boolean NOT NULL DEFAULT true,
  warning_limit integer NOT NULL DEFAULT 3,
  auto_action text NOT NULL DEFAULT 'auto_submit',
  result_policy_low text NOT NULL DEFAULT 'release',
  result_policy_medium text NOT NULL DEFAULT 'hold_teacher',
  result_policy_high text NOT NULL DEFAULT 'hold_admin',
  system_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_security_settings TO anon, authenticated;
GRANT ALL ON public.exam_security_settings TO service_role;
ALTER TABLE public.exam_security_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read exam_security_settings" ON public.exam_security_settings FOR SELECT USING (true);
CREATE POLICY "public write exam_security_settings" ON public.exam_security_settings FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.exam_security_settings (scope) VALUES ('default') ON CONFLICT DO NOTHING;

CREATE TRIGGER exam_security_settings_touch BEFORE UPDATE ON public.exam_security_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Per-attempt event log
CREATE TABLE public.exam_security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid,
  student_id uuid,
  test_id uuid,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'low',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_security_events TO anon, authenticated;
GRANT ALL ON public.exam_security_events TO service_role;
ALTER TABLE public.exam_security_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read exam_security_events" ON public.exam_security_events FOR SELECT USING (true);
CREATE POLICY "public write exam_security_events" ON public.exam_security_events FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_exam_events_attempt ON public.exam_security_events(attempt_id, created_at DESC);
CREATE INDEX idx_exam_events_student ON public.exam_security_events(student_id, created_at DESC);

-- Extend test_attempts
ALTER TABLE public.test_attempts
  ADD COLUMN IF NOT EXISTS warnings_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS risk_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS risk_label text NOT NULL DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS result_status text NOT NULL DEFAULT 'auto_released',
  ADD COLUMN IF NOT EXISTS snapshots jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS security_summary jsonb NOT NULL DEFAULT '{}'::jsonb;
