# Senior ERP Mirror

Oglindește tabelele din Senior ERP în Coral ERP, pentru rapoarte și Argus; istoricul identificabil este limitat la 2025–2026.
Este separat complet de `senior-erp-bridge` (comenzile) — pot rula amândouă în paralel.

## Cum funcționează
- Citește lista tabelelor din `INFORMATION_SCHEMA.TABLES` la fiecare ciclu (tabelele noi apar automat).
- Pentru fiecare tabel: citește coloanele, creează/completează tabelul în Coral ERP (nume cu litere mici;
  tabelele din alte scheme decât `dbo` devin `schema__tabel`), apoi trimite datele în loturi de 1000.
- Tabelele neschimbate (același număr de rânduri + checksum) sunt sărite.
- Versiunea 1.7 păstrează toate tabelele și loturile de 1000, dar așteaptă minimum 2 secunde între loturi și de 4 ori durata scrierii dacă aceasta e mai lentă. Oglindirea durează mai mult; pauzele reduc presiunea pe prerecepții, fără să garanteze viteza aplicației.
- Actualizare la 1.8.1: oprește programul cu Ctrl+C, înlocuiește folderul `src` și `package.json` din arhivă, apoi rulează `npm run once`. Păstrează `.env` și `mirror-state.json`. Versiunea 1.8.1 corectează filtrarea AccountingStatistics pentru versiunile SQL Server care nu acceptă TRY_CONVERT. La prima rulare noul domeniu de filtrare recitește tabelele; apoi sunt sărite dacă nu s-au schimbat.
- Nu se mai șterg rânduri deja copiate, nici istoricul anterior anului 2025, nici documentele eliminate ulterior în Senior. Copia păstrează istoricul existent; nu este o replică cu ștergeri sincronizate.
- Filtrarea folosește perioada `YYYYMM` la AccountingStatistics și datele de document identificate, nu crearea/modificarea/expirarea/scadența. Liniile urmează documentul prin legăturile declarate în ERP; C_D_Note_Contabile urmează C_H_Note_Contabile prin H_ID verificat în coloane.
- Nomenclatoarele rămân integrale. Datele nule și legăturile lipsă sunt păstrate pentru siguranță. Tabelele fără o perioadă identificabilă se copiază integral și sunt marcate în consolă și în `history-filter-report.json`; nu putem garanta că toate cele 1097 de tabele sunt reduse fără verificarea acestui raport pe server.
- Intervalul fix este 1 ianuarie 2025 inclusiv – 1 ianuarie 2027 exclusiv. Înainte de 2027 trebuie actualizat intervalul. Progresul tabelelor filtrate arată rândurile trimise, fără estimare din întregul istoric; totalul Cloud include datele vechi păstrate.
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
