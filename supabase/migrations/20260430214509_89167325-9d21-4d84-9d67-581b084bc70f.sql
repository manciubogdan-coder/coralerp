DROP POLICY IF EXISTS members_insert ON public.chat_members;

CREATE POLICY members_insert
ON public.chat_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR public.is_chat_member(conversation_id, auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.chat_conversations c
    WHERE c.id = conversation_id
      AND c.created_by = auth.uid()
  )
);

REVOKE EXECUTE ON FUNCTION public.is_chat_member(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_chat_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_chat_member(uuid, uuid) FROM authenticated;