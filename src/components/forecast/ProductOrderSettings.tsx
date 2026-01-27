import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-custom-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save, Loader2 } from "lucide-react";

interface ProductOrderSettingsProps {
  inventoryType: "materii-prime" | "ambalaje" | "etichete";
}

interface ProductSetting {
  product_id: string;
  product_name: string;
  product_code: string | null;
  unit: string;
  lead_time_days: number;
  min_order_quantity: number;
  hasChanges: boolean;
}

const ProductOrderSettings: React.FC<ProductOrderSettingsProps> = ({ inventoryType }) => {
  const [settings, setSettings] = useState<ProductSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const getTableNames = () => {
    switch (inventoryType) {
      case "ambalaje":
        return { products: "ambalaje_products" as const, settings: "ambalaje_product_order_settings" as const };
      case "etichete":
        return { products: "etichete_products" as const, settings: "etichete_product_order_settings" as const };
      default:
        return { products: "products" as const, settings: "product_order_settings" as const };
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [inventoryType]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { products: productsTable, settings: settingsTable } = getTableNames();

      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from(productsTable)
        .select("id, name, cod_produs, default_unit")
        .order("name");

      if (productsError) throw productsError;

      // Fetch existing settings
      const { data: settingsData, error: settingsError } = await supabase
        .from(settingsTable)
        .select("*");

      if (settingsError) throw settingsError;

      // Merge products with settings
      const settingsMap = new Map((settingsData || []).map((s: any) => [s.product_id, s]));
      
      const mergedSettings: ProductSetting[] = (productsData || []).map((product: any) => {
        const existing = settingsMap.get(product.id) as any;
        return {
          product_id: product.id,
          product_name: product.name,
          product_code: product.cod_produs,
          unit: product.default_unit,
          lead_time_days: existing?.lead_time_days ?? 7,
          min_order_quantity: existing?.min_order_quantity ?? 100,
          hasChanges: false
        };
      });

      setSettings(mergedSettings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast({ title: "Eroare la încărcarea setărilor", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (productId: string, field: "lead_time_days" | "min_order_quantity", value: number) => {
    setSettings(prev => prev.map(s => 
      s.product_id === productId 
        ? { ...s, [field]: value, hasChanges: true }
        : s
    ));
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const { settings: settingsTable } = getTableNames();
      const changedSettings = settings.filter(s => s.hasChanges);

      for (const setting of changedSettings) {
        const { error } = await supabase
          .from(settingsTable)
          .upsert({
            product_id: setting.product_id,
            lead_time_days: setting.lead_time_days,
            min_order_quantity: setting.min_order_quantity
          }, { onConflict: "product_id" });

        if (error) throw error;
      }

      toast({ title: "Setările au fost salvate cu succes!" });
      setSettings(prev => prev.map(s => ({ ...s, hasChanges: false })));
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({ title: "Eroare la salvarea setărilor", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const hasAnyChanges = settings.some(s => s.hasChanges);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Setează timpul de livrare și cantitatea minimă de comandă pentru fiecare produs.
        </p>
        <Button onClick={saveSettings} disabled={!hasAnyChanges || saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvează Modificările
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cod Produs</TableHead>
              <TableHead>Nume Produs</TableHead>
              <TableHead>Unitate</TableHead>
              <TableHead className="w-40">Timp Livrare (zile)</TableHead>
              <TableHead className="w-48">Cantitate Minimă Comandă</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {settings.map(setting => (
              <TableRow key={setting.product_id} className={setting.hasChanges ? "bg-amber-50" : ""}>
                <TableCell className="font-mono text-sm">
                  {setting.product_code || "-"}
                </TableCell>
                <TableCell className="font-medium">{setting.product_name}</TableCell>
                <TableCell>{setting.unit}</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={1}
                    value={setting.lead_time_days}
                    onChange={(e) => handleChange(setting.product_id, "lead_time_days", parseInt(e.target.value) || 1)}
                    className="w-24"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={1}
                    step={inventoryType === "etichete" ? 1 : 0.01}
                    value={setting.min_order_quantity}
                    onChange={(e) => handleChange(setting.product_id, "min_order_quantity", parseFloat(e.target.value) || 1)}
                    className="w-32"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ProductOrderSettings;
