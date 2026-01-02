import * as crypto from 'crypto'
import { SignedXml } from 'xml-crypto'
import { CertificadoA1 } from '../certificate'

/**
 * Assina o XML da NF-e/NFC-e usando o certificado A1
 */
export function assinarXML(xml: string, certificado: CertificadoA1): string {
  // Extrai o ID do elemento infNFe para referenciar na assinatura
  const idMatch = xml.match(/Id="(NFe\d+)"/)
  if (!idMatch) {
    throw new Error('ID da NF-e não encontrado no XML')
  }
  const referenceId = idMatch[1]

  // Configurações do SignedXml
  const sig = new SignedXml({
    privateKey: certificado.pem.key,
    publicCert: certificado.pem.cert,
    signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
    canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
  })

  // Adiciona referência ao elemento infNFe
  sig.addReference({
    xpath: `//*[@Id='${referenceId}']`,
    digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    ],
  })

  // Define onde inserir a assinatura
  sig.computeSignature(xml, {
    location: {
      reference: `//*[local-name()='infNFe']`,
      action: 'after',
    },
  })

  return sig.getSignedXml()
}

/**
 * Classe customizada para gerar KeyInfo com X509Certificate
 */
class KeyInfoProvider {
  private cert: string

  constructor(cert: string) {
    this.cert = cert
  }

  getKeyInfo(): string {
    // Remove headers do PEM e quebras de linha
    const certBase64 = this.cert
      .replace('-----BEGIN CERTIFICATE-----', '')
      .replace('-----END CERTIFICATE-----', '')
      .replace(/\s/g, '')

    return `<X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data>`
  }
}

/**
 * Assina XML manualmente (alternativa se xml-crypto der problemas)
 */
export function assinarXMLManual(xml: string, certificado: CertificadoA1): string {
  // Encontra o elemento infNFe
  const infNFeMatch = xml.match(/<infNFe[^>]*>([\s\S]*?)<\/infNFe>/)
  if (!infNFeMatch) {
    throw new Error('Elemento infNFe não encontrado')
  }

  const infNFe = infNFeMatch[0]
  const idMatch = xml.match(/Id="(NFe\d+)"/)
  if (!idMatch) {
    throw new Error('ID não encontrado')
  }
  const id = idMatch[1]

  // Canoniza o elemento infNFe (C14N)
  const canonicalizedInfNFe = canonicalize(infNFe)

  // Calcula digest SHA-1
  const digestValue = crypto
    .createHash('sha1')
    .update(canonicalizedInfNFe, 'utf8')
    .digest('base64')

  // Monta SignedInfo
  const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><Reference URI="#${id}"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`

  // Canoniza SignedInfo
  const canonicalizedSignedInfo = canonicalize(signedInfo)

  // Assina com RSA-SHA1
  const sign = crypto.createSign('RSA-SHA1')
  sign.update(canonicalizedSignedInfo, 'utf8')
  const signatureValue = sign.sign(certificado.pem.key, 'base64')

  // Extrai certificado em base64
  const certBase64 = certificado.pem.cert
    .replace('-----BEGIN CERTIFICATE-----', '')
    .replace('-----END CERTIFICATE-----', '')
    .replace(/\s/g, '')

  // Monta elemento Signature
  const signature = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfo}<SignatureValue>${signatureValue}</SignatureValue><KeyInfo><X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data></KeyInfo></Signature>`

  // Insere a assinatura após o fechamento de infNFe
  const xmlAssinado = xml.replace('</infNFe>', `</infNFe>${signature}`)

  return xmlAssinado
}

/**
 * Canonização simples (C14N)
 * Nota: Esta é uma implementação simplificada
 */
function canonicalize(xml: string): string {
  // Remove declaração XML
  let canonical = xml.replace(/<\?xml[^>]*\?>/, '')

  // Remove espaços extras entre elementos
  canonical = canonical.replace(/>\s+</g, '><')

  // Remove espaços no início e fim
  canonical = canonical.trim()

  // Normaliza atributos (ordem alfabética)
  // Esta é uma simplificação - uma implementação completa seria mais complexa
  canonical = canonical.replace(/<([^\s>]+)([^>]*)>/g, (match, tagName, attrs) => {
    if (!attrs.trim()) return match

    // Extrai atributos
    const attrRegex = /(\w+)="([^"]*)"/g
    const attrList: [string, string][] = []
    let attrMatch
    while ((attrMatch = attrRegex.exec(attrs)) !== null) {
      attrList.push([attrMatch[1], attrMatch[2]])
    }

    // Ordena por nome do atributo
    attrList.sort((a, b) => a[0].localeCompare(b[0]))

    // Reconstrói
    const sortedAttrs = attrList.map(([name, value]) => `${name}="${value}"`).join(' ')
    return `<${tagName}${sortedAttrs ? ' ' + sortedAttrs : ''}>`
  })

  return canonical
}

/**
 * Valida a assinatura de um XML
 */
export function validarAssinatura(xmlAssinado: string, certificado: CertificadoA1): boolean {
  try {
    const sig = new SignedXml()
    sig.publicCert = certificado.pem.cert

    // Encontra a assinatura no XML
    const signatureMatch = xmlAssinado.match(/<Signature[^>]*>[\s\S]*?<\/Signature>/)
    if (!signatureMatch) {
      return false
    }

    sig.loadSignature(signatureMatch[0])
    return sig.checkSignature(xmlAssinado)
  } catch {
    return false
  }
}
