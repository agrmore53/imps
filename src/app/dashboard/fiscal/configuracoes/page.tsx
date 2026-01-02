'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import {
  Loader2,
  Save,
  FileKey,
  Building2,
  Settings,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Shield,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react'

interface ConfigFiscal {
  ambiente?: number
  crt?: number
  serie_nfce?: number
  serie_nfe?: number
  ultimo_numero_nfce?: number
  ultimo_numero_nfe?: number
  id_token_nfce?: number
  csc_nfce?: string
  cfop_venda?: string
  cfop_venda_nfe?: string
  certificado_base64?: string
  certificado_senha?: string
  certificado_validade?: string
  certificado_nome?: string
}

interface Empresa {
  id: string
  razao_social: string
  nome_fantasia?: string
  cnpj: string
  inscricao_estadual?: string
  endereco?: {
    uf?: string
  }
  config_fiscal?: ConfigFiscal
}

interface StatusSEFAZ {
  nfce: { online: boolean; mensagem: string }
  nfe: { online: boolean; mensagem: string }
  ambiente?: string
  uf?: string
}

export default function ConfiguracoesFiscaisPage() {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingCert, setUploadingCert] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(false)
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [statusSEFAZ, setStatusSEFAZ] = useState<StatusSEFAZ | null>(null)

  const [formData, setFormData] = useState({
    crt: '1',
    ambiente: '2',
    serie_nfce: '1',
    ultimo_numero_nfce: '0',
    serie_nfe: '1',
    ultimo_numero_nfe: '0',
    id_token_nfce: '1',
    csc_nfce: '',
    cfop_venda: '5102',
    cfop_venda_nfe: '5102',
  })

  const [certificadoSenha, setCertificadoSenha] = useState('')
  const [certificadoInfo, setCertificadoInfo] = useState({
    configurado: false,
    validade: null as string | null,
    nome: null as string | null,
  })

  useEffect(() => {
    carregarDados()
  }, [])

  async function carregarDados() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: userData } = await supabase
        .from('usuarios')
        .select('empresa_id')
        .eq('auth_id', user.id)
        .single()

      if (!userData?.empresa_id) return

      const { data: empresaData, error } = await supabase
        .from('empresas')
        .select('id, razao_social, nome_fantasia, cnpj, inscricao_estadual, endereco, config_fiscal')
        .eq('id', userData.empresa_id)
        .single()

      if (error) throw error

      if (empresaData) {
        setEmpresa(empresaData)
        const config = empresaData.config_fiscal || {}
        setFormData({
          crt: config.crt?.toString() || '1',
          ambiente: config.ambiente?.toString() || '2',
          serie_nfce: config.serie_nfce?.toString() || '1',
          ultimo_numero_nfce: config.ultimo_numero_nfce?.toString() || '0',
          serie_nfe: config.serie_nfe?.toString() || '1',
          ultimo_numero_nfe: config.ultimo_numero_nfe?.toString() || '0',
          id_token_nfce: config.id_token_nfce?.toString() || '1',
          csc_nfce: config.csc_nfce || '',
          cfop_venda: config.cfop_venda || '5102',
          cfop_venda_nfe: config.cfop_venda_nfe || '5102',
        })
        setCertificadoInfo({
          configurado: !!config.certificado_base64,
          validade: config.certificado_validade || null,
          nome: config.certificado_nome || null,
        })
      }
    } catch (error) {
      toast.error('Erro ao carregar configurações')
    } finally {
      setLoading(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!empresa) {
      toast.error('Empresa não encontrada')
      return
    }

    setSaving(true)

    try {
      const config_fiscal: ConfigFiscal = {
        ...(empresa.config_fiscal || {}),
        crt: parseInt(formData.crt) || 1,
        ambiente: parseInt(formData.ambiente) as 1 | 2,
        serie_nfce: parseInt(formData.serie_nfce) || 1,
        ultimo_numero_nfce: parseInt(formData.ultimo_numero_nfce) || 0,
        serie_nfe: parseInt(formData.serie_nfe) || 1,
        ultimo_numero_nfe: parseInt(formData.ultimo_numero_nfe) || 0,
        id_token_nfce: parseInt(formData.id_token_nfce) || 1,
        csc_nfce: formData.csc_nfce,
        cfop_venda: formData.cfop_venda,
        cfop_venda_nfe: formData.cfop_venda_nfe,
      }

      const { error } = await supabase
        .from('empresas')
        .update({ config_fiscal })
        .eq('id', empresa.id)

      if (error) throw error

      setEmpresa(prev => prev ? { ...prev, config_fiscal } : null)
      toast.success('Configurações salvas com sucesso!')
    } catch (error: any) {
      toast.error('Erro ao salvar configurações', {
        description: error.message,
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleCertificadoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!certificadoSenha) {
      toast.error('Digite a senha do certificado')
      return
    }

    if (!empresa) {
      toast.error('Empresa não encontrada')
      return
    }

    setUploadingCert(true)

    try {
      // Lê o arquivo como base64
      const reader = new FileReader()
      reader.onload = async (event) => {
        try {
          const base64 = (event.target?.result as string).split(',')[1]

          // Salva o certificado na configuração fiscal
          const config_fiscal: ConfigFiscal = {
            ...(empresa.config_fiscal || {}),
            certificado_base64: base64,
            certificado_senha: certificadoSenha, // Em produção, criptografar!
            certificado_nome: file.name,
          }

          const { error } = await supabase
            .from('empresas')
            .update({ config_fiscal })
            .eq('id', empresa.id)

          if (error) throw error

          setEmpresa(prev => prev ? { ...prev, config_fiscal } : null)
          setCertificadoInfo({
            configurado: true,
            validade: null,
            nome: file.name,
          })
          setCertificadoSenha('')
          toast.success('Certificado enviado com sucesso!')

          // Testa consulta de status
          await consultarStatusSEFAZ()
        } catch (error: any) {
          toast.error('Erro ao salvar certificado', {
            description: error.message,
          })
        } finally {
          setUploadingCert(false)
        }
      }
      reader.onerror = () => {
        toast.error('Erro ao ler arquivo')
        setUploadingCert(false)
      }
      reader.readAsDataURL(file)
    } catch (error: any) {
      toast.error('Erro ao processar certificado', {
        description: error.message,
      })
      setUploadingCert(false)
    }

    // Limpa o input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function consultarStatusSEFAZ() {
    setCheckingStatus(true)
    try {
      const response = await fetch('/api/fiscal/status')
      const data = await response.json()

      if (response.ok) {
        setStatusSEFAZ(data)
        if (data.nfce?.online && data.nfe?.online) {
          toast.success('SEFAZ online!')
        } else if (data.nfce?.online || data.nfe?.online) {
          toast.warning('SEFAZ parcialmente online')
        } else {
          toast.error('SEFAZ offline ou erro de conexão')
        }
      } else {
        toast.error('Erro ao consultar status', {
          description: data.error,
        })
      }
    } catch (error: any) {
      toast.error('Erro ao consultar SEFAZ', {
        description: error.message,
      })
    } finally {
      setCheckingStatus(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configurações Fiscais</h1>
          <p className="text-muted-foreground">
            Configure os parâmetros para emissão de NFC-e e NF-e
          </p>
        </div>
        <Button
          variant="outline"
          onClick={consultarStatusSEFAZ}
          disabled={checkingStatus || !certificadoInfo.configurado}
        >
          {checkingStatus ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Testar Conexão SEFAZ
        </Button>
      </div>

      {/* Status SEFAZ */}
      {statusSEFAZ && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className={statusSEFAZ.nfce?.online ? 'border-green-500' : 'border-red-500'}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                {statusSEFAZ.nfce?.online ? (
                  <Wifi className="h-5 w-5 text-green-500" />
                ) : (
                  <WifiOff className="h-5 w-5 text-red-500" />
                )}
                <div>
                  <p className="font-medium">NFC-e (Modelo 65)</p>
                  <p className="text-sm text-muted-foreground">{statusSEFAZ.nfce?.mensagem}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={statusSEFAZ.nfe?.online ? 'border-green-500' : 'border-red-500'}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                {statusSEFAZ.nfe?.online ? (
                  <Wifi className="h-5 w-5 text-green-500" />
                ) : (
                  <WifiOff className="h-5 w-5 text-red-500" />
                )}
                <div>
                  <p className="font-medium">NF-e (Modelo 55)</p>
                  <p className="text-sm text-muted-foreground">{statusSEFAZ.nfe?.mensagem}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Tabs defaultValue="geral" className="space-y-4">
          <TabsList>
            <TabsTrigger value="geral">
              <Settings className="mr-2 h-4 w-4" />
              Geral
            </TabsTrigger>
            <TabsTrigger value="certificado">
              <FileKey className="mr-2 h-4 w-4" />
              Certificado
            </TabsTrigger>
            <TabsTrigger value="nfce">
              <Building2 className="mr-2 h-4 w-4" />
              NFC-e
            </TabsTrigger>
            <TabsTrigger value="nfe">
              <Building2 className="mr-2 h-4 w-4" />
              NF-e
            </TabsTrigger>
          </TabsList>

          {/* Configurações Gerais */}
          <TabsContent value="geral">
            <Card>
              <CardHeader>
                <CardTitle>Configurações Gerais</CardTitle>
                <CardDescription>
                  Regime tributário e ambiente de emissão
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="crt">Regime Tributário (CRT)</Label>
                    <select
                      id="crt"
                      name="crt"
                      value={formData.crt}
                      onChange={handleChange}
                      disabled={saving}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="1">1 - Simples Nacional</option>
                      <option value="2">2 - Simples Nacional - Excesso sublimite</option>
                      <option value="3">3 - Regime Normal</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ambiente">Ambiente de Emissão</Label>
                    <select
                      id="ambiente"
                      name="ambiente"
                      value={formData.ambiente}
                      onChange={handleChange}
                      disabled={saving}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="2">2 - Homologação (Testes)</option>
                      <option value="1">1 - Produção</option>
                    </select>
                  </div>
                </div>

                {formData.ambiente === '2' && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-md border border-yellow-200 dark:border-yellow-800">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      <p className="font-medium text-yellow-800 dark:text-yellow-200">
                        Ambiente de Homologação
                      </p>
                    </div>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      As notas emitidas em homologação não possuem validade fiscal. Use apenas para testes.
                    </p>
                  </div>
                )}

                {formData.ambiente === '1' && (
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-md border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <p className="font-medium text-green-800 dark:text-green-200">
                        Ambiente de Produção
                      </p>
                    </div>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                      As notas terão validade fiscal e serão transmitidas oficialmente para a SEFAZ.
                    </p>
                  </div>
                )}

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Dados da Empresa</h4>
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Razão Social:</span>
                      <span className="font-medium">{empresa?.razao_social || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CNPJ:</span>
                      <span className="font-mono">{empresa?.cnpj || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Inscrição Estadual:</span>
                      <span className="font-mono">{empresa?.inscricao_estadual || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">UF:</span>
                      <span>{empresa?.endereco?.uf || 'SC'}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Certificado Digital */}
          <TabsContent value="certificado">
            <Card>
              <CardHeader>
                <CardTitle>Certificado Digital A1</CardTitle>
                <CardDescription>
                  O certificado digital é obrigatório para emissão de notas fiscais
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Status do Certificado */}
                <div className={`p-4 rounded-md border ${
                  certificadoInfo.configurado
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                }`}>
                  <div className="flex items-center gap-2">
                    {certificadoInfo.configurado ? (
                      <Shield className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    )}
                    <p className={`font-medium ${
                      certificadoInfo.configurado
                        ? 'text-green-800 dark:text-green-200'
                        : 'text-red-800 dark:text-red-200'
                    }`}>
                      {certificadoInfo.configurado ? 'Certificado Configurado' : 'Certificado Não Configurado'}
                    </p>
                  </div>
                  {certificadoInfo.configurado && certificadoInfo.nome && (
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                      Arquivo: {certificadoInfo.nome}
                    </p>
                  )}
                  {certificadoInfo.validade && (
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Válido até: {new Date(certificadoInfo.validade).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                  {!certificadoInfo.configurado && (
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                      Faça o upload do certificado A1 (.pfx) para habilitar a emissão fiscal.
                    </p>
                  )}
                </div>

                {/* Upload de Certificado */}
                <div className="border-2 border-dashed rounded-lg p-8">
                  <div className="text-center">
                    <FileKey className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-medium mb-2">
                      {certificadoInfo.configurado ? 'Substituir Certificado A1' : 'Upload do Certificado A1'}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Selecione o arquivo .pfx do seu certificado digital
                    </p>
                  </div>

                  <div className="max-w-md mx-auto space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="certificado_senha">Senha do Certificado</Label>
                      <Input
                        id="certificado_senha"
                        type="password"
                        placeholder="Digite a senha do certificado"
                        value={certificadoSenha}
                        onChange={(e) => setCertificadoSenha(e.target.value)}
                        disabled={uploadingCert}
                      />
                    </div>

                    <div className="flex justify-center">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pfx,.p12"
                        onChange={handleCertificadoUpload}
                        className="hidden"
                        id="certificado_file"
                        disabled={uploadingCert || !certificadoSenha}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingCert || !certificadoSenha}
                      >
                        {uploadingCert ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Selecionar Arquivo
                          </>
                        )}
                      </Button>
                    </div>

                    <p className="text-xs text-muted-foreground text-center">
                      Apenas certificados do tipo A1 (arquivo .pfx ou .p12) são suportados
                    </p>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <strong>Segurança:</strong> O certificado é armazenado de forma segura no banco de dados.
                    A senha é necessária para assinar as notas fiscais.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Configurações NFC-e */}
          <TabsContent value="nfce">
            <Card>
              <CardHeader>
                <CardTitle>Configurações NFC-e</CardTitle>
                <CardDescription>
                  Parâmetros para emissão de Nota Fiscal de Consumidor Eletrônica (Modelo 65)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="serie_nfce">Série</Label>
                    <Input
                      id="serie_nfce"
                      name="serie_nfce"
                      type="number"
                      min="1"
                      placeholder="1"
                      value={formData.serie_nfce}
                      onChange={handleChange}
                      disabled={saving}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ultimo_numero_nfce">Último Número</Label>
                    <Input
                      id="ultimo_numero_nfce"
                      name="ultimo_numero_nfce"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={formData.ultimo_numero_nfce}
                      onChange={handleChange}
                      disabled={saving}
                    />
                    <p className="text-xs text-muted-foreground">
                      A próxima NFC-e será: {(parseInt(formData.ultimo_numero_nfce) || 0) + 1}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cfop_venda">CFOP Venda</Label>
                    <select
                      id="cfop_venda"
                      name="cfop_venda"
                      value={formData.cfop_venda}
                      onChange={handleChange}
                      disabled={saving}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="5102">5102 - Venda merc. adq. terceiros</option>
                      <option value="5101">5101 - Venda prod. estabelecimento</option>
                      <option value="5405">5405 - Venda merc. ST</option>
                    </select>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-4">CSC (Código de Segurança do Contribuinte)</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    O CSC é obtido no portal da SEFAZ do seu estado e é obrigatório para NFC-e
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="id_token_nfce">ID do Token</Label>
                      <Input
                        id="id_token_nfce"
                        name="id_token_nfce"
                        type="number"
                        min="1"
                        placeholder="1"
                        value={formData.id_token_nfce}
                        onChange={handleChange}
                        disabled={saving}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="csc_nfce">CSC (Token)</Label>
                      <Input
                        id="csc_nfce"
                        name="csc_nfce"
                        type="password"
                        placeholder="Código de Segurança"
                        value={formData.csc_nfce}
                        onChange={handleChange}
                        disabled={saving}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Configurações NF-e */}
          <TabsContent value="nfe">
            <Card>
              <CardHeader>
                <CardTitle>Configurações NF-e</CardTitle>
                <CardDescription>
                  Parâmetros para emissão de Nota Fiscal Eletrônica (Modelo 55)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="serie_nfe">Série</Label>
                    <Input
                      id="serie_nfe"
                      name="serie_nfe"
                      type="number"
                      min="1"
                      placeholder="1"
                      value={formData.serie_nfe}
                      onChange={handleChange}
                      disabled={saving}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ultimo_numero_nfe">Último Número</Label>
                    <Input
                      id="ultimo_numero_nfe"
                      name="ultimo_numero_nfe"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={formData.ultimo_numero_nfe}
                      onChange={handleChange}
                      disabled={saving}
                    />
                    <p className="text-xs text-muted-foreground">
                      A próxima NF-e será: {(parseInt(formData.ultimo_numero_nfe) || 0) + 1}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cfop_venda_nfe">CFOP Venda</Label>
                    <select
                      id="cfop_venda_nfe"
                      name="cfop_venda_nfe"
                      value={formData.cfop_venda_nfe}
                      onChange={handleChange}
                      disabled={saving}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="5102">5102 - Venda merc. adq. terceiros</option>
                      <option value="5101">5101 - Venda prod. estabelecimento</option>
                      <option value="5405">5405 - Venda merc. ST</option>
                      <option value="6102">6102 - Venda interestadual</option>
                      <option value="6101">6101 - Venda interestadual (produção)</option>
                    </select>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-md border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    <strong>Importante:</strong> A numeração é sequencial e não pode ter lacunas.
                    Antes de alterar, certifique-se de que os números anteriores foram utilizados ou inutilizados.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end mt-6">
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salvar Configurações
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
