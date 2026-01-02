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
import { FileText, CheckCircle2, XCircle, Clock, AlertTriangle, Download, Eye } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function NFCeListPage() {
  const supabase = await createClient()

  // Buscar notas fiscais NFC-e
  const { data: notas } = await supabase
    .from('notas_fiscais')
    .select(`
      *,
      vendas (numero, total, data_hora)
    `)
    .eq('tipo', 'nfce')
    .order('emitida_em', { ascending: false })
    .limit(50)

  // Calcular resumo
  const resumo = {
    total: notas?.length || 0,
    autorizadas: notas?.filter(n => n.status === 'autorizada').length || 0,
    canceladas: notas?.filter(n => n.status === 'cancelada').length || 0,
    pendentes: notas?.filter(n => n.status === 'pendente').length || 0,
    rejeitadas: notas?.filter(n => n.status === 'rejeitada').length || 0,
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  function formatDateTime(date: string) {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date))
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'autorizada':
        return (
          <Badge className="bg-green-600">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Autorizada
          </Badge>
        )
      case 'cancelada':
        return (
          <Badge variant="secondary">
            <XCircle className="mr-1 h-3 w-3" />
            Cancelada
          </Badge>
        )
      case 'rejeitada':
        return (
          <Badge variant="destructive">
            <AlertTriangle className="mr-1 h-3 w-3" />
            Rejeitada
          </Badge>
        )
      case 'pendente':
      default:
        return (
          <Badge variant="outline">
            <Clock className="mr-1 h-3 w-3" />
            Pendente
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">NFC-e</h1>
          <p className="text-muted-foreground">
            Nota Fiscal de Consumidor Eletrônica
          </p>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Emitidas</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resumo.total}</div>
            <p className="text-xs text-muted-foreground">notas fiscais</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Autorizadas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{resumo.autorizadas}</div>
            <p className="text-xs text-muted-foreground">notas válidas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Canceladas</CardTitle>
            <XCircle className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resumo.canceladas}</div>
            <p className="text-xs text-muted-foreground">notas canceladas</p>
          </CardContent>
        </Card>

        <Card className={resumo.rejeitadas > 0 ? 'border-red-500' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejeitadas</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${resumo.rejeitadas > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${resumo.rejeitadas > 0 ? 'text-red-600' : ''}`}>
              {resumo.rejeitadas}
            </div>
            <p className="text-xs text-muted-foreground">requer atenção</p>
          </CardContent>
        </Card>
      </div>

      {/* Informativo */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <FileText className="h-8 w-8 text-blue-600 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-800 dark:text-blue-200">
                Emissão Automática
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                As NFC-e são emitidas automaticamente ao finalizar uma venda no PDV.
                Configure o certificado digital e dados fiscais em{' '}
                <Link href="/dashboard/fiscal/configuracoes" className="underline font-medium">
                  Configurações Fiscais
                </Link>
                {' '}para habilitar a emissão.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Notas */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de NFC-e</CardTitle>
          <CardDescription>
            {notas?.length || 0} nota(s) encontrada(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!notas || notas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Nenhuma NFC-e emitida</h3>
              <p className="text-muted-foreground mb-4">
                As notas fiscais emitidas no PDV aparecerão aqui
              </p>
              <Button asChild>
                <Link href="/pdv">
                  Ir para o PDV
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Série</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Venda</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notas.map((nota) => (
                  <TableRow key={nota.id}>
                    <TableCell className="font-mono font-medium">
                      {nota.numero}
                    </TableCell>
                    <TableCell className="font-mono">
                      {nota.serie}
                    </TableCell>
                    <TableCell>
                      {nota.emitida_em ? formatDateTime(nota.emitida_em) : '-'}
                    </TableCell>
                    <TableCell>
                      {nota.vendas?.numero ? `#${nota.vendas.numero}` : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {nota.vendas?.total ? formatCurrency(nota.vendas.total) : '-'}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(nota.status)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/dashboard/fiscal/nfce/${nota.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        {nota.status === 'autorizada' && (
                          <Button variant="ghost" size="sm" title="Download XML">
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
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
