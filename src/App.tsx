import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Package, Boxes, Users, LogOut, Tag } from "lucide-react";
import Dashboard from "./pages/Dashboard";
import ProductsPage from "./pages/dashboard/ProductsPage";
import SuppliersPage from "./pages/dashboard/SuppliersPage";
import ManufacturersPage from "./pages/dashboard/ManufacturersPage";
import CrateTypesPage from "./pages/dashboard/CrateTypesPage";
import InventoryPage from "./pages/dashboard/InventoryPage";
import AnalyticsPage from "./pages/dashboard/AnalyticsPage";
import ProductionStockPage from "./pages/dashboard/ProductionStockPage";
import ForecastPage from "./pages/dashboard/ForecastPage";
import NotFound from "./pages/NotFound";
import AppSidebar from "./components/AppSidebar";
import InventoryOverviewPage from "./pages/InventoryPage";
import AuthPage from "./pages/AuthPage";
import PendingApprovalPage from "./pages/PendingApprovalPage";
import UserManagementPage from "./pages/UserManagementPage";
import ProtectedRoute from "./components/ProtectedRoute";
import { InventoryTypeProvider, useInventoryType } from "@/context/inventory-type";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

const queryClient = new QueryClient();

const AppShell = () => {
  const navigate = useNavigate();
  const { inventoryType, setInventoryType } = useInventoryType();
  const { isAdmin, signOut } = useAuth();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset>
          <div className="flex flex-col min-h-screen w-full">
            <div className="flex items-center justify-between p-2 sm:p-4 border-b">
              <SidebarTrigger className="mr-2 sm:mr-4" />
              <div className="flex gap-2 items-center">
                <Button
                  variant={inventoryType === "materii-prime" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setInventoryType("materii-prime")}
                  className="flex items-center gap-2"
                >
                  <Package size={16} />
                  Materii Prime
                </Button>
                <Button
                  variant={inventoryType === "ambalaje" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setInventoryType("ambalaje")}
                  className="flex items-center gap-2"
                >
                  <Boxes size={16} />
                  Ambalaje
                </Button>
                <Button
                  variant={inventoryType === "etichete" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setInventoryType("etichete")}
                  className="flex items-center gap-2"
                >
                  <Tag size={16} />
                  Etichete
                </Button>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/users')}
                    className="flex items-center gap-2"
                  >
                    <Users size={16} />
                    Utilizatori
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={signOut}
                  title="Deconectare"
                >
                  <LogOut size={16} />
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
                <Route path="/dashboard/production-stock" element={<ProductionStockPage />} />
                <Route path="/dashboard/forecast" element={<ForecastPage />} />
                <Route path="/inventory" element={<InventoryOverviewPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

const App = () => {
  return (
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/pending-approval" element={<PendingApprovalPage />} />
                <Route path="/users" element={
                  <ProtectedRoute requireAdmin>
                    <UserManagementPage />
                  </ProtectedRoute>
                } />
                <Route path="/*" element={
                  <ProtectedRoute>
                    <InventoryTypeProvider>
                      <AppShell />
                    </InventoryTypeProvider>
                  </ProtectedRoute>
                } />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </React.StrictMode>
  );
};

export default App;
