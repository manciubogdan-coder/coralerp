
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
    
    from<T = any>(
      table: string
    ): {
      select: (columns?: string) => {
        eq: (column: string, value: any) => Promise<{ data: T[]; error: Error | null }>;
        neq: (column: string, value: any) => Promise<{ data: T[]; error: Error | null }>;
        gt: (column: string, value: any) => Promise<{ data: T[]; error: Error | null }>;
        lt: (column: string, value: any) => Promise<{ data: T[]; error: Error | null }>;
        gte: (column: string, value: any) => Promise<{ data: T[]; error: Error | null }>;
        lte: (column: string, value: any) => Promise<{ data: T[]; error: Error | null }>;
        like: (column: string, value: any) => Promise<{ data: T[]; error: Error | null }>;
        ilike: (column: string, value: any) => Promise<{ data: T[]; error: Error | null }>;
        is: (column: string, value: any) => Promise<{ data: T[]; error: Error | null }>;
        in: (column: string, values: any[]) => Promise<{ data: T[]; error: Error | null }>;
        contains: (column: string, value: any) => Promise<{ data: T[]; error: Error | null }>;
        containedBy: (column: string, value: any) => Promise<{ data: T[]; error: Error | null }>;
        range: (from: number, to: number) => Promise<{ data: T[]; error: Error | null }>;
        single: () => Promise<{ data: T; error: Error | null }>;
        maybeSingle: () => Promise<{ data: T | null; error: Error | null }>;
        order: (column: string, options?: { ascending?: boolean }) => { 
          limit: (count: number) => Promise<{ data: T[]; error: Error | null }>;
          range: (from: number, to: number) => Promise<{ data: T[]; error: Error | null }>;
          select: (columns?: string) => Promise<{ data: T[]; error: Error | null }>;
        };
        order: (column: string, options?: { ascending?: boolean }) => Promise<{ data: T[]; error: Error | null }>;
        limit: (count: number) => Promise<{ data: T[]; error: Error | null }>;
        eq: (column: string, value: any) => Promise<{ data: T[]; error: Error | null }>;
        neq: (column: string, value: any) => Promise<{ data: T[]; error: Error | null }>;
        gt: (column: string, value: any) => Promise<{ data: T[]; error: Error | null }>;
        lt: (column: string, value: any) => Promise<{ data: T[]; error: Error | null }>;
        gte: (column: string, value: any) => Promise<{ data: T[]; error: Error | null }>;
        lte: (column: string, value: any) => Promise<{ data: T[]; error: Error | null }>;
        like: (column: string, value: any) => Promise<{ data: T[]; error: Error | null }>;
        ilike: (column: string, value: any) => Promise<{ data: T[]; error: Error | null }>;
        is: (column: string, value: any) => Promise<{ data: T[]; error: Error | null }>;
        in: (column: string, values: any[]) => Promise<{ data: T[]; error: Error | null }>;
        contains: (column: string, value: any) => Promise<{ data: T[]; error: Error | null }>;
        containedBy: (column: string, value: any) => Promise<{ data: T[]; error: Error | null }>;
        count: (options?: { count?: 'exact' | 'planned' | 'estimated' }) => Promise<{ data: T[]; count: number; error: Error | null }>;
      };
      insert: (values: Partial<T> | Partial<T>[], options?: { upsert?: boolean }) => Promise<{ data: T[]; error: Error | null }>;
      upsert: (values: Partial<T> | Partial<T>[]) => Promise<{ data: T[]; error: Error | null }>;
      update: (values: Partial<T>, options?: any) => {
        eq: (column: string, value: any) => Promise<{ data: T[]; error: Error | null }>;
        neq: (column: string, value: any) => Promise<{ data: T[]; error: Error | null }>;
        gt: (column: string, value: any) => Promise<{ data: T[]; error: Error | null }>;
        lt: (column: string, value: any) => Promise<{ data: T[]; error: Error | null }>;
        gte: (column: string, value: any) => Promise<{ data: T[]; error: Error | null }>;
        lte: (column: string, value: any) => Promise<{ data: T[]; error: Error | null }>;
        match: (query: any) => Promise<{ data: T[]; error: Error | null }>;
        eq: (column: string, value: any) => Promise<{ data: T[]; error: Error | null }>;
      };
      delete: () => {
        eq: (column: string, value: any) => Promise<{ data: T[]; error: Error | null }>;
        neq: (column: string, value: any) => Promise<{ data: T[]; error: Error | null }>;
        gt: (column: string, value: any) => Promise<{ data: T[]; error: Error | null }>;
        lt: (column: string, value: any) => Promise<{ data: T[]; error: Error | null }>;
        gte: (column: string, value: any) => Promise<{ data: T[]; error: Error | null }>;
        lte: (column: string, value: any) => Promise<{ data: T[]; error: Error | null }>;
        match: (query: any) => Promise<{ data: T[]; error: Error | null }>;
      };
    };
  }

  export function createClient(
    supabaseUrl: string,
    supabaseKey: string,
    options?: any
  ): SupabaseClient;
}
