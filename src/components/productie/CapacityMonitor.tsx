import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useOrders, useProductionLines, useDeliveryZones } from '@/hooks/useProductionData';
import { useShifts, calculateShiftDuration, getCurrentShift } from '@/hooks/useShifts';
import { AlertTriangle, Clock, Truck, CheckCircle, XCircle } from 'lucide-react';

interface CapacityAnalysis {
  zona: any;
  totalCantitate: number;
  capacitateNecesara: number;
  capacitateDisponibila: number;
  capacitateOraZona: number;
  oraLimitaPlecare: string;
  timpRamasOre: number;
  oreLucruDisponibile: number;
  status: 'ok' | 'warning' | 'critical';
  comenziAfectate: any[];
  detaliiLinii: Array<{
    linieId: string;
    numeLinie: string;
    comenziPeLinie: any[];
    capacitateLinie: number;
    oreNecesareLinie: number;
  }>;
}

const CapacityMonitor = () => {
  const { data: orders = [] } = useOrders();
  const { data: lines = [] } = useProductionLines();
  const { data: zones = [] } = useDeliveryZones();
  const { data: shifts = [] } = useShifts();

  const currentShift = getCurrentShift(shifts);

  const capacityAnalysis = useMemo((): CapacityAnalysis[] => {
    const activeOrders = orders.filter(order => 
      order.status === 'pending' || order.status === 'assigned' || order.status === 'in_progress'
    );

    // Folosim fusul orar al României
    const now = new Date();
    const romaniaTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Bucharest"}));
    
    const liniiActive = lines.filter(line => line.status === 'activa');

    // Calculăm orele de lucru disponibile pentru o anumită oră limită
    const calculateWorkingHours = (oraLimita: string): number => {
      const [oreLimita, minuteLimita] = oraLimita.split(':').map(Number);
      
      // Creăm data limită în fusul orar al României
      const dataLimita = new Date(romaniaTime);
      dataLimita.setHours(oreLimita, minuteLimita, 0, 0);

      // Dacă ora limită este în trecut pentru astăzi, presupunem că este mâine
      if (dataLimita <= romaniaTime) {
        dataLimita.setDate(dataLimita.getDate() + 1);
      }

      console.log(`Calculez ore lucru pentru ora limită ${oraLimita}:`);
      console.log(`Ora curentă România: ${romaniaTime.toLocaleString()}`);
      console.log(`Ora limită: ${dataLimita.toLocaleString()}`);

      // Dacă nu avem schimburi definite, presupunem program normal 8 ore/zi
      if (shifts.length === 0) {
        const timpRamasMs = dataLimita.getTime() - romaniaTime.getTime();
        const timpRamasOre = Math.max(0, timpRamasMs / (1000 * 60 * 60));
        return Math.min(timpRamasOre, 8);
      }

      let oreLucruDisponibile = 0;
      const acum = romaniaTime.getTime();
      const limitaTime = dataLimita.getTime();
      
      // Procesăm doar schimburile cu durate normale (max 12 ore)
      const schimburiValide = shifts.filter(shift => {
        const durata = calculateShiftDuration(shift.ora_start, shift.ora_sfarsit);
        // Considerăm valide doar schimburile cu durată rezonabilă
        return durata > 0 && durata <= 12;
      });

      console.log(`Schimburi valide găsite: ${schimburiValide.length}`);
      
      // Pentru fiecare schimb valid
      for (const shift of schimburiValide) {
        const [oreStart, minuteStart] = shift.ora_start.split(':').map(Number);
        const [oreSfarsit, minuteSfarsit] = shift.ora_sfarsit.split(':').map(Number);
        
        console.log(`Verific schimbul ${shift.nume}: ${shift.ora_start} - ${shift.ora_sfarsit}`);
        
        const durataSchimb = calculateShiftDuration(shift.ora_start, shift.ora_sfarsit);
        console.log(`Durata schimb: ${durataSchimb}h`);
        
        // Calculăm pentru astăzi
        let startSchimb = new Date(romaniaTime);
        startSchimb.setHours(oreStart, minuteStart, 0, 0);
        
        let endSchimb = new Date(romaniaTime);
        endSchimb.setHours(oreSfarsit, minuteSfarsit, 0, 0);
        
        // Dacă sfârșitul este înainte de început, schimbul se termină mâine
        if (endSchimb <= startSchimb) {
          endSchimb.setDate(endSchimb.getDate() + 1);
        }
        
        // Verificăm intersecția cu intervalul [acum, ora_limita]
        const intervalStart = Math.max(startSchimb.getTime(), acum);
        const intervalEnd = Math.min(endSchimb.getTime(), limitaTime);
        
        if (intervalEnd > intervalStart) {
          const oreSuprapuse = (intervalEnd - intervalStart) / (1000 * 60 * 60);
          
          // Aplicăm pauza doar pentru schimburi >= 8 ore
          const oreFaraPauza = durataSchimb >= 8 ? Math.max(0, durataSchimb - 1) : durataSchimb;
          
          // Calculăm proporția efectivă
          const proportieEfectiva = durataSchimb > 0 ? oreFaraPauza / durataSchimb : 0;
          const oreLucruEfective = oreSuprapuse * proportieEfectiva;
          
          oreLucruDisponibile += oreLucruEfective;
          
          console.log(`Schimbul ${shift.nume}:`);
          console.log(`- Ore suprapuse: ${oreSuprapuse.toFixed(2)}h`);
          console.log(`- Ore lucru efective adăugate: ${oreLucruEfective.toFixed(2)}h`);
        }
        
        // Verificăm și pentru mâine dacă ora limită se întinde
        if (limitaTime > new Date(romaniaTime.getTime() + 24 * 60 * 60 * 1000).setHours(0, 0, 0, 0)) {
          let startSchimbMaine = new Date(startSchimb);
          startSchimbMaine.setDate(startSchimbMaine.getDate() + 1);
          
          let endSchimbMaine = new Date(endSchimb);
          if (endSchimb.getTime() <= startSchimb.getTime()) {
            // Schimbul se termină în ziua următoare, endSchimbMaine e deja corect
          } else {
            endSchimbMaine.setDate(endSchimbMaine.getDate() + 1);
          }
          
          const intervalStartMaine = Math.max(startSchimbMaine.getTime(), acum);
          const intervalEndMaine = Math.min(endSchimbMaine.getTime(), limitaTime);
          
          if (intervalEndMaine > intervalStartMaine) {
            const oreSuprapuseMaine = (intervalEndMaine - intervalStartMaine) / (1000 * 60 * 60);
            const oreFaraPauzaMaine = durataSchimb >= 8 ? Math.max(0, durataSchimb - 1) : durataSchimb;
            const proportieEfectivaMaine = durataSchimb > 0 ? oreFaraPauzaMaine / durataSchimb : 0;
            const oreLucruEfectiveMaine = oreSuprapuseMaine * proportieEfectivaMaine;
            
            oreLucruDisponibile += oreLucruEfectiveMaine;
            
            console.log(`Schimbul ${shift.nume} (mâine):`);
            console.log(`- Ore suprapuse: ${oreSuprapuseMaine.toFixed(2)}h`);
            console.log(`- Ore lucru efective adăugate: ${oreLucruEfectiveMaine.toFixed(2)}h`);
          }
        }
      }
      
      console.log(`Total ore lucru disponibile pentru ${oraLimita}: ${oreLucruDisponibile.toFixed(2)}h`);
      return Math.max(0, oreLucruDisponibile);
    };

    return zones.map(zona => {
      // Găsește comenzile pentru această zonă
      const zoneOrders = activeOrders.filter(order => 
        order.productie_clienti?.zona_livrare_id === zona.id
      );

      // Dacă nu sunt comenzi pentru zonă, afișăm 0 ore de lucru efective
      if (zoneOrders.length === 0) {
        return {
          zona,
          totalCantitate: 0,
          capacitateNecesara: 0,
          capacitateDisponibila: 0,
          capacitateOraZona: 0,
          oraLimitaPlecare: zona.ora_limita_plecare || '19:00',
          timpRamasOre: 0,
          oreLucruDisponibile: 0, // 0 pentru zone fără comenzi
          status: 'ok' as const,
          comenziAfectate: [],
          detaliiLinii: []
        };
      }

      // Calculează cantitatea totală necesară
      const totalCantitate = zoneOrders.reduce((sum, order) => sum + order.cantitate, 0);

      const oraLimitaPlecare = zona.ora_limita_plecare || '19:00';
      const oreLucruDisponibile = calculateWorkingHours(oraLimitaPlecare);

      // Grupăm comenzile pe linii pentru calculul corect al timpului necesar
      const comenziPeLinii = new Map();
      zoneOrders.forEach(order => {
        const linieId = order.linie_id;
        if (linieId) {
          if (!comenziPeLinii.has(linieId)) {
            comenziPeLinii.set(linieId, []);
          }
          comenziPeLinii.get(linieId).push(order);
        }
      });

      // Calculăm detaliile pentru fiecare linie
      const detaliiLinii = Array.from(comenziPeLinii.entries()).map(([linieId, comenziLinie]) => {
        const linie = liniiActive.find(l => l.id === linieId);
        const capacitateLinie = linie ? linie.capacitate_ora : 0;
        const cantitateTotateLinie = comenziLinie.reduce((sum, order) => sum + order.cantitate, 0);
        const oreNecesareLinie = capacitateLinie > 0 ? cantitateTotateLinie / capacitateLinie : 0;

        return {
          linieId,
          numeLinie: linie?.nume || 'Linie necunoscută',
          comenziPeLinie: comenziLinie,
          capacitateLinie,
          oreNecesareLinie
        };
      });

      // Calculăm capacitatea totală pentru zonă (suma capacităților liniilor alocate)
      let capacitateOraZona = 0;
      detaliiLinii.forEach(detaliu => {
        capacitateOraZona += detaliu.capacitateLinie;
      });

      // Dacă nu sunt linii alocate și avem comenzi, distribuim capacitatea disponibilă
      if (capacitateOraZona === 0 && zoneOrders.length > 0) {
        const capacitateTotala = liniiActive.reduce((sum, line) => sum + line.capacitate_ora, 0);
        const zoneActiveCuComenzi = zones.filter(z => 
          activeOrders.some(order => order.productie_clienti?.zona_livrare_id === z.id)
        ).length;
        capacitateOraZona = zoneActiveCuComenzi > 0 ? capacitateTotala / zoneActiveCuComenzi : 0;
      }

      // Calculează capacitatea disponibilă (capacitate zonă * ore lucru disponibile)
      const capacitateDisponibila = capacitateOraZona * oreLucruDisponibile;

      // Pentru calculul orelor necesare:
      // - Pe aceeași linie: timpul se ADUNĂ (secvențial)
      // - Pe linii diferite: se ia MAXIMUL (paralel)
      const oreNecesareMaxime = detaliiLinii.length > 0 
        ? Math.max(...detaliiLinii.map(d => d.oreNecesareLinie))
        : (capacitateOraZona > 0 ? totalCantitate / capacitateOraZona : 0);

      // Determină statusul
      let status: 'ok' | 'warning' | 'critical' = 'ok';
      if (oreNecesareMaxime > oreLucruDisponibile) {
        status = 'critical';
      } else if (oreNecesareMaxime > oreLucruDisponibile * 0.8) {
        status = 'warning';
      }

      const [oreLimita, minuteLimita] = oraLimitaPlecare.split(':').map(Number);
      const dataLimita = new Date(romaniaTime);
      dataLimita.setHours(oreLimita, minuteLimita, 0, 0);
      if (dataLimita <= romaniaTime) {
        dataLimita.setDate(dataLimita.getDate() + 1);
      }
      const timpRamasMs = dataLimita.getTime() - romaniaTime.getTime();
      const timpRamasOre = Math.max(0, timpRamasMs / (1000 * 60 * 60));

      return {
        zona,
        totalCantitate,
        capacitateNecesara: oreNecesareMaxime,
        capacitateDisponibila,
        capacitateOraZona,
        oraLimitaPlecare,
        timpRamasOre,
        oreLucruDisponibile,
        status,
        comenziAfectate: zoneOrders,
        detaliiLinii
      };
    });
  }, [orders, lines, zones, shifts]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok': return 'text-green-600 bg-green-50 border-green-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'critical': return <XCircle className="h-5 w-5 text-red-600" />;
      default: return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ok': return 'În regulă';
      case 'warning': return 'Atenție';
      case 'critical': return 'Depășire capacitate';
      default: return 'Necunoscut';
    }
  };

  const criticalZones = capacityAnalysis.filter(analysis => analysis.status === 'critical');
  const warningZones = capacityAnalysis.filter(analysis => analysis.status === 'warning');

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold mb-2">Monitor Capacitate Producție</h3>
        <p className="text-gray-600">
          Monitorizează capacitatea de producție pentru fiecare zonă de livrare, ținând cont de schimburile de lucru și pauzele
        </p>
        {currentShift && (
          <Badge variant="outline" className="mt-2">
            Schimbul curent: {currentShift.nume} ({currentShift.ora_start} - {currentShift.ora_sfarsit})
          </Badge>
        )}
      </div>

      {/* Alerte critice */}
      {criticalZones.length > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <XCircle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800">
            Depășire capacitate critică!
          </AlertTitle>
          <AlertDescription className="text-red-700">
            {criticalZones.length} zone au capacitatea depășită. Este necesară reprogramarea comenzilor.
          </AlertDescription>
        </Alert>
      )}

      {/* Alerte de atenționare */}
      {warningZones.length > 0 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800">
            Capacitate aproape de limită
          </AlertTitle>
          <AlertDescription className="text-yellow-700">
            {warningZones.length} zone se apropie de limita de capacitate.
          </AlertDescription>
        </Alert>
      )}

      {/* Grid cu analizele pentru fiecare zonă */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {capacityAnalysis.map((analysis) => (
          <Card key={analysis.zona.id} className={`border-2 ${getStatusColor(analysis.status)}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: analysis.zona.culoare }}
                  />
                  {analysis.zona.nume_zona}
                </CardTitle>
                {getStatusIcon(analysis.status)}
              </div>
              <Badge className={getStatusColor(analysis.status)}>
                {getStatusText(analysis.status)}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Truck className="h-4 w-4" />
                  <span>Plecare până la: <strong>{analysis.oraLimitaPlecare}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4" />
                  <span>Timp total rămas: <strong>{analysis.timpRamasOre.toFixed(1)}h</strong></span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4" />
                  <span>Ore lucru efective: <strong>{analysis.oreLucruDisponibile.toFixed(1)}h</strong></span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm">
                  <div className="flex justify-between">
                    <span>Cantitate totală:</span>
                    <span className="font-medium">{analysis.totalCantitate} buc</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Capacitate/oră zonă:</span>
                    <span className="font-medium">{Math.round(analysis.capacitateOraZona)} buc/h</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ore necesare (max pe linie):</span>
                    <span className="font-medium">{analysis.capacitateNecesara.toFixed(1)}h</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Capacitate disponibilă:</span>
                    <span className="font-medium">{Math.round(analysis.capacitateDisponibila)} buc</span>
                  </div>
                </div>

                {/* Bara de progres */}
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      analysis.status === 'critical' ? 'bg-red-500' :
                      analysis.status === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ 
                      width: `${Math.min(100, (analysis.capacitateNecesara / Math.max(analysis.oreLucruDisponibile, 0.1)) * 100)}%` 
                    }}
                  />
                </div>
                <div className="text-xs text-gray-600">
                  {analysis.oreLucruDisponibile > 0 ? 
                    `${((analysis.capacitateNecesara / analysis.oreLucruDisponibile) * 100).toFixed(1)}% din timpul de lucru efectiv` :
                    'Fără timp de lucru disponibil'
                  }
                </div>
              </div>

              {/* Detalii linii */}
              {analysis.detaliiLinii.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Detalii linii:</div>
                  {analysis.detaliiLinii.map((detaliu, index) => (
                    <div key={index} className="text-xs bg-gray-50 p-2 rounded">
                      <div className="font-medium">{detaliu.numeLinie}</div>
                      <div>Comenzi: {detaliu.comenziPeLinie.length}</div>
                      <div>Capacitate: {detaliu.capacitateLinie} buc/h</div>
                      <div>Ore necesare: {detaliu.oreNecesareLinie.toFixed(1)}h</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-sm">
                <div className="flex justify-between">
                  <span>Comenzi active:</span>
                  <span className="font-medium">{analysis.comenziAfectate.length}</span>
                </div>
              </div>

              {analysis.status === 'critical' && (
                <div className="mt-3 p-2 bg-red-100 rounded text-xs text-red-800">
                  <strong>Acțiune necesară:</strong> Lipsa de {(analysis.capacitateNecesara - analysis.oreLucruDisponibile).toFixed(1)}h sau {Math.ceil((analysis.totalCantitate - analysis.capacitateDisponibila))} bucăți
                </div>
              )}

              {analysis.status === 'warning' && (
                <div className="mt-3 p-2 bg-yellow-100 rounded text-xs text-yellow-800">
                  <strong>Recomandare:</strong> Monitorizează îndeaproape această zonă
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {capacityAnalysis.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Truck className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold mb-2">Nu există zone configurate</h3>
            <p className="text-gray-600">Configurează zone de livrare pentru a monitiza capacitatea.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CapacityMonitor;
