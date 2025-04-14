import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BarChart4, Users, ShoppingCart, Package, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DashboardMenuItem from "@/components/DashboardMenuItem";
import { DashboardMenuItem as DashboardMenuItemType } from "@/types";

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

      <main className="flex-1 container mx-auto p-4 md:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/")}
              className="mr-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Înapoi la pagina principală
            </Button>
            <h1 className="text-2xl font-bold">Panou de Control</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
