-- =============================================
-- IMPÉRIO SISTEMAS DE ALTO NÍVEL
-- Migration 003: Fiscal Updates
-- Adiciona campos necessários para emissão fiscal
-- =============================================

-- Adiciona protocolo_nfce na tabela vendas
ALTER TABLE vendas
ADD COLUMN IF NOT EXISTS protocolo_nfce VARCHAR(50);

-- Adiciona valor_total na tabela notas_fiscais
ALTER TABLE notas_fiscais
ADD COLUMN IF NOT EXISTS valor_total DECIMAL(15, 2);

-- Adiciona inscricao_estadual na tabela empresas (alias para ie)
-- Garante que o campo ie existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'empresas' AND column_name = 'inscricao_estadual'
    ) THEN
        ALTER TABLE empresas ADD COLUMN inscricao_estadual VARCHAR(20);
    END IF;
END $$;

-- Atualiza inscricao_estadual com valor de ie se existir
UPDATE empresas SET inscricao_estadual = ie WHERE inscricao_estadual IS NULL AND ie IS NOT NULL;

-- Adiciona campo para dados do destinatário na nota fiscal (para NF-e)
ALTER TABLE notas_fiscais
ADD COLUMN IF NOT EXISTS destinatario JSONB DEFAULT '{}';

-- Adiciona campo para itens da nota fiscal
ALTER TABLE notas_fiscais
ADD COLUMN IF NOT EXISTS itens JSONB DEFAULT '[]';

-- Adiciona campo para pagamentos da nota fiscal
ALTER TABLE notas_fiscais
ADD COLUMN IF NOT EXISTS pagamentos JSONB DEFAULT '[]';

-- Atualiza config_fiscal padrão para ter todos os campos necessários
COMMENT ON COLUMN empresas.config_fiscal IS 'Configuração fiscal da empresa. Campos esperados:
{
  "ambiente": 1 | 2,           -- 1=Produção, 2=Homologação
  "crt": 1 | 2 | 3,            -- Código Regime Tributário
  "serie_nfce": number,
  "serie_nfe": number,
  "ultimo_numero_nfce": number,
  "ultimo_numero_nfe": number,
  "id_token_nfce": number,     -- ID do CSC
  "csc_nfce": string,          -- Token CSC
  "cfop_venda": string,        -- CFOP padrão NFC-e
  "cfop_venda_nfe": string,    -- CFOP padrão NF-e
  "certificado_base64": string, -- Certificado A1 em base64
  "certificado_senha": string,  -- Senha do certificado
  "certificado_nome": string,   -- Nome do arquivo
  "certificado_validade": string -- Data de validade
}';

-- Índice para busca por data de emissão
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_emitida_em ON notas_fiscais(emitida_em);

-- Índice para busca por status
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_status ON notas_fiscais(status);
