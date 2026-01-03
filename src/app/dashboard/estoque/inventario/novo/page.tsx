'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ClipboardList,
  Loader2,
  Package,
  Search,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'

interface Produto {
  id: string
  codigo: string
  nome: string
  estoque_atual: number
  unidade: string
  preco_custo: number
}

export default function NovoInventarioPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [loadingProdutos, setLoadingProdutos] = useState(true)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [produtosFiltrados, setProdutosFiltrados] = useState<Produto[]>([])
  const [produtosSelecionados, setProdutosSelecionados] = useState<Set<string>>(new Set())
  const [busca, setBusca] = useState('')

  // Formulário
  const [descricao, setDescricao] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [contagemCega, setContagemCega] = useState(false)
  const [tipoInventario, setTipoInventario] = useState<'completo' | 'parcial'>('completo')

  useEffect(() => {
    fetchProdutos()
  }, [])

  useEffect(() => {
    if (busca.trim()) {
      const termo = busca.toLowerCase()
      setProdutosFiltrados(
        produtos.filter(
          (p) =>
            p.nome.toLowerCase().includes(termo) ||
            p.codigo.toLowerCase().includes(termo)
        )
      )
    } else {
      setProdutosFiltrados(produtos)
    }
  }, [busca, produtos])

  useEffect(() => {
    if (tipoInventario === 'completo') {
      setProdutosSelecionados(new Set(produtos.map((p) => p.id)))
    } else {
      setProdutosSelecionados(new Set())
    }
  }, [tipoInventario, produtos])

  async function fetchProdutos() {
    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('id, codigo, nome, estoque_atual, unidade, preco_custo')
        .eq('ativo', true)
        .order('nome')

      if (error) throw error

      setProdutos(data || [])
      setProdutosFiltrados(data || [])
      // Por padrão, selecionar todos
      setProdutosSelecionados(new Set((data || []).map((p) => p.id)))
    } catch (error) {
      console.error('Erro ao buscar produtos:', error)
      toast.error('Erro ao carregar produtos')
    } finally {
      setLoadingProdutos(false)
    }
  }

  function toggleProduto(id: string) {
    const novos = new Set(produtosSelecionados)
    if (novos.has(id)) {
      novos.delete(id)
    } else {
      novos.add(id)
    }
    setProdutosSelecionados(novos)

    // Se desmarcar algum, muda para parcial
    if (novos.size !== produtos.length) {
      setTipoInventario('parcial')
    } else {
      setTipoInventario('completo')
    }
  }

  function selecionarTodos() {
    setProdutosSelecionados(new Set(produtos.map((p) => p.id)))
    setTipoInventario('completo')
  }

  function desmarcarTodos() {
    setProdutosSelecionados(new Set())
    setTipoInventario('parcial')
  }

  async function criarInventario() {
    if (produtosSelecionados.size === 0) {
      toast.error('Selecione pelo menos um produto')
      return
    }

    setLoading(true)
    try {
      // Buscar usuário atual
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      const { data: userData } = await supabase
        .from('usuarios')
        .select('id, empresa_id')
        .eq('auth_id', user.id)
        .single()

      if (!userData) throw new Error('Usuário não encontrado')

      // Criar inventário
      const { data: inventario, error: invError } = await supabase
        .from('inventarios')
        .insert({
          empresa_id: userData.empresa_id,
          descricao: descricao || 'Inventário Geral',
          tipo: tipoInventario,
          contagem_cega: contagemCega,
          usuario_id: userData.id,
          observacoes,
          total_produtos: produtosSelecionados.size,
        })
        .select()
        .single()

      if (invError) throw invError

      // Criar itens do inventário
      const produtosSelecionadosArray = produtos.filter((p) =>
        produtosSelecionados.has(p.id)
      )

      const itens = produtosSelecionadosArray.map((p) => ({
        inventario_id: inventario.id,
        produto_id: p.id,
        quantidade_sistema: p.estoque_atual,
      }))

      const { error: itensError } = await supabase
        .from('inventario_itens')
        .insert(itens)

      if (itensError) throw itensError

      toast.success('Inventário criado com sucesso!')
      router.push(`/dashboard/estoque/inventario/${inventario.id}/contagem`)
    } catch (error) {
      console.error('Erro ao criar inventário:', error)
      toast.error('Erro ao criar inventário')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/estoque/inventario">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Novo Inventário</h1>
          <p className="text-muted-foreground">
            Configure e inicie uma nova contagem de estoque
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Configurações */}
        <Card>
          <CardHeader>
            <CardTitle>Configurações</CardTitle>
            <CardDescription>
              Defina as opções do inventário
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Input
                id="descricao"
                placeholder="Ex: Inventário Mensal Janeiro/2024"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                placeholder="Observações adicionais..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="contagem-cega">Contagem Cega</Label>
                <p className="text-sm text-muted-foreground">
                  Operador não verá a quantidade do sistema
                </p>
              </div>
              <Switch
                id="contagem-cega"
                checked={contagemCega}
                onCheckedChange={setContagemCega}
              />
            </div>

            <div className="p-4 border rounded-lg space-y-3">
              <Label>Tipo de Inventário</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setTipoInventario('completo')
                    selecionarTodos()
                  }}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    tipoInventario === 'completo'
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-muted-foreground/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    <span className="font-medium">Completo</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Todos os produtos
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTipoInventario('parcial')
                    desmarcarTodos()
                  }}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    tipoInventario === 'parcial'
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-muted-foreground/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    <span className="font-medium">Parcial</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Produtos selecionados
                  </p>
                </button>
              </div>
            </div>

            {/* Resumo */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Produtos selecionados</span>
                <Badge variant="secondary" className="text-lg px-3">
                  {produtosSelecionados.size}
                </Badge>
              </div>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={criarInventario}
              disabled={loading || produtosSelecionados.size === 0}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Iniciar Inventário
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Seleção de Produtos */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Produtos</CardTitle>
                <CardDescription>
                  {tipoInventario === 'completo'
                    ? 'Todos os produtos serão inventariados'
                    : 'Selecione os produtos para inventariar'}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selecionarTodos}>
                  Todos
                </Button>
                <Button variant="outline" size="sm" onClick={desmarcarTodos}>
                  Nenhum
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Busca */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Lista de produtos */}
            {loadingProdutos ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : produtosFiltrados.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum produto encontrado</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-2">
                  {produtosFiltrados.map((produto) => {
                    const selecionado = produtosSelecionados.has(produto.id)
                    return (
                      <div
                        key={produto.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selecionado
                            ? 'bg-primary/5 border-primary'
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => toggleProduto(produto.id)}
                      >
                        <Checkbox
                          checked={selecionado}
                          onCheckedChange={() => toggleProduto(produto.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{produto.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            Cód: {produto.codigo}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">
                            {produto.estoque_atual} {produto.unidade}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            em estoque
                          </p>
                        </div>
                        {selecionado && (
                          <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                        )}
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
