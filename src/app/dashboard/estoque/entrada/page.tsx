'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, Search, Package } from 'lucide-react'

interface Produto {
  id: string
  codigo: string
  nome: string
  unidade: string
  estoque_atual: number
  preco_custo: number
}

export default function EntradaEstoquePage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null)
  const [busca, setBusca] = useState('')

  const [formData, setFormData] = useState({
    produto_id: '',
    quantidade: '',
    custo_unitario: '',
    documento_origem: '',
    observacao: '',
  })

  async function buscarProdutos() {
    if (!busca.trim()) return

    setBuscando(true)
    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('id, codigo, nome, unidade, estoque_atual, preco_custo')
        .eq('ativo', true)
        .or(`codigo.ilike.%${busca}%,nome.ilike.%${busca}%`)
        .limit(10)

      if (error) throw error
      setProdutos(data || [])
    } catch (error) {
      toast.error('Erro ao buscar produtos')
    } finally {
      setBuscando(false)
    }
  }

  function selecionarProduto(produto: Produto) {
    setProdutoSelecionado(produto)
    setFormData(prev => ({
      ...prev,
      produto_id: produto.id,
      custo_unitario: produto.preco_custo?.toString() || '',
    }))
    setProdutos([])
    setBusca('')
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.produto_id) {
      toast.error('Selecione um produto')
      return
    }

    const quantidade = parseFloat(formData.quantidade)
    if (isNaN(quantidade) || quantidade <= 0) {
      toast.error('Quantidade inválida')
      return
    }

    const custoUnitario = parseFloat(formData.custo_unitario)
    if (isNaN(custoUnitario) || custoUnitario < 0) {
      toast.error('Custo unitário inválido')
      return
    }

    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Usuário não autenticado')
        return
      }

      const { data: userData } = await supabase
        .from('usuarios')
        .select('id')
        .eq('auth_id', user.id)
        .single()

      if (!userData) {
        toast.error('Usuário não encontrado')
        return
      }

      // Registrar movimento de entrada
      const { error: movimentoError } = await supabase
        .from('estoque_movimentos')
        .insert({
          produto_id: formData.produto_id,
          tipo: 'entrada',
          quantidade: quantidade,
          custo_unitario: custoUnitario,
          documento_origem: formData.documento_origem || null,
          observacao: formData.observacao || null,
          usuario_id: userData.id,
        })

      if (movimentoError) throw movimentoError

      // Atualizar estoque do produto
      const novoEstoque = (produtoSelecionado?.estoque_atual || 0) + quantidade
      const { error: produtoError } = await supabase
        .from('produtos')
        .update({
          estoque_atual: novoEstoque,
          preco_custo: custoUnitario, // Atualiza o custo unitário
        })
        .eq('id', formData.produto_id)

      if (produtoError) throw produtoError

      toast.success('Entrada de estoque registrada!', {
        description: `${quantidade} ${produtoSelecionado?.unidade} de ${produtoSelecionado?.nome}`,
      })

      router.push('/dashboard/estoque')
      router.refresh()
    } catch (error: any) {
      toast.error('Erro ao registrar entrada', {
        description: error.message,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/estoque">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Entrada de Estoque</h1>
          <p className="text-muted-foreground">
            Registre a entrada de produtos no estoque
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Produto</CardTitle>
            <CardDescription>
              Busque e selecione o produto para entrada
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Busca de Produto */}
            <div className="space-y-2">
              <Label htmlFor="busca">Buscar Produto</Label>
              <div className="flex gap-2">
                <Input
                  id="busca"
                  placeholder="Digite o código ou nome do produto..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), buscarProdutos())}
                  disabled={loading}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={buscarProdutos}
                  disabled={loading || buscando}
                >
                  {buscando ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Lista de resultados */}
            {produtos.length > 0 && (
              <div className="border rounded-md divide-y">
                {produtos.map((produto) => (
                  <button
                    key={produto.id}
                    type="button"
                    onClick={() => selecionarProduto(produto)}
                    className="w-full px-4 py-3 text-left hover:bg-muted transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{produto.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          Código: {produto.codigo} | Estoque: {produto.estoque_atual} {produto.unidade}
                        </p>
                      </div>
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Produto Selecionado */}
            {produtoSelecionado && (
              <div className="bg-muted p-4 rounded-md">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-lg">{produtoSelecionado.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      Código: {produtoSelecionado.codigo}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Estoque atual: {produtoSelecionado.estoque_atual} {produtoSelecionado.unidade}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setProdutoSelecionado(null)
                      setFormData(prev => ({ ...prev, produto_id: '', custo_unitario: '' }))
                    }}
                  >
                    Trocar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dados da Entrada</CardTitle>
            <CardDescription>
              Informe a quantidade e valor do produto
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="quantidade">Quantidade *</Label>
                <Input
                  id="quantidade"
                  name="quantidade"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0"
                  value={formData.quantidade}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
                {produtoSelecionado && (
                  <p className="text-xs text-muted-foreground">
                    Unidade: {produtoSelecionado.unidade}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="custo_unitario">Custo Unitário *</Label>
                <Input
                  id="custo_unitario"
                  name="custo_unitario"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={formData.custo_unitario}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="documento_origem">Documento de Origem</Label>
              <Input
                id="documento_origem"
                name="documento_origem"
                placeholder="Nota fiscal, pedido, etc."
                value={formData.documento_origem}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacao">Observação</Label>
              <Textarea
                id="observacao"
                name="observacao"
                placeholder="Observações adicionais..."
                value={formData.observacao}
                onChange={handleChange}
                disabled={loading}
                rows={3}
              />
            </div>

            {/* Resumo */}
            {produtoSelecionado && formData.quantidade && formData.custo_unitario && (
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-md border border-green-200 dark:border-green-800">
                <p className="font-medium text-green-800 dark:text-green-200">
                  Resumo da Entrada
                </p>
                <div className="mt-2 space-y-1 text-sm text-green-700 dark:text-green-300">
                  <p>Produto: {produtoSelecionado.nome}</p>
                  <p>Quantidade: {formData.quantidade} {produtoSelecionado.unidade}</p>
                  <p>Custo unitário: R$ {parseFloat(formData.custo_unitario).toFixed(2)}</p>
                  <p className="font-semibold">
                    Custo total: R$ {(parseFloat(formData.quantidade) * parseFloat(formData.custo_unitario)).toFixed(2)}
                  </p>
                  <p className="pt-2 border-t border-green-200 dark:border-green-700">
                    Estoque após entrada: {(produtoSelecionado.estoque_atual + parseFloat(formData.quantidade)).toFixed(2)} {produtoSelecionado.unidade}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" disabled={loading || !produtoSelecionado}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Registrar Entrada'
            )}
          </Button>
          <Button type="button" variant="outline" asChild disabled={loading}>
            <Link href="/dashboard/estoque">Cancelar</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
