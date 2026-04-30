CREATE OR REPLACE FUNCTION public.is_chat_member(_conv uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_members
    WHERE conversation_id = _conv
      AND user_id = _user
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_chat_member(uuid, uuid) TO authenticated;

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conv_read ON public.chat_conversations;
DROP POLICY IF EXISTS conv_insert ON public.chat_conversations;
DROP POLICY IF EXISTS conv_update ON public.chat_conversations;
DROP POLICY IF EXISTS members_read ON public.chat_members;
DROP POLICY IF EXISTS members_insert ON public.chat_members;
DROP POLICY IF EXISTS members_update ON public.chat_members;
DROP POLICY IF EXISTS members_delete ON public.chat_members;
DROP POLICY IF EXISTS msg_read ON public.chat_messages;
DROP POLICY IF EXISTS msg_insert ON public.chat_messages;

DROP POLICY IF EXISTS "Users can view chat members" ON public.chat_members;
DROP POLICY IF EXISTS "Users can insert chat members" ON public.chat_members;
DROP POLICY IF EXISTS "Users can update own chat member" ON public.chat_members;
DROP POLICY IF EXISTS "Users can delete own chat member" ON public.chat_members;
DROP POLICY IF EXISTS "Members can view their conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Members can view messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Members can send messages" ON public.chat_messages;

CREATE POLICY conv_read
ON public.chat_conversations
FOR SELECT
TO authenticated
USING (public.is_chat_member(id, auth.uid()) OR created_by = auth.uid());

CREATE POLICY conv_insert
ON public.chat_conversations
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid() OR created_by IS NULL);

CREATE POLICY conv_update
ON public.chat_conversations
FOR UPDATE
TO authenticated
USING (public.is_chat_member(id, auth.uid()) OR created_by = auth.uid())
WITH CHECK (public.is_chat_member(id, auth.uid()) OR created_by = auth.uid());

CREATE POLICY members_read
ON public.chat_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_chat_member(conversation_id, auth.uid()));

CREATE POLICY members_insert
ON public.chat_members
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY members_update
ON public.chat_members
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY members_delete
ON public.chat_members
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY msg_read
ON public.chat_messages
FOR SELECT
TO authenticated
USING (public.is_chat_member(conversation_id, auth.uid()));

CREATE POLICY msg_insert
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (author_id = auth.uid() AND public.is_chat_member(conversation_id, auth.uid()));