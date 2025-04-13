
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

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b">
        <h1 className="text-xl font-bold">Inventory Manager</h1>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigare</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton 
                    isActive={location.pathname === item.path}
                    onClick={() => navigate(item.path)}
                    tooltip={item.name}
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
