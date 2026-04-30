import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

import DepartmentHub from "./pages/DepartmentHub";
import AdministrativHub from "./pages/AdministrativHub";
import PlaceholderPage from "./components/PlaceholderPage";

import ProductsPage from "./pages/dashboard/ProductsPage";
import SuppliersPage from "./pages/dashboard/SuppliersPage";
import ManufacturersPage from "./pages/dashboard/ManufacturersPage";
import CrateTypesPage from "./pages/dashboard/CrateTypesPage";
import InventoryPage from "./pages/dashboard/InventoryPage";
import AnalyticsPage from "./pages/dashboard/AnalyticsPage";
import ProductionStockPage from "./pages/dashboard/ProductionStockPage";
import ForecastPage from "./pages/dashboard/ForecastPage";
import NomenclatoarePage from "./pages/NomenclatoarePage";
import NotFound from "./pages/NotFound";
import AppSidebar from "./components/AppSidebar";
import InventoryOverviewPage from "./pages/InventoryPage";
import ReceptionReportPage from "./pages/ReceptionReportPage";
import PickingPage from "./pages/PickingPage";
import AuthPage from "./pages/AuthPage";
import PendingApprovalPage from "./pages/PendingApprovalPage";
import UserManagementPage from "./pages/UserManagementPage";
import AuditLogPage from "./pages/AuditLogPage";
import ProtectedRoute from "./components/ProtectedRoute";
import { InventoryTypeProvider, ForceInventoryType } from "@/context/inventory-type";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

const queryClient = new QueryClient();

const AppShell = () => {
  const { signOut, profile } = useAuth();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset>
          <div className="flex flex-col min-h-screen w-full">
            <div className="flex items-center justify-between p-2 sm:p-4 border-b">
              <SidebarTrigger className="mr-2 sm:mr-4" />
              <div className="flex items-center gap-3">
                {profile?.email && (
                  <span className="hidden sm:inline text-sm text-muted-foreground">
                    {profile.name || profile.email}
                  </span>
                )}
                <Button variant="ghost" size="icon" onClick={signOut} title="Deconectare">
                  <LogOut size={16} />
                </Button>
              </div>
            </div>
            <main className="flex-1 p-2 sm:p-4">
              <Routes>
                {/* Hub principal */}
                <Route path="/" element={<DepartmentHub />} />

                {/* ========== ACHIZIȚII ========== */}
                <Route
                  path="/achizitii"
                  element={
                    <ProtectedRoute requireDepartment="achizitii">
                      <PlaceholderPage title="Achiziții" description="Hub-ul departamentului de achiziții." />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/achizitii/comenzi"
                  element={
                    <ProtectedRoute requireDepartment="achizitii">
                      <PlaceholderPage title="Comenzi Furnizori" description="Generare și urmărire comenzi." />
                    </ProtectedRoute>
                  }
                />

                {/* ========== DEPOZIT MATERIE PRIMĂ ========== */}
                <Route
                  path="/depozit-mp"
                  element={
                    <ProtectedRoute requireDepartment="depozit_mp">
                      <ForceInventoryType type="materii-prime">
                        <InventoryPage />
                      </ForceInventoryType>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/depozit-mp/receptie"
                  element={
                    <ProtectedRoute requireDepartment="depozit_mp">
                      <ForceInventoryType type="materii-prime">
                        <ReceptionReportPage />
                      </ForceInventoryType>
                    </ProtectedRoute>
                  }
                />

                {/* ========== DEPOZIT AMBALAJE ========== */}
                <Route
                  path="/depozit-ambalaje"
                  element={
                    <ProtectedRoute requireDepartment="depozit_ambalaje">
                      <ForceInventoryType type="ambalaje">
                        <InventoryPage />
                      </ForceInventoryType>
                    </ProtectedRoute>
                  }
                />

                {/* ========== ETICHETE ========== */}
                <Route
                  path="/etichete"
                  element={
                    <ProtectedRoute requireDepartment="etichete">
                      <ForceInventoryType type="etichete">
                        <InventoryPage />
                      </ForceInventoryType>
                    </ProtectedRoute>
                  }
                />

                {/* ========== PRODUCȚIE ========== */}
                <Route
                  path="/productie"
                  element={
                    <ProtectedRoute requireDepartment="productie">
                      <ProductionStockPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/productie/forecast"
                  element={
                    <ProtectedRoute requireDepartment="productie">
                      <ForecastPage />
                    </ProtectedRoute>
                  }
                />

                {/* ========== PICKING & VÂNZĂRI ========== */}
                <Route
                  path="/picking"
                  element={
                    <ProtectedRoute requireDepartment="picking_vanzari">
                      <PickingPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/vanzari"
                  element={
                    <ProtectedRoute requireDepartment="picking_vanzari">
                      <PlaceholderPage title="Vânzări" description="Gestionare comenzi clienți." />
                    </ProtectedRoute>
                  }
                />

                {/* ========== MENTENANȚĂ ========== */}
                <Route
                  path="/mentenanta"
                  element={
                    <ProtectedRoute requireDepartment="mentenanta">
                      <PlaceholderPage title="Mentenanță" description="Echipamente, intervenții, planificare." />
                    </ProtectedRoute>
                  }
                />

                {/* ========== ADMINISTRATIV ========== */}
                <Route
                  path="/administrativ"
                  element={
                    <ProtectedRoute requireDepartment="administrativ">
                      <AdministrativHub />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/administrativ/users"
                  element={
                    <ProtectedRoute requireAdmin>
                      <UserManagementPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/administrativ/audit"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AuditLogPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/administrativ/produse"
                  element={
                    <ProtectedRoute requireDepartment="administrativ">
                      <ProductsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/administrativ/furnizori"
                  element={
                    <ProtectedRoute requireDepartment="administrativ">
                      <SuppliersPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/administrativ/producatori"
                  element={
                    <ProtectedRoute requireDepartment="administrativ">
                      <ManufacturersPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/administrativ/lazi"
                  element={
                    <ProtectedRoute requireDepartment="administrativ">
                      <CrateTypesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/administrativ/analytics"
                  element={
                    <ProtectedRoute requireDepartment="administrativ">
                      <AnalyticsPage />
                    </ProtectedRoute>
                  }
                />

                {/* ========== REDIRECT-URI VECHI → NOI ========== */}
                <Route path="/dashboard" element={<Navigate to="/" replace />} />
                <Route path="/dashboard/products" element={<Navigate to="/administrativ/produse" replace />} />
                <Route path="/dashboard/suppliers" element={<Navigate to="/administrativ/furnizori" replace />} />
                <Route path="/dashboard/manufacturers" element={<Navigate to="/administrativ/producatori" replace />} />
                <Route path="/dashboard/crate-types" element={<Navigate to="/administrativ/lazi" replace />} />
                <Route path="/dashboard/inventory" element={<Navigate to="/depozit-mp" replace />} />
                <Route path="/dashboard/analytics" element={<Navigate to="/administrativ/analytics" replace />} />
                <Route path="/dashboard/production-stock" element={<Navigate to="/productie" replace />} />
                <Route path="/dashboard/forecast" element={<Navigate to="/productie/forecast" replace />} />
                <Route path="/dashboard/reception-report" element={<Navigate to="/depozit-mp/receptie" replace />} />
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

                {/* Redirect-uri legacy pentru rute aflate înainte la rădăcină */}
                <Route path="/users" element={<Navigate to="/administrativ/users" replace />} />
                <Route path="/audit" element={<Navigate to="/administrativ/audit" replace />} />

                <Route
                  path="/*"
                  element={
                    <ProtectedRoute>
                      <InventoryTypeProvider>
                        <AppShell />
                      </InventoryTypeProvider>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </React.StrictMode>
  );
};

export default App;
