## Problemă

Când modifici o recepție în "Istoric recepții", se salvează corect în `reception_records` și se scrie audit log, dar tabelul Recepție din **Calitate** și **Evidență Documente** rămâne neschimbat.

Motivul: aceste tabele se construiesc din tabela `inventory` (respectiv `ambalaje_inventory` / `etichete_inventory`), folosind în principal câmpurile `original_quantity` și `supplier_name`. În `handleSaveEdit`:
- se actualizează `quantity` în inventar, dar **nu** și `original_quantity` (ăsta e folosit la raport)
- **nu** se actualizează `supplier_name` (câmpul denormalizat afișat la grupare)
- match-ul pe `entry_number` poate eșua silențios (doar `console.warn`), deci pare că a mers chiar dacă n-a făcut nimic

## Soluție

În `src/components/inventory/ReceptionHistory.tsx` → `handleSaveEdit`:

1. **Extinde update-ul pe inventar** ca să sincronizeze toate câmpurile afișate în Recepție/Evidență Documente:
   - `original_quantity` = noua cantitate (pe lângă `quantity`)
   - `supplier_name` = numele furnizorului nou (rezolvat din `suppliersList` pe baza `supplier_id`)
   - restul rămân (`name`, `unit`, `document_number`, `lot_number`, `receipt_date`, `supplier_id`, `manufacturer_id`, `product_id`)

2. **Match mai robust pe inventar**: în loc de doar `entry_number`, încearcă întâi după `reception_record_id`/`reception_id` dacă există, apoi fallback pe `entry_number`. Dacă tot nu găsește, încearcă după combinația `lot_number + document_number + receipt_date` originală.

3. **Notifică vizibil** când inventarul nu poate fi actualizat (toast warning), în loc de console.warn tăcut, ca utilizatorul să știe dacă raportul nu se va sincroniza.

4. **Re-fetch** rămâne la fel după save.

## Note tehnice

- Nu se atinge logica de audit log — funcționează deja.
- Nu se modifică schema; toate câmpurile există deja pe `inventory` / `ambalaje_inventory` / `etichete_inventory`.
- Modificarea e izolată la o singură funcție într-un singur fișier.