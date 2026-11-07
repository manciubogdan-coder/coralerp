import { seniorLive } from "./senior.ts";
import { PALLET_RELATION } from "./priceSourceRules.ts";

export async function priceLogistics(sb: any, aid: number, start: string, end: string, period: number) {
  const run = async (sql: string) => { const r = await seniorLive(sb, "sql", { sql }, 55000); return Array.isArray(r) ? r : []; };
  // Audited against extensions.NumarPaleti: article-only join, never corresponding UM.
  const relation = PALLET_RELATION;
  const [conversion, points, trips, costs] = await Promise.all([
    run(`SELECT Articol_ID id,coef FROM (${relation}) r WHERE Articol_ID=${aid}`),
    // Pallets invoiced per delivery point (each store is its own Senior partner).
    run(`SELECT pp.Partener_ID pid,MAX(pp.Partener_Denumire) name,MAX(pp.Document_Judet) judet,MAX(pp.Document_Tara) country,
      SUM(CAST(d.Cantitate AS float)/r.coef) pallets,SUM(CASE WHEN r.coef IS NULL AND d.Cantitate<>0 THEN 1 ELSE 0 END) missing
      FROM dbo.C_H_Note_Contabile h WITH (NOLOCK) JOIN dbo.C_Tipuri_Document t WITH (NOLOCK) ON t.Tip_Document_ID=h.Tip_Document_ID JOIN dbo.C_D_Note_Contabile d WITH (NOLOCK) ON d.H_ID=h.H_ID
      JOIN dbo.C_H_Note_Contabile_Parteneri pp WITH (NOLOCK) ON pp.H_ID=h.H_ID AND pp.TipPartener=1
      LEFT JOIN (${relation}) r ON r.Articol_ID=d.Articol_ID
      WHERE t.Cod IN ('FC','FCE','FCEC') AND ISNULL(h.Anulat,0)=0 AND h.Data>='${start}' AND h.Data<'${end}'
      AND d.Denumire NOT LIKE '%DISCOUNT%' AND d.Denumire NOT LIKE '%Reducere de pret%' AND d.Denumire NOT LIKE '%SERVIC%' AND d.Denumire NOT LIKE '%REFACTUR%'
      GROUP BY pp.Partener_ID`),
    // Carrier invoice lines: one line per trip, named "TRANSPORT DIST <CURSĂ>" (audited: line totals equal journal subject totals).
    run(`SELECT UPPER(LTRIM(RTRIM(d.Denumire))) line,COUNT(*) trips,SUM(CAST(d.Cantitate AS float)) qty,SUM(CAST(d.Cantitate*d.Pret_Final_ROL AS float)) total,
      MIN(CAST(d.Pret_Final_ROL AS float)) pmin,MAX(CAST(d.Pret_Final_ROL AS float)) pmax
      FROM dbo.C_H_Note_Contabile h WITH (NOLOCK) JOIN dbo.C_D_Note_Contabile d WITH (NOLOCK) ON d.H_ID=h.H_ID
      WHERE ISNULL(h.Anulat,0)=0 AND d.Denumire LIKE 'TRANSPORT DIST%' AND h.H_ID IN (SELECT dc.H_ID FROM dbo.C_H_Note_Contabile_Detalii_Conturi dc WITH (NOLOCK)
        JOIN dbo.C_Plan_Contabil p WITH (NOLOCK) ON p.Analitic_ID=dc.AnaliticId WHERE p.Cont IN ('624.02','624.06') AND dc.LunaContabila='${period}')
      GROUP BY UPPER(LTRIM(RTRIM(d.Denumire)))`),
    run(`SELECT p.Cont cont,dc.SubiectDenumire subject,SUM(CASE WHEN dc.IsDebit=1 THEN CAST(dc.Valoare_Rol AS float) ELSE -CAST(dc.Valoare_Rol AS float) END) total FROM dbo.C_H_Note_Contabile_Detalii_Conturi dc WITH (NOLOCK) JOIN dbo.C_Plan_Contabil p WITH (NOLOCK) ON p.Analitic_ID=dc.AnaliticId JOIN dbo.C_H_Note_Contabile h WITH (NOLOCK) ON h.H_ID=dc.H_ID JOIN dbo.C_Tipuri_Document t WITH (NOLOCK) ON t.Tip_Document_ID=h.Tip_Document_ID WHERE p.Cont IN ('624.01','624.02','624.03','624.06') AND dc.LunaContabila='${period}' AND t.Cod<>'NCICV' AND ISNULL(h.Anulat,0)=0 GROUP BY p.Cont,dc.SubiectDenumire`),
  ]);
  return { conversion, points, trips, costs };
}
