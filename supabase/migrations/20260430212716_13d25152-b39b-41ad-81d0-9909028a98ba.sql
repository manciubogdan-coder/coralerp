-- =========================================================
-- TASKS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.app_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo', -- todo|in_progress|done
  priority text NOT NULL DEFAULT 'normal', -- low|normal|high|urgent
  due_at timestamptz,
  assignee_id uuid,
  created_by uuid NOT NULL,
  department text,
  recurrence text, -- null|daily|weekly|monthly
  parent_task_id uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON public.app_tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_creator ON public.app_tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.app_tasks(status);

CREATE TABLE IF NOT EXISTS public.app_task_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.app_tasks(id) ON DELETE CASCADE,
  label text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.app_tasks(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_task_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_task_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tasks_read ON public.app_tasks;
CREATE POLICY tasks_read ON public.app_tasks FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS tasks_insert ON public.app_tasks;
CREATE POLICY tasks_insert ON public.app_tasks FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
DROP POLICY IF EXISTS tasks_update ON public.app_tasks;
CREATE POLICY tasks_update ON public.app_tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS tasks_delete ON public.app_tasks;
CREATE POLICY tasks_delete ON public.app_tasks FOR DELETE TO authenticated USING (created_by = auth.uid());

DROP POLICY IF EXISTS taskcl_all ON public.app_task_checklist;
CREATE POLICY taskcl_all ON public.app_task_checklist FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS taskcm_read ON public.app_task_comments;
CREATE POLICY taskcm_read ON public.app_task_comments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS taskcm_insert ON public.app_task_comments;
CREATE POLICY taskcm_insert ON public.app_task_comments FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
DROP POLICY IF EXISTS taskcm_delete ON public.app_task_comments;
CREATE POLICY taskcm_delete ON public.app_task_comments FOR DELETE TO authenticated USING (author_id = auth.uid());

-- =========================================================
-- CHAT
-- =========================================================
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL, -- dm|group|department
  name text,
  department text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_members (
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_chat_members_user ON public.chat_members(user_id);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conv ON public.chat_messages(conversation_id, created_at);

-- SECURITY DEFINER helper to avoid RLS recursion on chat_members
CREATE OR REPLACE FUNCTION public.is_chat_member(_conv uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE conversation_id = _conv AND user_id = _user
  );
$$;

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- conversations: anyone authenticated can read/insert; updates open
DROP POLICY IF EXISTS conv_read ON public.chat_conversations;
CREATE POLICY conv_read ON public.chat_conversations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS conv_insert ON public.chat_conversations;
CREATE POLICY conv_insert ON public.chat_conversations FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS conv_update ON public.chat_conversations;
CREATE POLICY conv_update ON public.chat_conversations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- members: read open (needed to compute DM partners), insert open, delete by self
DROP POLICY IF EXISTS members_read ON public.chat_members;
CREATE POLICY members_read ON public.chat_members FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS members_insert ON public.chat_members;
CREATE POLICY members_insert ON public.chat_members FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS members_update ON public.chat_members;
CREATE POLICY members_update ON public.chat_members FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS members_delete ON public.chat_members;
CREATE POLICY members_delete ON public.chat_members FOR DELETE TO authenticated USING (user_id = auth.uid());

-- messages: read/insert only if member of conversation (via SECURITY DEFINER fn)
DROP POLICY IF EXISTS msg_read ON public.chat_messages;
CREATE POLICY msg_read ON public.chat_messages FOR SELECT TO authenticated
  USING (public.is_chat_member(conversation_id, auth.uid()));
DROP POLICY IF EXISTS msg_insert ON public.chat_messages;
CREATE POLICY msg_insert ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.is_chat_member(conversation_id, auth.uid()));

-- =========================================================
-- NOTIFICATIONS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.notif_events_catalog (
  event_key text PRIMARY KEY,
  label text NOT NULL,
  description text
);

INSERT INTO public.notif_events_catalog (event_key, label, description) VALUES
  ('reception.completed', 'Recepție finalizată', 'O recepție a fost înregistrată / finalizată.'),
  ('quality.completed', 'Calitate finalizată', 'Verificarea de calitate a fost încheiată.'),
  ('transfer.created', 'Transfer creat', 'Un bon de transfer a fost emis.'),
  ('order.created', 'Comandă creată', 'O comandă către furnizor a fost creată.'),
  ('order.received', 'Comandă recepționată', 'O comandă a fost marcată ca recepționată.'),
  ('maintenance.created', 'Mentenanță – problemă raportată', 'O nouă problemă a fost raportată în registru.'),
  ('maintenance.resolved', 'Mentenanță – problemă rezolvată', 'O problemă raportată a fost marcată ca rezolvată.'),
  ('task.assigned', 'Task atribuit', 'Ți-a fost atribuit un task nou.'),
  ('task.due_soon', 'Task aproape de scadență', 'Un task se apropie de deadline.')
ON CONFLICT (event_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.notif_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL REFERENCES public.notif_events_catalog(event_key) ON DELETE CASCADE,
  target_department text,
  target_user_id uuid,
  title_template text NOT NULL,
  body_template text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (target_department IS NOT NULL OR target_user_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_key text,
  title text NOT NULL,
  body text,
  link text,
  payload jsonb DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON public.notifications(user_id, created_at DESC);

ALTER TABLE public.notif_events_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notif_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS evcat_read ON public.notif_events_catalog;
CREATE POLICY evcat_read ON public.notif_events_catalog FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS rules_read ON public.notif_rules;
CREATE POLICY rules_read ON public.notif_rules FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS rules_write ON public.notif_rules;
CREATE POLICY rules_write ON public.notif_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS notif_read ON public.notifications;
CREATE POLICY notif_read ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS notif_update ON public.notifications;
CREATE POLICY notif_update ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- inserts come only via SECURITY DEFINER function below
DROP POLICY IF EXISTS notif_insert ON public.notifications;
CREATE POLICY notif_insert ON public.notifications FOR INSERT TO authenticated WITH CHECK (false);

-- Dispatcher: SECURITY DEFINER, creates notifications based on rules
CREATE OR REPLACE FUNCTION public.emit_notification_event(
  p_event_key text,
  p_title_default text,
  p_body text DEFAULT NULL,
  p_link text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_users uuid[];
  uid uuid;
  cnt int := 0;
BEGIN
  FOR r IN
    SELECT * FROM public.notif_rules WHERE event_key = p_event_key AND enabled = true
  LOOP
    v_users := ARRAY[]::uuid[];
    IF r.target_user_id IS NOT NULL THEN
      v_users := ARRAY[r.target_user_id];
    ELSIF r.target_department IS NOT NULL THEN
      SELECT array_agg(DISTINCT user_id) INTO v_users
      FROM public.app_user_roles
      WHERE role::text = r.target_department;
    END IF;

    IF v_users IS NULL THEN CONTINUE; END IF;

    FOREACH uid IN ARRAY v_users LOOP
      INSERT INTO public.notifications (user_id, event_key, title, body, link, payload)
      VALUES (
        uid,
        p_event_key,
        COALESCE(NULLIF(r.title_template, ''), p_title_default),
        COALESCE(r.body_template, p_body),
        p_link,
        COALESCE(p_payload, '{}'::jsonb)
      );
      cnt := cnt + 1;
    END LOOP;
  END LOOP;
  RETURN cnt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.emit_notification_event(text, text, text, text, jsonb) TO authenticated;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_tasks;