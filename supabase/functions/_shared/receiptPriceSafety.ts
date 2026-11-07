import { priceSafety, type PriceSafety } from './priceSafetyRules.ts';
export { priceSafety } from './priceSafetyRules.ts';

/** Same article and NIR unit; latest row excluded, calendar six months ending at that entry. */
export function safetySql(articleIds: number[], endDay: string) {
  if (!articleIds.length || articleIds.some(id => !Number.isInteger(id) || id <= 0) || !/^\d{4}-\d{2}-\d{2}$/.test(endDay)) throw new Error('Articol/perioadă invalidă.');
  const entries = `
    SELECT d.Articol_ID id, d.UM_ID unitId, um.Cod unit, h.Data day, h.H_ID documentId, d.D_ID lineId,
      CAST(d.Cantitate AS float) q, CAST(d.Valoare_Neta_Rol AS float) v,
      ROW_NUMBER() OVER(PARTITION BY d.Articol_ID ORDER BY h.Data DESC,h.H_ID DESC,d.D_ID DESC) rn
    FROM dbo.C_H_Note_Contabile h WITH (NOLOCK)
    JOIN dbo.C_Tipuri_Document t WITH (NOLOCK) ON t.Tip_Document_ID=h.Tip_Document_ID
    JOIN dbo.C_D_Note_Contabile d WITH (NOLOCK) ON d.H_ID=h.H_ID
    LEFT JOIN dbo.D_Articole_UM um WITH (NOLOCK) ON um.UM_ID=d.UM_ID
    WHERE t.Cod='NIR' AND ISNULL(h.Anulat,0)=0 AND d.Articol_ID IN (${articleIds.join(',')})
      AND d.Cantitate>0 AND h.Data<'${endDay}' AND h.Data>=DATEADD(year,-3,'${endDay}')
  `;
  return `SELECT l.id, l.v/NULLIF(l.q,0) latestPrice, l.unit, CONVERT(char(10),l.day,120) day,
    l.documentId, CONVERT(char(10),DATEADD(month,-6,l.day),120) historyStart,
    SUM(p.v)/NULLIF(SUM(p.q),0) averagePrice, COUNT(p.lineId) historyCount
    FROM (${entries}) l LEFT JOIN (${entries}) p ON p.id=l.id AND p.unitId=l.unitId AND p.rn<>1
      AND p.day>=DATEADD(month,-6,l.day) AND (p.day<l.day OR (p.day=l.day AND
        (p.documentId<l.documentId OR (p.documentId=l.documentId AND p.lineId<l.lineId))))
    WHERE l.rn=1 GROUP BY l.id,l.v,l.q,l.unit,l.day,l.documentId`;
}

export async function readPriceSafety(sb: any, articleIds: number[], endDay: string): Promise<Map<number, PriceSafety>> {
  if (!articleIds.length) return new Map();
  const { seniorLive } = await import('./senior.ts');
  const rows = await seniorLive(sb, 'sql', { sql: safetySql(articleIds, endDay) }, 55000);
  if (!Array.isArray(rows)) throw new Error('Răspuns Senior invalid pentru verificarea prețului.');
  return new Map(rows.map((r: any) => [Number(r.id), priceSafety({
    latestPrice: Number(r.latestPrice), averagePrice: r.averagePrice == null ? null : Number(r.averagePrice),
    historyCount: Number(r.historyCount), unit: String(r.unit ?? ''), day: String(r.day),
    documentId: Number(r.documentId), historyStart: String(r.historyStart),
  })]));
}

/** Exact code preferred; exact name only as fallback. Never borrow another article's price. */
export async function receptionPriceSafety(sb: any, body: { code?: unknown; name?: unknown }) {
  const { seniorLive } = await import('./senior.ts');
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if ((!code && !name) || code.length > 100 || name.length > 300) throw new Error('Selectează produsul.');
  const escaped = (s: string) => s.replace(/'/g, "''");
  const rows = await seniorLive(sb, 'sql', { sql: `SELECT TOP 2 Articol_ID id FROM dbo.D_Articole WITH (NOLOCK) WHERE ${code ? `Cod=N'${escaped(code)}'` : `Denumire=N'${escaped(name)}'`}` }, 30000);
  if (!Array.isArray(rows) || rows.length !== 1) return { safety: null, reason: 'Produsul nu are o asociere unică în Senior; verificarea prețului nu este disponibilă.' };
  const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Europe/Bucharest' });
  const result = await readPriceSafety(sb, [Number(rows[0].id)], tomorrow);
  return { safety: result.get(Number(rows[0].id)) ?? null, reason: 'Nu există intrări NIR pentru produsul selectat.' };
}