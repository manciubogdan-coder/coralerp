// Plain-number check of the transport tariffs shown in the price list fields, so the user can verify them by hand.

/** Leaf pallet norm (frunze / baby leaf / aromate), the most common supply pallet. */
export const LEAF_PALLET_KG = 220;

const val = (v: string | number | null | undefined) => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const div = (a: number | null, b: number | null) => (a != null && b != null && b > 0 ? a / b : null);

/** Supply: lei/palet = cost per truck ÷ pallets per truck; lei/kg = cost per truck ÷ kg per truck.
 * The two only agree for a pallet of the average weight (kg per truck ÷ pallets per truck), never for every range. */
export function supplyCheck(f: Record<string, string | number | undefined>) {
  const cost = val(f.supplyTotal), pallets = val(f.supplyPallets), kg = val(f.supplyKg);
  const perPallet = div(cost, pallets), perKg = div(cost, kg), avgKg = div(kg, pallets);
  return {
    cost, pallets, kg, perPallet, perKg, avgPalletKg: avgKg,
    /** What a leaf pallet would cost if supply were charged per kg. */
    leafPalletByKg: perKg != null ? perKg * LEAF_PALLET_KG : null,
    shownPerPallet: val(f.supplyPerPallet), shownPerKg: val(f.supplyPerKg),
  };
}

/** Distribution: lei/palet = (cost ÷ trips) ÷ pallets per trip; without trips (client average) cost ÷ pallets. */
export function distributionCheck(f: Record<string, string | number | undefined>) {
  const cost = val(f.distributionTotal), trips = val(f.distributionTrips), ppt = val(f.distributionPalletsPerTrip), pallets = val(f.distributionPallets);
  const perTrip = div(cost, trips);
  const perPallet = perTrip != null && ppt ? perTrip / ppt : div(cost, pallets);
  return { cost, trips, perTrip, palletsPerTrip: ppt, pallets, perPallet, shownPerPallet: val(f.distributionPerPallet) };
}

/** True when the field holds a value that the formula does not give (typed by hand). */
export const differs = (computed: number | null, shown: number | null) => computed != null && shown != null && Math.abs(computed - shown) > 0.005;
