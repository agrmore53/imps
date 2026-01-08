-- =============================================
-- IMPÉRIO SISTEMAS DE ALTO NÍVEL
-- Migration 014: Logs de Erros do Sistema
-- =============================================

-- Tabela para registrar erros do sistema
CREATE TABLE IF NOT EXISTS logs_erros (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    tipo VARCHAR(50) NOT NULL, -- erro_api, erro_banco, erro_autenticacao, erro_validacao
    endpoint VARCHAR(255),
    metodo VARCHAR(10), -- GET, POST, PUT, DELETE, PATCH
    mensagem TEXT NOT NULL,
    stack_trace TEXT,
    request_body JSONB, -- Dados da requisição (sem senhas)
    response_status INTEGER,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas
CREATE INDEX IF NOT EXISTS idx_logs_erros_empresa ON logs_erros(empresa_id);
CREATE INDEX IF NOT EXISTS idx_logs_erros_tipo ON logs_erros(tipo);
CREATE INDEX IF NOT EXISTS idx_logs_erros_endpoint ON logs_erros(endpoint);
CREATE INDEX IF NOT EXISTS idx_logs_erros_created ON logs_erros(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_erros_status ON logs_erros(response_status);

-- Comentários
COMMENT ON TABLE logs_erros IS 'Registra erros do sistema para debugging e monitoramento';
COMMENT ON COLUMN logs_erros.tipo IS 'Tipo do erro: erro_api, erro_banco, erro_autenticacao, erro_validacao';
COMMENT ON COLUMN logs_erros.request_body IS 'Corpo da requisição (senhas são removidas automaticamente)';

-- RLS
ALTER TABLE logs_erros ENABLE ROW LEVEL SECURITY;

-- Política de leitura (apenas admins podem ver logs de erros)
CREATE POLICY "Admins podem ver logs de erros"
    ON logs_erros FOR SELECT
    USING (
        empresa_id IS NULL OR
        (empresa_id = get_user_empresa_id() AND is_admin())
    );

-- Política de inserção (qualquer usuário autenticado pode inserir - para capturar erros)
CREATE POLICY "Usuarios podem inserir logs de erros"
    ON logs_erros FOR INSERT
    WITH CHECK (true);
