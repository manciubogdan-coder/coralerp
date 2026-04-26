
# Card de confirmare înainte de salvare

## 🎯 Scopul
Când e vâlvă în depozit, operatorul apasă „Salvează” pe pilot automat. Adăugăm **un pas obligatoriu** între click pe Salvează și salvarea efectivă: un card mare, vizibil, care îi forțează ochiul să citească ce urmează să trimită în sistem.

## 📋 Ce se schimbă

### 1. La Recepție (`ReceptionRegistration.tsx`)
Când operatorul apasă **„Salvează recepția”**, NU se salvează direct. Se deschide un dialog AlertDialog mare cu:

- **Titlu mare roșu/galben**: ⚠️ CONFIRMĂ RECEPȚIA
- **Bloc evidențiat (font foarte mare, bold)**:
  - **Produs**: `FĂINĂ 550` (text 2xl, bold)
  - **Cantitate**: `1.250 kg` (text 3xl, bold, culoare primară)
  - **Furnizor**: `Moara SRL`
  - **Producător**: `X` (doar la materii prime)
  - **Document**: `NIR 12345`
  - **Zonă**: `Materii Prime` / `Ambalaje` / `Etichete` (badge colorat)
- **Două butoane mari**:
  - `← Modific` (secundar, stânga)
  - `✓ CONFIRM și salvez` (primar, dreapta, verde)

Doar după click pe „CONFIRM” se execută `INSERT` în baza de date (logica existentă din `handleSubmit`).

### 2. La Bon de Transfer (`StockTransferForm.tsx`)
Când operatorul apasă **„Salvează transferul”**, se deschide un dialog similar cu:

- **Titlu mare**: ⚠️ CONFIRMĂ BONUL DE TRANSFER
- **Antet**:
  - **Destinație**: `Producție` (text 2xl, bold)
  - **Data transfer**: `26.04.2026`
- **Tabel cu toate produsele** (font mare):
  | Produs | Lot | Cantitate netă |
  |---|---|---|
  | FĂINĂ 550 | L240426 | **500 kg** |
  | ZAHĂR | L240425 | **120 kg** |
- **Total linii**: `2 produse, total 620 kg`
- **Două butoane mari**:
  - `← Modific`
  - `✓ CONFIRM transferul`

## 🔧 Implementare tehnică

- Componentă nouă reutilizabilă: `src/components/inventory/ConfirmationDialog.tsx`
  - Props: `open`, `onConfirm`, `onCancel`, `title`, `children`
  - Stilizare: AlertDialog cu padding generos, font mare, culori clare
- Modificări minime în:
  - `src/components/inventory/ReceptionRegistration.tsx` — adaug state `showConfirm`, mut `handleSubmit` în spatele confirmării
  - `src/components/inventory/StockTransferForm.tsx` — același pattern pentru `onSubmit`

## ✅ Ce NU se schimbă
- Logica de calcul (cantitate netă, paleți, lăzi) rămâne identică
- Validările existente rămân
- Salvarea în DB rămâne neschimbată — doar se execută după confirmare

## 🎨 Detaliu vizual important
Cardul folosește:
- `text-3xl font-bold` pentru cantitate
- `text-2xl font-bold` pentru numele produsului
- Background subtil colorat (`bg-yellow-50` sau `bg-primary/5`) ca să atragă atenția
- Spațiu generos (`p-8`) — NU înghesuit
- Buton confirm pe dreapta, buton modific pe stânga (ca să nu se apese reflex)

## 📦 Fișiere afectate
1. `src/components/inventory/ConfirmationDialog.tsx` (nou)
2. `src/components/inventory/ReceptionRegistration.tsx` (modificat)
3. `src/components/inventory/StockTransferForm.tsx` (modificat)

După aprobare, implementez în ordine: componenta comună → recepție → transfer.
