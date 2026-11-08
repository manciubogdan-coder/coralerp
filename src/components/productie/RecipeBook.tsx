import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import XLSXStyle from "xlsx-js-style";
import { Download, Loader2, Printer, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrderPackaging } from "@/hooks/productie/useOrderPackaging";
import { packagingUnits, resolveStorePackaging } from "../../../supabase/functions/_shared/packagingRules";
import { buildRecipeBook, isMixed, lossFor, mainClient, toKg, type BookClient, type LossRule, type MixedRecipe } from "@/lib/productie/recipeBook";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest" }).format(new Date());
const kg = (n: number, d = 2) => n.toLocaleString("ro-RO", { minimumFractionDigits: d, maximumFractionDigits: d });
const per = (n: number) => n.toLocaleString("ro-RO", { maximumFractionDigits: 4 });
const ro = (d: string) => d.split("-").reverse().join(".");
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

async function pages<T = any>(query: () => any): Promise<T[]> {
  const rows: T[] = [];
  while (true) {
    const { data, error } = await query().range(rows.length, rows.length + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) return rows;
  }
}

function useRecipeData() {
  return useQuery({
    queryKey: ["retetar-recipes"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [recipes, losses] = await Promise.all([
        pages(() => supabase.from("productie_retete").select("id, produs_id, activa, versiune, productie_produse(id, nume), productie_retete_ingrediente(cantitate_necesara, unitate_masura, productie_ingrediente(nume))").order("id")),
        pages<LossRule>(() => supabase.from("products").select("name, pt_percent").order("id")),
      ]);
      // One recipe per product: the active one, latest version first.
      const best = new Map<string, any>();
      for (const r of recipes as any[]) {
        const cur = best.get(r.produs_id);
        if (!cur || Number(r.activa) > Number(cur.activa) || (r.activa === cur.activa && Number(r.versiune) > Number(cur.versiune))) best.set(r.produs_id, r);
      }
      const list: MixedRecipe[] = [...best.values()].map((r: any) => ({
        produsId: String(r.produs_id), produs: r.productie_produse?.nume || "?",
        ingredients: (r.productie_retete_ingrediente || []).map((i: any) => ({ nume: i.productie_ingrediente?.nume || "?", kgPerBuc: toKg(Number(i.cantitate_necesara) || 0, i.unitate_masura) })),
      }));
      return { recipes: list, losses };
    },
  });
}

const border = { style: "thin", color: { rgb: "000000" } };
const box = { top: border, bottom: border, left: border, right: border };
const HEAD = ["Nr.", "Produs", "Buc/bax", "Ingredient", "Kg / buc", "Total buc", "Kg net", "PT %", "Kg brut", "Total net produs", "Total brut produs"];

function clientSheet(c: BookClient, day: string) {
  const aoa: any[][] = [[`REȚETE PENTRU COMENZILE PRIMITE — ${c.client}`], [`Data producție: ${ro(day)} · comenzi Senior`], [], HEAD];
  const merges: any[] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: HEAD.length - 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: HEAD.length - 1 } }];
  c.products.forEach((p, i) => {
    const start = aoa.length;
    p.ingredients.forEach((ing, k) => aoa.push([
      k ? "" : i + 1, k ? "" : p.produs, k ? "" : p.bucBax ? `${p.bucBax} buc/bax` : "", ing.nume, ing.kgPerBuc, k ? "" : p.bucati,
      { f: `E${aoa.length + 1}*$F$${start + 1}`, v: ing.netKg }, ing.ptPct ?? "", { f: `G${aoa.length + 1}*(1+N(H${aoa.length + 1})/100)`, v: ing.brutKg },
      k ? "" : { f: `SUM(G${start + 1}:G${start + p.ingredients.length})`, v: p.netKg }, k ? "" : { f: `SUM(I${start + 1}:I${start + p.ingredients.length})`, v: p.brutKg },
    ]));
    if (p.ingredients.length > 1) [0, 1, 2, 5, 9, 10].forEach(col => merges.push({ s: { r: start, c: col }, e: { r: aoa.length - 1, c: col } }));
  });
  const last = aoa.length;
  aoa.push(["", "TOTAL " + c.client, "", "", "", { f: `SUM(F5:F${last})`, v: c.bucati }, "", "", "", { f: `SUM(J5:J${last})`, v: c.netKg }, { f: `SUM(K5:K${last})`, v: c.brutKg }]);
  const totalRow = aoa.length - 1;
  aoa.push([], ["", "TOTAL PE MATERIE PRIMĂ", "", "Ingredient", "", "", "Kg net", "PT %", "Kg brut"]);
  const matHead = aoa.length - 1;
  c.materials.forEach(m => aoa.push(["", "", "", m.nume, "", "", m.netKg, m.ptPct ?? "", { f: `G${aoa.length + 1}*(1+N(H${aoa.length + 1})/100)`, v: m.brutKg }]));
  const ws = XLSXStyle.utils.aoa_to_sheet(aoa);
  ws["!merges"] = merges;
  ws["!cols"] = [6, 34, 11, 24, 10, 10, 11, 7, 11, 14, 14].map(wch => ({ wch }));
  Object.keys(ws).forEach(ref => {
    if (ref.startsWith("!")) return;
    const { r, c: col } = XLSXStyle.utils.decode_cell(ref);
    const cell = ws[ref];
    const font = { name: "Arial", sz: 10 } as any;
    if (r === 0) { cell.s = { font: { name: "Arial", sz: 14, bold: true }, alignment: { horizontal: "center" } }; return; }
    if (r === 1) { cell.s = { font: { name: "Arial", sz: 10, italic: true }, alignment: { horizontal: "center" } }; return; }
    const head = r === 3 || r === matHead;
    const numFmt = col === 4 ? "0.0000" : col === 5 ? "#,##0" : col === 7 ? "0" : [6, 8, 9, 10].includes(col) ? "#,##0.00" : undefined;
    cell.s = {
      font: { ...font, bold: head || r === totalRow || col === 1 || col >= 9 },
      fill: head ? { fgColor: { rgb: "D9E1F2" } } : r === totalRow ? { fgColor: { rgb: "FCE4D6" } } : undefined,
      border: r > matHead && col < 3 ? undefined : box,
      alignment: { vertical: "center", horizontal: head || [0, 2, 5].includes(col) ? "center" : col >= 4 ? "right" : "left", wrapText: true },
      ...(numFmt && !head ? { numFmt } : {}),
    };
  });
  return ws;
}

function exportBook(book: BookClient[], day: string) {
  const wb = XLSXStyle.utils.book_new();
  const used = new Set<string>();
  book.forEach(c => {
    let name = c.client.replace(/[\\/?*[\]:]/g, " ").slice(0, 28).trim() || "Client";
    for (let i = 2; used.has(name); i++) name = `${name.slice(0, 26)} ${i}`;
    used.add(name);
    XLSXStyle.utils.book_append_sheet(wb, clientSheet(c, day), name);
  });
  XLSXStyle.writeFile(wb, `Retetar comenzi ${ro(day)}.xlsx`);
}

function printBook(book: BookClient[], day: string) {
  const th = HEAD.map(h => `<th>${esc(h)}</th>`).join("");
  const body = book.map(c => `
    <section><h1>Rețete pentru comenzile primite — ${esc(c.client)}</h1><p class="sub">Data producție: ${ro(day)} · comenzi Senior</p>
    <table><thead><tr>${th}</tr></thead><tbody>
    ${c.products.map((p, i) => p.ingredients.map((ing, k) => `<tr>
      ${k ? "" : `<td rowspan="${p.ingredients.length}" class="c">${i + 1}</td><td rowspan="${p.ingredients.length}" class="b">${esc(p.produs)}</td><td rowspan="${p.ingredients.length}" class="c">${p.bucBax ? `${esc(p.bucBax)} buc/bax` : ""}</td>`}
      <td>${esc(ing.nume)}</td><td class="r">${per(ing.kgPerBuc)}</td>
      ${k ? "" : `<td rowspan="${p.ingredients.length}" class="c b">${p.bucati.toLocaleString("ro-RO")}</td>`}
      <td class="r">${kg(ing.netKg)}</td><td class="r">${ing.ptPct ?? "—"}</td><td class="r">${kg(ing.brutKg)}</td>
      ${k ? "" : `<td rowspan="${p.ingredients.length}" class="r b">${kg(p.netKg, 1)}</td><td rowspan="${p.ingredients.length}" class="r b">${kg(p.brutKg, 1)}</td>`}
    </tr>`).join("")).join("")}
    <tr class="t"><td></td><td colspan="4">TOTAL ${esc(c.client)}</td><td class="c">${c.bucati.toLocaleString("ro-RO")}</td><td colspan="3"></td><td class="r">${kg(c.netKg, 1)}</td><td class="r">${kg(c.brutKg, 1)}</td></tr>
    </tbody></table>
    <h2>Total pe materie primă</h2>
    <table class="m"><thead><tr><th>Ingredient</th><th>Kg net</th><th>PT %</th><th>Kg brut</th></tr></thead><tbody>
    ${c.materials.map(m => `<tr><td>${esc(m.nume)}</td><td class="r">${kg(m.netKg)}</td><td class="r">${m.ptPct ?? "—"}</td><td class="r">${kg(m.brutKg)}</td></tr>`).join("")}
    </tbody></table></section>`).join("");
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Rețetar ${ro(day)}</title><style>
    @page{size:A4 landscape;margin:8mm} body{font-family:Arial,sans-serif;font-size:11px;color:#000;margin:0}
    section{page-break-after:always} section:last-child{page-break-after:auto}
    h1{font-size:16px;margin:0 0 2px} h2{font-size:13px;margin:10px 0 4px} .sub{margin:0 0 6px;font-style:italic}
    table{border-collapse:collapse;width:100%} table.m{width:auto;min-width:50%} th,td{border:1px solid #000;padding:3px 5px;vertical-align:middle}
    th{background:#d9e1f2} tr{page-break-inside:avoid} .c{text-align:center} .r{text-align:right} .b{font-weight:bold} .t td{font-weight:bold;background:#fce4d6}
    *{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>${body}</body></html>`);
  doc.close();
  setTimeout(() => { frame.contentWindow!.focus(); frame.contentWindow!.print(); setTimeout(() => frame.remove(), 1000); }, 300);
}

function OrdersRecipes() {
  const [day, setDay] = useState(today);
  const [client, setClient] = useState("__all");
  const recipeData = useRecipeData();
  const packaging = useOrderPackaging();
  const orders = useQuery({
    queryKey: ["retetar-orders", day],
    queryFn: async () => {
      const [rows, clients] = await Promise.all([
        pages(() => supabase.from("productie_comenzi").select("id, magazin, punct_livrare, produs_id, cantitate, baxare, tip_comanda").eq("data_productie", day).eq("sursa", "senior-erp").order("id")),
        pages(() => supabase.from("productie_clienti").select("id, nume_magazin, punct_livrare, nickname").order("id")),
      ]);
      return { rows: rows as any[], clients: clients as any[] };
    },
  });

  const book = useMemo(() => {
    if (!orders.data || !recipeData.data) return [];
    const key = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim().toUpperCase();
    const exact = new Map<string, string>(), byName = new Map<string, string>();
    orders.data.clients.forEach(c => {
      if (!String(c.nickname ?? "").trim()) return;
      exact.set(`${key(c.nume_magazin)}||${key(c.punct_livrare)}`, c.nickname);
      if (!byName.has(key(c.nume_magazin))) byName.set(key(c.nume_magazin), c.nickname);
    });
    const nickOf = (o: any) => exact.get(`${key(o.magazin)}||${key(o.punct_livrare)}`) ?? byName.get(key(o.magazin));
    return buildRecipeBook(orders.data.rows, recipeData.data.recipes, recipeData.data.losses,
      o => mainClient(o.magazin, nickOf(o)),
      o => packagingUnits(o.baxare) ?? (o.produs_id && o.magazin ? resolveStorePackaging(o.produs_id, o.magazin, packaging.data || []) : null));
  }, [orders.data, recipeData.data, packaging.data]);

  const shown = client === "__all" ? book : book.filter(c => c.client === client);
  const loading = orders.isLoading || recipeData.isLoading;
  const error = orders.error || recipeData.error;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div><label className="text-xs text-muted-foreground">Data producție</label><Input type="date" value={day} onChange={e => e.target.value && setDay(e.target.value)} className="w-40" /></div>
        <div>
          <label className="text-xs text-muted-foreground">Client principal</label>
          <select aria-label="Client principal" value={client} onChange={e => setClient(e.target.value)} className="block h-10 rounded-md border bg-background px-2 text-sm min-w-[220px]">
            <option value="__all">Toți clienții ({book.length})</option>
            {book.map(c => <option key={c.client} value={c.client}>{c.client}</option>)}
          </select>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => printBook(shown, day)} disabled={!shown.length}><Printer className="h-4 w-4 mr-1" />Printează</Button>
          <Button onClick={() => exportBook(shown, day)} disabled={!shown.length}><Download className="h-4 w-4 mr-1" />Export Excel</Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Produsele mixte (rețetă cu mai multe ingrediente) din comenzile Senior ale zilei. Toate magazinele unui client sunt însumate (ex. toate depozitele Lidl), iar clienții HoReCa sunt însumați după porecla din Configurări → Clienți. Kg brut = kg net × (1 + PT %) din nomenclatorul de materii prime.</p>
      {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Se încarcă comenzile și rețetele…</div>}
      {error && <p className="text-sm text-destructive">Nu am putut încărca datele: {(error as Error).message}</p>}
      {!loading && !error && !book.length && <p className="text-sm text-muted-foreground">Nu există comenzi Senior cu produse mixte pentru {ro(day)}.</p>}
      {shown.map(c => (
        <Card key={c.client}>
          <CardContent className="pt-4 space-y-3">
            <div className="flex flex-wrap items-baseline gap-x-4">
              <h3 className="text-lg font-bold">{c.client}</h3>
              <span className="text-sm text-muted-foreground">{c.bucati.toLocaleString("ro-RO")} buc · {kg(c.netKg, 1)} kg net · {kg(c.brutKg, 1)} kg brut</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-muted"><tr className="[&>th]:border [&>th]:px-2 [&>th]:py-1.5">{HEAD.map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {c.products.map((p, i) => p.ingredients.map((ing, k) => (
                    <tr key={`${p.produsId}-${k}`} className="[&>td]:border [&>td]:px-2 [&>td]:py-1">
                      {k === 0 && <>
                        <td rowSpan={p.ingredients.length} className="text-center">{i + 1}</td>
                        <td rowSpan={p.ingredients.length} className="font-semibold" title={p.stores.join("\n")}>{p.produs}<div className="text-[11px] font-normal text-muted-foreground">{p.stores.length} {p.stores.length === 1 ? "punct de livrare" : "puncte de livrare"}</div></td>
                        <td rowSpan={p.ingredients.length} className="text-center">{p.bucBax ? `${p.bucBax} buc/bax` : "—"}</td>
                      </>}
                      <td>{ing.nume}</td>
                      <td className="text-right tabular-nums">{per(ing.kgPerBuc)}</td>
                      {k === 0 && <td rowSpan={p.ingredients.length} className="text-center font-bold tabular-nums">{p.bucati.toLocaleString("ro-RO")}</td>}
                      <td className="text-right tabular-nums">{kg(ing.netKg)}</td>
                      <td className={`text-right tabular-nums ${ing.ptPct == null ? "text-destructive" : ""}`} title={ing.ptPct == null ? "PT nesetat în nomenclatorul de materii prime" : undefined}>{ing.ptPct ?? "—"}</td>
                      <td className="text-right tabular-nums">{kg(ing.brutKg)}</td>
                      {k === 0 && <>
                        <td rowSpan={p.ingredients.length} className="text-right font-bold tabular-nums">{kg(p.netKg, 1)}</td>
                        <td rowSpan={p.ingredients.length} className="text-right font-bold tabular-nums">{kg(p.brutKg, 1)}</td>
                      </>}
                    </tr>
                  )))}
                  <tr className="bg-muted font-bold [&>td]:border [&>td]:px-2 [&>td]:py-1">
                    <td></td><td colSpan={4}>TOTAL {c.client}</td><td className="text-center tabular-nums">{c.bucati.toLocaleString("ro-RO")}</td><td colSpan={3}></td>
                    <td className="text-right tabular-nums">{kg(c.netKg, 1)}</td><td className="text-right tabular-nums">{kg(c.brutKg, 1)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <details>
              <summary className="cursor-pointer text-sm font-medium">Total pe materie primă ({c.materials.length})</summary>
              <table className="mt-2 text-sm border-collapse min-w-[420px]">
                <thead className="bg-muted"><tr className="[&>th]:border [&>th]:px-2 [&>th]:py-1"><th>Ingredient</th><th>Kg net</th><th>PT %</th><th>Kg brut</th></tr></thead>
                <tbody>{c.materials.map(m => (
                  <tr key={m.nume} className="[&>td]:border [&>td]:px-2 [&>td]:py-1"><td>{m.nume}</td><td className="text-right tabular-nums">{kg(m.netKg)}</td><td className="text-right">{m.ptPct ?? "—"}</td><td className="text-right tabular-nums">{kg(m.brutKg)}</td></tr>
                ))}</tbody>
              </table>
            </details>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AllMixedRecipes() {
  const recipeData = useRecipeData();
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const all = (recipeData.data?.recipes || []).filter(isMixed).sort((a, b) => a.produs.localeCompare(b.produs, "ro"));
    const s = q.trim().toLowerCase();
    return s ? all.filter(r => r.produs.toLowerCase().includes(s) || r.ingredients.some(i => i.nume.toLowerCase().includes(s))) : all;
  }, [recipeData.data, q]);
  const losses = recipeData.data?.losses || [];
  const exportAll = () => {
    const aoa: any[][] = [["Produs", "Ingredient", "Kg / buc", "PT %", "Kg brut / buc"]];
    list.forEach(r => r.ingredients.filter(i => i.kgPerBuc > 0).forEach((i, k) => {
      const pt = lossFor(i.nume, losses);
      aoa.push([k ? "" : r.produs, i.nume, i.kgPerBuc, pt ?? "", { f: `C${aoa.length + 1}*(1+N(D${aoa.length + 1})/100)`, v: i.kgPerBuc * (1 + (pt ?? 0) / 100) }]);
    }));
    const ws = XLSXStyle.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 36 }, { wch: 26 }, { wch: 10 }, { wch: 7 }, { wch: 12 }];
    Object.keys(ws).forEach(ref => {
      if (ref.startsWith("!")) return;
      const { r, c } = XLSXStyle.utils.decode_cell(ref);
      ws[ref].s = { font: { name: "Arial", sz: 10, bold: r === 0 || c === 0 }, border: box, fill: r === 0 ? { fgColor: { rgb: "D9E1F2" } } : undefined, ...(r && (c === 2 || c === 4) ? { numFmt: "0.0000" } : {}) };
    });
    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, "Rețete mixte");
    XLSXStyle.writeFile(wb, "Retete produse mixte.xlsx");
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={q} onChange={e => setQ(e.target.value)} placeholder="Caută produs sau ingredient" className="pl-8 w-72" /></div>
        <span className="text-sm text-muted-foreground">{list.length} rețete mixte</span>
        <Button className="ml-auto" onClick={exportAll} disabled={!list.length}><Download className="h-4 w-4 mr-1" />Export Excel</Button>
      </div>
      {recipeData.isLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Se încarcă rețetele…</div>}
      {recipeData.error && <p className="text-sm text-destructive">Nu am putut încărca rețetele: {(recipeData.error as Error).message}</p>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.map(r => {
          const ings = r.ingredients.filter(i => i.kgPerBuc > 0);
          return (
            <Card key={r.produsId}><CardContent className="pt-3">
              <div className="font-semibold mb-1">{r.produs}</div>
              <table className="w-full text-xs">
                <thead><tr className="text-muted-foreground [&>th]:text-left [&>th]:font-normal"><th>Ingredient</th><th className="!text-right">Kg/buc</th><th className="!text-right">PT %</th></tr></thead>
                <tbody>{ings.map(i => { const pt = lossFor(i.nume, losses); return (
                  <tr key={i.nume} className="border-t"><td className="py-0.5">{i.nume}</td><td className="text-right tabular-nums">{per(i.kgPerBuc)}</td><td className="text-right">{pt ?? "—"}</td></tr>
                ); })}
                  <tr className="border-t font-semibold"><td className="py-0.5">Total net / buc</td><td className="text-right tabular-nums">{per(ings.reduce((s, i) => s + i.kgPerBuc, 0))}</td><td></td></tr>
                </tbody>
              </table>
            </CardContent></Card>
          );
        })}
      </div>
    </div>
  );
}

export default function RecipeBook() {
  return (
    <Tabs defaultValue="orders" className="w-full">
      <TabsList>
        <TabsTrigger value="orders">Rețete pentru comenzile primite</TabsTrigger>
        <TabsTrigger value="all">Toate rețetele mixte</TabsTrigger>
      </TabsList>
      <TabsContent value="orders" className="mt-4"><OrdersRecipes /></TabsContent>
      <TabsContent value="all" className="mt-4"><AllMixedRecipes /></TabsContent>
    </Tabs>
  );
}
