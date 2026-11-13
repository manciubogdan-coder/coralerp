import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KIND_LABEL, STATION_KINDS, newStation, setStationLine, type HallStation, type StationKind } from "@/lib/viziune/hallLayout";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Plus, RotateCw, Trash2, X } from "lucide-react";

const ADD_NAME: Record<StationKind, string> = {
  cantar: "Cântar", giostra: "Giostra", flowpack: "Flowpack", masa: "Masă", spalare_auto: "Spălare automată", spalare_manual: "Spălătoare", utilaj: "Utilaj",
};
const selectCls = "mt-1 w-full rounded border bg-background px-2 py-1 text-sm";

/** Side panel for arranging the hall: add, move, turn, rename and remove machines, and choose the line on each. */
export function HallEditor({ draft, setDraft, selectedId, setSelectedId, lines, onSave, onCancel, onReset, saving, changed }: {
  draft: HallStation[];
  setDraft: (next: HallStation[]) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  lines: { id: string; nume: string }[];
  onSave: () => void; onCancel: () => void; onReset: () => void;
  saving: boolean; changed: boolean;
}) {
  const st = draft.find((s) => s.id === selectedId) ?? null;
  const lineName = (id: string | null) => (id ? lines.find((l) => l.id === id)?.nume ?? "linie ștearsă" : null);
  const placed = new Set(draft.map((s) => s.lineId).filter(Boolean));
  const unplaced = lines.filter((l) => !placed.has(l.id));
  const patch = (p: Partial<HallStation>) => st && setDraft(draft.map((s) => (s.id === st.id ? { ...s, ...p } : s)));
  const add = (kind: StationKind, lineId: string | null = null) => {
    const s = newStation(draft, kind, ADD_NAME[kind], null);
    const next = [...draft, s];
    setDraft(lineId ? setStationLine(next, s.id, lineId) : next);
    setSelectedId(s.id);
  };
  const nudge = (dx: number, dy: number) => st && patch({ px: Math.min(780, Math.max(0, st.px + dx)), py: Math.min(1200, Math.max(0, st.py + dy)) });

  return (
    <div className="absolute right-3 top-28 z-20 flex max-h-[calc(100%-10rem)] w-[min(92vw,360px)] flex-col rounded-xl border bg-card shadow-xl">
      <div className="flex items-start justify-between gap-2 border-b p-3">
        <div>
          <div className="text-base font-black">Aranjezi hala</div>
          <div className="text-[11px] text-muted-foreground">Trage utilajele cu mouse-ul pe podea. Clic pe unul ca să-l schimbi.</div>
        </div>
        <Button size="icon" variant="ghost" onClick={onCancel} title="Închide fără salvare"><X className="h-4 w-4" /></Button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3 text-sm">
        <div>
          <div className="mb-1 text-xs font-bold uppercase text-muted-foreground">Adaugă în hală</div>
          <div className="flex flex-wrap gap-1">
            {STATION_KINDS.map((k) => (
              <Button key={k} size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => add(k)}><Plus className="mr-1 h-3 w-3" />{ADD_NAME[k]}</Button>
            ))}
          </div>
        </div>

        {st ? (
          <div className="space-y-2 rounded-lg border bg-muted/40 p-2">
            <label className="block text-xs"><span className="font-semibold">Nume</span>
              <Input className="mt-1 h-8" value={st.label} maxLength={60} onChange={(e) => patch({ label: e.target.value })} />
            </label>
            <label className="block text-xs"><span className="font-semibold">Ce fel de utilaj</span>
              <select className={selectCls} value={st.kind} onChange={(e) => patch({ kind: e.target.value as StationKind })}>
                {STATION_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </select>
            </label>
            <label className="block text-xs"><span className="font-semibold">Linia care lucrează aici</span>
              <select className={selectCls} value={st.lineId ?? ""} onChange={(e) => setDraft(setStationLine(draft, st.id, e.target.value || null))}>
                <option value="">— niciuna (liber) —</option>
                {lines.map((l) => {
                  const other = draft.find((s) => s.lineId === l.id && s.id !== st.id);
                  return <option key={l.id} value={l.id}>{l.nume}{other ? ` (acum la ${other.label})` : ""}</option>;
                })}
              </select>
            </label>
            <div className="flex flex-wrap items-center gap-1">
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => patch({ rot: ((st.rot || 0) + 90) % 360 })}><RotateCw className="mr-1 h-3 w-3" />Rotește</Button>
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => nudge(-10, 0)} title="Stânga"><ArrowLeft className="h-3 w-3" /></Button>
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => nudge(0, -10)} title="Sus"><ArrowUp className="h-3 w-3" /></Button>
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => nudge(0, 10)} title="Jos"><ArrowDown className="h-3 w-3" /></Button>
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => nudge(10, 0)} title="Dreapta"><ArrowRight className="h-3 w-3" /></Button>
              <Button size="sm" variant="ghost" className="ml-auto h-7 px-2 text-xs text-destructive" onClick={() => {
                if (!window.confirm(`Scoți „${st.label}" din hală?${st.lineId ? ` Linia ${lineName(st.lineId)} rămâne fără loc.` : ""}`)) return;
                setDraft(draft.filter((s) => s.id !== st.id)); setSelectedId(null);
              }}><Trash2 className="mr-1 h-3 w-3" />Scoate</Button>
            </div>
          </div>
        ) : <p className="text-xs text-muted-foreground">Alege un utilaj din hală sau din lista de mai jos.</p>}

        {unplaced.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-bold uppercase text-muted-foreground">Linii fără loc în hală</div>
            {unplaced.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-2 border-t py-1 text-xs">
                <span className="truncate">{l.nume}</span>
                <div className="flex shrink-0 gap-1">
                  {st && <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[11px]" onClick={() => setDraft(setStationLine(draft, st.id, l.id))}>Pune la {st.label.slice(0, 14)}</Button>}
                  <Button size="sm" variant="outline" className="h-6 px-1.5 text-[11px]" onClick={() => add("masa", l.id)}><Plus className="mr-0.5 h-3 w-3" />masă nouă</Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div>
          <div className="mb-1 text-xs font-bold uppercase text-muted-foreground">În hală ({draft.length})</div>
          {draft.map((s) => (
            <button key={s.id} type="button" onClick={() => setSelectedId(s.id)}
              className={`flex w-full justify-between gap-2 border-t py-1 text-left text-xs ${s.id === selectedId ? "font-bold text-primary" : ""}`}>
              <span className="truncate">{s.label}</span>
              <span className="truncate text-muted-foreground">{lineName(s.lineId) ?? "liber"}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5 border-t p-2">
        <Button className="w-full" disabled={saving || !changed} onClick={onSave}>{saving ? "Se salvează…" : "Salvează pentru toți colegii"}</Button>
        <div className="flex gap-1.5">
          <Button className="flex-1" variant="outline" size="sm" onClick={onCancel}>Renunță</Button>
          <Button className="flex-1" variant="ghost" size="sm" onClick={onReset} title="Pune la loc utilajele din planul inițial al halei">Planul inițial</Button>
        </div>
        <p className="text-[10px] text-muted-foreground">Schimbă doar desenul din Viziune; comenzile și producția rămân neatinse.</p>
      </div>
    </div>
  );
}
