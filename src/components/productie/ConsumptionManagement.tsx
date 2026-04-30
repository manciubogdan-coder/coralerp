
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRecipes } from "@/hooks/useRecipes";
import { DateRange } from "react-day-picker";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { Label } from "@/components/ui/label";
import ConsumptionExportDialog from "./ConsumptionExportDialog";

const ConsumptionManagement = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(),
  });
  const { data: recipes, isLoading: recipesLoading } = useRecipes();

  // Extragem datele de start și de final din range
  const startDate = dateRange?.from
    ? dateRange.from.toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];
  const endDate = dateRange?.to
    ? dateRange.to.toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  // Query pentru comenzile nefinalizate cu produsele și rețetele lor
  const { data: unfinishedOrders, isLoading: unfinishedLoading } = useQuery({
    queryKey: ['unfinished-orders-with-recipes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('productie_comenzi')
        .select(`
          *,
          productie_produse!inner(nume, unitate_masura)
        `)
        .in('status', ['pending', 'assigned', 'in_progress', 'partial'])
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Query pentru comenzile finalizate cu produsele și rețetele lor - folosind range-ul de date
  const { data: finishedOrders, isLoading: finishedLoading } = useQuery({
    queryKey: ['finished-orders-with-recipes', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('productie_comenzi')
        .select(`
          *,
          productie_produse!inner(nume, unitate_masura)
        `)
        .eq('status', 'completed')
        .gte('updated_at', `${startDate}T00:00:00`)
        .lte('updated_at', `${endDate}T23:59:59`)
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const isLoading = recipesLoading || unfinishedLoading || finishedLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Functie pentru convertirea unitatilor la kg
  const convertToKg = (cantidad: number, unitate: string) => {
    switch (unitate?.toLowerCase()) {
      case 'g':
      case 'grame':
        return cantidad / 1000;
      case 'kg':
      case 'kilograme':
        return cantidad;
      case 't':
      case 'tone':
        return cantidad * 1000;
      default:
        return cantidad; // Assume kg if unknown
    }
  };

  // Calculez ingredientele necesare pentru comenzile nefinalizate
  const calculateRequiredIngredients = () => {
    if (!unfinishedOrders || !recipes) return [];

    const ingredientsMap = new Map();

    unfinishedOrders.forEach(order => {
      const productRecipes = recipes.filter(recipe => 
        recipe.produs_id === order.produs_id && recipe.activa
      );

      if (productRecipes.length > 0) {
        const recipe = productRecipes[0]; // Folosesc prima rețetă activă
        
        recipe.productie_retete_ingrediente?.forEach(ingredient => {
          const key = ingredient.ingredient_id;
          const requiredQuantity = (ingredient.cantitate_necesara || 0) * order.cantitate;
          const requiredQuantityKg = convertToKg(requiredQuantity, ingredient.unitate_masura);
          
          if (ingredientsMap.has(key)) {
            ingredientsMap.get(key).cantitate_necesara += requiredQuantityKg;
          } else {
            ingredientsMap.set(key, {
              id: ingredient.ingredient_id,
              nume: ingredient.productie_ingrediente?.nume || 'Ingredient necunoscut',
              cantitate_necesara: requiredQuantityKg,
              cantitate_consumata: 0,
              magazine: new Set(),
              tip: 'necesar'
            });
          }
        });
      }
    });

    return Array.from(ingredientsMap.values());
  };

  // Calculez ingredientele consumate pentru comenzile finalizate în ziua selectată
  const calculateConsumedIngredients = () => {
    if (!finishedOrders || !recipes) return [];

    const ingredientsMap = new Map();

    finishedOrders.forEach(order => {
      const productRecipes = recipes.filter(recipe => 
        recipe.produs_id === order.produs_id && recipe.activa
      );

      if (productRecipes.length > 0) {
        const recipe = productRecipes[0]; // Folosesc prima rețetă activă
        
        recipe.productie_retete_ingrediente?.forEach(ingredient => {
          const key = ingredient.ingredient_id;
          const consumedQuantity = (ingredient.cantitate_necesara || 0) * order.cantitate;
          const consumedQuantityKg = convertToKg(consumedQuantity, ingredient.unitate_masura);
          
          if (ingredientsMap.has(key)) {
            ingredientsMap.get(key).cantitate_consumata += consumedQuantityKg;
            ingredientsMap.get(key).magazine.add(order.magazin);
          } else {
            ingredientsMap.set(key, {
              id: ingredient.ingredient_id,
              nume: ingredient.productie_ingrediente?.nume || 'Ingredient necunoscut',
              cantitate_necesara: 0,
              cantitate_consumata: consumedQuantityKg,
              magazine: new Set([order.magazin]),
              tip: 'consumat'
            });
          }
        });
      }
    });

    return Array.from(ingredientsMap.values());
  };

  const requiredIngredients = calculateRequiredIngredients();
  const consumedIngredients = calculateConsumedIngredients();

  // Combin ingredientele necesare și consumate
  const allIngredients = new Map();

  requiredIngredients.forEach(ingredient => {
    allIngredients.set(ingredient.id, {
      ...ingredient,
      cantitate_consumata: 0,
      magazine: new Set()
    });
  });

  consumedIngredients.forEach(ingredient => {
    if (allIngredients.has(ingredient.id)) {
      allIngredients.get(ingredient.id).cantitate_consumata = ingredient.cantitate_consumata;
      allIngredients.get(ingredient.id).magazine = ingredient.magazine;
    } else {
      allIngredients.set(ingredient.id, {
        ...ingredient,
        cantitate_necesara: 0
      });
    }
  });

  const combinedIngredients = Array.from(allIngredients.values());

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Consumuri Materii Prime</h2>
          <p className="text-muted-foreground">
            Monitorizează consumurile de ingrediente pe perioada selectată
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Ingrediente Urmărite</CardTitle>
          <Calendar className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{combinedIngredients.length}</div>
          <p className="text-xs text-muted-foreground">materii prime</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Consumuri Materii Prime</CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="date-filter">Perioada:</Label>
            <DatePickerWithRange date={dateRange} setDate={setDateRange} />
            <ConsumptionExportDialog
              consumptionData={combinedIngredients}
              fileName={`consumuri_${startDate}_${endDate}`}
            />
          </div>
        </CardHeader>
        <CardContent>
          {combinedIngredients.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nu există date despre consumuri pentru perioada selectată.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingredient</TableHead>
                  <TableHead>Cantitate Necesară (kg)</TableHead>
                  <TableHead>Cantitate Consumată (kg)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {combinedIngredients.map((ingredient) => {
                  return (
                    <TableRow key={ingredient.id}>
                      <TableCell className="font-medium">{ingredient.nume}</TableCell>
                      <TableCell>
                        <span className="text-orange-600 font-medium">
                          {(ingredient.cantitate_necesara || 0).toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-green-600 font-medium">
                          {(ingredient.cantitate_consumata || 0).toFixed(2)}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ConsumptionManagement;
