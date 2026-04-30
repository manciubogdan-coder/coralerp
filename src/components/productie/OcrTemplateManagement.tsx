import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useClients, useProducts } from "@/hooks/productie/useProductionData";
import { Settings, Plus, Trash2, Save, ChevronRight, Edit2, Upload, X, Eye, MousePointer, ArrowDown, ArrowUp, FileImage } from "lucide-react";
import InteractiveTablePreview from "./InteractiveTablePreview";
import PdfColumnSplitter from "./PdfColumnSplitter";
import ScanColumnPicker, { type ScanColumnConfig } from "./ScanColumnPicker";
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";

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
  text_identificare?: string | null;
  mappings?: TemplateMapping[];
}

interface TemplateMapping {
  id: string;
  template_id: string;
  nume_in_fisier: string;
  produs_id: string;
  gramaj: string | null;
}

interface PreviewRow {
  produs_raw: string;
  cantitate: number;
  gramaj: string;
  magazin: string;
  mapped_product?: string;
  mapped_product_id?: string;
}

type ColumnRole = 'produs' | 'cantitate' | 'gramaj' | 'magazin' | null;

interface StoreColumnAssignment {
  store_name: string;
  col_index: number;
  cell_key?: string; // "row:col" of the store name cell
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  produs: { label: 'Produs', color: 'bg-blue-500/20 text-blue-700 border-blue-500' },
  cantitate: { label: 'Cantitate', color: 'bg-green-500/20 text-green-700 border-green-500' },
  gramaj: { label: 'Gramaj', color: 'bg-amber-500/20 text-amber-700 border-amber-500' },
  magazin: { label: 'Magazin', color: 'bg-purple-500/20 text-purple-700 border-purple-500' },
};

export default function OcrTemplateManagement() {
  const [editingTemplate, setEditingTemplate] = useState<Partial<Template> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [openTemplates, setOpenTemplates] = useState<Set<string>>(new Set());
  const [newMappingName, setNewMappingName] = useState("");
  const [newMappingProductId, setNewMappingProductId] = useState("");
  const [newMappingGramaj, setNewMappingGramaj] = useState("");
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  // File-based builder state
  const [builderFile, setBuilderFile] = useState<File | null>(null);
  const [builderRawData, setBuilderRawData] = useState<any[][]>([]);
  const [builderSheets, setBuilderSheets] = useState<string[]>([]);
  const [builderSelectedSheet, setBuilderSelectedSheet] = useState<string>('');
  const [builderHeaderRow, setBuilderHeaderRow] = useState<number>(0);
  const [builderColumnRoles, setBuilderColumnRoles] = useState<Map<number, ColumnRole>>(new Map());
  const [builderCellSelections, setBuilderCellSelections] = useState<Map<string, string>>(new Map()); // "row:col" -> role
  const [builderStoreColumns, setBuilderStoreColumns] = useState<StoreColumnAssignment[]>([]);
  const [builderStep, setBuilderStep] = useState<'upload' | 'configure' | 'details'>('upload');
  const [builderFileData, setBuilderFileData] = useState<ArrayBuffer | null>(null);
  const [showPdfPreview, setShowPdfPreview] = useState(true);
  const [builderVSeparators, setBuilderVSeparators] = useState<number[]>([]);
  const [builderHSeparators, setBuilderHSeparators] = useState<number[]>([]);

  // Scan column picker state (for scanned PDFs/images)
  const [showScanPicker, setShowScanPicker] = useState(false);
  const [scanDetectedHeaders, setScanDetectedHeaders] = useState<string[]>([]);
  const [scanDetectedRows, setScanDetectedRows] = useState<string[][]>([]);
  const [scanDetectedClient, setScanDetectedClient] = useState('');
  const [scanFileBase64, setScanFileBase64] = useState<string>('');
  const [isDetectingColumns, setIsDetectingColumns] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: clients } = useClients();
  const { data: products } = useProducts();

  const { data: templates, isLoading } = useQuery({
    queryKey: ['ocr-templates'],
    queryFn: async () => {
      const { data: templatesData, error: tErr } = await supabase
        .from('productie_ocr_templates')
        .select('*')
        .order('nume_magazin');
      if (tErr) throw tErr;

      const { data: mappingsData, error: mErr } = await supabase
        .from('productie_ocr_template_mappings')
        .select('*');
      if (mErr) throw mErr;

      return (templatesData as any[]).map(t => ({
        ...t,
        mappings: (mappingsData as any[]).filter(m => m.template_id === t.id),
      })) as Template[];
    },
  });

  const toggleTemplate = (id: string) => {
    setOpenTemplates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  // ---- Builder: load file ----
  const loadFileForBuilder = useCallback(async (file: File, sheetOverride?: string) => {
    try {
      const isPdf = file.name.toLowerCase().endsWith('.pdf');
      
      if (isPdf) {
        // Parse PDF using improved parser
        const { parsePdfToRawData } = await import("@/lib/productie/parsePdfToTable");
        const arrayBuf = await file.arrayBuffer();
        const copyForPreview = arrayBuf.slice(0);
        const allRows = await parsePdfToRawData(arrayBuf);
        setBuilderFileData(copyForPreview);

        setBuilderSheets(['PDF']);
        setBuilderSelectedSheet('PDF');
        setBuilderRawData(allRows.slice(0, 50));
        setBuilderHeaderRow(0);
        setBuilderColumnRoles(new Map());
      } else {
        // Excel/CSV parsing
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
        setBuilderSheets(workbook.SheetNames);

        const sheetName = sheetOverride || workbook.SheetNames[0];
        setBuilderSelectedSheet(sheetName);

        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
          toast({ title: `Sheet "${sheetName}" nu există`, variant: "destructive" });
          return;
        }

        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        setBuilderRawData(jsonData.slice(0, 50));
        setBuilderHeaderRow(0);
        setBuilderColumnRoles(new Map());
      }
    } catch (error) {
      console.error('Error loading file:', error);
      toast({ title: "Eroare la citirea fișierului", variant: "destructive" });
    }
  }, [toast]);

  const handleBuilderFileUpload = useCallback(async (file: File) => {
    setBuilderFile(file);
    
    const isImage = /\.(jpg|jpeg|png|gif|bmp|webp|tiff?)$/i.test(file.name);
    const isPdf = file.name.toLowerCase().endsWith('.pdf');
    
    if (isImage) {
      // Images are always scans — use AI detect-columns
      await detectColumnsWithAI(file);
      return;
    }
    
    if (isPdf) {
      // Try local parse first; if it yields very little data, treat as scan
      await loadFileForBuilder(file);
      // Check if local parse yielded meaningful data
      // We'll set step to configure, and if data is empty the user can trigger AI
    } else {
      await loadFileForBuilder(file);
    }
    setBuilderStep('configure');
  }, [loadFileForBuilder]);

  const detectColumnsWithAI = useCallback(async (file: File) => {
    setIsDetectingColumns(true);
    try {
      const arrayBuf = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      setScanFileBase64(base64);

      const fileType = file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image';
      
      const { data, error } = await supabase.functions.invoke('ocr-order', {
        body: {
          file_base64: base64,
          file_type: fileType,
          mode: 'detect-columns',
        },
      });

      if (error || (!data?.headers && !data?.sample_rows)) {
        throw new Error(error?.message || data?.error || 'AI detection failed');
      }

      setScanDetectedHeaders(data.headers || []);
      setScanDetectedRows(data.sample_rows || data.sampleRows || []);
      setScanDetectedClient(data.client_detected || data.clientDetected || '');
      setShowScanPicker(true);
    } catch (err) {
      console.error('Error detecting columns:', err);
      toast({
        title: "Eroare la detectarea coloanelor",
        description: err instanceof Error ? err.message : 'Eroare necunoscută',
        variant: "destructive",
      });
    } finally {
      setIsDetectingColumns(false);
    }
  }, [toast]);

  const handleScanColumnConfirm = useCallback((config: ScanColumnConfig) => {
    setShowScanPicker(false);
    
    // Build template from scan column selection
    const isMulti = config.storeColumns && config.storeColumns.length > 1;
    setEditingTemplate(prev => ({
      ...(prev || {}),
      coloana_produs: config.colProdus,
      coloana_cantitate: config.colCantitate,
      col_index_produs: config.colProdusIdx,
      col_index_cantitate: config.colCantitateIdx,
      coloana_magazin: config.colMagazin || null,
      colMagazinIdx: config.colMagazinIdx,
      tip_document: 'scan',
      tip_split: isMulti ? 'multi_column' : (config.colMagazin ? 'column' : 'none'),
      store_columns: isMulti ? config.storeColumns!.map(sc => ({ store_name: sc.store_name, col_index: sc.col_index })) : null,
      randuri_skip: 0,
      activ: true,
      nume_magazin: prev?.nume_magazin || config.clientManual || (isMulti ? (scanDetectedClient || config.storeColumns![0].store_name) : '') || '',
      client_id: prev?.client_id || config.clientId || null,
    }));
    setBuilderStep('details');
  }, []);

  const handleSheetChange = useCallback((sheetName: string) => {
    if (builderFile) {
      loadFileForBuilder(builderFile, sheetName);
    }
  }, [builderFile, loadFileForBuilder]);

  const toggleColumnRole = useCallback((colIdx: number, role: ColumnRole) => {
    setBuilderColumnRoles(prev => {
      const newMap = new Map(prev);
      // If this column already has this role, remove it
      if (newMap.get(colIdx) === role) {
        newMap.delete(colIdx);
        // If removing a cantitate, also remove from storeColumns
        if (role === 'cantitate') {
          setBuilderStoreColumns(sc => sc.filter(s => s.col_index !== colIdx));
        }
        return newMap;
      }
      // For non-cantitate roles, remove this role from any other column
      if (role && role !== 'cantitate') {
        for (const [k, v] of newMap) {
          if (v === role) newMap.delete(k);
        }
      }
      // For cantitate, allow multiple columns
      if (role === 'cantitate') {
        newMap.set(colIdx, role);
        // Auto-detect store name from cells above header row
        let storeName = '';
        for (let r = builderHeaderRow - 1; r >= 0; r--) {
          const cellVal = String(builderRawData[r]?.[colIdx] || '').trim();
          if (cellVal && cellVal.length > 1 && isNaN(Number(cellVal))) {
            storeName = cellVal;
            break;
          }
          // Also check nearby columns (same row)
          const prevColVal = String(builderRawData[r]?.[colIdx - 1] || '').trim();
          if (prevColVal && prevColVal.length > 1 && isNaN(Number(prevColVal))) {
            storeName = prevColVal;
            break;
          }
        }
        setBuilderStoreColumns(sc => {
          const existing = sc.filter(s => s.col_index !== colIdx);
          return [...existing, { store_name: storeName || `Magazin ${existing.length + 1}`, col_index: colIdx }];
        });
      } else {
        newMap.set(colIdx, role);
      }
      return newMap;
    });
  }, [builderHeaderRow, builderRawData]);

  const builderHeaders = useMemo(() => {
    if (builderRawData.length === 0) return [];
    return (builderRawData[builderHeaderRow] || []).map((h: any) => String(h || '').trim());
  }, [builderRawData, builderHeaderRow]);

  const builderCanProceed = useMemo(() => {
    const roles = Array.from(builderColumnRoles.values());
    return roles.includes('produs') && roles.includes('cantitate');
  }, [builderColumnRoles]);

  const multiStoreCount = useMemo(() => {
    return Array.from(builderColumnRoles.values()).filter(r => r === 'cantitate').length;
  }, [builderColumnRoles]);

  const handleCellClick = useCallback((rowIdx: number, colIdx: number) => {
    const key = `${rowIdx}:${colIdx}`;
    setBuilderCellSelections(prev => {
      const newMap = new Map(prev);
      if (newMap.has(key)) {
        newMap.delete(key);
      } else {
        // Only one cell per role type "magazin_fix"
        for (const [k, v] of newMap) {
          if (v === 'magazin_fix') newMap.delete(k);
        }
        newMap.set(key, 'magazin_fix');
      }
      return newMap;
    });
  }, []);

  const proceedToDetails = useCallback(async () => {
    const isPdf = builderFile?.name.toLowerCase().endsWith('.pdf');
    const hasVisualSeps = builderVSeparators.length > 0 || builderHSeparators.length > 0;

    // If PDF has visual separators, re-parse with them to get correct rawData
    if (isPdf && hasVisualSeps && builderFileData) {
      try {
        const { parsePdfToRawData } = await import("@/lib/productie/parsePdfToTable");
        const visualSeps = { v: builderVSeparators, h: builderHSeparators };
        const reParsed = await parsePdfToRawData(builderFileData.slice(0), visualSeps);
        setBuilderRawData(reParsed.slice(0, 50));
        console.log(`[Builder] Re-parsed PDF with visual separators: ${reParsed.length} rows, ${reParsed[0]?.length || 0} cols`);
      } catch (err) {
        console.error('Error re-parsing with visual separators:', err);
      }
    }

    // Build template from column assignments
    // For PDF with visual separators, use __idx:N format since column names are unreliable
    const getHeaderForRole = (role: ColumnRole): string => {
      for (const [colIdx, r] of builderColumnRoles) {
        if (r === role) {
          if (isPdf && hasVisualSeps) return `__idx:${colIdx}`;
          return builderHeaders[colIdx] || `__idx:${colIdx}`;
        }
      }
      return '';
    };

    // Check for cell-level magazin selection
    let fixedMagazin = '';
    for (const [key, role] of builderCellSelections) {
      if (role === 'magazin_fix') {
        const [r, c] = key.split(':').map(Number);
        fixedMagazin = String(builderRawData[r]?.[c] || '');
      }
    }

    const isMultiColumn = multiStoreCount > 1;
    
    // Get first cantitate column header for backward compat
    const firstCantCol = Array.from(builderColumnRoles.entries()).find(([, r]) => r === 'cantitate');
    const cantHeader = firstCantCol 
      ? (isPdf && hasVisualSeps ? `__idx:${firstCantCol[0]}` : (builderHeaders[firstCantCol[0]] || `Col ${firstCantCol[0]}`))
      : '';

    // Build visual_separators if we have any
    const visualSeps = (builderVSeparators.length > 0 || builderHSeparators.length > 0)
      ? { v: builderVSeparators, h: builderHSeparators }
      : null;

    setEditingTemplate(prev => ({
      ...(prev || {}),
      coloana_produs: getHeaderForRole('produs'),
      coloana_cantitate: cantHeader,
      coloana_gramaj: getHeaderForRole('gramaj') || null,
      coloana_magazin: isMultiColumn ? null : (getHeaderForRole('magazin') || null),
      randuri_skip: builderHeaderRow,
      sheet_name: builderSelectedSheet || null,
      tip_split: isMultiColumn ? 'multi_column' : (getHeaderForRole('magazin') ? 'column' : 'none'),
      store_columns: isMultiColumn ? builderStoreColumns.map(sc => ({ store_name: sc.store_name, col_index: sc.col_index })) : null,
      activ: true,
      nume_magazin: prev?.nume_magazin || fixedMagazin || '',
      client_id: prev?.client_id || null,
      visual_separators: visualSeps,
    }));
    setBuilderStep('details');
  }, [builderColumnRoles, builderHeaders, builderHeaderRow, builderSelectedSheet, builderCellSelections, builderRawData, multiStoreCount, builderStoreColumns, builderVSeparators, builderHSeparators, builderFile, builderFileData]);

  const startCreate = () => {
    setEditingTemplate({
      nume_magazin: '',
      client_id: null,
      coloana_produs: '',
      coloana_cantitate: '',
      coloana_gramaj: '',
      coloana_magazin: '',
      randuri_skip: 0,
      tip_split: 'none',
      sheet_name: '',
      activ: true,
      mappings: [],
    });
    setIsCreating(true);
    setBuilderStep('upload');
    setBuilderFile(null);
    setBuilderFileData(null);
    setBuilderRawData([]);
    setBuilderColumnRoles(new Map());
    setBuilderCellSelections(new Map());
    setBuilderStoreColumns([]);
    setBuilderVSeparators([]);
    setBuilderHSeparators([]);
  };

  const startEdit = (template: Template) => {
    setEditingTemplate({ ...template });
    setIsCreating(false);
    setBuilderStep('upload');
    setBuilderFile(null);
    setBuilderFileData(null);
    setBuilderRawData([]);
    setBuilderColumnRoles(new Map());
    setBuilderCellSelections(new Map());
    setBuilderStoreColumns([]);
    setBuilderVSeparators([]);
    setBuilderHSeparators([]);
  };

  const closeDialog = () => {
    setEditingTemplate(null);
    setBuilderFile(null);
    setBuilderFileData(null);
    setBuilderRawData([]);
    setBuilderColumnRoles(new Map());
    setBuilderCellSelections(new Map());
    setBuilderStoreColumns([]);
    setBuilderVSeparators([]);
    setBuilderHSeparators([]);
    setBuilderStep('upload');
  };

  const saveTemplate = async () => {
    if (!editingTemplate?.nume_magazin || !editingTemplate?.coloana_produs || !editingTemplate?.coloana_cantitate) {
      toast({ title: "Completează câmpurile obligatorii", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const templateData: any = {
        nume_magazin: editingTemplate.nume_magazin,
        client_id: editingTemplate.client_id || null,
        coloana_produs: editingTemplate.coloana_produs,
        coloana_cantitate: editingTemplate.coloana_cantitate,
        coloana_gramaj: editingTemplate.coloana_gramaj || null,
        coloana_magazin: editingTemplate.coloana_magazin || null,
        randuri_skip: editingTemplate.randuri_skip || 0,
        tip_split: editingTemplate.tip_split || 'none',
        sheet_name: editingTemplate.sheet_name || null,
        activ: editingTemplate.activ ?? true,
        store_columns: (editingTemplate.store_columns as any) || null,
        text_identificare: editingTemplate.text_identificare || null,
        visual_separators: (editingTemplate as any).visual_separators || null,
        tip_document: (editingTemplate as any).tip_document || null,
        col_index_produs: (editingTemplate as any).col_index_produs ?? null,
        col_index_cantitate: (editingTemplate as any).col_index_cantitate ?? null,
      };

      if (isCreating) {
        const { error } = await supabase
          .from('productie_ocr_templates')
          .insert(templateData);
        if (error) throw error;
        toast({ title: "Template creat cu succes" });
      } else {
        const { error } = await supabase
          .from('productie_ocr_templates')
          .update(templateData)
          .eq('id', editingTemplate.id!);
        if (error) throw error;
        toast({ title: "Template actualizat cu succes" });
      }

      queryClient.invalidateQueries({ queryKey: ['ocr-templates'] });
      closeDialog();
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: "Eroare la salvare",
        description: error instanceof Error ? error.message : 'Eroare necunoscută',
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('productie_ocr_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast({ title: "Template șters cu succes" });
      queryClient.invalidateQueries({ queryKey: ['ocr-templates'] });
    } catch (error) {
      toast({ title: "Eroare la ștergere", variant: "destructive" });
    }
  };

  const addMapping = async (templateId: string) => {
    if (!newMappingName.trim() || !newMappingProductId) {
      toast({ title: "Completează numele și produsul", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase
        .from('productie_ocr_template_mappings')
        .insert({
          template_id: templateId,
          nume_in_fisier: newMappingName.trim(),
          produs_id: newMappingProductId,
          gramaj: newMappingGramaj || null,
        });
      if (error) throw error;

      toast({ title: "Mapare adăugată" });
      queryClient.invalidateQueries({ queryKey: ['ocr-templates'] });
      setNewMappingName("");
      setNewMappingProductId("");
      setNewMappingGramaj("");
    } catch (error) {
      toast({ title: "Eroare", variant: "destructive" });
    }
  };

  const deleteMapping = async (mappingId: string) => {
    try {
      const { error } = await supabase
        .from('productie_ocr_template_mappings')
        .delete()
        .eq('id', mappingId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['ocr-templates'] });
    } catch (error) {
      toast({ title: "Eroare la ștergere", variant: "destructive" });
    }
  };

  // Preview functionality
  const handlePreviewFile = useCallback(async (file: File, template: Template) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });

      const sheetName = template.sheet_name || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        toast({ title: `Sheet "${sheetName}" nu există`, variant: "destructive" });
        return;
      }

      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      const skipRows = template.randuri_skip || 0;
      const headerRow = jsonData[skipRows] || [];
      const headers = headerRow.map((h: any) => String(h || '').trim());

      const prodIdx = findColIndex(headers, template.coloana_produs);
      const cantIdx = findColIndex(headers, template.coloana_cantitate);
      const gramajIdx = template.coloana_gramaj ? findColIndex(headers, template.coloana_gramaj) : -1;
      const magazinIdx = template.coloana_magazin ? findColIndex(headers, template.coloana_magazin) : -1;

      if (prodIdx === -1 || cantIdx === -1) {
        toast({
          title: "Coloane negăsite",
          description: `Produs: "${template.coloana_produs}" (${prodIdx === -1 ? 'negăsit' : 'OK'}), Cantitate: "${template.coloana_cantitate}" (${cantIdx === -1 ? 'negăsit' : 'OK'})`,
          variant: "destructive",
        });
        return;
      }

      const rows: PreviewRow[] = [];
      for (let i = skipRows + 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || !row[prodIdx]) continue;

        const prodRaw = String(row[prodIdx] || '').trim();
        const cantitate = Number(row[cantIdx]) || 0;
        if (!prodRaw || cantitate <= 0) continue;

        const gramaj = gramajIdx !== -1 ? String(row[gramajIdx] || '').trim() : '';
        const magazin = magazinIdx !== -1 ? String(row[magazinIdx] || '').trim() : '';

        const mapping = template.mappings?.find(m =>
          normalizeForMatch(m.nume_in_fisier) === normalizeForMatch(prodRaw)
        );
        const mappedProduct = mapping ? products?.find(p => p.id === mapping.produs_id) : null;

        rows.push({
          produs_raw: prodRaw,
          cantitate,
          gramaj: mapping?.gramaj || gramaj,
          magazin,
          mapped_product: mappedProduct?.nume,
          mapped_product_id: mapping?.produs_id,
        });
      }

      setPreviewData(rows);
      setShowPreview(true);
    } catch (error) {
      console.error('Preview error:', error);
      toast({ title: "Eroare la citirea fișierului", variant: "destructive" });
    }
  }, [products, toast]);

  const findColIndex = (headers: string[], colName: string): number => {
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_\s]+/g, " ").trim();
    const target = norm(colName);
    let idx = headers.findIndex(h => norm(h) === target);
    if (idx !== -1) return idx;
    idx = headers.findIndex(h => norm(h).includes(target) || target.includes(norm(h)));
    return idx;
  };

  const normalizeForMatch = (s: string) =>
    (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

  const getClientName = (clientId: string | null) => {
    if (!clientId) return 'Orice client';
    const client = clients?.find(c => c.id === clientId);
    return client ? `${client.nume_magazin} - ${client.punct_livrare}` : 'Client necunoscut';
  };

  // Max columns in raw data
  const maxCols = useMemo(() => {
    return builderRawData.reduce((max, row) => Math.max(max, row?.length || 0), 0);
  }, [builderRawData]);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-6 w-6" />
              Template-uri Comenzi
            </CardTitle>
            <CardDescription>
              Configurează cum se citesc fișierele de la fiecare client. Parsare 100% locală, fără costuri AI.
            </CardDescription>
          </div>
          <Button onClick={startCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Template Nou
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Se încarcă...</div>
        ) : !templates || templates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nu există template-uri configurate.</p>
            <p className="text-sm mt-2">Creează un template pentru a parsa excel-urile fără AI.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((template) => (
              <Collapsible
                key={template.id}
                open={openTemplates.has(template.id)}
                onOpenChange={() => toggleTemplate(template.id)}
              >
                <CollapsibleTrigger asChild>
                  <div className="border rounded-lg px-4 py-3 flex justify-between items-center cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <ChevronRight className={cn(
                        "h-5 w-5 transition-transform",
                        openTemplates.has(template.id) && "rotate-90"
                      )} />
                      <div>
                        <h3 className="font-semibold">{template.nume_magazin}</h3>
                        <p className="text-sm text-muted-foreground">
                          {getClientName(template.client_id)} •
                          Produs: {template.coloana_produs} •
                          Cantitate: {template.coloana_cantitate}
                          {template.coloana_magazin && ` • Magazin: ${template.coloana_magazin}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={template.activ ? "default" : "secondary"}>
                        {template.activ ? 'Activ' : 'Inactiv'}
                      </Badge>
                      <Badge variant="outline">
                        {template.mappings?.length || 0} mapări
                      </Badge>
                      {(template as any).text_identificare && (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500">
                          🔑 {(template as any).text_identificare}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="border border-t-0 rounded-b-lg px-4 py-4 space-y-4">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => startEdit(template)}>
                      <Edit2 className="h-4 w-4 mr-1" />
                      Editează
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <label className="cursor-pointer">
                        <Eye className="h-4 w-4 mr-1" />
                        Testează cu Fișier
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv,.pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setPreviewFile(file);
                              handlePreviewFile(file, template);
                            }
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTemplate(template.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Șterge
                    </Button>
                  </div>

                  {/* Mappings */}
                  <div>
                    <h4 className="font-medium mb-2">Mapări Produse</h4>
                    {template.mappings && template.mappings.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nume în Fișier</TableHead>
                            <TableHead>Produs Sistem</TableHead>
                            <TableHead>Gramaj</TableHead>
                            <TableHead className="w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {template.mappings.map((mapping) => (
                            <TableRow key={mapping.id}>
                              <TableCell className="font-mono text-sm">{mapping.nume_in_fisier}</TableCell>
                              <TableCell>
                                {products?.find(p => p.id === mapping.produs_id)?.nume || 'Produs necunoscut'}
                              </TableCell>
                              <TableCell>{mapping.gramaj || '-'}</TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => deleteMapping(mapping.id)}
                                >
                                  <X className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-sm text-muted-foreground mb-2">
                        Nu sunt mapări. Adaugă mapări pentru a traduce numele produselor din fișier în produse din sistem.
                      </p>
                    )}

                    <div className="flex gap-2 mt-3 items-end">
                      <div className="flex-1">
                        <Label className="text-xs">Nume în fișier</Label>
                        <Input
                          placeholder="ex: MC BUSUIOC 30G"
                          value={newMappingName}
                          onChange={(e) => setNewMappingName(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs">Produs sistem</Label>
                        <Select value={newMappingProductId} onValueChange={setNewMappingProductId}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Selectează produs" />
                          </SelectTrigger>
                          <SelectContent>
                            {products?.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.nume}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-24">
                        <Label className="text-xs">Gramaj</Label>
                        <Input
                          placeholder="30 g"
                          value={newMappingGramaj}
                          onChange={(e) => setNewMappingGramaj(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <Button size="sm" className="h-9" onClick={() => addMapping(template.id)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}

        {/* ====== CREATE / EDIT DIALOG ====== */}
        <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && closeDialog()}>
          <DialogContent className={cn(
            "max-h-[90vh] overflow-y-auto",
            builderStep === 'configure' ? "max-w-5xl" : "max-w-lg"
          )}>
            <DialogHeader>
              <DialogTitle>
                {isCreating ? 'Template Nou' : 'Editează Template'}
                {builderStep === 'configure' && ' — Selectează Coloanele'}
              </DialogTitle>
              <DialogDescription>
                {builderStep === 'upload' && 'Încarcă un fișier model de comandă pentru a configura template-ul vizual.'}
                {builderStep === 'configure' && 'Click pe header-ul fiecărei coloane pentru a-i atribui un rol. Poți schimba și rândul header.'}
                {builderStep === 'details' && 'Completează detaliile template-ului.'}
              </DialogDescription>
            </DialogHeader>

            {/* STEP 1: Upload */}
            {builderStep === 'upload' && (
              <div className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-muted/50 transition-colors">
                  <label className="cursor-pointer block">
                    {isDetectingColumns ? (
                      <>
                        <FileImage className="h-10 w-10 mx-auto mb-3 text-muted-foreground animate-pulse" />
                        <p className="font-medium">AI analizează documentul...</p>
                        <p className="text-sm text-muted-foreground mt-1">Se detectează structura tabelului</p>
                      </>
                    ) : (
                      <>
                        <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                        <p className="font-medium">Încarcă un fișier model de comandă</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Excel, PDF sau imagini scanate (.jpg, .png) — vei configura coloanele vizual
                        </p>
                      </>
                    )}
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv,.pdf,.jpg,.jpeg,.png,.webp,.tiff,.bmp"
                      className="hidden"
                      disabled={isDetectingColumns}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleBuilderFileUpload(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>

                {!isCreating && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setBuilderStep('details')}
                  >
                    Sari peste — editează manual
                  </Button>
                )}
              </div>
            )}

            {/* STEP 2: Configure columns visually */}
            {builderStep === 'configure' && builderRawData.length > 0 && (
              <div className="space-y-4">
                {/* Sheet selector + header row */}
                <div className="flex gap-3 items-end flex-wrap">
                  {builderSheets.length > 1 && (
                    <div>
                      <Label className="text-xs">Sheet</Label>
                      <Select value={builderSelectedSheet} onValueChange={handleSheetChange}>
                        <SelectTrigger className="h-9 w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {builderSheets.map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs">Rândul header (0 = primul rând)</Label>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9"
                        disabled={builderHeaderRow <= 0}
                        onClick={() => setBuilderHeaderRow(prev => Math.max(0, prev - 1))}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Input
                        type="number"
                        min={0}
                        max={builderRawData.length - 1}
                        value={builderHeaderRow}
                        onChange={(e) => setBuilderHeaderRow(Math.max(0, parseInt(e.target.value) || 0))}
                        className="h-9 w-16 text-center"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9"
                        disabled={builderHeaderRow >= builderRawData.length - 1}
                        onClick={() => setBuilderHeaderRow(prev => Math.min(builderRawData.length - 1, prev + 1))}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-1 items-center flex-wrap ml-auto">
                    {Object.entries(ROLE_LABELS).map(([role, { label, color }]) => {
                      const assigned = Array.from(builderColumnRoles.entries()).find(([, r]) => r === role);
                      return (
                        <Badge
                          key={role}
                          variant="outline"
                          className={cn("text-xs", assigned ? color : "opacity-50")}
                        >
                          {label}: {assigned ? builderHeaders[assigned[0]] || `Col ${assigned[0] + 1}` : '—'}
                        </Badge>
                      );
                    })}
                  </div>
                </div>

                {/* Instructions */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                  <MousePointer className="h-4 w-4 shrink-0" />
                  <span>
                    <strong>Coloane:</strong> Alege rolul din dropdown-ul header-ului. Poți selecta mai multe coloane ca "Cantitate" pentru magazine diferite.{' '}
                    <strong>Celulă:</strong> Click pe orice celulă pentru a o marca ca Nume Magazin (fix).
                  </span>
                </div>

                {/* Multi-store column assignments */}
                {multiStoreCount > 1 && builderStoreColumns.length > 0 && (
                  <div className="bg-primary/10 rounded-md px-3 py-3 space-y-2">
                    <p className="text-sm font-medium">🏪 Magazine detectate ({builderStoreColumns.length} magazine → {builderStoreColumns.length} comenzi separate):</p>
                    {builderStoreColumns.map((sc, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-green-500/20 text-green-700 border-green-500 text-xs">
                          Col {sc.col_index + 1}
                        </Badge>
                        <span className="text-sm">→</span>
                        <Input
                          className="h-7 w-48 text-sm"
                          value={sc.store_name}
                          onChange={(e) => {
                            setBuilderStoreColumns(prev => prev.map((s, i) => 
                              i === idx ? { ...s, store_name: e.target.value } : s
                            ));
                          }}
                          placeholder="Nume magazin"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setBuilderStoreColumns(prev => prev.filter((_, i) => i !== idx));
                            setBuilderColumnRoles(prev => {
                              const newMap = new Map(prev);
                              newMap.delete(sc.col_index);
                              return newMap;
                            });
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Cell selections summary (only when not multi-column) */}
                {multiStoreCount <= 1 && builderCellSelections.size > 0 && (
                  <div className="flex items-center gap-2 bg-primary/10 rounded-md px-3 py-2 text-sm">
                    <span className="font-medium">Celule marcate:</span>
                    {Array.from(builderCellSelections.entries()).map(([key, role]) => {
                      const [r, c] = key.split(':').map(Number);
                      const value = String(builderRawData[r]?.[c] || '');
                      return (
                        <Badge key={key} className="gap-1">
                          🏪 Magazin: "{value}" (rând {r}, col {c})
                          <button onClick={() => handleCellClick(r, c)} className="ml-1 hover:text-destructive">×</button>
                        </Badge>
                      );
                    })}
                  </div>
                )}

                {/* PDF: Column Splitter visual | Excel: Interactive Table */}
                {builderFile?.name.toLowerCase().endsWith('.pdf') ? (
                  <PdfColumnSplitter
                    fileData={builderFileData!}
                    columnRoles={builderColumnRoles}
                    onColumnRoleChange={(colIdx, role) => toggleColumnRole(colIdx, role)}
                    initialSeparators={builderVSeparators}
                    initialHorizontalSeparators={builderHSeparators}
                    onSeparatorsChange={(seps) => setBuilderVSeparators(seps)}
                    onHorizontalSeparatorsChange={(seps) => setBuilderHSeparators(seps)}
                  />
                ) : (
                  <InteractiveTablePreview
                    rawData={builderRawData}
                    headerRow={builderHeaderRow}
                    columnRoles={builderColumnRoles}
                    onColumnRoleChange={(colIdx, role) => toggleColumnRole(colIdx, role)}
                    onCellClick={handleCellClick}
                    cellSelections={builderCellSelections}
                    maxRows={50}
                  />
                )}

                <div className="flex justify-between">
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setBuilderStep('upload')}>
                      ← Înapoi
                    </Button>
                    {builderFile && (
                      <Button
                        variant="secondary"
                        onClick={() => detectColumnsWithAI(builderFile)}
                        disabled={isDetectingColumns}
                      >
                        <FileImage className="h-4 w-4 mr-1" />
                        {isDetectingColumns ? 'Se detectează...' : 'Detectează cu AI (pt. scanări)'}
                      </Button>
                    )}
                  </div>
                  <Button
                    onClick={proceedToDetails}
                    disabled={!builderCanProceed}
                  >
                    Continuă →
                    {!builderCanProceed && (
                      <span className="ml-2 text-xs opacity-70">
                        (selectează minim Produs + Cantitate)
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 3: Template details */}
            {builderStep === 'details' && editingTemplate && (
              <div className="space-y-4">
                {/* Show detected config summary */}
                {builderFile && (
                  <div className="bg-muted/50 rounded-md px-3 py-2 text-sm space-y-1">
                    <p className="font-medium">Configurare detectată din fișier:</p>
                    <p>Produs: <span className="font-mono">{editingTemplate.coloana_produs}</span></p>
                    <p>Cantitate: <span className="font-mono">{editingTemplate.coloana_cantitate}</span></p>
                    {editingTemplate.coloana_gramaj && <p>Gramaj: <span className="font-mono">{editingTemplate.coloana_gramaj}</span></p>}
                    {editingTemplate.tip_split === 'multi_column' && editingTemplate.store_columns && (
                      <div>
                        <p className="font-medium mt-1">🏪 Magazine (multi-coloană):</p>
                        {(editingTemplate.store_columns as StoreColumnConfig[]).map((sc, i) => (
                          <p key={i} className="ml-2">• {sc.store_name} (coloana {sc.col_index + 1})</p>
                        ))}
                      </div>
                    )}
                    {editingTemplate.coloana_magazin && <p>Magazin: <span className="font-mono">{editingTemplate.coloana_magazin}</span></p>}
                    {editingTemplate.randuri_skip ? <p>Rânduri skip: {editingTemplate.randuri_skip}</p> : null}
                    {editingTemplate.sheet_name && <p>Sheet: {editingTemplate.sheet_name}</p>}
                  </div>
                )}

                <div>
                  <Label>Nume Template *</Label>
                  <Input
                    placeholder="ex: Kaufland Format Standard"
                    value={editingTemplate.nume_magazin || ''}
                    onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, nume_magazin: e.target.value } : null)}
                  />
                </div>
                <div>
                  <Label>🔑 Text Identificare (amprentă unică a documentului)</Label>
                  <Input
                    placeholder="ex: un text unic care apare DOAR în acest tip de document"
                    value={(editingTemplate as any).text_identificare || ''}
                    onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, text_identificare: e.target.value } : null)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Dacă este completat, template-ul va fi folosit DOAR dacă acest text apare în document. Util pentru a diferenția template-uri similare (ex: "Lidl" vs "Lidl Fundeni").
                  </p>
                </div>
                <div>
                  <Label>Client asociat</Label>
                  <Select
                    value={editingTemplate.client_id || 'none'}
                    onValueChange={(v) => setEditingTemplate(prev => prev ? { ...prev, client_id: v === 'none' ? null : v } : null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selectează client (opțional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Fără client specific</SelectItem>
                      {clients?.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nume_magazin} - {c.punct_livrare}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Coloana Produs *</Label>
                    <Input
                      placeholder="ex: DENUMIRE PRODUS"
                      value={editingTemplate.coloana_produs || ''}
                      onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, coloana_produs: e.target.value } : null)}
                    />
                  </div>
                  <div>
                    <Label>Coloana Cantitate *</Label>
                    <Input
                      placeholder="ex: BUCATI"
                      value={editingTemplate.coloana_cantitate || ''}
                      onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, coloana_cantitate: e.target.value } : null)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Coloana Gramaj</Label>
                    <Input
                      placeholder="opțional"
                      value={editingTemplate.coloana_gramaj || ''}
                      onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, coloana_gramaj: e.target.value } : null)}
                    />
                  </div>
                  <div>
                    <Label>Coloana Magazin</Label>
                    <Input
                      placeholder="opțional"
                      value={editingTemplate.coloana_magazin || ''}
                      onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, coloana_magazin: e.target.value } : null)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Rânduri de Ignorat</Label>
                    <Input
                      type="number"
                      min={0}
                      value={editingTemplate.randuri_skip || 0}
                      onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, randuri_skip: parseInt(e.target.value) || 0 } : null)}
                    />
                  </div>
                  <div>
                    <Label>Sheet</Label>
                    <Input
                      placeholder="Primul sheet (implicit)"
                      value={editingTemplate.sheet_name || ''}
                      onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, sheet_name: e.target.value } : null)}
                    />
                  </div>
                </div>
                <div>
                  <Label>Separare Magazine</Label>
                  <Select
                    value={editingTemplate.tip_split || 'none'}
                    onValueChange={(v) => setEditingTemplate(prev => prev ? { ...prev, tip_split: v } : null)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Fără separare</SelectItem>
                      <SelectItem value="column">Coloană magazin</SelectItem>
                      <SelectItem value="section">Secțiuni separate</SelectItem>
                      <SelectItem value="multi_column">Coloane multiple (un magazin per coloană)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {(builderStep === 'details') && (
              <DialogFooter>
                {builderFile && (
                  <Button variant="outline" onClick={() => setBuilderStep('configure')} className="mr-auto">
                    ← Înapoi la coloane
                  </Button>
                )}
                <Button variant="outline" onClick={closeDialog}>Anulează</Button>
                <Button onClick={saveTemplate} disabled={isSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Se salvează...' : 'Salvează'}
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Preview Parsare - {previewFile?.name}</DialogTitle>
              <DialogDescription>
                {previewData.length} produse detectate
                {previewData.filter(r => !r.mapped_product_id).length > 0 && (
                  <span className="text-destructive ml-2">
                    ({previewData.filter(r => !r.mapped_product_id).length} fără mapare)
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nume în Fișier</TableHead>
                  <TableHead>Cantitate</TableHead>
                  <TableHead>Gramaj</TableHead>
                  {previewData.some(r => r.magazin) && <TableHead>Magazin</TableHead>}
                  <TableHead>Produs Mapat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewData.map((row, i) => (
                  <TableRow key={i} className={!row.mapped_product_id ? 'bg-destructive/10' : ''}>
                    <TableCell className="font-mono text-sm">{row.produs_raw}</TableCell>
                    <TableCell>{row.cantitate}</TableCell>
                    <TableCell>{row.gramaj || '-'}</TableCell>
                    {previewData.some(r => r.magazin) && <TableCell>{row.magazin || '-'}</TableCell>}
                    <TableCell>
                      {row.mapped_product ? (
                        <Badge variant="outline" className="text-primary">
                          {row.mapped_product}
                        </Badge>
                      ) : (
                        <Badge variant="destructive">Fără mapare</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DialogContent>
        </Dialog>
        {/* Scan Column Picker (AI-detected columns for scans) */}
        <ScanColumnPicker
          open={showScanPicker}
          onOpenChange={setShowScanPicker}
          headers={scanDetectedHeaders}
          sampleRows={scanDetectedRows}
          clientDetected={scanDetectedClient}
          clients={clients?.map(c => ({ id: c.id, nume_magazin: c.nume_magazin, punct_livrare: c.punct_livrare })) || []}
          onConfirm={handleScanColumnConfirm}
        />
      </CardContent>
    </Card>
  );
}
