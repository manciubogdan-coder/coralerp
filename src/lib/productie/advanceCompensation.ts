type CompensationOrder = { data_productie?: string | null; created_at: string };

const dayOf = (order: CompensationOrder) => String(order.data_productie || order.created_at).slice(0, 10);

// Un avans este un plan pentru cererea din ziua pentru care e planificat.
// - Avansul generat AUTOMAT (cron/matrice) este o estimare: se reduce cu orice
//   comandă fermă din aceeași zi, indiferent când a fost importată comanda
//   (Senior poate crea comenzile ferme înainte de generarea avansului).
// - Avansul adăugat MANUAL este o decizie deliberată de a produce în plus:
//   comenzile ferme deja existente nu trebuie să îl șteargă; îl reduc doar
//   comenzile ferme create STRICT DUPĂ el.
export function canCompensateAdvance(
  advance: CompensationOrder,
  firm: CompensationOrder,
  advanceIsAuto = false,
): boolean {
  if (dayOf(advance) !== dayOf(firm)) return false;
  if (advanceIsAuto) return true;
  const advanceTime = Date.parse(advance.created_at);
  const firmTime = Date.parse(firm.created_at);
  return Number.isFinite(advanceTime) && Number.isFinite(firmTime) && firmTime > advanceTime;
}
