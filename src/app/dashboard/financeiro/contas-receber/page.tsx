import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Receipt, AlertTriangle, CheckCircle2, Clock, Ban } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ContasReceberPage() {
  const supabase = await createClient()

  // Buscar contas a receber
  const { data: contas } = await supabase
    .from('contas_receber')
    .select(`
      *,
      clientes (nome, tipo_pessoa, cpf_cnpj),
      vendas (numero)
    `)
    .order('vencimento', { ascending: true })
    .limit(50)

  // Calcular resumo
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const resumo = {
    total: 0,
    vencidas: 0,
    aVencer: 0,
    recebidas: 0,
    valorVencido: 0,
    valorAVencer: 0,
    valorRecebido: 0,
  }

  contas?.forEach((conta) => {
    resumo.total++
    if (conta.status === 'recebido') {
      resumo.recebidas++
      resumo.valorRecebido += conta.recebimento_valor || conta.valor
    } else if (conta.status !== 'cancelado') {
      const vencimento = new Date(conta.vencimento)
      vencimento.setHours(0, 0, 0, 0)
      if (vencimento < hoje) {
        resumo.vencidas++
        resumo.valorVencido += conta.valor
      } else {
        resumo.aVencer++
        resumo.valorAVencer += conta.valor
      }
    }
  })

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

  function getStatusBadge(conta: any) {
    if (conta.status === 'recebido') {
      return (
        <Badge variant="default" className="bg-green-600">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Recebido
        </Badge>
      )
    }

    if (conta.status === 'cancelado') {
      return (
        <Badge variant="secondary">
          <Ban className="mr-1 h-3 w-3" />
          Cancelado
        </Badge>
      )
    }

    const vencimento = new Date(conta.vencimento)
    vencimento.setHours(0, 0, 0, 0)

    if (vencimento < hoje) {
      return (
        <Badge variant="destructive">
          <AlertTriangle className="mr-1 h-3 w-3" />
          Vencida
        </Badge>
      )
    }

    return (
      <Badge variant="secondary">
        <Clock className="mr-1 h-3 w-3" />
        A Vencer
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contas a Receber</h1>
          <p className="text-muted-foreground">
            Gerencie seus recebíveis e crediário
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/financeiro/contas-receber/nova">
            <Plus className="mr-2 h-4 w-4" />
            Nova Conta
          </Link>
        </Button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className={resumo.valorVencido > 0 ? 'border-red-500' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencidas</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${resumo.valorVencido > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${resumo.valorVencido > 0 ? 'text-red-600' : ''}`}>
              {formatCurrency(resumo.valorVencido)}
            </div>
            <p className="text-xs text-muted-foreground">
              {resumo.vencidas} título(s) vencido(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">A Vencer</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(resumo.valorAVencer)}
            </div>
            <p className="text-xs text-muted-foreground">
              {resumo.aVencer} título(s) a vencer
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recebido</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(resumo.valorRecebido)}
            </div>
            <p className="text-xs text-muted-foreground">
              {resumo.recebidas} título(s) recebido(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total em Aberto</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(resumo.valorVencido + resumo.valorAVencer)}
            </div>
            <p className="text-xs text-muted-foreground">
              {resumo.vencidas + resumo.aVencer} título(s) em aberto
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Contas */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Títulos</CardTitle>
          <CardDescription>
            {contas?.length || 0} título(s) encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!contas || contas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Nenhum título cadastrado</h3>
              <p className="text-muted-foreground mb-4">
                Os títulos de vendas a prazo aparecerão aqui
              </p>
              <Button asChild>
                <Link href="/dashboard/financeiro/contas-receber/nova">
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Conta
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contas.map((conta) => (
                  <TableRow key={conta.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{conta.clientes?.nome || '-'}</p>
                        {conta.vendas?.numero && (
                          <p className="text-xs text-muted-foreground">
                            Venda #{conta.vendas.numero}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p>{conta.descricao || '-'}</p>
                        {conta.parcela && (
                          <p className="text-xs text-muted-foreground">
                            Parcela {conta.parcela}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatDate(conta.vencimento)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(conta.valor)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(conta)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/financeiro/contas-receber/${conta.id}`}>
                          Detalhes
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
