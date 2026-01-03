'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  Gift,
  Search,
  Loader2,
  Users,
  Star,
  TrendingUp,
  Settings,
  ArrowUpCircle,
  ArrowDownCircle,
  Plus,
  Minus,
  Save,
  Award,
} from 'lucide-react'

interface FidelidadeConfig {
  id?: string
  empresa_id: string
  pontos_por_real: number
  valor_ponto_resgate: number
  validade_dias: number
  ativo: boolean
}

interface ClientePontos {
  id: string
  cliente_id: string
  saldo_pontos: number
  total_acumulado: number
  total_resgatado: number
  cliente: {
    id: string
    nome: string
    cpf_cnpj: string
    telefone?: string
  }
}

interface Movimento {
  id: string
  tipo: 'acumulo' | 'resgate' | 'expiracao' | 'ajuste'
  pontos: number
  saldo_anterior: number
  saldo_posterior: number
  valor_venda?: number
  descricao?: string
  created_at: string
  venda?: { numero: number }[] | null
}

export default function FidelidadePage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [empresaId, setEmpresaId] = useState<string | null>(null)

  // Configuração
  const [config, setConfig] = useState<FidelidadeConfig | null>(null)

  // Clientes
  const [clientes, setClientes] = useState<ClientePontos[]>([])
  const [search, setSearch] = useState('')
  const [clienteSelecionado, setClienteSelecionado] = useState<ClientePontos | null>(null)
  const [movimentos, setMovimentos] = useState<Movimento[]>([])
  const [loadingMovimentos, setLoadingMovimentos] = useState(false)

  // Modal de ajuste
  const [showAjuste, setShowAjuste] = useState(false)
  const [tipoAjuste, setTipoAjuste] = useState<'adicionar' | 'remover'>('adicionar')
  const [valorAjuste, setValorAjuste] = useState('')
  const [descricaoAjuste, setDescricaoAjuste] = useState('')
  const [processando, setProcessando] = useState(false)

  // Estatísticas
  const totalPontosAtivos = clientes.reduce((acc, c) => acc + c.saldo_pontos, 0)
  const totalClientes = clientes.length
  const valorEmPontos = config ? totalPontosAtivos * config.valor_ponto_resgate : 0

  useEffect(() => {
    carregarDados()
  }, [])

  async function carregarDados() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: usuario } = await supabase
        .from('usuarios')
        .select('empresa_id')
        .eq('auth_id', user.id)
        .single()

      if (!usuario) return
      setEmpresaId(usuario.empresa_id)

      // Buscar configuração
      const { data: configData } = await supabase
        .from('fidelidade_config')
        .select('*')
        .eq('empresa_id', usuario.empresa_id)
        .single()

      if (configData) {
        setConfig(configData)
      } else {
        // Criar config padrão
        setConfig({
          empresa_id: usuario.empresa_id,
          pontos_por_real: 1,
          valor_ponto_resgate: 0.10,
          validade_dias: 365,
          ativo: false,
        })
      }

      // Buscar clientes com pontos
      const { data: clientesData } = await supabase
        .from('fidelidade_pontos')
        .select(`
          id,
          cliente_id,
          saldo_pontos,
          total_acumulado,
          total_resgatado,
          cliente:clientes(id, nome, cpf_cnpj, telefone)
        `)
        .eq('empresa_id', usuario.empresa_id)
        .order('saldo_pontos', { ascending: false })

      if (clientesData) {
        setClientes(clientesData.map(c => ({
          ...c,
          cliente: Array.isArray(c.cliente) ? c.cliente[0] : c.cliente
        })))
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  async function salvarConfig() {
    if (!config || !empresaId) return

    setSaving(true)
    try {
      if (config.id) {
        const { error } = await supabase
          .from('fidelidade_config')
          .update({
            pontos_por_real: config.pontos_por_real,
            valor_ponto_resgate: config.valor_ponto_resgate,
            validade_dias: config.validade_dias,
            ativo: config.ativo,
            updated_at: new Date().toISOString(),
          })
          .eq('id', config.id)

        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('fidelidade_config')
          .insert({
            empresa_id: empresaId,
            pontos_por_real: config.pontos_por_real,
            valor_ponto_resgate: config.valor_ponto_resgate,
            validade_dias: config.validade_dias,
            ativo: config.ativo,
          })
          .select()
          .single()

        if (error) throw error
        setConfig(data)
      }

      toast.success('Configurações salvas!')
    } catch (error) {
      console.error('Erro ao salvar:', error)
      toast.error('Erro ao salvar configurações')
    } finally {
      setSaving(false)
    }
  }

  async function buscarMovimentos(clienteId: string) {
    setLoadingMovimentos(true)
    try {
      const { data, error } = await supabase
        .from('fidelidade_movimentos')
        .select(`
          id,
          tipo,
          pontos,
          saldo_anterior,
          saldo_posterior,
          valor_venda,
          descricao,
          created_at,
          venda:vendas(numero)
        `)
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setMovimentos(data || [])
    } catch (error) {
      console.error('Erro ao buscar movimentos:', error)
      toast.error('Erro ao carregar histórico')
    } finally {
      setLoadingMovimentos(false)
    }
  }

  function selecionarCliente(cliente: ClientePontos) {
    setClienteSelecionado(cliente)
    buscarMovimentos(cliente.cliente_id)
  }

  async function realizarAjuste() {
    if (!clienteSelecionado || !empresaId) return

    const pontos = parseFloat(valorAjuste)
    if (isNaN(pontos) || pontos <= 0) {
      toast.error('Informe um valor válido')
      return
    }

    if (tipoAjuste === 'remover' && pontos > clienteSelecionado.saldo_pontos) {
      toast.error('Valor maior que o saldo de pontos')
      return
    }

    setProcessando(true)
    try {
      const pontosAjuste = tipoAjuste === 'adicionar' ? pontos : -pontos

      const { error } = await supabase
        .from('fidelidade_movimentos')
        .insert({
          empresa_id: empresaId,
          cliente_id: clienteSelecionado.cliente_id,
          tipo: 'ajuste',
          pontos: pontosAjuste,
          saldo_anterior: clienteSelecionado.saldo_pontos,
          saldo_posterior: clienteSelecionado.saldo_pontos + pontosAjuste,
          descricao: descricaoAjuste || `Ajuste manual: ${tipoAjuste === 'adicionar' ? '+' : '-'}${pontos} pontos`,
        })

      if (error) throw error

      toast.success('Ajuste realizado com sucesso!')

      // Atualizar dados
      setShowAjuste(false)
      setValorAjuste('')
      setDescricaoAjuste('')

      // Recarregar
      carregarDados()
      if (clienteSelecionado) {
        buscarMovimentos(clienteSelecionado.cliente_id)
      }
    } catch (error) {
      console.error('Erro ao realizar ajuste:', error)
      toast.error('Erro ao realizar ajuste')
    } finally {
      setProcessando(false)
    }
  }

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
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date))
  }

  function formatPontos(pontos: number) {
    return new Intl.NumberFormat('pt-BR').format(pontos)
  }

  // Filtrar clientes
  const clientesFiltrados = clientes.filter(
    (c) =>
      c.cliente?.nome?.toLowerCase().includes(search.toLowerCase()) ||
      c.cliente?.cpf_cnpj?.includes(search)
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Gift className="h-8 w-8" />
            Programa de Fidelidade
          </h1>
          <p className="text-muted-foreground">
            Gerencie pontos e recompensas dos clientes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/fidelidade/produtos">
            <Button variant="outline">
              <Gift className="h-4 w-4 mr-2" />
              Produtos Resgatáveis
            </Button>
          </Link>
          <Badge variant={config?.ativo ? 'default' : 'secondary'} className="text-sm">
            {config?.ativo ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="pontos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pontos">
            <Star className="h-4 w-4 mr-2" />
            Pontos
          </TabsTrigger>
          <TabsTrigger value="config">
            <Settings className="h-4 w-4 mr-2" />
            Configurações
          </TabsTrigger>
        </TabsList>

        {/* Aba de Pontos */}
        <TabsContent value="pontos" className="space-y-4">
          {/* Cards de resumo */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Pontos em Circulação</CardTitle>
                <Star className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatPontos(totalPontosAtivos)}</div>
                <p className="text-xs text-muted-foreground">
                  Equivalente a {formatCurrency(valorEmPontos)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Clientes Fidelidade</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalClientes}</div>
                <p className="text-xs text-muted-foreground">
                  Com pontos acumulados
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {config ? `${config.pontos_por_real} pts/R$` : '-'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {config ? `1 ponto = ${formatCurrency(config.valor_ponto_resgate)}` : '-'}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Lista de clientes */}
            <Card>
              <CardHeader>
                <CardTitle>Clientes</CardTitle>
                <CardDescription>Clientes com pontos no programa</CardDescription>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou CPF/CNPJ..."
                    className="pl-10"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {clientesFiltrados.length > 0 ? (
                    <div className="space-y-2">
                      {clientesFiltrados.map((cp) => (
                        <button
                          key={cp.id}
                          className={`w-full p-3 rounded-lg border text-left transition-colors hover:bg-muted ${
                            clienteSelecionado?.id === cp.id ? 'bg-muted border-primary' : ''
                          }`}
                          onClick={() => selecionarCliente(cp)}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{cp.cliente?.nome}</p>
                              <p className="text-sm text-muted-foreground">{cp.cliente?.cpf_cnpj}</p>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-1 justify-end">
                                <Star className="h-4 w-4 text-yellow-500" />
                                <span className="font-bold text-lg">{formatPontos(cp.saldo_pontos)}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                = {formatCurrency(cp.saldo_pontos * (config?.valor_ponto_resgate || 0))}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Award className="h-12 w-12 mx-auto mb-2 opacity-20" />
                      <p>Nenhum cliente com pontos</p>
                      <p className="text-sm">Os pontos são acumulados automaticamente nas vendas</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Detalhes do cliente */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {clienteSelecionado ? clienteSelecionado.cliente?.nome : 'Selecione um cliente'}
                </CardTitle>
                {clienteSelecionado && (
                  <CardDescription>{clienteSelecionado.cliente?.cpf_cnpj}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {clienteSelecionado ? (
                  <div className="space-y-4">
                    {/* Resumo */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-3 rounded-lg bg-muted text-center">
                        <p className="text-xs text-muted-foreground">Saldo</p>
                        <p className="text-lg font-bold">{formatPontos(clienteSelecionado.saldo_pontos)}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted text-center">
                        <p className="text-xs text-muted-foreground">Acumulado</p>
                        <p className="text-lg font-bold text-green-600">{formatPontos(clienteSelecionado.total_acumulado)}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted text-center">
                        <p className="text-xs text-muted-foreground">Resgatado</p>
                        <p className="text-lg font-bold text-blue-600">{formatPontos(clienteSelecionado.total_resgatado)}</p>
                      </div>
                    </div>

                    {/* Botões de ação */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setTipoAjuste('adicionar')
                          setShowAjuste(true)
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setTipoAjuste('remover')
                          setShowAjuste(true)
                        }}
                        disabled={clienteSelecionado.saldo_pontos === 0}
                      >
                        <Minus className="h-4 w-4 mr-2" />
                        Remover
                      </Button>
                    </div>

                    {/* Histórico */}
                    <div>
                      <h3 className="font-medium mb-2">Histórico</h3>
                      {loadingMovimentos ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : movimentos.length > 0 ? (
                        <ScrollArea className="h-[200px]">
                          <div className="space-y-2">
                            {movimentos.map((mov) => (
                              <div
                                key={mov.id}
                                className="flex items-center justify-between p-2 rounded border text-sm"
                              >
                                <div className="flex items-center gap-2">
                                  {mov.tipo === 'acumulo' || (mov.tipo === 'ajuste' && mov.pontos > 0) ? (
                                    <ArrowUpCircle className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <ArrowDownCircle className="h-4 w-4 text-red-500" />
                                  )}
                                  <div>
                                    <p className="font-medium">
                                      {mov.tipo === 'acumulo' && 'Acúmulo'}
                                      {mov.tipo === 'resgate' && 'Resgate'}
                                      {mov.tipo === 'expiracao' && 'Expiração'}
                                      {mov.tipo === 'ajuste' && 'Ajuste'}
                                      {mov.venda && mov.venda[0] && ` - Venda #${mov.venda[0].numero}`}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatDate(mov.created_at)}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className={`font-medium ${mov.pontos > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {mov.pontos > 0 ? '+' : ''}{formatPontos(mov.pontos)} pts
                                  </p>
                                  {mov.valor_venda && (
                                    <p className="text-xs text-muted-foreground">
                                      {formatCurrency(mov.valor_venda)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nenhuma movimentação
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Star className="h-16 w-16 mx-auto mb-4 opacity-20" />
                    <p>Selecione um cliente para ver os detalhes</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Aba de Configurações */}
        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações do Programa</CardTitle>
              <CardDescription>
                Defina as regras de acúmulo e resgate de pontos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Ativar/Desativar */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label className="text-base">Programa Ativo</Label>
                  <p className="text-sm text-muted-foreground">
                    Quando ativo, os clientes acumulam pontos automaticamente
                  </p>
                </div>
                <Switch
                  checked={config?.ativo || false}
                  onCheckedChange={(checked) => setConfig(prev => prev ? { ...prev, ativo: checked } : null)}
                />
              </div>

              {/* Pontos por real */}
              <div className="space-y-2">
                <Label>Pontos por Real Gasto</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.1"
                    min="0.1"
                    className="w-32"
                    value={config?.pontos_por_real || ''}
                    onChange={(e) => setConfig(prev => prev ? { ...prev, pontos_por_real: parseFloat(e.target.value) || 0 } : null)}
                  />
                  <span className="text-muted-foreground">pontos a cada R$ 1,00 gasto</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Exemplo: Se configurado 1, uma compra de R$ 100 gera 100 pontos
                </p>
              </div>

              {/* Valor do ponto */}
              <div className="space-y-2">
                <Label>Valor do Ponto no Resgate</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">R$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="w-32"
                    value={config?.valor_ponto_resgate || ''}
                    onChange={(e) => setConfig(prev => prev ? { ...prev, valor_ponto_resgate: parseFloat(e.target.value) || 0 } : null)}
                  />
                  <span className="text-muted-foreground">por ponto</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Exemplo: Se configurado R$ 0,10, 100 pontos valem R$ 10,00 de desconto
                </p>
              </div>

              {/* Validade */}
              <div className="space-y-2">
                <Label>Validade dos Pontos</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    className="w-32"
                    value={config?.validade_dias || ''}
                    onChange={(e) => setConfig(prev => prev ? { ...prev, validade_dias: parseInt(e.target.value) || 0 } : null)}
                  />
                  <span className="text-muted-foreground">dias (0 = não expira)</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Pontos expiram após este período desde o acúmulo
                </p>
              </div>

              {/* Simulação */}
              {config && config.pontos_por_real > 0 && config.valor_ponto_resgate > 0 && (
                <div className="rounded-lg bg-muted p-4">
                  <h4 className="font-medium mb-2">Simulação</h4>
                  <div className="space-y-1 text-sm">
                    <p>
                      Compra de <strong>R$ 100,00</strong> → <strong>{formatPontos(100 * config.pontos_por_real)} pontos</strong>
                    </p>
                    <p>
                      {formatPontos(100 * config.pontos_por_real)} pontos → <strong>{formatCurrency(100 * config.pontos_por_real * config.valor_ponto_resgate)}</strong> de desconto
                    </p>
                    <p className="text-muted-foreground">
                      Retorno efetivo: {((config.pontos_por_real * config.valor_ponto_resgate) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              )}

              <Button onClick={salvarConfig} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Salvar Configurações
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de Ajuste */}
      <Dialog open={showAjuste} onOpenChange={setShowAjuste}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {tipoAjuste === 'adicionar' ? 'Adicionar Pontos' : 'Remover Pontos'}
            </DialogTitle>
            <DialogDescription>
              Cliente: {clienteSelecionado?.cliente?.nome}
              <br />
              Saldo atual: {clienteSelecionado && formatPontos(clienteSelecionado.saldo_pontos)} pontos
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Quantidade de Pontos</Label>
              <Input
                type="number"
                min="1"
                placeholder="0"
                value={valorAjuste}
                onChange={(e) => setValorAjuste(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Motivo (opcional)</Label>
              <Input
                placeholder="Descreva o motivo do ajuste..."
                value={descricaoAjuste}
                onChange={(e) => setDescricaoAjuste(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAjuste(false)}>
              Cancelar
            </Button>
            <Button onClick={realizarAjuste} disabled={processando}>
              {processando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                'Confirmar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
