'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
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
import { toast } from 'sonner'
import { Loader2, ArrowLeft, Search, Trash2 } from 'lucide-react'
import { validarCPFCNPJ, formatarCPFCNPJ, formatarTelefone, formatarCEP } from '@/lib/utils/validators'

export default function EditarClientePage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [formData, setFormData] = useState({
    tipo_pessoa: 'PF',
    cpf_cnpj: '',
    nome: '',
    email: '',
    telefone: '',
    limite_credito: '0',
    ativo: true,
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
  })

  useEffect(() => {
    async function loadCliente() {
      try {
        const { data, error } = await supabase
          .from('clientes')
          .select('*')
          .eq('id', params.id)
          .single()

        if (error) throw error

        if (data) {
          const endereco = data.endereco || {}
          setFormData({
            tipo_pessoa: data.tipo_pessoa || 'PF',
            cpf_cnpj: formatarCPFCNPJ(data.cpf_cnpj || ''),
            nome: data.nome || '',
            email: data.email || '',
            telefone: formatarTelefone(data.telefone || ''),
            limite_credito: data.limite_credito?.toString() || '0',
            ativo: data.ativo ?? true,
            cep: formatarCEP(endereco.cep || ''),
            logradouro: endereco.logradouro || '',
            numero: endereco.numero || '',
            complemento: endereco.complemento || '',
            bairro: endereco.bairro || '',
            cidade: endereco.cidade || '',
            uf: endereco.uf || '',
          })
        }
      } catch (error) {
        toast.error('Erro ao carregar cliente')
        router.push('/dashboard/clientes')
      } finally {
        setLoading(false)
      }
    }

    loadCliente()
  }, [params.id, supabase, router])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target

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
      toast.error('CEP invalido')
      return
    }

    setBuscandoCep(true)
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const data = await response.json()

      if (data.erro) {
        toast.error('CEP nao encontrado')
        return
      }

      setFormData(prev => ({
        ...prev,
        logradouro: data.logradouro || '',
        bairro: data.bairro || '',
        cidade: data.localidade || '',
        uf: data.uf || '',
      }))
      toast.success('Endereco encontrado!')
    } catch (error) {
      toast.error('Erro ao buscar CEP')
    } finally {
      setBuscandoCep(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const cpfCnpjLimpo = formData.cpf_cnpj.replace(/\D/g, '')
    if (!validarCPFCNPJ(cpfCnpjLimpo)) {
      toast.error('CPF/CNPJ invalido')
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

      const { error } = await supabase
        .from('clientes')
        .update({
          tipo_pessoa: formData.tipo_pessoa,
          cpf_cnpj: cpfCnpjLimpo,
          nome: formData.nome,
          email: formData.email || null,
          telefone: formData.telefone.replace(/\D/g, '') || null,
          endereco,
          limite_credito: parseFloat(formData.limite_credito) || 0,
          ativo: formData.ativo,
        })
        .eq('id', params.id)

      if (error) {
        if (error.code === '23505') {
          toast.error('CPF/CNPJ ja cadastrado', {
            description: 'Ja existe um cliente com este CPF/CNPJ',
          })
        } else {
          toast.error('Erro ao atualizar cliente', {
            description: error.message,
          })
        }
        return
      }

      toast.success('Cliente atualizado com sucesso!')
      router.push('/dashboard/clientes')
      router.refresh()
    } catch (error) {
      toast.error('Erro inesperado', {
        description: 'Tente novamente mais tarde',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', params.id)

      if (error) throw error

      toast.success('Cliente excluido com sucesso!')
      router.push('/dashboard/clientes')
      router.refresh()
    } catch (error: any) {
      toast.error('Erro ao excluir cliente', {
        description: error.message,
      })
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-60" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
            <Skeleton className="h-10" />
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/clientes">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Editar Cliente</h1>
            <p className="text-muted-foreground">
              {formData.cpf_cnpj} - {formData.nome}
            </p>
          </div>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusao</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este cliente? Esta acao nao pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                {deleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  'Excluir'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Dados do Cliente</CardTitle>
            <CardDescription>
              Informacoes basicas do cliente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="ativo"
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, ativo: checked }))}
              />
              <Label htmlFor="ativo">Cliente ativo</Label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="tipo_pessoa">Tipo *</Label>
                <Select
                  value={formData.tipo_pessoa}
                  onValueChange={(value) => setFormData(prev => ({
                    ...prev,
                    tipo_pessoa: value,
                  }))}
                  disabled={saving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PF">Pessoa Fisica</SelectItem>
                    <SelectItem value="PJ">Pessoa Juridica</SelectItem>
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
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="limite_credito">Limite de Credito</Label>
                <Input
                  id="limite_credito"
                  name="limite_credito"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={formData.limite_credito}
                  onChange={handleChange}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome">
                {formData.tipo_pessoa === 'PF' ? 'Nome Completo *' : 'Razao Social *'}
              </Label>
              <Input
                id="nome"
                name="nome"
                placeholder={formData.tipo_pessoa === 'PF' ? 'Nome do cliente' : 'Razao social da empresa'}
                value={formData.nome}
                onChange={handleChange}
                required
                disabled={saving}
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
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Endereco</CardTitle>
            <CardDescription>
              Endereco para entrega e cobranca
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
                <Label htmlFor="numero">Numero</Label>
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
                  placeholder="Apto, Sala..."
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

        <div className="flex gap-4">
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Alteracoes'
            )}
          </Button>
          <Button type="button" variant="outline" asChild disabled={saving}>
            <Link href="/dashboard/clientes">Cancelar</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
