# Evidență Andrada

- Evidență Andrada MP lot view: pure rules in `src/lib/evidenta/lotJourney.ts`, data in `hooks/evidenta/useLotJourneys.ts`; NIR = reception_records original quantity linked to stock by entry_number, production matched by material+day with kg share across same-day lots; manual corrections only in Cloud `evidenta_andrada_rows` (`inventory_type` lot-materii-prime, `reception_id`+day). Why: lot numbers repeat across years and the view must never write operational data.
