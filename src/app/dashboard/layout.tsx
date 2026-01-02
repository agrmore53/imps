import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/dashboard/app-sidebar'
import { Header } from '@/components/dashboard/header'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Buscar dados do usuário no banco
  const { data: userData } = await supabase
    .from('usuarios')
    .select('nome, email, perfil')
    .eq('auth_id', user.id)
    .single()

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Header user={userData || { email: user.email }} />
        <main className="flex-1 p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
