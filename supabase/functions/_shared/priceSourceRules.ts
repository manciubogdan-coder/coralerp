/** Audited Senior custom packaging relation: Coef for selling-unit 28 is pieces/pallet,
 * regardless of UM_ID_Corespondent (which is PALET on the audited article). */
export const PALLET_RELATION = `SELECT Articol_ID,MIN(CAST(Coef AS float)) coef FROM dbo.D_Articole_UM_Relatii WITH (NOLOCK) WHERE Articol_UM_Vanzare_ID=28 AND Coef>0 GROUP BY Articol_ID HAVING MIN(Coef)=MAX(Coef)`;
export function transportRoute(subject: string): string | null {
  const s = subject.trim().toUpperCase();
  if (s === 'TRANSPORT DIST BULGARIA') return 'Bulgaria';
  if (s === 'TRANSPORT DIST MOLDOVA ICS') return 'Moldova';
  if (/^TRANSPORT DIST (BUCURESTI|CRAIOVA|FOCSANI|HORECA|LUGOJ|PLOIESTI|ROMAN|TIMISOARA|TURDA|TURDA-IERNUT)$/.test(s)) return 'România';
  return null;
}
export function historicalFeePct(discounts: number, sales: number): number | null {
  return sales > 0 && discounts >= 0 && discounts < sales ? discounts / sales * 100 : null;
}
export function configuredRawPalletKg(name: string): number | undefined {
  if (/radic|radich/i.test(name)) return 500;
  if (/iceberg|pan di|indivi|scarola/i.test(name)) return 400;
  if (/spanac|rucola|valerian|latuga|salat|baby|mizuna|tsatsoi|blood|busuioc|marar|patrunjel|menta|cimbru|coriandru|rozmarin|oregano|tarhon|chivas/i.test(name)) return 220;
  return undefined;
}