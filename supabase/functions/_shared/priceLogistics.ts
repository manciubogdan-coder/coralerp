import { seniorLive } from "./senior.ts";
import { PALLET_RELATION } from "./priceSourceRules.ts";

type Window = { start: string; end: string; bookFrom: number; bookTo: number };

/** Logistics reads shared by every product of a price list: trips in the latest window `w`, pallets and trips in the load window `load`. */
export async function priceLogistics(sb: any, aids: number[], w: Window, load: Window) {
  const run = async (sql: string) => { const r = await seniorLive(sb, "sql", { sql }, 55000); return Array.isArray(r) ? r : []; };
  // Audited against extensions.NumarPaleti: article-only join, never corresponding UM.
  const relation = PALLET_RELATION;
  const ids = aids.filter((x) => Number.isInteger(x) && x > 0);
  // Carrier invoice lines dated in a window: one line per trip, named "TRANSPORT DIST <CURSĂ>".
  const tripsSql = (x: Window) => run(`SELECT UPPER(LTRIM(RTRIM(d.Denumire))) line,COUNT(*) trips,SUM(CAST(d.Cantitate AS float)) qty,SUM(CAST(d.Cantitate*d.Pret_Final_ROL AS float)) total,
      MIN(CAST(d.Pret_Final_ROL AS float)) pmin,MAX(CAST(d.Pret_Final_ROL AS float)) pmax
      FROM dbo.C_H_Note_Contabile h WITH (NOLOCK) JOIN dbo.C_D_Note_Contabile d WITH (NOLOCK) ON d.H_ID=h.H_ID
      WHERE ISNULL(h.Anulat,0)=0 AND d.Denumire LIKE 'TRANSPORT DIST%' AND h.Data>='${x.start}' AND h.Data<'${x.end}'
        AND h.H_ID IN (SELECT dc.H_ID FROM dbo.C_H_Note_Contabile_Detalii_Conturi dc WITH (NOLOCK)
        JOIN dbo.C_Plan_Contabil p WITH (NOLOCK) ON p.Analitic_ID=dc.AnaliticId WHERE p.Cont IN ('624.02','624.06') AND dc.LunaContabila BETWEEN '${x.bookFrom}' AND '${x.bookTo}')
      GROUP BY UPPER(LTRIM(RTRIM(d.Denumire)))`);
  const [conversion, points, trips, loadTrips, costs] = await Promise.all([
    ids.length ? run(`SELECT Articol_ID id,coef FROM (${relation}) r WHERE Articol_ID IN (${ids.join(",")})`) : Promise.resolve([]),
    // Pallets invoiced per delivery point over the load window (each store is its own Senior partner).
    run(`SELECT pp.Partener_ID pid,MAX(pp.Partener_Denumire) name,MAX(pp.Document_Judet) judet,MAX(pp.Document_Tara) country,
      SUM(CAST(d.Cantitate AS float)/r.coef) pallets,SUM(CASE WHEN r.coef IS NULL AND d.Cantitate<>0 THEN 1 ELSE 0 END) missing
      FROM dbo.C_H_Note_Contabile h WITH (NOLOCK) JOIN dbo.C_Tipuri_Document t WITH (NOLOCK) ON t.Tip_Document_ID=h.Tip_Document_ID JOIN dbo.C_D_Note_Contabile d WITH (NOLOCK) ON d.H_ID=h.H_ID
      JOIN dbo.C_H_Note_Contabile_Parteneri pp WITH (NOLOCK) ON pp.H_ID=h.H_ID AND pp.TipPartener=1
      LEFT JOIN (${relation}) r ON r.Articol_ID=d.Articol_ID
      WHERE t.Cod IN ('FC','FCE','FCEC') AND ISNULL(h.Anulat,0)=0 AND h.Data>='${load.start}' AND h.Data<'${load.end}'
      AND d.Denumire NOT LIKE '%DISCOUNT%' AND d.Denumire NOT LIKE '%Reducere de pret%' AND d.Denumire NOT LIKE '%SERVIC%' AND d.Denumire NOT LIKE '%REFACTUR%'
      GROUP BY pp.Partener_ID`),
    tripsSql(w), tripsSql(load),
    // Distribution journal subjects of invoices dated in the window, to disclose costs not named after a cursă.
    run(`SELECT p.Cont cont,dc.SubiectDenumire subject,SUM(CASE WHEN dc.IsDebit=1 THEN CAST(dc.Valoare_Rol AS float) ELSE -CAST(dc.Valoare_Rol AS float) END) total FROM dbo.C_H_Note_Contabile_Detalii_Conturi dc WITH (NOLOCK) JOIN dbo.C_Plan_Contabil p WITH (NOLOCK) ON p.Analitic_ID=dc.AnaliticId JOIN dbo.C_H_Note_Contabile h WITH (NOLOCK) ON h.H_ID=dc.H_ID JOIN dbo.C_Tipuri_Document t WITH (NOLOCK) ON t.Tip_Document_ID=h.Tip_Document_ID WHERE p.Cont IN ('624.02','624.03','624.06') AND dc.LunaContabila BETWEEN '${w.bookFrom}' AND '${w.bookTo}' AND h.Data>='${w.start}' AND h.Data<'${w.end}' AND t.Cod<>'NCICV' AND ISNULL(h.Anulat,0)=0 GROUP BY p.Cont,dc.SubiectDenumire`),
  ]);
  return { conversion, points, trips, loadTrips, costs };
}
