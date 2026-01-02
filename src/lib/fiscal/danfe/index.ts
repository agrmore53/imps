/**
 * Gerador de DANFE e DANFCE em PDF
 * DANFE = Documento Auxiliar da Nota Fiscal Eletrônica (NF-e modelo 55)
 * DANFCE = Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica (NFC-e modelo 65)
 */

import { EmpresaFiscal } from '../types'

// Configurações do DANFCE (cupom térmico 80mm)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DANFCE_CONFIG = {
  width: 226, // ~80mm em pontos (72 pontos = 1 polegada, 80mm = ~3.15 polegadas)
  marginLeft: 10,
  marginRight: 10,
  fontSize: {
    titulo: 12,
    normal: 8,
    pequeno: 7,
    grande: 10,
  },
  lineHeight: 12,
}

// Configurações do DANFE (A4)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DANFE_A4_CONFIG = {
  width: 595, // A4 width em pontos
  height: 842, // A4 height em pontos
  margin: 30,
  fontSize: {
    titulo: 14,
    subtitulo: 10,
    normal: 8,
    pequeno: 7,
  },
}

interface DadosDANFCE {
  chave: string
  protocolo: string
  dataAutorizacao: Date
  empresa: EmpresaFiscal
  produtos: Array<{
    codigo: string
    descricao: string
    quantidade: number
    unidade: string
    valorUnitario: number
    valorTotal: number
  }>
  pagamentos: Array<{
    forma: string
    valor: number
  }>
  valorTotal: number
  valorDesconto?: number
  valorTroco?: number
  consumidor?: {
    cpfCnpj?: string
    nome?: string
  }
  qrCodeUrl: string
  urlConsulta: string
  ambiente: 1 | 2
  numero: number
  serie: number
  dataEmissao: Date
}

interface DadosDANFE {
  chave: string
  protocolo: string
  dataAutorizacao: Date
  empresa: EmpresaFiscal
  destinatario: {
    cpfCnpj: string
    nome: string
    endereco?: {
      logradouro: string
      numero: string
      complemento?: string
      bairro: string
      cidade: string
      uf: string
      cep: string
    }
    inscricaoEstadual?: string
  }
  produtos: Array<{
    codigo: string
    descricao: string
    ncm: string
    cfop: string
    unidade: string
    quantidade: number
    valorUnitario: number
    valorTotal: number
    icmsBase?: number
    icmsValor?: number
    icmsAliquota?: number
  }>
  pagamentos: Array<{
    forma: string
    valor: number
  }>
  valorProdutos: number
  valorDesconto?: number
  valorFrete?: number
  valorTotal: number
  naturezaOperacao: string
  numero: number
  serie: number
  dataEmissao: Date
  ambiente: 1 | 2
  informacoesAdicionais?: string
}

/**
 * Gera o conteúdo HTML do DANFCE para impressão térmica
 * Retorna HTML que pode ser convertido para PDF ou impresso diretamente
 */
export function gerarDANFCEHtml(dados: DadosDANFCE): string {
  const {
    chave,
    protocolo,
    dataAutorizacao,
    empresa,
    produtos,
    pagamentos,
    valorTotal,
    valorDesconto,
    valorTroco,
    consumidor,
    qrCodeUrl,
    urlConsulta,
    ambiente,
    numero,
    serie,
    dataEmissao,
  } = dados

  const formatarMoeda = (valor: number) =>
    valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const formatarData = (data: Date) =>
    data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR')

  const formatarChave = (chave: string) =>
    chave.replace(/(\d{4})/g, '$1 ').trim()

  const formasPagamento: Record<string, string> = {
    '01': 'Dinheiro',
    '02': 'Cheque',
    '03': 'Cartão Crédito',
    '04': 'Cartão Débito',
    '05': 'Crédito Loja',
    '10': 'Vale Alimentação',
    '11': 'Vale Refeição',
    '12': 'Vale Presente',
    '13': 'Vale Combustível',
    '15': 'Boleto',
    '16': 'Depósito',
    '17': 'PIX',
    '18': 'Transferência',
    '19': 'Cashback',
    '90': 'Sem Pagamento',
    '99': 'Outros',
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>DANFCE - ${numero}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Courier New', monospace;
      font-size: 10px;
      width: 80mm;
      padding: 5mm;
      line-height: 1.3;
    }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: bold; }
    .linha { border-top: 1px dashed #000; margin: 3mm 0; }
    .titulo { font-size: 12px; font-weight: bold; }
    .subtitulo { font-size: 11px; }
    .pequeno { font-size: 8px; }
    .item { display: flex; justify-content: space-between; }
    .item-desc { width: 100%; }
    .item-valores { display: flex; justify-content: space-between; font-size: 9px; }
    .qrcode {
      width: 120px;
      height: 120px;
      margin: 5mm auto;
      display: block;
    }
    .chave {
      font-size: 8px;
      word-break: break-all;
      text-align: center;
      margin: 2mm 0;
    }
    .total { font-size: 14px; font-weight: bold; }
    .ambiente-homolog {
      border: 2px solid #000;
      padding: 2mm;
      text-align: center;
      font-weight: bold;
      margin-bottom: 3mm;
    }
    @media print {
      body { width: 80mm; }
    }
  </style>
</head>
<body>
  ${ambiente === 2 ? '<div class="ambiente-homolog">AMBIENTE DE HOMOLOGAÇÃO<br>SEM VALOR FISCAL</div>' : ''}

  <div class="center titulo">DANFCE</div>
  <div class="center pequeno">Documento Auxiliar da NFC-e</div>

  <div class="linha"></div>

  <div class="center bold">${empresa.nomeFantasia || empresa.razaoSocial}</div>
  <div class="center pequeno">${empresa.razaoSocial}</div>
  <div class="center pequeno">CNPJ: ${empresa.cnpj}</div>
  <div class="center pequeno">IE: ${empresa.inscricaoEstadual || 'ISENTO'}</div>
  <div class="center pequeno">
    ${empresa.endereco.logradouro}, ${empresa.endereco.numero}
    ${empresa.endereco.complemento ? ', ' + empresa.endereco.complemento : ''}
  </div>
  <div class="center pequeno">
    ${empresa.endereco.bairro} - ${empresa.endereco.nomeMunicipio}/${empresa.endereco.uf}
  </div>
  <div class="center pequeno">CEP: ${empresa.endereco.cep}</div>

  <div class="linha"></div>

  <div class="center bold subtitulo">CUPOM FISCAL ELETRÔNICO - NFC-e</div>

  <div class="linha"></div>

  <div class="pequeno">CÓDIGO | DESCRIÇÃO</div>
  <div class="pequeno">QTD x VALOR UN = VALOR TOTAL</div>

  <div class="linha"></div>

  ${produtos.map((p, i) => `
    <div class="item-desc">${String(i + 1).padStart(3, '0')} | ${p.codigo} | ${p.descricao}</div>
    <div class="item-valores">
      <span>${p.quantidade.toFixed(3)} ${p.unidade} x ${formatarMoeda(p.valorUnitario)}</span>
      <span>${formatarMoeda(p.valorTotal)}</span>
    </div>
  `).join('')}

  <div class="linha"></div>

  <div class="item">
    <span>Qtd. Total de Itens:</span>
    <span>${produtos.length}</span>
  </div>

  ${valorDesconto && valorDesconto > 0 ? `
    <div class="item">
      <span>Subtotal:</span>
      <span>${formatarMoeda(valorTotal + valorDesconto)}</span>
    </div>
    <div class="item">
      <span>Desconto:</span>
      <span>-${formatarMoeda(valorDesconto)}</span>
    </div>
  ` : ''}

  <div class="item total">
    <span>TOTAL:</span>
    <span>${formatarMoeda(valorTotal)}</span>
  </div>

  <div class="linha"></div>

  <div class="bold">FORMAS DE PAGAMENTO</div>
  ${pagamentos.map(p => `
    <div class="item">
      <span>${formasPagamento[p.forma] || 'Outros'}</span>
      <span>${formatarMoeda(p.valor)}</span>
    </div>
  `).join('')}

  ${valorTroco && valorTroco > 0 ? `
    <div class="item">
      <span>Troco:</span>
      <span>${formatarMoeda(valorTroco)}</span>
    </div>
  ` : ''}

  <div class="linha"></div>

  ${consumidor?.cpfCnpj ? `
    <div class="pequeno">CONSUMIDOR: ${consumidor.nome || ''}</div>
    <div class="pequeno">CPF/CNPJ: ${consumidor.cpfCnpj}</div>
    <div class="linha"></div>
  ` : '<div class="pequeno center">CONSUMIDOR NÃO IDENTIFICADO</div><div class="linha"></div>'}

  <div class="center pequeno">NFC-e nº ${numero} Série ${serie}</div>
  <div class="center pequeno">Emissão: ${formatarData(dataEmissao)}</div>

  <div class="linha"></div>

  <div class="center pequeno bold">Consulte pela Chave de Acesso em:</div>
  <div class="center pequeno">${urlConsulta}</div>

  <div class="chave">${formatarChave(chave)}</div>

  <div class="linha"></div>

  <div class="center">
    <img class="qrcode" src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrCodeUrl)}" alt="QR Code" />
  </div>

  <div class="linha"></div>

  <div class="center pequeno">Protocolo de Autorização:</div>
  <div class="center pequeno bold">${protocolo}</div>
  <div class="center pequeno">Data: ${formatarData(dataAutorizacao)}</div>

  ${ambiente === 2 ? `
    <div class="linha"></div>
    <div class="center bold">EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO</div>
    <div class="center bold">SEM VALOR FISCAL</div>
  ` : ''}
</body>
</html>
`

  return html
}

/**
 * Gera o conteúdo HTML do DANFE (A4) para impressão
 */
export function gerarDANFEHtml(dados: DadosDANFE): string {
  const {
    chave,
    protocolo,
    dataAutorizacao,
    empresa,
    destinatario,
    produtos,
    pagamentos,
    valorProdutos,
    valorDesconto,
    valorFrete,
    valorTotal,
    naturezaOperacao,
    numero,
    serie,
    dataEmissao,
    ambiente,
    informacoesAdicionais,
  } = dados

  const formatarMoeda = (valor: number) =>
    valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const formatarData = (data: Date) =>
    data.toLocaleDateString('pt-BR')

  const formatarHora = (data: Date) =>
    data.toLocaleTimeString('pt-BR')

  const formatarChave = (chave: string) =>
    chave.replace(/(\d{4})/g, '$1 ').trim()

  const formasPagamento: Record<string, string> = {
    '01': 'Dinheiro',
    '02': 'Cheque',
    '03': 'Cartão de Crédito',
    '04': 'Cartão de Débito',
    '05': 'Crédito Loja',
    '15': 'Boleto Bancário',
    '16': 'Depósito Bancário',
    '17': 'PIX',
    '18': 'Transferência',
    '90': 'Sem Pagamento',
    '99': 'Outros',
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>DANFE - NF-e ${numero}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: Arial, sans-serif;
      font-size: 9px;
      padding: 10mm;
      max-width: 210mm;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    td, th {
      border: 1px solid #000;
      padding: 2px 4px;
      vertical-align: top;
    }
    .no-border { border: none; }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: bold; }
    .titulo { font-size: 14px; font-weight: bold; }
    .subtitulo { font-size: 10px; font-weight: bold; }
    .label { font-size: 7px; color: #666; }
    .valor { font-size: 9px; }
    .cabecalho {
      display: flex;
      border: 1px solid #000;
      margin-bottom: 2mm;
    }
    .logo-area {
      width: 25%;
      padding: 5px;
      border-right: 1px solid #000;
      text-align: center;
    }
    .danfe-area {
      width: 15%;
      padding: 5px;
      border-right: 1px solid #000;
      text-align: center;
    }
    .chave-area {
      width: 60%;
      padding: 5px;
    }
    .qrcode {
      width: 80px;
      height: 80px;
    }
    .chave {
      font-size: 8px;
      font-family: 'Courier New', monospace;
      word-break: break-all;
    }
    .ambiente-homolog {
      background: #ffff00;
      padding: 5px;
      text-align: center;
      font-weight: bold;
      font-size: 12px;
      margin-bottom: 5mm;
    }
    .secao {
      margin-bottom: 2mm;
    }
    .secao-titulo {
      background: #f0f0f0;
      font-weight: bold;
      padding: 2px 5px;
      font-size: 8px;
    }
    .produtos-header th {
      background: #f0f0f0;
      font-size: 7px;
      text-align: center;
    }
    .produtos-row td {
      font-size: 8px;
    }
    @media print {
      body { max-width: 210mm; }
      @page { size: A4; margin: 10mm; }
    }
  </style>
</head>
<body>
  ${ambiente === 2 ? '<div class="ambiente-homolog">EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL</div>' : ''}

  <!-- Cabeçalho -->
  <div class="cabecalho">
    <div class="logo-area">
      <div class="bold">${empresa.nomeFantasia || empresa.razaoSocial}</div>
      <div style="font-size:8px;">${empresa.razaoSocial}</div>
      <div style="font-size:8px;">
        ${empresa.endereco.logradouro}, ${empresa.endereco.numero}
        ${empresa.endereco.complemento ? ', ' + empresa.endereco.complemento : ''}<br>
        ${empresa.endereco.bairro} - ${empresa.endereco.nomeMunicipio}/${empresa.endereco.uf}<br>
        CEP: ${empresa.endereco.cep}
        ${empresa.endereco.telefone ? ' - Tel: ' + empresa.endereco.telefone : ''}
      </div>
    </div>
    <div class="danfe-area">
      <div class="titulo">DANFE</div>
      <div style="font-size:7px;">Documento Auxiliar da<br>Nota Fiscal Eletrônica</div>
      <div style="margin-top:5px;">
        <strong>0 - ENTRADA</strong><br>
        <strong>1 - SAÍDA</strong>
      </div>
      <div style="border:1px solid #000; padding:3px; margin-top:5px; font-size:12px; font-weight:bold;">1</div>
      <div style="margin-top:5px; font-size:10px;">
        Nº ${String(numero).padStart(9, '0')}<br>
        Série ${String(serie).padStart(3, '0')}<br>
        Folha 1/1
      </div>
    </div>
    <div class="chave-area">
      <div class="label">CHAVE DE ACESSO</div>
      <div class="chave">${formatarChave(chave)}</div>
      <div style="margin-top:5px;">
        <img class="qrcode" src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(chave)}" alt="QR Code">
      </div>
      <div style="font-size:7px; margin-top:3px;">
        Consulta de autenticidade no portal nacional da NF-e<br>
        www.nfe.fazenda.gov.br/portal
      </div>
      <div style="margin-top:5px;">
        <div class="label">PROTOCOLO DE AUTORIZAÇÃO</div>
        <div class="valor bold">${protocolo} - ${formatarData(dataAutorizacao)} ${formatarHora(dataAutorizacao)}</div>
      </div>
    </div>
  </div>

  <!-- Natureza da Operação -->
  <div class="secao">
    <table>
      <tr>
        <td style="width:70%">
          <div class="label">NATUREZA DA OPERAÇÃO</div>
          <div class="valor">${naturezaOperacao}</div>
        </td>
        <td>
          <div class="label">INSCRIÇÃO ESTADUAL</div>
          <div class="valor">${empresa.inscricaoEstadual || 'ISENTO'}</div>
        </td>
        <td>
          <div class="label">CNPJ</div>
          <div class="valor">${empresa.cnpj}</div>
        </td>
      </tr>
    </table>
  </div>

  <!-- Destinatário -->
  <div class="secao">
    <div class="secao-titulo">DESTINATÁRIO/REMETENTE</div>
    <table>
      <tr>
        <td style="width:60%">
          <div class="label">NOME/RAZÃO SOCIAL</div>
          <div class="valor">${destinatario.nome}</div>
        </td>
        <td style="width:25%">
          <div class="label">CNPJ/CPF</div>
          <div class="valor">${destinatario.cpfCnpj}</div>
        </td>
        <td>
          <div class="label">DATA EMISSÃO</div>
          <div class="valor">${formatarData(dataEmissao)}</div>
        </td>
      </tr>
      <tr>
        <td>
          <div class="label">ENDEREÇO</div>
          <div class="valor">${destinatario.endereco ? `${destinatario.endereco.logradouro}, ${destinatario.endereco.numero}${destinatario.endereco.complemento ? ', ' + destinatario.endereco.complemento : ''}` : ''}</div>
        </td>
        <td>
          <div class="label">BAIRRO</div>
          <div class="valor">${destinatario.endereco?.bairro || ''}</div>
        </td>
        <td>
          <div class="label">CEP</div>
          <div class="valor">${destinatario.endereco?.cep || ''}</div>
        </td>
      </tr>
      <tr>
        <td>
          <div class="label">MUNICÍPIO</div>
          <div class="valor">${destinatario.endereco?.cidade || ''}</div>
        </td>
        <td>
          <div class="label">UF</div>
          <div class="valor">${destinatario.endereco?.uf || ''}</div>
        </td>
        <td>
          <div class="label">INSCRIÇÃO ESTADUAL</div>
          <div class="valor">${destinatario.inscricaoEstadual || ''}</div>
        </td>
      </tr>
    </table>
  </div>

  <!-- Produtos -->
  <div class="secao">
    <div class="secao-titulo">DADOS DOS PRODUTOS/SERVIÇOS</div>
    <table>
      <tr class="produtos-header">
        <th style="width:8%">CÓDIGO</th>
        <th style="width:30%">DESCRIÇÃO</th>
        <th style="width:8%">NCM</th>
        <th style="width:5%">CFOP</th>
        <th style="width:5%">UN</th>
        <th style="width:8%">QTD</th>
        <th style="width:8%">VL.UNIT</th>
        <th style="width:8%">VL.TOTAL</th>
        <th style="width:8%">BC ICMS</th>
        <th style="width:6%">VL.ICMS</th>
        <th style="width:6%">%ICMS</th>
      </tr>
      ${produtos.map(p => `
        <tr class="produtos-row">
          <td class="center">${p.codigo}</td>
          <td>${p.descricao}</td>
          <td class="center">${p.ncm}</td>
          <td class="center">${p.cfop}</td>
          <td class="center">${p.unidade}</td>
          <td class="right">${p.quantidade.toFixed(4)}</td>
          <td class="right">${formatarMoeda(p.valorUnitario)}</td>
          <td class="right">${formatarMoeda(p.valorTotal)}</td>
          <td class="right">${p.icmsBase ? formatarMoeda(p.icmsBase) : ''}</td>
          <td class="right">${p.icmsValor ? formatarMoeda(p.icmsValor) : ''}</td>
          <td class="right">${p.icmsAliquota ? p.icmsAliquota.toFixed(2) : ''}</td>
        </tr>
      `).join('')}
    </table>
  </div>

  <!-- Totais -->
  <div class="secao">
    <div class="secao-titulo">CÁLCULO DO IMPOSTO</div>
    <table>
      <tr>
        <td>
          <div class="label">VALOR DOS PRODUTOS</div>
          <div class="valor right">${formatarMoeda(valorProdutos)}</div>
        </td>
        <td>
          <div class="label">VALOR DO FRETE</div>
          <div class="valor right">${valorFrete ? formatarMoeda(valorFrete) : '0,00'}</div>
        </td>
        <td>
          <div class="label">VALOR DO DESCONTO</div>
          <div class="valor right">${valorDesconto ? formatarMoeda(valorDesconto) : '0,00'}</div>
        </td>
        <td>
          <div class="label">VALOR TOTAL DA NOTA</div>
          <div class="valor right bold">${formatarMoeda(valorTotal)}</div>
        </td>
      </tr>
    </table>
  </div>

  <!-- Pagamentos -->
  <div class="secao">
    <div class="secao-titulo">FORMAS DE PAGAMENTO</div>
    <table>
      <tr>
        ${pagamentos.map(p => `
          <td>
            <div class="label">${formasPagamento[p.forma] || 'Outros'}</div>
            <div class="valor right">${formatarMoeda(p.valor)}</div>
          </td>
        `).join('')}
      </tr>
    </table>
  </div>

  <!-- Informações Adicionais -->
  ${informacoesAdicionais ? `
    <div class="secao">
      <div class="secao-titulo">INFORMAÇÕES COMPLEMENTARES</div>
      <div style="border:1px solid #000; padding:5px; min-height:30px; font-size:8px;">
        ${informacoesAdicionais}
      </div>
    </div>
  ` : ''}

  ${ambiente === 2 ? `
    <div style="margin-top:10mm; text-align:center; font-weight:bold; font-size:14px; color:red;">
      EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL
    </div>
  ` : ''}
</body>
</html>
`

  return html
}

/**
 * Converte o HTML do DANFCE para um Blob PDF (para download ou impressão)
 * Nota: Esta função deve ser chamada no cliente (browser)
 */
export async function gerarDANFCEPdf(dados: DadosDANFCE): Promise<Blob> {
  const html = gerarDANFCEHtml(dados)

  // Cria uma janela oculta para imprimir
  const printWindow = window.open('', '_blank', 'width=302,height=800')
  if (!printWindow) {
    throw new Error('Não foi possível abrir janela de impressão')
  }

  printWindow.document.write(html)
  printWindow.document.close()

  // Retorna um blob vazio - a impressão real é via window.print()
  return new Blob([html], { type: 'text/html' })
}

/**
 * Abre o DANFCE para impressão direta
 */
export function imprimirDANFCE(dados: DadosDANFCE): void {
  const html = gerarDANFCEHtml(dados)

  const printWindow = window.open('', '_blank', 'width=302,height=800')
  if (!printWindow) {
    throw new Error('Não foi possível abrir janela de impressão')
  }

  printWindow.document.write(html)
  printWindow.document.close()

  // Aguarda o carregamento do QR Code antes de imprimir
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print()
    }, 500)
  }
}

/**
 * Abre o DANFE para impressão
 */
export function imprimirDANFE(dados: DadosDANFE): void {
  const html = gerarDANFEHtml(dados)

  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    throw new Error('Não foi possível abrir janela de impressão')
  }

  printWindow.document.write(html)
  printWindow.document.close()

  // Aguarda o carregamento antes de imprimir
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print()
    }, 500)
  }
}

/**
 * Gera URL de consulta NFC-e por UF
 */
export function getUrlConsultaNFCe(uf: string, ambiente: 1 | 2): string {
  const urls: Record<string, { producao: string; homologacao: string }> = {
    'SC': {
      producao: 'https://sat.sef.sc.gov.br/nfce/consulta',
      homologacao: 'https://hom.sat.sef.sc.gov.br/nfce/consulta',
    },
    'SP': {
      producao: 'https://www.nfce.fazenda.sp.gov.br/consulta',
      homologacao: 'https://www.homologacao.nfce.fazenda.sp.gov.br/consulta',
    },
    'RS': {
      producao: 'https://www.sefaz.rs.gov.br/nfce/consulta',
      homologacao: 'https://www.sefaz.rs.gov.br/nfce/consulta-hom',
    },
    'PR': {
      producao: 'http://www.nfce.pr.gov.br/nfce/consulta',
      homologacao: 'http://www.nfce.pr.gov.br/nfce/consulta',
    },
    'MG': {
      producao: 'https://nfce.fazenda.mg.gov.br/portalnfce',
      homologacao: 'https://hnfce.fazenda.mg.gov.br/portalnfce',
    },
    'RJ': {
      producao: 'http://www.nfce.fazenda.rj.gov.br/consulta',
      homologacao: 'http://www.nfce.fazenda.rj.gov.br/consulta',
    },
  }

  const ufUrls = urls[uf] || urls['SC']
  return ambiente === 1 ? ufUrls.producao : ufUrls.homologacao
}

export type { DadosDANFCE, DadosDANFE }
