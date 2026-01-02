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
import { Plus, Users, Phone, Mail } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ClientesPage() {
  const supabase = await createClient()

  const { data: clientes, error } = await supabase
    .from('clientes')
    .select('*')
    .order('nome')
    .limit(50)

  function formatCPFCNPJ(value: string) {
    if (!value) return '-'
    if (value.length === 11) {
      return value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    }
    return value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">
            Gerencie o cadastro de clientes
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/clientes/novo">
            <Plus className="mr-2 h-4 w-4" />
            Novo Cliente
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Clientes</CardTitle>
          <CardDescription>
            {clientes?.length || 0} cliente(s) cadastrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!clientes || clientes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Nenhum cliente cadastrado</h3>
              <p className="text-muted-foreground mb-4">
                Comece cadastrando seu primeiro cliente
              </p>
              <Button asChild>
                <Link href="/dashboard/clientes/novo">
                  <Plus className="mr-2 h-4 w-4" />
                  Cadastrar Cliente
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF/CNPJ</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Limite de Crédito</TableHead>
                  <TableHead>Saldo Devedor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.map((cliente) => (
                  <TableRow key={cliente.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{cliente.nome}</p>
                        <Badge variant="outline" className="text-xs">
                          {cliente.tipo_pessoa}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatCPFCNPJ(cliente.cpf_cnpj)}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {cliente.telefone && (
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3" />
                            {cliente.telefone}
                          </div>
                        )}
                        {cliente.email && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {cliente.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(cliente.limite_credito || 0)}</TableCell>
                    <TableCell>
                      <span className={cliente.saldo_devedor > 0 ? 'text-red-600 font-semibold' : ''}>
                        {formatCurrency(cliente.saldo_devedor || 0)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={cliente.ativo ? 'default' : 'secondary'}>
                        {cliente.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/clientes/${cliente.id}`}>
                          Editar
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
