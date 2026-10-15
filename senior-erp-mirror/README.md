# Senior ERP Mirror

Oglindește **toate** tabelele din Senior ERP în Coral ERP, pentru rapoarte și Argus.
Este separat complet de `senior-erp-bridge` (comenzile) — pot rula amândouă în paralel.

## Cum funcționează
- Citește lista tabelelor din `INFORMATION_SCHEMA.TABLES` la fiecare ciclu (tabelele noi apar automat).
- Pentru fiecare tabel: citește coloanele, creează/completează tabelul în Coral ERP (nume cu litere mici;
  tabelele din alte scheme decât `dbo` devin `schema__tabel`), apoi trimite datele în loturi de 1000.
- Tabelele neschimbate (același număr de rânduri + checksum) sunt sărite.
- Rândurile șterse în Senior sunt șterse și din oglindă, doar după o citire completă reușită.
- **Read-only**: doar `SELECT ... WITH (NOLOCK)`, conexiune `ApplicationIntent=ReadOnly`, gardă în cod
  care refuză orice altă comandă. Recomandat: user SQL doar cu rolul `db_datareader`.

## Instalare
1. Copiază folderul `senior-erp-mirror` pe server (ex. `C:\senior-erp-mirror`). Necesită Node.js LTS.
2. Copiază `.env.example` ca `.env` și completează datele (același `BRIDGE_TOKEN` ca la bridge).
3. Test: în `cmd` din folder: `npm install` apoi `npm run once` (o singură oglindire, apoi se oprește).
   Prima rulare poate dura mult (toată baza).
4. Serviciu permanent: click dreapta pe `install-service.bat` → **Run as administrator**.

## Loguri
Folderul `logs/`. Starea (ce tabele erau neschimbate) e în `mirror-state.json` — șterge-l ca să forțezi
re-sincronizarea completă.
