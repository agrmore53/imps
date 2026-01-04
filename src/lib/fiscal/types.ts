// Tipos para integração fiscal NFC-e e NF-e

export interface CertificadoInfo {
  subject: string
  issuer: string
  validFrom: Date
  validTo: Date
  serialNumber: string
  cnpj: string
}

export interface EmpresaFiscal {
  cnpj: string
  razaoSocial: string
  nomeFantasia: string
  inscricaoEstadual: string
  crt: 1 | 2 | 3 // 1=Simples, 2=Simples Excesso, 3=Normal
  endereco: {
    logradouro: string
    numero: string
    complemento?: string
    bairro: string
    codigoMunicipio: string
    nomeMunicipio: string
    uf: string
    cep: string
    pais: string
    codigoPais: string
    telefone?: string
  }
}

export interface DestinatarioNFe {
  cpfCnpj: string
  nome: string
  email?: string
  inscricaoEstadual?: string
  endereco?: {
    logradouro: string
    numero: string
    complemento?: string
    bairro: string
    codigoMunicipio: string
    nomeMunicipio: string
    uf: string
    cep: string
    pais: string
    codigoPais: string
    telefone?: string
  }
}

export interface ProdutoNFe {
  codigo: string
  cEAN: string // Código de barras
  descricao: string
  ncm: string
  cfop: string
  unidade: string
  quantidade: number
  valorUnitario: number
  valorTotal: number
  // Impostos tradicionais
  icms: {
    origem: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
    cst: string
    aliquota?: number
    valorBase?: number
    valor?: number
  }
  pis: {
    cst: string
    aliquota?: number
    valor?: number
  }
  cofins: {
    cst: string
    aliquota?: number
    valor?: number
  }
  // Reforma Tributária - IBS/CBS (opcional até 2027 para Simples)
  ibsCbs?: {
    cst: string           // CST IBS/CBS (00, 10, 20, etc.)
    cClassTrib?: string   // Código Classificação Tributária
    vBC: number           // Base de cálculo
    pIBS: number          // Alíquota IBS
    pCBS: number          // Alíquota CBS
    vIBS: number          // Valor IBS
    vCBS: number          // Valor CBS
  }
}

export interface PagamentoNFe {
  forma: string // 01=Dinheiro, 02=Cheque, 03=Cartão Crédito, 04=Cartão Débito, etc.
  valor: number
  bandeira?: string
  cnpjCredenciadora?: string
  autorizacao?: string
}

export interface NFCeData {
  tipo: 'nfce'
  ambiente: 1 | 2 // 1=Producao, 2=Homologacao
  serie: number
  numero: number
  dataEmissao: Date
  empresa: EmpresaFiscal
  destinatario?: DestinatarioNFe
  produtos: ProdutoNFe[]
  pagamentos: PagamentoNFe[]
  valorTotal: number
  valorDesconto?: number
  informacoesAdicionais?: string
  // NFC-e específico
  idToken: number
  csc: string
}

export interface NFeData {
  tipo: 'nfe'
  ambiente: 1 | 2
  serie: number
  numero: number
  dataEmissao: Date
  naturezaOperacao: string
  empresa: EmpresaFiscal
  destinatario: DestinatarioNFe
  produtos: ProdutoNFe[]
  pagamentos: PagamentoNFe[]
  valorTotal: number
  valorDesconto?: number
  valorFrete?: number
  valorSeguro?: number
  valorOutros?: number
  informacoesAdicionais?: string
  // NF-e específico
  finalidade: 1 | 2 | 3 | 4 // 1=Normal, 2=Complementar, 3=Ajuste, 4=Devolução
  consumidorFinal: 0 | 1
  presenca: 0 | 1 | 2 | 3 | 4 | 5 | 9
}

export interface RetornoSEFAZ {
  sucesso: boolean
  codigo: string
  mensagem: string
  protocolo?: string
  chave?: string
  xml?: string
  dataRecebimento?: Date
}

export interface ConfiguracaoFiscal {
  ambiente: 1 | 2
  uf: string
  certificadoBase64?: string
  certificadoSenha?: string
  serieNFCe: number
  serieNFe: number
  ultimoNumeroNFCe: number
  ultimoNumeroNFe: number
  idTokenNFCe: number
  cscNFCe: string
  // Reforma Tributária - IBS/CBS
  ibsCbs?: {
    habilitado: boolean           // Habilita campos IBS/CBS no XML
    aliquotaIBS: number           // Alíquota padrão IBS (0.1% em 2026)
    aliquotaCBS: number           // Alíquota padrão CBS (0.9% em 2026)
    incluirEmDevolucao: boolean   // Incluir em notas de devolução
  }
}

// Códigos de UF do IBGE
export const CODIGOS_UF: Record<string, string> = {
  'AC': '12', 'AL': '27', 'AP': '16', 'AM': '13', 'BA': '29',
  'CE': '23', 'DF': '53', 'ES': '32', 'GO': '52', 'MA': '21',
  'MT': '51', 'MS': '50', 'MG': '31', 'PA': '15', 'PB': '25',
  'PR': '41', 'PE': '26', 'PI': '22', 'RJ': '33', 'RN': '24',
  'RS': '43', 'RO': '11', 'RR': '14', 'SC': '42', 'SP': '35',
  'SE': '28', 'TO': '17'
}

// Webservices SEFAZ por UF
export const WEBSERVICES_SEFAZ: Record<string, Record<string, Record<string, string>>> = {
  'SC': {
    'homologacao': {
      'NfeAutorizacao': 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
      'NfeRetAutorizacao': 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
      'NfeConsultaProtocolo': 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
      'NfeStatusServico': 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
      'NfeCancelamento': 'https://nfe-homologacao.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
      'NfceAutorizacao': 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
      'NfceRetAutorizacao': 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
      'NfceConsultaProtocolo': 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
      'NfceStatusServico': 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
    },
    'producao': {
      'NfeAutorizacao': 'https://nfe.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
      'NfeRetAutorizacao': 'https://nfe.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
      'NfeConsultaProtocolo': 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
      'NfeStatusServico': 'https://nfe.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
      'NfeCancelamento': 'https://nfe.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
      'NfceAutorizacao': 'https://nfce.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
      'NfceRetAutorizacao': 'https://nfce.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
      'NfceConsultaProtocolo': 'https://nfce.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
      'NfceStatusServico': 'https://nfce.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
    }
  }
}

// Formas de pagamento
export const FORMAS_PAGAMENTO: Record<string, string> = {
  '01': 'Dinheiro',
  '02': 'Cheque',
  '03': 'Cartão de Crédito',
  '04': 'Cartão de Débito',
  '05': 'Crédito Loja',
  '10': 'Vale Alimentação',
  '11': 'Vale Refeição',
  '12': 'Vale Presente',
  '13': 'Vale Combustível',
  '15': 'Boleto Bancário',
  '16': 'Depósito Bancário',
  '17': 'PIX',
  '18': 'Transferência',
  '19': 'Cashback',
  '90': 'Sem Pagamento',
  '99': 'Outros',
}

// ============================================================
// REFORMA TRIBUTÁRIA - IBS/CBS (NT 2025.002)
// Obrigatório: Simples Nacional a partir de 2027
//              Lucro Real/Presumido a partir de 2026
// ============================================================

/**
 * Tributação IBS/CBS por item do produto
 * Conforme Nota Técnica 2025.002 v1.34
 */
export interface TributacaoIBSCBS {
  // Código de Situação Tributária IBS/CBS
  cst: CstIbsCbs
  // Código de Classificação Tributária (vinculado ao NCM)
  cClassTrib?: string
  // Base de cálculo
  vBC: number
  // Alíquota IBS (0.1% em 2026)
  pIBS: number
  // Alíquota CBS (0.9% em 2026)
  pCBS: number
  // Valor IBS calculado
  vIBS: number
  // Valor CBS calculado
  vCBS: number
  // Indicador de tributação diferenciada
  indTribDif?: 0 | 1
}

/**
 * CST IBS/CBS - Código de Situação Tributária
 * Conforme LC 214/2025
 */
export type CstIbsCbs =
  | '00'  // Tributação integral
  | '10'  // Tributação com alíquota reduzida
  | '20'  // Tributação com alíquota zero
  | '30'  // Isenção
  | '40'  // Imunidade
  | '50'  // Suspensão
  | '60'  // Diferimento
  | '90'  // Outros

/**
 * Totais IBS/CBS da NF-e/NFC-e
 * Grupo W03 conforme NT 2025.002
 */
export interface TotaisIBSCBS {
  // Base de cálculo total IBS
  vBCIBS: number
  // Valor total IBS
  vIBS: number
  // Base de cálculo total CBS
  vBCCBS: number
  // Valor total CBS
  vCBS: number
  // Valor total IBS + CBS
  vTotTrib: number
}

/**
 * Configuração IBS/CBS da empresa
 */
export interface ConfiguracaoIBSCBS {
  // Habilita campos IBS/CBS no XML
  habilitado: boolean
  // Ano de início da obrigatoriedade (2026 ou 2027)
  anoObrigatoriedade: number
  // Alíquota padrão IBS (0.1% em 2026)
  aliquotaPadraoIBS: number
  // Alíquota padrão CBS (0.9% em 2026)
  aliquotaPadraoCBS: number
  // Incluir em notas de devolução mesmo sendo Simples
  incluirEmDevolucao: boolean
}

/**
 * Alíquotas IBS/CBS por ano (período de transição)
 */
export const ALIQUOTAS_IBS_CBS: Record<number, { ibs: number; cbs: number }> = {
  2026: { ibs: 0.1, cbs: 0.9 },     // Ano de teste
  2027: { ibs: 0.1, cbs: 0.9 },     // Início Simples Nacional
  2028: { ibs: 0.2, cbs: 1.8 },     // Transição
  2029: { ibs: 0.4, cbs: 3.6 },     // Transição
  2030: { ibs: 0.6, cbs: 5.4 },     // Transição
  2031: { ibs: 0.8, cbs: 7.2 },     // Transição
  2032: { ibs: 1.0, cbs: 9.0 },     // Transição
  2033: { ibs: 1.0, cbs: 9.0 },     // Final (alíquotas cheias - valores estimados)
}

/**
 * Descrição dos CSTs IBS/CBS
 */
export const CST_IBS_CBS_DESCRICAO: Record<CstIbsCbs, string> = {
  '00': 'Tributação integral',
  '10': 'Tributação com alíquota reduzida',
  '20': 'Tributação com alíquota zero',
  '30': 'Isenção',
  '40': 'Imunidade',
  '50': 'Suspensão',
  '60': 'Diferimento',
  '90': 'Outros',
}

/**
 * Finalidades de NF-e incluindo novas da Reforma (NT 2025.002)
 */
export const FINALIDADES_NFE: Record<number, string> = {
  1: 'NF-e Normal',
  2: 'NF-e Complementar',
  3: 'NF-e de Ajuste',
  4: 'Devolução de Mercadoria',
  5: 'Nota de Crédito',      // NOVA - Reforma Tributária
  6: 'Nota de Débito',       // NOVA - Reforma Tributária
}
