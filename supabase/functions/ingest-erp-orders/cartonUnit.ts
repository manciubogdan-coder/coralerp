/** Senior UM_ID=1 is BUC (verified against D_Articole_UM).
 * Other numeric IDs must be resolved by the bridge, never guessed.
 */
export function cartonNameUnit(um?: string | null): 'bax' | 'buc' {
  const unit = String(um ?? '').trim().toLowerCase();
  if (unit === '1' || /^(buc|piece)/.test(unit)) return 'buc';
  if (!unit || /^(bax|col|cut|cart|box)/.test(unit)) return 'bax';
  throw new Error(`Unitatea ${um} nu este compatibilă cu un bax mixt.`);
}