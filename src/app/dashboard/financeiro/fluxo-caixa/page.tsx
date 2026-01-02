import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  Calendar,
  DollarSign,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function FluxoCaixaPage() {
  const supabase = await createClient()

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  // Data de 30 dias atrás e 30 dias à frente
  const dataInicio = new Date(hoje)
  dataInicio.setDate(dataInicio.getDate() - 30)

  const dataFim = new Date(hoje)
  dataFim.setDate(dataFim.getDate() + 30)

  // Buscar contas a pagar (pendentes)
  const { data: contasPagar } = await supabase
    .from('contas_pagar')
    .select('id, descricao, valor, vencimento, status, categoria')
    .eq('status', 'pendente')
    .gte('vencimento', dataInicio.toISOString().split('T')[0])
    .lte('vencimento', dataFim.toISOString().split('T')[0])
    .order('vencimento')

  // Buscar contas a receber (pendentes)
  const { data: contasReceber } = await supabase
    .from('contas_receber')
    .select('id, descricao, valor, vencimento, status, parcela')
    .eq('status', 'pendente')
    .gte('vencimento', dataInicio.toISOString().split('T')[0])
    .lte('vencimento', dataFim.toISOString().split('T')[0])
    .order('vencimento')

  // Buscar pagamentos realizados no período
  const { data: pagamentosRealizados } = await supabase
    .from('contas_pagar')
    .select('pagamento_valor, pagamento_data')
    .eq('status', 'pago')
    .gte('pagamento_data', dataInicio.toISOString().split('T')[0])
    .lte('pagamento_data', hoje.toISOString().split('T')[0])

  // Buscar recebimentos realizados no período
  const { data: recebimentosRealizados } = await supabase
    .from('contas_receber')
    .select('recebimento_valor, recebimento_data')
    .eq('status', 'recebido')
    .gte('recebimento_data', dataInicio.toISOString().split('T')[0])
    .lte('recebimento_data', hoje.toISOString().split('T')[0])

  // Buscar vendas do dia (em dinheiro e cartão)
  const { data: vendasHoje } = await supabase
    .from('vendas')
    .select('total')
    .eq('status', 'concluida')
    .gte('data_hora', hoje.toISOString())

  // Calcular totais
  const totalPagamentosRealizados = pagamentosRealizados?.reduce(
    (acc, p) => acc + (p.pagamento_valor || 0), 0
  ) || 0

  const totalRecebimentosRealizados = recebimentosRealizados?.reduce(
    (acc, r) => acc + (r.recebimento_valor || 0), 0
  ) || 0

  const totalVendasHoje = vendasHoje?.reduce(
    (acc, v) => acc + v.total, 0
  ) || 0

  const totalAPagar = contasPagar?.reduce((acc, c) => acc + c.valor, 0) || 0
  const totalAReceber = contasReceber?.reduce((acc, c) => acc + c.valor, 0) || 0

  // Agrupar por período
  const hojeStr = hoje.toISOString().split('T')[0]

  const semanaFim = new Date(hoje)
  semanaFim.setDate(semanaFim.getDate() + 7)
  const semanaFimStr = semanaFim.toISOString().split('T')[0]

  const mesAtual = hoje.getMonth()
  const anoAtual = hoje.getFullYear()

  // Pagamentos por período
  const pagarHoje = contasPagar?.filter(c => c.vencimento === hojeStr) || []
  const pagarSemana = contasPagar?.filter(c => c.vencimento > hojeStr && c.vencimento <= semanaFimStr) || []
  const pagarMes = contasPagar?.filter(c => {
    const d = new Date(c.vencimento)
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual && c.vencimento > semanaFimStr
  }) || []

  // Recebimentos por período
  const receberHoje = contasReceber?.filter(c => c.vencimento === hojeStr) || []
  const receberSemana = contasReceber?.filter(c => c.vencimento > hojeStr && c.vencimento <= semanaFimStr) || []
  const receberMes = contasReceber?.filter(c => {
    const d = new Date(c.vencimento)
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual && c.vencimento > semanaFimStr
  }) || []

  // Saldo projetado
  const saldoProjetado = totalAReceber - totalAPagar

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  function formatDate(date: string) {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    }).format(new Date(date))
  }

  function somarValores(items: any[]) {
    return items.reduce((acc, item) => acc + item.valor, 0)
  }

  // Combinar e ordenar movimentos para a tabela
  const movimentos = [
    ...(contasPagar?.map(c => ({ ...c, tipo: 'saida' })) || []),
    ...(contasReceber?.map(c => ({ ...c, tipo: 'entrada' })) || []),
  ].sort((a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime())

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Fluxo de Caixa</h1>
        <p className="text-muted-foreground">
          Visão financeira dos próximos 30 dias
        </p>
      </div>

      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas Hoje</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalVendasHoje)}
            </div>
            <p className="text-xs text-muted-foreground">
              {vendasHoje?.length || 0} venda(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total a Receber</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalAReceber)}
            </div>
            <p className="text-xs text-muted-foreground">
              {contasReceber?.length || 0} título(s) pendente(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total a Pagar</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(totalAPagar)}
            </div>
            <p className="text-xs text-muted-foreground">
              {contasPagar?.length || 0} conta(s) pendente(s)
            </p>
          </CardContent>
        </Card>

        <Card className={saldoProjetado >= 0 ? 'border-green-500' : 'border-red-500'}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Projetado</CardTitle>
            <Wallet className={`h-4 w-4 ${saldoProjetado >= 0 ? 'text-green-500' : 'text-red-500'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${saldoProjetado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(saldoProjetado)}
            </div>
            <p className="text-xs text-muted-foreground">
              Próximos 30 dias
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Resumo por Período */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* A Pagar por Período */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5 text-red-500" />
              Contas a Pagar
            </CardTitle>
            <CardDescription>Distribuição por período</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b">
              <div className="flex items-center gap-2">
                <Badge variant="destructive">Hoje</Badge>
                <span className="text-sm text-muted-foreground">
                  {pagarHoje.length} conta(s)
                </span>
              </div>
              <span className="font-semibold">{formatCurrency(somarValores(pagarHoje))}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Esta Semana</Badge>
                <span className="text-sm text-muted-foreground">
                  {pagarSemana.length} conta(s)
                </span>
              </div>
              <span className="font-semibold">{formatCurrency(somarValores(pagarSemana))}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Este Mês</Badge>
                <span className="text-sm text-muted-foreground">
                  {pagarMes.length} conta(s)
                </span>
              </div>
              <span className="font-semibold">{formatCurrency(somarValores(pagarMes))}</span>
            </div>
          </CardContent>
        </Card>

        {/* A Receber por Período */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowDownCircle className="h-5 w-5 text-green-500" />
              Contas a Receber
            </CardTitle>
            <CardDescription>Distribuição por período</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b">
              <div className="flex items-center gap-2">
                <Badge className="bg-green-600">Hoje</Badge>
                <span className="text-sm text-muted-foreground">
                  {receberHoje.length} título(s)
                </span>
              </div>
              <span className="font-semibold text-green-600">{formatCurrency(somarValores(receberHoje))}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Esta Semana</Badge>
                <span className="text-sm text-muted-foreground">
                  {receberSemana.length} título(s)
                </span>
              </div>
              <span className="font-semibold text-green-600">{formatCurrency(somarValores(receberSemana))}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Este Mês</Badge>
                <span className="text-sm text-muted-foreground">
                  {receberMes.length} título(s)
                </span>
              </div>
              <span className="font-semibold text-green-600">{formatCurrency(somarValores(receberMes))}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Movimentos Previstos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Movimentações Previstas
          </CardTitle>
          <CardDescription>
            Entradas e saídas dos próximos 30 dias
          </CardDescription>
        </CardHeader>
        <CardContent>
          {movimentos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Nenhuma movimentação prevista</h3>
              <p className="text-muted-foreground">
                Não há contas a pagar ou receber nos próximos 30 dias
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimentos.slice(0, 20).map((mov) => (
                  <TableRow key={`${mov.tipo}-${mov.id}`}>
                    <TableCell>
                      {formatDate(mov.vencimento)}
                    </TableCell>
                    <TableCell>
                      {mov.tipo === 'entrada' ? (
                        <Badge className="bg-green-600">
                          <ArrowDownCircle className="mr-1 h-3 w-3" />
                          Entrada
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <ArrowUpCircle className="mr-1 h-3 w-3" />
                          Saída
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{mov.descricao || '-'}</p>
                        {(('categoria' in mov && mov.categoria) || ('parcela' in mov && mov.parcela)) && (
                          <p className="text-xs text-muted-foreground">
                            {'categoria' in mov && mov.categoria ? mov.categoria : `Parcela ${('parcela' in mov && mov.parcela) || ''}`}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className={`text-right font-medium ${mov.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                      {mov.tipo === 'entrada' ? '+' : '-'} {formatCurrency(mov.valor)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
