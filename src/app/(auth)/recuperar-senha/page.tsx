'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, Mail } from 'lucide-react'

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const supabase = createClient()

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/atualizar-senha`,
      })

      if (error) {
        toast.error('Erro ao enviar email', {
          description: error.message,
        })
        return
      }

      setSent(true)
      toast.success('Email enviado!', {
        description: 'Verifique sua caixa de entrada',
      })
    } catch (error) {
      toast.error('Erro inesperado', {
        description: 'Tente novamente mais tarde',
      })
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <Card className="shadow-xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto bg-green-100 dark:bg-green-900/20 p-3 rounded-full w-fit">
            <Mail className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl font-bold">Verifique seu email</CardTitle>
          <CardDescription>
            Enviamos um link de recuperação para <strong>{email}</strong>
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col gap-4">
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao login
            </Link>
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="shadow-xl">
      <CardHeader className="text-center space-y-2">
        <CardTitle className="text-2xl font-bold">Recuperar Senha</CardTitle>
        <CardDescription>
          Digite seu email para receber um link de recuperação
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleResetPassword}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              'Enviar link de recuperação'
            )}
          </Button>
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao login
          </Link>
        </CardFooter>
      </form>
    </Card>
  )
}
