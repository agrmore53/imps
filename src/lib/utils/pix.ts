/**
 * Gerador de Payload PIX (padrão EMV)
 * Baseado na especificação do Banco Central do Brasil
 */

interface PixPayload {
  // Chave PIX (CPF, CNPJ, email, telefone ou chave aleatória)
  chavePix: string
  // Nome do beneficiário (máx 25 caracteres)
  beneficiario: string
  // Cidade do beneficiário (máx 15 caracteres)
  cidade: string
  // Valor da transação (opcional para QR estático)
  valor?: number
  // Identificador da transação (máx 25 caracteres, opcional)
  txid?: string
  // Descrição/mensagem (opcional)
  descricao?: string
}

// Função para calcular CRC16 (CCITT-FALSE)
function calcularCRC16(payload: string): string {
  const polinomio = 0x1021
  let resultado = 0xFFFF

  for (let i = 0; i < payload.length; i++) {
    resultado ^= payload.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      if ((resultado & 0x8000) !== 0) {
        resultado = (resultado << 1) ^ polinomio
      } else {
        resultado <<= 1
      }
    }
  }

  resultado &= 0xFFFF
  return resultado.toString(16).toUpperCase().padStart(4, '0')
}

// Função para criar um campo EMV
function emvField(id: string, value: string): string {
  const length = value.length.toString().padStart(2, '0')
  return `${id}${length}${value}`
}

// Gera o payload PIX no formato EMV
export function gerarPayloadPix(dados: PixPayload): string {
  // Limitar tamanhos conforme especificação
  const beneficiario = dados.beneficiario.substring(0, 25).toUpperCase()
  const cidade = dados.cidade.substring(0, 15).toUpperCase()
  const txid = dados.txid?.substring(0, 25) || '***'

  // Formatar valor (2 casas decimais, sem separador de milhar)
  let valorFormatado = ''
  if (dados.valor && dados.valor > 0) {
    valorFormatado = dados.valor.toFixed(2)
  }

  // Construir o Merchant Account Information (campo 26)
  // 00 = GUI (br.gov.bcb.pix)
  // 01 = Chave PIX
  // 02 = Descrição (opcional)
  let merchantAccountInfo = emvField('00', 'br.gov.bcb.pix')
  merchantAccountInfo += emvField('01', dados.chavePix)
  if (dados.descricao) {
    merchantAccountInfo += emvField('02', dados.descricao.substring(0, 72))
  }

  // Construir Additional Data Field (campo 62)
  // 05 = Reference Label (TXID)
  const additionalDataField = emvField('05', txid)

  // Montar payload
  let payload = ''

  // 00 - Payload Format Indicator
  payload += emvField('00', '01')

  // 26 - Merchant Account Information (PIX)
  payload += emvField('26', merchantAccountInfo)

  // 52 - Merchant Category Code (0000 = não especificado)
  payload += emvField('52', '0000')

  // 53 - Transaction Currency (986 = BRL)
  payload += emvField('53', '986')

  // 54 - Transaction Amount (se especificado)
  if (valorFormatado) {
    payload += emvField('54', valorFormatado)
  }

  // 58 - Country Code
  payload += emvField('58', 'BR')

  // 59 - Merchant Name
  payload += emvField('59', beneficiario)

  // 60 - Merchant City
  payload += emvField('60', cidade)

  // 62 - Additional Data Field
  payload += emvField('62', additionalDataField)

  // 63 - CRC16 (placeholder para cálculo)
  payload += '6304'

  // Calcular e adicionar CRC16
  const crc = calcularCRC16(payload)
  payload = payload.slice(0, -4) + crc

  return payload
}

// Formatar chave PIX para exibição
export function formatarChavePix(chave: string): { tipo: string; formatada: string } {
  // Remove espaços e caracteres especiais para análise
  const limpa = chave.replace(/\s/g, '')

  // Detectar tipo de chave
  if (/^\d{11}$/.test(limpa)) {
    // CPF
    return {
      tipo: 'CPF',
      formatada: limpa.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'),
    }
  } else if (/^\d{14}$/.test(limpa)) {
    // CNPJ
    return {
      tipo: 'CNPJ',
      formatada: limpa.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'),
    }
  } else if (/^\+55\d{10,11}$/.test(limpa) || /^55\d{10,11}$/.test(limpa)) {
    // Telefone
    const tel = limpa.startsWith('+') ? limpa : '+' + limpa
    return {
      tipo: 'Telefone',
      formatada: tel,
    }
  } else if (limpa.includes('@')) {
    // Email
    return {
      tipo: 'Email',
      formatada: limpa.toLowerCase(),
    }
  } else if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(limpa)) {
    // Chave aleatória
    return {
      tipo: 'Chave Aleatória',
      formatada: limpa.toLowerCase(),
    }
  }

  // Tipo desconhecido
  return {
    tipo: 'Chave',
    formatada: chave,
  }
}

// Validar chave PIX
export function validarChavePix(chave: string): boolean {
  const limpa = chave.replace(/\s/g, '')

  // CPF (11 dígitos)
  if (/^\d{11}$/.test(limpa)) return true

  // CNPJ (14 dígitos)
  if (/^\d{14}$/.test(limpa)) return true

  // Telefone (+55 + DDD + número)
  if (/^\+?55\d{10,11}$/.test(limpa)) return true

  // Email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpa)) return true

  // Chave aleatória (UUID)
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(limpa)) return true

  return false
}
