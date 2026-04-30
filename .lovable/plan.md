
# Promptul 1 — Fundație ERP pe 8 departamente

Scop: pregătesc proiectul ca shell ERP cu acces pe rol și sidebar grupat pe departamente, fără să sparg nimic din ce funcționează acum (Inventar, Recepție, Forecast, Producție, Audit, Useri).

Nu migrez încă nimic din `productiecoral-18` — asta vine în Promptul 2.

## 1. Bază de date (migrare)

Extind enum-ul `app_role` cu 8 valori noi (admin rămâne):

```
achizitii, depozit_mp, depozit_ambalaje, etichete,
productie, picking_vanzari, mentenanta, administrativ
```

Adaug funcție security-definer pentru verificare acces pe departament, folosită în RLS și în UI:

```sql
create or replace function public.has_department_access(_user_id uuid, _dept app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.app_user_roles
    where user_id = _user_id
      and role in (_dept, 'admin')
  )
$$;
```

`admin` rămâne super-rol (vede tot). `app_user_roles` poate avea mai multe rânduri per user (multi-departament).

## 2. Frontend — `AuthContext`

Extind `AuthContext` cu:
- `departments: AppRole[]` — toate rolurile non-admin ale userului curent
- `hasDepartment(dept): boolean` — `isAdmin || departments.includes(dept)`

Schimb fetch-ul de roluri să ia toate rândurile, nu doar `admin`.

## 3. `ProtectedRoute` extins

Adaug prop opțional `requireDepartment?: AppRole`. Dacă e setat și userul nu are acces (nici admin, nici rolul respectiv) → redirect la `/`.

## 4. Sidebar refactorizat — 8 grupuri

`AppSidebar.tsx` rescris cu `SidebarGroup` per departament. Grupurile pe care userul nu le poate accesa **nu se afișează**. Admin le vede pe toate.

```text
ACHIZIȚII              → /achizitii (placeholder), /achizitii/comenzi (placeholder)
DEPOZIT MATERIE PRIMĂ  → /depozit-mp (= inventar MP existent), /depozit-mp/receptie
DEPOZIT AMBALAJE       → /depozit-ambalaje (= inventar ambalaje existent)
ETICHETE               → /etichete (= inventar etichete existent)
PRODUCȚIE              → /productie (= ProductionStockPage existent), /productie/forecast
PICKING & VÂNZĂRI      → /picking (placeholder), /vanzari (placeholder)
MENTENANȚĂ             → /mentenanta (placeholder)
ADMINISTRATIV          → /administrativ (dashboard simplu),
                         /administrativ/users (= /users existent),
                         /administrativ/audit (= /audit existent),
                         /administrativ/produse, /furnizori, /producatori, /lăzi
```

Rutele vechi (`/dashboard/*`, `/inventory`, `/users`, `/audit`) rămân ca **redirect-uri** la noile căi, ca să nu se rupă niciun bookmark și niciun cod intern.

Pe `/` afișez un dashboard nou „Hub Departamente": carduri mari pentru fiecare departament la care userul are acces, cu iconuri și descriere scurtă. Înlocuiește `Dashboard.tsx` actual (păstrăm backup logic în noile pagini administrative).

## 5. Pagini placeholder

Creez câte un component minimal pentru fiecare rută nouă care n-are încă conținut:
- `/achizitii`, `/achizitii/comenzi`
- `/picking`, `/vanzari`
- `/mentenanta`
- `/administrativ` (hub admin)

Fiecare placeholder = card cu titlul departamentului + text „Modul în construcție — va fi populat în pașii următori".

## 6. UI atribuire roluri în `/administrativ/users`

În tabelul de utilizatori activi adaug o coloană nouă „Departamente" cu badge-uri și un buton „Editează roluri" care deschide un dialog cu **8 checkbox-uri** (unul per departament) + checkbox separat pentru `admin`. Salvarea face diff și `insert`/`delete` în `app_user_roles`.

## 7. Curățenie barră sus

Butoanele „Materii Prime / Ambalaje / Etichete" din header-ul global se mută doar pe paginile de depozit unde au sens (Depozit MP, Depozit Ambalaje, Etichete devin pagini separate). Header-ul global rămâne doar cu `SidebarTrigger` + identitate user + logout.

## Verificare la final (cer asistentului să raporteze)

- Listă completă de rute create + către ce componentă duc
- Listă rolurilor disponibile în enum
- Confirmare că `admin` vede toate cele 8 grupuri în sidebar
- Confirmare că niciun import vechi nu e rupt (build verde)

## Ce NU fac în acest pas

- Nu migrez cod din `productiecoral-18` (Promptul 2)
- Nu fac RLS noi pe tabele existente (acces la date rămâne ca acum, doar UI-ul e gated)
- Nu șterg pagini vechi — doar le redenumesc / re-mapez prin redirect

---

Dacă aprobi, intru în mod build și execut tot într-o singură rulare. Dacă vrei să schimbi numele rutelor (ex. `/warehouse-mp` în loc de `/depozit-mp`) sau să muți o pagină în alt departament, spune-mi acum.
