## Problem
Comenzile din Senior se pot modifica după ce în Coral au fost deja `assigned`/`in_progress`/`completed`. Momentan:
- La update, dacă rândul există, doar `UPDATE cantitate` — dar dacă e deja făcut mai mult decât cere Senior acum, apare "făcut prea mult" fără restocare.
- La ștergere, sărim rândurile non-pending complet — deci suplimentările care apar ca linie separată nu se procesează bine, iar tăierile la 0 rămân "fantomă" pe linie.

Regulă cerută:
1. Senior nu are comenzi fără client → deja tratat prin `INNER JOIN` + skip.
2. Modificările din Senior trebuie propagate SIEMPRE, chiar dacă în Coral comanda e `assigned/in_progress/completed`.
3. **Cantitate crescută** (Senior > Coral): diferența trebuie să apară din nou de făcut pe linie.
4. **Cantitate scăzută** (Senior < Coral): ce s-a produs în plus trece în **restocată**.
5. Linie ștearsă în Senior (există în Coral, non-pending): tot ce s-a produs devine restocată.

## Modificări în `supabase/functions/ingest-erp-orders/index.ts`

### A. Logica de UPSERT pe linie existentă (`if (existing)`)

Extindem `select` să includă și `cantitate_facuta` (sau echivalent — verific numele real după intrarea în build). Presupunem `cantitate_facuta` (câmpul urmărit de picking/producție).

Cazuri după update:

```text
delta = cantitate_noua - cantitate_veche

daca status = 'pending':
  → doar UPDATE cantitate, magazin, data (cum e acum)

daca status ∈ ('assigned','in_progress','completed'):
  cantitate_facuta = cât s-a produs deja (0 dacă lipsește)

  daca delta > 0  (suplimentare):
    UPDATE cantitate = cantitate_noua
    daca status = 'completed':
      status ← 'assigned' (redeschidem; picking-ul vede diferența rămasă)
    // cantitate_facuta rămâne intactă; UI arată "rămas = cantitate - cantitate_facuta"

  daca delta < 0  (redusă):
    excedent = max(0, cantitate_facuta - cantitate_noua)
    UPDATE cantitate = cantitate_noua, cantitate_facuta = min(cantitate_facuta, cantitate_noua)
    daca excedent > 0:
      INSERT productie_restocari(produs_id, cantitate_surplus, status='disponibil',
                                 sursa='senior-update', comanda_id, created_at=now)
    daca cantitate_noua ≤ cantitate_facuta:
      status ← 'completed'
    altfel daca status = 'completed':
      status ← 'assigned'

  daca doar magazin/data s-a schimbat:
    UPDATE ca acum
```

### B. Logica de ștergere linie dispărută din Senior

Actualizăm blocul `toDelete`:

```text
pentru fiecare linie existentă pentru aviz care nu mai e în currentKeys:
  daca status = 'pending':
    DELETE (comportament actual)
  altfel:
    cantitate_facuta_ok = cât s-a produs (>=0)
    daca cantitate_facuta_ok > 0:
      INSERT productie_restocari(produs_id, cantitate_surplus=cantitate_facuta_ok,
                                 status='disponibil', sursa='senior-delete')
    UPDATE comanda: cantitate = 0, status = 'canceled_by_erp' (sau 'completed' cu flag),
                    observatie += "Șters din Senior — X kg mutat pe restocată"
    // nu ștergem rândul ca să păstrăm istoricul
```

Rămâne de confirmat cu tine: **preferi `status='canceled_by_erp'` sau păstrăm `completed` + marcăm în observație?** (implicit propun `canceled_by_erp` ca status nou, ca să nu polueze rapoartele de "finalizat").

### C. Log & răspuns

Adaug în răspuns și în `erp_import_log`:
- `linii_suplimentate` (delta > 0 pe non-pending)
- `linii_reduse_restock` (delta < 0 cu excedent → kg restocate)
- `linii_anulate` (dispărute cu producție deja făcută)

## Puncte de verificat înainte să scriu codul
1. Numele exact al coloanei de cantitate produsă pe `productie_comenzi` (`cantitate_facuta` / `cantitate_picking` / alt câmp). O verific la începutul turei de build.
2. Structura `productie_restocari` — câmpuri obligatorii (comanda_id? linie_id? sursa?). Se aliniază cu logica existentă din edge function (folosim aceeași structură ca la alocarea din restock).
3. Statusul `canceled_by_erp` — dacă preferi să reutilizez unul existent (`canceled`?), spune-mi.

## Impact frontend
Zero modificări obligatorii. `OrderManagementReal` deja arată `cantitate` vs `cantitate_facuta`, deci un `status='assigned'` reapărut cu delta pozitiv o să iasă natural pe linie ca "de făcut". Dacă vrei semnalizare vizuală ("modificat din Senior după alocare"), pot adăuga un badge separat — spune dacă îl vrei.

## Ce NU se schimbă
- Bridge-ul rămâne cum e (fereastră mobilă, INNER JOIN pe partener).
- Comenzile pending funcționează la fel.
- Restocările deja consumate la INSERT rămân cum sunt.
