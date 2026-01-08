import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface ProdutoImportacao {
  nome: string
  preco_venda: number
  preco_custo?: number
  estoque_atual?: number
  estoque_minimo?: number
  codigo_barras?: string
  unidade?: string
}

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
    const produtos: ProdutoImportacao[] = body.produtos

    if (!produtos || !Array.isArray(produtos) || produtos.length === 0) {
      return NextResponse.json({ error: 'Nenhum produto para importar' }, { status: 400 })
    }

    // Buscar último código usado
    const { data: ultimoProduto } = await supabase
      .from('produtos')
      .select('codigo')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    let ultimoCodigo = 0
    if (ultimoProduto?.codigo) {
      const match = ultimoProduto.codigo.match(/\d+/)
      if (match) {
        ultimoCodigo = parseInt(match[0], 10)
      }
    }

    const resultados = {
      importados: 0,
      erros: [] as { produto: string; erro: string }[],
    }

    // Importar produtos
    for (const produto of produtos) {
      try {
        if (!produto.nome || produto.preco_venda === undefined) {
          resultados.erros.push({
            produto: produto.nome || 'Sem nome',
            erro: 'Nome ou preço de venda não informado',
          })
          continue
        }

        ultimoCodigo++
        const codigo = String(ultimoCodigo).padStart(4, '0')

        const { error } = await supabase
          .from('produtos')
          .insert({
            empresa_id: empresaId,
            codigo,
            nome: produto.nome.trim(),
            preco_venda: produto.preco_venda,
            preco_custo: produto.preco_custo || 0,
            estoque_atual: produto.estoque_atual || 0,
            estoque_minimo: produto.estoque_minimo || 0,
            codigo_barras: produto.codigo_barras || null,
            unidade: produto.unidade || 'UN',
            ativo: true,
          })

        if (error) {
          resultados.erros.push({
            produto: produto.nome,
            erro: error.message,
          })
        } else {
          resultados.importados++
        }
      } catch (err: any) {
        resultados.erros.push({
          produto: produto.nome || 'Desconhecido',
          erro: err.message,
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `${resultados.importados} produtos importados com sucesso`,
      resultados,
    })
  } catch (error: any) {
    console.error('Erro ao importar produtos:', error)
    return NextResponse.json(
      { error: 'Erro ao importar produtos: ' + error.message },
      { status: 500 }
    )
  }
}
