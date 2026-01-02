'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useCartStore } from '@/stores/cart-store'
import { useOffline } from '@/lib/hooks/use-offline'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  Search,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  DollarSign,
  QrCode,
  ArrowLeft,
  ShoppingCart,
  X,
  Loader2,
  CheckCircle,
  Wifi,
  WifiOff,
  RefreshCw,
  Download,
  CloudOff,
  FileText,
  Printer,
  AlertCircle,
} from 'lucide-react'

interface Produto {
  id: string
  codigo: string
  codigo_barras: string | null
  nome: string
  preco_venda: number
  estoque_atual: number
  unidade: string
}

interface NFCeResult {
  sucesso: boolean
  chave?: string
  protocolo?: string
  mensagem: string
}

export default function PDVPage() {
  const supabase = createClient()
  const searchRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<string | null>(null)
  const [valorRecebido, setValorRecebido] = useState('')
  const [emitirNFCe, setEmitirNFCe] = useState(true)
  const [nfceResult, setNfceResult] = useState<NFCeResult | null>(null)
  const [cpfCliente, setCpfCliente] = useState('')
  const [fiscalConfigurado, setFiscalConfigurado] = useState(false)

  const {
    items,
    desconto,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    getSubtotal,
    getTotal,
    getTotalItems,
  } = useCartStore()

  const {
    isOnline,
    isSyncing,
    vendasPendentes,
    cacheAllProducts,
    buscarProdutoOffline,
    salvarVenda,
    sincronizarVendas,
  } = useOffline()

  const subtotal = getSubtotal()
  const total = getTotal()
  const troco = parseFloat(valorRecebido || '0') - total

  // Verificar se fiscal está configurado
  useEffect(() => {
    async function verificarFiscal() {
      try {
        const response = await fetch('/api/fiscal/status')
        if (response.ok) {
          const data = await response.json()
          // Considera configurado se não retornou erro de certificado
          setFiscalConfigurado(!data.nfce?.mensagem?.includes('não configurado'))
        }
      } catch {
        setFiscalConfigurado(false)
      }
    }
    verificarFiscal()
  }, [])

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  // Buscar produtos (online ou offline)
  async function buscarProdutos(termo: string) {
    if (!termo.trim()) {
      setProdutos([])
      return
    }

    setLoading(true)
    try {
      let resultados: Produto[] = []

      if (isOnline) {
        // Busca online
        const { data, error } = await supabase
          .from('produtos')
          .select('id, codigo, codigo_barras, nome, preco_venda, estoque_atual, unidade')
          .eq('ativo', true)
          .or(`codigo.ilike.%${termo}%,codigo_barras.eq.${termo},nome.ilike.%${termo}%`)
          .order('nome')
          .limit(10)

        if (error) throw error
        resultados = data || []
      } else {
        // Busca offline no cache
        const produtosCache = await buscarProdutoOffline(termo)
        resultados = produtosCache.map(p => ({
          id: p.id,
          codigo: p.codigo,
          codigo_barras: p.codigo_barras,
          nome: p.nome,
          preco_venda: p.preco_venda,
          estoque_atual: p.estoque_atual,
          unidade: p.unidade,
        }))
      }

      // Se encontrou apenas um produto pelo código de barras exato, adiciona direto
      if (resultados.length === 1 && resultados[0].codigo_barras === termo) {
        adicionarProduto(resultados[0])
        setSearch('')
        setProdutos([])
        searchRef.current?.focus()
      } else {
        setProdutos(resultados)
      }
    } catch (error) {
      console.error('Erro ao buscar produtos:', error)
      // Se deu erro online, tenta buscar offline
      if (isOnline) {
        try {
          const produtosCache = await buscarProdutoOffline(termo)
          setProdutos(produtosCache.map(p => ({
            id: p.id,
            codigo: p.codigo,
            codigo_barras: p.codigo_barras,
            nome: p.nome,
            preco_venda: p.preco_venda,
            estoque_atual: p.estoque_atual,
            unidade: p.unidade,
          })))
          toast.info('Usando dados em cache')
        } catch {
          toast.error('Erro ao buscar produtos')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  // Debounce na busca
  useEffect(() => {
    const timer = setTimeout(() => {
      buscarProdutos(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  function adicionarProduto(produto: Produto) {
    if (produto.estoque_atual <= 0) {
      toast.error('Produto sem estoque')
      return
    }

    addItem({
      id: produto.id,
      codigo: produto.codigo,
      nome: produto.nome,
      preco: produto.preco_venda,
    })

    toast.success(`${produto.nome} adicionado`)
    setSearch('')
    setProdutos([])
    searchRef.current?.focus()
  }

  // Finalizar venda (online ou offline)
  async function finalizarVenda() {
    if (!selectedPayment) {
      toast.error('Selecione uma forma de pagamento')
      return
    }

    if (selectedPayment === 'dinheiro' && troco < 0) {
      toast.error('Valor recebido insuficiente')
      return
    }

    setPaymentLoading(true)
    setNfceResult(null)

    try {
      // Obter usuario
      const { data: { user } } = await supabase.auth.getUser()
      let usuarioId = 'offline-user'

      if (user) {
        const { data: userData } = await supabase
          .from('usuarios')
          .select('id, empresa_id')
          .eq('auth_id', user.id)
          .single()

        if (userData) {
          usuarioId = userData.id
        }
      }

      // Mapear forma de pagamento para código fiscal
      const formasPagamentoFiscal: Record<string, string> = {
        'dinheiro': '01',
        'cartao_credito': '03',
        'cartao_debito': '04',
        'pix': '17',
      }

      const formaPagamento = selectedPayment === 'cartao_credito' ? 'cartao_credito' :
                            selectedPayment === 'cartao_debito' ? 'cartao_debito' :
                            selectedPayment === 'pix' ? 'pix' : 'dinheiro'

      const vendaData = {
        tempId: `venda-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        itens: items.map((item) => ({
          produto_id: item.id,
          codigo: item.codigo,
          nome: item.nome,
          quantidade: item.quantidade,
          preco_unitario: item.preco,
          desconto: 0,
          total: item.preco * item.quantidade,
        })),
        pagamentos: [{
          forma: formaPagamento,
          valor: total,
        }],
        subtotal,
        desconto,
        total,
        usuario_id: usuarioId,
      }

      if (isOnline) {
        // Tentar salvar online
        try {
          const { data: userData } = await supabase
            .from('usuarios')
            .select('id, empresa_id')
            .eq('auth_id', user?.id)
            .single()

          if (!userData) throw new Error('Usuario nao encontrado')

          // Criar venda
          const { data: venda, error: vendaError } = await supabase
            .from('vendas')
            .insert({
              empresa_id: userData.empresa_id,
              usuario_id: userData.id,
              subtotal,
              desconto,
              total,
              status: 'finalizada',
              tipo_documento: emitirNFCe && fiscalConfigurado ? 'nfce' : 'sem_nota',
            })
            .select()
            .single()

          if (vendaError) throw vendaError

          // Criar itens da venda
          const itensVenda = items.map((item) => ({
            venda_id: venda.id,
            produto_id: item.id,
            quantidade: item.quantidade,
            preco_unitario: item.preco,
            desconto: 0,
            total: item.preco * item.quantidade,
          }))

          const { error: itensError } = await supabase
            .from('venda_itens')
            .insert(itensVenda)

          if (itensError) throw itensError

          // Criar pagamento
          const { error: pagamentoError } = await supabase
            .from('venda_pagamentos')
            .insert({
              venda_id: venda.id,
              forma_pagamento: formaPagamento,
              valor: total,
            })

          if (pagamentoError) throw pagamentoError

          // Emitir NFC-e se configurado e habilitado
          if (emitirNFCe && fiscalConfigurado) {
            try {
              const nfceResponse = await fetch('/api/fiscal/nfce', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  produtos: items.map((item) => ({
                    codigo: item.codigo,
                    nome: item.nome,
                    quantidade: item.quantidade,
                    preco_unitario: item.preco,
                    total: item.preco * item.quantidade,
                    unidade: 'UN',
                  })),
                  pagamentos: [{
                    forma: formasPagamentoFiscal[formaPagamento] || '01',
                    valor: total,
                  }],
                  cliente: cpfCliente ? {
                    cpf_cnpj: cpfCliente.replace(/\D/g, ''),
                  } : undefined,
                  valorTotal: total,
                  valorDesconto: desconto,
                }),
              })

              const nfceData = await nfceResponse.json()
              setNfceResult(nfceData)

              if (nfceData.sucesso) {
                // Atualizar venda com dados da NFC-e
                await supabase
                  .from('vendas')
                  .update({
                    chave_nfce: nfceData.chave,
                    protocolo_nfce: nfceData.protocolo,
                  })
                  .eq('id', venda.id)

                toast.success('NFC-e emitida com sucesso!')
              } else {
                toast.error('Erro ao emitir NFC-e', {
                  description: nfceData.mensagem,
                })
              }
            } catch (nfceError) {
              console.error('Erro ao emitir NFC-e:', nfceError)
              setNfceResult({
                sucesso: false,
                mensagem: 'Erro ao comunicar com SEFAZ',
              })
              toast.error('Erro ao emitir NFC-e')
            }
          }

        } catch (error) {
          console.error('Erro ao salvar online, salvando offline:', error)
          await salvarVenda(vendaData)
          toast.info('Venda salva para sincronizar depois')
        }
      } else {
        // Salvar offline
        await salvarVenda(vendaData)
        toast.info('Venda salva offline', {
          description: 'Sera sincronizada quando voltar a conexao',
        })
      }

      setPaymentSuccess(true)

      // Após alguns segundos, limpar e fechar
      setTimeout(() => {
        clearCart()
        setShowPayment(false)
        setPaymentSuccess(false)
        setSelectedPayment(null)
        setValorRecebido('')
        setNfceResult(null)
        setCpfCliente('')
        searchRef.current?.focus()
      }, nfceResult?.sucesso ? 5000 : 2000)

    } catch (error) {
      console.error('Erro ao finalizar venda:', error)
      toast.error('Erro ao finalizar venda')
    } finally {
      setPaymentLoading(false)
    }
  }

  // Imprimir DANFCE
  function imprimirCupom() {
    if (!nfceResult?.sucesso) return
    // Abre popup para imprimir (simplificado)
    const printWindow = window.open('', '_blank', 'width=400,height=600')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head><title>DANFCE</title></head>
          <body style="font-family: monospace; padding: 20px;">
            <h3 style="text-align: center;">NFC-e EMITIDA</h3>
            <p><strong>Chave:</strong><br>${nfceResult.chave}</p>
            <p><strong>Protocolo:</strong> ${nfceResult.protocolo}</p>
            <p><strong>Total:</strong> ${formatCurrency(total)}</p>
            <hr>
            <p style="text-align: center; font-size: 10px;">
              Consulte pela chave de acesso em<br>
              www.nfce.fazenda.gov.br/portal
            </p>
          </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.print()
    }
  }

  // Atalhos de teclado
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'F2') {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === 'F4' && items.length > 0) {
        e.preventDefault()
        setShowPayment(true)
      } else if (e.key === 'Escape') {
        setShowPayment(false)
        setProdutos([])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [items])

  return (
    <div className="flex h-screen">
      {/* Área Principal - Produtos */}
      <div className="flex-1 flex flex-col p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">PDV - Ponto de Venda</h1>
            {/* Status de conexao */}
            {isOnline ? (
              <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                <Wifi className="h-3 w-3 mr-1" />
                Online
              </Badge>
            ) : (
              <Badge variant="destructive">
                <WifiOff className="h-3 w-3 mr-1" />
                Offline
              </Badge>
            )}
            {/* Vendas pendentes */}
            {vendasPendentes > 0 && (
              <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700">
                <CloudOff className="h-3 w-3 mr-1" />
                {vendasPendentes} pendente{vendasPendentes > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={cacheAllProducts}
              disabled={!isOnline}
              title="Baixar produtos para uso offline"
            >
              <Download className="h-4 w-4 mr-1" />
              <span className="hidden md:inline">Cache</span>
            </Button>
            {vendasPendentes > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={sincronizarVendas}
                disabled={!isOnline || isSyncing}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
                <span className="hidden md:inline">Sincronizar</span>
              </Button>
            )}
            <div className="text-sm text-muted-foreground hidden lg:block">
              F2: Buscar | F4: Pagamento | ESC: Cancelar
            </div>
          </div>
        </div>

        {/* Busca */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            ref={searchRef}
            placeholder="Digite o código de barras ou nome do produto..."
            className="pl-12 h-14 text-lg"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Lista de produtos encontrados */}
        {produtos.length > 0 && (
          <Card className="mb-4">
            <CardContent className="p-2">
              <ScrollArea className="max-h-64">
                {produtos.map((produto) => (
                  <button
                    key={produto.id}
                    className="w-full flex items-center justify-between p-3 hover:bg-muted rounded-lg transition-colors text-left"
                    onClick={() => adicionarProduto(produto)}
                  >
                    <div>
                      <p className="font-medium">{produto.nome}</p>
                      <p className="text-sm text-muted-foreground">
                        Código: {produto.codigo}
                        {produto.codigo_barras && ` | EAN: ${produto.codigo_barras}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{formatCurrency(produto.preco_venda)}</p>
                      <p className="text-sm text-muted-foreground">
                        Estoque: {produto.estoque_atual} {produto.unidade}
                      </p>
                    </div>
                  </button>
                ))}
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Área de itens do carrinho (visualização principal) */}
        <Card className="flex-1 overflow-hidden">
          <CardContent className="p-0 h-full flex flex-col">
            {items.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-6">
                <ShoppingCart className="h-20 w-20 mb-4 opacity-20" />
                <p className="text-xl">Carrinho vazio</p>
                <p className="text-sm">Digite o código de barras ou nome do produto</p>
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="divide-y">
                  {items.map((item, index) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 p-4 hover:bg-muted/50"
                    >
                      <span className="text-2xl font-bold text-muted-foreground w-8">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <p className="font-medium">{item.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(item.preco)} x {item.quantidade}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(item.id, item.quantidade - 1)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-12 text-center font-medium">
                          {item.quantidade}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(item.id, item.quantidade + 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="font-bold text-lg w-28 text-right">
                        {formatCurrency(item.preco * item.quantidade)}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive h-8 w-8"
                        onClick={() => removeItem(item.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sidebar - Resumo e Pagamento */}
      <div className="w-80 border-l flex flex-col bg-muted/30">
        {/* Header do carrinho */}
        <div className="p-4 border-b">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Resumo
            {getTotalItems() > 0 && (
              <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                {getTotalItems()}
              </span>
            )}
          </h2>
        </div>

        {/* Espaçador */}
        <div className="flex-1" />

        {/* Totais */}
        <div className="border-t p-4 space-y-3">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="font-medium">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Desconto</span>
            <span>-{formatCurrency(desconto)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-2xl font-bold">
            <span>Total</span>
            <span className="text-primary">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Ações */}
        <div className="border-t p-4 space-y-2">
          <Button
            className="w-full h-14 text-lg"
            disabled={items.length === 0}
            onClick={() => setShowPayment(true)}
          >
            Finalizar Venda (F4)
          </Button>
          <Button
            variant="outline"
            className="w-full"
            disabled={items.length === 0}
            onClick={clearCart}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Limpar Carrinho
          </Button>
        </div>
      </div>

      {/* Modal de Pagamento */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="sm:max-w-md">
          {paymentSuccess ? (
            <div className="flex flex-col items-center justify-center py-8">
              <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
              <DialogTitle className="text-2xl text-center">Venda Finalizada!</DialogTitle>
              <DialogDescription className="text-center mt-2">
                Total: {formatCurrency(total)}
                {selectedPayment === 'dinheiro' && troco > 0 && (
                  <span className="block mt-2 text-lg font-bold text-green-600">
                    Troco: {formatCurrency(troco)}
                  </span>
                )}
              </DialogDescription>

              {/* Resultado NFC-e */}
              {nfceResult && (
                <div className={`mt-4 p-4 rounded-lg w-full ${
                  nfceResult.sucesso
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200'
                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {nfceResult.sucesso ? (
                      <FileText className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span className={`font-medium ${nfceResult.sucesso ? 'text-green-700' : 'text-red-700'}`}>
                      {nfceResult.sucesso ? 'NFC-e Autorizada' : 'Erro na NFC-e'}
                    </span>
                  </div>
                  {nfceResult.sucesso ? (
                    <>
                      <p className="text-xs text-muted-foreground mb-1">
                        Protocolo: {nfceResult.protocolo}
                      </p>
                      <p className="text-xs font-mono text-muted-foreground break-all">
                        Chave: {nfceResult.chave}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 w-full"
                        onClick={imprimirCupom}
                      >
                        <Printer className="h-4 w-4 mr-2" />
                        Imprimir Cupom
                      </Button>
                    </>
                  ) : (
                    <p className="text-xs text-red-600">
                      {nfceResult.mensagem}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Forma de Pagamento</DialogTitle>
                <DialogDescription>
                  Total a pagar: <span className="font-bold text-xl">{formatCurrency(total)}</span>
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-3 py-4">
                <Button
                  variant={selectedPayment === 'dinheiro' ? 'default' : 'outline'}
                  className="h-20 flex-col"
                  onClick={() => setSelectedPayment('dinheiro')}
                >
                  <DollarSign className="h-6 w-6 mb-1" />
                  Dinheiro
                </Button>
                <Button
                  variant={selectedPayment === 'cartao_credito' ? 'default' : 'outline'}
                  className="h-20 flex-col"
                  onClick={() => setSelectedPayment('cartao_credito')}
                >
                  <CreditCard className="h-6 w-6 mb-1" />
                  Crédito
                </Button>
                <Button
                  variant={selectedPayment === 'cartao_debito' ? 'default' : 'outline'}
                  className="h-20 flex-col"
                  onClick={() => setSelectedPayment('cartao_debito')}
                >
                  <CreditCard className="h-6 w-6 mb-1" />
                  Débito
                </Button>
                <Button
                  variant={selectedPayment === 'pix' ? 'default' : 'outline'}
                  className="h-20 flex-col"
                  onClick={() => setSelectedPayment('pix')}
                >
                  <QrCode className="h-6 w-6 mb-1" />
                  PIX
                </Button>
              </div>

              {selectedPayment === 'dinheiro' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Valor Recebido</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={valorRecebido}
                      onChange={(e) => setValorRecebido(e.target.value)}
                      className="text-lg h-12"
                      autoFocus
                    />
                  </div>
                  {parseFloat(valorRecebido || '0') >= total && (
                    <div className="bg-green-100 dark:bg-green-900/20 p-3 rounded-lg text-center">
                      <span className="text-sm">Troco:</span>
                      <span className="block text-2xl font-bold text-green-600">
                        {formatCurrency(troco)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Opções de NFC-e */}
              <div className="border-t pt-4 mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="emitir-nfce" className="text-sm">
                      Emitir NFC-e
                    </Label>
                  </div>
                  <Switch
                    id="emitir-nfce"
                    checked={emitirNFCe}
                    onCheckedChange={setEmitirNFCe}
                    disabled={!fiscalConfigurado}
                  />
                </div>

                {!fiscalConfigurado && (
                  <p className="text-xs text-muted-foreground">
                    Configure o certificado digital em{' '}
                    <Link href="/dashboard/fiscal/configuracoes" className="underline text-primary">
                      Configurações Fiscais
                    </Link>
                  </p>
                )}

                {emitirNFCe && fiscalConfigurado && (
                  <div>
                    <Label htmlFor="cpf-cliente" className="text-sm">
                      CPF do cliente (opcional)
                    </Label>
                    <Input
                      id="cpf-cliente"
                      placeholder="000.000.000-00"
                      value={cpfCliente}
                      onChange={(e) => setCpfCliente(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                )}
              </div>

              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setShowPayment(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={finalizarVenda}
                  disabled={!selectedPayment || paymentLoading}
                >
                  {paymentLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {emitirNFCe && fiscalConfigurado ? 'Emitindo NFC-e...' : 'Processando...'}
                    </>
                  ) : (
                    'Confirmar Pagamento'
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
