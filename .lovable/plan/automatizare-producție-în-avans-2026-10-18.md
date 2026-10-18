# Automatizare Producție în Avans

## Ce se construiește

În ecranul **Producție → Producție în Avans** (`AdvanceProductionManagement`):

### 1. Buton „⚡ Generează Producție în Avans"
- Alegi ziua țintă (implicit: ziua următoare).
- Sistemul propune grila de produse din două surse, în această ordine:
  1. **Matricea pe zile ale săptămânii** (vezi punctul 4) — dacă are rânduri pentru ziua respectivă;
  2. **Istoricul real**: media cantităților din comenzile `PRODUCTIE_AVANS` din aceeași zi a săptămânii, ultimele 8 săptămâni (rotunjit la bax/multiplu cunoscut).
- Se deschide un dialog cu grila editabilă (produs, cantitate, linie, baxare) — poți modifica, șterge sau adăuga rânduri.
- La „Confirmă" se creează toate comenzile dintr-o singură operație, cu `tip_comanda = PRODUCTIE_AVANS`, `data_productie` = ziua țintă, status `assigned`/`pending` — exact ca la șabloanele existente (`useCreateAdvanceOrdersBulk`).

### 2. Comutator ON/OFF „Generare automată zilnică (16:50)"
- Setare vizibilă în același ecran, cu stare Activ/Inactiv.
- Când e **Activ**, un job programat zilnic la **16:50 (ora României)** generează automat comenzile pentru ziua următoare, pe baza matricei/istoricului.
- Când e **Inactiv**, funcționează doar butonul manual. Poți comuta oricând înapoi.
- Dacă pentru ziua țintă există deja comenzi de avans generate automat, jobul nu le dublează.

### 3. Jurnal de activitate
- Fiecare generare (manuală sau automată) se înscrie într-un jurnal: data, ziua țintă, număr de comenzi, cine/ce a generat (utilizator sau „automat"), eventuale erori.
- Jurnalul e vizibil într-un tab „Jurnal" în același ecran; revenirea la manual se face oricând din comutator.

### 4. Matricea de bază pe zile ale săptămânii
- Tab nou „Matrice săptămânală": pentru fiecare zi (Luni–Duminică) lista de produse cu cantitate tipică, linie și baxare — pre-populată din atașament (Busuioc 30g 800–1000 buc, Mentă 30g 700–800, Chivas, Coriandru, Rozmarin, Cimbru, Salvie, Oregano, Tarhon, variante 100g/250g/500g Gastro etc.) și complet editabilă (adăugare/modificare/ștergere rânduri).
- Aceasta e sursa principală a generatorului; istoricul e fallback.

## Detalii tehnice

- **Baze de date**: comenzile de producție stau în baza operațională (legacy); configurația automatizării (setare ON/OFF, matrice, jurnal) stă în Lovable Cloud în tabele noi:
  - `productie_avans_settings` (o singură linie: `auto_enabled`, `run_hour`),
  - `productie_avans_matrix` (`weekday` 0–6, `produs_nume`, `produs_id`, `cantitate`, `linie_nume`, `baxare`, `position`),
  - `productie_avans_log` (`target_date`, `orders_created`, `source` manual/auto, `created_by_email`, `details jsonb`, `error`).
  Toate cu RLS + GRANT (citire pentru utilizatori autentificați, scriere prin funcția edge / service role pentru jurnalul automat).
- **Funcție edge nouă** `productie-avans-auto` (Cloud): citește setarea; dacă e activă, calculează ziua următoare, construiește grila din matrice (fallback istoric citit din baza operațională cu cheia publică), verifică anti-duplicat, inserează comenzile în `productie_comenzi` și scrie în jurnal. Am testat deja că scrierea automată în baza operațională funcționează.
- **Programare**: `pg_cron` în Cloud la 13:50 UTC (16:50 România, ora de iarnă) care apelează funcția — același tipar ca la snapshotul zilnic existent. Proiectul nu are sistemul nou de programare gestionată, deci folosim varianta existentă în proiect.
- **Frontend**: buton + dialog grilă editabilă + comutator + taburi „Matrice săptămânală" și „Jurnal" în `AdvanceProductionManagement.tsx`; hook nou `useAdvanceAutomation.ts`.
- Cod existent reutilizat: `useCreateAdvanceOrdersBulk` (insert în masă), `useProducts`, `productie_linii`, tiparul din `SabloaneProductieAvans`.

## Limite cunoscute
- Ora de vară: 13:50 UTC = 16:50 ora României iarna; vara va rula la 16:50 tot ora României doar dacă ajustăm cron-ul la schimbarea orei (menționat în jurnal; alternativ îl setăm fix pe 13:50 UTC și acceptăm 16:50/17:50).
