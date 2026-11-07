import { seniorLive } from "./senior.ts";

export async function priceLogistics(sb: any, aid: number, start: string, end: string, period: number) {
  const run = async (sql: string) => { const r = await seniorLive(sb, "sql", { sql }, 55000); return Array.isArray(r) ? r : []; };
  // Coef is the quantity of the corresponding base UM in one pallet (UM_Vanzare=28).
  // Reject conflicting coefficients instead of selecting an arbitrary packaging definition.
  const relation = `SELECT Articol_ID,UM_ID_Corespondent,MIN(CAST(Coef AS float)) coef FROM dbo.D_Articole_UM_Relatii WITH (NOLOCK)
    WHERE Articol_UM_Vanzare_ID=28 AND Coef>0 GROUP BY Articol_ID,UM_ID_Corespondent HAVING MIN(Coef)=MAX(Coef)`;
  const [conversion, pallets, costs] = await Promise.all([
    run(`SELECT r.Articol_ID id,um.Cod unit,MIN(CAST(r.Coef AS float)) coef FROM dbo.D_Articole_UM_Relatii r WITH (NOLOCK) JOIN dbo.D_Articole_UM um WITH (NOLOCK) ON um.UM_ID=r.UM_ID_Corespondent WHERE r.Articol_ID=${aid} AND r.Articol_UM_Vanzare_ID=28 AND r.Coef>0 GROUP BY r.Articol_ID,um.Cod HAVING MIN(r.Coef)=MAX(r.Coef)`),
    run(`SELECT q.doc,q.route,SUM(q.pallets) pallets,SUM(q.missing) missing FROM (
      SELECT t.Cod doc,CASE WHEN country.name LIKE N'%Bulg%' THEN N'Bulgaria' WHEN country.name LIKE N'%Mold%' THEN N'Moldova' WHEN country.name LIKE N'%Rom%' THEN N'România' ELSE N'Necunoscut' END route,
      CAST(d.Cantitate AS float)/r.coef pallets,CASE WHEN r.coef IS NULL AND d.Cantitate<>0 THEN 1 ELSE 0 END missing
      FROM dbo.C_H_Note_Contabile h WITH (NOLOCK) JOIN dbo.C_Tipuri_Document t WITH (NOLOCK) ON t.Tip_Document_ID=h.Tip_Document_ID JOIN dbo.C_D_Note_Contabile d WITH (NOLOCK) ON d.H_ID=h.H_ID
      OUTER APPLY(SELECT CASE WHEN MIN(pp.Document_Tara)=MAX(pp.Document_Tara) THEN MAX(pp.Document_Tara) END name FROM dbo.C_H_Note_Contabile_Parteneri pp WITH (NOLOCK) WHERE pp.H_ID=h.H_ID) country
      LEFT JOIN (${relation}) r ON r.Articol_ID=d.Articol_ID AND r.UM_ID_Corespondent=d.UM_ID
      WHERE t.Cod IN ('NIR','FC','FCE','FCEC') AND ISNULL(h.Anulat,0)=0 AND h.Data>='${start}' AND h.Data<'${end}') q GROUP BY q.doc,q.route`),
    run(`SELECT p.Cont cont,dc.SubiectDenumire subject,SUM(CASE WHEN dc.IsDebit=1 THEN CAST(dc.Valoare_Rol AS float) ELSE -CAST(dc.Valoare_Rol AS float) END) total FROM dbo.C_H_Note_Contabile_Detalii_Conturi dc WITH (NOLOCK) JOIN dbo.C_Plan_Contabil p WITH (NOLOCK) ON p.Analitic_ID=dc.AnaliticId JOIN dbo.C_H_Note_Contabile h WITH (NOLOCK) ON h.H_ID=dc.H_ID JOIN dbo.C_Tipuri_Document t WITH (NOLOCK) ON t.Tip_Document_ID=h.Tip_Document_ID WHERE p.Cont IN ('624.01','624.02','624.03','624.06') AND dc.LunaContabila='${period}' AND t.Cod<>'NCICV' AND ISNULL(h.Anulat,0)=0 GROUP BY p.Cont,dc.SubiectDenumire`),
  ]);
  return { conversion, pallets, costs };
}