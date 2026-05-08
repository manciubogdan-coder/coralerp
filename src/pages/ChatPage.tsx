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
  kind: "image" | "video" | "file";
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

const makeUploadId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
  const activeConvStorageKey = userId ? `coral:chat:active-conversation:${userId}` : "";
  const pendingStorageKey = (convId: string) => `coral:chat:pending-attachments:${userId}:${convId}`;
  const convClearedKey = (convId: string) => `coral:chat:cleared-at:${userId}:${convId}`;
  const getConvClearedAt = (convId: string): string | null =>
    userId ? window.localStorage.getItem(convClearedKey(convId)) : null;
  const setConvClearedAt = (convId: string, iso: string) => {
    if (userId) window.localStorage.setItem(convClearedKey(convId), iso);
  };

  // Last-read timestamps for other members (used for read receipts in DMs)
  const [memberLastRead, setMemberLastRead] = useState<Record<string, Record<string, string>>>({});

  const selectConversation = (convId: string | null) => {
    setActiveId(convId);
    if (!activeConvStorageKey) return;
    if (convId) window.localStorage.setItem(activeConvStorageKey, convId);
    else window.localStorage.removeItem(activeConvStorageKey);
  };

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
    let list = (data as Message[]) ?? [];
    const clearedAt = getConvClearedAt(convId);
    if (clearedAt) {
      const cutoff = new Date(clearedAt).getTime();
      list = list.filter((m) => new Date(m.created_at).getTime() > cutoff);
    }
    const seenAt = getConvSeen(convId);
    const firstUnread = list.find(
      (m) => m.author_id !== userId && new Date(m.created_at) > new Date(seenAt)
    );
    setActiveUnreadAnchor(firstUnread?.id ?? null);
    setMessages(list);
    markConversationRead(convId);
    // Load other members' last_read_at for read receipts
    const { data: members } = await (supabase as any)
      .from("chat_members")
      .select("user_id,last_read_at")
      .eq("conversation_id", convId);
    const map: Record<string, string> = {};
    (members ?? []).forEach((m: any) => { map[m.user_id] = m.last_read_at; });
    setMemberLastRead((prev) => ({ ...prev, [convId]: map }));
  };

  // ---------- INITIAL LOAD ----------
  useEffect(() => {
    if (!userId) return;
    const isDesktop = typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;
    const savedActiveId = window.localStorage.getItem(activeConvStorageKey);
    // Pe mobil pornim mereu de la lista de conversații (nu auto-deschidem ultima)
    if (savedActiveId && isDesktop) setActiveId(savedActiveId);
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
    if (activeId) {
      window.localStorage.setItem(activeConvStorageKey, activeId);
      const savedPending = window.localStorage.getItem(pendingStorageKey(activeId));
      setPendingAttachments(savedPending ? JSON.parse(savedPending) : []);
      loadMessages(activeId);
    } else {
      setMessages([]);
      setPendingAttachments([]);
      if (activeConvStorageKey) window.localStorage.removeItem(activeConvStorageKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    if (!activeId || !userId) return;
    window.localStorage.setItem(pendingStorageKey(activeId), JSON.stringify(pendingAttachments));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAttachments, activeId, userId]);

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
      const path = `${userId}/${Date.now()}-${makeUploadId()}.${ext}`;
      const { error } = await (supabase as any).storage
        .from("chat-attachments").upload(path, file, { contentType: file.type });
      if (error) {
        toast({ title: "Upload eșuat", description: error.message, variant: "destructive" });
        continue;
      }
      const { data: pub } = (supabase as any).storage.from("chat-attachments").getPublicUrl(path);
      const kind: Attachment["kind"] = file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("video/")
        ? "video"
        : "file";
      out.push({
        url: pub.publicUrl, name: file.name, size: file.size,
        mime: file.type, kind,
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
    window.localStorage.removeItem(pendingStorageKey(convId));

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
    if (activeId === conv.id) selectConversation(null);
    loadConversations();
  };

  // ---------- DELETE CONVERSATION ----------
  const confirmDeleteConv = async () => {
    if (!deleteConvTarget || !userId) return;
    const convId = deleteConvTarget.id;
    const isDept = deleteConvTarget.type === "department";

    // Local cutoff as a safety net while the database action is being applied.
    setConvClearedAt(convId, new Date().toISOString());

    const { error: rpcErr } = await (supabase as any).rpc("chat_delete_conversation", {
      p_conversation_id: convId,
    });

    if (rpcErr) {
      console.warn("Conversation delete RPC failed", rpcErr);
      toast({ title: "Eroare", description: rpcErr.message, variant: "destructive" });
      setDeleteConvTarget(null);
      return;
    }

    const { data: stillExists } = await (supabase as any)
      .from("chat_conversations")
      .select("id")
      .eq("id", convId)
      .maybeSingle();

    if (stillExists && !isDept) {
      const { error: leaveErr } = await (supabase as any)
        .from("chat_members")
        .delete()
        .eq("conversation_id", convId)
        .eq("user_id", userId);
      if (leaveErr) console.warn("Fallback leave conversation failed", leaveErr);
    }

    toast({ title: "Conversație ștearsă", description: "Conversația a fost ștearsă din baza de date." });
    if (activeId === convId) {
      setMessages([]);
      selectConversation(null);
    }
    await loadConversations();
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
    selectConversation(convId as string);
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
    selectConversation(convId as string);
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
    // Fallback: dacă activeId s-a pierdut după ce iOS a reîncărcat pagina,
    // încearcă să-l recuperezi din localStorage.
    let convId = activeId;
    if (!convId && userId) {
      try {
        convId = window.localStorage.getItem(activeConvStorageKey);
        if (convId) setActiveId(convId);
      } catch {}
    }
    if (!convId) {
      toast({ title: "Selectează o conversație", description: "Deschide o conversație înainte să atașezi fișiere.", variant: "destructive" });
      return;
    }
    setPendingFiles((p) => [...p, ...files]);
    setUploadingFiles(true);
    try {
      const uploaded = await uploadAttachments(files);
      setPendingAttachments((a) => {
        const next = [...a, ...uploaded];
        window.localStorage.setItem(pendingStorageKey(convId!), JSON.stringify(next));
        return next;
      });
    } catch (error: any) {
      toast({ title: "Poza nu s-a atașat", description: error?.message ?? "Te rog încearcă din nou.", variant: "destructive" });
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
    <div className="container mx-auto p-2 sm:p-4 space-y-2 sm:space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-6 w-6 text-primary" />
          <h1 className="text-xl sm:text-2xl font-bold">Chat</h1>
        </div>
        <BackToHubButton />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-2 sm:gap-4 h-[calc(100vh-140px)] sm:h-[calc(100vh-180px)]">
        {/* Sidebar */}
        <Card className={`flex flex-col overflow-hidden ${activeId ? "hidden md:flex" : "flex"}`}>
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
                      onClick={() => selectConversation(c.id)}
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
        <Card className={`flex flex-col overflow-hidden ${activeId ? "flex" : "hidden md:flex"}`}>
          {!activeConv ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Selectează o conversație.
            </div>
          ) : (
            <>
              <div className="p-2 sm:p-3 border-b flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="md:hidden h-8 w-8 -ml-1"
                  onClick={() => selectConversation(null)}
                  title="Înapoi"
                >
                  <ArrowLeft size={18} />
                </Button>
                {getConvIcon(activeConv)}
                <span className="font-medium truncate">{getConvLabel(activeConv)}</span>
                <Badge variant="outline" className="text-xs ml-auto hidden sm:inline-flex">
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
                                    ) : a.kind === "video" ? (
                                      <video
                                        key={idx}
                                        src={a.url}
                                        controls
                                        playsInline
                                        className="max-h-60 max-w-full rounded"
                                      />
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
                            <div className={`text-[10px] mt-1 flex items-center gap-1 ${isMine ? "justify-end opacity-90" : "text-muted-foreground"}`}>
                              <span>{format(new Date(m.created_at), "HH:mm")}</span>
                              {isMine && !m.deleted_for_all && (() => {
                                const reads = memberLastRead[m.conversation_id] ?? {};
                                const others = Object.entries(reads).filter(([uid]) => uid !== userId);
                                const msgTime = new Date(m.created_at).getTime();
                                const seenByAll = others.length > 0 && others.every(([, ts]) => ts && new Date(ts).getTime() >= msgTime);
                                const seenByAny = others.some(([, ts]) => ts && new Date(ts).getTime() >= msgTime);
                                const label = seenByAll ? "Citit" : seenByAny ? "Citit de unii" : "Trimis";
                                const color = seenByAll ? "text-sky-300" : "text-primary-foreground/70";
                                return (
                                  <span title={label} className={`inline-flex items-center font-bold tracking-tighter text-xs ${color}`}>
                                    {seenByAny || seenByAll ? "✓✓" : "✓"}
                                  </span>
                                );
                              })()}
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
              {(pendingAttachments.length > 0 || uploadingFiles) && (
                <div className="px-3 pt-2 flex flex-wrap gap-2 border-t">
                  {pendingAttachments.map((a, i) => (
                    <div key={`a-${i}`} className="flex items-center gap-2 bg-muted rounded px-2 py-1 text-xs">
                      {a.kind === "image" ? (
                        <img src={a.url} alt={a.name} className="h-10 w-10 object-cover rounded" />
                      ) : (
                        <FileText size={14} />
                      )}
                      <span className="max-w-[120px] truncate">{a.name}</span>
                      <button
                        onClick={() => setPendingAttachments((p) => p.filter((_, k) => k !== i))}
                        title="Elimină"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {uploadingFiles && (
                    <div className="flex items-center gap-2 bg-muted rounded px-2 py-1 text-xs animate-pulse">
                      <ImageIcon size={14} />
                      <span>Se încarcă...</span>
                    </div>
                  )}
                </div>
              )}

              <div className="p-2 sm:p-3 border-t flex gap-1 sm:gap-2 items-end">
                <input
                  type="file" ref={fileInputRef} className="hidden" multiple
                  accept="image/*,video/*"
                  onChange={handleFileSelect}
                />
                <input
                  type="file" ref={cameraInputRef} className="hidden" multiple
                  accept="image/*,video/*"
                  capture="environment"
                  onChange={handleFileSelect}
                />
                <Button
                  size="icon" variant="ghost"
                  className="h-9 w-9 shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                  title="Atașează poze sau videoclipuri"
                >
                  <Paperclip size={18} />
                </Button>
                <Button
                  size="icon" variant="ghost"
                  className="h-9 w-9 shrink-0 md:hidden"
                  onClick={() => cameraInputRef.current?.click()}
                  title="Cameră"
                >
                  <Camera size={18} />
                </Button>
                <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
                  <PopoverTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" title="Emoji">
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
                  placeholder="Scrie un mesaj..."
                  rows={1}
                  className="resize-none flex-1 min-h-[40px] max-h-32 text-base"
                />
                <Button
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={sendMessage}
                  disabled={(!draft.trim() && pendingAttachments.length === 0) || isSending || uploadingFiles}
                >
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
            <AlertDialogTitle>Ștergi conversația definitiv?</AlertDialogTitle>
            <AlertDialogDescription>
              Conversația „{deleteConvTarget ? getConvLabel(deleteConvTarget) : ""}” va fi ștearsă din baza de date, împreună cu mesajele ei.
              Această acțiune nu poate fi anulată.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteConv} className="bg-destructive hover:bg-destructive/90">
              Șterge definitiv
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
