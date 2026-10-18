# Citire directă din Senior + rapoarte salvate în Cloud

## Ce se schimbă pentru tine
- **Rapoartele noi se citesc direct din Senior, în momentul în care le ceri.** Asta e valabil pentru Constructor, Asistent și Argus. Cifrele sunt la zi și nu mai copiem baza întreagă.
- **Rapoartele salvate se păstrează în Cloud împreună cu rezultatul lor.** Le găsești la „Rapoarte”, unde se deschid instant. Butonul „Actualizează” le recitește din Senior.
- **Panoul CEO și „Date comerciale” rămân rapide.** Folosesc o copie mică, doar cu tabelele esențiale: contabilitate, plan de conturi, tipuri de documente, antete de documente, parteneri și nomenclatoare mici. Copia se actualizează automat.
- **Copia completă se oprește.** Ștergem din Cloud tabelele mari care nu sunt folosite (aproximativ 20 GB), ca baza să nu se mai blocheze. Datele rămân neatinse în Senior.

## Cum funcționează
```text
Aplicația ──cere raport──> Cloud (coadă de cereri)
                               ^            |
Program pe serverul Senior ────┘ ia cererea, rulează SELECT read-only,
                                 trimite rezultatul înapoi
Aplicația <──rezultat (câteva secunde)── Cloud
```
Programul de pe server se conectează doar spre exterior, deci nu trebuie deschise porturi în firmă. Cât timp serverul e pornit, rapoartele merg.

## Pași
1. **Coada de cereri în Cloud.** Facem un tabel la care are acces doar serverul, cu cererea, starea, rezultatul și eroarea. Cererile vechi se curăță automat.
2. **Funcția Cloud `erp-mirror`, acțiuni noi:**
   - pentru aplicație: `live_query`, care pune cererea în coadă și așteaptă rezultatul cel mult 30 de secunde;
   - pentru programul de pe server: `live_pull` (ia cererile în așteptare) și `live_result` (trimite rezultatul).
3. **Programul de pe server, versiunea 2.0:**
   - Un mod live care întreabă coada la fiecare secundă.
   - Construiește interogările doar din tabele și coloane verificate în dicționarul Senior. Rulează doar SELECT, cu NOLOCK, cu limită de rânduri și de timp.
   - Copia rămâne doar pentru lista de tabele esențiale.
4. **Rapoarte salvate:** salvăm rezultatul și ora la care a fost calculat. Raportul se deschide instant din Cloud, iar butonul „Actualizează” îl recitește din Senior.
5. **Constructor și Asistent:** lista de tabele și coloane vine live din Senior, iar rezultatele vin prin `live_query`.
6. **Curățenie:** ștergem din copie tabelele mari care nu sunt esențiale, de exemplu `c_h_note_contabile_detalii_conturi` (7 GB), `c_d_note_contabile` (4,5 GB), `c_d_note_contabile_gestiuni`, `centrevcvalori` și tabelele `containers__*`. Pagina „Oglindire Senior ERP” va afișa doar tabelele esențiale și starea programului live.

## Detalii tehnice
- Tabelul nou `erp_mirror._live_requests` stă în schema privată și e accesibil doar prin funcții SECURITY DEFINER, numai pentru service_role.
- Sunt permise doar trei tipuri de cereri: `catalog`, `aggregate` și `browse`, cu parametri validați. Nu primim SQL scris liber.
- Rezultatele sunt limitate la 5.000 de rânduri. Interogarea în Senior are un timeout de 25 de secunde.
- Tabelul `_reports` primește coloanele `result jsonb` și `refreshed_at`.
- Lista de tabele esențiale stă într-un singur loc în script (INCLUDE_TABLES implicit).
- Tabelele șterse dispar și din `_tables`.
- Regula de arhitectură se actualizează în AGENTS.md: citire live pentru rapoarte, copie doar pentru tabelele esențiale.
