import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Package, Hash, Store, User, X, Plus } from "lucide-react";

interface ScanColumnPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  headers: string[];
  sampleRows: string[][];
  clientDetected: string;
  clients?: { id: string; nume_magazin: string; punct_livrare: string }[];
  onConfirm: (config: ScanColumnConfig) => void;
}

export interface ScanColumnConfig {
  colProdus: string;
  colCantitate: string;
  colProdusIdx: number;
  colCantitateIdx: number;
  colMagazin?: string;
  colMagazinIdx?: number;
  clientManual?: string;
  clientId?: string;
  // Multi-store support
  storeColumns?: { store_name: string; col_index: number; col_name: string }[];
}

type SelectionStep = 'produs' | 'cantitate' | 'magazin';

interface StoreColumnEntry {
  col_index: number;
  col_name: string;
  store_name: string;
}

export default function ScanColumnPicker({
  open,
  onOpenChange,
  headers,
  sampleRows,
  clientDetected,
  clients,
  onConfirm,
}: ScanColumnPickerProps) {
  const [selectedProdus, setSelectedProdus] = useState<number | null>(null);
  const [selectedCantitate, setSelectedCantitate] = useState<number | null>(null);
  const [selectedMagazin, setSelectedMagazin] = useState<number | null>(null);
  const [clientManual, setClientManual] = useState(clientDetected || '');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [magazinMode, setMagazinMode] = useState<'column' | 'manual'>('manual');
  const [step, setStep] = useState<SelectionStep>('produs');
  
  // Multi-store: multiple quantity columns, each assigned to a store
  const [multiStore, setMultiStore] = useState(false);
  const [storeColumns, setStoreColumns] = useState<StoreColumnEntry[]>([]);

  const handleColumnClick = (idx: number) => {
    if (idx === selectedProdus) return; // can't reuse product column

    if (step === 'produs') {
      setSelectedProdus(idx);
      setStep('cantitate');
      return;
    }
    
    if (step === 'cantitate') {
      if (multiStore) {
        // In multi-store mode, toggle quantity columns
        if (storeColumns.some(sc => sc.col_index === idx)) {
          setStoreColumns(prev => prev.filter(sc => sc.col_index !== idx));
        } else {
          // Try to auto-detect store name from header
          const headerName = headers[idx] || `Col ${idx + 1}`;
          setStoreColumns(prev => [...prev, { 
            col_index: idx, 
            col_name: headerName,
            store_name: headerName 
          }]);
        }
      } else {
        if (idx !== selectedProdus) {
          setSelectedCantitate(idx);
          setStep('magazin');
        }
      }
      return;
    }
    
    if (step === 'magazin' && idx !== selectedProdus && idx !== selectedCantitate) {
      if (magazinMode === 'column') {
        setSelectedMagazin(idx);
      }
    }
  };

  const resetSelection = () => {
    setSelectedProdus(null);
    setSelectedCantitate(null);
    setSelectedMagazin(null);
    setStoreColumns([]);
    setStep('produs');
  };

  const toggleMultiStore = () => {
    if (!multiStore) {
      // Switching to multi-store: if we had a single cantitate selected, convert it
      setMultiStore(true);
      if (selectedCantitate !== null) {
        const headerName = headers[selectedCantitate] || `Col ${selectedCantitate + 1}`;
        setStoreColumns([{ col_index: selectedCantitate, col_name: headerName, store_name: headerName }]);
        setSelectedCantitate(null);
      }
      setStep('cantitate');
    } else {
      // Switching back to single
      setMultiStore(false);
      if (storeColumns.length > 0) {
        setSelectedCantitate(storeColumns[0].col_index);
        setStep('magazin');
      }
      setStoreColumns([]);
    }
  };

  const handleConfirm = () => {
    if (selectedProdus === null) return;
    
    if (multiStore && storeColumns.length > 0) {
      // Multi-store mode
      onConfirm({
        colProdus: headers[selectedProdus],
        colCantitate: storeColumns[0].col_name, // first one for backward compat
        colProdusIdx: selectedProdus,
        colCantitateIdx: storeColumns[0].col_index,
        storeColumns: storeColumns.map(sc => ({
          store_name: sc.store_name,
          col_index: sc.col_index,
          col_name: sc.col_name,
        })),
      });
    } else if (selectedCantitate !== null) {
      // Single store mode
      onConfirm({
        colProdus: headers[selectedProdus],
        colCantitate: headers[selectedCantitate],
        colProdusIdx: selectedProdus,
        colCantitateIdx: selectedCantitate,
        colMagazin: selectedMagazin !== null ? headers[selectedMagazin] : undefined,
        colMagazinIdx: selectedMagazin !== null ? selectedMagazin : undefined,
        clientManual: magazinMode === 'manual' ? clientManual : undefined,
        clientId: selectedClientId || undefined,
      });
    }
  };

  const getColumnStyle = (idx: number) => {
    if (idx === selectedProdus) return "bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500 cursor-pointer";
    if (idx === selectedCantitate) return "bg-green-100 dark:bg-green-900/30 border-2 border-green-500 cursor-pointer";
    if (multiStore && storeColumns.some(sc => sc.col_index === idx)) return "bg-green-100 dark:bg-green-900/30 border-2 border-green-500 cursor-pointer";
    if (idx === selectedMagazin) return "bg-orange-100 dark:bg-orange-900/30 border-2 border-orange-500 cursor-pointer";
    return "cursor-pointer hover:bg-muted/50";
  };

  const getStepLabel = () => {
    switch (step) {
      case 'produs': return '👆 Click pe coloana cu PRODUSE';
      case 'cantitate': 
        return multiStore 
          ? '👆 Click pe fiecare coloană de CANTITATE (câte una per magazin)'
          : '👆 Click pe coloana cu CANTITATEA';
      case 'magazin': return magazinMode === 'column' 
        ? '👆 Click pe coloana cu MAGAZINUL (opțional)' 
        : '✅ Selectează magazinul mai jos';
    }
  };

  const canConfirm = selectedProdus !== null && (
    (multiStore && storeColumns.length > 0 && storeColumns.every(sc => sc.store_name.trim())) ||
    (!multiStore && selectedCantitate !== null && (magazinMode === 'column' || clientManual.trim() || selectedClientId))
  );

  

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Selectează coloanele
          </DialogTitle>
          <DialogDescription>
            <span className="text-base font-medium text-foreground">{getStepLabel()}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mb-2">
          <div className="flex items-center gap-2" onClick={() => { setStep('produs'); }}>
            <div className="w-4 h-4 rounded border-2 border-blue-500 bg-blue-100" />
            <span className="text-sm flex items-center gap-1 cursor-pointer">
              <Package className="h-3 w-3" /> Produs
              {selectedProdus !== null && <Badge variant="secondary" className="ml-1">{headers[selectedProdus]}</Badge>}
            </span>
          </div>
          <div className="flex items-center gap-2" onClick={() => { if (selectedProdus !== null) setStep('cantitate'); }}>
            <div className="w-4 h-4 rounded border-2 border-green-500 bg-green-100" />
            <span className="text-sm flex items-center gap-1 cursor-pointer">
              <Hash className="h-3 w-3" /> Cantitate
              {!multiStore && selectedCantitate !== null && <Badge variant="secondary" className="ml-1">{headers[selectedCantitate]}</Badge>}
              {multiStore && storeColumns.length > 0 && <Badge variant="secondary" className="ml-1">{storeColumns.length} coloane</Badge>}
            </span>
          </div>
          {!multiStore && magazinMode === 'column' && (
            <div className="flex items-center gap-2" onClick={() => { if (selectedCantitate !== null) setStep('magazin'); }}>
              <div className="w-4 h-4 rounded border-2 border-orange-500 bg-orange-100" />
              <span className="text-sm flex items-center gap-1 cursor-pointer">
                <Store className="h-3 w-3" /> Magazin
                {selectedMagazin !== null && <Badge variant="secondary" className="ml-1">{headers[selectedMagazin]}</Badge>}
              </span>
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={resetSelection} className="ml-auto text-xs">
            Resetează selecția
          </Button>
        </div>

        {/* Multi-store toggle - show after product is selected */}
        {selectedProdus !== null && (
          <div className="flex items-center gap-3 px-3 py-2 bg-muted/30 rounded-md">
            <Button
              variant={multiStore ? "default" : "outline"}
              size="sm"
              onClick={toggleMultiStore}
            >
              <Store className="h-4 w-4 mr-1" />
              {multiStore ? 'Mai multe magazine (activ)' : 'Mai multe magazine în același document?'}
            </Button>
            {multiStore && (
              <span className="text-sm text-muted-foreground">
                Click pe fiecare coloană de cantitate, apoi denumește magazinele mai jos
              </span>
            )}
          </div>
        )}

        {/* Table preview */}
        <div className="border rounded-lg overflow-auto max-h-[40vh]">
          <Table>
            <TableHeader>
              <TableRow>
                {headers.map((h, idx) => (
                  <TableHead
                    key={idx}
                    className={`whitespace-nowrap text-center ${getColumnStyle(idx)}`}
                    onClick={() => handleColumnClick(idx)}
                  >
                    <div className="flex flex-col items-center gap-1">
                      {idx === selectedProdus && <Package className="h-3 w-3 text-blue-600" />}
                      {idx === selectedCantitate && <Hash className="h-3 w-3 text-green-600" />}
                      {multiStore && storeColumns.some(sc => sc.col_index === idx) && <Hash className="h-3 w-3 text-green-600" />}
                      {idx === selectedMagazin && <Store className="h-3 w-3 text-orange-600" />}
                      <span>{h || `Col ${idx + 1}`}</span>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sampleRows.slice(0, 8).map((row, rIdx) => (
                <TableRow key={rIdx}>
                  {headers.map((_, cIdx) => (
                    <TableCell
                      key={cIdx}
                      className={`whitespace-nowrap text-sm ${getColumnStyle(cIdx)}`}
                      onClick={() => handleColumnClick(cIdx)}
                    >
                      {row[cIdx] || ""}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Multi-store column assignments */}
        {multiStore && storeColumns.length > 0 && (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <div className="flex items-center gap-2 mb-2">
              <Store className="h-4 w-4" />
              <Label className="font-semibold">Magazine detectate ({storeColumns.length} → {storeColumns.length} comenzi separate)</Label>
            </div>
            {storeColumns.map((sc, idx) => (
              <div key={sc.col_index} className="flex items-center gap-2">
                <Badge variant="outline" className="bg-green-500/20 text-green-700 border-green-500 text-xs shrink-0">
                  {sc.col_name}
                </Badge>
                <span className="text-sm">→</span>
                <Input
                  className="h-8 w-56 text-sm"
                  value={sc.store_name}
                  onChange={(e) => {
                    setStoreColumns(prev => prev.map((s, i) => 
                      i === idx ? { ...s, store_name: e.target.value } : s
                    ));
                  }}
                  placeholder="Nume magazin (ex: PLOIESTI)"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => setStoreColumns(prev => prev.filter((_, i) => i !== idx))}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {storeColumns.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setStep('cantitate');
                }}
              >
                <Plus className="h-3 w-3 mr-1" />
                Adaugă încă o coloană de cantitate
              </Button>
            )}
          </div>
        )}

        {/* Magazine/Client selection - shown for single-store mode after produs + cantitate are selected */}
        {!multiStore && selectedProdus !== null && selectedCantitate !== null && (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4" />
              <Label className="font-semibold">Magazin / Client</Label>
            </div>

            <div className="flex gap-2 mb-3">
              <Button 
                variant={magazinMode === 'manual' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => { setMagazinMode('manual'); setSelectedMagazin(null); }}
              >
                Selectează manual
              </Button>
              <Button 
                variant={magazinMode === 'column' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => { setMagazinMode('column'); setStep('magazin'); }}
              >
                Din coloana tabelului
              </Button>
            </div>

            {magazinMode === 'manual' && (
              <div className="space-y-2">
                {clients && clients.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Selectează din lista de clienți:</Label>
                    <Select value={selectedClientId} onValueChange={(v) => {
                      setSelectedClientId(v);
                      const cl = clients.find(c => c.id === v);
                      if (cl) setClientManual(cl.nume_magazin);
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Alege clientul..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {clients.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nume_magazin} {c.punct_livrare ? `— ${c.punct_livrare}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label className="text-xs text-muted-foreground">Sau scrie numele magazinului:</Label>
                  <Input 
                    value={clientManual} 
                    onChange={(e) => { setClientManual(e.target.value); setSelectedClientId(''); }}
                    placeholder="Ex: Lidl Brașov, Kaufland..."
                  />
                </div>
              </div>
            )}

            {magazinMode === 'column' && (
              <p className="text-sm text-muted-foreground">
                {selectedMagazin !== null 
                  ? <>Coloana selectată: <Badge variant="outline">{headers[selectedMagazin]}</Badge></>
                  : 'Click pe coloana din tabel care conține numele magazinului.'
                }
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anulează
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            <Check className="h-4 w-4 mr-1" />
            Confirmă și salvează template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
