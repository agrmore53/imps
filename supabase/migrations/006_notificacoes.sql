-- =============================================
-- SISTEMA DE NOTIFICACOES
-- Migration: 006_notificacoes.sql
-- =============================================

-- Tabela de notificacoes
CREATE TABLE notificacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('estoque_baixo', 'conta_pagar_vencida', 'conta_pagar_vencendo', 'conta_receber_vencida')),
    titulo VARCHAR(255) NOT NULL,
    mensagem TEXT NOT NULL,
    referencia_id UUID,           -- ID do produto/conta relacionado
    referencia_tipo VARCHAR(50),  -- 'produto', 'conta_pagar', 'conta_receber'
    lida BOOLEAN DEFAULT false,
    data_geracao DATE NOT NULL,   -- Data que a notificacao foi gerada (evita duplicatas)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(empresa_id, tipo, referencia_id, data_geracao) -- Evita duplicatas no mesmo dia
);

-- =============================================
-- INDICES
-- =============================================

CREATE INDEX idx_notificacoes_empresa ON notificacoes(empresa_id);
CREATE INDEX idx_notificacoes_lida ON notificacoes(lida);
CREATE INDEX idx_notificacoes_tipo ON notificacoes(tipo);
CREATE INDEX idx_notificacoes_created ON notificacoes(created_at DESC);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;

-- Politicas para notificacoes
CREATE POLICY "Ver notificacoes da sua empresa" ON notificacoes
    FOR SELECT USING (
        empresa_id IN (
            SELECT empresa_id FROM usuarios WHERE auth_id = auth.uid()
        )
    );

CREATE POLICY "Inserir notificacoes da sua empresa" ON notificacoes
    FOR INSERT WITH CHECK (
        empresa_id IN (
            SELECT empresa_id FROM usuarios WHERE auth_id = auth.uid()
        )
    );

CREATE POLICY "Atualizar notificacoes da sua empresa" ON notificacoes
    FOR UPDATE USING (
        empresa_id IN (
            SELECT empresa_id FROM usuarios WHERE auth_id = auth.uid()
        )
    );

CREATE POLICY "Deletar notificacoes da sua empresa" ON notificacoes
    FOR DELETE USING (
        empresa_id IN (
            SELECT empresa_id FROM usuarios WHERE auth_id = auth.uid()
        )
    );
