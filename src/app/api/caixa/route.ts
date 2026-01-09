import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logErroAPI } from '@/lib/logger'

// GET - Buscar caixa aberto do usuário
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('id, empresa_id, nome')
      .eq('auth_id', user.id)
      .single()

    if (!usuario) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    // Buscar caixa aberto
    const { data: caixa } = await supabase
      .from('caixas')
      .select('*')
      .eq('usuario_id', usuario.id)
      .eq('status', 'aberto')
      .single()

    // Buscar movimentos do caixa se existir
    let movimentos = []
    let resumo = {
      total_vendas: 0,
      total_sangrias: 0,
      total_suprimentos: 0,
      total_dinheiro: 0,
      total_cartao_credito: 0,
      total_cartao_debito: 0,
      total_pix: 0,
      quantidade_vendas: 0,
    }

    if (caixa) {
      const { data: movs } = await supabase
        .from('caixa_movimentos')
        .select('*')
        .eq('caixa_id', caixa.id)
        .order('created_at', { ascending: false })

      movimentos = movs || []

      // Calcular resumo
      for (const mov of movimentos) {
        if (mov.tipo === 'entrada') {
          resumo.total_vendas += mov.valor
          resumo.quantidade_vendas++
        } else if (mov.tipo === 'sangria') {
          resumo.total_sangrias += mov.valor
        } else if (mov.tipo === 'suprimento') {
          resumo.total_suprimentos += mov.valor
        }
      }

      // Buscar vendas do caixa para detalhar por forma de pagamento
      const { data: pagamentos } = await supabase
        .from('venda_pagamentos')
        .select(`
          forma_pagamento,
          valor,
          vendas!inner (caixa_id)
        `)
        .eq('vendas.caixa_id', caixa.id)

      if (pagamentos) {
        for (const pag of pagamentos) {
          switch (pag.forma_pagamento) {
            case 'dinheiro':
              resumo.total_dinheiro += pag.valor
              break
            case 'cartao_credito':
              resumo.total_cartao_credito += pag.valor
              break
            case 'cartao_debito':
              resumo.total_cartao_debito += pag.valor
              break
            case 'pix':
              resumo.total_pix += pag.valor
              break
          }
        }
      }
    }

    return NextResponse.json({
      caixa,
      movimentos,
      resumo,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
      },
    })
  } catch (error) {
    await logErroAPI('Erro ao buscar caixa', error, request, 500)
    return NextResponse.json(
      { error: 'Erro ao buscar caixa' },
      { status: 500 }
    )
  }
}

// POST - Operações do caixa (abrir, fechar, sangria, suprimento)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('id, empresa_id, nome')
      .eq('auth_id', user.id)
      .single()

    if (!usuario) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    const body = await request.json()
    const { operacao, valor, observacao } = body

    switch (operacao) {
      case 'abrir': {
        // Verificar se já existe caixa aberto
        const { data: caixaExistente } = await supabase
          .from('caixas')
          .select('id')
          .eq('usuario_id', usuario.id)
          .eq('status', 'aberto')
          .single()

        if (caixaExistente) {
          return NextResponse.json(
            { error: 'Já existe um caixa aberto para este usuário' },
            { status: 400 }
          )
        }

        // Abrir novo caixa
        const { data: novoCaixa, error: createError } = await supabase
          .from('caixas')
          .insert({
            empresa_id: usuario.empresa_id,
            usuario_id: usuario.id,
            valor_abertura: valor || 0,
            status: 'aberto',
          })
          .select()
          .single()

        if (createError) {
          throw createError
        }

        // Não criar movimento de abertura - o valor_abertura já está registrado no caixa
        // Isso evita duplicação no cálculo do saldo

        return NextResponse.json({
          success: true,
          message: 'Caixa aberto com sucesso',
          caixa: novoCaixa,
        })
      }

      case 'fechar': {
        // Buscar caixa aberto
        const { data: caixa } = await supabase
          .from('caixas')
          .select('*')
          .eq('usuario_id', usuario.id)
          .eq('status', 'aberto')
          .single()

        if (!caixa) {
          return NextResponse.json(
            { error: 'Nenhum caixa aberto encontrado' },
            { status: 400 }
          )
        }

        // Calcular valor esperado
        const { data: movimentos } = await supabase
          .from('caixa_movimentos')
          .select('tipo, valor')
          .eq('caixa_id', caixa.id)

        let saldoEsperado = caixa.valor_abertura || 0
        if (movimentos) {
          for (const mov of movimentos) {
            if (mov.tipo === 'entrada' || mov.tipo === 'suprimento') {
              saldoEsperado += mov.valor
            } else if (mov.tipo === 'saida' || mov.tipo === 'sangria') {
              saldoEsperado -= mov.valor
            }
          }
        }

        // Fechar caixa
        const { data: caixaFechado, error: closeError } = await supabase
          .from('caixas')
          .update({
            data_fechamento: new Date().toISOString(),
            valor_fechamento: valor || 0,
            status: 'fechado',
          })
          .eq('id', caixa.id)
          .select()
          .single()

        if (closeError) {
          throw closeError
        }

        const diferenca = (valor || 0) - saldoEsperado

        return NextResponse.json({
          success: true,
          message: 'Caixa fechado com sucesso',
          caixa: caixaFechado,
          resumo: {
            valor_abertura: caixa.valor_abertura,
            valor_fechamento: valor,
            saldo_esperado: saldoEsperado,
            diferenca: diferenca,
          },
        })
      }

      case 'sangria': {
        // Buscar caixa aberto
        const { data: caixa } = await supabase
          .from('caixas')
          .select('id')
          .eq('usuario_id', usuario.id)
          .eq('status', 'aberto')
          .single()

        if (!caixa) {
          return NextResponse.json(
            { error: 'Nenhum caixa aberto encontrado' },
            { status: 400 }
          )
        }

        if (!valor || valor <= 0) {
          return NextResponse.json(
            { error: 'Valor inválido para sangria' },
            { status: 400 }
          )
        }

        // Registrar sangria
        const { data: movimento, error: movError } = await supabase
          .from('caixa_movimentos')
          .insert({
            caixa_id: caixa.id,
            tipo: 'sangria',
            valor: valor,
            descricao: observacao || 'Sangria de caixa',
          })
          .select()
          .single()

        if (movError) {
          throw movError
        }

        return NextResponse.json({
          success: true,
          message: 'Sangria registrada com sucesso',
          movimento,
        })
      }

      case 'suprimento': {
        // Buscar caixa aberto
        const { data: caixa } = await supabase
          .from('caixas')
          .select('id')
          .eq('usuario_id', usuario.id)
          .eq('status', 'aberto')
          .single()

        if (!caixa) {
          return NextResponse.json(
            { error: 'Nenhum caixa aberto encontrado' },
            { status: 400 }
          )
        }

        if (!valor || valor <= 0) {
          return NextResponse.json(
            { error: 'Valor inválido para suprimento' },
            { status: 400 }
          )
        }

        // Registrar suprimento
        const { data: movimento, error: movError } = await supabase
          .from('caixa_movimentos')
          .insert({
            caixa_id: caixa.id,
            tipo: 'suprimento',
            valor: valor,
            descricao: observacao || 'Suprimento de caixa',
          })
          .select()
          .single()

        if (movError) {
          throw movError
        }

        return NextResponse.json({
          success: true,
          message: 'Suprimento registrado com sucesso',
          movimento,
        })
      }

      default:
        return NextResponse.json(
          { error: 'Operação inválida' },
          { status: 400 }
        )
    }
  } catch (error) {
    await logErroAPI('Erro na operação do caixa', error, request, 500)
    return NextResponse.json(
      { error: 'Erro na operação do caixa: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
