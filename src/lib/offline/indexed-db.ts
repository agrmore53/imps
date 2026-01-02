import { openDB, DBSchema, IDBPDatabase } from 'idb'

interface VendaOffline {
  id: string
  tempId: string
  itens: Array<{
    produto_id: string
    codigo: string
    nome: string
    quantidade: number
    preco_unitario: number
    desconto: number
    total: number
  }>
  pagamentos: Array<{
    forma: string
    valor: number
    bandeira?: string
    nsu?: string
  }>
  subtotal: number
  desconto: number
  total: number
  cliente_id?: string
  usuario_id: string
  data_hora: string
  sincronizado: boolean
  tentativas: number
}

interface ProdutoCache {
  id: string
  codigo: string
  codigo_barras: string | null
  nome: string
  preco_venda: number
  estoque_atual: number
  unidade: string
  ncm: string | null
  updated_at: string
}

interface ImperioDBSchema extends DBSchema {
  'vendas-offline': {
    key: string
    value: VendaOffline
    indexes: { 'by-sincronizado': number }
  }
  'produtos-cache': {
    key: string
    value: ProdutoCache
    indexes: { 'by-codigo': string; 'by-codigo-barras': string }
  }
  'config': {
    key: string
    value: any
  }
}

const DB_NAME = 'imperio-db'
const DB_VERSION = 1

let dbInstance: IDBPDatabase<ImperioDBSchema> | null = null

export async function getDB(): Promise<IDBPDatabase<ImperioDBSchema>> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB<ImperioDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Vendas offline
      if (!db.objectStoreNames.contains('vendas-offline')) {
        const vendasStore = db.createObjectStore('vendas-offline', {
          keyPath: 'tempId',
        })
        vendasStore.createIndex('by-sincronizado', 'sincronizado')
      }

      // Cache de produtos
      if (!db.objectStoreNames.contains('produtos-cache')) {
        const produtosStore = db.createObjectStore('produtos-cache', {
          keyPath: 'id',
        })
        produtosStore.createIndex('by-codigo', 'codigo')
        produtosStore.createIndex('by-codigo-barras', 'codigo_barras')
      }

      // Configuracoes
      if (!db.objectStoreNames.contains('config')) {
        db.createObjectStore('config', { keyPath: 'key' })
      }
    },
  })

  return dbInstance
}

// Vendas Offline
export async function salvarVendaOffline(venda: Omit<VendaOffline, 'sincronizado' | 'tentativas'>) {
  const db = await getDB()
  const vendaCompleta: VendaOffline = {
    ...venda,
    sincronizado: false,
    tentativas: 0,
  }
  await db.put('vendas-offline', vendaCompleta)
  return vendaCompleta
}

export async function getVendasNaoSincronizadas(): Promise<VendaOffline[]> {
  const db = await getDB()
  return db.getAllFromIndex('vendas-offline', 'by-sincronizado', 0)
}

export async function marcarVendaSincronizada(tempId: string, serverId: string) {
  const db = await getDB()
  const venda = await db.get('vendas-offline', tempId)
  if (venda) {
    venda.id = serverId
    venda.sincronizado = true
    await db.put('vendas-offline', venda)
  }
}

export async function incrementarTentativaVenda(tempId: string) {
  const db = await getDB()
  const venda = await db.get('vendas-offline', tempId)
  if (venda) {
    venda.tentativas++
    await db.put('vendas-offline', venda)
  }
}

export async function removerVendaOffline(tempId: string) {
  const db = await getDB()
  await db.delete('vendas-offline', tempId)
}

export async function contarVendasPendentes(): Promise<number> {
  const db = await getDB()
  const vendas = await db.getAllFromIndex('vendas-offline', 'by-sincronizado', 0)
  return vendas.length
}

// Cache de Produtos
export async function cacheProdutos(produtos: ProdutoCache[]) {
  const db = await getDB()
  const tx = db.transaction('produtos-cache', 'readwrite')
  await Promise.all([
    ...produtos.map(p => tx.store.put(p)),
    tx.done,
  ])
}

export async function getProdutosCacheados(): Promise<ProdutoCache[]> {
  const db = await getDB()
  return db.getAll('produtos-cache')
}

export async function buscarProdutoCachePorCodigo(codigo: string): Promise<ProdutoCache | undefined> {
  const db = await getDB()
  return db.getFromIndex('produtos-cache', 'by-codigo', codigo)
}

export async function buscarProdutoCachePorCodigoBarras(codigoBarras: string): Promise<ProdutoCache | undefined> {
  const db = await getDB()
  return db.getFromIndex('produtos-cache', 'by-codigo-barras', codigoBarras)
}

export async function limparCacheProdutos() {
  const db = await getDB()
  await db.clear('produtos-cache')
}

// Config
export async function setConfig(key: string, value: any) {
  const db = await getDB()
  await db.put('config', { key, value })
}

export async function getConfig<T>(key: string): Promise<T | undefined> {
  const db = await getDB()
  const result = await db.get('config', key)
  return result?.value as T | undefined
}

// Utils
export async function limparTudo() {
  const db = await getDB()
  await db.clear('vendas-offline')
  await db.clear('produtos-cache')
  await db.clear('config')
}
