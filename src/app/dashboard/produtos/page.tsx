import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Package, Upload } from 'lucide-react'
import { ProdutosTable } from '@/components/produtos-table'

export default async function ProdutosPage() {
  const supabase = await createClient()

  const { data: produtos, error } = await supabase
    .from('produtos')
    .select('id, codigo, nome, ncm, preco_venda, estoque_atual, estoque_minimo, unidade, ativo')
    .order('nome')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produtos</h1>
          <p className="text-muted-foreground">
            Gerencie o cadastro de produtos
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/produtos/importar">
              <Upload className="mr-2 h-4 w-4" />
              Importar
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/produtos/novo">
              <Plus className="mr-2 h-4 w-4" />
              Novo Produto
            </Link>
          </Button>
        </div>
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
            <ProdutosTable produtos={produtos} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
