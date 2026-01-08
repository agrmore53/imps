import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as bcrypt from 'bcryptjs'
import { logErroAPI, logErroBanco } from '@/lib/logger'

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
      .select('id, empresa_id, perfil, nome')
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
    console.log('[restaurar-padrao] Recebido:', {
      confirmacao: body.confirmacao,
      limparDadosEmpresa: body.limparDadosEmpresa
    })

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

    const resultados: { tabela: string; excluidos: number; erro?: string }[] = []

    // Função auxiliar para deletar e registrar resultado
    async function deletarTabela(tabela: string, filtro: { coluna: string; valor: string | string[] }) {
      try {
        let query = supabase.from(tabela).delete()

        if (Array.isArray(filtro.valor)) {
          if (filtro.valor.length === 0) {
            resultados.push({ tabela, excluidos: 0 })
            return
          }
          query = query.in(filtro.coluna, filtro.valor)
        } else {
          query = query.eq(filtro.coluna, filtro.valor)
        }

        const { data, error } = await query.select('id')
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

    // 1. Buscar IDs das vendas da empresa
    const { data: vendas } = await supabase
      .from('vendas')
      .select('id')
      .eq('empresa_id', empresaId)
    const vendasIds = vendas?.map(v => v.id) || []

    // 2. Buscar IDs dos caixas da empresa
    const { data: caixas } = await supabase
      .from('caixas')
      .select('id')
      .eq('empresa_id', empresaId)
    const caixasIds = caixas?.map(c => c.id) || []

    // 3. Deletar na ordem correta (filhos primeiro)

    // Tabelas que dependem de vendas (usar venda_id)
    await deletarTabela('venda_pagamentos', { coluna: 'venda_id', valor: vendasIds })
    await deletarTabela('venda_itens', { coluna: 'venda_id', valor: vendasIds })

    // Tabelas que dependem de caixas (usar caixa_id)
    await deletarTabela('caixa_movimentos', { coluna: 'caixa_id', valor: caixasIds })

    // Agora deletar vendas e caixas
    await deletarTabela('vendas', { coluna: 'empresa_id', valor: empresaId })
    await deletarTabela('caixas', { coluna: 'empresa_id', valor: empresaId })

    // Demais tabelas com empresa_id direto
    await deletarTabela('estoque_movimentos', { coluna: 'empresa_id', valor: empresaId })
    await deletarTabela('produtos_classificacao_tributaria', { coluna: 'empresa_id', valor: empresaId })
    await deletarTabela('notas_fiscais', { coluna: 'empresa_id', valor: empresaId })
    await deletarTabela('contas_pagar', { coluna: 'empresa_id', valor: empresaId })
    await deletarTabela('contas_receber', { coluna: 'empresa_id', valor: empresaId })
    await deletarTabela('produtos', { coluna: 'empresa_id', valor: empresaId })
    await deletarTabela('clientes', { coluna: 'empresa_id', valor: empresaId })
    await deletarTabela('fornecedores', { coluna: 'empresa_id', valor: empresaId })
    await deletarTabela('notificacoes', { coluna: 'empresa_id', valor: empresaId })

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

    // Preparar dados para atualização
    const updateData: any = { config_fiscal: configPadrao }

    // Se marcou para limpar dados da empresa
    if (body.limparDadosEmpresa) {
      updateData.cnpj = null
      updateData.razao_social = 'Empresa'
      updateData.nome_fantasia = ''  // NOT NULL no banco, usar string vazia
      updateData.ie = null
      updateData.telefone = null
      updateData.email = null
      updateData.endereco = {}
    }

    const { error: updateError } = await supabase
      .from('empresas')
      .update(updateData)
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
      if (body.limparDadosEmpresa) {
        resultados.push({
          tabela: 'dados_empresa',
          excluidos: 1,
          erro: undefined,
        })
      }
    }

    // Verificar se houve erros críticos
    const errosCriticos = resultados.filter(r => r.erro && !r.erro.includes('does not exist'))

    // Registrar log de auditoria
    const ipAddress = request.headers.get('x-forwarded-for') ||
                      request.headers.get('x-real-ip') ||
                      'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Calcular totais para o log
    const totalExcluidos = resultados.reduce((acc, r) => acc + r.excluidos, 0)

    await supabase
      .from('logs_auditoria')
      .insert({
        empresa_id: empresaId,
        usuario_id: userData.id,
        usuario_nome: userData.nome,
        acao: 'RESTAURAR_PADRAO',
        detalhes: {
          total_registros_excluidos: totalExcluidos,
          tabelas_afetadas: resultados.map(r => ({
            tabela: r.tabela,
            excluidos: r.excluidos,
          })),
          erros: errosCriticos.length > 0 ? errosCriticos : undefined,
          sucesso: errosCriticos.length === 0,
          limpar_dados_empresa: body.limparDadosEmpresa || false,
        },
        ip_address: ipAddress,
        user_agent: userAgent,
      })

    return NextResponse.json({
      success: errosCriticos.length === 0,
      message: errosCriticos.length === 0
        ? 'Padrão de fábrica restaurado com sucesso!'
        : 'Restauração concluída com alguns avisos',
      resultados,
    })

  } catch (error: any) {
    await logErroAPI(
      'Erro ao restaurar padrão de fábrica',
      error,
      request,
      500
    )
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error.message },
      { status: 500 }
    )
  }
}
