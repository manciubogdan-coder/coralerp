import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { argusFetch } from "@/lib/argusApi";
import { buildOffices, type RawOffices } from "@/lib/viziune/officeState";

/** Offices for Viziune: app activity and Senior documents of today, refreshed every minute. */
export function useOfficeData() {
  const q = useQuery({
    queryKey: ["viziune-birouri"],
    queryFn: () => argusFetch<RawOffices>("viziune_offices"),
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 3,
    retryDelay: (n) => Math.min(15_000, 2_000 * 2 ** n),
  });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  const view = useMemo(() => buildOffices(q.data, now), [q.data, now]);
  return { ...view, loading: q.isLoading, error: q.error as Error | null, updatedAt: q.dataUpdatedAt, refetch: q.refetch };
}
export type OfficeData = ReturnType<typeof useOfficeData>;
