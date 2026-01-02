import { create } from 'xmlbuilder2'
import { NFCeData, NFeData, CODIGOS_UF } from '../types'
import {
  gerarChaveAcesso,
  gerarCodigoNumerico,
  formatarDataSEFAZ,
  formatarValor,
  truncar,
  gerarURLQRCode,
} from '../utils'

const VERSAO_NFE = '4.00'

/**
 * Gera XML de NFC-e
 */
export function gerarXMLNFCe(dados: NFCeData): { xml: string; chave: string } {
  const codigoNumerico = gerarCodigoNumerico()

  // Gera chave de acesso
  const chave = gerarChaveAcesso({
    uf: dados.empresa.endereco.uf,
    dataEmissao: dados.dataEmissao,
    cnpj: dados.empresa.cnpj,
    modelo: '65',
    serie: dados.serie,
    numero: dados.numero,
    tipoEmissao: 1,
    codigoNumerico,
  })

  // Gera QR Code
  const urlQRCode = gerarURLQRCode({
    chave,
    ambiente: dados.ambiente,
    csc: dados.csc,
    idToken: dados.idToken,
  })

  // URL de consulta
  const urlConsulta = dados.ambiente === 1
    ? 'https://sat.sef.sc.gov.br/nfce/consulta'
    : 'https://sat-h.sef.sc.gov.br/nfce/consulta'

  const xml = gerarXMLBase({
    ...dados,
    chave,
    codigoNumerico,
    modelo: '65',
    urlQRCode,
    urlConsulta,
  })

  return { xml, chave }
}

/**
 * Gera XML de NF-e
 */
export function gerarXMLNFe(dados: NFeData): { xml: string; chave: string } {
  const codigoNumerico = gerarCodigoNumerico()

  // Gera chave de acesso
  const chave = gerarChaveAcesso({
    uf: dados.empresa.endereco.uf,
    dataEmissao: dados.dataEmissao,
    cnpj: dados.empresa.cnpj,
    modelo: '55',
    serie: dados.serie,
    numero: dados.numero,
    tipoEmissao: 1,
    codigoNumerico,
  })

  const xml = gerarXMLBase({
    ...dados,
    chave,
    codigoNumerico,
    modelo: '55',
  })

  return { xml, chave }
}

/**
 * Gera XML base (comum para NFC-e e NF-e)
 */
function gerarXMLBase(dados: any): string {
  const isNFCe = dados.modelo === '65'
  const cUF = CODIGOS_UF[dados.empresa.endereco.uf] || '42'

  const doc = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('NFe', { xmlns: 'http://www.portalfiscal.inf.br/nfe' })
    .ele('infNFe', {
      versao: VERSAO_NFE,
      Id: `NFe${dados.chave}`,
    })

  // Identificação (ide)
  const ide = doc.ele('ide')
  ide.ele('cUF').txt(cUF)
  ide.ele('cNF').txt(dados.codigoNumerico.toString().padStart(8, '0'))
  ide.ele('natOp').txt(truncar(dados.naturezaOperacao || 'VENDA', 60))
  ide.ele('mod').txt(dados.modelo)
  ide.ele('serie').txt(dados.serie.toString())
  ide.ele('nNF').txt(dados.numero.toString())
  ide.ele('dhEmi').txt(formatarDataSEFAZ(dados.dataEmissao))
  ide.ele('tpNF').txt('1') // 1=Saída
  ide.ele('idDest').txt(isNFCe ? '1' : '1') // 1=Operação interna
  ide.ele('cMunFG').txt(dados.empresa.endereco.codigoMunicipio)
  ide.ele('tpImp').txt(isNFCe ? '4' : '1') // 4=DANFCE, 1=DANFE retrato
  ide.ele('tpEmis').txt('1') // 1=Emissão normal
  ide.ele('cDV').txt(dados.chave.slice(-1))
  ide.ele('tpAmb').txt(dados.ambiente.toString())
  ide.ele('finNFe').txt(dados.finalidade?.toString() || '1')
  ide.ele('indFinal').txt(isNFCe ? '1' : (dados.consumidorFinal?.toString() || '1'))
  ide.ele('indPres').txt(isNFCe ? '1' : (dados.presenca?.toString() || '1'))
  ide.ele('procEmi').txt('0') // 0=Aplicativo do contribuinte
  ide.ele('verProc').txt('IMPERIO-1.0')

  // Emitente (emit)
  const emit = doc.ele('emit')
  emit.ele('CNPJ').txt(dados.empresa.cnpj.replace(/\D/g, ''))
  emit.ele('xNome').txt(truncar(dados.empresa.razaoSocial, 60))
  if (dados.empresa.nomeFantasia) {
    emit.ele('xFant').txt(truncar(dados.empresa.nomeFantasia, 60))
  }

  const enderEmit = emit.ele('enderEmit')
  enderEmit.ele('xLgr').txt(truncar(dados.empresa.endereco.logradouro, 60))
  enderEmit.ele('nro').txt(truncar(dados.empresa.endereco.numero, 60))
  if (dados.empresa.endereco.complemento) {
    enderEmit.ele('xCpl').txt(truncar(dados.empresa.endereco.complemento, 60))
  }
  enderEmit.ele('xBairro').txt(truncar(dados.empresa.endereco.bairro, 60))
  enderEmit.ele('cMun').txt(dados.empresa.endereco.codigoMunicipio)
  enderEmit.ele('xMun').txt(truncar(dados.empresa.endereco.nomeMunicipio, 60))
  enderEmit.ele('UF').txt(dados.empresa.endereco.uf)
  enderEmit.ele('CEP').txt(dados.empresa.endereco.cep.replace(/\D/g, ''))
  enderEmit.ele('cPais').txt('1058')
  enderEmit.ele('xPais').txt('BRASIL')
  if (dados.empresa.endereco.telefone) {
    enderEmit.ele('fone').txt(dados.empresa.endereco.telefone.replace(/\D/g, ''))
  }

  emit.ele('IE').txt(dados.empresa.inscricaoEstadual.replace(/\D/g, ''))
  emit.ele('CRT').txt(dados.empresa.crt.toString())

  // Destinatário (dest) - opcional para NFC-e
  if (dados.destinatario) {
    const dest = doc.ele('dest')
    const cpfCnpj = dados.destinatario.cpfCnpj.replace(/\D/g, '')
    if (cpfCnpj.length === 11) {
      dest.ele('CPF').txt(cpfCnpj)
    } else {
      dest.ele('CNPJ').txt(cpfCnpj)
    }
    dest.ele('xNome').txt(truncar(dados.destinatario.nome, 60))

    if (dados.destinatario.endereco) {
      const enderDest = dest.ele('enderDest')
      enderDest.ele('xLgr').txt(truncar(dados.destinatario.endereco.logradouro, 60))
      enderDest.ele('nro').txt(truncar(dados.destinatario.endereco.numero, 60))
      if (dados.destinatario.endereco.complemento) {
        enderDest.ele('xCpl').txt(truncar(dados.destinatario.endereco.complemento, 60))
      }
      enderDest.ele('xBairro').txt(truncar(dados.destinatario.endereco.bairro, 60))
      enderDest.ele('cMun').txt(dados.destinatario.endereco.codigoMunicipio)
      enderDest.ele('xMun').txt(truncar(dados.destinatario.endereco.nomeMunicipio, 60))
      enderDest.ele('UF').txt(dados.destinatario.endereco.uf)
      enderDest.ele('CEP').txt(dados.destinatario.endereco.cep.replace(/\D/g, ''))
      enderDest.ele('cPais').txt('1058')
      enderDest.ele('xPais').txt('BRASIL')
    }

    dest.ele('indIEDest').txt('9') // 9=Não contribuinte

    if (dados.destinatario.email) {
      dest.ele('email').txt(truncar(dados.destinatario.email, 60))
    }
  }

  // Produtos (det)
  let totalProdutos = 0
  let totalDesconto = 0
  let totalICMS = 0

  dados.produtos.forEach((prod: any, index: number) => {
    const det = doc.ele('det', { nItem: (index + 1).toString() })

    const prodNode = det.ele('prod')
    prodNode.ele('cProd').txt(truncar(prod.codigo, 60))
    prodNode.ele('cEAN').txt(prod.cEAN || 'SEM GTIN')
    prodNode.ele('xProd').txt(truncar(prod.descricao, 120))
    prodNode.ele('NCM').txt(prod.ncm.replace(/\D/g, ''))
    prodNode.ele('CFOP').txt(prod.cfop)
    prodNode.ele('uCom').txt(prod.unidade)
    prodNode.ele('qCom').txt(formatarValor(prod.quantidade, 4))
    prodNode.ele('vUnCom').txt(formatarValor(prod.valorUnitario, 10))
    prodNode.ele('vProd').txt(formatarValor(prod.valorTotal, 2))
    prodNode.ele('cEANTrib').txt(prod.cEAN || 'SEM GTIN')
    prodNode.ele('uTrib').txt(prod.unidade)
    prodNode.ele('qTrib').txt(formatarValor(prod.quantidade, 4))
    prodNode.ele('vUnTrib').txt(formatarValor(prod.valorUnitario, 10))
    prodNode.ele('indTot').txt('1')

    totalProdutos += prod.valorTotal

    // Impostos
    const imposto = det.ele('imposto')

    // ICMS
    const icms = imposto.ele('ICMS')

    // Para Simples Nacional, usar ICMSSN
    if (dados.empresa.crt === 1) {
      const icmssn = icms.ele('ICMSSN102')
      icmssn.ele('orig').txt(prod.icms.origem.toString())
      icmssn.ele('CSOSN').txt('102') // Simples sem crédito
    } else {
      const icms00 = icms.ele('ICMS00')
      icms00.ele('orig').txt(prod.icms.origem.toString())
      icms00.ele('CST').txt(prod.icms.cst || '00')
      icms00.ele('modBC').txt('0')
      icms00.ele('vBC').txt(formatarValor(prod.icms.valorBase || prod.valorTotal, 2))
      icms00.ele('pICMS').txt(formatarValor(prod.icms.aliquota || 0, 2))
      icms00.ele('vICMS').txt(formatarValor(prod.icms.valor || 0, 2))
      totalICMS += prod.icms.valor || 0
    }

    // PIS
    const pis = imposto.ele('PIS')
    const pisnt = pis.ele('PISNT')
    pisnt.ele('CST').txt(prod.pis.cst || '07')

    // COFINS
    const cofins = imposto.ele('COFINS')
    const cofinsnt = cofins.ele('COFINSNT')
    cofinsnt.ele('CST').txt(prod.cofins.cst || '07')
  })

  // Totais
  const total = doc.ele('total')
  const icmsTot = total.ele('ICMSTot')
  icmsTot.ele('vBC').txt(formatarValor(0, 2))
  icmsTot.ele('vICMS').txt(formatarValor(totalICMS, 2))
  icmsTot.ele('vICMSDeson').txt('0.00')
  icmsTot.ele('vFCPUFDest').txt('0.00')
  icmsTot.ele('vICMSUFDest').txt('0.00')
  icmsTot.ele('vICMSUFRemet').txt('0.00')
  icmsTot.ele('vFCP').txt('0.00')
  icmsTot.ele('vBCST').txt('0.00')
  icmsTot.ele('vST').txt('0.00')
  icmsTot.ele('vFCPST').txt('0.00')
  icmsTot.ele('vFCPSTRet').txt('0.00')
  icmsTot.ele('vProd').txt(formatarValor(totalProdutos, 2))
  icmsTot.ele('vFrete').txt(formatarValor(dados.valorFrete || 0, 2))
  icmsTot.ele('vSeg').txt(formatarValor(dados.valorSeguro || 0, 2))
  icmsTot.ele('vDesc').txt(formatarValor(dados.valorDesconto || 0, 2))
  icmsTot.ele('vII').txt('0.00')
  icmsTot.ele('vIPI').txt('0.00')
  icmsTot.ele('vIPIDevol').txt('0.00')
  icmsTot.ele('vPIS').txt('0.00')
  icmsTot.ele('vCOFINS').txt('0.00')
  icmsTot.ele('vOutro').txt(formatarValor(dados.valorOutros || 0, 2))
  icmsTot.ele('vNF').txt(formatarValor(dados.valorTotal, 2))

  // Transporte
  const transp = doc.ele('transp')
  transp.ele('modFrete').txt('9') // 9=Sem frete

  // Pagamento
  const pag = doc.ele('pag')
  dados.pagamentos.forEach((pgto: any) => {
    const detPag = pag.ele('detPag')
    detPag.ele('tPag').txt(pgto.forma)
    detPag.ele('vPag').txt(formatarValor(pgto.valor, 2))

    if (['03', '04'].includes(pgto.forma)) {
      const card = detPag.ele('card')
      card.ele('tpIntegra').txt('2') // 2=Não integrado
      if (pgto.cnpjCredenciadora) {
        card.ele('CNPJ').txt(pgto.cnpjCredenciadora.replace(/\D/g, ''))
      }
      if (pgto.bandeira) {
        card.ele('tBand').txt(pgto.bandeira)
      }
      if (pgto.autorizacao) {
        card.ele('cAut').txt(pgto.autorizacao)
      }
    }
  })

  // Informações adicionais
  if (dados.informacoesAdicionais) {
    const infAdic = doc.ele('infAdic')
    infAdic.ele('infCpl').txt(truncar(dados.informacoesAdicionais, 5000))
  }

  // NFC-e: QR Code
  if (isNFCe && dados.urlQRCode) {
    const infNFeSupl = doc.up().ele('infNFeSupl')
    infNFeSupl.ele('qrCode').txt(`<![CDATA[${dados.urlQRCode}]]>`)
    infNFeSupl.ele('urlChave').txt(dados.urlConsulta)
  }

  return doc.end({ prettyPrint: false })
}

/**
 * Gera envelope SOAP para envio à SEFAZ
 */
export function gerarEnvelopeSOAP(xmlAssinado: string, servico: string): string {
  const envelope = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('soap12:Envelope', {
      'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
      'xmlns:soap12': 'http://www.w3.org/2003/05/soap-envelope',
    })
    .ele('soap12:Body')
    .ele('nfeDadosMsg', { xmlns: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4' })
    .dat(xmlAssinado)

  return envelope.end({ prettyPrint: false })
}

/**
 * Gera lote para envio
 */
export function gerarLoteEnvio(xmlAssinado: string, idLote: string): string {
  const lote = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('enviNFe', {
      xmlns: 'http://www.portalfiscal.inf.br/nfe',
      versao: VERSAO_NFE,
    })
    .ele('idLote').txt(idLote).up()
    .ele('indSinc').txt('1').up() // 1=Síncrono
    .dat(xmlAssinado)

  return lote.end({ prettyPrint: false })
}
