import * as XLSX from 'xlsx';

interface TemplateMapping {
  id: string;
  template_id: string;
  nume_in_fisier: string;
  produs_id: string;
  gramaj: string | null;
}

interface StoreColumnConfig {
  store_name: string;
  col_index: number;
}

interface Template {
  id: string;
  nume_magazin: string;
  client_id: string | null;
  coloana_produs: string;
  coloana_cantitate: string;
  coloana_gramaj: string | null;
  coloana_magazin: string | null;
  randuri_skip: number;
  tip_split: string;
  sheet_name: string | null;
  activ: boolean;
  store_columns?: StoreColumnConfig[] | null;
  mappings?: TemplateMapping[];
}

interface ParsedProduct {
  nume_produs: string;
  gramaj: string;
  cantitate: number;
  confidence: number;
  matched_product_id?: string;
}

interface ParsedOrder {
  client_id: string | null;
  client_name: string;
  punct_livrare: string;
  products: ParsedProduct[];
}

function normalizeForMatch(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Parse a number that may use European formatting (e.g., "600,000" or "1.234,56") */
function parseEuropeanNumber(val: any): number {
  if (typeof val === 'number') return val;
  const s = String(val || '').trim();
  if (!s) return 0;
  // If contains both dots and commas, determine format
  // European: 1.234,56 → remove dots, replace comma with dot
  // US: 1,234.56 → remove commas
  if (s.includes(',') && s.includes('.')) {
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma > lastDot) {
      // European: 1.234,56
      return Number(s.replace(/\./g, '').replace(',', '.')) || 0;
    } else {
      // US: 1,234.56
      return Number(s.replace(/,/g, '')) || 0;
    }
  }
  // Only commas: could be "600,000" (European thousands) or "3,5" (European decimal)
  if (s.includes(',')) {
    const parts = s.split(',');
    // If last part has exactly 3 digits, treat comma as thousands separator
    if (parts[parts.length - 1].length === 3) {
      return Number(s.replace(/,/g, '')) || 0;
    }
    // Otherwise treat comma as decimal separator
    return Number(s.replace(',', '.')) || 0;
  }
  return Number(s) || 0;
}

function findColIndex(headers: string[], colName: string): number {
  // Support direct index reference: "__idx:5" → column 5
  const idxMatch = colName.match(/^__idx:(\d+)$/);
  if (idxMatch) {
    const directIdx = parseInt(idxMatch[1], 10);
    console.log(`[findColIndex] Using direct index ${directIdx} for "${colName}"`);
    return directIdx < headers.length ? directIdx : directIdx; // allow even if beyond headers
  }

  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_\s]+/g, " ").trim();
  const target = norm(colName);

  // Exact match
  let idx = headers.findIndex(h => norm(h) === target);
  if (idx !== -1) return idx;

  // Contains match
  idx = headers.findIndex(h => norm(h).includes(target) || target.includes(norm(h)));
  if (idx !== -1) return idx;

  // Fallback: check if colName looks like "Col N" (legacy format)
  const colNMatch = colName.match(/^Col\s+(\d+)$/i);
  if (colNMatch) {
    const legacyIdx = parseInt(colNMatch[1], 10);
    console.log(`[findColIndex] Using legacy Col index ${legacyIdx} for "${colName}"`);
    return legacyIdx;
  }

  return -1;
}

export interface Client {
  id: string;
  nume_magazin: string;
  punct_livrare: string;
}

export interface Product {
  id: string;
  nume: string;
}

const extractBaseName = (s: string): string => {
  return normalizeForMatch(s)
    .replace(/\b\d+\s*g\s*r?\b/g, '')
    .replace(/\b(bg|mc|gastro|salata|sal|fr|frunze|frunza|fresh|coral)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
};

// Simple Levenshtein distance for fuzzy matching
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array(n + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function similarity(a: string, b: string): number {
  const dist = levenshtein(a, b);
  return 1 - dist / Math.max(a.length, b.length, 1);
}

const extractWeight = (s: string): string | null => {
  const match = s.match(/(\d+)\s*g\b/i);
  return match ? match[1] : null;
};

function mapProductWithTemplate(
  raw: string,
  gramaj: string,
  template: { mappings?: TemplateMapping[]; nume_magazin?: string },
  products: Product[]
): ParsedProduct {
  const mapping = template.mappings?.find(m =>
    normalizeForMatch(m.nume_in_fisier) === normalizeForMatch(raw)
  );

  if (mapping) {
    const product = products.find(p => p.id === mapping.produs_id);
    return {
      nume_produs: product?.nume || raw,
      gramaj: mapping.gramaj || gramaj,
      cantitate: 0,
      confidence: 1,
      matched_product_id: mapping.produs_id,
    };
  }

  const normRaw = normalizeForMatch(raw);
  const rawBase = extractBaseName(raw);
  const rawWeight = extractWeight(raw) || extractWeight(gramaj);
  
  // Client hint for preferring products with matching suffix (e.g., "LIDL")
  const clientHintTokens = template.nume_magazin 
    ? normalizeForMatch(template.nume_magazin).split(' ').filter(t => t.length >= 3) 
    : [];
  
  const preferClient = (candidates: Product[]): Product => {
    if (clientHintTokens.length > 0 && candidates.length > 1) {
      const hinted = candidates.find(p => {
        const pn = normalizeForMatch(p.nume);
        return clientHintTokens.some(h => pn.includes(h));
      });
      if (hinted) return hinted;
    }
    return candidates[0];
  };

  const exactMatch = products.find(p => normalizeForMatch(p.nume) === normRaw);
  if (exactMatch) {
    return { nume_produs: exactMatch.nume, gramaj, cantitate: 0, confidence: 1, matched_product_id: exactMatch.id };
  }

  const containsMatches = products.filter(p => {
    const pn = normalizeForMatch(p.nume);
    return pn.includes(normRaw) || normRaw.includes(pn);
  });
  if (containsMatches.length > 0) {
    const best = preferClient(containsMatches);
    return { nume_produs: best.nume, gramaj, cantitate: 0, confidence: 0.95, matched_product_id: best.id };
  }

  const baseMatches = products.filter(p => {
    const pBase = extractBaseName(p.nume);
    return pBase === rawBase ||
           (pBase.length > 2 && rawBase.length > 2 && (pBase.includes(rawBase) || rawBase.includes(pBase))) ||
           (pBase.length > 3 && rawBase.length > 3 && similarity(pBase, rawBase) >= 0.8);
  });
  if (baseMatches.length > 0) {
    if (rawWeight) {
      const weightMatches = baseMatches.filter(p => extractWeight(p.nume) === rawWeight);
      if (weightMatches.length > 0) {
        const best = preferClient(weightMatches);
        return { nume_produs: best.nume, gramaj, cantitate: 0, confidence: 0.95, matched_product_id: best.id };
      }
    }
    const best = preferClient(baseMatches);
    return { nume_produs: best.nume, gramaj, cantitate: 0, confidence: 0.7, matched_product_id: best.id };
  }

  // Token overlap matching
  const rawTokens = rawBase.split(' ').filter(t => t.length > 1);
  if (rawTokens.length > 0) {
    let bestMatch: (typeof products)[0] | null = null;
    let bestScore = 0;
    for (const prod of products) {
      const prodTokens = extractBaseName(prod.nume).split(' ').filter(t => t.length > 1);
      const overlap = rawTokens.filter(t => prodTokens.some(pt => pt.includes(t) || t.includes(pt) || similarity(pt, t) >= 0.8)).length;
      const score = overlap / Math.max(rawTokens.length, prodTokens.length);
      if (score > bestScore && score >= 0.5) {
        bestScore = score;
        bestMatch = prod;
      }
    }
    if (bestMatch) {
      return { nume_produs: bestMatch.nume, gramaj, cantitate: 0, confidence: Math.round(bestScore * 70) / 100, matched_product_id: bestMatch.id };
    }
  }

  // Fuzzy full-name matching as last resort
  let bestFuzzy: (typeof products)[0] | null = null;
  let bestFuzzySim = 0;
  for (const prod of products) {
    const pBase = extractBaseName(prod.nume);
    const sim = similarity(rawBase, pBase);
    if (sim > bestFuzzySim && sim >= 0.7) {
      bestFuzzySim = sim;
      bestFuzzy = prod;
    }
  }
  if (bestFuzzy) {
    return { nume_produs: bestFuzzy.nume, gramaj, cantitate: 0, confidence: Math.round(bestFuzzySim * 80) / 100, matched_product_id: bestFuzzy.id };
  }

  return { nume_produs: raw, gramaj, cantitate: 0, confidence: 0 };
}

/**
 * Parse an Excel/PDF file using a template configuration - no AI needed.
 * Returns one or more parsed orders (multiple if multi-store splitting is active).
 */
export function parseExcelWithTemplate(
  fileData: ArrayBuffer,
  template: Template,
  clients: Client[],
  products: Product[],
  preParsedData?: any[][]
): ParsedOrder[] {
  let jsonData: any[][];

  if (preParsedData && preParsedData.length > 0) {
    jsonData = preParsedData;
  } else {
    const workbook = XLSX.read(new Uint8Array(fileData), { type: 'array' });

    const sheetName = template.sheet_name || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      throw new Error(`Sheet "${sheetName}" nu există în fișier`);
    }

    jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
  }

  // ========== FILE CONTENT VALIDATION (soft) ==========
  // Skip validation for templates using __idx: columns (visual separator templates)
  // because horizontal bounds may filter out header rows containing the template name.
  const usesDirectIndex = template.coloana_produs.startsWith('__idx:');
  
  const templateNameParts = normalizeForMatch(template.nume_magazin)
    .split(' ')
    .filter(p => p.length >= 3);
  
  let nameMatchFound = true;
  if (templateNameParts.length > 0 && !usesDirectIndex) {
    const fileText = jsonData.slice(0, Math.min(40, jsonData.length)).map(r => 
      (r || []).map((c: any) => normalizeForMatch(String(c || ''))).join(' ')
    ).join(' ');
    
    const matchedParts = templateNameParts.filter(part => fileText.includes(part));
    if (matchedParts.length === 0) {
      nameMatchFound = false;
      // Hard reject: if no part of the template name appears in the file, this template doesn't match
      throw new Error(`File content doesn't match template "${template.nume_magazin}" — no name parts found in first 40 rows`);
    }
    // For multi-word template names (e.g., "Lidl Fundeni"), ALL parts must match.
    // This prevents "Lidl Fundeni" from matching a generic "Lidl" PDF.
    if (templateNameParts.length > 1 && matchedParts.length < templateNameParts.length) {
      throw new Error(`File content doesn't match template "${template.nume_magazin}" — only ${matchedParts.length}/${templateNameParts.length} name parts found (matched: ${matchedParts.join(', ')}, missing: ${templateNameParts.filter(p => !matchedParts.includes(p)).join(', ')})`);
    }
  }

  let skipRows = template.randuri_skip || 0;

  // ========== AUTO-DETECT HEADER ROW ==========
  // For ALL template types, scan rows for the expected product column name.
  // This makes templates robust regardless of randuri_skip value.
  if (template.tip_split !== 'multi_column' && !template.coloana_produs.startsWith('__idx:')) {
    const targetCol = template.coloana_produs.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    for (let r = 0; r < Math.min(30, jsonData.length); r++) {
      const row = jsonData[r];
      if (!row) continue;
      const rowStr = row.map((c: any) => String(c || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim());
      if (rowStr.some((cell: string) => cell.includes(targetCol) || targetCol.includes(cell))) {
        console.log(`[auto-header] Found product column "${template.coloana_produs}" in row ${r}`);
        skipRows = r;
        break;
      }
    }
  }

  // For multi_column templates, auto-detect the LAST header row containing store names.
  // This handles PDFs with multiple sections (e.g., baxuri + caserole) — we want the last one.
  if (template.tip_split === 'multi_column' && template.store_columns && template.store_columns.length > 0) {
    const storeNames = (template.store_columns as StoreColumnConfig[]).map(sc => sc.store_name.toUpperCase().trim());
    let bestRow = -1;
    let bestMatchCount = 0;

    // Debug: dump all rows to find where store names appear
    console.log(`[multi_column] Searching for stores: ${storeNames.join(', ')} in ${jsonData.length} rows`);
    for (let r = 0; r < jsonData.length; r++) {
      const row = jsonData[r];
      if (!row) continue;
      const rowStr = row.map((c: any) => String(c || '').toUpperCase().trim()).join(' ');
      const matchCount = storeNames.filter(sn => rowStr.includes(sn)).length;
      if (matchCount > 0) {
        console.log(`[multi_column] Row ${r} matches ${matchCount} stores: ${JSON.stringify(row.map((c: any) => String(c || '').trim()))}`);
      }
      // Accept rows matching at least 2 store names (or all if only 1)
      if (matchCount >= Math.min(2, storeNames.length) && matchCount >= bestMatchCount) {
        bestMatchCount = matchCount;
        bestRow = r; // keep updating — we want the LAST matching row
      }
    }

    if (bestRow !== -1 && bestMatchCount >= Math.min(2, storeNames.length)) {
      console.log(`[multi_column] Auto-detected header row at index ${bestRow} (matched ${bestMatchCount}/${storeNames.length} stores)`);
      skipRows = bestRow;

      // Log header content for debugging
      const detectedHeaders = jsonData[bestRow]?.map((c: any) => String(c || '').toUpperCase().trim()) || [];
      console.log(`[multi_column] Header row content: ${JSON.stringify(detectedHeaders)}`);
    } else {
      // Store names not found by exact scan — try a looser scan:
      // Check if ANY row contains at least ONE store name (single match is OK for 2-store templates)
      let looseRow = -1;
      for (let r = 0; r < Math.min(20, jsonData.length); r++) {
        const row = jsonData[r];
        if (!row) continue;
        const rowStr = row.map((c: any) => String(c || '').toUpperCase().trim()).join(' ');
        if (storeNames.some(sn => rowStr.includes(sn))) {
          looseRow = r;
        }
      }
      if (looseRow !== -1) {
        console.log(`[multi_column] Loose store match at row ${looseRow}, using it`);
        skipRows = looseRow;
      } else {
        // Template name matches file content (validated earlier), trust the configured randuri_skip
        console.log(`[multi_column] Store names not found but template name matches file — using configured randuri_skip=${template.randuri_skip}`);
        skipRows = template.randuri_skip || 0;
      }
    }
  }

  const headerRow = jsonData[skipRows] || [];
  const headers = headerRow.map((h: any) => String(h || '').trim());

  let prodIdx = findColIndex(headers, template.coloana_produs);
  const gramajIdx = template.coloana_gramaj ? findColIndex(headers, template.coloana_gramaj) : -1;

  // For multi_column templates, if product column not found by name, default to column 0
  if (prodIdx === -1 && template.tip_split === 'multi_column' && template.store_columns && template.store_columns.length > 0) {
    prodIdx = 0;
  }

  if (prodIdx === -1) {
    throw new Error(`Coloana produs "${template.coloana_produs}" nu a fost găsită. Coloane disponibile: ${headers.join(', ')}`);
  }

  // ========== MULTI-COLUMN STORE SPLIT ==========
  // Each store has its own quantity column. Product column is shared.
  if (template.tip_split === 'multi_column' && template.store_columns && template.store_columns.length > 0) {
    let storeConfigs = template.store_columns as StoreColumnConfig[];
    let workingData = jsonData;

    // Sub-header detection: if the row after the header contains sub-headers
    // like "cas"/"bax", skip that row so it's not treated as product data.
    // The template's col_index values are trusted as-is (they should already
    // point to the correct column, e.g., "bax" = caserole count).
    const subHeaderRow = jsonData[skipRows + 1];
    if (subHeaderRow) {
      const subHeaders = subHeaderRow.map((c: any) => String(c || '').toLowerCase().trim());
      const hasCasBax = subHeaders.some(h => h === 'cas' || h === 'caserole') && 
                         subHeaders.some(h => h === 'bax' || h === 'baxuri');
      
      if (hasCasBax) {
        console.log(`[multi_column] Sub-header row detected (cas/bax), skipping row ${skipRows + 1}`);
        skipRows = skipRows + 1;
      }
    }

    // --- FIX: Expand merged columns ---
    // PDF parser sometimes merges nearby columns (e.g., "ROMAN IERNUT LUGOJ" into one cell).
    // Detect this by checking if a header cell contains multiple store names,
    // then split both headers and data cells accordingly.
    const storeNames = storeConfigs.map(sc => sc.store_name.toUpperCase().trim());
    const maxColIdx = Math.max(...storeConfigs.map(sc => sc.col_index));

    if (maxColIdx >= headers.length || headers.some(h => {
      const upper = (h || '').toUpperCase();
      return storeNames.filter(sn => upper.includes(sn)).length > 1;
    })) {
      // Find which header cells contain multiple merged store names
      const expandedData: any[][] = [];
      let newStoreConfigs: StoreColumnConfig[] = [];
      let expansionMap: { colIdx: number; matchedStores: string[] }[] = [];

      for (let colIdx = 0; colIdx < headers.length; colIdx++) {
        const headerUpper = (headers[colIdx] || '').toUpperCase();
        const matched = storeNames.filter(sn => headerUpper.includes(sn));
        if (matched.length > 1) {
          expansionMap.push({ colIdx, matchedStores: matched });
        }
      }

      if (expansionMap.length > 0) {
        console.log('[multi_column] Expanding merged columns:', expansionMap);

        // Rebuild each row with expanded columns
        for (let rowIdx = 0; rowIdx < workingData.length; rowIdx++) {
          const row = workingData[rowIdx];
          if (!row) { expandedData.push(row); continue; }

          const newRow: any[] = [];
          for (let colIdx = 0; colIdx < row.length; colIdx++) {
            const expansion = expansionMap.find(e => e.colIdx === colIdx);
            if (expansion) {
              const numSplits = expansion.matchedStores.length;
              if (rowIdx === skipRows) {
                // Split header cell into individual store names
                for (const storeName of expansion.matchedStores) {
                  newRow.push(storeName);
                }
              } else {
                // Split data cell: "72 72 72" -> ["72", "72", "72"]
                const cellValue = String(row[colIdx] || '').trim();
                const parts = cellValue.split(/\s+/).filter(p => p.length > 0);
                for (let k = 0; k < numSplits; k++) {
                  newRow.push(k < parts.length ? parts[k] : '');
                }
              }
            } else {
              newRow.push(row[colIdx]);
            }
          }
          expandedData.push(newRow);
        }

        // Remap store configs to new column indices
        const newHeaders = expandedData[skipRows]?.map((h: any) => String(h || '').toUpperCase().trim()) || [];
        newStoreConfigs = storeConfigs.map(sc => {
          const nameUpper = sc.store_name.toUpperCase().trim();
          const newIdx = newHeaders.findIndex((h: string) => h === nameUpper || h.includes(nameUpper));
          return newIdx !== -1 ? { ...sc, col_index: newIdx } : sc;
        });

        workingData = expandedData;
        storeConfigs = newStoreConfigs;

        // Recalculate prodIdx for expanded data
        const expandedHeaders = expandedData[skipRows]?.map((h: any) => String(h || '').trim()) || [];
        const newProdIdx = findColIndex(expandedHeaders, template.coloana_produs);
        if (newProdIdx !== -1) prodIdx = newProdIdx;
        else if (prodIdx === 0) { /* keep 0 */ }

        console.log('[multi_column] Expanded headers:', expandedHeaders);
        console.log('[multi_column] Remapped storeConfigs:', JSON.stringify(newStoreConfigs));
      }
    }

    const orders: ParsedOrder[] = [];

    for (const storeConfig of storeConfigs) {
      const storeProducts: ParsedProduct[] = [];

      for (let i = skipRows + 1; i < workingData.length; i++) {
        const row = workingData[i];
        if (!row) continue;

        const prodRaw = String(row[prodIdx] || '').trim();
        // Skip summary/total rows
        if (/^total/i.test(prodRaw)) continue;
        const cantitate = parseEuropeanNumber(row[storeConfig.col_index]);
        if (!prodRaw || cantitate <= 0) continue;

        const gramaj = gramajIdx !== -1 ? String(row[gramajIdx] || '').trim() : '';
        const mapped = mapProductWithTemplate(prodRaw, gramaj, template, products);
        storeProducts.push({ ...mapped, cantitate });
      }

      if (storeProducts.length > 0) {
        const normStore = normalizeForMatch(storeConfig.store_name);
        const normTemplateName = normalizeForMatch(template.nume_magazin);
        
        // First: find client matching BOTH the template brand (e.g. "lidl") AND the store name
        const matchedClient = clients.find(c => {
          const cNume = normalizeForMatch(c.nume_magazin);
          const cPunct = normalizeForMatch(c.punct_livrare);
          const belongsToChain = cNume.includes(normTemplateName) || normTemplateName.includes(cNume);
          return belongsToChain && (cPunct === normStore || cPunct.includes(normStore) || normStore.includes(cPunct));
        }) || clients.find(c => {
          // Fallback: match by punct_livrare only if client name is similar length to store name
          const cNume = normalizeForMatch(c.nume_magazin);
          const cPunct = normalizeForMatch(c.punct_livrare);
          if (cPunct === normStore) {
            const minLen = Math.min(normStore.length, cNume.length);
            const maxLen = Math.max(normStore.length, cNume.length);
            if (maxLen / minLen > 2) return false;
          }
          return cNume === normStore;
        });

        orders.push({
          client_id: matchedClient?.id || template.client_id,
          client_name: matchedClient?.nume_magazin || storeConfig.store_name,
          punct_livrare: matchedClient?.punct_livrare || storeConfig.store_name,
          products: storeProducts,
        });
      }
    }

    return orders;
  }

  // ========== STANDARD SINGLE/COLUMN/SECTION SPLIT ==========
  const cantIdx = findColIndex(headers, template.coloana_cantitate);
  const magazinIdx = template.coloana_magazin ? findColIndex(headers, template.coloana_magazin) : -1;

  if (cantIdx === -1) {
    throw new Error(`Coloana cantitate "${template.coloana_cantitate}" nu a fost găsită. Coloane disponibile: ${headers.join(', ')}`);
  }

  // Parse rows
  interface RawRow {
    produs_raw: string;
    cantitate: number;
    gramaj: string;
    magazin: string;
  }

  const rows: RawRow[] = [];
  let currentSection = '';

  // Buffer for multi-line rows (common in PDFs where product name and quantity are on separate lines)
  let pendingProductName = '';
  let pendingGramaj = '';

  for (let i = skipRows + 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row) continue;

    // Skip total rows
    const firstCell = String(row[0] || '').trim();
    if (/^total/i.test(firstCell)) continue;

    // For section-based splitting, detect section headers
    if (template.tip_split === 'section') {
      const prodCell = row[prodIdx];
      const cantCell = row[cantIdx];
      if (prodCell && (!cantCell || isNaN(Number(cantCell)))) {
        const cellStr = String(prodCell).trim();
        if (cellStr.length > 2 && !template.mappings?.some(m => normalizeForMatch(m.nume_in_fisier) === normalizeForMatch(cellStr))) {
          currentSection = cellStr;
          continue;
        }
      }
    }

    const prodRaw = String(row[prodIdx] || '').trim();
    const cantitate = parseEuropeanNumber(row[cantIdx]);
    const gramaj = gramajIdx !== -1 ? String(row[gramajIdx] || '').trim() : '';
    const magazin = magazinIdx !== -1
      ? String(row[magazinIdx] || '').trim()
      : (template.tip_split === 'section' ? currentSection : '');

    // Multi-line merge logic for PDF tables:
    // Case 1: Row has product name but no valid quantity → buffer it
    if (prodRaw && prodRaw.length > 2 && cantitate <= 0) {
      // Only buffer if it looks like a product name (not a code/number)
      if (!/^\d{4,}/.test(prodRaw) && !/^[\d\s\-]+$/.test(prodRaw)) {
        pendingProductName = pendingProductName ? pendingProductName + ' ' + prodRaw : prodRaw;
        if (gramaj) pendingGramaj = gramaj;
        continue;
      }
    }

    // Case 2: Row has quantity but no product name → use buffered product name
    if (cantitate > 0 && (!prodRaw || prodRaw.length <= 2 || /^\d{4,}/.test(prodRaw)) && pendingProductName) {
      rows.push({ produs_raw: pendingProductName, cantitate, gramaj: pendingGramaj || gramaj, magazin });
      pendingProductName = '';
      pendingGramaj = '';
      continue;
    }

    // Case 3: Row has both product and quantity → normal processing
    if (prodRaw && cantitate > 0) {
      // If there's a pending product, it was a false alarm (standalone text), discard it
      pendingProductName = '';
      pendingGramaj = '';
      rows.push({ produs_raw: prodRaw, cantitate, gramaj, magazin });
      continue;
    }

    // Case 4: Row has quantity and product name is on a DIFFERENT column
    // Check if any other column has text that looks like a product name
    if (cantitate > 0 && !prodRaw && !pendingProductName) {
      for (let c = 0; c < row.length; c++) {
        if (c === prodIdx || c === cantIdx || c === gramajIdx) continue;
        const cellText = String(row[c] || '').trim();
        if (cellText.length > 3 && !/^\d+$/.test(cellText) && !/^[\d.,\s]+$/.test(cellText)) {
          rows.push({ produs_raw: cellText, cantitate, gramaj, magazin });
          break;
        }
      }
    }
  }

  // Group by store if multi-store
  if (template.tip_split !== 'none' && rows.some(r => r.magazin)) {
    const storeGroups = new Map<string, RawRow[]>();
    for (const row of rows) {
      const key = row.magazin || 'default';
      if (!storeGroups.has(key)) storeGroups.set(key, []);
      storeGroups.get(key)!.push(row);
    }

    const orders: ParsedOrder[] = [];
    for (const [storeName, storeRows] of storeGroups) {
      const normStore = normalizeForMatch(storeName);
      const matchedClient = clients.find(c => {
        const cNume = normalizeForMatch(c.nume_magazin);
        const cPunct = normalizeForMatch(c.punct_livrare);
        return cNume.includes(normStore) || normStore.includes(cNume) ||
               cPunct.includes(normStore) || normStore.includes(cPunct);
      });

      orders.push({
        client_id: matchedClient?.id || template.client_id,
        client_name: matchedClient?.nume_magazin || storeName,
        punct_livrare: matchedClient?.punct_livrare || storeName,
        products: storeRows.map(r => ({
          ...mapProductWithTemplate(r.produs_raw, r.gramaj, template, products),
          cantitate: r.cantitate,
        })),
      });
    }

    return orders;
  }

  // Single store - use template's client
  const matchedClient = template.client_id
    ? clients.find(c => c.id === template.client_id)
    : null;

  return [{
    client_id: template.client_id,
    client_name: matchedClient?.nume_magazin || template.nume_magazin,
    punct_livrare: matchedClient?.punct_livrare || '',
    products: rows.map(r => ({
      ...mapProductWithTemplate(r.produs_raw, r.gramaj, template, products),
      cantitate: r.cantitate,
    })),
  }];
}
