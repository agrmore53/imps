import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Restaurar Padrão de Fábrica
 * Exclui todos os dados transacionais e reseta configurações
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Buscar empresa do usuário
    const { data: userData, error: userError } = await supabase
      .from('usuarios')
      .select('empresa_id, tipo')
      .eq('auth_id', user.id)
      .single()

    if (userError || !userData?.empresa_id) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })
    }

    // Verificar se é admin
    if (userData.tipo !== 'admin') {
      return NextResponse.json({ error: 'Apenas administradores podem restaurar padrão de fábrica' }, { status: 403 })
    }

    const empresaId = userData.empresa_id

    // Verificar confirmação
    const body = await request.json()
    if (body.confirmacao !== 'CONFIRMAR') {
      return NextResponse.json({ error: 'Confirmação inválida' }, { status: 400 })
    }

    // Ordem de exclusão (respeitar foreign keys)
    const tabelasParaLimpar = [
      'itens_venda',           // Itens das vendas (depende de vendas e produtos)
      'vendas',                // Vendas
      'caixa_movimentacoes',   // Movimentações de caixa (depende de caixas)
      'caixas',                // Caixas
      'movimentacoes_estoque', // Movimentações de estoque (depende de produtos)
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
