'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import {
  Gift,
  Search,
  Loader2,
  Plus,
  Edit,
  Trash2,
  Star,
  Package,
  ArrowLeft,
  Save,
} from 'lucide-react'

interface ProdutoFidelidade {
  id: string
  produto_id: string | null
  nome: string
  descricao: string | null
  pontos_necessarios: number
  estoque_disponivel: number | null
  ativo: boolean
  produto?: {
    nome: string
    codigo: string
  } | null
}

interface Produto {
  id: string
  codigo: string
  nome: string
  preco_venda: number
}

export default function ProdutosResgataveisPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [empresaId, setEmpresaId] = useState<string | null>(null)

  const [produtosFidelidade, setProdutosFidelidade] = useState<ProdutoFidelidade[]>([])
  const [search, setSearch] = useState('')

  // Modal de edição/criação
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<ProdutoFidelidade | null>(null)
  const [salvando, setSalvando] = useState(false)

  // Form
  const [formNome, setFormNome] = useState('')
  const [formDescricao, setFormDescricao] = useState('')
  const [formPontos, setFormPontos] = useState('')
  const [formEstoque, setFormEstoque] = useState('')
  const [formAtivo, setFormAtivo] = useState(true)
  const [formProdutoId, setFormProdutoId] = useState<string | null>(null)

  // Busca de produto
  const [buscaProduto, setBuscaProduto] = useState('')
  const [produtosEncontrados, setProdutosEncontrados] = useState<Produto[]>([])
  const [buscandoProduto, setBuscandoProduto] = useState(false)

  // Delete
  const [produtoParaDeletar, setProdutoParaDeletar] = useState<ProdutoFidelidade | null>(null)
  const [deletando, setDeletando] = useState(false)

  useEffect(() => {
    carregarDados()
  }, [])

  async function carregarDados() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: usuario } = await supabase
        .from('usuarios')
        .select('empresa_id')
        .eq('auth_id', user.id)
        .single()

      if (!usuario) return
      setEmpresaId(usuario.empresa_id)

      // Buscar produtos resgatáveis
      const { data: produtos } = await supabase
        .from('fidelidade_produtos')
        .select(`
          *,
          produto:produtos(nome, codigo)
        `)
        .eq('empresa_id', usuario.empresa_id)
        .order('pontos_necessarios', { ascending: true })

      if (produtos) {
        setProdutosFidelidade(produtos.map(p => ({
          ...p,
          produto: Array.isArray(p.produto) ? p.produto[0] : p.produto
        })))
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      toast.error('Erro ao carregar produtos')
    } finally {
      setLoading(false)
    }
  }

  async function buscarProdutos(termo: string) {
    if (!termo.trim()) {
      setProdutosEncontrados([])
      return
    }

    setBuscandoProduto(true)
    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('id, codigo, nome, preco_venda')
        .eq('ativo', true)
        .or(`codigo.ilike.%${termo}%,nome.ilike.%${termo}%`)
        .order('nome')
        .limit(5)

      if (error) throw error
      setProdutosEncontrados(data || [])
    } catch (error) {
      console.error('Erro ao buscar produtos:', error)
    } finally {
      setBuscandoProduto(false)
    }
  }

  // Debounce na busca de produtos
  useEffect(() => {
    const timer = setTimeout(() => {
      buscarProdutos(buscaProduto)
    }, 300)
    return () => clearTimeout(timer)
  }, [buscaProduto])

  function abrirModal(produto?: ProdutoFidelidade) {
    if (produto) {
      setEditando(produto)
      setFormNome(produto.nome)
      setFormDescricao(produto.descricao || '')
      setFormPontos(String(produto.pontos_necessarios))
      setFormEstoque(produto.estoque_disponivel !== null ? String(produto.estoque_disponivel) : '')
      setFormAtivo(produto.ativo)
      setFormProdutoId(produto.produto_id)
    } else {
      setEditando(null)
      setFormNome('')
      setFormDescricao('')
      setFormPontos('')
      setFormEstoque('')
      setFormAtivo(true)
      setFormProdutoId(null)
    }
    setBuscaProduto('')
    setProdutosEncontrados([])
    setShowModal(true)
  }

  function selecionarProduto(produto: Produto) {
    setFormProdutoId(produto.id)
    setFormNome(produto.nome)
    setBuscaProduto('')
    setProdutosEncontrados([])
  }

  async function salvar() {
    if (!empresaId) return

    const pontos = parseFloat(formPontos)
    if (!formNome.trim() || isNaN(pontos) || pontos <= 0) {
      toast.error('Preencha nome e pontos corretamente')
      return
    }

    setSalvando(true)
    try {
      const dados = {
        empresa_id: empresaId,
        produto_id: formProdutoId,
        nome: formNome.trim(),
        descricao: formDescricao.trim() || null,
        pontos_necessarios: pontos,
        estoque_disponivel: formEstoque ? parseInt(formEstoque) : null,
        ativo: formAtivo,
      }

      if (editando) {
        const { error } = await supabase
          .from('fidelidade_produtos')
          .update({
            ...dados,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editando.id)

        if (error) throw error
        toast.success('Produto atualizado!')
      } else {
        const { error } = await supabase
          .from('fidelidade_produtos')
          .insert(dados)

        if (error) throw error
        toast.success('Produto cadastrado!')
      }

      setShowModal(false)
      carregarDados()
    } catch (error) {
      console.error('Erro ao salvar:', error)
      toast.error('Erro ao salvar produto')
    } finally {
      setSalvando(false)
    }
  }

  async function deletar() {
    if (!produtoParaDeletar) return

    setDeletando(true)
    try {
      const { error } = await supabase
        .from('fidelidade_produtos')
        .delete()
        .eq('id', produtoParaDeletar.id)

      if (error) throw error
      toast.success('Produto removido!')
      setProdutoParaDeletar(null)
      carregarDados()
    } catch (error) {
      console.error('Erro ao deletar:', error)
      toast.error('Erro ao remover produto')
    } finally {
      setDeletando(false)
    }
  }

  function formatPontos(pontos: number) {
    return new Intl.NumberFormat('pt-BR').format(pontos)
  }

  // Filtrar produtos
  const produtosFiltrados = produtosFidelidade.filter(
    (p) =>
      p.nome.toLowerCase().includes(search.toLowerCase()) ||
      p.produto?.nome?.toLowerCase().includes(search.toLowerCase())
  )

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
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/fidelidade">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Gift className="h-8 w-8" />
              Produtos Resgatáveis
            </h1>
            <p className="text-muted-foreground">
              Gerencie os produtos disponíveis para troca por pontos
            </p>
          </div>
        </div>
        <Button onClick={() => abrirModal()}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Produto
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Catálogo de Recompensas</CardTitle>
          <CardDescription>
            Produtos que os clientes podem resgatar usando seus pontos de fidelidade
          </CardDescription>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produtos..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {produtosFiltrados.length > 0 ? (
            <ScrollArea className="h-[500px]">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {produtosFiltrados.map((produto) => (
                  <Card key={produto.id} className={!produto.ativo ? 'opacity-60' : ''}>
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold">{produto.nome}</h3>
                          {produto.descricao && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {produto.descricao}
                            </p>
                          )}
                        </div>
                        <Badge variant={produto.ativo ? 'default' : 'secondary'}>
                          {produto.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-1">
                          <Star className="h-5 w-5 text-yellow-500" />
                          <span className="text-xl font-bold">
                            {formatPontos(produto.pontos_necessarios)}
                          </span>
                          <span className="text-sm text-muted-foreground">pontos</span>
                        </div>
                        {produto.estoque_disponivel !== null && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Package className="h-4 w-4" />
                            <span>{produto.estoque_disponivel} disponível</span>
                          </div>
                        )}
                      </div>

                      {produto.produto && (
                        <p className="text-xs text-muted-foreground mb-3">
                          Vinculado: {produto.produto.codigo} - {produto.produto.nome}
                        </p>
                      )}

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => abrirModal(produto)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setProdutoParaDeletar(produto)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Gift className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg">Nenhum produto cadastrado</p>
              <p className="text-sm">Cadastre produtos para os clientes resgatarem com pontos</p>
              <Button className="mt-4" onClick={() => abrirModal()}>
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Primeiro Produto
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Criação/Edição */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editando ? 'Editar Produto' : 'Novo Produto Resgatável'}
            </DialogTitle>
            <DialogDescription>
              {editando
                ? 'Atualize as informações do produto'
                : 'Cadastre um novo produto para resgate por pontos'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Vincular a produto existente */}
            <div className="space-y-2">
              <Label>Vincular a Produto (opcional)</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produto do estoque..."
                  className="pl-10"
                  value={buscaProduto}
                  onChange={(e) => setBuscaProduto(e.target.value)}
                />
                {buscandoProduto && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {produtosEncontrados.length > 0 && (
                <div className="border rounded-lg max-h-40 overflow-y-auto">
                  {produtosEncontrados.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full p-2 text-left hover:bg-muted text-sm"
                      onClick={() => selecionarProduto(p)}
                    >
                      <span className="font-medium">{p.codigo}</span> - {p.nome}
                    </button>
                  ))}
                </div>
              )}
              {formProdutoId && (
                <div className="flex items-center gap-2 text-sm">
                  <Package className="h-4 w-4 text-green-600" />
                  <span>Produto vinculado</span>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="p-0 h-auto"
                    onClick={() => setFormProdutoId(null)}
                  >
                    Remover vínculo
                  </Button>
                </div>
              )}
            </div>

            {/* Nome */}
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                placeholder="Nome do produto/recompensa"
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
              />
            </div>

            {/* Descrição */}
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                placeholder="Descrição do produto..."
                value={formDescricao}
                onChange={(e) => setFormDescricao(e.target.value)}
                rows={2}
              />
            </div>

            {/* Pontos e Estoque */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pontos">Pontos Necessários *</Label>
                <Input
                  id="pontos"
                  type="number"
                  min="1"
                  placeholder="100"
                  value={formPontos}
                  onChange={(e) => setFormPontos(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estoque">Estoque (vazio = ilimitado)</Label>
                <Input
                  id="estoque"
                  type="number"
                  min="0"
                  placeholder="Ilimitado"
                  value={formEstoque}
                  onChange={(e) => setFormEstoque(e.target.value)}
                />
              </div>
            </div>

            {/* Ativo */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Produto Ativo</Label>
                <p className="text-xs text-muted-foreground">
                  Disponível para resgate pelos clientes
                </p>
              </div>
              <Switch
                checked={formAtivo}
                onCheckedChange={setFormAtivo}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!produtoParaDeletar} onOpenChange={() => setProdutoParaDeletar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Produto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o produto &quot;{produtoParaDeletar?.nome}&quot;?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={deletar}
              disabled={deletando}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletando ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
