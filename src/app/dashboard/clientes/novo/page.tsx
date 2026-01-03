'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, Search } from 'lucide-react'
import { validarCPFCNPJ, formatarCPFCNPJ, formatarTelefone, formatarCEP } from '@/lib/utils/validators'

export default function NovoClientePage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [formData, setFormData] = useState({
    tipo_pessoa: 'PF',
    cpf_cnpj: '',
    nome: '',
    email: '',
    telefone: '',
    limite_credito: '0',
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

    // Aplicar máscaras
    if (name === 'cpf_cnpj') {
      setFormData(prev => ({ ...prev, [name]: formatarCPFCNPJ(value) }))
    } else if (name === 'telefone') {
      setFormData(prev => ({ ...prev, [name]: formatarTelefone(value) }))
    } else if (name === 'cep') {
      setFormData(prev => ({ ...prev, [name]: formatarCEP(value) }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
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

    // Validar CPF/CNPJ
    const cpfCnpjLimpo = formData.cpf_cnpj.replace(/\D/g, '')
    if (!validarCPFCNPJ(cpfCnpjLimpo)) {
      toast.error('CPF/CNPJ inválido')
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

      const { error } = await supabase.from('clientes').insert({
        empresa_id: userData.empresa_id,
        tipo_pessoa: formData.tipo_pessoa,
        cpf_cnpj: cpfCnpjLimpo,
        nome: formData.nome,
        email: formData.email || null,
        telefone: formData.telefone.replace(/\D/g, '') || null,
        endereco,
        limite_credito: parseFloat(formData.limite_credito) || 0,
      })

      if (error) {
        if (error.code === '23505') {
          toast.error('CPF/CNPJ já cadastrado', {
            description: 'Já existe um cliente com este CPF/CNPJ',
          })
        } else {
          toast.error('Erro ao cadastrar cliente', {
            description: error.message,
          })
        }
        return
      }

      toast.success('Cliente cadastrado com sucesso!')
      router.push('/dashboard/clientes')
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
          <Link href="/dashboard/clientes">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Novo Cliente</h1>
          <p className="text-muted-foreground">
            Preencha os dados do cliente
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dados Básicos */}
        <Card>
          <CardHeader>
            <CardTitle>Dados do Cliente</CardTitle>
            <CardDescription>
              Informações básicas do cliente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="tipo_pessoa">Tipo *</Label>
                <Select
                  value={formData.tipo_pessoa}
                  onValueChange={(value) => setFormData(prev => ({
                    ...prev,
                    tipo_pessoa: value,
                    cpf_cnpj: '' // Limpa o campo ao trocar o tipo
                  }))}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PF">Pessoa Física</SelectItem>
                    <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf_cnpj">
                  {formData.tipo_pessoa === 'PF' ? 'CPF *' : 'CNPJ *'}
                </Label>
                <Input
                  id="cpf_cnpj"
                  name="cpf_cnpj"
                  placeholder={formData.tipo_pessoa === 'PF' ? '000.000.000-00' : '00.000.000/0001-00'}
                  value={formData.cpf_cnpj}
                  onChange={handleChange}
                  maxLength={formData.tipo_pessoa === 'PF' ? 14 : 18}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="limite_credito">Limite de Crédito</Label>
                <Input
                  id="limite_credito"
                  name="limite_credito"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={formData.limite_credito}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome">
                {formData.tipo_pessoa === 'PF' ? 'Nome Completo *' : 'Razão Social *'}
              </Label>
              <Input
                id="nome"
                name="nome"
                placeholder={formData.tipo_pessoa === 'PF' ? 'Nome do cliente' : 'Razão social da empresa'}
                value={formData.nome}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={loading}
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
              Endereço para entrega e cobrança
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
                  placeholder="Apto, Sala..."
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
              'Salvar Cliente'
            )}
          </Button>
          <Button type="button" variant="outline" asChild disabled={loading}>
            <Link href="/dashboard/clientes">Cancelar</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
