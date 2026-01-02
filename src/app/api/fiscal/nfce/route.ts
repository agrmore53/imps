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

    // Dados da venda
    const body = await request.json()
    const { produtos, pagamentos, cliente, valorTotal, valorDesconto, informacoesAdicionais } = body

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
      ambiente: configFiscal.ambiente || 2, // 2=Homologação por padrão
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

    // Prepara produtos para NFC-e
    const produtosNFCe = produtos.map((p: any) => ({
      codigo: p.codigo,
      cEAN: p.codigo_barras || 'SEM GTIN',
      descricao: p.nome,
      ncm: p.ncm || '00000000',
      cfop: configFiscal.cfop_venda || '5102',
      unidade: p.unidade || 'UN',
      quantidade: p.quantidade,
      valorUnitario: p.preco_unitario,
      valorTotal: p.total,
      icms: {
        origem: 0,
        cst: '00',
      },
      pis: { cst: '07' },
      cofins: { cst: '07' },
    }))

    // Prepara pagamentos
    const pagamentosNFCe = pagamentos.map((pag: any) => ({
      forma: pag.forma || '01',
      valor: pag.valor,
      bandeira: pag.bandeira,
    }))

    // Prepara destinatário (opcional)
    let destinatario
    if (cliente && cliente.cpf_cnpj) {
      destinatario = {
        cpfCnpj: cliente.cpf_cnpj,
        nome: cliente.nome,
        email: cliente.email,
      }
    }

    // Emite NFC-e
    const resultado = await servicoFiscal.emitirNFCe({
      dataEmissao: new Date(),
      empresa: empresaFiscal,
      destinatario,
      produtos: produtosNFCe,
      pagamentos: pagamentosNFCe,
      valorTotal,
      valorDesconto,
      informacoesAdicionais,
    })

    if (resultado.sucesso) {
      // Atualiza último número no banco
      const novoNumero = servicoFiscal.getConfig().ultimoNumeroNFCe
      await supabase
        .from('empresas')
        .update({
          config_fiscal: {
            ...configFiscal,
            ultimo_numero_nfce: novoNumero,
          },
        })
        .eq('id', userData.empresa_id)

      // Salva nota no banco
      await supabase.from('notas_fiscais').insert({
        empresa_id: userData.empresa_id,
        tipo: 'nfce',
        serie: configFiscal.serie_nfce || 1,
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
    console.error('Erro ao emitir NFC-e:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno' },
      { status: 500 }
    )
  }
}
