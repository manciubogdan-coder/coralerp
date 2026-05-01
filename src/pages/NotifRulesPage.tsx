import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Bell } from "lucide-react";
import BackToHubButton from "@/components/BackToHubButton";
import { DEPARTMENTS } from "@/lib/departments";

interface EventDef {
  event_key: string;
  label: string;
  description: string | null;
}
interface Rule {
  id: string;
  event_key: string;
  target_department: string | null;
  target_user_id: string | null;
  title_template: string;
  body_template: string | null;
  enabled: boolean;
}
interface Profile {
  user_id: string;
  name: string | null;
  email: string;
}

const NotifRulesPage: React.FC = () => {
  const { toast } = useToast();
  const [events, setEvents] = useState<EventDef[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [eventKey, setEventKey] = useState("");
  const [targetType, setTargetType] = useState<"department" | "user" | "users">("department");
  const [targetDept, setTargetDept] = useState("");
  const [targetUser, setTargetUser] = useState("");
  const [targetUsers, setTargetUsers] = useState<string[]>([]);
  const [titleTpl, setTitleTpl] = useState("");
  const [bodyTpl, setBodyTpl] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [userFilter, setUserFilter] = useState("");

  const load = async () => {
    const [{ data: ev }, { data: rl }, { data: pr }] = await Promise.all([
      (supabase as any).from("notif_events_catalog").select("*").order("event_key"),
      (supabase as any).from("notif_rules").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("app_profiles").select("user_id,name,email").order("name"),
    ]);
    setEvents((ev as EventDef[]) ?? []);
    setRules((rl as Rule[]) ?? []);
    setProfiles((pr as Profile[]) ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const reset = () => {
    setEditing(null);
    setEventKey("");
    setTargetType("department");
    setTargetDept("");
    setTargetUser("");
    setTargetUsers([]);
    setTitleTpl("");
    setBodyTpl("");
    setEnabled(true);
    setUserFilter("");
  };

  const openNew = () => {
    reset();
    setOpen(true);
  };
  const openEdit = (r: Rule) => {
    setEditing(r);
    setEventKey(r.event_key);
    setTargetType(r.target_department ? "department" : "user");
    setTargetDept(r.target_department ?? "");
    setTargetUser(r.target_user_id ?? "");
    setTitleTpl(r.title_template);
    setBodyTpl(r.body_template ?? "");
    setEnabled(r.enabled);
    setOpen(true);
  };

  const save = async () => {
    if (!eventKey || !titleTpl.trim()) {
      toast({ title: "Eveniment și titlu obligatorii", variant: "destructive" });
      return;
    }
    if (targetType === "department" && !targetDept) {
      toast({ title: "Selectează un departament", variant: "destructive" });
      return;
    }
    if (targetType === "user" && !targetUser) {
      toast({ title: "Selectează un utilizator", variant: "destructive" });
      return;
    }
    if (targetType === "users" && targetUsers.length === 0) {
      toast({ title: "Selectează cel puțin un utilizator", variant: "destructive" });
      return;
    }

    if (targetType === "users" && !editing) {
      // Creează câte o regulă pentru fiecare user selectat
      const rows = targetUsers.map((uid) => ({
        event_key: eventKey,
        target_department: null,
        target_user_id: uid,
        title_template: titleTpl.trim(),
        body_template: bodyTpl.trim() || null,
        enabled,
      }));
      const res = await (supabase as any).from("notif_rules").insert(rows);
      if (res.error) {
        toast({ title: "Eroare", description: res.error.message, variant: "destructive" });
        return;
      }
      toast({ title: `${rows.length} reguli create` });
      setOpen(false);
      reset();
      load();
      return;
    }

    const payload: any = {
      event_key: eventKey,
      target_department: targetType === "department" ? targetDept : null,
      target_user_id: targetType === "user" ? targetUser : null,
      title_template: titleTpl.trim(),
      body_template: bodyTpl.trim() || null,
      enabled,
    };
    const res = editing
      ? await (supabase as any).from("notif_rules").update(payload).eq("id", editing.id)
      : await (supabase as any).from("notif_rules").insert(payload);
    if (res.error) {
      toast({ title: "Eroare", description: res.error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Regulă actualizată" : "Regulă creată" });
    setOpen(false);
    reset();
    load();
  };

  const toggleEnabled = async (r: Rule) => {
    await (supabase as any)
      .from("notif_rules")
      .update({ enabled: !r.enabled })
      .eq("id", r.id);
    load();
  };

  const remove = async (r: Rule) => {
    if (!confirm("Ștergi această regulă?")) return;
    await (supabase as any).from("notif_rules").delete().eq("id", r.id);
    load();
  };

  const eventLabel = (key: string) =>
    events.find((e) => e.event_key === key)?.label ?? key;
  const userName = (uid: string | null) => {
    if (!uid) return "-";
    const p = profiles.find((x) => x.user_id === uid);
    return p?.name || p?.email || uid;
  };
  const deptLabel = (key: string | null) => {
    if (!key) return "-";
    return DEPARTMENTS.find((d) => d.id === key)?.label ?? key;
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Reguli notificări</h1>
            <p className="text-sm text-muted-foreground">
              Definește cine primește notificări automate la fiecare eveniment.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <BackToHubButton />
          <Button onClick={openNew}>
            <Plus size={16} className="mr-1" /> Regulă nouă
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evenimente disponibile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            {events.map((e) => (
              <div key={e.event_key} className="border rounded p-2">
                <div className="font-medium">{e.label}</div>
                <code className="text-xs text-muted-foreground">{e.event_key}</code>
                {e.description && (
                  <div className="text-xs text-muted-foreground mt-1">{e.description}</div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reguli active</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Activ</TableHead>
                  <TableHead>Eveniment</TableHead>
                  <TableHead>Destinatar</TableHead>
                  <TableHead>Titlu notificare</TableHead>
                  <TableHead className="text-right">Acțiuni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Nicio regulă configurată.
                    </TableCell>
                  </TableRow>
                )}
                {rules.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Switch checked={r.enabled} onCheckedChange={() => toggleEnabled(r)} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{eventLabel(r.event_key)}</Badge>
                    </TableCell>
                    <TableCell>
                      {r.target_department ? (
                        <Badge>Dept: {deptLabel(r.target_department)}</Badge>
                      ) : (
                        <Badge variant="secondary">User: {userName(r.target_user_id)}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-sm truncate">{r.title_template}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(r)}>
                        <Pencil size={14} />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(r)}>
                        <Trash2 size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editare regulă" : "Regulă nouă"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Eveniment *</Label>
              <Select value={eventKey} onValueChange={setEventKey}>
                <SelectTrigger><SelectValue placeholder="Alege evenimentul" /></SelectTrigger>
                <SelectContent className="max-h-72 overflow-y-auto">
                  {events.map((e) => (
                    <SelectItem key={e.event_key} value={e.event_key}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tip destinatar</Label>
              <Select value={targetType} onValueChange={(v) => setTargetType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="department">Departament (toți userii)</SelectItem>
                  <SelectItem value="user">Utilizator specific</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {targetType === "department" ? (
              <div>
                <Label>Departament *</Label>
                <Select value={targetDept} onValueChange={setTargetDept}>
                  <SelectTrigger><SelectValue placeholder="Alege departamentul" /></SelectTrigger>
                  <SelectContent className="max-h-72 overflow-y-auto">
                    {DEPARTMENTS.map((d, i) => (
                      <SelectItem key={`${d.id}-${i}`} value={d.id}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label>Utilizator *</Label>
                <Select value={targetUser} onValueChange={setTargetUser}>
                  <SelectTrigger><SelectValue placeholder="Alege utilizatorul" /></SelectTrigger>
                  <SelectContent className="max-h-72 overflow-y-auto">
                    {profiles.map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>
                        {p.name || p.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Titlu notificare *</Label>
              <Input
                value={titleTpl}
                onChange={(e) => setTitleTpl(e.target.value)}
                placeholder="Ex: Recepție gata - poți face calitatea"
              />
            </div>
            <div>
              <Label>Mesaj (opțional)</Label>
              <Textarea
                value={bodyTpl}
                onChange={(e) => setBodyTpl(e.target.value)}
                rows={2}
                placeholder="Detalii suplimentare"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={enabled} onCheckedChange={setEnabled} />
              <Label>Activă</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Anulează</Button>
            <Button onClick={save}>Salvează</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NotifRulesPage;
