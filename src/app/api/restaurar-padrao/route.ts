import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as bcrypt from 'bcryptjs'

/**
 * Restaurar Padrão de Fábrica
 * Exclui todos os dados transacionais e reseta configurações
 *
 * SEGURANÇA:
 * - Apenas usuários com perfil 'admin' podem executar
 * - Requer digitação de "CONFIRMAR"
 * - Requer SENHA MESTRE (separada da senha de login)
 * - Apenas o dono da empresa deve conhecer a senha mestre
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Buscar empresa e perfil do usuário
    const { data: userData, error: userError } = await supabase
      .from('usuarios')
      .select('empresa_id, perfil, nome')
      .eq('auth_id', user.id)
      .single()

    if (userError || !userData?.empresa_id) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })
    }

    // Verificar se é admin (campo correto: perfil)
    if (userData.perfil !== 'admin') {
      return NextResponse.json({ error: 'Apenas administradores podem restaurar padrão de fábrica' }, { status: 403 })
    }

    const empresaId = userData.empresa_id

    // Verificar confirmação e senha mestre
    const body = await request.json()
    if (body.confirmacao !== 'CONFIRMAR') {
      return NextResponse.json({ error: 'Confirmação inválida' }, { status: 400 })
    }

    // Validar senha mestre
    if (!body.senhaMestre) {
      return NextResponse.json({ error: 'Senha mestre é obrigatória para esta operação' }, { status: 400 })
    }

    // Buscar hash da senha mestre
    const { data: empresa, error: empresaError } = await supabase
      .from('empresas')
      .select('senha_mestre_hash')
      .eq('id', empresaId)
      .single()

    if (empresaError) {
      return NextResponse.json({ error: 'Erro ao buscar empresa' }, { status: 500 })
    }

    // Verificar se tem senha mestre configurada
    if (!empresa.senha_mestre_hash) {
      return NextResponse.json({
        error: 'Senha mestre não configurada. Configure em Configurações → Sistema.'
      }, { status: 400 })
    }

    // Validar senha mestre
    const senhaValida = await bcrypt.compare(body.senhaMestre, empresa.senha_mestre_hash)
    if (!senhaValida) {
      return NextResponse.json({ error: 'Senha mestre incorreta' }, { status: 401 })
    }

    // Ordem de exclusão (respeitar foreign keys)
    const tabelasParaLimpar = [
      'venda_pagamentos',      // Pagamentos das vendas (depende de vendas)
      'venda_itens',           // Itens das vendas (depende de vendas e produtos)
      'vendas',                // Vendas
      'caixa_movimentos',      // Movimentações de caixa (depende de caixas)
      'caixas',                // Caixas
      'estoque_movimentos',    // Movimentações de estoque (depende de produtos)
      'notas_fiscais',         // Notas fiscais
      'contas_pagar',          // Contas a pagar
      'contas_receber',        // Contas a receber
      'produtos_classificacao_tributaria', // Classificação tributária (depende de produtos)
      'produtos',              // Produtos
      'clientes',              // Clientes
      'notificacoes',          // Notificações
    ]

    const resultados: { tabela: string; excluidos: number; erro?: string }[] = []

    for (const tabela of tabelasParaLimpar) {
      try {
        const { data, error } = await supabase
          .from(tabela)
          .delete()
          .eq('empresa_id', empresaId)
          .select('id')

        resultados.push({
          tabela,
          excluidos: data?.length || 0,
          erro: error?.message,
        })
      } catch (err: any) {
        resultados.push({
          tabela,
          excluidos: 0,
          erro: err.message,
        })
      }
    }

    // Resetar configurações fiscais para padrão
    const configPadrao = {
      regime_tributario: '1',  // Simples Nacional
      ambiente: '2',           // Homologação
      serie_nfce: '1',
      numero_nfce: 1,
      serie_nfe: '1',
      numero_nfe: 1,
      csc_nfce: null,
      id_token_nfce: null,
      certificado_base64: null,
      certificado_validade: null,
    }

    const { error: updateError } = await supabase
      .from('empresas')
      .update({ config_fiscal: configPadrao })
      .eq('id', empresaId)

    if (updateError) {
      resultados.push({
        tabela: 'config_fiscal',
        excluidos: 0,
        erro: updateError.message,
      })
    } else {
      resultados.push({
        tabela: 'config_fiscal',
        excluidos: 1,
        erro: undefined,
      })
    }

    // Verificar se houve erros críticos
    const errosCriticos = resultados.filter(r => r.erro && !r.erro.includes('does not exist'))

    return NextResponse.json({
      success: errosCriticos.length === 0,
      message: errosCriticos.length === 0
        ? 'Padrão de fábrica restaurado com sucesso!'
        : 'Restauração concluída com alguns avisos',
      resultados,
    })

  } catch (error: any) {
    console.error('Erro ao restaurar padrão:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error.message },
      { status: 500 }
    )
  }
}
