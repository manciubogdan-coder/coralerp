import { seniorSqlAll } from "./senior.ts";
import { recipeChecks, type BaxRow, type RecipeRow } from "./recipeCaseRules.ts";

type Rpc = { rpc: (fn: string, args?: Record<string, unknown>) => any };

/** Every active Senior recipe, paged past the reader's 500-row cap, checked with recipeChecks. */
export async function recipeCaseAudit(sb: Rpc) {
  const [rows, bax] = await Promise.all([
    seniorSqlAll(sb, `SELECT v.ArticolId pa, p.Cod pcode, p.Denumire pname, v.PKArticoleCompuseHVersiuni vid, CAST(v.Cantitate AS float) vq, CAST(v.IsImplicit AS int) impl,
        CONVERT(char(10),v.DataStart,120) ds, d.ArticolId id, a.Denumire name, CAST(d.Cantitate AS float) q, um.Cod um
      FROM dbo.DArticoleCompuseHVersiuni v WITH (NOLOCK) JOIN dbo.DArticoleCompuseD d WITH (NOLOCK) ON d.FKArticoleCompuseHVersiuni=v.PKArticoleCompuseHVersiuni
      JOIN dbo.D_Articole p WITH (NOLOCK) ON p.Articol_ID=v.ArticolId JOIN dbo.D_Articole a WITH (NOLOCK) ON a.Articol_ID=d.ArticolId
      LEFT JOIN dbo.D_Articole_UM um WITH (NOLOCK) ON um.UM_ID=d.UMId
      WHERE v.IsActiv=1 AND d.ArticolId<>v.ArticolId AND ISNULL(d.IsProdusPrincipal,0)=0`, "v.PKArticoleCompuseHVersiuni, d.ArticolId, d.Cantitate"),
    seniorSqlAll(sb, `SELECT d.Articol_ID aid, LTRIM(RTRIM(CAST(b.ContinutBAX AS nvarchar(50)))) units, COUNT(*) lines
      FROM extensions.CT_CantitateBAX b WITH (NOLOCK) JOIN dbo.C_D_Note_Contabile d WITH (NOLOCK) ON d.D_ID=b.CodArticol
      JOIN dbo.C_H_Note_Contabile h WITH (NOLOCK) ON h.H_ID=d.H_ID
      WHERE ISNULL(h.Anulat,0)=0 AND h.Data>=DATEADD(month,-12,GETDATE())
      GROUP BY d.Articol_ID, LTRIM(RTRIM(CAST(b.ContinutBAX AS nvarchar(50))))`, "1, 2"),
  ]);
  const all = recipeChecks(rows as RecipeRow[], bax as BaxRow[]);
  return { checked: all.length, issues: all.filter((c) => c.status !== "ok"), all };
}
