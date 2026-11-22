import React, { useMemo, useState } from "react";
import { Calendar, FileSpreadsheet, Loader2, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-custom-toast";
import { exportToExcel } from "@/lib/excelExport";
import { persistDateKey, readStoredDateKey, todayKey } from "@/lib/persistentDate";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { saveLotOverride, useLotJourneys } from "@/hooks/evidenta/useLotJourneys";
import { bucharestTime, buildLotJourneys, LOT_PACK_GRAMS, OTHER_PACK, overrideKey, packBucket, type DayOverride, type JourneyDay, type LotJourney } from "@/lib/evidenta/lotJourney";

const packLabel = (g: number) => (g === OTHER_PACK ? "alte gramaje" : g === 1000 ? "1,0 kg" : `${g} g`);

const minusDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};
const fmtDate = (s: string | null | undefined) => {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  return `${d}.${m}.${y}`;
};
const n2 = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? "—" : v.toLocaleString("ro-RO", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const pct = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? "—" : `${(v * 100).toLocaleString("ro-RO", { maximumFractionDigits: 2 })}%`;
const round2 = (v: number) => Math.round(v * 100) / 100;
/** Procent ca număr (30,68), ca să poată fi adunat în Excel. */
const pctNum = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "" : round2(v * 100));

/** Câte zile a stat marfa de la intrare până a ajuns în producție. */
const AgeBadge: React.FC<{ days: number }> = ({ days }) => (
  <span
    className={`inline-flex min-w-[2.25rem] justify-center rounded px-1.5 py-0.5 text-xs font-semibold ${
      days >= 3 ? "bg-destructive text-destructive-foreground" : days === 2 ? "bg-muted text-foreground ring-1 ring-destructive/50" : "bg-secondary text-secondary-foreground"
    }`}
    title={`${days} ${days === 1 ? "zi" : "zile"} de la intrarea NIR`}
  >
    {days} {days === 1 ? "zi" : "zile"}
  </span>
);

type Field = "rebut" | "kg_final" | "nr_pers" | "ora_start" | "ora_stop" | "observatii";
const FIELD_TO_OVERRIDE: Record<Field, keyof DayOverride> = {
  rebut: "rebut", kg_final: "kgFinal", nr_pers: "nrPers", ora_start: "oraStart", ora_stop: "oraStop", observatii: "observatii",
};

export const EvidentaLoturi: React.FC = () => {
  const startKey = "evidenta-lot.start";
  const endKey = "evidenta-lot.end";
  const [start, setStartState] = useState(() => readStoredDateKey(startKey, minusDays(todayKey(), 7)));
  const [end, setEndState] = useState(() => readStoredDateKey(endKey, todayKey()));
  const setStart = (v: string) => { setStartState(v); persistDateKey(startKey, v); };
  const setEnd = (v: string) => { setEndState(v); persistDateKey(endKey, v); };
  const [search, setSearch] = usePersistentState("evidenta-lot.search", "");
  const [onlyProduced, setOnlyProduced] = usePersistentState("evidenta-lot.only-produced", true);

  const { data, isLoading, isFetching, error, refetch } = useLotJourneys(start, end);
  const [local, setLocal] = useState<Map<string, DayOverride>>(new Map());
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const journeys = useMemo<LotJourney[]>(() => {
    if (!data) return [];
    const overrides = new Map(data.overrides);
    for (const [k, v] of local) overrides.set(k, { ...overrides.get(k), ...v });
    return buildLotJourneys({ ...data, overrides });
  }, [data, local]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return journeys
      .filter((j) => !onlyProduced || j.days.length > 0)
      .filter((j) => !q || [j.reception.product, j.reception.lot, j.reception.supplier, j.reception.producer].join(" ").toLowerCase().includes(q))
      .sort((a, b) => a.reception.receiptDay.localeCompare(b.reception.receiptDay) || a.reception.lot.localeCompare(b.reception.lot) || a.reception.product.localeCompare(b.reception.product));
  }, [journeys, search, onlyProduced]);

  // Coloanele fixe din Excelul Andradei; „Alte gramaje" apare doar dacă există.
  const grams = useMemo(() => {
    const other = visible.some((j) => (j.totals.piecesByGrams[OTHER_PACK] || 0) > 0);
    return [...LOT_PACK_GRAMS, ...(other ? [OTHER_PACK] : [])] as number[];
  }, [visible]);

  const save = async (j: LotJourney, d: JourneyDay, field: Field, raw: string) => {
    const k = overrideKey(j.reception.id, d.day);
    const isNum = field === "rebut" || field === "kg_final" || field === "nr_pers";
    const value = raw.trim() === "" ? null : isNum ? Number(raw.replace(",", ".")) : raw.trim();
    if (isNum && value !== null && !Number.isFinite(value as number)) {
      toast({ title: "Valoare invalidă", variant: "destructive" });
      return;
    }
    const current = (d.override as any)?.[FIELD_TO_OVERRIDE[field]] ?? null;
    if (current === value) return;
    try {
      const id = await saveLotOverride({
        receptionId: j.reception.id, day: d.day, lot: j.reception.lot, produs: j.reception.product,
        existingId: d.override?.id, patch: { [field]: value },
      });
      setLocal((prev) => {
        const next = new Map(prev);
        next.set(k, { ...(next.get(k) || {}), id, [FIELD_TO_OVERRIDE[field]]: value });
        return next;
      });
    } catch (e: any) {
      toast({ title: "Eroare la salvare", description: e?.message, variant: "destructive" });
    }
  };

  const cellInput = (j: LotJourney, d: JourneyDay, field: Field, current: string, placeholder: string, className = "") => {
    const k = `${j.reception.id}|${d.day}|${field}`;
    const type = field === "ora_start" || field === "ora_stop" ? "time" : "text";
    return (
      <Input
        type={type}
        inputMode={field === "rebut" || field === "kg_final" || field === "nr_pers" ? "decimal" : undefined}
        value={drafts[k] ?? current}
        placeholder={placeholder}
        onChange={(e) => setDrafts((p) => ({ ...p, [k]: e.target.value }))}
        onBlur={async (e) => {
          if (e.target.value !== current) await save(j, d, field, e.target.value);
          setDrafts((p) => { const n = { ...p }; delete n[k]; return n; });
        }}
        className={`h-8 px-2 ${className}`}
      />
    );
  };

  const handleExport = () => {
    if (!visible.length) { toast({ title: "Nu există date" }); return; }
    const rows: any[] = [];
    for (const j of visible) {
      const r = j.reception;
      const t = j.totals;
      const base = (o: Record<string, any>) => o;
      const head = base({
        "Data intrare": fmtDate(r.receiptDay), "Lot": r.lot, "Produs": r.product, "Furnizor": r.supplier ?? "", "Producător": r.producer ?? "",
        "Cantitate intrată NIR (kg)": round2(r.nirKg), "Kg CN solicitat": r.creditKg ?? "", "% CN solicitat": r.qualityPct != null ? round2(r.qualityPct) : "",
        "Cantitate rămasă (kg)": round2(r.remainingKg ?? (j.days.length ? j.days[j.days.length - 1].remainingAfter : r.nirKg)),
        "Data producție": j.days.length ? `TOTAL (${j.days.length} ${j.days.length === 1 ? "zi" : "zile"})` : "",
        "Zile de la intrare": t.firstAgeDays != null ? (t.firstAgeDays === t.lastAgeDays ? t.firstAgeDays : `${t.firstAgeDays}–${t.lastAgeDays}`) : "",
        "Linia": "", "MP intrată în prod (kg)": t.mpKg, "Rebut (kg)": t.rebut, "Pus în caserole (kg)": t.pusInCaserole,
        "% NC": pctNum(t.pctNc), "Diferență cântar (kg)": t.difCantar, "% cântar": pctNum(t.pctCantar),
      });
      for (const g of grams) head[`Bucăți ${packLabel(g)}`] = Math.round(t.piecesByGrams[g] || 0);
      Object.assign(head, { "Kg final": t.kgFinal, "Nr. pers.": "", "Ora start": "", "Ora stop": "", "Observații": "" });
      rows.push(head);
      for (const d of j.days) {
        const row: Record<string, any> = {
          "Data intrare": "", "Lot": "", "Produs": "", "Furnizor": "", "Producător": "",
          "Cantitate intrată NIR (kg)": "", "Kg CN solicitat": "", "% CN solicitat": "",
          "Cantitate rămasă (kg)": d.remainingAfter, "Data producție": fmtDate(d.day), "Zile de la intrare": d.ageDays,
          "Linia": d.lines.join(", "), "MP intrată în prod (kg)": d.mpKg, "Rebut (kg)": d.rebut, "Pus în caserole (kg)": d.pusInCaserole,
          "% NC": pctNum(d.pctNc), "Diferență cântar (kg)": d.difCantar, "% cântar": pctNum(d.pctCantar),
        };
        for (const g of grams) row[`Bucăți ${packLabel(g)}`] = Math.round(d.piecesByGrams[g] || 0);
        Object.assign(row, {
          "Kg final": d.kgFinal, "Nr. pers.": d.override?.nrPers ?? "",
          "Ora start": d.override?.oraStart || bucharestTime(d.autoStart), "Ora stop": d.override?.oraStop || bucharestTime(d.autoStop),
          "Observații": [d.share < 1 ? `Împărțit cu alte loturi (${Math.round(d.share * 100)}% din ziua respectivă)` : "", d.override?.observatii || ""].filter(Boolean).join(" • "),
        });
        rows.push(row);
      }
    }
    exportToExcel(rows, `Evidenta_loturi_${start}_${end}.xlsx`);
  };

  const th = "sticky top-0 z-10 bg-background border-b px-2 py-2 text-left text-xs font-semibold whitespace-nowrap";
  const td = "px-2 py-1 border-b text-sm whitespace-nowrap";
  const num = `${td} text-right tabular-nums`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Calendar className="h-4 w-4" />
        <span className="text-sm text-muted-foreground">Intrare NIR:</span>
        <input type="date" value={start} max={end} onChange={(e) => e.target.value && setStart(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm" />
        <span className="text-sm text-muted-foreground">–</span>
        <input type="date" value={end} min={start} onChange={(e) => e.target.value && setEnd(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm" />
        <Input placeholder="Caută produs, lot, furnizor…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={onlyProduced} onCheckedChange={(v) => setOnlyProduced(v === true)} />
          Doar loturile date în producție
        </label>
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-1 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Actualizează
        </Button>
        <Button size="sm" variant="outline" onClick={handleExport}>
          <FileSpreadsheet className="mr-1 h-4 w-4" /> Export Excel
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Fiecare lot pornește de la NIR (cantitate intrată, CN cerut la recepție). Dedesubt apare fiecare zi în care lotul a fost dat în producție:
        câte zile a stat de la intrare, kg date pe linie, produsul finit obținut (bucăți pe gramaj din sesiunile de producție), rebutul, diferența de cântar și orele.
        Pus în caserole = MP − rebut • Dif. cântar = pus în caserole − kg final • % NC = rebut ÷ MP. Producția se leagă de lot după zi: dacă în aceeași zi s-au dat mai multe loturi din același produs, bucățile și rebutul se împart după kg date. Rebutul, kg final, oamenii, orele și observațiile se pot corecta; câmpul gol revine la valoarea din aplicație.
      </p>

      {error ? (
        <div className="rounded-md border border-destructive/40 p-4 text-sm text-destructive">Nu am putut încărca loturile: {(error as Error).message}</div>
      ) : isLoading ? (
        <div className="flex items-center justify-center gap-2 p-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Se încarcă loturile…</div>
      ) : (
        <div className="max-h-[75vh] overflow-auto rounded-lg border">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <th className={th}>Data intrare</th>
                <th className={th}>Lot</th>
                <th className={th}>Produs</th>
                <th className={th}>Furnizor / producător</th>
                <th className={`${th} text-right`}>Cant. intrată NIR</th>
                <th className={`${th} text-right`}>Kg CN solicitat</th>
                <th className={`${th} text-right`}>% CN</th>
                <th className={`${th} text-right`}>Rămas</th>
                <th className={`${th} border-l`}>Data producție</th>
                <th className={th}>De la intrare</th>
                <th className={th}>Linia</th>
                <th className={`${th} text-right`}>MP în prod.</th>
                <th className={`${th} text-right`}>Rebut</th>
                <th className={`${th} text-right`}>Pus în caserole</th>
                <th className={`${th} text-right`}>% NC</th>
                <th className={`${th} text-right`}>Dif. cântar</th>
                <th className={`${th} text-right`}>% cântar</th>
                {grams.map((g) => <th key={g} className={`${th} text-right`}>Buc {packLabel(g)}</th>)}
                <th className={`${th} text-right`}>Kg final</th>
                <th className={th}>Nr. pers.</th>
                <th className={th}>Ora start</th>
                <th className={th}>Ora stop</th>
                <th className={`${th} min-w-[220px]`}>Observații</th>
              </tr>
            </thead>
            {visible.map((j) => {
                const r = j.reception;
                const t = j.totals;
                const ncHigh = (v: number | null) => v != null && v * 100 > (r.qualityPct ?? 0) + 5;
                return (
                  <tbody key={r.id}>
                    <tr className="bg-muted/60 font-semibold">
                      <td className={td}>{fmtDate(r.receiptDay)}</td>
                      <td className={`${td} font-mono`}>{r.lot || "—"}</td>
                      <td className={td}>{r.product}</td>
                      <td className={td}>
                        <div>{r.supplier || "—"}</div>
                        {r.producer && r.producer !== r.supplier && <div className="text-xs font-normal text-muted-foreground">{r.producer}</div>}
                      </td>
                      <td className={num}>{n2(r.nirKg)}</td>
                      <td className={num}>{r.creditKg ? n2(r.creditKg) : "—"}</td>
                      <td className={num}>{r.qualityPct != null ? `${n2(r.qualityPct)}%` : "—"}</td>
                      <td className={num} title="Stocul rămas acum în depozit din acest NIR">{n2(r.remainingKg ?? (j.days.length ? j.days[j.days.length - 1].remainingAfter : r.nirKg))}</td>
                      <td className={`${td} border-l`}>{j.days.length ? `Total · ${j.days.length} ${j.days.length === 1 ? "zi" : "zile"}` : <span className="font-normal text-muted-foreground">Nedat în producție</span>}</td>
                      <td className={td}>{t.firstAgeDays != null && (t.firstAgeDays === t.lastAgeDays ? <AgeBadge days={t.firstAgeDays} /> : <span className="text-xs">{t.firstAgeDays}–{t.lastAgeDays} zile</span>)}</td>
                      <td className={td} />
                      <td className={num}>{j.days.length ? n2(t.mpKg) : ""}</td>
                      <td className={num}>{j.days.length ? n2(t.rebut) : ""}</td>
                      <td className={num}>{j.days.length ? n2(t.pusInCaserole) : ""}</td>
                      <td className={`${num} ${ncHigh(t.pctNc) ? "text-destructive" : ""}`}>{j.days.length ? pct(t.pctNc) : ""}</td>
                      <td className={num}>{j.days.length ? n2(t.difCantar) : ""}</td>
                      <td className={num}>{j.days.length ? pct(t.pctCantar) : ""}</td>
                      {grams.map((g) => <td key={g} className={num}>{t.piecesByGrams[g] ? Math.round(t.piecesByGrams[g]).toLocaleString("ro-RO") : ""}</td>)}
                      <td className={num}>{j.days.length ? n2(t.kgFinal) : ""}</td>
                      <td className={td} /><td className={td} /><td className={td} /><td className={td} />
                    </tr>
                    {j.days.map((d) => {
                      const ov = d.override;
                      return (
                        <tr key={d.day} className="hover:bg-muted/30">
                          <td className={td} colSpan={7} />
                          <td className={num}>{n2(d.remainingAfter)}</td>
                          <td className={`${td} border-l`}>{fmtDate(d.day)}</td>
                          <td className={td}><AgeBadge days={d.ageDays} /></td>
                          <td className={`${td} text-xs`}>{d.lines.join(", ") || "—"}</td>
                          <td className={num}>{n2(d.mpKg)}</td>
                          <td className="border-b p-1 w-24">{cellInput(j, d, "rebut", ov?.rebut != null ? String(ov.rebut) : "", n2(d.autoRebut), "text-right")}</td>
                          <td className={num}>{n2(d.pusInCaserole)}</td>
                          <td className={`${num} ${ncHigh(d.pctNc) ? "font-semibold text-destructive" : ""}`}>{pct(d.pctNc)}</td>
                          <td className={num}>{n2(d.difCantar)}</td>
                          <td className={num}>{pct(d.pctCantar)}</td>
                          {grams.map((g) => (
                            <td key={g} className={num} title={d.products.filter((p) => packBucket(p.packGrams) === g).map((p) => `${p.name}: ${Math.round(p.pieces)} buc`).join("\n")}>
                              {d.piecesByGrams[g] ? Math.round(d.piecesByGrams[g]).toLocaleString("ro-RO") : ""}
                            </td>
                          ))}
                          <td className="border-b p-1 w-24">{cellInput(j, d, "kg_final", ov?.kgFinal != null ? String(ov.kgFinal) : "", n2(d.autoKgFinal), "text-right")}</td>
                          <td className="border-b p-1 w-20">{cellInput(j, d, "nr_pers", ov?.nrPers != null ? String(ov.nrPers) : "", "")}</td>
                          <td className="border-b p-1 w-28">{cellInput(j, d, "ora_start", ov?.oraStart || bucharestTime(d.autoStart), "")}</td>
                          <td className="border-b p-1 w-28">{cellInput(j, d, "ora_stop", ov?.oraStop || bucharestTime(d.autoStop), "")}</td>
                          <td className="border-b p-1">
                            {d.share < 1 && (
                              <div className="mb-1 whitespace-nowrap text-xs text-muted-foreground">Împărțit cu alte loturi: {Math.round(d.share * 100)}% din materialul zilei</div>
                            )}
                            {!d.hasProduction && <div className="mb-1 whitespace-nowrap text-xs text-muted-foreground">Nicio sesiune de producție găsită în această zi</div>}
                            {cellInput(j, d, "observatii", ov?.observatii || "", "")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                );
              })}
            {visible.length === 0 && (
              <tbody><tr><td colSpan={22 + grams.length} className="p-6 text-center text-sm text-muted-foreground">Niciun lot în perioada aleasă.</td></tr></tbody>
            )}
          </table>
        </div>
      )}
    </div>
  );
};

export default EvidentaLoturi;
