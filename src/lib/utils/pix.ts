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

// Normalizar chave PIX para o formato correto do payload EMV
function normalizarChavePix(chave: string): string {
  const limpa = chave.replace(/\s/g, '')

  // Se for celular brasileiro sem +55, adicionar
  // Formato: 11 dígitos, DDD (11-99) + começa com 9
  if (/^\d{11}$/.test(limpa)) {
    const ddd = parseInt(limpa.substring(0, 2))
    const terceiroDigito = limpa.charAt(2)

    if (ddd >= 11 && ddd <= 99 && terceiroDigito === '9') {
      // É um celular brasileiro, adicionar +55
      return '+55' + limpa
    }
  }

  // Se já tem 55 mas não tem +, adicionar
  if (/^55\d{10,11}$/.test(limpa)) {
    return '+' + limpa
  }

  return limpa
}

// Remove acentos e caracteres especiais (EMV só aceita ASCII)
function removerAcentos(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacríticos
    .replace(/[^a-zA-Z0-9 ]/g, '')   // Remove caracteres especiais
    .trim()
}

// Gera o payload PIX no formato EMV
export function gerarPayloadPix(dados: PixPayload): string {
  // Limitar tamanhos e remover acentos conforme especificação EMV
  const beneficiario = removerAcentos(dados.beneficiario).substring(0, 25).toUpperCase()
  const cidade = removerAcentos(dados.cidade).substring(0, 15).toUpperCase()
  // TXID só pode ter letras e números, sem caracteres especiais
  const txid = dados.txid?.replace(/[^a-zA-Z0-9]/g, '').substring(0, 25) || '***'

  // Normalizar a chave PIX (adiciona +55 para celulares)
  const chaveNormalizada = normalizarChavePix(dados.chavePix)

  // Formatar valor (2 casas decimais, sem separador de milhar)
  let valorFormatado = ''
  if (dados.valor && dados.valor > 0) {
    valorFormatado = dados.valor.toFixed(2)
  }

  // Construir o Merchant Account Information (campo 26)
  // 00 = GUI (BR.GOV.BCB.PIX) - DEVE SER MAIÚSCULO
  // 01 = Chave PIX
  // 02 = Descrição (opcional)
  let merchantAccountInfo = emvField('00', 'BR.GOV.BCB.PIX')
  merchantAccountInfo += emvField('01', chaveNormalizada)
  if (dados.descricao) {
    merchantAccountInfo += emvField('02', removerAcentos(dados.descricao).substring(0, 72))
  }

  // Construir Additional Data Field (campo 62)
  // 05 = Reference Label (TXID)
  const additionalDataField = emvField('05', txid)

  // Montar payload
  let payload = ''

  // 00 - Payload Format Indicator
  payload += emvField('00', '01')

  // 01 - Point of Initiation Method (12 = QR dinâmico/com valor, 11 = estático)
  // Campo obrigatório quando há valor definido
  if (valorFormatado) {
    payload += emvField('01', '12')
  }

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

// Verificar se é um número de celular brasileiro (DDD + 9 + 8 dígitos)
function isCelularBrasileiro(numero: string): boolean {
  // Formato: XX9XXXXXXXX (11 dígitos, 3º dígito é 9)
  if (!/^\d{11}$/.test(numero)) return false

  const ddd = parseInt(numero.substring(0, 2))
  const terceiroDigito = numero.charAt(2)

  // DDDs válidos são de 11 a 99
  // Celulares brasileiros começam com 9 após o DDD
  return ddd >= 11 && ddd <= 99 && terceiroDigito === '9'
}

// Formatar chave PIX para exibição
export function formatarChavePix(chave: string): { tipo: string; formatada: string } {
  // Remove espaços e caracteres especiais para análise
  const limpa = chave.replace(/\s/g, '')

  // Detectar tipo de chave - verificar telefone ANTES de CPF
  if (/^\+55\d{10,11}$/.test(limpa) || /^55\d{10,11}$/.test(limpa)) {
    // Telefone com código do país
    const tel = limpa.startsWith('+') ? limpa : '+' + limpa
    return {
      tipo: 'Telefone',
      formatada: tel,
    }
  } else if (isCelularBrasileiro(limpa)) {
    // Celular brasileiro sem código do país (11 dígitos, começa com DDD + 9)
    const ddd = limpa.substring(0, 2)
    const numero = limpa.substring(2)
    return {
      tipo: 'Celular',
      formatada: `(${ddd}) ${numero.substring(0, 5)}-${numero.substring(5)}`,
    }
  } else if (/^\d{11}$/.test(limpa)) {
    // CPF (11 dígitos que não são celular)
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

  // Telefone (+55 + DDD + número)
  if (/^\+?55\d{10,11}$/.test(limpa)) return true

  // Celular brasileiro sem código do país (DDD + 9 + número)
  if (isCelularBrasileiro(limpa)) return true

  // CPF (11 dígitos que não são celular)
  if (/^\d{11}$/.test(limpa)) return true

  // CNPJ (14 dígitos)
  if (/^\d{14}$/.test(limpa)) return true

  // Email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpa)) return true

  // Chave aleatória (UUID)
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(limpa)) return true

  return false
}
