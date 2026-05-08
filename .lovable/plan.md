## Obiectiv

Permite mai multe tipuri de paleți și lăzi pe același articol, atât la **înregistrarea recepției** (`ReceptionRegistration`) cât și la **raportul de calitate** (`ReceptionReport`), cu perechi recepționat ↔ document defalcate pe fiecare tip și totalizare pe tip.

## Constrângere tehnică

DB-ul folosit este cel legacy (`mfcdlifjxxdrekzdatfb`) — nu putem rula migrări prin Lovable Cloud pe el. Folosim aceeași strategie de encoding string pe care o folosim deja la `paleti_lazi_document` (`2P/10L||TipLada`), extinsă cu un sufix `||BD:<base64-json>` pentru breakdown-ul detaliat. Tabelele rămân neschimbate.

## Format encoding `paleti_lazi_document`

```
{nrPaletiTotal}P/{nrLaziTotal}L||{tipLadaPrincipal}||BD:{base64(JSON)}
```

JSON-ul conține breakdown-ul complet:
```json
{
  "rec_pallets": [{"id":"uuid","name":"EUR","count":2}, {"id":"uuid","name":"IND","count":1}],
  "rec_crates":  [{"id":"uuid","name":"Neagra","count":10}, {"id":"uuid","name":"Verde","count":5}],
  "doc_pallets": [{"id":"uuid","name":"EUR","count":2}],
  "doc_crates":  [{"id":"uuid","name":"Neagra","count":10}]
}
```

`nrPaletiTotal` / `nrLaziTotal` rămân suma breakdown-ului, ca să nu strice exporturile/footerele actuale.

## Modificări UI

### 1. `ReceptionRegistration.tsx`
Înlocuim secțiunea „Paleți recepționați" (un singur tip palet + un singur tip lădiță) cu două blocuri cu rânduri dinamice:

- **Paleți recepționați (multi-tip)** — listă de `{tipPaletId, count}` cu butoane Adaugă rând / Șterge rând. Primul rând e cel implicit. Total paleți afișat dedesubt.
- **Lădițe recepționate (multi-tip)** — la fel pentru lăzi: `{tipLadaId, count}`. Greutatea lădițelor pentru calculul cantității nete devine suma `count * weight` pe toate rândurile.

La salvare:
- în `reception_records` scriem totalurile (primul tip rămâne în `pallet_type_id`/`crate_type_id` ca „dominant" pentru compatibilitate; sumele în `pallet_count`/`crate_count`).
- după insert, scriem un rând în `reception_report_data` cu `paleti_lazi_document` deja codat cu breakdown-ul recepție (doc rămâne gol — se completează în raport).

### 2. `ReceptionReport.tsx`
- Înlocuim cele 3 coloane curente (Paleți doc / Lăzi doc / Tip lăzi doc) și inputurile pentru paleți doc / lăzi doc cu un **buton „Detalii"** într-o singură coloană care deschide un dialog.
- **Dialogul „Detalii paleți & lăzi"** are 4 tabele cu rânduri dinamice:
  - Paleți recepționați (tip + cant)
  - Paleți document (tip + cant)
  - Lăzi recepționate (tip + cant)
  - Lăzi document (tip + cant)
- În rândul tabelului afișăm un sumar compact: `2 EUR + 1 IND` / `10 Neagră + 5 Verde` (recepționat sus, document jos sau cu badge culoare diferită).
- Footerul tabelului totalizează pe tip pentru toate cele 4 sub-categorii (extindem `groupTotals.ladiDocByType` cu `paletiRecByType`, `paletiDocByType`, `laziRecByType`, `laziDocByType`).
- Encoding/decoding centralizat în 2 funcții `encodePalDoc(state)` / `decodePalDoc(text)`.

### 3. Excel export (`ReceptionReport`)
Înlocuim coloanele „Paleți doc / Lăzi doc / Tip lăzi doc" cu 4 coloane text descriptive:
- `Paleți rec` (ex: `2 EUR + 1 IND`)
- `Paleți doc` (ex: `2 EUR + 1 IND`)
- `Lăzi rec` (ex: `10 Neagră + 5 Verde`)
- `Lăzi doc` (ex: `10 Neagră + 5 Verde`)

Footer cu totaluri pe tip pentru fiecare categorie.

### 4. Compatibilitate înapoi
`decodePalDoc` detectează formatul vechi (`2P/10L||TipLada` fără `BD:`) și îl mapează la breakdown cu un singur rând per categorie, folosind `pallet_type_id`/`crate_type_id` din recepție pentru tipuri.

## Detalii tehnice

- **Tipuri noi**: `BreakdownEntry = { id: string|null; name: string; count: number }` și `BreakdownPayload = { rec_pallets, rec_crates, doc_pallets, doc_crates }`.
- **Helpers** într-un fișier nou `src/lib/receptionBreakdown.ts` (encode/decode + sumar text).
- **Fără modificări la `inventory` / `reception_records`** — totalurile pe care le folosesc deja alte ecrane rămân corecte.

## Fișiere afectate

- `src/components/inventory/ReceptionRegistration.tsx` (multi-tip la înregistrare)
- `src/components/inventory/ReceptionReport.tsx` (dialog Detalii + footer extins + export)
- `src/lib/receptionBreakdown.ts` (nou — helpers encode/decode)

## În afara scopului

- Nu modificăm schema DB.
- Nu schimbăm restul coloanelor din raport (defecte, poze, observații, % pierdere etc.).
- Nu atingem alte ecrane care citesc `pallet_count`/`crate_count` — ele continuă să vadă totalurile corecte.
