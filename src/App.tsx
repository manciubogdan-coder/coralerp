import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
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

const queryClient = new QueryClient();

const App = () => (
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <SidebarProvider>
            <div className="flex min-h-screen w-full">
              <AppSidebar />
              <SidebarInset>
                <div className="flex flex-col min-h-screen w-full">
                  <div className="flex items-center justify-between p-2 sm:p-4 border-b">
                    <SidebarTrigger className="mr-2 sm:mr-4" />
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
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

export default App;
