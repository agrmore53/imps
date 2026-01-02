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
import { Loader2, ArrowLeft, Calculator, Search } from 'lucide-react'

interface Cliente {
  id: string
  nome: string
  tipo_pessoa: string
  cpf_cnpj: string
}

export default function NovaContaReceberPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null)
  const [busca, setBusca] = useState('')

  const [formData, setFormData] = useState({
    cliente_id: '',
    descricao: '',
    valor: '',
    vencimento: '',
    parcelas: '1',
    observacao: '',
  })

  async function buscarClientes() {
    if (!busca.trim()) return

    setBuscando(true)
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, tipo_pessoa, cpf_cnpj')
        .eq('ativo', true)
        .or(`nome.ilike.%${busca}%,cpf_cnpj.ilike.%${busca}%`)
        .limit(10)

      if (error) throw error
      setClientes(data || [])
    } catch (error) {
      toast.error('Erro ao buscar clientes')
    } finally {
      setBuscando(false)
    }
  }

  function selecionarCliente(cliente: Cliente) {
    setClienteSelecionado(cliente)
    setFormData(prev => ({ ...prev, cliente_id: cliente.id }))
    setClientes([])
    setBusca('')
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.cliente_id) {
      toast.error('Selecione um cliente')
      return
    }

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

        contasCriadas.push({
          empresa_id: userData.empresa_id,
          cliente_id: formData.cliente_id,
          descricao: formData.descricao || 'Crediário',
          parcela: parcelas > 1 ? `${i + 1}/${parcelas}` : null,
          valor: Math.round(valorParcela * 100) / 100,
          vencimento: vencimentoParcela.toISOString().split('T')[0],
          observacao: formData.observacao || null,
          status: 'pendente',
        })
      }

      const { error } = await supabase
        .from('contas_receber')
        .insert(contasCriadas)

      if (error) throw error

      toast.success(
        parcelas > 1
          ? `${parcelas} parcelas criadas com sucesso!`
          : 'Conta cadastrada com sucesso!'
      )

      router.push('/dashboard/financeiro/contas-receber')
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
          <Link href="/dashboard/financeiro/contas-receber">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nova Conta a Receber</h1>
          <p className="text-muted-foreground">
            Cadastre um novo título ou crediário
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Cliente</CardTitle>
            <CardDescription>
              Busque e selecione o cliente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Busca de Cliente */}
            <div className="space-y-2">
              <Label htmlFor="busca">Buscar Cliente</Label>
              <div className="flex gap-2">
                <Input
                  id="busca"
                  placeholder="Digite o nome ou CPF/CNPJ do cliente..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), buscarClientes())}
                  disabled={loading}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={buscarClientes}
                  disabled={loading || buscando}
                >
                  {buscando ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Lista de resultados */}
            {clientes.length > 0 && (
              <div className="border rounded-md divide-y">
                {clientes.map((cliente) => (
                  <button
                    key={cliente.id}
                    type="button"
                    onClick={() => selecionarCliente(cliente)}
                    className="w-full px-4 py-3 text-left hover:bg-muted transition-colors"
                  >
                    <p className="font-medium">{cliente.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      {cliente.tipo_pessoa === 'PF' ? 'CPF' : 'CNPJ'}: {cliente.cpf_cnpj}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {/* Cliente Selecionado */}
            {clienteSelecionado && (
              <div className="bg-muted p-4 rounded-md">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-lg">{clienteSelecionado.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      {clienteSelecionado.tipo_pessoa === 'PF' ? 'CPF' : 'CNPJ'}: {clienteSelecionado.cpf_cnpj}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setClienteSelecionado(null)
                      setFormData(prev => ({ ...prev, cliente_id: '' }))
                    }}
                  >
                    Trocar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dados do Título</CardTitle>
            <CardDescription>
              Informações do valor a receber
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Input
                id="descricao"
                name="descricao"
                placeholder="Ex: Venda a prazo, Crediário..."
                value={formData.descricao}
                onChange={handleChange}
                disabled={loading}
              />
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
                <Label htmlFor="vencimento">Primeiro Vencimento *</Label>
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
          <Button type="submit" disabled={loading || !clienteSelecionado}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Cadastrar Título'
            )}
          </Button>
          <Button type="button" variant="outline" asChild disabled={loading}>
            <Link href="/dashboard/financeiro/contas-receber">Cancelar</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
