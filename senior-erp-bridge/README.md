# Senior ERP Bridge

Sincronizează automat avizele din Senior ERP în aplicația Coral ERP.

## Instalare pas cu pas

### 1. Instalează Node.js
Descarcă de la https://nodejs.org (versiunea LTS, next-next-finish).

### 2. Copiază folderul
Copiază tot folderul `senior-erp-bridge` pe PC-ul din rețeaua companiei
(unde e accesibil Senior ERP-ul). De ex. în `C:\senior-erp-bridge`.

### 3. Configurează
1. Copiază `.env.example` → redenumește-l în `.env`
2. Deschide `.env` cu Notepad și completează:
   - `ERP_DB_TYPE` — `postgres` sau `mysql`
   - `ERP_DB_HOST` — IP-ul serverului DB
   - `ERP_DB_PORT` — 5432 (Postgres) sau 3306 (MySQL)
   - `ERP_DB_NAME` — numele bazei
   - `ERP_DB_USER` / `ERP_DB_PASSWORD` — user READ-ONLY
   - `BRIDGE_TOKEN` — îl primești de la administratorul Coral ERP

### 4. Test manual (opțional dar recomandat)
Deschide `cmd` în folder și rulează:
```
npm install
npm start
```
Ar trebui să vezi `Bridge pornit — poll la fiecare 120s`.
Dacă totul merge, oprește cu `Ctrl+C` și treci la pasul 5.

### 5. Instalează ca serviciu (pornește automat cu PC-ul)
Click DREAPTA pe `install-service.bat` → **Run as administrator**.
Serviciul „Senior ERP Bridge" apare în Services (services.msc).

### Dezinstalare
Click DREAPTA pe `uninstall-service.bat` → **Run as administrator**.

## Adaptare interogare SQL
Fișierul `src/db.js` conține un ȘABLON de query care presupune tabelele
`avize` și `avize_linii`. Dacă Senior ERP folosește alte nume,
modifică query-urile din funcția `fetchAvizeSince` în `src/db.js`,
apoi repornește serviciul din services.msc.

Coloanele returnate trebuie să fie:
- **avize (antet):** `nr_aviz`, `data_aviz`, `cod_magazin`, `nume_magazin`,
  `observatie`
- **linii:** `nr_aviz`, `cod_produs`, `denumire_produs`, `cantitate`, `um`,
  `observatie`

## Loguri
- Loguri text: folderul `logs/` (câte un fișier pe zi).
- Sincronizări în aplicație: tab-ul **Producție → Import ERP**.

## Troubleshooting
- **Nu se conectează la DB**: verifică IP/port/user/parolă, testează din
  DBeaver de pe același PC.
- **HTTP 401**: `BRIDGE_TOKEN` din `.env` nu se potrivește cu tokenul din
  Lovable — cere-l din nou de la administrator.
- **Produse „nemapate"**: du-te în aplicație → **Producție → Import ERP →
  Mapping produse** și adaugă codurile lipsă.
