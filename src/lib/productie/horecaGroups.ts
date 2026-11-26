import { supabaseCloud } from '@/integrations/supabase/cloudClient';
import { loadHorecaGroups } from '../../../supabase/functions/_shared/horecaGroupConfig';
import { loadHorecaRouting as routing } from '../../../supabase/functions/_shared/horecaRouting';
export { loadHorecaGroups };
export const readHorecaGroups = () => loadHorecaGroups(supabaseCloud);
export const loadHorecaRouting = async (client: any) => routing(client, (await readHorecaGroups()).groups);