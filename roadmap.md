# Roadmap
- [x] Switch reports to live reads from Senior with saved report results in Cloud; mirror only essential tables; dropped non-essential mirrored tables (DB 22 GB → 577 MB). Queue and agent query builder tested; end-to-end blocked until v2.0 is installed on the Senior server.
- [ ] Install mirror 2.0 on the Senior server and verify live reports — blocked on the user installing it.
- [x] Diagnose reported mirror stoppage: confirmed DocumentsAudit rows increasing and healthy Cloud; corrected unsupported TRY_CONVERT in the local script with regression coverage.
- [ ] Install mirror 1.8.1 and verify AccountingStatistics retries against Senior — blocked on installing the corrected script on the user's local server.
- [x] Replace commercial source browsing with verified CEO commercial KPIs, monthly activity and partner rankings; show incomplete sources explicitly. Database regression tests pass (header totals, empty/invalid periods, partner counts and service-only access); build OK. Signed-in UI verification remains unavailable because the operational account session is absent.
- [x] CEO: verified accounting copy stops at June 2026; added selectable periods and paginated commercial source browsing with freshness/availability. Database browsing/search/validation tests pass; authenticated UI verification unavailable (operational session absent).
- [x] Fix CEO report aggregation when no measure is selected; verified default count, grouped/filtered count and explicit count on mirrored data (signed-in UI check unavailable).
- [x] Limit future ERP historical transfers to 2025–2026 without deleting already mirrored rows; preserve reference data and verify filtering.
- [ ] Validate v1.8's server filter report against Senior — blocked until the user installs it on the local server.
- [x] Prepare adaptive mirror recovery pauses without excluding tables; bound prereception loading and verify retry UI with simulated timeout.
- [ ] Verify real reception performance during mirroring — blocked until user installs v1.8 on the local server and an operational-app session is available.
- [x] Înlocuiește lista de operatori cu operator principal + număr total și afișează datele în rapoarte.

- [x] Operator: câmp căutare produs/magazin (individual + grupat + pagina principală)
- [x] Ambalaje: stoc tuburi folie
- [x] Comenzi & Necesar: tabele și export după modelele standardizate, cantitate modificată, depozite pe coloane și Lidl mono/mixte.
- [x] Reproduce original template colors, borders, fonts, merged headers and sizing in Sales sheets and Excel exports; verified template rendering and sample exports.
