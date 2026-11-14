import { useQuery } from "@tanstack/react-query";
import { argusFetch } from "@/lib/argusApi";
import type { PalletInfo } from "@/lib/viziune/warehouseState";

/** Pallet sizes (Senior pieces/pallet, raw-material kg/pallet rules); read only when a warehouse panel is open. */
export function useWarehousePallets(rawNames: string[], productIds: string[], enabled: boolean) {
  const names = [...new Set(rawNames)].sort();
  const products = [...new Set(productIds)].sort();
  return useQuery({
    queryKey: ["viziune-pallets", names.join("|"), products.join("|")],
    enabled,
    staleTime: 30 * 60_000,
    placeholderData: (prev) => prev,
    queryFn: () => argusFetch<PalletInfo>("viziune_pallets", {}, { names, products }),
  });
}
