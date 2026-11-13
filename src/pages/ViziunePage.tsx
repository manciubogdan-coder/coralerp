import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import BackToHubButton from "@/components/BackToHubButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFactoryData } from "@/components/viziune/useFactoryData";
import { FactoryScene, ZONES, type Selection, type Zone } from "@/components/viziune/FactoryScene";
import { producedOf } from "@/lib/viziune/factoryState";
import { RefreshCw, X } from "lucide-react";

const fmt = (n: number) => Math.round(n).toLocaleString("ro-RO");
const STATUS_LABEL: Record<string, string> = { lucreaza: "Lucrează", asteapta: "În așteptare", terminat: "Gata pe azi", oprita: "Oprită" };
const ORDER_STATUS: Record<string, string> = { pending: "Neîncepută", assigned: "Pe linie", in_progress: "În lucru", partial: "Parțial", completed: "Gata" };

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card/95 px-3 py-2 shadow">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-black tabular-nums leading-tight">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

export default function ViziunePage() {
  const navigate = useNavigate();
  const data = useFactoryData();
  const [zone, setZone] = useState<Zone>("all");
  const [sel, setSel] = useState<Selection>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => { const t = setInterval(() => data.refetch(), 30_000); return () => clearInterval(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const real = data.orders.filter((o) => o.magazin !== "PRODUCTIE_AVANS" && o.magazin !== "REAMBALARE");
  const pieces = real.reduce((a, o) => a + (Number(o.cantitate) || 0), 0);
  const produced = real.reduce((a, o) => a + producedOf(o), 0);
  const working = data.lineViews.filter((l) => l.status === "lucreaza");
  const people = data.lineViews.reduce((a, l) => a + l.workers, 0);
  const recKg = data.receptions.reduce((a, r) => a + r.kg, 0);
  const line = sel?.kind === "line" ? data.lineViews.find((l) => l.id === sel.id) : null;

  const select = (s: Selection) => {
    setSel(s);
    if (s?.kind === "receptie") setZone("receptie");
    if (s?.kind === "depozit") setZone("depozit");
    if (s?.kind === "livrare") setZone("livrare");
  };

  return (
    <div className="relative h-[calc(100vh-4rem)] w-full overflow-hidden bg-background" data-scene-ready={ready ? "" : undefined}>
      {/* top HUD */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-wrap items-start gap-2">
        <div className="pointer-events-auto flex items-center gap-2 rounded-lg border bg-card/95 px-3 py-2 shadow">
          <BackToHubButton />
          <div>
            <h1 className="text-base font-black leading-tight">Viziune · Fabrica Coral live</h1>
            <p className="text-[10px] text-muted-foreground">{data.today} · actualizat {data.updatedAt ? new Date(data.updatedAt).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" }) : "…"} · se reîmprospătează la 30 s</p>
          </div>
          <Button size="icon" variant="ghost" onClick={() => data.refetch()} title="Reîmprospătează"><RefreshCw className="h-4 w-4" /></Button>
        </div>
        <Kpi label="Producție azi" value={pieces ? `${Math.round((produced / pieces) * 100)}%` : "—"} sub={`${fmt(produced)} / ${fmt(pieces)} buc`} />
        <Kpi label="Linii care lucrează" value={`${working.length} / ${data.lineViews.length}`} sub={`${people} oameni pe linii`} />
        <Kpi label="Comenzi azi" value={fmt(real.length)} sub={`${real.filter((o) => o.status === "completed").length} gata · ${data.unassigned.length} fără linie`} />
        <Kpi label="Recepții azi" value={`${fmt(recKg)} kg`} sub={`${data.receptions.length} furnizori`} />
        <Kpi label="Prerecepții de descărcat" value={`${(data.prereceptions ?? []).length} camioane`} sub={`${fmt((data.prereceptions ?? []).reduce((a, p) => a + p.kgLeft, 0))} kg${(data.prereceptions ?? []).some((p) => p.late) ? ` · ${(data.prereceptions ?? []).filter((p) => p.late).length} întârziate` : ""}`} />
        <Kpi label="Gata de livrare" value={`${data.ready.length} magazine`} sub={`${fmt(data.ready.reduce((a, r) => a + r.pieces, 0))} buc`} />
      </div>

      {/* zone camera buttons */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-wrap gap-1.5 rounded-lg border bg-card/95 p-1.5 shadow">
        {(Object.keys(ZONES) as Zone[]).map((z) => (
          <Button key={z} size="sm" variant={zone === z ? "default" : "ghost"} onClick={() => setZone(z)}>{ZONES[z].label}</Button>
        ))}
      </div>

      {/* legend */}
      <div className="absolute bottom-3 right-3 z-10 hidden rounded-lg border bg-card/95 px-3 py-2 text-[10px] shadow md:block">
        <div className="mb-1 font-semibold">Lumina de pe linie</div>
        <div className="flex gap-3"><span>🟢 lucrează</span><span>🟡 așteaptă</span><span>🔵 gata</span><span>🔴 oprită</span></div>
        <div className="mt-1 text-muted-foreground">Trage = rotire · rotiță = zoom · clic dreapta = mutare · clic pe linie/zonă = detalii</div>
      </div>

      {/* detail panel */}
      {sel && (
        <div className="absolute right-3 top-28 z-20 flex max-h-[calc(100%-10rem)] w-[min(92vw,380px)] flex-col rounded-xl border bg-card/97 shadow-xl">
          <div className="flex items-start justify-between gap-2 border-b p-3">
            <div>
              <div className="text-base font-black">{line ? line.name : sel.kind === "receptie" ? "Recepție azi" : sel.kind === "depozit" ? "Depozit materie primă" : "Gata de livrare"}</div>
              {line && <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"><Badge variant="secondary">{STATUS_LABEL[line.status]}</Badge>{line.operator && <span>{line.operator} · {line.workers} oameni</span>}</div>}
            </div>
            <Button size="icon" variant="ghost" onClick={() => setSel(null)}><X className="h-4 w-4" /></Button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 text-sm">
            {line && (line.orders.length === 0 ? <p className="text-muted-foreground">Nicio comandă pe linia asta azi.</p> : (
              <table className="w-full text-xs">
                <thead className="text-muted-foreground"><tr><th className="pb-1 text-left">Produs / magazin</th><th className="pb-1 text-right">Făcut</th><th className="pb-1 text-right">Stare</th></tr></thead>
                <tbody>{line.orders.map((o) => (
                  <tr key={o.id} className="border-t">
                    <td className="py-1 pr-2"><div className="font-medium">{o.productie_produse?.nume ?? "—"}</div><div className="text-muted-foreground">{o.magazin === "PRODUCTIE_AVANS" ? "Avans" : o.magazin}</div></td>
                    <td className="py-1 text-right tabular-nums">{fmt(producedOf(o))}/{fmt(Number(o.cantitate) || 0)}</td>
                    <td className="py-1 text-right">{ORDER_STATUS[o.status] ?? o.status}</td>
                  </tr>))}</tbody>
              </table>
            ))}
            {sel.kind === "receptie" && <>
              <div className="mb-1 text-xs font-bold uppercase text-muted-foreground">La poartă — prerecepții nedescărcate</div>
              {(data.prereceptions ?? []).length === 0 ? <p className="mb-3 text-xs text-muted-foreground">Nimic anunțat care să mai aștepte.</p> : (data.prereceptions ?? []).map((p) => (
                <div key={p.id} className="border-b py-1.5 last:border-0">
                  <div className="flex justify-between font-medium"><span>{p.supplier}</span><span className="tabular-nums">{fmt(p.kgLeft)} kg</span></div>
                  <div className="text-xs text-muted-foreground">{p.doc && `Doc ${p.doc} · `}{p.linesLeft}/{p.linesTotal} poziții de recepționat{p.late && <span className="font-semibold text-destructive"> · întârziat (anunțat {p.expected})</span>}</div>
                  <div className="text-xs text-muted-foreground">{p.products.slice(0, 5).join(", ")}</div>
                </div>
              ))}
              <div className="mb-1 mt-3 text-xs font-bold uppercase text-muted-foreground">Recepționat azi</div>
              {data.receptions.length === 0 ? <p className="text-xs text-muted-foreground">Nicio recepție azi.</p> : data.receptions.map((r) => (
                <div key={r.supplier} className="border-b py-1.5 last:border-0"><div className="flex justify-between font-medium"><span>{r.supplier}</span><span className="tabular-nums">{fmt(r.kg)} kg</span></div><div className="text-xs text-muted-foreground">{r.lots} loturi · {[...r.products].slice(0, 4).join(", ")}</div></div>
              ))}
            </>}
            {sel.kind === "depozit" && data.stock.slice(0, 60).map((s) => (
              <div key={s.name} className="flex justify-between border-b py-1 text-xs last:border-0"><span>{s.name}</span><span className="tabular-nums">{fmt(s.qty)} {s.unit}</span></div>
            ))}
            {sel.kind === "livrare" && (data.ready.length === 0 ? <p className="text-muted-foreground">Încă nu e marfă gata azi.</p> : data.ready.map((r) => (
              <div key={r.store} className="flex justify-between border-b py-1 text-xs last:border-0"><span>{r.store}</span><span className="tabular-nums">{fmt(r.pieces)} buc · {r.orders} com.</span></div>
            )))}
          </div>
          <div className="border-t p-2">
            <Button className="w-full" variant="outline" onClick={() => navigate(line ? "/operator" : sel.kind === "receptie" ? "/depozit-mp" : sel.kind === "depozit" ? "/depozit-mp" : "/picking")}>
              Deschide {line ? "Operator" : sel.kind === "livrare" ? "Picking" : "Depozit MP"}
            </Button>
          </div>
        </div>
      )}

      {data.error && <div className="absolute left-1/2 top-24 z-20 -translate-x-1/2 rounded-lg border border-destructive bg-card px-3 py-2 text-sm text-destructive shadow">Nu am putut citi datele: {data.error.message}</div>}

      <Canvas shadows dpr={[1, 1.75]} camera={{ position: ZONES.all.pos, fov: 42, near: 0.5, far: 300 }} onCreated={() => setTimeout(() => setReady(true), 500)} onPointerMissed={() => setSel(null)}>
        <FactoryScene data={data} zone={zone} selection={sel} onSelect={select} />
      </Canvas>
    </div>
  );
}
