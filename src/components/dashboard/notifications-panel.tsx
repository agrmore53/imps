'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import {
  Bell,
  Package,
  AlertTriangle,
  Clock,
  Receipt,
  Check,
  CheckCheck,
  Loader2,
  ArrowRight,
  X,
} from 'lucide-react'

interface Notificacao {
  id: string
  tipo: 'estoque_baixo' | 'conta_pagar_vencida' | 'conta_pagar_vencendo' | 'conta_receber_vencida'
  titulo: string
  mensagem: string
  referencia_id?: string
  referencia_tipo?: string
  lida: boolean
  created_at: string
}

const tipoConfig = {
  estoque_baixo: {
    icon: Package,
    color: 'text-orange-500',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    borderColor: 'border-orange-200',
    link: '/dashboard/estoque',
  },
  conta_pagar_vencida: {
    icon: AlertTriangle,
    color: 'text-red-500',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200',
    link: '/dashboard/financeiro/contas-pagar',
  },
  conta_pagar_vencendo: {
    icon: Clock,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    borderColor: 'border-yellow-200',
    link: '/dashboard/financeiro/contas-pagar',
  },
  conta_receber_vencida: {
    icon: Receipt,
    color: 'text-red-500',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200',
    link: '/dashboard/financeiro/contas-receber',
  },
}

export function NotificationsPanel() {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState<string | null>(null)

  useEffect(() => {
    fetchNotificacoes()
  }, [])

  async function fetchNotificacoes() {
    try {
      const response = await fetch('/api/notificacoes')
      if (response.ok) {
        const data = await response.json()
        setNotificacoes(data)
      }
    } catch (error) {
      console.error('Erro ao buscar notificações:', error)
    } finally {
      setLoading(false)
    }
  }

  async function marcarComoLida(id: string) {
    setMarking(id)
    try {
      const response = await fetch(`/api/notificacoes/${id}`, {
        method: 'PATCH',
      })

      if (response.ok) {
        setNotificacoes((prev) => prev.filter((n) => n.id !== id))
        toast.success('Notificação marcada como lida')
      }
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao marcar notificação')
    } finally {
      setMarking(null)
    }
  }

  async function marcarTodasComoLidas() {
    setMarking('all')
    try {
      const response = await fetch('/api/notificacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' }),
      })

      if (response.ok) {
        setNotificacoes([])
        toast.success('Todas as notificações marcadas como lidas')
      }
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao marcar notificações')
    } finally {
      setMarking(null)
    }
  }

  // Agrupar por tipo
  const grupos = {
    urgente: notificacoes.filter((n) =>
      n.tipo === 'conta_pagar_vencida' || n.tipo === 'conta_receber_vencida'
    ),
    atencao: notificacoes.filter((n) =>
      n.tipo === 'conta_pagar_vencendo' || n.tipo === 'estoque_baixo'
    ),
  }

  const totalNotificacoes = notificacoes.length
  const totalUrgente = grupos.urgente.length

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (totalNotificacoes === 0) {
    return (
      <Card className="border-green-200 bg-green-50/50 dark:bg-green-900/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-500">
            <Check className="h-5 w-5" />
            Tudo em dia!
          </CardTitle>
          <CardDescription>
            Não há alertas pendentes no momento
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className={totalUrgente > 0 ? 'border-red-300' : 'border-yellow-300'}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className={`h-5 w-5 ${totalUrgente > 0 ? 'text-red-500' : 'text-yellow-500'}`} />
            <CardTitle>Notificações</CardTitle>
            <Badge variant={totalUrgente > 0 ? 'destructive' : 'secondary'}>
              {totalNotificacoes}
            </Badge>
          </div>
          {totalNotificacoes > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={marcarTodasComoLidas}
              disabled={marking === 'all'}
            >
              {marking === 'all' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCheck className="h-4 w-4 mr-2" />
              )}
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <CardDescription>
          {totalUrgente > 0
            ? `${totalUrgente} alerta(s) urgente(s) requer(em) atenção`
            : 'Itens que precisam de sua atenção'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-3">
            {/* Alertas urgentes primeiro */}
            {grupos.urgente.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-red-600 uppercase tracking-wide">
                  Urgente
                </p>
                {grupos.urgente.map((notif) => (
                  <NotificacaoItem
                    key={notif.id}
                    notificacao={notif}
                    onMarcarLida={marcarComoLida}
                    marking={marking}
                  />
                ))}
              </div>
            )}

            {/* Alertas de atenção */}
            {grupos.atencao.length > 0 && (
              <div className="space-y-2">
                {grupos.urgente.length > 0 && (
                  <p className="text-xs font-medium text-yellow-600 uppercase tracking-wide mt-4">
                    Atenção
                  </p>
                )}
                {grupos.atencao.map((notif) => (
                  <NotificacaoItem
                    key={notif.id}
                    notificacao={notif}
                    onMarcarLida={marcarComoLida}
                    marking={marking}
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

function NotificacaoItem({
  notificacao,
  onMarcarLida,
  marking,
}: {
  notificacao: Notificacao
  onMarcarLida: (id: string) => void
  marking: string | null
}) {
  const config = tipoConfig[notificacao.tipo]
  const Icon = config.icon

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border ${config.bgColor} ${config.borderColor}`}
    >
      <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${config.color}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{notificacao.titulo}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{notificacao.mensagem}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
          <Link href={config.link}>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => onMarcarLida(notificacao.id)}
          disabled={marking === notificacao.id}
        >
          {marking === notificacao.id ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <X className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}
