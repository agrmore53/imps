'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  BarChart3,
  ShoppingCart,
  Package,
  DollarSign,
  Loader2,
  Download,
  Search,
  TrendingUp,
  CreditCard,
  Banknote,
  QrCode,
  FileSpreadsheet,
  Users,
  Calendar,
  Wallet,
} from 'lucide-react'

interface VendaRelatorio {
  id: string
  numero: number
  data_hora: string
  total: number
  status: string
  clientes: { nome: string } | null
  usuarios: { nome: string } | null
}

interface ProdutoRelatorio {
  id: string
  codigo: string
  nome: string
  estoque_atual: number
  estoque_minimo: number
  preco_venda: number
  preco_custo: number
  unidade: string
  total_vendido?: number
  valor_vendido?: number
}

interface PagamentoRelatorio {
  forma_pagamento: string
  total: number
  quantidade: number
}

interface ResumoFinanceiro {
  total_vendas: number
  total_custo: number
  lucro_bruto: number
  margem: number
  ticket_medio: number
  quantidade_vendas: number
}

interface ProdutoCurvaABC {
  id: string
  codigo: string
  nome: string
  quantidade_vendida: number
  valor_vendido: number
  percentual: number
  percentual_acumulado: number
  classe: 'A' | 'B' | 'C'
}

export default function RelatoriosPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('vendas')

  // Filtros de data
  const hoje = new Date()
  const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)

  const [dataInicio, setDataInicio] = useState(primeiroDiaMes.toISOString().split('T')[0])
  const [dataFim, setDataFim] = useState(hoje.toISOString().split('T')[0])

  // Dados dos relatórios
  const [vendas, setVendas] = useState<VendaRelatorio[]>([])
  const [produtos, setProdutos] = useState<ProdutoRelatorio[]>([])
  const [pagamentos, setPagamentos] = useState<PagamentoRelatorio[]>([])
  const [resumoFinanceiro, setResumoFinanceiro] = useState<ResumoFinanceiro | null>(null)
  const [curvaABC, setCurvaABC] = useState<ProdutoCurvaABC[]>([])
  const [resumoCurvaABC, setResumoCurvaABC] = useState({
    totalFaturamento: 0,
    qtdClasseA: 0,
    qtdClasseB: 0,
    qtdClasseC: 0,
    valorClasseA: 0,
    valorClasseB: 0,
    valorClasseC: 0,
  })

  const [resumoVendas, setResumoVendas] = useState({
    total: 0,
    quantidade: 0,
    ticketMedio: 0,
  })
  const [resumoEstoque, setResumoEstoque] = useState({
    totalProdutos: 0,
    valorEstoque: 0,
    valorCusto: 0,
    baixoEstoque: 0,
  })

  async function buscarRelatorioVendas() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('vendas')
        .select(`
          id,
          numero,
          data_hora,
          total,
          status,
          clientes (nome),
          usuarios (nome)
        `)
        .eq('status', 'finalizada')
        .gte('data_hora', `${dataInicio}T00:00:00`)
        .lte('data_hora', `${dataFim}T23:59:59`)
        .order('data_hora', { ascending: false })

      if (error) throw error

      const vendasFormatadas: VendaRelatorio[] = (data || []).map((v: any) => ({
        id: v.id,
        numero: v.numero,
        data_hora: v.data_hora,
        total: v.total,
        status: v.status,
        clientes: Array.isArray(v.clientes) ? v.clientes[0] || null : v.clientes,
        usuarios: Array.isArray(v.usuarios) ? v.usuarios[0] || null : v.usuarios,
      }))

      setVendas(vendasFormatadas)

      const total = data?.reduce((acc, v) => acc + v.total, 0) || 0
      const quantidade = data?.length || 0
      setResumoVendas({
        total,
        quantidade,
        ticketMedio: quantidade > 0 ? total / quantidade : 0,
      })

      toast.success('Relatório gerado!')
    } catch (error) {
      toast.error('Erro ao gerar relatório')
    } finally {
      setLoading(false)
    }
  }

  async function buscarRelatorioProdutos() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('id, codigo, nome, estoque_atual, estoque_minimo, preco_venda, preco_custo, unidade')
        .eq('ativo', true)
        .order('nome')

      if (error) throw error

      setProdutos(data || [])

      const totalProdutos = data?.length || 0
      const valorEstoque = data?.reduce((acc, p) => acc + (p.estoque_atual * p.preco_venda), 0) || 0
      const valorCusto = data?.reduce((acc, p) => acc + (p.estoque_atual * (p.preco_custo || 0)), 0) || 0
      const baixoEstoque = data?.filter(p => p.estoque_atual <= p.estoque_minimo).length || 0

      setResumoEstoque({
        totalProdutos,
        valorEstoque,
        valorCusto,
        baixoEstoque,
      })

      toast.success('Relatório gerado!')
    } catch (error) {
      toast.error('Erro ao gerar relatório')
    } finally {
      setLoading(false)
    }
  }

  async function buscarRelatorioMaisVendidos() {
    setLoading(true)
    try {
      const { data: itensVendidos, error } = await supabase
        .from('venda_itens')
        .select(`
          produto_id,
          quantidade,
          preco_unitario,
          total,
          produtos (id, codigo, nome, preco_venda, preco_custo, unidade)
        `)
        .gte('created_at', `${dataInicio}T00:00:00`)
        .lte('created_at', `${dataFim}T23:59:59`)

      if (error) throw error

      const agrupado: { [key: string]: ProdutoRelatorio } = {}
      itensVendidos?.forEach((item: any) => {
        if (item.produtos) {
          const id = item.produto_id
          if (!agrupado[id]) {
            agrupado[id] = {
              id: item.produtos.id,
              codigo: item.produtos.codigo,
              nome: item.produtos.nome,
              preco_venda: item.produtos.preco_venda,
              preco_custo: item.produtos.preco_custo || 0,
              unidade: item.produtos.unidade,
              estoque_atual: 0,
              estoque_minimo: 0,
              total_vendido: 0,
              valor_vendido: 0,
            }
          }
          agrupado[id].total_vendido! += item.quantidade
          agrupado[id].valor_vendido! += item.total
        }
      })

      const produtosOrdenados = Object.values(agrupado).sort(
        (a, b) => (b.valor_vendido || 0) - (a.valor_vendido || 0)
      )

      setProdutos(produtosOrdenados)
      toast.success('Relatório gerado!')
    } catch (error) {
      toast.error('Erro ao gerar relatório')
    } finally {
      setLoading(false)
    }
  }

  async function buscarRelatorioPagamentos() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('venda_pagamentos')
        .select(`
          forma_pagamento,
          valor,
          vendas!inner (data_hora, status)
        `)
        .eq('vendas.status', 'finalizada')
        .gte('vendas.data_hora', `${dataInicio}T00:00:00`)
        .lte('vendas.data_hora', `${dataFim}T23:59:59`)

      if (error) throw error

      // Agrupar por forma de pagamento
      const agrupado: { [key: string]: PagamentoRelatorio } = {}
      data?.forEach((pag: any) => {
        const forma = pag.forma_pagamento
        if (!agrupado[forma]) {
          agrupado[forma] = {
            forma_pagamento: forma,
            total: 0,
            quantidade: 0,
          }
        }
        agrupado[forma].total += pag.valor
        agrupado[forma].quantidade++
      })

      const pagamentosOrdenados = Object.values(agrupado).sort((a, b) => b.total - a.total)
      setPagamentos(pagamentosOrdenados)

      toast.success('Relatório gerado!')
    } catch (error) {
      toast.error('Erro ao gerar relatório')
    } finally {
      setLoading(false)
    }
  }

  async function buscarResumoFinanceiro() {
    setLoading(true)
    try {
      // Buscar vendas com itens
      const { data: vendas, error: vendasError } = await supabase
        .from('vendas')
        .select(`
          id,
          total,
          venda_itens (
            quantidade,
            preco_unitario,
            produtos (preco_custo)
          )
        `)
        .eq('status', 'finalizada')
        .gte('data_hora', `${dataInicio}T00:00:00`)
        .lte('data_hora', `${dataFim}T23:59:59`)

      if (vendasError) throw vendasError

      let totalVendas = 0
      let totalCusto = 0
      let quantidadeVendas = vendas?.length || 0

      vendas?.forEach((venda: any) => {
        totalVendas += venda.total
        venda.venda_itens?.forEach((item: any) => {
          const custoProduto = item.produtos?.preco_custo || 0
          totalCusto += item.quantidade * custoProduto
        })
      })

      const lucroBruto = totalVendas - totalCusto
      const margem = totalVendas > 0 ? (lucroBruto / totalVendas) * 100 : 0
      const ticketMedio = quantidadeVendas > 0 ? totalVendas / quantidadeVendas : 0

      setResumoFinanceiro({
        total_vendas: totalVendas,
        total_custo: totalCusto,
        lucro_bruto: lucroBruto,
        margem,
        ticket_medio: ticketMedio,
        quantidade_vendas: quantidadeVendas,
      })

      toast.success('Relatório gerado!')
    } catch (error) {
      toast.error('Erro ao gerar relatório')
    } finally {
      setLoading(false)
    }
  }

  async function buscarCurvaABC() {
    setLoading(true)
    try {
      const { data: itensVendidos, error } = await supabase
        .from('venda_itens')
        .select(`
          produto_id,
          quantidade,
          total,
          produtos (id, codigo, nome)
        `)
        .gte('created_at', `${dataInicio}T00:00:00`)
        .lte('created_at', `${dataFim}T23:59:59`)

      if (error) throw error

      // Agrupar por produto
      const agrupado: { [key: string]: { id: string; codigo: string; nome: string; quantidade: number; valor: number } } = {}
      itensVendidos?.forEach((item: any) => {
        if (item.produtos) {
          const id = item.produto_id
          if (!agrupado[id]) {
            agrupado[id] = {
              id: item.produtos.id,
              codigo: item.produtos.codigo,
              nome: item.produtos.nome,
              quantidade: 0,
              valor: 0,
            }
          }
          agrupado[id].quantidade += item.quantidade
          agrupado[id].valor += item.total
        }
      })

      // Ordenar por valor (decrescente)
      const produtosOrdenados = Object.values(agrupado).sort((a, b) => b.valor - a.valor)

      // Calcular total faturamento
      const totalFaturamento = produtosOrdenados.reduce((acc, p) => acc + p.valor, 0)

      // Calcular percentuais e classificar
      let acumulado = 0
      const produtosABC: ProdutoCurvaABC[] = produtosOrdenados.map((p) => {
        const percentual = totalFaturamento > 0 ? (p.valor / totalFaturamento) * 100 : 0
        acumulado += percentual

        let classe: 'A' | 'B' | 'C' = 'C'
        if (acumulado <= 80) {
          classe = 'A'
        } else if (acumulado <= 95) {
          classe = 'B'
        }

        return {
          id: p.id,
          codigo: p.codigo,
          nome: p.nome,
          quantidade_vendida: p.quantidade,
          valor_vendido: p.valor,
          percentual,
          percentual_acumulado: acumulado,
          classe,
        }
      })

      setCurvaABC(produtosABC)

      // Calcular resumo
      const classeA = produtosABC.filter(p => p.classe === 'A')
      const classeB = produtosABC.filter(p => p.classe === 'B')
      const classeC = produtosABC.filter(p => p.classe === 'C')

      setResumoCurvaABC({
        totalFaturamento,
        qtdClasseA: classeA.length,
        qtdClasseB: classeB.length,
        qtdClasseC: classeC.length,
        valorClasseA: classeA.reduce((acc, p) => acc + p.valor_vendido, 0),
        valorClasseB: classeB.reduce((acc, p) => acc + p.valor_vendido, 0),
        valorClasseC: classeC.reduce((acc, p) => acc + p.valor_vendido, 0),
      })

      toast.success('Curva ABC gerada!')
    } catch (error) {
      toast.error('Erro ao gerar Curva ABC')
    } finally {
      setLoading(false)
    }
  }

  function exportarExcel(dados: any[], nomeArquivo: string) {
    if (dados.length === 0) {
      toast.error('Não há dados para exportar')
      return
    }

    // Criar CSV
    const headers = Object.keys(dados[0])
    const csvContent = [
      headers.join(';'),
      ...dados.map(row =>
        headers.map(header => {
          let value = row[header]
          if (typeof value === 'object' && value !== null) {
            value = value.nome || JSON.stringify(value)
          }
          if (typeof value === 'number') {
            value = value.toString().replace('.', ',')
          }
          return `"${value || ''}"`
        }).join(';')
      )
    ].join('\n')

    // Adicionar BOM para Excel reconhecer UTF-8
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${nomeArquivo}_${dataInicio}_${dataFim}.csv`
    link.click()
    URL.revokeObjectURL(url)

    toast.success('Arquivo exportado!')
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  function formatDateTime(date: string) {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date))
  }

  function formatFormaPagamento(forma: string) {
    const nomes: Record<string, string> = {
      dinheiro: 'Dinheiro',
      cartao_credito: 'Cartão Crédito',
      cartao_debito: 'Cartão Débito',
      pix: 'PIX',
      crediario: 'Crediário',
    }
    return nomes[forma] || forma
  }

  function getIconePagamento(forma: string) {
    switch (forma) {
      case 'dinheiro':
        return <Banknote className="h-5 w-5 text-green-600" />
      case 'cartao_credito':
        return <CreditCard className="h-5 w-5 text-blue-600" />
      case 'cartao_debito':
        return <CreditCard className="h-5 w-5 text-purple-600" />
      case 'pix':
        return <QrCode className="h-5 w-5 text-teal-600" />
      default:
        return <Wallet className="h-5 w-5 text-gray-600" />
    }
  }

  const totalPagamentos = pagamentos.reduce((acc, p) => acc + p.total, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-muted-foreground">
          Análises e relatórios do seu negócio
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="vendas">
            <ShoppingCart className="mr-2 h-4 w-4" />
            Vendas
          </TabsTrigger>
          <TabsTrigger value="pagamentos">
            <CreditCard className="mr-2 h-4 w-4" />
            Pagamentos
          </TabsTrigger>
          <TabsTrigger value="mais-vendidos">
            <TrendingUp className="mr-2 h-4 w-4" />
            Mais Vendidos
          </TabsTrigger>
          <TabsTrigger value="curva-abc">
            <BarChart3 className="mr-2 h-4 w-4" />
            Curva ABC
          </TabsTrigger>
          <TabsTrigger value="produtos">
            <Package className="mr-2 h-4 w-4" />
            Estoque
          </TabsTrigger>
          <TabsTrigger value="financeiro">
            <DollarSign className="mr-2 h-4 w-4" />
            Financeiro
          </TabsTrigger>
        </TabsList>

        {/* Relatório de Vendas */}
        <TabsContent value="vendas" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Relatório de Vendas</CardTitle>
              <CardDescription>
                Visualize todas as vendas realizadas no período
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-2">
                  <Label htmlFor="dataInicio">Data Início</Label>
                  <Input
                    id="dataInicio"
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dataFim">Data Fim</Label>
                  <Input
                    id="dataFim"
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                  />
                </div>
                <Button onClick={buscarRelatorioVendas} disabled={loading}>
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  Gerar Relatório
                </Button>
                {vendas.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => exportarExcel(
                      vendas.map(v => ({
                        Numero: v.numero,
                        Data: formatDateTime(v.data_hora),
                        Cliente: v.clientes?.nome || 'Consumidor',
                        Vendedor: v.usuarios?.nome || '-',
                        Total: v.total,
                      })),
                      'vendas'
                    )}
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Exportar
                  </Button>
                )}
              </div>

              {resumoVendas.quantidade > 0 && (
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        <DollarSign className="h-8 w-8 text-green-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">Total Vendido</p>
                          <p className="text-2xl font-bold">{formatCurrency(resumoVendas.total)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        <ShoppingCart className="h-8 w-8 text-blue-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">Quantidade de Vendas</p>
                          <p className="text-2xl font-bold">{resumoVendas.quantidade}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        <BarChart3 className="h-8 w-8 text-purple-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">Ticket Médio</p>
                          <p className="text-2xl font-bold">{formatCurrency(resumoVendas.ticketMedio)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {vendas.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendas.map((venda) => (
                      <TableRow key={venda.id}>
                        <TableCell className="font-mono">#{venda.numero}</TableCell>
                        <TableCell>{formatDateTime(venda.data_hora)}</TableCell>
                        <TableCell>{venda.clientes?.nome || 'Consumidor'}</TableCell>
                        <TableCell>{venda.usuarios?.nome || '-'}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(venda.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Relatório de Pagamentos */}
        <TabsContent value="pagamentos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Vendas por Forma de Pagamento</CardTitle>
              <CardDescription>
                Análise das vendas por tipo de pagamento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-2">
                  <Label>Data Início</Label>
                  <Input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data Fim</Label>
                  <Input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                  />
                </div>
                <Button onClick={buscarRelatorioPagamentos} disabled={loading}>
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  Gerar Relatório
                </Button>
              </div>

              {pagamentos.length > 0 && (
                <>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {pagamentos.map((pag) => (
                      <Card key={pag.forma_pagamento}>
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-4">
                            {getIconePagamento(pag.forma_pagamento)}
                            <div className="flex-1">
                              <p className="text-sm text-muted-foreground">
                                {formatFormaPagamento(pag.forma_pagamento)}
                              </p>
                              <p className="text-xl font-bold">{formatCurrency(pag.total)}</p>
                              <p className="text-xs text-muted-foreground">
                                {pag.quantidade} transação(ões)
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Distribuição</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {pagamentos.map((pag) => {
                        const percentual = totalPagamentos > 0
                          ? (pag.total / totalPagamentos) * 100
                          : 0
                        return (
                          <div key={pag.forma_pagamento} className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="flex items-center gap-2">
                                {getIconePagamento(pag.forma_pagamento)}
                                {formatFormaPagamento(pag.forma_pagamento)}
                              </span>
                              <span className="font-medium">
                                {percentual.toFixed(1)}% ({formatCurrency(pag.total)})
                              </span>
                            </div>
                            <Progress value={percentual} className="h-2" />
                          </div>
                        )
                      })}
                    </CardContent>
                  </Card>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mais Vendidos */}
        <TabsContent value="mais-vendidos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Produtos Mais Vendidos</CardTitle>
              <CardDescription>
                Ranking dos produtos mais vendidos no período
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-2">
                  <Label>Data Início</Label>
                  <Input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data Fim</Label>
                  <Input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                  />
                </div>
                <Button onClick={buscarRelatorioMaisVendidos} disabled={loading}>
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  Gerar Relatório
                </Button>
                {produtos.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => exportarExcel(
                      produtos.map((p, i) => ({
                        Rank: i + 1,
                        Codigo: p.codigo,
                        Produto: p.nome,
                        Quantidade: p.total_vendido,
                        Valor_Total: p.valor_vendido,
                      })),
                      'mais_vendidos'
                    )}
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Exportar
                  </Button>
                )}
              </div>

              {produtos.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Rank</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Qtd. Vendida</TableHead>
                      <TableHead className="text-right">Total Faturado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {produtos.slice(0, 20).map((produto, index) => (
                      <TableRow key={produto.id}>
                        <TableCell>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                            index === 0 ? 'bg-yellow-100 text-yellow-700' :
                            index === 1 ? 'bg-gray-100 text-gray-700' :
                            index === 2 ? 'bg-orange-100 text-orange-700' :
                            'bg-primary/10 text-primary'
                          }`}>
                            {index + 1}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">{produto.codigo}</TableCell>
                        <TableCell>{produto.nome}</TableCell>
                        <TableCell className="text-right font-medium">
                          {produto.total_vendido} {produto.unidade}
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          {formatCurrency(produto.valor_vendido || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {produtos.length === 0 && !loading && (
                <div className="text-center py-12 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Clique em "Gerar Relatório" para visualizar os produtos mais vendidos</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Curva ABC */}
        <TabsContent value="curva-abc" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Curva ABC - Análise de Pareto</CardTitle>
              <CardDescription>
                Classificação dos produtos por importância no faturamento (80-15-5)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-2">
                  <Label>Data Início</Label>
                  <Input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data Fim</Label>
                  <Input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                  />
                </div>
                <Button onClick={buscarCurvaABC} disabled={loading}>
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  Gerar Curva ABC
                </Button>
                {curvaABC.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => exportarExcel(
                      curvaABC.map((p, i) => ({
                        Rank: i + 1,
                        Codigo: p.codigo,
                        Produto: p.nome,
                        Quantidade: p.quantidade_vendida,
                        Valor: p.valor_vendido,
                        Percentual: p.percentual.toFixed(2),
                        Acumulado: p.percentual_acumulado.toFixed(2),
                        Classe: p.classe,
                      })),
                      'curva_abc'
                    )}
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Exportar
                  </Button>
                )}
              </div>

              {curvaABC.length > 0 && (
                <>
                  {/* Resumo das Classes */}
                  <div className="grid gap-4 md:grid-cols-4">
                    <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20 border-green-200">
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500 text-white text-xl font-bold mb-2">
                            A
                          </div>
                          <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                            {resumoCurvaABC.qtdClasseA} produtos
                          </p>
                          <p className="text-sm text-green-600 dark:text-green-500">
                            {formatCurrency(resumoCurvaABC.valorClasseA)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            ~80% do faturamento
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/30 dark:to-yellow-800/20 border-yellow-200">
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-yellow-500 text-white text-xl font-bold mb-2">
                            B
                          </div>
                          <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                            {resumoCurvaABC.qtdClasseB} produtos
                          </p>
                          <p className="text-sm text-yellow-600 dark:text-yellow-500">
                            {formatCurrency(resumoCurvaABC.valorClasseB)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            ~15% do faturamento
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/20 border-red-200">
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500 text-white text-xl font-bold mb-2">
                            C
                          </div>
                          <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                            {resumoCurvaABC.qtdClasseC} produtos
                          </p>
                          <p className="text-sm text-red-600 dark:text-red-500">
                            {formatCurrency(resumoCurvaABC.valorClasseC)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            ~5% do faturamento
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground text-lg font-bold mb-2">
                            <DollarSign className="h-6 w-6" />
                          </div>
                          <p className="text-2xl font-bold">
                            {formatCurrency(resumoCurvaABC.totalFaturamento)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Faturamento Total
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {curvaABC.length} produtos
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Barra Visual das Classes */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Distribuição do Faturamento</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex h-8 rounded-lg overflow-hidden">
                        <div
                          className="bg-green-500 flex items-center justify-center text-white text-xs font-medium"
                          style={{ width: `${(resumoCurvaABC.valorClasseA / resumoCurvaABC.totalFaturamento) * 100}%` }}
                        >
                          A ({((resumoCurvaABC.valorClasseA / resumoCurvaABC.totalFaturamento) * 100).toFixed(0)}%)
                        </div>
                        <div
                          className="bg-yellow-500 flex items-center justify-center text-white text-xs font-medium"
                          style={{ width: `${(resumoCurvaABC.valorClasseB / resumoCurvaABC.totalFaturamento) * 100}%` }}
                        >
                          B ({((resumoCurvaABC.valorClasseB / resumoCurvaABC.totalFaturamento) * 100).toFixed(0)}%)
                        </div>
                        <div
                          className="bg-red-500 flex items-center justify-center text-white text-xs font-medium"
                          style={{ width: `${(resumoCurvaABC.valorClasseC / resumoCurvaABC.totalFaturamento) * 100}%` }}
                        >
                          C ({((resumoCurvaABC.valorClasseC / resumoCurvaABC.totalFaturamento) * 100).toFixed(0)}%)
                        </div>
                      </div>
                      <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                        <span>{resumoCurvaABC.qtdClasseA} itens ({((resumoCurvaABC.qtdClasseA / curvaABC.length) * 100).toFixed(0)}%)</span>
                        <span>{resumoCurvaABC.qtdClasseB} itens ({((resumoCurvaABC.qtdClasseB / curvaABC.length) * 100).toFixed(0)}%)</span>
                        <span>{resumoCurvaABC.qtdClasseC} itens ({((resumoCurvaABC.qtdClasseC / curvaABC.length) * 100).toFixed(0)}%)</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Tabela de Produtos */}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Rank</TableHead>
                        <TableHead className="w-16">Classe</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Qtd.</TableHead>
                        <TableHead className="text-right">Faturamento</TableHead>
                        <TableHead className="text-right">%</TableHead>
                        <TableHead className="text-right">% Acum.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {curvaABC.map((produto, index) => (
                        <TableRow key={produto.id}>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell>
                            <Badge
                              className={
                                produto.classe === 'A'
                                  ? 'bg-green-500 hover:bg-green-600'
                                  : produto.classe === 'B'
                                  ? 'bg-yellow-500 hover:bg-yellow-600'
                                  : 'bg-red-500 hover:bg-red-600'
                              }
                            >
                              {produto.classe}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono">{produto.codigo}</TableCell>
                          <TableCell>{produto.nome}</TableCell>
                          <TableCell className="text-right">{produto.quantidade_vendida}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(produto.valor_vendido)}
                          </TableCell>
                          <TableCell className="text-right">{produto.percentual.toFixed(2)}%</TableCell>
                          <TableCell className="text-right font-medium">
                            {produto.percentual_acumulado.toFixed(2)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}

              {curvaABC.length === 0 && !loading && (
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Clique em "Gerar Curva ABC" para classificar os produtos</p>
                  <p className="text-sm mt-2">
                    A análise ABC identifica quais produtos são mais importantes para seu faturamento
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Relatório de Estoque */}
        <TabsContent value="produtos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Relatório de Estoque</CardTitle>
              <CardDescription>
                Posição atual do estoque de produtos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Button onClick={buscarRelatorioProdutos} disabled={loading}>
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  Gerar Relatório
                </Button>
                {produtos.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => exportarExcel(
                      produtos.map(p => ({
                        Codigo: p.codigo,
                        Produto: p.nome,
                        Estoque: p.estoque_atual,
                        Minimo: p.estoque_minimo,
                        Preco_Custo: p.preco_custo,
                        Preco_Venda: p.preco_venda,
                        Valor_Estoque: p.estoque_atual * p.preco_venda,
                      })),
                      'estoque'
                    )}
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Exportar
                  </Button>
                )}
              </div>

              {resumoEstoque.totalProdutos > 0 && (
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        <Package className="h-8 w-8 text-blue-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">Total de Produtos</p>
                          <p className="text-2xl font-bold">{resumoEstoque.totalProdutos}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        <DollarSign className="h-8 w-8 text-green-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">Valor Venda</p>
                          <p className="text-2xl font-bold">{formatCurrency(resumoEstoque.valorEstoque)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        <DollarSign className="h-8 w-8 text-orange-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">Valor Custo</p>
                          <p className="text-2xl font-bold">{formatCurrency(resumoEstoque.valorCusto)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className={resumoEstoque.baixoEstoque > 0 ? 'border-red-500' : ''}>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        <Package className={`h-8 w-8 ${resumoEstoque.baixoEstoque > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
                        <div>
                          <p className="text-sm text-muted-foreground">Estoque Baixo</p>
                          <p className={`text-2xl font-bold ${resumoEstoque.baixoEstoque > 0 ? 'text-red-600' : ''}`}>
                            {resumoEstoque.baixoEstoque}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {produtos.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Estoque</TableHead>
                      <TableHead className="text-right">Mínimo</TableHead>
                      <TableHead className="text-right">Preço Venda</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {produtos.map((produto) => {
                      const baixo = produto.estoque_atual <= produto.estoque_minimo
                      return (
                        <TableRow key={produto.id}>
                          <TableCell className="font-mono">{produto.codigo}</TableCell>
                          <TableCell>{produto.nome}</TableCell>
                          <TableCell className="text-right">
                            {produto.estoque_atual} {produto.unidade}
                          </TableCell>
                          <TableCell className="text-right">
                            {produto.estoque_minimo} {produto.unidade}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(produto.preco_venda)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(produto.estoque_atual * produto.preco_venda)}
                          </TableCell>
                          <TableCell>
                            {baixo ? (
                              <Badge variant="destructive">Baixo</Badge>
                            ) : (
                              <Badge variant="default">OK</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Resumo Financeiro */}
        <TabsContent value="financeiro" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Resumo Financeiro</CardTitle>
              <CardDescription>
                Análise de faturamento, custos e lucratividade
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-2">
                  <Label>Data Início</Label>
                  <Input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data Fim</Label>
                  <Input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                  />
                </div>
                <Button onClick={buscarResumoFinanceiro} disabled={loading}>
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  Gerar Relatório
                </Button>
              </div>

              {resumoFinanceiro && (
                <>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card className="bg-green-50 dark:bg-green-900/20 border-green-200">
                      <CardContent className="pt-6">
                        <div className="space-y-2">
                          <p className="text-sm text-green-700 dark:text-green-400">Total de Vendas</p>
                          <p className="text-3xl font-bold text-green-700 dark:text-green-400">
                            {formatCurrency(resumoFinanceiro.total_vendas)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {resumoFinanceiro.quantidade_vendas} vendas
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-orange-50 dark:bg-orange-900/20 border-orange-200">
                      <CardContent className="pt-6">
                        <div className="space-y-2">
                          <p className="text-sm text-orange-700 dark:text-orange-400">Custo das Mercadorias</p>
                          <p className="text-3xl font-bold text-orange-700 dark:text-orange-400">
                            {formatCurrency(resumoFinanceiro.total_custo)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            CMV (Custo Mercadoria Vendida)
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
                      <CardContent className="pt-6">
                        <div className="space-y-2">
                          <p className="text-sm text-blue-700 dark:text-blue-400">Lucro Bruto</p>
                          <p className="text-3xl font-bold text-blue-700 dark:text-blue-400">
                            {formatCurrency(resumoFinanceiro.lucro_bruto)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Margem: {resumoFinanceiro.margem.toFixed(1)}%
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                          <BarChart3 className="h-10 w-10 text-purple-500" />
                          <div>
                            <p className="text-sm text-muted-foreground">Ticket Médio</p>
                            <p className="text-2xl font-bold">{formatCurrency(resumoFinanceiro.ticket_medio)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                          <TrendingUp className="h-10 w-10 text-green-500" />
                          <div>
                            <p className="text-sm text-muted-foreground">Margem de Lucro</p>
                            <p className="text-2xl font-bold">{resumoFinanceiro.margem.toFixed(1)}%</p>
                          </div>
                        </div>
                        <div className="mt-4">
                          <Progress value={resumoFinanceiro.margem} className="h-3" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}

              {!resumoFinanceiro && !loading && (
                <div className="text-center py-12 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Clique em "Gerar Relatório" para visualizar o resumo financeiro</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
