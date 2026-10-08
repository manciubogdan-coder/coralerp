import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import * as XLSX from "xlsx";
import XLSXStyle from "xlsx-js-style";
import { format } from "date-fns";
import { toast } from "sonner";
import { FileUp, Loader2, Trash2, Download, Printer, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { supabaseCloud } from "@/integrations/supabase/cloudClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { makeSheets, withTemplatePack } from "@/lib/vanzari/orderSheets";
import { orderWorkbook } from "@/lib/vanzari/orderWorkbook";
import OrderSheetTable from "./OrderSheetTable";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

const FN_URL = "https://yeniohmlmxhjzywqlidx.supabase.co/functions/v1/comenzi-extract";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbmlvaG1sbXhoanp5d3FsaWR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NjM0ODgsImV4cCI6MjA5MzEzOTQ4OH0.8rNaYX5D5hk22o_bUqERO9ChJfQdJYkaKiD9UsRi1mE";

type Doc = { id: string; zi: string; client: string; file_name: string | null; nr_comanda: string | null };
type Linie = {
  id: string; document_id: string; zi: string; client: string; depozit: string | null; nr_comanda: string | null;
  produs: string; gramaj: number | null; bucati: number; taiat: number; buc_bax: number | null;
  ambalaj_primar: string | null; ambalaj_tertiar: string | null; produs_id: string | null; position: number;
};
type Ing = { nume: string; qtyKg: number }; // per bucată
type Recipe = { id: string; nume: string; ings: Ing[] };

const norm = (s: any) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const toKg = (q: number, u: string) => { const x = (u || "").toLowerCase(); return x.startsWith("g") ? q / 1000 : x === "t" ? q * 1000 : q; };
const fmt = (n: number, d = 1) => n.toLocaleString("ro-RO", { maximumFractionDigits: d });

async function fileToPayload(file: File) {
  const buf = await file.arrayBuffer();
  if (/\.(xlsx|xls|csv)$/i.test(file.name)) {
    const wb = XLSX.read(buf);
    return { text: wb.SheetNames.map((n) => `## ${n}\n` + XLSX.utils.sheet_to_csv(wb.Sheets[n])).join("\n"), images: [] as string[] };
  }
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let text = "";
  const images: string[] = [];
  for (let p = 1; p <= Math.min(pdf.numPages, 8); p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    text += (tc.items as any[]).map((i) => i.str + (i.hasEOL ? "\n" : " ")).join("") + "\n";
    const vp = page.getViewport({ scale: 1.6 });
    const c = document.createElement("canvas");
    c.width = vp.width; c.height = vp.height;
    const context = c.getContext("2d");
    if (!context) throw new Error("Nu se poate citi pagina PDF");
    await page.render({ canvasContext: context, viewport: vp }).promise;
    images.push(c.toDataURL("image/jpeg", 0.75));
  }
  return { text: text.trim().length > 50 ? text : "", images };
}

async function fetchAll(q: () => any) {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q().range(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export default function NecesarComenzi() {
  const [zi, setZi] = useState(() => format(new Date(Date.now() + 86400000), "yyyy-MM-dd"));
  const [ziProd, setZiProd] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [docs, setDocs] = useState<Doc[]>([]);
  const [linii, setLinii] = useState<Linie[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [stock, setStock] = useState<Map<string, number>>(new Map());
  const [inbound, setInbound] = useState<Map<string, number>>(new Map());
  const [packaging, setPackaging] = useState<any[]>([]);
  const [sheet, setSheet] = useState<string>("__balanta");
  const [uploading, setUploading] = useState<string[]>([]);
  const [drag, setDrag] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [d, l] = await Promise.all([
        fetchAll(() => supabaseCloud.from("vanzari_necesar_documente").select("*").eq("zi", zi).order("created_at").order("id")),
        fetchAll(() => supabaseCloud.from("vanzari_necesar_linii").select("*").eq("zi", zi).order("position").order("id")),
      ]);
      setDocs(d as Doc[]);
      setLinii(l as Linie[]);
    } catch (e: any) { toast.error("Nu am putut încărca comenzile: " + e.message); }
  }, [zi]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const [prods, rets, pk] = await Promise.all([
          fetchAll(() => (supabase as any).from("productie_produse").select("id, nume")),
          fetchAll(() => (supabase as any).from("productie_retete").select("produs_id, productie_retete_ingrediente(cantitate_necesara, unitate_masura, productie_ingrediente(nume))").eq("activa", true)),
          supabaseCloud.from("packaging_methods").select("*"),
        ]);
        const rmap = new Map<string, Ing[]>();
        rets.forEach((r: any) => {
          if (rmap.has(r.produs_id)) return;
          rmap.set(r.produs_id, (r.productie_retete_ingrediente || []).map((i: any) => ({
            nume: i.productie_ingrediente?.nume || "?", qtyKg: toKg(Number(i.cantitate_necesara) || 0, i.unitate_masura),
          })));
        });
        setRecipes(prods.map((p: any) => ({ id: String(p.id), nume: p.nume, ings: rmap.get(p.id) || [] })));
        setPackaging(pk.data || []);
      } catch (e: any) { toast.error("Nu am putut încărca rețetele: " + e.message); }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const snap = await fetchAll(() => (supabase as any).from("daily_stock_snapshots").select("name, quantity, unit").eq("snapshot_date", ziProd));
      const s = new Map<string, number>();
      snap.forEach((r: any) => { const k = norm(r.name); s.set(k, (s.get(k) || 0) + toKg(Number(r.quantity) || 0, r.unit)); });
      setStock(s);
      const { data } = await supabaseCloud.from("prereceptii").select("linii:prereceptie_linii(product_name, cantitate_document, unit, received_at)").eq("inventory_type", "materii-prime").eq("expected_date", ziProd);
      const m = new Map<string, number>();
      (data || []).forEach((p: any) => (p.linii || []).forEach((l: any) => {
        if (l.received_at) return;
        const k = norm(l.product_name); m.set(k, (m.get(k) || 0) + toKg(Number(l.cantitate_document) || 0, l.unit || "kg"));
      }));
      setInbound(m);
    })().catch((e) => toast.error(e.message));
  }, [ziProd]);

  const matchRecipe = useCallback((l: Linie): Recipe | null => {
    if (l.produs_id) return recipes.find((r) => r.id === l.produs_id) || null;
    const toks = norm(l.produs).split(" ").filter((t) => t.length > 1 && t !== "SALATA" && t !== "FR");
    let best: Recipe | null = null, score = 0;
    for (const r of recipes) {
      if (!r.ings.length) continue;
      const n = norm(r.nume);
      const hit = toks.filter((t) => n.includes(t)).length;
      if (!toks.length || hit / toks.length < 0.6) continue;
      let sc = 1 + hit - (toks.length - hit) * 2;
      if (l.gramaj && new RegExp(`(^|\\D)${l.gramaj}\\s*(G|GR)?(\\D|$)`).test(n)) sc += 5;
      sc -= n.split(" ").length * 0.05;
      if (sc > score) { score = sc; best = r; }
    }
    return best;
  }, [recipes]);

  const matchPack = useCallback((l: Linie) => {
    const c = norm(l.client), p = norm(l.produs);
    return packaging.find((m) => norm(m.client_name).includes(c.split(" ")[0]) && norm(m.product_name).includes(p) && (!l.gramaj || String(m.weight).includes(String(l.gramaj))));
  }, [packaging]);

  // stoc per ingredient (potrivire pe nume, ca în balanța de materiale)
  const sumByName = (m: Map<string, number>, ing: string) => { const k = norm(ing); let t = 0; m.forEach((v, n) => { if (n.includes(k)) t += v; }); return t; };

  const balanta = useMemo(() => {
    const map = new Map<string, { nume: string; necesar: number; uses: { l: Linie; kgPerBuc: number }[] }>();
    const nomatch: Linie[] = [];
    linii.forEach((l) => {
      const r = matchRecipe(l);
      const ings = r?.ings.length ? r.ings : l.gramaj ? [{ nume: l.produs, qtyKg: l.gramaj / 1000 }] : [];
      if (!r) nomatch.push(l);
      ings.forEach((i) => {
        const k = norm(i.nume);
        if (!map.has(k)) map.set(k, { nume: i.nume, necesar: 0, uses: [] });
        const e = map.get(k);
        if (!e) return;
        e.necesar += i.qtyKg * Math.max(0, l.bucati - l.taiat);
        e.uses.push({ l, kgPerBuc: i.qtyKg });
      });
    });
    const rows = [...map.entries()].map(([k, e]) => {
      const st = sumByName(stock, e.nume), inn = sumByName(inbound, e.nume);
      return { key: k, ...e, stoc: st, intrari: inn, disponibil: st + inn, dif: st + inn - e.necesar };
    }).sort((a, b) => a.dif - b.dif);
    return { rows, nomatch };
  }, [linii, matchRecipe, stock, inbound]);

  const orderSheets = useMemo(() => makeSheets(linii), [linii]);
  useEffect(() => { if (sheet !== "__balanta" && !orderSheets.some(s => s.key === sheet)) setSheet("__balanta"); }, [orderSheets, sheet]);

  const clients = useMemo(() => [...new Set(linii.map((l) => l.client))].sort(), [linii]);

  const updateLinie = async (id: string, patch: Partial<Linie>) => {
    setLinii((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    const { error } = await supabaseCloud.from("vanzari_necesar_linii").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message);
  };

  const handleFiles = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      setUploading((u) => [...u, file.name]);
      try {
        const payload = await fileToPayload(file);
        const r = await fetch(FN_URL, { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` }, body: JSON.stringify({ ...payload, images: payload.text ? payload.images.slice(0, 2) : payload.images, fileName: file.name }) });
        const res = await r.json();
        if (!r.ok || res.error) throw new Error(res.error || "Eroare la citire");
        const client = norm(res.client) || "NECUNOSCUT";
        const email = (await supabase.auth.getUser()).data.user?.email ?? null;
        const { data: doc, error } = await supabaseCloud.from("vanzari_necesar_documente").insert({ zi, client, file_name: file.name, nr_comanda: res.nr_comanda, created_by_email: email }).select().single();
        if (error) throw error;
        const rows = (res.linii || []).filter((x: any) => Number(x.bucati) > 0).map((x: any, i: number) => {
          const base: any = { document_id: doc.id, zi, client, depozit: x.depozit, nr_comanda: x.nr_comanda || res.nr_comanda, produs: String(x.produs).toUpperCase(), gramaj: x.gramaj, bucati: Number(x.bucati), taiat: 0, buc_bax: x.buc_bax, position: i };
          const pk = matchPack(base);
          if (pk) { base.ambalaj_primar = pk.primary_packaging; base.ambalaj_tertiar = pk.tertiary_packaging; base.buc_bax = base.buc_bax || Number(pk.units_per_case) || null; }
          return withTemplatePack(base);
        });
        if (rows.length) { const { error: e2 } = await supabaseCloud.from("vanzari_necesar_linii").insert(rows); if (e2) throw e2; }
        toast.success(`${file.name}: ${client}, ${rows.length} produse`);
        if (res.data_livrare && res.data_livrare !== zi) toast.warning(`${file.name} are data livrare ${res.data_livrare}, salvat pe ${zi}`);
      } catch (e: any) { toast.error(`${file.name}: ${e.message}`); }
      setUploading((u) => u.filter((n) => n !== file.name));
      await load();
    }
  };

  const deleteDoc = async (id: string) => { await supabaseCloud.from("vanzari_necesar_documente").delete().eq("id", id); load(); };

  const exportExcel = async (separate = false) => {
    const dLivr = format(new Date(zi), "dd.MM.yyyy");
    const wbAll = orderWorkbook(orderSheets, dLivr);
    const files = clients.map(c => ({
      name: `Comanda_${c.replace(/[^\w\- ]+/g, "_")}_${zi}.xlsx`,
      data: XLSXStyle.write(orderWorkbook(orderSheets.filter(s => s.client === c), dLivr), { type: "array", bookType: "xlsx" }) as ArrayBuffer,
    }));
    if (!separate) {
      XLSXStyle.writeFile(wbAll, `Formulare_comanda_${zi}.xlsx`);
      return;
    }
    // Alege folderul o singură dată și salvează toate fișierele acolo (Chrome/Edge).
    const w = window as any;
    if (typeof w.showDirectoryPicker === "function") {
      try {
        const dir = await w.showDirectoryPicker({ mode: "readwrite" });
        for (const f of files) {
          const fh = await dir.getFileHandle(f.name, { create: true });
          const wr = await fh.createWritable();
          await wr.write(new Blob([f.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
          await wr.close();
        }
        toast.success(`${files.length} fișiere salvate în folderul „${dir.name}"`);
        return;
      } catch (e: any) {
        if (e?.name === "AbortError") return; // utilizatorul a anulat alegerea folderului
      }
    }
    // Fallback: descărcări multiple (browserul poate cere permisiune o dată).
    for (const f of files) {
      const url = URL.createObjectURL(new Blob([f.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = f.name;
      a.click();
      URL.revokeObjectURL(url);
      await new Promise((r) => setTimeout(r, 300));
    }
  };

  // Centralizator comenzi: toți clienții cu comenzi în ziua respectivă, împărțiți Retail / Alți clienți.
  const exportCentralizator = () => {
    const RETAIL = ["AUCHAN", "CARREFOUR", "METRO", "SELGROS", "KAUFLAND", "LIDL", "MEGA"];
    const b = { style: "thin", color: { rgb: "000000" } };
    const border = { top: b, bottom: b, left: b, right: b };
    const dLivr = format(new Date(zi), "dd.MM.yyyy");
    const isRetail = (c: string) => RETAIL.some((k) => norm(c).includes(k));
    const retail = clients.filter(isRetail);
    const alti = clients.filter((c) => !isRetail(c));
    const obsFor = (c: string) => {
      const ls = linii.filter((l) => l.client === c);
      const nrs = [...new Set(ls.map((l) => l.nr_comanda).filter(Boolean))].join(", ");
      const dep = [...new Set(ls.map((l) => l.depozit).filter(Boolean))].join(", ");
      return [nrs ? `com ${nrs}` : "", dep].filter(Boolean).join(" - ");
    };
    const aoa: any[][] = [[`CENTRALIZATOR COMENZI - ${dLivr}`], [], ["Nr crt", "Client", "Observatii"]];
    let i = 0;
    const push = (list: string[], titlu: string) => {
      if (!list.length) return;
      aoa.push([titlu]);
      list.forEach((c) => aoa.push([++i, c, obsFor(c)]));
    };
    push(retail, "RETAIL (lanturi de magazine)");
    push(alti, "ALTI CLIENTI");
    const ws = XLSXStyle.utils.aoa_to_sheet(aoa);
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
    ws["!cols"] = [{ wch: 8 }, { wch: 38 }, { wch: 40 }];
    ws["!rows"] = [{ hpt: 30 }];
    Object.keys(ws).forEach((k) => {
      if (k.startsWith("!")) return;
      const { r, c: col } = XLSXStyle.utils.decode_cell(k);
      const cell = ws[k];
      if (r === 0) cell.s = { font: { bold: true, sz: 16, name: "Arial" }, alignment: { horizontal: "center" } };
      else if (r === 2) cell.s = { font: { bold: true, name: "Arial" }, fill: { fgColor: { rgb: "D9E1F2" } }, border, alignment: { horizontal: "center" } };
      else if (typeof cell.v === "string" && (cell.v.startsWith("RETAIL") || cell.v.startsWith("ALTI"))) cell.s = { font: { bold: true, name: "Arial" }, fill: { fgColor: { rgb: "FCE4D6" } }, border };
      else cell.s = { font: { name: "Arial" }, border, alignment: { horizontal: col === 0 ? "center" : "left" } };
    });
    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, "Centralizator");
    XLSXStyle.writeFile(wb, `Centralizator_comenzi_${dLivr}.xlsx`);
  };

  const det = balanta.rows.find((r) => r.key === detail);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div><label className="text-xs text-muted-foreground">Data livrare</label><Input type="date" value={zi} onChange={(e) => setZi(e.target.value)} className="w-40" /></div>
        <div><label className="text-xs text-muted-foreground">Ziua producției (stoc + prerecepții)</label><Input type="date" value={ziProd} onChange={(e) => setZiProd(e.target.value)} className="w-40" /></div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => window.print()} disabled={!linii.length}><Printer className="h-4 w-4 mr-1" />Printează</Button>
          <Button onClick={() => exportExcel(false)} disabled={!linii.length}><Download className="h-4 w-4 mr-1" />Export Excel (un fișier)</Button>
          <Button variant="outline" onClick={() => exportExcel(true)} disabled={!linii.length}><Download className="h-4 w-4 mr-1" />Fișiere separate pe client</Button>
          <Button variant="outline" onClick={exportCentralizator} disabled={!linii.length}><Download className="h-4 w-4 mr-1" />Centralizator</Button>
        </div>
      </div>

      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
        className={cn("flex flex-col items-center justify-center gap-1 border-2 border-dashed rounded-lg p-4 cursor-pointer text-sm text-muted-foreground print:hidden", drag && "border-primary bg-primary/5")}
      >
        <FileUp className="h-6 w-6" />
        Trage aici comenzile (PDF sau Excel) sau apasă pentru a alege — se pot mai multe deodată
        <input type="file" multiple accept=".pdf,.xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
      </label>

      {(uploading.length > 0 || docs.length > 0) && (
        <div className="flex flex-wrap gap-2 print:hidden">
          {uploading.map((n) => <Badge key={n} variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />{n}</Badge>)}
          {docs.map((d) => (
            <Badge key={d.id} variant="outline" className="gap-1">
              {d.client} · {d.file_name}
              <button onClick={() => deleteDoc(d.id)} aria-label="Șterge"><Trash2 className="h-3 w-3 text-destructive" /></button>
            </Badge>
          ))}
        </div>
      )}

      {linii.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-auto max-h-[65vh]">
            {sheet === "__balanta" ? (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted z-10"><tr className="[&>th]:px-2 [&>th]:py-1.5 [&>th]:text-left [&>th]:border">
                  <th>Materie primă</th><th className="text-right">Necesar (kg)</th><th className="text-right">Stoc început zi</th><th className="text-right">Intră azi (prerecepții)</th><th className="text-right">Disponibil</th><th className="text-right">Diferență</th><th></th>
                </tr></thead>
                <tbody>
                  {balanta.rows.map((r) => (
                    <tr key={r.key} onClick={() => setDetail(r.key)} className={cn("cursor-pointer hover:bg-muted/50 [&>td]:px-2 [&>td]:py-1 [&>td]:border", r.dif < 0 && "bg-destructive/10")}>
                      <td className="font-medium">{r.nume}</td><td className="text-right">{fmt(r.necesar)}</td><td className="text-right">{fmt(r.stoc)}</td><td className="text-right">{fmt(r.intrari)}</td><td className="text-right">{fmt(r.disponibil)}</td>
                      <td className={cn("text-right font-semibold", r.dif < 0 ? "text-destructive" : "text-primary")}>{fmt(r.dif)}</td>
                      <td>{r.dif < 0 ? <AlertTriangle className="h-4 w-4 text-destructive" /> : <CheckCircle2 className="h-4 w-4 text-primary" />}</td>
                    </tr>
                  ))}
                  {balanta.nomatch.length > 0 && (
                    <tr><td colSpan={7} className="px-2 py-2 text-xs">
                      <div className="font-medium text-destructive mb-1">Produse fără rețetă găsită (calculate gramaj × bucăți) — alege rețeta corectă:</div>
                      <div className="space-y-1">
                        {[...new Map(balanta.nomatch.map((l) => [`${l.produs}|${l.gramaj ?? ""}`, l])).values()].map((l) => (
                          <div key={l.id} className="flex items-center gap-2">
                            <span className="min-w-[280px]">{l.produs} {l.gramaj ?? ""}g</span>
                            <select className="border rounded px-1 py-0.5 bg-background min-w-[280px]" value="" onChange={(e) => { const v = e.target.value; if (!v) return; linii.filter((x) => x.produs === l.produs && x.gramaj === l.gramaj && !x.produs_id).forEach((x) => updateLinie(x.id, { produs_id: v })); }}>
                              <option value="">— alege rețeta (se aplică la toate liniile) —</option>
                              {recipes.filter((x) => x.ings.length).map((x) => <option key={x.id} value={x.id}>{x.nume}</option>)}
                            </select>
                          </div>
                        ))}
                      </div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            ) : (
              (() => {
                const current = orderSheets.find(s => s.key === sheet);
                if (!current) return null;
                return <OrderSheetTable sheet={current} update={(id, patch) => updateLinie(id, patch as Partial<Linie>)} recipeControl={(line) => {
                  const original = linii.find(l => l.id === line.id);
                  if (!original) return null;
                  const r = matchRecipe(original);
                  return <select aria-label={`Rețetă ${line.produs}`} className="w-80 bg-background text-xs" value={r?.id ?? ""} onChange={e => updateLinie(line.id, { produs_id: e.target.value || null })}>
                    <option value="">— gramaj × buc —</option>
                    {recipes.filter(x => x.ings.length).map(x => <option key={x.id} value={x.id}>{x.nume}</option>)}
                  </select>;
                }} />;
              })()
            )}
          </div>
          <div className="flex overflow-x-auto border-t bg-muted/40 text-sm print:hidden">
            {[{ k: "__balanta", label: "Balanță materie primă" }, ...orderSheets.map((s) => ({ k: s.key, label: s.title }))].map((t) => (
              <button key={t.k} onClick={() => setSheet(t.k)} className={cn("px-3 py-1.5 border-r whitespace-nowrap", sheet === t.k ? "bg-background font-semibold text-primary" : "text-muted-foreground")}>
                {t.label}{t.k === "__balanta" && balanta.rows.some((r) => r.dif < 0) && <AlertTriangle className="inline h-3 w-3 ml-1 text-destructive" />}
              </button>
            ))}
          </div>
        </div>
      )}

      <Dialog open={!!det} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          {det && (<>
            <DialogHeader><DialogTitle>{det.nume} — necesar {fmt(det.necesar)} kg, disponibil {fmt(det.disponibil)} kg, <span className={det.dif < 0 ? "text-destructive" : "text-primary"}>diferență {fmt(det.dif)} kg</span></DialogTitle></DialogHeader>
            <table className="w-full text-sm">
              <thead><tr className="[&>th]:px-2 [&>th]:py-1 [&>th]:text-left border-b"><th>Client</th><th>Depozit</th><th>Produs</th><th className="text-right">Bucăți</th><th className="text-right">Tăiat</th><th className="text-right">Kg din materie</th></tr></thead>
              <tbody>
                {det.uses.map(({ l, kgPerBuc }) => {
                  const cur = linii.find((x) => x.id === l.id) || l;
                  return (
                    <tr key={l.id} className="[&>td]:px-2 [&>td]:py-1 border-b">
                      <td>{cur.client}</td><td>{cur.depozit}</td><td>{cur.produs} {cur.gramaj}g</td><td className="text-right">{cur.bucati}</td>
                      <td className="text-right"><input type="number" className="w-20 border rounded px-1 text-right text-destructive" value={cur.taiat || ""} placeholder="0" onChange={(e) => updateLinie(cur.id, { taiat: Number(e.target.value) || 0 })} /></td>
                      <td className="text-right">{fmt(kgPerBuc * Math.max(0, cur.bucati - cur.taiat), 2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>)}
        </DialogContent>
      </Dialog>
    </div>
  );
}
