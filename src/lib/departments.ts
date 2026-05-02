import {
  ShoppingCart,
  Package,
  Boxes,
  Tag,
  Factory,
  Truck,
  ShoppingBag,
  Wrench,
  Settings,
  ShieldCheck,
  HardHat,
  type LucideIcon,
} from "lucide-react";

// Toate rolurile ne-admin recunoscute de aplicație.
// Trebuie să corespundă cu valorile din enum-ul `app_role` din Supabase.
export const DEPARTMENT_ROLES = [
  "achizitii",
  "depozit_mp",
  "depozit_ambalaje",
  "etichete",
  "productie",
  "picking_vanzari",
  "calitate",
  "mentenanta",
  "administrativ",
  "operator",
] as const;

export type DepartmentRole = (typeof DEPARTMENT_ROLES)[number];
export type AppRole = DepartmentRole | "admin";

export interface DepartmentDef {
  id: DepartmentRole;
  label: string;
  short: string;
  icon: LucideIcon;
  /** Ruta principală (hub-ul departamentului) */
  rootPath: string;
  description: string;
}

export const DEPARTMENTS: DepartmentDef[] = [
  {
    id: "achizitii",
    label: "Achiziții",
    short: "Achiziții",
    icon: ShoppingCart,
    rootPath: "/achizitii",
    description: "Comenzi furnizori, planificare aprovizionare.",
  },
  {
    id: "depozit_mp",
    label: "Depozit Materie Primă",
    short: "Depozit MP",
    icon: Package,
    rootPath: "/depozit-mp",
    description: "Stoc materii prime, recepții și transferuri.",
  },
  {
    id: "depozit_ambalaje",
    label: "Depozit Ambalaje",
    short: "Ambalaje",
    icon: Boxes,
    rootPath: "/depozit-ambalaje",
    description: "Stoc ambalaje și consum în producție.",
  },
  {
    id: "etichete",
    label: "Etichete",
    short: "Etichete",
    icon: Tag,
    rootPath: "/etichete",
    description: "Stoc etichete și gestionare loturi.",
  },
  {
    id: "productie",
    label: "Producție",
    short: "Producție",
    icon: Factory,
    rootPath: "/productie",
    description: "Stoc producție, forecast și planificare.",
  },
  {
    id: "picking_vanzari",
    label: "Picking",
    short: "Picking",
    icon: Truck,
    rootPath: "/picking",
    description: "Pregătire comenzi și expediții.",
  },
  {
    id: "picking_vanzari",
    label: "Vânzări",
    short: "Vânzări",
    icon: ShoppingBag,
    rootPath: "/vanzari",
    description: "Stoc marfă, consumuri, necesar MP, restocări, comenzi pe client.",
  },
  {
    id: "calitate",
    label: "Calitate",
    short: "Calitate",
    icon: ShieldCheck,
    rootPath: "/calitate",
    description: "Stocuri, calitate, consum pe loturi și recepții.",
  },
  {
    id: "mentenanta",
    label: "Mentenanță",
    short: "Mentenanță",
    icon: Wrench,
    rootPath: "/mentenanta",
    description: "Echipamente, intervenții și planificare.",
  },
  {
    id: "administrativ",
    label: "Administrativ",
    short: "Administrativ",
    icon: Settings,
    rootPath: "/administrativ",
    description: "Utilizatori, audit, nomenclatoare.",
  },
];
