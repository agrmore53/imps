'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  Users,
  Search,
  Loader2,
  DollarSign,
  CreditCard,
  QrCode,
  ArrowDownCircle,
  ArrowUpCircle,
  Receipt,
  Calendar,
  TrendingDown,
  Wallet,
} from 'lucide-react'

interface Cliente {
  id: string
  nome: string
  cpf_cnpj: string
  telefone?: string
  limite_credito: number
  saldo_devedor: number
}

interface Movimentacao {
  id: string
  tipo: 'debito' | 'credito'
  valor: number
  saldo_anterior: number
  saldo_posterior: number
  descricao?: string
  forma_pagamento?: string
  created_at: string
  venda?: {
    numero: number
  }[] | null
}

export default function CrediarioPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [search, setSearch] = useState('')
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null)
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([])
  const [loadingMovimentacoes, setLoadingMovimentacoes] = useState(false)
  const [showPagamento, setShowPagamento] = useState(false)
  const [valorPagamento, setValorPagamento] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('dinheiro')
  const [observacao, setObservacao] = useState('')
  const [processando, setProcessando] = useState(false)
  const [empresaId, setEmpresaId] = useState<string | null>(null)

  // Estatísticas
  const totalDevedores = clientes.filter(c => c.saldo_devedor > 0).length
  const totalDivida = clientes.reduce((acc, c) => acc + c.saldo_devedor, 0)

  useEffect(() => {
    buscarClientes()
  }, [])

  async function buscarClientes() {
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

      // Buscar clientes com saldo devedor ou com limite de crédito
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, cpf_cnpj, telefone, limite_credito, saldo_devedor')
        .eq('empresa_id', usuario.empresa_id)
        .eq('ativo', true)
        .or('saldo_devedor.gt.0,limite_credito.gt.0')
        .order('saldo_devedor', { ascending: false })

      if (error) throw error
      setClientes(data || [])
    } catch (error) {
      console.error('Erro ao buscar clientes:', error)
      toast.error('Erro ao carregar clientes')
    } finally {
      setLoading(false)
    }
  }

  async function buscarMovimentacoes(clienteId: string) {
    setLoadingMovimentacoes(true)
    try {
      const { data, error } = await supabase
        .from('crediario')
        .select(`
          id,
          tipo,
          valor,
          saldo_anterior,
          saldo_posterior,
          descricao,
          forma_pagamento,
          created_at,
          venda:vendas(numero)
        `)
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setMovimentacoes(data || [])
    } catch (error) {
      console.error('Erro ao buscar movimentações:', error)
      toast.error('Erro ao carregar histórico')
    } finally {
      setLoadingMovimentacoes(false)
    }
  }

  function selecionarCliente(cliente: Cliente) {
    setClienteSelecionado(cliente)
    buscarMovimentacoes(cliente.id)
  }

  async function registrarPagamento() {
    if (!clienteSelecionado || !empresaId) return

    const valor = parseFloat(valorPagamento)
    if (isNaN(valor) || valor <= 0) {
      toast.error('Informe um valor válido')
      return
    }

    if (valor > clienteSelecionado.saldo_devedor) {
      toast.error('Valor maior que o saldo devedor')
      return
    }

    setProcessando(true)
    try {
      const { error } = await supabase
        .from('crediario')
        .insert({
          empresa_id: empresaId,
          cliente_id: clienteSelecionado.id,
          tipo: 'credito',
          valor: valor,
          saldo_anterior: clienteSelecionado.saldo_devedor,
          saldo_posterior: clienteSelecionado.saldo_devedor - valor,
          descricao: observacao || 'Pagamento de crediário',
          forma_pagamento: formaPagamento,
        })

      if (error) throw error

      toast.success('Pagamento registrado com sucesso!')

      // Atualizar dados
      setShowPagamento(false)
      setValorPagamento('')
      setObservacao('')
      setFormaPagamento('dinheiro')

      // Atualizar cliente selecionado
      setClienteSelecionado({
        ...clienteSelecionado,
        saldo_devedor: clienteSelecionado.saldo_devedor - valor,
      })

      // Recarregar movimentações e lista de clientes
      buscarMovimentacoes(clienteSelecionado.id)
      buscarClientes()
    } catch (error) {
      console.error('Erro ao registrar pagamento:', error)
      toast.error('Erro ao registrar pagamento')
    } finally {
      setProcessando(false)
    }
  }

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

  // Filtrar clientes pela busca
  const clientesFiltrados = clientes.filter(
    (c) =>
      c.nome.toLowerCase().includes(search.toLowerCase()) ||
      c.cpf_cnpj.includes(search)
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
      <div>
        <h1 className="text-3xl font-bold">Crediário / Fiado</h1>
        <p className="text-muted-foreground">Gerencie vendas no crediário e receba pagamentos</p>
      </div>

      {/* Cards de resumo */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total em Aberto</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalDivida)}</div>
            <p className="text-xs text-muted-foreground">
              {totalDevedores} cliente{totalDevedores !== 1 ? 's' : ''} devendo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Clientes com Crédito</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientes.length}</div>
            <p className="text-xs text-muted-foreground">
              Com limite de crédito configurado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Limite Total</CardTitle>
            <Wallet className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(clientes.reduce((acc, c) => acc + c.limite_credito, 0))}
            </div>
            <p className="text-xs text-muted-foreground">
              Somando todos os clientes
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Lista de clientes */}
        <Card>
          <CardHeader>
            <CardTitle>Clientes</CardTitle>
            <CardDescription>Selecione um cliente para ver o histórico</CardDescription>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou CPF/CNPJ..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {clientesFiltrados.length > 0 ? (
                <div className="space-y-2">
                  {clientesFiltrados.map((cliente) => (
                    <button
                      key={cliente.id}
                      className={`w-full p-3 rounded-lg border text-left transition-colors hover:bg-muted ${
                        clienteSelecionado?.id === cliente.id ? 'bg-muted border-primary' : ''
                      }`}
                      onClick={() => selecionarCliente(cliente)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{cliente.nome}</p>
                          <p className="text-sm text-muted-foreground">{cliente.cpf_cnpj}</p>
                        </div>
                        <div className="text-right">
                          {cliente.saldo_devedor > 0 ? (
                            <>
                              <p className="text-sm text-muted-foreground">Deve</p>
                              <p className="font-bold text-red-600">
                                {formatCurrency(cliente.saldo_devedor)}
                              </p>
                            </>
                          ) : (
                            <Badge variant="secondary" className="bg-green-100 text-green-700">
                              Em dia
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                        <span>Limite: {formatCurrency(cliente.limite_credito)}</span>
                        <span>
                          Disponível: {formatCurrency(cliente.limite_credito - cliente.saldo_devedor)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>Nenhum cliente encontrado</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Detalhes do cliente */}
        <Card>
          <CardHeader>
            <CardTitle>
              {clienteSelecionado ? clienteSelecionado.nome : 'Selecione um cliente'}
            </CardTitle>
            {clienteSelecionado && (
              <CardDescription>{clienteSelecionado.cpf_cnpj}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {clienteSelecionado ? (
              <div className="space-y-4">
                {/* Resumo do cliente */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground">Saldo Devedor</p>
                    <p className="text-xl font-bold text-red-600">
                      {formatCurrency(clienteSelecionado.saldo_devedor)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground">Crédito Disponível</p>
                    <p className="text-xl font-bold text-green-600">
                      {formatCurrency(clienteSelecionado.limite_credito - clienteSelecionado.saldo_devedor)}
                    </p>
                  </div>
                </div>

                {/* Botão de receber pagamento */}
                {clienteSelecionado.saldo_devedor > 0 && (
                  <Button className="w-full" onClick={() => setShowPagamento(true)}>
                    <DollarSign className="h-4 w-4 mr-2" />
                    Receber Pagamento
                  </Button>
                )}

                {/* Histórico de movimentações */}
                <div>
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    Histórico
                  </h3>
                  {loadingMovimentacoes ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : movimentacoes.length > 0 ? (
                    <ScrollArea className="h-[250px]">
                      <div className="space-y-2">
                        {movimentacoes.map((mov) => (
                          <div
                            key={mov.id}
                            className="flex items-center justify-between p-2 rounded border text-sm"
                          >
                            <div className="flex items-center gap-2">
                              {mov.tipo === 'debito' ? (
                                <ArrowUpCircle className="h-4 w-4 text-red-500" />
                              ) : (
                                <ArrowDownCircle className="h-4 w-4 text-green-500" />
                              )}
                              <div>
                                <p className="font-medium">
                                  {mov.tipo === 'debito' ? 'Compra' : 'Pagamento'}
                                  {mov.venda && mov.venda[0] && ` - Venda #${mov.venda[0].numero}`}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(mov.created_at)}
                                </p>
                                {mov.descricao && (
                                  <p className="text-xs text-muted-foreground">{mov.descricao}</p>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`font-medium ${mov.tipo === 'debito' ? 'text-red-600' : 'text-green-600'}`}>
                                {mov.tipo === 'debito' ? '+' : '-'}{formatCurrency(mov.valor)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Saldo: {formatCurrency(mov.saldo_posterior)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma movimentação registrada
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p>Selecione um cliente para ver os detalhes</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de pagamento */}
      <Dialog open={showPagamento} onOpenChange={setShowPagamento}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receber Pagamento</DialogTitle>
            <DialogDescription>
              Cliente: {clienteSelecionado?.nome}
              <br />
              Saldo devedor: {clienteSelecionado && formatCurrency(clienteSelecionado.saldo_devedor)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Valor do Pagamento</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max={clienteSelecionado?.saldo_devedor}
                placeholder="0,00"
                value={valorPagamento}
                onChange={(e) => setValorPagamento(e.target.value)}
                autoFocus
              />
              {clienteSelecionado && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setValorPagamento(clienteSelecionado.saldo_devedor.toString())}
                  >
                    Pagar tudo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setValorPagamento((clienteSelecionado.saldo_devedor / 2).toFixed(2))}
                  >
                    50%
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dinheiro">
                    <span className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Dinheiro
                    </span>
                  </SelectItem>
                  <SelectItem value="pix">
                    <span className="flex items-center gap-2">
                      <QrCode className="h-4 w-4" />
                      PIX
                    </span>
                  </SelectItem>
                  <SelectItem value="cartao_debito">
                    <span className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Cartão Débito
                    </span>
                  </SelectItem>
                  <SelectItem value="cartao_credito">
                    <span className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Cartão Crédito
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Observação (opcional)</Label>
              <Textarea
                placeholder="Observações sobre o pagamento..."
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPagamento(false)}>
              Cancelar
            </Button>
            <Button onClick={registrarPagamento} disabled={processando}>
              {processando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                'Confirmar Pagamento'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
