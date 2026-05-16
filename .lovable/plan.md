## Obiectiv

La finalul unei recepții, utilizatorul să poată genera și printa o etichetă cu cod QR pentru lotul recepționat. Scanarea QR-ului (din aplicație sau de pe telefon) deschide o pagină dedicată cu toate datele lotului și acțiuni rapide: **Bon transfer** și **Returnare în stoc**.

## Flux utilizator

1. La salvarea unei recepții (Materii Prime / Ambalaje / Etichete), apare un buton **"Printează QR lot"** (și automat un dialog cu preview).
2. Dialogul afișează eticheta 50×30 mm (sau 80mm rolă termică) cu:
   - QR code (link către `/lot/{inventory_id}`)
   - Denumire produs, Furnizor, Producător
   - Cantitate + unitate, Lot, Data recepție, Nr. intrare
3. Buton **"Printează"** → `window.print()` cu CSS dedicat (compatibil imprimante termice ESC/POS prin driver Windows/Mac standard).
4. Scanarea QR-ului deschide `/lot/{id}` în browser:
   - Sus: toate datele lotului + cantitate curentă în stoc (live din DB)
   - Istoric scurt (recepție, transferuri, returnări)
   - Acțiuni: **Bon transfer din acest lot** și **Returnare în stoc** (dacă există transfer activ pentru acest lot)
5. Pagina `/lot/{id}` funcționează și pe mobil (scanare cu camera telefonului) — necesită autentificare.

## Modificări tehnice

**Pachete noi:**
- `qrcode.react` — pentru generarea QR în React (mic, fără dependențe native)

**Componente noi:**
- `src/components/inventory/LotQRLabel.tsx` — eticheta printabilă (QR + text), cu CSS `@media print` pentru format termic 50×30mm
- `src/components/inventory/LotQRDialog.tsx` — dialog cu preview + buton Printează
- `src/pages/LotDetailPage.tsx` — pagina deschisă la scanare; afișează datele + acțiunile

**Integrare:**
- `ReceptionRegistration.tsx`: după salvare reușită, deschide automat `LotQRDialog` cu `inventoryId` nou creat (în loc să închidă direct dialogul). Adaug și buton "QR" în `ReceptionHistory` pentru reprintare.
- `App.tsx`: rută nouă `/lot/:id` (în interiorul `ProtectedRoute`).
- QR-ul conține URL-ul absolut: `${window.location.origin}/lot/${id}` — funcționează din orice cititor QR.

**Acțiuni din pagina lotului:**
- **Bon transfer**: deschide `StockTransferForm` pre-completat cu produsul/lotul respectiv (refolosesc componenta existentă, adaug prop `prefillLotId`).
- **Returnare**: caută ultimul transfer activ pentru acest `inventory_item_id` și deschide `TransferReturnForm` pre-completat.

**Tip inventar:** detectez automat tipul (MP / Ambalaje / Etichete) căutând `id`-ul în cele 3 tabele (`inventory`, `ambalaje_inventory`, `etichete_inventory`) și setez contextul corespunzător.

## Imprimantă termică

Nu e nevoie de driver special — folosesc `window.print()` cu `@page { size: 50mm 30mm; margin: 0 }` și CSS care ascunde restul UI-ului. Funcționează cu orice imprimantă termică instalată ca printer Windows/Mac (Zebra, Brother QL, Xprinter etc.). Utilizatorul setează imprimanta default pe cea termică sau o alege la dialog print.

## În afara scope-ului (pentru iterații viitoare)

- Print direct ESC/POS via USB/Bluetooth (nu funcționează din browser fără extensii)
- Generare bulk QR pentru loturi vechi
- Stocare istoric printări
