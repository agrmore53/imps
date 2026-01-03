'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import {
  Plus,
  ClipboardList,
  MoreHorizontal,
  Play,
  CheckCircle,
  XCircle,
  FileText,
  Loader2,
  AlertTriangle,
  Package,
  BarChart3,
} from 'lucide-react'

interface Inventario {
  id: string
  numero: number
  descricao: string
  data_inicio: string
  data_fim: string | null
  status: 'em_andamento' | 'finalizado' | 'cancelado'
  tipo: 'completo' | 'parcial'
  contagem_cega: boolean
  total_produtos: number
  total_contados: number
  total_divergencias: number
  valor_divergencia: number
  usuarios: { nome: string } | null
}

export default function InventarioPage() {
  const router = useRouter()
  const supabase = createClient()
  const [inventarios, setInventarios] = useState<Inventario[]>([])
  const [loading, setLoading] = useState(true)
  const [resumo, setResumo] = useState({
    total: 0,
    emAndamento: 0,
    finalizados: 0,
    divergenciasTotal: 0,
  })

  useEffect(() => {
    fetchInventarios()
  }, [])

  async function fetchInventarios() {
    try {
      const { data, error } = await supabase
        .from('inventarios')
        .select(`
          id,
          numero,
          descricao,
          data_inicio,
          data_fim,
          status,
          tipo,
          contagem_cega,
          total_produtos,
          total_contados,
          total_divergencias,
          valor_divergencia,
          usuarios:usuario_id (nome)
        `)
        .order('data_inicio', { ascending: false })

      if (error) throw error

      const inventariosFormatados: Inventario[] = (data || []).map((inv: any) => ({
        ...inv,
        usuarios: Array.isArray(inv.usuarios) ? inv.usuarios[0] || null : inv.usuarios,
      }))

      setInventarios(inventariosFormatados)

      // Calcular resumo
      const emAndamento = inventariosFormatados.filter(i => i.status === 'em_andamento').length
      const finalizados = inventariosFormatados.filter(i => i.status === 'finalizado').length
      const divergenciasTotal = inventariosFormatados
        .filter(i => i.status === 'finalizado')
        .reduce((acc, i) => acc + i.total_divergencias, 0)

      setResumo({
        total: inventariosFormatados.length,
        emAndamento,
        finalizados,
        divergenciasTotal,
      })
    } catch (error) {
      console.error('Erro ao buscar inventários:', error)
      toast.error('Erro ao carregar inventários')
    } finally {
      setLoading(false)
    }
  }

  async function cancelarInventario(id: string) {
    if (!confirm('Tem certeza que deseja cancelar este inventário?')) return

    try {
      const { error } = await supabase
        .from('inventarios')
        .update({ status: 'cancelado' })
        .eq('id', id)

      if (error) throw error

      toast.success('Inventário cancelado')
      fetchInventarios()
    } catch (error) {
      toast.error('Erro ao cancelar inventário')
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

  function getStatusBadge(status: string) {
    switch (status) {
      case 'em_andamento':
        return <Badge className="bg-blue-500">Em Andamento</Badge>
      case 'finalizado':
        return <Badge className="bg-green-500">Finalizado</Badge>
      case 'cancelado':
        return <Badge variant="destructive">Cancelado</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventário de Estoque</h1>
          <p className="text-muted-foreground">
            Contagem física e ajuste de estoque
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/estoque/inventario/novo">
            <Plus className="mr-2 h-4 w-4" />
            Novo Inventário
          </Link>
        </Button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Inventários</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resumo.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
            <Play className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{resumo.emAndamento}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Finalizados</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{resumo.finalizados}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Divergências</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{resumo.divergenciasTotal}</div>
            <p className="text-xs text-muted-foreground">itens com diferença</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Inventários */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Inventários</CardTitle>
          <CardDescription>
            Lista de todos os inventários realizados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {inventarios.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum inventário realizado ainda</p>
              <Button className="mt-4" asChild>
                <Link href="/dashboard/estoque/inventario/novo">
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Primeiro Inventário
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Data Início</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-center">Progresso</TableHead>
                  <TableHead className="text-center">Divergências</TableHead>
                  <TableHead className="text-right">Valor Diverg.</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventarios.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono">#{inv.numero}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{inv.descricao || 'Inventário Geral'}</p>
                        <p className="text-xs text-muted-foreground">
                          Por: {inv.usuarios?.nome || 'Sistema'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(inv.data_inicio)}</TableCell>
                    <TableCell>{getStatusBadge(inv.status)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {inv.tipo === 'completo' ? 'Completo' : 'Parcial'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="font-medium">{inv.total_contados}</span>
                        <span className="text-muted-foreground">/</span>
                        <span>{inv.total_produtos}</span>
                      </div>
                      {inv.total_produtos > 0 && (
                        <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                          <div
                            className="bg-primary h-1.5 rounded-full"
                            style={{
                              width: `${(inv.total_contados / inv.total_produtos) * 100}%`,
                            }}
                          />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {inv.total_divergencias > 0 ? (
                        <Badge variant="destructive">{inv.total_divergencias}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {inv.valor_divergencia !== 0 ? (
                        <span className={inv.valor_divergencia < 0 ? 'text-red-600' : 'text-green-600'}>
                          {formatCurrency(inv.valor_divergencia)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {inv.status === 'em_andamento' && (
                            <DropdownMenuItem
                              onClick={() => router.push(`/dashboard/estoque/inventario/${inv.id}/contagem`)}
                            >
                              <ClipboardList className="mr-2 h-4 w-4" />
                              Continuar Contagem
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => router.push(`/dashboard/estoque/inventario/${inv.id}`)}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          {inv.status === 'finalizado' && (
                            <DropdownMenuItem
                              onClick={() => router.push(`/dashboard/estoque/inventario/${inv.id}/relatorio`)}
                            >
                              <BarChart3 className="mr-2 h-4 w-4" />
                              Relatório
                            </DropdownMenuItem>
                          )}
                          {inv.status === 'em_andamento' && (
                            <DropdownMenuItem
                              onClick={() => cancelarInventario(inv.id)}
                              className="text-red-600"
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Cancelar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
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
