'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Loader2, Check, X } from 'lucide-react'

interface NCM {
  ncm: string
  descricao: string
}

interface NCMSearchProps {
  value: string
  onChange: (ncm: string) => void
  disabled?: boolean
}

export function NCMSearch({ value, onChange, disabled }: NCMSearchProps) {
  const [busca, setBusca] = useState(value || '')
  const [resultados, setResultados] = useState<NCM[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [ncmSelecionado, setNcmSelecionado] = useState<NCM | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setBusca(value || '')
    if (value) {
      validarNCM(value)
    }
  }, [value])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function validarNCM(ncm: string) {
    if (!ncm || ncm.length < 8) {
      setNcmSelecionado(null)
      return
    }

    try {
      const response = await fetch('/api/ncm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ncm }),
      })
      const data = await response.json()

      if (data.valido) {
        setNcmSelecionado({ ncm: data.ncm, descricao: data.descricao })
      } else {
        setNcmSelecionado(null)
      }
    } catch (error) {
      setNcmSelecionado(null)
    }
  }

  async function buscarNCM(termo: string) {
    if (termo.length < 2) {
      setResultados([])
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/ncm?q=${encodeURIComponent(termo)}`)
      const data = await response.json()
      setResultados(data)
      setShowDropdown(true)
    } catch (error) {
      console.error('Erro ao buscar NCM:', error)
      setResultados([])
    } finally {
      setLoading(false)
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const valor = e.target.value
    setBusca(valor)
    setNcmSelecionado(null)

    // Se digitou apenas números/pontos, pode ser um código NCM
    if (/^[\d.]+$/.test(valor)) {
      onChange(valor.replace(/\./g, '').slice(0, 8))
      if (valor.replace(/\./g, '').length >= 8) {
        validarNCM(valor)
      }
    }

    // Buscar por descrição se tiver 2+ caracteres
    if (valor.length >= 2) {
      buscarNCM(valor)
    } else {
      setResultados([])
      setShowDropdown(false)
    }
  }

  function handleSelectNCM(ncm: NCM) {
    setBusca(ncm.ncm)
    setNcmSelecionado(ncm)
    onChange(ncm.ncm)
    setShowDropdown(false)
    setResultados([])
  }

  function handleClear() {
    setBusca('')
    setNcmSelecionado(null)
    onChange('')
    inputRef.current?.focus()
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative">
        <Input
          ref={inputRef}
          placeholder="Digite NCM ou descrição..."
          value={busca}
          onChange={handleInputChange}
          onFocus={() => resultados.length > 0 && setShowDropdown(true)}
          disabled={disabled}
          className={ncmSelecionado ? 'pr-20' : 'pr-10'}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {ncmSelecionado && (
            <Check className="h-4 w-4 text-green-500" />
          )}
          {busca && !disabled && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleClear}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {ncmSelecionado && (
        <p className="text-xs text-muted-foreground mt-1 truncate">
          {ncmSelecionado.descricao}
        </p>
      )}

      {showDropdown && resultados.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {resultados.map((ncm) => (
            <button
              key={ncm.ncm}
              type="button"
              className="w-full px-3 py-2 text-left hover:bg-accent text-sm border-b last:border-b-0"
              onClick={() => handleSelectNCM(ncm)}
            >
              <span className="font-mono font-medium">{ncm.ncm}</span>
              <span className="text-muted-foreground ml-2 text-xs">
                {ncm.descricao}
              </span>
            </button>
          ))}
        </div>
      )}

      {showDropdown && busca.length >= 2 && resultados.length === 0 && !loading && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg p-3 text-sm text-muted-foreground">
          Nenhum NCM encontrado para "{busca}"
        </div>
      )}
    </div>
  )
}
