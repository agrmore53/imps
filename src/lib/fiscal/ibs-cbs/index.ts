/**
 * Módulo IBS/CBS - Reforma Tributária
 * Conforme NT 2025.002 e LC 214/2025
 *
 * Obrigatório:
 * - Lucro Real/Presumido: a partir de 01/01/2026
 * - Simples Nacional: a partir de 01/01/2027
 */

import { ALIQUOTAS_IBS_CBS, CstIbsCbs, TributacaoIBSCBS, TotaisIBSCBS } from '../types'

/**
 * Obtém as alíquotas IBS/CBS para o ano corrente
 */
export function getAliquotasAno(ano?: number): { ibs: number; cbs: number } {
  const anoAtual = ano || new Date().getFullYear()
  return ALIQUOTAS_IBS_CBS[anoAtual] || ALIQUOTAS_IBS_CBS[2033] // Default para alíquotas finais
}

/**
 * Calcula IBS/CBS para um item
 */
export function calcularIBSCBS(params: {
  valorBase: number
  cst?: CstIbsCbs
  cClassTrib?: string
  aliquotaIBS?: number
  aliquotaCBS?: number
  ano?: number
}): TributacaoIBSCBS {
  const { valorBase, cst = '00', cClassTrib, ano } = params

  // Obtém alíquotas do ano ou usa as fornecidas
  const aliquotasAno = getAliquotasAno(ano)
  const pIBS = params.aliquotaIBS ?? aliquotasAno.ibs
  const pCBS = params.aliquotaCBS ?? aliquotasAno.cbs

  // CSTs que não tributam
  const cstsSemTributacao: CstIbsCbs[] = ['20', '30', '40', '50', '60']
  const tributar = !cstsSemTributacao.includes(cst)

  // Calcula valores
  const vIBS = tributar ? Number((valorBase * pIBS / 100).toFixed(2)) : 0
  const vCBS = tributar ? Number((valorBase * pCBS / 100).toFixed(2)) : 0

  return {
    cst,
    cClassTrib,
    vBC: valorBase,
    pIBS: tributar ? pIBS : 0,
    pCBS: tributar ? pCBS : 0,
    vIBS,
    vCBS,
  }
}

/**
 * Calcula totais IBS/CBS de uma lista de itens
 */
export function calcularTotaisIBSCBS(itens: TributacaoIBSCBS[]): TotaisIBSCBS {
  const totais = itens.reduce(
    (acc, item) => ({
      vBCIBS: acc.vBCIBS + item.vBC,
      vIBS: acc.vIBS + item.vIBS,
      vBCCBS: acc.vBCCBS + item.vBC,
      vCBS: acc.vCBS + item.vCBS,
    }),
    { vBCIBS: 0, vIBS: 0, vBCCBS: 0, vCBS: 0 }
  )

  return {
    ...totais,
    vBCIBS: Number(totais.vBCIBS.toFixed(2)),
    vIBS: Number(totais.vIBS.toFixed(2)),
    vBCCBS: Number(totais.vBCCBS.toFixed(2)),
    vCBS: Number(totais.vCBS.toFixed(2)),
    vTotTrib: Number((totais.vIBS + totais.vCBS).toFixed(2)),
  }
}

/**
 * Gera XML do grupo IBSCBS para um item
 * Conforme NT 2025.002
 */
export function gerarXMLIBSCBS(tributacao: TributacaoIBSCBS): string {
  if (!tributacao) return ''

  let xml = '<IBSCBS>'
  xml += `<CST>${tributacao.cst}</CST>`

  if (tributacao.cClassTrib) {
    xml += `<cClassTrib>${tributacao.cClassTrib}</cClassTrib>`
  }

  xml += `<vBC>${tributacao.vBC.toFixed(2)}</vBC>`
  xml += `<pIBS>${tributacao.pIBS.toFixed(4)}</pIBS>`
  xml += `<pCBS>${tributacao.pCBS.toFixed(4)}</pCBS>`
  xml += `<vIBS>${tributacao.vIBS.toFixed(2)}</vIBS>`
  xml += `<vCBS>${tributacao.vCBS.toFixed(2)}</vCBS>`
  xml += '</IBSCBS>'

  return xml
}

/**
 * Gera XML do grupo de totais IBS/CBS (W03)
 * Conforme NT 2025.002
 */
export function gerarXMLTotaisIBSCBS(totais: TotaisIBSCBS): string {
  if (!totais) return ''

  let xml = '<IBSCBSTot>'
  xml += `<vBCIBS>${totais.vBCIBS.toFixed(2)}</vBCIBS>`
  xml += `<vIBS>${totais.vIBS.toFixed(2)}</vIBS>`
  xml += `<vBCCBS>${totais.vBCCBS.toFixed(2)}</vBCCBS>`
  xml += `<vCBS>${totais.vCBS.toFixed(2)}</vCBS>`
  xml += `<vTotTrib>${totais.vTotTrib.toFixed(2)}</vTotTrib>`
  xml += '</IBSCBSTot>'

  return xml
}

/**
 * Verifica se IBS/CBS é obrigatório para o CRT e ano
 */
export function isIBSCBSObrigatorio(crt: 1 | 2 | 3, ano?: number): boolean {
  const anoAtual = ano || new Date().getFullYear()

  // Simples Nacional (CRT 1 e 2): obrigatório a partir de 2027
  if (crt === 1 || crt === 2) {
    return anoAtual >= 2027
  }

  // Lucro Real/Presumido (CRT 3): obrigatório a partir de 2026
  return anoAtual >= 2026
}

/**
 * Verifica se é nota de devolução (pode exigir IBS/CBS mesmo do Simples)
 */
export function isNotaDevolucao(finalidade: number): boolean {
  return finalidade === 4 // Devolução de Mercadoria
}

/**
 * Verifica se deve incluir IBS/CBS na nota
 */
export function deveIncluirIBSCBS(params: {
  crt: 1 | 2 | 3
  finalidade?: number
  habilitadoManualmente?: boolean
  incluirEmDevolucao?: boolean
  ano?: number
}): boolean {
  const { crt, finalidade, habilitadoManualmente, incluirEmDevolucao, ano } = params

  // Se habilitado manualmente, inclui
  if (habilitadoManualmente) return true

  // Se é obrigatório pelo CRT/ano, inclui
  if (isIBSCBSObrigatorio(crt, ano)) return true

  // Se é devolução e configurado para incluir, inclui
  if (finalidade && isNotaDevolucao(finalidade) && incluirEmDevolucao) return true

  return false
}
