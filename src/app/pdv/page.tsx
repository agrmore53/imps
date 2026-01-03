'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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
  Scan,
  Volume2,
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

  // Scanner de código de barras
  const lastKeystrokeTime = useRef<number>(0)
  const keystrokeBuffer = useRef<string>('')
  const scannerTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [isScannerInput, setIsScannerInput] = useState(false)
  const [scannerEnabled, setScannerEnabled] = useState(true)
  const audioContextRef = useRef<AudioContext | null>(null)
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

  // Função para tocar beep de confirmação
  const playBeep = useCallback((success: boolean = true) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const ctx = audioContextRef.current
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      // Frequência: sucesso = agudo, erro = grave
      oscillator.frequency.value = success ? 1200 : 400
      oscillator.type = 'sine'

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + (success ? 0.1 : 0.3))

      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + (success ? 0.1 : 0.3))
    } catch (error) {
      console.error('Erro ao tocar beep:', error)
    }
  }, [])

  // Busca rápida para scanner (sem debounce)
  const buscarProdutoScanner = useCallback(async (codigoBarras: string) => {
    if (!codigoBarras.trim()) return

    setLoading(true)
    try {
      let produto: Produto | null = null

      if (isOnline) {
        // Busca exata por código de barras
        const { data, error } = await supabase
          .from('produtos')
          .select('id, codigo, codigo_barras, nome, preco_venda, estoque_atual, unidade')
          .eq('ativo', true)
          .eq('codigo_barras', codigoBarras)
          .single()

        if (!error && data) {
          produto = data
        }
      } else {
        // Busca offline
        const produtosCache = await buscarProdutoOffline(codigoBarras)
        const encontrado = produtosCache.find(p => p.codigo_barras === codigoBarras)
        if (encontrado) {
          produto = {
            id: encontrado.id,
            codigo: encontrado.codigo,
            codigo_barras: encontrado.codigo_barras,
            nome: encontrado.nome,
            preco_venda: encontrado.preco_venda,
            estoque_atual: encontrado.estoque_atual,
            unidade: encontrado.unidade,
          }
        }
      }

      if (produto) {
        if (produto.estoque_atual <= 0) {
          playBeep(false)
          toast.error('Produto sem estoque', {
            description: produto.nome,
          })
        } else {
          addItem({
            id: produto.id,
            codigo: produto.codigo,
            nome: produto.nome,
            preco: produto.preco_venda,
          })
          playBeep(true)
          toast.success(produto.nome, {
            description: `${formatCurrency(produto.preco_venda)} adicionado`,
          })
        }
      } else {
        playBeep(false)
        toast.error('Produto não encontrado', {
          description: `Código: ${codigoBarras}`,
        })
      }
    } catch (error) {
      console.error('Erro ao buscar produto:', error)
      playBeep(false)
      toast.error('Erro ao buscar produto')
    } finally {
      setLoading(false)
      setSearch('')
      setProdutos([])
      setIsScannerInput(false)
      searchRef.current?.focus()
    }
  }, [isOnline, supabase, buscarProdutoOffline, addItem, playBeep])

  // Handler para detectar entrada de scanner
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!scannerEnabled) return

    const now = Date.now()
    const timeSinceLastKey = now - lastKeystrokeTime.current

    // Scanner digita muito rápido (< 50ms entre teclas)
    // Humano digita devagar (> 50ms entre teclas)
    if (timeSinceLastKey < 50 && lastKeystrokeTime.current > 0) {
      setIsScannerInput(true)
    }

    lastKeystrokeTime.current = now

    // Se pressionar Enter e detectou entrada de scanner
    if (e.key === 'Enter') {
      e.preventDefault()
      const value = (e.target as HTMLInputElement).value.trim()

      if (value) {
        if (isScannerInput || value.length >= 8) {
          // Provavelmente um código de barras (EAN-8, EAN-13, etc)
          buscarProdutoScanner(value)
        } else if (produtos.length === 1) {
          // Se só tem um produto na lista, adiciona
          adicionarProduto(produtos[0])
        } else if (produtos.length > 1) {
          // Se tem mais de um, não faz nada (usuário deve selecionar)
          toast.info('Selecione um produto da lista')
        }
      }

      // Reset do detector de scanner
      setIsScannerInput(false)
      keystrokeBuffer.current = ''
    }
  }, [scannerEnabled, isScannerInput, produtos, buscarProdutoScanner])

  // Auto-focus no campo de busca
  useEffect(() => {
    // Foca no campo quando modais fecham
    if (!showPayment && !showClienteModal && !showAjuda) {
      const timer = setTimeout(() => {
        searchRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [showPayment, showClienteModal, showAjuda])

  // Manter foco no campo de busca (a cada 5 segundos verifica)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!showPayment && !showClienteModal && !showAjuda) {
        const activeElement = document.activeElement
        const isInputFocused = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA'

        // Se nenhum input está focado, foca no campo de busca
        if (!isInputFocused) {
          searchRef.current?.focus()
        }
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [showPayment, showClienteModal, showAjuda])

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
      playBeep(false)
      toast.error('Produto sem estoque')
      return
    }

    addItem({
      id: produto.id,
      codigo: produto.codigo,
      nome: produto.nome,
      preco: produto.preco_venda,
    })

    playBeep(true)
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
            placeholder={scannerEnabled ? "Escaneie ou digite o código do produto..." : "Digite o código ou nome do produto..."}
            className={`pl-12 pr-24 h-14 text-lg ${isScannerInput ? 'border-green-500 ring-2 ring-green-500/20' : ''}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            autoFocus
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {loading && (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            )}
            {isScannerInput && (
              <Badge variant="default" className="bg-green-500 animate-pulse">
                <Scan className="h-3 w-3 mr-1" />
                Scanner
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 px-2 ${scannerEnabled ? 'text-green-600' : 'text-muted-foreground'}`}
              onClick={() => setScannerEnabled(!scannerEnabled)}
              title={scannerEnabled ? 'Scanner ativo' : 'Scanner desativado'}
            >
              <Scan className="h-4 w-4" />
            </Button>
          </div>
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

      {/* Modal de Pagamento - Design Moderno */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="w-[calc(100vw-80px)] max-w-none p-0 gap-0 overflow-hidden">
          {paymentSuccess ? (
            /* ========== TELA DE SUCESSO ========== */
            <div className="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/20 p-8">
              <div className="max-w-md mx-auto text-center">
                {/* Ícone animado */}
                <div className="relative inline-flex">
                  <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping" />
                  <div className="relative bg-green-500 rounded-full p-4">
                    <CheckCircle className="h-12 w-12 text-white" />
                  </div>
                </div>

                <DialogTitle className="text-3xl font-bold mt-6 text-green-800 dark:text-green-200">
                  Venda Finalizada!
                </DialogTitle>

                {/* Total e Troco */}
                <div className="mt-4 p-4 bg-white/80 dark:bg-black/20 rounded-2xl">
                  <p className="text-sm text-muted-foreground">Total pago</p>
                  <p className="text-4xl font-bold text-green-600">{formatCurrency(total)}</p>
                  {selectedPayment === 'dinheiro' && troco > 0 && (
                    <div className="mt-3 pt-3 border-t border-green-200">
                      <p className="text-sm text-muted-foreground">Troco</p>
                      <p className="text-3xl font-bold text-amber-600">{formatCurrency(troco)}</p>
                    </div>
                  )}
                </div>

                {/* Info cards */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {pontosGanhos !== null && pontosGanhos > 0 && (
                    <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl text-left">
                      <div className="flex items-center gap-2">
                        <Star className="h-5 w-5 text-amber-500" />
                        <span className="font-bold text-amber-700">+{pontosGanhos} pts</span>
                      </div>
                      <p className="text-xs text-amber-600 mt-1">{clienteSelecionado?.nome}</p>
                    </div>
                  )}
                  {nfceResult?.sucesso && (
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-left">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-500" />
                        <span className="font-bold text-blue-700">NFC-e OK</span>
                      </div>
                      <p className="text-xs text-blue-600 mt-1 truncate">Prot: {nfceResult.protocolo}</p>
                    </div>
                  )}
                </div>

                {/* Botões */}
                <div className="mt-6 flex gap-3">
                  <Button
                    size="lg"
                    className="flex-1 h-14 bg-green-600 hover:bg-green-700"
                    onClick={imprimirCupom}
                  >
                    <Printer className="h-5 w-5 mr-2" />
                    Imprimir
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="flex-1 h-14 border-green-300 hover:bg-green-50"
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
                    Nova Venda
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* ========== TELA DE PAGAMENTO ========== */
            <div className="flex flex-col h-full">
              {/* Header com Total Destacado */}
              <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="text-xl font-semibold">Pagamento</DialogTitle>
                    <DialogDescription className="text-sm">
                      Selecione a forma de pagamento
                    </DialogDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Total a pagar</p>
                    <p className="text-4xl font-bold text-primary">{formatCurrency(total)}</p>
                    {descontoPontos > 0 && (
                      <Badge variant="secondary" className="mt-1 bg-amber-100 text-amber-700">
                        <Star className="h-3 w-3 mr-1" />
                        -{formatCurrency(descontoPontos)} pontos
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Conteúdo Principal */}
              <div className="flex-1 p-6">
                <div className="grid grid-cols-12 gap-6 h-full">
                  {/* Coluna Esquerda: Formas de Pagamento */}
                  <div className="col-span-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                      Forma de Pagamento
                    </p>

                    {/* Botões de pagamento com cores */}
                    <button
                      onClick={() => setSelectedPayment('dinheiro')}
                      className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                        selectedPayment === 'dinheiro'
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/30 shadow-lg shadow-green-500/20'
                          : 'border-transparent bg-muted/50 hover:bg-muted hover:border-muted-foreground/20'
                      }`}
                    >
                      <div className={`p-3 rounded-lg ${selectedPayment === 'dinheiro' ? 'bg-green-500' : 'bg-green-500/20'}`}>
                        <DollarSign className={`h-6 w-6 ${selectedPayment === 'dinheiro' ? 'text-white' : 'text-green-600'}`} />
                      </div>
                      <div className="text-left flex-1">
                        <p className="font-semibold">Dinheiro</p>
                        <p className="text-xs text-muted-foreground">F6</p>
                      </div>
                      {selectedPayment === 'dinheiro' && <CheckCircle className="h-5 w-5 text-green-500" />}
                    </button>

                    <button
                      onClick={() => setSelectedPayment('cartao_credito')}
                      className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                        selectedPayment === 'cartao_credito'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-lg shadow-blue-500/20'
                          : 'border-transparent bg-muted/50 hover:bg-muted hover:border-muted-foreground/20'
                      }`}
                    >
                      <div className={`p-3 rounded-lg ${selectedPayment === 'cartao_credito' ? 'bg-blue-500' : 'bg-blue-500/20'}`}>
                        <CreditCard className={`h-6 w-6 ${selectedPayment === 'cartao_credito' ? 'text-white' : 'text-blue-600'}`} />
                      </div>
                      <div className="text-left flex-1">
                        <p className="font-semibold">Crédito</p>
                        <p className="text-xs text-muted-foreground">F7</p>
                      </div>
                      {selectedPayment === 'cartao_credito' && <CheckCircle className="h-5 w-5 text-blue-500" />}
                    </button>

                    <button
                      onClick={() => setSelectedPayment('cartao_debito')}
                      className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                        selectedPayment === 'cartao_debito'
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 shadow-lg shadow-indigo-500/20'
                          : 'border-transparent bg-muted/50 hover:bg-muted hover:border-muted-foreground/20'
                      }`}
                    >
                      <div className={`p-3 rounded-lg ${selectedPayment === 'cartao_debito' ? 'bg-indigo-500' : 'bg-indigo-500/20'}`}>
                        <CreditCard className={`h-6 w-6 ${selectedPayment === 'cartao_debito' ? 'text-white' : 'text-indigo-600'}`} />
                      </div>
                      <div className="text-left flex-1">
                        <p className="font-semibold">Débito</p>
                        <p className="text-xs text-muted-foreground">F8</p>
                      </div>
                      {selectedPayment === 'cartao_debito' && <CheckCircle className="h-5 w-5 text-indigo-500" />}
                    </button>

                    <button
                      onClick={() => setSelectedPayment('pix')}
                      className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                        selectedPayment === 'pix'
                          ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 shadow-lg shadow-teal-500/20'
                          : 'border-transparent bg-muted/50 hover:bg-muted hover:border-muted-foreground/20'
                      }`}
                    >
                      <div className={`p-3 rounded-lg ${selectedPayment === 'pix' ? 'bg-teal-500' : 'bg-teal-500/20'}`}>
                        <QrCode className={`h-6 w-6 ${selectedPayment === 'pix' ? 'text-white' : 'text-teal-600'}`} />
                      </div>
                      <div className="text-left flex-1">
                        <p className="font-semibold">PIX</p>
                        <p className="text-xs text-muted-foreground">F9</p>
                      </div>
                      {selectedPayment === 'pix' && <CheckCircle className="h-5 w-5 text-teal-500" />}
                    </button>

                    <button
                      onClick={() => {
                        setSelectedPayment('crediario')
                        if (!clienteSelecionado) setShowClienteModal(true)
                      }}
                      className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                        selectedPayment === 'crediario'
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/30 shadow-lg shadow-orange-500/20'
                          : 'border-transparent bg-muted/50 hover:bg-muted hover:border-muted-foreground/20'
                      }`}
                    >
                      <div className={`p-3 rounded-lg ${selectedPayment === 'crediario' ? 'bg-orange-500' : 'bg-orange-500/20'}`}>
                        <Users className={`h-6 w-6 ${selectedPayment === 'crediario' ? 'text-white' : 'text-orange-600'}`} />
                      </div>
                      <div className="text-left flex-1">
                        <p className="font-semibold">Crediário</p>
                        <p className="text-xs text-muted-foreground">F10</p>
                      </div>
                      {selectedPayment === 'crediario' && <CheckCircle className="h-5 w-5 text-orange-500" />}
                    </button>
                  </div>

                  {/* Coluna Central: Detalhes do Pagamento */}
                  <div className="col-span-5 bg-muted/30 rounded-2xl p-5">
                    {/* Dinheiro */}
                    {selectedPayment === 'dinheiro' && (
                      <div className="space-y-4">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Pagamento em Dinheiro
                        </p>

                        <div>
                          <label className="text-sm font-medium mb-2 block">Valor Recebido</label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0,00"
                            value={valorRecebido}
                            onChange={(e) => setValorRecebido(e.target.value)}
                            className="text-2xl h-14 text-center font-bold"
                            autoFocus
                          />
                        </div>

                        {/* Botões de valor rápido */}
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">Valor rápido:</p>
                          <div className="grid grid-cols-4 gap-2">
                            {[10, 20, 50, 100].map((valor) => (
                              <Button
                                key={valor}
                                variant="outline"
                                size="sm"
                                onClick={() => setValorRecebido(String(valor))}
                                className="font-mono"
                              >
                                R${valor}
                              </Button>
                            ))}
                          </div>
                          <div className="grid grid-cols-3 gap-2 mt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setValorRecebido(String(total))}
                              className="font-mono"
                            >
                              Exato
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setValorRecebido(String(Math.ceil(total / 10) * 10))}
                              className="font-mono"
                            >
                              R${Math.ceil(total / 10) * 10}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setValorRecebido('200')}
                              className="font-mono"
                            >
                              R$200
                            </Button>
                          </div>
                        </div>

                        {/* Troco */}
                        {parseFloat(valorRecebido || '0') >= total && (
                          <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-xl text-center">
                            <p className="text-sm text-green-700 dark:text-green-300">Troco</p>
                            <p className="text-4xl font-bold text-green-600">{formatCurrency(troco)}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* PIX */}
                    {selectedPayment === 'pix' && (
                      <div className="space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Pagamento via PIX
                        </p>
                        <div className="bg-white dark:bg-black/20 rounded-xl p-4">
                          <PixQRCode
                            valor={total}
                            chavePix={empresa?.chavePix}
                            beneficiario={empresa?.nome}
                            cidade={empresa?.cidade}
                            txid={`PDV${Date.now()}`}
                          />
                        </div>
                      </div>
                    )}

                    {/* Cartões */}
                    {(selectedPayment === 'cartao_credito' || selectedPayment === 'cartao_debito') && (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="bg-primary/10 rounded-full p-6 mb-4">
                          <CreditCard className="h-12 w-12 text-primary" />
                        </div>
                        <p className="text-lg font-medium">Aguardando maquininha</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Passe o cartão de {selectedPayment === 'cartao_credito' ? 'crédito' : 'débito'}
                        </p>
                        <div className="flex items-center gap-2 mt-4 text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">Processando...</span>
                        </div>
                      </div>
                    )}

                    {/* Crediário */}
                    {selectedPayment === 'crediario' && (
                      <div className="space-y-4">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Venda no Crediário
                        </p>

                        {clienteSelecionado ? (
                          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 rounded-xl p-4">
                            <div className="flex items-center gap-3">
                              <div className="bg-orange-500 rounded-full p-2">
                                <UserCheck className="h-5 w-5 text-white" />
                              </div>
                              <div className="flex-1">
                                <p className="font-semibold">{clienteSelecionado.nome}</p>
                                <p className="text-sm text-muted-foreground">{clienteSelecionado.cpf_cnpj}</p>
                              </div>
                            </div>
                            <div className="mt-3 pt-3 border-t border-orange-200 flex justify-between items-center">
                              <span className="text-sm">Crédito disponível:</span>
                              <span className="text-lg font-bold text-green-600">
                                {formatCurrency(clienteSelecionado.limite_credito - clienteSelecionado.saldo_devedor)}
                              </span>
                            </div>
                            <Button
                              variant="link"
                              size="sm"
                              className="mt-2 p-0 h-auto"
                              onClick={() => setShowClienteModal(true)}
                            >
                              Trocar cliente
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            className="w-full h-16"
                            onClick={() => setShowClienteModal(true)}
                          >
                            <Users className="h-5 w-5 mr-2" />
                            Selecionar Cliente
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Placeholder */}
                    {!selectedPayment && (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="bg-muted rounded-full p-6 mb-4">
                          <CreditCard className="h-12 w-12 text-muted-foreground" />
                        </div>
                        <p className="text-lg font-medium text-muted-foreground">
                          Selecione uma forma de pagamento
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Use F6-F10 ou clique ao lado
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Coluna Direita: Opções */}
                  <div className="col-span-3 space-y-4">
                    {/* Fidelidade */}
                    {fidelidadeConfig && (
                      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200">
                        <div className="flex items-center gap-2 mb-3">
                          <Gift className="h-5 w-5 text-amber-600" />
                          <span className="font-semibold text-amber-800 dark:text-amber-200">Fidelidade</span>
                        </div>

                        {!clienteSelecionado ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full border-amber-300"
                            onClick={() => setShowClienteModal(true)}
                          >
                            <UserCheck className="h-4 w-4 mr-2" />
                            Identificar Cliente
                          </Button>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm truncate">{clienteSelecionado.nome}</span>
                              <Button variant="link" size="sm" className="p-0 h-auto text-xs" onClick={() => setShowClienteModal(true)}>
                                Trocar
                              </Button>
                            </div>
                            <div className="bg-white dark:bg-black/20 rounded-lg p-3 text-center">
                              <p className="text-2xl font-bold text-amber-600">{(clientePontos?.saldo_pontos || 0).toLocaleString('pt-BR')}</p>
                              <p className="text-xs text-muted-foreground">pontos disponíveis</p>
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
                                  Usar pontos (-{formatCurrency(clientePontos.saldo_pontos * fidelidadeConfig.valor_ponto_resgate)})
                                </Label>
                              </div>
                            )}
                            <p className="text-xs text-amber-600 text-center">
                              Ganha +{Math.floor(total * fidelidadeConfig.pontos_por_real)} pts
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* NFC-e */}
                    <div className="bg-muted/50 rounded-xl p-4 border">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <span className="font-semibold">NFC-e</span>
                        </div>
                        <Switch
                          id="emitir-nfce"
                          checked={emitirNFCe}
                          onCheckedChange={setEmitirNFCe}
                          disabled={!fiscalConfigurado}
                        />
                      </div>

                      {!fiscalConfigurado ? (
                        <p className="text-xs text-muted-foreground">
                          <Link href="/dashboard/fiscal/configuracoes" className="underline text-primary">
                            Configurar fiscal
                          </Link>
                        </p>
                      ) : emitirNFCe && (
                        <div>
                          <Label htmlFor="cpf-cliente" className="text-xs">CPF na nota</Label>
                          <Input
                            id="cpf-cliente"
                            placeholder="Opcional"
                            value={cpfCliente}
                            onChange={(e) => setCpfCliente(e.target.value)}
                            className="mt-1 h-9"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t bg-muted/30 p-4 flex items-center justify-between">
                <Button variant="ghost" onClick={() => setShowPayment(false)} className="text-muted-foreground">
                  <X className="h-4 w-4 mr-2" />
                  Cancelar (ESC)
                </Button>
                <Button
                  size="lg"
                  onClick={finalizarVenda}
                  disabled={!selectedPayment || paymentLoading}
                  className="min-w-[250px] h-12 text-lg"
                >
                  {paymentLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {emitirNFCe && fiscalConfigurado ? 'Emitindo NFC-e...' : 'Processando...'}
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-5 w-5" />
                      Confirmar Pagamento
                    </>
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
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" />
              Atalhos e Scanner
            </DialogTitle>
            <DialogDescription>
              Use os atalhos e o scanner para agilizar suas vendas
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Scanner info */}
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <Scan className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-700">Leitor de Código de Barras</span>
                <Badge variant={scannerEnabled ? 'default' : 'secondary'} className={scannerEnabled ? 'bg-green-500' : ''}>
                  {scannerEnabled ? 'Ativo' : 'Desativado'}
                </Badge>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Scanner USB funciona automaticamente</li>
                <li>• Produto é adicionado ao escanear</li>
                <li>• Beep sonoro confirma a leitura</li>
                <li>• Borda verde indica detecção do scanner</li>
              </ul>
            </div>

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
