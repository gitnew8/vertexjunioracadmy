ALTER TABLE public.students ADD COLUMN IF NOT EXISTS can_manage_curriculum boolean NOT NULL DEFAULT false;

CREATE TABLE public.custom_curriculum (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_class text NOT NULL,
  subject text NOT NULL DEFAULT '',
  chapter text NOT NULL DEFAULT '',
  topics text[] NOT NULL DEFAULT '{}',
  added_by_type text NOT NULL DEFAULT 'admin',
  added_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_curriculum TO anon, authenticated;
GRANT ALL ON public.custom_curriculum TO service_role;
ALTER TABLE public.custom_curriculum ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read curriculum" ON public.custom_curriculum FOR SELECT USING (true);
CREATE POLICY "admin panel writes curriculum" ON public.custom_curriculum FOR ALL USING (added_by_type IN ('admin','student')) WITH CHECK (added_by_type IN ('admin','student'));
CREATE TRIGGER trg_custom_curriculum_touch BEFORE UPDATE ON public.custom_curriculum FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Student entry path: verifies the student was granted permission by the admin
CREATE OR REPLACE FUNCTION public.curriculum_student_add(p_login text, p_class text, p_subject text, p_chapter text, p_topics text[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; new_id uuid;
BEGIN
  SELECT * INTO s FROM public.students WHERE login_number = p_login AND can_manage_curriculum = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Permission nahi hai — admin se access lijiye'; END IF;
  IF coalesce(trim(p_class),'') = '' OR coalesce(trim(p_subject),'') = '' OR coalesce(trim(p_chapter),'') = '' THEN
    RAISE EXCEPTION 'Class, subject aur chapter zaroori hain';
  END IF;
  INSERT INTO public.custom_curriculum(student_class, subject, chapter, topics, added_by_type, added_by_name)
  VALUES (trim(p_class), trim(p_subject), trim(p_chapter), coalesce(p_topics,'{}'), 'student', s.name)
  RETURNING id INTO new_id;
  RETURN new_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.curriculum_student_add(text,text,text,text,text[]) TO anon, authenticated;