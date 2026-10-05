import { Card, CardContent } from "@/components/ui/card";

const norm = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const AROMATE_KEYS = [
  "menta", "busuioc", "patrunjel", "marar", "cimbru", "cimbrisor", "rozmarin", "oregano",
  "leustean", "tarhon", "coriandru", "arpagic", "ceapa verde", "salvie", "melisa", "roinita",
  "lavanda", "aromat",
];

export const CATEGORIES = ["Aromate", "Salate mono", "Salate mixte", "Horeca"] as const;
type Cat = (typeof CATEGORIES)[number];

export const categoryOf = (o: any): Cat => {
  const p = norm(o?.productie_produse?.nume || "");
  const c = norm(`${o?.magazin || ""} ${o?.productie_clienti?.nume || ""}`);
  if (p.includes("horeca") || c.includes("horeca")) return "Horeca";
  if (AROMATE_KEYS.some((k) => p.includes(k))) return "Aromate";
  if (p.includes("mix") || p.includes("+") || p.includes("asortat")) return "Salate mixte";
  return "Salate mono";
};

interface Stat { cerut: number; facut: number; comenzi: number; gata: number }
const empty = (): Stat => ({ cerut: 0, facut: 0, comenzi: 0, gata: 0 });

const Donut = ({ pct, size = 140, stroke = 14 }: { pct: number; size?: number; stroke?: number }) => {
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
        className="fill-foreground font-bold" style={{ fontSize: size / 5 }}>
        {Math.round(p)}%
      </text>
    </svg>
  );
};

const fmt = (n: number) => Math.round(n).toLocaleString("ro-RO");

export default function OperatorDaySummary({ orders }: { orders: any[] }) {
  const total = empty();
  const byCat: Record<string, Stat> = Object.fromEntries(CATEGORIES.map((k) => [k, empty()]));

  for (const o of orders) {
    const cerut = Number(o.cantitate || 0);
    if (cerut <= 0) continue;
    const reamb = o.magazin === "REAMBALARE" || o.tip_comanda === "REAMBALARE";
    const acoperit = Number(o.cantitate_reala_produsa || 0) + (reamb ? 0 : Number(o.cantitate_din_restock || 0));
    const facut = o.status === "completed" ? cerut : Math.min(acoperit, cerut);
    const gata = o.status === "completed" || acoperit >= cerut;
    for (const s of [total, byCat[categoryOf(o)]]) {
      s.cerut += cerut;
      s.facut += facut;
      s.comenzi += 1;
      if (gata) s.gata += 1;
    }
  }
  if (total.comenzi === 0) return null;
  const pct = (s: Stat) => (s.cerut > 0 ? (s.facut / s.cerut) * 100 : 0);

  return (
    <Card className="border-coral-200">
      <CardContent className="pt-4 space-y-4">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <Donut pct={pct(total)} />
          <div className="grid grid-cols-3 gap-3 flex-1 w-full text-center">
            <div className="rounded-md bg-muted p-3">
              <div className="text-xs text-muted-foreground">Bucăți de făcut</div>
              <div className="text-xl font-bold">{fmt(total.cerut)}</div>
            </div>
            <div className="rounded-md bg-muted p-3">
              <div className="text-xs text-muted-foreground">Bucăți făcute</div>
              <div className="text-xl font-bold text-primary">{fmt(total.facut)}</div>
            </div>
            <div className="rounded-md bg-muted p-3">
              <div className="text-xs text-muted-foreground">Bucăți rămase</div>
              <div className="text-xl font-bold text-destructive">{fmt(total.cerut - total.facut)}</div>
            </div>
            <div className="rounded-md bg-muted p-3">
              <div className="text-xs text-muted-foreground">Comenzi total</div>
              <div className="text-xl font-bold">{total.comenzi}</div>
            </div>
            <div className="rounded-md bg-muted p-3">
              <div className="text-xs text-muted-foreground">Finalizate (≥100%)</div>
              <div className="text-xl font-bold text-primary">{total.gata}</div>
            </div>
            <div className="rounded-md bg-muted p-3">
              <div className="text-xs text-muted-foreground">Comenzi rămase</div>
              <div className="text-xl font-bold text-destructive">{total.comenzi - total.gata}</div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {CATEGORIES.map((k) => {
            const s = byCat[k];
            return (
              <div key={k} className="border rounded-md p-3 flex items-center gap-3">
                <Donut pct={pct(s)} size={64} stroke={8} />
                <div className="text-xs space-y-0.5 min-w-0">
                  <div className="font-semibold text-sm">{k}</div>
                  <div>{fmt(s.facut)} / {fmt(s.cerut)} buc</div>
                  <div className="text-muted-foreground">rămas {fmt(s.cerut - s.facut)} buc</div>
                  <div>{s.gata} / {s.comenzi} comenzi</div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
