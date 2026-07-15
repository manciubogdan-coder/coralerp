// Dedicated client for the Lovable Cloud database (yeniohmlmxhjzywqlidx).
// The main `@/integrations/supabase/client` points at the LEGACY DB where all
// operational data lives. Some newer features (like Evidență Andrada) use
// tables created directly in the Cloud DB, so they need this separate client.
import { createClient } from '@supabase/supabase-js';

const CLOUD_URL = 'https://yeniohmlmxhjzywqlidx.supabase.co';
const CLOUD_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbmlvaG1sbXhoanp5d3FsaWR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NjM0ODgsImV4cCI6MjA5MzEzOTQ4OH0.8rNaYX5D5hk22o_bUqERO9ChJfQdJYkaKiD9UsRi1mE';

export const supabaseCloud = createClient(CLOUD_URL, CLOUD_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
