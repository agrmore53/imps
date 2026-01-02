'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  salvarVendaOffline,
  getVendasNaoSincronizadas,
  marcarVendaSincronizada,
  incrementarTentativaVenda,
  contarVendasPendentes,
  cacheProdutos,
  getProdutosCacheados,
  buscarProdutoCachePorCodigo,
  buscarProdutoCachePorCodigoBarras,
  setConfig,
  getConfig,
} from '@/lib/offline/indexed-db'
import { toast } from 'sonner'

interface ProdutoCache {
  id: string
  codigo: string
  codigo_barras: string | null
  nome: string
  preco_venda: number
  estoque_atual: number
  unidade: string
  ncm: string | null
  updated_at: string
}

interface VendaParaSalvar {
  tempId: string
  itens: Array<{
    produto_id: string
    codigo: string
    nome: string
    quantidade: number
    preco_unitario: number
    desconto: number
    total: number
  }>
  pagamentos: Array<{
    forma: string
    valor: number
    bandeira?: string
    nsu?: string
  }>
  subtotal: number
  desconto: number
  total: number
  cliente_id?: string
  usuario_id: string
}

export function useOffline() {
  const [isOnline, setIsOnline] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [vendasPendentes, setVendasPendentes] = useState(0)
  const [produtosCacheados, setProdutosCacheados] = useState<ProdutoCache[]>([])
  const supabase = createClient()

  // Monitor online status
  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine)
    }

    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)

    updateOnlineStatus()

    return () => {
      window.removeEventListener('online', updateOnlineStatus)
      window.removeEventListener('offline', updateOnlineStatus)
    }
  }, [])

  // Count pending sales
  const atualizarContagemPendentes = useCallback(async () => {
    try {
      const count = await contarVendasPendentes()
      setVendasPendentes(count)
    } catch (error) {
      console.error('Erro ao contar vendas pendentes:', error)
    }
  }, [])

  // Load cached products
  const carregarProdutosCacheados = useCallback(async () => {
    try {
      const produtos = await getProdutosCacheados()
      setProdutosCacheados(produtos)
    } catch (error) {
      console.error('Erro ao carregar produtos cacheados:', error)
    }
  }, [])

  // Initial load
  useEffect(() => {
    atualizarContagemPendentes()
    carregarProdutosCacheados()
  }, [atualizarContagemPendentes, carregarProdutosCacheados])

  // Cache products for offline use
  const cacheAllProducts = useCallback(async () => {
    if (!isOnline) {
      toast.error('Sem conexao para atualizar cache')
      return false
    }

    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('id, codigo, codigo_barras, nome, preco_venda, estoque_atual, unidade, ncm, updated_at')
        .eq('ativo', true)
        .order('nome')

      if (error) throw error

      await cacheProdutos(data || [])
      await setConfig('last-cache-update', new Date().toISOString())

      setProdutosCacheados(data || [])
      toast.success(`${data?.length || 0} produtos salvos para uso offline`)
      return true
    } catch (error) {
      console.error('Erro ao cachear produtos:', error)
      toast.error('Erro ao salvar produtos offline')
      return false
    }
  }, [isOnline, supabase])

  // Search product in cache
  const buscarProdutoOffline = useCallback(async (termo: string): Promise<ProdutoCache[]> => {
    // Try exact match by codigo or codigo_barras first
    const porCodigo = await buscarProdutoCachePorCodigo(termo)
    if (porCodigo) return [porCodigo]

    const porCodigoBarras = await buscarProdutoCachePorCodigoBarras(termo)
    if (porCodigoBarras) return [porCodigoBarras]

    // Fallback to search in memory
    const termoLower = termo.toLowerCase()
    return produtosCacheados.filter(
      p =>
        p.codigo.toLowerCase().includes(termoLower) ||
        p.nome.toLowerCase().includes(termoLower) ||
        (p.codigo_barras && p.codigo_barras.includes(termo))
    )
  }, [produtosCacheados])

  // Save sale offline
  const salvarVenda = useCallback(async (venda: VendaParaSalvar) => {
    try {
      const vendaOffline = {
        ...venda,
        id: '',
        data_hora: new Date().toISOString(),
      }

      await salvarVendaOffline(vendaOffline)
      await atualizarContagemPendentes()

      // Try to sync immediately if online
      if (isOnline) {
        sincronizarVendas()
      }

      return { success: true, tempId: venda.tempId }
    } catch (error) {
      console.error('Erro ao salvar venda offline:', error)
      return { success: false, error }
    }
  }, [isOnline, atualizarContagemPendentes])

  // Sync sales to server
  const sincronizarVendas = useCallback(async () => {
    if (!isOnline || isSyncing) return

    setIsSyncing(true)
    try {
      const vendasPendentes = await getVendasNaoSincronizadas()

      if (vendasPendentes.length === 0) {
        setIsSyncing(false)
        return
      }

      let sincronizadas = 0
      let erros = 0

      for (const venda of vendasPendentes) {
        if (venda.tentativas >= 5) {
          // Skip sales with too many failed attempts
          continue
        }

        try {
          // Create venda in database
          const { data: vendaData, error: vendaError } = await supabase
            .from('vendas')
            .insert({
              cliente_id: venda.cliente_id || null,
              usuario_id: venda.usuario_id,
              subtotal: venda.subtotal,
              desconto: venda.desconto,
              total: venda.total,
              status: 'concluida',
              origem: 'pdv_offline',
              data_hora: venda.data_hora,
            })
            .select('id, numero')
            .single()

          if (vendaError) throw vendaError

          // Insert items
          const itens = venda.itens.map(item => ({
            venda_id: vendaData.id,
            produto_id: item.produto_id,
            quantidade: item.quantidade,
            preco_unitario: item.preco_unitario,
            desconto: item.desconto,
            total: item.total,
          }))

          const { error: itensError } = await supabase
            .from('venda_itens')
            .insert(itens)

          if (itensError) throw itensError

          // Insert payments
          const pagamentos = venda.pagamentos.map(pag => ({
            venda_id: vendaData.id,
            forma_pagamento: pag.forma,
            valor: pag.valor,
            bandeira: pag.bandeira || null,
            nsu: pag.nsu || null,
          }))

          const { error: pagError } = await supabase
            .from('venda_pagamentos')
            .insert(pagamentos)

          if (pagError) throw pagError

          await marcarVendaSincronizada(venda.tempId, vendaData.id)
          sincronizadas++
        } catch (error) {
          console.error('Erro ao sincronizar venda:', error)
          await incrementarTentativaVenda(venda.tempId)
          erros++
        }
      }

      await atualizarContagemPendentes()

      if (sincronizadas > 0) {
        toast.success(`${sincronizadas} venda(s) sincronizada(s)`)
      }
      if (erros > 0) {
        toast.error(`${erros} venda(s) com erro de sincronizacao`)
      }
    } catch (error) {
      console.error('Erro na sincronizacao:', error)
    } finally {
      setIsSyncing(false)
    }
  }, [isOnline, isSyncing, supabase, atualizarContagemPendentes])

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && vendasPendentes > 0) {
      sincronizarVendas()
    }
  }, [isOnline, vendasPendentes, sincronizarVendas])

  return {
    isOnline,
    isSyncing,
    vendasPendentes,
    produtosCacheados,
    cacheAllProducts,
    buscarProdutoOffline,
    salvarVenda,
    sincronizarVendas,
    atualizarContagemPendentes,
  }
}
