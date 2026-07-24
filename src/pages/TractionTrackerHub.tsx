import React, { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, Target, LayoutDashboard, User, Users, Plus, Trash2, Save, ChevronDown, ChevronRight, Pencil, CheckCircle2, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import BackToHubButton from "@/components/BackToHubButton";
import { supabaseCloud } from "@/integrations/supabase/cloudClient";
import { useAuth } from "@/contexts/AuthContext";
import { useTractionTrackerAccess } from "@/hooks/use-traction-tracker-access";

type Tracker = {
  id: string;
  owner_id: string;
  owner_email: string | null;
  owner_name: string | null;
  department: string;
  name: string;
  period_type: string;
};

type Strategic = {
  id: string;
  tracker_id: string;
  title: string;
  description: string | null;
  year: number | null;
  order_index: number;
  completed_at?: string | null;
};

type Kpi = {
  id: string;
  strategic_id: string;
  name: string;
  unit: string | null;
  target_value: number | null;
  target_operator: "gte" | "lte" | "eq" | string;
  threshold_green: number | null;
  threshold_yellow: number | null;
  order_index: number;
  completed_at?: string | null;
};

type KpiValue = {
  id: string;
  kpi_id: string;
  period_label: string;
  period_start: string | null;
  value: number | null;
  notes: string | null;
};

type OpTask = {
  id: string;
  tracker_id: string;
  kpi_id: string | null;
  title: string;
  action: string | null;
  deadline: string | null;
  status: string;
  period_label: string | null;
  order_index: number;
  completed_at?: string | null;
};

type ProgressLog = {
  id: string;
  parent_id: string; // strategic_id sau operational_id
  period_label: string | null;
  period_start: string | null;
  progress: number | null;
  status: Status | null;
  notes: string | null;
  created_at?: string;
};

type Status = "green" | "yellow" | "red" | "unset";

const DEPARTMENT_OPTIONS = [
  "Achiziții",
  "Vânzări",
  "Calitate",
  "Producție",
  "Depozit",
  "Financiar",
  "Administrativ",
  "Altul",
];

const PERIOD_TYPES: Record<string, string> = {
  weekly: "Săptămânal",
  monthly: "Lunar",
  quarterly: "Trimestrial",
};

function statusForValue(kpi: Kpi, value: number | null | undefined): Status {
  if (value === null || value === undefined || Number.isNaN(value)) return "unset";
  const target = kpi.target_value;
  if (target === null || target === undefined) return "unset";
  const op = kpi.target_operator || "gte";

  // Ratio vs target: 1 = perfect. For lte, we invert.
  let ratio: number;
  if (op === "gte") ratio = target === 0 ? (value >= 0 ? 1 : 0) : value / target;
  else if (op === "lte") ratio = value === 0 ? 1 : target / value;
  else ratio = Math.abs(value - target) < 1e-9 ? 1 : 0;

  const green = kpi.threshold_green ?? 1;
  const yellow = kpi.threshold_yellow ?? 0.8;
  if (ratio >= green) return "green";
  if (ratio >= yellow) return "yellow";
  return "red";
}


const STATUS_COLORS: Record<Status, string> = {
  green: "hsl(142 71% 45%)",
  yellow: "hsl(45 93% 55%)",
  red: "hsl(0 84% 60%)",
  unset: "hsl(220 9% 65%)",
};

function statusForProgress(pct: number | null | undefined): Status {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return "unset";
  if (pct >= 80) return "green";
  if (pct >= 50) return "yellow";
  return "red";
}

function latestOf<T extends { period_start?: string | null; period_label?: string | null; created_at?: string }>(rows: T[]): T | undefined {
  if (!rows.length) return undefined;
  return [...rows].sort((a, b) => {
    const ka = a.period_start || a.period_label || a.created_at || "";
    const kb = b.period_start || b.period_label || b.created_at || "";
    return kb > ka ? 1 : -1;
  })[0];
}

const TractionTrackerHub: React.FC = () => {
  const { user, isAdmin, profile } = useAuth();
  const { allowed, loading: accessLoading } = useTractionTrackerAccess();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [strategics, setStrategics] = useState<Strategic[]>([]);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [values, setValues] = useState<KpiValue[]>([]);
  const [tasks, setTasks] = useState<OpTask[]>([]);
  const [stratProgress, setStratProgress] = useState<ProgressLog[]>([]);
  const [opProgress, setOpProgress] = useState<ProgressLog[]>([]);
  const [tab, setTab] = useState("dashboard");
  const [viewedTrackerId, setViewedTrackerId] = useState<string | null>(null);

  const fetchAll = async () => {
    const [tr, so, kp, kv, to, sp, op] = await Promise.all([
      supabaseCloud.from("traction_trackers").select("*").order("created_at", { ascending: true }),
      supabaseCloud.from("traction_strategic_objectives").select("*").order("order_index"),
      supabaseCloud.from("traction_kpis").select("*").order("order_index"),
      supabaseCloud.from("traction_kpi_values").select("*").order("period_start", { ascending: false }),
      supabaseCloud.from("traction_operational_objectives").select("*").order("order_index"),
      supabaseCloud.from("traction_strategic_progress").select("*").order("period_start", { ascending: false }),
      supabaseCloud.from("traction_operational_progress").select("*").order("period_start", { ascending: false }),
    ]);
    setTrackers((tr.data as Tracker[]) || []);
    setStrategics((so.data as Strategic[]) || []);
    setKpis((kp.data as Kpi[]) || []);
    setValues((kv.data as KpiValue[]) || []);
    setTasks((to.data as OpTask[]) || []);
    setStratProgress(((sp.data as any[]) || []).map((r) => ({ ...r, parent_id: r.strategic_id })) as ProgressLog[]);
    setOpProgress(((op.data as any[]) || []).map((r) => ({ ...r, parent_id: r.operational_id })) as ProgressLog[]);
  };

  useEffect(() => {
    if (allowed) {
      setLoading(true);
      fetchAll().finally(() => setLoading(false));
    }
  }, [allowed]);

  const myTracker = useMemo(
    () => trackers.find((t) => t.owner_id === user?.id) || null,
    [trackers, user?.id],
  );

  const showErr = (error: any) => {
    if (error) toast({ title: "Eroare", description: error.message, variant: "destructive" });
  };

  // ---------- CRUD helpers (optimistic — no full refetch on edits) ----------
  const createMyTracker = async (department: string, name: string, period_type: string) => {
    if (!user) return;
    const { data, error } = await supabaseCloud.from("traction_trackers").insert({
      owner_id: user.id,
      owner_email: user.email,
      owner_name: profile?.name || null,
      department,
      name,
      period_type,
    }).select().single();
    if (error) return showErr(error);
    setTrackers((prev) => [...prev, data as Tracker]);
  };

  const updateTracker = async (id: string, patch: Partial<Tracker>) => {
    setTrackers((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    const { error } = await supabaseCloud.from("traction_trackers").update(patch).eq("id", id);
    if (error) showErr(error);
  };

  const addStrategic = async (tracker_id: string) => {
    const { data, error } = await supabaseCloud.from("traction_strategic_objectives").insert({
      tracker_id, title: "Obiectiv strategic nou", year: new Date().getFullYear(),
      order_index: strategics.filter((s) => s.tracker_id === tracker_id).length,
    }).select().single();
    if (error) return showErr(error);
    setStrategics((prev) => [...prev, data as Strategic]);
  };
  const updateStrategic = async (id: string, patch: Partial<Strategic>) => {
    setStrategics((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    const { error } = await supabaseCloud.from("traction_strategic_objectives").update(patch).eq("id", id);
    if (error) showErr(error);
  };
  const deleteStrategic = async (id: string) => {
    setStrategics((prev) => prev.filter((s) => s.id !== id));
    const { error } = await supabaseCloud.from("traction_strategic_objectives").delete().eq("id", id);
    if (error) showErr(error);
  };

  const addKpi = async (strategic_id: string) => {
    const { data, error } = await supabaseCloud.from("traction_kpis").insert({
      strategic_id, name: "KPI nou", target_operator: "gte",
      threshold_green: 1, threshold_yellow: 0.8,
      order_index: kpis.filter((k) => k.strategic_id === strategic_id).length,
    }).select().single();
    if (error) return showErr(error);
    setKpis((prev) => [...prev, data as Kpi]);
  };
  const updateKpi = async (id: string, patch: Partial<Kpi>) => {
    setKpis((prev) => prev.map((k) => (k.id === id ? { ...k, ...patch } : k)));
    const { error } = await supabaseCloud.from("traction_kpis").update(patch).eq("id", id);
    if (error) showErr(error);
  };
  const deleteKpi = async (id: string) => {
    setKpis((prev) => prev.filter((k) => k.id !== id));
    const { error } = await supabaseCloud.from("traction_kpis").delete().eq("id", id);
    if (error) showErr(error);
  };

  const addValue = async (kpi_id: string, period_label: string, value: number) => {
    const { data, error } = await supabaseCloud.from("traction_kpi_values").insert({
      kpi_id, period_label, value, period_start: new Date().toISOString().slice(0, 10),
    }).select().single();
    if (error) return showErr(error);
    setValues((prev) => [data as KpiValue, ...prev]);
  };
  const deleteValue = async (id: string) => {
    setValues((prev) => prev.filter((v) => v.id !== id));
    const { error } = await supabaseCloud.from("traction_kpi_values").delete().eq("id", id);
    if (error) showErr(error);
  };

  const addTask = async (tracker_id: string, kpi_id: string | null) => {
    const { data, error } = await supabaseCloud.from("traction_operational_objectives").insert({
      tracker_id, kpi_id, title: "Acțiune nouă", status: "open",
      order_index: tasks.filter((t) => t.tracker_id === tracker_id).length,
    }).select().single();
    if (error) return showErr(error);
    setTasks((prev) => [...prev, data as OpTask]);
  };
  const updateTask = async (id: string, patch: Partial<OpTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    const { error } = await supabaseCloud.from("traction_operational_objectives").update(patch).eq("id", id);
    if (error) showErr(error);
  };
  const deleteTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    const { error } = await supabaseCloud.from("traction_operational_objectives").delete().eq("id", id);
    if (error) showErr(error);
  };

  // ---------- Progress logs (strategic + operational) ----------
  const addStratProgress = async (strategic_id: string, entry: { period_label: string; progress: number | null; status: Status | null; notes: string | null }) => {
    const payload: any = { strategic_id, ...entry, period_start: new Date().toISOString().slice(0, 10) };
    const { data, error } = await supabaseCloud.from("traction_strategic_progress").insert(payload).select().single();
    if (error) return showErr(error);
    setStratProgress((prev) => [{ ...(data as any), parent_id: (data as any).strategic_id } as ProgressLog, ...prev]);
  };
  const deleteStratProgress = async (id: string) => {
    setStratProgress((prev) => prev.filter((p) => p.id !== id));
    const { error } = await supabaseCloud.from("traction_strategic_progress").delete().eq("id", id);
    if (error) showErr(error);
  };
  const addOpProgress = async (operational_id: string, entry: { period_label: string; progress: number | null; status: Status | null; notes: string | null }) => {
    const payload: any = { operational_id, ...entry, period_start: new Date().toISOString().slice(0, 10) };
    const { data, error } = await supabaseCloud.from("traction_operational_progress").insert(payload).select().single();
    if (error) return showErr(error);
    setOpProgress((prev) => [{ ...(data as any), parent_id: (data as any).operational_id } as ProgressLog, ...prev]);
  };
  const deleteOpProgress = async (id: string) => {
    setOpProgress((prev) => prev.filter((p) => p.id !== id));
    const { error } = await supabaseCloud.from("traction_operational_progress").delete().eq("id", id);
    if (error) showErr(error);
  };

  // ---------- Dashboard aggregation ----------
  const latestValueByKpi = useMemo(() => {
    const map = new Map<string, KpiValue>();
    values.forEach((v) => {
      const cur = map.get(v.kpi_id);
      if (!cur) map.set(v.kpi_id, v);
      else {
        const a = cur.period_start || cur.period_label;
        const b = v.period_start || v.period_label;
        if ((b || "") > (a || "")) map.set(v.kpi_id, v);
      }
    });
    return map;
  }, [values]);

  const departmentBreakdown = useMemo(() => {
    // Group KPIs by tracker.department -> count status
    const byDept = new Map<string, { green: number; yellow: number; red: number; unset: number; total: number }>();
    trackers.forEach((tr) => {
      const trStrats = strategics.filter((s) => s.tracker_id === tr.id).map((s) => s.id);
      const trKpis = kpis.filter((k) => trStrats.includes(k.strategic_id));
      const bucket = byDept.get(tr.department) || { green: 0, yellow: 0, red: 0, unset: 0, total: 0 };
      trKpis.forEach((k) => {
        const st = statusForValue(k, latestValueByKpi.get(k.id)?.value ?? null);
        bucket[st] += 1;
        bucket.total += 1;
      });
      byDept.set(tr.department, bucket);
    });
    return Array.from(byDept.entries()).map(([dept, b]) => ({ dept, ...b }));
  }, [trackers, strategics, kpis, latestValueByKpi]);

  if (accessLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!allowed) return <Navigate to="/" replace />;

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const viewedTracker = viewedTrackerId
    ? trackers.find((t) => t.id === viewedTrackerId) || null
    : myTracker;

  return (
    <div className="container mx-auto px-2 md:px-6 py-3 md:py-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Target className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Traction Tracker</h1>
            <p className="text-sm text-muted-foreground">
              Obiective strategice, KPI-uri și acțiuni operaționale pe departament.
            </p>
          </div>
        </div>
        <BackToHubButton />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-xl">
          <TabsTrigger value="dashboard" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="mine" className="gap-2">
            <User className="h-4 w-4" />
            Trackerul meu
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="all" className="gap-2">
              <Users className="h-4 w-4" />
              Toate trackerele
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="dashboard" className="mt-4">
          <DashboardView
            breakdown={departmentBreakdown}
            trackers={trackers}
            strategics={strategics}
            kpis={kpis}
            values={values}
            tasks={tasks}
            stratProgress={stratProgress}
            opProgress={opProgress}
            onOpenTracker={(id) => { setViewedTrackerId(id); setTab(isAdmin ? "all" : "mine"); }}
          />
        </TabsContent>

        <TabsContent value="mine" className="mt-4">
          {!myTracker ? (
            <NewTrackerCard onCreate={createMyTracker} />
          ) : (
            <TrackerEditor
              tracker={myTracker}
              strategics={strategics.filter((s) => s.tracker_id === myTracker.id)}
              kpis={kpis}
              values={values}
              tasks={tasks.filter((t) => t.tracker_id === myTracker.id)}
              onUpdateTracker={updateTracker}
              onAddStrategic={addStrategic}
              onUpdateStrategic={updateStrategic}
              onDeleteStrategic={deleteStrategic}
              onAddKpi={addKpi}
              onUpdateKpi={updateKpi}
              onDeleteKpi={deleteKpi}
              onAddValue={addValue}
              onDeleteValue={deleteValue}
              onAddTask={addTask}
              onUpdateTask={updateTask}
              onDeleteTask={deleteTask}
              stratProgress={stratProgress}
              opProgress={opProgress}
              onAddStratProgress={addStratProgress}
              onDeleteStratProgress={deleteStratProgress}
              onAddOpProgress={addOpProgress}
              onDeleteOpProgress={deleteOpProgress}
            />
          )}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="all" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {trackers.map((tr) => {
                const stratIds = strategics.filter((s) => s.tracker_id === tr.id).map((s) => s.id);
                const trKpis = kpis.filter((k) => stratIds.includes(k.strategic_id));
                const stats = { green: 0, yellow: 0, red: 0, unset: 0 };
                trKpis.forEach((k) => {
                  stats[statusForValue(k, latestValueByKpi.get(k.id)?.value ?? null)] += 1;
                });
                return (
                  <Card
                    key={tr.id}
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => { setViewedTrackerId(tr.id); setTab("mine"); }}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{tr.name}</CardTitle>
                        <Badge variant="secondary">{tr.department}</Badge>
                      </div>
                      <CardDescription>
                        {tr.owner_name || tr.owner_email || "—"} • {PERIOD_TYPES[tr.period_type] || tr.period_type}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex gap-2 text-xs">
                      <Badge className="bg-green-500/15 text-green-700 border-green-500/30">{stats.green}✓</Badge>
                      <Badge className="bg-yellow-500/15 text-yellow-700 border-yellow-500/30">{stats.yellow}!</Badge>
                      <Badge className="bg-red-500/15 text-red-700 border-red-500/30">{stats.red}✗</Badge>
                      <Badge variant="outline">{stats.unset} nesetate</Badge>
                    </CardContent>
                  </Card>
                );
              })}
              {trackers.length === 0 && (
                <p className="text-sm text-muted-foreground col-span-full">
                  Nu există trackere create încă.
                </p>
              )}
            </div>
            {viewedTracker && viewedTracker.owner_id !== user?.id && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="text-base">
                    Vizualizezi: {viewedTracker.name} ({viewedTracker.owner_name || viewedTracker.owner_email})
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setViewedTrackerId(null)}>
                    Închide
                  </Button>
                </CardHeader>
                <CardContent>
                  <TrackerEditor
                    tracker={viewedTracker}
                    strategics={strategics.filter((s) => s.tracker_id === viewedTracker.id)}
                    kpis={kpis}
                    values={values}
                    tasks={tasks.filter((t) => t.tracker_id === viewedTracker.id)}
                    onUpdateTracker={updateTracker}
                    onAddStrategic={addStrategic}
                    onUpdateStrategic={updateStrategic}
                    onDeleteStrategic={deleteStrategic}
                    onAddKpi={addKpi}
                    onUpdateKpi={updateKpi}
                    onDeleteKpi={deleteKpi}
                    onAddValue={addValue}
                    onDeleteValue={deleteValue}
                    onAddTask={addTask}
                    onUpdateTask={updateTask}
                    onDeleteTask={deleteTask}
                    stratProgress={stratProgress}
                    opProgress={opProgress}
                    onAddStratProgress={addStratProgress}
                    onDeleteStratProgress={deleteStratProgress}
                    onAddOpProgress={addOpProgress}
                    onDeleteOpProgress={deleteOpProgress}
                    readOnly={!isAdmin && viewedTracker.owner_id !== user?.id}
                  />
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

// ============ Dashboard ============
const DashboardView: React.FC<{
  breakdown: Array<{ dept: string; green: number; yellow: number; red: number; unset: number; total: number }>;
  trackers: Tracker[];
  strategics: Strategic[];
  kpis: Kpi[];
  values: KpiValue[];
  tasks: OpTask[];
  stratProgress: ProgressLog[];
  opProgress: ProgressLog[];
  onOpenTracker: (id: string) => void;
}> = ({ breakdown, trackers, strategics, kpis, values, tasks, stratProgress, opProgress, onOpenTracker }) => {
  if (breakdown.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Încă nu există date. Creează primul tracker în tab-ul „Trackerul meu".
        </CardContent>
      </Card>
    );
  }

  const global = breakdown.reduce(
    (acc, b) => ({
      green: acc.green + b.green,
      yellow: acc.yellow + b.yellow,
      red: acc.red + b.red,
      unset: acc.unset + b.unset,
      total: acc.total + b.total,
    }),
    { green: 0, yellow: 0, red: 0, unset: 0, total: 0 },
  );
  const globalEvaluated = global.green + global.yellow + global.red;
  const globalOkPct = globalEvaluated > 0 ? Math.round((global.green / globalEvaluated) * 100) : null;

  const totalStrategics = strategics.length;
  const stratDone = strategics.filter((s) => !!s.completed_at).length;
  const stratActive = totalStrategics - stratDone;
  const kpisDone = kpis.filter((k) => !!k.completed_at).length;
  const totalOps = tasks.length;
  const opsDone = tasks.filter((t) => !!t.completed_at || (t.status || "").toLowerCase().includes("final") || (t.status || "").toLowerCase() === "done" || (t.status || "").toLowerCase() === "closed").length;
  const opsOpen = totalOps - opsDone;

  return (
    <div className="space-y-6">
      {/* Summary strip — 3 categories */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <CategorySummary
          title="Obiective strategice"
          total={totalStrategics}
          lines={[
            { label: "Active", value: stratActive, tone: "yellow" },
            { label: "Finalizate", value: stratDone, tone: "green" },
            { label: "Trackere", value: trackers.length, tone: "neutral" },
          ]}
        />
        <CategorySummary
          title="KPI-uri"
          total={global.total}
          lines={[
            { label: "OK", value: global.green, tone: "green" },
            { label: "Atenție", value: global.yellow, tone: "yellow" },
            { label: "Critic", value: global.red, tone: "red" },
            { label: "Nesetate", value: global.unset, tone: "neutral" },
            { label: "Finalizate", value: kpisDone, tone: "green" },
            { label: "% OK", value: globalOkPct === null ? "—" : `${globalOkPct}%`, tone: "green" },
          ]}
        />
        <CategorySummary
          title="Acțiuni operaționale"
          total={totalOps}
          lines={[
            { label: "Finalizate", value: opsDone, tone: "green" },
            { label: "În lucru / deschise", value: opsOpen, tone: "yellow" },
          ]}
        />
      </div>

      {/* Per-department donuts (KPI status) */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Stare KPI-uri per departament
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {breakdown.map((b) => {
            const data = [
              { name: "Verde", value: b.green, color: STATUS_COLORS.green },
              { name: "Galben", value: b.yellow, color: STATUS_COLORS.yellow },
              { name: "Roșu", value: b.red, color: STATUS_COLORS.red },
              { name: "Nesetate", value: b.unset, color: STATUS_COLORS.unset },
            ].filter((x) => x.value > 0);
            const evaluated = b.green + b.yellow + b.red;
            const okPct = evaluated > 0 ? Math.round((b.green / evaluated) * 100) : null;
            return (
              <Card key={b.dept}>
                <CardHeader className="pb-0 pt-2 px-3">
                  <CardTitle className="text-xs">{b.dept}</CardTitle>
                  <CardDescription className="text-[10px]">{b.total} KPI-uri</CardDescription>
                </CardHeader>
                <CardContent style={{ height: 120 }} className="relative p-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data} dataKey="value" nameKey="name" innerRadius={30} outerRadius={50} paddingAngle={2}>
                        {data.map((d, i) => (<Cell key={i} fill={d.color} />))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-base font-bold" style={{ color: okPct === null ? STATUS_COLORS.unset : STATUS_COLORS.green }}>
                      {okPct === null ? "—" : `${okPct}%`}
                    </div>
                    <div className="text-[8px] text-muted-foreground uppercase">OK</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Per-tracker breakdown split into 3 columns */}
      <div className="space-y-5">
        {trackers.map((tr) => (
          <TrackerThreeColumns
            key={tr.id}
            tracker={tr}
            strategics={strategics.filter((s) => s.tracker_id === tr.id)}
            kpis={kpis}
            values={values}
            tasks={tasks.filter((t) => t.tracker_id === tr.id)}
            stratProgress={stratProgress}
            opProgress={opProgress}
            onOpen={() => onOpenTracker(tr.id)}
          />
        ))}
      </div>
    </div>
  );
};

const CategorySummary: React.FC<{
  title: string;
  total: number;
  lines: Array<{ label: string; value: number | string; tone: "green" | "yellow" | "red" | "neutral" }>;
}> = ({ title, total, lines }) => {
  const toneClass = (t: string) =>
    t === "green" ? "text-green-700"
    : t === "yellow" ? "text-yellow-700"
    : t === "red" ? "text-red-700"
    : "text-foreground";
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardDescription className="text-[10px] uppercase tracking-wide">{title}</CardDescription>
        <CardTitle className="text-3xl font-bold">{total}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {lines.map((l, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className="text-muted-foreground">{l.label}:</span>
              <span className={`font-semibold ${toneClass(l.tone)}`}>{l.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const SummaryTile: React.FC<{ label: string; value: number | string; tone: "green" | "yellow" | "red" | "neutral" }> = ({ label, value, tone }) => {
  const bg =
    tone === "green" ? "bg-green-500/10 border-green-500/30 text-green-700"
    : tone === "yellow" ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-700"
    : tone === "red" ? "bg-red-500/10 border-red-500/30 text-red-700"
    : "bg-muted border-border text-foreground";
  return (
    <div className={`rounded-lg border p-3 ${bg}`}>
      <div className="text-[11px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
};

// ============ 3-column tracker breakdown ============
const TrackerThreeColumns: React.FC<{
  tracker: Tracker;
  strategics: Strategic[];
  kpis: Kpi[];
  values: KpiValue[];
  tasks: OpTask[];
  stratProgress: ProgressLog[];
  opProgress: ProgressLog[];
  onOpen: () => void;
}> = ({ tracker, strategics, kpis, values, tasks, stratProgress, opProgress, onOpen }) => {
  const latest = (kpiId: string) => {
    const rows = values.filter((v) => v.kpi_id === kpiId);
    if (!rows.length) return undefined;
    return rows.sort((a, b) => ((b.period_start || b.period_label || "") > (a.period_start || a.period_label || "") ? 1 : -1))[0];
  };

  const stratStatus = (s: Strategic): Status => {
    const sKpis = kpis.filter((k) => k.strategic_id === s.id);
    if (sKpis.length === 0) return "unset";
    const statuses = sKpis.map((k) => statusForValue(k, latest(k.id)?.value ?? null));
    if (statuses.some((x) => x === "red")) return "red";
    if (statuses.some((x) => x === "yellow")) return "yellow";
    if (statuses.every((x) => x === "unset")) return "unset";
    return "green";
  };

  const allKpis = kpis.filter((k) => strategics.some((s) => s.id === k.strategic_id));
  const opDone = (t: OpTask) => {
    if (t.completed_at) return true;
    const s = (t.status || "").toLowerCase();
    return s.includes("final") || s === "done" || s === "closed";
  };
  const sortDone = <T extends { completed_at?: string | null }>(arr: T[]) =>
    [...arr].sort((a, b) => (a.completed_at ? 1 : 0) - (b.completed_at ? 1 : 0));
  const sortedStrategics = sortDone(strategics);
  const sortedKpis = sortDone(allKpis);
  const sortedTasks = [...tasks].sort((a, b) => (opDone(a) ? 1 : 0) - (opDone(b) ? 1 : 0));
  const fmtDate = (iso?: string | null) => {
    if (!iso) return "";
    try { return new Date(iso).toLocaleDateString("ro-RO"); } catch { return ""; }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              {tracker.name}
              <Badge variant="secondary">{tracker.department}</Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              {tracker.owner_name || tracker.owner_email || "—"} • {PERIOD_TYPES[tracker.period_type] || tracker.period_type}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onOpen}>
            <Pencil className="h-3.5 w-3.5 mr-1" /> Deschide editor
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* ===== Col 1: Strategic objectives ===== */}
          <div className="border rounded-md overflow-hidden">
            <div className="px-3 py-2 bg-primary/10 text-primary text-[11px] font-semibold uppercase tracking-wide flex items-center justify-between">
              <span>Obiective strategice</span>
              <Badge variant="outline" className="text-[10px]">{strategics.length}</Badge>
            </div>
            <div className="divide-y">
              {strategics.length === 0 && (
                <p className="text-xs text-muted-foreground italic p-3">Fără obiective.</p>
              )}
              {strategics.map((s) => {
                const progressList = stratProgress.filter((p) => p.parent_id === s.id);
                const lastProg = latestOf(progressList);
                const evolStatus: Status | null = lastProg
                  ? (lastProg.status || statusForProgress(lastProg.progress))
                  : null;
                const st = evolStatus || stratStatus(s);
                const nKpi = kpis.filter((k) => k.strategic_id === s.id).length;
                return (
                  <div key={s.id} className="p-2 flex items-start gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full mt-1 shrink-0"
                      style={{ backgroundColor: STATUS_COLORS[st] }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium truncate" title={s.title}>{s.title}</div>
                      {s.description && (
                        <div className="text-[10px] text-muted-foreground line-clamp-2" title={s.description}>
                          {s.description}
                        </div>
                      )}
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {nKpi} KPI-uri{s.year ? ` • ${s.year}` : ""}
                      </div>
                      {lastProg ? (
                        <div className="text-[10px] mt-1 flex items-center gap-1 flex-wrap">
                          <Badge
                            className="text-[9px] px-1.5 py-0"
                            style={{ backgroundColor: STATUS_COLORS[evolStatus!], color: "white" }}
                          >
                            {lastProg.progress ?? "—"}%
                          </Badge>
                          <span className="text-muted-foreground">
                            {lastProg.period_label || ""}
                            {lastProg.notes ? ` — ${lastProg.notes}` : ""}
                          </span>
                        </div>
                      ) : (
                        <div className="text-[10px] italic text-muted-foreground mt-1">fără progres înregistrat</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ===== Col 2: KPIs ===== */}
          <div className="border rounded-md overflow-hidden">
            <div className="px-3 py-2 bg-blue-500/10 text-blue-700 text-[11px] font-semibold uppercase tracking-wide flex items-center justify-between">
              <span>KPI-uri</span>
              <Badge variant="outline" className="text-[10px]">{allKpis.length}</Badge>
            </div>
            <div className="divide-y">
              {allKpis.length === 0 && (
                <p className="text-xs text-muted-foreground italic p-3">Fără KPI-uri.</p>
              )}
              {allKpis.map((k) => {
                const last = latest(k.id);
                const st = statusForValue(k, last?.value ?? null);
                const opSign = k.target_operator === "lte" ? "≤" : k.target_operator === "eq" ? "=" : "≥";
                return (
                  <div key={k.id} className="p-2 flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: STATUS_COLORS[st] }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium truncate" title={k.name}>{k.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        Actual: <span className="font-semibold text-foreground">{last?.value ?? "—"}</span>
                        {k.unit ? ` ${k.unit}` : ""} • Țintă: {opSign} {k.target_value ?? "—"}
                        {last?.period_label ? ` • ${last.period_label}` : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ===== Col 3: Operational actions ===== */}
          <div className="border rounded-md overflow-hidden">
            <div className="px-3 py-2 bg-amber-500/10 text-amber-700 text-[11px] font-semibold uppercase tracking-wide flex items-center justify-between">
              <span>Acțiuni operaționale</span>
              <Badge variant="outline" className="text-[10px]">{tasks.length}</Badge>
            </div>
            <div className="divide-y">
              {tasks.length === 0 && (
                <p className="text-xs text-muted-foreground italic p-3">Fără acțiuni.</p>
              )}
              {tasks.map((t) => {
                const progressList = opProgress.filter((p) => p.parent_id === t.id);
                const lastProg = latestOf(progressList);
                const evolStatus: Status | null = lastProg
                  ? (lastProg.status || statusForProgress(lastProg.progress))
                  : null;
                const done = opDone(t);
                const dotColor = evolStatus
                  ? STATUS_COLORS[evolStatus]
                  : (done ? STATUS_COLORS.green : STATUS_COLORS.yellow);
                const linkedKpi = t.kpi_id ? kpis.find((k) => k.id === t.kpi_id) : null;
                return (
                  <div key={t.id} className="p-2 flex items-start gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full mt-1 shrink-0"
                      style={{ backgroundColor: dotColor }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium truncate" title={t.title}>{t.title}</div>
                      {t.action && (
                        <div className="text-[10px] text-muted-foreground line-clamp-2" title={t.action}>
                          {t.action}
                        </div>
                      )}
                      <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[9px]">{t.status || "—"}</Badge>
                        {t.deadline && <span>Termen: {t.deadline}</span>}
                        {linkedKpi && <span className="truncate">KPI: {linkedKpi.name}</span>}
                      </div>
                      {lastProg && (
                        <div className="text-[10px] mt-1 flex items-center gap-1 flex-wrap">
                          <Badge
                            className="text-[9px] px-1.5 py-0"
                            style={{ backgroundColor: STATUS_COLORS[evolStatus!], color: "white" }}
                          >
                            {lastProg.progress ?? "—"}%
                          </Badge>
                          <span className="text-muted-foreground">
                            {lastProg.period_label || ""}
                            {lastProg.notes ? ` — ${lastProg.notes}` : ""}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};



// ============ New tracker card ============
const NewTrackerCard: React.FC<{ onCreate: (dept: string, name: string, period: string) => void }> = ({ onCreate }) => {
  const [dept, setDept] = useState(DEPARTMENT_OPTIONS[0]);
  const [name, setName] = useState("Traction Tracker");
  const [period, setPeriod] = useState("weekly");
  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Creează trackerul tău</CardTitle>
        <CardDescription>
          Setează departamentul și frecvența pentru urmărirea KPI-urilor.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label>Nume tracker</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Departament</Label>
          <Input
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            list="dept-options"
            placeholder="Ex: Achiziții, Marketing, IT..."
          />
          <datalist id="dept-options">
            {DEPARTMENT_OPTIONS.map((d) => (<option key={d} value={d} />))}
          </datalist>
          <p className="text-xs text-muted-foreground">Poți scrie orice departament nou.</p>
        </div>
        <div className="space-y-1">
          <Label>Perioadă</Label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(PERIOD_TYPES).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => onCreate(dept, name.trim() || "Traction Tracker", period)} className="w-full">
          <Plus className="h-4 w-4 mr-1" />
          Creează tracker
        </Button>
      </CardContent>
    </Card>
  );
};

// ============ Tracker editor ============
type TrackerEditorProps = {
  tracker: Tracker;
  strategics: Strategic[];
  kpis: Kpi[];
  values: KpiValue[];
  tasks: OpTask[];
  onUpdateTracker: (id: string, patch: Partial<Tracker>) => void;
  onAddStrategic: (tracker_id: string) => void;
  onUpdateStrategic: (id: string, patch: Partial<Strategic>) => void;
  onDeleteStrategic: (id: string) => void;
  onAddKpi: (strategic_id: string) => void;
  onUpdateKpi: (id: string, patch: Partial<Kpi>) => void;
  onDeleteKpi: (id: string) => void;
  onAddValue: (kpi_id: string, period_label: string, value: number) => void;
  onDeleteValue: (id: string) => void;
  onAddTask: (tracker_id: string, kpi_id: string | null) => void;
  onUpdateTask: (id: string, patch: Partial<OpTask>) => void;
  onDeleteTask: (id: string) => void;
  stratProgress: ProgressLog[];
  opProgress: ProgressLog[];
  onAddStratProgress: (strategic_id: string, entry: { period_label: string; progress: number | null; status: Status | null; notes: string | null }) => void;
  onDeleteStratProgress: (id: string) => void;
  onAddOpProgress: (operational_id: string, entry: { period_label: string; progress: number | null; status: Status | null; notes: string | null }) => void;
  onDeleteOpProgress: (id: string) => void;
  readOnly?: boolean;
};

const TrackerEditor: React.FC<TrackerEditorProps> = (props) => {
  const { tracker, strategics, kpis, values, tasks, readOnly } = props;
  const [expanded, setExpanded] = useState<Set<string>>(new Set(strategics.map((s) => s.id)));

  const toggle = (id: string) => setExpanded((s) => {
    const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n;
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label>Nume</Label>
            <Input
              value={tracker.name}
              disabled={readOnly}
              onChange={(e) => props.onUpdateTracker(tracker.id, { name: e.target.value })}
              className="w-64"
            />
          </div>
          <div className="space-y-1">
            <Label>Departament</Label>
            <Input
              value={tracker.department}
              disabled={readOnly}
              onChange={(e) => props.onUpdateTracker(tracker.id, { department: e.target.value })}
              list="dept-options-editor"
              className="w-48"
              placeholder="Ex: Marketing, IT..."
            />
            <datalist id="dept-options-editor">
              {DEPARTMENT_OPTIONS.map((d) => (<option key={d} value={d} />))}
            </datalist>
          </div>
          <div className="space-y-1">
            <Label>Perioadă</Label>
            <Select
              value={tracker.period_type}
              onValueChange={(v) => props.onUpdateTracker(tracker.id, { period_type: v })}
              disabled={readOnly}
            >
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PERIOD_TYPES).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase text-muted-foreground">Obiective strategice</h3>
        {!readOnly && (
          <Button size="sm" onClick={() => props.onAddStrategic(tracker.id)}>
            <Plus className="h-4 w-4 mr-1" />Adaugă obiectiv strategic
          </Button>
        )}
      </div>

      {strategics.length === 0 && (
        <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">Fără obiective strategice.</CardContent></Card>
      )}

      {strategics.map((s) => {
        const sKpis = kpis.filter((k) => k.strategic_id === s.id);
        const isOpen = expanded.has(s.id);
        return (
          <Card key={s.id} className={s.completed_at ? "opacity-70 border-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-950/10" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-start gap-2">
                <Button variant="ghost" size="icon" onClick={() => toggle(s.id)}>
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={s.title}
                      disabled={readOnly}
                      onChange={(e) => props.onUpdateStrategic(s.id, { title: e.target.value })}
                      className={"font-semibold " + (s.completed_at ? "line-through text-muted-foreground" : "")}
                    />
                    {s.completed_at && (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1 shrink-0">
                        <CheckCircle2 className="h-3 w-3" />Finalizat
                      </Badge>
                    )}
                  </div>
                  <Textarea
                    value={s.description || ""}
                    placeholder="Descriere (opțional)"
                    disabled={readOnly}
                    onChange={(e) => props.onUpdateStrategic(s.id, { description: e.target.value })}
                    rows={2}
                  />
                </div>
                <Input
                  type="number"
                  value={s.year ?? ""}
                  disabled={readOnly}
                  onChange={(e) => props.onUpdateStrategic(s.id, { year: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-24"
                  placeholder="An"
                />
                {!readOnly && (
                  <>
                    {s.completed_at ? (
                      <Button variant="ghost" size="sm" onClick={() => props.onUpdateStrategic(s.id, { completed_at: null })} title="Redeschide" className="text-emerald-600">
                        <RotateCcw className="h-4 w-4 mr-1" />Redeschide
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => props.onUpdateStrategic(s.id, { completed_at: new Date().toISOString() })} title="Finalizează" className="text-emerald-600">
                        <CheckCircle2 className="h-4 w-4 mr-1" />Finalizează
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => props.onDeleteStrategic(s.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
              <div className="pl-10 pt-2">
                <ProgressCell
                  label="Progres obiectiv"
                  entries={props.stratProgress.filter((p) => p.parent_id === s.id)}
                  readOnly={readOnly}
                  onAdd={(entry) => props.onAddStratProgress(s.id, entry)}
                  onDelete={props.onDeleteStratProgress}
                />
              </div>
            </CardHeader>
            {isOpen && (
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground">KPI-uri</h4>
                  {!readOnly && (
                    <Button size="sm" variant="outline" onClick={() => props.onAddKpi(s.id)}>
                      <Plus className="h-4 w-4 mr-1" />Adaugă KPI
                    </Button>
                  )}
                </div>
                {sKpis.map((k) => (
                  <KpiRow
                    key={k.id}
                    kpi={k}
                    values={values.filter((v) => v.kpi_id === k.id)}
                    tasks={tasks.filter((t) => t.kpi_id === k.id)}
                    trackerId={tracker.id}
                    readOnly={readOnly}
                    onUpdate={(patch) => props.onUpdateKpi(k.id, patch)}
                    onDelete={() => props.onDeleteKpi(k.id)}
                    onAddValue={(period, value) => props.onAddValue(k.id, period, value)}
                    onDeleteValue={props.onDeleteValue}
                    onAddTask={() => props.onAddTask(tracker.id, k.id)}
                    onUpdateTask={props.onUpdateTask}
                    onDeleteTask={props.onDeleteTask}
                    opProgress={props.opProgress}
                    onAddOpProgress={props.onAddOpProgress}
                    onDeleteOpProgress={props.onDeleteOpProgress}
                  />
                ))}
                {sKpis.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">Fără KPI-uri.</p>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}

      <div className="flex items-center justify-between pt-2">
        <h3 className="text-sm font-semibold uppercase text-muted-foreground">Acțiuni operaționale (nelegate de KPI)</h3>
        {!readOnly && (
          <Button size="sm" variant="outline" onClick={() => props.onAddTask(tracker.id, null)}>
            <Plus className="h-4 w-4 mr-1" />Adaugă acțiune
          </Button>
        )}
      </div>
      <Card>
        <CardContent className="pt-4 space-y-2">
          {tasks.filter((t) => !t.kpi_id).map((t) => (
            <TaskRow key={t.id} task={t} readOnly={readOnly}
              onUpdate={(p) => props.onUpdateTask(t.id, p)}
              onDelete={() => props.onDeleteTask(t.id)}
              progress={props.opProgress.filter((pr) => pr.parent_id === t.id)}
              onAddProgress={(entry) => props.onAddOpProgress(t.id, entry)}
              onDeleteProgress={props.onDeleteOpProgress} />
          ))}
          {tasks.filter((t) => !t.kpi_id).length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">Fără acțiuni.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// ============ KPI row ============
const KpiRow: React.FC<{
  kpi: Kpi;
  values: KpiValue[];
  tasks: OpTask[];
  trackerId: string;
  readOnly?: boolean;
  onUpdate: (patch: Partial<Kpi>) => void;
  onDelete: () => void;
  onAddValue: (period: string, value: number) => void;
  onDeleteValue: (id: string) => void;
  onAddTask: () => void;
  onUpdateTask: (id: string, patch: Partial<OpTask>) => void;
  onDeleteTask: (id: string) => void;
  opProgress: ProgressLog[];
  onAddOpProgress: (operational_id: string, entry: { period_label: string; progress: number | null; status: Status | null; notes: string | null }) => void;
  onDeleteOpProgress: (id: string) => void;
}> = ({ kpi, values, tasks, readOnly, onUpdate, onDelete, onAddValue, onDeleteValue, onAddTask, onUpdateTask, onDeleteTask, opProgress, onAddOpProgress, onDeleteOpProgress }) => {
  const [addOpen, setAddOpen] = useState(false);
  const [newPeriod, setNewPeriod] = useState("");
  const [newValue, setNewValue] = useState("");
  const [advOpen, setAdvOpen] = useState(false);

  const latest = values[0];
  const status = statusForValue(kpi, latest?.value ?? null);
  const opLabel = kpi.target_operator === "lte" ? "≤" : kpi.target_operator === "eq" ? "=" : "≥";

  return (
    <div className={"rounded-lg border p-3 space-y-3 " + (kpi.completed_at ? "bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-500/40 opacity-80" : "bg-card")}>
      <div className="flex flex-wrap gap-3 items-end">
        <div
          className="w-4 h-4 rounded-full mt-2 shrink-0 ring-2 ring-background shadow"
          style={{ backgroundColor: STATUS_COLORS[status] }}
          title={status}
        />
        <div className="space-y-1 flex-1 min-w-[200px]">
          <Label className="text-xs text-muted-foreground flex items-center gap-2">
            Nume KPI
            {kpi.completed_at && (
              <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1 h-5">
                <CheckCircle2 className="h-3 w-3" />Finalizat
              </Badge>
            )}
          </Label>
          <Input value={kpi.name} disabled={readOnly} onChange={(e) => onUpdate({ name: e.target.value })} className={"font-medium " + (kpi.completed_at ? "line-through text-muted-foreground" : "")} />
        </div>
        <div className="space-y-1 w-24">
          <Label className="text-xs text-muted-foreground">UM</Label>
          <Input value={kpi.unit || ""} disabled={readOnly} onChange={(e) => onUpdate({ unit: e.target.value })} placeholder="%, buc..." />
        </div>
        <div className="space-y-1 w-40">
          <Label className="text-xs text-muted-foreground">Direcție</Label>
          <Select value={kpi.target_operator || "gte"} disabled={readOnly} onValueChange={(v) => onUpdate({ target_operator: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gte">↑ Cât mai mare (≥)</SelectItem>
              <SelectItem value="lte">↓ Cât mai mic (≤)</SelectItem>
              <SelectItem value="eq">= Egal cu ținta</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 w-32">
          <Label className="text-xs text-muted-foreground">Țintă ({opLabel})</Label>
          <Input type="number" step="any" value={kpi.target_value ?? ""} disabled={readOnly}
            onChange={(e) => onUpdate({ target_value: e.target.value ? parseFloat(e.target.value) : null })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Ultima valoare</Label>
          <div className="h-10 px-3 flex items-center rounded-md border bg-muted/40 text-sm font-medium min-w-[120px]">
            {latest ? `${latest.value ?? "—"} ${kpi.unit || ""}` : "—"}
            {latest && <span className="text-xs text-muted-foreground ml-2">({latest.period_label})</span>}
          </div>
        </div>
        {!readOnly && (
          <>
            <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}>
              <Plus className="h-3 w-3 mr-1" />Valoare
            </Button>
            {kpi.completed_at ? (
              <Button size="sm" variant="ghost" onClick={() => onUpdate({ completed_at: null })} className="text-emerald-600" title="Redeschide KPI">
                <RotateCcw className="h-4 w-4 mr-1" />Redeschide
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => onUpdate({ completed_at: new Date().toISOString() })} className="text-emerald-600" title="Finalizează KPI">
                <CheckCircle2 className="h-4 w-4 mr-1" />Finalizează
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onDelete} title="Șterge KPI">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </>
        )}
      </div>

      {!readOnly && (
        <button
          type="button"
          onClick={() => setAdvOpen((o) => !o)}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          {advOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          Setări avansate (operator, praguri culori)
        </button>
      )}
      {advOpen && !readOnly && (
        <div className="flex flex-wrap gap-2 items-end pl-4 border-l-2 border-muted">
          <div className="space-y-1 w-32">
            <Label className="text-xs">Regulă</Label>
            <Select value={kpi.target_operator} onValueChange={(v) => onUpdate({ target_operator: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gte">Mai mare ≥</SelectItem>
                <SelectItem value="lte">Mai mic ≤</SelectItem>
                <SelectItem value="eq">Egal =</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 w-28">
            <Label className="text-xs">Prag verde</Label>
            <Input type="number" step="any" value={kpi.threshold_green ?? ""}
              onChange={(e) => onUpdate({ threshold_green: e.target.value ? parseFloat(e.target.value) : null })} />
          </div>
          <div className="space-y-1 w-28">
            <Label className="text-xs">Prag galben</Label>
            <Input type="number" step="any" value={kpi.threshold_yellow ?? ""}
              onChange={(e) => onUpdate({ threshold_yellow: e.target.value ? parseFloat(e.target.value) : null })} />
          </div>
          <p className="text-xs text-muted-foreground flex-1 min-w-[200px]">
            Pragurile sunt raportate la țintă (1 = 100%, 0.8 = 80%).
          </p>
        </div>
      )}

      {values.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Istoric:</span>
          {values.slice(0, 8).map((v) => (
            <Badge key={v.id} variant="outline" className="gap-1">
              {v.period_label}: <strong>{v.value ?? "—"}</strong>
              {!readOnly && (
                <button className="ml-1 text-destructive" onClick={() => onDeleteValue(v.id)} title="Șterge">×</button>
              )}
            </Badge>
          ))}
        </div>
      )}

      {tasks.length > 0 && (
        <div className="border-t pt-2 space-y-1">
          <div className="text-xs font-semibold uppercase text-muted-foreground">Acțiuni corective</div>
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} readOnly={readOnly}
              onUpdate={(p) => onUpdateTask(t.id, p)}
              onDelete={() => onDeleteTask(t.id)}
              progress={opProgress.filter((pr) => pr.parent_id === t.id)}
              onAddProgress={(entry) => onAddOpProgress(t.id, entry)}
              onDeleteProgress={onDeleteOpProgress} />
          ))}
        </div>
      )}
      {!readOnly && (
        <Button size="sm" variant="ghost" onClick={onAddTask} className="text-xs">
          <Plus className="h-3 w-3 mr-1" />Adaugă acțiune corectivă
        </Button>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adaugă valoare</DialogTitle>
            <DialogDescription>Ex: „S23 2026", „Iunie 2026", „T2 2026"</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Perioadă</Label>
            <Input value={newPeriod} onChange={(e) => setNewPeriod(e.target.value)} placeholder="S23 2026" />
            <Label>Valoare</Label>
            <Input type="number" step="any" value={newValue} onChange={(e) => setNewValue(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Anulează</Button>
            <Button onClick={() => {
              if (!newPeriod.trim() || !newValue) return;
              onAddValue(newPeriod.trim(), parseFloat(newValue));
              setNewPeriod(""); setNewValue(""); setAddOpen(false);
            }}>
              <Save className="h-4 w-4 mr-1" />Salvează
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ============ Task row ============
const TaskRow: React.FC<{
  task: OpTask;
  readOnly?: boolean;
  onUpdate: (patch: Partial<OpTask>) => void;
  onDelete: () => void;
  progress?: ProgressLog[];
  onAddProgress?: (entry: { period_label: string; progress: number | null; status: Status | null; notes: string | null }) => void;
  onDeleteProgress?: (id: string) => void;
}> = ({ task, readOnly, onUpdate, onDelete, progress, onAddProgress, onDeleteProgress }) => {
  return (
    <div className={"rounded border p-2 space-y-2 " + (task.completed_at ? "bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-500/40 opacity-80" : "bg-background")}>
      <div className="flex flex-wrap items-center gap-2">
        {task.completed_at && (
          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1 shrink-0">
            <CheckCircle2 className="h-3 w-3" />Finalizat
          </Badge>
        )}
        <Input value={task.title} disabled={readOnly}
          onChange={(e) => onUpdate({ title: e.target.value })}
          className={"flex-1 min-w-[160px] " + (task.completed_at ? "line-through text-muted-foreground" : "")} />
        <Input value={task.action || ""} placeholder="Acțiune" disabled={readOnly}
          onChange={(e) => onUpdate({ action: e.target.value })} className="flex-1 min-w-[160px]" />
        <Input type="date" value={task.deadline || ""} disabled={readOnly}
          onChange={(e) => onUpdate({ deadline: e.target.value || null })} className="w-40" />
        <Select value={task.status} onValueChange={(v) => onUpdate({ status: v })} disabled={readOnly}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Deschis</SelectItem>
            <SelectItem value="in_progress">În lucru</SelectItem>
            <SelectItem value="done">Finalizat</SelectItem>
            <SelectItem value="blocked">Blocat</SelectItem>
          </SelectContent>
        </Select>
        {!readOnly && (
          <>
            {task.completed_at ? (
              <Button variant="ghost" size="sm" onClick={() => onUpdate({ completed_at: null })} className="text-emerald-600" title="Redeschide">
                <RotateCcw className="h-4 w-4 mr-1" />Redeschide
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => onUpdate({ completed_at: new Date().toISOString(), status: "done" })} className="text-emerald-600" title="Finalizează">
                <CheckCircle2 className="h-4 w-4 mr-1" />Finalizează
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onDelete}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </>
        )}
      </div>
      {onAddProgress && (
        <ProgressCell
          label="Progres acțiune"
          entries={progress || []}
          readOnly={readOnly}
          onAdd={onAddProgress}
          onDelete={onDeleteProgress || (() => {})}
        />
      )}
    </div>
  );
};

// ============ Progress cell (evoluție pentru obiective strategice și acțiuni operaționale) ============
const ProgressCell: React.FC<{
  label: string;
  entries: ProgressLog[];
  readOnly?: boolean;
  onAdd: (entry: { period_label: string; progress: number | null; status: Status | null; notes: string | null }) => void;
  onDelete: (id: string) => void;
}> = ({ label, entries, readOnly, onAdd, onDelete }) => {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState("");
  const [pct, setPct] = useState("");
  const [statusChoice, setStatusChoice] = useState<"auto" | Status>("auto");
  const [notes, setNotes] = useState("");

  const sorted = [...entries].sort((a, b) => {
    const ka = a.period_start || a.period_label || a.created_at || "";
    const kb = b.period_start || b.period_label || b.created_at || "";
    return kb > ka ? 1 : -1;
  });
  const last = sorted[0];
  const lastStatus: Status = last
    ? (last.status || statusForProgress(last.progress))
    : "unset";

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase tracking-wide">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-background shadow"
          style={{ backgroundColor: STATUS_COLORS[lastStatus] }}
        />
        {label}:
      </div>
      {last ? (
        <span className="text-xs">
          <strong>{last.progress ?? "—"}%</strong>
          {last.period_label ? ` • ${last.period_label}` : ""}
          {last.notes ? ` — ${last.notes}` : ""}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground italic">fără istoric</span>
      )}
      {sorted.slice(1, 5).map((p) => (
        <Badge key={p.id} variant="outline" className="gap-1 text-[10px]">
          {p.period_label || (p.period_start ?? "")}:
          <strong>{p.progress ?? "—"}%</strong>
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: STATUS_COLORS[(p.status || statusForProgress(p.progress)) as Status] }}
          />
          {!readOnly && (
            <button className="ml-1 text-destructive" onClick={() => onDelete(p.id)} title="Șterge">×</button>
          )}
        </Badge>
      ))}
      {!readOnly && (
        <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => setOpen(true)}>
          <Plus className="h-3 w-3 mr-1" />Progres
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adaugă intrare de progres</DialogTitle>
            <DialogDescription>
              Notează cum evoluăm sau involvăm față de perioada trecută.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Perioadă</Label>
            <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="S23 2026 / Iunie 2026" />
            <Label>Progres (%)</Label>
            <Input type="number" step="any" min={0} max={100} value={pct} onChange={(e) => setPct(e.target.value)} placeholder="0 - 100" />
            <Label>Semafor</Label>
            <Select value={statusChoice} onValueChange={(v) => setStatusChoice(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automat din % (≥80 verde, ≥50 galben)</SelectItem>
                <SelectItem value="green">🟢 Verde</SelectItem>
                <SelectItem value="yellow">🟡 Galben</SelectItem>
                <SelectItem value="red">🔴 Roșu</SelectItem>
              </SelectContent>
            </Select>
            <Label>Observații</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Ce am făcut / ce urmează..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Anulează</Button>
            <Button onClick={() => {
              const progressVal = pct === "" ? null : parseFloat(pct);
              const statusVal = statusChoice === "auto" ? null : statusChoice;
              onAdd({
                period_label: period.trim() || new Date().toLocaleDateString("ro-RO"),
                progress: progressVal,
                status: statusVal,
                notes: notes.trim() || null,
              });
              setPeriod(""); setPct(""); setStatusChoice("auto"); setNotes(""); setOpen(false);
            }}>
              <Save className="h-4 w-4 mr-1" />Salvează
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TractionTrackerHub;
