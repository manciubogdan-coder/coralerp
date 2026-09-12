import React, { createContext, useContext, useMemo } from "react";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Languages, Check } from "lucide-react";

export type OperatorLang = "ro" | "en" | "ne" | "hu";

export const OPERATOR_LANGS: { code: OperatorLang; label: string; flag: string }[] = [
  { code: "ro", label: "Română", flag: "🇷🇴" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "ne", label: "नेपाली", flag: "🇳🇵" },
  { code: "hu", label: "Magyar", flag: "🇭🇺" },
];

type Dict = Record<string, string>;

const ro: Dict = {
  operator: "Operator",
  backToPanel: "Înapoi la panou",
  operatorInterface: "Interfața Operatorului",
  selectLine: "Selectează o linie de producție pentru a continua",
  lineNoName: "Linie fără nume",
  active: "Activă",
  status: "Status",
  inProduction: "În producție",
  available: "Disponibilă",
  toDo: "De lucrat",
  ordersCount: "comenzi",
  noOrder: "Nicio comandă",
  pieces: "Bucăți",
  pcs: "buc",
  estimatedTime: "Timp estimat",
  noCapacityShort: "Fără cap.",
  noCapacity: "Fără capacitate",
  productivity: "Productivitate",
  accessLine: "Accesează Linia",
  backToLines: "Înapoi la linii",
  backToOrders: "Înapoi la comenzi",
  ordersFor: "Comenzi pentru",
  deliveryOrder: "ordinea livrării",
  totalToProduce: "Total de produs",
  noTargetDate: "Comenzile fără dată țintă apar la „Azi”.",
  viewMode: "Vizualizare",
  individual: "Individual",
  groupedByProduct: "Grupat pe produs",
  noOrdersForLine: "Nu există comenzi pentru această linie",
  sessionManagement: "Gestionare Sesiune",
  orderProgress: "Progres Comandă",
  product: "Produs",
  store: "Magazin",
  deliveryPoint: "Punct Livrare",
  unit: "Unitate",
  departure: "Plecare",
  notSpecified: "Nu specificat",
  priority: "Prioritate",
  complete: "complet",
  producedEffective: "Produs efectiv",
  fromRestock: "Din restocări",
  stillToProduce: "Mai trebuie produs",
  remaining: "Mai rămâne",
  fromStock: "Din stoc",
  exactQuantity: "Cantitate exactă ✓",
  productionNotStarted: "Nu s-a început producția",
  createdDate: "Data creării",
  productionDate: "Data producției",
  notSet: "Nestabilită",
  observations: "Observații",
  noObservations: "Fără observații",
  activeSession: "Sesiune Activă - În Desfășurare",
  operators: "Operatori",
  startedAt: "Pornită la",
  producedQtyThisSession: "Cantitate Produsă în această sesiune",
  enterProducedQty: "Introduceți cantitatea produsă",
  finishSession: "Finalizare Sesiune",
  autoDetectHint:
    "Sistemul detectează automat dacă comanda e completă sau parțială pe baza cantităților introduse.",
  startNewSession: "Pornire Sesiune Nouă",
  operatorName: "Numele operatorului",
  addOperator: "+ Adaugă operator",
  startSession: "Pornire Sesiune",
  error: "Eroare",
  errNoOperator: "Te rog completează cel puțin un nume de operator.",
  sessionStarted: "Sesiune pornită",
  sessionStartedFor: "Sesiunea a fost pornită pentru comanda",
  errStartSession: "Nu s-a putut porni sesiunea.",
  errFinishSession: "Nu s-a putut finaliza sesiunea.",
  confirmZero:
    "Ai introdus 0 bucăți produse. Ești sigur că vrei să finalizezi sesiunea fără producție?",
  confirmZeroGroup: "Ai introdus 0 bucăți produse pentru tot grupul. Continui?",
  sessionDoneFull: "✅ Sesiune finalizată complet",
  sessionDonePartial: "⚠️ Sesiune finalizată parțial",
  producedThisSession: "buc produse în această sesiune.",
  remainsToProduce: "Mai rămân de produs",
  orderFullyCovered: "Comanda este acoperită integral.",
  sessionsStarted: "Sesiuni pornite",
  sessionsStartedCount: "S-au pornit {n} sesiuni pentru grup.",
  errFillOperator: "Completează cel puțin un operator.",
  noActiveSession: "Nicio sesiune activă",
  noActiveSessionDesc: "Grupul nu are sesiuni active de finalizat.",
  groupFinished: "Grup finalizat",
  groupDistributed: "Distribuit {q} buc pe {n} comenzi.",
  language: "Limba",
};

const en: Dict = {
  operator: "Operator",
  backToPanel: "Back to panel",
  operatorInterface: "Operator Interface",
  selectLine: "Select a production line to continue",
  lineNoName: "Unnamed line",
  active: "Active",
  status: "Status",
  inProduction: "In production",
  available: "Available",
  toDo: "To do",
  ordersCount: "orders",
  noOrder: "No orders",
  pieces: "Pieces",
  pcs: "pcs",
  estimatedTime: "Estimated time",
  noCapacityShort: "No cap.",
  noCapacity: "No capacity",
  productivity: "Productivity",
  accessLine: "Open line",
  backToLines: "Back to lines",
  backToOrders: "Back to orders",
  ordersFor: "Orders for",
  deliveryOrder: "delivery order",
  totalToProduce: "Total to produce",
  noTargetDate: "Orders without a target date show under “Today”.",
  viewMode: "View",
  individual: "Individual",
  groupedByProduct: "Grouped by product",
  noOrdersForLine: "There are no orders for this line",
  sessionManagement: "Session management",
  orderProgress: "Order progress",
  product: "Product",
  store: "Store",
  deliveryPoint: "Delivery point",
  unit: "Unit",
  departure: "Departure",
  notSpecified: "Not specified",
  priority: "Priority",
  complete: "complete",
  producedEffective: "Actually produced",
  fromRestock: "From restock",
  stillToProduce: "Still to produce",
  remaining: "Remaining",
  fromStock: "From stock",
  exactQuantity: "Exact quantity ✓",
  productionNotStarted: "Production has not started",
  createdDate: "Created on",
  productionDate: "Production date",
  notSet: "Not set",
  observations: "Notes",
  noObservations: "No notes",
  activeSession: "Active session - In progress",
  operators: "Operators",
  startedAt: "Started at",
  producedQtyThisSession: "Quantity produced in this session",
  enterProducedQty: "Enter the produced quantity",
  finishSession: "Finish session",
  autoDetectHint:
    "The system automatically detects whether the order is complete or partial based on the entered quantities.",
  startNewSession: "Start new session",
  operatorName: "Operator name",
  addOperator: "+ Add operator",
  startSession: "Start session",
  error: "Error",
  errNoOperator: "Please enter at least one operator name.",
  sessionStarted: "Session started",
  sessionStartedFor: "The session was started for order",
  errStartSession: "The session could not be started.",
  errFinishSession: "The session could not be finished.",
  confirmZero:
    "You entered 0 pieces produced. Are you sure you want to finish the session with no production?",
  confirmZeroGroup: "You entered 0 pieces produced for the whole group. Continue?",
  sessionDoneFull: "✅ Session fully completed",
  sessionDonePartial: "⚠️ Session partially completed",
  producedThisSession: "pcs produced in this session.",
  remainsToProduce: "Still to produce",
  orderFullyCovered: "The order is fully covered.",
  sessionsStarted: "Sessions started",
  sessionsStartedCount: "{n} sessions started for the group.",
  errFillOperator: "Enter at least one operator.",
  noActiveSession: "No active session",
  noActiveSessionDesc: "The group has no active sessions to finish.",
  groupFinished: "Group finished",
  groupDistributed: "Distributed {q} pcs across {n} orders.",
  language: "Language",
};

const ne: Dict = {
  operator: "अपरेटर",
  backToPanel: "प्यानलमा फर्कनु",
  operatorInterface: "अपरेटर इन्टरफेस",
  selectLine: "जारी राख्न उत्पादन लाइन छान्नुहोस्",
  lineNoName: "नाम नभएको लाइन",
  active: "सक्रिय",
  status: "स्थिति",
  inProduction: "उत्पादनमा",
  available: "उपलब्ध",
  toDo: "गर्नुपर्ने",
  ordersCount: "अर्डर",
  noOrder: "अर्डर छैन",
  pieces: "टुक्रा",
  pcs: "पिस",
  estimatedTime: "अनुमानित समय",
  noCapacityShort: "क्षमता छैन",
  noCapacity: "क्षमता छैन",
  productivity: "उत्पादकत्व",
  accessLine: "लाइन खोल्नु",
  backToLines: "लाइनहरूमा फर्कनु",
  backToOrders: "अर्डरहरूमा फर्कनु",
  ordersFor: "अर्डरहरू —",
  deliveryOrder: "डेलिभरी क्रम",
  totalToProduce: "कुल उत्पादन गर्नुपर्ने",
  noTargetDate: "मिति नतोकिएका अर्डरहरू “आज” मा देखिन्छन्।",
  viewMode: "दृश्य",
  individual: "छुट्टाछुट्टै",
  groupedByProduct: "उत्पादन अनुसार समूह",
  noOrdersForLine: "यो लाइनको कुनै अर्डर छैन",
  sessionManagement: "सेसन व्यवस्थापन",
  orderProgress: "अर्डर प्रगति",
  product: "उत्पादन",
  store: "स्टोर",
  deliveryPoint: "डेलिभरी स्थान",
  unit: "एकाइ",
  departure: "प्रस्थान",
  notSpecified: "तोकिएको छैन",
  priority: "प्राथमिकता",
  complete: "पूरा",
  producedEffective: "वास्तविक उत्पादन",
  fromRestock: "रिस्टकबाट",
  stillToProduce: "अझै उत्पादन गर्नुपर्ने",
  remaining: "बाँकी",
  fromStock: "स्टकबाट",
  exactQuantity: "सही परिमाण ✓",
  productionNotStarted: "उत्पादन सुरु भएको छैन",
  createdDate: "बनाइएको मिति",
  productionDate: "उत्पादन मिति",
  notSet: "तोकिएको छैन",
  observations: "टिप्पणी",
  noObservations: "टिप्पणी छैन",
  activeSession: "सक्रिय सेसन - चलिरहेको",
  operators: "अपरेटरहरू",
  startedAt: "सुरु भयो",
  producedQtyThisSession: "यो सेसनमा उत्पादित परिमाण",
  enterProducedQty: "उत्पादित परिमाण लेख्नुहोस्",
  finishSession: "सेसन समाप्त गर्नु",
  autoDetectHint:
    "प्रविष्ट परिमाणको आधारमा अर्डर पूरा वा आंशिक भएको प्रणालीले स्वतः पत्ता लगाउँछ।",
  startNewSession: "नयाँ सेसन सुरु गर्नु",
  operatorName: "अपरेटरको नाम",
  addOperator: "+ अपरेटर थप्नु",
  startSession: "सेसन सुरु गर्नु",
  error: "त्रुटि",
  errNoOperator: "कृपया कम्तीमा एक अपरेटरको नाम लेख्नुहोस्।",
  sessionStarted: "सेसन सुरु भयो",
  sessionStartedFor: "यो अर्डरको लागि सेसन सुरु भयो:",
  errStartSession: "सेसन सुरु गर्न सकिएन।",
  errFinishSession: "सेसन समाप्त गर्न सकिएन।",
  confirmZero:
    "तपाईंले ० पिस उत्पादन लेख्नुभयो। उत्पादन बिना सेसन समाप्त गर्ने पक्का हो?",
  confirmZeroGroup: "तपाईंले सम्पूर्ण समूहको लागि ० पिस लेख्नुभयो। जारी राख्ने?",
  sessionDoneFull: "✅ सेसन पूर्ण रूपमा समाप्त",
  sessionDonePartial: "⚠️ सेसन आंशिक रूपमा समाप्त",
  producedThisSession: "पिस यो सेसनमा उत्पादन भयो।",
  remainsToProduce: "अझै उत्पादन गर्नुपर्ने",
  orderFullyCovered: "अर्डर पूर्ण रूपमा पूरा भयो।",
  sessionsStarted: "सेसनहरू सुरु भए",
  sessionsStartedCount: "समूहको लागि {n} सेसन सुरु भए।",
  errFillOperator: "कम्तीमा एक अपरेटर लेख्नुहोस्।",
  noActiveSession: "सक्रिय सेसन छैन",
  noActiveSessionDesc: "समूहमा समाप्त गर्न कुनै सक्रिय सेसन छैन।",
  groupFinished: "समूह समाप्त",
  groupDistributed: "{q} पिस {n} अर्डरमा बाँडियो।",
  language: "भाषा",
};

const hu: Dict = {
  operator: "Operátor",
  backToPanel: "Vissza a panelhez",
  operatorInterface: "Operátori felület",
  selectLine: "Válassz gyártósort a folytatáshoz",
  lineNoName: "Névtelen sor",
  active: "Aktív",
  status: "Állapot",
  inProduction: "Gyártásban",
  available: "Szabad",
  toDo: "Elvégzendő",
  ordersCount: "rendelés",
  noOrder: "Nincs rendelés",
  pieces: "Darab",
  pcs: "db",
  estimatedTime: "Becsült idő",
  noCapacityShort: "Nincs kap.",
  noCapacity: "Nincs kapacitás",
  productivity: "Termelékenység",
  accessLine: "Sor megnyitása",
  backToLines: "Vissza a sorokhoz",
  backToOrders: "Vissza a rendelésekhez",
  ordersFor: "Rendelések —",
  deliveryOrder: "kiszállítási sorrend",
  totalToProduce: "Összes gyártandó",
  noTargetDate: "A céldátum nélküli rendelések a „Ma” alatt jelennek meg.",
  viewMode: "Nézet",
  individual: "Egyenként",
  groupedByProduct: "Termék szerint csoportosítva",
  noOrdersForLine: "Ehhez a sorhoz nincs rendelés",
  sessionManagement: "Munkamenet kezelése",
  orderProgress: "Rendelés előrehaladása",
  product: "Termék",
  store: "Üzlet",
  deliveryPoint: "Kiszállítási pont",
  unit: "Egység",
  departure: "Indulás",
  notSpecified: "Nincs megadva",
  priority: "Prioritás",
  complete: "kész",
  producedEffective: "Tényleges gyártás",
  fromRestock: "Készletről",
  stillToProduce: "Még gyártandó",
  remaining: "Hátralévő",
  fromStock: "Raktárról",
  exactQuantity: "Pontos mennyiség ✓",
  productionNotStarted: "A gyártás nem indult el",
  createdDate: "Létrehozva",
  productionDate: "Gyártás dátuma",
  notSet: "Nincs megadva",
  observations: "Megjegyzések",
  noObservations: "Nincs megjegyzés",
  activeSession: "Aktív munkamenet - folyamatban",
  operators: "Operátorok",
  startedAt: "Indítva",
  producedQtyThisSession: "Ebben a munkamenetben gyártott mennyiség",
  enterProducedQty: "Add meg a gyártott mennyiséget",
  finishSession: "Munkamenet befejezése",
  autoDetectHint:
    "A rendszer a megadott mennyiségek alapján automatikusan felismeri, hogy a rendelés teljes vagy részleges.",
  startNewSession: "Új munkamenet indítása",
  operatorName: "Operátor neve",
  addOperator: "+ Operátor hozzáadása",
  startSession: "Munkamenet indítása",
  error: "Hiba",
  errNoOperator: "Adj meg legalább egy operátor nevet.",
  sessionStarted: "Munkamenet elindítva",
  sessionStartedFor: "A munkamenet elindult a rendeléshez:",
  errStartSession: "A munkamenetet nem lehetett elindítani.",
  errFinishSession: "A munkamenetet nem lehetett befejezni.",
  confirmZero:
    "0 gyártott darabot adtál meg. Biztosan befejezed a munkamenetet gyártás nélkül?",
  confirmZeroGroup: "0 darabot adtál meg az egész csoportra. Folytatod?",
  sessionDoneFull: "✅ Munkamenet teljesen befejezve",
  sessionDonePartial: "⚠️ Munkamenet részlegesen befejezve",
  producedThisSession: "db gyártva ebben a munkamenetben.",
  remainsToProduce: "Még gyártandó",
  orderFullyCovered: "A rendelés teljesen teljesítve.",
  sessionsStarted: "Munkamenetek elindítva",
  sessionsStartedCount: "{n} munkamenet indult el a csoporthoz.",
  errFillOperator: "Adj meg legalább egy operátort.",
  noActiveSession: "Nincs aktív munkamenet",
  noActiveSessionDesc: "A csoportnak nincs befejezhető aktív munkamenete.",
  groupFinished: "Csoport befejezve",
  groupDistributed: "{q} db elosztva {n} rendelésre.",
  language: "Nyelv",
};

const DICTS: Record<OperatorLang, Dict> = { ro, en, ne, hu };

type Ctx = {
  lang: OperatorLang;
  setLang: (l: OperatorLang) => void;
  t: (key: keyof typeof ro | string, vars?: Record<string, string | number>) => string;
};

const OperatorI18nContext = createContext<Ctx | undefined>(undefined);

export const OperatorI18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = usePersistentState<OperatorLang>("operator-lang", "ro");

  const value = useMemo<Ctx>(() => {
    const dict = DICTS[lang] || ro;
    return {
      lang,
      setLang,
      t: (key, vars) => {
        let out = dict[key as string] ?? ro[key as string] ?? String(key);
        if (vars) {
          for (const [k, v] of Object.entries(vars)) {
            out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
          }
        }
        return out;
      },
    };
  }, [lang, setLang]);

  return <OperatorI18nContext.Provider value={value}>{children}</OperatorI18nContext.Provider>;
};

export const useOperatorT = (): Ctx => {
  const ctx = useContext(OperatorI18nContext);
  if (!ctx) {
    return {
      lang: "ro",
      setLang: () => {},
      t: (key, vars) => {
        let out = ro[key as string] ?? String(key);
        if (vars) {
          for (const [k, v] of Object.entries(vars)) {
            out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
          }
        }
        return out;
      },
    };
  }
  return ctx;
};

export const OperatorLanguageSelector: React.FC<{ className?: string }> = ({ className }) => {
  const { lang, setLang } = useOperatorT();
  const current = OPERATOR_LANGS.find((l) => l.code === lang) || OPERATOR_LANGS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <Languages className="h-4 w-4 mr-2" />
          <span className="mr-1">{current.flag}</span>
          <span className="hidden sm:inline">{current.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {OPERATOR_LANGS.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => setLang(l.code)}
            className="cursor-pointer flex items-center gap-2"
          >
            <span>{l.flag}</span>
            <span className="flex-1">{l.label}</span>
            {l.code === lang && <Check className="h-4 w-4 text-coral-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
