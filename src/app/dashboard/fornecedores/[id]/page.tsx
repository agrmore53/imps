'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, Search, Trash2 } from 'lucide-react'
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

export default function EditarFornecedorPage() {
  const router = useRouter()
  const params = useParams()
  const fornecedorId = params.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [formData, setFormData] = useState({
    cpf_cnpj: '',
    razao_social: '',
    nome_fantasia: '',
    contato: '',
    telefone: '',
    email: '',
    ativo: true,
    // Endereço
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
  })

  useEffect(() => {
    carregarFornecedor()
  }, [fornecedorId])

  async function carregarFornecedor() {
    try {
      const { data: fornecedor, error } = await supabase
        .from('fornecedores')
        .select('*')
        .eq('id', fornecedorId)
        .single()

      if (error || !fornecedor) {
        toast.error('Fornecedor não encontrado')
        router.push('/dashboard/fornecedores')
        return
      }

      const endereco = fornecedor.endereco || {}

      setFormData({
        cpf_cnpj: formatarCNPJ(fornecedor.cpf_cnpj || ''),
        razao_social: fornecedor.razao_social || '',
        nome_fantasia: fornecedor.nome_fantasia || '',
        contato: fornecedor.contato || '',
        telefone: formatarTelefone(fornecedor.telefone || ''),
        email: fornecedor.email || '',
        ativo: fornecedor.ativo ?? true,
        cep: formatarCEP(endereco.cep || ''),
        logradouro: endereco.logradouro || '',
        numero: endereco.numero || '',
        complemento: endereco.complemento || '',
        bairro: endereco.bairro || '',
        cidade: endereco.cidade || '',
        uf: endereco.uf || '',
      })
    } catch (error) {
      toast.error('Erro ao carregar fornecedor')
      router.push('/dashboard/fornecedores')
    } finally {
      setLoading(false)
    }
  }

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

      const { error } = await supabase
        .from('fornecedores')
        .update({
          cpf_cnpj: cnpjLimpo,
          razao_social: formData.razao_social,
          nome_fantasia: formData.nome_fantasia || null,
          contato: formData.contato || null,
          telefone: formData.telefone.replace(/\D/g, '') || null,
          email: formData.email || null,
          ativo: formData.ativo,
          endereco,
        })
        .eq('id', fornecedorId)

      if (error) {
        if (error.code === '23505') {
          toast.error('CNPJ já cadastrado', {
            description: 'Já existe um fornecedor com este CNPJ',
          })
        } else {
          toast.error('Erro ao atualizar fornecedor', {
            description: error.message,
          })
        }
        return
      }

      toast.success('Fornecedor atualizado com sucesso!')
      router.push('/dashboard/fornecedores')
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
        .from('fornecedores')
        .delete()
        .eq('id', fornecedorId)

      if (error) {
        toast.error('Erro ao excluir fornecedor', {
          description: error.message,
        })
        return
      }

      toast.success('Fornecedor excluído com sucesso!')
      router.push('/dashboard/fornecedores')
      router.refresh()
    } catch (error) {
      toast.error('Erro inesperado')
    } finally {
      setDeleting(false)
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/fornecedores">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Editar Fornecedor</h1>
            <p className="text-muted-foreground">
              Atualize os dados do fornecedor
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
              <AlertDialogTitle>Excluir fornecedor?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. O fornecedor será removido permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
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
        {/* Dados Básicos */}
        <Card>
          <CardHeader>
            <CardTitle>Dados do Fornecedor</CardTitle>
            <CardDescription>
              Informações cadastrais do fornecedor
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label htmlFor="ativo">Status</Label>
                <p className="text-sm text-muted-foreground">
                  Fornecedor {formData.ativo ? 'ativo' : 'inativo'}
                </p>
              </div>
              <Switch
                id="ativo"
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, ativo: checked }))}
                disabled={saving}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cpf_cnpj">CNPJ *</Label>
                <Input
                  id="cpf_cnpj"
                  name="cpf_cnpj"
                  placeholder="00.000.000/0001-00"
                  value={formData.cpf_cnpj}
                  onChange={handleChange}
                  maxLength={18}
                  required
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contato">Pessoa de Contato</Label>
                <Input
                  id="contato"
                  name="contato"
                  placeholder="Nome do contato"
                  value={formData.contato}
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
                  placeholder="Sala, Galpão..."
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

        {/* Ações */}
        <div className="flex gap-4">
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Alterações'
            )}
          </Button>
          <Button type="button" variant="outline" asChild disabled={saving}>
            <Link href="/dashboard/fornecedores">Cancelar</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
