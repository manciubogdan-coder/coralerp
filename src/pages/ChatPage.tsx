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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { format, isToday, isYesterday } from "date-fns";
import { ro } from "date-fns/locale";
import {
  Plus, Send, MessageSquare, Hash, Users, User as UserIcon,
  Paperclip, Smile, MoreVertical, Trash2, Archive, ArchiveRestore,
  FileText, Download, X, Image as ImageIcon, Camera, ArrowLeft,
} from "lucide-react";
import EmojiPicker, { EmojiStyle, Theme } from "emoji-picker-react";
import BackToHubButton from "@/components/BackToHubButton";
import { DEPARTMENTS } from "@/lib/departments";
import UserAvatar from "@/components/UserAvatar";
import { useTheme } from "@/contexts/ThemeContext";

interface Profile {
  user_id: string;
  name: string | null;
  email: string;
  avatar_url?: string | null;
  display_name?: string | null;
}
interface Attachment {
  url: string;
  name: string;
  size: number;
  mime: string;
  kind: "image" | "file";
}
interface Conversation {
  id: string;
  type: "dm" | "group" | "department";
  name: string | null;
  department: string | null;
  created_by: string | null;
  updated_at: string;
  archived?: boolean;
}
interface Message {
  id: string;
  conversation_id: string;
  author_id: string;
  body: string;
  created_at: string;
  deleted_for_all?: boolean;
  attachments?: Attachment[];
}

const formatDay = (iso: string) => {
  const d = new Date(iso);
  if (isToday(d)) return "Astăzi";
  if (isYesterday(d)) return "Ieri";
  return format(d, "dd MMM yyyy", { locale: ro });
};

const formatBytes = (b: number) => {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

const ChatPage: React.FC = () => {
  const { user } = useAuth();
  const { chatBackground } = useTheme();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [unreadByConv, setUnreadByConv] = useState<Record<string, number>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeUnreadAnchor, setActiveUnreadAnchor] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [filter, setFilter] = useState<"toate" | "dm" | "group" | "department" | "arhivate">("toate");
  const [newDmOpen, setNewDmOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupMembers, setNewGroupMembers] = useState<Set<string>>(new Set());
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Message | null>(null);
  const [deleteMode, setDeleteMode] = useState<"me" | "all">("me");
  const [deleteConvTarget, setDeleteConvTarget] = useState<Conversation | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const userId = user?.id ?? "";

  // ---------- LOAD PROFILES ----------
  const loadProfiles = async () => {
    const { data, error } = await (supabase as any).rpc("chat_list_users");
    if (error) {
      const { data: fallback } = await (supabase as any)
        .from("app_profiles").select("user_id,name,email").order("name");
      const map: Record<string, Profile> = {};
      (fallback ?? []).forEach((p: Profile) => { map[p.user_id] = p; });
      setProfiles(map);
      return;
    }
    const map: Record<string, Profile> = {};
    (data ?? []).forEach((p: Profile) => { map[p.user_id] = p; });
    setProfiles(map);
  };

  // ---------- ENSURE DEPARTMENT CHANNELS ----------
  const ensureDepartmentChannels = async () => {
    if (!userId) return;
    const { data: rolesData } = await (supabase as any)
      .from("app_user_roles").select("role").eq("user_id", userId);
    const userDepts: string[] = (rolesData ?? [])
      .map((r: any) => r.role).filter((r: string) => r !== "admin");
    const deptLabels = Object.fromEntries(
      userDepts.map((dept) => [dept, DEPARTMENTS.find((d) => d.id === dept)?.label ?? dept])
    );
    await (supabase as any).rpc("chat_ensure_department_channels", {
      p_departments: userDepts, p_department_labels: deptLabels,
    });
  };

  // ---------- LOAD CONVERSATIONS ----------
  const loadConversations = async () => {
    if (!userId) return;
    const { data: convs, error } = await (supabase as any).rpc("chat_list_conversations");
    if (error) {
      toast({ title: "Eroare chat", description: error.message, variant: "destructive" });
      setConversations([]);
      return;
    }
    setConversations((convs as Conversation[]) ?? []);
    loadUnreadCounts((convs as Conversation[]) ?? []);
  };

  const convSeenKey = (convId: string) => `coral:chat:conv-seen:${userId}:${convId}`;
  const getConvSeen = (convId: string) =>
    window.localStorage.getItem(convSeenKey(convId)) ?? new Date(0).toISOString();
  const setConvSeen = (convId: string, iso: string) => {
    window.localStorage.setItem(convSeenKey(convId), iso);
  };

  const loadUnreadCounts = async (convs: Conversation[]) => {
    if (!userId || !convs.length) { setUnreadByConv({}); return; }
    const next: Record<string, number> = {};
    await Promise.all(convs.map(async (conv) => {
      if (conv.id === activeId) return;
      const seenAt = getConvSeen(conv.id);
      const { data: rows } = await (supabase as any).rpc("chat_list_messages", { p_conversation_id: conv.id });
      const unread = ((rows as Message[]) ?? []).filter(
        (m) => m.author_id !== userId && new Date(m.created_at) > new Date(seenAt)
      ).length;
      if (unread > 0) next[conv.id] = unread;
    }));
    setUnreadByConv(next);
  };

  const markConversationRead = async (convId: string) => {
    if (!userId) return;
    setConvSeen(convId, new Date().toISOString());
    await (supabase as any).from("chat_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", convId).eq("user_id", userId);
    setUnreadByConv((u) => ({ ...u, [convId]: 0 }));
    window.dispatchEvent(new Event("collaboration-alerts-refresh"));
  };

  // ---------- LOAD MESSAGES ----------
  const loadMessages = async (convId: string) => {
    const { data } = await (supabase as any).rpc("chat_list_messages", { p_conversation_id: convId });
    const list = (data as Message[]) ?? [];
    const seenAt = getConvSeen(convId);
    const firstUnread = list.find(
      (m) => m.author_id !== userId && new Date(m.created_at) > new Date(seenAt)
    );
    setActiveUnreadAnchor(firstUnread?.id ?? null);
    setMessages(list);
    markConversationRead(convId);
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

  // ---------- REALTIME ----------
  useEffect(() => {
    if (!userId) return;
    const channel = (supabase as any)
      .channel("chat-global")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload: any) => {
          const msg = payload.new as Message;
          if (msg.conversation_id === activeId) {
            loadMessages(activeId);
          } else {
            setUnreadByConv((u) => ({
              ...u,
              [msg.conversation_id]: (u[msg.conversation_id] ?? 0) + (msg.author_id !== userId ? 1 : 0),
            }));
            if (msg.author_id !== userId) window.dispatchEvent(new Event("collaboration-alerts-refresh"));
          }
        }
      )
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_messages" },
        () => { if (activeId) loadMessages(activeId); }
      )
      .subscribe();
    return () => { (supabase as any).removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, activeId]);

  useEffect(() => {
    if (activeId) loadMessages(activeId);
    else setMessages([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    if (!activeId) return;
    const interval = window.setInterval(() => {
      loadMessages(activeId);
      loadConversations();
    }, 5000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ---------- UPLOAD ATTACHMENTS ----------
  const uploadAttachments = async (files: File[]): Promise<Attachment[]> => {
    const out: Attachment[] = [];
    for (const file of files) {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error } = await (supabase as any).storage
        .from("chat-attachments").upload(path, file, { contentType: file.type });
      if (error) {
        toast({ title: "Upload eșuat", description: error.message, variant: "destructive" });
        continue;
      }
      const { data: pub } = (supabase as any).storage.from("chat-attachments").getPublicUrl(path);
      out.push({
        url: pub.publicUrl, name: file.name, size: file.size,
        mime: file.type, kind: file.type.startsWith("image/") ? "image" : "file",
      });
    }
    return out;
  };

  // ---------- SEND ----------
  const sendMessage = async () => {
    if ((!draft.trim() && pendingAttachments.length === 0) || !activeId || !userId || isSending || uploadingFiles) return;
    const body = draft.trim();
    const convId = activeId;
    const attachments = pendingAttachments;
    setDraft(""); setPendingAttachments([]); setPendingFiles([]); setIsSending(true);

    const { error } = await (supabase as any).rpc("chat_send_message", {
      p_conversation_id: convId, p_body: body, p_attachments: attachments,
    });
    if (error) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
      setDraft(body); setPendingAttachments(attachments);
    } else {
      await Promise.all([loadMessages(convId), loadConversations()]);
    }
    setIsSending(false);
  };

  // ---------- DELETE MESSAGE ----------
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await (supabase as any).rpc("chat_delete_message", {
      p_message_id: deleteTarget.id, p_for_all: deleteMode === "all",
    });
    if (error) toast({ title: "Eroare", description: error.message, variant: "destructive" });
    setDeleteTarget(null);
    if (activeId) loadMessages(activeId);
  };

  // ---------- ARCHIVE ----------
  const toggleArchive = async (conv: Conversation) => {
    await (supabase as any).rpc("chat_set_archived", {
      p_conversation_id: conv.id, p_archived: !conv.archived,
    });
    if (activeId === conv.id) setActiveId(null);
    loadConversations();
  };

  // ---------- DELETE CONVERSATION (for me) ----------
  const confirmDeleteConv = async () => {
    if (!deleteConvTarget) return;
    const { error } = await (supabase as any).rpc("chat_delete_conversation", {
      p_conversation_id: deleteConvTarget.id,
    });
    if (error) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Conversație ștearsă", description: "A fost eliminată din lista ta." });
      if (activeId === deleteConvTarget.id) setActiveId(null);
      await loadConversations();
    }
    setDeleteConvTarget(null);
  };

  // ---------- CREATE DM ----------
  const createDM = async (otherUserId: string) => {
    const { data: convId, error } = await (supabase as any).rpc("chat_create_dm", {
      p_other_user_id: otherUserId, p_name: null,
    });
    if (error || !convId) {
      toast({ title: "Eroare", description: error?.message ?? "Nu s-a creat conversația", variant: "destructive" });
      return;
    }
    setNewDmOpen(false);
    await loadConversations();
    setActiveId(convId as string);
  };

  // ---------- CREATE GROUP ----------
  const createGroup = async () => {
    if (!newGroupName.trim() || newGroupMembers.size === 0) {
      toast({ title: "Completează numele și cel puțin un membru", variant: "destructive" });
      return;
    }
    const { data: convId, error } = await (supabase as any).rpc("chat_create_group", {
      p_name: newGroupName.trim(), p_member_ids: Array.from(newGroupMembers),
    });
    if (error || !convId) {
      toast({ title: "Eroare", description: error?.message ?? "Nu s-a creat grupul", variant: "destructive" });
      return;
    }
    setNewGroupOpen(false); setNewGroupName(""); setNewGroupMembers(new Set());
    await loadConversations();
    setActiveId(convId as string);
  };

  const insertEmoji = (emoji: string) => {
    setDraft((d) => d + emoji);
    setEmojiOpen(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setPendingFiles((p) => [...p, ...files]);
    setUploadingFiles(true);
    try {
      const uploaded = await uploadAttachments(files);
      setPendingAttachments((a) => [...a, ...uploaded]);
    } finally {
      setUploadingFiles(false);
    }
  };

  const getConvLabel = (c: Conversation) => {
    if (c.type === "department") return `# ${c.name ?? c.department}`;
    if (c.type === "group") return c.name ?? "Grup";
    return c.name || "DM";
  };
  const getConvIcon = (c: Conversation) => {
    if (c.type === "department") return <Hash size={14} />;
    if (c.type === "group") return <Users size={14} />;
    return <UserIcon size={14} />;
  };

  const filtered = useMemo(() => {
    if (filter === "arhivate") return conversations.filter((c) => c.archived);
    const base = conversations.filter((c) => !c.archived);
    if (filter === "toate") return base;
    return base.filter((c) => c.type === filter);
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
        {/* Sidebar */}
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
              <TabsList className="grid grid-cols-5 h-8">
                <TabsTrigger value="toate" className="text-xs">Toate</TabsTrigger>
                <TabsTrigger value="dm" className="text-xs">DM</TabsTrigger>
                <TabsTrigger value="group" className="text-xs">Grup</TabsTrigger>
                <TabsTrigger value="department" className="text-xs">Dept</TabsTrigger>
                <TabsTrigger value="arhivate" className="text-xs">Arh.</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <ScrollArea className="flex-1">
            {filtered.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">Nicio conversație.</div>
            ) : (
              filtered.map((c) => {
                const unread = unreadByConv[c.id] ?? 0;
                // pentru DM extragem celălalt user (din lista de membri o vom afla din profile)
                let dmOther: Profile | undefined;
                if (c.type === "dm") {
                  dmOther = Object.values(profiles).find(
                    (p) => p.user_id !== userId && (p.display_name === c.name || p.name === c.name || p.email === c.name)
                  );
                }
                return (
                  <div
                    key={c.id}
                    className={`group w-full p-3 border-b hover:bg-accent transition-colors flex items-center gap-2 ${
                      activeId === c.id ? "bg-accent" : ""
                    }`}
                  >
                    <button
                      onClick={() => setActiveId(c.id)}
                      className="flex-1 flex items-center gap-2 text-left min-w-0"
                    >
                      {c.type === "dm" ? (
                        <UserAvatar
                          size="sm"
                          name={dmOther?.display_name || dmOther?.name || c.name}
                          email={dmOther?.email}
                          url={dmOther?.avatar_url}
                        />
                      ) : (
                        getConvIcon(c)
                      )}
                      <span className="flex-1 truncate text-sm">{getConvLabel(c)}</span>
                      {unread > 0 && (
                        <Badge className="bg-red-500 text-white border-0 h-5 min-w-[20px] px-1 text-[10px]">
                          {unread}
                        </Badge>
                      )}
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-6 w-6 opacity-60 group-hover:opacity-100">
                          <MoreVertical size={14} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => toggleArchive(c)}>
                          {c.archived ? (
                            <><ArchiveRestore size={14} className="mr-2" /> Dezarhivează</>
                          ) : (
                            <><Archive size={14} className="mr-2" /> Arhivează</>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteConvTarget(c)}
                        >
                          <Trash2 size={14} className="mr-2" /> Șterge conversația
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
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
                  {activeConv.type === "dm" ? "Direct"
                    : activeConv.type === "group" ? "Grup" : "Departament"}
                </Badge>
                <Button size="icon" variant="ghost" onClick={() => toggleArchive(activeConv)} title={activeConv.archived ? "Dezarhivează" : "Arhivează"}>
                  {activeConv.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                </Button>
              </div>
              <ScrollArea
                className="flex-1 p-4"
                style={chatBackground ? { background: chatBackground } : undefined}
              >
                {messages.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    Niciun mesaj încă. Scrie primul!
                  </div>
                ) : (
                  messages.map((m, i) => {
                    const prev = messages[i - 1];
                    const showDay = !prev || formatDay(prev.created_at) !== formatDay(m.created_at);
                    const isMine = m.author_id === userId;
                    const author = profiles[m.author_id];
                    const isUnreadAnchor = m.id === activeUnreadAnchor;
                    const isUnread = !isMine && new Date(m.created_at) > new Date(getConvSeen(m.conversation_id));
                    const atts = (m.attachments ?? []) as Attachment[];

                    return (
                      <div key={m.id}>
                        {showDay && (
                          <div className="text-center text-xs text-muted-foreground my-3">
                            {formatDay(m.created_at)}
                          </div>
                        )}
                        {isUnreadAnchor && (
                          <div className="flex items-center gap-2 my-3">
                            <div className="flex-1 h-px bg-red-500/60" />
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-red-500">
                              Mesaje noi
                            </span>
                            <div className="flex-1 h-px bg-red-500/60" />
                          </div>
                        )}
                        <div className={`group/msg flex mb-2 items-end gap-2 ${isMine ? "justify-end" : "justify-start"}`}>
                          {!isMine && (
                            <UserAvatar
                              size="xs"
                              name={author?.display_name || author?.name}
                              email={author?.email}
                              url={author?.avatar_url}
                              className="mb-1"
                            />
                          )}
                          {isMine && !m.deleted_for_all && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover/msg:opacity-100">
                                  <MoreVertical size={12} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setDeleteTarget(m); setDeleteMode("me"); }}>
                                  <Trash2 size={14} className="mr-2" /> Șterge pentru mine
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => { setDeleteTarget(m); setDeleteMode("all"); }}
                                >
                                  <Trash2 size={14} className="mr-2" /> Șterge pentru toți
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                          <div
                            className={`max-w-[75%] rounded-lg px-3 py-2 ${
                              isMine ? "bg-primary text-primary-foreground" : "bg-card border"
                            } ${isUnread ? "ring-2 ring-red-500/70" : ""} ${m.deleted_for_all ? "italic opacity-70" : ""}`}
                          >
                            {!isMine && (
                              <div className="text-xs font-medium mb-0.5 opacity-80 flex items-center gap-1">
                                {isUnread && <span className="inline-block h-2 w-2 rounded-full bg-red-500" />}
                                {author?.display_name || author?.name || author?.email || "Utilizator"}
                              </div>
                            )}
                            {m.deleted_for_all ? (
                              <div className="text-sm">🚫 Mesaj șters</div>
                            ) : (
                              <>
                                {atts.length > 0 && (
                                  <div className="space-y-2 mb-1">
                                    {atts.map((a, idx) => a.kind === "image" ? (
                                      <button
                                        key={idx}
                                        onClick={() => setImagePreview(a.url)}
                                        className="block max-w-full rounded overflow-hidden"
                                      >
                                        <img src={a.url} alt={a.name} className="max-h-60 object-contain" />
                                      </button>
                                    ) : (
                                      <a
                                        key={idx}
                                        href={a.url} target="_blank" rel="noopener noreferrer" download={a.name}
                                        className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
                                          isMine ? "bg-primary-foreground/20 hover:bg-primary-foreground/30" : "bg-background hover:bg-accent"
                                        }`}
                                      >
                                        <FileText size={16} />
                                        <div className="flex-1 min-w-0">
                                          <div className="truncate font-medium">{a.name}</div>
                                          <div className="opacity-70">{formatBytes(a.size)}</div>
                                        </div>
                                        <Download size={14} />
                                      </a>
                                    ))}
                                  </div>
                                )}
                                {m.body && (
                                  <div className="text-sm whitespace-pre-wrap break-words">{m.body}</div>
                                )}
                              </>
                            )}
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

              {/* Pending attachments preview */}
              {pendingFiles.length > 0 && (
                <div className="px-3 pt-2 flex flex-wrap gap-2 border-t">
                  {pendingFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 bg-muted rounded px-2 py-1 text-xs">
                      {f.type.startsWith("image/") ? <ImageIcon size={14} /> : <FileText size={14} />}
                      <span className="max-w-[150px] truncate">{f.name}</span>
                      <button onClick={() => setPendingFiles((p) => p.filter((_, k) => k !== i))}>
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="p-3 border-t flex gap-2 items-end">
                <input
                  type="file" ref={fileInputRef} className="hidden" multiple
                  onChange={handleFileSelect}
                />
                <Button size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()} title="Atașează">
                  <Paperclip size={18} />
                </Button>
                <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
                  <PopoverTrigger asChild>
                    <Button size="icon" variant="ghost" title="Emoji">
                      <Smile size={18} />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-auto border-0" side="top" align="start">
                    <EmojiPicker
                      onEmojiClick={(e) => insertEmoji(e.emoji)}
                      emojiStyle={EmojiStyle.NATIVE}
                      theme={Theme.AUTO}
                      width={320} height={400}
                      lazyLoadEmojis
                    />
                  </PopoverContent>
                </Popover>
                <Textarea
                  ref={textareaRef}
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
                  className="resize-none flex-1"
                />
                <Button onClick={sendMessage} disabled={(!draft.trim() && pendingFiles.length === 0) || isSending}>
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
          <DialogHeader><DialogTitle>Mesaj direct nou</DialogTitle></DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-1">
            {allOtherProfiles.length === 0 ? (
              <div className="text-sm text-muted-foreground p-4 text-center">Niciun alt utilizator.</div>
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
                    {p.name && <div className="text-xs text-muted-foreground">{p.email}</div>}
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
          <DialogHeader><DialogTitle>Grup nou</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nume grup</Label>
              <Input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Ex: Echipa producție tură 1" />
            </div>
            <div>
              <Label>Membri ({newGroupMembers.size} aleși)</Label>
              <div className="max-h-60 overflow-y-auto border rounded mt-1">
                {allOtherProfiles.map((p) => {
                  const checked = newGroupMembers.has(p.user_id);
                  return (
                    <label key={p.user_id}
                      className="flex items-center gap-2 p-2 border-b hover:bg-accent cursor-pointer">
                      <input type="checkbox" checked={checked}
                        onChange={(e) => {
                          const s = new Set(newGroupMembers);
                          if (e.target.checked) s.add(p.user_id); else s.delete(p.user_id);
                          setNewGroupMembers(s);
                        }} />
                      <span className="text-sm">{p.name || p.email}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewGroupOpen(false)}>Anulează</Button>
            <Button onClick={createGroup}>Creează grup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteMode === "all" ? "Șterge mesajul pentru toți?" : "Șterge mesajul pentru tine?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteMode === "all"
                ? "Mesajul va dispărea pentru toți participanții. Această acțiune nu poate fi anulată."
                : "Mesajul va fi ascuns doar din lista ta. Ceilalți îl vor vedea în continuare."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Șterge</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm delete conversation */}
      <AlertDialog open={!!deleteConvTarget} onOpenChange={(o) => !o && setDeleteConvTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ștergi conversația?</AlertDialogTitle>
            <AlertDialogDescription>
              Conversația „{deleteConvTarget ? getConvLabel(deleteConvTarget) : ""}” va fi eliminată din lista ta.
              Ceilalți participanți o vor vedea în continuare. Dacă primești un mesaj nou aici, conversația va reapărea automat.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteConv} className="bg-destructive hover:bg-destructive/90">
              Șterge pentru mine
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image preview */}
      <Dialog open={!!imagePreview} onOpenChange={(o) => !o && setImagePreview(null)}>
        <DialogContent className="max-w-4xl p-2">
          {imagePreview && (
            <img src={imagePreview} alt="preview" className="w-full h-auto max-h-[80vh] object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatPage;
