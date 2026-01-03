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
  Wallet,
  LockOpen,
  Receipt,
  UserCheck,
  Users,
  Star,
  Gift,
  Keyboard,
  HelpCircle,
} from 'lucide-react'
import { printReceipt, type DadosRecibo } from '@/components/pdv/receipt'
import { PixQRCode } from '@/components/pdv/pix-qrcode'

interface Produto {
  id: string
  codigo: string
  codigo_barras: string | null
  nome: string
  preco_venda: number
  estoque_atual: number
  unidade: string
}

interface Cliente {
  id: string
  nome: string
  cpf_cnpj: string
  telefone?: string
  limite_credito: number
  saldo_devedor: number
}

interface FidelidadeConfig {
  id: string
  pontos_por_real: number
  valor_ponto_resgate: number
  validade_dias: number
  ativo: boolean
}

interface ClientePontos {
  saldo_pontos: number
  total_acumulado: number
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
  const [caixaAberto, setCaixaAberto] = useState<{ id: string; valor_abertura: number } | null>(null)
  const [loadingCaixa, setLoadingCaixa] = useState(true)
  const [empresa, setEmpresa] = useState<{ nome: string; cnpj: string; endereco?: string; chavePix?: string; cidade?: string } | null>(null)
  // Estados para crediário
  const [showClienteModal, setShowClienteModal] = useState(false)
  const [clienteSearch, setClienteSearch] = useState('')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null)
  const [loadingClientes, setLoadingClientes] = useState(false)
  // Estados para fidelidade
  const [fidelidadeConfig, setFidelidadeConfig] = useState<FidelidadeConfig | null>(null)
  const [clientePontos, setClientePontos] = useState<ClientePontos | null>(null)
  const [usarPontos, setUsarPontos] = useState(false)
  const [pontosAUsar, setPontosAUsar] = useState('')
  const [pontosGanhos, setPontosGanhos] = useState<number | null>(null)
  const [showAjuda, setShowAjuda] = useState(false)
  const [vendaFinalizada, setVendaFinalizada] = useState<{
    numero?: number
    itens: { codigo: string; nome: string; quantidade: number; preco: number; total: number }[]
    subtotal: number
    desconto: number
    total: number
    pagamentos: { forma: string; valor: number }[]
    valorRecebido?: number
    troco?: number
    operador: string
  } | null>(null)

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
  // Calcular desconto de pontos
  const pontosUsados = usarPontos && clientePontos && fidelidadeConfig
    ? Math.min(parseFloat(pontosAUsar || '0') || 0, clientePontos.saldo_pontos)
    : 0
  const descontoPontos = pontosUsados * (fidelidadeConfig?.valor_ponto_resgate || 0)
  const total = Math.max(0, getTotal() - descontoPontos)
  const troco = parseFloat(valorRecebido || '0') - total

  // Verificar se fiscal está configurado e buscar dados da empresa
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

    async function buscarEmpresa() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: usuario } = await supabase
          .from('usuarios')
          .select('empresa_id')
          .eq('auth_id', user.id)
          .single()

        if (!usuario) return

        const { data: empresaData } = await supabase
          .from('empresas')
          .select('razao_social, nome_fantasia, cnpj, endereco, config_fiscal')
          .eq('id', usuario.empresa_id)
          .single()

        if (empresaData) {
          let enderecoFormatado: string | undefined
          let cidade: string | undefined

          if (empresaData.endereco && typeof empresaData.endereco === 'object') {
            const end = empresaData.endereco as Record<string, string>
            cidade = end.cidade
            enderecoFormatado = [
              end.logradouro,
              end.numero,
              end.bairro,
              end.cidade,
              end.uf,
            ].filter(Boolean).join(', ')
          }

          // Buscar chave PIX do config_fiscal
          let chavePix: string | undefined
          if (empresaData.config_fiscal && typeof empresaData.config_fiscal === 'object') {
            const config = empresaData.config_fiscal as Record<string, unknown>
            chavePix = config.chave_pix as string | undefined
          }

          setEmpresa({
            nome: empresaData.nome_fantasia || empresaData.razao_social,
            cnpj: empresaData.cnpj,
            endereco: enderecoFormatado || undefined,
            chavePix: chavePix || undefined,
            cidade: cidade || undefined,
          })
        }
      } catch (error) {
        console.error('Erro ao buscar empresa:', error)
      }
    }

    async function buscarFidelidadeConfig() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: usuario } = await supabase
          .from('usuarios')
          .select('empresa_id')
          .eq('auth_id', user.id)
          .single()

        if (!usuario) return

        const { data: config } = await supabase
          .from('fidelidade_config')
          .select('*')
          .eq('empresa_id', usuario.empresa_id)
          .eq('ativo', true)
          .single()

        if (config) {
          setFidelidadeConfig(config)
        }
      } catch {
        // Programa de fidelidade não configurado
      }
    }

    verificarFiscal()
    buscarEmpresa()
    buscarFidelidadeConfig()
  }, [])

  // Verificar se há caixa aberto
  useEffect(() => {
    async function verificarCaixa() {
      try {
        const response = await fetch('/api/caixa')
        if (response.ok) {
          const data = await response.json()
          setCaixaAberto(data.caixa)
        }
      } catch {
        setCaixaAberto(null)
      } finally {
        setLoadingCaixa(false)
      }
    }
    verificarCaixa()
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

  // Buscar clientes para crediário
  async function buscarClientes(termo: string) {
    if (!termo.trim()) {
      setClientes([])
      return
    }

    setLoadingClientes(true)
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, cpf_cnpj, telefone, limite_credito, saldo_devedor')
        .eq('ativo', true)
        .or(`nome.ilike.%${termo}%,cpf_cnpj.ilike.%${termo}%`)
        .order('nome')
        .limit(10)

      if (error) throw error
      setClientes(data || [])
    } catch (error) {
      console.error('Erro ao buscar clientes:', error)
      toast.error('Erro ao buscar clientes')
    } finally {
      setLoadingClientes(false)
    }
  }

  // Selecionar cliente para crediário
  function selecionarCliente(cliente: Cliente) {
    const creditoDisponivel = cliente.limite_credito - cliente.saldo_devedor

    if (selectedPayment === 'crediario' && creditoDisponivel < total) {
      toast.error(`Crédito insuficiente. Disponível: ${formatCurrency(creditoDisponivel)}`)
      return
    }

    setClienteSelecionado(cliente)
    setShowClienteModal(false)
    setClienteSearch('')
    setClientes([])
    toast.success(`Cliente ${cliente.nome} selecionado`)

    // Buscar pontos do cliente se programa de fidelidade ativo
    if (fidelidadeConfig) {
      buscarPontosCliente(cliente.id)
    }
  }

  // Buscar pontos do cliente
  async function buscarPontosCliente(clienteId: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: usuario } = await supabase
        .from('usuarios')
        .select('empresa_id')
        .eq('auth_id', user.id)
        .single()

      if (!usuario) return

      const { data: pontos } = await supabase
        .from('fidelidade_pontos')
        .select('saldo_pontos, total_acumulado')
        .eq('empresa_id', usuario.empresa_id)
        .eq('cliente_id', clienteId)
        .single()

      setClientePontos(pontos || null)
    } catch {
      setClientePontos(null)
    }
  }

  // Debounce na busca de clientes
  useEffect(() => {
    if (!showClienteModal) return
    const timer = setTimeout(() => {
      buscarClientes(clienteSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [clienteSearch, showClienteModal])

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

    // Validação para crediário
    if (selectedPayment === 'crediario') {
      if (!clienteSelecionado) {
        toast.error('Selecione um cliente para venda no crediário')
        setShowClienteModal(true)
        return
      }

      const creditoDisponivel = clienteSelecionado.limite_credito - clienteSelecionado.saldo_devedor
      if (creditoDisponivel < total) {
        toast.error(`Crédito insuficiente. Disponível: ${formatCurrency(creditoDisponivel)}`)
        return
      }
    }

    setPaymentLoading(true)
    setNfceResult(null)

    try {
      // Obter usuario
      const { data: { user } } = await supabase.auth.getUser()
      let usuarioId = 'offline-user'
      let operadorNome = 'Operador'
      let vendaNumero: number | undefined

      if (user) {
        const { data: userData } = await supabase
          .from('usuarios')
          .select('id, empresa_id, nome')
          .eq('auth_id', user.id)
          .single()

        if (userData) {
          usuarioId = userData.id
          operadorNome = userData.nome || 'Operador'
        }
      }

      // Mapear forma de pagamento para código fiscal
      const formasPagamentoFiscal: Record<string, string> = {
        'dinheiro': '01',
        'cartao_credito': '03',
        'cartao_debito': '04',
        'pix': '17',
        'crediario': '05', // Crédito loja
      }

      const formaPagamento = selectedPayment === 'cartao_credito' ? 'cartao_credito' :
                            selectedPayment === 'cartao_debito' ? 'cartao_debito' :
                            selectedPayment === 'pix' ? 'pix' :
                            selectedPayment === 'crediario' ? 'crediario' : 'dinheiro'

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
              caixa_id: caixaAberto?.id || null,
              subtotal,
              desconto,
              total,
              status: 'finalizada',
              tipo_documento: emitirNFCe && fiscalConfigurado ? 'nfce' : 'sem_nota',
            })
            .select()
            .single()

          if (vendaError) throw vendaError

          vendaNumero = venda.numero

          // Registrar movimento no caixa (se houver caixa aberto)
          if (caixaAberto?.id) {
            await supabase
              .from('caixa_movimentos')
              .insert({
                caixa_id: caixaAberto.id,
                tipo: 'entrada',
                valor: total,
                descricao: `Venda #${venda.numero}`,
                venda_id: venda.id,
              })
          }

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

          // Registrar no crediário se for venda fiado
          if (formaPagamento === 'crediario' && clienteSelecionado) {
            const { error: crediarioError } = await supabase
              .from('crediario')
              .insert({
                empresa_id: userData.empresa_id,
                cliente_id: clienteSelecionado.id,
                venda_id: venda.id,
                tipo: 'debito',
                valor: total,
                saldo_anterior: clienteSelecionado.saldo_devedor,
                saldo_posterior: clienteSelecionado.saldo_devedor + total,
                descricao: `Venda #${venda.numero} - PDV`,
              })

            if (crediarioError) {
              console.error('Erro ao registrar crediário:', crediarioError)
              // Não bloqueia a venda, apenas loga o erro
            }
          }

          // Programa de Fidelidade - Registrar resgate e acúmulo
          if (fidelidadeConfig && clienteSelecionado) {
            try {
              // Verificar/criar conta de pontos do cliente
              let saldoAtual = clientePontos?.saldo_pontos || 0

              // Sempre garantir que existe o registro de pontos
              const { error: upsertError } = await supabase
                .from('fidelidade_pontos')
                .upsert({
                  empresa_id: userData.empresa_id,
                  cliente_id: clienteSelecionado.id,
                  saldo_pontos: saldoAtual,
                  total_acumulado: clientePontos?.total_acumulado || 0,
                  total_resgatado: 0,
                }, { onConflict: 'empresa_id,cliente_id', ignoreDuplicates: true })

              if (upsertError) {
                console.error('Erro ao criar registro de pontos:', upsertError)
              }

              // 1. Registrar resgate de pontos (se usou)
              if (usarPontos && pontosUsados > 0) {
                await supabase
                  .from('fidelidade_movimentos')
                  .insert({
                    empresa_id: userData.empresa_id,
                    cliente_id: clienteSelecionado.id,
                    venda_id: venda.id,
                    tipo: 'resgate',
                    pontos: -pontosUsados,
                    saldo_anterior: saldoAtual,
                    saldo_posterior: saldoAtual - pontosUsados,
                    valor_venda: total,
                    descricao: `Resgate na venda #${venda.numero}`,
                  })

                // Atualizar saldo local
                saldoAtual -= pontosUsados
              }

              // 2. Calcular e registrar acúmulo de pontos
              const valorParaPontos = total // Valor após desconto
              const pontosGanhosVenda = Math.floor(valorParaPontos * fidelidadeConfig.pontos_por_real)

              if (pontosGanhosVenda > 0) {
                // Calcular data de expiração
                const dataExpiracao = fidelidadeConfig.validade_dias > 0
                  ? new Date(Date.now() + fidelidadeConfig.validade_dias * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                  : null

                await supabase
                  .from('fidelidade_movimentos')
                  .insert({
                    empresa_id: userData.empresa_id,
                    cliente_id: clienteSelecionado.id,
                    venda_id: venda.id,
                    tipo: 'acumulo',
                    pontos: pontosGanhosVenda,
                    saldo_anterior: saldoAtual,
                    saldo_posterior: saldoAtual + pontosGanhosVenda,
                    valor_venda: valorParaPontos,
                    data_expiracao: dataExpiracao,
                    descricao: `Acúmulo na venda #${venda.numero}`,
                  })

                setPontosGanhos(pontosGanhosVenda)
              }
            } catch (fidelError) {
              console.error('Erro no programa de fidelidade:', fidelError)
              // Não bloqueia a venda
            }
          }

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

      // Salvar dados da venda para impressão
      setVendaFinalizada({
        numero: vendaNumero,
        itens: items.map((item) => ({
          codigo: item.codigo,
          nome: item.nome,
          quantidade: item.quantidade,
          preco: item.preco,
          total: item.preco * item.quantidade,
        })),
        subtotal,
        desconto,
        total,
        pagamentos: [{ forma: formaPagamento, valor: total }],
        valorRecebido: selectedPayment === 'dinheiro' ? parseFloat(valorRecebido || '0') : undefined,
        troco: selectedPayment === 'dinheiro' && troco > 0 ? troco : undefined,
        operador: operadorNome,
      })

      setPaymentSuccess(true)

      // Após alguns segundos, limpar e fechar (não fechar automaticamente para permitir impressão)
      setTimeout(() => {
        clearCart()
        setShowPayment(false)
        setPaymentSuccess(false)
        setSelectedPayment(null)
        setValorRecebido('')
        setNfceResult(null)
        setCpfCliente('')
        setVendaFinalizada(null)
        setClienteSelecionado(null)
        // Reset fidelidade
        setClientePontos(null)
        setUsarPontos(false)
        setPontosAUsar('')
        setPontosGanhos(null)
        searchRef.current?.focus()
      }, 10000) // 10 segundos para dar tempo de imprimir

    } catch (error) {
      console.error('Erro ao finalizar venda:', error)
      toast.error('Erro ao finalizar venda')
    } finally {
      setPaymentLoading(false)
    }
  }

  // Imprimir cupom
  function imprimirCupom() {
    if (!vendaFinalizada) {
      toast.error('Dados da venda não disponíveis')
      return
    }

    // Usar dados da empresa ou valores padrão
    const empresaData = empresa || {
      nome: 'EMPRESA',
      cnpj: '00000000000000',
      endereco: undefined,
    }

    const dadosRecibo: DadosRecibo = {
      empresa: {
        nome: empresaData.nome,
        cnpj: empresaData.cnpj,
        endereco: empresaData.endereco,
      },
      numero: vendaFinalizada.numero,
      data: new Date(),
      operador: vendaFinalizada.operador,
      itens: vendaFinalizada.itens,
      subtotal: vendaFinalizada.subtotal,
      desconto: vendaFinalizada.desconto,
      total: vendaFinalizada.total,
      pagamentos: vendaFinalizada.pagamentos,
      valorRecebido: vendaFinalizada.valorRecebido,
      troco: vendaFinalizada.troco,
      nfce: nfceResult?.sucesso
        ? { chave: nfceResult.chave, protocolo: nfceResult.protocolo }
        : undefined,
      cliente: cpfCliente ? { cpf: cpfCliente } : undefined,
    }

    printReceipt({ dados: dadosRecibo, largura: '80mm' })
  }

  // Atalhos de teclado
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignorar se estiver digitando em input
      const target = e.target as HTMLElement
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'

      switch (e.key) {
        case 'F1':
          e.preventDefault()
          setShowAjuda(true)
          break
        case 'F2':
          e.preventDefault()
          searchRef.current?.focus()
          break
        case 'F3':
          e.preventDefault()
          if (!showPayment) {
            window.open('/dashboard/clientes/novo', '_blank')
          }
          break
        case 'F4':
          e.preventDefault()
          if (items.length > 0 && !showPayment) {
            setShowPayment(true)
          }
          break
        case 'F5':
          e.preventDefault()
          if (items.length > 0 && !showPayment) {
            if (confirm('Limpar todos os itens do carrinho?')) {
              clearCart()
            }
          }
          break
        case 'F6':
          e.preventDefault()
          if (items.length > 0) {
            setShowPayment(true)
            setSelectedPayment('dinheiro')
          }
          break
        case 'F7':
          e.preventDefault()
          if (items.length > 0) {
            setShowPayment(true)
            setSelectedPayment('cartao_credito')
          }
          break
        case 'F8':
          e.preventDefault()
          if (items.length > 0) {
            setShowPayment(true)
            setSelectedPayment('cartao_debito')
          }
          break
        case 'F9':
          e.preventDefault()
          if (items.length > 0) {
            setShowPayment(true)
            setSelectedPayment('pix')
          }
          break
        case 'F10':
          e.preventDefault()
          if (items.length > 0) {
            setShowPayment(true)
            setSelectedPayment('crediario')
            if (!clienteSelecionado) {
              setShowClienteModal(true)
            }
          }
          break
        case 'F11':
          e.preventDefault()
          if (fidelidadeConfig && !showPayment) {
            setShowClienteModal(true)
          }
          break
        case 'F12':
          e.preventDefault()
          window.location.href = '/pdv/caixa'
          break
        case 'Escape':
          if (showAjuda) {
            setShowAjuda(false)
          } else if (showPayment) {
            setShowPayment(false)
          } else {
            setProdutos([])
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [items, showPayment, clienteSelecionado, fidelidadeConfig, showAjuda, clearCart])

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
            {/* Status do Caixa */}
            {!loadingCaixa && (
              <Link href="/pdv/caixa">
                {caixaAberto ? (
                  <Badge variant="default" className="bg-green-600 hover:bg-green-700 cursor-pointer">
                    <LockOpen className="h-3 w-3 mr-1" />
                    Caixa Aberto
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="cursor-pointer">
                    <Wallet className="h-3 w-3 mr-1" />
                    Abrir Caixa
                  </Badge>
                )}
              </Link>
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAjuda(true)}
              className="text-muted-foreground"
            >
              <Keyboard className="h-4 w-4 mr-1" />
              <span className="hidden md:inline">F1: Atalhos</span>
            </Button>
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
        <DialogContent className="w-[calc(100vw-80px)] max-w-none p-0 gap-0">
          {paymentSuccess ? (
            <div className="flex flex-col items-center justify-center py-6 px-6">
              <CheckCircle className="h-14 w-14 text-green-500 mb-3" />
              <DialogTitle className="text-2xl text-center">Venda Finalizada!</DialogTitle>
              <DialogDescription className="text-center mt-2">
                Total: {formatCurrency(total)}
                {selectedPayment === 'dinheiro' && troco > 0 && (
                  <span className="block mt-2 text-lg font-bold text-green-600">
                    Troco: {formatCurrency(troco)}
                  </span>
                )}
              </DialogDescription>

              {/* Grid de informações pós-venda */}
              <div className="mt-4 w-full grid grid-cols-2 gap-4">
                {/* Pontos ganhos */}
                {pontosGanhos !== null && pontosGanhos > 0 && (
                  <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200">
                    <div className="flex items-center gap-2">
                      <Star className="h-5 w-5 text-yellow-500" />
                      <span className="font-medium text-yellow-700">
                        {clienteSelecionado?.nome} ganhou <span className="text-lg font-bold">{pontosGanhos}</span> pts
                      </span>
                    </div>
                    {usarPontos && pontosUsados > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Usou {pontosUsados} pontos ({formatCurrency(descontoPontos)} desc.)
                      </p>
                    )}
                  </div>
                )}

                {/* Resultado NFC-e */}
                {nfceResult && (
                  <div className={`p-3 rounded-lg ${
                    nfceResult.sucesso
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200'
                      : 'bg-red-50 dark:bg-red-900/20 border border-red-200'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
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
                      <p className="text-xs text-muted-foreground">Protocolo: {nfceResult.protocolo}</p>
                    ) : (
                      <p className="text-xs text-red-600">{nfceResult.mensagem}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Botões de ação */}
              <div className="mt-4 w-full flex gap-3">
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={imprimirCupom}
                  disabled={!vendaFinalizada}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir Cupom
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    clearCart()
                    setShowPayment(false)
                    setPaymentSuccess(false)
                    setSelectedPayment(null)
                    setValorRecebido('')
                    setNfceResult(null)
                    setCpfCliente('')
                    setVendaFinalizada(null)
                    setClienteSelecionado(null)
                    setClientePontos(null)
                    setUsarPontos(false)
                    setPontosAUsar('')
                    setPontosGanhos(null)
                    searchRef.current?.focus()
                  }}
                >
                  Nova Venda (Enter)
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4">
              {/* Header com total */}
              <DialogHeader className="mb-3">
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-lg">Forma de Pagamento</DialogTitle>
                  <div className="text-right">
                    <span className="text-sm text-muted-foreground">Total a pagar:</span>
                    <span className="ml-2 font-bold text-2xl">{formatCurrency(total)}</span>
                    {descontoPontos > 0 && (
                      <span className="block text-xs text-yellow-600">
                        Inclui {formatCurrency(descontoPontos)} de desconto ({pontosUsados} pts)
                      </span>
                    )}
                  </div>
                </div>
              </DialogHeader>

              {/* Layout em 3 colunas */}
              <div className="grid grid-cols-3 gap-4">
                {/* Coluna 1: Formas de pagamento */}
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Forma de Pagamento</p>
                  <div className="grid grid-cols-1 gap-2">
                    <Button
                      variant={selectedPayment === 'dinheiro' ? 'default' : 'outline'}
                      className="h-12 justify-start"
                      onClick={() => setSelectedPayment('dinheiro')}
                    >
                      <DollarSign className="h-5 w-5 mr-2" />
                      Dinheiro (F6)
                    </Button>
                    <Button
                      variant={selectedPayment === 'cartao_credito' ? 'default' : 'outline'}
                      className="h-12 justify-start"
                      onClick={() => setSelectedPayment('cartao_credito')}
                    >
                      <CreditCard className="h-5 w-5 mr-2" />
                      Crédito (F7)
                    </Button>
                    <Button
                      variant={selectedPayment === 'cartao_debito' ? 'default' : 'outline'}
                      className="h-12 justify-start"
                      onClick={() => setSelectedPayment('cartao_debito')}
                    >
                      <CreditCard className="h-5 w-5 mr-2" />
                      Débito (F8)
                    </Button>
                    <Button
                      variant={selectedPayment === 'pix' ? 'default' : 'outline'}
                      className="h-12 justify-start"
                      onClick={() => setSelectedPayment('pix')}
                    >
                      <QrCode className="h-5 w-5 mr-2" />
                      PIX (F9)
                    </Button>
                    <Button
                      variant={selectedPayment === 'crediario' ? 'default' : 'outline'}
                      className="h-12 justify-start"
                      onClick={() => {
                        setSelectedPayment('crediario')
                        if (!clienteSelecionado) {
                          setShowClienteModal(true)
                        }
                      }}
                    >
                      <Users className="h-5 w-5 mr-2" />
                      Crediário (F10)
                    </Button>
                  </div>
                </div>

                {/* Coluna 2: Detalhes do pagamento */}
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Detalhes</p>

                  {/* Dinheiro: valor recebido e troco */}
                  {selectedPayment === 'dinheiro' && (
                    <div className="space-y-2">
                      <div>
                        <label className="text-sm font-medium">Valor Recebido</label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0,00"
                          value={valorRecebido}
                          onChange={(e) => setValorRecebido(e.target.value)}
                          className="text-lg h-12 mt-1"
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

                  {/* PIX: QR Code */}
                  {selectedPayment === 'pix' && (
                    <div className="border rounded-lg p-2 bg-muted/30">
                      <PixQRCode
                        valor={total}
                        chavePix={empresa?.chavePix}
                        beneficiario={empresa?.nome}
                        cidade={empresa?.cidade}
                        txid={`PDV${Date.now()}`}
                      />
                    </div>
                  )}

                  {/* Crediário: info do cliente */}
                  {selectedPayment === 'crediario' && clienteSelecionado && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <UserCheck className="h-4 w-4 text-blue-600" />
                        <span className="font-medium">{clienteSelecionado.nome}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{clienteSelecionado.cpf_cnpj}</p>
                      <div className="mt-2 flex justify-between items-center">
                        <span className="text-sm">Crédito disponível:</span>
                        <span className="font-bold text-green-600">
                          {formatCurrency(clienteSelecionado.limite_credito - clienteSelecionado.saldo_devedor)}
                        </span>
                      </div>
                      <Button
                        variant="link"
                        size="sm"
                        className="mt-1 p-0 h-auto text-xs"
                        onClick={() => setShowClienteModal(true)}
                      >
                        Trocar cliente
                      </Button>
                    </div>
                  )}

                  {selectedPayment === 'crediario' && !clienteSelecionado && (
                    <Button
                      variant="outline"
                      className="w-full h-12"
                      onClick={() => setShowClienteModal(true)}
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Selecionar Cliente (F11)
                    </Button>
                  )}

                  {/* Cartões: mensagem simples */}
                  {(selectedPayment === 'cartao_credito' || selectedPayment === 'cartao_debito') && (
                    <div className="bg-muted/50 rounded-lg p-4 text-center">
                      <CreditCard className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Aguardando pagamento na maquininha
                      </p>
                    </div>
                  )}

                  {/* Placeholder quando nenhum pagamento selecionado */}
                  {!selectedPayment && (
                    <div className="bg-muted/30 rounded-lg p-4 text-center border-2 border-dashed">
                      <p className="text-sm text-muted-foreground">
                        Selecione uma forma de pagamento
                      </p>
                    </div>
                  )}
                </div>

                {/* Coluna 3: Fidelidade e NFC-e */}
                <div className="space-y-3">
                  {/* Programa de Fidelidade */}
                  {fidelidadeConfig && (
                    <div className="border rounded-lg p-3 bg-yellow-50/50 dark:bg-yellow-900/10">
                      <div className="flex items-center gap-2 mb-2">
                        <Gift className="h-4 w-4 text-yellow-600" />
                        <span className="font-medium text-sm">Fidelidade (F11)</span>
                      </div>

                      {!clienteSelecionado ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => setShowClienteModal(true)}
                        >
                          <UserCheck className="h-4 w-4 mr-2" />
                          Identificar Cliente
                        </Button>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground truncate">{clienteSelecionado.nome}</span>
                            <Button
                              variant="link"
                              size="sm"
                              className="p-0 h-auto text-xs shrink-0"
                              onClick={() => setShowClienteModal(true)}
                            >
                              Trocar
                            </Button>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 text-yellow-500" />
                              <span className="font-bold">{(clientePontos?.saldo_pontos || 0).toLocaleString('pt-BR')} pts</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              = {formatCurrency((clientePontos?.saldo_pontos || 0) * fidelidadeConfig.valor_ponto_resgate)}
                            </span>
                          </div>

                          {clientePontos && clientePontos.saldo_pontos > 0 && (
                            <div className="flex items-center gap-2">
                              <Switch
                                id="usar-pontos"
                                checked={usarPontos}
                                onCheckedChange={(checked) => {
                                  setUsarPontos(checked)
                                  if (!checked) setPontosAUsar('')
                                  else setPontosAUsar(String(clientePontos.saldo_pontos))
                                }}
                              />
                              <Label htmlFor="usar-pontos" className="text-xs">
                                Usar {clientePontos.saldo_pontos} pts ({formatCurrency(clientePontos.saldo_pontos * fidelidadeConfig.valor_ponto_resgate)})
                              </Label>
                            </div>
                          )}

                          <p className="text-xs text-muted-foreground">
                            Ganha +{Math.floor(total * fidelidadeConfig.pontos_por_real)} pts nesta compra
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Opções de NFC-e */}
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <Label htmlFor="emitir-nfce" className="text-sm font-medium">
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
                        Configure em{' '}
                        <Link href="/dashboard/fiscal/configuracoes" className="underline text-primary">
                          Config. Fiscais
                        </Link>
                      </p>
                    )}

                    {emitirNFCe && fiscalConfigurado && (
                      <div>
                        <Label htmlFor="cpf-cliente" className="text-xs">
                          CPF na nota (opcional)
                        </Label>
                        <Input
                          id="cpf-cliente"
                          placeholder="000.000.000-00"
                          value={cpfCliente}
                          onChange={(e) => setCpfCliente(e.target.value)}
                          className="mt-1 h-8 text-sm"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer com botões */}
              <div className="flex justify-end gap-3 mt-4 pt-3 border-t">
                <Button variant="outline" onClick={() => setShowPayment(false)}>
                  Cancelar (ESC)
                </Button>
                <Button
                  onClick={finalizarVenda}
                  disabled={!selectedPayment || paymentLoading}
                  className="min-w-[200px]"
                >
                  {paymentLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {emitirNFCe && fiscalConfigurado ? 'Emitindo NFC-e...' : 'Processando...'}
                    </>
                  ) : (
                    'Confirmar Pagamento (Enter)'
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Seleção de Cliente (Crediário) */}
      <Dialog open={showClienteModal} onOpenChange={setShowClienteModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Selecionar Cliente
            </DialogTitle>
            <DialogDescription>
              Busque o cliente para venda no crediário
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Busca */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nome ou CPF/CNPJ do cliente..."
                className="pl-10"
                value={clienteSearch}
                onChange={(e) => setClienteSearch(e.target.value)}
                autoFocus
              />
              {loadingClientes && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* Lista de clientes */}
            <ScrollArea className="h-64">
              {clientes.length > 0 ? (
                <div className="space-y-2">
                  {clientes.map((cliente) => {
                    const creditoDisponivel = cliente.limite_credito - cliente.saldo_devedor
                    const temCredito = creditoDisponivel >= total

                    return (
                      <button
                        key={cliente.id}
                        className={`w-full p-3 rounded-lg border text-left transition-colors ${
                          temCredito
                            ? 'hover:bg-muted cursor-pointer'
                            : 'opacity-50 cursor-not-allowed bg-muted/50'
                        }`}
                        onClick={() => temCredito && selecionarCliente(cliente)}
                        disabled={!temCredito}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{cliente.nome}</p>
                            <p className="text-sm text-muted-foreground">{cliente.cpf_cnpj}</p>
                            {cliente.telefone && (
                              <p className="text-xs text-muted-foreground">{cliente.telefone}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Limite</p>
                            <p className="text-sm font-medium">{formatCurrency(cliente.limite_credito)}</p>
                            <p className={`text-xs ${temCredito ? 'text-green-600' : 'text-red-600'}`}>
                              Disponível: {formatCurrency(creditoDisponivel)}
                            </p>
                          </div>
                        </div>
                        {!temCredito && (
                          <p className="text-xs text-red-600 mt-1">
                            Crédito insuficiente para esta venda
                          </p>
                        )}
                      </button>
                    )
                  })}
                </div>
              ) : clienteSearch ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>Nenhum cliente encontrado</p>
                  <Button variant="link" asChild className="mt-2">
                    <Link href="/dashboard/clientes/novo">Cadastrar novo cliente</Link>
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>Digite para buscar clientes</p>
                </div>
              )}
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClienteModal(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Atalhos de Teclado */}
      <Dialog open={showAjuda} onOpenChange={setShowAjuda}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" />
              Atalhos de Teclado
            </DialogTitle>
            <DialogDescription>
              Use os atalhos abaixo para agilizar suas vendas
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2 p-2 rounded bg-muted">
                <kbd className="px-2 py-1 bg-background border rounded text-xs font-mono">F1</kbd>
                <span>Esta ajuda</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-muted">
                <kbd className="px-2 py-1 bg-background border rounded text-xs font-mono">F2</kbd>
                <span>Buscar produto</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-muted">
                <kbd className="px-2 py-1 bg-background border rounded text-xs font-mono">F3</kbd>
                <span>Novo cliente</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-muted">
                <kbd className="px-2 py-1 bg-background border rounded text-xs font-mono">F4</kbd>
                <span>Finalizar venda</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-muted">
                <kbd className="px-2 py-1 bg-background border rounded text-xs font-mono">F5</kbd>
                <span>Limpar carrinho</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-muted">
                <kbd className="px-2 py-1 bg-background border rounded text-xs font-mono">F6</kbd>
                <span>Pagar Dinheiro</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-muted">
                <kbd className="px-2 py-1 bg-background border rounded text-xs font-mono">F7</kbd>
                <span>Pagar Crédito</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-muted">
                <kbd className="px-2 py-1 bg-background border rounded text-xs font-mono">F8</kbd>
                <span>Pagar Débito</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-muted">
                <kbd className="px-2 py-1 bg-background border rounded text-xs font-mono">F9</kbd>
                <span>Pagar PIX</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-muted">
                <kbd className="px-2 py-1 bg-background border rounded text-xs font-mono">F10</kbd>
                <span>Crediário</span>
              </div>
              {fidelidadeConfig && (
                <div className="flex items-center gap-2 p-2 rounded bg-muted">
                  <kbd className="px-2 py-1 bg-background border rounded text-xs font-mono">F11</kbd>
                  <span>Fidelidade</span>
                </div>
              )}
              <div className="flex items-center gap-2 p-2 rounded bg-muted">
                <kbd className="px-2 py-1 bg-background border rounded text-xs font-mono">F12</kbd>
                <span>Abrir/Fechar Caixa</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-muted col-span-2">
                <kbd className="px-2 py-1 bg-background border rounded text-xs font-mono">ESC</kbd>
                <span>Fechar modal / Cancelar</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowAjuda(false)}>
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
