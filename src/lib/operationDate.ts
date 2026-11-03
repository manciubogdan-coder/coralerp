import { formatInTimeZone } from 'date-fns-tz';

/** Capture once at confirmation, never from an operator-editable date field. */
export function operationDate(now = new Date()) {
  return {
    day: formatInTimeZone(now, 'Europe/Bucharest', 'yyyy-MM-dd'),
    timestamp: now.toISOString(),
  };
}