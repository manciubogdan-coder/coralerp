
/**
 * TypeScript declaration file for Supabase RPC functions
 * This allows us to properly type the RPC calls
 */

declare module '@supabase/supabase-js' {
  interface SupabaseClient {
    rpc<T = any>(
      fn: string, // Allow any string for function names
      params?: object,
      options?: {
        head?: boolean;
        count?: null | 'exact' | 'planned' | 'estimated';
      }
    ): Promise<{ data: T; error: Error | null }>;
  }

  export function createClient(
    supabaseUrl: string,
    supabaseKey: string,
    options?: any
  ): SupabaseClient;
}
