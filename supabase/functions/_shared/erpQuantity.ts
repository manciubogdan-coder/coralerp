/**
 * Decide cantitatea planificată a unei linii de comandă importată din Senior ERP.
 *
 * Regula de bază: „Acceptat" (Cantitate_Disponibila) are prioritate; dacă lipsește,
 * folosim cantitatea comandată.
 *
 * Excepție pentru comenzi deja importate: dacă „Acceptat" e identic cu ce avem
 * stocat, dar cantitatea comandată s-a schimbat, înseamnă că editarea s-a făcut
 * pe „Cantitate" și „Acceptat" a rămas vechi — urmăm cantitatea comandată,
 * altfel modificarea din Senior nu s-ar propaga în aplicație.
 */
export function plannedQuantity(
  cantitateComandata: number,
  cantitateAcceptata: number | null | undefined,
  storedCantitate?: number | null
): number {
  const acceptata =
    cantitateAcceptata != null && Number.isFinite(Number(cantitateAcceptata))
      ? Number(cantitateAcceptata)
      : NaN;

  if (Number.isFinite(acceptata) && acceptata > 0) {
    if (
      storedCantitate != null &&
      Math.abs(acceptata - storedCantitate) < 0.0001 &&
      Math.abs(cantitateComandata - storedCantitate) > 0.0001
    ) {
      return cantitateComandata;
    }
    return acceptata;
  }
  return cantitateComandata;
}
