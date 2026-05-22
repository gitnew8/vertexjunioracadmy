
CREATE TABLE public.chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'New chat',
  student_class text,
  subject text,
  mode text NOT NULL DEFAULT 'explain',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_sessions_student ON public.chat_sessions(student_id, updated_at DESC);

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view chat_sessions" ON public.chat_sessions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert chat_sessions" ON public.chat_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update chat_sessions" ON public.chat_sessions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete chat_sessions" ON public.chat_sessions FOR DELETE USING (true);

CREATE TRIGGER trg_chat_sessions_touch BEFORE UPDATE ON public.chat_sessions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL DEFAULT '',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_session ON public.chat_messages(session_id, created_at);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view chat_messages" ON public.chat_messages FOR SELECT USING (true);
CREATE POLICY "Anyone can insert chat_messages" ON public.chat_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update chat_messages" ON public.chat_messages FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete chat_messages" ON public.chat_messages FOR DELETE USING (true);
