
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package, ShoppingCart, Users, Boxes, BarChart4, BarChart3, FileText, Factory } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DashboardMenuItem, { DashboardMenuItem as DashboardMenuItemType } from "@/components/DashboardMenuItem";
import { ReportsManagement } from "@/components/dashboard/ReportsManagement";

const Dashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");

  const menuItems: DashboardMenuItemType[] = [
    {
      id: "inventory",
      name: "Stoc Depozit",
      icon: Package,
      route: "/dashboard/inventory",
      description: "Gestionați stocul curent de produse."
    },
    {
      id: "production-stock",
      name: "Stoc Producție",
      icon: Factory,
      route: "/dashboard/production-stock",
      description: "Gestionați stocul din producție."
    },
    {
      id: "analytics",
      name: "Analytics",
      icon: BarChart3,
      route: "/dashboard/analytics",
      description: "Analize și rapoarte detaliate pentru stoc."
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Prezentare Generală</TabsTrigger>
            <TabsTrigger value="reports">Rapoarte Avansate</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {menuItems.map((item) => (
                <DashboardMenuItem key={item.id} item={item} />
              ))}
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Stoc Total Activ
                  </CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">1,234</div>
                  <p className="text-xs text-muted-foreground">
                    Produse în stoc
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Transferuri Astăzi
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">23</div>
                  <p className="text-xs text-muted-foreground">
                    Mișcări de stoc
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Furnizori Activi
                  </CardTitle>
                  <Boxes className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">12</div>
                  <p className="text-xs text-muted-foreground">
                    Parteneri colaboratori
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <ReportsManagement />
          </TabsContent>
        </Tabs>
      </main>

      <Footer />
    </div>
  );
};

export default Dashboard;
