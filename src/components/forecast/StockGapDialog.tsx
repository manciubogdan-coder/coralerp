import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { explainStockGap, type ProductionUsage } from "@/lib/forecastReconciliation";
import { cn } from "@/lib/utils";

type Gap = ReturnType<typeof explainStockGap>;

const fmt = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("ro-RO", { maximumFractionDigits: 1 });
const signed = (n: number | null) => (n == null ? "—" : `${n > 0 ? "+" : ""}${fmt(n)}`);
const dayLabel = (d: string) => format(new Date(`${d}T12:00:00`), "EEE d MMM", { locale: ro });

export default function StockGapDialog({
  open, onOpenChange, name, unit, today, gap, shifted = [],
}: { shifted?: ProductionUsage[]; open: boolean; onOpenChange: (v: boolean) => void; name: string; unit: string; today: string; gap: Gap | null }) {
  const u = unit.toLowerCase();
  const u_ = u;
  const first = gap?.days[0]?.day;
  const missing = gap?.days.filter((d) => d.opening == null).map((d) => dayLabel(d.day)) || [];
  const causes = gap ? [
    { label: "Recepționat față de comandat", value: gap.receivedVsOrdered, hint: `comandat ${fmt(gap.ordered)} ${u}, recepționat ${fmt(gap.received)} ${u}` },
    { label: "Retururi în depozit", value: gap.returned, hint: "marfă întoarsă din producție" },
    { label: "Consumat față de necesarul planificat", value: -gap.consumedOverPlan, hint: `ieșit din depozit ${fmt(gap.outbound)} ${u}, necesar din comenzi ${fmt(gap.planned)} ${u}` },
    { label: "Diferență de inventar neexplicată", value: gap.unexplained, hint: "stocul numărat dimineața nu se potrivește cu mișcările înregistrate" },
  ] : [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>De unde vine diferența la {name}</DialogTitle>
        </DialogHeader>
        {!gap || !first ? (
          <p className="text-sm text-muted-foreground">
            Alege în proiecție o dată de început din trecut (de ex. ziua în care ai făcut captura) ca să vezi ce s-a schimbat până azi.
          </p>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Stoc la {dayLabel(first)}</div>
                <div className="text-lg font-semibold tabular-nums">{fmt(gap.start)} {u}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Trebuia să ai azi ({dayLabel(today)})</div>
                <div className="text-lg font-semibold tabular-nums">{fmt(gap.expected)} {u}</div>
                <div className="text-[11px] text-muted-foreground">stoc + comandat − necesar comenzi</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Ai azi în stoc</div>
                <div className="text-lg font-semibold tabular-nums">{fmt(gap.actual)} {u}</div>
                <div className={cn("text-[11px] font-medium", (gap.gap ?? 0) < 0 ? "text-destructive" : "text-muted-foreground")}>
                  diferență {signed(gap.gap)} {u}
                </div>
              </div>
            </div>

            <div className="rounded-md border">
              <div className="px-3 py-2 border-b font-medium">Cauzele diferenței</div>
              {causes.map((c) => (
                <div key={c.label} className="flex items-start justify-between gap-4 px-3 py-2 border-b last:border-b-0">
                  <div>
                    <div>{c.label}</div>
                    <div className="text-[11px] text-muted-foreground">{c.hint}</div>
                  </div>
                  <div className={cn("tabular-nums font-semibold whitespace-nowrap", (c.value ?? 0) < 0 && "text-destructive")}>
                    {signed(c.value)} {u}
                  </div>
                </div>
              ))}
              {(gap.advances > 0 || gap.otherDays > 0 || gap.qualityLoss > 0) && (
                <div className="px-3 py-2 bg-muted/40 text-[12px] space-y-0.5">
                  {gap.advances > 0 && <div>Din consum, lucrat în avans (estimat din rețete): {fmt(gap.advances)} {u}</div>}
                  {gap.otherDays > 0 && <div>Din consum, produs pentru comenzile altor zile (estimat): {fmt(gap.otherDays)} {u}</div>}
                  {gap.qualityLoss > 0 && <div>Pierdere calitativă raportată la recepții: {fmt(gap.qualityLoss)} {u}</div>}
                </div>
              )}
            </div>
            {missing.length > 0 && (
              <p className="text-xs text-amber-700">Lipsește stocul de început pentru: {missing.join(", ")}. Diferența neexplicată nu poate fi calculată exact.</p>
            )}

            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left p-1.5">Zi</th>
                  <th className="text-right p-1.5">Stoc înc.</th>
                  <th className="text-right p-1.5">Comandat</th>
                  <th className="text-right p-1.5">Recepționat</th>
                  <th className="text-right p-1.5">Necesar comenzi</th>
                  <th className="text-right p-1.5">Consum real</th>
                </tr>
              </thead>
              <tbody>
                {gap.days.map((d) => (
                  <tr key={d.day} className="border-b">
                    <td className="p-1.5 capitalize">{dayLabel(d.day)}</td>
                    <td className="p-1.5 text-right tabular-nums">{fmt(d.opening)}</td>
                    <td className="p-1.5 text-right tabular-nums">{fmt(d.ordered)}</td>
                    <td className={cn("p-1.5 text-right tabular-nums", d.received < d.ordered && "text-destructive")}>{fmt(d.received)}</td>
                    <td className="p-1.5 text-right tabular-nums">{fmt(d.planned)}</td>
                    <td className={cn("p-1.5 text-right tabular-nums", d.outbound - d.returned > d.planned && "text-destructive")}>{fmt(d.outbound - d.returned)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="rounded-md border">
              <div className="px-3 py-2 border-b font-medium">Producție lucrată pentru alte zile / avans</div>
              {shifted.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">Nu s-a lucrat nimic pentru alte zile în perioada aleasă.</p>
              ) : (
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left p-1.5">Lucrat în</th>
                      <th className="text-left p-1.5">Comanda era pentru</th>
                      <th className="text-left p-1.5">Produs</th>
                      <th className="text-left p-1.5">Client</th>
                      <th className="text-right p-1.5">{name} consumat (est.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...shifted].sort((a, b) => a.day.localeCompare(b.day)).map((u, i) => (
                      <tr key={i} className="border-b">
                        <td className="p-1.5 capitalize">{dayLabel(u.day)}</td>
                        <td className={cn("p-1.5 capitalize", u.targetDay && u.targetDay > u.day && "text-destructive")}>
                          {u.advance ? "Avans" : u.targetDay ? `${dayLabel(u.targetDay)}${u.targetDay > u.day ? " (viitor)" : " (trecut)"}` : "—"}
                        </td>
                        <td className="p-1.5">{u.product}</td>
                        <td className="p-1.5">{u.client}</td>
                        <td className="p-1.5 text-right tabular-nums">{fmt(u.quantity)} {u_}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
