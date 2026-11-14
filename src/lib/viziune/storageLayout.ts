// Dense warehouse floors: which pallet places each product (or store) fills and how high it is stacked.
// Pure rules, no React or three.

export interface StorageSlot { x: number; z: number; levels: number; item: number }

/**
 * Pallet places in back-to-back row pairs with an aisle between pairs (row-major, left to right).
 * `pairs` row pairs, `cols` places per row, starting at (x0, z0); `dir` = +1 rows grow towards +z.
 */
export function rowPairCells(x0: number, z0: number, cols: number, pairs: number, { dx = 1.3, pairGap = 0.9, aisle = 3.7, dir = 1 } = {}): [number, number][] {
  const out: [number, number][] = [];
  for (let p = 0; p < pairs; p++) for (let r = 0; r < 2; r++) {
    const z = z0 + dir * (p * aisle + r * pairGap);
    for (let c = 0; c < cols; c++) out.push([x0 + c * dx, z]);
  }
  return out;
}

/**
 * Shares the pallet places among items (sorted biggest first): every item with stock gets at least one
 * place, the rest go in proportion to quantity; each item's places are next to each other. Stack height
 * grows with the quantity per place, between minLevels and maxLevels. Items beyond the places are left out.
 */
export function fillSlots(qtys: number[], cells: [number, number][], maxLevels: number, minLevels = 1): StorageSlot[] {
  const items = qtys.map((q, i) => ({ i, q: Number(q) || 0 })).filter((x) => x.q > 0).slice(0, cells.length);
  if (!items.length || !cells.length) return [];
  const total = items.reduce((a, x) => a + x.q, 0);
  const spare = cells.length - items.length;
  const raw = items.map((x) => (x.q / total) * spare);
  const count = raw.map((r) => 1 + Math.floor(r));
  let left = cells.length - count.reduce((a, b) => a + b, 0);
  raw.map((r, k) => ({ k, f: r - Math.floor(r) })).sort((a, b) => b.f - a.f).forEach(({ k }) => { if (left > 0) { count[k]++; left--; } });
  const perSlot = items.map((x, k) => x.q / count[k]);
  const maxPer = Math.max(...perSlot);
  const out: StorageSlot[] = [];
  let c = 0;
  items.forEach((x, k) => {
    const levels = Math.max(minLevels, Math.min(maxLevels, Math.round(minLevels + (perSlot[k] / maxPer) * (maxLevels - minLevels))));
    for (let n = 0; n < count[k]; n++, c++) out.push({ x: cells[c][0], z: cells[c][1], levels, item: x.i });
  });
  return out;
}
