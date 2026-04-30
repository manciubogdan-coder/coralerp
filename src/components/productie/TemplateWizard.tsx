import { useState, useCallback, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Loader2, Save, Sparkles, ArrowUp, ArrowDown, MousePointer, X, AlertTriangle, CheckCircle2 } from "lucide-react";
import InteractiveTablePreview from "./InteractiveTablePreview";
import PdfColumnSplitter from "./PdfColumnSplitter";

type ColumnRole = 'produs' | 'cantitate' | 'gramaj' | 'magazin' | null;

interface StoreColumnAssignment {
  store_name: string;
  col_index: number;
}

interface AITemplateConfig {
  client_name?: string;
  coloana_produs?: string;
  col_index_produs?: number;
  coloana_cantitate?: string;
  col_index_cantitate?: number;
  coloana_gramaj?: string | null;
  col_index_gramaj?: number;
  coloana_magazin?: string | null;
  randuri_skip?: number;
  tip_split?: string;
  store_columns?: { store_name: string; col_index: number }[];
}

interface Client {
  id: string;
  nume_magazin: string;
  punct_livrare: string;
}

interface Product {
  id: string;
  nume: string;
}

interface TemplateWizardProps {
  open: boolean;
  onClose: () => void;
  rawData: any[][];
  fileName: string;
  fileData: ArrayBuffer;
  preParsedData?: any[][];
  clients: Client[];
  products: Product[];
  onTemplateCreated: (templateId: string) => void;
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  produs: { label: 'Produs', color: 'bg-blue-500/20 text-blue-700 border-blue-500' },
  cantitate: { label: 'Cantitate', color: 'bg-green-500/20 text-green-700 border-green-500' },
  gramaj: { label: 'Gramaj', color: 'bg-amber-500/20 text-amber-700 border-amber-500' },
  magazin: { label: 'Magazin', color: 'bg-purple-500/20 text-purple-700 border-purple-500' },
};

export default function TemplateWizard({
  open,
  onClose,
  rawData,
  fileName,
  fileData,
  preParsedData,
  clients,
  products,
  onTemplateCreated,
}: TemplateWizardProps) {
  const [headerRow, setHeaderRow] = useState(0);
  const [columnRoles, setColumnRoles] = useState<Map<number, ColumnRole>>(new Map());
  const [storeColumns, setStoreColumns] = useState<StoreColumnAssignment[]>([]);
  const [cellSelections, setCellSelections] = useState<Map<string, string>>(new Map());
  const [templateName, setTemplateName] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);
  const [tipSplit, setTipSplit] = useState('none');
  const [step, setStep] = useState<'ai_loading' | 'configure' | 'details'>('ai_loading');
  const [aiSuggestion, setAiSuggestion] = useState<AITemplateConfig | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const maxCols = useMemo(() => rawData.reduce((max, row) => Math.max(max, row?.length || 0), 0), [rawData]);

  const headers = useMemo(() => {
    if (rawData.length === 0) return [];
    return (rawData[headerRow] || []).map((h: any) => String(h || '').trim());
  }, [rawData, headerRow]);

  const multiStoreCount = useMemo(() => {
    return Array.from(columnRoles.values()).filter(r => r === 'cantitate').length;
  }, [columnRoles]);

  const canProceed = useMemo(() => {
    const roles = Array.from(columnRoles.values());
    return roles.includes('produs') && roles.includes('cantitate');
  }, [columnRoles]);

  // Call AI for suggestions when dialog opens
  useEffect(() => {
    if (!open || rawData.length === 0) return;

    // Reset state
    setStep('ai_loading');
    setAiSuggestion(null);
    setAiError(null);
    setColumnRoles(new Map());
    setStoreColumns([]);
    setCellSelections(new Map());
    setTemplateName('');
    setClientId(null);
    setTipSplit('none');
    setHeaderRow(0);

    const callAI = async () => {
      try {
        const textSample = rawData.slice(0, 30).map((r, i) => `Rând ${i}: ${(r || []).map(c => c?.toString() || '').join(' | ')}`).join('\n');
        
        const { data, error } = await supabase.functions.invoke('generate-template', {
          body: {
            file_text: textSample,
            file_type: fileName.toLowerCase().endsWith('.pdf') ? 'pdf' : 'excel',
            clients: clients.map(c => ({ id: c.id, nume_magazin: c.nume_magazin, punct_livrare: c.punct_livrare })),
          },
        });

        if (error) throw new Error(error.message);

        if (data && data.coloana_produs) {
          setAiSuggestion(data);
          applyAISuggestion(data);
          setStep('configure');
        } else {
          setAiError('AI nu a putut detecta structura. Configurează manual.');
          setStep('configure');
        }
      } catch (err) {
        console.error('AI template generation error:', err);
        setAiError('Eroare AI. Configurează manual coloanele.');
        setStep('configure');
      }
    };

    callAI();
  }, [open]);

  // Apply AI suggestion to column roles
  const applyAISuggestion = useCallback((config: AITemplateConfig) => {
    const newRoles = new Map<number, ColumnRole>();
    const newStoreColumns: StoreColumnAssignment[] = [];
    
    // Find header row
    const suggestedSkip = config.randuri_skip || 0;
    setHeaderRow(suggestedSkip);

    const hRow = rawData[suggestedSkip] || [];
    const hHeaders = hRow.map((h: any) => String(h || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_\s]+/g, " ").trim());

    // Helper: find column by name, fallback to direct index
    const findCol = (name: string | undefined | null, directIdx: number | undefined): number => {
      if (name) {
        const target = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_\s]+/g, " ").trim();
        let idx = hHeaders.findIndex(h => h === target);
        if (idx === -1) idx = hHeaders.findIndex(h => h.includes(target) || target.includes(h));
        if (idx !== -1) return idx;
      }
      // Fallback: use direct column index from AI
      if (directIdx !== undefined && directIdx >= 0 && directIdx < hRow.length) {
        return directIdx;
      }
      return -1;
    };

    // Find product column
    const prodIdx = findCol(config.coloana_produs, config.col_index_produs);
    if (prodIdx !== -1) newRoles.set(prodIdx, 'produs');

    // Find gramaj column
    const gramajIdx = findCol(config.coloana_gramaj, config.col_index_gramaj);
    if (gramajIdx !== -1) newRoles.set(gramajIdx, 'gramaj');

    // Handle multi_column store columns
    if (config.tip_split === 'multi_column' && config.store_columns && config.store_columns.length > 0) {
      setTipSplit('multi_column');
      for (const sc of config.store_columns) {
        if (sc.col_index < hHeaders.length) {
          newRoles.set(sc.col_index, 'cantitate');
          newStoreColumns.push({ store_name: sc.store_name, col_index: sc.col_index });
        }
      }
    } else {
      // Find single quantity column
      const cantIdx = findCol(config.coloana_cantitate, config.col_index_cantitate);
      if (cantIdx !== -1) newRoles.set(cantIdx, 'cantitate');

      // Find magazin column
      const magIdx = findCol(config.coloana_magazin, undefined);
      if (magIdx !== -1) newRoles.set(magIdx, 'magazin');

      setTipSplit(config.tip_split || 'none');
    }

    setColumnRoles(newRoles);
    setStoreColumns(newStoreColumns);

    // Set template name from AI suggestion
    if (config.client_name) {
      setTemplateName(config.client_name);
      // Try to match client
      const norm = (s: string) => (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, ' ').trim();
      const detectedName = norm(config.client_name);
      const matched = clients.find(c => {
        const cn = norm(c.nume_magazin);
        const cp = norm(c.punct_livrare);
        return cn.includes(detectedName) || detectedName.includes(cn) || cp.includes(detectedName) || detectedName.includes(cp);
      });
      if (matched) setClientId(matched.id);
    }
  }, [rawData, clients]);

  const toggleColumnRole = useCallback((colIdx: number, role: ColumnRole) => {
    setColumnRoles(prev => {
      const newMap = new Map(prev);
      if (newMap.get(colIdx) === role) {
        newMap.delete(colIdx);
        if (role === 'cantitate') {
          setStoreColumns(sc => sc.filter(s => s.col_index !== colIdx));
        }
        return newMap;
      }
      if (role && role !== 'cantitate') {
        for (const [k, v] of newMap) {
          if (v === role) newMap.delete(k);
        }
      }
      if (role === 'cantitate') {
        newMap.set(colIdx, role);
        let storeName = '';
        for (let r = headerRow - 1; r >= 0; r--) {
          const cellVal = String(rawData[r]?.[colIdx] || '').trim();
          if (cellVal && cellVal.length > 1 && isNaN(Number(cellVal))) {
            storeName = cellVal;
            break;
          }
        }
        setStoreColumns(sc => {
          const existing = sc.filter(s => s.col_index !== colIdx);
          return [...existing, { store_name: storeName || `Magazin ${existing.length + 1}`, col_index: colIdx }];
        });
      } else {
        newMap.set(colIdx, role);
      }
      return newMap;
    });
  }, [headerRow, rawData]);

  const handleCellClick = useCallback((rowIdx: number, colIdx: number) => {
    const key = `${rowIdx}:${colIdx}`;
    setCellSelections(prev => {
      const newMap = new Map(prev);
      if (newMap.has(key)) {
        newMap.delete(key);
      } else {
        for (const [k, v] of newMap) {
          if (v === 'magazin_fix') newMap.delete(k);
        }
        newMap.set(key, 'magazin_fix');
      }
      return newMap;
    });
  }, []);

  const proceedToDetails = useCallback(() => {
    const getHeaderForRole = (role: ColumnRole): string => {
      for (const [colIdx, r] of columnRoles) {
        if (r === role) return headers[colIdx] || `Col ${colIdx}`;
      }
      return '';
    };

    let fixedMagazin = '';
    for (const [key, role] of cellSelections) {
      if (role === 'magazin_fix') {
        const [r, c] = key.split(':').map(Number);
        fixedMagazin = String(rawData[r]?.[c] || '');
      }
    }

    const isMultiColumn = multiStoreCount > 1;
    if (isMultiColumn) setTipSplit('multi_column');

    if (!templateName && fixedMagazin) setTemplateName(fixedMagazin);
    if (!templateName && !fixedMagazin) setTemplateName(fileName.replace(/\.[^.]+$/, ''));

    setStep('details');
  }, [columnRoles, headers, cellSelections, rawData, multiStoreCount, templateName, fileName]);

  const saveTemplate = async () => {
    if (!templateName) {
      toast({ title: "Completează numele template-ului", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      // Get header name for a role, falling back to AI suggestion, then to __idx:N format
      const getHeaderForRole = (role: ColumnRole): string => {
        for (const [colIdx, r] of columnRoles) {
          if (r === role) {
            const headerVal = headers[colIdx];
            if (headerVal && headerVal.trim().length > 0) return headerVal;
            // Fallback: use AI suggestion name if available
            if (role === 'produs' && aiSuggestion?.coloana_produs) return aiSuggestion.coloana_produs;
            if (role === 'cantitate' && aiSuggestion?.coloana_cantitate) return aiSuggestion.coloana_cantitate;
            if (role === 'gramaj' && aiSuggestion?.coloana_gramaj) return aiSuggestion.coloana_gramaj;
            if (role === 'magazin' && aiSuggestion?.coloana_magazin) return aiSuggestion.coloana_magazin;
            // Last fallback: store index directly
            return `__idx:${colIdx}`;
          }
        }
        return '';
      };

      const isMultiColumn = multiStoreCount > 1;
      const firstCantCol = Array.from(columnRoles.entries()).find(([, r]) => r === 'cantitate');
      let cantHeader = '';
      if (firstCantCol) {
        const headerVal = headers[firstCantCol[0]];
        if (headerVal && headerVal.trim().length > 0) {
          cantHeader = headerVal;
        } else if (aiSuggestion?.coloana_cantitate) {
          cantHeader = aiSuggestion.coloana_cantitate;
        } else {
          cantHeader = `__idx:${firstCantCol[0]}`;
        }
      }

      const templateData = {
        nume_magazin: templateName,
        client_id: clientId || null,
        coloana_produs: getHeaderForRole('produs'),
        coloana_cantitate: cantHeader,
        coloana_gramaj: getHeaderForRole('gramaj') || null,
        coloana_magazin: isMultiColumn ? null : (getHeaderForRole('magazin') || null),
        randuri_skip: headerRow,
        tip_split: isMultiColumn ? 'multi_column' : tipSplit,
        store_columns: isMultiColumn ? storeColumns.map(sc => ({ store_name: sc.store_name, col_index: sc.col_index })) : null,
        activ: true,
      };

      // Use upsert to handle duplicate template names (update existing)
      const { data: savedTemplate, error } = await supabase
        .from('productie_ocr_templates')
        .upsert(templateData, { onConflict: 'nume_magazin' })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "✅ Template salvat cu succes!",
        description: `"${templateName}" — viitoarele comenzi similare se vor parsa automat.`,
      });

      onTemplateCreated(savedTemplate.id);
      onClose();
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

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(
        "max-h-[92vh] overflow-y-auto",
        step === 'configure' ? "max-w-[95vw]" : "max-w-lg"
      )}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {step === 'ai_loading' && 'AI analizează fișierul...'}
            {step === 'configure' && 'Configurează Template — Verifică sugestiile AI'}
            {step === 'details' && 'Salvează Template'}
          </DialogTitle>
          <DialogDescription>
            {step === 'ai_loading' && `Se analizează "${fileName}" pentru a detecta structura...`}
            {step === 'configure' && (
              <>
                {aiSuggestion ? (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4 text-green-600 inline" />
                    AI a pre-selectat coloanele. <strong>Verifică și ajustează</strong> dacă e nevoie, apoi continuă.
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4 text-amber-600 inline" />
                    {aiError || 'Selectează manual coloanele de Produs și Cantitate.'}
                  </span>
                )}
              </>
            )}
            {step === 'details' && 'Completează numele și clientul, apoi salvează.'}
          </DialogDescription>
        </DialogHeader>

        {/* AI Loading */}
        {step === 'ai_loading' && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">AI analizează structura documentului...</p>
            <Button variant="outline" size="sm" onClick={() => { setAiError('Sărit analiza AI'); setStep('configure'); }}>
              Sari peste — configurez manual
            </Button>
          </div>
        )}

        {/* STEP: Configure columns */}
        {step === 'configure' && rawData.length > 0 && (
          <div className="space-y-3">
            {/* Header row selector + role summary */}
            <div className="flex gap-3 items-end flex-wrap">
              <div>
                <Label className="text-xs">Rândul header</Label>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled={headerRow <= 0} onClick={() => setHeaderRow(prev => Math.max(0, prev - 1))}>
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Input type="number" min={0} max={rawData.length - 1} value={headerRow} onChange={(e) => setHeaderRow(Math.max(0, parseInt(e.target.value) || 0))} className="h-8 w-14 text-center text-sm" />
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled={headerRow >= rawData.length - 1} onClick={() => setHeaderRow(prev => Math.min(rawData.length - 1, prev + 1))}>
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="flex gap-1 items-center flex-wrap ml-auto">
                {Object.entries(ROLE_LABELS).map(([role, { label, color }]) => {
                  const assigned = Array.from(columnRoles.entries()).find(([, r]) => r === role);
                  return (
                    <Badge key={role} variant="outline" className={cn("text-xs", assigned ? color : "opacity-50")}>
                      {label}: {assigned ? headers[assigned[0]] || `Col ${assigned[0] + 1}` : '—'}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {/* PDF: Column Splitter visual | Excel: Interactive Table */}
            {fileName.toLowerCase().endsWith('.pdf') ? (
              <PdfColumnSplitter
                fileData={fileData}
                columnRoles={columnRoles}
                onColumnRoleChange={toggleColumnRole}
              />
            ) : (
              <InteractiveTablePreview
                rawData={rawData}
                headerRow={headerRow}
                columnRoles={columnRoles}
                onColumnRoleChange={toggleColumnRole}
                onCellClick={handleCellClick}
                cellSelections={cellSelections}
                maxRows={50}
              />
            )}

            {/* Raw data table below for reference (PDF) */}
            {fileName.toLowerCase().endsWith('.pdf') && rawData.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground py-1">
                  📊 Arată datele extrase ({rawData.length} rânduri)
                </summary>
                <InteractiveTablePreview
                  rawData={rawData}
                  headerRow={headerRow}
                  columnRoles={columnRoles}
                  onColumnRoleChange={toggleColumnRole}
                  onCellClick={handleCellClick}
                  cellSelections={cellSelections}
                  maxRows={30}
                />
              </details>
            )}

            <div className="flex justify-between">
              <Button variant="outline" size="sm" onClick={onClose}>Anulează</Button>
              <Button size="sm" onClick={proceedToDetails} disabled={!canProceed}>
                Continuă →
                {!canProceed && <span className="ml-2 text-[10px] opacity-70">(Produs + Cantitate)</span>}
              </Button>
            </div>
          </div>
        )}

        {/* STEP: Details */}
        {step === 'details' && (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-md px-3 py-2 text-sm space-y-1">
              <p className="font-medium">Configurare detectată:</p>
              {Array.from(columnRoles.entries()).map(([colIdx, role]) => (
                <p key={colIdx}>
                  {ROLE_LABELS[role!]?.label}: <span className="font-mono">{headers[colIdx] || `Col ${colIdx}`}</span>
                </p>
              ))}
              {multiStoreCount > 1 && (
                <p>🏪 {storeColumns.length} magazine: {storeColumns.map(sc => sc.store_name).join(', ')}</p>
              )}
              <p>Header la rândul: {headerRow}</p>
            </div>

            <div>
              <Label>Nume Template *</Label>
              <Input placeholder="ex: Profi Roman" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
            </div>
            <div>
              <Label>Client asociat</Label>
              <Select value={clientId || 'none'} onValueChange={(v) => setClientId(v === 'none' ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Selectează (opțional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Fără client specific</SelectItem>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nume_magazin} - {c.punct_livrare}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Separare Magazine</Label>
              <Select value={multiStoreCount > 1 ? 'multi_column' : tipSplit} onValueChange={setTipSplit} disabled={multiStoreCount > 1}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Fără separare</SelectItem>
                  <SelectItem value="column">Coloană magazin</SelectItem>
                  <SelectItem value="section">Secțiuni separate</SelectItem>
                  <SelectItem value="multi_column">Coloane multiple per magazin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('configure')} className="mr-auto">← Înapoi</Button>
              <Button variant="outline" onClick={onClose}>Anulează</Button>
              <Button onClick={saveTemplate} disabled={isSaving || !templateName}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Se salvează...' : 'Salvează Template'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
