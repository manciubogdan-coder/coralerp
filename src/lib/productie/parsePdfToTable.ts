import * as pdfjsLib from 'pdfjs-dist';

/**
 * Parse a PDF file into a 2D table (rows × columns).
 * 
 * Strategy:
 *  1. Extract all text items with their coordinates from each page.
 *  2. Cluster Y-coordinates (tolerance ±3) to group items into visual lines.
 *  3. For each line, sort items by X and merge items that are close together.
 *  4. Detect gaps between merged items to split each line into columns.
 *  5. Use a global column grid derived from the most common gap positions
 *     across all lines to ensure consistent column alignment.
 */

interface TextItem {
  x: number;
  y: number;
  text: string;
  width: number;
  endX: number;
}

interface MergedItem {
  x: number;
  endX: number;
  text: string;
}

/** Group nearby Y values so items within `tol` become one cluster. */
function clusterYValues(vals: number[], tol: number): Map<number, number> {
  const sorted = [...new Set(vals)].sort((a, b) => a - b);
  const mapping = new Map<number, number>();
  if (sorted.length === 0) return mapping;

  let cluster: number[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] <= tol) {
      cluster.push(sorted[i]);
    } else {
      const rep = Math.round(cluster.reduce((a, b) => a + b, 0) / cluster.length);
      for (const v of cluster) mapping.set(v, rep);
      cluster = [sorted[i]];
    }
  }
  const rep = Math.round(cluster.reduce((a, b) => a + b, 0) / cluster.length);
  for (const v of cluster) mapping.set(v, rep);

  return mapping;
}

/**
 * Merge text items on a line that are close together (gap < threshold).
 * Items separated by a large gap form separate "cells".
 */
function mergeLineItems(items: TextItem[], gapThreshold: number): MergedItem[] {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => a.x - b.x);
  
  const merged: MergedItem[] = [];
  let current: MergedItem = { x: sorted[0].x, endX: sorted[0].endX, text: sorted[0].text.trim() };

  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].x - current.endX;
    if (gap <= gapThreshold) {
      // Merge: items are close together
      const spacer = gap > 1 ? ' ' : '';
      current.text += spacer + sorted[i].text.trim();
      current.endX = Math.max(current.endX, sorted[i].endX);
    } else {
      // New cell
      merged.push(current);
      current = { x: sorted[i].x, endX: sorted[i].endX, text: sorted[i].text.trim() };
    }
  }
  merged.push(current);
  return merged;
}

/**
 * Build a global column grid from all lines.
 * Collect all cell start-X positions, cluster them, and use as column boundaries.
 */
function buildColumnGrid(allLineCells: MergedItem[][], minCols: number): number[] {
  // Collect all cell start positions
  const allStarts: number[] = [];
  for (const line of allLineCells) {
    for (const cell of line) {
      allStarts.push(Math.round(cell.x));
    }
  }
  
  if (allStarts.length === 0) return [];
  
  // Cluster X starts with tolerance
  const tolerance = 15;
  const sorted = [...allStarts].sort((a, b) => a - b);
  
  const clusters: { x: number; count: number; sum: number }[] = [];
  for (const x of sorted) {
    const existing = clusters.find(c => Math.abs(c.x - x) <= tolerance);
    if (existing) {
      existing.count++;
      existing.sum += x;
      existing.x = Math.round(existing.sum / existing.count);
    } else {
      clusters.push({ x, count: 1, sum: x });
    }
  }
  
  // Sort by position and filter to significant clusters
  clusters.sort((a, b) => a.x - b.x);
  
  // Keep clusters that appear in at least ~10% of lines or at least 2 times
  const minCount = Math.max(2, Math.floor(allLineCells.length * 0.08));
  let significant = clusters.filter(c => c.count >= minCount);
  
  // Fallback: if too few, use all
  if (significant.length < minCols) {
    significant = clusters;
  }
  
  return significant.map(c => c.x);
}

/** Assign a merged cell to the best-matching column index. */
function assignToColumn(cellX: number, colGrid: number[]): number {
  let bestIdx = 0;
  let bestDist = Math.abs(cellX - colGrid[0]);
  
  for (let i = 1; i < colGrid.length; i++) {
    const dist = Math.abs(cellX - colGrid[i]);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  
  // If the cell is clearly to the right of the best match, check if it should go to next column
  if (bestIdx < colGrid.length - 1 && cellX > colGrid[bestIdx] + 20) {
    const nextDist = Math.abs(cellX - colGrid[bestIdx + 1]);
    if (nextDist < bestDist) return bestIdx + 1;
  }
  
  return bestIdx;
}

/**
 * Parse PDF with optional visual separator positions from PdfColumnSplitter.
 * If visualSeparators is provided, uses those exact X% boundaries instead of auto-detection.
 */
export async function parsePdfToRawData(
  fileData: ArrayBuffer,
  visualSeparators?: { v?: number[]; h?: number[] } | null
): Promise<any[][]> {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(fileData) }).promise;
  
  // Collect all text items from all pages
  const pageTextItems: TextItem[][] = [];
  const pageViewports: { width: number; height: number }[] = [];
  
  for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 10); pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    pageViewports.push({ width: viewport.width, height: viewport.height });
    const textContent = await page.getTextContent();
    const items: TextItem[] = [];

    for (const item of textContent.items) {
      if (!('str' in item) || !(item as any).str.trim()) continue;
      const str = (item as any).str;
      const x = Math.round((item as any).transform[4] * 10) / 10;
      const rawWidth = (item as any).width;
      const width = rawWidth > 0 ? rawWidth : (str.length * 5);
      
      items.push({
        x,
        y: Math.round((item as any).transform[5]),
        text: str,
        width,
        endX: x + width,
      });
    }
    pageTextItems.push(items);
  }

  const allItems = pageTextItems.flat();
  if (allItems.length === 0) return [];

  // If we have visual separators, use them for column boundaries
  const hasVisualSeps = visualSeparators?.v && visualSeparators.v.length > 0;
  const hasHBounds = visualSeparators?.h && visualSeparators.h.length > 0;

  // Cluster Y values globally
  const yMapping = clusterYValues(allItems.map(it => it.y), 3);

  // Build lines per page, maintaining page order (top to bottom = descending Y)
  const allLineCells: MergedItem[][] = [];
  const allLineYs: number[] = [];
  
  for (let pIdx = 0; pIdx < pageTextItems.length; pIdx++) {
    const items = pageTextItems[pIdx];
    const vp = pageViewports[pIdx] || { width: 600, height: 800 };

    // Filter by horizontal bounds if provided (Y in PDF is bottom-up)
    let filteredItems = items;
    if (hasHBounds) {
      const hSorted = [...visualSeparators!.h!].sort((a, b) => a - b);
      // Convert h% (top-down) to PDF Y coordinates (bottom-up)
      const yTop = vp.height * (1 - hSorted[0] / 100);
      const yBottom = hSorted.length > 1 ? vp.height * (1 - hSorted[1] / 100) : 0;
      filteredItems = items.filter(it => it.y <= yTop && it.y >= yBottom);
    }

    // Group by clustered Y
    const lineMap = new Map<number, TextItem[]>();
    for (const item of filteredItems) {
      const cy = yMapping.get(item.y) ?? item.y;
      if (!lineMap.has(cy)) lineMap.set(cy, []);
      lineMap.get(cy)!.push(item);
    }

    // Sort lines top-to-bottom (descending Y in PDF coordinate system)
    const sortedYs = [...lineMap.keys()].sort((a, b) => b - a);
    
    for (const y of sortedYs) {
      const lineItems = lineMap.get(y)!;
      const merged = mergeLineItems(lineItems, 8);
      if (merged.length > 0 && merged.some(m => m.text.length > 0)) {
        allLineCells.push(merged);
        allLineYs.push(y);
      }
    }
  }

  if (allLineCells.length === 0) return [];

  // Build column grid
  let colGrid: number[];

  if (hasVisualSeps) {
    // Use visual separators: convert % to absolute X positions using first page width
    const vpWidth = pageViewports[0]?.width || 600;
    const vSorted = [...visualSeparators!.v!].sort((a, b) => a - b);
    // Each separator creates a boundary. Column centers are between separators.
    // We need column "snap" positions (center of each zone) for assignToColumn
    const boundaries = [0, ...vSorted.map(pct => (pct / 100) * vpWidth), vpWidth];
    colGrid = [];
    for (let i = 0; i < boundaries.length - 1; i++) {
      colGrid.push(boundaries[i]); // Use left edge as column position
    }
    console.log(`[PDF Parser] Using ${colGrid.length} visual columns from separators at X: ${colGrid.map(x => Math.round(x)).join(', ')}`);
  } else {
    // Auto-detect columns
    const multiCellLines = allLineCells.filter(line => line.length >= 2);
    const gridSource = multiCellLines.length >= 3 ? multiCellLines : allLineCells;
    colGrid = buildColumnGrid(gridSource, 2);
  }
  
  if (colGrid.length === 0) {
    return allLineCells.map(line => [line.map(c => c.text).join(' ')]);
  }

  const numCols = colGrid.length;
  console.log(`[PDF Parser] Detected ${numCols} columns at X: ${colGrid.join(', ')} from ${allLineCells.length} lines`);

  // Build output rows
  const allRows: string[][] = [];
  
  for (const lineCells of allLineCells) {
    const row: string[] = new Array(numCols).fill('');
    
    for (const cell of lineCells) {
      const colIdx = assignToColumn(cell.x, colGrid);
      if (row[colIdx]) {
        row[colIdx] += ' ' + cell.text;
      } else {
        row[colIdx] = cell.text;
      }
    }
    
    if (row.some(c => c.length > 0)) {
      allRows.push(row);
    }
  }

  return allRows;
}
