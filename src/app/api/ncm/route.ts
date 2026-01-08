import { NextRequest, NextResponse } from 'next/server'
import ncmList from '@/data/ncm-list.json'

// GET - Buscar NCMs por código ou descrição
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const busca = searchParams.get('q')?.toLowerCase().trim()

    if (!busca) {
      // Retornar todos os NCMs se não houver busca
      return NextResponse.json(ncmList)
    }

    // Filtrar por código ou descrição
    const resultados = ncmList.filter((ncm) => {
      const codigo = ncm.ncm.replace(/\./g, '').toLowerCase()
      const buscaLimpa = busca.replace(/\./g, '').toLowerCase()
      const descricao = ncm.descricao.toLowerCase()

      return codigo.includes(buscaLimpa) || descricao.includes(busca)
    })

    return NextResponse.json(resultados)
  } catch (error: any) {
    console.error('Erro ao buscar NCM:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar NCM' },
      { status: 500 }
    )
  }
}

// POST - Validar se NCM existe
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ncm } = body

    if (!ncm) {
      return NextResponse.json({ error: 'NCM não informado' }, { status: 400 })
    }

    const ncmLimpo = ncm.replace(/\./g, '')
    const encontrado = ncmList.find((n) => n.ncm.replace(/\./g, '') === ncmLimpo)

    if (encontrado) {
      return NextResponse.json({
        valido: true,
        ncm: encontrado.ncm,
        descricao: encontrado.descricao,
      })
    }

    return NextResponse.json({
      valido: false,
      message: 'NCM não encontrado na base de dados. Verifique se o código está correto.',
    })
  } catch (error: any) {
    console.error('Erro ao validar NCM:', error)
    return NextResponse.json(
      { error: 'Erro ao validar NCM' },
      { status: 500 }
    )
  }
}
