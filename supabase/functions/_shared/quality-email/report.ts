import { isSupplierQualityLoss, supplierQualityCreditQuantity, supplierQualityLossBase } from './credit.ts';
export type EmailLang = "en" | "ro" | "it";
type EmailContent = Record<EmailLang,string>;
const escapeHtml = (v: unknown) => String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
export type PhotoRef = { path: string; url: string };

export type ReportRow = {
  inventory_id: string;
  product_id: string | null;
  // AUTO din recepție (read-only)
  denumire_produs: string;
  producator: string;
  cantitate_receptionata: number;
  unit: string;
  tip_lada_culoare: string;
  nr_lazi: number | null;
  tip_palet: string;          // AUTO din recepție acum
  nr_paleti_rec: number | null; // AUTO din recepție acum
  // MANUALE (persistente)
  paleti_lazi_document: string;
  cantitate_document: string;
  declared_quantity: string;  // pt. cazul cu surplus peste prag
  pierdere_calitativa_procent: string;
  transmis_la_furnizor: boolean;
  defects: string[];
  observations: string;
  photos: PhotoRef[];
  // marker pentru articole lipsă
  is_missing?: boolean;
  missing_id?: string;
  lot_number?: string;
  operator?: string;
};

type ToleranceCfg = { under: number; over: number };
const DEFAULT_TOLERANCE: ToleranceCfg = { under: 3, over: 100 };

export type SupplierGroup = {
  supplierName: string;
  supplierId: string | null;
  documentNumber: string;
  operatorName?: string;
  rows: ReportRow[];
};

const QUALITY_TRANSLATIONS: Record<EmailLang, Record<string, string>> = {
  en: {
    impuritati: "impurities", "impurități": "impurities", "varfuri arse": "burnt tips", "vârfuri arse": "burnt tips",
    "frunze galbene": "yellow leaves", "frunze arse": "burnt leaves", "frunze negre": "black leaves", "frunze putrede": "rotten leaves",
    putred: "rotten", mucegai: "mold", umed: "wet", "usor umed": "slightly damp", "ușor umed": "slightly damp",
    deshidratat: "dehydrated", "tije lungi": "long stems", "cozi lungi": "long tails", seminte: "seeds", semințe: "seeds",
    flori: "flowers", crengi: "branches", neuniform: "uneven", "capete nedezvoltate": "undeveloped heads",
  },
  ro: {
    impurities: "impurități", "burnt tips": "vârfuri arse", "yellow leaves": "frunze galbene", "burnt leaves": "frunze arse",
    "black leaves": "frunze negre", "rotten leaves": "frunze putrede", rotten: "putred", mold: "mucegai", wet: "umed",
    "slightly damp": "ușor umed", dehydrated: "deshidratat", "long stems": "tije lungi", "long tails": "cozi lungi",
    seeds: "semințe", flowers: "flori", branches: "crengi", uneven: "neuniform", "undeveloped heads": "capete nedezvoltate",
  },
  it: {
    impurities: "impurità", impuritati: "impurità", "impurități": "impurità", "burnt tips": "punte bruciate", "vârfuri arse": "punte bruciate",
    "yellow leaves": "foglie gialle", "frunze galbene": "foglie gialle", "burnt leaves": "foglie bruciate", "frunze arse": "foglie bruciate",
    "black leaves": "foglie nere", "rotten leaves": "foglie marce", putred: "marcio", rotten: "marcio", mold: "muffa", mucegai: "muffa",
    wet: "bagnato", umed: "bagnato", "slightly damp": "leggermente umido", "ușor umed": "leggermente umido",
    dehydrated: "disidratato", deshidratat: "disidratato", "long stems": "gambi lunghi", "tije lungi": "gambi lunghi",
    "long tails": "code lunghe", "cozi lungi": "code lunghe", seeds: "semi", seminte: "semi", semințe: "semi", flowers: "fiori", flori: "fiori",
    branches: "rami", crengi: "rami", uneven: "non uniforme", neuniform: "non uniforme", "undeveloped heads": "cespi non sviluppati",
  },
};

const translateKnownTerms = (text: string, lang: EmailLang) => {
  let out = text;
  Object.entries(QUALITY_TRANSLATIONS[lang]).forEach(([from, to]) => {
    out = out.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), to);
  });
  return out;
};

export function createQualityEmail(day: string, emailLang: EmailLang, emailVersion: "v1" | "v2", tolerances: Record<string,{under:number;over:number}> = {}, photoUrl: (p:PhotoRef)=>string = p=>p.url) {
 const date = day;
 const format = (_date: unknown, _pattern: string) => day.split("-").reverse().join(".");
 const getTol = (id:string|null|undefined) => (id && tolerances[id]) || DEFAULT_TOLERANCE;
 const buildBodyWithPhotos = () => emailVersion === "v2" ? buildShortIntro(currentGroup)[emailLang] : buildEmailContent(currentGroup)[emailLang];
 let currentGroup: SupplierGroup;
  const fmtKg = (n: number) => {
    const s = n.toFixed(2);
    if (s.endsWith(".00")) return s.slice(0, -3);
    if (s.endsWith("0")) return s.slice(0, -1);
    return s;
  };

  const buildEmailContent = (group: SupplierGroup): EmailContent => {
    const dateStr = format(date, "dd.MM.yyyy");
    const doc = group.documentNumber || "—";
    const partner = group.supplierName;

    const render = (lang: EmailLang) => {
      const ql = getQualityLines(group, lang);
      const qualityRows = ql.filter((q) => q.creditText !== "-" || q.defectsText !== "-");
      const diffRows = ql.filter((q) => q.diffText !== "-");
      const lines: string[] = [lang === "ro" ? "Bună ziua," : lang === "it" ? "Buongiorno," : "Hello,", ""];
      if (qualityRows.length > 0) {
        lines.push(
          lang === "ro"
            ? `La recepția din ${dateStr}, ${partner} cu numărul de document ${doc} am constatat următoarele probleme calitative:`
            : lang === "it"
              ? `Al ricevimento del ${dateStr}, ${partner} con numero documento ${doc}, abbiamo riscontrato i seguenti problemi qualitativi:`
              : `At the reception on ${dateStr}, ${partner} with document number ${doc}, we found the following quality problems:`,
          ""
        );
        qualityRows.forEach((q) => {
          const d = q.defectsText !== "-" ? q.defectsText.replace(/\n/g, "; ") : (lang === "ro" ? "probleme calitative" : lang === "it" ? "problemi qualitativi" : "quality issues");
          const credit = q.creditKg > 0
            ? (lang === "ro" ? ` Solicităm notă de credit: ${q.creditText.replace(/\n/g, "; ")}.`
              : lang === "it" ? ` Chiediamo una nota di credito: ${q.creditText.replace(/\n/g, "; ")}.`
                : ` We want a credit note for ${q.creditText.replace(/\n/g, "; ")}.`)
            : q.creditText === "Warning!" ? " Warning!" : "";
          lines.push(
            lang === "ro"
              ? `${q.product} de la furnizorul ${q.producer} am recepționat ${kgTxt(q.recvQty, q.unit)} – ${d}.${credit}`
              : lang === "it"
                ? `${q.product} dal fornitore ${q.producer} abbiamo ricevuto ${kgTxt(q.recvQty, q.unit)} – ${d}.${credit}`
                : `${q.product} from the supplier ${q.producer} we received ${kgTxt(q.recvQty, q.unit)} – ${d}.${credit}`,
            ""
          );
        });
      }
      if (diffRows.length > 0) {
        lines.push(
          lang === "ro" ? `Vă transmitem diferențele cantitative pentru documentul ${doc}:`
            : lang === "it" ? `Vi inviamo le differenze quantitative per il documento ${doc}:`
              : `Please find below the quantity differences for document ${doc}:`,
          ""
        );
        diffRows.forEach((q) => lines.push(`${q.product} – ${q.diffText}`));
        lines.push("");
      } else if (qualityRows.length > 0) {
        lines.push(lang === "ro" ? "Nu avem diferențe cantitative." : lang === "it" ? "Non abbiamo differenze quantitative." : "We do not have quantitative differences.", "");
      }
      lines.push(
        lang === "ro" ? "Vă rugăm să ne transmiteți notele de credit în termen de 30 de zile."
          : lang === "it" ? "Vi preghiamo di inviarci le note di credito entro 30 giorni."
            : "Please send us your credit notes within 30 days.",
        "",
        lang === "ro" ? "Mulțumim, o zi bună!" : lang === "it" ? "Grazie, buona giornata!" : "Thank you, have a good day!"
      );
      return lines.join("\n");
    };

    return { en: render("en"), ro: render("ro"), it: render("it") };
  };

  const allPhotosForGroup = (group: SupplierGroup) => {
    const out: { row: ReportRow; photo: PhotoRef }[] = [];
    group.rows.forEach((r) => (r.photos || []).forEach((p) => out.push({ row: r, photo: p })));
    return out;
  };

  const buildShortIntro = (group: SupplierGroup): EmailContent => {
    const doc = group.documentNumber || "-";
    const partner = group.supplierName;
    return {
      en: `Hello,\n\nAttached please find the quality report for ${partner} with doc. no. ${doc}.\n\nPlease send us your credit notes within 30 days.\n\nThank you!`,
      ro: `Bună ziua,\n\nVă transmitem atașat raportul calitativ pentru ${partner} cu doc. nr. ${doc}.\n\nVă rugăm să ne transmiteți notele de credit în termen de 30 de zile.\n\nMulțumim!`,
      it: `Buongiorno,\n\nIn allegato il report qualitativo per ${partner} con doc. n. ${doc}.\n\nVi preghiamo di inviarci le note di credito entro 30 giorni.\n\nGrazie!`,
    };
  };

  const rawDefectsOf = (r: ReportRow) => [(r.defects || []).join(", "), r.observations].filter(Boolean).join(", ").trim();
  const trDefects = (raw: string, lang: EmailLang) => raw ? translateKnownTerms(raw, lang) : "";
  const kgTxt = (n: number, unit: string) => `${fmtKg(Math.round(n * 100) / 100)}${unit}`;
  const moreLess = (n: number, unit: string, more: boolean, lang: EmailLang) => {
    const v = kgTxt(n, unit);
    if (lang === "ro") return `${v} ${more ? "în plus" : "mai puțin"}`;
    if (lang === "it") return `${v} ${more ? "in più" : "in meno"}`;
    return `${v} ${more ? "more" : "less"}`;
  };
  const lotLabel = (r: ReportRow) => {
    const n = Number(r.nr_paleti_rec) || 1;
    const p = `${n} ${n === 1 ? "pallet" : "pallets"}`;
    return r.lot_number ? `${p}, lot ${r.lot_number}` : p;
  };

  type QualityLine = {
    product: string; producer: string; unit: string;
    docQty: number | null; weighed: number; recvQty: number;
    diffText: string; defectsText: string; creditText: string;
    creditKg: number; shortageKg: number;
  };

  const computeQualityLine = (rows: ReportRow[], group: SupplierGroup, lang: EmailLang): QualityLine => {
    const first = rows[0];
    if (!first) throw new Error("Empty quality group");
    const unit = first.unit || "kg";
    const docs = rows.map((r) => parseFloat(r.cantitate_document)).filter((n) => !isNaN(n));
    const docQty = docs.length ? docs.reduce((a, b) => a + b, 0) : null;
    const missing = rows.every((r) => r.is_missing);
    const weighed = missing ? 0 : rows.reduce((a, r) => a + (r.is_missing ? 0 : Number(r.cantitate_receptionata) || 0), 0);
    const tol = getTol(first.product_id);
    let recvQty = weighed;
    let diffText = "-";
    let shortageKg = 0;
    if (docQty != null && docQty > 0) {
      const diff = weighed - docQty;
      const under = docQty * (tol.under / 100);
      if (diff > 0 && diff > tol.over) { recvQty = weighed; diffText = moreLess(diff, unit, true, lang); }
      else if (diff < 0 && Math.abs(diff) > under + 1e-9) { recvQty = weighed; diffText = moreLess(-diff, unit, false, lang); shortageKg = -diff; }
      else recvQty = docQty;
    }

    // Pierdere calitativă
    const lots = rows.filter((r) => !r.is_missing).map((r) => ({ r, p: parseFloat(r.pierdere_calitativa_procent) || 0 }));
    const affected = lots.filter((l) => l.p > 0);
    const wholeProduct = lots.length <= 1 || (affected.length === lots.length && affected.every((l) => l.p === affected[0].p));
    let creditText = "-";
    let creditKg = 0;
    if (affected.length > 0) {
      if (wholeProduct) {
        const p = affected[0].p;
        const base = supplierQualityLossBase(docQty, weighed, tol);
        if (isSupplierQualityLoss(p)) { creditKg = supplierQualityCreditQuantity(base, p); creditText = kgTxt(creditKg, unit); }
        else creditText = "Warning!";
      } else {
        const lines: string[] = [];
        affected.forEach(({ r, p }) => {
          if (isSupplierQualityLoss(p)) {
            const docR = parseFloat(r.cantitate_document);
            const tolR = getTol(r.product_id);
            const recvR = Number(r.cantitate_receptionata) || 0;
            const baseR = supplierQualityLossBase(docR, recvR, tolR);
            const kg = supplierQualityCreditQuantity(baseR, p);
            creditKg += kg;
            lines.push(`${lotLabel(r)} - ${kgTxt(kg, unit)}`);
          }
        });
        creditText = lines.length ? lines.join("\n") : "Warning!";
      }
    }

    // Defecte — fără procentul pierderii calitative (nu se transmite furnizorului)
    let defectsText = "-";
    if (lots.length <= 1) {
      defectsText = trDefects(rawDefectsOf(first), lang) || "-";
    } else if (lots.some((l) => rawDefectsOf(l.r))) {
      defectsText = lots.map(({ r }) => `${lotLabel(r)} – ${trDefects(rawDefectsOf(r), lang) || "OK"}`).join("\n");
    }

    return {
      product: first.denumire_produs,
      producer: first.producator || group.supplierName || "-",
      unit, docQty, weighed, recvQty: missing ? 0 : recvQty,
      diffText: missing && docQty ? moreLess(docQty, unit, false, lang) : diffText,
      defectsText, creditText, creditKg,
      shortageKg: missing ? (docQty || 0) : shortageKg,
    };
  };

  // Un rând pe produs (+producător); mai multe loturi/paleți ale aceluiași produs se cumulează.
  const getQualityLines = (group: SupplierGroup, lang: EmailLang): QualityLine[] => {
    const map = new Map<string, ReportRow[]>();
    group.rows.forEach((r) => {
      const k = `${r.denumire_produs}__${r.producator}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k)?.push(r);
    });
    return Array.from(map.values()).map((rows) => computeQualityLine(rows, group, lang));
  };

  const getEmailTableRows = (group: SupplierGroup, lang: EmailLang) => group.rows.map((r) => {
    const q = computeQualityLine([r], group, lang);
    return {
      product: q.product,
      producer: q.producer,
      document: q.docQty != null ? kgTxt(q.docQty, q.unit) : "-",
      received: kgTxt(q.recvQty, q.unit),
      difference: q.diffText,
      loss: q.creditText,
      credit: q.creditText,
      defects: q.defectsText,

      photos: (r.photos || []).length > 0 ? `${r.photos.length} link` : "-",
    };
  });

  // V2 – Quality Report (format procedură)
  const getEmailTableRowsV2 = (group: SupplierGroup, lang: EmailLang) => {
    const dateStr = format(date, "dd.MM.yyyy");
    return getQualityLines(group, lang).map((q) => ({
      date: dateStr,
      supplier: group.supplierName || "-",
      document: group.documentNumber || "-",
      product: q.product,
      producer: q.producer,
      docQty: q.docQty != null ? kgTxt(q.docQty, q.unit) : "-",
      recvQty: kgTxt(q.recvQty, q.unit),
      diff: q.diffText,
      defects: q.defectsText,
      credit: q.creditText,
    }));
  };

  const emailHeaders = (lang: EmailLang) => lang === "ro"
    ? ["Produs", "Producător", "Cantitate document", "Cantitate recepționată", "Diferență cantitativă", "Pierdere calitativă", "Notă de credit", "Defecte", "Poze"]
    : lang === "it"
      ? ["Prodotto", "Produttore", "Quantità documento", "Quantità ricevuta", "Differenza quantitativa", "Perdita qualitativa", "Nota di credito", "Difetti", "Foto"]
      : ["Product", "Producer", "Document quantity", "Received quantity", "Quantitative difference", "Quality loss", "Credit note", "Defects", "Photos"];

  const emailHeadersV2 = (lang: EmailLang) => lang === "ro"
    ? ["Data", "Furnizor", "Nr. Document", "Denumire produs", "Producător", "Cant. Document\n(kg/buc)", "Cant. Recepționată\n(kg/buc)", "Diferență\nCantitativă", "Probleme Calitative\nConstatate", "Notă Credit\nCalitativă (kg)"]
    : lang === "it"
      ? ["Data", "Fornitore", "N. Documento", "Nome prodotto", "Produttore", "Q.tà Documento\n(kg/pz)", "Q.tà Ricevuta\n(kg/pz)", "Differenza\nQuantitativa", "Difetti Qualitativi\nRiscontrati", "Nota Credito\nQualitativo (kg)"]
      : ["Date", "Supplier", "Document No.", "Product name", "Producer", "Document Qty\n(kg/pcs)", "Received Qty\n(kg/pcs)", "Quantity\nDifference", "Quality Defects\nIdentified", "Quality Credit\nNote (kg)"];

  const buildEmailPlainText = (group: SupplierGroup) => {
    const isV2 = emailVersion === "v2";
    const headers = isV2 ? emailHeadersV2(emailLang) : emailHeaders(emailLang);
    const photoLines = allPhotosForGroup(group).map((p) => `${p.row.denumire_produs}: ${photoUrl(p.photo)}`);
    const tableTitle = emailLang === "ro"
      ? (isV2 ? "Raport calitativ:" : "Tabel recepție:")
      : emailLang === "it"
        ? (isV2 ? "Report qualitativo:" : "Tabella ricevimento:")
        : (isV2 ? "Quality report:" : "Reception table:");
    const rowLines = isV2
      ? getEmailTableRowsV2(group, emailLang).map((r) => [r.date, r.supplier, r.document, r.product, r.producer, r.docQty, r.recvQty, r.diff, r.defects.replace(/\n/g, "; "), r.credit.replace(/\n/g, "; ")].join(" | "))
      : getEmailTableRows(group, emailLang).map((r) => [r.product, r.producer, r.document, r.received, r.difference, r.loss, r.credit, r.defects, r.photos].join(" | "));
    return [
      buildBodyWithPhotos(),
      "",
      tableTitle,
      headers.map((h) => h.replace(/\n/g, " ")).join(" | "),
      ...rowLines,
      ...(photoLines.length ? ["", emailLang === "ro" ? "Poze:" : emailLang === "it" ? "Foto:" : "Photos:", ...photoLines] : []),
    ].join("\n");
  };

  const buildEmailHtml = (group: SupplierGroup) => {
    const isV2 = emailVersion === "v2";
    const headers = isV2 ? emailHeadersV2(emailLang) : emailHeaders(emailLang);
    const photos = allPhotosForGroup(group);
    const tableTitle = emailLang === "ro"
      ? (isV2 ? "Raport calitativ" : "Tabel recepție")
      : emailLang === "it"
        ? (isV2 ? "Report qualitativo" : "Tabella ricevimento")
        : (isV2 ? "Quality report" : "Reception table");
    const bodyCells = isV2
      ? getEmailTableRowsV2(group, emailLang).map((r) => [r.date, r.supplier, r.document, r.product, r.producer, r.docQty, r.recvQty, r.diff, r.defects, r.credit])
      : getEmailTableRows(group, emailLang).map((r) => [r.product, r.producer, r.document, r.received, r.difference, r.loss, r.credit, r.defects, r.photos]);
    return `
      <div style="font-family: Arial, sans-serif; color:#111827; font-size:14px; line-height:1.45;">
        ${buildBodyWithPhotos().split("\n").map((line) => {
          if (!line.trim()) return "";
          const bold = /credit notes within 30 days|notele de credit în termen de 30|note di credito entro 30/i.test(line);
          return `<p style="margin:0 0 12px;">${bold ? `<b>${escapeHtml(line)}</b>` : escapeHtml(line)}</p>`;
        }).join("")}
        <h3 style="margin:18px 0 8px; font-size:16px;">${tableTitle}</h3>
        <table style="border-collapse:collapse; width:100%; font-size:13px;">
          <thead><tr>${headers.map((h) => `<th style="border:1px solid #d1d5db; padding:8px; background:#f3f4f6; text-align:left; white-space:pre-line;">${escapeHtml(h)}</th>`).join("")}</tr></thead>
          <tbody>${bodyCells.map((cells) => `<tr>${cells.map((v) => `<td style="border:1px solid #d1d5db; padding:8px; vertical-align:top;">${escapeHtml(v).replace(/\n/g, "<br/>")}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>
        ${photos.length ? `<h3 style="margin:18px 0 8px; font-size:16px;">${emailLang === "ro" ? "Poze" : emailLang === "it" ? "Foto" : "Photos"}</h3><ul style="padding-left:18px;">${photos.map((p) => `<li><a href="${escapeHtml(photoUrl(p.photo))}">${escapeHtml(p.row.denumire_produs)}</a></li>`).join("")}</ul>` : ""}
      </div>`;
  };


return {
 computeQualityLine, getQualityLines, getEmailTableRows, getEmailTableRowsV2,
 render(group: SupplierGroup) { currentGroup=group; return {html:buildEmailHtml(group),text:buildEmailPlainText(group)}; }
};
}
