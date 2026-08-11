// @ts-nocheck

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Calendar, TrendingDown, Package, AlertCircle, FileText, Clock, Filter } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIngredients } from "@/hooks/productie/useIngredients";
import ExportConsumptionDialog from "./ExportConsumptionDialog";
import { DateRange } from "react-day-picker";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";

interface OrderDetail {
  comanda_id: string;
  produs: string;
  magazin: string;
  data: string;
  status: string;
  cantitate_comanda: number;
  cantitate_kg: number;
  sursa: 'custom' | 'reteta';
}

interface ConsumptionData {
  ingredient_nume: string;
  cantitate_consumata: number; // în kg
  cantitate_necesara_pending: number; // în kg pentru comenzile pending
  cantitate_totala: number; // în kg
  unitate_masura_originala: string;
  comenzi_finalizate: number;
  comenzi_pending: number;
  produse_list: string;
  detalii: OrderDetail[];
}

// Normalizare nume pentru potrivirea ingredient <-> stoc depozit
const normalizeName = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const ConsumptionAnalytics = () => {
  // Înlocuim cele două state-uri pentru date cu un singur state pentru range
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(),
  });
  const [selectedIngredient, setSelectedIngredient] = useState<string>('all');
  const { toast } = useToast();
  const { data: ingredients } = useIngredients();

  // Extragem datele de start/final folosind data LOCALĂ (nu UTC) pentru a evita
  // probleme de fus orar care fac ca "azi" să nu apară în rezultate.
  const toLocalISODate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const startDate = dateRange?.from ? toLocalISODate(dateRange.from) : toLocalISODate(new Date());
  const endDate = dateRange?.to ? toLocalISODate(dateRange.to) : toLocalISODate(new Date());

  // Calculăm boundaries cu offset explicit Europe/Bucharest pentru a interoga corect timestamptz
  const tzOffset = (() => {
    const offMin = -new Date().getTimezoneOffset();
    const sign = offMin >= 0 ? '+' : '-';
    const abs = Math.abs(offMin);
    return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
  })();
  const startTs = `${startDate}T00:00:00${tzOffset}`;
  const endTs = `${endDate}T23:59:59${tzOffset}`;

  // Query pentru consumurile și necesarul
  const { data: consumptionData, isLoading } = useQuery({
    queryKey: ['consumption-analytics', startDate, endDate, selectedIngredient],
    queryFn: async () => {
      console.log('🔍 === ÎNCEPE ANALIZA CONSUMURILOR ===');
      console.log('📅 Perioada:', startDate, 'to', endDate, 'ingredient:', selectedIngredient);
      
      // PASUL 1: Obținem toate comenzile din perioada selectată
      const { data: comenzi, error: comenziError } = await supabase
        .from('productie_comenzi')
        .select(`
          id,
          cantitate,
          status,
          created_at,
          cantitate_din_restock,
          magazin,
          data_productie,
          productie_produse!inner(
            id,
            nume,
            productie_retete(
              id,
              productie_retete_ingrediente(
                cantitate_necesara,
                unitate_masura,
                productie_ingrediente(nume, unitate_masura)
              )
            )
          )
        `)
        .or(`and(data_productie.gte.${startDate},data_productie.lte.${endDate}),and(data_productie.is.null,created_at.gte.${startTs},created_at.lte.${endTs})`)
        .order('created_at', { ascending: false });

      if (comenziError) {
        console.error('❌ Error fetching orders:', comenziError);
        throw comenziError;
      }

      console.log('📊 Comenzi găsite în perioada:', comenzi?.length);
      console.log('📋 ID-urile comenzilor:', comenzi?.map(c => c.id));

      // PASUL 2: Obținem ingredientele custom pentru comenzile găsite
      let customIngredients = [];
      if (comenzi && comenzi.length > 0) {
        const comenziIds = comenzi.map(c => c.id);
        console.log('🔍 Căutăm ingrediente custom pentru comenzile:', comenziIds);
        
        const { data: customIngredientsData, error: customError } = await supabase
          .from('productie_comenzi_ingrediente')
          .select(`
            *,
            productie_ingrediente(nume, unitate_masura)
          `)
          .in('comanda_id', comenziIds);

        if (customError) {
          console.error('❌ Eroare la încărcarea ingredientelor custom:', customError);
        } else {
          customIngredients = customIngredientsData || [];
          console.log('🎯 Ingrediente custom găsite:', customIngredients.length);
          console.log('🔧 DETALII COMPLETE ingrediente custom:', customIngredients);
        }
      }

      // Procesăm datele pentru a calcula consumurile în kg
      const consumptionMap = new Map<string, ConsumptionData>();
      
      // Funcție helper pentru conversie la kg
      const convertToKg = (cantitate: number, unitate: string): number => {
        const unitateLowerCase = unitate.toLowerCase();
        switch (unitateLowerCase) {
          case 'g':
          case 'grame':
          case 'gr':
            return cantitate / 1000;
          case 'ml':
          case 'mililitri':
            return cantitate / 1000; // presupunem densitatea 1
          case 'litri':
          case 'l':
            return cantitate; // presupunem densitatea 1
          case 'kg':
          case 'kilograme':
          default:
            return cantitate;
        }
      };

      // Creăm un map cu ingredientele custom pe comandă
      const customIngredientsMap = new Map();
      customIngredients.forEach(ing => {
        const comandaId = ing.comanda_id;
        if (!customIngredientsMap.has(comandaId)) {
          customIngredientsMap.set(comandaId, []);
        }
        customIngredientsMap.get(comandaId).push(ing);
      });

      console.log('🗺️ Map-ul ingredientelor custom per comandă:', Array.from(customIngredientsMap.entries()));

      // PASUL 3: Procesăm fiecare comandă
      comenzi?.forEach(comanda => {
        const produs = comanda.productie_produse;
        const cantitateComanda = comanda.cantitate;
        const cantitatedinRestock = comanda.cantitate_din_restock || 0;
        const statusComanda = comanda.status;
        const esteComandeAvans = comanda.magazin === 'PRODUCTIE_AVANS';
        
        console.log(`\n🏭 === PROCESEZ COMANDA ${comanda.id} ===`);
        console.log(`📦 Produs: ${produs.nume}`);
        console.log(`🔢 Cantitate comandă: ${cantitateComanda}`);
        console.log(`📋 Status: ${statusComanda}`);
        console.log(`🔄 Cantitate din restock: ${cantitatedinRestock}`);
        console.log(`🎯 Este comandă de avans: ${esteComandeAvans}`);
        
        // VERIFICARE CRITICĂ: Pentru comenzile finalizate din restocări, nu calculăm consumul
        if (statusComanda === 'completed' && !esteComandeAvans && cantitatedinRestock >= cantitateComanda) {
          console.log(`⚠️ SKIP CONSUM - Comandă finalizată complet din restocări pentru ${comanda.id}`);
          console.log(`ℹ️ Cantitate comandă: ${cantitateComanda}, din restock: ${cantitatedinRestock}`);
          return; // SKIP această comandă pentru calculul consumului
        }
        
        // Pentru comenzile parțial din restock, calculăm doar pentru partea produsă efectiv
        let cantitateEfectivProdusa = cantitateComanda;
        if (!esteComandeAvans && cantitatedinRestock > 0) {
          cantitateEfectivProdusa = cantitateComanda - cantitatedinRestock;
          console.log(`📊 Comandă parțial din restock - calculez consum doar pentru: ${cantitateEfectivProdusa} bucăți`);
          
          if (cantitateEfectivProdusa <= 0) {
            console.log(`⚠️ SKIP CONSUM - Nu există cantitate efectiv produsă pentru ${comanda.id}`);
            return; // SKIP dacă nu există cantitate efectiv produsă
          }
        }
        
        // Verificăm dacă există ingrediente custom pentru această comandă
        const customIngredientsForThisOrder = customIngredientsMap.get(comanda.id) || [];
        console.log(`🔧 Ingrediente CUSTOM pentru comanda ${comanda.id}:`, customIngredientsForThisOrder.length);
        
        if (customIngredientsForThisOrder.length > 0) {
          console.log(`🔧 DETALII ingrediente custom pentru ${comanda.id}:`, customIngredientsForThisOrder);
          
          // PRIORITATE 1: FOLOSIM EXCLUSIV INGREDIENTELE CUSTOM
          console.log(`✅ FOLOSESC EXCLUSIV REȚETA CUSTOM pentru comanda ${comanda.id}`);
          
          customIngredientsForThisOrder.forEach((ingredientCustom, index) => {
            // Determinăm numele ingredientului
            const numeIngredient = ingredientCustom.ingredient_custom_nume || 
                                 ingredientCustom.productie_ingrediente?.nume || 
                                 'Ingredient necunoscut';
            
            console.log(`  🧪 [${index + 1}] Ingredient CUSTOM: "${numeIngredient}"`);
            console.log(`  📏 Cantitate necesară per bucată: ${ingredientCustom.cantitate_necesara} ${ingredientCustom.unitate_masura}`);
            
            // Aplicăm filtrul dacă este setat
            if (selectedIngredient !== 'all' && !numeIngredient.toLowerCase().includes(selectedIngredient.toLowerCase())) {
              console.log(`  ⏭️ SKIP - Nu se potrivește cu filtrul: "${selectedIngredient}"`);
              return;
            }
            
            // Calculăm cantitatea totală necesară pentru cantitatea efectiv produsă
            const cantitateNecesaraTotal = ingredientCustom.cantitate_necesara * cantitateEfectivProdusa;
            const cantitateKg = convertToKg(cantitateNecesaraTotal, ingredientCustom.unitate_masura);
            
            console.log(`  ✅ CALCULAT: ${cantitateKg.toFixed(3)} kg (${cantitateNecesaraTotal} ${ingredientCustom.unitate_masura} pentru ${cantitateEfectivProdusa} bucăți efective)`);
            
            // Adăugăm în map
            const key = numeIngredient;
            
            if (!consumptionMap.has(key)) {
              consumptionMap.set(key, {
                ingredient_nume: numeIngredient,
                cantitate_consumata: 0,
                cantitate_necesara_pending: 0,
                cantitate_totala: 0,
                unitate_masura_originala: ingredientCustom.unitate_masura,
                comenzi_finalizate: 0,
                comenzi_pending: 0,
                produse_list: produs.nume,
                detalii: []
              });
            }
            
            const existing = consumptionMap.get(key)!;
            existing.cantitate_totala += cantitateKg;
            existing.detalii.push({
              comanda_id: comanda.id,
              produs: produs.nume,
              magazin: comanda.magazin || '-',
              data: comanda.data_productie || comanda.created_at,
              status: statusComanda,
              cantitate_comanda: cantitateEfectivProdusa,
              cantitate_kg: cantitateKg,
              sursa: 'custom'
            });
            
            if (statusComanda === 'completed') {
              existing.cantitate_consumata += cantitateKg;
              existing.comenzi_finalizate += 1;
              console.log(`  ✅ ADĂUGAT LA CONSUMAT: ${cantitateKg.toFixed(3)} kg`);
            } else {
              existing.cantitate_necesara_pending += cantitateKg;
              existing.comenzi_pending += 1;
              console.log(`  ⏳ ADĂUGAT LA PENDING: ${cantitateKg.toFixed(3)} kg`);
            }
            
            // Adăugăm produsul în lista dacă nu există deja
            if (!existing.produse_list.includes(produs.nume)) {
              existing.produse_list += `, ${produs.nume}`;
            }
          });
          
          console.log(`🚫 SKIP rețeta standard pentru comanda ${comanda.id} - am folosit ingrediente CUSTOM`);
        }
        // PRIORITATE 2: Doar dacă NU există ingrediente custom, folosește rețeta standard
        else if (produs.productie_retete && produs.productie_retete.length > 0) {
          console.log(`📝 FOLOSESC REȚETA STANDARD pentru comanda ${comanda.id} (fără ingrediente custom)`);
          
          const reteta = produs.productie_retete[0]; // Prima rețetă activă
          
          reteta.productie_retete_ingrediente?.forEach((ingredientReteta) => {
            const numeIngredient = ingredientReteta.productie_ingrediente?.nume || 'Ingredient necunoscut';
            
            // Aplicăm filtrul dacă este setat
            if (selectedIngredient !== 'all' && !numeIngredient.toLowerCase().includes(selectedIngredient.toLowerCase())) {
              return;
            }
            
            const cantitateNecesaraTotal = ingredientReteta.cantitate_necesara * cantitateEfectivProdusa;
            const cantitateKg = convertToKg(cantitateNecesaraTotal, ingredientReteta.unitate_masura);
            
            console.log(`  ✅ Ingredient STANDARD: ${numeIngredient} - ${cantitateKg.toFixed(3)} kg (pentru ${cantitateEfectivProdusa} bucăți efective)`);
            
            const key = numeIngredient;
            
            if (!consumptionMap.has(key)) {
              consumptionMap.set(key, {
                ingredient_nume: numeIngredient,
                cantitate_consumata: 0,
                cantitate_necesara_pending: 0,
                cantitate_totala: 0,
                unitate_masura_originala: ingredientReteta.unitate_masura,
                comenzi_finalizate: 0,
                comenzi_pending: 0,
                produse_list: produs.nume,
                detalii: []
              });
            }
            
            const existing = consumptionMap.get(key)!;
            existing.cantitate_totala += cantitateKg;
            existing.detalii.push({
              comanda_id: comanda.id,
              produs: produs.nume,
              magazin: comanda.magazin || '-',
              data: comanda.data_productie || comanda.created_at,
              status: statusComanda,
              cantitate_comanda: cantitateEfectivProdusa,
              cantitate_kg: cantitateKg,
              sursa: 'reteta'
            });
            
            if (statusComanda === 'completed') {
              existing.cantitate_consumata += cantitateKg;
              existing.comenzi_finalizate += 1;
            } else {
              existing.cantitate_necesara_pending += cantitateKg;
              existing.comenzi_pending += 1;
            }
            
            if (!existing.produse_list.includes(produs.nume)) {
              existing.produse_list += `, ${produs.nume}`;
            }
          });
        } else {
          console.log(`⚠️ ATENȚIE: Comanda ${comanda.id} nu are nici ingrediente custom, nici rețetă standard!`);
        }
        
        console.log(`🏁 === FINALIZAT COMANDA ${comanda.id} ===\n`);
      });

      const result = Array.from(consumptionMap.values());
      console.log('📈 REZULTAT FINAL - Consumuri procesate:', result.length, 'ingrediente');
      console.log('📈 DETALII FINALE:', result);
      console.log('🔍 === SFÂRȘIT ANALIZA CONSUMURILOR ===\n');
      return result;
    }
  });

  const handleExport = () => {
    if (!consumptionData || consumptionData.length === 0) {
      toast({
        title: "Nu există date",
        description: "Nu există date pentru export în perioada selectată",
        variant: "destructive"
      });
      return;
    }

    const csvContent = [
      'Ingredient,Consumat (kg),Necesar Pending (kg),Total (kg),Comenzi Finalizate,Comenzi Pending,Produse',
      ...consumptionData.map(item => 
        `${item.ingredient_nume},${item.cantitate_consumata.toFixed(2)},${item.cantitate_necesara_pending.toFixed(2)},${item.cantitate_totala.toFixed(2)},${item.comenzi_finalizate},${item.comenzi_pending},"${item.produse_list}"`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consumuri_${startDate}_${endDate}${selectedIngredient !== 'all' ? '_' + selectedIngredient : ''}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export realizat",
      description: "Fișierul CSV a fost descărcat cu succes"
    });
  };

  const totalConsumat = consumptionData?.reduce((sum, item) => sum + item.cantitate_consumata, 0) || 0;
  const totalNecesar = consumptionData?.reduce((sum, item) => sum + item.cantitate_necesara_pending, 0) || 0;

  // Funcție pentru formatarea valorilor în kg cu exact 2 zecimale
  const formatValueInKg = (value: number): string => {
    return value.toFixed(2);
  };

  return (
    <div className="space-y-6">
      {/* Title + Filtre */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Analiza Consumurilor</h2>
          <p className="text-muted-foreground">Analiza consumului și necesarului de materie primă</p>
        </div>
        {/* Acum, Exportul e chiar lângă picker-ul de date */}
        <div className="flex items-center gap-2">
          <DatePickerWithRange date={dateRange} setDate={setDateRange} />
          <ExportConsumptionDialog
            consumptionData={consumptionData || []}
            fileName={`consumuri_${startDate}_${endDate}${selectedIngredient !== "all" ? "_" + selectedIngredient : ""}`}
          />
        </div>
      </div>

      {/* Filtre */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtre
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ingredient">Ingredient:</Label>
              <Select
                value={selectedIngredient}
                onValueChange={setSelectedIngredient}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Toate ingredientele" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toate ingredientele</SelectItem>
                  {ingredients?.map((ingredient) => (
                    <SelectItem key={ingredient.id} value={ingredient.nume}>
                      {ingredient.nume}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Perioada:</Label>
              <div className="text-sm text-muted-foreground pt-2">
                {dateRange?.from
                  ? new Date(dateRange.from).toLocaleDateString('ro-RO') : "-"}
                {" - "}
                {dateRange?.to
                  ? new Date(dateRange.to).toLocaleDateString('ro-RO') : "-"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistici rapide */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Perioada Analizată</p>
                <p className="font-medium">
                  {Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24) + 1)} zile
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Materie Primă Consumată</p>
                <p className="font-medium">{formatValueInKg(totalConsumat)} kg</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-600" />
              <div>
                <p className="text-sm text-muted-foreground">Necesar Pentru Pending</p>
                <p className="font-medium">{formatValueInKg(totalNecesar)} kg</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">Ingrediente Analizate</p>
                <p className="font-medium">{consumptionData?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabelul cu consumurile */}
      <Card>
        <CardHeader>
          <CardTitle>
            Consumuri de Materie Primă - {new Date(startDate).toLocaleDateString('ro-RO')} → {new Date(endDate).toLocaleDateString('ro-RO')}
            {selectedIngredient !== 'all' && (
              <Badge variant="outline" className="ml-2">
                Filtrat: {selectedIngredient}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Se încarcă datele...</div>
          ) : !consumptionData || consumptionData.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Nu există comenzi în perioada selectată sau produsele nu au rețete definite.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Verificați că produsele au rețete configurate în secțiunea Produse.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingredient</TableHead>
                  <TableHead>Consumat (kg)</TableHead>
                  <TableHead>Necesar Pending (kg)</TableHead>
                  <TableHead>Total (kg)</TableHead>
                  <TableHead>Comenzi Finalizate</TableHead>
                  <TableHead>Comenzi Pending</TableHead>
                  <TableHead>Produse Care Folosesc</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consumptionData.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{item.ingredient_nume}</TableCell>
                    <TableCell className="font-mono text-green-600">
                      {formatValueInKg(item.cantitate_consumata)}
                    </TableCell>
                    <TableCell className="font-mono text-orange-600">
                      {formatValueInKg(item.cantitate_necesara_pending)}
                    </TableCell>
                    <TableCell className="font-mono font-bold">
                      {formatValueInKg(item.cantitate_totala)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">{item.comenzi_finalizate}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{item.comenzi_pending}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {item.produse_list}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ConsumptionAnalytics;
