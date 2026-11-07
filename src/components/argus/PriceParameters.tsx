import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LABOUR_LINES, type PriceConfig } from "../../../supabase/functions/_shared/priceConfig";

export type ParameterValues = Record<string, string>;
export const PARAMETER_GROUPS = [
  ["Produs", [["unitsPerCase", "Bucăți / bax"], ["piecesPerPallet", "Bucăți / palet produs finit"]]],
  ["Transport aprovizionare (ultimele prețuri)", [
    ["supplyTotal", "Cost mediu pe camion (lei, ultimele 30 zile)"], ["supplyPallets", "Paleți pe camion (medie 90 zile)"], ["supplyKg", "Kg materii prime pe camion (medie 90 zile)"],
    ["supplyPerPallet", "Tarif aprovizionare (lei/palet)"], ["supplyPerKg", "Tarif aprovizionare (lei/kg)"],
  ]],
  ["Transport distribuție (cursa aleasă, ultimele prețuri)", [
    ["distributionTotal", "Cost curse ultimele 30 zile (lei)"], ["distributionTrips", "Număr curse ultimele 30 zile"], ["distributionPallets", "Paleți transportați în acele curse"],
    ["distributionPalletsPerTrip", "Paleți pe cursă (medie)"], ["distributionPerPallet", "Tarif distribuție (lei/palet)"],
  ]],
  ["Manoperă", [
    ["labourPeople", "Oameni pe linie"], ["labourSpeed", "Viteză linie (buc/oră)"], ["labourHourCost", "Cost orar / om (lei)"], ["labourOverheadPct", "Regie fabrică %"],
    ["labourPerPiece", "Manoperă directă (lei/buc)"], ["utilitiesPerPiece", "Regie fabrică (lei/buc)"],
  ]],
  ["Marjă, taxe, curs", [["marginPct", "Marjă brută %"], ["feePct", "Taxe rețea % din prețul final"], ["clientFeePerPiece", "Taxe rețea fixe (lei/buc)"], ["eurRate", "Curs EUR"], ["eurBufferPct", "Siguranță curs %"], ["techLossPct", "Pierdere suplimentară scenariu %"]]],
] as const;
export const PARAMETER_FIELDS = PARAMETER_GROUPS.flatMap(([, f]) => f as unknown as Array<readonly [string, string]>);

export function NumericParameter({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <label className="block space-y-1 text-xs text-muted-foreground"><span>{label}</span><Input aria-label={label} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}
export function PriceParameters({ values, setValue, mode, setMode, route, setRoute, routes = [], line, setLine, basis, setBasis }: {
  values: ParameterValues; setValue: (key: string, v: string) => void;
  mode: "annual" | "week"; setMode: (v: "annual" | "week") => void;
  route: string; setRoute: (v: string) => void; routes?: Array<{ value: string; label: string }>; line: string; setLine: (v: string) => void;
  basis: "pallet" | "kg"; setBasis: (v: "pallet" | "kg") => void;
}) {
  const selectClass = "h-10 w-full rounded-md border border-input bg-background px-2 text-sm";
  const lineInfo = LABOUR_LINES.find((l) => l.name === line);
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="space-y-1"><Label>Preț materii prime</Label><select aria-label="Preț materii prime" className={selectClass} value={mode} onChange={(e) => setMode(e.target.value as PriceConfig["rawPriceMode"] ?? "annual")}><option value="annual">Medie anuală ponderată</option><option value="week">Medie intrări ultima săptămână</option></select></label>
      <label className="space-y-1"><Label>Aprovizionare în total</Label><select aria-label="Aprovizionare în total" className={selectClass} value={basis} onChange={(e) => setBasis(e.target.value as "pallet" | "kg")}><option value="pallet">Pe palet</option><option value="kg">Pe kg</option></select></label>
      <label className="space-y-1"><Label>Cursă distribuție</Label><select aria-label="Cursă distribuție" className={selectClass} value={route} onChange={(e) => setRoute(e.target.value)}>{(routes.some((r) => r.value === route) ? routes : [{ value: route, label: route }, ...routes]).map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select></label>
      <label className="space-y-1"><Label>Linie de producție</Label><select aria-label="Linie de producție" className={selectClass} value={line} onChange={(e) => setLine(e.target.value)}><option value="">Alege linia / tarif manual</option>{LABOUR_LINES.map((l) => <option key={l.name} value={l.name}>{l.name}{l.total != null ? ` · ${l.total} lei/buc` : " · după viteza mixului"}</option>)}</select></label>
    </div>
    {PARAMETER_GROUPS.map(([title, fields]) => <div key={title} className="space-y-2">
      <p className="text-xs font-medium">{title}{title === "Manoperă" && lineInfo?.note ? ` · ${lineInfo.note}` : ""}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map(([key, label]) => <NumericParameter key={key} label={label} value={values[key] ?? ""} onChange={(v) => setValue(key, v)} />)}
      </div>
    </div>)}
  </div>;
}
