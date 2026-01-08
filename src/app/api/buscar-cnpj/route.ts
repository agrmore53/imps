import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const cnpj = searchParams.get('cnpj')?.replace(/\D/g, '')

    if (!cnpj || cnpj.length !== 14) {
      return NextResponse.json({ error: 'CNPJ inválido' }, { status: 400 })
    }

    // Buscar dados na ReceitaWS
    const response = await fetch(`https://receitaws.com.br/v1/cnpj/${cnpj}`, {
      headers: {
        'Accept': 'application/json',
      },
    })

    const data = await response.json()

    if (data.status === 'ERROR') {
      return NextResponse.json({ error: data.message || 'CNPJ não encontrado' }, { status: 404 })
    }

    return NextResponse.json({
      nome: data.nome,
      fantasia: data.fantasia,
      telefone: data.telefone,
      email: data.email,
      cep: data.cep,
      logradouro: data.logradouro,
      numero: data.numero,
      complemento: data.complemento,
      bairro: data.bairro,
      municipio: data.municipio,
      uf: data.uf,
    })
  } catch (error) {
    console.error('Erro ao buscar CNPJ:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar CNPJ' },
      { status: 500 }
    )
  }
}
