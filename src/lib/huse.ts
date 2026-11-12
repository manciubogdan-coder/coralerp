export type HusaTip = "intrare" | "predare" | "retur" | "pierdere";
export type HusaZona = "picking" | "depozit_mp";

export interface HusaMiscare {
  id?: string;
  occurred_at: string;
  tip: HusaTip;
  cantitate: number;
  zona: HusaZona;
  persoana?: string | null;
  destinatie?: string | null;
  document?: string | null;
  observatii?: string | null;
  created_by_email?: string | null;
}

export const ZONA_LABEL: Record<HusaZona, string> = { picking: "Picking", depozit_mp: "Depozit MP" };
export const TIP_LABEL: Record<HusaTip, string> = {
  intrare: "Intrare în gestiune",
  predare: "Predată",
  retur: "Returnată",
  pierdere: "Pierdută / casată",
};

/** Stock in warehouse = intrări − predări + retururi. Pierderi reduce what people still hold. */
export function husaBalance(rows: HusaMiscare[]) {
  let intrate = 0, predate = 0, returnate = 0, pierdute = 0;
  const perPersoana = new Map<string, { persoana: string; predate: number; returnate: number; pierdute: number; afara: number; ultima?: string }>();
  for (const r of rows) {
    const q = Number(r.cantitate) || 0;
    if (r.tip === "intrare") intrate += q;
    else {
      const key = (r.persoana || "Necunoscut").trim();
      const p = perPersoana.get(key.toLowerCase()) || { persoana: key, predate: 0, returnate: 0, pierdute: 0, afara: 0 };
      if (r.tip === "predare") { predate += q; p.predate += q; if (!p.ultima || r.occurred_at > p.ultima) p.ultima = r.occurred_at; }
      if (r.tip === "retur") { returnate += q; p.returnate += q; }
      if (r.tip === "pierdere") { pierdute += q; p.pierdute += q; }
      // Returul peste ce s-a predat e permis (huse venite de la mai mulți); nimeni nu poate datora sub 0.
      p.afara = Math.max(0, p.predate - p.returnate - p.pierdute);
      perPersoana.set(key.toLowerCase(), p);
    }
  }
  const persoane = [...perPersoana.values()];
  return {
    intrate, predate, returnate, pierdute,
    inDepozit: intrate - predate + returnate,
    afara: persoane.reduce((s, p) => s + p.afara, 0),
    total: intrate - pierdute,
    persoane: persoane.sort((a, b) => b.afara - a.afara),
  };
}
