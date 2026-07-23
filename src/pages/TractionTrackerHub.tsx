import React, { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, Target, LayoutDashboard, User, Users, Plus, Trash2, Save, ChevronDown, ChevronRight, Pencil } from "lucide-react";
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
  const [tab, setTab] = useState("dashboard");
  const [viewedTrackerId, setViewedTrackerId] = useState<string | null>(null);

  const fetchAll = async () => {
    const [tr, so, kp, kv, to] = await Promise.all([
      supabaseCloud.from("traction_trackers").select("*").order("created_at", { ascending: true }),
      supabaseCloud.from("traction_strategic_objectives").select("*").order("order_index"),
      supabaseCloud.from("traction_kpis").select("*").order("order_index"),
      supabaseCloud.from("traction_kpi_values").select("*").order("period_start", { ascending: false }),
      supabaseCloud.from("traction_operational_objectives").select("*").order("order_index"),
    ]);
    setTrackers((tr.data as Tracker[]) || []);
    setStrategics((so.data as Strategic[]) || []);
    setKpis((kp.data as Kpi[]) || []);
    setValues((kv.data as KpiValue[]) || []);
    setTasks((to.data as OpTask[]) || []);
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
          <DashboardView breakdown={departmentBreakdown} />
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
const DashboardView: React.FC<{ breakdown: Array<{ dept: string; green: number; yellow: number; red: number; unset: number; total: number }> }> = ({ breakdown }) => {
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
  const globalData = [
    { name: "Verde", value: global.green, color: STATUS_COLORS.green },
    { name: "Galben", value: global.yellow, color: STATUS_COLORS.yellow },
    { name: "Roșu", value: global.red, color: STATUS_COLORS.red },
    { name: "Nesetate", value: global.unset, color: STATUS_COLORS.unset },
  ].filter((x) => x.value > 0);

  const globalEvaluated = global.green + global.yellow + global.red;
  const globalOkPct = globalEvaluated > 0 ? Math.round((global.green / globalEvaluated) * 100) : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Global — toate departamentele</CardTitle>
          <CardDescription>{global.total} KPI-uri urmărite</CardDescription>
        </CardHeader>
        <CardContent style={{ height: 280 }} className="relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={globalData} dataKey="value" nameKey="name" innerRadius={75} outerRadius={110} paddingAngle={2}>
                {globalData.map((d, i) => (<Cell key={i} fill={d.color} />))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={30} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center -mt-6">
            <div className="text-4xl font-bold" style={{ color: globalOkPct === null ? STATUS_COLORS.unset : STATUS_COLORS.green }}>
              {globalOkPct === null ? "—" : `${globalOkPct}%`}
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">{globalOkPct === null ? "fără date" : "OK"}</div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {breakdown.map((b) => {
          const data = [
            { name: "Verde", value: b.green, color: STATUS_COLORS.green },
            { name: "Galben", value: b.yellow, color: STATUS_COLORS.yellow },
            { name: "Roșu", value: b.red, color: STATUS_COLORS.red },
            { name: "Nesetate", value: b.unset, color: STATUS_COLORS.unset },
          ].filter((x) => x.value > 0);
          const okPct = b.total > 0 ? Math.round((b.green / b.total) * 100) : 0;
          return (
            <Card key={b.dept}>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  {b.dept}
                  <Badge variant="secondary">{okPct}% OK</Badge>
                </CardTitle>
                <CardDescription>{b.total} KPI-uri</CardDescription>
              </CardHeader>
              <CardContent style={{ height: 200 }} className="relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {data.map((d, i) => (<Cell key={i} fill={d.color} />))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-2xl font-bold" style={{ color: STATUS_COLORS.green }}>{okPct}%</div>
                  <div className="text-[10px] text-muted-foreground uppercase">OK</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
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
          <Card key={s.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start gap-2">
                <Button variant="ghost" size="icon" onClick={() => toggle(s.id)}>
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
                <div className="flex-1 space-y-2">
                  <Input
                    value={s.title}
                    disabled={readOnly}
                    onChange={(e) => props.onUpdateStrategic(s.id, { title: e.target.value })}
                    className="font-semibold"
                  />
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
                  <Button variant="ghost" size="icon" onClick={() => props.onDeleteStrategic(s.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
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
              onDelete={() => props.onDeleteTask(t.id)} />
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
}> = ({ kpi, values, tasks, readOnly, onUpdate, onDelete, onAddValue, onDeleteValue, onAddTask, onUpdateTask, onDeleteTask }) => {
  const [addOpen, setAddOpen] = useState(false);
  const [newPeriod, setNewPeriod] = useState("");
  const [newValue, setNewValue] = useState("");
  const [advOpen, setAdvOpen] = useState(false);

  const latest = values[0];
  const status = statusForValue(kpi, latest?.value ?? null);
  const opLabel = kpi.target_operator === "lte" ? "≤" : kpi.target_operator === "eq" ? "=" : "≥";

  return (
    <div className="rounded-lg border p-3 space-y-3 bg-card">
      <div className="flex flex-wrap gap-3 items-end">
        <div
          className="w-4 h-4 rounded-full mt-2 shrink-0 ring-2 ring-background shadow"
          style={{ backgroundColor: STATUS_COLORS[status] }}
          title={status}
        />
        <div className="space-y-1 flex-1 min-w-[200px]">
          <Label className="text-xs text-muted-foreground">Nume KPI</Label>
          <Input value={kpi.name} disabled={readOnly} onChange={(e) => onUpdate({ name: e.target.value })} className="font-medium" />
        </div>
        <div className="space-y-1 w-24">
          <Label className="text-xs text-muted-foreground">UM</Label>
          <Input value={kpi.unit || ""} disabled={readOnly} onChange={(e) => onUpdate({ unit: e.target.value })} placeholder="%, buc..." />
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
              onDelete={() => onDeleteTask(t.id)} />
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
}> = ({ task, readOnly, onUpdate, onDelete }) => {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded border p-2 bg-background">
      <Input value={task.title} disabled={readOnly}
        onChange={(e) => onUpdate({ title: e.target.value })} className="flex-1 min-w-[160px]" />
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
        <Button variant="ghost" size="icon" onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      )}
    </div>
  );
};

export default TractionTrackerHub;
