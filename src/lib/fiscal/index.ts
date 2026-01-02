// Exportações principais da biblioteca fiscal

export * from './types'
export * from './certificate'
export * from './xml/generator'
export * from './xml/signer'
export * from './sefaz'
export * from './utils'
export * from './danfe'

import { lerCertificadoA1, CertificadoA1 } from './certificate'
import { gerarXMLNFCe, gerarXMLNFe } from './xml/generator'
import { assinarXMLManual } from './xml/signer'
import { enviarParaSEFAZ, consultarStatusSEFAZ, consultarNFePorChave, cancelarNFe } from './sefaz'
import { NFCeData, NFeData, RetornoSEFAZ, ConfiguracaoFiscal, EmpresaFiscal } from './types'

export interface ResultadoEmissao {
  sucesso: boolean
  chave?: string
  protocolo?: string
  xml?: string
  mensagem: string
  codigo?: string
}

/**
 * Serviço principal de emissão fiscal
 */
export class ServicoFiscal {
  private certificado: CertificadoA1 | null = null
  private config: ConfiguracaoFiscal

  constructor(config: ConfiguracaoFiscal) {
    this.config = config
  }

  /**
   * Inicializa o certificado
   */
  async inicializar(pfxBase64: string, senha: string): Promise<void> {
    this.certificado = lerCertificadoA1(pfxBase64, senha)
  }

  /**
   * Verifica se o serviço está inicializado
   */
  estaInicializado(): boolean {
    return this.certificado !== null
  }

  /**
   * Emite NFC-e
   */
  async emitirNFCe(dados: Omit<NFCeData, 'tipo' | 'ambiente' | 'serie' | 'numero' | 'idToken' | 'csc'>): Promise<ResultadoEmissao> {
    if (!this.certificado) {
      return { sucesso: false, mensagem: 'Certificado não inicializado' }
    }

    try {
      // Prepara dados completos
      const dadosCompletos: NFCeData = {
        ...dados,
        tipo: 'nfce',
        ambiente: this.config.ambiente,
        serie: this.config.serieNFCe,
        numero: this.config.ultimoNumeroNFCe + 1,
        idToken: this.config.idTokenNFCe,
        csc: this.config.cscNFCe,
      }

      // Gera XML
      const { xml, chave } = gerarXMLNFCe(dadosCompletos)

      // Assina XML
      const xmlAssinado = assinarXMLManual(xml, this.certificado)

      // Envia para SEFAZ
      const retorno = await enviarParaSEFAZ({
        xmlAssinado,
        certificado: this.certificado,
        uf: this.config.uf,
        ambiente: this.config.ambiente,
        modelo: '65',
      })

      if (retorno.sucesso) {
        // Atualiza número da nota
        this.config.ultimoNumeroNFCe++
      }

      return {
        sucesso: retorno.sucesso,
        chave: retorno.chave || chave,
        protocolo: retorno.protocolo,
        xml: xmlAssinado,
        mensagem: retorno.mensagem,
        codigo: retorno.codigo,
      }
    } catch (error: any) {
      return {
        sucesso: false,
        mensagem: `Erro ao emitir NFC-e: ${error.message}`,
      }
    }
  }

  /**
   * Emite NF-e
   */
  async emitirNFe(dados: Omit<NFeData, 'tipo' | 'ambiente' | 'serie' | 'numero'>): Promise<ResultadoEmissao> {
    if (!this.certificado) {
      return { sucesso: false, mensagem: 'Certificado não inicializado' }
    }

    try {
      // Prepara dados completos
      const dadosCompletos: NFeData = {
        ...dados,
        tipo: 'nfe',
        ambiente: this.config.ambiente,
        serie: this.config.serieNFe,
        numero: this.config.ultimoNumeroNFe + 1,
      }

      // Gera XML
      const { xml, chave } = gerarXMLNFe(dadosCompletos)

      // Assina XML
      const xmlAssinado = assinarXMLManual(xml, this.certificado)

      // Envia para SEFAZ
      const retorno = await enviarParaSEFAZ({
        xmlAssinado,
        certificado: this.certificado,
        uf: this.config.uf,
        ambiente: this.config.ambiente,
        modelo: '55',
      })

      if (retorno.sucesso) {
        // Atualiza número da nota
        this.config.ultimoNumeroNFe++
      }

      return {
        sucesso: retorno.sucesso,
        chave: retorno.chave || chave,
        protocolo: retorno.protocolo,
        xml: xmlAssinado,
        mensagem: retorno.mensagem,
        codigo: retorno.codigo,
      }
    } catch (error: any) {
      return {
        sucesso: false,
        mensagem: `Erro ao emitir NF-e: ${error.message}`,
      }
    }
  }

  /**
   * Consulta status do serviço SEFAZ
   */
  async consultarStatus(modelo: '55' | '65' = '65'): Promise<{ online: boolean; mensagem: string }> {
    if (!this.certificado) {
      return { online: false, mensagem: 'Certificado não inicializado' }
    }

    return consultarStatusSEFAZ({
      certificado: this.certificado,
      uf: this.config.uf,
      ambiente: this.config.ambiente,
      modelo,
    })
  }

  /**
   * Consulta nota por chave
   */
  async consultarNota(chave: string, modelo: '55' | '65' = '65'): Promise<RetornoSEFAZ> {
    if (!this.certificado) {
      return { sucesso: false, codigo: 'ERRO', mensagem: 'Certificado não inicializado' }
    }

    return consultarNFePorChave({
      chave,
      certificado: this.certificado,
      uf: this.config.uf,
      ambiente: this.config.ambiente,
      modelo,
    })
  }

  /**
   * Cancela nota
   */
  async cancelarNota(chave: string, protocolo: string, justificativa: string, cnpj: string): Promise<RetornoSEFAZ> {
    if (!this.certificado) {
      return { sucesso: false, codigo: 'ERRO', mensagem: 'Certificado não inicializado' }
    }

    return cancelarNFe({
      chave,
      protocolo,
      justificativa,
      certificado: this.certificado,
      uf: this.config.uf,
      ambiente: this.config.ambiente,
      cnpj,
    })
  }

  /**
   * Retorna a configuração atual
   */
  getConfig(): ConfiguracaoFiscal {
    return { ...this.config }
  }

  /**
   * Atualiza a configuração
   */
  setConfig(config: Partial<ConfiguracaoFiscal>): void {
    this.config = { ...this.config, ...config }
  }
}
