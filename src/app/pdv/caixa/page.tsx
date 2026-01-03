'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import {
  ArrowLeft,
  DollarSign,
  Loader2,
  LockOpen,
  Lock,
  ArrowDownCircle,
  ArrowUpCircle,
  ShoppingCart,
  Banknote,
  CreditCard,
  QrCode,
  RefreshCw,
} from 'lucide-react'

interface Caixa {
  id: string
  data_abertura: string
  valor_abertura: number
  status: 'aberto' | 'fechado'
}

interface Movimento {
  id: string
  tipo: 'entrada' | 'saida' | 'sangria' | 'suprimento'
  valor: number
  descricao: string
  created_at: string
}

interface Resumo {
  total_vendas: number
  total_sangrias: number
  total_suprimentos: number
  total_dinheiro: number
  total_cartao_credito: number
  total_cartao_debito: number
  total_pix: number
  quantidade_vendas: number
}

export default function CaixaPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [operando, setOperando] = useState(false)
  const [caixa, setCaixa] = useState<Caixa | null>(null)
  const [movimentos, setMovimentos] = useState<Movimento[]>([])
  const [resumo, setResumo] = useState<Resumo>({
    total_vendas: 0,
    total_sangrias: 0,
    total_suprimentos: 0,
    total_dinheiro: 0,
    total_cartao_credito: 0,
    total_cartao_debito: 0,
    total_pix: 0,
    quantidade_vendas: 0,
  })
  const [nomeUsuario, setNomeUsuario] = useState('')

  // Dialogs
  const [dialogAbrir, setDialogAbrir] = useState(false)
  const [dialogFechar, setDialogFechar] = useState(false)
  const [dialogSangria, setDialogSangria] = useState(false)
  const [dialogSuprimento, setDialogSuprimento] = useState(false)

  // Form values
  const [valorAbertura, setValorAbertura] = useState('')
  const [valorFechamento, setValorFechamento] = useState('')
  const [valorSangria, setValorSangria] = useState('')
  const [valorSuprimento, setValorSuprimento] = useState('')
  const [observacao, setObservacao] = useState('')

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  const formatDateTime = (date: string) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date))
  }

  const carregarCaixa = useCallback(async () => {
    try {
      const response = await fetch('/api/caixa')
      const data = await response.json()

      if (response.ok) {
        setCaixa(data.caixa)
        setMovimentos(data.movimentos || [])
        setResumo(data.resumo)
        setNomeUsuario(data.usuario?.nome || '')
      }
    } catch (error) {
      toast.error('Erro ao carregar caixa')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregarCaixa()
  }, [carregarCaixa])

  const handleAbrir = async () => {
    setOperando(true)
    try {
      const response = await fetch('/api/caixa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operacao: 'abrir',
          valor: parseFloat(valorAbertura) || 0,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error)
      }

      toast.success('Caixa aberto com sucesso!')
      setDialogAbrir(false)
      setValorAbertura('')
      carregarCaixa()
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setOperando(false)
    }
  }

  const handleFechar = async () => {
    setOperando(true)
    try {
      const response = await fetch('/api/caixa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operacao: 'fechar',
          valor: parseFloat(valorFechamento) || 0,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error)
      }

      const diferenca = data.resumo?.diferenca || 0
      if (diferenca === 0) {
        toast.success('Caixa fechado! Valores conferem.')
      } else if (diferenca > 0) {
        toast.warning(`Caixa fechado com sobra de ${formatCurrency(diferenca)}`)
      } else {
        toast.error(`Caixa fechado com falta de ${formatCurrency(Math.abs(diferenca))}`)
      }

      setDialogFechar(false)
      setValorFechamento('')
      carregarCaixa()
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setOperando(false)
    }
  }

  const handleSangria = async () => {
    setOperando(true)
    try {
      const response = await fetch('/api/caixa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operacao: 'sangria',
          valor: parseFloat(valorSangria) || 0,
          observacao,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error)
      }

      toast.success('Sangria registrada!')
      setDialogSangria(false)
      setValorSangria('')
      setObservacao('')
      carregarCaixa()
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setOperando(false)
    }
  }

  const handleSuprimento = async () => {
    setOperando(true)
    try {
      const response = await fetch('/api/caixa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operacao: 'suprimento',
          valor: parseFloat(valorSuprimento) || 0,
          observacao,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error)
      }

      toast.success('Suprimento registrado!')
      setDialogSuprimento(false)
      setValorSuprimento('')
      setObservacao('')
      carregarCaixa()
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setOperando(false)
    }
  }

  // Calcular saldo atual
  const saldoAtual = caixa
    ? (caixa.valor_abertura || 0) +
      resumo.total_dinheiro +
      resumo.total_suprimentos -
      resumo.total_sangrias
    : 0

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/pdv">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Controle de Caixa</h1>
              <p className="text-muted-foreground">Operador: {nomeUsuario}</p>
            </div>
          </div>
          <Button variant="outline" size="icon" onClick={carregarCaixa}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Status do Caixa */}
        {!caixa ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Lock className="h-16 w-16 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Caixa Fechado</h2>
              <p className="text-muted-foreground mb-6">
                Abra o caixa para iniciar as operações
              </p>
              <Button size="lg" onClick={() => setDialogAbrir(true)}>
                <LockOpen className="mr-2 h-5 w-5" />
                Abrir Caixa
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Caixa Aberto - Resumo */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="border-green-500 bg-green-50 dark:bg-green-900/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">
                    Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="bg-green-500">
                      <LockOpen className="mr-1 h-3 w-3" />
                      Aberto
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Desde {formatDateTime(caixa.data_abertura)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Banknote className="h-4 w-4" />
                    Saldo em Dinheiro
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{formatCurrency(saldoAtual)}</p>
                  <p className="text-xs text-muted-foreground">
                    Abertura: {formatCurrency(caixa.valor_abertura || 0)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    Vendas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{formatCurrency(resumo.total_vendas)}</p>
                  <p className="text-xs text-muted-foreground">
                    {resumo.quantidade_vendas} venda(s)
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Movimentações
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600">+ Suprimentos</span>
                      <span>{formatCurrency(resumo.total_suprimentos)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-red-600">- Sangrias</span>
                      <span>{formatCurrency(resumo.total_sangrias)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Vendas por Forma de Pagamento */}
            <Card>
              <CardHeader>
                <CardTitle>Vendas por Forma de Pagamento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                    <Banknote className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">Dinheiro</p>
                      <p className="text-lg font-semibold">{formatCurrency(resumo.total_dinheiro)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                    <CreditCard className="h-8 w-8 text-blue-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">Crédito</p>
                      <p className="text-lg font-semibold">{formatCurrency(resumo.total_cartao_credito)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                    <CreditCard className="h-8 w-8 text-purple-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">Débito</p>
                      <p className="text-lg font-semibold">{formatCurrency(resumo.total_cartao_debito)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                    <QrCode className="h-8 w-8 text-teal-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">PIX</p>
                      <p className="text-lg font-semibold">{formatCurrency(resumo.total_pix)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Ações */}
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => setDialogSangria(true)}>
                <ArrowUpCircle className="mr-2 h-4 w-4 text-red-500" />
                Sangria
              </Button>
              <Button variant="outline" onClick={() => setDialogSuprimento(true)}>
                <ArrowDownCircle className="mr-2 h-4 w-4 text-green-500" />
                Suprimento
              </Button>
              <Button variant="default" asChild>
                <Link href="/pdv">
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Ir para PDV
                </Link>
              </Button>
              <Button variant="destructive" onClick={() => setDialogFechar(true)}>
                <Lock className="mr-2 h-4 w-4" />
                Fechar Caixa
              </Button>
            </div>

            {/* Últimos Movimentos */}
            {movimentos.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Últimos Movimentos</CardTitle>
                  <CardDescription>Movimentações do caixa atual</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Hora</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movimentos.slice(0, 10).map((mov) => (
                        <TableRow key={mov.id}>
                          <TableCell className="text-sm">
                            {formatDateTime(mov.created_at)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                mov.tipo === 'entrada' || mov.tipo === 'suprimento'
                                  ? 'default'
                                  : 'destructive'
                              }
                            >
                              {mov.tipo === 'entrada' && 'Venda'}
                              {mov.tipo === 'saida' && 'Saída'}
                              {mov.tipo === 'sangria' && 'Sangria'}
                              {mov.tipo === 'suprimento' && 'Suprimento'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{mov.descricao || '-'}</TableCell>
                          <TableCell className="text-right font-medium">
                            <span
                              className={
                                mov.tipo === 'entrada' || mov.tipo === 'suprimento'
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              }
                            >
                              {mov.tipo === 'entrada' || mov.tipo === 'suprimento' ? '+' : '-'}
                              {formatCurrency(mov.valor)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Dialog Abrir Caixa */}
      <Dialog open={dialogAbrir} onOpenChange={setDialogAbrir}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abrir Caixa</DialogTitle>
            <DialogDescription>
              Informe o valor inicial em dinheiro no caixa
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="valor-abertura">Valor de Abertura (R$)</Label>
              <Input
                id="valor-abertura"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={valorAbertura}
                onChange={(e) => setValorAbertura(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAbrir(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAbrir} disabled={operando}>
              {operando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Abrir Caixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Fechar Caixa */}
      <Dialog open={dialogFechar} onOpenChange={setDialogFechar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fechar Caixa</DialogTitle>
            <DialogDescription>
              Conte o dinheiro e informe o valor total em caixa
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Saldo esperado em dinheiro:</p>
              <p className="text-2xl font-bold">{formatCurrency(saldoAtual)}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="valor-fechamento">Valor Contado (R$)</Label>
              <Input
                id="valor-fechamento"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={valorFechamento}
                onChange={(e) => setValorFechamento(e.target.value)}
              />
            </div>
            {valorFechamento && (
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Diferença:</p>
                <p
                  className={`text-xl font-bold ${
                    parseFloat(valorFechamento) - saldoAtual === 0
                      ? 'text-green-600'
                      : parseFloat(valorFechamento) - saldoAtual > 0
                      ? 'text-blue-600'
                      : 'text-red-600'
                  }`}
                >
                  {formatCurrency(parseFloat(valorFechamento) - saldoAtual)}
                  {parseFloat(valorFechamento) - saldoAtual === 0 && ' (Confere!)'}
                  {parseFloat(valorFechamento) - saldoAtual > 0 && ' (Sobra)'}
                  {parseFloat(valorFechamento) - saldoAtual < 0 && ' (Falta)'}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogFechar(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleFechar} disabled={operando}>
              {operando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Fechar Caixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Sangria */}
      <Dialog open={dialogSangria} onOpenChange={setDialogSangria}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Sangria</DialogTitle>
            <DialogDescription>
              Retirada de dinheiro do caixa
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="valor-sangria">Valor (R$)</Label>
              <Input
                id="valor-sangria"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={valorSangria}
                onChange={(e) => setValorSangria(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="obs-sangria">Observação</Label>
              <Textarea
                id="obs-sangria"
                placeholder="Motivo da sangria..."
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogSangria(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSangria} disabled={operando || !valorSangria}>
              {operando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar Sangria
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Suprimento */}
      <Dialog open={dialogSuprimento} onOpenChange={setDialogSuprimento}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Suprimento</DialogTitle>
            <DialogDescription>
              Entrada de dinheiro no caixa
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="valor-suprimento">Valor (R$)</Label>
              <Input
                id="valor-suprimento"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={valorSuprimento}
                onChange={(e) => setValorSuprimento(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="obs-suprimento">Observação</Label>
              <Textarea
                id="obs-suprimento"
                placeholder="Motivo do suprimento..."
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogSuprimento(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSuprimento} disabled={operando || !valorSuprimento}>
              {operando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar Suprimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
