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

    const computeOnline = () => {
      const state = channel.presenceState();
      const ids = new Set<string>();
      Object.values(state).forEach((arr: any) => {
        (arr as any[]).forEach((meta: any) => {
          const uid = meta?.user_id;
          if (uid) ids.add(String(uid));
        });
      });
      // include current user always
      ids.add(user.id);
      console.log("[presence] online:", Array.from(ids));
      setOnlineUsers(ids);
    };

    channel
      .on("presence", { event: "sync" }, computeOnline)
      .on("presence", { event: "join" }, computeOnline)
      .on("presence", { event: "leave" }, computeOnline)
      .subscribe(async (status: string) => {
        console.log("[presence] status:", status);
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
