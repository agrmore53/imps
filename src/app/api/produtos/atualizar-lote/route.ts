import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Buscar empresa do usuário
    const { data: userData } = await supabase
      .from('usuarios')
      .select('empresa_id')
      .eq('auth_id', user.id)
      .single()

    if (!userData?.empresa_id) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })
    }

    const empresaId = userData.empresa_id
    const body = await request.json()
    const { produto_ids, dados } = body

    if (!produto_ids || !Array.isArray(produto_ids) || produto_ids.length === 0) {
      return NextResponse.json({ error: 'Nenhum produto selecionado' }, { status: 400 })
    }

    if (!dados || Object.keys(dados).length === 0) {
      return NextResponse.json({ error: 'Nenhum dado para atualizar' }, { status: 400 })
    }

    // Campos permitidos para atualização em lote
    const camposPermitidos = ['ncm', 'cest', 'cfop', 'unidade', 'icms_cst', 'icms_aliquota', 'pis_cst', 'cofins_cst', 'ativo']
    const dadosFiltrados: Record<string, any> = {}

    for (const campo of camposPermitidos) {
      if (dados[campo] !== undefined) {
        dadosFiltrados[campo] = dados[campo]
      }
    }

    if (Object.keys(dadosFiltrados).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo válido para atualização' }, { status: 400 })
    }

    // Atualizar produtos
    const { data, error } = await supabase
      .from('produtos')
      .update(dadosFiltrados)
      .eq('empresa_id', empresaId)
      .in('id', produto_ids)
      .select('id')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `${data?.length || 0} produto(s) atualizado(s)`,
      atualizados: data?.length || 0,
    })
  } catch (error: any) {
    console.error('Erro ao atualizar produtos em lote:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar produtos: ' + error.message },
      { status: 500 }
    )
  }
}
