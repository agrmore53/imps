'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Upload,
  FileText,
  Package,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Building2,
} from 'lucide-react'

interface ProdutoXML {
  numero_item: string
  codigo: string
  codigo_barras: string
  descricao: string
  ncm: string
  cfop: string
  unidade: string
  quantidade: number
  valor_unitario: number
  valor_total: number
  produto_id: string | null
  produto_nome: string | null
  status: 'encontrado' | 'nao_encontrado'
  selecionado?: boolean
}

interface DadosNFe {
  fornecedor: {
    cnpj: string
    razao_social: string
    nome_fantasia: string
    ie: string
  }
  nota: {
    numero: string
    serie: string
    data_emissao: string
    chave: string
  }
  produtos: ProdutoXML[]
  totais: {
    valor_produtos: number
    valor_frete: number
    valor_desconto: number
    valor_total: number
  }
}

export default function ImportarXMLPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [dadosNFe, setDadosNFe] = useState<DadosNFe | null>(null)
  const [produtosSelecionados, setProdutosSelecionados] = useState<Set<string>>(new Set())
  const [criarContaPagar, setCriarContaPagar] = useState(true)
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null)

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  const formatCNPJ = (cnpj: string) => {
    if (!cnpj || cnpj.length !== 14) return cnpj
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  }

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.xml')) {
      toast.error('Por favor, selecione um arquivo XML')
      return
    }

    setArquivoSelecionado(file)
    setLoading(true)
    setDadosNFe(null)

    try {
      const formData = new FormData()
      formData.append('xml', file)
      formData.append('modo', 'preview')

      const response = await fetch('/api/estoque/importar-xml', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao processar XML')
      }

      setDadosNFe(result.dados)

      // Selecionar automaticamente os produtos encontrados
      const encontrados = new Set<string>()
      result.dados.produtos.forEach((p: ProdutoXML) => {
        if (p.status === 'encontrado') {
          encontrados.add(p.numero_item)
        }
      })
      setProdutosSelecionados(encontrados)

      toast.success(`XML processado: ${result.dados.produtos.length} produto(s) encontrado(s)`)
    } catch (error) {
      toast.error((error as Error).message)
      setArquivoSelecionado(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const toggleProduto = (numeroItem: string) => {
    const novos = new Set(produtosSelecionados)
    if (novos.has(numeroItem)) {
      novos.delete(numeroItem)
    } else {
      novos.add(numeroItem)
    }
    setProdutosSelecionados(novos)
  }

  const toggleTodos = () => {
    if (!dadosNFe) return

    const produtosEncontrados = dadosNFe.produtos.filter((p) => p.status === 'encontrado')

    if (produtosSelecionados.size === produtosEncontrados.length) {
      setProdutosSelecionados(new Set())
    } else {
      const todos = new Set<string>()
      produtosEncontrados.forEach((p) => todos.add(p.numero_item))
      setProdutosSelecionados(todos)
    }
  }

  const handleImportar = async () => {
    if (!dadosNFe || !arquivoSelecionado) return

    const produtosParaImportar = dadosNFe.produtos.filter(
      (p) => produtosSelecionados.has(p.numero_item) && p.status === 'encontrado'
    )

    if (produtosParaImportar.length === 0) {
      toast.error('Selecione pelo menos um produto para importar')
      return
    }

    setImporting(true)

    try {
      const formData = new FormData()
      formData.append('xml', arquivoSelecionado)
      formData.append('modo', 'importar')
      formData.append('produtos', JSON.stringify(produtosParaImportar))
      formData.append('criar_conta_pagar', criarContaPagar.toString())

      const response = await fetch('/api/estoque/importar-xml', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao importar')
      }

      toast.success(
        `Importação concluída: ${result.totais.importados} produto(s) importado(s)`
      )

      // Redirecionar para estoque
      router.push('/dashboard/estoque')
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setImporting(false)
    }
  }

  const produtosEncontrados = dadosNFe?.produtos.filter((p) => p.status === 'encontrado').length || 0
  const produtosNaoEncontrados = dadosNFe?.produtos.filter((p) => p.status === 'nao_encontrado').length || 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/estoque">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Importar XML</h1>
          <p className="text-muted-foreground">
            Importe produtos a partir de uma NF-e do fornecedor
          </p>
        </div>
      </div>

      {/* Upload de arquivo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Arquivo XML da NF-e
          </CardTitle>
          <CardDescription>
            Selecione o arquivo XML da nota fiscal recebida do fornecedor
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <label
              htmlFor="xml-upload"
              className="flex-1 flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
            >
              {loading ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <span className="mt-2 text-sm text-muted-foreground">Processando XML...</span>
                </div>
              ) : arquivoSelecionado ? (
                <div className="flex flex-col items-center">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                  <span className="mt-2 text-sm font-medium">{arquivoSelecionado.name}</span>
                  <span className="text-xs text-muted-foreground">Clique para selecionar outro</span>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="mt-2 text-sm text-muted-foreground">
                    Clique para selecionar ou arraste o arquivo
                  </span>
                  <span className="text-xs text-muted-foreground">Apenas arquivos .xml</span>
                </div>
              )}
              <input
                id="xml-upload"
                type="file"
                accept=".xml"
                className="hidden"
                onChange={handleFileSelect}
                disabled={loading}
              />
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Dados do fornecedor e nota */}
      {dadosNFe && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Fornecedor
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="font-medium">{dadosNFe.fornecedor.razao_social}</p>
                {dadosNFe.fornecedor.nome_fantasia !== dadosNFe.fornecedor.razao_social && (
                  <p className="text-sm text-muted-foreground">{dadosNFe.fornecedor.nome_fantasia}</p>
                )}
                <p className="text-sm">CNPJ: {formatCNPJ(dadosNFe.fornecedor.cnpj)}</p>
                {dadosNFe.fornecedor.ie && (
                  <p className="text-sm">IE: {dadosNFe.fornecedor.ie}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Nota Fiscal
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="font-medium">NF-e {dadosNFe.nota.numero}/{dadosNFe.nota.serie}</p>
                {dadosNFe.nota.data_emissao && (
                  <p className="text-sm">
                    Emissão: {new Date(dadosNFe.nota.data_emissao).toLocaleDateString('pt-BR')}
                  </p>
                )}
                <p className="text-sm font-mono text-xs break-all">
                  Chave: {dadosNFe.nota.chave || 'Não disponível'}
                </p>
                <p className="text-lg font-bold text-primary mt-2">
                  Total: {formatCurrency(dadosNFe.totais.valor_total)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Status de matching */}
          <div className="flex gap-4">
            <Badge variant="default" className="text-sm py-1 px-3">
              <CheckCircle2 className="h-4 w-4 mr-1" />
              {produtosEncontrados} produto(s) encontrado(s)
            </Badge>
            {produtosNaoEncontrados > 0 && (
              <Badge variant="secondary" className="text-sm py-1 px-3">
                <AlertCircle className="h-4 w-4 mr-1" />
                {produtosNaoEncontrados} não vinculado(s)
              </Badge>
            )}
          </div>

          {/* Lista de produtos */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Produtos da Nota
                  </CardTitle>
                  <CardDescription>
                    Selecione os produtos que deseja dar entrada no estoque
                  </CardDescription>
                </div>
                {produtosEncontrados > 0 && (
                  <Button variant="outline" size="sm" onClick={toggleTodos}>
                    {produtosSelecionados.size === produtosEncontrados
                      ? 'Desmarcar todos'
                      : 'Selecionar todos'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Vinculado a</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Valor Unit.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dadosNFe.produtos.map((produto) => (
                    <TableRow
                      key={produto.numero_item}
                      className={produto.status === 'nao_encontrado' ? 'opacity-60' : ''}
                    >
                      <TableCell>
                        <Checkbox
                          checked={produtosSelecionados.has(produto.numero_item)}
                          onCheckedChange={() => toggleProduto(produto.numero_item)}
                          disabled={produto.status === 'nao_encontrado'}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{produto.descricao}</p>
                          <p className="text-xs text-muted-foreground">
                            Cód: {produto.codigo} | NCM: {produto.ncm}
                          </p>
                          {produto.codigo_barras && produto.codigo_barras !== 'SEM GTIN' && (
                            <p className="text-xs text-muted-foreground">
                              EAN: {produto.codigo_barras}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {produto.produto_nome ? (
                          <span className="text-sm text-green-600 font-medium">
                            {produto.produto_nome}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {produto.quantidade} {produto.unidade}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(produto.valor_unitario)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(produto.valor_total)}
                      </TableCell>
                      <TableCell>
                        {produto.status === 'encontrado' ? (
                          <Badge variant="default">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Encontrado
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <XCircle className="h-3 w-3 mr-1" />
                            Não vinculado
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {produtosNaoEncontrados > 0 && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <p className="text-sm flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                    <span>
                      <strong>{produtosNaoEncontrados} produto(s)</strong> não foram vinculados.
                      Cadastre-os primeiro em{' '}
                      <Link href="/dashboard/produtos/novo" className="text-primary underline">
                        Produtos
                      </Link>{' '}
                      para importá-los.
                    </span>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Opções e ações */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="conta-pagar"
                    checked={criarContaPagar}
                    onCheckedChange={setCriarContaPagar}
                  />
                  <Label htmlFor="conta-pagar">
                    Criar conta a pagar ({formatCurrency(dadosNFe.totais.valor_total)})
                  </Label>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" asChild>
                    <Link href="/dashboard/estoque">Cancelar</Link>
                  </Button>
                  <Button
                    onClick={handleImportar}
                    disabled={importing || produtosSelecionados.size === 0}
                  >
                    {importing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Importar {produtosSelecionados.size} Produto(s)
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
