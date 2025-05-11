
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
    insert(values: Partial<T> | Partial<T>[], options?: { upsert?: boolean }): PostgrestFilterBuilder<T>;
    upsert(values: Partial<T> | Partial<T>[]): PostgrestFilterBuilder<T>;
    update(values: Partial<T>, options?: any): PostgrestFilterBuilder<T>;
    delete(): PostgrestFilterBuilder<T>;
    eq(column: string, value: any): PostgrestFilterBuilder<T>;
    neq(column: string, value: any): PostgrestFilterBuilder<T>;
    gt(column: string, value: any): PostgrestFilterBuilder<T>;
    lt(column: string, value: any): PostgrestFilterBuilder<T>;
    gte(column: string, value: any): PostgrestFilterBuilder<T>;
    lte(column: string, value: any): PostgrestFilterBuilder<T>;
    like(column: string, value: any): PostgrestFilterBuilder<T>;
    ilike(column: string, value: any): PostgrestFilterBuilder<T>;
    is(column: string, value: any): PostgrestFilterBuilder<T>;
    in(column: string, values: any[]): PostgrestFilterBuilder<T>;
    contains(column: string, value: any): PostgrestFilterBuilder<T>;
    containedBy(column: string, value: any): PostgrestFilterBuilder<T>;
    order(column: string, options?: { ascending?: boolean }): PostgrestTransformBuilder<T>;
    limit(count: number): PostgrestTransformBuilder<T>;
    range(from: number, to: number): PostgrestTransformBuilder<T>;
    single(): PostgrestFilterBuilder<T>;
    maybeSingle(): PostgrestFilterBuilder<T>;
    match(query: any): PostgrestFilterBuilder<T>;
    count(options?: { count?: 'exact' | 'planned' | 'estimated' }): PostgrestFilterBuilder<T>;
  }

  interface PostgrestFilterBuilder<T> extends PostgrestQueryBuilder<T> {
    then<TResult1 = PostgrestResponse<T[]>, TResult2 = never>(
      onfulfilled?: ((value: PostgrestResponse<T[]>) => TResult1 | PromiseLike<TResult1>) | undefined | null,
      onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
    ): Promise<TResult1 | TResult2>;
    
    // Direct access to data, error, count
    data: T[];
    error: Error | null;
    count?: number;
  }

  interface PostgrestTransformBuilder<T> extends PostgrestFilterBuilder<T> {
    select(columns?: string): PostgrestTransformBuilder<T>;
    order(column: string, options?: { ascending?: boolean }): PostgrestTransformBuilder<T>;
    limit(count: number): PostgrestTransformBuilder<T>;
    range(from: number, to: number): PostgrestTransformBuilder<T>;
    single(): PostgrestFilterBuilder<T>;
    maybeSingle(): PostgrestFilterBuilder<T>;
    
    // We need to include filter methods directly in TransformBuilder
    eq(column: string, value: any): PostgrestFilterBuilder<T>;
    neq(column: string, value: any): PostgrestFilterBuilder<T>;
    gt(column: string, value: any): PostgrestFilterBuilder<T>;
    lt(column: string, value: any): PostgrestFilterBuilder<T>;
    gte(column: string, value: any): PostgrestFilterBuilder<T>;
    lte(column: string, value: any): PostgrestFilterBuilder<T>;
    like(column: string, value: any): PostgrestFilterBuilder<T>;
    ilike(column: string, value: any): PostgrestFilterBuilder<T>;
    is(column: string, value: any): PostgrestFilterBuilder<T>;
    in(column: string, values: any[]): PostgrestFilterBuilder<T>;
    contains(column: string, value: any): PostgrestFilterBuilder<T>;
    containedBy(column: string, value: any): PostgrestFilterBuilder<T>;
    
    // Add Promise compatibility
    then<TResult1 = PostgrestResponse<T[]>, TResult2 = never>(
      onfulfilled?: ((value: PostgrestResponse<T[]>) => TResult1 | PromiseLike<TResult1>) | undefined | null,
      onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
    ): Promise<TResult1 | TResult2>;
    
    // Direct access to data, error, count
    data: T[];
    error: Error | null;
    count?: number;
  }

  interface SupabaseClient {
    rpc<T = any>(
      fn: string, 
      params?: object,
      options?: {
        head?: boolean;
        count?: null | 'exact' | 'planned' | 'estimated';
      }
    ): PostgrestFilterBuilder<T>;
    
    from<T = any>(table: string): PostgrestQueryBuilder<T>;
  }

  export function createClient(
    supabaseUrl: string,
    supabaseKey: string,
    options?: any
  ): SupabaseClient;

  // Make Promise properties directly accessible
  interface Promise<T> {
    data: any;
    error: Error | null;
    count?: number;
    select(columns?: string): this;
    eq(column: string, value: any): this;
    neq(column: string, value: any): this;
    gt(column: string, value: any): this;
    lt(column: string, value: any): this;
    gte(column: string, value: any): this;
    lte(column: string, value: any): this;
    like(column: string, value: any): this;
    ilike(column: string, value: any): this;
    is(column: string, value: any): this;
    in(column: string, values: any[]): this;
    contains(column: string, value: any): this;
    containedBy(column: string, value: any): this;
    order(column: string, options?: { ascending?: boolean }): this;
    limit(count: number): this;
    range(from: number, to: number): this;
    single(): this;
    maybeSingle(): this;
    match(query: any): this;
  }
}
