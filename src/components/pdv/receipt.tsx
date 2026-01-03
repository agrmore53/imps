'use client'

import { forwardRef } from 'react'

interface ItemRecibo {
  codigo: string
  nome: string
  quantidade: number
  preco: number
  total: number
}

interface PagamentoRecibo {
  forma: string
  valor: number
}

interface DadosRecibo {
  // Empresa
  empresa: {
    nome: string
    cnpj: string
    endereco?: string
    telefone?: string
  }
  // Venda
  numero?: number
  data: Date
  operador: string
  // Itens
  itens: ItemRecibo[]
  // Valores
  subtotal: number
  desconto: number
  total: number
  // Pagamentos
  pagamentos: PagamentoRecibo[]
  valorRecebido?: number
  troco?: number
  // NFC-e
  nfce?: {
    chave?: string
    protocolo?: string
  }
  // Cliente
  cliente?: {
    nome?: string
    cpf?: string
  }
}

interface ReceiptProps {
  dados: DadosRecibo
  largura?: '58mm' | '80mm'
}

// Formata moeda
function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

// Formata data e hora
function formatDateTime(date: Date): string {
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Formata CNPJ
function formatCNPJ(cnpj: string): string {
  const cleaned = cnpj.replace(/\D/g, '')
  return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

// Formata CPF
function formatCPF(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, '')
  return cleaned.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
}

// Mapa de formas de pagamento
const formasPagamento: Record<string, string> = {
  dinheiro: 'DINHEIRO',
  cartao_credito: 'CARTAO CREDITO',
  cartao_debito: 'CARTAO DEBITO',
  pix: 'PIX',
}

// Componente do Cupom
export const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(
  function Receipt({ dados, largura = '80mm' }, ref) {
    const {
      empresa,
      numero,
      data,
      operador,
      itens,
      subtotal,
      desconto,
      total,
      pagamentos,
      valorRecebido,
      troco,
      nfce,
      cliente,
    } = dados

    // Largura em caracteres
    const maxChars = largura === '58mm' ? 32 : 48
    const separador = '-'.repeat(maxChars)

    // Trunca texto se necessário
    function truncate(text: string, max: number): string {
      return text.length > max ? text.substring(0, max - 1) + '.' : text
    }

    return (
      <div
        ref={ref}
        className="receipt-container"
        style={{
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: largura === '58mm' ? '10px' : '12px',
          lineHeight: 1.3,
          width: largura,
          padding: '5mm',
          backgroundColor: 'white',
          color: 'black',
        }}
      >
        {/* Header da Empresa */}
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div style={{ fontWeight: 'bold', fontSize: largura === '58mm' ? '12px' : '14px' }}>
            {truncate(empresa.nome, maxChars)}
          </div>
          <div>CNPJ: {formatCNPJ(empresa.cnpj)}</div>
          {empresa.endereco && (
            <div style={{ fontSize: largura === '58mm' ? '9px' : '10px' }}>
              {truncate(empresa.endereco, maxChars)}
            </div>
          )}
          {empresa.telefone && <div>Tel: {empresa.telefone}</div>}
        </div>

        <div>{separador}</div>

        {/* Tipo de documento */}
        <div style={{ textAlign: 'center', fontWeight: 'bold' }}>
          {nfce?.chave ? 'NFC-e - DANFE' : 'CUPOM NAO FISCAL'}
        </div>

        <div>{separador}</div>

        {/* Info da venda */}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Venda: {numero || '---'}</span>
          <span>{formatDateTime(data)}</span>
        </div>
        <div>Operador: {truncate(operador, maxChars - 10)}</div>

        {cliente?.nome && (
          <div>Cliente: {truncate(cliente.nome, maxChars - 9)}</div>
        )}
        {cliente?.cpf && (
          <div>CPF: {formatCPF(cliente.cpf)}</div>
        )}

        <div>{separador}</div>

        {/* Header dos itens */}
        <div style={{ fontWeight: 'bold' }}>
          {largura === '58mm' ? (
            <>
              <div>ITEM DESCRICAO</div>
              <div>QTD x VALOR = TOTAL</div>
            </>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>ITEM</span>
              <span>QTD x VALOR</span>
              <span>TOTAL</span>
            </div>
          )}
        </div>

        <div>{separador}</div>

        {/* Lista de itens */}
        {itens.map((item, index) => (
          <div key={index} style={{ marginBottom: '4px' }}>
            {largura === '58mm' ? (
              <>
                <div>{String(index + 1).padStart(3, '0')} {truncate(item.nome, maxChars - 4)}</div>
                <div style={{ textAlign: 'right' }}>
                  {item.quantidade.toFixed(2)} x {formatCurrency(item.preco)} = {formatCurrency(item.total)}
                </div>
              </>
            ) : (
              <>
                <div>{String(index + 1).padStart(3, '0')} {truncate(item.nome, maxChars - 4)}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '20px' }}>
                  <span>{item.quantidade.toFixed(2)} x {formatCurrency(item.preco)}</span>
                  <span style={{ fontWeight: 'bold' }}>{formatCurrency(item.total)}</span>
                </div>
              </>
            )}
          </div>
        ))}

        <div>{separador}</div>

        {/* Totais */}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>SUBTOTAL:</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>

        {desconto > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>DESCONTO:</span>
            <span>-{formatCurrency(desconto)}</span>
          </div>
        )}

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontWeight: 'bold',
          fontSize: largura === '58mm' ? '12px' : '14px',
          marginTop: '4px',
        }}>
          <span>TOTAL:</span>
          <span>{formatCurrency(total)}</span>
        </div>

        <div>{separador}</div>

        {/* Pagamentos */}
        <div style={{ fontWeight: 'bold' }}>PAGAMENTO:</div>
        {pagamentos.map((pag, index) => (
          <div key={index} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{formasPagamento[pag.forma] || pag.forma.toUpperCase()}</span>
            <span>{formatCurrency(pag.valor)}</span>
          </div>
        ))}

        {valorRecebido !== undefined && valorRecebido > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Valor Recebido:</span>
            <span>{formatCurrency(valorRecebido)}</span>
          </div>
        )}

        {troco !== undefined && troco > 0 && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontWeight: 'bold',
            fontSize: largura === '58mm' ? '12px' : '14px',
          }}>
            <span>TROCO:</span>
            <span>{formatCurrency(troco)}</span>
          </div>
        )}

        {/* NFC-e Info */}
        {nfce?.chave && (
          <>
            <div>{separador}</div>
            <div style={{ textAlign: 'center', fontSize: largura === '58mm' ? '8px' : '9px' }}>
              <div style={{ fontWeight: 'bold' }}>CHAVE DE ACESSO</div>
              <div style={{ wordBreak: 'break-all' }}>{nfce.chave}</div>
              {nfce.protocolo && (
                <div style={{ marginTop: '4px' }}>
                  Protocolo: {nfce.protocolo}
                </div>
              )}
              <div style={{ marginTop: '4px' }}>
                Consulte em www.nfce.fazenda.gov.br
              </div>
            </div>
          </>
        )}

        <div>{separador}</div>

        {/* QR Code placeholder */}
        {nfce?.chave && (
          <div style={{
            textAlign: 'center',
            padding: '10px',
            border: '1px dashed #ccc',
            margin: '8px 0',
          }}>
            [QR CODE]
          </div>
        )}

        {/* Rodapé */}
        <div style={{ textAlign: 'center', marginTop: '8px' }}>
          <div>{separador}</div>
          <div style={{ fontWeight: 'bold', marginTop: '4px' }}>
            OBRIGADO PELA PREFERENCIA!
          </div>
          <div style={{ fontSize: largura === '58mm' ? '8px' : '9px', marginTop: '4px' }}>
            Volte sempre!
          </div>
          <div style={{ fontSize: largura === '58mm' ? '7px' : '8px', marginTop: '8px' }}>
            Imperio Sistemas
          </div>
        </div>
      </div>
    )
  }
)

// Componente de impressão (abre em nova janela)
interface PrintReceiptProps {
  dados: DadosRecibo
  largura?: '58mm' | '80mm'
  onClose?: () => void
}

export function printReceipt({ dados, largura = '80mm' }: PrintReceiptProps) {
  const {
    empresa,
    numero,
    data,
    operador,
    itens,
    subtotal,
    desconto,
    total,
    pagamentos,
    valorRecebido,
    troco,
    nfce,
    cliente,
  } = dados

  const maxChars = largura === '58mm' ? 32 : 48
  const separador = '-'.repeat(maxChars)
  const fontSize = largura === '58mm' ? '10px' : '12px'
  const fontSizeSmall = largura === '58mm' ? '9px' : '10px'
  const fontSizeLarge = largura === '58mm' ? '12px' : '14px'

  function truncate(text: string, max: number): string {
    return text.length > max ? text.substring(0, max - 1) + '.' : text
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Cupom ${numero || ''}</title>
      <style>
        @media print {
          @page {
            size: ${largura} auto;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
          }
        }
        body {
          font-family: 'Courier New', Courier, monospace;
          font-size: ${fontSize};
          line-height: 1.3;
          width: ${largura};
          padding: 5mm;
          margin: 0 auto;
          background: white;
          color: black;
        }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .separator { margin: 4px 0; }
        .flex { display: flex; justify-content: space-between; }
        .small { font-size: ${fontSizeSmall}; }
        .large { font-size: ${fontSizeLarge}; }
        .item { margin-bottom: 4px; }
        .item-detail { padding-left: 20px; }
        .break-all { word-break: break-all; }
        .qr-placeholder {
          border: 1px dashed #ccc;
          padding: 10px;
          margin: 8px 0;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <!-- Header -->
      <div class="center">
        <div class="bold large">${truncate(empresa.nome, maxChars)}</div>
        <div>CNPJ: ${formatCNPJ(empresa.cnpj)}</div>
        ${empresa.endereco ? `<div class="small">${truncate(empresa.endereco, maxChars)}</div>` : ''}
        ${empresa.telefone ? `<div>Tel: ${empresa.telefone}</div>` : ''}
      </div>

      <div class="separator">${separador}</div>

      <div class="center bold">${nfce?.chave ? 'NFC-e - DANFE' : 'CUPOM NAO FISCAL'}</div>

      <div class="separator">${separador}</div>

      <!-- Info venda -->
      <div class="flex">
        <span>Venda: ${numero || '---'}</span>
        <span>${formatDateTime(data)}</span>
      </div>
      <div>Operador: ${truncate(operador, maxChars - 10)}</div>
      ${cliente?.nome ? `<div>Cliente: ${truncate(cliente.nome, maxChars - 9)}</div>` : ''}
      ${cliente?.cpf ? `<div>CPF: ${formatCPF(cliente.cpf)}</div>` : ''}

      <div class="separator">${separador}</div>

      <!-- Header itens -->
      <div class="bold">
        ${largura === '58mm'
          ? '<div>ITEM DESCRICAO</div><div>QTD x VALOR = TOTAL</div>'
          : '<div class="flex"><span>ITEM</span><span>QTD x VALOR</span><span>TOTAL</span></div>'
        }
      </div>

      <div class="separator">${separador}</div>

      <!-- Itens -->
      ${itens.map((item, index) => `
        <div class="item">
          <div>${String(index + 1).padStart(3, '0')} ${truncate(item.nome, maxChars - 4)}</div>
          <div class="flex item-detail">
            <span>${item.quantidade.toFixed(2)} x ${formatCurrency(item.preco)}</span>
            <span class="bold">${formatCurrency(item.total)}</span>
          </div>
        </div>
      `).join('')}

      <div class="separator">${separador}</div>

      <!-- Totais -->
      <div class="flex">
        <span>SUBTOTAL:</span>
        <span>${formatCurrency(subtotal)}</span>
      </div>
      ${desconto > 0 ? `
        <div class="flex">
          <span>DESCONTO:</span>
          <span>-${formatCurrency(desconto)}</span>
        </div>
      ` : ''}
      <div class="flex bold large" style="margin-top: 4px;">
        <span>TOTAL:</span>
        <span>${formatCurrency(total)}</span>
      </div>

      <div class="separator">${separador}</div>

      <!-- Pagamentos -->
      <div class="bold">PAGAMENTO:</div>
      ${pagamentos.map(pag => `
        <div class="flex">
          <span>${formasPagamento[pag.forma] || pag.forma.toUpperCase()}</span>
          <span>${formatCurrency(pag.valor)}</span>
        </div>
      `).join('')}
      ${valorRecebido && valorRecebido > 0 ? `
        <div class="flex">
          <span>Valor Recebido:</span>
          <span>${formatCurrency(valorRecebido)}</span>
        </div>
      ` : ''}
      ${troco && troco > 0 ? `
        <div class="flex bold large">
          <span>TROCO:</span>
          <span>${formatCurrency(troco)}</span>
        </div>
      ` : ''}

      ${nfce?.chave ? `
        <div class="separator">${separador}</div>
        <div class="center small">
          <div class="bold">CHAVE DE ACESSO</div>
          <div class="break-all">${nfce.chave}</div>
          ${nfce.protocolo ? `<div style="margin-top: 4px;">Protocolo: ${nfce.protocolo}</div>` : ''}
          <div style="margin-top: 4px;">Consulte em www.nfce.fazenda.gov.br</div>
        </div>
        <div class="qr-placeholder">[QR CODE]</div>
      ` : ''}

      <div class="separator">${separador}</div>

      <!-- Rodape -->
      <div class="center">
        <div class="bold" style="margin-top: 4px;">OBRIGADO PELA PREFERENCIA!</div>
        <div class="small" style="margin-top: 4px;">Volte sempre!</div>
        <div style="font-size: 8px; margin-top: 8px;">Imperio Sistemas</div>
      </div>

      <script>
        window.onload = function() {
          window.print();
        }
      </script>
    </body>
    </html>
  `

  const printWindow = window.open('', '_blank', 'width=400,height=600')
  if (printWindow) {
    printWindow.document.write(html)
    printWindow.document.close()
  }
}

export type { DadosRecibo, ItemRecibo, PagamentoRecibo }
