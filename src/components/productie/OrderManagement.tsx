import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Package, AlertTriangle, Calendar } from "lucide-react";
import { useInventoryStock } from "@/hooks/useInventoryData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRecipes } from "@/hooks/useRecipes";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const StockManagement = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const { data: inventory, isLoading: inventoryLoading } = useInventoryStock();
  const { data: recipes, isLoading: recipesLoading } = useRecipes();

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

  // Query pentru comenzile finalizate cu produsele și rețetele lor
  const { data: finishedOrders, isLoading: finishedLoading } = useQuery({
    queryKey: ['finished-orders-with-recipes', selectedDate],
    queryFn: async () => {
      const startDate = new Date(selectedDate);
      const endDate = new Date(selectedDate);
      endDate.setDate(endDate.getDate() + 1);

      const { data, error } = await supabase
        .from('productie_comenzi')
        .select(`
          *,
          productie_produse!inner(nume, unitate_masura)
        `)
        .eq('status', 'completed')
        .gte('updated_at', startDate.toISOString())
        .lt('updated_at', endDate.toISOString())
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const isLoading = inventoryLoading || recipesLoading || unfinishedLoading || finishedLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const lowStockItems = inventory?.filter(item => item.quantity < 10) || [];

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
          <h2 className="text-2xl font-bold">Gestiunea Stocurilor</h2>
          <p className="text-muted-foreground">
            Monitorizează stocurile și consumurile de materii prime
          </p>
        </div>
        
        {lowStockItems.length > 0 && (
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">{lowStockItems.length} produse cu stoc redus</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Produse</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inventory?.length || 0}</div>
            <p className="text-xs text-muted-foreground">produse în stoc</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stoc Redus</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{lowStockItems.length}</div>
            <p className="text-xs text-muted-foreground">necesită atenție</p>
          </CardContent>
        </Card>

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
      </div>

      <Tabs defaultValue="stock" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="stock">
            <Package className="h-4 w-4 mr-2" />
            Stocuri Disponibile
          </TabsTrigger>
          <TabsTrigger value="consumptions">
            <Calendar className="h-4 w-4 mr-2" />
            Consumuri Materii Prime
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stock">
          <Card>
            <CardHeader>
              <CardTitle>Lista Stocurilor</CardTitle>
            </CardHeader>
            <CardContent>
              {!inventory || inventory.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nu există stocuri în depozit.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produs</TableHead>
                      <TableHead>Cantitate</TableHead>
                      <TableHead>Unitate</TableHead>
                      <TableHead>Furnizor</TableHead>
                      <TableHead>Data Intrării</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventory.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>
                          <span className={item.quantity < 10 ? 'text-amber-600 font-medium' : ''}>
                            {item.quantity}
                          </span>
                        </TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell>{item.supplier || '-'}</TableCell>
                        <TableCell>
                          {new Date(item.receipt_date).toLocaleDateString('ro-RO')}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={item.quantity < 10 ? 'destructive' : item.quantity < 50 ? 'secondary' : 'default'}
                          >
                            {item.quantity < 10 ? 'Stoc redus' : 
                             item.quantity < 50 ? 'Atenție' : 'OK'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consumptions">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Consumuri Materii Prime</CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="date-filter">Filtrează după data:</Label>
                <Input
                  id="date-filter"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-auto"
                />
              </div>
            </CardHeader>
            <CardContent>
              {combinedIngredients.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nu există date despre consumuri pentru data selectată.
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
                              {(ingredient.cantitate_necesara || 0).toFixed(3)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-green-600 font-medium">
                              {(ingredient.cantitate_consumata || 0).toFixed(3)}
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
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StockManagement;
