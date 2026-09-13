# Fix „Fă poză" din raportul de recepție

## Problema
În fereastra de poze din Recepție (Calitate), butonul „Fă poză" deschide selectorul de fișiere în locul camerei. Cauza: input-ul de cameră are și atributul `capture="environment"` și atributul `multiple` — pe Android/Chrome, prezența lui `multiple` face ca `capture` să fie ignorat, deci se deschide galeria.

## Modificare
Fișier: `src/components/inventory/ReceptionReport.tsx` (~linia 2041)

1. **Butonul „Fă poză"**: se elimină atributul `multiple` din input-ul cu `capture="environment"`. Astfel pe telefon se deschide direct camera; poza făcută este încărcată, iar utilizatorul poate apăsa din nou pentru încă o poză.
2. **Butonul „Alege din galerie"**: rămâne neschimbat (cu `multiple`, fără `capture`) — permite selectarea uneia sau mai multor poze existente.

Rezultat: ambele posibilități funcționează corect — cameră directă la „Fă poză" și galerie la „Alege din galerie".

## Verificare
- `tsgo --noEmit` + build OK.
- Test vizual pe `/calitate` → Recepție → fereastra Poze: ambele butoane prezente; pe desktop „Fă poză" deschide selectorul (comportament normal pe desktop), pe mobil deschide camera.
