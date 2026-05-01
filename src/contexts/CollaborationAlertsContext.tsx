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

const taskSeenKey = (userId: string) => `coral:taskuri:last-seen:${userId}`;
const chatSeenKey = (userId: string) => `coral:chat:last-seen:${userId}`;

const getSeenAt = (key: string) => {
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  return new Date(0).toISOString();
};

export const CollaborationAlertsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, departments, isAdmin } = useAuth();
  const location = useLocation();
  const [chatUnread, setChatUnread] = useState(0);
  const [taskUnread, setTaskUnread] = useState(0);

  const markTasksSeen = useCallback(() => {
    if (!user?.id) return;
    window.localStorage.setItem(taskSeenKey(user.id), new Date().toISOString());
    setTaskUnread(0);
    (supabase as any)
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null)
      .or("link.eq./taskuri,event_key.eq.task.assigned,event_key.eq.task.moved,event_key.eq.task.updated,event_key.eq.task.due_soon")
      .then(() => undefined);
  }, [user?.id]);

  const markChatSeen = useCallback(async () => {
    if (!user?.id) return;
    window.localStorage.setItem(chatSeenKey(user.id), new Date().toISOString());
    await (supabase as any)
      .from("chat_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("user_id", user.id);
    await (supabase as any)
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null)
      .or("link.eq./chat,event_key.eq.chat.message");
    setChatUnread(0);
  }, [user?.id]);

  const loadNotificationUnread = useCallback(async () => {
    if (!user?.id) return { chat: 0, task: 0 };
    const { data } = await (supabase as any)
      .from("notifications")
      .select("event_key,link")
      .eq("user_id", user.id)
      .is("read_at", null)
      .limit(1000);

    return ((data as Array<{ event_key: string | null; link: string | null }> | null) ?? []).reduce(
      (acc, n) => {
        if (n.link === "/chat" || n.event_key === "chat.message") acc.chat += 1;
        if (n.link === "/taskuri" || n.event_key?.startsWith("task.")) acc.task += 1;
        return acc;
      },
      { chat: 0, task: 0 }
    );
  }, [user?.id]);

  const loadChatUnread = useCallback(async () => {
    if (!user?.id) return 0;
    const seenAt = getSeenAt(chatSeenKey(user.id));
    const { data: conversations, error } = await (supabase as any).rpc("chat_list_conversations");
    if (error || !conversations?.length) return 0;

    let total = 0;
    for (const conv of conversations as Array<{ id: string }>) {
      const { data: messages, error: messagesError } = await (supabase as any).rpc("chat_list_messages", {
        p_conversation_id: conv.id,
      });
      if (messagesError) continue;
      total += ((messages as any[]) ?? []).filter(
        (message) => message.author_id !== user.id && message.created_at > seenAt
      ).length;
    }

    return total;
  }, [user?.id]);

  const loadTaskUnread = useCallback(async () => {
    if (!user?.id || location.pathname.startsWith("/taskuri")) return 0;
    const seenAt = getSeenAt(taskSeenKey(user.id));
    let page = 0;
    const pageSize = 1000;
    let relevant = 0;

    while (true) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data, error } = await (supabase as any)
        .from("app_tasks")
        .select("id,department,created_by,assigned_to,assignee_id,updated_at")
        .gt("updated_at", seenAt)
        .order("updated_at", { ascending: false })
        .range(from, to);
      if (error || !data?.length) break;

      relevant += ((data as any[]) ?? []).filter((task) => {
        const assignedTo = task.assigned_to ?? task.assignee_id;
        return (
          isAdmin ||
          assignedTo === user.id ||
          task.created_by === user.id ||
          (task.department && departments.includes(task.department))
        );
      }).length;

      if (data.length < pageSize) break;
      page += 1;
    }

    return relevant;
  }, [departments, isAdmin, location.pathname, user?.id]);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setChatUnread(0);
      setTaskUnread(0);
      return;
    }
    const [chatResult, taskResult, notifResult] = await Promise.allSettled([
      loadChatUnread(),
      loadTaskUnread(),
      loadNotificationUnread(),
    ]);
    const nextChatUnread = chatResult.status === "fulfilled" ? chatResult.value : 0;
    const nextTaskUnread = taskResult.status === "fulfilled" ? taskResult.value : 0;
    const notifUnread = notifResult.status === "fulfilled" ? notifResult.value : { chat: 0, task: 0 };
    setChatUnread(Math.max(nextChatUnread, notifUnread.chat));
    setTaskUnread(Math.max(nextTaskUnread, notifUnread.task));
  }, [loadChatUnread, loadNotificationUnread, loadTaskUnread, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    if (location.pathname.startsWith("/chat")) markChatSeen();
    if (location.pathname.startsWith("/taskuri")) markTasksSeen();
    refresh();
    const interval = window.setInterval(refresh, 5000);
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