import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Boxes, ArrowUpCircle, ArrowDownCircle, AlertTriangle, FileUp, ClipboardList } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function EstoquePage() {
  const supabase = await createClient()

  // Buscar produtos com estoque
  const { data: produtos } = await supabase
    .from('produtos')
    .select('id, codigo, nome, estoque_atual, estoque_minimo, unidade, preco_custo')
    .eq('ativo', true)
    .order('nome')

  // Buscar movimentações recentes
  const { data: movimentos } = await supabase
    .from('estoque_movimentos')
    .select(`
      id,
      tipo,
      quantidade,
      custo_unitario,
      documento_origem,
      observacao,
      data_hora,
      produtos (nome, codigo),
      usuarios (nome)
    `)
    .order('data_hora', { ascending: false })
    .limit(20)

  // Calcular alertas
  const produtosBaixoEstoque = produtos?.filter(
    (p) => p.estoque_atual <= p.estoque_minimo
  ) || []

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
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Controle de Estoque</h1>
          <p className="text-muted-foreground">
            Gerencie o estoque de produtos
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/estoque/inventario">
              <ClipboardList className="mr-2 h-4 w-4" />
              Inventário
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/estoque/importar-xml">
              <FileUp className="mr-2 h-4 w-4" />
              Importar XML
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/estoque/entrada">
              <ArrowDownCircle className="mr-2 h-4 w-4" />
              Entrada
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/estoque/saida">
              <ArrowUpCircle className="mr-2 h-4 w-4" />
              Saída
            </Link>
          </Button>
        </div>
      </div>

      {/* Alerta de estoque baixo */}
      {produtosBaixoEstoque.length > 0 && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-500">
              <AlertTriangle className="h-5 w-5" />
              Produtos com Estoque Baixo ({produtosBaixoEstoque.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {produtosBaixoEstoque.slice(0, 5).map((p) => (
                <Badge key={p.id} variant="outline" className="text-yellow-700 border-yellow-500">
                  {p.nome} ({p.estoque_atual} {p.unidade})
                </Badge>
              ))}
              {produtosBaixoEstoque.length > 5 && (
                <Badge variant="outline" className="text-yellow-700 border-yellow-500">
                  +{produtosBaixoEstoque.length - 5} mais
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="posicao" className="space-y-4">
        <TabsList>
          <TabsTrigger value="posicao">Posição de Estoque</TabsTrigger>
          <TabsTrigger value="movimentos">Movimentações</TabsTrigger>
        </TabsList>

        {/* Posição de Estoque */}
        <TabsContent value="posicao">
          <Card>
            <CardHeader>
              <CardTitle>Posição Atual</CardTitle>
              <CardDescription>
                {produtos?.length || 0} produto(s) cadastrado(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!produtos || produtos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Boxes className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">Nenhum produto encontrado</h3>
                  <p className="text-muted-foreground mb-4">
                    Cadastre produtos para visualizar o estoque
                  </p>
                  <Button asChild>
                    <Link href="/dashboard/produtos/novo">
                      <Plus className="mr-2 h-4 w-4" />
                      Cadastrar Produto
                    </Link>
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Estoque Atual</TableHead>
                      <TableHead className="text-right">Estoque Mínimo</TableHead>
                      <TableHead className="text-right">Custo Unit.</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {produtos.map((produto) => {
                      const valorTotal = produto.estoque_atual * (produto.preco_custo || 0)
                      const estoqueBaixo = produto.estoque_atual <= produto.estoque_minimo
                      return (
                        <TableRow key={produto.id}>
                          <TableCell className="font-mono">{produto.codigo}</TableCell>
                          <TableCell className="font-medium">{produto.nome}</TableCell>
                          <TableCell className="text-right">
                            <span className={estoqueBaixo ? 'text-red-600 font-semibold' : ''}>
                              {produto.estoque_atual} {produto.unidade}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {produto.estoque_minimo} {produto.unidade}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(produto.preco_custo || 0)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(valorTotal)}
                          </TableCell>
                          <TableCell>
                            {estoqueBaixo ? (
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

        {/* Movimentações */}
        <TabsContent value="movimentos">
          <Card>
            <CardHeader>
              <CardTitle>Últimas Movimentações</CardTitle>
              <CardDescription>
                Histórico de entradas e saídas de estoque
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!movimentos || movimentos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Boxes className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">Nenhuma movimentação</h3>
                  <p className="text-muted-foreground">
                    As movimentações de estoque aparecerão aqui
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Usuário</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movimentos.map((mov: any) => (
                      <TableRow key={mov.id}>
                        <TableCell className="text-sm">
                          {formatDate(mov.data_hora)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              mov.tipo === 'entrada'
                                ? 'default'
                                : mov.tipo === 'saida'
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {mov.tipo === 'entrada' && (
                              <ArrowDownCircle className="mr-1 h-3 w-3" />
                            )}
                            {mov.tipo === 'saida' && (
                              <ArrowUpCircle className="mr-1 h-3 w-3" />
                            )}
                            {mov.tipo.charAt(0).toUpperCase() + mov.tipo.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{mov.produtos?.nome}</p>
                            <p className="text-xs text-muted-foreground">
                              {mov.produtos?.codigo}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {mov.tipo === 'entrada' ? '+' : '-'}{mov.quantidade}
                        </TableCell>
                        <TableCell className="text-sm">
                          {mov.documento_origem || '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {mov.usuarios?.nome || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
