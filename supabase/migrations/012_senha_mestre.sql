-- =============================================
-- IMPÉRIO SISTEMAS DE ALTO NÍVEL
-- Migration 012: Senha Mestre para operações críticas
-- =============================================

-- Adicionar campo para senha mestre (hash) na tabela empresas
-- Esta senha é separada da senha de login e só o dono deve saber
ALTER TABLE empresas
ADD COLUMN IF NOT EXISTS senha_mestre_hash TEXT DEFAULT NULL;

-- Comentário explicativo
COMMENT ON COLUMN empresas.senha_mestre_hash IS 'Hash da senha mestre para operações críticas (restaurar padrão, etc). Apenas o dono deve conhecer esta senha.';

-- Índice para performance (caso precise buscar)
CREATE INDEX IF NOT EXISTS idx_empresas_senha_mestre ON empresas(id) WHERE senha_mestre_hash IS NOT NULL;
