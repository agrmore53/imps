'use client'

import { useState } from 'react'
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
import { Loader2, ArrowLeft, Search, Package, AlertTriangle } from 'lucide-react'

interface Produto {
  id: string
  codigo: string
  nome: string
  unidade: string
  estoque_atual: number
  preco_custo: number
}

export default function SaidaEstoquePage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null)
  const [busca, setBusca] = useState('')
  const [motivo, setMotivo] = useState('')

  const [formData, setFormData] = useState({
    produto_id: '',
    quantidade: '',
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

    if (!motivo) {
      toast.error('Selecione o motivo da saída')
      return
    }

    const quantidade = parseFloat(formData.quantidade)
    if (isNaN(quantidade) || quantidade <= 0) {
      toast.error('Quantidade inválida')
      return
    }

    if (produtoSelecionado && quantidade > produtoSelecionado.estoque_atual) {
      toast.error('Quantidade maior que o estoque disponível', {
        description: `Estoque atual: ${produtoSelecionado.estoque_atual} ${produtoSelecionado.unidade}`,
      })
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

      // Montar observação com motivo
      const observacaoCompleta = motivo + (formData.observacao ? ` - ${formData.observacao}` : '')

      // Registrar movimento de saída
      const { error: movimentoError } = await supabase
        .from('estoque_movimentos')
        .insert({
          produto_id: formData.produto_id,
          tipo: 'saida',
          quantidade: quantidade,
          custo_unitario: produtoSelecionado?.preco_custo || 0,
          documento_origem: formData.documento_origem || null,
          observacao: observacaoCompleta,
          usuario_id: userData.id,
        })

      if (movimentoError) throw movimentoError

      // Atualizar estoque do produto
      const novoEstoque = (produtoSelecionado?.estoque_atual || 0) - quantidade
      const { error: produtoError } = await supabase
        .from('produtos')
        .update({
          estoque_atual: novoEstoque,
        })
        .eq('id', formData.produto_id)

      if (produtoError) throw produtoError

      toast.success('Saída de estoque registrada!', {
        description: `${quantidade} ${produtoSelecionado?.unidade} de ${produtoSelecionado?.nome}`,
      })

      router.push('/dashboard/estoque')
      router.refresh()
    } catch (error: any) {
      toast.error('Erro ao registrar saída', {
        description: error.message,
      })
    } finally {
      setLoading(false)
    }
  }

  const estoqueInsuficiente = produtoSelecionado &&
    parseFloat(formData.quantidade || '0') > produtoSelecionado.estoque_atual

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/estoque">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Saída de Estoque</h1>
          <p className="text-muted-foreground">
            Registre a saída de produtos do estoque
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Produto</CardTitle>
            <CardDescription>
              Busque e selecione o produto para saída
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
                    <p className="text-sm font-medium mt-1">
                      Estoque disponível: {produtoSelecionado.estoque_atual} {produtoSelecionado.unidade}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setProdutoSelecionado(null)
                      setFormData(prev => ({ ...prev, produto_id: '', quantidade: '' }))
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
            <CardTitle>Dados da Saída</CardTitle>
            <CardDescription>
              Informe a quantidade e motivo da saída
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
                  max={produtoSelecionado?.estoque_atual || undefined}
                  placeholder="0"
                  value={formData.quantidade}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  className={estoqueInsuficiente ? 'border-red-500' : ''}
                />
                {produtoSelecionado && (
                  <p className={`text-xs ${estoqueInsuficiente ? 'text-red-500' : 'text-muted-foreground'}`}>
                    {estoqueInsuficiente
                      ? `Quantidade excede o estoque disponível (${produtoSelecionado.estoque_atual} ${produtoSelecionado.unidade})`
                      : `Máximo: ${produtoSelecionado.estoque_atual} ${produtoSelecionado.unidade}`
                    }
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="motivo">Motivo da Saída *</Label>
                <Select value={motivo} onValueChange={setMotivo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ajuste de inventário">Ajuste de inventário</SelectItem>
                    <SelectItem value="Perda/Avaria">Perda/Avaria</SelectItem>
                    <SelectItem value="Devolução ao fornecedor">Devolução ao fornecedor</SelectItem>
                    <SelectItem value="Consumo interno">Consumo interno</SelectItem>
                    <SelectItem value="Transferência">Transferência</SelectItem>
                    <SelectItem value="Vencimento/Validade">Vencimento/Validade</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="documento_origem">Documento de Referência</Label>
              <Input
                id="documento_origem"
                name="documento_origem"
                placeholder="Número do documento, ordem de serviço, etc."
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
            {produtoSelecionado && formData.quantidade && !estoqueInsuficiente && (
              <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-md border border-orange-200 dark:border-orange-800">
                <p className="font-medium text-orange-800 dark:text-orange-200">
                  Resumo da Saída
                </p>
                <div className="mt-2 space-y-1 text-sm text-orange-700 dark:text-orange-300">
                  <p>Produto: {produtoSelecionado.nome}</p>
                  <p>Quantidade: {formData.quantidade} {produtoSelecionado.unidade}</p>
                  <p>Motivo: {motivo || 'Não informado'}</p>
                  <p className="pt-2 border-t border-orange-200 dark:border-orange-700">
                    Estoque após saída: {(produtoSelecionado.estoque_atual - parseFloat(formData.quantidade)).toFixed(2)} {produtoSelecionado.unidade}
                  </p>
                </div>
              </div>
            )}

            {/* Alerta de estoque insuficiente */}
            {estoqueInsuficiente && (
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md border border-red-200 dark:border-red-800 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800 dark:text-red-200">
                    Estoque Insuficiente
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    A quantidade informada ({formData.quantidade}) é maior que o estoque disponível ({produtoSelecionado?.estoque_atual} {produtoSelecionado?.unidade}).
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading || !produtoSelecionado || estoqueInsuficiente || !motivo}
            variant="destructive"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Registrar Saída'
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
