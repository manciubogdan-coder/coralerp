import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LABOUR_LINES, ROUTES, type PriceConfig } from "../../../supabase/functions/_shared/priceConfig";

export type ParameterValues = Record<string, string>;
export const PARAMETER_FIELDS = [
  ["unitsPerCase", "Bucăți / bax"], ["piecesPerPallet", "Bucăți / palet produs finit"],
  ["supplyTotal", "Cost total aprovizionare (lei, luna închisă)"], ["supplyPallets", "Paleți recepționați (luna închisă)"],
  ["supplyPerPallet", "Tarif aprovizionare manual (lei/palet)"],
  ["distributionTotal", "Cost total distribuție rută (lei)"], ["distributionPallets", "Paleți facturați pe rută"],
  ["distributionPerPallet", "Tarif distribuție manual (lei/palet)"],
  ["labourPerPiece", "Manoperă directă (lei/buc)"], ["utilitiesPerPiece", "Regie fabrică (lei/buc)"],
  ["marginPct", "Marjă brută %"], ["feePct", "Taxe rețea % din prețul final"], ["clientFeePerPiece", "Taxe rețea fixe (lei/buc)"],
  ["eurRate", "Curs EUR"], ["eurBufferPct", "Siguranță curs %"], ["techLossPct", "Pierdere suplimentară scenariu %"],
] as const;
export function NumericParameter({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <label className="block space-y-1 text-xs text-muted-foreground"><span>{label}</span><Input aria-label={label} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}
export function PriceParameters({ values, setValue, mode, setMode, route, setRoute, line, setLine }: {
  values: ParameterValues; setValue: (key: string, v: string) => void;
  mode: "annual" | "week"; setMode: (v: "annual" | "week") => void;
  route: string; setRoute: (v: string) => void; line: string; setLine: (v: string) => void;
}) {
  const selectClass = "h-10 w-full rounded-md border border-input bg-background px-2 text-sm";
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <label className="space-y-1"><Label>Preț materii prime</Label><select aria-label="Preț materii prime" className={selectClass} value={mode} onChange={(e) => setMode(e.target.value as PriceConfig["rawPriceMode"] ?? "annual")}><option value="annual">Medie anuală ponderată</option><option value="week">Medie intrări ultima săptămână</option></select></label>
    <label className="space-y-1"><Label>Rută distribuție</Label><select aria-label="Rută distribuție" className={selectClass} value={route} onChange={(e) => setRoute(e.target.value)}>{ROUTES.map((r) => <option key={r}>{r}</option>)}</select></label>
    <label className="space-y-1"><Label>Linie de producție</Label><select aria-label="Linie de producție" className={selectClass} value={line} onChange={(e) => setLine(e.target.value)}><option value="">Alege linia / tarif manual</option>{LABOUR_LINES.map((l) => <option key={l.name} value={l.name}>{l.name}{l.total != null ? ` · ${l.total} lei/buc` : " · tarif de completat"}</option>)}</select></label>
    {PARAMETER_FIELDS.map(([key, label]) => <NumericParameter key={key} label={label} value={values[key] ?? ""} onChange={(v) => setValue(key, v)} />)}
  </div>;
}