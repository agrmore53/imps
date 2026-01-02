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
import { Plus, Truck, Phone, Mail } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function FornecedoresPage() {
  const supabase = await createClient()

  const { data: fornecedores, error } = await supabase
    .from('fornecedores')
    .select('*')
    .order('razao_social')
    .limit(50)

  function formatCNPJ(value: string) {
    if (!value) return '-'
    return value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fornecedores</h1>
          <p className="text-muted-foreground">
            Gerencie o cadastro de fornecedores
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/fornecedores/novo">
            <Plus className="mr-2 h-4 w-4" />
            Novo Fornecedor
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Fornecedores</CardTitle>
          <CardDescription>
            {fornecedores?.length || 0} fornecedor(es) cadastrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!fornecedores || fornecedores.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Truck className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Nenhum fornecedor cadastrado</h3>
              <p className="text-muted-foreground mb-4">
                Comece cadastrando seu primeiro fornecedor
              </p>
              <Button asChild>
                <Link href="/dashboard/fornecedores/novo">
                  <Plus className="mr-2 h-4 w-4" />
                  Cadastrar Fornecedor
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Razão Social</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fornecedores.map((fornecedor) => (
                  <TableRow key={fornecedor.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{fornecedor.razao_social}</p>
                        {fornecedor.nome_fantasia && (
                          <p className="text-sm text-muted-foreground">
                            {fornecedor.nome_fantasia}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatCNPJ(fornecedor.cpf_cnpj)}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {fornecedor.contato && (
                          <p className="text-sm">{fornecedor.contato}</p>
                        )}
                        {fornecedor.telefone && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {fornecedor.telefone}
                          </div>
                        )}
                        {fornecedor.email && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {fornecedor.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={fornecedor.ativo ? 'default' : 'secondary'}>
                        {fornecedor.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/fornecedores/${fornecedor.id}`}>
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
