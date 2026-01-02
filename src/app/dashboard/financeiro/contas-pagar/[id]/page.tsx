'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { Loader2, ArrowLeft, CheckCircle2, Trash2, AlertTriangle, Clock } from 'lucide-react'

interface Conta {
  id: string
  descricao: string
  fornecedor_id: string | null
  categoria: string | null
  valor: number
  vencimento: string
  pagamento_data: string | null
  pagamento_valor: number | null
  status: string
  observacao: string | null
  fornecedores: {
    razao_social: string
    nome_fantasia: string | null
  } | null
}

export default function ContaPagarDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [conta, setConta] = useState<Conta | null>(null)
  const [dataPagamento, setDataPagamento] = useState('')
  const [valorPago, setValorPago] = useState('')

  useEffect(() => {
    carregarConta()
  }, [id])

  async function carregarConta() {
    try {
      const { data, error } = await supabase
        .from('contas_pagar')
        .select(`
          *,
          fornecedores (razao_social, nome_fantasia)
        `)
        .eq('id', id)
        .single()

      if (error) throw error

      setConta(data)
      setValorPago(data.valor.toString())
      setDataPagamento(new Date().toISOString().split('T')[0])
    } catch (error) {
      toast.error('Erro ao carregar conta')
      router.push('/dashboard/financeiro/contas-pagar')
    } finally {
      setLoading(false)
    }
  }

  async function handleBaixar() {
    if (!conta) return

    const valor = parseFloat(valorPago)
    if (isNaN(valor) || valor <= 0) {
      toast.error('Valor inválido')
      return
    }

    if (!dataPagamento) {
      toast.error('Informe a data do pagamento')
      return
    }

    setSaving(true)

    try {
      const { error } = await supabase
        .from('contas_pagar')
        .update({
          status: 'pago',
          pagamento_data: dataPagamento,
          pagamento_valor: valor,
        })
        .eq('id', conta.id)

      if (error) throw error

      toast.success('Pagamento registrado com sucesso!')
      router.push('/dashboard/financeiro/contas-pagar')
      router.refresh()
    } catch (error: any) {
      toast.error('Erro ao registrar pagamento', {
        description: error.message,
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleEstornar() {
    if (!conta) return

    setSaving(true)

    try {
      const { error } = await supabase
        .from('contas_pagar')
        .update({
          status: 'pendente',
          pagamento_data: null,
          pagamento_valor: null,
        })
        .eq('id', conta.id)

      if (error) throw error

      toast.success('Pagamento estornado!')
      carregarConta()
    } catch (error: any) {
      toast.error('Erro ao estornar pagamento', {
        description: error.message,
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleExcluir() {
    if (!conta) return

    setDeleting(true)

    try {
      const { error } = await supabase
        .from('contas_pagar')
        .delete()
        .eq('id', conta.id)

      if (error) throw error

      toast.success('Conta excluída!')
      router.push('/dashboard/financeiro/contas-pagar')
      router.refresh()
    } catch (error: any) {
      toast.error('Erro ao excluir conta', {
        description: error.message,
      })
    } finally {
      setDeleting(false)
    }
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  function formatDate(date: string) {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(date))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!conta) {
    return null
  }

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const vencimento = new Date(conta.vencimento)
  vencimento.setHours(0, 0, 0, 0)
  const vencida = conta.status !== 'pago' && vencimento < hoje

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/financeiro/contas-pagar">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Detalhes da Conta</h1>
          <p className="text-muted-foreground">
            {conta.descricao}
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" disabled={deleting}>
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleExcluir} className="bg-destructive text-destructive-foreground">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Informações da Conta */}
        <Card>
          <CardHeader>
            <CardTitle>Informações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Status</span>
              {conta.status === 'pago' ? (
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Pago
                </Badge>
              ) : vencida ? (
                <Badge variant="destructive">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  Vencida
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <Clock className="mr-1 h-3 w-3" />
                  A Vencer
                </Badge>
              )}
            </div>

            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Valor</span>
              <span className="font-semibold text-lg">{formatCurrency(conta.valor)}</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Vencimento</span>
              <span className={vencida && conta.status !== 'pago' ? 'text-red-600 font-semibold' : ''}>
                {formatDate(conta.vencimento)}
              </span>
            </div>

            {conta.fornecedores && (
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Fornecedor</span>
                <span>{conta.fornecedores.nome_fantasia || conta.fornecedores.razao_social}</span>
              </div>
            )}

            {conta.categoria && (
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Categoria</span>
                <span>{conta.categoria}</span>
              </div>
            )}

            {conta.observacao && (
              <div className="py-2">
                <span className="text-muted-foreground block mb-1">Observação</span>
                <p className="text-sm">{conta.observacao}</p>
              </div>
            )}

            {conta.status === 'pago' && (
              <>
                <div className="border-t pt-4 mt-4">
                  <p className="font-medium text-green-600 mb-2">Dados do Pagamento</p>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Data do Pagamento</span>
                  <span>{conta.pagamento_data ? formatDate(conta.pagamento_data) : '-'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Valor Pago</span>
                  <span className="font-semibold text-green-600">
                    {conta.pagamento_valor ? formatCurrency(conta.pagamento_valor) : '-'}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Ações */}
        <Card>
          <CardHeader>
            <CardTitle>
              {conta.status === 'pago' ? 'Pagamento Realizado' : 'Baixar Pagamento'}
            </CardTitle>
            <CardDescription>
              {conta.status === 'pago'
                ? 'Esta conta já foi paga'
                : 'Registre o pagamento desta conta'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {conta.status === 'pago' ? (
              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-md border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <p className="font-medium text-green-800 dark:text-green-200">
                      Conta paga em {conta.pagamento_data ? formatDate(conta.pagamento_data) : '-'}
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleEstornar}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Estornar Pagamento
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="dataPagamento">Data do Pagamento *</Label>
                  <Input
                    id="dataPagamento"
                    type="date"
                    value={dataPagamento}
                    onChange={(e) => setDataPagamento(e.target.value)}
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="valorPago">Valor Pago *</Label>
                  <Input
                    id="valorPago"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={valorPago}
                    onChange={(e) => setValorPago(e.target.value)}
                    disabled={saving}
                  />
                </div>

                <Button
                  className="w-full"
                  onClick={handleBaixar}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Confirmar Pagamento
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
