import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import XLSXStyle from "xlsx-js-style";
import * as pdfjsLib from "pdfjs-dist";
import { toast } from "sonner";
import { Download, FileUp, Loader2, Pencil, Plus, Printer, Search, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrderPackaging } from "@/hooks/productie/useOrderPackaging";
import { useMixedCartons } from "@/hooks/productie/useMixedCartons";
import { useRecipes } from "@/hooks/productie/useRecipes";
import RecipeEditDialog from "./RecipeEditDialog";
import { findCarton } from "../../../supabase/functions/_shared/mixedCartons";
import { packagingUnits, resolveStorePackaging } from "../../../supabase/functions/_shared/packagingRules";
import {
  buildRecipeBook, isMixed, lossFor, mainClient, manualOrders, matchMixedProduct, toKg,
  type BookClient, type LossRule, type ManualLine, type MixedRecipe, type RecipeBookOrder,
} from "@/lib/productie/recipeBook";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

const EXTRACT_URL = "https://yeniohmlmxhjzywqlidx.supabase.co/functions/v1/comenzi-extract";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbmlvaG1sbXhoanp5d3FsaWR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NjM0ODgsImV4cCI6MjA5MzEzOTQ4OH0.8rNaYX5D5hk22o_bUqERO9ChJfQdJYkaKiD9UsRi1mE";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest" }).format(new Date());
const kg = (n: number, d = 2) => n.toLocaleString("ro-RO", { minimumFractionDigits: d, maximumFractionDigits: d });
const per = (n: number) => n.toLocaleString("ro-RO", { maximumFractionDigits: 4 });
const ro = (d: string) => d.split("-").reverse().join(".");
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const low = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const nameKey = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim().toUpperCase();

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
        produsId: String(r.produs_id), recipeId: String(r.id), produs: r.productie_produse?.nume || "?",
        ingredients: (r.productie_retete_ingrediente || []).map((i: any) => ({ nume: i.productie_ingrediente?.nume || "?", kgPerBuc: toKg(Number(i.cantitate_necesara) || 0, i.unitate_masura) })),
      }));
      return { recipes: list, losses };
    },
  });
}

/** Store → main client (nickname from Configurări → Clienți, else company name). */
function useClientOf() {
  const clients = useQuery({
    queryKey: ["retetar-clients"],
    staleTime: 5 * 60_000,
    queryFn: () => pages(() => supabase.from("productie_clienti").select("id, nume_magazin, punct_livrare, nickname").order("id")),
  });
  return useMemo(() => {
    const exact = new Map<string, string>(), byName = new Map<string, string>();
    (clients.data || []).forEach((c: any) => {
      if (!String(c.nickname ?? "").trim()) return;
      exact.set(`${nameKey(c.nume_magazin)}||${nameKey(c.punct_livrare)}`, c.nickname);
      if (!byName.has(nameKey(c.nume_magazin))) byName.set(nameKey(c.nume_magazin), c.nickname);
    });
    const clientOf = (o: any) => mainClient(o.magazin, exact.get(`${nameKey(o.magazin)}||${nameKey(o.punct_livrare)}`) ?? byName.get(nameKey(o.magazin)));
    const stores = [...new Set((clients.data || []).map((c: any) => String(c.nume_magazin ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ro"));
    return { clientOf, stores, loading: clients.isLoading };
  }, [clients.data, clients.isLoading]);
}

const border = { style: "thin", color: { rgb: "000000" } };
const box = { top: border, bottom: border, left: border, right: border };
const HEAD = ["Nr.", "Produs", "Buc/bax", "Ingredient", "Kg / buc", "Total buc", "Kg net", "PT %", "Kg brut", "Total net produs", "Total brut produs"];

function clientSheet(c: BookClient, day: string, source: string) {
  const aoa: any[][] = [[`REȚETE PENTRU COMENZILE PRIMITE — ${c.client}`], [`Data producție: ${ro(day)} · ${source}`], [], HEAD];
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

function exportBook(book: BookClient[], day: string, source: string, fileName: string) {
  const wb = XLSXStyle.utils.book_new();
  const used = new Set<string>();
  book.forEach(c => {
    let name = c.client.replace(/[\\/?*[\]:]/g, " ").slice(0, 28).trim() || "Client";
    for (let i = 2; used.has(name); i++) name = `${name.slice(0, 26)} ${i}`;
    used.add(name);
    XLSXStyle.utils.book_append_sheet(wb, clientSheet(c, day, source), name);
  });
  XLSXStyle.writeFile(wb, `${fileName} ${ro(day)}.xlsx`);
}

function printBook(book: BookClient[], day: string, source: string) {
  const th = HEAD.map(h => `<th>${esc(h)}</th>`).join("");
  const body = book.map(c => `
    <section><h1>Rețete pentru comenzile primite — ${esc(c.client)}</h1><p class="sub">Data producție: ${ro(day)} · ${esc(source)}</p>
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

/** Opens the Configurări recipe form for one recipe, loaded from the full recipe list. */
function EditRecipeById({ recipeId, onClose }: { recipeId: string; onClose: () => void }) {
  const recipes = useRecipes();
  const recipe = (recipes.data || []).find(r => r.id === recipeId) ?? null;
  if (!recipe) return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Editează rețeta</DialogTitle></DialogHeader>
        {recipes.isLoading
          ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Se încarcă rețeta…</div>
          : <p className="text-sm text-destructive">{recipes.error ? `Nu am putut încărca rețeta: ${(recipes.error as Error).message}` : "Rețeta nu a fost găsită."}</p>}
      </DialogContent>
    </Dialog>
  );
  return <RecipeEditDialog open onOpenChange={o => !o && onClose()} recipe={recipe} />;
}

/** Shared sheet view: search by product and client, Excel/print for all or one client, edit recipes. */
function BookPanel({ orders, recipes, losses, clientOf, unitsOf, day, source, fileName, empty }: {
  orders: RecipeBookOrder[]; recipes: MixedRecipe[]; losses: LossRule[];
  clientOf: (o: any) => string; unitsOf: (o: any) => string | null;
  day: string; source: string; fileName: string; empty: string;
}) {
  const [productQ, setProductQ] = useState("");
  const [clientQ, setClientQ] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const allClients = useMemo(() => [...new Set(orders.map(clientOf))].sort((a, b) => a.localeCompare(b, "ro")), [orders, clientOf]);
  const book = useMemo(() => {
    const pq = low(productQ.trim()), cq = low(clientQ.trim());
    const names = new Map(recipes.map(r => [r.produsId, low(r.produs)]));
    const shown = orders.filter(o =>
      (!pq || (names.get(String(o.produs_id)) || "").includes(pq)) &&
      (!cq || low(clientOf(o)).includes(cq) || low(o.magazin).includes(cq)));
    return buildRecipeBook(shown, recipes, losses, clientOf, unitsOf);
  }, [orders, recipes, losses, clientOf, unitsOf, productQ, clientQ]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input aria-label="Caută produs" value={productQ} onChange={e => setProductQ(e.target.value)} placeholder="Caută produs" className="pl-8 w-56" />
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input aria-label="Caută client sau magazin" list="retetar-clienti" value={clientQ} onChange={e => setClientQ(e.target.value)} placeholder="Caută client sau magazin" className="pl-8 w-64" />
          <datalist id="retetar-clienti">{allClients.map(c => <option key={c} value={c} />)}</datalist>
        </div>
        {(productQ || clientQ) && <Button variant="ghost" size="sm" onClick={() => { setProductQ(""); setClientQ(""); }}><X className="h-4 w-4 mr-1" />Șterge filtrele</Button>}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => printBook(book, day, source)} disabled={!book.length}><Printer className="h-4 w-4 mr-1" />Printează tot</Button>
          <Button onClick={() => exportBook(book, day, source, fileName)} disabled={!book.length}><Download className="h-4 w-4 mr-1" />Export Excel</Button>
        </div>
      </div>
      {!book.length && <p className="text-sm text-muted-foreground">{orders.length && (productQ || clientQ) ? "Nimic nu corespunde filtrelor." : empty}</p>}
      {book.map(c => (
        <Card key={c.client}>
          <CardContent className="pt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <h3 className="text-lg font-bold">{c.client}</h3>
              <span className="text-sm text-muted-foreground">{c.bucati.toLocaleString("ro-RO")} buc · {kg(c.netKg, 1)} kg net · {kg(c.brutKg, 1)} kg brut</span>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="outline" onClick={() => printBook([c], day, source)}><Printer className="h-4 w-4 mr-1" />Printează</Button>
                <Button size="sm" variant="outline" onClick={() => exportBook([c], day, source, `${fileName} ${c.client.replace(/[\\/?*[\]:"<>|]/g, " ").trim()}`)}><Download className="h-4 w-4 mr-1" />Excel</Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-muted"><tr className="[&>th]:border [&>th]:px-2 [&>th]:py-1.5">{HEAD.map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {c.products.map((p, i) => p.ingredients.map((ing, k) => (
                    <tr key={`${p.produsId}-${k}`} className="[&>td]:border [&>td]:px-2 [&>td]:py-1">
                      {k === 0 && <>
                        <td rowSpan={p.ingredients.length} className="text-center">{i + 1}</td>
                        <td rowSpan={p.ingredients.length} className="font-semibold" title={p.stores.join("\n")}>
                          <div className="flex items-start gap-1">
                            <span className="flex-1">{p.produs}</span>
                            {p.recipeId && <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" aria-label={`Editează rețeta ${p.produs}`} title="Editează rețeta" onClick={() => setEditing(p.recipeId!)}><Pencil className="h-3.5 w-3.5" /></Button>}
                          </div>
                          <div className="text-[11px] font-normal text-muted-foreground">{p.stores.length} {p.stores.length === 1 ? "punct de livrare" : "puncte de livrare"}</div>
                        </td>
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
      {editing && <EditRecipeById recipeId={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function OrdersRecipes() {
  const [day, setDay] = useState(today);
  const recipeData = useRecipeData();
  const packaging = useOrderPackaging();
  const { clientOf, loading: clientsLoading } = useClientOf();
  const orders = useQuery({
    queryKey: ["retetar-orders", day],
    queryFn: () => pages(() => supabase.from("productie_comenzi").select("id, magazin, punct_livrare, produs_id, cantitate, baxare, tip_comanda").eq("data_productie", day).eq("sursa", "senior-erp").order("id")),
  });
  const unitsOf = useMemo(() => (o: any) => packagingUnits(o.baxare) ?? (o.produs_id && o.magazin ? resolveStorePackaging(o.produs_id, o.magazin, packaging.data || []) : null), [packaging.data]);
  const loading = orders.isLoading || recipeData.isLoading || clientsLoading;
  const error = orders.error || recipeData.error;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div><label className="text-xs text-muted-foreground">Data producție</label><Input type="date" value={day} onChange={e => e.target.value && setDay(e.target.value)} className="w-40" /></div>
        <p className="text-xs text-muted-foreground max-w-3xl">Produsele mixte (rețetă cu mai multe ingrediente) din comenzile Senior ale zilei. Toate magazinele unui client sunt însumate (ex. toate depozitele Lidl), iar clienții HoReCa sunt însumați după porecla din Configurări → Clienți. Kg brut = kg net × (1 + PT %) din nomenclatorul de materii prime. Creionul de lângă produs deschide rețeta, ca în Configurări → Rețete.</p>
      </div>
      {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Se încarcă comenzile și rețetele…</div>}
      {error && <p className="text-sm text-destructive">Nu am putut încărca datele: {(error as Error).message}</p>}
      {!loading && !error && (
        <BookPanel orders={orders.data || []} recipes={recipeData.data!.recipes} losses={recipeData.data!.losses} clientOf={clientOf} unitsOf={unitsOf}
          day={day} source="comenzi Senior" fileName="Retetar comenzi" empty={`Nu există comenzi Senior cu produse mixte pentru ${ro(day)}.`} />
      )}
    </div>
  );
}

// ---------- Necesar manual: typed or uploaded orders, same sheet ----------

const DRAFT_KEY = "retetar-necesar-manual-v1";
const newId = () => (crypto as any).randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

async function imageToDataUrl(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Imaginea nu se poate citi")); i.src = url; });
    const scale = Math.min(1, 1800 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.8);
  } finally { URL.revokeObjectURL(url); }
}

async function fileToPayload(file: File): Promise<{ text: string; images: string[] }> {
  const name = file.name.toLowerCase();
  if (/\.(xlsx|xls|csv)$/.test(name)) {
    const wb = XLSX.read(await file.arrayBuffer());
    return { text: wb.SheetNames.map(n => `## ${n}\n` + XLSX.utils.sheet_to_csv(wb.Sheets[n])).join("\n"), images: [] };
  }
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return { text: value, images: [] };
  }
  if (name.endsWith(".doc")) throw new Error("Formatul .doc vechi nu se poate citi. Salvează-l ca .docx sau PDF.");
  if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/.test(name)) return { text: "", images: [await imageToDataUrl(file)] };
  if (name.endsWith(".pdf")) {
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    let text = "";
    const images: string[] = [];
    for (let p = 1; p <= Math.min(pdf.numPages, 8); p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      text += (tc.items as any[]).map(i => i.str + (i.hasEOL ? "\n" : " ")).join("") + "\n";
      const vp = page.getViewport({ scale: 1.6 });
      const c = document.createElement("canvas");
      c.width = vp.width; c.height = vp.height;
      await page.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
      images.push(c.toDataURL("image/jpeg", 0.75));
    }
    return text.trim().length > 50 ? { text, images: images.slice(0, 2) } : { text: "", images };
  }
  throw new Error("Tip de fișier necunoscut. Folosește PDF, Excel, Word sau o poză.");
}

function ManualNeeds() {
  const recipeData = useRecipeData();
  const cartons = useMixedCartons();
  const packaging = useOrderPackaging();
  const { clientOf, stores } = useClientOf();
  const saved = useMemo(() => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}"); } catch { return {}; } }, []);
  const [day, setDay] = useState<string>(saved.day || today());
  const [lines, setLines] = useState<ManualLine[]>(Array.isArray(saved.lines) ? saved.lines : []);
  const [draft, setDraft] = useState({ magazin: "", produs: "", cantitate: "", unit: "buc" as "buc" | "bax", bucBax: "" });
  const [reading, setReading] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { localStorage.setItem(DRAFT_KEY, JSON.stringify({ day, lines })); }, [day, lines]);

  const recipes = recipeData.data?.recipes || [];
  const mixed = useMemo(() => recipes.filter(isMixed).sort((a, b) => a.produs.localeCompare(b.produs, "ro")), [recipes]);
  const cartonDefs = useMemo(() => (cartons.data || []).filter(c => c.enabled).map(c => ({ produs_id: c.produs_id, denumire: c.denumire, components: c.components })), [cartons.data]);
  // Product options: mixed cartons first (Lupino/Amorino 6+2…), then mixed recipes.
  const options = useMemo(() => [
    ...cartonDefs.map(c => ({ id: c.produs_id, label: `${c.denumire} (bax ${c.components.map(x => x.units).join("+")})`, carton: true })),
    ...mixed.map(r => ({ id: r.produsId, label: r.produs, carton: false })),
  ], [cartonDefs, mixed]);
  const labelOf = (id: string) => options.find(o => o.id === id)?.label ?? "";
  const idOf = (label: string) => options.find(o => o.label.toUpperCase() === label.trim().toUpperCase())?.id ?? "";
  const unitsFor = (produsId: string, magazin: string) => produsId && magazin ? resolveStorePackaging(produsId, magazin, packaging.data || []) : null;

  const { orders, problems } = useMemo(() => manualOrders(lines, cartonDefs), [lines, cartonDefs]);
  const problemOf = new Map(problems.map(p => [p.id, p.message]));
  const unitsOf = useMemo(() => (o: any) => o.baxare ?? null, []);

  const draftId = idOf(draft.produs);
  const draftIsCarton = cartonDefs.some(c => c.produs_id === draftId);
  useEffect(() => {
    if (draftIsCarton || !draftId || !draft.magazin) return;
    const u = unitsFor(draftId, draft.magazin);
    if (u) setDraft(d => ({ ...d, bucBax: u }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, draft.magazin, packaging.data]);

  const addLine = () => {
    const qty = Number(draft.cantitate.replace(",", "."));
    if (!draft.magazin.trim()) return toast.error("Alege sau scrie magazinul.");
    if (!draftId) return toast.error("Alege produsul din listă.");
    if (!(qty > 0)) return toast.error("Scrie cantitatea.");
    setLines(ls => [...ls, { id: newId(), magazin: draft.magazin.trim(), produsId: draftId, cantitate: qty, unit: draftIsCarton ? "bax" : draft.unit, bucBax: draftIsCarton ? null : draft.bucBax || null }]);
    setDraft(d => ({ ...d, produs: "", cantitate: "" }));
  };
  const updateLine = (id: string, patch: Partial<ManualLine>) => setLines(ls => ls.map(l => l.id === id ? { ...l, ...patch } : l));

  const handleFiles = async (files: FileList) => {
    for (const file of Array.from(files)) {
      setReading(r => [...r, file.name]);
      try {
        const payload = await fileToPayload(file);
        const r = await fetch(EXTRACT_URL, { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` }, body: JSON.stringify({ ...payload, fileName: file.name }) });
        const res = await r.json();
        if (!r.ok || res.error) throw new Error(res.error || "Fișierul nu a putut fi citit");
        const client = String(res.client || "").trim().toUpperCase();
        let added = 0, mono = 0, unknown = 0;
        const next: ManualLine[] = [];
        for (const x of res.linii || []) {
          const qty = Number(x.bucati) || 0;
          if (qty <= 0) continue;
          const magazin = [client || "CLIENT", x.depozit].filter(Boolean).join(" - ");
          const sursa = `${x.produs}${x.gramaj ? ` ${x.gramaj}g` : ""} · ${qty} ${x.unitate_cantitate || "buc"}`;
          let carton: any = null;
          try { carton = findCarton(cartons.data || [], null, x.produs); } catch { carton = null; }
          if (carton) {
            next.push({ id: newId(), magazin, produsId: carton.produs_id, cantitate: qty, unit: x.unitate_cantitate === "buc" ? "buc" : "bax", sursa });
            added++; continue;
          }
          const hit = matchMixedProduct(x.produs, x.gramaj, mixed, client);
          if (hit) {
            next.push({ id: newId(), magazin, produsId: hit.produsId, cantitate: qty, unit: "buc", bucBax: x.buc_bax ? String(x.buc_bax) : unitsFor(hit.produsId, magazin), sursa });
            added++; continue;
          }
          // Mono products (one ingredient) don't belong to the Rețetar; anything else waits for a manual choice.
          if (matchMixedProduct(x.produs, x.gramaj, recipes.filter(r => !isMixed(r)), client)) { mono++; continue; }
          next.push({ id: newId(), magazin, produsId: "", cantitate: qty, unit: "buc", sursa });
          unknown++;
        }
        setLines(ls => [...ls, ...next]);
        toast.success(`${file.name}: ${added} produse mixte adăugate${mono ? `, ${mono} produse simple ignorate` : ""}${unknown ? `, ${unknown} de ales manual` : ""}`);
      } catch (e: any) {
        toast.error(`${file.name}: ${e.message}`);
      }
      setReading(r => r.filter(n => n !== file.name));
    }
  };

  if (recipeData.isLoading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Se încarcă rețetele…</div>;
  if (recipeData.error) return <p className="text-sm text-destructive">Nu am putut încărca rețetele: {(recipeData.error as Error).message}</p>;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div><label className="text-xs text-muted-foreground">Data producție</label><Input type="date" value={day} onChange={e => e.target.value && setDay(e.target.value)} className="w-40" /></div>
            <p className="text-xs text-muted-foreground flex-1 min-w-[240px]">Pentru zilele în care comenzile nu sunt încă în Senior: adaugă magazin, produs și cantitate sau încarcă comanda (PDF, Excel, Word, poză). Necesarul nu creează comenzi de producție; rămâne salvat în acest browser până îl golești.</p>
            <input ref={fileRef} type="file" multiple accept=".pdf,.xlsx,.xls,.csv,.docx,.doc,image/*" className="hidden" onChange={e => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ""; }} />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={!!reading.length}>
              {reading.length ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileUp className="h-4 w-4 mr-1" />}
              {reading.length ? `Citesc ${reading.join(", ")}…` : "Încarcă comandă din fișier"}
            </Button>
            {!!lines.length && <Button variant="ghost" onClick={() => confirm("Golești tot necesarul introdus?") && setLines([])}><Trash2 className="h-4 w-4 mr-1" />Golește</Button>}
          </div>

          <div className="flex flex-wrap items-end gap-2 rounded-md border p-3 bg-muted/40">
            <div className="min-w-[220px] flex-1">
              <label className="text-xs text-muted-foreground">Magazin</label>
              <Input aria-label="Magazin" list="retetar-magazine" value={draft.magazin} onChange={e => setDraft(d => ({ ...d, magazin: e.target.value }))} placeholder="ex. LIDL DISCOUNT SRL - ARICESTI" />
              <datalist id="retetar-magazine">{stores.map(s => <option key={s} value={s} />)}</datalist>
            </div>
            <div className="min-w-[240px] flex-1">
              <label className="text-xs text-muted-foreground">Produs</label>
              <Input aria-label="Produs" list="retetar-produse" value={draft.produs} onChange={e => setDraft(d => ({ ...d, produs: e.target.value }))} placeholder="Scrie și alege din listă" className={draft.produs && !draftId ? "border-destructive" : ""} />
              <datalist id="retetar-produse">{options.map(o => <option key={o.id} value={o.label} />)}</datalist>
            </div>
            <div className="w-24"><label className="text-xs text-muted-foreground">Cantitate</label><Input aria-label="Cantitate" inputMode="decimal" value={draft.cantitate} onChange={e => setDraft(d => ({ ...d, cantitate: e.target.value }))} onKeyDown={e => e.key === "Enter" && addLine()} /></div>
            <div>
              <label className="text-xs text-muted-foreground">Unitate</label>
              <select aria-label="Unitate" value={draftIsCarton ? "bax" : draft.unit} disabled={draftIsCarton} onChange={e => setDraft(d => ({ ...d, unit: e.target.value as any }))} className="block h-10 rounded-md border bg-background px-2 text-sm">
                <option value="buc">buc</option><option value="bax">bax</option>
              </select>
            </div>
            {!draftIsCarton && <div className="w-20"><label className="text-xs text-muted-foreground">Buc/bax</label><Input aria-label="Buc/bax" value={draft.bucBax} onChange={e => setDraft(d => ({ ...d, bucBax: e.target.value }))} placeholder="6" /></div>}
            <Button onClick={addLine}><Plus className="h-4 w-4 mr-1" />Adaugă</Button>
          </div>

          {!!lines.length && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-muted"><tr className="[&>th]:border [&>th]:px-2 [&>th]:py-1 [&>th]:text-left"><th>Magazin</th><th>Produs</th><th>Cantitate</th><th>Unitate</th><th>Buc/bax</th><th>Din fișier</th><th></th></tr></thead>
                <tbody>{lines.map(l => {
                  const isCarton = cartonDefs.some(c => c.produs_id === l.produsId);
                  const problem = problemOf.get(l.id);
                  return (
                    <tr key={l.id} className={`[&>td]:border [&>td]:px-2 [&>td]:py-1 ${problem ? "bg-destructive/10" : ""}`}>
                      <td><Input className="h-8" list="retetar-magazine" value={l.magazin} onChange={e => updateLine(l.id, { magazin: e.target.value })} /></td>
                      <td>
                        <select aria-label="Produs" value={l.produsId} onChange={e => updateLine(l.id, { produsId: e.target.value, unit: cartonDefs.some(c => c.produs_id === e.target.value) ? "bax" : l.unit })} className="h-8 w-full min-w-[220px] rounded-md border bg-background px-1 text-sm">
                          <option value="">— alege produsul —</option>
                          {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                        </select>
                        {problem && <div className="text-xs text-destructive mt-0.5">{problem}</div>}
                      </td>
                      <td className="w-24"><Input className="h-8" inputMode="decimal" value={String(l.cantitate)} onChange={e => updateLine(l.id, { cantitate: Number(e.target.value.replace(",", ".")) || 0 })} /></td>
                      <td>
                        <select aria-label="Unitate" value={l.unit} onChange={e => updateLine(l.id, { unit: e.target.value as any })} className="h-8 rounded-md border bg-background px-1 text-sm">
                          <option value="buc">buc</option><option value="bax">bax</option>
                        </select>
                      </td>
                      <td className="w-20">{isCarton ? <span className="text-xs text-muted-foreground">{cartonDefs.find(c => c.produs_id === l.produsId)!.components.map(x => x.units).join("+")}</span> : <Input className="h-8" value={l.bucBax ?? ""} onChange={e => updateLine(l.id, { bucBax: e.target.value || null })} />}</td>
                      <td className="text-xs text-muted-foreground max-w-[220px]" title={l.produsId ? labelOf(l.produsId) : undefined}>{l.sursa || "—"}</td>
                      <td><Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Șterge rândul" onClick={() => setLines(ls => ls.filter(x => x.id !== l.id))}><Trash2 className="h-4 w-4" /></Button></td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <BookPanel orders={orders} recipes={recipes} losses={recipeData.data!.losses} clientOf={clientOf} unitsOf={unitsOf}
        day={day} source="necesar introdus manual" fileName="Necesar retetar" empty="Adaugă produse mixte mai sus ca să vezi rețetarul." />
    </div>
  );
}

function AllMixedRecipes() {
  const recipeData = useRecipeData();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const list = useMemo(() => {
    const all = (recipeData.data?.recipes || []).filter(isMixed).sort((a, b) => a.produs.localeCompare(b.produs, "ro"));
    const s = low(q.trim());
    return s ? all.filter(r => low(r.produs).includes(s) || r.ingredients.some(i => low(i.nume).includes(s))) : all;
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
              <div className="flex items-start gap-1 mb-1">
                <div className="font-semibold flex-1">{r.produs}</div>
                {r.recipeId && <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Editează rețeta ${r.produs}`} title="Editează rețeta" onClick={() => setEditing(r.recipeId!)}><Pencil className="h-4 w-4" /></Button>}
              </div>
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
      {editing && <EditRecipeById recipeId={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

export default function RecipeBook() {
  return (
    <Tabs defaultValue="orders" className="w-full">
      <TabsList className="flex flex-wrap h-auto">
        <TabsTrigger value="orders">Rețete pentru comenzile primite</TabsTrigger>
        <TabsTrigger value="manual">Generează necesar</TabsTrigger>
        <TabsTrigger value="all">Toate rețetele mixte</TabsTrigger>
      </TabsList>
      <TabsContent value="orders" className="mt-4"><OrdersRecipes /></TabsContent>
      <TabsContent value="manual" className="mt-4"><ManualNeeds /></TabsContent>
      <TabsContent value="all" className="mt-4"><AllMixedRecipes /></TabsContent>
    </Tabs>
  );
}
