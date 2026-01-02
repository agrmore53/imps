import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ServicoFiscal } from '@/lib/fiscal'

export async function POST(request: NextRequest) {
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
      return NextResponse.json(
        { error: 'Certificado digital não configurado' },
        { status: 400 }
      )
    }

    // Dados da NF-e
    const body = await request.json()
    const {
      naturezaOperacao,
      destinatario,
      produtos,
      pagamentos,
      valorTotal,
      valorDesconto,
      valorFrete,
      informacoesAdicionais,
    } = body

    if (!destinatario || !destinatario.cpfCnpj) {
      return NextResponse.json({ error: 'Destinatário obrigatório para NF-e' }, { status: 400 })
    }

    if (!produtos || produtos.length === 0) {
      return NextResponse.json({ error: 'Nenhum produto informado' }, { status: 400 })
    }

    // Prepara dados da empresa
    const empresaFiscal = {
      cnpj: empresa.cnpj,
      razaoSocial: empresa.razao_social,
      nomeFantasia: empresa.nome_fantasia,
      inscricaoEstadual: empresa.inscricao_estadual,
      crt: configFiscal.crt || 1,
      endereco: {
        logradouro: empresa.endereco?.logradouro || '',
        numero: empresa.endereco?.numero || '',
        complemento: empresa.endereco?.complemento,
        bairro: empresa.endereco?.bairro || '',
        codigoMunicipio: empresa.endereco?.codigo_municipio || '',
        nomeMunicipio: empresa.endereco?.cidade || '',
        uf: empresa.endereco?.uf || 'SC',
        cep: empresa.endereco?.cep || '',
        pais: 'BRASIL',
        codigoPais: '1058',
        telefone: empresa.telefone,
      },
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

    // Inicializa certificado
    await servicoFiscal.inicializar(
      configFiscal.certificado_base64,
      configFiscal.certificado_senha
    )

    // Prepara destinatário
    const destinatarioNFe = {
      cpfCnpj: destinatario.cpfCnpj,
      nome: destinatario.nome,
      email: destinatario.email,
      inscricaoEstadual: destinatario.inscricaoEstadual,
      endereco: destinatario.endereco ? {
        logradouro: destinatario.endereco.logradouro,
        numero: destinatario.endereco.numero,
        complemento: destinatario.endereco.complemento,
        bairro: destinatario.endereco.bairro,
        codigoMunicipio: destinatario.endereco.codigoMunicipio,
        nomeMunicipio: destinatario.endereco.cidade,
        uf: destinatario.endereco.uf,
        cep: destinatario.endereco.cep,
        pais: 'BRASIL',
        codigoPais: '1058',
      } : undefined,
    }

    // Prepara produtos para NF-e
    const produtosNFe = produtos.map((p: any) => ({
      codigo: p.codigo,
      cEAN: p.codigo_barras || 'SEM GTIN',
      descricao: p.nome,
      ncm: p.ncm || '00000000',
      cfop: configFiscal.cfop_venda_nfe || '5102',
      unidade: p.unidade || 'UN',
      quantidade: p.quantidade,
      valorUnitario: p.preco_unitario,
      valorTotal: p.total,
      icms: {
        origem: 0,
        cst: p.icms_cst || '00',
        aliquota: p.icms_aliquota || 0,
        valorBase: p.total,
        valor: (p.total * (p.icms_aliquota || 0)) / 100,
      },
      pis: { cst: p.pis_cst || '07' },
      cofins: { cst: p.cofins_cst || '07' },
    }))

    // Prepara pagamentos
    const pagamentosNFe = pagamentos.map((pag: any) => ({
      forma: pag.forma || '01',
      valor: pag.valor,
      bandeira: pag.bandeira,
    }))

    // Emite NF-e
    const resultado = await servicoFiscal.emitirNFe({
      dataEmissao: new Date(),
      naturezaOperacao: naturezaOperacao || 'Venda de mercadoria',
      empresa: empresaFiscal,
      destinatario: destinatarioNFe,
      produtos: produtosNFe,
      pagamentos: pagamentosNFe,
      valorTotal,
      valorDesconto,
      valorFrete,
      informacoesAdicionais,
      finalidade: 1,
      consumidorFinal: 1,
      presenca: 1,
    })

    if (resultado.sucesso) {
      // Atualiza último número no banco
      const novoNumero = servicoFiscal.getConfig().ultimoNumeroNFe
      await supabase
        .from('empresas')
        .update({
          config_fiscal: {
            ...configFiscal,
            ultimo_numero_nfe: novoNumero,
          },
        })
        .eq('id', userData.empresa_id)

      // Salva nota no banco
      await supabase.from('notas_fiscais').insert({
        empresa_id: userData.empresa_id,
        tipo: 'nfe',
        serie: configFiscal.serie_nfe || 1,
        numero: novoNumero,
        chave: resultado.chave,
        protocolo: resultado.protocolo,
        xml: resultado.xml,
        status: 'autorizada',
        valor_total: valorTotal,
        emitida_em: new Date().toISOString(),
      })
    }

    return NextResponse.json(resultado)
  } catch (error: any) {
    console.error('Erro ao emitir NF-e:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno' },
      { status: 500 }
    )
  }
}
