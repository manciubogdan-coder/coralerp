import { supabaseCloud } from '@/integrations/supabase/cloudClient';

export async function loadAutomaticRestock(): Promise<boolean> {
  const { data, error } = await supabaseCloud.from('productie_restock_settings')
    .select('auto_enabled').eq('id', true).maybeSingle();
  if (error) throw error;
  return data?.auto_enabled === true;
}

export async function offerRestockAtStart(
  loadEnabled: () => Promise<boolean>,
  offer: () => Promise<boolean>,
): Promise<boolean> {
  // A missing/unavailable setting must never enable stock allocation.
  let enabled = false;
  try { enabled = await loadEnabled(); } catch { return false; }
  return enabled === true ? offer() : false;
}