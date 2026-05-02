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
  Home,
  ShoppingCart,
  ClipboardList,
  Package,
  ClipboardCheck,
  Boxes,
  Tag,
  Factory,
  TrendingUp,
  Truck,
  ShoppingBag,
  Wrench,
  ShieldCheck,
  HardHat,
  MessageSquare,
  CheckSquare,
  Bell,
  Settings,
  Users,
  FileClock,
  PackageSearch,
  Building2,
  Layers,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCollaborationAlerts } from '@/contexts/CollaborationAlertsContext';
import { DEPARTMENTS, type DepartmentRole } from '@/lib/departments';

interface MenuLink {
  name: string;
  icon: LucideIcon;
  path: string;
}

interface DeptGroup {
  dept: DepartmentRole;
  label: string;
  items: MenuLink[];
}

const GROUPS: DeptGroup[] = [
  {
    dept: 'achizitii',
    label: 'Achiziții',
    items: [
      { name: 'Stocuri & Forecast', icon: ShoppingCart, path: '/achizitii' },
      { name: 'Comenzi Furnizori', icon: ClipboardList, path: '/achizitii/comenzi' },
    ],
  },
  {
    dept: 'depozit_mp',
    label: 'Depozit Materie Primă',
    items: [
      { name: 'Stoc MP', icon: Package, path: '/depozit-mp' },
      { name: 'Recepție MP', icon: ClipboardCheck, path: '/depozit-mp/receptie' },
      { name: 'Nomenclatoare', icon: Layers, path: '/depozit-mp/nomenclatoare' },
    ],
  },
  {
    dept: 'depozit_ambalaje',
    label: 'Depozit Ambalaje',
    items: [
      { name: 'Stoc Ambalaje', icon: Boxes, path: '/depozit-ambalaje' },
      { name: 'Nomenclatoare', icon: Layers, path: '/depozit-ambalaje/nomenclatoare' },
    ],
  },
  {
    dept: 'etichete',
    label: 'Etichete',
    items: [
      { name: 'Stoc Etichete', icon: Tag, path: '/etichete' },
      { name: 'Nomenclatoare', icon: Layers, path: '/etichete/nomenclatoare' },
    ],
  },
  {
    dept: 'productie',
    label: 'Producție',
    items: [
      { name: 'Stoc Producție', icon: Factory, path: '/productie' },
    ],
  },
  {
    dept: 'picking_vanzari',
    label: 'Picking',
    items: [
      { name: 'Picking', icon: Truck, path: '/picking' },
    ],
  },
  {
    dept: 'picking_vanzari',
    label: 'Vânzări',
    items: [
      { name: 'Hub Vânzări', icon: ShoppingBag, path: '/vanzari' },
    ],
  },
  {
    dept: 'mentenanta',
    label: 'Mentenanță',
    items: [
      { name: 'Hub Mentenanță', icon: Wrench, path: '/mentenanta' },
    ],
  },
  {
    dept: 'administrativ',
    label: 'Administrativ',
    items: [
      { name: 'Hub Administrativ', icon: Settings, path: '/administrativ' },
      { name: 'Utilizatori', icon: Users, path: '/administrativ/users' },
      { name: 'Audit', icon: FileClock, path: '/administrativ/audit' },
    ],
  },
];

const AppSidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  const { hasDepartment, isAdmin } = useAuth();
  const { chatUnread, taskUnread } = useCollaborationAlerts();

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) setOpenMobile(false);
  };

  const visibleGroups = GROUPS.filter((g) => hasDepartment(g.dept));

  return (
    <Sidebar className={isMobile ? 'bg-white' : ''}>
      <SidebarHeader className="p-4 border-b bg-white">
        <h1 className="text-lg font-bold text-black">Coral ERP</h1>
        <p className="text-xs text-muted-foreground">Sistem departamental</p>
      </SidebarHeader>

      <SidebarContent className={isMobile ? 'bg-white' : ''}>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={location.pathname === '/'}
                  onClick={() => handleNavigation('/')}
                  tooltip="Hub Departamente"
                  className={isMobile ? 'text-black hover:bg-gray-100' : ''}
                >
                  <Home className="mr-2" size={18} />
                  <span>Hub Departamente</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Calitate — vizibil pentru toți userii aprobați (transversal) */}
        <SidebarGroup>
          <SidebarGroupLabel className={isMobile ? 'text-black font-medium' : ''}>
            Calitate
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={location.pathname === '/calitate'}
                  onClick={() => handleNavigation('/calitate')}
                  tooltip="Hub Calitate"
                  className={isMobile ? 'text-black hover:bg-gray-100' : ''}
                >
                  <ShieldCheck className="mr-2" size={16} />
                  <span>Hub Calitate</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={location.pathname === '/operator'}
                  onClick={() => handleNavigation('/operator')}
                  tooltip="Hub Operator"
                  className={isMobile ? 'text-black hover:bg-gray-100' : ''}
                >
                  <HardHat className="mr-2" size={16} />
                  <span>Hub Operator</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Colaborare — Chat, Taskuri (+ Reguli notificări pentru admin) */}
        <SidebarGroup>
          <SidebarGroupLabel className={isMobile ? 'text-black font-medium' : ''}>
            Colaborare
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={location.pathname === '/chat'}
                  onClick={() => handleNavigation('/chat')}
                  tooltip="Chat"
                  className={isMobile ? 'text-black hover:bg-gray-100' : ''}
                >
                  <MessageSquare className="mr-2" size={16} />
                  <span>Chat</span>
                  {chatUnread > 0 && (
                    <span className="ml-auto h-5 min-w-5 rounded-full bg-destructive px-1.5 text-[10px] font-semibold leading-5 text-destructive-foreground text-center">
                      {chatUnread > 99 ? '99+' : chatUnread}
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={location.pathname === '/taskuri'}
                  onClick={() => handleNavigation('/taskuri')}
                  tooltip="Taskuri"
                  className={isMobile ? 'text-black hover:bg-gray-100' : ''}
                >
                  <CheckSquare className="mr-2" size={16} />
                  <span>Taskuri</span>
                  {taskUnread > 0 && (
                    <span className="ml-auto h-5 min-w-5 rounded-full bg-destructive px-1.5 text-[10px] font-semibold leading-5 text-destructive-foreground text-center">
                      {taskUnread > 99 ? '99+' : taskUnread}
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={location.pathname === '/administrativ/notificari-reguli'}
                    onClick={() => handleNavigation('/administrativ/notificari-reguli')}
                    tooltip="Reguli notificări"
                    className={isMobile ? 'text-black hover:bg-gray-100' : ''}
                  >
                    <Bell className="mr-2" size={16} />
                    <span>Reguli notificări</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {visibleGroups.map((group) => (
          <SidebarGroup key={`${group.dept}-${group.label}`}>
            <SidebarGroupLabel className={isMobile ? 'text-black font-medium' : ''}>
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={location.pathname === item.path}
                      onClick={() => handleNavigation(item.path)}
                      tooltip={item.name}
                      className={isMobile ? 'text-black hover:bg-gray-100' : ''}
                    >
                      <item.icon className="mr-2" size={16} />
                      <span>{item.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {visibleGroups.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">
            Nu ai încă acces la niciun departament. Contactează un administrator.
          </div>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t text-xs text-gray-500 bg-white">
        <p>© 2025 Coral Biogreens</p>
      </SidebarFooter>
    </Sidebar>
  );
};

// Reference DEPARTMENTS to satisfy `noUnusedLocals` if it lands later.
void DEPARTMENTS;

export default AppSidebar;
