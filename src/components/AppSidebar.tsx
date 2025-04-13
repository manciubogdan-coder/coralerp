
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
  Home
} from 'lucide-react';

const AppSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();

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
      name: "Inventar",
      icon: Database,
      path: "/dashboard/inventory",
    }
  ];

  const handleNavigation = (path: string) => {
    navigate(path);
    // Pe mobil, închide sidebar-ul după navigare
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar className={isMobile ? "mobile-sidebar" : ""}>
      <SidebarHeader className="p-4 border-b">
        <h1 className="text-xl font-bold">Inventory Manager</h1>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className={isMobile ? "sidebar-group-label" : ""}>Navigare</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton 
                    isActive={location.pathname === item.path}
                    onClick={() => handleNavigation(item.path)}
                    tooltip={item.name}
                    className={isMobile ? "sidebar-menu-button" : ""}
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
      
      <SidebarFooter className="p-4 border-t text-sm text-gray-500">
        <p>© 2025 Inventory Manager</p>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
