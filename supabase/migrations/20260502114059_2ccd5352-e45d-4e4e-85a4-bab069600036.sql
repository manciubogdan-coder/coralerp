DROP TRIGGER IF EXISTS trg_fire_push_for_notification ON public.notifications;

CREATE TRIGGER trg_fire_push_for_notification
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.fire_push_for_notification();