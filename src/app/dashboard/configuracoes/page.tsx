'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Loader2, Building2, MapPin, FileText, Save, Search, Settings, AlertTriangle, RotateCcw, Key, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { validarCNPJ, formatarCNPJ, formatarTelefone, formatarCEP } from '@/lib/utils/validators'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface Empresa {
  id: string
  razao_social: string
  nome_fantasia: string | null
  cnpj: string
  ie: string | null
  telefone: string | null
  email: string | null
  endereco: {
    cep: string
    logradouro: string
    numero: string
    complemento: string
    bairro: string
    cidade: string
    uf: string
  } | null
  config_fiscal: {
    regime_tributario: string
    ambiente: string
    serie_nfce: string
    numero_nfce: number
    serie_nfe: string
    numero_nfe: number
  } | null
}

export default function ConfiguracoesPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [buscandoCnpj, setBuscandoCnpj] = useState(false)
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [restaurando, setRestaurando] = useState(false)
  const [confirmacaoTexto, setConfirmacaoTexto] = useState('')
  const [senhaConfirmacao, setSenhaConfirmacao] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [limparDadosEmpresa, setLimparDadosEmpresa] = useState(false)

  // Estados para senha mestre
  const [temSenhaMestre, setTemSenhaMestre] = useState(false)
  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenhaMestre, setNovaSenhaMestre] = useState('')
  const [confirmarSenhaMestre, setConfirmarSenhaMestre] = useState('')
  const [salvandoSenhaMestre, setSalvandoSenhaMestre] = useState(false)
  const [mostrarSenhaAtual, setMostrarSenhaAtual] = useState(false)
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false)

  const [formData, setFormData] = useState({
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    ie: '',
    telefone: '',
    email: '',
    // Endereço
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    // Fiscal
    regime_tributario: '1',
    ambiente: '2', // 1 = Produção, 2 = Homologação
    serie_nfce: '1',
    numero_nfce: '1',
    serie_nfe: '1',
    numero_nfe: '1',
    // PIX
    chave_pix: '',
  })

  useEffect(() => {
    carregarEmpresa()
    verificarSenhaMestre()
  }, [])

  async function verificarSenhaMestre() {
    try {
      const response = await fetch('/api/senha-mestre')
      if (response.ok) {
        const data = await response.json()
        setTemSenhaMestre(data.temSenhaMestre)
      }
    } catch (error) {
      console.error('Erro ao verificar senha mestre:', error)
    }
  }

  async function handleSalvarSenhaMestre() {
    if (novaSenhaMestre.length < 6) {
      toast.error('A senha mestre deve ter pelo menos 6 caracteres')
      return
    }

    if (novaSenhaMestre !== confirmarSenhaMestre) {
      toast.error('As senhas não conferem')
      return
    }

    if (temSenhaMestre && !senhaAtual) {
      toast.error('Informe a senha mestre atual')
      return
    }

    setSalvandoSenhaMestre(true)
    try {
      const response = await fetch('/api/senha-mestre', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senhaAtual: temSenhaMestre ? senhaAtual : undefined,
          novaSenha: novaSenhaMestre,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao salvar senha mestre')
      }

      toast.success(data.message)
      setTemSenhaMestre(true)
      setSenhaAtual('')
      setNovaSenhaMestre('')
      setConfirmarSenhaMestre('')
    } catch (error: any) {
      toast.error('Erro ao salvar senha mestre', {
        description: error.message,
      })
    } finally {
      setSalvandoSenhaMestre(false)
    }
  }

  async function carregarEmpresa() {
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
        .select('*')
        .eq('id', userData.empresa_id)
        .single()

      if (error) throw error

      if (empresaData) {
        setEmpresa(empresaData)
        setFormData({
          razao_social: empresaData.razao_social || '',
          nome_fantasia: empresaData.nome_fantasia || '',
          cnpj: formatarCNPJ(empresaData.cnpj || ''),
          ie: empresaData.ie || '',
          telefone: formatarTelefone(empresaData.telefone || ''),
          email: empresaData.email || '',
          // Endereço
          cep: formatarCEP(empresaData.endereco?.cep || ''),
          logradouro: empresaData.endereco?.logradouro || '',
          numero: empresaData.endereco?.numero || '',
          complemento: empresaData.endereco?.complemento || '',
          bairro: empresaData.endereco?.bairro || '',
          cidade: empresaData.endereco?.cidade || '',
          uf: empresaData.endereco?.uf || '',
          // Fiscal
          regime_tributario: empresaData.config_fiscal?.regime_tributario || '1',
          ambiente: empresaData.config_fiscal?.ambiente || '2',
          serie_nfce: empresaData.config_fiscal?.serie_nfce || '1',
          numero_nfce: empresaData.config_fiscal?.numero_nfce?.toString() || '1',
          serie_nfe: empresaData.config_fiscal?.serie_nfe || '1',
          numero_nfe: empresaData.config_fiscal?.numero_nfe?.toString() || '1',
          // PIX
          chave_pix: empresaData.config_fiscal?.chave_pix || '',
        })
      }
    } catch (error) {
      toast.error('Erro ao carregar dados da empresa')
    } finally {
      setLoading(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target

    if (name === 'cnpj') {
      setFormData(prev => ({ ...prev, [name]: formatarCNPJ(value) }))
    } else if (name === 'telefone') {
      setFormData(prev => ({ ...prev, [name]: formatarTelefone(value) }))
    } else if (name === 'cep') {
      setFormData(prev => ({ ...prev, [name]: formatarCEP(value) }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  async function buscarCNPJ() {
    const cnpj = formData.cnpj.replace(/\D/g, '')
    if (cnpj.length !== 14) {
      toast.error('CNPJ inválido')
      return
    }

    if (!validarCNPJ(cnpj)) {
      toast.error('CNPJ inválido')
      return
    }

    setBuscandoCnpj(true)
    try {
      const response = await fetch(`/api/buscar-cnpj?cnpj=${cnpj}`)
      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'CNPJ não encontrado')
        return
      }

      setFormData(prev => ({
        ...prev,
        razao_social: data.nome || prev.razao_social,
        nome_fantasia: data.fantasia || '',
        telefone: formatarTelefone(data.telefone?.replace(/\D/g, '') || ''),
        email: data.email?.toLowerCase() || '',
        cep: formatarCEP(data.cep?.replace(/\D/g, '') || ''),
        logradouro: data.logradouro || '',
        numero: data.numero || '',
        complemento: data.complemento || '',
        bairro: data.bairro || '',
        cidade: data.municipio || '',
        uf: data.uf || '',
      }))
      toast.success('Dados do CNPJ encontrados!')
    } catch (error) {
      toast.error('Erro ao buscar CNPJ', {
        description: 'Tente novamente mais tarde',
      })
    } finally {
      setBuscandoCnpj(false)
    }
  }

  async function buscarCEP() {
    const cep = formData.cep.replace(/\D/g, '')
    if (cep.length !== 8) {
      toast.error('CEP inválido')
      return
    }

    setBuscandoCep(true)
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const data = await response.json()

      if (data.erro) {
        toast.error('CEP não encontrado')
        return
      }

      setFormData(prev => ({
        ...prev,
        logradouro: data.logradouro || '',
        bairro: data.bairro || '',
        cidade: data.localidade || '',
        uf: data.uf || '',
      }))
      toast.success('Endereço encontrado!')
    } catch (error) {
      toast.error('Erro ao buscar CEP')
    } finally {
      setBuscandoCep(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!empresa) {
      toast.error('Empresa não encontrada')
      return
    }

    const cnpjLimpo = formData.cnpj.replace(/\D/g, '')
    if (cnpjLimpo && !validarCNPJ(cnpjLimpo)) {
      toast.error('CNPJ inválido')
      return
    }

    setSaving(true)

    try {
      const endereco = {
        cep: formData.cep.replace(/\D/g, ''),
        logradouro: formData.logradouro,
        numero: formData.numero,
        complemento: formData.complemento,
        bairro: formData.bairro,
        cidade: formData.cidade,
        uf: formData.uf,
      }

      const config_fiscal = {
        regime_tributario: formData.regime_tributario,
        ambiente: formData.ambiente,
        serie_nfce: formData.serie_nfce,
        numero_nfce: parseInt(formData.numero_nfce) || 1,
        serie_nfe: formData.serie_nfe,
        numero_nfe: parseInt(formData.numero_nfe) || 1,
        chave_pix: formData.chave_pix || null,
      }

      const { error } = await supabase
        .from('empresas')
        .update({
          razao_social: formData.razao_social,
          nome_fantasia: formData.nome_fantasia || null,
          cnpj: cnpjLimpo,
          ie: formData.ie || null,
          telefone: formData.telefone.replace(/\D/g, '') || null,
          email: formData.email || null,
          endereco,
          config_fiscal,
        })
        .eq('id', empresa.id)

      if (error) throw error

      toast.success('Configurações salvas com sucesso!')
    } catch (error: any) {
      toast.error('Erro ao salvar configurações', {
        description: error.message,
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleRestaurarPadrao() {
    if (confirmacaoTexto !== 'CONFIRMAR') {
      toast.error('Digite CONFIRMAR para continuar')
      return
    }

    if (!senhaConfirmacao) {
      toast.error('Digite a senha mestre para continuar')
      return
    }

    setRestaurando(true)
    try {
      const payload = {
        confirmacao: 'CONFIRMAR',
        senhaMestre: senhaConfirmacao,
        limparDadosEmpresa: limparDadosEmpresa,
      }
      console.log('Enviando para API:', { ...payload, senhaMestre: '***' })

      const response = await fetch('/api/restaurar-padrao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      console.log('Resposta da API:', data)

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao restaurar')
      }

      if (data.success) {
        toast.success('Padrão de fábrica restaurado!', {
          description: limparDadosEmpresa
            ? 'Todos os dados e cadastro da empresa foram excluídos.'
            : 'Todos os dados foram excluídos.',
        })
        setDialogOpen(false)
        setConfirmacaoTexto('')
        setSenhaConfirmacao('')
        setLimparDadosEmpresa(false)
        // Recarregar a página para atualizar os dados
        window.location.reload()
      } else {
        toast.warning('Restauração concluída com avisos', {
          description: 'Verifique o console para detalhes.',
        })
        console.log('Resultados:', data.resultados)
      }
    } catch (error: any) {
      toast.error('Erro ao restaurar padrão', {
        description: error.message,
      })
    } finally {
      setRestaurando(false)
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">
          Configure os dados da empresa e preferências do sistema
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Tabs defaultValue="empresa" className="space-y-4">
          <TabsList>
            <TabsTrigger value="empresa">
              <Building2 className="mr-2 h-4 w-4" />
              Empresa
            </TabsTrigger>
            <TabsTrigger value="endereco">
              <MapPin className="mr-2 h-4 w-4" />
              Endereço
            </TabsTrigger>
            <TabsTrigger value="fiscal">
              <FileText className="mr-2 h-4 w-4" />
              Fiscal
            </TabsTrigger>
            <TabsTrigger value="sistema">
              <Settings className="mr-2 h-4 w-4" />
              Sistema
            </TabsTrigger>
          </TabsList>

          {/* Dados da Empresa */}
          <TabsContent value="empresa">
            <Card>
              <CardHeader>
                <CardTitle>Dados Cadastrais</CardTitle>
                <CardDescription>
                  Informações básicas da empresa
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cnpj">CNPJ *</Label>
                    <div className="flex gap-2">
                      <Input
                        id="cnpj"
                        name="cnpj"
                        placeholder="00.000.000/0001-00"
                        value={formData.cnpj}
                        onChange={handleChange}
                        maxLength={18}
                        required
                        disabled={saving || buscandoCnpj}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={buscarCNPJ}
                        disabled={saving || buscandoCnpj}
                      >
                        {buscandoCnpj ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Search className="mr-2 h-4 w-4" />
                            Buscar
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ie">Inscrição Estadual</Label>
                    <Input
                      id="ie"
                      name="ie"
                      placeholder="Inscrição estadual"
                      value={formData.ie}
                      onChange={handleChange}
                      disabled={saving}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="razao_social">Razão Social *</Label>
                  <Input
                    id="razao_social"
                    name="razao_social"
                    placeholder="Razão social da empresa"
                    value={formData.razao_social}
                    onChange={handleChange}
                    required
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
                  <Input
                    id="nome_fantasia"
                    name="nome_fantasia"
                    placeholder="Nome fantasia"
                    value={formData.nome_fantasia}
                    onChange={handleChange}
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telefone">WhatsApp</Label>
                  <Input
                    id="telefone"
                    name="telefone"
                    placeholder="(00) 00000-0000"
                    value={formData.telefone}
                    onChange={handleChange}
                    maxLength={15}
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="email@empresa.com"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={saving}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Endereço */}
          <TabsContent value="endereco">
            <Card>
              <CardHeader>
                <CardTitle>Endereço</CardTitle>
                <CardDescription>
                  Endereço fiscal da empresa
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="cep">CEP</Label>
                    <div className="flex gap-2">
                      <Input
                        id="cep"
                        name="cep"
                        placeholder="00000-000"
                        value={formData.cep}
                        onChange={handleChange}
                        maxLength={9}
                        disabled={saving}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={buscarCEP}
                        disabled={saving || buscandoCep}
                      >
                        {buscandoCep ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="logradouro">Logradouro</Label>
                    <Input
                      id="logradouro"
                      name="logradouro"
                      placeholder="Rua, Avenida..."
                      value={formData.logradouro}
                      onChange={handleChange}
                      disabled={saving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="numero">Número</Label>
                    <Input
                      id="numero"
                      name="numero"
                      placeholder="123"
                      value={formData.numero}
                      onChange={handleChange}
                      disabled={saving}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="complemento">Complemento</Label>
                    <Input
                      id="complemento"
                      name="complemento"
                      placeholder="Sala, Loja..."
                      value={formData.complemento}
                      onChange={handleChange}
                      disabled={saving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bairro">Bairro</Label>
                    <Input
                      id="bairro"
                      name="bairro"
                      placeholder="Bairro"
                      value={formData.bairro}
                      onChange={handleChange}
                      disabled={saving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cidade">Cidade</Label>
                    <Input
                      id="cidade"
                      name="cidade"
                      placeholder="Cidade"
                      value={formData.cidade}
                      onChange={handleChange}
                      disabled={saving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="uf">UF</Label>
                    <Input
                      id="uf"
                      name="uf"
                      placeholder="SC"
                      value={formData.uf}
                      onChange={handleChange}
                      maxLength={2}
                      disabled={saving}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Configurações Fiscais */}
          <TabsContent value="fiscal">
            <Card>
              <CardHeader>
                <CardTitle>Configurações Fiscais</CardTitle>
                <CardDescription>
                  Configurações para emissão de notas fiscais (NFC-e e NF-e)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="regime_tributario">Regime Tributário</Label>
                    <select
                      id="regime_tributario"
                      name="regime_tributario"
                      value={formData.regime_tributario}
                      onChange={handleChange}
                      disabled={saving}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="1">Simples Nacional</option>
                      <option value="2">Simples Nacional - Excesso de sublimite</option>
                      <option value="3">Regime Normal</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ambiente">Ambiente</Label>
                    <select
                      id="ambiente"
                      name="ambiente"
                      value={formData.ambiente}
                      onChange={handleChange}
                      disabled={saving}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="2">Homologação (Testes)</option>
                      <option value="1">Produção</option>
                    </select>
                  </div>
                </div>

                <div className="border-t pt-4 mt-4">
                  <h4 className="font-medium mb-4">NFC-e (Nota Fiscal ao Consumidor)</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="serie_nfce">Série NFC-e</Label>
                      <Input
                        id="serie_nfce"
                        name="serie_nfce"
                        placeholder="1"
                        value={formData.serie_nfce}
                        onChange={handleChange}
                        disabled={saving}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="numero_nfce">Próximo Número NFC-e</Label>
                      <Input
                        id="numero_nfce"
                        name="numero_nfce"
                        type="number"
                        min="1"
                        placeholder="1"
                        value={formData.numero_nfce}
                        onChange={handleChange}
                        disabled={saving}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4 mt-4">
                  <h4 className="font-medium mb-4">NF-e (Nota Fiscal Eletrônica)</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="serie_nfe">Série NF-e</Label>
                      <Input
                        id="serie_nfe"
                        name="serie_nfe"
                        placeholder="1"
                        value={formData.serie_nfe}
                        onChange={handleChange}
                        disabled={saving}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="numero_nfe">Próximo Número NF-e</Label>
                      <Input
                        id="numero_nfe"
                        name="numero_nfe"
                        type="number"
                        min="1"
                        placeholder="1"
                        value={formData.numero_nfe}
                        onChange={handleChange}
                        disabled={saving}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4 mt-4">
                  <h4 className="font-medium mb-4">PIX - Pagamento Instantâneo</h4>
                  <div className="space-y-2">
                    <Label htmlFor="chave_pix">Chave PIX da Empresa</Label>
                    <Input
                      id="chave_pix"
                      name="chave_pix"
                      placeholder="CPF, CNPJ, email, telefone ou chave aleatória"
                      value={formData.chave_pix}
                      onChange={handleChange}
                      disabled={saving}
                    />
                    <p className="text-xs text-muted-foreground">
                      Configure a chave PIX para receber pagamentos via QR Code no PDV
                    </p>
                  </div>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-md border border-yellow-200 dark:border-yellow-800 mt-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>Importante:</strong> Para emissão fiscal em produção, é necessário ter um certificado digital A1 válido.
                    A configuração do certificado será feita na fase de implementação fiscal.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sistema */}
          <TabsContent value="sistema">
            <div className="space-y-6">
              {/* Informações do Sistema */}
              <Card>
                <CardHeader>
                  <CardTitle>Informações do Sistema</CardTitle>
                  <CardDescription>
                    Dados gerais sobre a instalação
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Versão do Sistema</p>
                      <p className="text-lg font-semibold">1.0.0</p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">ID da Empresa</p>
                      <p className="text-sm font-mono">{empresa?.id || '-'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Senha Mestre */}
              <Card className="border-amber-200 dark:border-amber-900">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-amber-600" />
                    Senha Mestre
                    {temSenhaMestre && (
                      <span className="ml-2 inline-flex items-center gap-1 text-sm font-normal text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-4 w-4" />
                        Configurada
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Senha de segurança para operações críticas. Apenas o dono da empresa deve conhecer.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      <strong>Importante:</strong> Esta senha é diferente da senha de login.
                      Ela é necessária para operações críticas como restaurar padrão de fábrica.
                      Guarde-a em local seguro e não compartilhe com funcionários.
                    </p>
                  </div>

                  <div className="space-y-4 max-w-md">
                    {temSenhaMestre && (
                      <div className="space-y-2">
                        <Label htmlFor="senha-atual">Senha Mestre Atual</Label>
                        <div className="relative">
                          <Input
                            id="senha-atual"
                            type={mostrarSenhaAtual ? 'text' : 'password'}
                            placeholder="Digite a senha atual"
                            value={senhaAtual}
                            onChange={(e) => setSenhaAtual(e.target.value)}
                            disabled={salvandoSenhaMestre}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full"
                            onClick={() => setMostrarSenhaAtual(!mostrarSenhaAtual)}
                          >
                            {mostrarSenhaAtual ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="nova-senha">{temSenhaMestre ? 'Nova Senha Mestre' : 'Criar Senha Mestre'}</Label>
                      <div className="relative">
                        <Input
                          id="nova-senha"
                          type={mostrarNovaSenha ? 'text' : 'password'}
                          placeholder="Mínimo 6 caracteres"
                          value={novaSenhaMestre}
                          onChange={(e) => setNovaSenhaMestre(e.target.value)}
                          disabled={salvandoSenhaMestre}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full"
                          onClick={() => setMostrarNovaSenha(!mostrarNovaSenha)}
                        >
                          {mostrarNovaSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmar-senha">Confirmar Senha</Label>
                      <Input
                        id="confirmar-senha"
                        type="password"
                        placeholder="Repita a senha"
                        value={confirmarSenhaMestre}
                        onChange={(e) => setConfirmarSenhaMestre(e.target.value)}
                        disabled={salvandoSenhaMestre}
                      />
                    </div>

                    <Button
                      type="button"
                      onClick={handleSalvarSenhaMestre}
                      disabled={salvandoSenhaMestre || !novaSenhaMestre || !confirmarSenhaMestre}
                      className="w-full"
                    >
                      {salvandoSenhaMestre ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Key className="mr-2 h-4 w-4" />
                          {temSenhaMestre ? 'Alterar Senha Mestre' : 'Definir Senha Mestre'}
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Zona de Perigo */}
              <Card className="border-red-200 dark:border-red-900">
                <CardHeader>
                  <CardTitle className="text-red-600 dark:text-red-400 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Zona de Perigo
                  </CardTitle>
                  <CardDescription>
                    Ações irreversíveis que afetam todos os dados do sistema
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 border border-red-200 dark:border-red-900 rounded-lg bg-red-50 dark:bg-red-950/20">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h4 className="font-semibold text-red-800 dark:text-red-200">
                          Restaurar Padrão de Fábrica
                        </h4>
                        <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                          Esta ação irá <strong>EXCLUIR PERMANENTEMENTE</strong> todos os dados:
                        </p>
                        <ul className="text-sm text-red-600 dark:text-red-400 mt-2 list-disc list-inside space-y-1">
                          <li>Todos os produtos cadastrados</li>
                          <li>Todos os clientes</li>
                          <li>Todas as vendas e histórico</li>
                          <li>Todas as notas fiscais</li>
                          <li>Todas as contas a pagar/receber</li>
                          <li>Todas as movimentações de estoque</li>
                          <li>Configurações fiscais (serão resetadas)</li>
                        </ul>
                        <p className="text-sm text-red-700 dark:text-red-300 mt-3 font-semibold">
                          ⚠️ Esta ação NÃO pode ser desfeita!
                        </p>
                      </div>
                      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            className="shrink-0"
                            onClick={() => {
                              setConfirmacaoTexto('')
                              setSenhaConfirmacao('')
                              setLimparDadosEmpresa(false)
                            }}
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Restaurar Padrão
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-red-600 flex items-center gap-2">
                              <AlertTriangle className="h-5 w-5" />
                              Confirmar Restauração de Fábrica
                            </AlertDialogTitle>
                            <AlertDialogDescription asChild>
                              <div className="space-y-4">
                                <p>
                                  Você está prestes a <strong>EXCLUIR TODOS OS DADOS</strong> do sistema.
                                  Esta ação é <strong>IRREVERSÍVEL</strong>.
                                </p>
                                <div className="p-3 bg-red-100 dark:bg-red-950 rounded-md">
                                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                                    Para confirmar, digite <strong>CONFIRMAR</strong> e a <strong>SENHA MESTRE</strong>:
                                  </p>
                                </div>
                                {!temSenhaMestre && (
                                  <div className="p-3 bg-amber-100 dark:bg-amber-950 rounded-md">
                                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                                      Você precisa configurar a Senha Mestre antes de usar esta funcionalidade.
                                      Acesse a seção "Senha Mestre" acima.
                                    </p>
                                  </div>
                                )}
                                <div className="space-y-3">
                                  <div>
                                    <Label htmlFor="confirmacao-texto" className="text-xs text-muted-foreground">
                                      Digite CONFIRMAR
                                    </Label>
                                    <Input
                                      id="confirmacao-texto"
                                      placeholder="CONFIRMAR"
                                      value={confirmacaoTexto}
                                      onChange={(e) => setConfirmacaoTexto(e.target.value.toUpperCase())}
                                      className="font-mono text-center text-lg"
                                      disabled={restaurando || !temSenhaMestre}
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="senha-confirmacao" className="text-xs text-muted-foreground">
                                      Senha Mestre
                                    </Label>
                                    <Input
                                      id="senha-confirmacao"
                                      type="password"
                                      placeholder="Digite a senha mestre"
                                      value={senhaConfirmacao}
                                      onChange={(e) => setSenhaConfirmacao(e.target.value)}
                                      className="text-center"
                                      disabled={restaurando || !temSenhaMestre}
                                    />
                                  </div>
                                  <div className="flex items-center space-x-2 p-3 border rounded-md bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800">
                                    <Checkbox
                                      id="limpar-empresa"
                                      checked={limparDadosEmpresa}
                                      onCheckedChange={(checked) => setLimparDadosEmpresa(checked === true)}
                                      disabled={restaurando || !temSenhaMestre}
                                    />
                                    <div className="grid gap-1.5 leading-none">
                                      <label
                                        htmlFor="limpar-empresa"
                                        className="text-sm font-medium text-orange-800 dark:text-orange-200 cursor-pointer"
                                      >
                                        Limpar dados cadastrais da empresa
                                      </label>
                                      <p className="text-xs text-orange-600 dark:text-orange-400">
                                        Reseta CNPJ, razão social, endereço, telefone, email
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={restaurando}>
                              Cancelar
                            </AlertDialogCancel>
                            <Button
                              variant="destructive"
                              onClick={handleRestaurarPadrao}
                              disabled={!temSenhaMestre || confirmacaoTexto !== 'CONFIRMAR' || !senhaConfirmacao || restaurando}
                            >
                              {restaurando ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Restaurando...
                                </>
                              ) : (
                                <>
                                  <RotateCcw className="mr-2 h-4 w-4" />
                                  Restaurar Padrão de Fábrica
                                </>
                              )}
                            </Button>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
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
