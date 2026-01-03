'use client'

import { useEffect, useState } from 'react'
import { QrCodePix } from 'qrcode-pix'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { CheckCircle, Loader2, QrCode } from 'lucide-react'
import { formatarChavePix, validarChavePix } from '@/lib/utils/pix'

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
  const [loading, setLoading] = useState(true)
  const [chaveConfigurada, setChaveConfigurada] = useState(!!chavePix)

  // Formatar valor para exibição
  const valorFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor)

  // Gerar QR Code usando biblioteca validada
  useEffect(() => {
    async function gerarQRCode() {
      if (!chavePix) {
        setLoading(false)
        setChaveConfigurada(false)
        return
      }

      setLoading(true)
      setChaveConfigurada(true)

      try {
        // Normalizar chave para telefone se necessário
        let chaveNormalizada = chavePix.replace(/\s/g, '')

        // Se for celular brasileiro (11 dígitos começando com 9 após DDD), adicionar +55
        if (/^\d{11}$/.test(chaveNormalizada)) {
          const ddd = parseInt(chaveNormalizada.substring(0, 2))
          const terceiroDigito = chaveNormalizada.charAt(2)
          if (ddd >= 11 && ddd <= 99 && terceiroDigito === '9') {
            chaveNormalizada = '+55' + chaveNormalizada
          }
        }

        // Remover acentos do nome e cidade
        const nomeNormalizado = beneficiario
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9 ]/g, '')
          .substring(0, 25)

        const cidadeNormalizada = cidade
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9 ]/g, '')
          .substring(0, 15)

        // Usar biblioteca qrcode-pix (validada pela comunidade)
        const qrCodePix = QrCodePix({
          version: '01',
          key: chaveNormalizada,
          name: nomeNormalizado,
          city: cidadeNormalizada,
          transactionId: txid?.replace(/[^a-zA-Z0-9]/g, '').substring(0, 25) || '***',
          value: valor,
        })

        // Gerar imagem QR Code usando a biblioteca
        const base64 = await qrCodePix.base64()
        setQrCodeUrl(base64)
      } catch (error) {
        console.error('Erro ao gerar QR Code:', error)
        toast.error('Erro ao gerar QR Code PIX')
      } finally {
        setLoading(false)
      }
    }

    gerarQRCode()
  }, [chavePix, beneficiario, cidade, valor, txid])

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
    <div className="flex flex-col items-center py-2 sm:py-4">
      {/* Valor */}
      <div className="text-center mb-2 sm:mb-4">
        <p className="text-xs sm:text-sm text-muted-foreground">Valor a pagar</p>
        <p className="text-2xl sm:text-3xl font-bold text-primary">{valorFormatado}</p>
      </div>

      {/* QR Code */}
      <div className="bg-white p-2 sm:p-4 rounded-lg shadow-sm mb-3">
        {loading ? (
          <div className="w-40 h-40 sm:w-52 sm:h-52 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : qrCodeUrl ? (
          <img
            src={qrCodeUrl}
            alt="QR Code PIX"
            className="w-40 h-40 sm:w-52 sm:h-52"
          />
        ) : (
          <div className="w-40 h-40 sm:w-52 sm:h-52 flex items-center justify-center bg-muted rounded">
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

      {/* Instruções */}
      <div className="text-xs text-muted-foreground text-center">
        <p>Escaneie o QR Code com o app do banco</p>
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
