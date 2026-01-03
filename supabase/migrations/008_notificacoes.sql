-- Migration: Sistema de Notificações
-- Descrição: Tabela para armazenar notificações do sistema (estoque baixo, contas vencidas, etc.)

-- Criar tabela de notificações
CREATE TABLE IF NOT EXISTS notificacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL, -- 'estoque_baixo', 'conta_pagar_vencida', 'conta_pagar_vencendo', 'conta_receber_vencida'
    titulo VARCHAR(255) NOT NULL,
    mensagem TEXT NOT NULL,
    referencia_id UUID,           -- ID do produto/conta relacionado
    referencia_tipo VARCHAR(50),  -- 'produto', 'conta_pagar', 'conta_receber'
    lida BOOLEAN DEFAULT false,
    data_geracao DATE NOT NULL,   -- Data que a notificação foi gerada (evita duplicatas)
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraint para evitar duplicatas no mesmo dia
    CONSTRAINT notificacoes_unique_dia UNIQUE(empresa_id, tipo, referencia_id, data_geracao)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_notificacoes_empresa ON notificacoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_lida ON notificacoes(lida);
CREATE INDEX IF NOT EXISTS idx_notificacoes_tipo ON notificacoes(tipo);
CREATE INDEX IF NOT EXISTS idx_notificacoes_data ON notificacoes(data_geracao DESC);

-- Habilitar RLS
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
CREATE POLICY "Usuarios podem ver notificacoes da sua empresa"
ON notificacoes FOR SELECT
TO authenticated
USING (
    empresa_id IN (
        SELECT empresa_id FROM usuarios WHERE auth_id = auth.uid()
    )
);

CREATE POLICY "Usuarios podem inserir notificacoes da sua empresa"
ON notificacoes FOR INSERT
TO authenticated
WITH CHECK (
    empresa_id IN (
        SELECT empresa_id FROM usuarios WHERE auth_id = auth.uid()
    )
);

CREATE POLICY "Usuarios podem atualizar notificacoes da sua empresa"
ON notificacoes FOR UPDATE
TO authenticated
USING (
    empresa_id IN (
        SELECT empresa_id FROM usuarios WHERE auth_id = auth.uid()
    )
);

CREATE POLICY "Usuarios podem deletar notificacoes da sua empresa"
ON notificacoes FOR DELETE
TO authenticated
USING (
    empresa_id IN (
        SELECT empresa_id FROM usuarios WHERE auth_id = auth.uid()
    )
);

-- Comentários
COMMENT ON TABLE notificacoes IS 'Notificações do sistema para alertar sobre eventos importantes';
COMMENT ON COLUMN notificacoes.tipo IS 'Tipo da notificação: estoque_baixo, conta_pagar_vencida, conta_pagar_vencendo, conta_receber_vencida';
COMMENT ON COLUMN notificacoes.referencia_id IS 'ID do registro relacionado (produto, conta_pagar, conta_receber)';
COMMENT ON COLUMN notificacoes.referencia_tipo IS 'Tipo do registro relacionado';
COMMENT ON COLUMN notificacoes.data_geracao IS 'Data em que a notificação foi gerada, usado para evitar duplicatas';
