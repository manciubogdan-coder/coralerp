import { seniorLive } from './senior.ts';
import { readAll } from './productRecipes.ts';
import { packagingStoreKey, packagingUnits } from './packagingRules.ts';

// Verified live: CodArticol is a document D_ID, NOT an article Articol_ID.
export function seniorPackagingSql(codes: string[], page: number) {
  const literals = codes.map(c => `N'${c.replace(/'/g, "''")}'`).join(',');
  return `SELECT code,store_id,store_name,units,document_date FROM (
    SELECT d.Cod AS code, pp.Partener_ID AS store_id, pp.Partener_Denumire AS store_name,
      b.ContinutBAX AS units, CONVERT(char(10),h.Data,120) AS document_date,
      ROW_NUMBER() OVER(PARTITION BY d.Cod,pp.Partener_ID ORDER BY h.Data DESC,d.D_ID DESC,b.Id DESC) AS rn
    FROM extensions.CT_CantitateBAX b WITH (NOLOCK)
    JOIN dbo.C_D_Note_Contabile d WITH (NOLOCK) ON d.D_ID=b.CodArticol
    JOIN dbo.C_H_Note_Contabile h WITH (NOLOCK) ON h.H_ID=d.H_ID
    JOIN dbo.C_H_Note_Contabile_Parteneri pp WITH (NOLOCK) ON pp.H_ID=h.H_ID
    WHERE ISNULL(h.Anulat,0)=0 AND h.Data>=DATEADD(year,-2,GETDATE())
      AND d.Cod IN (${literals}) AND NULLIF(LTRIM(RTRIM(b.ContinutBAX)),'') IS NOT NULL
  ) q WHERE rn=1 ORDER BY code,store_id OFFSET ${page * 500} ROWS FETCH NEXT 500 ROWS ONLY`;
}

export async function syncSeniorPackaging(legacy: any, cloud: any, productId: string) {
  const mappings = await readAll(legacy, 'erp_mapping_produse', 'produs_id,cod_extern');
  const codes = [...new Set(mappings.filter((r: any) => r.produs_id === productId).map((r: any) => String(r.cod_extern).trim()))] as string[];
  if (!codes.length) throw new Error('Produsul nu are cod Senior asociat.');
  const stores = await readAll(legacy, 'erp_mapping_magazine', 'cod_extern,nume_magazin');
  const storeNames = new Map(stores.map((r: any) => [String(r.cod_extern), String(r.nume_magazin)]));
  const entries = new Map<string, any>();
  for (let off = 0; off < codes.length; off += 50) {
    let page = 0;
    while (true) {
      const result = await seniorLive(cloud, 'sql', { sql: seniorPackagingSql(codes.slice(off, off + 50), page) }, 45000);
      if (!Array.isArray(result)) throw new Error('Răspuns Senior invalid.');
      for (const row of result) {
        const units = packagingUnits(row.units);
        if (!units) continue;
        const store = String(storeNames.get(String(row.store_id)) ?? row.store_name);
        const key = packagingStoreKey(store);
        const previous = entries.get(key);
        if (previous && previous.senior_date === row.document_date && previous.senior_units !== units) throw new Error(`Baxări Senior diferite pentru ${store}; verifică maparea codurilor.`);
        if (previous && previous.senior_date > row.document_date) continue;
        entries.set(key, { produs_id: productId, magazin_key: key, magazin: store, senior_units: units, senior_code: row.code, senior_date: row.document_date, synced_at: new Date().toISOString() });
      }
      if (result.length < 500) break;
      page++;
    }
  }
  if (entries.size) {
    // Omit manual_units so a refresh never overwrites a local correction.
    const { error } = await cloud.from('productie_baxare_magazine').upsert([...entries.values()], { onConflict: 'produs_id,magazin_key' });
    if (error) throw error;
  }
  return { count: entries.size };
}