// Argus tool: exact price sheet computed by code from Senior data (same engine as the Calculator Preț screen).
import { jsonSchema, tool } from "npm:ai@7.0.123";
import { computeSheet } from "../_shared/priceSheet.ts";
import { defaultRates, findArticles, findPartners, priceCalcData } from "../_shared/priceCalcSenior.ts";

type C = { cloud: any; legacy: any; legacyUser?: any };

export function priceTools(c: C) {
  return {
    calculeaza_pret: tool({
      description: "Fișă de preț EXACTĂ calculată de program din Senior pentru un produs finit (per bax și per bucată): materie primă cu pierdere, transport aprovizionare, ambalaje, manoperă, utilități, preț poartă fabrică cu marjă, cost logistic, taxe client, preț livrare RON/EUR, istoric preț vânzare lunar și lista de preț. Folosește-l pentru ORICE calcul de cost/preț; prezintă cifrele exact cum le întoarce, nu le recalcula. Dacă întoarce 'alege', cere utilizatorului să aleagă.",
      inputSchema: jsonSchema<{ produs: string; client: string | null; an: number | null; luna: number | null; marja: number | null }>({
        type: "object", additionalProperties: false, required: ["produs", "client", "an", "luna", "marja"],
        properties: {
          produs: { type: "string", minLength: 2, maxLength: 120, description: "Denumire sau cuvinte din denumirea produsului finit din Senior, ex. 'busuioc 100 bulgaria'" },
          client: { type: ["string", "null"], maxLength: 120, description: "Client Senior (opțional)" },
          an: { type: ["integer", "null"] }, luna: { type: ["integer", "null"], minimum: 1, maximum: 12 },
          marja: { type: ["number", "null"], minimum: 0, maximum: 90, description: "Marjă brută % din prețul de vânzare" },
        },
      }),
      execute: async ({ produs, client, an, luna, marja }) => {
        try {
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
          const d = await priceCalcData(c.cloud, c.legacyUser ?? c.legacy, { articolId: art.id, partnerId: partner?.id ?? null, year: an ?? now.getFullYear(), month: luna ?? now.getMonth() + 1 });
          const sheet = computeSheet({ unitsPerCase: d.product.unitsPerCase, components: d.components, rates: defaultRates(d, marja ?? 0) });
          const lastSale = [...d.salesHistory].reverse().find((h) => h.price != null) ?? null;
          return {
            produs: d.product.name, client: partner ? String(partner.name).trim() : "toți clienții", bucati_bax: d.product.unitsPerCase,
            perioada_tarife: `${d.period.from}–${d.period.to}`,
            fisa_per_bax_RON: sheet.lines.map((l) => ({ rand: l.label, valoare: l.value, detaliu: l.detail })),
            cost_productie: sheet.productionCost, pret_poarta_fabrica: sheet.factoryGate, cost_logistic: sheet.logistics,
            pret_final_livrare: sheet.delivered, taxe_client: sheet.clientFees, pret_livrare_client_RON: sheet.clientPrice,
            pret_livrare_client_EUR: sheet.clientPriceEur, curs_EUR_folosit: sheet.eurEffective, per_bucata: sheet.perPiece,
            preturi_lipsa: sheet.missingPrices,
            surse_tarife: Object.fromEntries(Object.entries(d.rates).map(([k, r]) => [k, { valoare: r.value, total_RON: Math.round(r.total), volum: Math.round(r.volume), unitate: r.unit, conturi: r.accounts.map((a) => `${a.cont} ${a.name}`) }])),
            ultimul_pret_vanzare_buc: lastSale, istoric_vanzare: d.salesHistory, lista_pret: d.priceList,
            nota: "Tarifele de manoperă/utilități/logistică sunt medii pe 12 luni din contabilitatea Senior împărțite la bucățile vândute; detaliile pe ecranul Argus → Calculator preț.",
          };
        } catch (e) { return { eroare: (e as Error).message }; }
      },
    }),
  };
}
