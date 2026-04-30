## Obiectiv

Unificarea proiectelor `marfa-ai-asistent` (Stoc Depozit) și `productiecoral-18` (Producție Coral Biogreens) într-o singură aplicație organizată pe **8 departamente**, cu acces pe rol per departament. Ambele proiecte folosesc deja **același Supabase** (`mfcdlifjxxdrekzdatfb`) — deci nu trebuie migrate date, ci doar unificat codul frontend.

## Departamente țintă

```
1. Achiziții              → comenzi furnizori, forecast, raport recepție
2. Depozit Materii Prime  → stoc MP, recepție, transferuri
3. Depozit Ambalaje       → stoc ambalaje
4. Etichete               → stoc etichete (workflow simplificat)
5. Producție              → linii, comenzi prod., rețete, ingrediente, operatori, avans
6. Picking & Vânzări      → picking, OCR comenzi clienți, distribuție, zone livrare, clienți
7. Mentenanță             → (nou — placeholder cu structură pentru extindere)
8. Administrativ          → utilizatori, aprobări, audit, produse, furnizori, producători, rapoarte
```

## Strategie: 4 prompturi ghidate

### Prompt 1 — Fundație (remix nou + shell + roluri)
Pornim un **remix gol** sau folosim un proiect nou conectat la același Supabase. În acest prompt:
- Conectarea la Supabase existent (URL + anon key deja știute).
- Migrare DB: extindere `app_role` enum cu valorile noi:
  `admin`, `achizitii`, `depozit_mp`, `depozit_ambalaje`, `etichete`, `productie`, `operator`, `picking`, `vanzari`, `mentenanta`, `supervizor`.
- Funcție `has_department_access(_user_id, _department text)` (security definer) care mapează roluri → departamente.
- `AuthContext` + `ProtectedRoute` + `DepartmentRoute` (gate pe departament).
- `AppShell` cu sidebar shadcn (8 grupuri colapsabile, unul per departament).
- Pagină Dashboard care arată **doar departamentele la care userul are acces**.
- Pagini placeholder pentru fiecare departament (`/depozit-mp`, `/productie`, etc.) ca să existe rutele.
- Pagina `/admin/users` cu UI pentru atribuirea de roluri pe departament.

Rezultat: aplicația rulează, userul admin vede tot, ceilalți doar ce li s-a alocat. Niciun feature business încă.

### Prompt 2 — Migrare „Lanț Materiale” (Achiziții + 3 Depozite + Etichete)
Copiere componente din **acest proiect** (marfa-ai-asistent) în proiectul nou:
- Sub `/achizitii`: `OrderManagement`, `ForecastView`, `ConsumptionReport`, `ReceptionReport`, `OrderHistory`, `FutureOrders`, `OrderToday`, `SupplierSelectDialog`, `ProductOrderSettings`.
- Sub `/depozit-mp`, `/depozit-ambalaje`, `/etichete`: `InventoryManagement`, `StockTransferForm`, `ReceptionRegistration`, `TransferReturnForm`, `DailyStock*`, `ReceptionHistory`, `TransferHistory`, plus `InventoryTypeProvider` (dar de data asta tipul e fixat per rută, nu prin context global).
- Hooks: `use-inventory-data`, `use-aggregated-stock`, `use-grouped-receptions`.
- Lib: `excelExport`, `purchaseOrderExport`, `productionStockBackfill`.
- Edge function `daily-stock-snapshot` (rămâne deployată pe același Supabase).
- Memoriile existente (paginare 1000 rows, format Excel, etc.) rămân valide.

### Prompt 3 — Migrare „Producție + Picking/Vânzări”
Copiere componente din **productiecoral-18**:
- Sub `/productie`: `ProductionDashboardReal`, `OrderManagementReal`, `LineManagement`, `RecipeManagement`, `IngredientManagement`, `AdvanceProductionManagement`, `OperatorInterface`, `ShiftManagement`, `LineDistribution`, `CapacityMonitor`, `StockManagement` (stoc producție), `ConsumptionAnalytics`, `MarfaRestocataView`.
- Sub `/picking-vanzari`: `PickingManagementSimple`, `OrderOCR`, `OcrOrdersByClient`, `OcrTemplateManagement`, `ClientManagement`, `ClientSearch`, `DeliveryZoneManagement`, `DeliveryZoneForm`, `DistributionSearch`, `OrderSearch*`.
- Operatorii (rol `operator`) sunt redirectați direct la `/productie/operator/:lineId`, picking-iștii la `/picking-vanzari/picking` — păstrăm UX-ul actual de „kiosk mode”.
- Pagini admin sub `/administrativ`: `Reports`, `UserApprovalManagement`, `UserManagement`, `AuditLogPage`, `ProductsPage`, `SuppliersPage`, `ManufacturersPage`, `CrateTypesPage`.

### Prompt 4 — Polish, Mentenanță și cleanup
- Schelet pentru departamentul **Mentenanță** (tichete, intervenții, plan revizii) — minimal, ca să poți extinde ulterior.
- Pagină „Pagina mea” cu shortcuts personalizate per user.
- Verificare matrice acces (admin testează ca fiecare rol).
- Ștergere rute vechi din ambele proiecte sursă (opțional — le putem lăsa în paralel o săptămână ca fallback).
- Decommissioning ambele proiecte vechi după validare.

## Detalii tehnice

**De ce remix nou și nu „peste” unul existent**: ambele proiecte au `App.tsx` foarte ramificat și convenții diferite (acesta folosește `InventoryTypeProvider` global + sidebar shadcn; celălalt folosește Tabs imbricate + header custom). Un remix curat ne lasă să impunem o singură arhitectură (router cu rute reale per departament, fără tabs imbricate de 3 niveluri).

**Fără migrare de date**: tabele, RLS, edge functions, storage — toate rămân pe `mfcdlifjxxdrekzdatfb`. Doar mapăm UI nou peste ele.

**Acces pe departament — model**:
```sql
-- mapare rol → departamente (în has_department_access)
admin              → toate
achizitii          → achizitii
depozit_mp         → depozit_mp
depozit_ambalaje   → depozit_ambalaje
etichete           → etichete
productie          → productie
operator           → productie (doar /operator)
picking            → picking-vanzari (doar /picking)
vanzari            → picking-vanzari
mentenanta         → mentenanta
supervizor         → toate (read + aprobare useri)
```
Un user poate avea **mai multe roluri** (tabela `user_roles` permite deja, `unique(user_id, role)`).

**Structură rute**:
```text
/                           Dashboard cu carduri pe departament
/achizitii/*                comenzi, forecast, raport recepție
/depozit-mp/*               inventar materii prime
/depozit-ambalaje/*         inventar ambalaje
/etichete/*                 inventar etichete
/productie/*                producție (sub-tab-uri: dashboard, comenzi, avans, linii, operator)
/picking-vanzari/*          picking, OCR, clienți, distribuție
/mentenanta/*               (placeholder)
/administrativ/*            utilizatori, audit, nomenclatoare, rapoarte
/auth, /pending-approval    (publice)
```

## Ce-ți trebuie să porněm

Înainte de Prompt 1 confirmă:
1. Numele noului proiect (sugestie: `coral-erp` sau `coral-biogreens`).
2. Dacă pornim direct cu remix din acest proiect (păstrează toate componentele de stoc, le mutăm pe rute noi) **sau** chiar gol (mai mult de copiat dar mai curat).

Recomandarea mea: **remix din acest proiect** ca bază (ai deja sidebar, audit, roluri, RLS bune), apoi importăm Producția peste. Reduce Prompt 1 la jumătate.
