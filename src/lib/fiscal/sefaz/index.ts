import axios, { AxiosError } from 'axios'
import * as https from 'https'
import { XMLParser } from 'fast-xml-parser'
import { CertificadoA1 } from '../certificate'
import { RetornoSEFAZ, WEBSERVICES_SEFAZ, CODIGOS_UF } from '../types'
import { gerarLoteEnvio } from '../xml/generator'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
})

/**
 * Envia NF-e/NFC-e para a SEFAZ
 */
export async function enviarParaSEFAZ(params: {
  xmlAssinado: string
  certificado: CertificadoA1
  uf: string
  ambiente: 1 | 2
  modelo: '55' | '65'
}): Promise<RetornoSEFAZ> {
  const { xmlAssinado, certificado, uf, ambiente, modelo } = params

  // Determina o webservice
  const ambienteStr = ambiente === 1 ? 'producao' : 'homologacao'
  const servico = modelo === '65' ? 'NfceAutorizacao' : 'NfeAutorizacao'

  const webservices = WEBSERVICES_SEFAZ[uf]?.[ambienteStr]
  if (!webservices) {
    throw new Error(`Webservices não configurados para ${uf} em ${ambienteStr}`)
  }

  const url = webservices[servico]
  if (!url) {
    throw new Error(`Serviço ${servico} não encontrado`)
  }

  // Gera ID do lote (timestamp)
  const idLote = Date.now().toString().slice(-15)

  // Gera lote de envio
  const loteXML = gerarLoteEnvio(xmlAssinado, idLote)

  // Envelope SOAP
  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
      ${loteXML}
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`

  try {
    // Configura agente HTTPS com certificado
    const httpsAgent = new https.Agent({
      cert: certificado.pem.cert,
      key: certificado.pem.key,
      rejectUnauthorized: true,
    })

    // Envia requisição SOAP
    const response = await axios.post(url, soapEnvelope, {
      httpsAgent,
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote',
      },
      timeout: 60000, // 60 segundos
    })

    // Processa resposta
    return processarRespostaSEFAZ(response.data)
  } catch (error) {
    if (error instanceof AxiosError) {
      return {
        sucesso: false,
        codigo: 'ERRO_CONEXAO',
        mensagem: `Erro de conexão: ${error.message}`,
      }
    }
    throw error
  }
}

/**
 * Processa a resposta da SEFAZ
 */
function processarRespostaSEFAZ(xmlResposta: string): RetornoSEFAZ {
  try {
    const parsed = parser.parse(xmlResposta)

    // Navega na estrutura SOAP
    const body = parsed['soap:Envelope']?.['soap:Body'] ||
                 parsed['Envelope']?.['Body'] ||
                 parsed

    const retorno = body?.nfeResultMsg?.retEnviNFe ||
                    body?.retEnviNFe ||
                    {}

    const cStat = retorno.cStat || retorno.protNFe?.infProt?.cStat
    const xMotivo = retorno.xMotivo || retorno.protNFe?.infProt?.xMotivo

    // Códigos de sucesso: 100 (Autorizado), 104 (Lote processado)
    const sucesso = ['100', '104'].includes(cStat?.toString())

    const protocolo = retorno.protNFe?.infProt?.nProt
    const chave = retorno.protNFe?.infProt?.chNFe
    const dataRecebimento = retorno.protNFe?.infProt?.dhRecbto

    return {
      sucesso,
      codigo: cStat?.toString() || 'ERRO',
      mensagem: xMotivo || 'Resposta não reconhecida',
      protocolo,
      chave,
      xml: xmlResposta,
      dataRecebimento: dataRecebimento ? new Date(dataRecebimento) : undefined,
    }
  } catch (error: any) {
    return {
      sucesso: false,
      codigo: 'ERRO_PARSE',
      mensagem: `Erro ao processar resposta: ${error.message}`,
      xml: xmlResposta,
    }
  }
}

/**
 * Consulta status do serviço SEFAZ
 */
export async function consultarStatusSEFAZ(params: {
  certificado: CertificadoA1
  uf: string
  ambiente: 1 | 2
  modelo: '55' | '65'
}): Promise<{ online: boolean; mensagem: string }> {
  const { certificado, uf, ambiente, modelo } = params

  const ambienteStr = ambiente === 1 ? 'producao' : 'homologacao'
  const servico = modelo === '65' ? 'NfceStatusServico' : 'NfeStatusServico'

  const webservices = WEBSERVICES_SEFAZ[uf]?.[ambienteStr]
  if (!webservices) {
    return { online: false, mensagem: `Webservices não configurados para ${uf}` }
  }

  const url = webservices[servico]
  if (!url) {
    return { online: false, mensagem: `Serviço ${servico} não encontrado` }
  }

  // Obtém código da UF
  const cUF = CODIGOS_UF[uf] || '42' // Default SC

  // XML de consulta de status (sem declaração XML pois será embutido no SOAP)
  const consStatServ = `<consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>${ambiente}</tpAmb><cUF>${cUF}</cUF><xServ>STATUS</xServ></consStatServ>`

  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">${consStatServ}</nfeDadosMsg></soap12:Body></soap12:Envelope>`

  try {
    // Configura agente HTTPS com certificado client-side (mTLS)
    const httpsAgent = new https.Agent({
      cert: certificado.pem.cert,
      key: certificado.pem.key,
      rejectUnauthorized: false, // Permite certificados auto-assinados da SEFAZ
      secureProtocol: 'TLSv1_2_method',
    })

    console.log(`[SEFAZ] Consultando status: ${url}`)
    console.log(`[SEFAZ] Ambiente: ${ambiente === 1 ? 'Produção' : 'Homologação'}, UF: ${uf}, cUF: ${cUF}`)

    const response = await axios.post(url, soapEnvelope, {
      httpsAgent,
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF"',
        'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF',
        'Accept': '*/*',
      },
      timeout: 30000,
      maxRedirects: 5,
    })

    console.log(`[SEFAZ] Resposta recebida: ${response.status}`)

    const parsed = parser.parse(response.data)
    const retConsStatServ = parsed?.['soap:Envelope']?.['soap:Body']?.nfeResultMsg?.retConsStatServ ||
                            parsed?.['soap12:Envelope']?.['soap12:Body']?.nfeResultMsg?.retConsStatServ ||
                            parsed?.Envelope?.Body?.nfeResultMsg?.retConsStatServ ||
                            {}

    const cStat = retConsStatServ.cStat
    const xMotivo = retConsStatServ.xMotivo

    console.log(`[SEFAZ] Status: ${cStat} - ${xMotivo}`)

    return {
      online: cStat === '107' || cStat === 107, // 107 = Serviço em operação
      mensagem: xMotivo || 'Status desconhecido',
    }
  } catch (error: any) {
    console.error(`[SEFAZ] Erro:`, error.message)
    if (error.code) console.error(`[SEFAZ] Código erro:`, error.code)
    if (error.response) console.error(`[SEFAZ] Resposta:`, error.response.status, error.response.data)

    let mensagem = error.message
    if (error.code === 'ECONNREFUSED') {
      mensagem = 'Conexão recusada pela SEFAZ'
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT') {
      mensagem = 'Timeout na conexão com SEFAZ'
    } else if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
      mensagem = 'Erro de certificado SSL'
    } else if (error.code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
      mensagem = 'Certificado SSL inválido'
    }

    return {
      online: false,
      mensagem: `Erro: ${mensagem}`,
    }
  }
}

/**
 * Consulta NF-e por chave de acesso
 */
export async function consultarNFePorChave(params: {
  chave: string
  certificado: CertificadoA1
  uf: string
  ambiente: 1 | 2
  modelo: '55' | '65'
}): Promise<RetornoSEFAZ> {
  const { chave, certificado, uf, ambiente, modelo } = params

  const ambienteStr = ambiente === 1 ? 'producao' : 'homologacao'
  const servico = modelo === '65' ? 'NfceConsultaProtocolo' : 'NfeConsultaProtocolo'

  const webservices = WEBSERVICES_SEFAZ[uf]?.[ambienteStr]
  if (!webservices) {
    throw new Error(`Webservices não configurados para ${uf}`)
  }

  const url = webservices[servico]
  if (!url) {
    throw new Error(`Serviço ${servico} não encontrado`)
  }

  const consSitNFe = `<?xml version="1.0" encoding="UTF-8"?>
<consSitNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <tpAmb>${ambiente}</tpAmb>
  <xServ>CONSULTAR</xServ>
  <chNFe>${chave}</chNFe>
</consSitNFe>`

  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4">
      ${consSitNFe}
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`

  try {
    const httpsAgent = new https.Agent({
      cert: certificado.pem.cert,
      key: certificado.pem.key,
      rejectUnauthorized: true,
    })

    const response = await axios.post(url, soapEnvelope, {
      httpsAgent,
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
      },
      timeout: 30000,
    })

    return processarRespostaSEFAZ(response.data)
  } catch (error: any) {
    return {
      sucesso: false,
      codigo: 'ERRO_CONEXAO',
      mensagem: `Erro de conexão: ${error.message}`,
    }
  }
}

/**
 * Cancela NF-e
 */
export async function cancelarNFe(params: {
  chave: string
  protocolo: string
  justificativa: string
  certificado: CertificadoA1
  uf: string
  ambiente: 1 | 2
  cnpj: string
}): Promise<RetornoSEFAZ> {
  const { chave, protocolo, justificativa, certificado, uf, ambiente, cnpj } = params

  if (justificativa.length < 15) {
    return {
      sucesso: false,
      codigo: 'ERRO_VALIDACAO',
      mensagem: 'Justificativa deve ter no mínimo 15 caracteres',
    }
  }

  const ambienteStr = ambiente === 1 ? 'producao' : 'homologacao'
  const webservices = WEBSERVICES_SEFAZ[uf]?.[ambienteStr]
  if (!webservices) {
    throw new Error(`Webservices não configurados para ${uf}`)
  }

  const url = webservices['NfeCancelamento']
  if (!url) {
    throw new Error('Serviço de cancelamento não encontrado')
  }

  const dataEvento = new Date().toISOString()
  const idEvento = `ID110111${chave}01`
  const nSeqEvento = '1'

  const evento = `<?xml version="1.0" encoding="UTF-8"?>
<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">
  <idLote>${Date.now()}</idLote>
  <evento versao="1.00">
    <infEvento Id="${idEvento}">
      <cOrgao>42</cOrgao>
      <tpAmb>${ambiente}</tpAmb>
      <CNPJ>${cnpj.replace(/\D/g, '')}</CNPJ>
      <chNFe>${chave}</chNFe>
      <dhEvento>${dataEvento}</dhEvento>
      <tpEvento>110111</tpEvento>
      <nSeqEvento>${nSeqEvento}</nSeqEvento>
      <verEvento>1.00</verEvento>
      <detEvento versao="1.00">
        <descEvento>Cancelamento</descEvento>
        <nProt>${protocolo}</nProt>
        <xJust>${justificativa}</xJust>
      </detEvento>
    </infEvento>
  </evento>
</envEvento>`

  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">
      ${evento}
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`

  try {
    const httpsAgent = new https.Agent({
      cert: certificado.pem.cert,
      key: certificado.pem.key,
      rejectUnauthorized: true,
    })

    const response = await axios.post(url, soapEnvelope, {
      httpsAgent,
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
      },
      timeout: 60000,
    })

    const parsed = parser.parse(response.data)
    const retEvento = parsed?.['soap:Envelope']?.['soap:Body']?.nfeResultMsg?.retEnvEvento ||
                      {}

    const cStat = retEvento.retEvento?.infEvento?.cStat
    const xMotivo = retEvento.retEvento?.infEvento?.xMotivo

    return {
      sucesso: cStat === '135', // 135 = Evento registrado e vinculado a NF-e
      codigo: cStat?.toString() || 'ERRO',
      mensagem: xMotivo || 'Resposta não reconhecida',
      xml: response.data,
    }
  } catch (error: any) {
    return {
      sucesso: false,
      codigo: 'ERRO_CONEXAO',
      mensagem: `Erro de conexão: ${error.message}`,
    }
  }
}
