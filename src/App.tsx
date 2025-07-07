import React, { createContext, useContext, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Package, Boxes } from "lucide-react";
import Dashboard from "./pages/Dashboard";
import ProductsPage from "./pages/dashboard/ProductsPage";
import SuppliersPage from "./pages/dashboard/SuppliersPage";
import ManufacturersPage from "./pages/dashboard/ManufacturersPage";
import CrateTypesPage from "./pages/dashboard/CrateTypesPage";
import InventoryPage from "./pages/dashboard/InventoryPage";
import AnalyticsPage from "./pages/dashboard/AnalyticsPage";
import NotFound from "./pages/NotFound";
import AppSidebar from "./components/AppSidebar";
import InventoryOverviewPage from "./pages/InventoryPage";

// Context pentru tipul de inventar
const InventoryTypeContext = createContext<{
  inventoryType: 'materii-prime' | 'ambalaje';
  setInventoryType: (type: 'materii-prime' | 'ambalaje') => void;
}>({
  inventoryType: 'materii-prime',
  setInventoryType: () => {}
});

export const useInventoryType = () => useContext(InventoryTypeContext);

const queryClient = new QueryClient();

const App = () => {
  const [inventoryType, setInventoryType] = useState<'materii-prime' | 'ambalaje'>('materii-prime');

  return (
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <InventoryTypeContext.Provider value={{ inventoryType, setInventoryType }}>
              <SidebarProvider>
                <div className="flex min-h-screen w-full">
                  <AppSidebar />
                  <SidebarInset>
                    <div className="flex flex-col min-h-screen w-full">
                      <div className="flex items-center justify-between p-2 sm:p-4 border-b">
                        <SidebarTrigger className="mr-2 sm:mr-4" />
                        <div className="flex gap-2">
                          <Button
                            variant={inventoryType === 'materii-prime' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setInventoryType('materii-prime')}
                            className="flex items-center gap-2"
                          >
                            <Package size={16} />
                            Materii Prime
                          </Button>
                          <Button
                            variant={inventoryType === 'ambalaje' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setInventoryType('ambalaje')}
                            className="flex items-center gap-2"
                          >
                            <Boxes size={16} />
                            Ambalaje
                          </Button>
                        </div>
                      </div>
                      <main className="flex-1 p-2 sm:p-4">
                        <Routes>
                          <Route path="/" element={<Dashboard />} />
                          <Route path="/dashboard" element={<Navigate to="/" replace />} />
                          <Route path="/dashboard/products" element={<ProductsPage />} />
                          <Route path="/dashboard/suppliers" element={<SuppliersPage />} />
                          <Route path="/dashboard/manufacturers" element={<ManufacturersPage />} />
                          <Route path="/dashboard/crate-types" element={<CrateTypesPage />} />
                          <Route path="/dashboard/inventory" element={<InventoryPage />} />
                          <Route path="/dashboard/analytics" element={<AnalyticsPage />} />
                          <Route path="/inventory" element={<InventoryOverviewPage />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </main>
                    </div>
                  </SidebarInset>
                </div>
              </SidebarProvider>
            </InventoryTypeContext.Provider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </React.StrictMode>
  );
};

export default App;
