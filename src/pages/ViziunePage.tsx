import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import BackToHubButton from "@/components/BackToHubButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFactoryData } from "@/components/viziune/useFactoryData";
import { FactoryScene, ZONES, type CameraCmd, type Selection, type Zone } from "@/components/viziune/FactoryScene";
import { NavPad } from "@/components/viziune/NavPad";
import type { NavAction } from "@/lib/viziune/cameraNav";
import { producedOf, remainingOf, type LineView } from "@/lib/viziune/factoryState";
import { defaultLayout, toWorld, type HallStation } from "@/lib/viziune/hallLayout";
import { HallEditor } from "@/components/viziune/HallEditor";
import { toast } from "sonner";
import { clockTime, minutesLabel, PaceBadge } from "@/components/viziune/pace";
import { AlertTriangle, LayoutGrid, RefreshCw, X } from "lucide-react";
import { useOfficeData } from "@/components/viziune/useOfficeData";
import { OfficeDetail, OfficesOverview, type OfficeFacts } from "@/components/viziune/OfficeDetail";
import { buildingOf, OFFICES } from "@/lib/viziune/officeState";
import { OfficeEditor } from "@/components/viziune/OfficeEditor";

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

function LineDetail({ line }: { line: LineView }) {
  const p = line.pace;
  const late = p.status === "intarziat";
  const queue = line.orders.filter((o) => !p.orders.some((w) => w.id === o.id) && remainingOf(o) > 0);
  const done = line.orders.filter((o) => !p.orders.some((w) => w.id === o.id) && remainingOf(o) === 0);
  return (
    <div className="space-y-3">
      <div className={`rounded-lg border p-2 text-xs ${late ? "border-destructive bg-destructive/10" : "bg-muted/40"}`}>
        <div className="mb-1 font-bold">Normă linie: {line.norm > 0 ? `${fmt(line.norm)} buc/oră` : "nesetată"}</div>
        {p.orders.length === 0 ? <div className="text-muted-foreground">Acum nu rulează nicio comandă pe linie.</div> : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 tabular-nums">
            <span className="text-muted-foreground">Început la</span><span className="text-right font-semibold">{clockTime(p.startedAt)}</span>
            <span className="text-muted-foreground">Lucrat efectiv</span><span className="text-right font-semibold">{minutesLabel(p.workedHours * 60)}</span>
            <span className="text-muted-foreground">Timp după normă</span><span className="text-right font-semibold">{p.normHours != null ? minutesLabel(p.normHours * 60) : "—"}</span>
            <span className="text-muted-foreground">{late ? "Trebuia gata la" : "Ar trebui gata la"}</span><span className={`text-right font-bold ${late ? "text-destructive" : ""}`}>{clockTime(p.dueAt)}</span>
            <span className="text-muted-foreground">Bucăți în lucru</span><span className="text-right font-semibold">{fmt(p.qty)}</span>
            {line.norm > 0 && <><span className="text-muted-foreground">Ar trebui făcute până acum</span><span className="text-right font-semibold">~{fmt(p.expectedNow)}</span></>}
          </div>
        )}
        {late && <div className="mt-1.5 font-bold text-destructive">⚠ Depășit cu {minutesLabel(p.lateMinutes)} față de normă și încă nu e închisă.</div>}
        {p.status === "aproape" && <div className="mt-1.5 font-semibold text-crm-warning">A folosit peste 90% din timpul normat.</div>}
        {p.otherDayOrders > 0 && <div className="mt-1.5 text-muted-foreground">+{p.otherDayOrders} comenzi în lucru planificate pe altă zi (nu intră în calcul).</div>}
        {p.forgotten.length > 0 && <div className="mt-1.5 font-semibold text-crm-warning">{p.forgotten.length} sesiuni lăsate deschise de peste 12 ore (cea mai veche din {new Date(Math.min(...p.forgotten.map((f) => Date.parse(f.ora_start || "")))).toLocaleDateString("ro-RO")}) — nu le-am socotit. Închide-le din Operator.</div>}
        {line.norm > 0 && (p.orders.length > 0 || p.queueOrders > 0) && <div className="mt-1.5 text-muted-foreground">Termină tot ce are azi pe la <b className="text-foreground">{clockTime(p.dayDoneAt)}</b> ({p.queueOrders} comenzi · {fmt(p.queueQty)} buc încă neîncepute)</div>}
      </div>
      {p.orders.length > 0 && <div>
        <div className="mb-1 text-xs font-bold uppercase text-muted-foreground">În lucru acum</div>
        <table className="w-full text-xs"><tbody>{p.orders.map((o) => (
          <tr key={o.id} className="border-t"><td className="py-1 pr-2"><div className="font-medium">{o.product}</div><div className="text-muted-foreground">{o.store}</div></td>
            <td className="py-1 text-right tabular-nums"><div>{fmt(o.qty)} buc</div><div className="text-muted-foreground">de la {clockTime(o.startedAt)}{o.normMinutes != null ? ` · normă ${minutesLabel(o.normMinutes)}` : ""}</div></td></tr>
        ))}</tbody></table>
      </div>}
      {queue.length > 0 && <div>
        <div className="mb-1 text-xs font-bold uppercase text-muted-foreground">Urmează pe linie</div>
        <table className="w-full text-xs"><tbody>{queue.map((o) => (
          <tr key={o.id} className="border-t"><td className="py-1 pr-2"><div className="font-medium">{o.productie_produse?.nume ?? "—"}</div><div className="text-muted-foreground">{o.magazin === "PRODUCTIE_AVANS" ? "Avans" : o.magazin}</div></td>
            <td className="py-1 text-right tabular-nums"><div>{fmt(remainingOf(o))} buc</div><div className="text-muted-foreground">{line.norm > 0 ? `normă ${minutesLabel((remainingOf(o) / line.norm) * 60)}` : ORDER_STATUS[o.status] ?? o.status}</div></td></tr>
        ))}</tbody></table>
      </div>}
      {done.length > 0 && <div>
        <div className="mb-1 text-xs font-bold uppercase text-muted-foreground">Gata azi</div>
        {done.map((o) => <div key={o.id} className="flex justify-between border-t py-1 text-xs"><span className="truncate pr-2">{o.productie_produse?.nume ?? "—"} · {o.magazin === "PRODUCTIE_AVANS" ? "Avans" : o.magazin}</span><span className="tabular-nums">{fmt(producedOf(o))}/{fmt(Number(o.cantitate) || 0)}</span></div>)}
      </div>}
      {line.orders.length === 0 && <p className="text-muted-foreground">Nicio comandă pe linia asta azi.</p>}
    </div>
  );
}

export default function ViziunePage() {
  const navigate = useNavigate();
  const data = useFactoryData();
  const offices = useOfficeData();
  const [officeEdit, setOfficeEdit] = useState(false);
  const [zone, setZoneState] = useState<Zone>("all");
  const [cam, setCam] = useState<CameraCmd>({ seq: 0, kind: "zone", zone: "all" });
  const setZone = (z: Zone) => { setZoneState(z); setCam((c) => ({ seq: c.seq + 1, kind: "zone", zone: z })); };
  const nav = (action: NavAction) => setCam((c) => ({ seq: c.seq + 1, kind: "nav", action }));
  const flyToStation = (stationId: string | null) => {
    const st = (draft ?? data.layout).find((x) => x.id === stationId);
    if (!st) return false;
    const [x, z] = toWorld(st.px, st.py);
    setZoneState("productie"); setCam((c) => ({ seq: c.seq + 1, kind: "focus", x, z }));
    return true;
  };
  const [sel, setSel] = useState<Selection>(null);
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState<HallStation[] | null>(null);
  const editing = draft !== null;
  const changed = editing && JSON.stringify(draft) !== JSON.stringify(data.layout);

  useEffect(() => { const t = setInterval(() => data.refetch(), 30_000); return () => clearInterval(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard: arrows / WASD move, Q/E rotate, +/- zoom (ignored while typing in a field).
  useEffect(() => {
    const keys: Record<string, NavAction> = { ArrowUp: "inainte", w: "inainte", ArrowDown: "inapoi", s: "inapoi", ArrowLeft: "stanga", a: "stanga", ArrowRight: "dreapta", d: "dreapta", q: "rotStanga", e: "rotDreapta", "+": "aproape", "=": "aproape", "-": "departe" };
    const onKey = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement | null;
      if (ev.ctrlKey || ev.metaKey || ev.altKey || (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.getAttribute("role") === "combobox"))) return;
      const a = keys[ev.key.length === 1 ? ev.key.toLowerCase() : ev.key];
      if (!a) return;
      ev.preventDefault(); nav(a);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const real = data.orders.filter((o) => o.magazin !== "PRODUCTIE_AVANS" && o.magazin !== "REAMBALARE");
  const pieces = real.reduce((a, o) => a + (Number(o.cantitate) || 0), 0);
  const produced = real.reduce((a, o) => a + producedOf(o), 0);
  const working = data.lineViews.filter((l) => l.status === "lucreaza");
  const people = data.lineViews.reduce((a, l) => a + l.workers, 0);
  const recKg = data.receptions.reduce((a, r) => a + r.kg, 0);
  const line = sel?.kind === "line" ? data.lineViews.find((l) => l.id === sel.id) : null;
  const late = data.lineViews.filter((l) => l.pace.status === "intarziat").sort((a, b) => b.pace.lateMinutes - a.pace.lateMinutes);
  const stationOfLine = (id: string) => [...data.placement.byStation.entries()].find(([, lid]) => lid === id)?.[0] ?? null;
  const emptyStation = sel?.kind === "station" ? data.layout.find((st) => st.id === sel.id) : null;

  const startEdit = (stationId: string | null = null) => {
    setDraft(data.layout.map((st) => ({ ...st })));
    setSel(stationId ? { kind: "station", id: stationId } : null);
    setZone("plan");
  };
  const stopEdit = () => {
    if (changed && !window.confirm("Ai schimbări nesalvate în hală. Renunți la ele?")) return;
    setDraft(null); setSel(null);
  };
  const saveDraft = async () => {
    if (!draft) return;
    try { await data.saveLayout(draft); toast.success("Hala a fost salvată pentru toți colegii."); setDraft(null); setSel(null); }
    catch (e) { toast.error(`Nu s-a salvat: ${(e as Error).message}`); }
  };
  const moveStation = (id: string, px: number, py: number) => setDraft((d) => d && d.map((st) => (st.id === id && (st.px !== px || st.py !== py) ? { ...st, px, py } : st)));

  const select = (s: Selection) => {
    if (editing) { setSel(s?.kind === "station" ? s : null); return; }
    setSel(s);
    if (s?.kind === "line") { if (!flyToStation(stationOfLine(s.id))) setZone("productie"); }
    if (s?.kind === "station") { if (!flyToStation(s.id)) setZone("productie"); }
    if (s?.kind === "receptie") setZone("receptie");
    if (s?.kind === "depozit") setZone("depozit");
    if (s?.kind === "livrare") setZone("livrare");
    if (s?.kind === "birouri") setZone("birouri");
    if (s?.kind === "office") setZone(buildingOf(s.id, offices.order) === "hala" ? "birouriHala" : "birouri");
  };
  const officeFacts: OfficeFacts = {
    linesWorking: working.length, linesTotal: data.lineViews.length, producedPct: pieces ? Math.round((produced / pieces) * 100) : null,
    lateLines: late.length, receptionLots: data.receptions.reduce((a, r) => a + r.lots, 0), receptionKg: recKg,
    prereceptions: (data.prereceptions ?? []).length, stoppedLines: data.lineViews.filter((l) => l.status === "oprita").length,
  };
  const officeNow = offices.people.filter((p) => p.status === "aplicatie" || p.status === "senior").length;
  const seniorDocs = [...offices.docTotals.values()].reduce((a, t) => a + t.n, 0);
  const isOffice = sel?.kind === "office" || sel?.kind === "birouri";

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
          <Button size="icon" variant="ghost" onClick={() => { data.refetch(); offices.refetch(); }} title="Reîmprospătează"><RefreshCw className="h-4 w-4" /></Button>
          <Button size="sm" variant={editing ? "default" : "outline"} disabled={editing || data.layoutLoading} onClick={() => startEdit()} title="Mută, adaugă sau scoate utilaje și alege ce linie lucrează pe fiecare">
            <LayoutGrid className="mr-1 h-4 w-4" />Aranjează hala
          </Button>
        </div>
        <Kpi label="Producție azi" value={pieces ? `${Math.round((produced / pieces) * 100)}%` : "—"} sub={`${fmt(produced)} / ${fmt(pieces)} buc`} />
        <Kpi label="Linii care lucrează" value={`${working.length} / ${data.lineViews.length}`} sub={`${people} oameni pe linii`} />
        <button type="button" className="pointer-events-auto text-left" onClick={() => late[0] && select({ kind: "line", id: late[0].id })}>
          <div className={`rounded-lg border px-3 py-2 shadow ${late.length ? "border-destructive bg-destructive text-destructive-foreground" : "bg-card/95"}`}>
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide opacity-80"><AlertTriangle className="h-3 w-3" />Peste normă</div>
            <div className="text-lg font-black tabular-nums leading-tight">{late.length ? `${late.length} linii` : "Nimic"}</div>
            <div className="max-w-[220px] truncate text-[10px] opacity-80">{late.length ? late.map((l) => `${l.name} +${minutesLabel(l.pace.lateMinutes)}`).join(" · ") : "toate comenzile în lucru sunt în timp"}</div>
          </div>
        </button>
        <Kpi label="Comenzi azi" value={fmt(real.length)} sub={`${real.filter((o) => o.status === "completed").length} gata · ${data.unassigned.length} fără linie`} />
        <Kpi label="Recepții azi" value={`${fmt(recKg)} kg`} sub={`${data.receptions.length} furnizori`} />
        <Kpi label="Prerecepții de descărcat" value={`${(data.prereceptions ?? []).length} camioane`} sub={`${fmt((data.prereceptions ?? []).reduce((a, p) => a + p.kgLeft, 0))} kg${(data.prereceptions ?? []).some((p) => p.late) ? ` · ${(data.prereceptions ?? []).filter((p) => p.late).length} întârziate` : ""}`} />
        <button type="button" className="pointer-events-auto text-left" onClick={() => select({ kind: "birouri" })}>
          <Kpi label="Birouri" value={offices.loading ? "…" : `${officeNow} lucrează acum`} sub={offices.error ? "nu s-au putut citi" : `${seniorDocs} documente Senior azi${offices.seniorError ? " · Senior indisponibil" : ""}`} />
        </button>
        <Kpi label="Gata de livrare" value={`${data.ready.length} magazine`} sub={`${fmt(data.ready.reduce((a, r) => a + r.pieces, 0))} buc`} />
      </div>

      <NavPad onNav={nav} onHome={() => setZone("all")}
        lines={data.lineViews.filter((l) => stationOfLine(l.id)).map((l) => ({ id: l.id, name: l.name, workers: l.workers, late: l.pace.status === "intarziat" }))}
        onLine={(id) => select({ kind: "line", id })} />

      {/* zone camera buttons */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-wrap gap-1.5 rounded-lg border bg-card/95 p-1.5 shadow">
        {(Object.keys(ZONES) as Zone[]).map((z) => (
          <Button key={z} size="sm" variant={zone === z ? "default" : "ghost"} onClick={() => setZone(z)}>{ZONES[z].label}</Button>
        ))}
      </div>

      {/* legend */}
      <div className="absolute bottom-3 right-3 z-10 hidden rounded-lg border bg-card/95 px-3 py-2 text-[10px] shadow md:block">
        <div className="mb-1 font-semibold">Lumina de pe linie</div>
        <div className="flex gap-3"><span>🟢 lucrează</span><span>🟡 așteaptă</span><span>🔵 gata</span><span>⚪ oprită</span><span className="font-bold text-destructive">🔴 ⚠ peste normă</span></div>
        <div className="mt-1 flex gap-3"><span className="font-semibold text-crm-cool">━ materie primă</span><span className="font-semibold text-crm-green">━ produs finit</span><span className="font-semibold text-crm-warning">━ graniță igienă</span></div>
        <div className="mt-1 text-muted-foreground">Trage = rotire · rotiță = zoom · clic dreapta = mutare · clic pe linie/zonă = detalii</div>
      </div>

      {/* detail panel */}
      {editing && draft && (
        <HallEditor draft={draft} setDraft={setDraft} selectedId={sel?.kind === "station" ? sel.id : null}
          setSelectedId={(id) => setSel(id ? { kind: "station", id } : null)}
          lines={data.lines} onSave={saveDraft} onCancel={stopEdit} saving={data.savingLayout} changed={changed}
          onReset={() => { if (window.confirm("Pui la loc utilajele și liniile din planul inițial al halei?")) { setDraft(defaultLayout(data.lines)); setSel(null); } }} />
      )}

      {sel && !editing && (
        <div className="absolute right-3 top-28 z-20 flex max-h-[calc(100%-10rem)] w-[min(92vw,380px)] flex-col rounded-xl border bg-card shadow-xl">
          <div className="flex items-start justify-between gap-2 border-b p-3">
            <div>
              <div className="text-base font-black">{line ? line.name : emptyStation ? emptyStation.label : sel.kind === "office" ? OFFICES[sel.id].label : sel.kind === "birouri" ? "Birourile firmei azi" : sel.kind === "receptie" ? "Recepție azi" : sel.kind === "depozit" ? "Depozit materie primă" : "Gata de livrare"}</div>
              {line && <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"><Badge variant="secondary">{STATUS_LABEL[line.status]}</Badge><PaceBadge pace={line.pace} />{line.operator && <span>{line.operator} · {line.workers} oameni</span>}</div>}
            </div>
            <Button size="icon" variant="ghost" onClick={() => setSel(null)}><X className="h-4 w-4" /></Button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 text-sm">
            {line && <LineDetail line={line} />}
            {sel.kind === "office" && <OfficeDetail id={sel.id} offices={offices} facts={officeFacts} onEdit={() => setOfficeEdit(true)} />}
            {sel.kind === "birouri" && <OfficesOverview offices={offices} onOffice={(id) => select({ kind: "office", id })} onEdit={() => setOfficeEdit(true)} />}
            {isOffice && offices.error && <p className="text-xs text-destructive">Nu am putut citi activitatea birourilor: {offices.error.message}</p>}
            {(line || emptyStation) && (
              <div className="mt-3 border-t pt-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">În hală: <b className="text-foreground">{line ? data.layout.find((st) => st.id === stationOfLine(line.id))?.label ?? "fără loc" : emptyStation!.label}</b></span>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => startEdit(line ? stationOfLine(line.id) : emptyStation!.id)}><LayoutGrid className="mr-1 h-3 w-3" />Mută / schimbă</Button>
                </div>
                {data.layoutInfo && <span className="mt-1 block text-[10px] text-muted-foreground">Hala aranjată de {data.layoutInfo.by ?? "un coleg"} pe {new Date(data.layoutInfo.at).toLocaleDateString("ro-RO")}.</span>}
              </div>
            )}
            {data.placement.unplaced.length > 0 && (line || emptyStation) && <p className="mt-2 text-[10px] text-muted-foreground">Fără loc în hală: {data.placement.unplaced.map((l) => l.nume).join(", ")}</p>}
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
            {isOffice ? <Button className="w-full" variant="outline" onClick={() => navigate("/administrativ/activitate")}>Deschide Activitate (istoric pe zile)</Button> :
            <Button className="w-full" variant="outline" onClick={() => navigate(line || emptyStation ? "/operator" : sel.kind === "receptie" ? "/depozit-mp" : sel.kind === "depozit" ? "/depozit-mp" : "/picking")}>
              Deschide {line || emptyStation ? "Operator" : sel.kind === "livrare" ? "Picking" : "Depozit MP"}
            </Button>}
          </div>
        </div>
      )}

      <OfficeEditor offices={offices} open={officeEdit} onClose={() => setOfficeEdit(false)} />

      {data.error && <div className="absolute left-1/2 top-24 z-20 -translate-x-1/2 rounded-lg border border-destructive bg-card px-3 py-2 text-sm text-destructive shadow">Nu am putut citi datele: {data.error.message}</div>}

      <Canvas shadows dpr={[1, 1.75]} camera={{ position: ZONES.all.pos, fov: 42, near: 0.5, far: 300 }} onCreated={() => setTimeout(() => setReady(true), 500)} onPointerMissed={() => setSel(null)}>
        <FactoryScene data={data} offices={offices} camera={cam} selection={sel} onSelect={select} layout={draft ?? undefined} editing={editing} onMove={moveStation} />
      </Canvas>
    </div>
  );
}
