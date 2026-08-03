const DEFAULT_SUPABASE_URL = 'https://spnawjvexcwhhyfavvew.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwbmF3anZleGN3aGh5ZmF2dmV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNjU1NDgsImV4cCI6MjEwMDk0MTU0OH0.IYNTrKH7s5aTBcRREiBgq1SOw5ONBcP0uxWpC_tSznU';

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseUrl = rawUrl.includes('placeholder') ? DEFAULT_SUPABASE_URL : rawUrl;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('placeholder')
    ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    : DEFAULT_SUPABASE_ANON_KEY;

type QueryResult<T = any> = {
  data: T | null;
  error: any;
};

class SupabaseRestQuery<T = any> implements PromiseLike<QueryResult<T>> {
  private method = 'GET';
  private body: any = undefined;
  private params = new URLSearchParams();
  private prefer = '';
  private singular: 'single' | 'maybeSingle' | null = null;

  constructor(private table: string) {}

  select(columns = '*') {
    this.params.set('select', columns);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.params.set('order', `${column}.${options?.ascending === false ? 'desc' : 'asc'}`);
    return this;
  }

  eq(column: string, value: string | number | boolean | null) {
    this.params.set(column, `eq.${String(value)}`);
    return this;
  }

  gt(column: string, value: string | number) {
    this.params.set(column, `gt.${String(value)}`);
    return this;
  }

  ilike(column: string, value: string) {
    this.params.set(column, `ilike.${String(value)}`);
    return this;
  }

  insert(value: any) {
    this.method = 'POST';
    this.body = value;
    this.prefer = 'return=representation';
    return this;
  }

  upsert(value: any, options?: { onConflict?: string }) {
    this.method = 'POST';
    this.body = value;
    this.prefer = 'resolution=merge-duplicates,return=representation';
    if (options?.onConflict) this.params.set('on_conflict', options.onConflict);
    return this;
  }

  update(value: any) {
    this.method = 'PATCH';
    this.body = value;
    this.prefer = 'return=representation';
    return this;
  }

  delete() {
    this.method = 'DELETE';
    this.prefer = 'return=representation';
    return this;
  }

  single() {
    this.singular = 'single';
    return this;
  }

  maybeSingle() {
    this.singular = 'maybeSingle';
    return this;
  }

  then<TResult1 = QueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<QueryResult<T>> {
    const url = `${supabaseUrl}/rest/v1/${this.table}?${this.params.toString()}`;
    try {
      const response = await fetch(url, {
        method: this.method,
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
          ...(this.prefer ? { Prefer: this.prefer } : {}),
        },
        body: this.body === undefined ? undefined : JSON.stringify(this.body),
        cache: 'no-store',
      });

      if (!response.ok) {
        let error: any = { message: `Supabase REST error ${response.status}` };
        try {
          error = await response.json();
        } catch {}
        return { data: null, error };
      }

      if (response.status === 204) return { data: null, error: null };
      const parsed = await response.json();
      if (this.singular) {
        const first = Array.isArray(parsed) ? parsed[0] : parsed;
        if (!first && this.singular === 'single') return { data: null, error: { message: 'Row not found' } };
        return { data: first || null, error: null };
      }
      return { data: parsed, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }
}

export const supabaseRest = {
  from(table: string) {
    return new SupabaseRestQuery(table);
  },
};
