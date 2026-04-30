-- Add collaboration events to the catalog used by the notification UI
INSERT INTO public.notif_events_catalog (event_key, label, description) VALUES
  ('chat.message', 'Mesaj nou în chat', 'Ai primit un mesaj nou într-o conversație.'),
  ('task.updated', 'Task modificat', 'Un task relevant pentru tine a fost modificat.'),
  ('task.moved', 'Task mutat', 'Statusul unui task relevant pentru tine s-a schimbat.')
ON CONFLICT (event_key) DO NOTHING;

-- Notify all other members when a chat message is inserted.
CREATE OR REPLACE FUNCTION public.notify_chat_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_name text;
BEGIN
  SELECT COALESCE(NULLIF(name, ''), NULLIF(department, ''), 'Chat')
  INTO v_conversation_name
  FROM public.chat_conversations
  WHERE id = NEW.conversation_id;

  INSERT INTO public.notifications (user_id, event_key, title, body, link, payload)
  SELECT
    cm.user_id,
    'chat.message',
    'Mesaj nou în chat',
    COALESCE(v_conversation_name, 'Chat') || ': ' || left(NEW.body, 160),
    '/chat',
    jsonb_build_object('conversation_id', NEW.conversation_id, 'message_id', NEW.id, 'author_id', NEW.author_id)
  FROM public.chat_members cm
  WHERE cm.conversation_id = NEW.conversation_id
    AND cm.user_id <> NEW.author_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_chat_message ON public.chat_messages;
CREATE TRIGGER trg_notify_chat_message
AFTER INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_chat_message();

-- Notify interested users when tasks are created/updated/moved.
CREATE OR REPLACE FUNCTION public.notify_app_task_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new jsonb := to_jsonb(NEW);
  v_old jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  v_actor uuid := auth.uid();
  v_assignee uuid := NULLIF(COALESCE(v_new->>'assigned_to', v_new->>'assignee_id'), '')::uuid;
  v_created_by uuid := NULLIF(v_new->>'created_by', '')::uuid;
  v_recipients uuid[];
  v_uid uuid;
  v_event text;
  v_title text;
  v_body text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event := 'task.assigned';
    v_title := 'Task nou';
    v_body := NEW.title;
  ELSIF COALESCE(v_old->>'status', '') IS DISTINCT FROM COALESCE(v_new->>'status', '') THEN
    v_event := 'task.moved';
    v_title := 'Task mutat';
    v_body := NEW.title || ' → ' || COALESCE(v_new->>'status', '');
  ELSE
    v_event := 'task.updated';
    v_title := 'Task modificat';
    v_body := NEW.title;
  END IF;

  SELECT ARRAY(
    SELECT DISTINCT x
    FROM unnest(ARRAY[v_assignee, v_created_by]) AS x
    WHERE x IS NOT NULL
      AND (v_actor IS NULL OR x <> v_actor)
  ) INTO v_recipients;

  FOREACH v_uid IN ARRAY COALESCE(v_recipients, ARRAY[]::uuid[]) LOOP
    INSERT INTO public.notifications (user_id, event_key, title, body, link, payload)
    VALUES (
      v_uid,
      v_event,
      v_title,
      v_body,
      '/taskuri',
      jsonb_build_object('task_id', NEW.id, 'status', v_new->>'status')
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_app_task_insert ON public.app_tasks;
CREATE TRIGGER trg_notify_app_task_insert
AFTER INSERT ON public.app_tasks
FOR EACH ROW
EXECUTE FUNCTION public.notify_app_task_change();

DROP TRIGGER IF EXISTS trg_notify_app_task_update ON public.app_tasks;
CREATE TRIGGER trg_notify_app_task_update
AFTER UPDATE ON public.app_tasks
FOR EACH ROW
WHEN (OLD IS DISTINCT FROM NEW)
EXECUTE FUNCTION public.notify_app_task_change();

GRANT EXECUTE ON FUNCTION public.notify_chat_message() TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_app_task_change() TO authenticated;