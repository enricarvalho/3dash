import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Boxes,
  Users,
  Gem,
  Shapes,
  FileText,
  Wallet,
  Scale,
  Handshake,
  Vault,
  ShoppingCart,
  Package,
  Printer,
  BarChart3,
  Settings,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { LogoWordmark } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Estoque", url: "/estoque", icon: Boxes },
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "LTV", url: "/ltv", icon: Gem },
  { title: "Peças", url: "/pecas", icon: Shapes },
  { title: "Orçamentos", url: "/orcamentos", icon: FileText },
  { title: "Vendas", url: "/vendas", icon: ShoppingCart },
  { title: "Inventário", url: "/inventario", icon: Package },
  { title: "Impressoras", url: "/impressoras", icon: Printer },
  { title: "Financeiro", url: "/financeiro", icon: Wallet },
  { title: "DRE", url: "/dre", icon: Scale },
  { title: "Sócios", url: "/socios", icon: Handshake },
  { title: "Fechamento", url: "/caixa", icon: Vault },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
] as const;

export function useDarkMode() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("workspace-theme") === "dark";
    setDark(saved);
    document.documentElement.classList.toggle("dark", saved);
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("workspace-theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  };
  return { dark, toggle };
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { dark, toggle } = useDarkMode();

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Sessão encerrada");
    navigate({ to: "/", replace: true });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4">
        <LogoWordmark collapsed={collapsed} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Operação</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url || pathname.startsWith(item.url + "/")}
                    tooltip={item.title}
                  >
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-1 p-2">
        <Button variant="ghost" size="sm" className="justify-start" onClick={toggle}>
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {!collapsed && <span>{dark ? "Modo claro" : "Modo escuro"}</span>}
        </Button>
        <Button variant="ghost" size="sm" className="justify-start" onClick={signOut}>
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
