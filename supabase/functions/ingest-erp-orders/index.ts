// Edge function: ingest-erp-orders
// Primește avize din bridge-ul local Senior ERP și creează comenzi client.
// Autentificare: header X-Bridge-Token verificat față de SENIOR_ERP_BRIDGE_TOKEN.
// Notă: se conectează la LEGACY DB (unde trăiește restul aplicației).

import { createClient } from "npm:@supabase/supabase-js@2";

const LEGACY_URL = "https://mfcdlifjxxdrekzdatfb.supabase.co";
const LEGACY_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mY2RsaWZqeHhkcmVremRhdGZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMTg0MTMsImV4cCI6MjA1OTc5NDQxM30.P7molAFqPEpn4hwwEvKzYTEFHRlJhhvQ8GM29CqEDxk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-bridge-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface AvizLine {
  cod_produs: string;
  denumire_produs?: string;
  cantitate: number;
  um?: string;
  observatie?: string;
}
interface Aviz {
  nr_aviz: string;
  data_aviz: string; // ISO date
  cod_magazin?: string;
  nume_magazin: string;
  observatie?: string;
  linii: AvizLine[];
}
interface Payload {
  bridge_version?: string;
  bridge_host?: string;
  avize: Aviz[];
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Setează (idempotent) cantitatea din pool pentru o comandă/produs/zi.
 * Dacă lotul există deja, doar îl actualizează — nu mai inserează duplicate
 * la fiecare rulare a sincronizării.
 */
async function setRestockLot(
  supabase: any,
  comandaId: string,
  produsId: string,
  dataOnly: string,
  cantitate: number
) {
  const { data: existent } = await supabase
    .from("productie_restocari")
    .select("id, cantitate_surplus")
    .eq("comanda_originala_id", comandaId)
    .eq("produs_id", produsId)
    .eq("data_productie", dataOnly)
    .eq("status", "disponibil")
    .limit(1)
    .maybeSingle();

  if (existent?.id) {
    if (Number(existent.cantitate_surplus || 0) !== cantitate) {
      await supabase
        .from("productie_restocari")
        .update({ cantitate_surplus: cantitate })
        .eq("id", existent.id);
    }
    return;
  }

  await supabase.from("productie_restocari").insert({
    comanda_originala_id: comandaId,
    produs_id: produsId,
    cantitate_surplus: cantitate,
    data_productie: dataOnly,
    status: "disponibil",
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = req.headers.get("x-bridge-token") || "";
  const expected = Deno.env.get("SENIOR_ERP_BRIDGE_TOKEN") || "";
  if (!expected) return json({ error: "Server missing SENIOR_ERP_BRIDGE_TOKEN" }, 500);
  if (token !== expected) return json({ error: "Unauthorized" }, 401);

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  // Rută de reset: șterge toate comenzile importate din Senior ERP
  if ((payload as any)?.action === "reset_all") {
    const sb = createClient(LEGACY_URL, LEGACY_ANON);
    const { count, error } = await sb
      .from("productie_comenzi")
      .delete({ count: "exact" })
      .eq("sursa", "senior-erp");
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, deleted: count ?? 0 });
  }


  // Rută de curățare retururi: șterge comenzile cu cantitate <= 0
  if ((payload as any)?.action === "cleanup_returns") {
    const sb = createClient(LEGACY_URL, LEGACY_ANON);
    const { count, error } = await sb
      .from("productie_comenzi")
      .delete({ count: "exact" })
      .eq("sursa", "senior-erp")
      .lte("cantitate", 0);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, deleted: count ?? 0 });
  }

  if (!payload || !Array.isArray(payload.avize)) {
    return json({ error: "Missing avize[]" }, 400);
  }

  const supabase = createClient(LEGACY_URL, LEGACY_ANON);

  // Normalizare pentru match după denumire (trim, lower, colapsare spații, fără diacritice)
  const norm = (s: string) =>
    String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  // Preload: mapări existente + toate produsele/clienții pentru match după nume
  const [
    { data: mapProduseData },
    { data: mapMagData },
    { data: produseData },
    { data: clientiData },
  ] = await Promise.all([
    supabase.from("erp_mapping_produse").select("cod_extern, produs_id"),
    supabase.from("erp_mapping_magazine").select("cod_extern, nume_magazin"),
    supabase.from("productie_produse").select("id, nume, unitate_masura"),
    supabase.from("productie_clienti").select("id, nume_magazin, punct_livrare"),
  ]);

  const mapProduse = new Map<string, string>();
  (mapProduseData || []).forEach((r: any) =>
    mapProduse.set(String(r.cod_extern).trim().toLowerCase(), r.produs_id)
  );
  const mapMag = new Map<string, string>();
  (mapMagData || []).forEach((r: any) =>
    mapMag.set(String(r.cod_extern).trim().toLowerCase(), r.nume_magazin)
  );

  // Index produse după nume normalizat
  const produseByNume = new Map<string, string>(); // nume_norm -> produs_id
  (produseData || []).forEach((p: any) => {
    const k = norm(p.nume);
    if (k && !produseByNume.has(k)) produseByNume.set(k, p.id);
  });

  // Index clienți după nume magazin normalizat
  const clientiByNume = new Map<string, { id: string; punct: string }>();
  (clientiData || []).forEach((c: any) => {
    const k = norm(c.nume_magazin);
    if (k && !clientiByNume.has(k)) {
      clientiByNume.set(k, { id: c.id, punct: c.punct_livrare || "Standard" });
    }
  });

  let created = 0;
  let lines = 0;
  let skipped = 0;
  const autoCreatedProduse: string[] = [];
  const autoMappedProduse: string[] = [];
  const autoCreatedMagazine: string[] = [];
  const autoMappedMagazine: string[] = [];
  const errors: any[] = [];

  // Data de producție = azi (Europe/Bucharest)
  const todayBucharest = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Bucharest" })
  )
    .toISOString()
    .slice(0, 10);

  // Preîncarc liniile de producție active (pentru auto-distribuire)
  const { data: liniiActive } = await supabase
    .from("productie_linii")
    .select("id, nume, status")
    .eq("status", "activa")
    .order("nume");
  const primaLinieActiva = (liniiActive && liniiActive[0]) || null;

  // Preîncarc reguli distribuire produse->linie
  const { data: reguliData } = await supabase
    .from("productie_reguli_distribuire")
    .select("produs_id, linie_preferata_id, prioritate")
    .order("prioritate");
  const reguliByProdus = new Map<string, string>();
  const liniiActiveIds = new Set((liniiActive || []).map((l: any) => l.id));
  (reguliData || []).forEach((r: any) => {
    if (!reguliByProdus.has(r.produs_id) && liniiActiveIds.has(r.linie_preferata_id)) {
      reguliByProdus.set(r.produs_id, r.linie_preferata_id);
    }
  });

  // Fallback: dacă produsul nu are regulă, folosim ultima linie pe care a fost
  // alocat același produs (istoric). Astfel comenzile noi nu mai rămân "pending".
  const linieByIstoric = new Map<string, string>();
  try {
    const { data: istoric } = await supabase
      .from("productie_comenzi")
      .select("produs_id, linie_id, created_at")
      .not("linie_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(3000);
    for (const row of (istoric || []) as any[]) {
      if (!row.produs_id || !row.linie_id) continue;
      if (linieByIstoric.has(row.produs_id)) continue;
      if (!liniiActiveIds.has(row.linie_id)) continue;
      linieByIstoric.set(row.produs_id, row.linie_id);
    }
  } catch (e: any) {
    errors.push({ istoric_linii: e.message || String(e) });
  }
  const produseFaraLinie: string[] = [];



  // Backfill lazy: aliniem numar_comanda + data_productie pe rândurile senior-erp mai vechi.
  try {
    const { data: toFix } = await supabase
      .from("productie_comenzi")
      .select("id, extern_nr_aviz, extern_data_aviz, numar_comanda, data_productie")
      .eq("sursa", "senior-erp")
      .limit(400);
    for (const row of (toFix || []) as any[]) {
      const docNr = String(row.extern_nr_aviz || "").split("::")[0];
      const dataDoc = row.extern_data_aviz ? String(row.extern_data_aviz).slice(0, 10) : null;
      const patch: any = {};
      if (docNr && docNr !== row.numar_comanda) patch.numar_comanda = docNr;
      if (dataDoc && dataDoc !== String(row.data_productie || "").slice(0, 10)) patch.data_productie = dataDoc;
      if (Object.keys(patch).length) {
        await supabase.from("productie_comenzi").update(patch).eq("id", row.id);
      }
    }
  } catch (e: any) {
    errors.push({ backfill: e.message || String(e) });
  }


  // Rezolvă (sau creează) un client pornind de la aviz. Returnează { nume, punct } sau null.
  async function resolveMagazin(aviz: Aviz): Promise<{ nume: string; punct: string } | null> {
    const codExtern = (aviz.cod_magazin || "").trim();
    const numeErp = (aviz.nume_magazin || "").trim();
    if (!numeErp && !codExtern) return null;

    // 1) mapping după cod
    if (codExtern) {
      const mapped = mapMag.get(codExtern.toLowerCase());
      if (mapped) {
        const info = clientiByNume.get(norm(mapped));
        if (info) return { nume: mapped, punct: info.punct };
      }
    }

    // 2) match după nume normalizat
    const numeKey = norm(numeErp);
    const found = clientiByNume.get(numeKey);
    if (found) {
      // creează maparea (cod_extern -> nume) pentru viitor
      if (codExtern) {
        const { error: mErr } = await supabase.from("erp_mapping_magazine").insert({
          cod_extern: codExtern,
          denumire_extern: numeErp,
          nume_magazin: numeErp,
        });
        if (!mErr) {
          mapMag.set(codExtern.toLowerCase(), numeErp);
          if (!autoMappedMagazine.includes(numeErp)) autoMappedMagazine.push(numeErp);
        }
      }
      return { nume: numeErp, punct: found.punct };
    }

    // 3) creează client nou + mapping
    const { data: newClient, error: cErr } = await supabase
      .from("productie_clienti")
      .insert({
        nume_magazin: numeErp,
        punct_livrare: "Standard",
        adresa: "",
        telefon: "",
        email: "",
      })
      .select("id, nume_magazin, punct_livrare")
      .maybeSingle();
    if (cErr || !newClient) {
      errors.push({ aviz: aviz.nr_aviz, err: `client nou eșuat: ${cErr?.message}` });
      return null;
    }
    clientiByNume.set(numeKey, { id: newClient.id, punct: "Standard" });
    if (!autoCreatedMagazine.includes(numeErp)) autoCreatedMagazine.push(numeErp);

    if (codExtern) {
      const { error: mErr } = await supabase.from("erp_mapping_magazine").insert({
        cod_extern: codExtern,
        denumire_extern: numeErp,
        nume_magazin: numeErp,
      });
      if (!mErr) mapMag.set(codExtern.toLowerCase(), numeErp);
    }
    return { nume: numeErp, punct: "Standard" };
  }

  // Rezolvă (sau creează) un produs pornind de la linie. Returnează produs_id sau null.
  async function resolveProdus(linie: AvizLine): Promise<string | null> {
    const cod = String(linie.cod_produs || "").trim();
    const codKey = cod.toLowerCase();
    if (!codKey) return null;

    // 1) mapping după cod
    const mapped = mapProduse.get(codKey);
    if (mapped) return mapped;

    const denumire = (linie.denumire_produs || "").trim();
    if (!denumire) return null;
    const numeKey = norm(denumire);

    // 2) match după denumire
    let produsId = produseByNume.get(numeKey);
    if (produsId) {
      const { error: mErr } = await supabase.from("erp_mapping_produse").insert({
        cod_extern: cod,
        denumire_extern: denumire,
        produs_id: produsId,
      });
      if (!mErr) {
        mapProduse.set(codKey, produsId);
        const lbl = `${cod} — ${denumire}`;
        if (!autoMappedProduse.includes(lbl)) autoMappedProduse.push(lbl);
      }
      return produsId;
    }

    // 3) creează produs nou + mapping
    const { data: newProd, error: pErr } = await supabase
      .from("productie_produse")
      .insert({
        nume: denumire,
        descriere: `[auto-import Senior ERP · cod ${cod}]`,
        unitate_masura: linie.um || "buc",
      })
      .select("id")
      .maybeSingle();
    if (pErr || !newProd) {
      errors.push({ produs: cod, err: `produs nou eșuat: ${pErr?.message}` });
      return null;
    }
    produseByNume.set(numeKey, newProd.id);
    const { error: mErr } = await supabase.from("erp_mapping_produse").insert({
      cod_extern: cod,
      denumire_extern: denumire,
      produs_id: newProd.id,
    });
    if (!mErr) mapProduse.set(codKey, newProd.id);
    const lbl = `${cod} — ${denumire}`;
    if (!autoCreatedProduse.includes(lbl)) autoCreatedProduse.push(lbl);
    return newProd.id;
  }

  let updated = 0;
  let deleted = 0;

  for (const aviz of payload.avize) {
    try {
      if (!aviz.nr_aviz || !aviz.data_aviz || !aviz.nume_magazin) {
        errors.push({ aviz: aviz.nr_aviz, err: "câmpuri lipsă" });
        continue;
      }

      const mag = await resolveMagazin(aviz);
      if (!mag) continue;
      const numeMagazin = mag.nume;
      const punctLivrare = mag.punct;

      const dataOnly = String(aviz.data_aviz || "").slice(0, 10);
      const currentKeys: string[] = [];

      for (const linie of aviz.linii || []) {
        // Skip linii care nu sunt produse reale (reduceri, discount-uri, transport etc.)
        const denumireLower = String((linie as any).denumire_produs || "").toLowerCase();
        const codLower = String(linie.cod_produs || "").toLowerCase();
        const nonProductPatterns = ["reducere", "discount", "transport", "rabat", "bonificatie", "bonificație"];
        if (nonProductPatterns.some((p) => denumireLower.includes(p) || codLower.includes(p))) {
          skipped++;
          continue;
        }

        const produsId = await resolveProdus(linie);
        if (!produsId) continue;

        const externKey = `${aviz.nr_aviz}::${linie.cod_produs}`;
        currentKeys.push(externKey);
        const cantitate = Number(linie.cantitate) || 0;

        // Skip retururi (cantitate <= 0)
        if (cantitate <= 0) {
          skipped++;
          continue;
        }

        // Verifică dacă rândul există deja (upsert)
        const { data: existing } = await supabase
          .from("productie_comenzi")
          .select("id, cantitate, status, magazin, data_productie, produs_id")
          .eq("sursa", "senior-erp")
          .eq("extern_nr_aviz", externKey)
          .maybeSingle();

        if (existing) {
          const ex: any = existing;
          const oldQty = Number(ex.cantitate) || 0;
          const delta = cantitate - oldQty;
          const status = String(ex.status || "pending");
          const isPending = status === "pending";

          const patch: any = {};
          if (ex.magazin !== numeMagazin) {
            patch.magazin = numeMagazin;
            patch.punct_livrare = punctLivrare;
          }
          if (String(ex.data_productie || "").slice(0, 10) !== dataOnly) {
            patch.data_productie = dataOnly;
          }

          if (isPending) {
            // pending: simplu update cantitate
            if (oldQty !== cantitate) patch.cantitate = cantitate;
          } else {
            // non-pending (assigned/in_progress/completed): propagăm cu grijă
            if (delta > 0) {
              // Suplimentare: reafișăm delta pe linie
              patch.cantitate = cantitate;
              if (status === "completed") patch.status = "assigned";
            } else if (delta < 0) {
              // Redusă: dacă s-a produs mai mult decât cere Senior acum → excedent → restocare
              // Calculăm cât s-a produs deja din sesiuni_lucru
              let cantitateFacuta = 0;
              try {
                const { data: sesiuni } = await supabase
                  .from("productie_sesiuni_lucru")
                  .select("cantitate_produsa, status")
                  .eq("comanda_id", ex.id)
                  .in("status", ["finalizata", "partial"]);
                for (const s of (sesiuni || []) as any[]) {
                  cantitateFacuta += Number(s.cantitate_produsa || 0);
                }
              } catch (_) {}
              const excedent = Math.max(0, cantitateFacuta - cantitate);
              if (excedent > 0) {
                try {
                  await supabase.from("productie_restocari").insert({
                    comanda_originala_id: ex.id,
                    produs_id: ex.produs_id,
                    cantitate_surplus: excedent,
                    data_productie: dataOnly,
                    status: "disponibil",
                  });
                } catch (e: any) {
                  errors.push({ aviz: aviz.nr_aviz, produs: linie.cod_produs, restock_reduce: e.message });
                }
              }
              patch.cantitate = cantitate;
              // dacă noul necesar e deja acoperit de ce s-a făcut → completed
              if (cantitate <= cantitateFacuta - excedent + 0.0001) {
                patch.status = "completed";
              } else if (status === "completed") {
                patch.status = "assigned";
              }
            }
          }

          if (Object.keys(patch).length) {
            const { error: uErr } = await supabase
              .from("productie_comenzi")
              .update(patch)
              .eq("id", ex.id);
            if (uErr) errors.push({ aviz: aviz.nr_aviz, produs: linie.cod_produs, upd: uErr.message });
            else updated++;
          } else {
            skipped++;
          }
          continue;
        }

        // 1) Alocare din restocări (surplus disponibil) - doar la INSERT nou
        let cantitateRamasa = cantitate;
        let cantitateDinRestock = 0;
        try {
          const { data: restocariDisp } = await supabase
            .from("productie_restocari")
            .select("id, cantitate_surplus, status")
            .eq("produs_id", produsId)
            .eq("status", "disponibil")
            .gt("cantitate_surplus", 0)
            .order("created_at");
          for (const r of restocariDisp || []) {
            if (cantitateRamasa <= 0) break;
            const surplus = Number((r as any).cantitate_surplus || 0);
            if (surplus <= 0) continue;
            const folosit = Math.min(cantitateRamasa, surplus);
            cantitateDinRestock += folosit;
            cantitateRamasa -= folosit;
            if (folosit >= surplus) {
              await supabase
                .from("productie_restocari")
                .update({ status: "redistribuit", cantitate_surplus: 0 })
                .eq("id", (r as any).id);
            } else {
              await supabase
                .from("productie_restocari")
                .update({ cantitate_surplus: surplus - folosit })
                .eq("id", (r as any).id);
            }
          }
        } catch (e: any) {
          errors.push({ aviz: aviz.nr_aviz, produs: linie.cod_produs, restocari: e.message });
        }

        // 2) Status + linie
        let statusFinal: string = "pending";
        let linieId: string | null = null;
        if (cantitateRamasa === 0 && cantitate > 0) {
          statusFinal = "completed";
        } else {
          const linieRegula = reguliByProdus.get(produsId) || linieByIstoric.get(produsId);
          if (linieRegula) {
            linieId = linieRegula;
            statusFinal = "assigned";
            // memorez pentru liniile următoare din același import
            if (!reguliByProdus.has(produsId)) reguliByProdus.set(produsId, linieRegula);
          } else {
            const nume = (linie.denumire_produs || linie.cod_produs || "").trim();
            if (nume && !produseFaraLinie.includes(nume)) produseFaraLinie.push(nume);
          }
        }


        // 3) INSERT
        const { data: inserted, error } = await supabase
          .from("productie_comenzi")
          .insert({
            numar_comanda: aviz.nr_aviz,
            magazin: numeMagazin,
            punct_livrare: punctLivrare,
            produs_id: produsId,
            cantitate,
            baxare: linie.observatie || null,
            status: statusFinal,
            linie_id: linieId,
            cantitate_din_restock: cantitateDinRestock,
            data_productie: dataOnly,
            created_at: dataOnly,
            sursa: "senior-erp",
            extern_nr_aviz: externKey,
            extern_data_aviz: dataOnly,
          })
          .select("id")
          .maybeSingle();
        if (error) {
          errors.push({ aviz: aviz.nr_aviz, produs: linie.cod_produs, err: error.message });
        } else {
          if (inserted?.id) {
            await supabase
              .from("productie_comenzi")
              .update({ numar_comanda: aviz.nr_aviz, data_productie: dataOnly })
              .eq("id", inserted.id);
          }
          lines++;
        }
      }

      // Liniile care nu mai există în Senior pentru acest aviz:
      //  - pending → DELETE
      //  - non-pending: mutăm ce s-a produs pe restocare, marcăm cantitate=0 + status='canceled_by_erp'
      try {
        const { data: existingForAviz } = await supabase
          .from("productie_comenzi")
          .select("id, extern_nr_aviz, status, produs_id, cantitate")
          .eq("sursa", "senior-erp")
          .like("extern_nr_aviz", `${aviz.nr_aviz}::%`);
        const disparute = (existingForAviz || []).filter(
          (r: any) => !currentKeys.includes(r.extern_nr_aviz)
        );
        for (const r of disparute as any[]) {
          if (r.status === "pending") {
            const { error: dErr } = await supabase
              .from("productie_comenzi")
              .delete()
              .eq("id", r.id);
            if (!dErr) deleted++;
            continue;
          }
          // non-pending: calculăm cât s-a produs → restocăm
          let cantitateFacuta = 0;
          try {
            const { data: sesiuni } = await supabase
              .from("productie_sesiuni_lucru")
              .select("cantitate_produsa, status")
              .eq("comanda_id", r.id)
              .in("status", ["finalizata", "partial"]);
            for (const s of (sesiuni || []) as any[]) {
              cantitateFacuta += Number(s.cantitate_produsa || 0);
            }
          } catch (_) {}
          if (cantitateFacuta > 0) {
            try {
              await supabase.from("productie_restocari").insert({
                comanda_originala_id: r.id,
                produs_id: r.produs_id,
                cantitate_surplus: cantitateFacuta,
                data_productie: dataOnly,
                status: "disponibil",
              });
            } catch (e: any) {
              errors.push({ aviz: aviz.nr_aviz, restock_delete: e.message });
            }
          }
          const { error: uErr } = await supabase
            .from("productie_comenzi")
            .update({ cantitate: 0, status: "canceled_by_erp" })
            .eq("id", r.id);
          if (!uErr) deleted++;
        }
      } catch (e: any) {
        errors.push({ aviz: aviz.nr_aviz, del: e.message });
      }

      created++;
    } catch (e: any) {
      errors.push({ aviz: aviz.nr_aviz, err: e.message || String(e) });
    }
  }

  // ------------------------------------------------------------------
  // Pass final: descarc surplusul din restocări pe comenzile deschise
  // (inclusiv comenzi create anterior care nu au primit alocare la insert).
  // ------------------------------------------------------------------
  let restockAlocat = 0;
  try {
    const { data: restDisp } = await supabase
      .from("productie_restocari")
      .select("id, produs_id, cantitate_surplus")
      .eq("status", "disponibil")
      .gt("cantitate_surplus", 0)
      .order("created_at");

    const restByProdus = new Map<string, any[]>();
    for (const r of (restDisp || []) as any[]) {
      const arr = restByProdus.get(r.produs_id) || [];
      arr.push(r);
      restByProdus.set(r.produs_id, arr);
    }

    if (restByProdus.size > 0) {
      const { data: openOrders } = await supabase
        .from("productie_comenzi")
        .select("id, produs_id, cantitate, cantitate_din_restock, status")
        .in("status", ["pending", "assigned"])
        .in("produs_id", Array.from(restByProdus.keys()))
        .gt("cantitate", 0)
        .order("data_productie", { ascending: true })
        .limit(500);

      for (const o of (openOrders || []) as any[]) {
        const pool = restByProdus.get(o.produs_id) || [];
        let necesar = Number(o.cantitate || 0) - Number(o.cantitate_din_restock || 0);
        if (necesar <= 0) continue;
        let folositTotal = 0;
        for (const r of pool) {
          if (necesar <= 0) break;
          const surplus = Number(r.cantitate_surplus || 0);
          if (surplus <= 0) continue;
          const folosit = Math.min(necesar, surplus);
          r.cantitate_surplus = surplus - folosit;
          necesar -= folosit;
          folositTotal += folosit;
          if (r.cantitate_surplus <= 0) {
            await supabase
              .from("productie_restocari")
              .update({ status: "redistribuit", cantitate_surplus: 0 })
              .eq("id", r.id);
          } else {
            await supabase
              .from("productie_restocari")
              .update({ cantitate_surplus: r.cantitate_surplus })
              .eq("id", r.id);
          }
        }
        if (folositTotal > 0) {
          const nouRestock = Number(o.cantitate_din_restock || 0) + folositTotal;
          const patch: any = { cantitate_din_restock: nouRestock };
          if (nouRestock >= Number(o.cantitate || 0) - 0.0001) patch.status = "completed";
          await supabase.from("productie_comenzi").update(patch).eq("id", o.id);
          restockAlocat += folositTotal;
        }
      }
    }
  } catch (e: any) {
    errors.push({ restock_pass: e.message || String(e) });
  }


  // Log rulare
  await supabase.from("erp_import_log").insert({
    avize_primite: payload.avize.length,
    comenzi_create: created,
    linii_create: lines,
    skipped_duplicat: skipped,
    unmapped_produse: [
      ...autoCreatedProduse.map((s) => `[NOU] ${s}`),
      ...autoMappedProduse.map((s) => `[MAP] ${s}`),
    ],
    unmapped_magazine: [
      ...autoCreatedMagazine.map((s) => `[NOU] ${s}`),
      ...autoMappedMagazine.map((s) => `[MAP] ${s}`),
    ],
    erori: errors,
    bridge_version: payload.bridge_version || null,
    bridge_host: payload.bridge_host || null,
  });

  return json({
    ok: true,
    avize_primite: payload.avize.length,
    comenzi_create: created,
    linii_create: lines,
    linii_actualizate: updated,
    linii_sterse: deleted,
    restock_alocat: restockAlocat,
    produse_fara_linie: produseFaraLinie,

    skipped_duplicat: skipped,
    produse_auto_create: autoCreatedProduse,
    produse_auto_map: autoMappedProduse,
    magazine_auto_create: autoCreatedMagazine,
    magazine_auto_map: autoMappedMagazine,
    unmapped_produse: [],
    unmapped_magazine: [],
    erori: errors,
  });
});

