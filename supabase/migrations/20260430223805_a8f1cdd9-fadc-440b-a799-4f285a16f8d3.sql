REVOKE EXECUTE ON FUNCTION public.notify_chat_message() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_chat_message() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_chat_message() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.notify_app_task_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_app_task_change() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_app_task_change() FROM authenticated;