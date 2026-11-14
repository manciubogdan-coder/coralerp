import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import type { OfficeData } from "./useOfficeData";
import type { OfficeId, PersonView } from "@/lib/viziune/officeState";
import { labelForPath, formatDuration } from "@/lib/activityTracking";
import { doingNow } from "./OfficeScene";

const fmt = (n: number) => Math.round(n).toLocaleString("ro-RO");
const hhmm = (ms: number | null) => (ms ? new Date(ms).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest" }) : "—");
const STATUS: Record<PersonView["status"], { label: string; cls: string }> = {
  aplicatie: { label: "în aplicație acum", cls: "bg-crm-green/15 text-crm-green" },
  senior: { label: "în Senior acum", cls: "bg-crm-cool/15 text-crm-cool" },
  azi: { label: "a lucrat azi", cls: "bg-muted text-muted-foreground" },
  absent: { label: "nimic azi", cls: "bg-muted text-muted-foreground" },
};

export interface OfficeFacts { linesWorking: number; linesTotal: number; producedPct: number | null; lateLines: number; receptionLots: number; receptionKg: number; prereceptions: number; stoppedLines: number }

function Person({ p }: { p: PersonView }) {
  const [open, setOpen] = useState(false);
  const st = STATUS[p.status];
  return (
    <div className="border-b py-1.5 last:border-0">
      <button type="button" className="flex w-full items-start justify-between gap-2 text-left" onClick={() => setOpen((o) => !o)}>
        <div className="min-w-0">
          <div className="truncate font-semibold">{p.name}</div>
          <div className="truncate text-xs text-muted-foreground">{doingNow(p) || (p.lastAt ? `ultima dată la ${hhmm(p.lastAt)}` : "fără activitate azi")}</div>
        </div>
        <div className="shrink-0 text-right text-xs">
          <span className={`rounded px-1.5 py-0.5 font-semibold ${st.cls}`}>{st.label}</span>
          <div className="mt-0.5 tabular-nums text-muted-foreground">{p.appSeconds ? `${formatDuration(p.appSeconds)} în app` : ""}{p.appSeconds && p.docs ? " · " : ""}{p.docs ? `${p.docs} doc.` : ""}</div>
        </div>
      </button>
      {open && (
        <div className="mt-1.5 space-y-1.5 rounded-md bg-muted/40 p-2 text-xs">
          <div className="text-muted-foreground">Pus aici după {p.reason}{p.seniorAccounts.length ? ` · Senior: ${p.seniorAccounts.join(", ")}` : " · fără cont Senior legat"}</div>
          {p.pages.length > 0 && <div><div className="font-semibold">În aplicație azi</div>{p.pages.map((pg, i) => (
            <div key={i} className="flex justify-between gap-2"><span className="truncate">{labelForPath(pg.path)}{pg.tab ? ` › ${pg.tab}` : ""}</span><span className="tabular-nums">{formatDuration(pg.seconds)}</span></div>
          ))}</div>}
          {p.docTypes.length > 0 && <div><div className="font-semibold">Documente introduse azi în Senior</div>{p.docTypes.map((t) => (
            <div key={t.cod} className="flex justify-between gap-2"><span className="truncate">{t.cod} · {t.descr}</span><span className="tabular-nums">{t.n}{t.value ? ` · ${fmt(t.value)} lei` : ""}</span></div>
          ))}</div>}
          {p.edits > 0 && <div className="text-muted-foreground">+{p.edits} documente mai vechi modificate azi</div>}
          {p.recent.length > 0 && <div><div className="font-semibold">Ultimele documente</div>{p.recent.map((r, i) => (
            <div key={i} className="flex justify-between gap-2"><span className="truncate">{r.at.slice(11, 16)} · {r.cod} {[r.serie, r.nr].filter(Boolean).join(" ")}{r.partner ? ` · ${r.partner}` : ""}</span><span className="shrink-0 tabular-nums">{r.val ? `${fmt(r.val)} lei` : ""}</span></div>
          ))}</div>}
        </div>
      )}
    </div>
  );
}

/** Company-wide figures that belong to an office, from Senior documents and the factory data. */
function highlights(id: OfficeId, o: OfficeData, f: OfficeFacts): string[] {
  const t = (cod: string) => o.docTotals.get(cod);
  const doc = (cod: string, label: string) => { const x = t(cod); return x ? `${label}: ${x.n}${x.value ? ` · ${fmt(x.value)} lei` : ""}` : `${label}: 0`; };
  const all = o.people;
  switch (id) {
    case "vanzari": return [doc("CC", "Comenzi clienți azi (toată firma)"), doc("FC", "Facturi clienți azi"), doc("AEC", "Avize expediție azi")];
    case "achizitii": return [doc("CF", "Comenzi furnizori azi (toată firma)"), doc("NIR", "NIR-uri azi"), `Prerecepții de descărcat: ${f.prereceptions}`];
    case "contabilitate": return [doc("FF", "Facturi furnizori azi"), `Documente Senior azi în toată firma: ${fmt([...o.docTotals.values()].reduce((a, x) => a + x.n, 0))}`];
    case "productie": return [`Linii care lucrează: ${f.linesWorking} / ${f.linesTotal}`, `Producție azi: ${f.producedPct == null ? "—" : `${f.producedPct}%`}`, `Linii peste normă: ${f.lateLines}`];
    case "calitate": return [`Recepții azi: ${f.receptionLots} loturi · ${fmt(f.receptionKg)} kg`, `Prerecepții de verificat: ${f.prereceptions}`];
    case "mentenanta": return [`Linii oprite acum: ${f.stoppedLines}`, `Linii peste normă: ${f.lateLines}`];
    case "hr": return [`Colegi care au lucrat azi: ${all.filter((p) => p.status !== "absent").length}`, `Lucrează acum: ${all.filter((p) => p.status === "aplicatie" || p.status === "senior").length}`];
    case "ceo": return [`Lucrează acum în firmă: ${all.filter((p) => p.status === "aplicatie" || p.status === "senior").length} oameni`, `Documente Senior azi: ${fmt([...o.docTotals.values()].reduce((a, x) => a + x.n, 0))}`, `Producție azi: ${f.producedPct == null ? "—" : `${f.producedPct}%`} · ${f.lateLines} linii peste normă`];
  }
}

function EditButton({ offices, onEdit }: { offices: OfficeData; onEdit: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={onEdit}><Users className="mr-1 h-3 w-3" />Pune oamenii pe birouri</Button>
      {offices.configInfo && <span className="text-[10px] text-muted-foreground">aranjat de {offices.configInfo.by ?? "un coleg"} pe {new Date(offices.configInfo.at).toLocaleDateString("ro-RO")}</span>}
    </div>
  );
}

export function OfficeDetail({ id, offices, facts, onEdit }: { id: OfficeId; offices: OfficeData; facts: OfficeFacts; onEdit: () => void }) {
  const office = offices.offices.find((o) => o.id === id);
  if (!office) return null;
  return (
    <div className="space-y-3">
      <EditButton offices={offices} onEdit={onEdit} />
      <div className="rounded-lg border bg-muted/40 p-2 text-xs">{highlights(id, offices, facts).map((h) => <div key={h}>{h}</div>)}</div>
      {offices.seniorError && <p className="text-xs text-destructive">Nu am putut citi Senior acum ({offices.seniorError}); arăt doar ce se vede în aplicație.</p>}
      <div>
        <div className="mb-1 text-xs font-bold uppercase text-muted-foreground">Oameni · {office.onlineNow} acum · {office.activeToday} azi</div>
        {office.people.length === 0 ? <p className="text-xs text-muted-foreground">Nu am găsit pe nimeni pentru biroul ăsta după drepturile din aplicație și grupele din Senior.</p> : office.people.map((p) => <Person key={p.key} p={p} />)}
      </div>
      <p className="text-[10px] text-muted-foreground">Unde n-ai ales tu, biroul e ghicit după grupa din Senior, apoi după drepturile din aplicație. Clic pe un om ca să vezi de ce e aici și ce a făcut azi.</p>
    </div>
  );
}

export function OfficesOverview({ offices, onOffice, onEdit }: { offices: OfficeData; onOffice: (id: OfficeId) => void; onEdit: () => void }) {
  return (
    <div className="space-y-3">
      <EditButton offices={offices} onEdit={onEdit} />
      {offices.seniorError && <p className="text-xs text-destructive">Nu am putut citi Senior acum ({offices.seniorError}).</p>}
      <table className="w-full text-xs"><tbody>{offices.offices.map((o) => (
        <tr key={o.id} className="cursor-pointer border-t hover:bg-muted/50" onClick={() => onOffice(o.id)}>
          <td className="py-1.5 pr-2"><div className="font-semibold">{o.label}</div><div className="text-muted-foreground">{o.building === "hala" ? "în hală" : "clădirea de birouri"}</div></td>
          <td className="py-1.5 text-right tabular-nums"><div><Badge variant="secondary">{o.onlineNow} acum</Badge></div><div className="text-muted-foreground">{o.activeToday} azi · {o.docs} doc. · {formatDuration(o.appSeconds)}</div></td>
        </tr>
      ))}</tbody></table>
      {offices.unassigned.length > 0 && <div>
        <div className="mb-1 text-xs font-bold uppercase text-muted-foreground">Activi azi, fără birou ({offices.unassigned.length})</div>
        <p className="mb-1 text-[10px] text-muted-foreground">Depozit, operatori de linie sau conturi comune din Senior.</p>
        {offices.unassigned.map((p) => <Person key={p.key} p={p} />)}
      </div>}
    </div>
  );
}
