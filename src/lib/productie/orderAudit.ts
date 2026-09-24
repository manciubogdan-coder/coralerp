import { supabaseCloud } from '@/integrations/supabase/cloudClient';

/**
 * Jurnal automat: interceptează TOATE scrierile (insert/update/delete) către
 * tabelele de comenzi/sesiuni/restoc din baza operațională și le salvează în
 * `productie_comenzi_audit` — cine, când, din ce pagină, ce s-a schimbat și
 * din ce bucată de cod (stack), ca să putem vedea de unde apar schimbările.
 */
const LEGACY_HOST = 'mfcdlifjxxdrekzdatfb.supabase.co';
const WATCH = /^(productie_comenzi|productie_sesiuni_lucru|.*restoc.*)$/;

let currentUser: { email: string | null; name: string | null } = { email: null, name: null };
export function setAuditUser(u: { email: string | null; name: string | null } | null) {
  currentUser = u ?? { email: null, name: null };
}

function idsFromFilter(params: URLSearchParams, key: string): string[] {
  const v = params.get(key);
  if (!v) return [];
  const m = v.match(/^(eq|in)\.\(?(.*?)\)?$/);
  if (!m) return [];
  return m[2].split(',').map((s) => s.replace(/"/g, '').trim()).filter(Boolean);
}

function shortStack(): string {
  const s = new Error().stack || '';
  return s
    .split('\n')
    .slice(3)
    .filter((l) => !l.includes('node_modules') && !l.includes('orderAudit'))
    .slice(0, 6)
    .map((l) => l.trim().replace(/https?:\/\/[^/]+/, '').replace(/\?[^:)]*/, ''))
    .join('\n');
}

let installed = false;
export function installOrderAudit() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await orig(input as any, init);
    try {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
      if (url.host !== LEGACY_HOST || method === 'GET' || method === 'HEAD') return res;
      const m = url.pathname.match(/\/rest\/v1\/([^/?]+)/);
      if (!m || !WATCH.test(m[1]) || !res.ok) return res;
      const table = m[1];
      let body: any = null;
      try { body = typeof init?.body === 'string' ? JSON.parse(init.body) : null; } catch { /* ignore */ }
      const rows: any[] = Array.isArray(body) ? body : body ? [body] : [];
      const recordIds = [...idsFromFilter(url.searchParams, 'id'), ...rows.map((r) => r?.id).filter(Boolean)];
      const comandaIds = [
        ...(table === 'productie_comenzi' ? recordIds : []),
        ...idsFromFilter(url.searchParams, 'comanda_id'),
        ...rows.map((r) => r?.comanda_id).filter(Boolean),
      ];
      // pentru insert fără id în body, încearcă să citim id-urile din răspuns
      if (method === 'POST' && recordIds.length === 0) {
        try {
          const data = await res.clone().json();
          (Array.isArray(data) ? data : [data]).forEach((r: any) => {
            if (r?.id) recordIds.push(r.id);
            if (r?.comanda_id) comandaIds.push(r.comanda_id);
            if (table === 'productie_comenzi' && r?.id) comandaIds.push(r.id);
          });
        } catch { /* fără corp */ }
      }
      const action = method === 'POST' ? 'insert' : method === 'DELETE' ? 'delete' : 'update';
      const filter = [...url.searchParams.entries()]
        .filter(([k]) => k !== 'select')
        .map(([k, v]) => `${k}=${v}`)
        .join('&');
      void supabaseCloud.from('productie_comenzi_audit').insert({
        table_name: table,
        action,
        record_ids: [...new Set(recordIds.map(String))],
        comanda_ids: [...new Set(comandaIds.map(String))],
        changes: rows.length === 1 ? rows[0] : rows.length ? rows : null,
        filter,
        user_email: currentUser.email,
        user_name: currentUser.name,
        page_path: window.location.pathname + window.location.search,
        source: shortStack(),
      } as any).then(({ error }) => { if (error) console.warn('audit', error.message); });
    } catch { /* nu blocăm aplicația */ }
    return res;
  };
}
