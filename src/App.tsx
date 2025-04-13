
import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import ProductsPage from "./pages/dashboard/ProductsPage";
import SuppliersPage from "./pages/dashboard/SuppliersPage";
import ManufacturersPage from "./pages/dashboard/ManufacturersPage";
import CrateTypesPage from "./pages/dashboard/CrateTypesPage";
import InventoryPage from "./pages/dashboard/InventoryPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/products" element={<ProductsPage />} />
            <Route path="/dashboard/suppliers" element={<SuppliersPage />} />
            <Route path="/dashboard/manufacturers" element={<ManufacturersPage />} />
            <Route path="/dashboard/crate-types" element={<CrateTypesPage />} />
            <Route path="/dashboard/inventory" element={<InventoryPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

export default App;
