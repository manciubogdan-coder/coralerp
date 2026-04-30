import { useState, useCallback } from "react";
 import { format } from "date-fns";
 import { ro } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
 import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
 import { Calendar } from "@/components/ui/calendar";
 import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useClients, useProducts, useCreateOrder, useAutoDistributeToLine } from "@/hooks/useProductionData";
import { Upload, X, FileImage, Loader2, Check, AlertCircle, Trash2, Plus, Save, FileSpreadsheet, FileText, Calendar as CalendarIcon, List, Package, FlaskConical, AlertTriangle, Printer, Download, Settings } from "lucide-react";
 import { Users } from "lucide-react";
import * as XLSX from 'xlsx';
 import * as pdfjsLib from 'pdfjs-dist';
 import { cn } from "@/lib/utils";
 import { useQuery, useQueryClient } from "@tanstack/react-query";
 import { useOcrMaterialNeeds } from "@/hooks/useOcrMaterialNeeds";
 import OcrOrdersByClient from "@/components/OcrOrdersByClient";
 import OcrTemplateManagement from "@/components/OcrTemplateManagement";
 import { parseExcelWithTemplate } from "@/lib/parseExcelWithTemplate";

import { parsePdfToRawData } from "@/lib/parsePdfToTable";
import TemplateWizard from "@/components/TemplateWizard";
import ScanColumnPicker, { type ScanColumnConfig } from "@/components/ScanColumnPicker";


interface ExtractedProduct {
  id?: string;
  nume_produs: string;
  gramaj: string;
  cantitate: number;
  confidence: number;
  matched_product_id?: string;
}

interface ExtractedOrder {
  id: string;
  file_url: string;
  file_name: string;
  file_type: 'image' | 'pdf' | 'excel';
  client: {
    nume_magazin: string;
    punct_livrare: string;
    confidence: number;
    matched_client_id?: string;
  };
  products: ExtractedProduct[];
  raw_text?: string;
  status: 'processing' | 'ready' | 'saved' | 'error';
  error_message?: string;
}

export default function OrderOCR() {
  const [extractedOrders, setExtractedOrders] = useState<ExtractedOrder[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
   const [selectedDate, setSelectedDate] = useState<Date>(new Date());
   const [filterDate, setFilterDate] = useState<Date>(new Date());
    const [materialsFilterDate, setMaterialsFilterDate] = useState<Date>(new Date());
   const [activeTab, setActiveTab] = useState("upload");
  // Template Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardRawData, setWizardRawData] = useState<any[][]>([]);
  const [wizardFileName, setWizardFileName] = useState('');
  const [wizardFileData, setWizardFileData] = useState<ArrayBuffer | null>(null);
  const [wizardPreParsedData, setWizardPreParsedData] = useState<any[][] | undefined>();
  const [wizardPendingOrderId, setWizardPendingOrderId] = useState<string | null>(null);
  const [wizardPendingFile, setWizardPendingFile] = useState<File | null>(null);
  // Scan column picker state
  const [scanPickerOpen, setScanPickerOpen] = useState(false);
  const [scanPickerHeaders, setScanPickerHeaders] = useState<string[]>([]);
  const [scanPickerRows, setScanPickerRows] = useState<string[][]>([]);
  const [scanPickerClient, setScanPickerClient] = useState('');
  const [scanPickerPendingOrderId, setScanPickerPendingOrderId] = useState<string | null>(null);
  const [scanPickerPendingBase64, setScanPickerPendingBase64] = useState<string | null>(null);
  const [scanPickerPendingFileType, setScanPickerPendingFileType] = useState<string>('');
  const [scanPickerPendingFileName, setScanPickerPendingFileName] = useState<string>('');
  const { toast } = useToast();
   const queryClient = useQueryClient();

  const { data: clients } = useClients();
  const { data: products } = useProducts();
  const createOrder = useCreateOrder();
  const autoDistribute = useAutoDistributeToLine();

  // Fetch active templates with mappings for local parsing
  const { data: activeTemplates } = useQuery({
    queryKey: ['ocr-templates-active'],
    queryFn: async () => {
      const { data: templatesData, error: tErr } = await supabase
        .from('productie_ocr_templates')
        .select('*')
        .eq('activ', true);
      if (tErr) throw tErr;

      const { data: mappingsData, error: mErr } = await supabase
        .from('productie_ocr_template_mappings')
        .select('*');
      if (mErr) throw mErr;

      return (templatesData as any[]).map(t => ({
        ...t,
        mappings: (mappingsData as any[]).filter(m => m.template_id === t.id),
      }));
    },
  });
 
   // Fetch OCR orders for selected filter date
   const { data: dailyOrders, isLoading: isLoadingDailyOrders } = useQuery({
     queryKey: ['ocr-daily-orders', format(filterDate, 'yyyy-MM-dd')],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('productie_ocr_comenzi')
         .select(`
           *,
           produs:productie_produse(id, nume)
         `)
         .eq('data_comanda', format(filterDate, 'yyyy-MM-dd'))
         .order('produs_nume');
       
       if (error) throw error;
       return data;
     },
   });
 
   // Aggregate orders by product
   const aggregatedOrders = dailyOrders?.reduce((acc, order) => {
     const key = order.produs_id || order.produs_nume;
     if (!acc[key]) {
       acc[key] = {
         produs_id: order.produs_id,
         produs_nume: order.produs?.nume || order.produs_nume,
         total_cantitate: 0,
         comenzi: [],
       };
     }
     acc[key].total_cantitate += order.cantitate;
     acc[key].comenzi.push(order);
     return acc;
   }, {} as Record<string, { produs_id: string | null; produs_nume: string; total_cantitate: number; comenzi: any[] }>) || {};
 
   const aggregatedList = Object.values(aggregatedOrders).sort((a, b) => 
     a.produs_nume.localeCompare(b.produs_nume)
   );
 
   // Hook for material needs calculation
   const { materialNeeds, isLoading: isLoadingMaterials } = useOcrMaterialNeeds(materialsFilterDate);

  // Export functions for daily orders
  const exportDailyOrdersExcel = () => {
    if (aggregatedList.length === 0) return;
    
    const exportData = aggregatedList.map(item => ({
      'Produs': item.produs_nume,
      'Cantitate Totală': item.total_cantitate,
      'Nr. Comenzi': item.comenzi.length
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Comenzile Zilei');
    XLSX.writeFile(wb, `comenzi-${format(filterDate, 'yyyy-MM-dd')}.xlsx`);
  };

  const printDailyOrders = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Comenzile Zilei - ${format(filterDate, 'dd.MM.yyyy')}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { font-size: 18px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f5f5f5; font-weight: bold; }
          .text-right { text-align: right; }
          .total { margin-top: 20px; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>Comenzile Zilei - ${format(filterDate, 'dd.MM.yyyy')}</h1>
        <table>
          <thead>
            <tr>
              <th>Produs</th>
              <th class="text-right">Cantitate Totală</th>
              <th class="text-right">Nr. Comenzi</th>
            </tr>
          </thead>
          <tbody>
            ${aggregatedList.map(item => `
              <tr>
                <td>${item.produs_nume}</td>
                <td class="text-right">${item.total_cantitate}</td>
                <td class="text-right">${item.comenzi.length}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="total">
          Total: ${aggregatedList.length} produse, ${dailyOrders?.length || 0} comenzi individuale
        </div>
        <script>window.print(); window.close();</script>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Export functions for material needs
  const exportMaterialsExcel = () => {
    if (materialNeeds.length === 0) return;
    
    const exportData = materialNeeds.map(item => ({
      'Ingredient': item.ingredient_nume,
      'Stoc Început Zi (kg)': item.stoc_inceput_zi.toFixed(2),
      'Necesar (kg)': item.cantitate_necesara.toFixed(2),
      'Diferență (kg)': item.diferenta.toFixed(2),
      'Status': item.status === 'ok' ? 'OK' : item.status === 'atentie' ? 'Atenție' : 'Insuficient'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Necesar Mat Prime');
    XLSX.writeFile(wb, `necesar-mat-prime-${format(materialsFilterDate, 'yyyy-MM-dd')}.xlsx`);
  };

  const printMaterials = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Necesar Materii Prime - ${format(materialsFilterDate, 'dd.MM.yyyy')}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { font-size: 18px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f5f5f5; font-weight: bold; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .ok { background-color: #dcfce7; }
          .atentie { background-color: #fef3c7; }
          .insuficient { background-color: #fee2e2; }
          .summary { margin-bottom: 20px; }
          .summary span { margin-right: 20px; padding: 4px 8px; border-radius: 4px; }
        </style>
      </head>
      <body>
        <h1>Necesar Materii Prime - ${format(materialsFilterDate, 'dd.MM.yyyy')}</h1>
        <div class="summary">
          <span>Total ingrediente: ${materialNeeds.length}</span>
          <span class="insuficient">Insuficient: ${materialNeeds.filter(m => m.status === 'insuficient').length}</span>
          <span class="atentie">Atenție: ${materialNeeds.filter(m => m.status === 'atentie').length}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Ingredient</th>
              <th class="text-right">Stoc Început Zi (kg)</th>
              <th class="text-right">Necesar (kg)</th>
              <th class="text-right">Diferență (kg)</th>
              <th class="text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            ${materialNeeds.map(item => `
              <tr class="${item.status}">
                <td>${item.ingredient_nume}</td>
                <td class="text-right">${item.stoc_inceput_zi.toFixed(2)}</td>
                <td class="text-right">${item.cantitate_necesara.toFixed(2)}</td>
                <td class="text-right">${item.diferenta >= 0 ? '+' : ''}${item.diferenta.toFixed(2)}</td>
                <td class="text-center">${item.status === 'ok' ? 'OK' : item.status === 'atentie' ? 'Atenție' : 'Insuficient'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <script>window.print(); window.close();</script>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const norm = (s: string) =>
    (s || "")
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\bcoral\b/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const normalizeGramaj = (s: string) =>
    (s || "")
      .toString()
      .toLowerCase()
      .replace(/(\d+)\s*(gr|g)\b/gi, '$1 g')
      .replace(/\s+/g, ' ')
      .trim();

  const normalizeProductLabel = (name: string, gramaj: string) => {
    const g = normalizeGramaj(gramaj);
    // if name already contains gramaj, avoid duplicating
    const n = norm(name).replace(new RegExp(`\\b${norm(g)}\\b`, 'g'), '').trim();
    return norm(`${n} ${g}`);
  };

  // Extract base product name without weight/gramaj suffixes
  const extractBaseName = (s: string): string => {
    return norm(s)
      .replace(/\b\d+\s*g\s*r?\b/g, '')
      .replace(/\b(bg|mc|gastro|salata|sal|fr|frunze|frunza|fresh|coral)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Simple Levenshtein distance for fuzzy matching
  const levenshtein = (a: string, b: string): number => {
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
  };

  const strSimilarity = (a: string, b: string): number => {
    const dist = levenshtein(a, b);
    return 1 - dist / Math.max(a.length, b.length, 1);
  };

  // Extract weight from a string like "Tisa 250 g BG" -> "250"
  const extractWeight = (s: string): string | null => {
    const match = s.match(/(\d+)\s*g\b/i);
    return match ? match[1] : null;
  };

  // Smart product matching: tries exact, then base name, then partial
  const smartMatchProduct = (
    name: string, 
    gramaj: string, 
    productsList: { id: string; nume: string }[],
    clientHint?: string
  ): { id: string; nume: string; confidence: number } | null => {
    const fullLabel = normalizeProductLabel(name, gramaj);
    const extractedBase = extractBaseName(name);
    const extractedWeight = extractWeight(name) || extractWeight(gramaj);
    const clientHintNorm = clientHint ? norm(clientHint).split(' ').filter(t => t.length >= 3) : [];

    // Helper: prefer products whose name contains the client hint (e.g., "LIDL")
    const preferClient = (candidates: { id: string; nume: string }[]): { id: string; nume: string } => {
      if (clientHintNorm.length > 0 && candidates.length > 1) {
        const hinted = candidates.find(p => {
          const pn = norm(p.nume);
          return clientHintNorm.some(h => pn.includes(h));
        });
        if (hinted) return hinted;
      }
      return candidates[0];
    };

    // Priority 1: Exact full match
    const exact = productsList.find(p => norm(p.nume) === fullLabel);
    if (exact) return { ...exact, confidence: 1 };

    // Priority 2: Full label contains/included
    const fullMatches = productsList.filter(p => {
      const pn = norm(p.nume);
      return pn.includes(fullLabel) || fullLabel.includes(pn);
    });
    if (fullMatches.length > 0) {
      const best = preferClient(fullMatches);
      return { ...best, confidence: 0.95 };
    }

     // Priority 3: Base name match with fuzzy similarity
    const baseMatches = productsList.filter(p => {
      const pBase = extractBaseName(p.nume);
      return pBase === extractedBase || 
             (pBase.length > 2 && extractedBase.length > 2 && 
              (pBase.includes(extractedBase) || extractedBase.includes(pBase))) ||
             (pBase.length > 3 && extractedBase.length > 3 && strSimilarity(pBase, extractedBase) >= 0.8);
    });

    if (baseMatches.length > 0) {
      if (extractedWeight) {
        const weightMatches = baseMatches.filter(p => extractWeight(p.nume) === extractedWeight);
        if (weightMatches.length > 0) {
          const best = preferClient(weightMatches);
          return { ...best, confidence: 0.95 };
        }
      }
      const best = preferClient(baseMatches);
      return { ...best, confidence: 0.7 };
    }

    // Priority 4: Token overlap with fuzzy token matching
    const extractedTokens = extractedBase.split(' ').filter(t => t.length > 1);
    if (extractedTokens.length > 0) {
      let bestMatch: { id: string; nume: string } | null = null;
      let bestScore = 0;
      for (const prod of productsList) {
        const prodBase = extractBaseName(prod.nume);
        const prodTokens = prodBase.split(' ').filter(t => t.length > 1);
        const overlap = extractedTokens.filter(t => prodTokens.some(pt => pt.includes(t) || t.includes(pt) || strSimilarity(pt, t) >= 0.8)).length;
        const score = overlap / Math.max(extractedTokens.length, prodTokens.length);
        if (score > bestScore && score >= 0.5) {
          bestScore = score;
          bestMatch = prod;
        }
      }
      if (bestMatch) return { ...bestMatch, confidence: Math.round(bestScore * 70) / 100 };
    }

    // Priority 5: Fuzzy full base name match as last resort
    let bestFuzzy: { id: string; nume: string } | null = null;
    let bestFuzzySim = 0;
    for (const prod of productsList) {
      const pBase = extractBaseName(prod.nume);
      const sim = strSimilarity(extractedBase, pBase);
      if (sim > bestFuzzySim && sim >= 0.7) {
        bestFuzzySim = sim;
        bestFuzzy = prod;
      }
    }
    if (bestFuzzy) return { ...bestFuzzy, confidence: Math.round(bestFuzzySim * 80) / 100 };

    return null;
  };

  const getFileType = (file: File): 'image' | 'pdf' | 'excel' => {
    const mimeType = file.type;
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension || '')) {
      return 'image';
    }
    if (mimeType === 'application/pdf' || extension === 'pdf') {
      return 'pdf';
    }
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || ['xlsx', 'xls', 'csv'].includes(extension || '')) {
      return 'excel';
    }
    return 'image'; // default
  };

  const getFileIcon = (fileType: 'image' | 'pdf' | 'excel') => {
    switch (fileType) {
      case 'pdf':
        return <FileText className="h-8 w-8 text-red-500" />;
      case 'excel':
        return <FileSpreadsheet className="h-8 w-8 text-green-600" />;
      default:
        return <FileImage className="h-8 w-8 text-blue-500" />;
    }
  };

  const extractTextFromExcel = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          let fullText = '';
          workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
            
            fullText += `=== Sheet: ${sheetName} ===\n`;
            jsonData.forEach((row) => {
              if (row && row.length > 0) {
                fullText += row.map(cell => cell?.toString() || '').join(' | ') + '\n';
              }
            });
            fullText += '\n';
          });
          
          resolve(fullText);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const processFile = useCallback(async (file: File, orderId: string) => {
    try {
      const fileType = getFileType(file);

      // Read file data once
      let fileData: ArrayBuffer | undefined;
      
      if (fileType === 'excel' || fileType === 'pdf') {
        fileData = await file.arrayBuffer();
      }

      // ========== EXCEL: Try template-based local parsing first (no AI cost!) ==========
      if (fileType === 'excel' && activeTemplates && activeTemplates.length > 0 && clients && products && fileData) {
        try {
          const workbook = XLSX.read(new Uint8Array(fileData), { type: 'array' });
          const ws = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
          const fileTextNorm = rows.map(r => 
            (r || []).map((c: any) => (c || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')).join(' ')
          ).join(' ');
          
          // Filter templates by text_identificare
          const eligibleTemplates = activeTemplates.filter((t: any) => {
            if (t.text_identificare && t.text_identificare.trim()) {
              const identNorm = t.text_identificare.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              return fileTextNorm.includes(identNorm);
            }
            return true;
          });
          
          let bestMatch: { template: typeof activeTemplates[0]; parsedOrders: any[]; productCount: number; orderCount: number; hasIdentifier: boolean } | null = null;
          
          for (const template of eligibleTemplates) {
            try {
              const parsedOrders = parseExcelWithTemplate(
                fileData,
                template,
                clients.map(c => ({ id: c.id, nume_magazin: c.nume_magazin, punct_livrare: c.punct_livrare })),
                products.map(p => ({ id: p.id, nume: p.nume })),
              );

              if (parsedOrders.length > 0 && parsedOrders.some(o => o.products.length > 0)) {
                const productCount = parsedOrders.reduce((s, o) => s + o.products.length, 0);
                const orderCount = parsedOrders.length;
                const hasIdentifier = !!(template as any).text_identificare?.trim();
                
                const isBetter = !bestMatch ||
                  (hasIdentifier && !bestMatch.hasIdentifier) ||
                  (hasIdentifier === bestMatch.hasIdentifier && orderCount > bestMatch.orderCount) ||
                  (hasIdentifier === bestMatch.hasIdentifier && orderCount === bestMatch.orderCount && productCount > bestMatch.productCount);
                
                if (isBetter) {
                  bestMatch = { template, parsedOrders, productCount, orderCount, hasIdentifier };
                }
              }
            } catch (templateErr) {
              console.log(`Template "${template.nume_magazin}" failed:`, templateErr);
            }
          }
          
          if (bestMatch) {
            const { template, parsedOrders } = bestMatch;
            console.log(`Best template: "${template.nume_magazin}" (orders=${bestMatch.orderCount}, products=${bestMatch.productCount})`);
            
            if (parsedOrders.length > 1) {
              const newOrders: ExtractedOrder[] = parsedOrders.map((parsed, idx) => ({
                id: idx === 0 ? orderId : `${orderId}-store-${idx}`,
                file_url: '',
                file_name: `${file.name} → ${parsed.client_name}`,
                file_type: 'excel' as const,
                client: {
                  nume_magazin: parsed.client_name,
                  punct_livrare: parsed.punct_livrare,
                  confidence: 1,
                  matched_client_id: parsed.client_id || undefined,
                },
                products: parsed.products,
                raw_text: `Parsat local cu template "${template.nume_magazin}"`,
                status: 'ready' as const,
              }));

              setExtractedOrders(prev => {
                const filtered = prev.filter(o => o.id !== orderId);
                return [...filtered, ...newOrders];
              });
            } else {
              const parsed = parsedOrders[0];
              setExtractedOrders(prev => prev.map(order =>
                order.id === orderId
                  ? {
                      ...order,
                      client: {
                        nume_magazin: parsed.client_name,
                        punct_livrare: parsed.punct_livrare,
                        confidence: 1,
                        matched_client_id: parsed.client_id || undefined,
                      },
                      products: parsed.products,
                      raw_text: `Parsat local cu template "${template.nume_magazin}"`,
                      status: 'ready' as const,
                    }
                  : order
              ));
            }
            return; // Successfully parsed with template
          }
          
          // No template matched for Excel → open wizard
          if (clients && fileData) {
            const rawDataForWizard = rows;
            if (rawDataForWizard.length > 0) {
              setWizardRawData(rawDataForWizard.slice(0, 50));
              setWizardFileName(file.name);
              setWizardFileData(fileData);
              setWizardPreParsedData(undefined);
              setWizardPendingOrderId(orderId);
              setWizardPendingFile(file);
              setWizardOpen(true);
              
              setExtractedOrders(prev => prev.map(order =>
                order.id === orderId
                  ? {
                      ...order,
                      status: 'error' as const,
                      error_message: '⚙️ Template necunoscut — se deschide wizardul de configurare...',
                    }
                  : order
              ));
              return;
            }
          }
        } catch (err) {
          console.log('Excel template parsing failed, falling back to AI:', err);
        }
      }

      // ========== PDF & IMAGE: ALWAYS use AI (scans need vision) ==========
      // ========== EXCEL without template: also falls through here ==========
      let fileBase64: string | null = null;
      let extractedText: string | null = null;

      if (fileType === 'excel') {
        extractedText = await extractTextFromExcel(file);
      } else {
        fileBase64 = await fileToBase64(file);
      }

      // Check if we have a scan template matching this document
      // Try to match by doing a quick detect first or by client name from file
      let scanTemplate: any = null;
      if (activeTemplates && fileType !== 'excel') {
        const scanTemplates = activeTemplates.filter((t: any) => 
          t.tip_document === 'scan' && t.coloana_produs && t.coloana_cantitate
        );
        // If only one scan template, use it
        if (scanTemplates.length === 1) {
          scanTemplate = scanTemplates[0];
        } else if (scanTemplates.length > 1) {
          // Try to match by text_identificare or client name from filename
          const fileNameNorm = norm(file.name);
          scanTemplate = scanTemplates.find((t: any) => {
            if (t.text_identificare?.trim()) {
              return fileNameNorm.includes(norm(t.text_identificare));
            }
            return fileNameNorm.includes(norm(t.nume_magazin || ''));
          }) || null;
          // If no match by name, don't use any — ask user again
        }
      }

      // If NO scan template matched for PDF/image → detect columns first, then try to match by client_detected
      if (!scanTemplate && fileType !== 'excel' && fileBase64) {
        console.log('No scan template found by filename, detecting columns to identify client...');
        
        setExtractedOrders(prev => prev.map(order =>
          order.id === orderId
            ? { ...order, error_message: '🔍 Se detectează structura tabelului...', status: 'processing' as const }
            : order
        ));

        const { data: detectData, error: detectError } = await supabase.functions.invoke('ocr-order', {
          body: {
            file_base64: fileBase64,
            file_type: fileType,
            mode: 'detect-columns',
          },
        });

        if (!detectError && detectData?.headers?.length > 0) {
          // Try to match template by client_detected from AI
          const detectedClient = detectData.client_detected || '';
          const detectedClientNorm = norm(detectedClient);
          const scanTemplates = (activeTemplates || []).filter((t: any) => 
            t.tip_document === 'scan' && t.coloana_produs && t.coloana_cantitate
          );
          
          if (detectedClientNorm && scanTemplates.length > 0) {
            const matchedByClient = scanTemplates.find((t: any) => {
              const tName = norm(t.nume_magazin || '');
              const tIdent = norm(t.text_identificare || '');
              return (tName && (detectedClientNorm.includes(tName) || tName.includes(detectedClientNorm))) ||
                     (tIdent && (detectedClientNorm.includes(tIdent) || tIdent.includes(detectedClientNorm)));
            });
            if (matchedByClient) {
              console.log(`Matched template "${matchedByClient.nume_magazin}" by client_detected="${detectedClient}"`);
              scanTemplate = matchedByClient;
            }
          }
          
          // If still no match, show picker to user
          if (!scanTemplate) {
            setScanPickerHeaders(detectData.headers);
            setScanPickerRows(detectData.sample_rows || []);
            setScanPickerClient(detectedClient);
            setScanPickerPendingOrderId(orderId);
            setScanPickerPendingBase64(fileBase64);
            setScanPickerPendingFileType(fileType);
            setScanPickerPendingFileName(file.name);
            setScanPickerOpen(true);

            setExtractedOrders(prev => prev.map(order =>
              order.id === orderId
                ? { ...order, error_message: '⚙️ Selectează coloanele de produs și cantitate...', status: 'error' as const }
                : order
            ));
            return; // Wait for user to pick columns
          }
        }
        // If detect failed and no template, fall through to normal extraction
        if (!scanTemplate) {
          console.log('Column detection failed, falling back to auto-extract');
        }
      }

      // Use column hints from scan template if available
      const colProdus = scanTemplate?.coloana_produs;
      const colCantitate = scanTemplate?.coloana_cantitate;
      const colIdxProdus = scanTemplate?.col_index_produs;
      const colIdxCantitate = scanTemplate?.col_index_cantitate;

      // ========== SCAN TEMPLATE WITH KNOWN COLUMNS: extract full table then pick locally ==========
      const storeColumns = scanTemplate?.store_columns as { store_name: string; col_index: number }[] | null;
      const isMultiStore = scanTemplate?.tip_split === 'multi_column' && storeColumns && storeColumns.length > 1;
      const hasScanColumnIndices = scanTemplate && colIdxProdus !== undefined && colIdxProdus !== null && colIdxCantitate !== undefined && colIdxCantitate !== null;
      
      if (isMultiStore || hasScanColumnIndices) {
        const effectiveStoreColumns = isMultiStore && storeColumns
          ? storeColumns
          : [{ store_name: scanTemplate?.nume_magazin || '', col_index: colIdxCantitate! }];
        
        console.log(`Scan template "${scanTemplate.nume_magazin}" - full-table-extract with ${effectiveStoreColumns.length} store(s), prodCol=${colIdxProdus}, qtyCol(s)=`, effectiveStoreColumns);

        setExtractedOrders(prev => prev.map(order =>
          order.id === orderId
            ? { ...order, error_message: `🔄 Se extrage tabelul complet...`, status: 'processing' as const }
            : order
        ));

        // Single AI call to get the full table
        const { data: tableData, error: tableError } = await supabase.functions.invoke('ocr-order', {
          body: {
            file_base64: fileBase64,
            file_type: fileType,
            extracted_text: extractedText,
            mode: 'full-table-extract',
          },
        });

        if (tableError) {
          throw new Error(tableError.message);
        }

        const headers: string[] = tableData?.headers || [];
        const rows: string[][] = tableData?.rows || [];
        
        // Try to find correct column indices by matching header names from template
        let prodColIdx = colIdxProdus ?? 0;
        let baseQtyColIdx = colIdxCantitate ?? 0;
        
        // Validate indices by checking if header names match template
        const normH = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const templateProdName = normH(colProdus || '');
        const templateQtyName = normH(colCantitate || '');
        
        if (templateProdName && headers.length > 0) {
          const foundProdIdx = headers.findIndex(h => normH(h) === templateProdName || normH(h).includes(templateProdName) || templateProdName.includes(normH(h)));
          if (foundProdIdx >= 0 && foundProdIdx !== prodColIdx) {
            console.log(`Column correction: product col ${prodColIdx} -> ${foundProdIdx} (matched "${headers[foundProdIdx]}" to "${colProdus}")`);
            prodColIdx = foundProdIdx;
          }
        }
        
        if (templateQtyName && headers.length > 0 && !isMultiStore) {
          const foundQtyIdx = headers.findIndex(h => normH(h) === templateQtyName || normH(h).includes(templateQtyName) || templateQtyName.includes(normH(h)));
          if (foundQtyIdx >= 0 && foundQtyIdx !== baseQtyColIdx) {
            console.log(`Column correction: qty col ${baseQtyColIdx} -> ${foundQtyIdx} (matched "${headers[foundQtyIdx]}" to "${colCantitate}")`);
            baseQtyColIdx = foundQtyIdx;
            // Update effectiveStoreColumns for single-store
            if (!isMultiStore) {
              effectiveStoreColumns[0] = { ...effectiveStoreColumns[0], col_index: foundQtyIdx };
            }
          }
        }

        console.log(`Full table: ${headers.length} headers, ${rows.length} rows, prodCol=${prodColIdx}, qtyCol=${baseQtyColIdx}`, headers);

        const newOrders: ExtractedOrder[] = [];

        for (let storeIdx = 0; storeIdx < effectiveStoreColumns.length; storeIdx++) {
          const storeCol = effectiveStoreColumns[storeIdx];
          const qtyColIdx = storeCol.col_index;

          // Build products from local column extraction
          const extractedProducts: ExtractedProduct[] = [];
          for (const row of rows) {
            const productName = (row[prodColIdx] || '').toString().trim();
            if (!productName) continue;

            const rawQty = (row[qtyColIdx] || '').toString().trim();
            const qty = parseFloat(rawQty.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
            if (qty <= 0) continue;

            extractedProducts.push({
              nume_produs: productName,
              gramaj: '',
              cantitate: Math.round(qty),
              confidence: 0.95,
            });
          }

          console.log(`Store "${storeCol.store_name}" (col ${qtyColIdx}): ${extractedProducts.length} products`);

          // Match client for this store - use template's client_id for single-store
          const storeName = storeCol.store_name || '';
          let storeClientId: string | undefined = (!isMultiStore && scanTemplate?.client_id) ? scanTemplate.client_id : undefined;
          let storeClientName = storeName || scanTemplate?.nume_magazin || '';
          let storeClientPunct = '';
          if (clients) {
            if (storeClientId) {
              // Already have client_id from template
              const clientMatch = clients.find(c => c.id === storeClientId);
              if (clientMatch) {
                storeClientName = clientMatch.nume_magazin;
                storeClientPunct = clientMatch.punct_livrare;
              }
            } else if (storeName) {
              const storeNorm = norm(storeName);
              const clientMatch = clients.find(c => {
                const cNume = norm(c.nume_magazin || '');
                const cPunct = norm(c.punct_livrare || '');
                return cNume.includes(storeNorm) || storeNorm.includes(cNume) ||
                       cPunct.includes(storeNorm) || storeNorm.includes(cPunct);
              });
              if (clientMatch) {
                storeClientId = clientMatch.id;
                storeClientName = clientMatch.nume_magazin;
                storeClientPunct = clientMatch.punct_livrare;
              }
            }
          }

          // Match products
          const storeProducts = extractedProducts.map((p) => {
            if (!p.nume_produs || !products) return p;
            if (activeTemplates) {
              for (const tmpl of activeTemplates) {
                const mapping = (tmpl.mappings || []).find((m: any) => {
                  const mNorm = norm(m.text_original || '');
                  const pNorm = norm(p.nume_produs);
                  return mNorm === pNorm || mNorm.includes(pNorm) || pNorm.includes(mNorm);
                });
                if (mapping?.produs_id) {
                  const prod = products.find(pr => pr.id === mapping.produs_id);
                  if (prod) return { ...p, matched_product_id: prod.id, nume_produs: prod.nume, confidence: 1 };
                }
              }
            }
            const match = smartMatchProduct(p.nume_produs, p.gramaj || '', products, storeClientName);
            if (match) return { ...p, matched_product_id: match.id, nume_produs: match.nume, confidence: match.confidence };
            return p;
          });

          if (storeProducts.length > 0) {
            newOrders.push({
              id: storeIdx === 0 ? orderId : `${orderId}-store-${storeIdx}`,
              file_url: '',
              file_name: `${file.name} → ${storeClientName}`,
              file_type: fileType,
              client: {
                nume_magazin: storeClientName,
                punct_livrare: storeClientPunct,
                confidence: 0.9,
                matched_client_id: storeClientId,
              },
              products: storeProducts,
              raw_text: `Multi-store: ${storeCol.store_name} (col ${storeCol.col_index})`,
              status: 'ready' as const,
            });
          }
        }

        if (newOrders.length > 0) {
          setExtractedOrders(prev => {
            const filtered = prev.filter(o => o.id !== orderId);
            return [...filtered, ...newOrders];
          });
          return;
        }
        // If no orders extracted, fall through to single extraction
        console.warn('Multi-store extraction returned 0 orders, falling back to single extraction');
      }

      console.log(`Sending ${fileType} to AI (scan-extract mode)...${colProdus ? ` columns: ${colProdus}(idx:${colIdxProdus})/${colCantitate}(idx:${colIdxCantitate})` : ''}`);

      const { data, error } = await supabase.functions.invoke('ocr-order', {
        body: {
          file_base64: fileBase64,
          file_type: fileType,
          extracted_text: extractedText,
          mode: 'scan-extract',
          col_produs: colProdus,
          col_cantitate: colCantitate,
          col_index_produs: colIdxProdus,
          col_index_cantitate: colIdxCantitate,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      const clientData = data?.client || { nume_magazin: '', punct_livrare: '', confidence: 0 };
      const clientNume = clientData.nume_magazin || '';
      const clientPunct = clientData.punct_livrare || '';

      // Match client from system
      let matchedClientId: string | undefined;
      if (clientNume && clients) {
        const extractedNume = norm(clientNume);
        const extractedPunct = norm(clientPunct);
        const clientMatch = clients.find(c => {
          const cNume = norm(c.nume_magazin || '');
          const cPunct = norm(c.punct_livrare || '');
          const nameOk = cNume.includes(extractedNume) || extractedNume.includes(cNume);
          const punctOk = !extractedPunct || cPunct.includes(extractedPunct) || extractedPunct.includes(cPunct);
          return nameOk && punctOk;
        });
        if (clientMatch) {
          matchedClientId = clientMatch.id;
          clientData.nume_magazin = clientMatch.nume_magazin;
          clientData.punct_livrare = clientMatch.punct_livrare;
        }
      }

      // Match products: first check template mappings, then smart matching
      const extractedProducts = data?.products || [];
      const matchedProducts = extractedProducts.map((p: ExtractedProduct) => {
        const productName = p.nume_produs || '';
        const productGramaj = p.gramaj || '';
        
        if (!productName || !products) return p;

        // Priority 1: Check saved template mappings
        if (activeTemplates) {
          for (const tmpl of activeTemplates) {
            const mapping = (tmpl.mappings || []).find((m: any) => {
              const mNorm = norm(m.text_original || '');
              const pNorm = norm(productName);
              return mNorm === pNorm || mNorm.includes(pNorm) || pNorm.includes(mNorm);
            });
            if (mapping && mapping.produs_id) {
              const prod = products.find(pr => pr.id === mapping.produs_id);
              if (prod) {
                return { ...p, matched_product_id: prod.id, nume_produs: prod.nume, confidence: 1 };
              }
            }
          }
        }

        // Priority 2: Smart matching algorithm
        const match = smartMatchProduct(productName, productGramaj, products, clientData.nume_magazin);
        if (match) {
          return { ...p, matched_product_id: match.id, nume_produs: match.nume, confidence: match.confidence };
        }
        
        return p;
      });

      setExtractedOrders(prev => prev.map(order =>
        order.id === orderId
          ? {
              ...order,
              client: {
                nume_magazin: clientData.nume_magazin || '',
                punct_livrare: clientData.punct_livrare || '',
                confidence: clientData.confidence || 0,
                matched_client_id: matchedClientId,
              },
              products: matchedProducts,
              raw_text: data?.raw_text || extractedText?.substring(0, 1000) || '',
              status: 'ready' as const,
            }
          : order
      ));

    } catch (error) {
      console.error('Error processing file:', error);
      setExtractedOrders(prev => prev.map(order =>
        order.id === orderId
          ? {
              ...order,
              status: 'error' as const,
              error_message: error instanceof Error ? error.message : 'Unknown error',
            }
          : order
      ));
    }
  }, [clients, products, activeTemplates, queryClient, toast]);

  // Handle wizard template creation — re-parse file with new template
  const handleWizardTemplateCreated = useCallback(async (templateId: string) => {
    if (!wizardPendingOrderId || !wizardFileData || !clients || !products) return;

    try {
      // Fetch the newly created template
      const { data: newTemplate, error: fetchErr } = await supabase
        .from('productie_ocr_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (fetchErr || !newTemplate) throw new Error('Nu s-a putut citi template-ul salvat');

      const templateWithMappings = { ...newTemplate, mappings: [] };
      
      // Re-parse PDF with template's visual separators if available
      let parsedData = wizardPreParsedData;
      if ((newTemplate as any).visual_separators && wizardFileData) {
        parsedData = await parsePdfToRawData(wizardFileData, (newTemplate as any).visual_separators);
      }
      
      const parsedOrders = parseExcelWithTemplate(
        wizardFileData,
        templateWithMappings as any,
        clients.map(c => ({ id: c.id, nume_magazin: c.nume_magazin, punct_livrare: c.punct_livrare })),
        products.map(p => ({ id: p.id, nume: p.nume })),
        parsedData
      );

      const orderId = wizardPendingOrderId;
      const fileName = wizardFileName;

      if (parsedOrders.length > 0 && parsedOrders.some(o => o.products.length > 0)) {
        if (parsedOrders.length > 1) {
          const newOrders: ExtractedOrder[] = parsedOrders.map((parsed, idx) => ({
            id: idx === 0 ? orderId : `${orderId}-store-${idx}`,
            file_url: '',
            file_name: `${fileName} → ${parsed.client_name}`,
            file_type: 'excel' as const,
            client: {
              nume_magazin: parsed.client_name,
              punct_livrare: parsed.punct_livrare,
              confidence: 1,
              matched_client_id: parsed.client_id || undefined,
            },
            products: parsed.products,
            raw_text: `Template creat colaborativ "${newTemplate.nume_magazin}"`,
            status: 'ready' as const,
          }));
          setExtractedOrders(prev => {
            const filtered = prev.filter(o => o.id !== orderId);
            return [...filtered, ...newOrders];
          });
        } else {
          const parsed = parsedOrders[0];
          setExtractedOrders(prev => prev.map(order =>
            order.id === orderId
              ? {
                  ...order,
                  client: {
                    nume_magazin: parsed.client_name,
                    punct_livrare: parsed.punct_livrare,
                    confidence: 1,
                    matched_client_id: parsed.client_id || undefined,
                  },
                  products: parsed.products,
                  raw_text: `Template creat colaborativ "${newTemplate.nume_magazin}"`,
                  status: 'ready' as const,
                }
              : order
          ));
        }
      } else {
        // Template matched but extracted 0 products - inform user
        console.warn(`Template "${newTemplate.nume_magazin}" matched but extracted 0 products. Falling back to AI.`);
        toast({
          title: "Template salvat",
          description: "Template-ul a fost salvat, dar nu s-au putut extrage produse din acest fișier. Se va folosi AI ca fallback.",
        });
        // Fall back to AI processing for this file
        if (wizardPendingFile) {
          processFile(wizardPendingFile, orderId);
        }
      }

      // Refresh template caches
      queryClient.invalidateQueries({ queryKey: ['ocr-templates-active'] });
      queryClient.invalidateQueries({ queryKey: ['ocr-templates'] });
    } catch (err) {
      console.error('Error re-parsing with new template:', err);
      toast({
        title: "Template salvat dar parsarea a eșuat",
        description: "Reîncarcă fișierul pentru a folosi noul template.",
        variant: "destructive",
      });
    }

    // Clean up wizard state
    setWizardPendingOrderId(null);
    setWizardFileData(null);
    setWizardPreParsedData(undefined);
    setWizardPendingFile(null);
  }, [wizardPendingOrderId, wizardFileData, wizardPreParsedData, wizardFileName, wizardPendingFile, clients, products, queryClient, toast, processFile]);

  // Handle scan column picker confirmation — save template and re-extract with column hints
  const handleScanColumnConfirm = useCallback(async (config: ScanColumnConfig) => {
    setScanPickerOpen(false);
    const orderId = scanPickerPendingOrderId;
    const fileBase64 = scanPickerPendingBase64;
    const fileType = scanPickerPendingFileType;
    const fileName = scanPickerPendingFileName;

    const { colProdus, colCantitate, colProdusIdx, colCantitateIdx, colMagazin, colMagazinIdx, clientManual, clientId, storeColumns } = config;
    const clientName = clientManual || scanPickerClient;
    const isMultiStore = storeColumns && storeColumns.length > 1;

    if (!orderId || !fileBase64) return;

    try {
      // Save as scan template in database
      const templateData: any = {
        nume_magazin: clientName || fileName,
        tip_document: 'scan',
        coloana_produs: colProdus,
        col_index_produs: colProdusIdx,
        coloana_cantitate: colCantitate,
        col_index_cantitate: colCantitateIdx,
        randuri_skip: 0,
        tip_split: isMultiStore ? 'multi_column' : (colMagazin ? 'multi_column' : 'none'),
        activ: true,
      };
      if (isMultiStore) {
        templateData.store_columns = storeColumns.map(sc => ({ store_name: sc.store_name, col_index: sc.col_index }));
      }

      const { error: saveErr } = await supabase
        .from('productie_ocr_templates')
        .upsert(templateData, { onConflict: 'nume_magazin' });

      if (saveErr) {
        console.error('Error saving scan template:', saveErr);
      } else {
        const storeNames = isMultiStore ? storeColumns.map(sc => sc.store_name).join(', ') : '';
        toast({ title: "Template scanare salvat", description: isMultiStore ? `Magazine: ${storeNames}` : `Coloane: ${colProdus} / ${colCantitate}` });
        queryClient.invalidateQueries({ queryKey: ['ocr-templates-active'] });
        queryClient.invalidateQueries({ queryKey: ['ocr-templates'] });
      }

      // ========== MULTI-STORE: extract per store column ==========
      if (isMultiStore) {
        const newOrders: ExtractedOrder[] = [];

        for (let storeIdx = 0; storeIdx < storeColumns.length; storeIdx++) {
          const storeCol = storeColumns[storeIdx];

          setExtractedOrders(prev => prev.map(order =>
            order.id === orderId
              ? { ...order, status: 'processing' as const, error_message: `🔄 Se extrage ${storeCol.store_name} (${storeIdx + 1}/${storeColumns.length})...` }
              : order
          ));

          const { data: storeData, error: storeError } = await supabase.functions.invoke('ocr-order', {
            body: {
              file_base64: fileBase64,
              file_type: fileType,
              mode: 'scan-extract',
              col_produs: colProdus,
              col_cantitate: storeCol.col_name,
              col_index_produs: colProdusIdx,
              col_index_cantitate: storeCol.col_index,
            },
          });

          if (storeError) {
            console.error(`Error extracting store "${storeCol.store_name}":`, storeError);
            continue;
          }

          // Match client for this store
          let storeClientId: string | undefined;
          let storeClientName = storeCol.store_name;
          let storeClientPunct = '';
          if (clients && storeCol.store_name) {
            const storeNorm = norm(storeCol.store_name);
            const clientMatch = clients.find(c => {
              const cNume = norm(c.nume_magazin || '');
              const cPunct = norm(c.punct_livrare || '');
              return cNume.includes(storeNorm) || storeNorm.includes(cNume) ||
                     cPunct.includes(storeNorm) || storeNorm.includes(cPunct);
            });
            if (clientMatch) {
              storeClientId = clientMatch.id;
              storeClientName = clientMatch.nume_magazin;
              storeClientPunct = clientMatch.punct_livrare;
            }
          }

          const storeProducts = (storeData?.products || [])
            .filter((p: ExtractedProduct) => p.cantitate > 0)
            .map((p: ExtractedProduct) => {
              if (!p.nume_produs || !products) return p;
              const match = smartMatchProduct(p.nume_produs, p.gramaj || '', products, storeClientName);
              if (match) return { ...p, matched_product_id: match.id, nume_produs: match.nume, confidence: match.confidence };
              return p;
            });

          if (storeProducts.length > 0) {
            newOrders.push({
              id: storeIdx === 0 ? orderId : `${orderId}-store-${storeIdx}`,
              file_url: '',
              file_name: `${fileName} → ${storeClientName}`,
              file_type: fileType as any,
              client: {
                nume_magazin: storeClientName,
                punct_livrare: storeClientPunct,
                confidence: 0.9,
                matched_client_id: storeClientId,
              },
              products: storeProducts,
              raw_text: `Multi-store: ${storeCol.store_name} (col ${storeCol.col_index})`,
              status: 'ready' as const,
            });
          }
        }

        if (newOrders.length > 0) {
          setExtractedOrders(prev => {
            const filtered = prev.filter(o => o.id !== orderId);
            return [...filtered, ...newOrders];
          });
        } else {
          setExtractedOrders(prev => prev.map(order =>
            order.id === orderId
              ? { ...order, status: 'error' as const, error_message: 'Nu s-au extras produse din niciun magazin' }
              : order
          ));
        }
      } else {
        // ========== SINGLE STORE: normal extraction ==========
        setExtractedOrders(prev => prev.map(order =>
          order.id === orderId
            ? { ...order, status: 'processing' as const, error_message: '🔄 Se re-extrage cu coloanele selectate...' }
            : order
        ));

        const { data, error } = await supabase.functions.invoke('ocr-order', {
          body: {
            file_base64: fileBase64,
            file_type: fileType,
            mode: 'scan-extract',
            col_produs: colProdus,
            col_cantitate: colCantitate,
            col_index_produs: colProdusIdx,
            col_index_cantitate: colCantitateIdx,
          },
        });

        if (error) throw new Error(error.message);

        const clientData = data?.client || { nume_magazin: '', punct_livrare: '', confidence: 0 };
        let matchedClientId: string | undefined = clientId;
        
        if (clientId && clients) {
          const selectedClient = clients.find(c => c.id === clientId);
          if (selectedClient) {
            clientData.nume_magazin = selectedClient.nume_magazin;
            clientData.punct_livrare = selectedClient.punct_livrare;
            matchedClientId = selectedClient.id;
          }
        } else if (clientName && clients) {
          const extractedNume = norm(clientName);
          const clientMatch = clients.find(c => {
            const cNume = norm(c.nume_magazin || '');
            return cNume.includes(extractedNume) || extractedNume.includes(cNume);
          });
          if (clientMatch) {
            matchedClientId = clientMatch.id;
            clientData.nume_magazin = clientMatch.nume_magazin;
            clientData.punct_livrare = clientMatch.punct_livrare;
          } else {
            clientData.nume_magazin = clientName;
          }
        }

        const matchedProducts = (data?.products || []).map((p: ExtractedProduct) => {
          if (!p.nume_produs || !products) return p;
          const match = smartMatchProduct(p.nume_produs, p.gramaj || '', products, clientData.nume_magazin);
          if (match) return { ...p, matched_product_id: match.id, nume_produs: match.nume, confidence: match.confidence };
          return p;
        });

        setExtractedOrders(prev => prev.map(order =>
          order.id === orderId
            ? {
                ...order,
                client: {
                  nume_magazin: clientData.nume_magazin || '',
                  punct_livrare: clientData.punct_livrare || '',
                  confidence: clientData.confidence || 0,
                  matched_client_id: matchedClientId,
                },
                products: matchedProducts,
                raw_text: `Extras cu coloane: ${colProdus} / ${colCantitate}`,
                status: 'ready' as const,
              }
            : order
        ));
      }
    } catch (err) {
      console.error('Error in scan column confirm:', err);
      setExtractedOrders(prev => prev.map(order =>
        order.id === orderId
          ? { ...order, status: 'error' as const, error_message: err instanceof Error ? err.message : 'Eroare' }
          : order
      ));
    }

    // Cleanup
    setScanPickerPendingOrderId(null);
    setScanPickerPendingBase64(null);
  }, [scanPickerPendingOrderId, scanPickerPendingBase64, scanPickerPendingFileType, scanPickerPendingFileName, scanPickerClient, clients, products, toast, queryClient]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);

    const newOrders: ExtractedOrder[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const orderId = `order-${Date.now()}-${i}`;
      const fileType = getFileType(file);
      const fileUrl = fileType === 'image' ? URL.createObjectURL(file) : '';
      
      newOrders.push({
        id: orderId,
        file_url: fileUrl,
        file_name: file.name,
        file_type: fileType,
        client: { nume_magazin: '', punct_livrare: '', confidence: 0 },
        products: [],
        status: 'processing',
      });
    }

    setExtractedOrders(prev => [...prev, ...newOrders]);

    // Process each file
    for (let i = 0; i < files.length; i++) {
      await processFile(files[i], newOrders[i].id);
    }

    setIsProcessing(false);
    event.target.value = ''; // Reset input
  }, [processFile]);

  const handleDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);

    const newOrders: ExtractedOrder[] = [];
    const validFiles: File[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileType = getFileType(file);
      
      const orderId = `order-${Date.now()}-${i}`;
      const fileUrl = fileType === 'image' ? URL.createObjectURL(file) : '';
      
      newOrders.push({
        id: orderId,
        file_url: fileUrl,
        file_name: file.name,
        file_type: fileType,
        client: { nume_magazin: '', punct_livrare: '', confidence: 0 },
        products: [],
        status: 'processing',
      });
      validFiles.push(file);
    }

    setExtractedOrders(prev => [...prev, ...newOrders]);

    // Process each file
    for (let i = 0; i < validFiles.length; i++) {
      await processFile(validFiles[i], newOrders[i].id);
    }

    setIsProcessing(false);
  }, [processFile]);

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const updateOrderClient = (orderId: string, clientId: string) => {
    const client = clients?.find(c => c.id === clientId);
    if (!client) return;

    setExtractedOrders(prev => prev.map(order => 
      order.id === orderId 
        ? { 
            ...order, 
            client: {
              ...order.client,
              matched_client_id: clientId,
              nume_magazin: client.nume_magazin,
              punct_livrare: client.punct_livrare,
              confidence: 1,
            }
          }
        : order
    ));
  };

  const updateProductMatch = (orderId: string, productIndex: number, productId: string) => {
    const product = products?.find(p => p.id === productId);
    if (!product) return;

    setExtractedOrders(prev => prev.map(order => 
      order.id === orderId 
        ? { 
            ...order, 
            products: order.products.map((p, idx) => 
              idx === productIndex 
                ? { ...p, matched_product_id: productId, nume_produs: product.nume, confidence: 1 }
                : p
            )
          }
        : order
    ));
  };

  const updateProductQuantity = (orderId: string, productIndex: number, quantity: number) => {
    setExtractedOrders(prev => prev.map(order => 
      order.id === orderId 
        ? { 
            ...order, 
            products: order.products.map((p, idx) => 
              idx === productIndex 
                ? { ...p, cantitate: quantity }
                : p
            )
          }
        : order
    ));
  };

  const removeProduct = (orderId: string, productIndex: number) => {
    setExtractedOrders(prev => prev.map(order => 
      order.id === orderId 
        ? { 
            ...order, 
            products: order.products.filter((_, idx) => idx !== productIndex)
          }
        : order
    ));
  };

  const addProduct = (orderId: string) => {
    setExtractedOrders(prev => prev.map(order => 
      order.id === orderId 
        ? { 
            ...order, 
            products: [...order.products, { nume_produs: '', gramaj: '', cantitate: 1, confidence: 0 }]
          }
        : order
    ));
  };

  const removeOrder = (orderId: string) => {
    setExtractedOrders(prev => prev.filter(order => order.id !== orderId));
  };

  const saveOrders = async () => {
    const ordersToSave = extractedOrders.filter(o => o.status === 'ready');
    
    if (ordersToSave.length === 0) {
      toast({
        title: "Nicio comandă de salvat",
        description: "Nu există comenzi gata pentru salvare.",
        variant: "destructive",
      });
      return;
    }

    // Validate all orders
    for (const order of ordersToSave) {
      if (!order.client.matched_client_id) {
        toast({
          title: "Client neselectat",
          description: `Selectează un client pentru comanda din "${order.file_name}"`,
          variant: "destructive",
        });
        return;
      }

      for (const product of order.products) {
        if (!product.matched_product_id) {
          toast({
            title: "Produs neselectat",
            description: `Selectează un produs valid pentru "${product.nume_produs}"`,
            variant: "destructive",
          });
          return;
        }
      }
    }

    setIsSaving(true);

    try {
       const ocrRecords = [];
       
      for (const order of ordersToSave) {
        const client = clients?.find(c => c.id === order.client.matched_client_id);
        if (!client) continue;

        for (const product of order.products) {
          if (!product.matched_product_id || product.cantitate <= 0) continue;

           // Save to OCR orders table instead of creating production orders
           ocrRecords.push({
             data_comanda: format(selectedDate, 'yyyy-MM-dd'),
             client_id: client.id,
             client_nume: `${client.nume_magazin} - ${client.punct_livrare}`,
             produs_id: product.matched_product_id,
             produs_nume: product.nume_produs,
             cantitate: product.cantitate,
             gramaj: product.gramaj || null,
             fisier_sursa: order.file_name,
             status: 'pending',
          });
        }

        // Mark order as saved
        setExtractedOrders(prev => prev.map(o => 
          o.id === order.id ? { ...o, status: 'saved' as const } : o
        ));
      }
 
       // Insert all OCR records
       if (ocrRecords.length > 0) {
         const { error } = await supabase
           .from('productie_ocr_comenzi')
           .insert(ocrRecords);
         
         if (error) throw error;
       }
 
       // Refresh daily orders
       queryClient.invalidateQueries({ queryKey: ['ocr-daily-orders'] });

      toast({
        title: "Comenzi salvate",
         description: `${ocrRecords.length} produse au fost salvate pentru data ${format(selectedDate, 'dd.MM.yyyy')}.`,
      });
 
       // Clear extracted orders
       setExtractedOrders([]);
       
       // Switch to daily summary tab
       setFilterDate(selectedDate);
       setActiveTab("daily");

    } catch (error) {
      console.error('Error saving orders:', error);
      toast({
        title: "Eroare la salvare",
        description: error instanceof Error ? error.message : "Eroare necunoscută",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) {
      return <Badge className="bg-green-600 hover:bg-green-700">Sigur ({Math.round(confidence * 100)}%)</Badge>;
    } else if (confidence >= 0.5) {
      return <Badge className="bg-yellow-600 hover:bg-yellow-700">Posibil ({Math.round(confidence * 100)}%)</Badge>;
    } else {
      return <Badge variant="destructive">Incert ({Math.round(confidence * 100)}%)</Badge>;
    }
  };

  return (
    <div className="space-y-6">
       <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
           <TabsTrigger value="upload" className="flex items-center gap-2">
             <Upload className="h-4 w-4" />
             Încărcare OCR
           </TabsTrigger>
           <TabsTrigger value="daily" className="flex items-center gap-2">
             <List className="h-4 w-4" />
            Comenzile Zilei
           </TabsTrigger>
            <TabsTrigger value="materials" className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4" />
              Necesar Mat Prime
            </TabsTrigger>
            <TabsTrigger value="clients" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Comenzi pe Client
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Template-uri
            </TabsTrigger>
         </TabsList>
 
         <TabsContent value="upload" className="space-y-6">
           <Card>
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <FileImage className="h-6 w-6" />
                 Import Comenzi prin OCR
               </CardTitle>
               <CardDescription>
                 Selectează data comenzii și încarcă fișierele. AI-ul va extrage automat datele.
               </CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
               {/* Date Selection */}
               <div className="flex items-center gap-4">
                 <Label className="font-medium">Data comenzii:</Label>
                 <Popover>
                   <PopoverTrigger asChild>
                     <Button
                       variant="outline"
                       className={cn(
                         "w-[240px] justify-start text-left font-normal",
                         !selectedDate && "text-muted-foreground"
                       )}
                     >
                       <CalendarIcon className="mr-2 h-4 w-4" />
                       {selectedDate ? format(selectedDate, "PPP", { locale: ro }) : "Selectează data"}
                     </Button>
                   </PopoverTrigger>
                   <PopoverContent className="w-auto p-0" align="start">
                     <Calendar
                       mode="single"
                       selected={selectedDate}
                       onSelect={(date) => date && setSelectedDate(date)}
                       initialFocus
                       className="pointer-events-auto"
                     />
                   </PopoverContent>
                 </Popover>
               </div>
 
               {/* File Upload */}
               <div 
                 className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                 onDrop={handleDrop}
                 onDragOver={handleDragOver}
               >
                 <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                 <div className="space-y-2">
                   <p className="text-lg font-medium">Trage și lasă fișierele aici</p>
                   <p className="text-sm text-muted-foreground">sau</p>
                   <Label htmlFor="file-upload" className="cursor-pointer">
                     <Button variant="outline" asChild disabled={isProcessing}>
                       <span>
                         {isProcessing ? (
                           <>
                             <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                             Se procesează...
                           </>
                         ) : (
                           <>
                             <Upload className="h-4 w-4 mr-2" />
                             Selectează fișiere
                           </>
                         )}
                       </span>
                     </Button>
                   </Label>
                   <Input
                     id="file-upload"
                     type="file"
                     accept="image/*,.pdf,.xlsx,.xls,.csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                     multiple
                     className="hidden"
                     onChange={handleFileUpload}
                     disabled={isProcessing}
                   />
                 </div>
                 <div className="flex justify-center gap-4 mt-4">
                   <div className="flex items-center gap-1 text-xs text-muted-foreground">
                     <FileImage className="h-4 w-4" />
                     <span>JPG, PNG</span>
                   </div>
                   <div className="flex items-center gap-1 text-xs text-muted-foreground">
                     <FileText className="h-4 w-4" />
                     <span>PDF</span>
                   </div>
                   <div className="flex items-center gap-1 text-xs text-muted-foreground">
                     <FileSpreadsheet className="h-4 w-4" />
                     <span>Excel, CSV</span>
                   </div>
                 </div>
               </div>
             </CardContent>
           </Card>

           {extractedOrders.length > 0 && (
             <div className="space-y-4">
               <div className="flex justify-between items-center">
                 <h2 className="text-xl font-semibold">
                   Comenzi extrase ({extractedOrders.filter(o => o.status === 'ready').length} gata de salvare)
                   <Badge variant="outline" className="ml-2">
                     {format(selectedDate, 'dd.MM.yyyy')}
                   </Badge>
                 </h2>
                 <Button 
                   onClick={saveOrders} 
                   disabled={isSaving || extractedOrders.filter(o => o.status === 'ready').length === 0}
                 >
                   {isSaving ? (
                     <>
                       <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                       Se salvează...
                     </>
                   ) : (
                     <>
                       <Save className="h-4 w-4 mr-2" />
                       Salvează pentru {format(selectedDate, 'dd.MM.yyyy')}
                     </>
                   )}
                 </Button>
               </div>

          {extractedOrders.map((order) => (
            <Card key={order.id} className={order.status === 'saved' ? 'opacity-50' : ''}>
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <div className="flex gap-4">
                    <div className="w-32 h-32 flex items-center justify-center rounded-lg border bg-muted">
                      {order.file_type === 'image' && order.file_url ? (
                        <img 
                          src={order.file_url} 
                          alt="Order" 
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <div className="text-center">
                          {getFileIcon(order.file_type)}
                          <p className="text-xs text-muted-foreground mt-2 px-2 truncate max-w-[120px]">
                            {order.file_name}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {order.status === 'processing' && (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Se procesează...</>
                        )}
                        {order.status === 'ready' && (
                          <><Check className="h-4 w-4 text-green-600" /> Gata pentru verificare</>
                        )}
                        {order.status === 'saved' && (
                          <><Check className="h-4 w-4 text-blue-600" /> Salvat</>
                        )}
                        {order.status === 'error' && (
                          <><AlertCircle className="h-4 w-4 text-destructive" /> Eroare</>
                        )}
                      </CardTitle>
                      
                      {order.status === 'error' && (
                        <p className="text-sm text-destructive">{order.error_message}</p>
                      )}

                      {(order.status === 'ready' || order.status === 'saved') && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label className="w-20">Client:</Label>
                            <Select 
                              value={order.client.matched_client_id || ''} 
                              onValueChange={(value) => updateOrderClient(order.id, value)}
                              disabled={order.status === 'saved'}
                            >
                              <SelectTrigger className="w-80">
                                <SelectValue placeholder="Selectează client" />
                              </SelectTrigger>
                              <SelectContent>
                                {clients?.map(client => (
                                  <SelectItem key={client.id} value={client.id}>
                                    {client.nume_magazin} - {client.punct_livrare}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {order.client.confidence > 0 && getConfidenceBadge(order.client.confidence)}
                          </div>
                          {order.raw_text && (
                            <details className="text-xs text-muted-foreground">
                              <summary className="cursor-pointer">Text extras (debug)</summary>
                              <pre className="mt-2 p-2 bg-muted rounded text-xs whitespace-pre-wrap max-h-40 overflow-auto">{order.raw_text}</pre>
                            </details>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => removeOrder(order.id)}
                    disabled={order.status === 'saved'}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              {(order.status === 'ready' || order.status === 'saved') && order.products.length > 0 && (
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produs detectat</TableHead>
                        <TableHead>Produs din sistem</TableHead>
                        <TableHead className="w-32">Cantitate</TableHead>
                        <TableHead>Încredere</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {order.products.map((product, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-muted-foreground">
                            {product.nume_produs} {product.gramaj && `(${product.gramaj})`}
                          </TableCell>
                          <TableCell>
                            <Select 
                              value={product.matched_product_id || ''} 
                              onValueChange={(value) => updateProductMatch(order.id, idx, value)}
                              disabled={order.status === 'saved'}
                            >
                              <SelectTrigger className="w-64">
                                <SelectValue placeholder="Selectează produs" />
                              </SelectTrigger>
                              <SelectContent>
                                {products?.map(p => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.nume}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input 
                              type="number" 
                              min="1" 
                              value={product.cantitate} 
                              onChange={(e) => updateProductQuantity(order.id, idx, parseInt(e.target.value) || 1)}
                              className="w-24"
                              disabled={order.status === 'saved'}
                            />
                          </TableCell>
                          <TableCell>
                            {getConfidenceBadge(product.confidence)}
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => removeProduct(order.id, idx)}
                              disabled={order.status === 'saved'}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {order.status === 'ready' && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-4"
                      onClick={() => addProduct(order.id)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adaugă produs
                    </Button>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
             </div>
           )}
         </TabsContent>
 
         <TabsContent value="daily" className="space-y-6">
           <Card>
             <CardHeader>
               <div className="flex justify-between items-center">
                 <div>
                   <CardTitle className="flex items-center gap-2">
                     <Package className="h-6 w-6" />
                    Comenzile Zilei - Totalizare pe Produse
                   </CardTitle>
                   <CardDescription>
                     Vizualizează toate comenzile agregate pe produse pentru o anumită zi.
                   </CardDescription>
                 </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={printDailyOrders}
                    disabled={aggregatedList.length === 0}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Print
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportDailyOrdersExcel}
                    disabled={aggregatedList.length === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export Excel
                  </Button>
                  <Popover>
                   <PopoverTrigger asChild>
                     <Button
                       variant="outline"
                       className={cn(
                         "w-[240px] justify-start text-left font-normal"
                       )}
                     >
                       <CalendarIcon className="mr-2 h-4 w-4" />
                       {format(filterDate, "PPP", { locale: ro })}
                     </Button>
                   </PopoverTrigger>
                   <PopoverContent className="w-auto p-0" align="end">
                     <Calendar
                       mode="single"
                       selected={filterDate}
                       onSelect={(date) => date && setFilterDate(date)}
                       initialFocus
                       className="pointer-events-auto"
                     />
                   </PopoverContent>
                 </Popover>
                </div>
               </div>
             </CardHeader>
             <CardContent>
               {isLoadingDailyOrders ? (
                 <div className="flex justify-center py-8">
                   <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                 </div>
               ) : aggregatedList.length === 0 ? (
                 <div className="text-center py-8 text-muted-foreground">
                   <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                   <p>Nu există comenzi pentru {format(filterDate, 'dd.MM.yyyy')}</p>
                   <Button 
                     variant="link" 
                     onClick={() => setActiveTab("upload")}
                     className="mt-2"
                   >
                     Încarcă comenzi
                   </Button>
                 </div>
               ) : (
                 <Table>
                   <TableHeader>
                     <TableRow>
                       <TableHead>Produs</TableHead>
                       <TableHead className="text-right">Cantitate Totală</TableHead>
                       <TableHead className="text-right">Nr. Comenzi</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {aggregatedList.map((item) => (
                       <TableRow key={item.produs_id || item.produs_nume}>
                         <TableCell className="font-medium">{item.produs_nume}</TableCell>
                         <TableCell className="text-right">
                           <Badge variant="secondary" className="text-lg px-3 py-1">
                             {item.total_cantitate}
                           </Badge>
                         </TableCell>
                         <TableCell className="text-right text-muted-foreground">
                           {item.comenzi.length}
                         </TableCell>
                       </TableRow>
                     ))}
                   </TableBody>
                 </Table>
               )}
 
               {aggregatedList.length > 0 && (
                 <div className="mt-4 pt-4 border-t flex justify-between items-center">
                   <div className="text-sm text-muted-foreground">
                     Total: <strong>{aggregatedList.length}</strong> produse, 
                     <strong className="ml-1">{dailyOrders?.length || 0}</strong> comenzi individuale
                   </div>
                 </div>
               )}
             </CardContent>
           </Card>
         </TabsContent>
  
          <TabsContent value="materials" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FlaskConical className="h-6 w-6" />
                      Necesar Materii Prime
                    </CardTitle>
                    <CardDescription>
                      Calculează ingredientele necesare pe baza comenzilor OCR și compară cu stocul disponibil.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={printMaterials}
                      disabled={materialNeeds.length === 0}
                    >
                      <Printer className="h-4 w-4 mr-2" />
                      Print
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportMaterialsExcel}
                      disabled={materialNeeds.length === 0}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export Excel
                    </Button>
                    <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[240px] justify-start text-left font-normal"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(materialsFilterDate, "PPP", { locale: ro })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="single"
                        selected={materialsFilterDate}
                        onSelect={(date) => date && setMaterialsFilterDate(date)}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingMaterials ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : materialNeeds.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FlaskConical className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nu există comenzi OCR pentru {format(materialsFilterDate, 'dd.MM.yyyy')} sau nu există rețete configurate.</p>
                    <Button 
                      variant="link" 
                      onClick={() => setActiveTab("upload")}
                      className="mt-2"
                    >
                      Încarcă comenzi
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Summary badges */}
                    <div className="flex gap-4 mb-4">
                      <Badge variant="outline" className="text-sm px-3 py-1">
                        Total ingrediente: {materialNeeds.length}
                      </Badge>
                      <Badge variant="destructive" className="text-sm px-3 py-1">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Insuficient: {materialNeeds.filter(m => m.status === 'insuficient').length}
                      </Badge>
                      <Badge className="text-sm px-3 py-1 bg-amber-500 hover:bg-amber-600">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Atenție: {materialNeeds.filter(m => m.status === 'atentie').length}
                      </Badge>
                    </div>
  
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ingredient</TableHead>
                          <TableHead className="text-right">Stoc Început Zi (kg)</TableHead>
                          <TableHead className="text-right">Necesar (kg)</TableHead>
                          <TableHead className="text-right">Diferență (kg)</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {materialNeeds.map((item) => (
                          <TableRow 
                            key={item.ingredient_id}
                            className={cn(
                              item.status === 'insuficient' && "bg-destructive/10",
                              item.status === 'atentie' && "bg-amber-500/10"
                            )}
                          >
                            <TableCell className="font-medium">{item.ingredient_nume}</TableCell>
                            <TableCell className="text-right">
                              {item.stoc_inceput_zi.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.cantitate_necesara.toFixed(2)}
                            </TableCell>
                            <TableCell className={cn(
                              "text-right font-semibold",
                              item.diferenta < 0 && "text-destructive",
                              item.diferenta >= 0 && item.diferenta < 20 && "text-amber-600",
                              item.diferenta >= 20 && "text-green-600"
                            )}>
                              {item.diferenta >= 0 ? '+' : ''}{item.diferenta.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-center">
                              {item.status === 'ok' && (
                                <Badge className="bg-green-600 hover:bg-green-700">
                                  <Check className="h-3 w-3 mr-1" />
                                  OK
                                </Badge>
                              )}
                              {item.status === 'atentie' && (
                                <Badge className="bg-amber-500 hover:bg-amber-600">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Atenție
                                </Badge>
                              )}
                              {item.status === 'insuficient' && (
                                <Badge variant="destructive">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Insuficient
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
  
                    <div className="mt-4 pt-4 border-t">
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p><strong>Legendă:</strong></p>
                        <p>• <span className="text-green-600 font-medium">OK</span> - Stoc suficient (diferență ≥ 20 kg)</p>
                        <p>• <span className="text-amber-600 font-medium">Atenție</span> - Stoc la limită (diferență 0-20 kg)</p>
                        <p>• <span className="text-destructive font-medium">Insuficient</span> - Stoc insuficient (diferență negativă)</p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="clients" className="space-y-6">
            <OcrOrdersByClient />
          </TabsContent>

          <TabsContent value="templates" className="space-y-6">
            <OcrTemplateManagement />
          </TabsContent>
       </Tabs>

      {/* Template Wizard - collaborative AI + human template creation */}
      {wizardRawData.length > 0 && clients && products && (
        <TemplateWizard
          open={wizardOpen}
          onClose={() => {
            setWizardOpen(false);
            setWizardRawData([]);
          }}
          rawData={wizardRawData}
          fileName={wizardFileName}
          fileData={wizardFileData!}
          preParsedData={wizardPreParsedData}
          clients={clients.map(c => ({ id: c.id, nume_magazin: c.nume_magazin, punct_livrare: c.punct_livrare }))}
          products={products.map(p => ({ id: p.id, nume: p.nume }))}
          onTemplateCreated={handleWizardTemplateCreated}
        />
      )}

      {/* Scan Column Picker - for scans without template */}
      <ScanColumnPicker
        open={scanPickerOpen}
        onOpenChange={setScanPickerOpen}
        headers={scanPickerHeaders}
        sampleRows={scanPickerRows}
        clientDetected={scanPickerClient}
        clients={clients?.map(c => ({ id: c.id, nume_magazin: c.nume_magazin, punct_livrare: c.punct_livrare }))}
        onConfirm={handleScanColumnConfirm}
      />
    </div>
  );
}
