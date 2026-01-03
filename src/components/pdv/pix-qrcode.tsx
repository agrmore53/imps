'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Copy, CheckCircle, Loader2, QrCode, RefreshCw } from 'lucide-react'
import { gerarPayloadPix, formatarChavePix, validarChavePix } from '@/lib/utils/pix'

interface PixQRCodeProps {
  valor: number
  chavePix?: string
  beneficiario?: string
  cidade?: string
  txid?: string
  onPagamentoConfirmado?: () => void
}

export function PixQRCode({
  valor,
  chavePix,
  beneficiario = 'EMPRESA',
  cidade = 'CIDADE',
  txid,
  onPagamentoConfirmado,
}: PixQRCodeProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('')
  const [pixPayload, setPixPayload] = useState<string>('')
  const [copiado, setCopiado] = useState(false)
  const [loading, setLoading] = useState(true)
  const [chaveConfigurada, setChaveConfigurada] = useState(!!chavePix)

  // Formatar valor para exibição
  const valorFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor)

  // Gerar QR Code
  useEffect(() => {
    async function gerarQRCode() {
      if (!chavePix || !validarChavePix(chavePix)) {
        setLoading(false)
        setChaveConfigurada(false)
        return
      }

      setLoading(true)
      setChaveConfigurada(true)

      try {
        // Gerar payload PIX
        const payload = gerarPayloadPix({
          chavePix,
          beneficiario,
          cidade,
          valor,
          txid: txid || `PDV${Date.now()}`,
        })

        setPixPayload(payload)

        // Gerar imagem QR Code
        const url = await QRCode.toDataURL(payload, {
          width: 256,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
          errorCorrectionLevel: 'M',
        })

        setQrCodeUrl(url)
      } catch (error) {
        console.error('Erro ao gerar QR Code:', error)
        toast.error('Erro ao gerar QR Code PIX')
      } finally {
        setLoading(false)
      }
    }

    gerarQRCode()
  }, [chavePix, beneficiario, cidade, valor, txid])

  // Copiar código PIX
  async function copiarPix() {
    if (!pixPayload) return

    try {
      await navigator.clipboard.writeText(pixPayload)
      setCopiado(true)
      toast.success('Código PIX copiado!')
      setTimeout(() => setCopiado(false), 3000)
    } catch (error) {
      toast.error('Erro ao copiar código')
    }
  }

  // Se não tem chave configurada
  if (!chaveConfigurada && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <QrCode className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="font-semibold text-lg mb-2">Chave PIX não configurada</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Configure a chave PIX da empresa nas configurações para habilitar pagamentos via PIX.
        </p>
        <Button variant="outline" asChild>
          <a href="/dashboard/configuracoes">Configurar PIX</a>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center py-4">
      {/* Valor */}
      <div className="text-center mb-4">
        <p className="text-sm text-muted-foreground">Valor a pagar</p>
        <p className="text-3xl font-bold text-primary">{valorFormatado}</p>
      </div>

      {/* QR Code */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
        {loading ? (
          <div className="w-64 h-64 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : qrCodeUrl ? (
          <img
            src={qrCodeUrl}
            alt="QR Code PIX"
            className="w-64 h-64"
          />
        ) : (
          <div className="w-64 h-64 flex items-center justify-center bg-muted rounded">
            <p className="text-sm text-muted-foreground">Erro ao gerar QR Code</p>
          </div>
        )}
      </div>

      {/* Informações */}
      {chavePix && (
        <div className="text-center mb-4">
          <p className="text-xs text-muted-foreground">
            {formatarChavePix(chavePix).tipo}: {formatarChavePix(chavePix).formatada}
          </p>
          <p className="text-xs text-muted-foreground">{beneficiario}</p>
        </div>
      )}

      {/* Botão Copiar */}
      <Button
        variant="outline"
        className="w-full mb-3"
        onClick={copiarPix}
        disabled={!pixPayload || loading}
      >
        {copiado ? (
          <>
            <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
            Copiado!
          </>
        ) : (
          <>
            <Copy className="h-4 w-4 mr-2" />
            Copiar código PIX
          </>
        )}
      </Button>

      {/* Instruções */}
      <div className="text-xs text-muted-foreground text-center space-y-1">
        <p>1. Abra o app do seu banco</p>
        <p>2. Escolha pagar com PIX</p>
        <p>3. Escaneie o QR Code ou cole o código</p>
      </div>

      {/* Botão confirmar pagamento */}
      {onPagamentoConfirmado && (
        <Button
          className="w-full mt-4"
          onClick={onPagamentoConfirmado}
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Confirmar Pagamento Recebido
        </Button>
      )}
    </div>
  )
}

// Componente para configurar chave PIX
interface PixConfigProps {
  chavePix: string
  onChange: (chave: string) => void
}

export function PixConfig({ chavePix, onChange }: PixConfigProps) {
  const [chave, setChave] = useState(chavePix)
  const [valida, setValida] = useState(false)

  useEffect(() => {
    setValida(validarChavePix(chave))
  }, [chave])

  function handleSave() {
    if (valida) {
      onChange(chave)
      toast.success('Chave PIX salva!')
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="chave-pix">Chave PIX</Label>
        <Input
          id="chave-pix"
          placeholder="CPF, CNPJ, email, telefone ou chave aleatória"
          value={chave}
          onChange={(e) => setChave(e.target.value)}
        />
        {chave && (
          <p className={`text-xs ${valida ? 'text-green-600' : 'text-red-600'}`}>
            {valida
              ? `✓ ${formatarChavePix(chave).tipo} válido`
              : '✗ Chave PIX inválida'}
          </p>
        )}
      </div>
      <Button onClick={handleSave} disabled={!valida} className="w-full">
        Salvar Chave PIX
      </Button>
    </div>
  )
}
