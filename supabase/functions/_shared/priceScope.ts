// Sales scope of the price calculator: one store, or every store of a central partner, as literal SQL predicates.
export type PartnerInfo = { cf: string | null; central: string | null } | null;
export const lit = (s: string) => `N'${s.replace(/'/g, "''")}'`;
/** Normalized fiscal code (CUI) of a document partner row. */
export const cf = (a: string) => `NULLIF(REPLACE(UPPER(LTRIM(RTRIM(${a}.Partener_Cod_Fiscal))),'RO',''),'')`;
/** One cheap read of the partner's latest fiscal code and Senior "Partener_Central" text. */
export const partnerInfoSql = (pid: number) => `SELECT (SELECT TOP 1 ${cf("x")} FROM dbo.C_H_Note_Contabile_Parteneri x WITH (NOLOCK) WHERE x.Partener_ID=${pid} AND ${cf("x")} IS NOT NULL ORDER BY x.H_ID DESC) cf,
  (SELECT TOP 1 x.Partener_Central FROM dbo.C_H_Note_Contabile_Parteneri x WITH (NOLOCK) WHERE x.Partener_ID=${pid} AND NULLIF(x.Partener_Central,'') IS NOT NULL ORDER BY x.H_ID DESC) central`;
/** Stores are grouped by fiscal code (CUI): Senior's Partener_Central text differs between stores of the same company
 * (e.g. "LIDL DISCOUNT SRL - ROMAN"). Values are inlined as literals, never per-row subqueries. */
export const partnerScope = (pid: number | null, storeId: number | null, info: PartnerInfo) => storeId ? `pp.Partener_ID=${storeId}` : !pid ? null
  : info?.cf ? `(pp.Partener_ID=${pid} OR ${cf("pp")}=${lit(info.cf)})`
  : info?.central ? `(pp.Partener_ID=${pid} OR pp.Partener_Central=${lit(info.central)})`
  : `pp.Partener_ID=${pid}`;
