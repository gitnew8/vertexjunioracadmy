CREATE TABLE public.site_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  html text NOT NULL,
  start_date date,
  end_date date,
  repeat_yearly boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  force_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_themes TO anon, authenticated;
GRANT ALL ON public.site_themes TO service_role;

ALTER TABLE public.site_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read site_themes" ON public.site_themes FOR SELECT USING (true);
CREATE POLICY "public write site_themes" ON public.site_themes FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER trg_site_themes_updated BEFORE UPDATE ON public.site_themes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_site_themes_active ON public.site_themes(active, priority DESC);