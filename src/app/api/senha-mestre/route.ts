import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as bcrypt from 'bcryptjs'
import { logErroAPI } from '@/lib/logger'

/**
 * API para gerenciar a Senha Mestre
 * Esta senha é separada da senha de login e só o dono deve saber
 */

// POST - Definir ou alterar senha mestre
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Buscar dados do usuário
    const { data: userData, error: userError } = await supabase
      .from('usuarios')
      .select('id, empresa_id, perfil, nome')
      .eq('auth_id', user.id)
      .single()

    if (userError || !userData?.empresa_id) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })
    }

    // Apenas admin pode definir senha mestre
    if (userData.perfil !== 'admin') {
      return NextResponse.json({ error: 'Apenas administradores podem definir a senha mestre' }, { status: 403 })
    }

    const body = await request.json()
    const { senhaAtual, novaSenha } = body

    if (!novaSenha || novaSenha.length < 6) {
      return NextResponse.json({ error: 'A nova senha deve ter pelo menos 6 caracteres' }, { status: 400 })
    }

    // Buscar empresa para verificar se já tem senha mestre
    const { data: empresa, error: empresaError } = await supabase
      .from('empresas')
      .select('senha_mestre_hash')
      .eq('id', userData.empresa_id)
      .single()

    if (empresaError) {
      return NextResponse.json({ error: 'Erro ao buscar empresa' }, { status: 500 })
    }

    // Se já existe senha mestre, precisa informar a atual
    if (empresa.senha_mestre_hash) {
      if (!senhaAtual) {
        return NextResponse.json({ error: 'Informe a senha mestre atual' }, { status: 400 })
      }

      const senhaValida = await bcrypt.compare(senhaAtual, empresa.senha_mestre_hash)
      if (!senhaValida) {
        return NextResponse.json({ error: 'Senha mestre atual incorreta' }, { status: 401 })
      }
    }

    // Gerar hash da nova senha
    const salt = await bcrypt.genSalt(12)
    const hash = await bcrypt.hash(novaSenha, salt)

    // Salvar no banco
    const { error: updateError } = await supabase
      .from('empresas')
      .update({ senha_mestre_hash: hash })
      .eq('id', userData.empresa_id)

    if (updateError) {
      return NextResponse.json({ error: 'Erro ao salvar senha mestre' }, { status: 500 })
    }

    // Registrar log de auditoria
    const ipAddress = request.headers.get('x-forwarded-for') ||
                      request.headers.get('x-real-ip') ||
                      'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'
    const acao = empresa.senha_mestre_hash ? 'ALTERAR_SENHA_MESTRE' : 'DEFINIR_SENHA_MESTRE'

    await supabase
      .from('logs_auditoria')
      .insert({
        empresa_id: userData.empresa_id,
        usuario_id: userData.id,
        usuario_nome: userData.nome,
        acao,
        detalhes: {
          tipo: empresa.senha_mestre_hash ? 'alteracao' : 'criacao',
        },
        ip_address: ipAddress,
        user_agent: userAgent,
      })

    return NextResponse.json({
      success: true,
      message: empresa.senha_mestre_hash ? 'Senha mestre alterada com sucesso' : 'Senha mestre definida com sucesso'
    })

  } catch (error: any) {
    await logErroAPI('Erro ao definir senha mestre', error, request, 500)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// GET - Verificar se tem senha mestre configurada
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Buscar dados do usuário
    const { data: userData, error: userError } = await supabase
      .from('usuarios')
      .select('empresa_id')
      .eq('auth_id', user.id)
      .single()

    if (userError || !userData?.empresa_id) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })
    }

    // Buscar empresa
    const { data: empresa, error: empresaError } = await supabase
      .from('empresas')
      .select('senha_mestre_hash')
      .eq('id', userData.empresa_id)
      .single()

    if (empresaError) {
      return NextResponse.json({ error: 'Erro ao buscar empresa' }, { status: 500 })
    }

    return NextResponse.json({
      temSenhaMestre: !!empresa.senha_mestre_hash
    })

  } catch (error: any) {
    await logErroAPI('Erro ao verificar senha mestre', error, request, 500)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
