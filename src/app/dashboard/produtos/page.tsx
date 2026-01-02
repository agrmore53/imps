import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
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
import { Plus, Package } from 'lucide-react'

export default async function ProdutosPage() {
  const supabase = await createClient()

  const { data: produtos, error } = await supabase
    .from('produtos')
    .select('*')
    .order('nome')
    .limit(50)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produtos</h1>
          <p className="text-muted-foreground">
            Gerencie o cadastro de produtos
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/produtos/novo">
            <Plus className="mr-2 h-4 w-4" />
            Novo Produto
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Produtos</CardTitle>
          <CardDescription>
            {produtos?.length || 0} produto(s) cadastrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!produtos || produtos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Nenhum produto cadastrado</h3>
              <p className="text-muted-foreground mb-4">
                Comece cadastrando seu primeiro produto
              </p>
              <Button asChild>
                <Link href="/dashboard/produtos/novo">
                  <Plus className="mr-2 h-4 w-4" />
                  Cadastrar Produto
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Preço Venda</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {produtos.map((produto) => (
                  <TableRow key={produto.id}>
                    <TableCell className="font-mono">{produto.codigo}</TableCell>
                    <TableCell className="font-medium">{produto.nome}</TableCell>
                    <TableCell>
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(produto.preco_venda)}
                    </TableCell>
                    <TableCell>
                      <span className={produto.estoque_atual <= produto.estoque_minimo ? 'text-red-600 font-semibold' : ''}>
                        {produto.estoque_atual} {produto.unidade}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={produto.ativo ? 'default' : 'secondary'}>
                        {produto.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/produtos/${produto.id}`}>
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
