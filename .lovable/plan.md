
# Import automat comenzi din Senior ERP — Varianta B (agent local)

## Ce faci tu (utilizatorul) — foarte puțin
1. Instalezi Node.js pe PC-ul din rețeaua companiei (installer next-next-finish, îți dau linkul).
2. Dezarhivezi folderul `senior-erp-bridge/` pe care ți-l generez.
3. Deschizi fișierul `.env` și completezi 4 valori (IP, user, parolă DB, un token pe care ți-l dau eu). Îți scriu exact ce merge în fiecare rând.
4. Dublu-click pe `install-service.bat` (Windows) — se instalează ca serviciu care pornește automat cu PC-ul.
5. Deschizi în aplicație pagina „Import Senior ERP", faci mapping-ul produselor o singură dată și gata.

Restul îl fac eu.

## Ce fac eu

### 1. Migrație DB
- adaug pe `productie_comenzi` coloanele: `sursa TEXT`, `extern_nr_aviz TEXT`, `extern_data_aviz DATE`
- index unic `(sursa, extern_nr_aviz)` ca să nu se dubleze avizele
- tabelă nouă `erp_mapping_produse` (cod ERP ↔ `produs_id` intern)
- tabelă nouă `erp_import_log` (istoric rulări: câte avize, câte create, erori)
- RLS + GRANT pentru authenticated

### 2. Edge function `ingest-erp-orders`
- Primește POST cu lista de avize noi de la bridge-ul local
- Auth prin header `X-Bridge-Token` verificat față de secret `SENIOR_ERP_BRIDGE_TOKEN` (îl generez eu automat)
- Validare Zod, deduplicare pe `extern_nr_aviz`, mapping magazin după nume, mapping produs prin `erp_mapping_produse`
- Inserează în `productie_comenzi` cu `status='pending'`, `sursa='senior-erp'`
- Scrie log în `erp_import_log`, returnează sumar: `{ created, skipped, unmapped_products, unmapped_stores }`

### 3. Bridge Node.js (folderul livrat ție)
Structură:
```text
senior-erp-bridge/
  package.json
  .env.example            ← tu îl copiezi în .env și completezi
  src/index.js            ← loop de poll 2 min
  src/db.js               ← conectare PG/MySQL, SELECT avize
  src/last-sync.json      ← auto-generat, ține minte de unde a rămas
  install-service.bat     ← instalează serviciu Windows (node-windows)
  uninstall-service.bat
  README.md               ← ghid pas cu pas cu poze/comenzi
```
- Dependințe minime: `pg` (sau `mysql2`), `node-fetch`, `dotenv`, `node-windows`
- La fiecare 2 min: SELECT avize cu `data_aviz >= last_sync` → POST către edge function → salvează `last_sync` doar dacă răspunsul e OK
- Retry automat la eroare de rețea (bridge-ul așteaptă și încearcă din nou)
- Log local în `logs/bridge-YYYY-MM-DD.log`

### 4. Query SQL pentru Senior ERP
Aici am nevoie **o singură informație de la tine** înainte să scriu bridge-ul:
- **numele exact al tabelelor de avize din Senior ERP** și 2-3 coloane cheie (nr aviz, dată, cod client, produs, cantitate)

Poți să-mi dai una din variantele astea:
- un screenshot cu structura tabelelor din pgAdmin/MySQL Workbench, sau
- un export cu `\d avize` (Postgres) / `DESCRIBE avize;` (MySQL), sau
- pur și simplu mă conectezi tu la DB de pe PC-ul lor și îmi trimiți rezultatul unei interogări simple `SELECT * FROM information_schema.tables WHERE table_schema='public' LIMIT 200;`

Fără asta, scriu `db.js` cu placeholder-uri și trebuie să le înlocuiesc oricum după. Cu asta, primești bridge-ul gata funcțional din prima.

### 5. UI: pagina „Import Senior ERP" în Producție
- Card status: „Ultima sincronizare acum 1 min • 8 avize azi • 2 erori"
- Buton „Sincronizare manuală" (apelează edge function-ul cu flag `force=true`)
- Tabel mapping produse ERP (cod extern ↔ produs intern) — editabil, salvare live
- Tabel istoric ultimele 50 rulări din `erp_import_log`
- Alert vizibil dacă bridge-ul nu a mai raportat de > 15 min (îngrijorare că serviciul s-a oprit)

## Ordinea implementării (după ce aprobi planul)
1. Migrație DB (tabelele noi + coloane pe comenzi)
2. Generez token bridge cu `generate_secret`
3. Edge function `ingest-erp-orders` + o testez cu date fake
4. UI mapping produse + status
5. **Pauză aici**: îmi trimiți structura tabelelor din Senior ERP
6. Generez folderul `senior-erp-bridge/` cu SQL-ul corect și README pas cu pas
7. Îl descarci, îl pui pe PC, completezi 4 valori în `.env`, dublu-click pe installer
8. Test end-to-end

## Note
- Bridge-ul face doar `SELECT` (read-only) pe ERP-ul lor — zero risc pentru datele lor
- Dacă PC-ul e Linux, îți dau `install-service.sh` cu systemd în loc de `install-service.bat`
- Dacă mai târziu vor și marcare aviz procesat în ERP, se adaugă la bridge fără să schimb altceva
