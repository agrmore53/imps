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
import { Loader2, ArrowLeft, Trash2 } from 'lucide-react'
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

export default function EditarProdutoPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
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
    ativo: true,
  })

  useEffect(() => {
    async function loadProduto() {
      try {
        const { data, error } = await supabase
          .from('produtos')
          .select('*')
          .eq('id', params.id)
          .single()

        if (error) throw error

        if (data) {
          setFormData({
            codigo: data.codigo || '',
            codigo_barras: data.codigo_barras || '',
            nome: data.nome || '',
            descricao: data.descricao || '',
            ncm: data.ncm || '',
            unidade: data.unidade || 'UN',
            preco_custo: data.preco_custo?.toString() || '',
            preco_venda: data.preco_venda?.toString() || '',
            estoque_atual: data.estoque_atual?.toString() || '0',
            estoque_minimo: data.estoque_minimo?.toString() || '0',
            ativo: data.ativo ?? true,
          })
        }
      } catch (error) {
        toast.error('Erro ao carregar produto')
        router.push('/dashboard/produtos')
      } finally {
        setLoading(false)
      }
    }

    loadProduto()
  }, [params.id, supabase, router])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      const { error } = await supabase
        .from('produtos')
        .update({
          codigo: formData.codigo,
          codigo_barras: formData.codigo_barras || null,
          nome: formData.nome,
          descricao: formData.descricao || null,
          ncm: formData.ncm || null,
          unidade: formData.unidade,
          preco_custo: parseFloat(formData.preco_custo) || 0,
          preco_venda: parseFloat(formData.preco_venda),
          estoque_minimo: parseFloat(formData.estoque_minimo) || 0,
          ativo: formData.ativo,
        })
        .eq('id', params.id)

      if (error) {
        if (error.code === '23505') {
          toast.error('Codigo ja existe', {
            description: 'Ja existe um produto com este codigo',
          })
        } else {
          toast.error('Erro ao atualizar produto', {
            description: error.message,
          })
        }
        return
      }

      toast.success('Produto atualizado com sucesso!')
      router.push('/dashboard/produtos')
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
        .from('produtos')
        .delete()
        .eq('id', params.id)

      if (error) throw error

      toast.success('Produto excluido com sucesso!')
      router.push('/dashboard/produtos')
      router.refresh()
    } catch (error: any) {
      toast.error('Erro ao excluir produto', {
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
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <div className="grid gap-4 md:grid-cols-4">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
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
            <Link href="/dashboard/produtos">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Editar Produto</h1>
            <p className="text-muted-foreground">
              {formData.codigo} - {formData.nome}
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
                Tem certeza que deseja excluir este produto? Esta acao nao pode ser desfeita.
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

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Dados do Produto</CardTitle>
            <CardDescription>
              Informacoes basicas do produto
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center space-x-2">
              <Switch
                id="ativo"
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, ativo: checked }))}
              />
              <Label htmlFor="ativo">Produto ativo</Label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="codigo">Codigo *</Label>
                <Input
                  id="codigo"
                  name="codigo"
                  placeholder="001"
                  value={formData.codigo}
                  onChange={handleChange}
                  required
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="codigo_barras">Codigo de Barras</Label>
                <Input
                  id="codigo_barras"
                  name="codigo_barras"
                  placeholder="7891234567890"
                  value={formData.codigo_barras}
                  onChange={handleChange}
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ncm">NCM</Label>
                <NCMSearch
                  value={formData.ncm}
                  onChange={(ncm) => setFormData(prev => ({ ...prev, ncm }))}
                  disabled={saving}
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
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descricao</Label>
              <Input
                id="descricao"
                name="descricao"
                placeholder="Descricao do produto"
                value={formData.descricao}
                onChange={handleChange}
                disabled={saving}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="unidade">Unidade *</Label>
                <Select
                  value={formData.unidade}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, unidade: value }))}
                  disabled={saving}
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
                <Label htmlFor="preco_custo">Preco de Custo</Label>
                <Input
                  id="preco_custo"
                  name="preco_custo"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={formData.preco_custo}
                  onChange={handleChange}
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preco_venda">Preco de Venda *</Label>
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
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estoque_minimo">Estoque Minimo</Label>
                <Input
                  id="estoque_minimo"
                  name="estoque_minimo"
                  type="number"
                  step="1"
                  min="0"
                  placeholder="0"
                  value={formData.estoque_minimo}
                  onChange={handleChange}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm font-medium">Estoque Atual</p>
              <p className="text-2xl font-bold">{formData.estoque_atual} {formData.unidade}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Para alterar o estoque, utilize as funcoes de Entrada ou Saida de estoque
              </p>
            </div>

            <div className="flex gap-4 pt-4">
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
                <Link href="/dashboard/produtos">Cancelar</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
