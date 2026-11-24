import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Canvas, useThree } from "@react-three/fiber";
import type * as THREE from "three";
import { PerformanceMonitor } from "@react-three/drei";
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
import { AlertTriangle, ArrowLeft, Footprints, Gamepad2, Home, LayoutGrid, LogOut, MoreVertical, RefreshCw, Sparkles, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { Effects, EffectsGuard } from "@/components/viziune/Effects";
import type { WalkPad } from "@/components/viziune/Walker";
import { OFFICE_PREFIX, ZONE_PREFIX } from "@/lib/viziune/walk";
import type { OfficeId } from "@/lib/viziune/officeState";
import { useOfficeData } from "@/components/viziune/useOfficeData";
import { OfficeDetail, OfficesOverview, type OfficeFacts } from "@/components/viziune/OfficeDetail";
import { buildingOf, OFFICES } from "@/lib/viziune/officeState";
import { OfficeEditor } from "@/components/viziune/OfficeEditor";
import { DepotDetail, PickingDetail } from "@/components/viziune/WarehouseDetail";
import { useWarehousePallets } from "@/components/viziune/useWarehousePallets";
import { depotDetail, pickingDetail } from "@/lib/viziune/warehouseState";
import { clockRo, copilotSnapshot, factorySummary, tourStops, type FactoryInput, type TourStop } from "@/lib/viziune/presentation";
import { TourOverlay, useTour } from "@/components/viziune/Presentation";
import { ArgusCopilot } from "@/components/viziune/ArgusCopilot";
import { Clapperboard } from "lucide-react";

const fmt = (n: number) => Math.round(n).toLocaleString("ro-RO");
const STATUS_LABEL: Record<string, string> = { lucreaza: "Lucrează", asteapta: "În așteptare", terminat: "Gata pe azi", oprita: "Oprită" };
const ORDER_STATUS: Record<string, string> = { pending: "Neîncepută", assigned: "Pe linie", in_progress: "În lucru", partial: "Parțial", completed: "Gata" };

/** One live figure, as small as it can be and still readable from a distance. */
function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="shrink-0 snap-start rounded-md border bg-card/95 px-2 py-0.5 shadow">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="text-sm font-black tabular-nums leading-none">{value}</span>
      </div>
      {sub && <div className="text-[10px] leading-tight text-muted-foreground">{sub}</div>}
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

/** Phones and small tablets: smaller screen, weaker GPU, touch instead of mouse. */
const SMALL_SCREEN = typeof window !== "undefined" && window.innerWidth < 768;
// Phones already have very dense screens; past 1.25× the GPU works hard for detail nobody sees.
const MAX_DPR = SMALL_SCREEN ? 1.25 : 1.5;
type Quality = "inalta" | "rapida";
const QUALITY_KEY = "viziune-grafica";
const readQuality = (): Quality => {
  const fallback: Quality = SMALL_SCREEN ? "rapida" : "inalta";
  try { const v = localStorage.getItem(QUALITY_KEY); return v === "rapida" || v === "inalta" ? v : fallback; } catch { return fallback; }
};

/** Tall phone screens get a wider lens so the factory is not cropped to a thin slice. */
function ResponsiveLens() {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const fov = size.width < size.height ? 62 : 42;
    if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
  }, [camera, size.width, size.height]);
  return null;
}
const PAD_AXIS: Partial<Record<NavAction, [keyof WalkPad, number]>> = { inainte: ["fwd", 1], inapoi: ["fwd", -1], stanga: ["side", -1], dreapta: ["side", 1], rotStanga: ["turn", 1], rotDreapta: ["turn", -1] };

export default function ViziunePage() {
  const navigate = useNavigate();
  const data = useFactoryData();
  const offices = useOfficeData();
  const mobile = useIsMobile();
  const [padOpen, setPadOpen] = useState(false);
  const [dpr, setDpr] = useState(() => Math.min(MAX_DPR, window.devicePixelRatio || 1));
  const [officeEdit, setOfficeEdit] = useState(false);
  const [quality, setQualityState] = useState<Quality>(readQuality);
  const setQuality = (q: Quality, remember = true) => { setQualityState(q); if (remember) try { localStorage.setItem(QUALITY_KEY, q); } catch { /* private mode */ } };
  // Walking through the hall at eye height.
  const [walking, setWalking] = useState(false);
  const [locked, setLocked] = useState(false);
  const [looked, setLooked] = useState<string | null>(null);
  const walkPad = useRef<WalkPad>({ fwd: 0, side: 0, turn: 0 });
  const held = useRef(new Set<NavAction>());
  const walkingRef = useRef(false); walkingRef.current = walking;
  const holdPad = (a: NavAction, down: boolean) => {
    if (down) held.current.add(a); else held.current.delete(a);
    const p: WalkPad = { fwd: 0, side: 0, turn: 0 };
    for (const h of held.current) { const ax = PAD_AXIS[h]; if (ax) p[ax[0]] += ax[1]; }
    walkPad.current = p;
  };
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
      if (walkingRef.current) return; // the walk camera reads its own keys
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
    tourRef.current?.end();
    setWalking(false); setLocked(false); setLooked(null);
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

  const startWalk = () => { tourRef.current?.end(); setSel(null); held.current.clear(); walkPad.current = { fwd: 0, side: 0, turn: 0 }; setWalking(true); };
  const exitWalk = () => { setWalking(false); setLocked(false); setLooked(null); held.current.clear(); walkPad.current = { fwd: 0, side: 0, turn: 0 }; setZone("productie"); };
  const officeNow = offices.people.filter((p) => p.status === "aplicatie" || p.status === "senior").length;
  /** What a walk-mode target id (machine, warehouse, office) opens. */
  const targetSelection = (id: string): Selection => {
    if (id.startsWith(OFFICE_PREFIX)) return { kind: "office", id: id.slice(OFFICE_PREFIX.length) as OfficeId };
    if (id.startsWith(ZONE_PREFIX)) { const k = id.slice(ZONE_PREFIX.length); return k === "depozit" || k === "receptie" || k === "livrare" || k === "birouri" ? { kind: k } : null; }
    const lid = data.placement.byStation.get(id);
    return lid && data.lineViews.some((l) => l.id === lid) ? { kind: "line", id: lid } : { kind: "station", id };
  };
  const pickTarget = (id: string) => setSel(targetSelection(id));
  const lookedSel = looked ? targetSelection(looked) : null;
  const lookedStation = looked && (lookedSel?.kind === "line" || lookedSel?.kind === "station") ? data.layout.find((st) => st.id === looked) : null;
  const lookedLine = lookedSel?.kind === "line" ? data.lineViews.find((l) => l.id === lookedSel.id) : null;
  const lookedOffice = lookedSel?.kind === "office" ? offices.offices.find((o) => o.id === lookedSel.id) : null;
  const lookedLabel: { title: string; sub: string } | null = !lookedSel ? null
    : lookedStation ? { title: lookedLine?.name ?? lookedStation.label, sub: lookedLine ? `${STATUS_LABEL[lookedLine.status]}${lookedLine.workers ? ` · 👷 ${lookedLine.workers}` : ""}${lookedLine.pace.status === "intarziat" ? ` · ⚠ +${minutesLabel(lookedLine.pace.lateMinutes)}` : ""}` : "fără linie" }
    : lookedSel.kind === "office" ? { title: OFFICES[lookedSel.id].label, sub: lookedOffice ? `${lookedOffice.onlineNow} lucrează acum · ${lookedOffice.people.length} oameni` : "birou" }
    : lookedSel.kind === "depozit" ? { title: "Depozit materie primă", sub: `${data.stock.length} produse pe stoc` }
    : lookedSel.kind === "receptie" ? { title: "Recepție", sub: `${data.receptions.reduce((a, r) => a + r.lots, 0)} loturi azi · ${(data.prereceptions ?? []).length} camioane așteptate` }
    : lookedSel.kind === "livrare" ? { title: "Picking & livrare", sub: `${data.ready.length} magazine cu marfă gata` }
    : lookedSel.kind === "birouri" ? { title: "Clădirea de birouri", sub: `${officeNow} lucrează acum` }
    : null;

  const select = (s: Selection) => {
    if (editing) { setSel(s?.kind === "station" ? s : null); return; }
    if (walking) { setSel(s); return; }
    setSel(s);
    if (s?.kind === "line") { if (!flyToStation(stationOfLine(s.id))) setZone("productie"); }
    if (s?.kind === "station") { if (!flyToStation(s.id)) setZone("productie"); }
    if (s?.kind === "receptie") setZone("receptie");
    if (s?.kind === "depozit") setZone("depozit");
    if (s?.kind === "livrare") setZone("livrare");
    if (s?.kind === "birouri") setZone("birouri");
    if (s?.kind === "office") { const area = buildingOf(s.id, offices.order); setZone(area === "hala" ? "birouriHala" : area === "depozit" ? "birouDepozit" : "birouri"); };
  };
  const officeFacts: OfficeFacts = {
    linesWorking: working.length, linesTotal: data.lineViews.length, producedPct: pieces ? Math.round((produced / pieces) * 100) : null,
    lateLines: late.length, receptionLots: data.receptions.reduce((a, r) => a + r.lots, 0), receptionKg: recKg,
    prereceptions: (data.prereceptions ?? []).length, stoppedLines: data.lineViews.filter((l) => l.status === "oprita").length,
  };
  const seniorDocs = [...offices.docTotals.values()].reduce((a, t) => a + t.n, 0);

  // Presentation: cinematic tour + Argus copilot, both on the same live figures as the screen.
  const factoryInput: FactoryInput = {
    now: data.now, orders: data.orders, lineViews: data.lineViews, receptions: data.receptions, prereceptions: data.prereceptions ?? [],
    ready: data.ready, stock: data.stock, unassigned: data.unassigned.length,
    offices: offices.loading || offices.error ? null : { online: officeNow, seniorDocs },
  };
  const summary = factorySummary(factoryInput);
  const inputRef = useRef({ factoryInput, summary }); inputRef.current = { factoryInput, summary };
  const stops = tourStops(summary, (id) => data.lineViews.find((l) => l.id === id)?.name ?? null);
  const tourGo = (st: TourStop) => {
    setSel(null);
    if ("line" in st.camera) {
      const station = (data.layout ?? []).find((x) => x.id === stationOfLine((st.camera as { line: string }).line));
      if (station) { const [x, z] = toWorld(station.px, station.py); setZoneState("productie"); setCam((c) => ({ seq: c.seq + 1, slow: true, kind: "focus", x, z })); return; }
      setZoneState("productie"); setCam((c) => ({ seq: c.seq + 1, slow: true, kind: "zone", zone: "productie" })); return;
    }
    const z = st.camera.zone as Zone;
    setZoneState(z); setCam((c) => ({ seq: c.seq + 1, slow: true, kind: "zone", zone: z }));
  };
  const tour = useTour(stops, tourGo);
  const touring = tour.running;
  const [copilotOpen, setCopilotOpen] = useState(false);
  const startTour = () => { if (editing) return; setWalking(false); setLocked(false); setLooked(null); setSel(null); setCopilotOpen(false); tour.start(); };
  const tourRef = useRef(tour); tourRef.current = tour;
  const startTourRef = useRef(startTour); startTourRef.current = startTour;
  // P = start/stop the presentation tour (ignored while typing).
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement | null;
      if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.repeat || (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))) return;
      if (ev.key.toLowerCase() === "p") { ev.preventDefault(); if (tourRef.current.running) tourRef.current.end(); else startTourRef.current(); }
      else if (ev.key === "Escape" && tourRef.current.running) tourRef.current.end();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const copilotSnap = React.useCallback(() => copilotSnapshot(inputRef.current.factoryInput, inputRef.current.summary), []);
  const copilotTarget = (t: { kind: "line" | "zone"; id: string }) => {
    if (t.kind === "line") { if (!flyToStation(stationOfLine(t.id))) setZone("productie"); return; }
    setZone(t.id as Zone);
  };
  const copilotDetails = (t: { kind: "line" | "zone"; id: string }) => {
    if (t.kind === "line") { select({ kind: "line", id: t.id }); return; }
    if (t.id === "receptie" || t.id === "depozit" || t.id === "livrare" || t.id === "birouri") select({ kind: t.id }); else setZone(t.id as Zone);
  };
  const isOffice = sel?.kind === "office" || sel?.kind === "birouri";
  const isStore = sel?.kind === "depozit" || sel?.kind === "livrare";
  const pallets = useWarehousePallets(sel?.kind === "depozit" ? data.stock.map((x) => x.name).slice(0, 1000) : [], sel?.kind === "livrare" ? pickingDetail(data.orders, null).flatMap((st) => st.products.map((p) => p.productId)).filter((id): id is string => !!id).slice(0, 500) : [], isStore);
  const depot = sel?.kind === "depozit" ? depotDetail(data.stockRows, pallets.data, data.today) : [];
  const picking = sel?.kind === "livrare" ? pickingDetail(data.orders, pallets.data) : [];

  // The HUD wraps to two rows on narrower screens, so the detail panel has to start
  // below the height the HUD actually has instead of a fixed offset.
  const hudRef = useRef<HTMLDivElement>(null);
  const [hudH, setHudH] = useState(64);
  useEffect(() => {
    const el = hudRef.current;
    if (!el) return;
    const read = () => setHudH(el.getBoundingClientRect().height);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mobile, touring]);

  return (
    <div className="relative h-[calc(100dvh-4rem)] w-full overflow-hidden bg-background" data-scene-ready={ready ? "" : undefined}>
      {/* top HUD */}
      {touring ? (
      <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-wrap items-center gap-2">
        <div className="rounded-xl border bg-card/90 px-4 py-2 shadow-lg backdrop-blur-md">
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary">Viziune</div>
          <div className={`font-black leading-tight ${mobile ? "text-base" : "text-xl"}`}>Coral Biogreens · fabrica live</div>
        </div>
      </div>
      ) : mobile ? (
      <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex flex-col gap-1.5">
        <div className="pointer-events-auto flex w-full items-center gap-1 rounded-lg border bg-card/95 px-1.5 py-1 shadow">
          <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => navigate("/administrativ")} aria-label="Înapoi la Administrativ"><ArrowLeft className="h-4 w-4" /></Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-black leading-tight">Viziune · Coral live</h1>
            <p className="truncate text-[10px] text-muted-foreground">actualizat {data.updatedAt ? new Date(data.updatedAt).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" }) : "…"}</p>
          </div>
          <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => { data.refetch(); offices.refetch(); }} aria-label="Reîmprospătează"><RefreshCw className="h-4 w-4" /></Button>
          {walking
            ? <Button size="sm" className="h-9 shrink-0" onClick={exitWalk}><LogOut className="mr-1 h-4 w-4" />Ieși</Button>
            : <Button size="sm" variant="outline" className="h-9 shrink-0 px-2" disabled={editing} onClick={startWalk} aria-label="Plimbă-te prin hală"><Footprints className="mr-1 h-4 w-4" />Plimbare</Button>}
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" aria-label="Mai multe"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem disabled={editing} onSelect={() => startTour()}><Clapperboard className="mr-2 h-4 w-4" />Tur de prezentare</DropdownMenuItem>
              <DropdownMenuItem disabled={editing || data.layoutLoading} onSelect={() => startEdit()}><LayoutGrid className="mr-2 h-4 w-4" />Aranjează hala</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setQuality(quality === "inalta" ? "rapida" : "inalta")}><Sparkles className="mr-2 h-4 w-4" />{quality === "inalta" ? "Treci pe grafică rapidă" : "Treci pe grafică frumoasă"}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate("/")}><Home className="mr-2 h-4 w-4" />Hub Departamente</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {!walking && !(sel && !editing) && <div className="pointer-events-auto -mx-2 flex snap-x gap-1.5 overflow-x-auto px-2 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Kpi label="Producție azi" value={pieces ? `${Math.round((produced / pieces) * 100)}%` : "—"} sub={`${fmt(produced)} / ${fmt(pieces)} buc`} />
        <Kpi label="Ziua se termină" value={summary.dayDoneAt ? `~${clockRo(summary.dayDoneAt)}` : "—"} sub={summary.dayDoneAt ? "după normă, la ritmul de acum" : "fără comenzi rămase cu normă"} />
        <button type="button" className="pointer-events-auto shrink-0 snap-start text-left" onClick={() => late[0] && select({ kind: "line", id: late[0].id })}>
          <div className={`rounded-md border px-2 py-0.5 shadow ${late.length ? "border-destructive bg-destructive text-destructive-foreground" : "bg-card/95"}`}>
            <div className="flex items-baseline gap-1.5">
              <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide opacity-80"><AlertTriangle className="h-3 w-3" />Peste normă</span>
              <span className="text-sm font-black tabular-nums leading-none">{late.length ? `${late.length} linii` : "Nimic"}</span>
            </div>
            <div className="max-w-[220px] truncate text-[10px] leading-tight opacity-80">{late.length ? late.map((l) => `${l.name} +${minutesLabel(l.pace.lateMinutes)}`).join(" · ") : "toate comenzile în lucru sunt în timp"}</div>
          </div>
        </button>
        <Kpi label="Comenzi azi" value={fmt(real.length)} sub={`${real.filter((o) => o.status === "completed").length} gata · ${data.unassigned.length} fără linie`} />
        <Kpi label="Recepții azi" value={`${fmt(recKg)} kg`} sub={`${data.receptions.length} furnizori`} />
        <Kpi label="Prerecepții de descărcat" value={`${(data.prereceptions ?? []).length} camioane`} sub={`${fmt((data.prereceptions ?? []).reduce((a, p) => a + p.kgLeft, 0))} kg${(data.prereceptions ?? []).some((p) => p.late) ? ` · ${(data.prereceptions ?? []).filter((p) => p.late).length} întârziate` : ""}`} />
        <button type="button" className="pointer-events-auto shrink-0 snap-start text-left" onClick={() => select({ kind: "livrare" })}>
          <Kpi label="Gata de livrare" value={`${data.ready.length} magazine`} sub={`${fmt(data.ready.reduce((a, r) => a + r.pieces, 0))} buc`} />
        </button>
        </div>}
      </div>
      ) : (
      <div ref={hudRef} className="pointer-events-none absolute inset-x-2 top-2 z-10 flex flex-wrap items-start gap-1.5">
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-lg border bg-card/95 px-2 py-1 shadow">
          <BackToHubButton size="xs" />
          <div>
            <h1 className="text-sm font-black leading-tight">Viziune · Fabrica Coral live</h1>
            <p className="text-[10px] leading-tight text-muted-foreground">{data.today} · actualizat {data.updatedAt ? new Date(data.updatedAt).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" }) : "…"} · se reîmprospătează la 30 s</p>
          </div>
          <Button size="icon-xs" variant="ghost" onClick={() => { data.refetch(); offices.refetch(); }} title="Reîmprospătează"><RefreshCw className="h-3.5 w-3.5" /></Button>
          <Button size="xs" disabled={editing} onClick={startTour} title="Zbor cinematic automat prin fabrică, cu cifrele de azi (tasta P). Orice clic în scenă îl oprește.">
            <Clapperboard className="h-3.5 w-3.5" />Tur prezentare
          </Button>
          <Button size="xs" variant={editing ? "default" : "outline"} disabled={editing || data.layoutLoading} onClick={() => startEdit()} title="Mută, adaugă sau scoate utilaje și alege ce linie lucrează pe fiecare">
            <LayoutGrid className="h-3.5 w-3.5" />Aranjează hala
          </Button>
          {walking
            ? <Button size="xs" onClick={exitWalk} title="Înapoi la vederea de sus (Esc)"><LogOut className="h-3.5 w-3.5" />Ieși din plimbare</Button>
            : <Button size="xs" variant="outline" disabled={editing} onClick={startWalk} title="Mergi prin fabrică la înălțimea ochilor, ca într-un joc"><Footprints className="h-3.5 w-3.5" />Plimbă-te prin hală</Button>}
          <Button size="xs" variant={quality === "inalta" ? "secondary" : "ghost"} onClick={() => setQuality(quality === "inalta" ? "rapida" : "inalta")}
            title={quality === "inalta" ? "Grafică frumoasă (umbre fine, lumini care strălucesc). Apasă pentru modul rapid, pe calculatoare mai slabe." : "Grafică rapidă. Apasă pentru grafica frumoasă."}>
            <Sparkles className="h-3.5 w-3.5" />{quality === "inalta" ? "Grafică frumoasă" : "Grafică rapidă"}
          </Button>
        </div>
        {!walking && <>
        <Kpi label="Producție azi" value={pieces ? `${Math.round((produced / pieces) * 100)}%` : "—"} sub={`${fmt(produced)} / ${fmt(pieces)} buc`} />
        <Kpi label="Ziua se termină" value={summary.dayDoneAt ? `~${clockRo(summary.dayDoneAt)}` : "—"} sub={summary.dayDoneAt ? "după normă, la ritmul de acum" : "fără comenzi rămase cu normă"} />
        <button type="button" className="pointer-events-auto shrink-0 snap-start text-left" onClick={() => late[0] && select({ kind: "line", id: late[0].id })}>
          <div className={`rounded-md border px-2 py-0.5 shadow ${late.length ? "border-destructive bg-destructive text-destructive-foreground" : "bg-card/95"}`}>
            <div className="flex items-baseline gap-1.5">
              <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide opacity-80"><AlertTriangle className="h-3 w-3" />Peste normă</span>
              <span className="text-sm font-black tabular-nums leading-none">{late.length ? `${late.length} linii` : "Nimic"}</span>
            </div>
            <div className="max-w-[220px] truncate text-[10px] leading-tight opacity-80">{late.length ? late.map((l) => `${l.name} +${minutesLabel(l.pace.lateMinutes)}`).join(" · ") : "toate comenzile în lucru sunt în timp"}</div>
          </div>
        </button>
        <Kpi label="Comenzi azi" value={fmt(real.length)} sub={`${real.filter((o) => o.status === "completed").length} gata · ${data.unassigned.length} fără linie`} />
        <Kpi label="Recepții azi" value={`${fmt(recKg)} kg`} sub={`${data.receptions.length} furnizori`} />
        <Kpi label="Prerecepții de descărcat" value={`${(data.prereceptions ?? []).length} camioane`} sub={`${fmt((data.prereceptions ?? []).reduce((a, p) => a + p.kgLeft, 0))} kg${(data.prereceptions ?? []).some((p) => p.late) ? ` · ${(data.prereceptions ?? []).filter((p) => p.late).length} întârziate` : ""}`} />
        <button type="button" className="pointer-events-auto shrink-0 snap-start text-left" onClick={() => select({ kind: "livrare" })}>
          <Kpi label="Gata de livrare" value={`${data.ready.length} magazine`} sub={`${fmt(data.ready.reduce((a, r) => a + r.pieces, 0))} buc`} />
        </button>
        </>}
      </div>
      )}

      {!touring && (!mobile || walking || padOpen) && <NavPad onNav={nav} onHome={walking ? exitWalk : () => setZone("all")} onHold={walking ? holdPad : undefined}
        hideLines={mobile} className={mobile ? (walking ? "bottom-3 left-2" : "bottom-16 left-2") : undefined}
        lines={data.lineViews.filter((l) => stationOfLine(l.id)).map((l) => ({ id: l.id, name: l.name, workers: l.workers, late: l.pace.status === "intarziat" }))}
        onLine={(id) => select({ kind: "line", id })} />}

      {walking && <>
        {/* crosshair + what is under it */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <div className={`h-3 w-3 rounded-full border-2 ${lookedLabel ? "border-primary bg-primary/40" : "border-background/90 bg-foreground/30"} shadow`} />
        </div>
        {lookedLabel && (
          <div className="pointer-events-none absolute left-1/2 top-[calc(50%+18px)] z-10 -translate-x-1/2 whitespace-nowrap rounded-md border bg-card/95 px-2 py-1 text-center text-xs shadow">
            <div className="font-bold">{lookedLabel.title}</div>
            <div className="text-[10px] text-muted-foreground">{lookedLabel.sub} · {mobile ? "atinge" : "clic"} pentru detalii</div>
          </div>
        )}
        {mobile ? <div className="pointer-events-none absolute inset-x-2 top-14 z-10 rounded-lg border bg-card/90 px-2 py-1 text-center text-[10px] shadow">
          <b>Trage cu degetul</b> = privești · <b>săgețile</b> = mergi · <b>atinge</b> ținta = detalii
        </div> :
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-lg border bg-card/95 px-3 py-2 text-center text-[11px] shadow">
          {locked
            ? <span><b>W A S D</b> / săgeți = mergi · <b>Shift</b> = alergi · <b>mouse</b> = privești · <b>clic</b> pe un utilaj, depozit sau birou = detalii · <b>Esc</b> = eliberezi mouse-ul</span>
            : <span><b>Clic pe ecran</b> ca să privești cu mouse-ul (pe telefon: trage cu degetul) · <b>W A S D</b> / săgeți = mergi · <b>Esc</b> = ieși din plimbare</span>}
        </div>}
      </>}

      {/* zone camera buttons */}
      {!walking && !touring && mobile && <div className="absolute inset-x-2 bottom-2 z-10 flex items-center gap-1.5 rounded-lg border bg-card/95 p-1 shadow">
        <Select value={zone} onValueChange={(z) => setZone(z as Zone)}>
          <SelectTrigger className="h-8 min-w-0 flex-1 text-xs" aria-label="Zonă"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-72 overflow-y-auto">
            {(Object.keys(ZONES) as Zone[]).map((z) => <SelectItem key={z} value={z} className="text-xs">{ZONES[z].label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value="" onValueChange={(id) => select({ kind: "line", id })}>
          <SelectTrigger className="h-8 min-w-0 flex-1 text-xs" aria-label="Mergi la linia"><SelectValue placeholder="Linia…" /></SelectTrigger>
          <SelectContent className="max-h-72 overflow-y-auto">
            {data.lineViews.filter((l) => stationOfLine(l.id)).map((l) => <SelectItem key={l.id} value={l.id} className="text-xs">{l.pace.status === "intarziat" ? "⚠ " : ""}{l.name}{l.workers ? ` · 👷 ${l.workers}` : ""}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="icon" variant={padOpen ? "default" : "outline"} className="h-8 w-8 shrink-0" onClick={() => setPadOpen((v) => !v)} aria-label="Butoane de mișcare"><Gamepad2 className="h-4 w-4" /></Button>
      </div>}
      {!walking && !touring && !mobile && <div className="absolute bottom-2 left-2 z-10 flex flex-wrap gap-1 rounded-lg border bg-card/95 p-1 shadow">
        {(Object.keys(ZONES) as Zone[]).map((z) => (
          <Button key={z} size="xs" variant={zone === z ? "default" : "ghost"} onClick={() => setZone(z)}>{ZONES[z].label}</Button>
        ))}
      </div>}

      {/* detail panel */}
      {editing && draft && (
        <HallEditor draft={draft} setDraft={setDraft} selectedId={sel?.kind === "station" ? sel.id : null}
          setSelectedId={(id) => setSel(id ? { kind: "station", id } : null)}
          lines={data.lines} onSave={saveDraft} onCancel={stopEdit} saving={data.savingLayout} changed={changed}
          onReset={() => { if (window.confirm("Pui la loc utilajele și liniile din planul inițial al halei?")) { setDraft(defaultLayout(data.lines)); setSel(null); } }} />
      )}

      {sel && !editing && !touring && (
        <div className={mobile
          ? "absolute inset-x-0 bottom-0 z-20 flex max-h-[62%] flex-col rounded-t-2xl border-t bg-card shadow-2xl"
          : `absolute right-2 z-20 flex flex-col rounded-lg border bg-card shadow-xl ${isStore ? "w-[min(92vw,460px)]" : "w-[min(88vw,320px)]"}`}
          style={mobile ? undefined : { top: hudH + 8, maxHeight: `calc(100% - ${hudH + 16}px)` }}>
          {mobile && <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />}
          <div className="flex items-start justify-between gap-2 border-b p-2">
            <div>
              <div className="text-sm font-black">{line ? line.name : emptyStation ? emptyStation.label : sel.kind === "office" ? OFFICES[sel.id].label : sel.kind === "birouri" ? "Birourile firmei azi" : sel.kind === "receptie" ? "Recepție azi" : sel.kind === "depozit" ? "Depozit materie primă" : "Gata de livrare"}</div>
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
            {sel.kind === "depozit" && <DepotDetail products={depot} loading={pallets.isLoading} error={pallets.error as Error | null} />}
            {sel.kind === "livrare" && <PickingDetail stores={picking} lines={data.lines} today={data.today} loading={pallets.isLoading} error={pallets.error as Error | null} />}
          </div>
          <div className="border-t p-2">
            {isOffice ? <Button className="w-full" variant="outline" onClick={() => navigate("/administrativ/activitate")}>Deschide Activitate (istoric pe zile)</Button> :
            <Button className="w-full" variant="outline" onClick={() => navigate(line || emptyStation ? "/operator" : sel.kind === "receptie" ? "/depozit-mp" : sel.kind === "depozit" ? "/depozit-mp" : "/picking")}>
              Deschide {line || emptyStation ? "Operator" : sel.kind === "livrare" ? "Picking" : "Depozit MP"}
            </Button>}
          </div>
        </div>
      )}

      <TourOverlay tour={tour} mobile={mobile} />
      {!editing && !walking && (
        <ArgusCopilot snapshot={copilotSnap} onTarget={copilotTarget} onDetails={copilotDetails} onAsk={() => { if (tourRef.current.running) tourRef.current.end(); }}
          open={copilotOpen} setOpen={setCopilotOpen} mobile={mobile} />
      )}

      <OfficeEditor offices={offices} open={officeEdit} onClose={() => setOfficeEdit(false)} />

      {data.error && <div className="absolute left-1/2 top-24 z-20 -translate-x-1/2 rounded-lg border border-destructive bg-card px-3 py-2 text-sm text-destructive shadow">Nu am putut citi datele: {data.error.message}</div>}

      <Canvas shadows dpr={dpr} gl={{ powerPreference: "high-performance" }} camera={{ position: ZONES.all.pos, fov: 42, near: 0.5, far: 300 }} onCreated={() => setTimeout(() => setReady(true), 500)} onPointerMissed={() => { if (!walking) setSel(null); }}
        onPointerDown={() => { if (tourRef.current.running) tourRef.current.end(); }} onWheel={() => { if (tourRef.current.running) tourRef.current.end(); }}>
        {/* Sharpness follows the computer: lower resolution when frames drop, back up when there is room. */}
        {!walking && <ResponsiveLens />}
        <PerformanceMonitor bounds={() => [45, 58]} flipflops={4} onDecline={() => setDpr((d) => Math.max(0.6, +(d - 0.2).toFixed(2)))} onIncline={() => setDpr((d) => Math.min(MAX_DPR, +(d + 0.2).toFixed(2)))} onFallback={() => { setDpr(0.6); setQuality("rapida", false); }} />
        <FactoryScene data={data} offices={offices} camera={cam} selection={sel} onSelect={select} layout={draft ?? undefined} editing={editing} onMove={moveStation}
          walk={walking ? { pad: walkPad, onLook: setLooked, onPick: pickTarget, onExit: exitWalk, onLock: setLocked } : null} tour={touring} />
        {quality === "inalta" && <EffectsGuard onFail={() => setQuality("rapida", false)}><Effects /></EffectsGuard>}
      </Canvas>
    </div>
  );
}
