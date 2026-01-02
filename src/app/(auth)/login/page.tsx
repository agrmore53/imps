'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, Building2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        toast.error('Erro ao fazer login', {
          description: error.message === 'Invalid login credentials'
            ? 'Email ou senha incorretos'
            : error.message,
        })
        return
      }

      toast.success('Login realizado com sucesso!')
      router.push('/dashboard')
      router.refresh()
    } catch (error) {
      toast.error('Erro inesperado', {
        description: 'Tente novamente mais tarde',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="shadow-xl">
      <CardHeader className="text-center space-y-2">
        <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
          <Building2 className="h-8 w-8 text-primary" />
        </div>
        <CardTitle className="text-2xl font-bold">Império Sistemas</CardTitle>
        <CardDescription>
          Entre com suas credenciais para acessar o sistema
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleLogin}>
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
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
                Entrando...
              </>
            ) : (
              'Entrar'
            )}
          </Button>
          <Link
            href="/recuperar-senha"
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            Esqueceu sua senha?
          </Link>
        </CardFooter>
      </form>
    </Card>
  )
}
