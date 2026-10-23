export const CRM_STAGES = ['lead','discovery','samples','negotiation','active'] as const;
export function canAccessCrm(approved: boolean, roles: string[]): boolean {
  return approved && roles.some(role => role === 'admin' || role === 'picking_vanzari');
}
export function isInactive(lastOrder: string | null, frequency: number, now = new Date()): boolean {
  if (!lastOrder) return false;
  return Math.floor((Date.parse(now.toISOString().slice(0,10)) - Date.parse(lastOrder.slice(0,10))) / 86400000) > frequency;
}
export function alertVisible(alert: {status:string;snoozed_until?:string|null}, now = new Date()): boolean {
  return alert.status !== 'resolved' && (alert.status !== 'snoozed' || !alert.snoozed_until || Date.parse(alert.snoozed_until) <= now.getTime());
}
