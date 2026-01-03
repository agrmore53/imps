'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Search,
  Loader2,
  Package,
  CheckCircle,
  AlertTriangle,
  Clock,
  Save,
  BarChart3,
  Scan,
} from 'lucide-react'

interface ItemInventario {
  id: string
  produto_id: string
  quantidade_sistema: number
  quantidade_contagem_1: number | null
  quantidade_final: number | null
  divergencia: number | null
  status: 'pendente' | 'contado' | 'divergente' | 'ajustado'
  produtos: {
    id: string
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
  status: string
  contagem_cega: boolean
  total_produtos: number
  total_contados: number
}

export default function ContagemPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [inventario, setInventario] = useState<Inventario | null>(null)
  const [itens, setItens] = useState<ItemInventario[]>([])
  const [itensFiltrados, setItensFiltrados] = useState<ItemInventario[]>([])
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'pendente' | 'contado'>('todos')
  const [itemAtivo, setItemAtivo] = useState<string | null>(null)
  const [valorContagem, setValorContagem] = useState('')

  useEffect(() => {
    fetchInventario()
  }, [params.id])

  useEffect(() => {
    let filtrados = itens

    // Filtrar por busca
    if (busca.trim()) {
      const termo = busca.toLowerCase()
      filtrados = filtrados.filter(
        (i) =>
          i.produtos.nome.toLowerCase().includes(termo) ||
          i.produtos.codigo.toLowerCase().includes(termo)
      )
    }

    // Filtrar por status
    if (filtroStatus === 'pendente') {
      filtrados = filtrados.filter((i) => i.status === 'pendente')
    } else if (filtroStatus === 'contado') {
      filtrados = filtrados.filter((i) => i.status !== 'pendente')
    }

    setItensFiltrados(filtrados)
  }, [busca, filtroStatus, itens])

  async function fetchInventario() {
    try {
      // Buscar inventário
      const { data: inv, error: invError } = await supabase
        .from('inventarios')
        .select('id, numero, descricao, status, contagem_cega, total_produtos, total_contados')
        .eq('id', params.id)
        .single()

      if (invError) throw invError

      setInventario(inv)

      // Buscar itens
      const { data: itensData, error: itensError } = await supabase
        .from('inventario_itens')
        .select(`
          id,
          produto_id,
          quantidade_sistema,
          quantidade_contagem_1,
          quantidade_final,
          divergencia,
          status,
          produtos (id, codigo, nome, unidade, preco_custo)
        `)
        .eq('inventario_id', params.id)
        .order('produtos(nome)')

      if (itensError) throw itensError

      const itensFormatados: ItemInventario[] = (itensData || []).map((item: any) => ({
        ...item,
        produtos: Array.isArray(item.produtos) ? item.produtos[0] : item.produtos,
      }))

      setItens(itensFormatados)
      setItensFiltrados(itensFormatados)
    } catch (error) {
      console.error('Erro ao buscar inventário:', error)
      toast.error('Erro ao carregar inventário')
    } finally {
      setLoading(false)
    }
  }

  async function salvarContagem(itemId: string, quantidade: number) {
    setSaving(true)
    try {
      const item = itens.find((i) => i.id === itemId)
      if (!item) return

      const divergencia = quantidade - item.quantidade_sistema
      const novoStatus = divergencia !== 0 ? 'divergente' : 'contado'

      const { error } = await supabase
        .from('inventario_itens')
        .update({
          quantidade_contagem_1: quantidade,
          quantidade_final: quantidade,
          divergencia,
          valor_divergencia: divergencia * (item.produtos.preco_custo || 0),
          status: novoStatus,
        })
        .eq('id', itemId)

      if (error) throw error

      // Atualizar estado local
      setItens((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? {
                ...i,
                quantidade_contagem_1: quantidade,
                quantidade_final: quantidade,
                divergencia,
                status: novoStatus as any,
              }
            : i
        )
      )

      // Atualizar contagem total
      const totalContados = itens.filter(
        (i) => i.id === itemId || i.status !== 'pendente'
      ).length

      await supabase
        .from('inventarios')
        .update({ total_contados: totalContados })
        .eq('id', params.id)

      setInventario((prev) =>
        prev ? { ...prev, total_contados: totalContados } : prev
      )

      toast.success('Contagem salva!')
      setItemAtivo(null)
      setValorContagem('')

      // Focar no próximo item pendente
      const proximoPendente = itens.find(
        (i) => i.id !== itemId && i.status === 'pendente'
      )
      if (proximoPendente) {
        setItemAtivo(proximoPendente.id)
        setTimeout(() => inputRef.current?.focus(), 100)
      }
    } catch (error) {
      console.error('Erro ao salvar contagem:', error)
      toast.error('Erro ao salvar contagem')
    } finally {
      setSaving(false)
    }
  }

  async function finalizarInventario() {
    const pendentes = itens.filter((i) => i.status === 'pendente').length
    if (pendentes > 0) {
      toast.error(`Ainda há ${pendentes} produto(s) sem contagem`)
      return
    }

    if (!confirm('Tem certeza que deseja finalizar o inventário? Esta ação gerará os ajustes de estoque.')) {
      return
    }

    setSaving(true)
    try {
      // Calcular totais
      const divergencias = itens.filter((i) => i.divergencia !== 0)
      const valorDivergencia = divergencias.reduce(
        (acc, i) => acc + (i.divergencia || 0) * (i.produtos.preco_custo || 0),
        0
      )

      // Atualizar inventário
      const { error: invError } = await supabase
        .from('inventarios')
        .update({
          status: 'finalizado',
          data_fim: new Date().toISOString(),
          total_divergencias: divergencias.length,
          valor_divergencia: valorDivergencia,
        })
        .eq('id', params.id)

      if (invError) throw invError

      // Gerar movimentos de ajuste de estoque
      for (const item of divergencias) {
        if (item.divergencia && item.divergencia !== 0) {
          // Atualizar estoque do produto
          const { error: prodError } = await supabase
            .from('produtos')
            .update({
              estoque_atual: item.quantidade_final,
            })
            .eq('id', item.produto_id)

          if (prodError) {
            console.error('Erro ao atualizar estoque:', prodError)
          }

          // Registrar movimento de estoque
          const { error: movError } = await supabase
            .from('estoque_movimentos')
            .insert({
              produto_id: item.produto_id,
              tipo: item.divergencia > 0 ? 'entrada' : 'saida',
              quantidade: Math.abs(item.divergencia),
              custo_unitario: item.produtos.preco_custo || 0,
              documento_origem: `INV-${inventario?.numero}`,
              observacao: `Ajuste de inventário #${inventario?.numero}`,
            })

          if (movError) {
            console.error('Erro ao registrar movimento:', movError)
          }
        }
      }

      toast.success('Inventário finalizado com sucesso!')
      router.push(`/dashboard/estoque/inventario/${params.id}`)
    } catch (error) {
      console.error('Erro ao finalizar inventário:', error)
      toast.error('Erro ao finalizar inventário')
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent, itemId: string) {
    if (e.key === 'Enter') {
      const valor = parseFloat(valorContagem.replace(',', '.'))
      if (!isNaN(valor) && valor >= 0) {
        salvarContagem(itemId, valor)
      }
    } else if (e.key === 'Escape') {
      setItemAtivo(null)
      setValorContagem('')
    }
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

  const progresso = inventario.total_produtos > 0
    ? (inventario.total_contados / inventario.total_produtos) * 100
    : 0

  const pendentes = itens.filter((i) => i.status === 'pendente').length
  const contados = itens.filter((i) => i.status !== 'pendente').length
  const divergentes = itens.filter((i) => i.divergencia !== 0 && i.status !== 'pendente').length

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
            <h1 className="text-3xl font-bold tracking-tight">
              Contagem #{inventario.numero}
            </h1>
            <p className="text-muted-foreground">
              {inventario.descricao || 'Inventário Geral'}
            </p>
          </div>
        </div>
        <Button
          onClick={finalizarInventario}
          disabled={saving || pendentes > 0}
        >
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="mr-2 h-4 w-4" />
          )}
          Finalizar Inventário
        </Button>
      </div>

      {/* Progresso */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progresso da Contagem</span>
            <span className="text-sm text-muted-foreground">
              {contados} de {inventario.total_produtos} produtos
            </span>
          </div>
          <Progress value={progresso} className="h-3" />

          <div className="flex gap-4 mt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Pendentes: <strong>{pendentes}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">Contados: <strong>{contados}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span className="text-sm">Divergências: <strong>{divergentes}</strong></span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Itens */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Produtos para Contagem</CardTitle>
              <CardDescription>
                {inventario.contagem_cega
                  ? 'Modo cego: quantidade do sistema não exibida'
                  : 'Informe a quantidade encontrada para cada produto'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros */}
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou código..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-10"
              />
            </div>
            <Tabs value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as any)}>
              <TabsList>
                <TabsTrigger value="todos">Todos ({itens.length})</TabsTrigger>
                <TabsTrigger value="pendente">Pendentes ({pendentes})</TabsTrigger>
                <TabsTrigger value="contado">Contados ({contados})</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Lista */}
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {itensFiltrados.map((item) => {
                const isAtivo = itemAtivo === item.id
                const temDivergencia = item.divergencia !== null && item.divergencia !== 0

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-lg border transition-all ${
                      isAtivo
                        ? 'border-primary bg-primary/5 ring-2 ring-primary'
                        : item.status === 'pendente'
                        ? 'hover:bg-muted/50 cursor-pointer'
                        : temDivergencia
                        ? 'bg-orange-50 border-orange-200 dark:bg-orange-900/20'
                        : 'bg-green-50 border-green-200 dark:bg-green-900/20'
                    }`}
                    onClick={() => {
                      if (!isAtivo && item.status === 'pendente') {
                        setItemAtivo(item.id)
                        setValorContagem('')
                        setTimeout(() => inputRef.current?.focus(), 100)
                      }
                    }}
                  >
                    <div className="flex items-center gap-4">
                      {/* Info do Produto */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{item.produtos.nome}</p>
                          {item.status === 'pendente' ? (
                            <Badge variant="secondary">Pendente</Badge>
                          ) : temDivergencia ? (
                            <Badge className="bg-orange-500">Divergência</Badge>
                          ) : (
                            <Badge className="bg-green-500">OK</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Cód: {item.produtos.codigo} | Unidade: {item.produtos.unidade}
                        </p>
                      </div>

                      {/* Quantidade Sistema */}
                      {!inventario.contagem_cega && (
                        <div className="text-center px-4 border-r">
                          <p className="text-xs text-muted-foreground">Sistema</p>
                          <p className="text-lg font-medium">{item.quantidade_sistema}</p>
                        </div>
                      )}

                      {/* Input de Contagem ou Resultado */}
                      {isAtivo ? (
                        <div className="flex items-center gap-2">
                          <Input
                            ref={inputRef}
                            type="number"
                            step="0.001"
                            placeholder="Qtd"
                            value={valorContagem}
                            onChange={(e) => setValorContagem(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, item.id)}
                            className="w-24 text-center text-lg font-bold"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            onClick={() => {
                              const valor = parseFloat(valorContagem.replace(',', '.'))
                              if (!isNaN(valor) && valor >= 0) {
                                salvarContagem(item.id, valor)
                              }
                            }}
                            disabled={saving}
                          >
                            {saving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      ) : item.quantidade_contagem_1 !== null ? (
                        <div className="text-center px-4">
                          <p className="text-xs text-muted-foreground">Contagem</p>
                          <p className="text-lg font-bold">{item.quantidade_contagem_1}</p>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setItemAtivo(item.id)
                            setValorContagem('')
                            setTimeout(() => inputRef.current?.focus(), 100)
                          }}
                        >
                          <Scan className="mr-2 h-4 w-4" />
                          Contar
                        </Button>
                      )}

                      {/* Divergência */}
                      {item.divergencia !== null && item.divergencia !== 0 && (
                        <div className={`text-center px-4 ${
                          item.divergencia > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          <p className="text-xs text-muted-foreground">Diferença</p>
                          <p className="text-lg font-bold">
                            {item.divergencia > 0 ? '+' : ''}{item.divergencia}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {itensFiltrados.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum produto encontrado</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
