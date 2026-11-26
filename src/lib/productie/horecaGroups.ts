import { argusFetch } from '@/lib/argusApi';
import { loadHorecaGroups } from '../../../supabase/functions/_shared/horecaGroupConfig';
import type { HorecaGroupDefinition } from '../../../supabase/functions/_shared/horecaRules';
import { loadHorecaRouting as routing } from '../../../supabase/functions/_shared/horecaRouting';
export { loadHorecaGroups };
export const readHorecaGroups = () => argusFetch<{ groups: HorecaGroupDefinition[]; version: number }>('horeca_groups_read');
export const loadHorecaRouting = async (client: any) => routing(client, (await readHorecaGroups()).groups);