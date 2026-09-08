import { supabaseCloud } from '@/integrations/supabase/cloudClient';

export interface ActivityPing {
  user_id: string;
  email: string | null;
  display_name: string | null;
  path: string;
  tab: string | null;
  seconds: number;
  occurred_at: string;
}

/** Citește tab-ul (sau tab-urile) active din interfață, folosind atributele Radix. */
export function readActiveTab(): string | null {
  if (typeof document === 'undefined') return null;
  const nodes = Array.from(
    document.querySelectorAll('[role="tab"][data-state="active"]'),
  ) as HTMLElement[];
  const labels = nodes
    .map((n) => (n.innerText || n.textContent || '').replace(/\s+/g, ' ').trim())
    .filter((t) => t.length > 0 && t.length <= 60);
  if (labels.length === 0) return null;
  return labels.slice(0, 3).join(' › ').slice(0, 160);
}

/** Normalizează ruta: /lot/<uuid> => /lot/:id */
export function normalizePath(pathname: string): string {
  return pathname
    .replace(
      /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      '/:id',
    )
    .replace(/\/\d+/g, '/:id');
}

export async function sendActivityPings(rows: ActivityPing[]) {
  if (rows.length === 0) return;
  try {
    await (supabaseCloud as any).from('app_activity_pings').insert(rows);
  } catch {
    /* nu blocăm aplicația dacă tracking-ul eșuează */
  }
}

export const PATH_LABELS: Record<string, string> = {
  '/': 'Hub Departamente',
  '/profil': 'Profil',
  '/achizitii': 'Achiziții — Stocuri & Forecast',
  '/achizitii/comenzi': 'Achiziții — Comenzi Furnizori',
  '/depozit-mp': 'Depozit MP — Stoc',
  '/depozit-mp/receptie': 'Depozit MP — Recepție',
  '/depozit-mp/nomenclatoare': 'Depozit MP — Nomenclatoare',
  '/depozit-ambalaje': 'Depozit Ambalaje — Stoc',
  '/depozit-ambalaje/nomenclatoare': 'Depozit Ambalaje — Nomenclatoare',
  '/etichete': 'Etichete — Stoc',
  '/etichete/nomenclatoare': 'Etichete — Nomenclatoare',
  '/productie': 'Producție',
  '/operator': 'Operator',
  '/picking': 'Picking',
  '/vanzari': 'Vânzări',
  '/mentenanta': 'Mentenanță',
  '/calitate': 'Calitate',
  '/evidenta-andrada': 'Evidență Andrada',
  '/evidenta-documente': 'Evidență Documente',
  '/traction-tracker': 'Traction Tracker',
  '/chat': 'Chat',
  '/taskuri': 'Taskuri',
  '/administrativ': 'Administrativ',
  '/administrativ/users': 'Administrativ — Utilizatori',
  '/administrativ/audit': 'Administrativ — Audit',
  '/administrativ/activitate': 'Administrativ — Activitate',
  '/administrativ/analytics': 'Administrativ — Analytics',
  '/administrativ/notificari-reguli': 'Administrativ — Reguli notificări',
  '/lot/:id': 'Detalii lot',
};

export function labelForPath(path: string): string {
  return PATH_LABELS[path] ?? path;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}
