import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown } from "lucide-react";

type Product = { id: string; nume: string };

// Lista de produse se construiește doar când se deschide (sute de produse × zeci de rânduri
// blocau pagina când fiecare rând avea lista completă încărcată).
const AvansProductPicker = ({
  value, label, products, groupOf, onPick,
}: {
  value: string | null;
  label: string;
  products: Product[];
  groupOf: (id: string, nume: string) => string;
  onPick: (p: Product) => void;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          <span className="truncate">{label || "Alege produs"}</span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      {open && (
        <PopoverContent className="w-[420px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Caută produs sau grupă..." />
            <CommandList className="max-h-72 overflow-y-auto">
              <CommandEmpty>Niciun produs găsit.</CommandEmpty>
              {products.map((p) => {
                const g = groupOf(p.id, p.nume);
                return (
                  <CommandItem
                    key={p.id}
                    value={`${p.nume} ${g} ${p.id}`}
                    onSelect={() => { onPick(p); setOpen(false); }}
                    className={p.id === value ? "font-semibold" : ""}
                  >
                    <div className="flex flex-col">
                      <span>{p.nume}</span>
                      {g !== p.nume.trim() && <span className="text-xs text-muted-foreground">Grupa: {g}</span>}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandList>
          </Command>
        </PopoverContent>
      )}
    </Popover>
  );
};

export default AvansProductPicker;
