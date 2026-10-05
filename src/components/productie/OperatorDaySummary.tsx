import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

export default function OperatorDaySummary({ orders }: { orders: any[] }) {
  const { total, byCat } = computeStats(orders);
  if (total.comenzi === 0) return null;

  const MiniStat = ({ label, value, cls = "" }: { label: string; value: string | number; cls?: string }) => (
    <div className="rounded-md bg-muted px-2 py-1.5 text-center">
      <div className="text-[10px] leading-tight text-muted-foreground">{label}</div>
      <div className={`text-base font-bold leading-tight ${cls}`}>{value}</div>
    </div>
  );

  return (
    <Card className="border-coral-200">
      <CardContent className="pt-3 pb-3 space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <Donut pct={pctOf(total)} />
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 flex-1 w-full">
            <MiniStat label="Bucăți de făcut" value={fmt(total.cerut)} />
            <MiniStat label="Bucăți făcute" value={fmt(total.facut)} cls="text-primary" />
            <MiniStat label="Bucăți rămase" value={fmt(total.cerut - total.facut)} cls="text-destructive" />
            <MiniStat label="Comenzi total" value={total.comenzi} />
            <MiniStat label="Finalizate (≥100%)" value={total.gata} cls="text-primary" />
            <MiniStat label="Comenzi rămase" value={total.comenzi - total.gata} cls="text-destructive" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {CATEGORIES.map((k) => {
            const s = byCat[k];
            return (
              <div key={k} className="border rounded-md px-2 py-1.5 flex items-center gap-2">
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
  );
}
