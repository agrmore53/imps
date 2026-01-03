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
  Wallet,
  LockOpen,
  Users,
  Star,
  Keyboard,
  Scan,
  Scale,
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
  const [showPixModal, setShowPixModal] = useState(false)
  // Estados para produto pesável
  const [showWeightModal, setShowWeightModal] = useState(false)
  const [pendingWeightProduct, setPendingWeightProduct] = useState<Produto | null>(null)
  const [weightValue, setWeightValue] = useState('')
  const weightInputRef = useRef<HTMLInputElement>(null)
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

  // Verifica se o produto é vendido por peso/volume
  function isProdutoPesavel(unidade: string): boolean {
    const unidadesPesaveis = ['KG', 'G', 'L', 'ML', 'M', 'CM', 'M2', 'M3']
    return unidadesPesaveis.includes(unidade.toUpperCase())
  }

  // Formata a unidade para exibição
  function formatUnidade(unidade: string): string {
    const unidadesFormatadas: Record<string, string> = {
      'KG': 'kg',
      'G': 'g',
      'L': 'L',
      'ML': 'ml',
      'M': 'm',
      'CM': 'cm',
      'M2': 'm²',
      'M3': 'm³',
    }
    return unidadesFormatadas[unidade.toUpperCase()] || unidade
  }

  // Adiciona produto pesável com a quantidade informada
  function confirmarPesagem() {
    if (!pendingWeightProduct) return

    const peso = parseFloat(weightValue.replace(',', '.'))
    if (isNaN(peso) || peso <= 0) {
      toast.error('Digite um peso válido')
      return
    }

    if (peso > pendingWeightProduct.estoque_atual) {
      toast.error(`Estoque insuficiente. Disponível: ${pendingWeightProduct.estoque_atual} ${pendingWeightProduct.unidade}`)
      return
    }

    addItem({
      id: pendingWeightProduct.id,
      codigo: pendingWeightProduct.codigo,
      nome: pendingWeightProduct.nome,
      preco: pendingWeightProduct.preco_venda,
      quantidade: peso,
      unidade: pendingWeightProduct.unidade,
    })

    const valorTotal = pendingWeightProduct.preco_venda * peso
    playBeep(true)
    toast.success(`${pendingWeightProduct.nome}`, {
      description: `${peso} ${formatUnidade(pendingWeightProduct.unidade)} = ${formatCurrency(valorTotal)}`,
    })

    // Limpar e fechar modal
    setShowWeightModal(false)
    setPendingWeightProduct(null)
    setWeightValue('')
    setSearch('')
    setProdutos([])
    searchRef.current?.focus()
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
        } else if (isProdutoPesavel(produto.unidade)) {
          // Produto pesável - abre modal para digitar peso
          setPendingWeightProduct(produto)
          setWeightValue('')
          setShowWeightModal(true)
          setTimeout(() => weightInputRef.current?.focus(), 100)
        } else {
          addItem({
            id: produto.id,
            codigo: produto.codigo,
            nome: produto.nome,
            preco: produto.preco_venda,
            unidade: produto.unidade,
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
    if (!showClienteModal && !showAjuda) {
      const timer = setTimeout(() => {
        searchRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [showClienteModal, showAjuda])

  // Manter foco no campo de busca (a cada 5 segundos verifica)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!showClienteModal && !showAjuda) {
        const activeElement = document.activeElement
        const isInputFocused = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA'

        // Se nenhum input está focado, foca no campo de busca
        if (!isInputFocused) {
          searchRef.current?.focus()
        }
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [showClienteModal, showAjuda])

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

    // Se for produto pesável, abre modal para digitar o peso
    if (isProdutoPesavel(produto.unidade)) {
      setPendingWeightProduct(produto)
      setWeightValue('')
      setShowWeightModal(true)
      // Foca no input de peso após abrir o modal
      setTimeout(() => weightInputRef.current?.focus(), 100)
      return
    }

    addItem({
      id: produto.id,
      codigo: produto.codigo,
      nome: produto.nome,
      preco: produto.preco_venda,
      unidade: produto.unidade,
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

      // Após alguns segundos, limpar e resetar (não resetar automaticamente para permitir impressão)
      setTimeout(() => {
        clearCart()
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
          window.open('/dashboard/clientes/novo', '_blank')
          break
        case 'F4':
          e.preventDefault()
          // F4 agora confirma a venda diretamente (Split View)
          if (items.length > 0 && selectedPayment && !paymentLoading) {
            if (selectedPayment === 'dinheiro' && troco < 0) {
              toast.error('Valor recebido insuficiente')
            } else {
              finalizarVenda()
            }
          }
          break
        case 'F5':
          e.preventDefault()
          if (items.length > 0) {
            if (confirm('Limpar todos os itens do carrinho?')) {
              clearCart()
              setSelectedPayment(null)
              setValorRecebido('')
            }
          }
          break
        case 'F6':
          e.preventDefault()
          if (items.length > 0) {
            setSelectedPayment('dinheiro')
          }
          break
        case 'F7':
          e.preventDefault()
          if (items.length > 0) {
            setSelectedPayment('cartao_credito')
          }
          break
        case 'F8':
          e.preventDefault()
          if (items.length > 0) {
            setSelectedPayment('cartao_debito')
          }
          break
        case 'F9':
          e.preventDefault()
          if (items.length > 0) {
            setSelectedPayment('pix')
            setShowPixModal(true)
          }
          break
        case 'F10':
          e.preventDefault()
          if (items.length > 0) {
            setSelectedPayment('crediario')
            if (!clienteSelecionado) {
              setShowClienteModal(true)
            }
          }
          break
        case 'F11':
          e.preventDefault()
          if (fidelidadeConfig) {
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
          } else if (showClienteModal) {
            setShowClienteModal(false)
          } else if (selectedPayment) {
            setSelectedPayment(null)
            setValorRecebido('')
          } else {
            setProdutos([])
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [items, selectedPayment, clienteSelecionado, fidelidadeConfig, showAjuda, showClienteModal, clearCart, paymentLoading, troco, finalizarVenda])

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
                {produtos.map((produto) => {
                  const pesavel = isProdutoPesavel(produto.unidade)
                  return (
                    <button
                      key={produto.id}
                      className="w-full flex items-center justify-between p-3 hover:bg-muted rounded-lg transition-colors text-left"
                      onClick={() => adicionarProduto(produto)}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{produto.nome}</p>
                          {pesavel && (
                            <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50">
                              <Scale className="h-3 w-3 mr-1" />
                              Pesável
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Código: {produto.codigo}
                          {produto.codigo_barras && ` | EAN: ${produto.codigo_barras}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">
                          {formatCurrency(produto.preco_venda)}
                          {pesavel && <span className="text-sm font-normal text-muted-foreground">/{formatUnidade(produto.unidade)}</span>}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Estoque: {produto.estoque_atual} {formatUnidade(produto.unidade)}
                        </p>
                      </div>
                    </button>
                  )
                })}
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
                  {items.map((item, index) => {
                    const isPesavel = item.unidade && ['KG', 'G', 'L', 'ML', 'M', 'CM', 'M2', 'M3'].includes(item.unidade.toUpperCase())
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-4 p-4 hover:bg-muted/50"
                      >
                        <span className="text-2xl font-bold text-muted-foreground w-8">
                          {index + 1}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{item.nome}</p>
                            {isPesavel && (
                              <Scale className="h-4 w-4 text-orange-500" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatCurrency(item.preco)}{isPesavel ? `/${formatUnidade(item.unidade!)}` : ''} x {isPesavel ? item.quantidade.toFixed(3).replace('.', ',') : item.quantidade} {isPesavel ? formatUnidade(item.unidade!) : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {isPesavel ? (
                            // Para produtos pesáveis, mostra o peso formatado
                            <span className="w-24 text-center font-medium text-orange-600">
                              {item.quantidade.toFixed(3).replace('.', ',')} {formatUnidade(item.unidade!)}
                            </span>
                          ) : (
                            // Para produtos unitários, mostra controles de quantidade
                            <>
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
                            </>
                          )}
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
                    )
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sidebar - Resumo e Pagamento (Split View) */}
      <div className="w-[420px] border-l flex flex-col bg-muted/30">
        <ScrollArea className="flex-1">
          {/* Header com Total */}
          <div className="p-4 border-b bg-gradient-to-r from-primary/10 to-primary/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                <span className="font-semibold">Resumo</span>
                {getTotalItems() > 0 && (
                  <Badge variant="secondary">{getTotalItems()} itens</Badge>
                )}
              </div>
              {items.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearCart} className="text-destructive h-8">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <div className="text-sm text-muted-foreground">
                <div>Subtotal: {formatCurrency(subtotal)}</div>
                {desconto > 0 && <div>Desconto: -{formatCurrency(desconto)}</div>}
                {descontoPontos > 0 && <div className="text-amber-600">Pontos: -{formatCurrency(descontoPontos)}</div>}
              </div>
              <div className="text-3xl font-bold text-primary">{formatCurrency(total)}</div>
            </div>
          </div>

          {/* Seção de Cliente/Fidelidade */}
          {(fidelidadeConfig || selectedPayment === 'crediario') && (
            <div className="p-3 border-b">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Cliente
                </span>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowClienteModal(true)}>
                  {clienteSelecionado ? 'Trocar' : 'Selecionar'}
                </Button>
              </div>
              {clienteSelecionado ? (
                <div className="bg-muted/50 rounded-lg p-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{clienteSelecionado.nome}</p>
                      <p className="text-xs text-muted-foreground">{clienteSelecionado.cpf_cnpj}</p>
                    </div>
                    {fidelidadeConfig && (
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-amber-600">
                          <Star className="h-3 w-3" />
                          <span className="font-bold text-sm">{(clientePontos?.saldo_pontos || 0).toLocaleString('pt-BR')}</span>
                        </div>
                        {clientePontos && clientePontos.saldo_pontos > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            <Switch
                              id="usar-pontos-split"
                              checked={usarPontos}
                              onCheckedChange={(checked) => {
                                setUsarPontos(checked)
                                if (!checked) setPontosAUsar('')
                                else setPontosAUsar(String(clientePontos.saldo_pontos))
                              }}
                              className="scale-75"
                            />
                            <Label htmlFor="usar-pontos-split" className="text-xs">Usar pts</Label>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {selectedPayment === 'crediario' && (
                    <div className="mt-2 pt-2 border-t flex justify-between text-xs">
                      <span>Crédito disponível:</span>
                      <span className="font-bold text-green-600">
                        {formatCurrency(clienteSelecionado.limite_credito - clienteSelecionado.saldo_devedor)}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Identifique para usar pontos ou crediário</p>
              )}
            </div>
          )}

          {/* Formas de Pagamento */}
          <div className="p-3">
            <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Forma de Pagamento</p>
            <div className="grid grid-cols-5 gap-1">
              {[
                { id: 'dinheiro', label: 'Dinheiro', icon: DollarSign, key: 'F6', color: 'green' },
                { id: 'cartao_credito', label: 'Crédito', icon: CreditCard, key: 'F7', color: 'blue' },
                { id: 'cartao_debito', label: 'Débito', icon: CreditCard, key: 'F8', color: 'indigo' },
                { id: 'pix', label: 'PIX', icon: QrCode, key: 'F9', color: 'teal' },
                { id: 'crediario', label: 'Fiado', icon: Users, key: 'F10', color: 'orange' },
              ].map((method) => {
                const Icon = method.icon
                const isSelected = selectedPayment === method.id
                const colors: Record<string, { bg: string; selected: string }> = {
                  green: { bg: 'bg-green-100 text-green-600', selected: 'bg-green-500 text-white' },
                  blue: { bg: 'bg-blue-100 text-blue-600', selected: 'bg-blue-500 text-white' },
                  indigo: { bg: 'bg-indigo-100 text-indigo-600', selected: 'bg-indigo-500 text-white' },
                  teal: { bg: 'bg-teal-100 text-teal-600', selected: 'bg-teal-500 text-white' },
                  orange: { bg: 'bg-orange-100 text-orange-600', selected: 'bg-orange-500 text-white' },
                }
                return (
                  <button
                    key={method.id}
                    onClick={() => {
                      setSelectedPayment(method.id)
                      if (method.id === 'pix') {
                        setShowPixModal(true)
                      } else if (method.id === 'crediario' && !clienteSelecionado) {
                        setShowClienteModal(true)
                      }
                    }}
                    disabled={items.length === 0}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      isSelected
                        ? `${colors[method.color].selected} ring-2 ring-offset-1 ring-${method.color}-500`
                        : `${colors[method.color].bg} hover:opacity-80`
                    }`}
                    title={`${method.label} (${method.key})`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-[10px] font-medium leading-none">{method.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Detalhes do Pagamento Selecionado */}
          {selectedPayment && items.length > 0 && (
            <div className="p-3 border-t">
              {/* Dinheiro */}
              {selectedPayment === 'dinheiro' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium">Valor Recebido</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      value={valorRecebido}
                      onChange={(e) => setValorRecebido(e.target.value)}
                      className="text-xl h-12 text-center font-bold mt-1"
                      autoFocus
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {[10, 20, 50, 100].map((v) => (
                      <Button key={v} variant="outline" size="sm" onClick={() => setValorRecebido(String(v))} className="text-xs h-8">
                        R${v}
                      </Button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <Button variant="outline" size="sm" onClick={() => setValorRecebido(String(total))} className="text-xs h-8">Exato</Button>
                    <Button variant="outline" size="sm" onClick={() => setValorRecebido(String(Math.ceil(total / 10) * 10))} className="text-xs h-8">R${Math.ceil(total / 10) * 10}</Button>
                    <Button variant="outline" size="sm" onClick={() => setValorRecebido('200')} className="text-xs h-8">R$200</Button>
                  </div>
                  {parseFloat(valorRecebido || '0') >= total && (
                    <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-lg text-center">
                      <p className="text-xs text-green-600">Troco</p>
                      <p className="text-2xl font-bold text-green-600">{formatCurrency(troco)}</p>
                    </div>
                  )}
                </div>
              )}

              {/* PIX */}
              {selectedPayment === 'pix' && (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <QrCode className="h-12 w-12 text-teal-500 mb-3" />
                  <p className="font-medium">Pagamento via PIX</p>
                  <p className="text-sm text-muted-foreground mb-3">QR Code exibido na tela</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPixModal(true)}
                  >
                    <QrCode className="h-4 w-4 mr-2" />
                    Ver QR Code
                  </Button>
                </div>
              )}

              {/* Cartões */}
              {(selectedPayment === 'cartao_credito' || selectedPayment === 'cartao_debito') && (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <CreditCard className="h-12 w-12 text-muted-foreground mb-3" />
                  <p className="font-medium">Aguardando maquininha</p>
                  <p className="text-sm text-muted-foreground">
                    Passe o cartão de {selectedPayment === 'cartao_credito' ? 'crédito' : 'débito'}
                  </p>
                </div>
              )}

              {/* Crediário */}
              {selectedPayment === 'crediario' && !clienteSelecionado && (
                <div className="text-center py-4">
                  <Users className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">Selecione um cliente</p>
                  <Button variant="outline" onClick={() => setShowClienteModal(true)}>
                    <Users className="h-4 w-4 mr-2" />
                    Selecionar Cliente
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* NFC-e */}
          <div className="p-3 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Emitir NFC-e</span>
              </div>
              <Switch
                checked={emitirNFCe}
                onCheckedChange={setEmitirNFCe}
                disabled={!fiscalConfigurado}
              />
            </div>
            {!fiscalConfigurado && (
              <Link href="/dashboard/fiscal/configuracoes" className="text-xs text-primary underline mt-1 block">
                Configurar certificado
              </Link>
            )}
            {emitirNFCe && fiscalConfigurado && (
              <Input
                placeholder="CPF na nota (opcional)"
                value={cpfCliente}
                onChange={(e) => setCpfCliente(e.target.value)}
                className="h-8 text-xs mt-2"
              />
            )}
          </div>
        </ScrollArea>

        {/* Botão Confirmar Venda - Fixo no rodapé */}
        <div className="border-t p-3 bg-background">
          {paymentSuccess ? (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-2">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <p className="font-bold text-green-700">Venda Finalizada!</p>
              {selectedPayment === 'dinheiro' && troco > 0 && (
                <p className="text-amber-600 font-bold">Troco: {formatCurrency(troco)}</p>
              )}
              {pontosGanhos !== null && pontosGanhos > 0 && (
                <Badge className="bg-amber-100 text-amber-700 mt-1">
                  <Star className="h-3 w-3 mr-1" />
                  +{pontosGanhos} pontos
                </Badge>
              )}
              <div className="flex gap-2 mt-3">
                <Button onClick={imprimirCupom} className="flex-1 bg-green-600 hover:bg-green-700">
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    clearCart()
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
          ) : (
            <Button
              className="w-full h-14 text-lg"
              disabled={items.length === 0 || !selectedPayment || paymentLoading || (selectedPayment === 'dinheiro' && troco < 0)}
              onClick={finalizarVenda}
            >
              {paymentLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-5 w-5" />
                  Confirmar Venda (F4)
                </>
              )}
            </Button>
          )}
        </div>
      </div>


      {/* Modal de Pesagem - Produto por Peso */}
      <Dialog open={showWeightModal} onOpenChange={(open) => {
        if (!open) {
          setShowWeightModal(false)
          setPendingWeightProduct(null)
          setWeightValue('')
          searchRef.current?.focus()
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-orange-500" />
              Produto por Peso
            </DialogTitle>
            <DialogDescription>
              Digite o peso do produto na balança
            </DialogDescription>
          </DialogHeader>

          {pendingWeightProduct && (
            <div className="space-y-4">
              {/* Info do produto */}
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="font-semibold text-lg">{pendingWeightProduct.nome}</p>
                <p className="text-sm text-muted-foreground">Código: {pendingWeightProduct.codigo}</p>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-2xl font-bold text-primary">
                    {formatCurrency(pendingWeightProduct.preco_venda)}/{formatUnidade(pendingWeightProduct.unidade)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Estoque: {pendingWeightProduct.estoque_atual} {formatUnidade(pendingWeightProduct.unidade)}
                  </span>
                </div>
              </div>

              {/* Input de peso */}
              <div className="space-y-2">
                <Label htmlFor="peso">Peso / Quantidade</Label>
                <div className="relative">
                  <Input
                    ref={weightInputRef}
                    id="peso"
                    type="text"
                    inputMode="decimal"
                    placeholder="0,000"
                    value={weightValue}
                    onChange={(e) => {
                      // Permitir apenas números, vírgula e ponto
                      const value = e.target.value.replace(/[^0-9.,]/g, '')
                      setWeightValue(value)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        confirmarPesagem()
                      } else if (e.key === 'Escape') {
                        e.preventDefault()
                        setShowWeightModal(false)
                        setPendingWeightProduct(null)
                        setWeightValue('')
                        searchRef.current?.focus()
                      }
                    }}
                    className="text-3xl h-16 text-center font-bold pr-16"
                    autoFocus
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl text-muted-foreground font-medium">
                    {formatUnidade(pendingWeightProduct.unidade)}
                  </span>
                </div>
              </div>

              {/* Atalhos rápidos de peso */}
              <div className="grid grid-cols-4 gap-2">
                {['0.5', '1', '1.5', '2'].map((peso) => (
                  <Button
                    key={peso}
                    variant="outline"
                    size="sm"
                    onClick={() => setWeightValue(peso.replace('.', ','))}
                    className="h-10"
                  >
                    {peso.replace('.', ',')} {formatUnidade(pendingWeightProduct.unidade)}
                  </Button>
                ))}
              </div>

              {/* Preview do valor */}
              {weightValue && parseFloat(weightValue.replace(',', '.')) > 0 && (
                <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-4 text-center">
                  <p className="text-sm text-green-600">Valor Total</p>
                  <p className="text-3xl font-bold text-green-700">
                    {formatCurrency(pendingWeightProduct.preco_venda * parseFloat(weightValue.replace(',', '.')))}
                  </p>
                </div>
              )}

              {/* Botões */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowWeightModal(false)
                    setPendingWeightProduct(null)
                    setWeightValue('')
                    searchRef.current?.focus()
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-orange-500 hover:bg-orange-600"
                  onClick={confirmarPesagem}
                  disabled={!weightValue || parseFloat(weightValue.replace(',', '.')) <= 0}
                >
                  <Scale className="h-4 w-4 mr-2" />
                  Confirmar Peso
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Exclusivo PIX */}
      <Dialog open={showPixModal} onOpenChange={setShowPixModal}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center py-4">
            {/* Header */}
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-teal-100 rounded-full mb-2">
                <QrCode className="h-6 w-6 text-teal-600" />
              </div>
              <DialogTitle className="text-xl">Pagamento via PIX</DialogTitle>
              <p className="text-3xl font-bold text-primary mt-2">{formatCurrency(total)}</p>
            </div>

            {/* QR Code */}
            <div className="bg-white p-4 rounded-xl shadow-sm border mb-4">
              <PixQRCode
                valor={total}
                chavePix={empresa?.chavePix}
                beneficiario={empresa?.nome}
                cidade={empresa?.cidade}
                txid={`PDV${Date.now()}`}
              />
            </div>

            {/* Botões */}
            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowPixModal(false)
                  setSelectedPayment(null)
                }}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-teal-600 hover:bg-teal-700"
                onClick={() => {
                  setShowPixModal(false)
                  finalizarVenda()
                }}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Recebido
              </Button>
            </div>
          </div>
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
                <span>Confirmar venda</span>
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
