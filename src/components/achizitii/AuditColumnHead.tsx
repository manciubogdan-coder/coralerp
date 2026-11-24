import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TableHead } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const explanations: Record<string, string> = {
  Ingredient: 'Materia primă cumpărată. Rândul adună facturile acestui ingredient din perioada aleasă; dedesubt găsești fiecare rând de factură.',
  Produs: 'Denumirea produsului de pe factura din Senior.',
  Furnizor: 'Firma de la care ai cumpărat efectiv marfa, nu furnizorul pe care îl recomandă comparația.',
  Data: 'Ziua facturii din Senior. La această dată căutăm lista de prețuri valabilă a fiecărui furnizor.',
  Factură: 'Tipul și numărul documentului din Senior, ca să poți verifica exact de unde vine suma.',
  Cantitate: 'Cantitatea facturată în perioada aleasă. Pe factura desfăcută vezi și unitatea (kg sau buc). Stornările scad cantitatea.',
  'Valoare facturată (€)': 'Cât valorează marfa pe facturile din Senior, nu dovada că ai achitat factura. Exemplu: 1.000 kg × 2,30 €/kg = 2.300 €. Facturile în lei sunt convertite la cursul BNR al zilei.',
  'Facturat peste listă (€)': 'Diferența față de prețul promis de furnizorul de la care ai cumpărat, înmulțită cu cantitatea. Exemplu: lista lui spune 2 €/kg, factura 2,30 €/kg; la 1.000 kg rezultă +300 €. Minus înseamnă facturat mai ieftin. Nu demonstrează singur că furnizorul a schimbat prețul intenționat.',
  'Furnizor mai scump (€)': 'Diferența dintre prețul din lista furnizorului ales și cel mai mic preț valabil din celelalte liste. Exemplu: ales 2 €/kg, cel mai ieftin 1,70 €/kg; la 1.000 kg diferența este +300 €. Nu știm dacă furnizorul ieftin avea marfă sau dacă alegerea a fost justificată.',
  'Diferență totală (€)': 'Cât a costat marfa facturată față de aceeași cantitate la cel mai mic preț valabil. Exemplu: facturat 2,30 €/kg, minim 1,70 €/kg, 1.000 kg → +600 €. Cu liste complete: +300 € peste lista furnizorului +300 € din furnizorul mai scump. Minus înseamnă economie.',
  'Rânduri de verificat': 'Numărul de rânduri de factură cu preț peste listă sau fără un preț de comparație cunoscut. Nu este numărul de facturi și nu include automat toate alegerile de furnizori mai scumpi.',
  'Preț facturat (€/UM)': 'Prețul unei unități (kg sau bucată) de pe factura din Senior, exprimat în euro. Nu este costul întregii cantități.',
  'Preț din listă (€/UM)': 'Prețul promis de furnizorul ales în lista valabilă în ziua facturii. Liniuța înseamnă că nu avem un preț valabil; nu înseamnă zero.',
  'Cel mai ieftin (€/UM)': 'Cel mai mic preț pentru acest ingredient dintre listele valabile în ziua facturii, cu numele furnizorului. Nu include disponibilitatea mărfii, calitatea sau diferențe de transport.',
  'Lista valabilă': 'Intervalul listei folosite pentru furnizorul ales. Prima și ultima zi sunt incluse. De exemplu: 5 ianuarie–12 martie; lista următoare poate începe pe 13 martie.',
  Stare: 'Preț respectat, peste listă, sub listă sau lipsă de informații. Fără listă valabilă nu putem verifica respectarea prețului.',
};

export function AuditColumnHead({ label, right = false }: { label: string; right?: boolean }) {
  return <TableHead className="sticky top-0 z-10 bg-background align-middle">
    <Popover><PopoverTrigger asChild>
      <Button variant="ghost" size="sm" className={`h-auto min-h-10 w-full whitespace-normal px-0 py-2 text-xs ${right ? 'justify-end text-right' : 'justify-start text-left'}`}>
        {label}<Info className="ml-1 h-3 w-3 shrink-0" />
      </Button>
    </PopoverTrigger><PopoverContent className="w-80 max-w-[calc(100vw-2rem)] text-sm" role="dialog" aria-label={label}>
      <p className="mb-2 font-semibold">{label}</p><p>{explanations[label] ?? `Preț convenit cu ${label}, în euro pe unitatea produsului.`}</p>
    </PopoverContent></Popover>
  </TableHead>;
}