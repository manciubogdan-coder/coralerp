
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const DatabaseDebugger = () => {
  // Verifică toate tabelele necesare
  const { data: comenzi } = useQuery({
    queryKey: ['debug-comenzi'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('productie_comenzi')
        .select('*')
        .limit(5);
      console.log('🔍 COMENZI DEBUG:', { data, error });
      return data;
    }
  });

  const { data: ingredienteCustom } = useQuery({
    queryKey: ['debug-ingrediente-custom'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('productie_comenzi_ingrediente')
        .select(`
          *,
          productie_ingrediente(nume, unitate_masura)
        `)
        .limit(5);
      console.log('🔍 INGREDIENTE CUSTOM DEBUG:', { data, error });
      return data;
    }
  });

  const { data: retete } = useQuery({
    queryKey: ['debug-retete'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('productie_retete')
        .select(`
          *,
          productie_retete_ingrediente(
            *,
            productie_ingrediente(nume, unitate_masura)
          )
        `)
        .limit(5);
      console.log('🔍 REȚETE DEBUG:', { data, error });
      return data;
    }
  });

  const { data: produse } = useQuery({
    queryKey: ['debug-produse'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('productie_produse')
        .select('*')
        .limit(5);
      console.log('🔍 PRODUSE DEBUG:', { data, error });
      return data;
    }
  });

  const { data: ingrediente } = useQuery({
    queryKey: ['debug-ingrediente'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('productie_ingrediente')
        .select('*')
        .limit(5);
      console.log('🔍 INGREDIENTE DEBUG:', { data, error });
      return data;
    }
  });

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-xl font-bold">Database Debug Info</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Comenzi</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={comenzi?.length ? "default" : "destructive"}>
              {comenzi?.length || 0} înregistrări
            </Badge>
            {comenzi?.slice(0, 2).map(c => (
              <div key={c.id} className="text-xs mt-2">
                ID: {c.id}<br/>
                Status: {c.status}<br/>
                Produs ID: {c.produs_id}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ingrediente Custom</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={ingredienteCustom?.length ? "default" : "destructive"}>
              {ingredienteCustom?.length || 0} înregistrări
            </Badge>
            {ingredienteCustom?.slice(0, 2).map(ing => (
              <div key={ing.id} className="text-xs mt-2">
                Comandă: {ing.comanda_id}<br/>
                Ingredient: {ing.ingredient_custom_nume || ing.productie_ingrediente?.nume}<br/>
                Cantitate: {ing.cantitate_necesara}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rețete</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={retete?.length ? "default" : "destructive"}>
              {retete?.length || 0} înregistrări
            </Badge>
            {retete?.slice(0, 2).map(r => (
              <div key={r.id} className="text-xs mt-2">
                Nume: {r.nume_reteta}<br/>
                Produs ID: {r.produs_id}<br/>
                Ingrediente: {r.productie_retete_ingrediente?.length || 0}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Produse</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={produse?.length ? "default" : "destructive"}>
              {produse?.length || 0} înregistrări
            </Badge>
            {produse?.slice(0, 2).map(p => (
              <div key={p.id} className="text-xs mt-2">
                ID: {p.id}<br/>
                Nume: {p.nume}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ingrediente</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={ingrediente?.length ? "default" : "destructive"}>
              {ingrediente?.length || 0} înregistrări
            </Badge>
            {ingrediente?.slice(0, 2).map(ing => (
              <div key={ing.id} className="text-xs mt-2">
                Nume: {ing.nume}<br/>
                Unitate: {ing.unitate_masura}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      
      <div className="mt-4 p-4 bg-gray-100 rounded">
        <p className="text-sm text-gray-600">
          Verifică consola pentru detalii complete despre fiecare query.
        </p>
      </div>
    </div>
  );
};

export default DatabaseDebugger;
