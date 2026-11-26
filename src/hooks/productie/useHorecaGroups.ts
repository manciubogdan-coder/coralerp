import { useQuery } from '@tanstack/react-query';
import { readHorecaGroups } from '@/lib/productie/horecaGroups';
export const HORECA_GROUPS_KEY = ['horeca-groups'] as const;
export const useHorecaGroups = () => useQuery({ queryKey: HORECA_GROUPS_KEY, queryFn: readHorecaGroups, staleTime: 30_000, refetchInterval: 60_000 });