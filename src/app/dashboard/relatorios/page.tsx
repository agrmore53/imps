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
  Users,
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
  unidade: string
  total_vendido?: number
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
  const [resumoVendas, setResumoVendas] = useState({
    total: 0,
    quantidade: 0,
    ticketMedio: 0,
  })
  const [resumoEstoque, setResumoEstoque] = useState({
    totalProdutos: 0,
    valorEstoque: 0,
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
        .eq('status', 'concluida')
        .gte('data_hora', `${dataInicio}T00:00:00`)
        .lte('data_hora', `${dataFim}T23:59:59`)
        .order('data_hora', { ascending: false })

      if (error) throw error

      // Transform data to match expected interface (Supabase returns relations as arrays)
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

      toast.success('Relatório gerado com sucesso!')
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
        .select('id, codigo, nome, estoque_atual, estoque_minimo, preco_venda, unidade')
        .eq('ativo', true)
        .order('nome')

      if (error) throw error

      setProdutos(data || [])

      const totalProdutos = data?.length || 0
      const valorEstoque = data?.reduce((acc, p) => acc + (p.estoque_atual * p.preco_venda), 0) || 0
      const baixoEstoque = data?.filter(p => p.estoque_atual <= p.estoque_minimo).length || 0

      setResumoEstoque({
        totalProdutos,
        valorEstoque,
        baixoEstoque,
      })

      toast.success('Relatório gerado com sucesso!')
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
          produtos (id, codigo, nome, preco_venda, unidade)
        `)
        .gte('created_at', `${dataInicio}T00:00:00`)
        .lte('created_at', `${dataFim}T23:59:59`)

      if (error) throw error

      // Agrupar por produto
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
              unidade: item.produtos.unidade,
              estoque_atual: 0,
              estoque_minimo: 0,
              total_vendido: 0,
            }
          }
          agrupado[id].total_vendido! += item.quantidade
        }
      })

      const produtosOrdenados = Object.values(agrupado).sort(
        (a, b) => (b.total_vendido || 0) - (a.total_vendido || 0)
      )

      setProdutos(produtosOrdenados)
      toast.success('Relatório gerado com sucesso!')
    } catch (error) {
      toast.error('Erro ao gerar relatório')
    } finally {
      setLoading(false)
    }
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-muted-foreground">
          Análises e relatórios do seu negócio
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="vendas">
            <ShoppingCart className="mr-2 h-4 w-4" />
            Vendas
          </TabsTrigger>
          <TabsTrigger value="produtos">
            <Package className="mr-2 h-4 w-4" />
            Estoque
          </TabsTrigger>
          <TabsTrigger value="mais-vendidos">
            <TrendingUp className="mr-2 h-4 w-4" />
            Mais Vendidos
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
              <Button onClick={buscarRelatorioProdutos} disabled={loading}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                Gerar Relatório
              </Button>

              {resumoEstoque.totalProdutos > 0 && (
                <div className="grid gap-4 md:grid-cols-3">
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
                          <p className="text-sm text-muted-foreground">Valor em Estoque</p>
                          <p className="text-2xl font-bold">{formatCurrency(resumoEstoque.valorEstoque)}</p>
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
                      <TableHead className="text-right">Est. Mínimo</TableHead>
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
                  <Label htmlFor="dataInicioMV">Data Início</Label>
                  <Input
                    id="dataInicioMV"
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dataFimMV">Data Fim</Label>
                  <Input
                    id="dataFimMV"
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
              </div>

              {produtos.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Rank</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Qtd. Vendida</TableHead>
                      <TableHead className="text-right">Preço Unit.</TableHead>
                      <TableHead className="text-right">Total Faturado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {produtos.map((produto, index) => (
                      <TableRow key={produto.id}>
                        <TableCell>
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                            {index + 1}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">{produto.codigo}</TableCell>
                        <TableCell>{produto.nome}</TableCell>
                        <TableCell className="text-right font-medium">
                          {produto.total_vendido} {produto.unidade}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(produto.preco_venda)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          {formatCurrency((produto.total_vendido || 0) * produto.preco_venda)}
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
      </Tabs>
    </div>
  )
}
