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
import { Bell, CheckCheck } from "lucide-react";
import { format } from "date-fns";
import { ro } from "date-fns/locale";

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
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);

  const unread = items.filter((i) => !i.read_at).length;

  const load = async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("notifications")
      .select("id,title,body,link,read_at,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data as Notif[]) ?? []);
  };

  useEffect(() => {
    if (!user) return;
    load();
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
      (supabase as any).removeChannel(channel);
    };
  }, [user?.id]);

  const markAllRead = async () => {
    if (!user) return;
    const ids = items.filter((i) => !i.read_at).map((i) => i.id);
    if (ids.length === 0) return;
    await (supabase as any)
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", ids);
    load();
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
        <div className="flex items-center justify-between p-3 border-b">
          <span className="font-medium">Notificări</span>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead}>
              <CheckCheck size={14} className="mr-1" /> Marchează tot
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nicio notificare.
            </div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => openItem(n)}
                className={`w-full text-left p-3 border-b hover:bg-accent transition-colors ${
                  !n.read_at ? "bg-accent/40" : ""
                }`}
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
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
