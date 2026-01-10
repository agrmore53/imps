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
import { Loader2, ArrowLeft } from 'lucide-react'
import { NCMSearch } from '@/components/ncm-search'

const unidades = [
  { value: 'UN', label: 'Unidade' },
  { value: 'KG', label: 'Quilograma' },
  { value: 'G', label: 'Grama' },
  { value: 'L', label: 'Litro' },
  { value: 'ML', label: 'Mililitro' },
  { value: 'M', label: 'Metro' },
  { value: 'M2', label: 'Metro Quadrado' },
  { value: 'CX', label: 'Caixa' },
  { value: 'PCT', label: 'Pacote' },
]

export default function NovoProdutoPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    codigo: '',
    codigo_barras: '',
    nome: '',
    descricao: '',
    ncm: '',
    unidade: 'UN',
    preco_custo: '',
    preco_venda: '',
    estoque_atual: '0',
    estoque_minimo: '0',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      // Buscar empresa_id do usuário logado
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

      const { error } = await supabase.from('produtos').insert({
        empresa_id: userData.empresa_id,
        codigo: formData.codigo,
        codigo_barras: formData.codigo_barras || null,
        nome: formData.nome,
        descricao: formData.descricao || null,
        ncm: formData.ncm || null,
        unidade: formData.unidade,
        preco_custo: parseFloat(formData.preco_custo) || 0,
        preco_venda: parseFloat(formData.preco_venda),
        estoque_atual: parseFloat(formData.estoque_atual) || 0,
        estoque_minimo: parseFloat(formData.estoque_minimo) || 0,
      })

      if (error) {
        if (error.code === '23505') {
          toast.error('Código já existe', {
            description: 'Já existe um produto com este código',
          })
        } else {
          toast.error('Erro ao cadastrar produto', {
            description: error.message,
          })
        }
        return
      }

      toast.success('Produto cadastrado com sucesso!')
      router.push('/dashboard/produtos')
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
          <Link href="/dashboard/produtos">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Novo Produto</h1>
          <p className="text-muted-foreground">
            Preencha os dados do produto
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Dados do Produto</CardTitle>
            <CardDescription>
              Informações básicas do produto
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="codigo">Código *</Label>
                <Input
                  id="codigo"
                  name="codigo"
                  placeholder="001"
                  value={formData.codigo}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="codigo_barras">Código de Barras</Label>
                <Input
                  id="codigo_barras"
                  name="codigo_barras"
                  placeholder="7891234567890"
                  value={formData.codigo_barras}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ncm">NCM</Label>
                <NCMSearch
                  value={formData.ncm}
                  onChange={(ncm) => setFormData(prev => ({ ...prev, ncm }))}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                name="nome"
                placeholder="Nome do produto"
                value={formData.nome}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Input
                id="descricao"
                name="descricao"
                placeholder="Descrição do produto"
                value={formData.descricao}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="unidade">Unidade *</Label>
                <Select
                  value={formData.unidade}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, unidade: value }))}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {unidades.map((un) => (
                      <SelectItem key={un.value} value={un.value}>
                        {un.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="preco_custo">Preço de Custo</Label>
                <Input
                  id="preco_custo"
                  name="preco_custo"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={formData.preco_custo}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preco_venda">Preço de Venda *</Label>
                <Input
                  id="preco_venda"
                  name="preco_venda"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={formData.preco_venda}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="estoque_atual">Quantidade Inicial</Label>
                <Input
                  id="estoque_atual"
                  name="estoque_atual"
                  type="number"
                  step="1"
                  min="0"
                  placeholder="0"
                  value={formData.estoque_atual}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estoque_minimo">Estoque Mínimo</Label>
                <Input
                  id="estoque_minimo"
                  name="estoque_minimo"
                  type="number"
                  step="1"
                  min="0"
                  placeholder="0"
                  value={formData.estoque_minimo}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Produto'
                )}
              </Button>
              <Button type="button" variant="outline" asChild disabled={loading}>
                <Link href="/dashboard/produtos">Cancelar</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
