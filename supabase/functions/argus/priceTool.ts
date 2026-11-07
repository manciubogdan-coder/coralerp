// Argus tool: exact price sheet computed by code from Senior data (same engine as the Calculator Preț screen).
import { jsonSchema, tool } from "npm:ai@7.0.123";
import { defaultRates, findArticles, findPartners, priceCalcData } from "../_shared/priceCalcSenior.ts";
import { configuredSheet, validPriceConfig } from "../_shared/priceConfig.ts";
import { prefilledConfig } from "../_shared/priceDefaults.ts";
import { DEFAULT_MARGIN_PCT } from "../_shared/priceList.ts";

type C = { cloud: any; legacy: any; legacyUser?: any };

export function priceTools(c: C) {
  return {
    calculeaza_pret: tool({
      description: "Fișă de preț EXACTĂ calculată de program din Senior pentru un produs finit (per bax și per bucată): materie primă cu pierdere, transport aprovizionare, ambalaje, manoperă, utilități, preț poartă fabrică cu marjă, cost logistic, taxe client, preț livrare RON/EUR, istoric preț vânzare lunar și lista de preț. Folosește-l pentru ORICE calcul de cost/preț; prezintă cifrele exact cum le întoarce, nu le recalcula. Dacă întoarce 'alege', cere utilizatorului să aleagă.",
      inputSchema: jsonSchema<{ produs: string; client: string | null; an: number | null; luna: number | null; marja: number | null; configurare: string | null }>({
        type: "object", additionalProperties: false, required: ["produs", "client", "an", "luna", "marja", "configurare"],
        properties: {
          configurare: { type: ["string", "null"], description: "JSON opțional: rawPriceMode annual/week, labourLine (Giostra, Flowpack, Multihead — Monoprodus, Spanac Mare, Aromate, Vracuri / Gastro), route = cursa Senior (BUCURESTI, PLOIESTI, ROMAN, TURDA, TURDA-IERNUT, LUGOJ, TIMISOARA, CRAIOVA, FOCSANI, HORECA, BULGARIA, MOLDOVA ICS; implicit propusă după magazinul clientului) sau România pentru media internă, distributionPalletsPerTrip, unitsPerCase, piecesPerPallet, supplyPerPallet, distributionPerPallet, feePct, rates {labourPerPiece, utilitiesPerPiece,...}, components {ID:{price,qty,lossPct,kgPerPallet}}. Doar valori confirmate; cere datele lipsă, nu inventa." },
          produs: { type: "string", minLength: 2, maxLength: 120, description: "Denumire sau cuvinte din denumirea produsului finit din Senior, ex. 'busuioc 100 bulgaria'" },
          client: { type: ["string", "null"], maxLength: 120, description: "Client Senior (opțional)" },
          an: { type: ["integer", "null"] }, luna: { type: ["integer", "null"], minimum: 1, maximum: 12 },
          marja: { type: ["number", "null"], minimum: 0, maximum: 90, description: "Marjă brută % din prețul de vânzare (implicit 15)" },
        },
      }),
      execute: async ({ produs, client, an, luna, marja, configurare }) => {
        try {
          const config = configurare ? validPriceConfig(JSON.parse(configurare)) : {};
          if (!config) throw new Error("Configurare preț invalidă.");
          const arts = await findArticles(c.cloud, produs);
          if (!arts.length) return { eroare: "Niciun produs finit cu rețetă activă în Senior pentru aceste cuvinte." };
          if (arts.length > 1 && !arts.some((a: any) => String(a.name).trim().toLowerCase() === produs.trim().toLowerCase())) {
            return { alege: "Mai multe produse se potrivesc; cere utilizatorului să aleagă exact unul.", produse: arts.map((a: any) => String(a.name).trim()) };
          }
          const art = arts.find((a: any) => String(a.name).trim().toLowerCase() === produs.trim().toLowerCase()) ?? arts[0];
          let partner: any = null;
          if (client) {
            const ps = await findPartners(c.cloud, client);
            if (!ps.length) return { eroare: `Clientul „${client}" nu există în Senior.` };
            if (ps.length > 1 && !ps.some((p: any) => String(p.name).trim().toLowerCase() === client.trim().toLowerCase())) {
              return { alege: "Mai mulți clienți se potrivesc; cere utilizatorului să aleagă.", clienti: ps.map((p: any) => String(p.name).trim()) };
            }
            partner = ps.find((p: any) => String(p.name).trim().toLowerCase() === client.trim().toLowerCase()) ?? ps[0];
          }
          const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Bucharest" }));
          const d = await priceCalcData(c.cloud, c.legacyUser ?? c.legacy, { articolId: art.id, partnerId: partner?.id ?? null, storeId: partner?.id ?? null, year: an ?? now.getFullYear(), month: luna ?? now.getMonth() + 1, rawPriceMode: config.rawPriceMode });
          const margin = marja ?? config.rates?.marginPct ?? DEFAULT_MARGIN_PCT;
          const { sheet } = configuredSheet(d, defaultRates(d, margin), prefilledConfig(d, { ...config, rates: { ...config.rates, marginPct: margin } }));
          const lastSale = [...d.salesHistory].reverse().find((h) => h.price != null) ?? null;
          return {
            produs: d.product.name, client: partner ? String(partner.name).trim() : "toți clienții", bucati_bax: d.product.unitsPerCase,
            perioada_transport: `ultimele prețuri: facturi ${d.logistics.closedStart} – ${d.logistics.closedEnd} (exclusiv)`,
            fisa_per_bax_RON: sheet.lines.map((l) => ({ rand: l.label, valoare: l.value, detaliu: l.detail })),
            cost_productie: sheet.productionCost, marja_bruta_procent: margin, marja_bruta_RON_bax: sheet.grossMargin, pret_poarta_fabrica: sheet.factoryGate, cost_logistic: sheet.logistics,
            pret_final_livrare: sheet.delivered, taxe_client: sheet.clientFees, pret_livrare_client_RON: sheet.clientPrice,
            pret_livrare_client_EUR: sheet.clientPriceEur, curs_EUR_folosit: sheet.eurEffective, per_bucata: sheet.perPiece,
            preturi_lipsa: sheet.missingPrices,
            fisa_completa: sheet.complete, parametri_lipsa: sheet.missingInputs,
            transport: { aprovizionare: d.logistics.supply, cursa: d.defaults.route, ultimele_camioane: d.logistics.lastTrucks },
            ultimul_pret_vanzare_buc: lastSale, istoric_vanzare: d.salesHistory, lista_pret: d.priceList,
            nota: "Materii prime anual/săptămânal, ambalaje ultima intrare, manoperă document octombrie 2026, transport din ultimele facturi (30 de zile) pe palet și cursă. Marja brută și profitul se prezintă separat. Dacă fisa_completa=false, totalurile sunt parțiale; nu prezenta un preț final validat.",
          };
        } catch (e) { return { eroare: (e as Error).message }; }
      },
    }),
  };
}
