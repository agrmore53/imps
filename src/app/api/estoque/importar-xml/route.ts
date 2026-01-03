import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Parser simples de XML para extrair dados da NF-e
function parseNFeXML(xmlString: string) {
  // Função auxiliar para extrair valor de uma tag
  const getTagValue = (xml: string, tagName: string): string => {
    const regex = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'i')
    const match = xml.match(regex)
    return match ? match[1].trim() : ''
  }

  // Função para extrair todos os elementos de uma tag
  const getAllElements = (xml: string, tagName: string): string[] => {
    const regex = new RegExp(`<${tagName}[^>]*>[\\s\\S]*?</${tagName}>`, 'gi')
    return xml.match(regex) || []
  }

  // Extrair dados do emitente (fornecedor)
  const emitMatch = xmlString.match(/<emit>([\s\S]*?)<\/emit>/i)
  const emitXml = emitMatch ? emitMatch[1] : ''

  const fornecedor = {
    cnpj: getTagValue(emitXml, 'CNPJ'),
    razao_social: getTagValue(emitXml, 'xNome'),
    nome_fantasia: getTagValue(emitXml, 'xFant') || getTagValue(emitXml, 'xNome'),
    ie: getTagValue(emitXml, 'IE'),
  }

  // Extrair dados da nota
  const ideMatch = xmlString.match(/<ide>([\s\S]*?)<\/ide>/i)
  const ideXml = ideMatch ? ideMatch[1] : ''

  const nota = {
    numero: getTagValue(ideXml, 'nNF'),
    serie: getTagValue(ideXml, 'serie'),
    data_emissao: getTagValue(ideXml, 'dhEmi') || getTagValue(ideXml, 'dEmi'),
    chave: '',
  }

  // Extrair chave de acesso
  const infNFeMatch = xmlString.match(/<infNFe[^>]*Id="NFe(\d{44})"[^>]*>/i)
  if (infNFeMatch) {
    nota.chave = infNFeMatch[1]
  }

  // Extrair produtos (itens)
  const detElements = getAllElements(xmlString, 'det')
  const produtos: Array<{
    numero_item: string
    codigo: string
    codigo_barras: string
    descricao: string
    ncm: string
    cfop: string
    unidade: string
    quantidade: number
    valor_unitario: number
    valor_total: number
  }> = []

  detElements.forEach((detXml) => {
    const prodMatch = detXml.match(/<prod>([\s\S]*?)<\/prod>/i)
    if (prodMatch) {
      const prodXml = prodMatch[1]

      // Extrair número do item
      const nItemMatch = detXml.match(/nItem="(\d+)"/i)
      const nItem = nItemMatch ? nItemMatch[1] : ''

      produtos.push({
        numero_item: nItem,
        codigo: getTagValue(prodXml, 'cProd'),
        codigo_barras: getTagValue(prodXml, 'cEAN') || getTagValue(prodXml, 'cEANTrib'),
        descricao: getTagValue(prodXml, 'xProd'),
        ncm: getTagValue(prodXml, 'NCM'),
        cfop: getTagValue(prodXml, 'CFOP'),
        unidade: getTagValue(prodXml, 'uCom') || getTagValue(prodXml, 'uTrib'),
        quantidade: parseFloat(getTagValue(prodXml, 'qCom') || getTagValue(prodXml, 'qTrib')) || 0,
        valor_unitario: parseFloat(getTagValue(prodXml, 'vUnCom') || getTagValue(prodXml, 'vUnTrib')) || 0,
        valor_total: parseFloat(getTagValue(prodXml, 'vProd')) || 0,
      })
    }
  })

  // Extrair totais
  const totalMatch = xmlString.match(/<total>([\s\S]*?)<\/total>/i)
  const totalXml = totalMatch ? totalMatch[1] : ''
  const icmsTotMatch = totalXml.match(/<ICMSTot>([\s\S]*?)<\/ICMSTot>/i)
  const icmsTotXml = icmsTotMatch ? icmsTotMatch[1] : ''

  const totais = {
    valor_produtos: parseFloat(getTagValue(icmsTotXml, 'vProd')) || 0,
    valor_frete: parseFloat(getTagValue(icmsTotXml, 'vFrete')) || 0,
    valor_desconto: parseFloat(getTagValue(icmsTotXml, 'vDesc')) || 0,
    valor_total: parseFloat(getTagValue(icmsTotXml, 'vNF')) || 0,
  }

  return {
    fornecedor,
    nota,
    produtos,
    totais,
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Buscar dados do usuário
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('id, empresa_id')
      .eq('auth_id', user.id)
      .single()

    if (!usuario) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('xml') as File
    const modo = formData.get('modo') as string // 'preview' ou 'importar'

    if (!file) {
      return NextResponse.json({ error: 'Arquivo XML não enviado' }, { status: 400 })
    }

    const xmlContent = await file.text()

    // Validar se é um XML de NF-e válido
    if (!xmlContent.includes('<nfeProc') && !xmlContent.includes('<NFe')) {
      return NextResponse.json({ error: 'Arquivo não é um XML de NF-e válido' }, { status: 400 })
    }

    // Parse do XML
    const dadosNFe = parseNFeXML(xmlContent)

    if (dadosNFe.produtos.length === 0) {
      return NextResponse.json({ error: 'Nenhum produto encontrado no XML' }, { status: 400 })
    }

    // Se for apenas preview, retornar os dados parseados
    if (modo === 'preview') {
      // Buscar produtos existentes para fazer matching
      const { data: produtosExistentes } = await supabase
        .from('produtos')
        .select('id, codigo, codigo_barras, nome')
        .eq('empresa_id', usuario.empresa_id)
        .eq('ativo', true)

      // Fazer matching de produtos
      const produtosComMatch = dadosNFe.produtos.map((prodXml) => {
        let produtoEncontrado = null

        // Tentar match por código de barras
        if (prodXml.codigo_barras && prodXml.codigo_barras !== 'SEM GTIN') {
          produtoEncontrado = produtosExistentes?.find(
            (p) => p.codigo_barras === prodXml.codigo_barras
          )
        }

        // Se não encontrou, tentar por código
        if (!produtoEncontrado && prodXml.codigo) {
          produtoEncontrado = produtosExistentes?.find(
            (p) => p.codigo === prodXml.codigo
          )
        }

        return {
          ...prodXml,
          produto_id: produtoEncontrado?.id || null,
          produto_nome: produtoEncontrado?.nome || null,
          status: produtoEncontrado ? 'encontrado' : 'nao_encontrado',
        }
      })

      return NextResponse.json({
        success: true,
        modo: 'preview',
        dados: {
          ...dadosNFe,
          produtos: produtosComMatch,
        },
      })
    }

    // Modo importar - processar a entrada de estoque
    const produtosParaImportar = JSON.parse(formData.get('produtos') as string || '[]')

    if (produtosParaImportar.length === 0) {
      return NextResponse.json({ error: 'Nenhum produto selecionado para importar' }, { status: 400 })
    }

    // Verificar/criar fornecedor
    let fornecedorId = null
    if (dadosNFe.fornecedor.cnpj) {
      const { data: fornecedorExistente } = await supabase
        .from('fornecedores')
        .select('id')
        .eq('empresa_id', usuario.empresa_id)
        .eq('cpf_cnpj', dadosNFe.fornecedor.cnpj)
        .single()

      if (fornecedorExistente) {
        fornecedorId = fornecedorExistente.id
      } else {
        // Criar fornecedor
        const { data: novoFornecedor } = await supabase
          .from('fornecedores')
          .insert({
            empresa_id: usuario.empresa_id,
            cpf_cnpj: dadosNFe.fornecedor.cnpj,
            razao_social: dadosNFe.fornecedor.razao_social,
            nome_fantasia: dadosNFe.fornecedor.nome_fantasia,
          })
          .select('id')
          .single()

        fornecedorId = novoFornecedor?.id
      }
    }

    // Processar cada produto
    const resultados: Array<{ produto: string; status: string; mensagem: string }> = []
    const documentoOrigem = `NF-e ${dadosNFe.nota.numero}/${dadosNFe.nota.serie}`

    for (const item of produtosParaImportar) {
      if (!item.produto_id) {
        resultados.push({
          produto: item.descricao,
          status: 'ignorado',
          mensagem: 'Produto não vinculado',
        })
        continue
      }

      // Criar movimento de entrada
      const { error: movError } = await supabase
        .from('estoque_movimentos')
        .insert({
          empresa_id: usuario.empresa_id,
          produto_id: item.produto_id,
          tipo: 'entrada',
          quantidade: item.quantidade,
          custo_unitario: item.valor_unitario,
          documento_origem: documentoOrigem,
          observacao: `Importação XML - ${dadosNFe.fornecedor.razao_social}`,
          usuario_id: usuario.id,
        })

      if (movError) {
        resultados.push({
          produto: item.descricao,
          status: 'erro',
          mensagem: movError.message,
        })
        continue
      }

      // Atualizar estoque do produto
      const { error: updateError } = await supabase.rpc('incrementar_estoque', {
        p_produto_id: item.produto_id,
        p_quantidade: item.quantidade,
        p_custo: item.valor_unitario,
      })

      // Se a RPC não existir, fazer update direto
      if (updateError) {
        await supabase
          .from('produtos')
          .update({
            estoque_atual: supabase.rpc('', {}), // Fallback
          })
          .eq('id', item.produto_id)

        // Update manual do estoque
        const { data: produtoAtual } = await supabase
          .from('produtos')
          .select('estoque_atual, preco_custo')
          .eq('id', item.produto_id)
          .single()

        if (produtoAtual) {
          await supabase
            .from('produtos')
            .update({
              estoque_atual: (produtoAtual.estoque_atual || 0) + item.quantidade,
              preco_custo: item.valor_unitario, // Atualiza custo
            })
            .eq('id', item.produto_id)
        }
      }

      resultados.push({
        produto: item.descricao,
        status: 'sucesso',
        mensagem: `+${item.quantidade} unidades`,
      })
    }

    // Criar conta a pagar (opcional)
    const criarContaPagar = formData.get('criar_conta_pagar') === 'true'
    if (criarContaPagar && fornecedorId && dadosNFe.totais.valor_total > 0) {
      const vencimento = new Date()
      vencimento.setDate(vencimento.getDate() + 30) // 30 dias

      await supabase
        .from('contas_pagar')
        .insert({
          empresa_id: usuario.empresa_id,
          fornecedor_id: fornecedorId,
          descricao: `NF-e ${dadosNFe.nota.numero} - ${dadosNFe.fornecedor.razao_social}`,
          valor: dadosNFe.totais.valor_total,
          vencimento: vencimento.toISOString().split('T')[0],
          status: 'pendente',
        })
    }

    return NextResponse.json({
      success: true,
      modo: 'importar',
      resultados,
      totais: {
        importados: resultados.filter((r) => r.status === 'sucesso').length,
        ignorados: resultados.filter((r) => r.status === 'ignorado').length,
        erros: resultados.filter((r) => r.status === 'erro').length,
      },
    })
  } catch (error) {
    console.error('Erro ao processar XML:', error)
    return NextResponse.json(
      { error: 'Erro ao processar XML: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
