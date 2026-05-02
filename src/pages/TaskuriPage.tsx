import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { format, isPast, isToday, addDays, addWeeks, addMonths, differenceInHours } from "date-fns";
import { ro } from "date-fns/locale";
import {
  Plus,
  Calendar as CalendarIcon,
  Clock,
  AlertTriangle,
  Pencil,
  Trash2,
  CheckSquare,
  MessageSquare,
  RefreshCw,
  CheckCircle2,
  CircleDashed,
  CalendarClock,
  CalendarOff,
  Filter,
  X,
} from "lucide-react";
import BackToHubButton from "@/components/BackToHubButton";
import { DEPARTMENTS } from "@/lib/departments";

interface Profile {
  user_id: string;
  name: string | null;
  email: string;
}
interface Task {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  deadline: string | null;
  reminder_at: string | null;
  department: string | null;
  tags: string[];
  created_by: string;
  assigned_to: string | null;
  recurrence: "none" | "daily" | "weekly" | "monthly";
  recurrence_until: string | null;
  position: number;
  completed_at: string | null;
  created_at: string;
}
interface ChecklistItem {
  id: string;
  task_id: string;
  label: string;
  done: boolean;
  position: number;
}
interface Comment {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

const STATUS_COLS: { key: Task["status"]; label: string; color: string }[] = [
  { key: "todo", label: "De făcut", color: "border-slate-400" },
  { key: "in_progress", label: "În lucru", color: "border-blue-500" },
  { key: "done", label: "Finalizate", color: "border-green-500" },
];

const PRIO_COLOR: Record<string, string> = {
  low: "bg-slate-400",
  medium: "bg-yellow-500",
  high: "bg-orange-500",
  urgent: "bg-red-500",
};
const PRIO_LABEL: Record<string, string> = {
  low: "Joasă",
  medium: "Medie",
  high: "Înaltă",
  urgent: "Urgentă",
};

const toLocalInput = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (s: string) => (s ? new Date(s).toISOString() : null);

const TaskuriPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id ?? "";

  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState<"mine" | "assigned_to_me" | "all">("assigned_to_me");
  const [search, setSearch] = useState("");

  // Filtre profi
  type DeadlineFilter = "all" | "overdue" | "today" | "soon" | "upcoming" | "no_deadline" | "completed";
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  // dialog editare
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [deadline, setDeadline] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [department, setDepartment] = useState<string>("none");
  const [assignedTo, setAssignedTo] = useState<string>("self");
  const [recurrence, setRecurrence] = useState<Task["recurrence"]>("none");
  const [tagsInput, setTagsInput] = useState("");

  // detalii: checklist + comentarii
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newCheckLabel, setNewCheckLabel] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");

  // ---------- LOAD ----------
  const loadProfiles = async () => {
    const { data } = await (supabase as any)
      .from("app_profiles")
      .select("user_id,name,email")
      .order("name");
    const map: Record<string, Profile> = {};
    (data ?? []).forEach((p: Profile) => (map[p.user_id] = p));
    setProfiles(map);
  };

  const loadTasks = async () => {
    const { data } = await (supabase as any)
      .from("app_tasks")
      .select("*")
      .order("position", { ascending: true })
      .order("created_at", { ascending: false });
    setTasks((data as Task[]) ?? []);
  };

  useEffect(() => {
    if (!userId) return;
    loadProfiles();
    loadTasks();
    const channel = (supabase as any)
      .channel("tasks-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_tasks" },
        () => {
          loadTasks();
          window.dispatchEvent(new Event("collaboration-alerts-refresh"));
        }
      )
      .subscribe();
    const interval = window.setInterval(loadTasks, 10000);
    return () => {
      window.clearInterval(interval);
      (supabase as any).removeChannel(channel);
    };
  }, [userId]);

  // ---------- FILTRARE ----------
  // Bază: aplicăm view + search (folosit și pentru numărarea chip-urilor)
  const baseFiltered = useMemo(() => {
    let arr = tasks;
    if (view === "mine") arr = arr.filter((t) => t.created_by === userId);
    else if (view === "assigned_to_me")
      arr = arr.filter((t) => t.assigned_to === userId);
    if (search.trim()) {
      const s = search.toLowerCase();
      arr = arr.filter(
        (t) =>
          t.title.toLowerCase().includes(s) ||
          (t.description ?? "").toLowerCase().includes(s) ||
          t.tags.some((tag) => tag.toLowerCase().includes(s))
      );
    }
    return arr;
  }, [tasks, view, userId, search]);

  // Helper pentru bucket-ul de deadline al unui task
  const matchDeadline = (t: Task, f: DeadlineFilter): boolean => {
    if (f === "all") return true;
    if (f === "completed") return t.status === "done";
    // celelalte bucket-uri exclud taskurile finalizate
    if (t.status === "done") return false;
    if (f === "no_deadline") return !t.deadline;
    if (!t.deadline) return false;
    const d = new Date(t.deadline);
    const now = new Date();
    if (f === "overdue") return isPast(d) && !isToday(d);
    if (f === "today") return isToday(d);
    if (f === "soon") {
      // în următoarele 24h dar nu azi
      const h = differenceInHours(d, now);
      return h > 0 && h <= 48 && !isToday(d);
    }
    if (f === "upcoming") {
      // în 3-7 zile
      const h = differenceInHours(d, now);
      return h > 48 && h <= 24 * 7;
    }
    return true;
  };

  // Numărători pentru chip-uri (pe baseFiltered, fără filtrele suplimentare)
  const counts = useMemo(() => {
    const c = {
      all: baseFiltered.length,
      overdue: 0,
      today: 0,
      soon: 0,
      upcoming: 0,
      no_deadline: 0,
      completed: 0,
    };
    baseFiltered.forEach((t) => {
      if (matchDeadline(t, "overdue")) c.overdue++;
      if (matchDeadline(t, "today")) c.today++;
      if (matchDeadline(t, "soon")) c.soon++;
      if (matchDeadline(t, "upcoming")) c.upcoming++;
      if (matchDeadline(t, "no_deadline")) c.no_deadline++;
      if (matchDeadline(t, "completed")) c.completed++;
    });
    return c;
  }, [baseFiltered]);

  const filtered = useMemo(() => {
    return baseFiltered.filter((t) => {
      if (!matchDeadline(t, deadlineFilter)) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (departmentFilter !== "all" && (t.department ?? "none") !== departmentFilter) return false;
      if (assigneeFilter !== "all") {
        if (assigneeFilter === "unassigned" && t.assigned_to) return false;
        if (assigneeFilter !== "unassigned" && t.assigned_to !== assigneeFilter) return false;
      }
      return true;
    });
  }, [baseFiltered, deadlineFilter, priorityFilter, departmentFilter, assigneeFilter]);

  const activeFiltersCount =
    (deadlineFilter !== "all" ? 1 : 0) +
    (priorityFilter !== "all" ? 1 : 0) +
    (departmentFilter !== "all" ? 1 : 0) +
    (assigneeFilter !== "all" ? 1 : 0);

  const clearFilters = () => {
    setDeadlineFilter("all");
    setPriorityFilter("all");
    setDepartmentFilter("all");
    setAssigneeFilter("all");
  };

  const byStatus = useMemo(() => {
    const m: Record<Task["status"], Task[]> = { todo: [], in_progress: [], done: [] };
    filtered.forEach((t) => m[t.status].push(t));
    return m;
  }, [filtered]);

  // ---------- DIALOG ----------
  const reset = () => {
    setEditing(null);
    setTitle("");
    setDescription("");
    setPriority("medium");
    setDeadline("");
    setReminderAt("");
    setDepartment("none");
    setAssignedTo("self");
    setRecurrence("none");
    setTagsInput("");
  };

  const openNew = () => {
    reset();
    setOpen(true);
  };
  const openEdit = (t: Task) => {
    setEditing(t);
    setTitle(t.title);
    setDescription(t.description ?? "");
    setPriority(t.priority);
    setDeadline(toLocalInput(t.deadline));
    setReminderAt(toLocalInput(t.reminder_at));
    setDepartment(t.department ?? "none");
    setAssignedTo(t.assigned_to ?? "self");
    setRecurrence(t.recurrence);
    setTagsInput((t.tags ?? []).join(", "));
    setOpen(true);
  };

  const save = async () => {
    if (!title.trim()) {
      toast({ title: "Titlu obligatoriu", variant: "destructive" });
      return;
    }
    const finalAssignee = assignedTo === "self" ? userId : assignedTo;
    const payload: any = {
      title: title.trim(),
      description: description.trim() || null,
      priority,
      deadline: fromLocalInput(deadline),
      reminder_at: fromLocalInput(reminderAt),
      department: department === "none" ? null : department,
      assigned_to: finalAssignee || null,
      recurrence,
      tags: tagsInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      updated_at: new Date().toISOString(),
    };

    let res: any;
    if (editing) {
      res = await (supabase as any)
        .from("app_tasks")
        .update(payload)
        .eq("id", editing.id);
    } else {
      payload.created_by = userId;
      res = await (supabase as any).from("app_tasks").insert(payload).select("id").single();
    }
    if (res.error) {
      toast({ title: "Eroare", description: res.error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Task actualizat" : "Task creat" });

    setOpen(false);
    reset();
    loadTasks();
    window.dispatchEvent(new Event("collaboration-alerts-refresh"));
  };

  const remove = async (t: Task) => {
    if (!confirm(`Ștergi task-ul "${t.title}"?`)) return;
    const { error } = await (supabase as any).from("app_tasks").delete().eq("id", t.id);
    if (error) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Task șters" });
    loadTasks();
  };

  const moveTo = async (t: Task, status: Task["status"]) => {
    const updates: any = { status, updated_at: new Date().toISOString() };
    if (status === "done") {
      updates.completed_at = new Date().toISOString();
      // taskuri recurente — generează următorul
      if (t.recurrence !== "none") {
        let nextDeadline: Date | null = null;
        if (t.deadline) {
          const d = new Date(t.deadline);
          if (t.recurrence === "daily") nextDeadline = addDays(d, 1);
          else if (t.recurrence === "weekly") nextDeadline = addWeeks(d, 1);
          else if (t.recurrence === "monthly") nextDeadline = addMonths(d, 1);
        }
        const limit = t.recurrence_until ? new Date(t.recurrence_until) : null;
        if (!limit || (nextDeadline && nextDeadline <= limit)) {
          await (supabase as any).from("app_tasks").insert({
            title: t.title,
            description: t.description,
            priority: t.priority,
            deadline: nextDeadline?.toISOString() ?? null,
            department: t.department,
            tags: t.tags,
            created_by: t.created_by,
            assigned_to: t.assigned_to,
            recurrence: t.recurrence,
            recurrence_until: t.recurrence_until,
          });
        }
      }
    } else {
      updates.completed_at = null;
    }
    await (supabase as any).from("app_tasks").update(updates).eq("id", t.id);
    loadTasks();
    window.dispatchEvent(new Event("collaboration-alerts-refresh"));
  };

  // ---------- DETAILS (checklist + comments) ----------
  const openDetails = async (taskId: string) => {
    setDetailTaskId(taskId);
    const [{ data: cl }, { data: cm }] = await Promise.all([
      (supabase as any)
        .from("app_task_checklist")
        .select("*")
        .eq("task_id", taskId)
        .order("position"),
      (supabase as any)
        .from("app_task_comments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at"),
    ]);
    setChecklist((cl as ChecklistItem[]) ?? []);
    setComments((cm as Comment[]) ?? []);
  };

  const addCheckItem = async () => {
    if (!newCheckLabel.trim() || !detailTaskId) return;
    await (supabase as any).from("app_task_checklist").insert({
      task_id: detailTaskId,
      label: newCheckLabel.trim(),
      position: checklist.length,
    });
    await (supabase as any).from("app_tasks").update({ updated_at: new Date().toISOString() }).eq("id", detailTaskId);
    setNewCheckLabel("");
    openDetails(detailTaskId);
    window.dispatchEvent(new Event("collaboration-alerts-refresh"));
  };
  const toggleCheck = async (item: ChecklistItem) => {
    await (supabase as any)
      .from("app_task_checklist")
      .update({ done: !item.done })
      .eq("id", item.id);
    await (supabase as any).from("app_tasks").update({ updated_at: new Date().toISOString() }).eq("id", item.task_id);
    openDetails(detailTaskId!);
    window.dispatchEvent(new Event("collaboration-alerts-refresh"));
  };
  const removeCheck = async (id: string) => {
    await (supabase as any).from("app_task_checklist").delete().eq("id", id);
    if (detailTaskId) {
      await (supabase as any).from("app_tasks").update({ updated_at: new Date().toISOString() }).eq("id", detailTaskId);
    }
    openDetails(detailTaskId!);
    window.dispatchEvent(new Event("collaboration-alerts-refresh"));
  };

  const addComment = async () => {
    if (!newComment.trim() || !detailTaskId) return;
    await (supabase as any).from("app_task_comments").insert({
      task_id: detailTaskId,
      author_id: userId,
      body: newComment.trim(),
    });
    await (supabase as any).from("app_tasks").update({ updated_at: new Date().toISOString() }).eq("id", detailTaskId);
    setNewComment("");
    openDetails(detailTaskId);
    window.dispatchEvent(new Event("collaboration-alerts-refresh"));
  };

  // ---------- DRAG & DROP (HTML5) ----------
  const onDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("text/plain", taskId);
  };
  const onDrop = async (e: React.DragEvent, status: Task["status"]) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");
    const t = tasks.find((x) => x.id === taskId);
    if (t && t.status !== status) await moveTo(t, status);
  };

  const allUsers = Object.values(profiles);
  const detailTask = tasks.find((t) => t.id === detailTaskId);

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <CheckSquare className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Taskuri</h1>
        </div>
        <div className="flex items-center gap-2">
          <BackToHubButton />
          <Button onClick={openNew}>
            <Plus size={16} className="mr-1" /> Task nou
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <Tabs value={view} onValueChange={(v) => setView(v as any)}>
          <TabsList>
            <TabsTrigger value="assigned_to_me">Atribuite mie</TabsTrigger>
            <TabsTrigger value="mine">Create de mine</TabsTrigger>
            <TabsTrigger value="all">Toate</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          className="w-64"
          placeholder="Caută în titlu, descriere, tag..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* KANBAN */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STATUS_COLS.map((col) => (
          <div
            key={col.key}
            className={`rounded-lg border-t-4 ${col.color} bg-muted/30 min-h-[400px]`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDrop(e, col.key)}
          >
            <div className="p-3 border-b flex items-center justify-between bg-background rounded-t-lg">
              <span className="font-medium">{col.label}</span>
              <Badge variant="secondary">{byStatus[col.key].length}</Badge>
            </div>
            <div className="p-2 space-y-2">
              {byStatus[col.key].length === 0 && (
                <div className="text-center text-xs text-muted-foreground py-8">
                  Niciun task
                </div>
              )}
              {byStatus[col.key].map((t) => {
                const overdue =
                  t.deadline && t.status !== "done" && isPast(new Date(t.deadline));
                const assignee = t.assigned_to ? profiles[t.assigned_to] : null;
                return (
                  <Card
                    key={t.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, t.id)}
                    className={`cursor-move hover:shadow-md transition-shadow ${
                      overdue ? "border-red-400" : ""
                    }`}
                  >
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <div
                          className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${PRIO_COLOR[t.priority]}`}
                          title={PRIO_LABEL[t.priority]}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{t.title}</div>
                          {t.description && (
                            <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                              {t.description}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 text-[10px]">
                        {t.deadline && (
                          <Badge
                            variant="outline"
                            className={overdue ? "border-red-500 text-red-700" : ""}
                          >
                            <CalendarIcon size={10} className="mr-1" />
                            {format(new Date(t.deadline), "dd MMM HH:mm", { locale: ro })}
                          </Badge>
                        )}
                        {t.recurrence !== "none" && (
                          <Badge variant="outline">
                            <RefreshCw size={10} className="mr-1" />
                            {t.recurrence}
                          </Badge>
                        )}
                        {t.department && (
                          <Badge variant="secondary">{t.department}</Badge>
                        )}
                        {t.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="bg-accent">
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <div className="text-[10px] text-muted-foreground">
                          {assignee?.name || assignee?.email || "Neatribuit"}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openDetails(t.id)}>
                            <MessageSquare size={12} />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(t)}>
                            <Pencil size={12} />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => remove(t)}>
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* DIALOG EDITARE */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-3 border-b">
            <DialogTitle>{editing ? "Editare task" : "Task nou"}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto p-6 space-y-3">
            <div>
              <Label>Titlu *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label>Descriere</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prioritate</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Joasă</SelectItem>
                    <SelectItem value="medium">Medie</SelectItem>
                    <SelectItem value="high">Înaltă</SelectItem>
                    <SelectItem value="urgent">Urgentă</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Recurență</Label>
                <Select value={recurrence} onValueChange={(v) => setRecurrence(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Fără</SelectItem>
                    <SelectItem value="daily">Zilnic</SelectItem>
                    <SelectItem value="weekly">Săptămânal</SelectItem>
                    <SelectItem value="monthly">Lunar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Deadline</Label>
                <Input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
              <div>
                <Label>Reminder</Label>
                <Input
                  type="datetime-local"
                  value={reminderAt}
                  onChange={(e) => setReminderAt(e.target.value)}
                />
              </div>
              <div>
                <Label>Departament</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Niciunul —</SelectItem>
                    {DEPARTMENTS.map((d, i) => (
                      <SelectItem key={`${d.id}-${i}`} value={d.id}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Atribuit lui</Label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72 overflow-y-auto">
                    <SelectItem value="self">Mie</SelectItem>
                    {allUsers
                      .filter((u) => u.user_id !== userId)
                      .map((u) => (
                        <SelectItem key={u.user_id} value={u.user_id}>
                          {u.name || u.email}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Tag-uri (separate prin virgulă)</Label>
              <Input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="ex: urgent, calitate, sef"
              />
            </div>
          </div>
          <DialogFooter className="p-6 pt-3 border-t">
            <Button variant="outline" onClick={() => setOpen(false)}>Anulează</Button>
            <Button onClick={save}>Salvează</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG DETALII */}
      <Dialog open={!!detailTaskId} onOpenChange={(o) => !o && setDetailTaskId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-3 border-b">
            <DialogTitle>{detailTask?.title}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto p-6 space-y-4">
            {detailTask?.description && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {detailTask.description}
              </p>
            )}

            {/* CHECKLIST */}
            <div>
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <CheckSquare size={16} /> Checklist
              </h3>
              <div className="space-y-1">
                {checklist.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => toggleCheck(item)}
                    />
                    <span className={`flex-1 text-sm ${item.done ? "line-through text-muted-foreground" : ""}`}>
                      {item.label}
                    </span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeCheck(item.id)}>
                      <Trash2 size={12} />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Adaugă subtask..."
                    value={newCheckLabel}
                    onChange={(e) => setNewCheckLabel(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCheckItem()}
                  />
                  <Button size="sm" onClick={addCheckItem}>
                    <Plus size={14} />
                  </Button>
                </div>
              </div>
            </div>

            {/* COMENTARII */}
            <div>
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <MessageSquare size={16} /> Comentarii
              </h3>
              <div className="space-y-2">
                {comments.map((c) => (
                  <div key={c.id} className="border rounded p-2">
                    <div className="text-xs font-medium">
                      {profiles[c.author_id]?.name || profiles[c.author_id]?.email || "Utilizator"}
                      <span className="text-muted-foreground ml-2 font-normal">
                        {format(new Date(c.created_at), "dd MMM HH:mm", { locale: ro })}
                      </span>
                    </div>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{c.body}</p>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Textarea
                    rows={2}
                    placeholder="Scrie un comentariu..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <Button onClick={addComment}>Trimite</Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TaskuriPage;
