-- Migration: Reforma Tributária - IBS/CBS
-- Descrição: Prepara estrutura para campos IBS/CBS conforme NT 2025.002
-- Obrigatório: Simples Nacional a partir de 2027, Lucro Real/Presumido a partir de 2026

-- Adicionar campos de configuração IBS/CBS na config_fiscal das empresas
-- Estes campos serão usados quando a empresa precisar emitir com IBS/CBS

COMMENT ON TABLE empresas IS 'Tabela de empresas - config_fiscal inclui campos para Reforma Tributária IBS/CBS';

-- Criar tabela de classificação tributária IBS/CBS por produto
CREATE TABLE IF NOT EXISTS produtos_classificacao_tributaria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,

    -- Classificação IBS/CBS (conforme NT 2025.002)
    cst_ibs_cbs VARCHAR(3) DEFAULT '00',           -- Código Situação Tributária IBS/CBS
    c_class_trib VARCHAR(10),                       -- Código Classificação Tributária (cClassTrib)

    -- Alíquotas (podem variar por produto/NCM)
    aliquota_ibs DECIMAL(5,2) DEFAULT 0.1,         -- Alíquota IBS (0.1% em 2026)
    aliquota_cbs DECIMAL(5,2) DEFAULT 0.9,         -- Alíquota CBS (0.9% em 2026)

    -- Flags de isenção/redução
    isento_ibs BOOLEAN DEFAULT false,
    isento_cbs BOOLEAN DEFAULT false,
    reducao_base_ibs DECIMAL(5,2) DEFAULT 0,       -- % redução base cálculo IBS
    reducao_base_cbs DECIMAL(5,2) DEFAULT 0,       -- % redução base cálculo CBS

    -- Metadata
    observacao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT produtos_class_trib_unique UNIQUE(empresa_id, produto_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_prod_class_trib_empresa ON produtos_classificacao_tributaria(empresa_id);
CREATE INDEX IF NOT EXISTS idx_prod_class_trib_produto ON produtos_classificacao_tributaria(produto_id);

-- Habilitar RLS
ALTER TABLE produtos_classificacao_tributaria ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuarios podem ver classificacao tributaria da sua empresa"
ON produtos_classificacao_tributaria FOR SELECT
TO authenticated
USING (
    empresa_id IN (
        SELECT empresa_id FROM usuarios WHERE auth_id = auth.uid()
    )
);

CREATE POLICY "Usuarios podem inserir classificacao tributaria da sua empresa"
ON produtos_classificacao_tributaria FOR INSERT
TO authenticated
WITH CHECK (
    empresa_id IN (
        SELECT empresa_id FROM usuarios WHERE auth_id = auth.uid()
    )
);

CREATE POLICY "Usuarios podem atualizar classificacao tributaria da sua empresa"
ON produtos_classificacao_tributaria FOR UPDATE
TO authenticated
USING (
    empresa_id IN (
        SELECT empresa_id FROM usuarios WHERE auth_id = auth.uid()
    )
);

CREATE POLICY "Usuarios podem deletar classificacao tributaria da sua empresa"
ON produtos_classificacao_tributaria FOR DELETE
TO authenticated
USING (
    empresa_id IN (
        SELECT empresa_id FROM usuarios WHERE auth_id = auth.uid()
    )
);

-- Tabela de CST IBS/CBS (códigos válidos conforme LC 214/2025)
CREATE TABLE IF NOT EXISTS cst_ibs_cbs (
    codigo VARCHAR(3) PRIMARY KEY,
    descricao VARCHAR(255) NOT NULL,
    tipo VARCHAR(20) NOT NULL, -- 'tributado', 'isento', 'imune', 'diferido', 'suspenso'
    ativo BOOLEAN DEFAULT true
);

-- Inserir CSTs básicos (conforme NT 2025.002)
INSERT INTO cst_ibs_cbs (codigo, descricao, tipo) VALUES
    ('00', 'Tributação integral', 'tributado'),
    ('10', 'Tributação com alíquota reduzida', 'tributado'),
    ('20', 'Tributação com alíquota zero', 'tributado'),
    ('30', 'Isenção', 'isento'),
    ('40', 'Imunidade', 'imune'),
    ('50', 'Suspensão', 'suspenso'),
    ('60', 'Diferimento', 'diferido'),
    ('90', 'Outros', 'tributado')
ON CONFLICT (codigo) DO NOTHING;

-- Adicionar campos na tabela notas_fiscais para totais IBS/CBS
ALTER TABLE notas_fiscais
ADD COLUMN IF NOT EXISTS total_ibs DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_cbs DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS base_calculo_ibs_cbs DECIMAL(15,2) DEFAULT 0;

-- Comentários
COMMENT ON TABLE produtos_classificacao_tributaria IS 'Classificação tributária IBS/CBS por produto - Reforma Tributária';
COMMENT ON TABLE cst_ibs_cbs IS 'Códigos de Situação Tributária IBS/CBS conforme LC 214/2025';
COMMENT ON COLUMN notas_fiscais.total_ibs IS 'Total do IBS na nota (Reforma Tributária)';
COMMENT ON COLUMN notas_fiscais.total_cbs IS 'Total da CBS na nota (Reforma Tributária)';
