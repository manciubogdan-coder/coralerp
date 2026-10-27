/** Only explicit packaging groups may share finished-goods stock. */
export function restockProductIds(productId: string, groups: Record<string, string>): string[] {
  const group = groups[productId]?.trim();
  if (!group) return [productId];
  return Array.from(new Set([productId, ...Object.keys(groups).filter(id => groups[id]?.trim() === group)]));
}

export function restockNeeded(order: { cantitate: number; cantitate_reala_produsa?: number | null; cantitate_din_restock?: number | null; magasin?: string; magazin?: string; tip_comanda?: string; status?: string }): number {
  if (order.status === 'completed' || [order.magazin, order.tip_comanda].some(value => value === 'PRODUCTIE_AVANS' || value === 'REAMBALARE')) return 0;
  return Math.max(0, Number(order.cantitate) - Number(order.cantitate_reala_produsa || 0) - Number(order.cantitate_din_restock || 0));
}