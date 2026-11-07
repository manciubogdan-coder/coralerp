import { seniorLive } from "./senior.ts";
import { caseIssues, type CaseRow } from "./recipeCaseRules.ts";

type Rpc = { rpc: (fn: string, args?: Record<string, unknown>) => any };

export async function recipeCaseAudit(sb: Rpc) {
  const sql = `SELECT a.Articol_ID id, a.Cod code, a.Denumire name, v.vq, x.units, x.lines, x.last FROM
    (SELECT ArticolId, CAST(Cantitate AS float) vq, ROW_NUMBER() OVER(PARTITION BY ArticolId ORDER BY IsImplicit DESC, DataStart DESC) rn
      FROM dbo.DArticoleCompuseHVersiuni WITH (NOLOCK) WHERE IsActiv=1) v
    JOIN dbo.D_Articole a WITH (NOLOCK) ON a.Articol_ID=v.ArticolId
    JOIN (SELECT d.Articol_ID aid, LTRIM(RTRIM(CAST(b.ContinutBAX AS nvarchar(50)))) units, COUNT(*) lines, CONVERT(char(10),MAX(h.Data),120) last
      FROM extensions.CT_CantitateBAX b WITH (NOLOCK) JOIN dbo.C_D_Note_Contabile d WITH (NOLOCK) ON d.D_ID=b.CodArticol
      JOIN dbo.C_H_Note_Contabile h WITH (NOLOCK) ON h.H_ID=d.H_ID
      WHERE ISNULL(h.Anulat,0)=0 AND h.Data>=DATEADD(month,-12,GETDATE())
      GROUP BY d.Articol_ID, LTRIM(RTRIM(CAST(b.ContinutBAX AS nvarchar(50))))) x ON x.aid=v.ArticolId
    WHERE v.rn=1`;
  const rows = await seniorLive(sb, "sql", { sql }, 55000);
  const list = Array.isArray(rows) ? rows : [];
  return { checked: new Set(list.map((r: any) => r.id)).size, issues: caseIssues(list as CaseRow[]) };
}
