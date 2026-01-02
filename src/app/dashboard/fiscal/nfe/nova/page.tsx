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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, Search, Plus, Trash2, FileText } from 'lucide-react'

interface Cliente {
  id: string
  nome: string
  tipo_pessoa: string
  cpf_cnpj: string
  email: string | null
  endereco: any
}

interface Produto {
  id: string
  codigo: string
  nome: string
  preco_venda: number
  unidade: string
  ncm: string
}

interface ItemNota {
  produto_id: string
  codigo: string
  nome: string
  ncm: string
  unidade: string
  quantidade: number
  valor_unitario: number
  valor_total: number
}

export default function NovaNFePage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [buscandoCliente, setBuscandoCliente] = useState(false)
  const [buscandoProduto, setBuscandoProduto] = useState(false)

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null)
  const [buscaCliente, setBuscaCliente] = useState('')

  const [produtos, setProdutos] = useState<Produto[]>([])
  const [buscaProduto, setBuscaProduto] = useState('')

  const [itens, setItens] = useState<ItemNota[]>([])
  const [naturezaOperacao, setNaturezaOperacao] = useState('Venda de mercadoria')
  const [observacao, setObservacao] = useState('')

  async function buscarClientes() {
    if (!buscaCliente.trim()) return

    setBuscandoCliente(true)
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, tipo_pessoa, cpf_cnpj, email, endereco')
        .eq('ativo', true)
        .or(`nome.ilike.%${buscaCliente}%,cpf_cnpj.ilike.%${buscaCliente}%`)
        .limit(10)

      if (error) throw error
      setClientes(data || [])
    } catch (error) {
      toast.error('Erro ao buscar clientes')
    } finally {
      setBuscandoCliente(false)
    }
  }

  function selecionarCliente(cliente: Cliente) {
    setClienteSelecionado(cliente)
    setClientes([])
    setBuscaCliente('')
  }

  async function buscarProdutos() {
    if (!buscaProduto.trim()) return

    setBuscandoProduto(true)
    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('id, codigo, nome, preco_venda, unidade, ncm')
        .eq('ativo', true)
        .or(`codigo.ilike.%${buscaProduto}%,nome.ilike.%${buscaProduto}%`)
        .limit(10)

      if (error) throw error
      setProdutos(data || [])
    } catch (error) {
      toast.error('Erro ao buscar produtos')
    } finally {
      setBuscandoProduto(false)
    }
  }

  function adicionarProduto(produto: Produto) {
    const itemExistente = itens.find(i => i.produto_id === produto.id)
    if (itemExistente) {
      setItens(itens.map(i =>
        i.produto_id === produto.id
          ? { ...i, quantidade: i.quantidade + 1, valor_total: (i.quantidade + 1) * i.valor_unitario }
          : i
      ))
    } else {
      setItens([...itens, {
        produto_id: produto.id,
        codigo: produto.codigo,
        nome: produto.nome,
        ncm: produto.ncm || '',
        unidade: produto.unidade,
        quantidade: 1,
        valor_unitario: produto.preco_venda,
        valor_total: produto.preco_venda,
      }])
    }
    setProdutos([])
    setBuscaProduto('')
  }

  function removerItem(produto_id: string) {
    setItens(itens.filter(i => i.produto_id !== produto_id))
  }

  function atualizarQuantidade(produto_id: string, quantidade: number) {
    if (quantidade <= 0) {
      removerItem(produto_id)
      return
    }
    setItens(itens.map(i =>
      i.produto_id === produto_id
        ? { ...i, quantidade, valor_total: quantidade * i.valor_unitario }
        : i
    ))
  }

  const totalNota = itens.reduce((acc, item) => acc + item.valor_total, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!clienteSelecionado) {
      toast.error('Selecione um destinatário')
      return
    }

    if (itens.length === 0) {
      toast.error('Adicione pelo menos um produto')
      return
    }

    // Verificar se cliente PJ tem CNPJ
    if (clienteSelecionado.tipo_pessoa === 'PJ' && !clienteSelecionado.cpf_cnpj) {
      toast.error('Cliente PJ deve ter CNPJ cadastrado')
      return
    }

    setLoading(true)

    try {
      // Aqui seria a chamada para a API de emissão
      // Por enquanto, apenas simula a criação do registro

      toast.success('NF-e criada com sucesso!', {
        description: 'A nota será processada e transmitida para a SEFAZ',
      })

      router.push('/dashboard/fiscal/nfe')
      router.refresh()
    } catch (error: any) {
      toast.error('Erro ao emitir NF-e', {
        description: error.message,
      })
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/fiscal/nfe">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nova NF-e</h1>
          <p className="text-muted-foreground">
            Emissão de Nota Fiscal Eletrônica
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Natureza da Operação */}
        <Card>
          <CardHeader>
            <CardTitle>Operação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="natureza">Natureza da Operação</Label>
              <Select value={naturezaOperacao} onValueChange={setNaturezaOperacao}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Venda de mercadoria">Venda de mercadoria</SelectItem>
                  <SelectItem value="Venda de produção do estabelecimento">Venda de produção do estabelecimento</SelectItem>
                  <SelectItem value="Devolução de compra">Devolução de compra</SelectItem>
                  <SelectItem value="Remessa para conserto">Remessa para conserto</SelectItem>
                  <SelectItem value="Remessa para demonstração">Remessa para demonstração</SelectItem>
                  <SelectItem value="Transferência">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Destinatário */}
        <Card>
          <CardHeader>
            <CardTitle>Destinatário</CardTitle>
            <CardDescription>
              Busque e selecione o cliente/destinatário da nota
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Buscar Cliente</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Digite o nome ou CPF/CNPJ..."
                  value={buscaCliente}
                  onChange={(e) => setBuscaCliente(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), buscarClientes())}
                  disabled={loading}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={buscarClientes}
                  disabled={loading || buscandoCliente}
                >
                  {buscandoCliente ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {clientes.length > 0 && (
              <div className="border rounded-md divide-y">
                {clientes.map((cliente) => (
                  <button
                    key={cliente.id}
                    type="button"
                    onClick={() => selecionarCliente(cliente)}
                    className="w-full px-4 py-3 text-left hover:bg-muted transition-colors"
                  >
                    <p className="font-medium">{cliente.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      {cliente.tipo_pessoa === 'PF' ? 'CPF' : 'CNPJ'}: {cliente.cpf_cnpj}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {clienteSelecionado && (
              <div className="bg-muted p-4 rounded-md">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-lg">{clienteSelecionado.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      {clienteSelecionado.tipo_pessoa === 'PF' ? 'CPF' : 'CNPJ'}: {clienteSelecionado.cpf_cnpj}
                    </p>
                    {clienteSelecionado.email && (
                      <p className="text-sm text-muted-foreground">{clienteSelecionado.email}</p>
                    )}
                    {clienteSelecionado.endereco && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {clienteSelecionado.endereco.logradouro}, {clienteSelecionado.endereco.numero} - {clienteSelecionado.endereco.cidade}/{clienteSelecionado.endereco.uf}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setClienteSelecionado(null)}
                  >
                    Trocar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Produtos */}
        <Card>
          <CardHeader>
            <CardTitle>Produtos</CardTitle>
            <CardDescription>
              Adicione os produtos da nota fiscal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Buscar Produto</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Digite o código ou nome do produto..."
                  value={buscaProduto}
                  onChange={(e) => setBuscaProduto(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), buscarProdutos())}
                  disabled={loading}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={buscarProdutos}
                  disabled={loading || buscandoProduto}
                >
                  {buscandoProduto ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {produtos.length > 0 && (
              <div className="border rounded-md divide-y">
                {produtos.map((produto) => (
                  <button
                    key={produto.id}
                    type="button"
                    onClick={() => adicionarProduto(produto)}
                    className="w-full px-4 py-3 text-left hover:bg-muted transition-colors flex justify-between items-center"
                  >
                    <div>
                      <p className="font-medium">{produto.nome}</p>
                      <p className="text-sm text-muted-foreground">
                        Código: {produto.codigo} | NCM: {produto.ncm || '-'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(produto.preco_venda)}</p>
                      <Plus className="h-4 w-4 text-muted-foreground ml-auto" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {itens.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>NCM</TableHead>
                    <TableHead className="text-center">Qtd</TableHead>
                    <TableHead className="text-right">Valor Unit.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((item) => (
                    <TableRow key={item.produto_id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.nome}</p>
                          <p className="text-xs text-muted-foreground">{item.codigo}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {item.ncm || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min="1"
                          value={item.quantidade}
                          onChange={(e) => atualizarQuantidade(item.produto_id, parseInt(e.target.value) || 0)}
                          className="w-20 text-center"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.valor_unitario)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.valor_total)}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removerItem(item.produto_id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {itens.length > 0 && (
              <div className="flex justify-end">
                <div className="bg-muted p-4 rounded-md">
                  <p className="text-sm text-muted-foreground">Total da Nota</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalNota)}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Observações */}
        <Card>
          <CardHeader>
            <CardTitle>Informações Adicionais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="observacao">Observações</Label>
              <Textarea
                id="observacao"
                placeholder="Informações complementares da nota fiscal..."
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={3}
                disabled={loading}
              />
            </div>
          </CardContent>
        </Card>

        {/* Ações */}
        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading || !clienteSelecionado || itens.length === 0}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Emitindo...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Emitir NF-e
              </>
            )}
          </Button>
          <Button type="button" variant="outline" asChild disabled={loading}>
            <Link href="/dashboard/fiscal/nfe">Cancelar</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
