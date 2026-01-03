'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
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
import { toast } from 'sonner'
import {
  ArrowLeft,
  Loader2,
  Package,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  FileSpreadsheet,
  Printer,
  Calendar,
  User,
  ClipboardList,
} from 'lucide-react'

interface ItemInventario {
  id: string
  produto_id: string
  quantidade_sistema: number
  quantidade_contagem_1: number | null
  quantidade_final: number | null
  divergencia: number | null
  valor_divergencia: number | null
  status: string
  motivo_ajuste: string | null
  produtos: {
    codigo: string
    nome: string
    unidade: string
    preco_custo: number
  }
}

interface Inventario {
  id: string
  numero: number
  descricao: string
  data_inicio: string
  data_fim: string | null
  status: string
  tipo: string
  contagem_cega: boolean
  total_produtos: number
  total_contados: number
  total_divergencias: number
  valor_divergencia: number
  observacoes: string | null
  usuarios: { nome: string } | null
}

export default function DetalhesInventarioPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [inventario, setInventario] = useState<Inventario | null>(null)
  const [itens, setItens] = useState<ItemInventario[]>([])

  useEffect(() => {
    fetchInventario()
  }, [params.id])

  async function fetchInventario() {
    try {
      const { data: inv, error: invError } = await supabase
        .from('inventarios')
        .select(`
          *,
          usuarios:usuario_id (nome)
        `)
        .eq('id', params.id)
        .single()

      if (invError) throw invError

      setInventario({
        ...inv,
        usuarios: Array.isArray(inv.usuarios) ? inv.usuarios[0] : inv.usuarios,
      })

      const { data: itensData, error: itensError } = await supabase
        .from('inventario_itens')
        .select(`
          *,
          produtos (codigo, nome, unidade, preco_custo)
        `)
        .eq('inventario_id', params.id)
        .order('produtos(nome)')

      if (itensError) throw itensError

      const itensFormatados: ItemInventario[] = (itensData || []).map((item: any) => ({
        ...item,
        produtos: Array.isArray(item.produtos) ? item.produtos[0] : item.produtos,
      }))

      setItens(itensFormatados)
    } catch (error) {
      console.error('Erro ao buscar inventário:', error)
      toast.error('Erro ao carregar inventário')
    } finally {
      setLoading(false)
    }
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

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  function exportarExcel() {
    if (itens.length === 0) {
      toast.error('Não há dados para exportar')
      return
    }

    const dados = itens.map((item, i) => ({
      '#': i + 1,
      Codigo: item.produtos.codigo,
      Produto: item.produtos.nome,
      Unidade: item.produtos.unidade,
      'Qtd Sistema': item.quantidade_sistema,
      'Qtd Contagem': item.quantidade_final || 0,
      Diferenca: item.divergencia || 0,
      'Valor Diferenca': item.valor_divergencia || 0,
      Status: item.status,
    }))

    const headers = Object.keys(dados[0])
    const csvContent = [
      headers.join(';'),
      ...dados.map((row) =>
        headers.map((header) => {
          let value = row[header as keyof typeof row]
          if (typeof value === 'number') {
            value = value.toString().replace('.', ',')
          }
          return `"${value || ''}"`
        }).join(';')
      ),
    ].join('\n')

    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `inventario_${inventario?.numero}_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)

    toast.success('Arquivo exportado!')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!inventario) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Inventário não encontrado</p>
      </div>
    )
  }

  const itensDivergentes = itens.filter((i) => i.divergencia !== null && i.divergencia !== 0)
  const itensSobra = itensDivergentes.filter((i) => (i.divergencia || 0) > 0)
  const itensFalta = itensDivergentes.filter((i) => (i.divergencia || 0) < 0)

  const valorSobra = itensSobra.reduce((acc, i) => acc + (i.valor_divergencia || 0), 0)
  const valorFalta = itensFalta.reduce((acc, i) => acc + Math.abs(i.valor_divergencia || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/estoque/inventario">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">
                Inventário #{inventario.numero}
              </h1>
              {inventario.status === 'em_andamento' ? (
                <Badge className="bg-blue-500">Em Andamento</Badge>
              ) : inventario.status === 'finalizado' ? (
                <Badge className="bg-green-500">Finalizado</Badge>
              ) : (
                <Badge variant="destructive">Cancelado</Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {inventario.descricao || 'Inventário Geral'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {inventario.status === 'em_andamento' && (
            <Button asChild>
              <Link href={`/dashboard/estoque/inventario/${params.id}/contagem`}>
                <ClipboardList className="mr-2 h-4 w-4" />
                Continuar Contagem
              </Link>
            </Button>
          )}
          <Button variant="outline" onClick={exportarExcel}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Informações do Inventário */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Calendar className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Início</p>
                <p className="font-medium">{formatDate(inventario.data_inicio)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <User className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Responsável</p>
                <p className="font-medium">{inventario.usuarios?.nome || 'Sistema'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Package className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Produtos</p>
                <p className="text-2xl font-bold">{inventario.total_produtos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={inventario.total_divergencias > 0 ? 'border-orange-300' : 'border-green-300'}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              {inventario.total_divergencias > 0 ? (
                <AlertTriangle className="h-8 w-8 text-orange-500" />
              ) : (
                <CheckCircle className="h-8 w-8 text-green-500" />
              )}
              <div>
                <p className="text-sm text-muted-foreground">Divergências</p>
                <p className={`text-2xl font-bold ${
                  inventario.total_divergencias > 0 ? 'text-orange-600' : 'text-green-600'
                }`}>
                  {inventario.total_divergencias}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumo de Divergências */}
      {inventario.status === 'finalizado' && inventario.total_divergencias > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-green-50 dark:bg-green-900/20 border-green-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <TrendingUp className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm text-green-700 dark:text-green-400">Sobras</p>
                  <p className="text-2xl font-bold text-green-700">{itensSobra.length} itens</p>
                  <p className="text-sm text-green-600">{formatCurrency(valorSobra)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-red-50 dark:bg-red-900/20 border-red-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <TrendingDown className="h-8 w-8 text-red-600" />
                <div>
                  <p className="text-sm text-red-700 dark:text-red-400">Faltas</p>
                  <p className="text-2xl font-bold text-red-700">{itensFalta.length} itens</p>
                  <p className="text-sm text-red-600">-{formatCurrency(valorFalta)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <AlertTriangle className={`h-8 w-8 ${
                  inventario.valor_divergencia >= 0 ? 'text-green-600' : 'text-red-600'
                }`} />
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Divergência</p>
                  <p className={`text-2xl font-bold ${
                    inventario.valor_divergencia >= 0 ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {formatCurrency(inventario.valor_divergencia)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabela de Itens */}
      <Card>
        <CardHeader>
          <CardTitle>Itens do Inventário</CardTitle>
          <CardDescription>
            Detalhamento de todos os produtos inventariados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Sistema</TableHead>
                <TableHead className="text-right">Contagem</TableHead>
                <TableHead className="text-right">Diferença</TableHead>
                <TableHead className="text-right">Valor Dif.</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((item) => {
                const temDivergencia = item.divergencia !== null && item.divergencia !== 0
                return (
                  <TableRow key={item.id} className={temDivergencia ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''}>
                    <TableCell className="font-mono">{item.produtos.codigo}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.produtos.nome}</p>
                        <p className="text-xs text-muted-foreground">{item.produtos.unidade}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{item.quantidade_sistema}</TableCell>
                    <TableCell className="text-right font-medium">
                      {item.quantidade_final ?? '-'}
                    </TableCell>
                    <TableCell className={`text-right font-bold ${
                      (item.divergencia || 0) > 0
                        ? 'text-green-600'
                        : (item.divergencia || 0) < 0
                        ? 'text-red-600'
                        : ''
                    }`}>
                      {item.divergencia !== null && item.divergencia !== 0 ? (
                        <>
                          {item.divergencia > 0 ? '+' : ''}{item.divergencia}
                        </>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className={`text-right ${
                      (item.valor_divergencia || 0) > 0
                        ? 'text-green-600'
                        : (item.valor_divergencia || 0) < 0
                        ? 'text-red-600'
                        : ''
                    }`}>
                      {item.valor_divergencia !== null && item.valor_divergencia !== 0
                        ? formatCurrency(item.valor_divergencia)
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {item.status === 'pendente' ? (
                        <Badge variant="secondary">Pendente</Badge>
                      ) : temDivergencia ? (
                        <Badge className="bg-orange-500">Divergente</Badge>
                      ) : (
                        <Badge className="bg-green-500">OK</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Observações */}
      {inventario.observacoes && (
        <Card>
          <CardHeader>
            <CardTitle>Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{inventario.observacoes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
