import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface CollaborationAlertsValue {
  chatUnread: number;
  taskUnread: number;
  totalUnread: number;
  refresh: () => Promise<void>;
  markChatSeen: () => Promise<void>;
  markTasksSeen: () => void;
}

const CollaborationAlertsContext = createContext<CollaborationAlertsValue | undefined>(undefined);

const chunk = <T,>(items: T[], size = 50) => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

const taskSeenKey = (userId: string) => `coral:taskuri:last-seen:${userId}`;

const getOrInitSeenAt = (userId: string) => {
  const key = taskSeenKey(userId);
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const now = new Date().toISOString();
  window.localStorage.setItem(key, now);
  return now;
};

export const CollaborationAlertsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, departments } = useAuth();
  const location = useLocation();
  const [chatUnread, setChatUnread] = useState(0);
  const [taskUnread, setTaskUnread] = useState(0);

  const markTasksSeen = useCallback(() => {
    if (!user?.id) return;
    window.localStorage.setItem(taskSeenKey(user.id), new Date().toISOString());
    setTaskUnread(0);
  }, [user?.id]);

  const markChatSeen = useCallback(async () => {
    if (!user?.id) return;
    await (supabase as any)
      .from("chat_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("user_id", user.id);
    setChatUnread(0);
  }, [user?.id]);

  const loadChatUnread = useCallback(async () => {
    if (!user?.id) return 0;
    const { data: memberships, error } = await (supabase as any)
      .from("chat_members")
      .select("conversation_id,last_read_at")
      .eq("user_id", user.id);
    if (error || !memberships?.length) return 0;

    const readByConv = new Map<string, string>(
      memberships.map((m: any) => [m.conversation_id, m.last_read_at ?? new Date(0).toISOString()])
    );
    let total = 0;

    for (const ids of chunk(Array.from(readByConv.keys()))) {
      const oldestRead = ids.reduce((min, id) => {
        const value = readByConv.get(id) ?? min;
        return value < min ? value : min;
      }, new Date().toISOString());

      const { data: messages } = await (supabase as any)
        .from("chat_messages")
        .select("conversation_id,author_id,created_at")
        .in("conversation_id", ids)
        .neq("author_id", user.id)
        .gt("created_at", oldestRead);

      total += ((messages as any[]) ?? []).filter(
        (m) => new Date(m.created_at) > new Date(readByConv.get(m.conversation_id) ?? 0)
      ).length;
    }

    return total;
  }, [user?.id]);

  const loadTaskUnread = useCallback(async () => {
    if (!user?.id || location.pathname.startsWith("/taskuri")) return 0;
    const seenAt = getOrInitSeenAt(user.id);
    let page = 0;
    const pageSize = 1000;
    let relevant = 0;

    while (true) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data, error } = await (supabase as any)
        .from("app_tasks")
        .select("*")
        .gt("updated_at", seenAt)
        .order("updated_at", { ascending: false })
        .range(from, to);
      if (error || !data?.length) break;

      relevant += ((data as any[]) ?? []).filter((task) => {
        const assignedTo = task.assigned_to ?? task.assignee_id;
        return (
          assignedTo === user.id ||
          task.created_by === user.id ||
          (task.department && departments.includes(task.department))
        );
      }).length;

      if (data.length < pageSize) break;
      page += 1;
    }

    return relevant;
  }, [departments, location.pathname, user?.id]);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setChatUnread(0);
      setTaskUnread(0);
      return;
    }
    const [nextChatUnread, nextTaskUnread] = await Promise.all([loadChatUnread(), loadTaskUnread()]);
    setChatUnread(nextChatUnread);
    setTaskUnread(nextTaskUnread);
  }, [loadChatUnread, loadTaskUnread, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    if (location.pathname.startsWith("/taskuri")) markTasksSeen();
    refresh();
    const interval = window.setInterval(refresh, 10000);
    window.addEventListener("collaboration-alerts-refresh", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("collaboration-alerts-refresh", refresh);
    };
  }, [location.pathname, markTasksSeen, refresh, user?.id]);

  const value = useMemo(
    () => ({ chatUnread, taskUnread, totalUnread: chatUnread + taskUnread, refresh, markChatSeen, markTasksSeen }),
    [chatUnread, markChatSeen, markTasksSeen, refresh, taskUnread]
  );

  return <CollaborationAlertsContext.Provider value={value}>{children}</CollaborationAlertsContext.Provider>;
};

export const useCollaborationAlerts = () => {
  const context = useContext(CollaborationAlertsContext);
  if (!context) {
    throw new Error("useCollaborationAlerts must be used within CollaborationAlertsProvider");
  }
  return context;
};