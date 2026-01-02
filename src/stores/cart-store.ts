import { create } from 'zustand'

export interface CartItem {
  id: string
  codigo: string
  nome: string
  preco: number
  quantidade: number
}

interface CartStore {
  items: CartItem[]
  desconto: number
  addItem: (item: Omit<CartItem, 'quantidade'>) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantidade: number) => void
  setDesconto: (desconto: number) => void
  clearCart: () => void
  getSubtotal: () => number
  getTotal: () => number
  getTotalItems: () => number
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  desconto: 0,

  addItem: (item) => {
    set((state) => {
      const existing = state.items.find((i) => i.id === item.id)
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.id === item.id ? { ...i, quantidade: i.quantidade + 1 } : i
          ),
        }
      }
      return {
        items: [...state.items, { ...item, quantidade: 1 }],
      }
    })
  },

  removeItem: (id) => {
    set((state) => ({
      items: state.items.filter((i) => i.id !== id),
    }))
  },

  updateQuantity: (id, quantidade) => {
    if (quantidade <= 0) {
      get().removeItem(id)
      return
    }
    set((state) => ({
      items: state.items.map((i) =>
        i.id === id ? { ...i, quantidade } : i
      ),
    }))
  },

  setDesconto: (desconto) => {
    set({ desconto })
  },

  clearCart: () => {
    set({ items: [], desconto: 0 })
  },

  getSubtotal: () => {
    return get().items.reduce((acc, item) => acc + item.preco * item.quantidade, 0)
  },

  getTotal: () => {
    return get().getSubtotal() - get().desconto
  },

  getTotalItems: () => {
    return get().items.reduce((acc, item) => acc + item.quantidade, 0)
  },
}))
