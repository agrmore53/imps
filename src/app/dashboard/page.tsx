import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/server'
import {
  ShoppingCart,
  Package,
  Users,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowRight,
  Wallet,
  Receipt,
  Clock,
} from 'lucide-react'
import { DashboardCharts } from '@/components/dashboard/dashboard-charts'
import { NotificationsPanel } from '@/components/dashboard/notifications-panel'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const hojeStr = hoje.toISOString()

  // Data de 7 dias atrás
  const seteDiasAtras = new Date(hoje)
  seteDiasAtras.setDate(seteDiasAtras.getDate() - 7)

  // Data de ontem
  const ontem = new Date(hoje)
  ontem.setDate(ontem.getDate() - 1)
  const ontemStr = ontem.toISOString()

  // Buscar vendas de hoje
  const { data: vendasHoje } = await supabase
    .from('vendas')
    .select('id, total')
    .eq('status', 'finalizada')
    .gte('data_hora', hojeStr)

  // Buscar vendas de ontem
  const { data: vendasOntem } = await supabase
    .from('vendas')
    .select('id, total')
    .eq('status', 'finalizada')
    .gte('data_hora', ontemStr)
    .lt('data_hora', hojeStr)

  // Buscar vendas dos últimos 7 dias para gráfico
  const { data: vendasSemana } = await supabase
    .from('vendas')
    .select('id, total, data_hora')
    .eq('status', 'finalizada')
    .gte('data_hora', seteDiasAtras.toISOString())
    .order('data_hora')

  // Buscar total de produtos
  const { count: totalProdutos } = await supabase
    .from('produtos')
    .select('*', { count: 'exact', head: true })
    .eq('ativo', true)

  // Buscar produtos com estoque baixo
  const { data: produtosBaixoEstoque } = await supabase
    .from('produtos')
    .select('id, nome, estoque_atual, estoque_minimo, unidade')
    .eq('ativo', true)
    .filter('estoque_atual', 'lte', 'estoque_minimo')
    .limit(5)

  // Buscar total de clientes
  const { count: totalClientes } = await supabase
    .from('clientes')
    .select('*', { count: 'exact', head: true })
    .eq('ativo', true)

  // Buscar contas a receber próximos 7 dias
  const proximosDias = new Date(hoje)
  proximosDias.setDate(proximosDias.getDate() + 7)

  const { data: contasReceberProximas } = await supabase
    .from('contas_receber')
    .select('valor')
    .eq('status', 'pendente')
    .gte('vencimento', hoje.toISOString().split('T')[0])
    .lte('vencimento', proximosDias.toISOString().split('T')[0])

  // Buscar contas a pagar vencidas
  const { data: contasPagarVencidas } = await supabase
    .from('contas_pagar')
    .select('valor')
    .eq('status', 'pendente')
    .lt('vencimento', hoje.toISOString().split('T')[0])

  // Buscar produtos mais vendidos (últimos 30 dias)
  const trintaDiasAtras = new Date(hoje)
  trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30)

  const { data: produtosMaisVendidos } = await supabase
    .from('venda_itens')
    .select(`
      produto_id,
      quantidade,
      produtos (nome)
    `)
    .gte('created_at', trintaDiasAtras.toISOString())
    .limit(100)

  // Calcular totais
  const totalVendasHoje = vendasHoje?.reduce((acc, v) => acc + v.total, 0) || 0
  const totalVendasOntem = vendasOntem?.reduce((acc, v) => acc + v.total, 0) || 0
  const qtdVendasHoje = vendasHoje?.length || 0

  // Calcular variação percentual
  let variacaoVendas = 0
  if (totalVendasOntem > 0) {
    variacaoVendas = ((totalVendasHoje - totalVendasOntem) / totalVendasOntem) * 100
  } else if (totalVendasHoje > 0) {
    variacaoVendas = 100
  }

  // Ticket médio
  const ticketMedio = qtdVendasHoje > 0 ? totalVendasHoje / qtdVendasHoje : 0

  // Total a receber
  const totalAReceber = contasReceberProximas?.reduce((acc, c) => acc + c.valor, 0) || 0

  // Total vencido a pagar
  const totalVencidoPagar = contasPagarVencidas?.reduce((acc, c) => acc + c.valor, 0) || 0

  // Agrupar vendas por dia para gráfico
  const vendasPorDia: { [key: string]: number } = {}
  for (let i = 6; i >= 0; i--) {
    const data = new Date(hoje)
    data.setDate(data.getDate() - i)
    const dataStr = data.toISOString().split('T')[0]
    vendasPorDia[dataStr] = 0
  }

  vendasSemana?.forEach((venda) => {
    const dataVenda = new Date(venda.data_hora).toISOString().split('T')[0]
    if (vendasPorDia[dataVenda] !== undefined) {
      vendasPorDia[dataVenda] += venda.total
    }
  })

  const dadosGrafico = Object.entries(vendasPorDia).map(([data, valor]) => ({
    data: new Date(data).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }),
    valor,
  }))

  // Agrupar produtos mais vendidos
  const produtosAgrupados: { [key: string]: { nome: string; quantidade: number } } = {}
  produtosMaisVendidos?.forEach((item: any) => {
    if (item.produto_id && item.produtos?.nome) {
      if (!produtosAgrupados[item.produto_id]) {
        produtosAgrupados[item.produto_id] = { nome: item.produtos.nome, quantidade: 0 }
      }
      produtosAgrupados[item.produto_id].quantidade += item.quantidade
    }
  })

  const topProdutos = Object.values(produtosAgrupados)
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 5)

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Bem-vindo ao Império Sistemas
        </p>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas Hoje</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalVendasHoje)}</div>
            <p className="text-xs text-muted-foreground">
              {qtdVendasHoje} venda(s) realizada(s)
            </p>
            {variacaoVendas !== 0 && (
              <div className={`flex items-center text-xs mt-1 ${variacaoVendas >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {variacaoVendas >= 0 ? (
                  <TrendingUp className="h-3 w-3 mr-1" />
                ) : (
                  <TrendingDown className="h-3 w-3 mr-1" />
                )}
                {variacaoVendas >= 0 ? '+' : ''}{variacaoVendas.toFixed(1)}% vs ontem
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(ticketMedio)}</div>
            <p className="text-xs text-muted-foreground">
              Valor médio por venda
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produtos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProdutos || 0}</div>
            <p className="text-xs text-muted-foreground">
              {produtosBaixoEstoque?.length || 0} com estoque baixo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClientes || 0}</div>
            <p className="text-xs text-muted-foreground">
              Total cadastrados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cards Financeiro */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">A Receber (7 dias)</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalAReceber)}</div>
            <p className="text-xs text-muted-foreground">
              {contasReceberProximas?.length || 0} título(s) a vencer
            </p>
          </CardContent>
        </Card>

        <Card className={totalVencidoPagar > 0 ? 'border-red-500' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contas Vencidas</CardTitle>
            <Wallet className={`h-4 w-4 ${totalVencidoPagar > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalVencidoPagar > 0 ? 'text-red-600' : ''}`}>
              {formatCurrency(totalVencidoPagar)}
            </div>
            <p className="text-xs text-muted-foreground">
              {contasPagarVencidas?.length || 0} conta(s) vencida(s)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Vendas e Produtos Mais Vendidos */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Vendas - Últimos 7 dias</CardTitle>
            <CardDescription>Evolução das vendas da semana</CardDescription>
          </CardHeader>
          <CardContent>
            <DashboardCharts data={dadosGrafico} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Produtos Mais Vendidos</CardTitle>
            <CardDescription>Últimos 30 dias</CardDescription>
          </CardHeader>
          <CardContent>
            {topProdutos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma venda registrada no período
              </p>
            ) : (
              <div className="space-y-4">
                {topProdutos.map((produto, index) => (
                  <div key={index} className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-sm font-medium">{produto.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {produto.quantidade} unidades vendidas
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Painel de Notificações */}
      <NotificationsPanel />

      {/* Ações Rápidas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Link href="/pdv">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Abrir PDV
              </CardTitle>
              <CardDescription>
                Iniciar uma nova venda
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/dashboard/produtos/novo">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Novo Produto
              </CardTitle>
              <CardDescription>
                Cadastrar um produto
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/dashboard/clientes/novo">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Novo Cliente
              </CardTitle>
              <CardDescription>
                Cadastrar um cliente
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/dashboard/relatorios">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Relatórios
              </CardTitle>
              <CardDescription>
                Visualizar relatórios
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  )
}
