import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export type TipoErro = 'erro_api' | 'erro_banco' | 'erro_autenticacao' | 'erro_validacao'

interface LogErroParams {
  tipo: TipoErro
  mensagem: string
  erro?: Error | any
  request?: NextRequest
  endpoint?: string
  metodo?: string
  responseStatus?: number
  requestBody?: any
  empresaId?: string
  usuarioId?: string
}

/**
 * Remove campos sensíveis do corpo da requisição antes de logar
 */
function sanitizeRequestBody(body: any): any {
  if (!body) return null

  const sensitiveFields = [
    'senha', 'password', 'senhaAtual', 'novaSenha', 'senhaMestre',
    'confirmarSenha', 'token', 'secret', 'apiKey', 'api_key',
    'certificado', 'certificado_base64', 'private_key'
  ]

  const sanitized = { ...body }

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]'
    }
  }

  return sanitized
}

/**
 * Extrai informações da requisição
 */
function extractRequestInfo(request?: NextRequest) {
  if (!request) {
    return {
      ipAddress: null,
      userAgent: null,
      endpoint: null,
      metodo: null,
    }
  }

  return {
    ipAddress: request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
    endpoint: request.nextUrl?.pathname || null,
    metodo: request.method || null,
  }
}

/**
 * Registra um erro no banco de dados
 */
export async function logErro(params: LogErroParams): Promise<void> {
  try {
    const supabase = await createClient()

    const requestInfo = extractRequestInfo(params.request)

    // Preparar stack trace
    let stackTrace: string | null = null
    if (params.erro) {
      if (params.erro instanceof Error) {
        stackTrace = params.erro.stack || null
      } else if (typeof params.erro === 'object') {
        stackTrace = JSON.stringify(params.erro, null, 2)
      } else {
        stackTrace = String(params.erro)
      }
    }

    // Sanitizar corpo da requisição
    const requestBody = params.requestBody
      ? sanitizeRequestBody(params.requestBody)
      : null

    await supabase
      .from('logs_erros')
      .insert({
        empresa_id: params.empresaId || null,
        usuario_id: params.usuarioId || null,
        tipo: params.tipo,
        endpoint: params.endpoint || requestInfo.endpoint,
        metodo: params.metodo || requestInfo.metodo,
        mensagem: params.mensagem,
        stack_trace: stackTrace,
        request_body: requestBody,
        response_status: params.responseStatus || null,
        ip_address: requestInfo.ipAddress,
        user_agent: requestInfo.userAgent,
      })

    // Também loga no console para debugging local
    console.error(`[${params.tipo.toUpperCase()}] ${params.mensagem}`, {
      endpoint: params.endpoint || requestInfo.endpoint,
      erro: params.erro,
    })

  } catch (logError) {
    // Se falhar ao logar, pelo menos mostra no console
    console.error('Falha ao registrar log de erro:', logError)
    console.error('Erro original:', params.mensagem, params.erro)
  }
}

/**
 * Helper para logar erro de API
 */
export async function logErroAPI(
  mensagem: string,
  erro: any,
  request: NextRequest,
  responseStatus: number,
  extras?: {
    requestBody?: any
    empresaId?: string
    usuarioId?: string
  }
): Promise<void> {
  await logErro({
    tipo: 'erro_api',
    mensagem,
    erro,
    request,
    responseStatus,
    ...extras,
  })
}

/**
 * Helper para logar erro de banco
 */
export async function logErroBanco(
  mensagem: string,
  erro: any,
  request?: NextRequest,
  extras?: {
    empresaId?: string
    usuarioId?: string
  }
): Promise<void> {
  await logErro({
    tipo: 'erro_banco',
    mensagem,
    erro,
    request,
    responseStatus: 500,
    ...extras,
  })
}

/**
 * Helper para logar erro de autenticação
 */
export async function logErroAutenticacao(
  mensagem: string,
  erro: any,
  request: NextRequest
): Promise<void> {
  await logErro({
    tipo: 'erro_autenticacao',
    mensagem,
    erro,
    request,
    responseStatus: 401,
  })
}

/**
 * Helper para logar erro de validação
 */
export async function logErroValidacao(
  mensagem: string,
  detalhes: any,
  request: NextRequest,
  extras?: {
    requestBody?: any
    empresaId?: string
    usuarioId?: string
  }
): Promise<void> {
  await logErro({
    tipo: 'erro_validacao',
    mensagem,
    erro: detalhes,
    request,
    responseStatus: 400,
    ...extras,
  })
}
