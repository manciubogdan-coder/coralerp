import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabaseCloud } from "@/integrations/supabase/cloudClient";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, History } from "lucide-react";

const norm = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const AROMATE_KEYS = [
  "menta", "busuioc", "patrunjel", "marar", "cimbru", "cimbrisor", "rozmarin", "oregano",
  "leustean", "tarhon", "coriandru", "arpagic", "ceapa verde", "salvie", "melisa", "roinita",
  "lavanda", "aromat",
];

export const CATEGORIES = ["Aromate", "Salate mono", "Salate mixte", "Horeca"] as const;
type Cat = (typeof CATEGORIES)[number];

// Mapă produs_id -> număr de ingrediente din rețetă (Salate mixte = mai mult de 1 ingredient)
export type IngCountMap = Record<string, number>;

export const useIngredientCounts = () =>
  useQuery({
    queryKey: ["produs-ingredient-counts"],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<IngCountMap> => {
      const { data, error } = await supabase
        .from("productie_retete_ingrediente")
        .select("productie_retete!inner(produs_id)");
      if (error) throw error;
      const map: IngCountMap = {};
      for (const r of (data as any) || []) {
        const pid = (r as any)?.productie_retete?.produs_id;
        if (pid) map[pid] = (map[pid] || 0) + 1;
      }
      return map;
    },
  });

export const categoryOf = (o: any, ingMap?: IngCountMap): Cat => {
  const prod = o?.productie_produse;
  const p = norm(prod?.nume || "");
  const c = norm(`${o?.magazin || ""} ${o?.productie_clienti?.nume || ""}`);
  if (p.includes("horeca") || c.includes("horeca")) return "Horeca";
  if (AROMATE_KEYS.some((k) => p.includes(k))) return "Aromate";
  const pid = prod?.id;
  const nrIng = pid && ingMap ? ingMap[pid] : undefined;
  if (nrIng === undefined) {
    if (p.includes("mix") || p.includes("+") || p.includes("asortat")) return "Salate mixte";
    return "Salate mono";
  }
  return nrIng > 1 ? "Salate mixte" : "Salate mono";
};

export interface Stat { cerut: number; facut: number; comenzi: number; gata: number }
const empty = (): Stat => ({ cerut: 0, facut: 0, comenzi: 0, gata: 0 });

export const computeStats = (orders: any[], ingMap?: IngCountMap): { total: Stat; byCat: Record<string, Stat> } => {
  const total = empty();
  const byCat: Record<string, Stat> = Object.fromEntries(CATEGORIES.map((k) => [k, empty()]));
  for (const o of orders) {
    const cerut = Number(o.cantitate || 0);
    if (cerut <= 0) continue;
    const reamb = o.magazin === "REAMBALARE" || o.tip_comanda === "REAMBALARE";
    const acoperit = Number(o.cantitate_reala_produsa || 0) + (reamb ? 0 : Number(o.cantitate_din_restock || 0));
    const facut = o.status === "completed" ? cerut : Math.min(acoperit, cerut);
    const gata = o.status === "completed" || acoperit >= cerut;
    for (const s of [total, byCat[categoryOf(o, ingMap)]]) {
      s.cerut += cerut;
      s.facut += facut;
      s.comenzi += 1;
      if (gata) s.gata += 1;
    }
  }
  return { total, byCat };
};

export const pctOf = (s: Stat) => (s.cerut > 0 ? (s.facut / s.cerut) * 100 : 0);

const Donut = ({ pct, size = 92, stroke = 10 }: { pct: number; size?: number; stroke?: number }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="hsl(var(--primary))" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${(p / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-700"
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle"
        className="fill-foreground font-bold" style={{ fontSize: size / 4.2 }}>
        {Math.round(p)}%
      </text>
    </svg>
  );
};

const fmt = (n: number) => Math.round(n).toLocaleString("ro-RO");

const isDone = (o: any) => {
  const cerut = Number(o.cantitate || 0);
  const reamb = o.magazin === "REAMBALARE" || o.tip_comanda === "REAMBALARE";
  const ac = Number(o.cantitate_reala_produsa || 0) + (reamb ? 0 : Number(o.cantitate_din_restock || 0));
  return o.status === "completed" || ac >= cerut;
};
const fmtDt = (d?: string) => (d ? new Date(d).toLocaleString("ro-RO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");

const describeAudit = (e: any) => {
  const c = Array.isArray(e.changes) ? e.changes[0] : e.changes || {};
  if (e.table_name === "productie_sesiuni_lucru") {
    if (e.action === "insert") return { label: "Sesiune deschisă", tone: "bg-primary/15 text-primary" };
    if (c?.status === "completed" || c?.ora_sfarsit) return { label: "Sesiune finalizată", tone: "bg-primary/25 text-primary" };
    return { label: "Sesiune modificată", tone: "bg-muted" };
  }
  if (e.table_name === "productie_comenzi") {
    if (e.action === "insert") return { label: "Comandă creată", tone: "bg-primary/15 text-primary" };
    if (e.action === "delete") return { label: "Comandă ștearsă", tone: "bg-destructive/15 text-destructive" };
    if (c?.status === "completed") return { label: "Comandă finalizată", tone: "bg-primary/25 text-primary" };
    if (c?.status === "in_progress") return { label: "Comandă pornită", tone: "bg-primary/15 text-primary" };
    const keys = Object.keys(c || {}).filter((k) => k !== "updated_at").slice(0, 3).join(", ");
    return { label: `Comandă modificată${keys ? ` (${keys})` : ""}`, tone: "bg-muted" };
  }
  return { label: `Restoc ${e.action}`, tone: "bg-muted" };
};

type Props = {
  orders: any[];
  allOrders?: any[];
  lineName?: (o: any) => string | undefined;
  onOpenOrder?: (o: any) => void;
};

export default function OperatorDaySummary({ orders, allOrders = [], lineName, onOpenOrder }: Props) {
  const { data: ingMap } = useIngredientCounts();
  const { total, byCat } = computeStats(orders, ingMap);
  const [detail, setDetail] = useState<{ title: string; list: any[] } | null>(null);
  const [panel, setPanel] = useState<null | "new" | "ops">(null);

  const audit = useQuery({
    queryKey: ["operator-recent-audit"],
    enabled: panel === "ops",
    refetchInterval: panel === "ops" ? 30_000 : false,
    queryFn: async () => {
      const { data, error } = await supabaseCloud
        .from("productie_comenzi_audit")
        .select("id, table_name, action, comanda_ids, changes, user_email, user_name, created_at")
        .order("created_at", { ascending: false })
        .limit(150);
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const byId = new Map((allOrders.length ? allOrders : orders).map((o: any) => [o.id, o]));
  const newest = [...(allOrders.length ? allOrders : orders)]
    .filter((o: any) => o.created_at)
    .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 60);

  const open = (o: any) => {
    if (!o || !onOpenOrder) return;
    setDetail(null); setPanel(null);
    onOpenOrder(o);
  };

  const OrderRow = ({ o, extra }: { o: any; extra?: React.ReactNode }) => {
    const cerut = Number(o.cantitate || 0);
    const facut = Math.min(cerut, Number(o.cantitate_reala_produsa || 0) + Number(o.cantitate_din_restock || 0));
    return (
      <button type="button" onClick={() => open(o)}
        className={`w-full text-left border rounded-md p-2 hover:bg-muted flex flex-wrap gap-x-3 gap-y-1 items-center text-xs ${isDone(o) ? "opacity-70" : ""}`}>
        {extra}
        <span className="font-semibold text-sm">{o.productie_produse?.nume || "-"}</span>
        <span className="text-muted-foreground">{o.magazin || o.productie_clienti?.nume || ""}</span>
        <span>{fmt(facut)} / {fmt(cerut)} buc</span>
        {o.data_productie && <span className="text-muted-foreground">prod. {new Date(o.data_productie).toLocaleDateString("ro-RO")}</span>}
        <Badge variant="outline" className="ml-auto">{lineName?.(o) || "fără linie"}</Badge>
        {isDone(o) && <Badge>Gata</Badge>}
      </button>
    );
  };

  const openStat = (title: string, pred: (o: any) => boolean, src: any[] = orders) =>
    setDetail({ title, list: src.filter((o) => Number(o.cantitate || 0) > 0 && pred(o)) });

  const MiniStat = ({ label, value, cls = "", onClick }: { label: string; value: string | number; cls?: string; onClick?: () => void }) => (
    <div role="button" onClick={onClick} className="rounded-md bg-muted px-2 py-1.5 text-center cursor-pointer hover:ring-2 hover:ring-primary/40">
      <div className="text-[10px] leading-tight text-muted-foreground">{label}</div>
      <div className={`text-base font-bold leading-tight ${cls}`}>{value}</div>
    </div>
  );

  return (
    <>
    <div className="flex flex-wrap gap-2 justify-end">
      <Button size="sm" variant="outline" onClick={() => setPanel("new")}><Bell className="h-4 w-4 mr-1" />Ultimele comenzi adăugate</Button>
      <Button size="sm" variant="outline" onClick={() => setPanel("ops")}><History className="h-4 w-4 mr-1" />Ultimele operațiuni pe comenzi</Button>
    </div>
    {total.comenzi > 0 && (
    <Card className="border-coral-200">
      <CardContent className="pt-3 pb-3 space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <Donut pct={pctOf(total)} />
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 flex-1 w-full">
            <MiniStat label="Bucăți de făcut" value={fmt(total.cerut)} onClick={() => openStat("Toate comenzile zilei", () => true)} />
            <MiniStat label="Bucăți făcute" value={fmt(total.facut)} cls="text-primary" onClick={() => openStat("Comenzi cu bucăți făcute", (o) => Number(o.cantitate_reala_produsa || 0) + Number(o.cantitate_din_restock || 0) > 0 || o.status === "completed")} />
            <MiniStat label="Bucăți rămase" value={fmt(total.cerut - total.facut)} cls="text-destructive" onClick={() => openStat("Comenzi cu bucăți rămase", (o) => !isDone(o))} />
            <MiniStat label="Comenzi total" value={total.comenzi} onClick={() => openStat("Toate comenzile zilei", () => true)} />
            <MiniStat label="Finalizate (≥100%)" value={total.gata} cls="text-primary" onClick={() => openStat("Comenzi finalizate", isDone)} />
            <MiniStat label="Comenzi rămase" value={total.comenzi - total.gata} cls="text-destructive" onClick={() => openStat("Comenzi rămase", (o) => !isDone(o))} />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {CATEGORIES.map((k) => {
            const s = byCat[k];
            return (
              <div key={k} role="button" onClick={() => openStat(`${k} — comenzile zilei`, (o) => categoryOf(o, ingMap) === k)} className="border rounded-md px-2 py-1.5 flex items-center gap-2 cursor-pointer hover:bg-muted">
                <Donut pct={pctOf(s)} size={44} stroke={6} />
                <div className="text-[11px] leading-tight min-w-0">
                  <div className="font-semibold text-xs">{k}</div>
                  <div>{fmt(s.facut)} / {fmt(s.cerut)} buc</div>
                  <div className="text-muted-foreground">rămas {fmt(s.cerut - s.facut)} · {s.gata}/{s.comenzi} com</div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
    )}

    <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader><DialogTitle>{detail?.title} ({detail?.list.length})</DialogTitle></DialogHeader>
        <div className="overflow-y-auto space-y-1.5 pr-1">
          {detail?.list.sort((a, b) => Number(isDone(a)) - Number(isDone(b))).map((o) => <OrderRow key={o.id} o={o} />)}
          {detail?.list.length === 0 && <p className="text-sm text-muted-foreground">Nicio comandă.</p>}
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={panel === "new"} onOpenChange={(o) => !o && setPanel(null)}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader><DialogTitle>Ultimele comenzi adăugate</DialogTitle></DialogHeader>
        <div className="overflow-y-auto space-y-1.5 pr-1">
          {newest.map((o) => (
            <OrderRow key={o.id} o={o} extra={<span className="font-mono text-muted-foreground">{fmtDt(o.created_at)}</span>} />
          ))}
          {newest.length === 0 && <p className="text-sm text-muted-foreground">Nicio comandă.</p>}
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={panel === "ops"} onOpenChange={(o) => !o && setPanel(null)}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader><DialogTitle>Ultimele operațiuni pe comenzi</DialogTitle></DialogHeader>
        <div className="overflow-y-auto space-y-1.5 pr-1">
          {audit.isLoading && <p className="text-sm text-muted-foreground">Se încarcă…</p>}
          {(audit.data || []).map((e: any) => {
            const d = describeAudit(e);
            const o = (e.comanda_ids || []).map((id: string) => byId.get(id)).find(Boolean);
            return (
              <button key={e.id} type="button" disabled={!o} onClick={() => open(o)}
                className="w-full text-left border rounded-md p-2 hover:bg-muted disabled:hover:bg-transparent text-xs flex flex-wrap gap-2 items-center">
                <span className="font-mono">{fmtDt(e.created_at)}</span>
                <span className={`px-1.5 py-0.5 rounded ${d.tone}`}>{d.label}</span>
                <span className="text-muted-foreground">de <b className="text-foreground">{e.user_name || e.user_email || "necunoscut"}</b></span>
                {o ? (
                  <>
                    <span className="font-semibold">{o.productie_produse?.nume}</span>
                    <span className="text-muted-foreground">{o.magazin || o.productie_clienti?.nume}</span>
                    <Badge variant="outline" className="ml-auto">{lineName?.(o) || "fără linie"}</Badge>
                  </>
                ) : (
                  <span className="text-muted-foreground ml-auto">comanda nu e în lista încărcată</span>
                )}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
