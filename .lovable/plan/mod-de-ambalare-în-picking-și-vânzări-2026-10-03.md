# Mod de ambalare în Picking și Vânzări

## Ce construiesc
- Import cele 10 foi din documentul primit, păstrând clienții, subgrupările și coloanele: Produs, Gramaj, Ambalaj primar, Ambalaj terțiar / Cutie și Bucăți / Bax.
- Adaug un tab comun „Mod de ambalare” atât în Picking, cât și în Vânzări.
- Afișez datele grupate pe client, cu selector de client și căutare după produs sau tip de ambalaj, inclusiv pe telefon.
- Permit utilizatorilor cu acces la Picking sau Vânzări să adauge, editeze și șteargă rânduri.
- Păstrez modificările într-o singură sursă comună, astfel încât schimbarea făcută într-un tab să apară imediat și în celălalt.

## Comportament
- La deschiderea tabului se vede primul client și tabelul în format apropiat de document.
- Subgrupările speciale din document, precum platformele Mega Image și Lidl, rămân vizibile.
- Formularul de editare validează câmpurile obligatorii și numărul de bucăți per bax.
- Ștergerea cere confirmare pentru a preveni modificările accidentale.

## Detalii tehnice
- Creez o tabelă protejată pentru regulile de ambalare și o populez cu toate rândurile din fișierul Excel.
- Accesul la scriere este limitat în baza de date la utilizatorii autentificați cu rolurile Picking/Vânzări sau administrator.
- Construiesc o componentă reutilizabilă folosită de ambele pagini și o integrez în taburile existente.
- Verific încărcarea, filtrarea, editarea și afișarea pe desktop și telefon.
