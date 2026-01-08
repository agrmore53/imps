-- =============================================
-- IMPÉRIO SISTEMAS DE ALTO NÍVEL
-- Migration 013: Logs de Auditoria para operações críticas
-- =============================================

-- Tabela para registrar operações críticas do sistema
CREATE TABLE IF NOT EXISTS logs_auditoria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    usuario_nome VARCHAR(255),
    acao VARCHAR(100) NOT NULL,
    detalhes JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_empresa ON logs_auditoria(empresa_id);
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_acao ON logs_auditoria(acao);
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_created ON logs_auditoria(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_usuario ON logs_auditoria(usuario_id);

-- Comentários
COMMENT ON TABLE logs_auditoria IS 'Registra operações críticas do sistema para auditoria';
COMMENT ON COLUMN logs_auditoria.acao IS 'Tipo da ação: RESTAURAR_PADRAO, ALTERAR_SENHA_MESTRE, etc';
COMMENT ON COLUMN logs_auditoria.detalhes IS 'Detalhes adicionais da operação em JSON';

-- RLS
ALTER TABLE logs_auditoria ENABLE ROW LEVEL SECURITY;

-- Política de leitura (apenas admins podem ver logs)
CREATE POLICY "Admins podem ver logs de auditoria"
    ON logs_auditoria FOR SELECT
    USING (empresa_id = get_user_empresa_id() AND is_admin());

-- Política de inserção (sistema pode inserir via service role)
CREATE POLICY "Sistema pode inserir logs"
    ON logs_auditoria FOR INSERT
    WITH CHECK (empresa_id = get_user_empresa_id());
