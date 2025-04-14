
import React from "react";
import { useNavigate } from "react-router-dom";
import { Package, ShoppingCart, Users, Boxes, BarChart4 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DashboardMenuItem, { DashboardMenuItem as DashboardMenuItemType } from "@/components/DashboardMenuItem";

const Dashboard = () => {
  const navigate = useNavigate();

  const menuItems: DashboardMenuItemType[] = [
    {
      id: "inventory",
      name: "Stoc Depozit",
      icon: Package,
      route: "/dashboard/inventory",
      description: "Gestionați stocul curent de produse."
    },
    {
      id: "inventory-overview",
      name: "Vizualizare Simplă Inventar",
      icon: Package,
      route: "/inventory",
      description: "Vizualizare simplificată a stocului."
    },
    {
      id: "products",
      name: "Produse",
      icon: ShoppingCart,
      route: "/dashboard/products",
      description: "Gestionați lista de produse."
    },
    {
      id: "suppliers",
      name: "Furnizori",
      icon: Users,
      route: "/dashboard/suppliers",
      description: "Gestionați lista de furnizori."
    },
    {
      id: "manufacturers",
      name: "Producători",
      icon: Boxes,
      route: "/dashboard/manufacturers",
      description: "Gestionați lista de producători."
    },
    {
      id: "crate-types",
      name: "Tipuri Lădițe",
      icon: BarChart4,
      route: "/dashboard/crate-types",
      description: "Gestionați tipurile de lădițe."
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />

      <main className="flex-1 container mx-auto px-2 sm:px-4 py-2 sm:py-6">
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-bold">Panou de Control</h1>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate("/inventory")}
            className="w-full sm:w-auto"
          >
            <Package className="h-4 w-4 mr-2" />
            Vizualizare Stoc
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {menuItems.map((item) => (
            <DashboardMenuItem key={item.id} item={item} />
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Dashboard;
