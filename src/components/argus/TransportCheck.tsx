import { differs, distributionCheck, LEAF_PALLET_KG, supplyCheck } from "../../../supabase/functions/_shared/transportCheck";

const f = (v: number | null | undefined, d = 2) => (v == null || !Number.isFinite(v) ? "—" : v.toLocaleString("ro-RO", { minimumFractionDigits: d, maximumFractionDigits: d }));

/** The transport tariffs of the fields above, recomputed step by step with the same numbers, so they can be checked with a calculator. */
export function TransportCheck({ values, basis, route }: { values: Record<string, string>; basis: "pallet" | "kg"; route: string }) {
  const s = supplyCheck(values), d = distributionCheck(values);
  return (
    <div className="mt-3 space-y-2 rounded-md border bg-muted/40 p-3 text-xs">
      <p className="font-medium">Verificare transport · aceleași cifre ca în câmpurile de mai sus</p>
      <div className="space-y-0.5">
        <p className="font-medium">Aprovizionare</p>
        <p>Lei/palet = {f(s.cost)} lei/camion ÷ {f(s.pallets, 2)} paleți/camion = <b>{f(s.perPallet, 4)}</b>
          {differs(s.perPallet, s.shownPerPallet) && <span className="text-crm-warning"> · câmpul are {f(s.shownPerPallet, 4)}, scris de mână</span>}</p>
        <p>Lei/kg = {f(s.cost)} lei/camion ÷ {f(s.kg, 0)} kg/camion = <b>{f(s.perKg, 4)}</b>
          {differs(s.perKg, s.shownPerKg) && <span className="text-crm-warning"> · câmpul are {f(s.shownPerKg, 4)}, scris de mână</span>}</p>
        {s.avgPalletKg != null && s.perKg != null && (
          <p className="text-muted-foreground">
            Un palet mediu din comenzi are {f(s.kg, 0)} kg ÷ {f(s.pallets, 2)} paleți = {f(s.avgPalletKg, 1)} kg, pentru că se amestecă frunze ({LEAF_PALLET_KG} kg), căpățâni (400 kg) și radicchio (500 kg).
            {" "}Deci lei/palet = lei/kg × {f(s.avgPalletKg, 1)} kg, nu × {LEAF_PALLET_KG} kg. Un palet de frunze ar costa {f(s.leafPalletByKg)} lei dacă plătești pe kg, dar {f(s.perPallet)} lei dacă plătești pe palet, fiindcă ocupă tot un loc în camion.
            {" "}Acum se folosește <b>{basis === "pallet" ? "pe palet" : "pe kg"}</b> (alegi la „Aprovizionare în total”).
          </p>
        )}
      </div>
      <div className="space-y-0.5">
        <p className="font-medium">Distribuție · {route}</p>
        {d.perTrip != null && d.palletsPerTrip
          ? <p>Lei/palet = {f(d.cost)} lei ÷ {f(d.trips, 0)} curse = {f(d.perTrip)} lei/cursă, ÷ {f(d.palletsPerTrip, 2)} paleți/cursă = <b>{f(d.perPallet, 4)}</b></p>
          : d.perPallet != null
            ? <p>Lei/palet = {f(d.cost)} lei ÷ {f(d.pallets, 1)} paleți = <b>{f(d.perPallet, 4)}</b> (media magazinelor clientului, ponderată cu paleții livrați fiecăruia; tariful fiecărei curse e în tabelul „Curse distribuție” de mai jos)</p>
            : d.shownPerPallet != null
              ? <p>Lei/palet = <b>{f(d.shownPerPallet, 4)}</b>: media tarifelor de cursă ale magazinelor care au cumpărat produsul, ponderată cu bucățile vândute fiecăruia. Tariful fiecărei curse e în tabelul „Curse distribuție” de mai jos, iar fiecare magazin în „Rentabilitate pe magazine”.</p>
              : <p className="text-muted-foreground">Fără cost sau paleți pentru cursa aleasă.</p>}
        {d.perPallet != null && differs(d.perPallet, d.shownPerPallet) && <p className="text-crm-warning">Câmpul „Tarif distribuție” are {f(d.shownPerPallet, 4)}, scris de mână sau media pe produs.</p>}
      </div>
    </div>
  );
}
