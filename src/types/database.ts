export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      empresas: {
        Row: {
          id: string
          razao_social: string
          nome_fantasia: string
          cnpj: string
          ie: string | null
          endereco: Json | null
          telefone: string | null
          email: string | null
          logo_url: string | null
          certificado_digital: string | null
          config_fiscal: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          razao_social: string
          nome_fantasia: string
          cnpj: string
          ie?: string | null
          endereco?: Json | null
          telefone?: string | null
          email?: string | null
          logo_url?: string | null
          certificado_digital?: string | null
          config_fiscal?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          razao_social?: string
          nome_fantasia?: string
          cnpj?: string
          ie?: string | null
          endereco?: Json | null
          telefone?: string | null
          email?: string | null
          logo_url?: string | null
          certificado_digital?: string | null
          config_fiscal?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      usuarios: {
        Row: {
          id: string
          auth_id: string
          empresa_id: string
          nome: string
          email: string
          perfil: 'admin' | 'gerente' | 'caixa' | 'estoque'
          ativo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          auth_id: string
          empresa_id: string
          nome: string
          email: string
          perfil?: 'admin' | 'gerente' | 'caixa' | 'estoque'
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          auth_id?: string
          empresa_id?: string
          nome?: string
          email?: string
          perfil?: 'admin' | 'gerente' | 'caixa' | 'estoque'
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      produtos: {
        Row: {
          id: string
          empresa_id: string
          codigo: string
          codigo_barras: string | null
          nome: string
          descricao: string | null
          ncm: string | null
          cest: string | null
          cfop: string | null
          unidade: string
          preco_custo: number
          preco_venda: number
          margem: number | null
          estoque_atual: number
          estoque_minimo: number
          icms_cst: string | null
          icms_aliquota: number | null
          pis_cst: string | null
          cofins_cst: string | null
          ativo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          empresa_id: string
          codigo: string
          codigo_barras?: string | null
          nome: string
          descricao?: string | null
          ncm?: string | null
          cest?: string | null
          cfop?: string | null
          unidade?: string
          preco_custo?: number
          preco_venda: number
          margem?: number | null
          estoque_atual?: number
          estoque_minimo?: number
          icms_cst?: string | null
          icms_aliquota?: number | null
          pis_cst?: string | null
          cofins_cst?: string | null
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          empresa_id?: string
          codigo?: string
          codigo_barras?: string | null
          nome?: string
          descricao?: string | null
          ncm?: string | null
          cest?: string | null
          cfop?: string | null
          unidade?: string
          preco_custo?: number
          preco_venda?: number
          margem?: number | null
          estoque_atual?: number
          estoque_minimo?: number
          icms_cst?: string | null
          icms_aliquota?: number | null
          pis_cst?: string | null
          cofins_cst?: string | null
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      clientes: {
        Row: {
          id: string
          empresa_id: string
          tipo_pessoa: 'PF' | 'PJ'
          cpf_cnpj: string
          nome: string
          email: string | null
          telefone: string | null
          endereco: Json | null
          limite_credito: number
          saldo_devedor: number
          ativo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          empresa_id: string
          tipo_pessoa?: 'PF' | 'PJ'
          cpf_cnpj: string
          nome: string
          email?: string | null
          telefone?: string | null
          endereco?: Json | null
          limite_credito?: number
          saldo_devedor?: number
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          empresa_id?: string
          tipo_pessoa?: 'PF' | 'PJ'
          cpf_cnpj?: string
          nome?: string
          email?: string | null
          telefone?: string | null
          endereco?: Json | null
          limite_credito?: number
          saldo_devedor?: number
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      fornecedores: {
        Row: {
          id: string
          empresa_id: string
          cpf_cnpj: string
          razao_social: string
          nome_fantasia: string | null
          contato: string | null
          telefone: string | null
          email: string | null
          endereco: Json | null
          ativo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          empresa_id: string
          cpf_cnpj: string
          razao_social: string
          nome_fantasia?: string | null
          contato?: string | null
          telefone?: string | null
          email?: string | null
          endereco?: Json | null
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          empresa_id?: string
          cpf_cnpj?: string
          razao_social?: string
          nome_fantasia?: string | null
          contato?: string | null
          telefone?: string | null
          email?: string | null
          endereco?: Json | null
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      vendas: {
        Row: {
          id: string
          empresa_id: string
          numero: number
          data_hora: string
          cliente_id: string | null
          usuario_id: string
          subtotal: number
          desconto: number
          total: number
          status: 'pendente' | 'finalizada' | 'cancelada'
          tipo_documento: 'nfce' | 'nfe' | 'sem_nota'
          chave_nfce: string | null
          observacao: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          empresa_id: string
          numero?: number
          data_hora?: string
          cliente_id?: string | null
          usuario_id: string
          subtotal?: number
          desconto?: number
          total?: number
          status?: 'pendente' | 'finalizada' | 'cancelada'
          tipo_documento?: 'nfce' | 'nfe' | 'sem_nota'
          chave_nfce?: string | null
          observacao?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          empresa_id?: string
          numero?: number
          data_hora?: string
          cliente_id?: string | null
          usuario_id?: string
          subtotal?: number
          desconto?: number
          total?: number
          status?: 'pendente' | 'finalizada' | 'cancelada'
          tipo_documento?: 'nfce' | 'nfe' | 'sem_nota'
          chave_nfce?: string | null
          observacao?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      venda_itens: {
        Row: {
          id: string
          venda_id: string
          produto_id: string
          quantidade: number
          preco_unitario: number
          desconto: number
          total: number
          created_at: string
        }
        Insert: {
          id?: string
          venda_id: string
          produto_id: string
          quantidade: number
          preco_unitario: number
          desconto?: number
          total?: number
          created_at?: string
        }
        Update: {
          id?: string
          venda_id?: string
          produto_id?: string
          quantidade?: number
          preco_unitario?: number
          desconto?: number
          total?: number
          created_at?: string
        }
      }
      venda_pagamentos: {
        Row: {
          id: string
          venda_id: string
          forma_pagamento: 'dinheiro' | 'cartao_credito' | 'cartao_debito' | 'pix' | 'crediario'
          valor: number
          bandeira: string | null
          nsu: string | null
          autorizacao: string | null
          created_at: string
        }
        Insert: {
          id?: string
          venda_id: string
          forma_pagamento: 'dinheiro' | 'cartao_credito' | 'cartao_debito' | 'pix' | 'crediario'
          valor: number
          bandeira?: string | null
          nsu?: string | null
          autorizacao?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          venda_id?: string
          forma_pagamento?: 'dinheiro' | 'cartao_credito' | 'cartao_debito' | 'pix' | 'crediario'
          valor?: number
          bandeira?: string | null
          nsu?: string | null
          autorizacao?: string | null
          created_at?: string
        }
      }
      estoque_movimentos: {
        Row: {
          id: string
          empresa_id: string
          produto_id: string
          tipo: 'entrada' | 'saida' | 'ajuste'
          quantidade: number
          custo_unitario: number | null
          documento_origem: string | null
          observacao: string | null
          usuario_id: string
          data_hora: string
          created_at: string
        }
        Insert: {
          id?: string
          empresa_id: string
          produto_id: string
          tipo: 'entrada' | 'saida' | 'ajuste'
          quantidade: number
          custo_unitario?: number | null
          documento_origem?: string | null
          observacao?: string | null
          usuario_id: string
          data_hora?: string
          created_at?: string
        }
        Update: {
          id?: string
          empresa_id?: string
          produto_id?: string
          tipo?: 'entrada' | 'saida' | 'ajuste'
          quantidade?: number
          custo_unitario?: number | null
          documento_origem?: string | null
          observacao?: string | null
          usuario_id?: string
          data_hora?: string
          created_at?: string
        }
      }
      contas_pagar: {
        Row: {
          id: string
          empresa_id: string
          fornecedor_id: string | null
          descricao: string
          valor: number
          vencimento: string
          pagamento_data: string | null
          status: 'pendente' | 'pago' | 'cancelado'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          empresa_id: string
          fornecedor_id?: string | null
          descricao: string
          valor: number
          vencimento: string
          pagamento_data?: string | null
          status?: 'pendente' | 'pago' | 'cancelado'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          empresa_id?: string
          fornecedor_id?: string | null
          descricao?: string
          valor?: number
          vencimento?: string
          pagamento_data?: string | null
          status?: 'pendente' | 'pago' | 'cancelado'
          created_at?: string
          updated_at?: string
        }
      }
      contas_receber: {
        Row: {
          id: string
          empresa_id: string
          cliente_id: string | null
          venda_id: string | null
          parcela: number
          valor: number
          vencimento: string
          recebimento_data: string | null
          status: 'pendente' | 'recebido' | 'cancelado'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          empresa_id: string
          cliente_id?: string | null
          venda_id?: string | null
          parcela?: number
          valor: number
          vencimento: string
          recebimento_data?: string | null
          status?: 'pendente' | 'recebido' | 'cancelado'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          empresa_id?: string
          cliente_id?: string | null
          venda_id?: string | null
          parcela?: number
          valor?: number
          vencimento?: string
          recebimento_data?: string | null
          status?: 'pendente' | 'recebido' | 'cancelado'
          created_at?: string
          updated_at?: string
        }
      }
      caixas: {
        Row: {
          id: string
          empresa_id: string
          usuario_id: string
          data_abertura: string
          valor_abertura: number
          data_fechamento: string | null
          valor_fechamento: number | null
          status: 'aberto' | 'fechado'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          empresa_id: string
          usuario_id: string
          data_abertura?: string
          valor_abertura?: number
          data_fechamento?: string | null
          valor_fechamento?: number | null
          status?: 'aberto' | 'fechado'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          empresa_id?: string
          usuario_id?: string
          data_abertura?: string
          valor_abertura?: number
          data_fechamento?: string | null
          valor_fechamento?: number | null
          status?: 'aberto' | 'fechado'
          created_at?: string
          updated_at?: string
        }
      }
      caixa_movimentos: {
        Row: {
          id: string
          caixa_id: string
          tipo: 'entrada' | 'saida' | 'sangria' | 'suprimento'
          valor: number
          descricao: string | null
          venda_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          caixa_id: string
          tipo: 'entrada' | 'saida' | 'sangria' | 'suprimento'
          valor: number
          descricao?: string | null
          venda_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          caixa_id?: string
          tipo?: 'entrada' | 'saida' | 'sangria' | 'suprimento'
          valor?: number
          descricao?: string | null
          venda_id?: string | null
          created_at?: string
        }
      }
      notas_fiscais: {
        Row: {
          id: string
          empresa_id: string
          venda_id: string | null
          tipo: 'nfce' | 'nfe'
          serie: string
          numero: number
          chave: string | null
          protocolo: string | null
          xml: string | null
          status: 'pendente' | 'autorizada' | 'cancelada' | 'rejeitada'
          motivo_rejeicao: string | null
          emitida_em: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          empresa_id: string
          venda_id?: string | null
          tipo: 'nfce' | 'nfe'
          serie: string
          numero: number
          chave?: string | null
          protocolo?: string | null
          xml?: string | null
          status?: 'pendente' | 'autorizada' | 'cancelada' | 'rejeitada'
          motivo_rejeicao?: string | null
          emitida_em?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          empresa_id?: string
          venda_id?: string | null
          tipo?: 'nfce' | 'nfe'
          serie?: string
          numero?: number
          chave?: string | null
          protocolo?: string | null
          xml?: string | null
          status?: 'pendente' | 'autorizada' | 'cancelada' | 'rejeitada'
          motivo_rejeicao?: string | null
          emitida_em?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
