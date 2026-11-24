/**
 * Decide cantitatea planificată a unei linii de comandă importată din Senior ERP.
 *
 * Regula: numai „Acceptat" (Cantitate_Disponibila) definește planul.
 * Lipsă, zero sau invalid = fără cerere de produs, niciodată cantitatea comandată.
 * La fiecare reimport acceptata se compară cu planul stocat (de apelant).
 *
 * Notă: dacă în Senior se modifică doar „Cantitate" dar „Acceptat" rămâne completat
 * cu valoarea veche, valoarea confirmată (Acceptat) câștigă — este cantitatea
 * angajată față de client. Pentru ca modificarea să se propage, se actualizează
 * și „Acceptat" în Senior.
 */
export function plannedQuantity(
  _cantitateComandata: number,
  cantitateAcceptata: number | null | undefined
): number {
  const acceptata =
    cantitateAcceptata != null && Number.isFinite(Number(cantitateAcceptata))
      ? Number(cantitateAcceptata)
      : NaN;

  if (Number.isFinite(acceptata) && acceptata > 0) return acceptata;
  return 0;
}
