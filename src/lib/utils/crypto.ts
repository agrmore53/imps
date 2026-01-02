/**
 * Utilitário de criptografia para dados sensíveis
 * Usa AES-256-GCM para criptografar dados como senha do certificado
 */

import crypto from 'crypto'

// A chave deve vir de uma variável de ambiente
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'imperio-sistemas-default-key-32b'

// Garante que a chave tenha 32 bytes
function getKey(): Buffer {
  const key = ENCRYPTION_KEY
  if (key.length < 32) {
    return Buffer.from(key.padEnd(32, '0'))
  }
  return Buffer.from(key.slice(0, 32))
}

/**
 * Criptografa uma string usando AES-256-GCM
 * @param text - Texto a ser criptografado
 * @returns String criptografada em formato base64 (iv:authTag:encrypted)
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16)
  const key = getKey()

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)

  let encrypted = cipher.update(text, 'utf8', 'base64')
  encrypted += cipher.final('base64')

  const authTag = cipher.getAuthTag()

  // Retorna: iv:authTag:encrypted (tudo em base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`
}

/**
 * Descriptografa uma string criptografada com encrypt()
 * @param encryptedText - Texto criptografado no formato iv:authTag:encrypted
 * @returns Texto original
 */
export function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':')

  if (parts.length !== 3) {
    throw new Error('Formato de texto criptografado inválido')
  }

  const iv = Buffer.from(parts[0], 'base64')
  const authTag = Buffer.from(parts[1], 'base64')
  const encrypted = parts[2]
  const key = getKey()

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, 'base64', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Verifica se um texto está criptografado (no formato esperado)
 */
export function isEncrypted(text: string): boolean {
  if (!text) return false
  const parts = text.split(':')
  return parts.length === 3 && parts.every(p => p.length > 0)
}

/**
 * Gera um hash SHA-256 de uma string
 */
export function hash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex')
}

/**
 * Gera uma string aleatória segura
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex')
}
