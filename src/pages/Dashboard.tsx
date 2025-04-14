
import React from "react";
import { useNavigate } from "react-router-dom";
import { 
  Package, 
  Factory, 
  Truck, 
  Box, 
  Database, 
  ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardMenuItem } from "@/types";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useIsMobile } from "@/hooks/use-mobile";

const Dashboard = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  const menuItems: DashboardMenuItem[] = [
    {
      id: "products",
      name: "Produse",
      icon: Package,
      route: "/dashboard/products",
      path: "/dashboard/products",
      description: "Gestionează catalogul de produse și specificații"
    },
    {
      id: "suppliers",
      name: "Furnizori",
      icon: Truck,
      route: "/dashboard/suppliers",
      path: "/dashboard/suppliers",
      description: "Administrează furnizorii și datele de contact"
    },
    {
      id: "manufacturers",
      name: "Producători",
      icon: Factory,
      route: "/dashboard/manufacturers",
      path: "/dashboard/manufacturers",
      description: "Gestionează producătorii și informațiile despre aceștia"
    },
    {
      id: "crate-types",
      name: "Tipuri de lădițe",
      icon: Box,
      route: "/dashboard/crate-types",
      path: "/dashboard/crate-types",
      description: "Configurează tipurile de lădițe și greutățile acestora"
    },
    {
      id: "inventory",
      name: "Stoc Depozit",
      icon: Database,
      route: "/dashboard/inventory",
      path: "/dashboard/inventory",
      description: "Adaugă și modifică manual intrările în stoc"
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-1 container mx-auto p-4 md:p-6">
        <div className="mb-6 flex items-center">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate("/")}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Înapoi
          </Button>
          <h1 className="text-2xl font-bold">Panou de Administrare</h1>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menuItems.map((item) => (
            <Card 
              key={item.id} 
              className="transition-all hover:shadow-md cursor-pointer"
              onClick={() => navigate(item.path || item.route)}
            >
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">{item.name}</CardTitle>
                  <div className="p-2 rounded-full bg-gray-100">
                    {React.createElement(item.icon, { className: "h-5 w-5" })}
                  </div>
                </div>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="secondary"
                  className="w-full"
                >
                  Deschide
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Dashboard;
