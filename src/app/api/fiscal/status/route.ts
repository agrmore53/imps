import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ServicoFiscal } from '@/lib/fiscal'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verifica autenticação
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Busca dados do usuário e empresa
    const { data: userData } = await supabase
      .from('usuarios')
      .select('empresa_id')
      .eq('auth_id', user.id)
      .single()

    if (!userData?.empresa_id) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })
    }

    // Busca configurações fiscais
    const { data: empresa } = await supabase
      .from('empresas')
      .select('*')
      .eq('id', userData.empresa_id)
      .single()

    if (!empresa) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })
    }

    const configFiscal = empresa.config_fiscal || {}

    if (!configFiscal.certificado_base64 || !configFiscal.certificado_senha) {
      return NextResponse.json({
        nfce: { online: false, mensagem: 'Certificado não configurado' },
        nfe: { online: false, mensagem: 'Certificado não configurado' },
      })
    }

    // Inicializa serviço fiscal
    const servicoFiscal = new ServicoFiscal({
      ambiente: configFiscal.ambiente || 2,
      uf: empresa.endereco?.uf || 'SC',
      serieNFCe: configFiscal.serie_nfce || 1,
      serieNFe: configFiscal.serie_nfe || 1,
      ultimoNumeroNFCe: configFiscal.ultimo_numero_nfce || 0,
      ultimoNumeroNFe: configFiscal.ultimo_numero_nfe || 0,
      idTokenNFCe: configFiscal.id_token_nfce || 1,
      cscNFCe: configFiscal.csc_nfce || '',
    })

    try {
      await servicoFiscal.inicializar(
        configFiscal.certificado_base64,
        configFiscal.certificado_senha
      )
    } catch (error: any) {
      return NextResponse.json({
        nfce: { online: false, mensagem: `Erro no certificado: ${error.message}` },
        nfe: { online: false, mensagem: `Erro no certificado: ${error.message}` },
      })
    }

    // Consulta status dos serviços
    const [statusNFCe, statusNFe] = await Promise.all([
      servicoFiscal.consultarStatus('65'),
      servicoFiscal.consultarStatus('55'),
    ])

    return NextResponse.json({
      nfce: statusNFCe,
      nfe: statusNFe,
      ambiente: configFiscal.ambiente === 1 ? 'Produção' : 'Homologação',
      uf: empresa.endereco?.uf || 'SC',
    })
  } catch (error: any) {
    console.error('Erro ao consultar status SEFAZ:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno' },
      { status: 500 }
    )
  }
}
