# Modul „Necesar Comenzi" în hubul Vânzări

Tab nou în Vânzări unde încarci comenzile clienților (PDF sau Excel), ele se adună pe clienți ca în „Formulare comanda", vezi dacă materia primă ajunge și tai cantitățile până ajunge, apoi exporți Excelul identic cu formularul.

## Ce vei vedea
1. **Alegi data livrării** — totul se salvează pe acea zi (poți reveni, pot lucra și colegii).
2. **Zonă de încărcare (drag & drop)** — tragi mai multe PDF-uri / Excel-uri deodată. Aplicația citește fiecare comandă (inclusiv PDF-uri scanate) și recunoaște clientul, nr. comenzii, depozitul/platforma, produsele și bucățile. Vezi lista fișierelor încărcate și poți șterge unul.
3. **Tabel mare, pe foi ca în Excel** — câte o foaie pe client (METRO, Carrefour, Auchan, Selgros, Mega Image, Kaufland, Lidl, Nuti etc.), aceleași coloane ca în formular: Denumire, Gramaj, Nr. bucăți, Ambalaj primar, Buc/Bax, Nr. BAX (calculat), Ambalaj terțiar. Plus coloana **Tăiat** editabilă direct în celulă și **Final**.
4. **Foaia „Balanță materie primă"** — pentru fiecare ingredient (din rețete): necesar, stoc început zi, intrări azi din prerecepții, disponibil, diferență (roșu dacă nu ajunge). Click pe un ingredient arată exact ce comenzi/clienți îl consumă, și poți tăia de acolo pe loc; balanța se recalculează imediat.
5. **Export Excel + Printare** — fișier cu foile identice ca „Formulare comanda" (titlu, data livrare, nr. comandă, coloane), cu cantitățile după tăieri.

Ambalajul primar/terțiar și buc/bax se completează din „Modul de ambalare" deja salvat, potrivit pe client + produs + gramaj; se pot corecta manual.

Tăierile rămân doar în acest modul și în Excel — comenzile din Producție nu se modifică.

## Detalii tehnice
- Tabele Cloud noi: `vanzari_necesar_documente` (zi, client, fișier, nr. comandă) și `vanzari_necesar_linii` (document, client, depozit, produs, gramaj, buc, buc_bax, ambalaje, tăiat, produs_id potrivit). RLS public pentru ecranele autentificate, ca la prerecepție.
- Extragere: edge function nouă `comenzi-extract` — PDF-urile text/Excel se trimit ca text, cele scanate ca imagini la Lovable AI (Gemini) cu ieșire structurată JSON.
- Potrivire produs → rețetă (`productie_produse` / `productie_retete_ingrediente` din baza operațională) după nume normalizat + gramaj, cu selector manual dacă nu se găsește.
- Stoc început zi din `daily_stock_snapshots` (Materii Prime), intrări din `prereceptii` cu `expected_date` = azi, cantitate rămasă de recepționat.
- Export cu `xlsx`/ExcelJS replicând layout-ul foilor din formular.
