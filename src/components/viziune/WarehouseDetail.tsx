// Side panels for the warehouses in Viziune: raw-material store (products → lots) and Picking (stores → products), with pallets.
import { useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import LineMaterialLotsCard from "@/components/productie/LineMaterialLotsCard";
import type { DepotProduct, PerPallet, PickStore } from "@/lib/viziune/warehouseState";

const fmt = (n: number, d = 0) => n.toLocaleString("ro-RO", { maximumFractionDigits: d, minimumFractionDigits: 0 });
const pal = (n: number) => fmt(n, n < 10 ? 1 : 0);
const dayLabel = (d: string | null) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit" }) : "—");
const SOURCE: Record<NonNullable<PerPallet>["source"], string> = {
  magazin: "din articolul Senior al magazinului",
  produs: "din Senior",
  aproximativ: "aproximativ: codurile Senior ale produsului au paleți diferiți",
};

function Totals({ items }: { items: [string, string][] }) {
  return (
    <div className="mb-2 grid grid-cols-3 gap-1.5">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-md border bg-muted/40 px-2 py-1">
          <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
          <div className="font-black tabular-nums">{value}</div>
        </div>
      ))}
    </div>
  );
}

function Filter({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative mb-2">
      <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-8 pl-7 text-xs" />
    </div>
  );
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function DepotDetail({ products, loading, error }: { products: DepotProduct[]; loading: boolean; error: Error | null }) {
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const shown = products.filter((p) => !q || norm(p.name).includes(norm(q)) || p.lots.some((l) => norm(`${l.lot} ${l.supplier}`).includes(norm(q))));
  const kg = products.filter((p) => /^kg$/i.test(p.unit)).reduce((a, p) => a + p.qty, 0);
  const pallets = products.reduce((a, p) => a + (p.pallets ?? 0), 0);
  const noNorm = products.filter((p) => p.pallets == null);
  const lots = products.reduce((a, p) => a + p.lots.length, 0);
  return (
    <div className="text-xs">
      <Totals items={[["Produse · loturi", `${products.length} · ${lots}`], ["Pe stoc", `${fmt(kg)} kg`], ["Paleți", loading ? "…" : `≈ ${pal(pallets)}`]]} />
      {error && <p className="mb-2 text-destructive">Nu am putut citi normele de palet: {error.message}</p>}
      {!loading && noNorm.length > 0 && <p className="mb-2 text-muted-foreground">{noNorm.length === 1 ? "Un produs fără normă kg/palet în Reguli de calcul nu intră" : `${noNorm.length} produse fără normă kg/palet în Reguli de calcul nu intră`} în totalul de paleți.</p>}
      <Filter value={q} onChange={setQ} placeholder="Caută produs, lot sau furnizor" />
      {shown.length === 0 && <p className="text-muted-foreground">Nimic pe stoc{q ? " pentru căutarea asta" : ""}.</p>}
      {shown.map((p) => {
        const isOpen = open === p.name || (q.length > 1 && shown.length <= 3);
        const oldest = p.lots.find((l) => l.ageDays != null)?.ageDays ?? null;
        return (
          <div key={p.name} className="border-b last:border-0">
            <button type="button" className="flex w-full items-center gap-1.5 py-1.5 text-left hover:bg-muted/50" onClick={() => setOpen(isOpen ? null : p.name)}>
              {isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
              <span className="flex-1 truncate font-medium">{p.name}</span>
              <span className="tabular-nums text-muted-foreground">{p.lots.length} {p.lots.length === 1 ? "lot" : "loturi"}{oldest != null && oldest > 0 ? ` · ${oldest} zile` : ""}</span>
              <span className="w-20 text-right font-semibold tabular-nums">{fmt(p.qty, 1)} {p.unit}</span>
              <span className="w-14 text-right tabular-nums">{p.pallets != null ? `${pal(p.pallets)} pal` : "—"}</span>
            </button>
            {isOpen && (
              <div className="mb-2 ml-5 rounded-md border bg-muted/30">
                <div className="px-2 py-1 text-[10px] text-muted-foreground">{p.kgPerPallet ? `${fmt(p.kgPerPallet)} kg/palet (Reguli de calcul)` : "Fără normă kg/palet în Reguli de calcul"} · cel mai vechi primul</div>
                <table className="w-full">
                  <thead className="text-[10px] text-muted-foreground"><tr><th className="px-2 text-left font-normal">Lot</th><th className="text-left font-normal">Furnizor</th><th className="text-left font-normal">Intrat</th><th className="px-2 text-right font-normal">Cantitate</th></tr></thead>
                  <tbody>{p.lots.map((l, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1 font-semibold">{l.lot}{l.document && <div className="font-normal text-muted-foreground">NIR {l.document}</div>}</td>
                      <td className="max-w-[120px] truncate py-1">{l.supplier}</td>
                      <td className={`py-1 tabular-nums ${l.ageDays != null && l.ageDays > 3 ? "font-semibold text-destructive" : ""}`}>{dayLabel(l.receiptDay)}{l.ageDays != null && <span className="text-muted-foreground"> · {l.ageDays === 0 ? "azi" : `${l.ageDays} z`}</span>}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{fmt(l.qty, 2)} {l.unit}{p.kgPerPallet && /^kg$/i.test(l.unit) ? <div className="text-muted-foreground">{pal(l.qty / p.kgPerPallet)} pal</div> : null}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function PickingDetail({ stores, lines, today, loading, error }: { stores: PickStore[]; lines: { id: string; nume: string }[]; today: string; loading: boolean; error: Error | null }) {
  const [open, setOpen] = useState<string | null>(null);
  const [lotsOf, setLotsOf] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const lineName = (id: string) => lines.find((l) => l.id === id)?.nume ?? "";
  const shown = stores.filter((s) => !q || norm(s.store).includes(norm(q)) || s.products.some((p) => norm(p.name).includes(norm(q))));
  const pallets = stores.reduce((a, s) => a + s.pallets, 0);
  const missing = stores.reduce((a, s) => a + s.missing, 0);
  return (
    <div className="text-xs">
      <Totals items={[["Magazine", `${stores.length}`], ["Bucăți gata", fmt(stores.reduce((a, s) => a + s.pieces, 0))], ["Paleți", loading ? "…" : `≈ ${pal(pallets)}`]]} />
      {error && <p className="mb-2 text-destructive">Nu am putut citi din Senior câte bucăți intră pe palet: {error.message}</p>}
      {!loading && missing > 0 && <p className="mb-2 text-muted-foreground">{missing === 1 ? "Un produs fără bucăți/palet în Senior nu intră" : `${missing} produse fără bucăți/palet în Senior nu intră`} în totalul de paleți.</p>}
      <Filter value={q} onChange={setQ} placeholder="Caută magazin sau produs" />
      {shown.length === 0 && <p className="text-muted-foreground">{stores.length ? "Nimic pentru căutarea asta." : "Încă nu e marfă gata azi."}</p>}
      {shown.map((s) => {
        const isOpen = open === s.store || (q.length > 1 && shown.length <= 2);
        return (
          <div key={s.store} className="border-b last:border-0">
            <button type="button" className="flex w-full items-center gap-1.5 py-1.5 text-left hover:bg-muted/50" onClick={() => setOpen(isOpen ? null : s.store)}>
              {isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
              <span className="flex-1 truncate font-medium">{s.store}</span>
              <span className="tabular-nums text-muted-foreground">{s.products.length} prod.</span>
              <span className="w-20 text-right font-semibold tabular-nums">{fmt(s.pieces)} buc</span>
              <span className="w-16 text-right tabular-nums">{s.pallets > 0 ? `${pal(s.pallets)} pal` : "—"}{s.missing > 0 && s.pallets > 0 ? "+" : ""}</span>
            </button>
            {isOpen && (
              <div className="mb-2 ml-5 rounded-md border bg-muted/30">
                {s.pallets > 0 && <div className="px-2 py-1 text-[10px] text-muted-foreground">≈ {pal(s.pallets)} paleți plini; la încărcare înseamnă cel puțin {Math.ceil(s.pallets - 1e-9)} paleți{s.missing ? `, plus ${s.missing === 1 ? "un produs" : `${s.missing} produse`} fără normă` : ""}.</div>}
                <table className="w-full">
                  <thead className="text-[10px] text-muted-foreground"><tr><th className="px-2 text-left font-normal">Produs</th><th className="text-right font-normal">Gata / comandat</th><th className="text-right font-normal">Buc/palet</th><th className="px-2 text-right font-normal">Paleți</th></tr></thead>
                  <tbody>{s.products.map((p) => {
                    const k = `${s.store}|${p.key}`;
                    const names = p.lineIds.map(lineName).filter(Boolean);
                    return (
                      <tr key={p.key} className="border-t align-top">
                        <td className="px-2 py-1" colSpan={lotsOf === k ? 4 : 1}>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-muted-foreground">{names.join(", ") || "fără linie"} · {p.orders} {p.orders === 1 ? "comandă" : "comenzi"}
                            {names.length > 0 && <button type="button" className="ml-1 underline" onClick={() => setLotsOf(lotsOf === k ? null : k)}>{lotsOf === k ? "ascunde loturile" : "loturi MP"}</button>}
                          </div>
                          {lotsOf === k && <div className="mt-1"><LineMaterialLotsCard produsId={p.productId} comandaId={p.orderIds[0]} lineNames={names} day={today} /></div>}
                        </td>
                        {lotsOf !== k && <>
                          <td className="py-1 text-right tabular-nums">{fmt(p.produced)} / {fmt(p.ordered)}</td>
                          <td className="py-1 text-right tabular-nums" title={p.perPallet ? SOURCE[p.perPallet.source] : "Senior nu are bucăți/palet pentru articolul acesta"}>{p.perPallet ? `${fmt(p.perPallet.pieces)}${p.perPallet.source === "aproximativ" ? "*" : ""}` : "—"}</td>
                          <td className="px-2 py-1 text-right font-semibold tabular-nums">{p.pallets != null ? pal(p.pallets) : "—"}</td>
                        </>}
                      </tr>
                    );
                  })}</tbody>
                </table>
                {s.products.some((p) => p.perPallet?.source === "aproximativ") && <div className="px-2 py-1 text-[10px] text-muted-foreground">* codurile Senior ale produsului au paleți diferiți; am luat valoarea cea mai des întâlnită.</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
