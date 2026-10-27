import { formatInTimeZone } from 'date-fns-tz';
import type { InventoryItem } from '@/types';

export const LEAF_STOCK_MAX_DAYS = 3;
const normalize = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const leafStockKey = (name: string) => normalize(name).replace(/[^a-z0-9]/g, '');

export function isLeafSalad(name: string) {
  return /\b(rucola|arugula|spanac|spinach|salat\w*|lettuce|baby\s*leaf\w*|valeriana|valerianella|mache|mizuna|tatsoi|tats oi|pak\s*choi|bok\s*choi|bulls?\s*blood|l\w*\s*bow\w*|red\s*chard|swiss\s*chard|mangold|frunze|leaf)\b/.test(normalize(name));
}

export function leafStockAgeDays(receipt: InventoryItem['receipt_date'], now = new Date()): number | null {
  if (!receipt) return null;
  const date = receipt instanceof Date ? receipt : new Date(receipt);
  if (!Number.isFinite(date.getTime())) return null;
  const businessDay = (d: Date) => Date.parse(`${formatInTimeZone(d, 'Europe/Bucharest', 'yyyy-MM-dd')}T00:00:00Z`);
  return Math.floor((businessDay(now) - businessDay(date)) / 86400000);
}

export interface AgedLeafLot { item: InventoryItem; days: number }
export function agedLeafLots(items: (InventoryItem & { items?: InventoryItem[] })[], now = new Date()): AgedLeafLot[] {
  return items.flatMap((item) => {
    if (item.items?.length) return agedLeafLots(item.items, now);
    const days = leafStockAgeDays(item.receipt_date, now);
    return isLeafSalad(item.name) && Number(item.quantity) > 0 && days !== null && days > LEAF_STOCK_MAX_DAYS
      ? [{ item, days }] : [];
  }).sort((a, b) => b.days - a.days);
}