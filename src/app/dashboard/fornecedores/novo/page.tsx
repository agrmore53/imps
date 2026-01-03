'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, Search } from 'lucide-react'
import { validarCNPJ, formatarCNPJ, formatarTelefone, formatarCEP } from '@/lib/utils/validators'

export default function NovoFornecedorPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [buscandoCnpj, setBuscandoCnpj] = useState(false)
  const [formData, setFormData] = useState({
    cpf_cnpj: '',
    razao_social: '',
    nome_fantasia: '',
    contato: '',
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
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target

    if (name === 'cpf_cnpj') {
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
    const cnpj = formData.cpf_cnpj.replace(/\D/g, '')
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
      // Usando a API da ReceitaWS (gratuita com limite de requisições)
      const response = await fetch(`https://receitaws.com.br/v1/cnpj/${cnpj}`)
      const data = await response.json()

      if (data.status === 'ERROR') {
        toast.error('CNPJ não encontrado')
        return
      }

      setFormData(prev => ({
        ...prev,
        razao_social: data.nome || '',
        nome_fantasia: data.fantasia || '',
        telefone: formatarTelefone(data.telefone?.replace(/\D/g, '') || ''),
        email: data.email || '',
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

    const cnpjLimpo = formData.cpf_cnpj.replace(/\D/g, '')
    if (!validarCNPJ(cnpjLimpo)) {
      toast.error('CNPJ inválido')
      return
    }

    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Usuário não autenticado')
        return
      }

      const { data: userData } = await supabase
        .from('usuarios')
        .select('empresa_id')
        .eq('auth_id', user.id)
        .single()

      if (!userData?.empresa_id) {
        toast.error('Empresa não encontrada')
        return
      }

      const endereco = {
        cep: formData.cep.replace(/\D/g, ''),
        logradouro: formData.logradouro,
        numero: formData.numero,
        complemento: formData.complemento,
        bairro: formData.bairro,
        cidade: formData.cidade,
        uf: formData.uf,
      }

      const { error } = await supabase.from('fornecedores').insert({
        empresa_id: userData.empresa_id,
        cpf_cnpj: cnpjLimpo,
        razao_social: formData.razao_social,
        nome_fantasia: formData.nome_fantasia || null,
        contato: formData.contato || null,
        telefone: formData.telefone.replace(/\D/g, '') || null,
        email: formData.email || null,
        endereco,
      })

      if (error) {
        if (error.code === '23505') {
          toast.error('CNPJ já cadastrado', {
            description: 'Já existe um fornecedor com este CNPJ',
          })
        } else {
          toast.error('Erro ao cadastrar fornecedor', {
            description: error.message,
          })
        }
        return
      }

      toast.success('Fornecedor cadastrado com sucesso!')
      router.push('/dashboard/fornecedores')
      router.refresh()
    } catch (error) {
      toast.error('Erro inesperado', {
        description: 'Tente novamente mais tarde',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/fornecedores">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Novo Fornecedor</h1>
          <p className="text-muted-foreground">
            Preencha os dados do fornecedor
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dados Básicos */}
        <Card>
          <CardHeader>
            <CardTitle>Dados do Fornecedor</CardTitle>
            <CardDescription>
              Digite o CNPJ para buscar os dados automaticamente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cpf_cnpj">CNPJ *</Label>
                <div className="flex gap-2">
                  <Input
                    id="cpf_cnpj"
                    name="cpf_cnpj"
                    placeholder="00.000.000/0001-00"
                    value={formData.cpf_cnpj}
                    onChange={handleChange}
                    maxLength={18}
                    required
                    disabled={loading}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={buscarCNPJ}
                    disabled={loading || buscandoCnpj}
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
                <Label htmlFor="contato">Pessoa de Contato</Label>
                <Input
                  id="contato"
                  name="contato"
                  placeholder="Nome do contato"
                  value={formData.contato}
                  onChange={handleChange}
                  disabled={loading}
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
                disabled={loading}
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
                disabled={loading}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="telefone">WhatsApp</Label>
                <Input
                  id="telefone"
                  name="telefone"
                  placeholder="(00) 00000-0000"
                  value={formData.telefone}
                  onChange={handleChange}
                  maxLength={15}
                  disabled={loading}
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
                  disabled={loading}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Endereço */}
        <Card>
          <CardHeader>
            <CardTitle>Endereço</CardTitle>
            <CardDescription>
              Endereço do fornecedor
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
                    disabled={loading}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={buscarCEP}
                    disabled={loading || buscandoCep}
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
                  disabled={loading}
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
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="complemento">Complemento</Label>
                <Input
                  id="complemento"
                  name="complemento"
                  placeholder="Sala, Galpão..."
                  value={formData.complemento}
                  onChange={handleChange}
                  disabled={loading}
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
                  disabled={loading}
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
                  disabled={loading}
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
                  disabled={loading}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ações */}
        <div className="flex gap-4">
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Fornecedor'
            )}
          </Button>
          <Button type="button" variant="outline" asChild disabled={loading}>
            <Link href="/dashboard/fornecedores">Cancelar</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
