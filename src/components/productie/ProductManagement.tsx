import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, useProductionLines } from '@/hooks/productie/useProductionData';
import { useIngredients } from '@/hooks/productie/useIngredients';
import { useRecipesByProduct, useCreateRecipe, useUpdateRecipe } from '@/hooks/productie/useRecipes';
import { useDistributionRulesByProduct, useCreateDistributionRule, useDeleteDistributionRulesByProduct } from '@/hooks/productie/useDistributionRules';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Package, Loader2, Layers } from 'lucide-react';
import GrupareAmbalareDialog from './GrupareAmbalareDialog';

interface Ingredient {
  ingredient_id: string;
  nume_ingredient: string;
  cantitate_necesara: number;
  unitate_masura: string;
  observatii?: string;
}

interface LineDistribution {
  linie_id: string;
  nume_linie: string;
  prioritate: number;
}

interface ProductFormData {
  nume: string;
  descriere?: string;
  unitate_masura: string;
  ingredients: Ingredient[];
  lineDistribution: LineDistribution[];
}

const ProductManagement = () => {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGrupareOpen, setIsGrupareOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [formData, setFormData] = useState<ProductFormData>({
    nume: '',
    descriere: '',
    unitate_masura: 'buc',
    ingredients: [],
    lineDistribution: []
  });
  const [currentIngredient, setCurrentIngredient] = useState({
    ingredient_id: '',
    cantitate_necesara: 1,
    unitate_masura: 'gr',
    observatii: ''
  });
  const [currentLine, setCurrentLine] = useState({
    linie_id: '',
    prioritate: 1
  });
  const { data: products, isLoading } = useProducts();
  const { data: availableIngredients } = useIngredients();
  const { data: productionLines } = useProductionLines();
  const createProductMutation = useCreateProduct();
  const updateProductMutation = useUpdateProduct();
  const deleteProductMutation = useDeleteProduct();
  const createRecipeMutation = useCreateRecipe();
  const updateRecipeMutation = useUpdateRecipe();
  const { data: existingRecipes } = useRecipesByProduct(editingProduct?.id || '');
  const { data: existingDistributionRules } = useDistributionRulesByProduct(editingProduct?.id || '');

  const { mutateAsync: createDistributionRule } = useCreateDistributionRule();
  const { mutateAsync: deleteDistributionRulesByProduct } = useDeleteDistributionRulesByProduct();

  // Effect pentru a actualiza form data când se încarcă rețetele existente
  useEffect(() => {
    if (editingProduct && existingRecipes && existingRecipes.length > 0) {
      const mappedIngredients = existingRecipes[0]?.productie_retete_ingrediente?.map(recipeIngredient => ({
        ingredient_id: recipeIngredient.ingredient_id,
        nume_ingredient: recipeIngredient.productie_ingrediente?.nume || 'Necunoscut',
        cantitate_necesara: recipeIngredient.cantitate_necesara,
        unitate_masura: recipeIngredient.unitate_masura,
        observatii: recipeIngredient.observatii || ''
      })) || [];

      setFormData(prev => ({
        ...prev,
        ingredients: mappedIngredients
      }));
    }
  }, [editingProduct, existingRecipes]);

  // Effect pentru a actualiza regulile de distribuire când se încarcă
  useEffect(() => {
    if (editingProduct && existingDistributionRules && existingDistributionRules.length > 0) {
      const mappedDistribution = existingDistributionRules.map(rule => ({
        linie_id: rule.linie_preferata_id,
        nume_linie: rule.productie_linii?.nume || 'Necunoscut',
        prioritate: rule.prioritate
      }));

      setFormData(prev => ({
        ...prev,
        lineDistribution: mappedDistribution
      }));
    }
  }, [editingProduct, existingDistributionRules]);

  const resetForm = () => {
    setFormData({
      nume: '',
      descriere: '',
      unitate_masura: 'buc',
      ingredients: [],
      lineDistribution: []
    });
    setCurrentIngredient({
      ingredient_id: '',
      cantitate_necesara: 1,
      unitate_masura: 'gr',
      observatii: ''
    });
    setCurrentLine({
      linie_id: '',
      prioritate: 1
    });
    setEditingProduct(null);
  };

  const openEdit = (product: any) => {
    setEditingProduct(product);
    
    setFormData({
      nume: product.nume,
      descriere: product.descriere || '',
      unitate_masura: product.unitate_masura,
      ingredients: [], // Va fi populat de useEffect când se încarcă rețetele
      lineDistribution: [] // Va fi populat de useEffect când se încarcă regulile
    });
    setIsDialogOpen(true);
  };

  const handleIngredientAdd = () => {
    if (!currentIngredient.ingredient_id) {
      toast({
        variant: "destructive",
        title: "Eroare",
        description: "Selectează un ingredient"
      });
      return;
    }

    const ingredientToAdd = {
      ...currentIngredient,
      nume_ingredient: availableIngredients?.find(ing => ing.id === currentIngredient.ingredient_id)?.nume || 'Necunoscut'
    };

    setFormData(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, ingredientToAdd]
    }));

    setCurrentIngredient({
      ingredient_id: '',
      cantitate_necesara: 1,
      unitate_masura: 'gr',
      observatii: ''
    });
  };

  const removeIngredient = (index: number) => {
    setFormData(prev => {
      const newIngredients = [...prev.ingredients];
      newIngredients.splice(index, 1);
      return { ...prev, ingredients: newIngredients };
    });
  };

  const handleLineAdd = () => {
    if (!currentLine.linie_id) {
      toast({
        variant: "destructive",
        title: "Eroare",
        description: "Selectează o linie de producție"
      });
      return;
    }

    const lineToAdd = {
      ...currentLine,
      nume_linie: productionLines?.find(line => line.id === currentLine.linie_id)?.nume || 'Necunoscut'
    };

    setFormData(prev => ({
      ...prev,
      lineDistribution: [...prev.lineDistribution, lineToAdd]
    }));

    setCurrentLine({
      linie_id: '',
      prioritate: 1
    });
  };

  const removeLineDistribution = (index: number) => {
    setFormData(prev => {
      const newLineDistribution = [...prev.lineDistribution];
      newLineDistribution.splice(index, 1);
      return { ...prev, lineDistribution: newLineDistribution };
    });
  };

  const handleDeleteProduct = async (product: any) => {
    if (window.confirm(`Sigur vrei să ștergi produsul "${product.nume}"?`)) {
      try {
        console.log('🗑️ Încep ștergerea produsului:', product.id);
        await deleteProductMutation.mutateAsync(product.id);
        
        toast({
          title: "Succes",
          description: `Produsul "${product.nume}" a fost șters cu succes!`
        });
        
        console.log('✅ Produsul a fost șters cu succes');
      } catch (error: any) {
        console.error('❌ Eroare la ștergerea produsului:', error);
        toast({
          variant: "destructive",
          title: "Eroare",
          description: error.message || `A apărut o eroare la ștergerea produsului "${product.nume}"`
        });
      }
    }
  };

  const handleSubmit = async () => {
    if (!formData.nume.trim()) {
      toast({
        variant: "destructive",
        title: "Eroare",
        description: "Numele produsului este obligatoriu"
      });
      return;
    }

    try {
      let productResult;
      
      if (editingProduct) {
        console.log('🔄 Actualizez produsul existent:', editingProduct.id);
        productResult = await updateProductMutation.mutateAsync({
          id: editingProduct.id,
          updates: {
            nume: formData.nume,
            descriere: formData.descriere,
            unitate_masura: formData.unitate_masura
          }
        });

        // Pentru editare, actualizăm rețeta existentă în loc să creăm una nouă
        if (formData.ingredients.length > 0 && existingRecipes && existingRecipes.length > 0) {
          console.log('🔄 Actualizez rețeta existentă:', existingRecipes[0].id);
          await updateRecipeMutation.mutateAsync({
            id: existingRecipes[0].id,
            updates: {
              nume_reteta: `Rețetă ${formData.nume}`,
              descriere: `Rețetă pentru ${formData.nume}`
            },
            ingrediente: formData.ingredients.map(ing => ({
              ingredient_id: ing.ingredient_id,
              cantitate_necesara: ing.cantitate_necesara,
              unitate_masura: ing.unitate_masura,
              observatii: ing.observatii
            }))
          });
        } else if (formData.ingredients.length > 0) {
          // Dacă nu există rețetă dar avem ingrediente, creăm una nouă
          console.log('➕ Creez rețetă nouă pentru produsul editat');
          await createRecipeMutation.mutateAsync({
            produs_id: productResult.id,
            nume_reteta: `Rețetă ${formData.nume}`,
            descriere: `Rețetă pentru ${formData.nume}`,
            ingrediente: formData.ingredients.map(ing => ({
              ingredient_id: ing.ingredient_id,
              cantitate_necesara: ing.cantitate_necesara,
              unitate_masura: ing.unitate_masura,
              observatii: ing.observatii
            }))
          });
        }
      } else {
        console.log('➕ Creez produs nou');
        productResult = await createProductMutation.mutateAsync({
          nume: formData.nume,
          descriere: formData.descriere,
          unitate_masura: formData.unitate_masura
        });

        // Pentru produs nou, creăm rețeta dacă avem ingrediente
        if (formData.ingredients.length > 0) {
          console.log('➕ Creez rețetă pentru produsul nou');
          await createRecipeMutation.mutateAsync({
            produs_id: productResult.id,
            nume_reteta: `Rețetă ${formData.nume}`,
            descriere: `Rețetă pentru ${formData.nume}`,
            ingrediente: formData.ingredients.map(ing => ({
              ingredient_id: ing.ingredient_id,
              cantitate_necesara: ing.cantitate_necesara,
              unitate_masura: ing.unitate_masura,
              observatii: ing.observatii
            }))
          });
        }
      }

      // Gestionăm regulile de distribuire
      if (formData.lineDistribution.length > 0) {
        console.log('🔧 Gestionez reguli de distribuire pentru produs:', productResult.id);
        
        // Dacă editezi un produs, șterge regulile existente
        if (editingProduct) {
          console.log('🗑️ Șterg regulile existente pentru produs');
          await deleteDistributionRulesByProduct(productResult.id);
        }
        
        // Creăm regulile noi
        for (const lineRule of formData.lineDistribution) {
          try {
            await createDistributionRule({
              produs_id: productResult.id,
              linie_preferata_id: lineRule.linie_id,
              prioritate: lineRule.prioritate
            });
            console.log('✅ Regulă creată:', {
              produs_id: productResult.id,
              linie_preferata_id: lineRule.linie_id,
              prioritate: lineRule.prioritate
            });
          } catch (ruleError) {
            console.error('❌ Eroare la crearea regulii:', ruleError);
          }
        }
        
        console.log('🎉 Toate regulile de distribuire au fost gestionate!');
      } else if (editingProduct) {
        // Dacă nu mai sunt reguli selectate dar e editare, șterge toate regulile existente
        console.log('🗑️ Șterg toate regulile pentru produs (nu mai există reguli selectate)');
        await deleteDistributionRulesByProduct(productResult.id);
      }

      toast({
        title: "Succes",
        description: `Produsul a fost ${editingProduct ? 'actualizat' : 'creat'} cu succes!`
      });

      setIsDialogOpen(false);
      resetForm();
    } catch (error: any) {
      console.error('❌ Eroare la salvarea produsului:', error);
      toast({
        variant: "destructive",
        title: "Eroare",
        description: error.message || `A apărut o eroare la ${editingProduct ? 'actualizarea' : 'crearea'} produsului`
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Management Produse</h2>
          <p className="text-gray-600">Administrează produsele, ingredientele și rețetele</p>
        </div>
        <Button onClick={() => { setIsDialogOpen(true); resetForm(); }} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Adaugă Produs
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista Produse</CardTitle>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nume</TableHead>
                  <TableHead>Unitate de Masura</TableHead>
                  <TableHead>Actiuni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center">Se incarca...</TableCell>
                  </TableRow>
                ) : products?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center">Nu exista produse</TableCell>
                  </TableRow>
                ) : (
                  products?.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>{product.nume}</TableCell>
                      <TableCell>{product.unitate_masura}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(product)}
                            className="flex items-center gap-1"
                          >
                            <Edit className="h-3 w-3" />
                            Editează
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteProduct(product)}
                            disabled={deleteProductMutation.isPending}
                            className="flex items-center gap-1 text-red-600 hover:text-red-700"
                          >
                            {deleteProductMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                            Șterge
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </CardHeader>
      </Card>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Editează Produs' : 'Adaugă Produs Nou'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Informații Produs</h3>
              <div className="space-y-2">
                <Label>Nume Produs *</Label>
                <Input
                  type="text"
                  value={formData.nume}
                  onChange={(e) => setFormData({ ...formData, nume: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Descriere</Label>
                <Input
                  type="text"
                  value={formData.descriere}
                  onChange={(e) => setFormData({ ...formData, descriere: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Unitate de Masura</Label>
                <Input
                  type="text"
                  value={formData.unitate_masura}
                  onChange={(e) => setFormData({ ...formData, unitate_masura: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Rețetă Produs</h3>

              {/* Form pentru adăugare ingredient */}
              <div className="space-y-3 p-4 border rounded-lg bg-gray-50">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-sm">Ingredient</Label>
                    <Select
                      value={currentIngredient.ingredient_id}
                      onValueChange={(value) => setCurrentIngredient({ ...currentIngredient, ingredient_id: value })}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Selectează ingredientul" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableIngredients?.map((ingredient) => (
                          <SelectItem key={ingredient.id} value={ingredient.id}>
                            {ingredient.nume}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm">Cantitate</Label>
                    <Input
                      type="number"
                      placeholder="Cantitate"
                      className="h-8"
                      value={currentIngredient.cantitate_necesara}
                      onChange={(e) => setCurrentIngredient({ ...currentIngredient, cantitate_necesara: parseFloat(e.target.value) || 1 })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-sm">Unitate de Masura</Label>
                    <Input
                      type="text"
                      placeholder="Unitate de masura"
                      className="h-8"
                      value={currentIngredient.unitate_masura}
                      onChange={(e) => setCurrentIngredient({ ...currentIngredient, unitate_masura: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Observații</Label>
                    <Input
                      type="text"
                      placeholder="Observații"
                      className="h-8"
                      value={currentIngredient.observatii}
                      onChange={(e) => setCurrentIngredient({ ...currentIngredient, observatii: e.target.value })}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={handleIngredientAdd}
                  size="sm"
                  className="w-full"
                  disabled={!currentIngredient.ingredient_id}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Adaugă Ingredient
                </Button>
              </div>

              {/* Lista ingredientelor adăugate */}
              {formData.ingredients.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Ingrediente Adăugate:</Label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {formData.ingredients.map((ingredient, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-blue-50 rounded text-sm">
                        <span>{ingredient.nume_ingredient} - {ingredient.cantitate_necesara} {ingredient.unitate_masura}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeIngredient(index)}
                          className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Secțiunea pentru Distribuție pe Linii */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Package className="h-5 w-5" />
                Distribuție pe Linii
              </h3>

              {/* Form pentru adăugare linie */}
              <div className="space-y-3 p-4 border rounded-lg bg-gray-50">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-sm">Linie Producție</Label>
                    <Select 
                      value={currentLine.linie_id} 
                      onValueChange={(value) => setCurrentLine({...currentLine, linie_id: value})}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Selectați linia" />
                      </SelectTrigger>
                      <SelectContent>
                        {productionLines?.map((line) => (
                          <SelectItem key={line.id} value={line.id}>
                            {line.nume} (cap. {line.capacitate_ora}/h)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm">Prioritate</Label>
                    <Input
                      type="number"
                      placeholder="1-10"
                      min="1"
                      max="10"
                      className="h-8"
                      value={currentLine.prioritate}
                      onChange={(e) => setCurrentLine({...currentLine, prioritate: parseInt(e.target.value) || 1})}
                    />
                  </div>
                </div>
                <Button 
                  type="button"
                  onClick={handleLineAdd}
                  size="sm"
                  className="w-full"
                  disabled={!currentLine.linie_id}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Adaugă Linie
                </Button>
              </div>

              {/* Lista liniilor selectate */}
              {formData.lineDistribution.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Linii Selectate:</Label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {formData.lineDistribution.map((line, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-blue-50 rounded text-sm">
                        <span>{line.nume_linie} (P{line.prioritate})</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLineDistribution(index)}
                          className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
              Anulează
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createProductMutation.isPending || updateProductMutation.isPending}
            >
              {(createProductMutation.isPending || updateProductMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingProduct ? 'Actualizează' : 'Creează'} Produs
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductManagement;
