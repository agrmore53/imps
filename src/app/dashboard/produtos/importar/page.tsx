'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, Upload, FileSpreadsheet, Check, AlertTriangle } from 'lucide-react'
import * as XLSX from 'xlsx'

interface ProdutoImportacao {
  nome: string
  preco_venda: number
  preco_custo: number
  estoque_atual: number
  estoque_minimo: number
  unidade: string
}

export default function ImportarProdutosPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [produtos, setProdutos] = useState<ProdutoImportacao[]>([])
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState<{
    importados: number
    erros: { produto: string; erro: string }[]
  } | null>(null)

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setProdutos([])
    setResultado(null)

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      const produtosProcessados: ProdutoImportacao[] = []

      for (const row of jsonData as any[]) {
        // Tentar identificar as colunas automaticamente
        const nome = row['Item'] || row['Nome'] || row['Produto'] || row['NOME'] || row['PRODUTO'] || ''
        const precoVenda = parseFloat(row['Preço'] || row['Preco'] || row['PRECO'] || row['Preço Venda'] || row['preco_venda'] || 0)
        const precoCusto = parseFloat(row['Valor Unitario'] || row['Custo'] || row['CUSTO'] || row['Preço Custo'] || row['preco_custo'] || 0)
        const estoqueAtual = parseFloat(row['Quantidade Disponivel'] || row['Quantidade'] || row['Estoque'] || row['ESTOQUE'] || row['estoque_atual'] || 0)
        const estoqueMinimo = parseFloat(row['Estoque Minimo'] || row['Minimo'] || row['MINIMO'] || row['estoque_minimo'] || 0)
        const unidade = row['Unidade'] || row['UN'] || row['unidade'] || 'UN'

        if (nome && nome.toString().trim()) {
          produtosProcessados.push({
            nome: nome.toString().trim(),
            preco_venda: isNaN(precoVenda) ? 0 : precoVenda,
            preco_custo: isNaN(precoCusto) ? 0 : precoCusto,
            estoque_atual: isNaN(estoqueAtual) ? 0 : estoqueAtual,
            estoque_minimo: isNaN(estoqueMinimo) ? 0 : estoqueMinimo,
            unidade: unidade.toString().trim() || 'UN',
          })
        }
      }

      if (produtosProcessados.length === 0) {
        toast.error('Nenhum produto encontrado no arquivo')
        return
      }

      setProdutos(produtosProcessados)
      toast.success(`${produtosProcessados.length} produtos encontrados no arquivo`)
    } catch (error: any) {
      toast.error('Erro ao ler arquivo', {
        description: error.message,
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleImportar() {
    if (produtos.length === 0) {
      toast.error('Nenhum produto para importar')
      return
    }

    setImportando(true)
    setResultado(null)

    try {
      const response = await fetch('/api/produtos/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ produtos }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao importar')
      }

      setResultado(data.resultados)

      if (data.resultados.erros.length === 0) {
        toast.success(`${data.resultados.importados} produtos importados com sucesso!`)
      } else {
        toast.warning(`${data.resultados.importados} importados, ${data.resultados.erros.length} erros`)
      }
    } catch (error: any) {
      toast.error('Erro ao importar produtos', {
        description: error.message,
      })
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/produtos">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Importar Produtos</h1>
          <p className="text-muted-foreground">
            Importe produtos de uma planilha Excel
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Selecionar Arquivo
            </CardTitle>
            <CardDescription>
              Selecione um arquivo Excel (.xls ou .xlsx) com os produtos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xls,.xlsx"
                onChange={handleFileUpload}
                className="hidden"
              />
              <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Arraste um arquivo ou clique para selecionar
              </p>
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Lendo arquivo...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Selecionar Arquivo
                  </>
                )}
              </Button>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Colunas esperadas:</strong></p>
              <ul className="list-disc list-inside">
                <li>Item / Nome / Produto</li>
                <li>Preço / Preço Venda</li>
                <li>Valor Unitario / Custo (opcional)</li>
                <li>Quantidade Disponivel / Estoque (opcional)</li>
                <li>Estoque Minimo (opcional)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Preview dos Produtos</CardTitle>
            <CardDescription>
              {produtos.length > 0
                ? `${produtos.length} produtos prontos para importar`
                : 'Selecione um arquivo para visualizar'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {produtos.length > 0 ? (
              <div className="space-y-4">
                <div className="max-h-[300px] overflow-y-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left p-2">Nome</th>
                        <th className="text-right p-2">Preço</th>
                        <th className="text-right p-2">Estoque</th>
                      </tr>
                    </thead>
                    <tbody>
                      {produtos.map((p, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2 truncate max-w-[200px]">{p.nome}</td>
                          <td className="p-2 text-right">R$ {p.preco_venda.toFixed(2)}</td>
                          <td className="p-2 text-right">{p.estoque_atual}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Button
                  onClick={handleImportar}
                  disabled={importando}
                  className="w-full"
                >
                  {importando ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Importar {produtos.length} Produtos
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum produto carregado
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resultado */}
      {resultado && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {resultado.erros.length === 0 ? (
                <Check className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              )}
              Resultado da Importação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="p-4 bg-green-100 dark:bg-green-950 rounded-lg flex-1">
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                  {resultado.importados}
                </p>
                <p className="text-sm text-green-600 dark:text-green-500">
                  Produtos importados
                </p>
              </div>
              {resultado.erros.length > 0 && (
                <div className="p-4 bg-red-100 dark:bg-red-950 rounded-lg flex-1">
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                    {resultado.erros.length}
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-500">
                    Erros
                  </p>
                </div>
              )}
            </div>

            {resultado.erros.length > 0 && (
              <div className="border rounded-lg p-4">
                <p className="font-medium mb-2">Erros encontrados:</p>
                <ul className="text-sm space-y-1 max-h-[200px] overflow-y-auto">
                  {resultado.erros.map((erro, i) => (
                    <li key={i} className="text-red-600 dark:text-red-400">
                      <strong>{erro.produto}:</strong> {erro.erro}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button asChild className="w-full">
              <Link href="/dashboard/produtos">
                Ver Produtos
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
