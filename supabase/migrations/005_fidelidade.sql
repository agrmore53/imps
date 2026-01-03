-- =============================================
-- PROGRAMA DE FIDELIDADE
-- Migration: 005_fidelidade.sql
-- =============================================

-- Configuracao do programa de fidelidade por empresa
CREATE TABLE fidelidade_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    pontos_por_real DECIMAL(5, 2) DEFAULT 1,        -- Ex: 1 ponto por R$ 1 gasto
    valor_ponto_resgate DECIMAL(5, 2) DEFAULT 0.10, -- Ex: 1 ponto = R$ 0,10 de desconto
    validade_dias INTEGER DEFAULT 365,              -- 0 = pontos nao expiram
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(empresa_id)
);

-- Saldo de pontos por cliente
CREATE TABLE fidelidade_pontos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    saldo_pontos DECIMAL(15, 2) DEFAULT 0,
    total_acumulado DECIMAL(15, 2) DEFAULT 0,
    total_resgatado DECIMAL(15, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(empresa_id, cliente_id)
);

-- Historico de movimentacoes (ledger pattern)
CREATE TABLE fidelidade_movimentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    venda_id UUID REFERENCES vendas(id) ON DELETE SET NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('acumulo', 'resgate', 'expiracao', 'ajuste')),
    pontos DECIMAL(15, 2) NOT NULL,
    saldo_anterior DECIMAL(15, 2) NOT NULL,
    saldo_posterior DECIMAL(15, 2) NOT NULL,
    valor_venda DECIMAL(15, 2),           -- Valor da venda (para acumulo)
    descricao TEXT,
    data_expiracao DATE,                   -- Quando esses pontos expiram
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Produtos disponiveis para resgate
CREATE TABLE fidelidade_produtos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    produto_id UUID REFERENCES produtos(id) ON DELETE SET NULL,
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    pontos_necessarios DECIMAL(15, 2) NOT NULL,
    estoque_disponivel INTEGER,            -- NULL = ilimitado
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- INDICES
-- =============================================

CREATE INDEX idx_fidelidade_config_empresa ON fidelidade_config(empresa_id);
CREATE INDEX idx_fidelidade_pontos_empresa ON fidelidade_pontos(empresa_id);
CREATE INDEX idx_fidelidade_pontos_cliente ON fidelidade_pontos(cliente_id);
CREATE INDEX idx_fidelidade_movimentos_empresa ON fidelidade_movimentos(empresa_id);
CREATE INDEX idx_fidelidade_movimentos_cliente ON fidelidade_movimentos(cliente_id);
CREATE INDEX idx_fidelidade_movimentos_venda ON fidelidade_movimentos(venda_id);
CREATE INDEX idx_fidelidade_movimentos_created ON fidelidade_movimentos(created_at DESC);
CREATE INDEX idx_fidelidade_produtos_empresa ON fidelidade_produtos(empresa_id);

-- =============================================
-- FUNCAO E TRIGGER PARA ATUALIZAR SALDO
-- =============================================

CREATE OR REPLACE FUNCTION atualizar_saldo_fidelidade()
RETURNS TRIGGER AS $$
BEGIN
    -- Acumulo ou ajuste positivo
    IF NEW.tipo = 'acumulo' OR (NEW.tipo = 'ajuste' AND NEW.pontos > 0) THEN
        UPDATE fidelidade_pontos SET
            saldo_pontos = saldo_pontos + ABS(NEW.pontos),
            total_acumulado = total_acumulado + ABS(NEW.pontos),
            updated_at = NOW()
        WHERE empresa_id = NEW.empresa_id AND cliente_id = NEW.cliente_id;
    -- Resgate, expiracao ou ajuste negativo
    ELSIF NEW.tipo IN ('resgate', 'expiracao') OR (NEW.tipo = 'ajuste' AND NEW.pontos < 0) THEN
        UPDATE fidelidade_pontos SET
            saldo_pontos = GREATEST(0, saldo_pontos - ABS(NEW.pontos)),
            total_resgatado = total_resgatado + ABS(NEW.pontos),
            updated_at = NOW()
        WHERE empresa_id = NEW.empresa_id AND cliente_id = NEW.cliente_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_atualizar_saldo_fidelidade
    AFTER INSERT ON fidelidade_movimentos
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_saldo_fidelidade();

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

ALTER TABLE fidelidade_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE fidelidade_pontos ENABLE ROW LEVEL SECURITY;
ALTER TABLE fidelidade_movimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE fidelidade_produtos ENABLE ROW LEVEL SECURITY;

-- Politicas para fidelidade_config
CREATE POLICY "Ver config fidelidade da sua empresa" ON fidelidade_config
    FOR SELECT USING (
        empresa_id IN (
            SELECT empresa_id FROM usuarios WHERE auth_id = auth.uid()
        )
    );

CREATE POLICY "Inserir config fidelidade da sua empresa" ON fidelidade_config
    FOR INSERT WITH CHECK (
        empresa_id IN (
            SELECT empresa_id FROM usuarios WHERE auth_id = auth.uid()
        )
    );

CREATE POLICY "Atualizar config fidelidade da sua empresa" ON fidelidade_config
    FOR UPDATE USING (
        empresa_id IN (
            SELECT empresa_id FROM usuarios WHERE auth_id = auth.uid()
        )
    );

-- Politicas para fidelidade_pontos
CREATE POLICY "Ver pontos da sua empresa" ON fidelidade_pontos
    FOR SELECT USING (
        empresa_id IN (
            SELECT empresa_id FROM usuarios WHERE auth_id = auth.uid()
        )
    );

CREATE POLICY "Inserir pontos da sua empresa" ON fidelidade_pontos
    FOR INSERT WITH CHECK (
        empresa_id IN (
            SELECT empresa_id FROM usuarios WHERE auth_id = auth.uid()
        )
    );

CREATE POLICY "Atualizar pontos da sua empresa" ON fidelidade_pontos
    FOR UPDATE USING (
        empresa_id IN (
            SELECT empresa_id FROM usuarios WHERE auth_id = auth.uid()
        )
    );

-- Politicas para fidelidade_movimentos
CREATE POLICY "Ver movimentos da sua empresa" ON fidelidade_movimentos
    FOR SELECT USING (
        empresa_id IN (
            SELECT empresa_id FROM usuarios WHERE auth_id = auth.uid()
        )
    );

CREATE POLICY "Inserir movimentos da sua empresa" ON fidelidade_movimentos
    FOR INSERT WITH CHECK (
        empresa_id IN (
            SELECT empresa_id FROM usuarios WHERE auth_id = auth.uid()
        )
    );

-- Politicas para fidelidade_produtos
CREATE POLICY "Ver produtos fidelidade da sua empresa" ON fidelidade_produtos
    FOR SELECT USING (
        empresa_id IN (
            SELECT empresa_id FROM usuarios WHERE auth_id = auth.uid()
        )
    );

CREATE POLICY "Inserir produtos fidelidade da sua empresa" ON fidelidade_produtos
    FOR INSERT WITH CHECK (
        empresa_id IN (
            SELECT empresa_id FROM usuarios WHERE auth_id = auth.uid()
        )
    );

CREATE POLICY "Atualizar produtos fidelidade da sua empresa" ON fidelidade_produtos
    FOR UPDATE USING (
        empresa_id IN (
            SELECT empresa_id FROM usuarios WHERE auth_id = auth.uid()
        )
    );

CREATE POLICY "Deletar produtos fidelidade da sua empresa" ON fidelidade_produtos
    FOR DELETE USING (
        empresa_id IN (
            SELECT empresa_id FROM usuarios WHERE auth_id = auth.uid()
        )
    );
