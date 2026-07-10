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
  if (!payload || !Array.isArray(payload.avize)) {
    return json({ error: "Missing avize[]" }, 400);
  }

  const supabase = createClient(LEGACY_URL, LEGACY_ANON);

  // Preload mappings
  const [{ data: mapProduseData }, { data: mapMagData }, { data: clientiData }] =
    await Promise.all([
      supabase.from("erp_mapping_produse").select("cod_extern, produs_id"),
      supabase.from("erp_mapping_magazine").select("cod_extern, nume_magazin"),
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
  const magazinePunct = new Map<string, string>();
  (clientiData || []).forEach((c: any) => {
    const key = String(c.nume_magazin || "").trim().toLowerCase();
    if (key && !magazinePunct.has(key)) {
      magazinePunct.set(key, c.punct_livrare || "Standard");
    }
  });

  let created = 0;
  let lines = 0;
  let skipped = 0;
  const unmappedProduse: string[] = [];
  const unmappedMagazine: string[] = [];
  const errors: any[] = [];

  for (const aviz of payload.avize) {
    try {
      if (!aviz.nr_aviz || !aviz.data_aviz || !aviz.nume_magazin) {
        errors.push({ aviz: aviz.nr_aviz, err: "câmpuri lipsă" });
        continue;
      }

      // Rezolvă numele magazinului: din mapping dacă există, altfel folosește nume_magazin direct
      let numeMagazin = aviz.nume_magazin.trim();
      if (aviz.cod_magazin) {
        const mapped = mapMag.get(aviz.cod_magazin.trim().toLowerCase());
        if (mapped) numeMagazin = mapped;
      }
      const punctLivrare =
        magazinePunct.get(numeMagazin.toLowerCase()) || "Standard";
      if (!magazinePunct.has(numeMagazin.toLowerCase())) {
        if (!unmappedMagazine.includes(numeMagazin)) unmappedMagazine.push(numeMagazin);
      }

      for (const linie of aviz.linii || []) {
        const codKey = String(linie.cod_produs || "").trim().toLowerCase();
        if (!codKey) continue;
        const produsId = mapProduse.get(codKey);
        if (!produsId) {
          const label = `${linie.cod_produs}${
            linie.denumire_produs ? " — " + linie.denumire_produs : ""
          }`;
          if (!unmappedProduse.includes(label)) unmappedProduse.push(label);
          continue;
        }

        // Inserare comandă cu ON CONFLICT DO NOTHING pe (sursa, extern_nr_aviz)+produs
        // Facem check manual: dacă există deja o comandă pentru acest aviz+produs, skip.
        const externKey = `${aviz.nr_aviz}::${linie.cod_produs}`;
        const { data: existing } = await supabase
          .from("productie_comenzi")
          .select("id")
          .eq("sursa", "senior-erp")
          .eq("extern_nr_aviz", externKey)
          .maybeSingle();
        if (existing) {
          skipped++;
          continue;
        }

        const dataOnly = String(aviz.data_aviz || "").slice(0, 10);
        const { error } = await supabase.from("productie_comenzi").insert({
          magazin: numeMagazin,
          punct_livrare: punctLivrare,
          produs_id: produsId,
          cantitate: Number(linie.cantitate) || 0,
          baxare: linie.observatie || null,
          status: "pending",
          data_productie: dataOnly,
          sursa: "senior-erp",
          extern_nr_aviz: externKey,
          extern_data_aviz: dataOnly,
        });
        if (error) {
          errors.push({ aviz: aviz.nr_aviz, produs: linie.cod_produs, err: error.message });
        } else {
          lines++;
        }
      }
      created++;
    } catch (e: any) {
      errors.push({ aviz: aviz.nr_aviz, err: e.message || String(e) });
    }
  }

  // Log rulare
  await supabase.from("erp_import_log").insert({
    avize_primite: payload.avize.length,
    comenzi_create: created,
    linii_create: lines,
    skipped_duplicat: skipped,
    unmapped_produse: unmappedProduse,
    unmapped_magazine: unmappedMagazine,
    erori: errors,
    bridge_version: payload.bridge_version || null,
    bridge_host: payload.bridge_host || null,
  });

  return json({
    ok: true,
    avize_primite: payload.avize.length,
    comenzi_create: created,
    linii_create: lines,
    skipped_duplicat: skipped,
    unmapped_produse: unmappedProduse,
    unmapped_magazine: unmappedMagazine,
    erori: errors,
  });
});
