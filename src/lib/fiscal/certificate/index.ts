import * as forge from 'node-forge'
import { CertificadoInfo } from '../types'

export interface CertificadoA1 {
  privateKey: forge.pki.PrivateKey
  certificate: forge.pki.Certificate
  pem: {
    key: string
    cert: string
  }
  info: CertificadoInfo
}

/**
 * Lê um certificado A1 (.pfx) e extrai as informações
 */
export function lerCertificadoA1(
  pfxBase64: string,
  senha: string
): CertificadoA1 {
  try {
    // Decodifica o PFX de base64
    const pfxDer = forge.util.decode64(pfxBase64)
    const pfxAsn1 = forge.asn1.fromDer(pfxDer)

    // Abre o PFX com a senha
    const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, senha)

    // Extrai a chave privada
    const keyBags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]

    if (!keyBag?.key) {
      throw new Error('Chave privada não encontrada no certificado')
    }

    const privateKey = keyBag.key

    // Extrai o certificado
    const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag })
    const certBag = certBags[forge.pki.oids.certBag]?.[0]

    if (!certBag?.cert) {
      throw new Error('Certificado não encontrado')
    }

    const certificate = certBag.cert

    // Converte para PEM
    const keyPem = forge.pki.privateKeyToPem(privateKey)
    const certPem = forge.pki.certificateToPem(certificate)

    // Extrai informações do certificado
    const info = extrairInfoCertificado(certificate)

    return {
      privateKey,
      certificate,
      pem: {
        key: keyPem,
        cert: certPem,
      },
      info,
    }
  } catch (error: any) {
    if (error.message?.includes('Invalid password')) {
      throw new Error('Senha do certificado inválida')
    }
    throw new Error(`Erro ao ler certificado: ${error.message}`)
  }
}

/**
 * Extrai informações do certificado
 */
function extrairInfoCertificado(cert: forge.pki.Certificate): CertificadoInfo {
  const subject = cert.subject.attributes
    .map(attr => `${attr.shortName}=${attr.value}`)
    .join(', ')

  const issuer = cert.issuer.attributes
    .map(attr => `${attr.shortName}=${attr.value}`)
    .join(', ')

  // Extrai o CNPJ do subject (formato: CN=EMPRESA:12345678000199)
  let cnpj = ''
  const cnAttr = cert.subject.getField('CN')
  if (cnAttr?.value) {
    const match = cnAttr.value.toString().match(/(\d{14})/)
    if (match) {
      cnpj = match[1]
    }
  }

  return {
    subject,
    issuer,
    validFrom: cert.validity.notBefore,
    validTo: cert.validity.notAfter,
    serialNumber: cert.serialNumber,
    cnpj,
  }
}

/**
 * Verifica se o certificado está válido (não expirado)
 */
export function certificadoValido(info: CertificadoInfo): {
  valido: boolean
  diasRestantes: number
  mensagem: string
} {
  const agora = new Date()
  const expiracao = new Date(info.validTo)
  const diasRestantes = Math.floor(
    (expiracao.getTime() - agora.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (agora < new Date(info.validFrom)) {
    return {
      valido: false,
      diasRestantes: 0,
      mensagem: 'Certificado ainda não está válido',
    }
  }

  if (agora > expiracao) {
    return {
      valido: false,
      diasRestantes: 0,
      mensagem: 'Certificado expirado',
    }
  }

  if (diasRestantes <= 30) {
    return {
      valido: true,
      diasRestantes,
      mensagem: `Certificado expira em ${diasRestantes} dias`,
    }
  }

  return {
    valido: true,
    diasRestantes,
    mensagem: 'Certificado válido',
  }
}

/**
 * Valida o certificado contra o CNPJ da empresa
 */
export function validarCertificadoEmpresa(
  info: CertificadoInfo,
  cnpjEmpresa: string
): boolean {
  const cnpjLimpo = cnpjEmpresa.replace(/\D/g, '')
  return info.cnpj === cnpjLimpo
}
