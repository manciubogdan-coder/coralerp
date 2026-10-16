# Panou CEO din datele Senior ERP

## Ce primești
Un card nou în Administrativ: **„Panou CEO”** (doar admini), cu 3 părți:

1. **Bani și profit dintr-o privire** (automat)
   - Venituri, cheltuieli și profit pe luna curentă și de la începutul anului, comparat cu anul trecut.
   - Grafic pe luni (venituri vs. cheltuieli vs. profit).
   - Top 10 categorii de cheltuieli și de venituri.
   - Calculat din notele contabile din Senior (conturi clasa 7 = venituri, clasa 6 = cheltuieli). Se completează singur pe măsură ce oglindirea aduce date noi.

2. **Constructor de rapoarte cu drag and drop**
   - Alegi un tabel din Senior (lista se actualizează singură când apar tabele noi).
   - Tragi coloanele în zonele „Rânduri”, „Valori” (sumă / număr / medie) și „Filtre”.
   - Alegi afișarea: tabel, bare, linie sau plăcintă. Salvezi raportul pe panou.

3. **Asistent de rapoarte**
   - Scrii „vreau vânzările pe clienți pe ultimele 3 luni” și asistentul caută singur tabelele potrivite, construiește raportul și îl poți salva pe panou.
   - Folosește Argus, care deja are acces sigur la datele oglindite.

## Limitări de acum
- Notele contabile mari (C_D_Note_Contabile, 7,3 milioane de rânduri) încă se copiază; până se termină, partea de profit arată date parțiale, cu un avertisment pe pagină.
- Vânzările și stocurile din Senior vin mai târziu în oglindire; constructorul și asistentul le vor vedea automat când intră.

## Detalii tehnice
- Funcții noi doar pentru server în schema `erp_mirror`: listă tabele + coloane (din catalogul `_tables`), agregare parametrizată (tabel, grupări, măsuri, filtre validate pe numele coloanelor existente, fără SQL liber), rezumat P&L pe luni din notele contabile.
- Acțiuni noi în funcția `erp-mirror` (sesiune admin): `catalog`, `aggregate`, `pnl`, `reports_list/save/delete`.
- Rapoartele salvate într-un tabel nou doar pentru server, citit prin funcție.
- Asistentul: unealtă nouă în Argus care propune configurația raportului (tabel, grupări, măsuri, grafic), executată prin aceeași agregare sigură.
- Drag and drop cu `@dnd-kit`, grafice cu `recharts` (deja în proiect).
- Mesajul de pe pagina de oglindire clarifică acum diferența dintre „Tabele copiate” (total real) și progresul rulării curente.
