import { supabase } from '@/integrations/supabase/client';
import { edgeFetchJson } from '@/lib/edgeFetch';
export async function qualityEmailApi<T = any>(body: Record<string, unknown>): Promise<T> {
  const {data} = await supabase.auth.getSession();
  if (!data.session) throw new Error('Autentificare necesară.');
  return edgeFetchJson<T>(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quality-emails`, {
    method:'POST',attempts:1,headers:{apikey:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,'x-app-token':data.session.access_token},body,
  });
}