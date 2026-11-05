import React, { useState } from "react";
import { Plus, RefreshCw, Trash2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type AgentFilter = { name: string; label: string; type: "period" | "text" | "choice"; options?: string[]; default: string };

export const PRESET_LABEL: Record<string, string> = {
  today: "Azi", yesterday: "Ieri", last_7: "Ultimele 7 zile", last_30: "Ultimele 30 de zile",
  this_month: "Luna curentă", last_month: "Luna trecută", custom: "Interval ales",
};
const TYPE_LABEL = { period: "Perioadă", text: "Text liber", choice: "Listă de opțiuni" };

/** One filter value control: period preset (+ custom range), text or choice. */
const READY_FILTERS: AgentFilter[] = [
  { name: "perioada", label: "Perioadă", type: "period", default: "last_30" },
  { name: "produs", label: "Produs", type: "text", default: "" },
  { name: "client", label: "Client", type: "choice", options: ["Lidl", "Kaufland", "Mega Image", "Carrefour", "Auchan", "Profi", "Penny", "Metro", "Selgros", "Horeca"], default: "" },
  { name: "furnizor", label: "Furnizor", type: "text", default: "" },
  { name: "linie", label: "Linie de producție", type: "text", default: "" },
  { name: "grupare", label: "Grupare rezultat", type: "choice", options: ["Pe zi", "Pe săptămână", "Pe lună", "Pe produs", "Pe client"], default: "" },
];

function FilterInput({ f, value, onChange }: { f: AgentFilter; value: string; onChange: (v: string) => void }) {
  if (f.type === "period") {
    const custom = value.includes("..") || value === "custom";
    const [a, b] = value.includes("..") ? value.split("..") : ["", ""];
    return (
      <div className="flex flex-wrap gap-1">
        <Select value={custom ? "custom" : value || "last_30"} onValueChange={(v) => onChange(v)}>
          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(PRESET_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
        </Select>
        {custom && (
          <>
            <Input type="date" className="h-8 w-36 text-xs" value={a} onChange={(e) => onChange(`${e.target.value}..${b || e.target.value}`)} />
            <Input type="date" className="h-8 w-36 text-xs" value={b} onChange={(e) => onChange(`${a || e.target.value}..${e.target.value}`)} />
          </>
        )}
      </div>
    );
  }
  if (f.type === "choice") {
    return (
      <Select value={value || "__all"} onValueChange={(v) => onChange(v === "__all" ? "" : v)}>
        <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="__all">Toate</SelectItem>{f.options?.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
      </Select>
    );
  }
  return <Input className="h-8 w-44 text-xs" placeholder="gol = toate" value={value} onChange={(e) => onChange(e.target.value)} />;
}

/** Filter bar on a dashboard card: change values and rerun. */
export function AgentFilterBar({ filters, values, onChange, onRun, busy }: { filters: AgentFilter[]; values: Record<string, string>; onChange: (v: Record<string, string>) => void; onRun: () => void; busy?: boolean }) {
  if (!filters.length) return null;
  return (
    <div className="mb-3 flex flex-wrap items-end gap-2 rounded-md border bg-muted/30 p-2">
      {filters.map((f) => (
        <label key={f.name} className="space-y-1 text-xs">
          <span className="block text-muted-foreground">{f.label}</span>
          <FilterInput f={f} value={values[f.name] ?? f.default} onChange={(v) => onChange({ ...values, [f.name]: v })} />
        </label>
      ))}
      <Button size="sm" className="h-8" onClick={onRun} disabled={busy}>
        {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}Actualizează
      </Button>
    </div>
  );
}

/** Editor in the save dialog: Argus's proposal, editable, removable, extendable, or re-proposed from a free description. */
export function AgentFiltersEditor({ filters, onChange, proposal, proposing, onRepropose }: {
  filters: AgentFilter[]; onChange: (f: AgentFilter[]) => void; proposal?: string; proposing?: boolean; onRepropose?: (wish: string) => void;
}) {
  const [wish, setWish] = useState("");
  const set = (i: number, patch: Partial<AgentFilter>) => onChange(filters.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="text-sm font-medium">Filtre pe care le vei putea schimba la fiecare rulare</div>
      {proposing ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Argus se gândește ce filtre să-ți propună…</p>
      ) : onRepropose && (
        <p className="rounded bg-primary/5 p-2 text-xs">
          <Sparkles className="mr-1 inline h-3.5 w-3.5 text-primary" />
          {filters.length ? <>Uite ce filtre îți propun{proposal ? ` — ${proposal}` : ""}. Le vrei așa? Poți să tai, să adaugi sau să-mi scrii exact ce vrei.</> : "Nu am găsit filtre potrivite. Adaugă-le tu sau scrie-mi ce vrei."}
        </p>
      )}
      {filters.map((f, i) => (
        <div key={f.name} className="space-y-2 rounded border bg-card p-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input className="h-8 w-40 text-xs" value={f.label} onChange={(e) => set(i, { label: e.target.value })} aria-label="Nume filtru" />
            <Select value={f.type} onValueChange={(v: any) => set(i, { type: v, default: v === "period" ? "last_30" : "", options: v === "choice" ? f.options ?? [] : undefined })}>
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(TYPE_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="icon" variant="ghost" className="ml-auto h-8 w-8" onClick={() => onChange(filters.filter((_, j) => j !== i))} aria-label="Taie filtrul"><Trash2 className="h-4 w-4" /></Button>
          </div>
          {f.type === "choice" && (
            <Input className="h-8 text-xs" placeholder="Opțiuni separate prin virgulă (ex: Lidl, Kaufland, Mega Image)" value={(f.options ?? []).join(", ")}
              onChange={(e) => set(i, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">Implicit:
            <FilterInput f={f} value={f.default} onChange={(v) => set(i, { default: v })} />
          </div>
        </div>
      ))}
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">Apasă ca să adaugi un filtru gata făcut:</div>
        <div className="flex flex-wrap gap-1.5">
          {READY_FILTERS.filter((r) => !filters.some((f) => f.name === r.name)).map((r) => (
            <Button key={r.name} size="sm" variant="outline" className="h-7 text-xs" onClick={() => onChange([...filters, { ...r }])}>
              <Plus className="mr-1 h-3 w-3" />{r.label}
            </Button>
          ))}
        </div>
      </div>
      {onRepropose && (
        <div className="flex gap-2 pt-1">
          <Input className="h-8 text-xs" value={wish} onChange={(e) => setWish(e.target.value)} placeholder="Scrie-mi exact ce filtre vrei (ex: perioadă, produs și magazin din listă)" />
          <Button size="sm" variant="secondary" disabled={!wish.trim() || proposing} onClick={() => onRepropose(wish)}>Propune din nou</Button>
        </div>
      )}
    </div>
  );
}
