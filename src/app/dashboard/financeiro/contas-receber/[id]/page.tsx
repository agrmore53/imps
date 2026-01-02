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
import { Loader2, ArrowLeft, CheckCircle2, Trash2, AlertTriangle, Clock, Ban } from 'lucide-react'

interface Conta {
  id: string
  descricao: string
  cliente_id: string
  parcela: string | null
  valor: number
  vencimento: string
  recebimento_data: string | null
  recebimento_valor: number | null
  status: string
  observacao: string | null
  clientes: {
    nome: string
    tipo_pessoa: string
    cpf_cnpj: string
  } | null
  vendas: {
    numero: number
  } | null
}

export default function ContaReceberDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [conta, setConta] = useState<Conta | null>(null)
  const [dataRecebimento, setDataRecebimento] = useState('')
  const [valorRecebido, setValorRecebido] = useState('')

  useEffect(() => {
    carregarConta()
  }, [id])

  async function carregarConta() {
    try {
      const { data, error } = await supabase
        .from('contas_receber')
        .select(`
          *,
          clientes (nome, tipo_pessoa, cpf_cnpj),
          vendas (numero)
        `)
        .eq('id', id)
        .single()

      if (error) throw error

      setConta(data)
      setValorRecebido(data.valor.toString())
      setDataRecebimento(new Date().toISOString().split('T')[0])
    } catch (error) {
      toast.error('Erro ao carregar título')
      router.push('/dashboard/financeiro/contas-receber')
    } finally {
      setLoading(false)
    }
  }

  async function handleBaixar() {
    if (!conta) return

    const valor = parseFloat(valorRecebido)
    if (isNaN(valor) || valor <= 0) {
      toast.error('Valor inválido')
      return
    }

    if (!dataRecebimento) {
      toast.error('Informe a data do recebimento')
      return
    }

    setSaving(true)

    try {
      const { error } = await supabase
        .from('contas_receber')
        .update({
          status: 'recebido',
          recebimento_data: dataRecebimento,
          recebimento_valor: valor,
        })
        .eq('id', conta.id)

      if (error) throw error

      toast.success('Recebimento registrado com sucesso!')
      router.push('/dashboard/financeiro/contas-receber')
      router.refresh()
    } catch (error: any) {
      toast.error('Erro ao registrar recebimento', {
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
        .from('contas_receber')
        .update({
          status: 'pendente',
          recebimento_data: null,
          recebimento_valor: null,
        })
        .eq('id', conta.id)

      if (error) throw error

      toast.success('Recebimento estornado!')
      carregarConta()
    } catch (error: any) {
      toast.error('Erro ao estornar recebimento', {
        description: error.message,
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleCancelar() {
    if (!conta) return

    setSaving(true)

    try {
      const { error } = await supabase
        .from('contas_receber')
        .update({
          status: 'cancelado',
        })
        .eq('id', conta.id)

      if (error) throw error

      toast.success('Título cancelado!')
      carregarConta()
    } catch (error: any) {
      toast.error('Erro ao cancelar título', {
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
        .from('contas_receber')
        .delete()
        .eq('id', conta.id)

      if (error) throw error

      toast.success('Título excluído!')
      router.push('/dashboard/financeiro/contas-receber')
      router.refresh()
    } catch (error: any) {
      toast.error('Erro ao excluir título', {
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
  const vencida = conta.status === 'pendente' && vencimento < hoje

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/financeiro/contas-receber">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Detalhes do Título</h1>
          <p className="text-muted-foreground">
            {conta.descricao} {conta.parcela && `- Parcela ${conta.parcela}`}
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
                Tem certeza que deseja excluir este título? Esta ação não pode ser desfeita.
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
        {/* Informações do Título */}
        <Card>
          <CardHeader>
            <CardTitle>Informações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Status</span>
              {conta.status === 'recebido' ? (
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Recebido
                </Badge>
              ) : conta.status === 'cancelado' ? (
                <Badge variant="secondary">
                  <Ban className="mr-1 h-3 w-3" />
                  Cancelado
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
              <span className={vencida ? 'text-red-600 font-semibold' : ''}>
                {formatDate(conta.vencimento)}
              </span>
            </div>

            {conta.clientes && (
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Cliente</span>
                <span>{conta.clientes.nome}</span>
              </div>
            )}

            {conta.vendas?.numero && (
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Venda</span>
                <span>#{conta.vendas.numero}</span>
              </div>
            )}

            {conta.observacao && (
              <div className="py-2">
                <span className="text-muted-foreground block mb-1">Observação</span>
                <p className="text-sm">{conta.observacao}</p>
              </div>
            )}

            {conta.status === 'recebido' && (
              <>
                <div className="border-t pt-4 mt-4">
                  <p className="font-medium text-green-600 mb-2">Dados do Recebimento</p>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Data do Recebimento</span>
                  <span>{conta.recebimento_data ? formatDate(conta.recebimento_data) : '-'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Valor Recebido</span>
                  <span className="font-semibold text-green-600">
                    {conta.recebimento_valor ? formatCurrency(conta.recebimento_valor) : '-'}
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
              {conta.status === 'recebido' ? 'Recebimento Realizado' :
               conta.status === 'cancelado' ? 'Título Cancelado' : 'Baixar Recebimento'}
            </CardTitle>
            <CardDescription>
              {conta.status === 'recebido'
                ? 'Este título já foi recebido'
                : conta.status === 'cancelado'
                ? 'Este título foi cancelado'
                : 'Registre o recebimento deste título'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {conta.status === 'recebido' ? (
              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-md border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <p className="font-medium text-green-800 dark:text-green-200">
                      Recebido em {conta.recebimento_data ? formatDate(conta.recebimento_data) : '-'}
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
                  Estornar Recebimento
                </Button>
              </div>
            ) : conta.status === 'cancelado' ? (
              <div className="bg-gray-50 dark:bg-gray-900/20 p-4 rounded-md border border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <Ban className="h-5 w-5 text-gray-500" />
                  <p className="font-medium text-gray-700 dark:text-gray-300">
                    Este título foi cancelado
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="dataRecebimento">Data do Recebimento *</Label>
                  <Input
                    id="dataRecebimento"
                    type="date"
                    value={dataRecebimento}
                    onChange={(e) => setDataRecebimento(e.target.value)}
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="valorRecebido">Valor Recebido *</Label>
                  <Input
                    id="valorRecebido"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={valorRecebido}
                    onChange={(e) => setValorRecebido(e.target.value)}
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
                      Confirmar Recebimento
                    </>
                  )}
                </Button>

                <div className="border-t pt-4">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleCancelar}
                    disabled={saving}
                  >
                    <Ban className="mr-2 h-4 w-4" />
                    Cancelar Título
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
