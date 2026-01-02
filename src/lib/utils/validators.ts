/**
 * Valida CPF
 */
export function validarCPF(cpf: string): boolean {
  cpf = cpf.replace(/\D/g, '')

  if (cpf.length !== 11) return false
  if (/^(\d)\1+$/.test(cpf)) return false

  let soma = 0
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpf.charAt(i)) * (10 - i)
  }
  let resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(cpf.charAt(9))) return false

  soma = 0
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpf.charAt(i)) * (11 - i)
  }
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(cpf.charAt(10))) return false

  return true
}

/**
 * Valida CNPJ
 */
export function validarCNPJ(cnpj: string): boolean {
  cnpj = cnpj.replace(/\D/g, '')

  if (cnpj.length !== 14) return false
  if (/^(\d)\1+$/.test(cnpj)) return false

  let tamanho = cnpj.length - 2
  let numeros = cnpj.substring(0, tamanho)
  const digitos = cnpj.substring(tamanho)
  let soma = 0
  let pos = tamanho - 7

  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--
    if (pos < 2) pos = 9
  }

  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11)
  if (resultado !== parseInt(digitos.charAt(0))) return false

  tamanho = tamanho + 1
  numeros = cnpj.substring(0, tamanho)
  soma = 0
  pos = tamanho - 7

  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--
    if (pos < 2) pos = 9
  }

  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11)
  if (resultado !== parseInt(digitos.charAt(1))) return false

  return true
}

/**
 * Valida CPF ou CNPJ
 */
export function validarCPFCNPJ(valor: string): boolean {
  const limpo = valor.replace(/\D/g, '')
  if (limpo.length === 11) return validarCPF(limpo)
  if (limpo.length === 14) return validarCNPJ(limpo)
  return false
}

/**
 * Formata CPF
 */
export function formatarCPF(cpf: string): string {
  const limpo = cpf.replace(/\D/g, '')
  return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

/**
 * Formata CNPJ
 */
export function formatarCNPJ(cnpj: string): string {
  const limpo = cnpj.replace(/\D/g, '')
  return limpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
}

/**
 * Formata CPF ou CNPJ automaticamente
 */
export function formatarCPFCNPJ(valor: string): string {
  const limpo = valor.replace(/\D/g, '')
  if (limpo.length <= 11) {
    return limpo
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  return limpo
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

/**
 * Formata telefone
 */
export function formatarTelefone(telefone: string): string {
  const limpo = telefone.replace(/\D/g, '')
  if (limpo.length === 11) {
    return limpo.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  }
  if (limpo.length === 10) {
    return limpo.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  }
  return telefone
}

/**
 * Formata CEP
 */
export function formatarCEP(cep: string): string {
  const limpo = cep.replace(/\D/g, '')
  return limpo.replace(/(\d{5})(\d{3})/, '$1-$2')
}
