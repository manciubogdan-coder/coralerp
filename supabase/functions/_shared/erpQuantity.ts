/**
 * Decide cantitatea planificată a unei linii de comandă importată din Senior ERP.
 *
 * Regula: „Acceptat" (Cantitate_Disponibila) are prioritate; dacă lipsește sau e 0,
 * folosim cantitatea comandată. La reimport, orice schimbare a acestor câmpuri în
 * Senior se propagă prin comparația cu cantitatea stocată (făcută de apelant).
 *
 * Notă: dacă în Senior se modifică doar „Cantitate" dar „Acceptat" rămâne completat
 * cu valoarea veche, valoarea confirmată (Acceptat) câștigă — este cantitatea
 * angajată față de client. Pentru ca modificarea să se propage, se actualizează
 * și „Acceptat" în Senior.
 */
export function plannedQuantity(
  cantitateComandata: number,
  cantitateAcceptata: number | null | undefined
): number {
  const acceptata =
    cantitateAcceptata != null && Number.isFinite(Number(cantitateAcceptata))
      ? Number(cantitateAcceptata)
      : NaN;

  if (Number.isFinite(acceptata) && acceptata > 0) return acceptata;
  return cantitateComandata;
}
