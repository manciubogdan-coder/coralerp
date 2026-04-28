import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { 
  Package, 
  Factory, 
  Truck, 
  Box, 
  Database,
  FileClock,
  Home,
  Warehouse,
  TrendingUp,
  ClipboardCheck
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const AppSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  const { isAdmin } = useAuth();

  const menuItems = [
    {
      id: "home",
      name: "Pagina Principală",
      icon: Home,
      path: "/",
    },
    {
      id: "products",
      name: "Produse",
      icon: Package,
      path: "/dashboard/products",
    },
    {
      id: "suppliers",
      name: "Furnizori",
      icon: Truck,
      path: "/dashboard/suppliers",
    },
    {
      id: "manufacturers",
      name: "Producători",
      icon: Factory,
      path: "/dashboard/manufacturers",
    },
    {
      id: "crate-types",
      name: "Tipuri de lădițe",
      icon: Box,
      path: "/dashboard/crate-types",
    },
    {
      id: "inventory",
      name: "Inventar Depozit",
      icon: Database,
      path: "/dashboard/inventory",
    },
    {
      id: "production-stock",
      name: "Stoc Producție",
      icon: Warehouse,
      path: "/dashboard/production-stock",
    },
    {
      id: "forecast",
      name: "Planificare & Forecast",
      icon: TrendingUp,
      path: "/dashboard/forecast",
    },
    {
      id: "reception-report",
      name: "Raport de Recepție",
      icon: ClipboardCheck,
      path: "/dashboard/reception-report",
    }
  ];

  const visibleMenuItems = isAdmin
    ? [...menuItems, { id: "audit", name: "Audit Operații", icon: FileClock, path: "/audit" }]
    : menuItems;

  const handleNavigation = (path: string) => {
    navigate(path);
    // Pe mobil, închide sidebar-ul după navigare
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar className={isMobile ? "bg-white" : ""}>
      <SidebarHeader className="p-4 border-b bg-white">
        <h1 className="text-xl font-bold text-black">Stoc Depozit</h1>
      </SidebarHeader>
      
      <SidebarContent className={isMobile ? "bg-white" : ""}>
        <SidebarGroup>
          <SidebarGroupLabel className={`${isMobile ? "text-black font-medium" : ""}`}>Navigare</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMenuItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton 
                    isActive={location.pathname === item.path}
                    onClick={() => handleNavigation(item.path)}
                    tooltip={item.name}
                    className={isMobile ? "text-black hover:bg-gray-100" : ""}
                  >
                    <item.icon className="mr-2" size={18} />
                    <span>{item.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="p-4 border-t text-sm text-gray-500 bg-white">
        <p>© 2025 Inventory Manager</p>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
