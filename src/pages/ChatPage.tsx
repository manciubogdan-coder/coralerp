import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format, isToday, isYesterday } from "date-fns";
import { ro } from "date-fns/locale";
import { Plus, Send, MessageSquare, Hash, Users, User as UserIcon } from "lucide-react";
import BackToHubButton from "@/components/BackToHubButton";
import { DEPARTMENTS } from "@/lib/departments";

interface Profile {
  user_id: string;
  name: string | null;
  email: string;
}
interface Conversation {
  id: string;
  type: "dm" | "group" | "department";
  name: string | null;
  department: string | null;
  created_by: string | null;
  updated_at: string;
}
interface Message {
  id: string;
  conversation_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

const formatDay = (iso: string) => {
  const d = new Date(iso);
  if (isToday(d)) return "Astăzi";
  if (isYesterday(d)) return "Ieri";
  return format(d, "dd MMM yyyy", { locale: ro });
};

const ChatPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [unreadByConv, setUnreadByConv] = useState<Record<string, number>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState<"toate" | "dm" | "group" | "department">("toate");
  const [newDmOpen, setNewDmOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupMembers, setNewGroupMembers] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const userId = user?.id ?? "";

  // ---------- LOAD PROFILES ----------
  const loadProfiles = async () => {
    const { data } = await (supabase as any)
      .from("app_profiles")
      .select("user_id,name,email")
      .order("name");
    const map: Record<string, Profile> = {};
    (data ?? []).forEach((p: Profile) => {
      map[p.user_id] = p;
    });
    setProfiles(map);
  };

  // ---------- ENSURE DEPARTMENT CHANNELS ----------
  // Pentru fiecare departament al userului curent, asigură-te că există un canal
  // și că userul e membru.
  const ensureDepartmentChannels = async () => {
    if (!userId) return;
    // ia rolurile userului
    const { data: rolesData } = await (supabase as any)
      .from("app_user_roles")
      .select("role")
      .eq("user_id", userId);
    const userDepts: string[] = (rolesData ?? [])
      .map((r: any) => r.role)
      .filter((r: string) => r !== "admin");

    for (const dept of userDepts) {
      // există canalul?
      const { data: existing } = await (supabase as any)
        .from("chat_conversations")
        .select("id")
        .eq("type", "department")
        .eq("department", dept)
        .maybeSingle();

      let convId: string | undefined = existing?.id;
      if (!convId) {
        const deptDef = DEPARTMENTS.find((d) => d.id === dept);
        const { data: created } = await (supabase as any)
          .from("chat_conversations")
          .insert({
            type: "department",
            department: dept,
            name: deptDef?.label ?? dept,
            created_by: userId,
          })
          .select("id")
          .single();
        convId = created?.id;
      }

      if (convId) {
        await (supabase as any)
          .from("chat_members")
          .upsert({ conversation_id: convId, user_id: userId }, { onConflict: "conversation_id,user_id" });
      }
    }
  };

  // ---------- LOAD CONVERSATIONS ----------
  const loadConversations = async () => {
    if (!userId) return;
    const { data: convs, error } = await (supabase as any)
      .from("chat_conversations")
      .select("id,type,name,department,created_by,updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      toast({ title: "Eroare chat", description: error.message, variant: "destructive" });
      setConversations([]);
      return;
    }

    setConversations((convs as Conversation[]) ?? []);
  };

  // ---------- LOAD MESSAGES ----------
  const loadMessages = async (convId: string) => {
    const { data } = await (supabase as any)
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(500);
    setMessages((data as Message[]) ?? []);
    setUnreadByConv((u) => ({ ...u, [convId]: 0 }));
  };

  // ---------- INITIAL LOAD ----------
  useEffect(() => {
    if (!userId) return;
    (async () => {
      await loadProfiles();
      await ensureDepartmentChannels();
      await loadConversations();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ---------- REALTIME on messages ----------
  useEffect(() => {
    if (!userId) return;
    const channel = (supabase as any)
      .channel("chat-global")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload: any) => {
          const msg = payload.new as Message;
          if (msg.conversation_id === activeId) {
            setMessages((m) => [...m, msg]);
            // marchează citit dacă e mesajul altuia
            if (msg.author_id !== userId) {
              (supabase as any)
                .from("chat_members")
                .update({ last_read_at: new Date().toISOString() })
                .eq("conversation_id", activeId!)
                .eq("user_id", userId);
            }
          } else {
            // crește unread
            setUnreadByConv((u) => ({
              ...u,
              [msg.conversation_id]: (u[msg.conversation_id] ?? 0) + (msg.author_id !== userId ? 1 : 0),
            }));
          }
        }
      )
      .subscribe();
    return () => {
      (supabase as any).removeChannel(channel);
    };
  }, [userId, activeId]);

  // ---------- ACTIVE CONVERSATION CHANGE ----------
  useEffect(() => {
    if (activeId) loadMessages(activeId);
    else setMessages([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // ---------- SCROLL ----------
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ---------- SEND ----------
  const sendMessage = async () => {
    if (!draft.trim() || !activeId) return;
    const body = draft.trim();
    setDraft("");
    const { error } = await (supabase as any)
      .from("chat_messages")
      .insert({ conversation_id: activeId, author_id: userId, body });
    if (error) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
      setDraft(body);
    }
  };

  // ---------- CREATE DM ----------
  const createDM = async (otherUserId: string) => {
    const partner = profiles[otherUserId];
    const { data: conv, error } = await (supabase as any)
      .from("chat_conversations")
      .insert({ type: "dm", name: partner?.name || partner?.email || "DM", created_by: userId })
      .select("id")
      .single();
    if (error || !conv) {
      toast({ title: "Eroare", description: error?.message, variant: "destructive" });
      return;
    }
    const { error: membersError } = await (supabase as any)
      .from("chat_members")
      .insert([
        { conversation_id: conv.id, user_id: userId },
        { conversation_id: conv.id, user_id: otherUserId },
      ]);
    if (membersError) {
      toast({ title: "Eroare membri chat", description: membersError.message, variant: "destructive" });
      return;
    }
    setNewDmOpen(false);
    await loadConversations();
    setActiveId(conv.id);
  };

  // ---------- CREATE GROUP ----------
  const createGroup = async () => {
    if (!newGroupName.trim() || newGroupMembers.size === 0) {
      toast({ title: "Completează numele și cel puțin un membru", variant: "destructive" });
      return;
    }
    const { data: conv, error } = await (supabase as any)
      .from("chat_conversations")
      .insert({ type: "group", name: newGroupName.trim(), created_by: userId })
      .select("id")
      .single();
    if (error || !conv) {
      toast({ title: "Eroare", description: error?.message, variant: "destructive" });
      return;
    }
    const members = [{ conversation_id: conv.id, user_id: userId }];
    newGroupMembers.forEach((uid) => {
      if (uid !== userId) members.push({ conversation_id: conv.id, user_id: uid });
    });
    await (supabase as any).from("chat_members").insert(members);
    setNewGroupOpen(false);
    setNewGroupName("");
    setNewGroupMembers(new Set());
    await loadConversations();
    setActiveId(conv.id);
  };

  const getConvLabel = (c: Conversation) => {
    if (c.type === "department")
      return `# ${c.name ?? c.department}`;
    if (c.type === "group") return c.name ?? "Grup";
    return c.name || "DM";
  };

  const getConvIcon = (c: Conversation) => {
    if (c.type === "department") return <Hash size={14} />;
    if (c.type === "group") return <Users size={14} />;
    return <UserIcon size={14} />;
  };

  const filtered = useMemo(() => {
    if (filter === "toate") return conversations;
    return conversations.filter((c) => c.type === filter);
  }, [conversations, filter]);

  const allOtherProfiles = Object.values(profiles).filter((p) => p.user_id !== userId);

  const activeConv = conversations.find((c) => c.id === activeId);

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Chat</h1>
        </div>
        <BackToHubButton />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4 h-[calc(100vh-180px)]">
        {/* Sidebar conversații */}
        <Card className="flex flex-col overflow-hidden">
          <div className="p-3 border-b space-y-2">
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => setNewDmOpen(true)}>
                <Plus size={14} className="mr-1" /> DM
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setNewGroupOpen(true)}>
                <Users size={14} className="mr-1" /> Grup
              </Button>
            </div>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
              <TabsList className="grid grid-cols-4 h-8">
                <TabsTrigger value="toate" className="text-xs">Toate</TabsTrigger>
                <TabsTrigger value="dm" className="text-xs">DM</TabsTrigger>
                <TabsTrigger value="group" className="text-xs">Grup</TabsTrigger>
                <TabsTrigger value="department" className="text-xs">Dept.</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <ScrollArea className="flex-1">
            {filtered.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">
                Nicio conversație.
              </div>
            ) : (
              filtered.map((c) => {
                const unread = unreadByConv[c.id] ?? 0;
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={`w-full text-left p-3 border-b hover:bg-accent transition-colors flex items-center gap-2 ${
                      activeId === c.id ? "bg-accent" : ""
                    }`}
                  >
                    {getConvIcon(c)}
                    <span className="flex-1 truncate text-sm">{getConvLabel(c)}</span>
                    {unread > 0 && (
                      <Badge className="bg-red-500 text-white border-0 h-5 min-w-[20px] px-1 text-[10px]">
                        {unread}
                      </Badge>
                    )}
                  </button>
                );
              })
            )}
          </ScrollArea>
        </Card>

        {/* Mesaje */}
        <Card className="flex flex-col overflow-hidden">
          {!activeConv ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Selectează o conversație.
            </div>
          ) : (
            <>
              <div className="p-3 border-b flex items-center gap-2">
                {getConvIcon(activeConv)}
                <span className="font-medium">{getConvLabel(activeConv)}</span>
                <Badge variant="outline" className="text-xs ml-auto">
                  {activeConv.type === "dm"
                    ? "Direct"
                    : activeConv.type === "group"
                    ? "Grup"
                    : "Departament"}
                </Badge>
              </div>
              <ScrollArea className="flex-1 p-4">
                {messages.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    Niciun mesaj încă. Scrie primul!
                  </div>
                ) : (
                  messages.map((m, i) => {
                    const prev = messages[i - 1];
                    const showDay =
                      !prev ||
                      formatDay(prev.created_at) !== formatDay(m.created_at);
                    const isMine = m.author_id === userId;
                    const author = profiles[m.author_id];
                    return (
                      <div key={m.id}>
                        {showDay && (
                          <div className="text-center text-xs text-muted-foreground my-3">
                            {formatDay(m.created_at)}
                          </div>
                        )}
                        <div
                          className={`flex mb-2 ${isMine ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-lg px-3 py-2 ${
                              isMine
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                          >
                            {!isMine && (
                              <div className="text-xs font-medium mb-0.5 opacity-80">
                                {author?.name || author?.email || "Utilizator"}
                              </div>
                            )}
                            <div className="text-sm whitespace-pre-wrap break-words">
                              {m.body}
                            </div>
                            <div className={`text-[10px] mt-1 ${isMine ? "opacity-80" : "text-muted-foreground"}`}>
                              {format(new Date(m.created_at), "HH:mm")}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </ScrollArea>
              <div className="p-3 border-t flex gap-2">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Scrie un mesaj... (Enter trimite, Shift+Enter linie nouă)"
                  rows={2}
                  className="resize-none"
                />
                <Button onClick={sendMessage} disabled={!draft.trim()}>
                  <Send size={16} />
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Dialog DM nou */}
      <Dialog open={newDmOpen} onOpenChange={setNewDmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mesaj direct nou</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-1">
            {allOtherProfiles.length === 0 ? (
              <div className="text-sm text-muted-foreground p-4 text-center">
                Niciun alt utilizator.
              </div>
            ) : (
              allOtherProfiles.map((p) => (
                <button
                  key={p.user_id}
                  onClick={() => createDM(p.user_id)}
                  className="w-full text-left p-3 rounded hover:bg-accent transition-colors flex items-center gap-2"
                >
                  <UserIcon size={14} />
                  <div>
                    <div className="text-sm font-medium">{p.name || p.email}</div>
                    {p.name && (
                      <div className="text-xs text-muted-foreground">{p.email}</div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog grup nou */}
      <Dialog open={newGroupOpen} onOpenChange={setNewGroupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grup nou</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nume grup</Label>
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Ex: Echipa producție tură 1"
              />
            </div>
            <div>
              <Label>Membri ({newGroupMembers.size} aleși)</Label>
              <div className="max-h-60 overflow-y-auto border rounded mt-1">
                {allOtherProfiles.map((p) => {
                  const checked = newGroupMembers.has(p.user_id);
                  return (
                    <label
                      key={p.user_id}
                      className="flex items-center gap-2 p-2 border-b hover:bg-accent cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const s = new Set(newGroupMembers);
                          if (e.target.checked) s.add(p.user_id);
                          else s.delete(p.user_id);
                          setNewGroupMembers(s);
                        }}
                      />
                      <span className="text-sm">{p.name || p.email}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewGroupOpen(false)}>
              Anulează
            </Button>
            <Button onClick={createGroup}>Creează grup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatPage;
