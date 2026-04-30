
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Search } from 'lucide-react';

interface ClientSearchProps {
  searchFilters: {
    numeMagazin: string;
    zonaLivrare: string;
  };
  setSearchFilters: (filters: any) => void;
  zones: any[];
}

const ClientSearch = ({ searchFilters, setSearchFilters, zones }: ClientSearchProps) => {
  const updateFilter = (key: string, value: string) => {
    setSearchFilters(prev => ({ ...prev, [key]: value === 'all' ? '' : value }));
  };

  const clearFilters = () => {
    setSearchFilters({
      numeMagazin: '',
      zonaLivrare: ''
    });
  };

  // Filtrare robustă pentru zone
  const validZones = React.useMemo(() => {
    if (!Array.isArray(zones)) {
      return [];
    }
    
    return zones.filter(zone => {
      return zone && 
             zone.id && 
             String(zone.id).trim() !== '' && 
             zone.nume_zona && 
             typeof zone.nume_zona === 'string' && 
             zone.nume_zona.trim() !== '';
    }).map(zone => ({
      ...zone,
      safeValue: `zone-${zone.id}`
    }));
  }, [zones]);

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Search className="h-4 w-4" />
          <h3 className="font-semibold">Căutare și Filtrare Clienți</h3>
          <button 
            onClick={clearFilters}
            className="ml-auto text-sm text-blue-600 hover:text-blue-800"
          >
            Resetează filtrele
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nume Magazin</Label>
            <Input
              placeholder="Caută după nume magazin..."
              value={searchFilters.numeMagazin}
              onChange={(e) => updateFilter('numeMagazin', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Zona de Livrare</Label>
            <Select value={searchFilters.zonaLivrare || 'all'} onValueChange={(value) => updateFilter('zonaLivrare', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Toate zonele" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate zonele</SelectItem>
                {validZones.map((zone) => (
                  <SelectItem key={zone.safeValue} value={zone.safeValue}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: zone.culoare || '#10b981' }}
                      />
                      {zone.nume_zona}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ClientSearch;
