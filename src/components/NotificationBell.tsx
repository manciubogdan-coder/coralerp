import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Bell, CheckCheck, Trash2, X } from "lucide-react";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { useCollaborationAlerts } from "@/contexts/CollaborationAlertsContext";

interface Notif {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { chatUnread, taskUnread, totalUnread, markChatSeen, markTasksSeen, refresh } = useCollaborationAlerts();
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);

  const dbUnread = items.filter((i) => !i.read_at).length;
  const unread = Math.max(dbUnread, totalUnread);

  const load = async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("notifications")
      .select("id,title,body,link,read_at,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data as Notif[]) ?? []);
    window.dispatchEvent(new Event("collaboration-alerts-refresh"));
  };

  useEffect(() => {
    if (!user) return;
    load();
    const interval = window.setInterval(load, 5000);
    const channel = (supabase as any)
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => load()
      )
      .subscribe();
    return () => {
      window.clearInterval(interval);
      (supabase as any).removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const markAllRead = async () => {
    if (!user) return;
    const ids = items.filter((i) => !i.read_at).map((i) => i.id);
    if (ids.length > 0) {
      await (supabase as any)
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .in("id", ids);
    }
    await markChatSeen();
    markTasksSeen();
    await load();
    window.dispatchEvent(new Event("collaboration-alerts-refresh"));
  };

  const deleteOne = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    const { error, count } = await (supabase as any)
      .from("notifications").delete({ count: "exact" }).eq("id", id);
    if (error || !count) {
      console.warn("Notification delete failed", error);
      return; // nu ascundem dacă DB-ul nu a șters
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
    window.dispatchEvent(new Event("collaboration-alerts-refresh"));
  };

  const clearAll = async () => {
    if (!user) return;
    const { error } = await (supabase as any)
      .from("notifications").delete().eq("user_id", user.id);
    if (error) { console.warn("Notifications clear failed", error); return; }
    setItems([]);
    await markChatSeen();
    markTasksSeen();
    window.dispatchEvent(new Event("collaboration-alerts-refresh"));
  };

  const openItem = async (n: Notif) => {
    if (!n.read_at) {
      await (supabase as any)
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", n.id);
    }
    setOpen(false);
    if (n.link) navigate(n.link);
    load();
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell size={18} />
          {unread > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 flex items-center justify-center text-[10px] bg-red-500 text-white border-0"
            >
              {unread > 99 ? "99+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b gap-1">
          <span className="font-medium">Notificări</span>
          <div className="flex items-center gap-1">
            {unread > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllRead} title="Marchează toate ca citite">
                <CheckCheck size={14} />
              </Button>
            )}
            {items.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAll} title="Șterge toate" className="text-destructive hover:text-destructive">
                <Trash2 size={14} />
              </Button>
            )}
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {chatUnread > 0 && (
            <button
              onClick={() => {
                markChatSeen();
                setOpen(false);
                navigate("/chat");
              }}
              className="w-full text-left p-3 border-b hover:bg-accent transition-colors bg-accent/40"
            >
              <div className="flex items-start gap-2">
                <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">Mesaje noi în chat</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {chatUnread > 99 ? "99+" : chatUnread} mesaje necitite
                  </div>
                </div>
              </div>
            </button>
          )}
          {taskUnread > 0 && (
            <button
              onClick={() => {
                markTasksSeen();
                setOpen(false);
                navigate("/taskuri");
              }}
              className="w-full text-left p-3 border-b hover:bg-accent transition-colors bg-accent/40"
            >
              <div className="flex items-start gap-2">
                <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">Taskuri modificate</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {taskUnread > 99 ? "99+" : taskUnread} modificări noi
                  </div>
                </div>
              </div>
            </button>
          )}
          {items.length === 0 && totalUnread === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nicio notificare.
            </div>
          ) : (
            items.map((n) => (
              <div
                key={n.id}
                className={`group/notif w-full border-b hover:bg-accent transition-colors flex items-start ${
                  !n.read_at ? "bg-accent/40" : ""
                }`}
              >
                <button
                  onClick={() => openItem(n)}
                  className="flex-1 text-left p-3 min-w-0"
                >
                  <div className="flex items-start gap-2">
                    {!n.read_at && (
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{n.title}</div>
                      {n.body && (
                        <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {n.body}
                        </div>
                      )}
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {format(new Date(n.created_at), "dd MMM HH:mm", { locale: ro })}
                      </div>
                    </div>
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 mr-2 mt-2 opacity-50 hover:opacity-100 hover:text-destructive shrink-0"
                  onClick={(e) => deleteOne(n.id, e)}
                  title="Șterge notificarea"
                >
                  <X size={14} />
                </Button>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
