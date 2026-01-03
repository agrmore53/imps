'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
} from '@/components/ui/sidebar'
import {
  LayoutDashboard,
  Package,
  Boxes,
  Users,
  Truck,
  Wallet,
  Receipt,
  FileText,
  BarChart3,
  Settings,
  ShoppingCart,
  LogOut,
  Building2,
  HandCoins,
  Gift,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

const menuItems = [
  {
    title: 'Principal',
    items: [
      { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { title: 'PDV', href: '/pdv', icon: ShoppingCart },
    ],
  },
  {
    title: 'Cadastros',
    items: [
      { title: 'Produtos', href: '/dashboard/produtos', icon: Package },
      { title: 'Clientes', href: '/dashboard/clientes', icon: Users },
      { title: 'Fornecedores', href: '/dashboard/fornecedores', icon: Truck },
      { title: 'Fidelidade', href: '/dashboard/fidelidade', icon: Gift },
    ],
  },
  {
    title: 'Operações',
    items: [
      { title: 'Estoque', href: '/dashboard/estoque', icon: Boxes },
    ],
  },
  {
    title: 'Financeiro',
    items: [
      { title: 'Crediário / Fiado', href: '/dashboard/financeiro/crediario', icon: HandCoins },
      { title: 'Contas a Pagar', href: '/dashboard/financeiro/contas-pagar', icon: Wallet },
      { title: 'Contas a Receber', href: '/dashboard/financeiro/contas-receber', icon: Receipt },
      { title: 'Fluxo de Caixa', href: '/dashboard/financeiro/fluxo-caixa', icon: BarChart3 },
    ],
  },
  {
    title: 'Fiscal',
    items: [
      { title: 'NFC-e', href: '/dashboard/fiscal/nfce', icon: FileText },
      { title: 'NF-e', href: '/dashboard/fiscal/nfe', icon: FileText },
      { title: 'Configurações Fiscais', href: '/dashboard/fiscal/configuracoes', icon: Settings },
    ],
  },
  {
    title: 'Relatórios',
    items: [
      { title: 'Relatórios', href: '/dashboard/relatorios', icon: BarChart3 },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-6 py-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg">Império</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {menuItems.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href || pathname.startsWith(item.href + '/')}
                    >
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/dashboard/configuracoes">
                <Settings className="h-4 w-4" />
                <span>Configurações</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 px-2"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
