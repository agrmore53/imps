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
  // Impostos
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
