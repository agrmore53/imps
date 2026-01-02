'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, Calculator } from 'lucide-react'

interface Fornecedor {
  id: string
  razao_social: string
  nome_fantasia: string | null
}

const categorias = [
  'Fornecedores',
  'Aluguel',
  'Água',
  'Energia',
  'Telefone/Internet',
  'Salários',
  'Impostos',
  'Manutenção',
  'Marketing',
  'Transporte',
  'Outros',
]

export default function NovaContaPagarPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])

  const [formData, setFormData] = useState({
    descricao: '',
    fornecedor_id: '',
    categoria: '',
    valor: '',
    vencimento: '',
    parcelas: '1',
    observacao: '',
  })

  useEffect(() => {
    carregarFornecedores()
  }, [])

  async function carregarFornecedores() {
    const { data } = await supabase
      .from('fornecedores')
      .select('id, razao_social, nome_fantasia')
      .eq('ativo', true)
      .order('razao_social')

    if (data) {
      setFornecedores(data)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const valor = parseFloat(formData.valor)
    if (isNaN(valor) || valor <= 0) {
      toast.error('Valor inválido')
      return
    }

    if (!formData.vencimento) {
      toast.error('Informe a data de vencimento')
      return
    }

    const parcelas = parseInt(formData.parcelas) || 1
    if (parcelas < 1 || parcelas > 48) {
      toast.error('Número de parcelas inválido (1-48)')
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

      // Se tiver mais de 1 parcela, cria várias contas
      const valorParcela = valor / parcelas
      const contasCriadas = []

      for (let i = 0; i < parcelas; i++) {
        const vencimentoParcela = new Date(formData.vencimento)
        vencimentoParcela.setMonth(vencimentoParcela.getMonth() + i)

        const descricaoParcela = parcelas > 1
          ? `${formData.descricao} (${i + 1}/${parcelas})`
          : formData.descricao

        contasCriadas.push({
          empresa_id: userData.empresa_id,
          descricao: descricaoParcela,
          fornecedor_id: formData.fornecedor_id || null,
          categoria: formData.categoria || null,
          valor: Math.round(valorParcela * 100) / 100,
          vencimento: vencimentoParcela.toISOString().split('T')[0],
          observacao: formData.observacao || null,
          status: 'pendente',
        })
      }

      const { error } = await supabase
        .from('contas_pagar')
        .insert(contasCriadas)

      if (error) throw error

      toast.success(
        parcelas > 1
          ? `${parcelas} parcelas criadas com sucesso!`
          : 'Conta cadastrada com sucesso!'
      )

      router.push('/dashboard/financeiro/contas-pagar')
      router.refresh()
    } catch (error: any) {
      toast.error('Erro ao cadastrar conta', {
        description: error.message,
      })
    } finally {
      setLoading(false)
    }
  }

  // Calcular valor da parcela
  const valorTotal = parseFloat(formData.valor) || 0
  const numParcelas = parseInt(formData.parcelas) || 1
  const valorParcela = valorTotal / numParcelas

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/financeiro/contas-pagar">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nova Conta a Pagar</h1>
          <p className="text-muted-foreground">
            Cadastre uma nova despesa ou conta
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Dados da Conta</CardTitle>
            <CardDescription>
              Informações básicas da conta a pagar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição *</Label>
              <Input
                id="descricao"
                name="descricao"
                placeholder="Ex: Compra de mercadorias, Aluguel de janeiro..."
                value={formData.descricao}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fornecedor_id">Fornecedor</Label>
                <Select
                  value={formData.fornecedor_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, fornecedor_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um fornecedor (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {fornecedores.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome_fantasia || f.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="categoria">Categoria</Label>
                <Select
                  value={formData.categoria}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, categoria: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="valor">Valor Total *</Label>
                <Input
                  id="valor"
                  name="valor"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0,00"
                  value={formData.valor}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vencimento">Vencimento *</Label>
                <Input
                  id="vencimento"
                  name="vencimento"
                  type="date"
                  value={formData.vencimento}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="parcelas">Parcelas</Label>
                <Input
                  id="parcelas"
                  name="parcelas"
                  type="number"
                  min="1"
                  max="48"
                  placeholder="1"
                  value={formData.parcelas}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Resumo de Parcelas */}
            {numParcelas > 1 && valorTotal > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <Calculator className="h-4 w-4 text-blue-600" />
                  <p className="font-medium text-blue-800 dark:text-blue-200">
                    Parcelamento
                  </p>
                </div>
                <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <p>Valor total: R$ {valorTotal.toFixed(2)}</p>
                  <p>Número de parcelas: {numParcelas}x</p>
                  <p className="font-semibold">Valor por parcela: R$ {valorParcela.toFixed(2)}</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="observacao">Observação</Label>
              <Textarea
                id="observacao"
                name="observacao"
                placeholder="Observações adicionais..."
                value={formData.observacao}
                onChange={handleChange}
                disabled={loading}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Cadastrar Conta'
            )}
          </Button>
          <Button type="button" variant="outline" asChild disabled={loading}>
            <Link href="/dashboard/financeiro/contas-pagar">Cancelar</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
