
/**
 * TypeScript declaration file for Supabase RPC functions
 * This allows us to properly type the RPC calls
 */

declare module '@supabase/supabase-js' {
  interface PostgrestResponse<T> {
    data: T;
    error: Error | null;
    count?: number;
  }

  interface PostgrestQueryBuilder<T> {
    select(columns?: string): PostgrestFilterBuilder<T>;
    insert(values: Partial<T> | Partial<T>[], options?: { upsert?: boolean }): Promise<PostgrestResponse<T[]>>;
    upsert(values: Partial<T> | Partial<T>[]): Promise<PostgrestResponse<T[]>>;
    update(values: Partial<T>, options?: any): PostgrestFilterBuilder<T>;
    delete(): PostgrestFilterBuilder<T>;
    eq(column: string, value: any): Promise<PostgrestResponse<T[]>>;
    neq(column: string, value: any): Promise<PostgrestResponse<T[]>>;
    gt(column: string, value: any): Promise<PostgrestResponse<T[]>>;
    lt(column: string, value: any): Promise<PostgrestResponse<T[]>>;
    gte(column: string, value: any): Promise<PostgrestResponse<T[]>>;
    lte(column: string, value: any): Promise<PostgrestResponse<T[]>>;
    like(column: string, value: any): Promise<PostgrestResponse<T[]>>;
    ilike(column: string, value: any): Promise<PostgrestResponse<T[]>>;
    is(column: string, value: any): Promise<PostgrestResponse<T[]>>;
    in(column: string, values: any[]): Promise<PostgrestResponse<T[]>>;
    contains(column: string, value: any): Promise<PostgrestResponse<T[]>>;
    containedBy(column: string, value: any): Promise<PostgrestResponse<T[]>>;
    order(column: string, options?: { ascending?: boolean }): PostgrestTransformBuilder<T>;
    limit(count: number): PostgrestTransformBuilder<T>;
    range(from: number, to: number): PostgrestTransformBuilder<T>;
    single(): Promise<PostgrestResponse<T>>;
    maybeSingle(): Promise<PostgrestResponse<T | null>>;
    // Support for count
    count(options?: { count?: 'exact' | 'planned' | 'estimated' }): Promise<PostgrestResponse<T[]>>;
  }

  interface PostgrestFilterBuilder<T> extends PostgrestQueryBuilder<T> {
    // Additional filter methods
    match(query: any): Promise<PostgrestResponse<T[]>>;
  }

  interface PostgrestTransformBuilder<T> {
    select(columns?: string): PostgrestTransformBuilder<T>;
    limit(count: number): PostgrestTransformBuilder<T>;
    order(column: string, options?: { ascending?: boolean }): PostgrestTransformBuilder<T>;
    range(from: number, to: number): PostgrestTransformBuilder<T>;
    single(): Promise<PostgrestResponse<T>>;
    maybeSingle(): Promise<PostgrestResponse<T | null>>;
    then(onfulfilled: (value: PostgrestResponse<T[]>) => any): Promise<any>;
  }

  interface SupabaseClient {
    rpc<T = any>(
      fn: string, 
      params?: object,
      options?: {
        head?: boolean;
        count?: null | 'exact' | 'planned' | 'estimated';
      }
    ): Promise<PostgrestResponse<T>>;
    
    from<T = any>(table: string): PostgrestQueryBuilder<T>;
  }

  export function createClient(
    supabaseUrl: string,
    supabaseKey: string,
    options?: any
  ): SupabaseClient;

  // Add support for awaitable chaining
  interface Promise<T> {
    select(columns?: string): Promise<T>;
    eq(column: string, value: any): Promise<T>;
    neq(column: string, value: any): Promise<T>;
    gt(column: string, value: any): Promise<T>;
    lt(column: string, value: any): Promise<T>;
    gte(column: string, value: any): Promise<T>;
    lte(column: string, value: any): Promise<T>;
    like(column: string, value: any): Promise<T>;
    ilike(column: string, value: any): Promise<T>;
    is(column: string, value: any): Promise<T>;
    in(column: string, values: any[]): Promise<T>;
    contains(column: string, value: any): Promise<T>;
    containedBy(column: string, value: any): Promise<T>;
    order(column: string, options?: { ascending?: boolean }): Promise<T>;
    limit(count: number): Promise<T>;
    range(from: number, to: number): Promise<T>;
    single(): Promise<T>;
    maybeSingle(): Promise<T>;
    match(query: any): Promise<T>;
  }
}
