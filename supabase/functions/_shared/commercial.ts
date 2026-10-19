// One bounded live query: header totals are never multiplied by partner or line joins.
export function commercialSql(start: string, end: string) {
  const validDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
  if (!validDate(start) || !validDate(end) || start > end || Number(end.slice(0, 4)) - Number(start.slice(0, 4)) > 2) throw new Error('Perioadă invalidă.');
  const docs = `SELECT h.H_ID, h.Data, CAST(h.Valoare_Rol AS decimal(28,2)) AS value,
    CASE t.Cod WHEN 'CC' THEN 'sales_orders' WHEN 'CF' THEN 'purchase_orders' WHEN 'FC' THEN 'sales_invoices' ELSE 'purchase_invoices' END AS kind
    FROM dbo.C_H_Note_Contabile h WITH (NOLOCK)
    JOIN dbo.C_Tipuri_Document t WITH (NOLOCK) ON t.Tip_Document_ID=h.Tip_Document_ID
    WHERE h.Data >= '${start}' AND h.Data < DATEADD(day,1,'${end}')
    AND ISNULL(h.Anulat,0)=0 AND t.Cod IN ('CC','CF','FC','FF','FFI')`;
  const enriched = `SELECT d.*, CASE WHEN p.partner_count=1 THEN p.partner_id END AS partner_id,
    CASE WHEN p.partner_count=1 THEN p.name END AS name FROM (${docs}) d
    OUTER APPLY (SELECT MIN(pp.Partener_ID) AS partner_id, MIN(pp.Partener_Denumire) AS name,
      COUNT(DISTINCT pp.Partener_ID) AS partner_count
      FROM dbo.C_H_Note_Contabile_Parteneri pp WITH (NOLOCK) WHERE pp.H_ID=d.H_ID) p`;
  // The installed bridge accepts SELECT, not leading WITH/CTEs.
  return `SELECT 'metric' AS section, kind, CAST(NULL AS varchar(7)) AS month, COUNT(*) AS documents,
    SUM(value) AS value, COUNT(value) AS valued_documents, COUNT(DISTINCT partner_id) AS partners,
    SUM(CASE WHEN partner_id IS NULL THEN 1 ELSE 0 END) AS unidentified_partners,
    CONVERT(varchar(10),MIN(Data),23) AS first_date, CONVERT(varchar(10),MAX(Data),23) AS last_date,
    CAST(NULL AS bigint) AS partner_id, CAST(NULL AS nvarchar(500)) AS name, CAST(NULL AS bigint) AS rank
    FROM (${enriched}) e GROUP BY kind
    UNION ALL
    SELECT 'monthly', kind, CONVERT(varchar(7),Data,120), COUNT(*), SUM(value), NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
    FROM (${docs}) d GROUP BY kind, CONVERT(varchar(7),Data,120)
    UNION ALL
    SELECT 'ranking', kind, NULL, documents, value, NULL, NULL, NULL, NULL, NULL, partner_id, name, rank
    FROM (SELECT kind, partner_id, MAX(name) AS name, COUNT(*) AS documents, SUM(value) AS value,
      ROW_NUMBER() OVER (PARTITION BY kind ORDER BY SUM(value) DESC, partner_id) AS rank
      FROM (${enriched}) e WHERE partner_id IS NOT NULL AND kind IN ('sales_invoices','purchase_invoices')
      GROUP BY kind, partner_id) r WHERE rank<=10`;
}

export function commercialSummary(rows: unknown, start: string, end: string) {
  if (!Array.isArray(rows) || rows.length >= 500) throw new Error('Răspunsul Senior este incomplet. Restrânge perioada și reîncearcă.');
  const metrics: Record<string, unknown> = {};
  const monthly: Record<string, any>[] = [];
  const rankings: Record<string, any>[] = [];
  for (const row of rows) {
    if (!row || !['metric', 'monthly', 'ranking'].includes(row.section)) throw new Error('Răspuns comercial Senior invalid.');
    const { section, ...r } = row;
    if (section === 'metric') metrics[r.kind] = r;
    else if (section === 'monthly') monthly.push(r);
    else rankings.push(r);
  }
  monthly.sort((a, b) => a.month.localeCompare(b.month) || a.kind.localeCompare(b.kind));
  rankings.sort((a, b) => a.kind.localeCompare(b.kind) || a.rank - b.rank);
  const fetched_at = new Date().toISOString();
  return { available: true, partial: false, live: true, fetched_at, start, end, metrics, monthly, rankings,
    sources: ['c_h_note_contabile', 'c_tipuri_document', 'c_h_note_contabile_parteneri'].map(table => ({ table, synced_at: null, error: null, complete: true })) };
}