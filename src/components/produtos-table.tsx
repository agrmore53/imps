'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, Settings2 } from 'lucide-react'
import { NCMSearch } from '@/components/ncm-search'

interface Produto {
  id: string
  codigo: string
  nome: string
  ncm: string | null
  preco_venda: number
  estoque_atual: number
  estoque_minimo: number
  unidade: string
  ativo: boolean
}

interface ProdutosTableProps {
  produtos: Produto[]
}

export function ProdutosTable({ produtos }: ProdutosTableProps) {
  const router = useRouter()
  const [selecionados, setSelecionados] = useState<string[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [ncmLote, setNcmLote] = useState('')

  const todosSelecionados = selecionados.length === produtos.length && produtos.length > 0
  const algunsSelecionados = selecionados.length > 0 && selecionados.length < produtos.length

  function toggleTodos() {
    if (todosSelecionados) {
      setSelecionados([])
    } else {
      setSelecionados(produtos.map(p => p.id))
    }
  }

  function toggleProduto(id: string) {
    setSelecionados(prev =>
      prev.includes(id)
        ? prev.filter(p => p !== id)
        : [...prev, id]
    )
  }

  async function handleAtualizarLote() {
    if (!ncmLote) {
      toast.error('Selecione um NCM')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/produtos/atualizar-lote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produto_ids: selecionados,
          dados: { ncm: ncmLote },
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao atualizar')
      }

      toast.success(`${data.atualizados} produto(s) atualizado(s)!`)
      setDialogOpen(false)
      setSelecionados([])
      setNcmLote('')
      router.refresh()
    } catch (error: any) {
      toast.error('Erro ao atualizar produtos', {
        description: error.message,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {selecionados.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg mb-4">
          <span className="text-sm font-medium">
            {selecionados.length} produto(s) selecionado(s)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelecionados([])}
            >
              Limpar seleção
            </Button>
            <Button
              size="sm"
              onClick={() => setDialogOpen(true)}
            >
              <Settings2 className="mr-2 h-4 w-4" />
              Atualizar NCM em lote
            </Button>
          </div>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={todosSelecionados}
                ref={(el) => {
                  if (el) {
                    (el as any).indeterminate = algunsSelecionados
                  }
                }}
                onCheckedChange={toggleTodos}
              />
            </TableHead>
            <TableHead>Código</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>NCM</TableHead>
            <TableHead>Preço Venda</TableHead>
            <TableHead>Estoque</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {produtos.map((produto) => (
            <TableRow
              key={produto.id}
              className={selecionados.includes(produto.id) ? 'bg-muted/50' : ''}
            >
              <TableCell>
                <Checkbox
                  checked={selecionados.includes(produto.id)}
                  onCheckedChange={() => toggleProduto(produto.id)}
                />
              </TableCell>
              <TableCell className="font-mono">{produto.codigo}</TableCell>
              <TableCell className="font-medium">{produto.nome}</TableCell>
              <TableCell>
                {produto.ncm ? (
                  <span className="font-mono text-xs">{produto.ncm}</span>
                ) : (
                  <span className="text-muted-foreground text-xs">-</span>
                )}
              </TableCell>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atualizar NCM em Lote</DialogTitle>
            <DialogDescription>
              Aplicar o mesmo NCM para {selecionados.length} produto(s) selecionado(s)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>NCM</Label>
              <NCMSearch
                value={ncmLote}
                onChange={setNcmLote}
                disabled={loading}
              />
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Atenção:</strong> Verifique se o NCM está correto antes de aplicar.
                NCM incorreto pode resultar em impostos maiores ou multas fiscais.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAtualizarLote}
              disabled={loading || !ncmLote}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Atualizando...
                </>
              ) : (
                'Aplicar NCM'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
