import { formatInTimeZone } from 'date-fns-tz';

export const pickingToday = () => formatInTimeZone(new Date(), 'Europe/Bucharest', 'yyyy-MM-dd');

export function pickingDay(row: { data_productie?: string | null; data_sesiune?: string | null; created_at?: string }) {
  const day = row.data_productie || row.data_sesiune;
  if (day) return day.slice(0, 10);
  return row.created_at ? formatInTimeZone(new Date(row.created_at), 'Europe/Bucharest', 'yyyy-MM-dd') : '';
}

export function matchesPickingDay(day: string, selected: string, mode: 'zi' | 'restante' | 'toate', today: string) {
  if (mode === 'toate') return true;
  if (mode === 'restante') return !!day && day < today;
  return day === selected;
}

// Sessions and pool lots describe the same goods, not two additive supplies.
// Unconfirmed free stock is an option to allocate, not completed production.
export function pickingReadiness(total: number, produced: number, allocated: number, ownPool: number) {
  const realized = Math.min(total, Math.max(0, allocated) + Math.max(0, produced, ownPool));
  return { realized, ready: total > 0 && realized >= total - 1e-6 };
}