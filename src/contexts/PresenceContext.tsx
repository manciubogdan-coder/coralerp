import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface PresenceValue {
  onlineUsers: Set<string>;
  isOnline: (userId: string) => boolean;
}

const PresenceContext = createContext<PresenceValue>({
  onlineUsers: new Set(),
  isOnline: () => false,
});

export const PresenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id) {
      setOnlineUsers(new Set());
      return;
    }
    const channel = (supabase as any).channel("presence:online-users", {
      config: { presence: { key: user.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const ids = new Set<string>(Object.keys(state));
        setOnlineUsers(ids);
      })
      .subscribe(async (status: string) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: user.id, online_at: new Date().toISOString() });
        }
      });

    const handleVisibility = async () => {
      if (document.visibilityState === "visible") {
        await channel.track({ user_id: user.id, online_at: new Date().toISOString() });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      (supabase as any).removeChannel(channel);
    };
  }, [user?.id]);

  const value = useMemo<PresenceValue>(
    () => ({ onlineUsers, isOnline: (id: string) => onlineUsers.has(id) }),
    [onlineUsers]
  );

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
};

export const usePresence = () => useContext(PresenceContext);
