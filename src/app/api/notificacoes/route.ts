import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logErroAPI } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Buscar empresa do usuário
    const { data: userData } = await supabase
      .from('usuarios')
      .select('empresa_id')
      .eq('auth_id', user.id)
      .single()

    if (!userData) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    const empresaId = userData.empresa_id
    const hoje = new Date()
    const hojeStr = hoje.toISOString().split('T')[0]

    // Data de 7 dias à frente
    const em7dias = new Date(hoje)
    em7dias.setDate(em7dias.getDate() + 7)
    const em7diasStr = em7dias.toISOString().split('T')[0]

    // 1. Buscar produtos com estoque baixo
    const { data: produtosBaixoEstoque } = await supabase
      .from('produtos')
      .select('id, nome, estoque_atual, estoque_minimo, unidade')
      .eq('empresa_id', empresaId)
      .eq('ativo', true)
      .not('estoque_minimo', 'is', null)
      .filter('estoque_atual', 'lte', 'estoque_minimo')

    // 2. Buscar contas a pagar vencidas
    const { data: contasPagarVencidas } = await supabase
      .from('contas_pagar')
      .select('id, descricao, valor, vencimento')
      .eq('empresa_id', empresaId)
      .eq('status', 'pendente')
      .lt('vencimento', hojeStr)

    // 3. Buscar contas a pagar vencendo nos próximos 7 dias
    const { data: contasPagarVencendo } = await supabase
      .from('contas_pagar')
      .select('id, descricao, valor, vencimento')
      .eq('empresa_id', empresaId)
      .eq('status', 'pendente')
      .gte('vencimento', hojeStr)
      .lte('vencimento', em7diasStr)

    // 4. Buscar contas a receber vencidas
    const { data: contasReceberVencidas } = await supabase
      .from('contas_receber')
      .select('id, valor, vencimento, clientes(nome)')
      .eq('empresa_id', empresaId)
      .eq('status', 'pendente')
      .lt('vencimento', hojeStr)

    // Gerar notificações
    const notificacoesParaInserir: Array<{
      empresa_id: string
      tipo: string
      titulo: string
      mensagem: string
      referencia_id: string
      referencia_tipo: string
      data_geracao: string
    }> = []

    // Notificações de estoque baixo
    produtosBaixoEstoque?.forEach((produto) => {
      notificacoesParaInserir.push({
        empresa_id: empresaId,
        tipo: 'estoque_baixo',
        titulo: 'Estoque baixo',
        mensagem: `Produto "${produto.nome}" com apenas ${produto.estoque_atual} ${produto.unidade}`,
        referencia_id: produto.id,
        referencia_tipo: 'produto',
        data_geracao: hojeStr,
      })
    })

    // Notificações de contas a pagar vencidas
    contasPagarVencidas?.forEach((conta) => {
      const diasVencido = Math.floor((hoje.getTime() - new Date(conta.vencimento).getTime()) / (1000 * 60 * 60 * 24))
      notificacoesParaInserir.push({
        empresa_id: empresaId,
        tipo: 'conta_pagar_vencida',
        titulo: 'Conta vencida',
        mensagem: `"${conta.descricao}" de R$ ${conta.valor.toFixed(2)} vencida há ${diasVencido} dia(s)`,
        referencia_id: conta.id,
        referencia_tipo: 'conta_pagar',
        data_geracao: hojeStr,
      })
    })

    // Notificações de contas a pagar vencendo
    contasPagarVencendo?.forEach((conta) => {
      const diasParaVencer = Math.floor((new Date(conta.vencimento).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
      notificacoesParaInserir.push({
        empresa_id: empresaId,
        tipo: 'conta_pagar_vencendo',
        titulo: 'Conta vencendo',
        mensagem: `"${conta.descricao}" de R$ ${conta.valor.toFixed(2)} vence em ${diasParaVencer} dia(s)`,
        referencia_id: conta.id,
        referencia_tipo: 'conta_pagar',
        data_geracao: hojeStr,
      })
    })

    // Notificações de contas a receber vencidas
    contasReceberVencidas?.forEach((conta: any) => {
      const diasVencido = Math.floor((hoje.getTime() - new Date(conta.vencimento).getTime()) / (1000 * 60 * 60 * 24))
      const nomeCliente = conta.clientes?.nome || 'Cliente'
      notificacoesParaInserir.push({
        empresa_id: empresaId,
        tipo: 'conta_receber_vencida',
        titulo: 'Recebimento atrasado',
        mensagem: `${nomeCliente} deve R$ ${conta.valor.toFixed(2)} há ${diasVencido} dia(s)`,
        referencia_id: conta.id,
        referencia_tipo: 'conta_receber',
        data_geracao: hojeStr,
      })
    })

    // Inserir notificações (ignorar duplicatas)
    if (notificacoesParaInserir.length > 0) {
      await supabase
        .from('notificacoes')
        .upsert(notificacoesParaInserir, {
          onConflict: 'empresa_id,tipo,referencia_id,data_geracao',
          ignoreDuplicates: true,
        })
    }

    // Buscar todas as notificações não lidas
    const { data: notificacoes, error } = await supabase
      .from('notificacoes')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('lida', false)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Erro ao buscar notificações:', error)
      return NextResponse.json({ error: 'Erro ao buscar notificações' }, { status: 500 })
    }

    return NextResponse.json(notificacoes || [])
  } catch (error) {
    await logErroAPI('Erro na API de notificações', error, request, 500)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// Marcar todas como lidas
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from('usuarios')
      .select('empresa_id')
      .eq('auth_id', user.id)
      .single()

    if (!userData) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    const body = await request.json()

    if (body.action === 'mark_all_read') {
      // Marcar todas como lidas
      const { error } = await supabase
        .from('notificacoes')
        .update({ lida: true })
        .eq('empresa_id', userData.empresa_id)
        .eq('lida', false)

      if (error) {
        return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  } catch (error) {
    await logErroAPI('Erro ao marcar notificações', error, request, 500)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
