-- Migration: Sistema de Inventário/Balanço
-- Descrição: Tabelas para contagem física de estoque

-- Tabela principal de inventários
CREATE TABLE inventarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    numero SERIAL,
    descricao VARCHAR(255),
    data_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data_fim TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'em_andamento', -- em_andamento, finalizado, cancelado
    tipo VARCHAR(20) NOT NULL DEFAULT 'completo', -- completo, parcial
    contagem_cega BOOLEAN DEFAULT false, -- se true, operador não vê qtd sistema
    usuario_id UUID REFERENCES usuarios(id), -- quem criou
    usuario_finalizacao_id UUID REFERENCES usuarios(id), -- quem finalizou
    observacoes TEXT,
    total_produtos INTEGER DEFAULT 0,
    total_contados INTEGER DEFAULT 0,
    total_divergencias INTEGER DEFAULT 0,
    valor_divergencia DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Itens do inventário (produtos a serem contados)
CREATE TABLE inventario_itens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventario_id UUID NOT NULL REFERENCES inventarios(id) ON DELETE CASCADE,
    produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
    quantidade_sistema DECIMAL(15,3) NOT NULL, -- qtd no momento da criação do inventário
    quantidade_contagem_1 DECIMAL(15,3), -- primeira contagem
    quantidade_contagem_2 DECIMAL(15,3), -- segunda contagem (reconferência)
    quantidade_contagem_3 DECIMAL(15,3), -- terceira contagem (desempate)
    quantidade_final DECIMAL(15,3), -- quantidade final aprovada
    divergencia DECIMAL(15,3), -- diferença (final - sistema)
    valor_divergencia DECIMAL(15,2), -- valor da divergência
    status VARCHAR(20) NOT NULL DEFAULT 'pendente', -- pendente, contado, divergente, ajustado
    motivo_ajuste VARCHAR(100), -- perda, furto, vencido, erro_entrada, erro_saida, outros
    observacao TEXT,
    usuario_contagem_1_id UUID REFERENCES usuarios(id),
    usuario_contagem_2_id UUID REFERENCES usuarios(id),
    usuario_contagem_3_id UUID REFERENCES usuarios(id),
    data_contagem_1 TIMESTAMPTZ,
    data_contagem_2 TIMESTAMPTZ,
    data_contagem_3 TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(inventario_id, produto_id)
);

-- Índices
CREATE INDEX idx_inventarios_empresa ON inventarios(empresa_id);
CREATE INDEX idx_inventarios_status ON inventarios(status);
CREATE INDEX idx_inventarios_data ON inventarios(data_inicio);
CREATE INDEX idx_inventario_itens_inventario ON inventario_itens(inventario_id);
CREATE INDEX idx_inventario_itens_produto ON inventario_itens(produto_id);
CREATE INDEX idx_inventario_itens_status ON inventario_itens(status);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_inventario_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_inventarios_updated_at
    BEFORE UPDATE ON inventarios
    FOR EACH ROW
    EXECUTE FUNCTION update_inventario_updated_at();

CREATE TRIGGER trigger_inventario_itens_updated_at
    BEFORE UPDATE ON inventario_itens
    FOR EACH ROW
    EXECUTE FUNCTION update_inventario_updated_at();

-- RLS Policies
ALTER TABLE inventarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario_itens ENABLE ROW LEVEL SECURITY;

-- Política para inventários
CREATE POLICY "Usuarios podem ver inventarios da sua empresa" ON inventarios
    FOR SELECT USING (
        empresa_id IN (
            SELECT empresa_id FROM usuarios WHERE auth_id = auth.uid()
        )
    );

CREATE POLICY "Usuarios podem criar inventarios da sua empresa" ON inventarios
    FOR INSERT WITH CHECK (
        empresa_id IN (
            SELECT empresa_id FROM usuarios WHERE auth_id = auth.uid()
        )
    );

CREATE POLICY "Usuarios podem atualizar inventarios da sua empresa" ON inventarios
    FOR UPDATE USING (
        empresa_id IN (
            SELECT empresa_id FROM usuarios WHERE auth_id = auth.uid()
        )
    );

-- Política para itens do inventário
CREATE POLICY "Usuarios podem ver itens de inventarios da sua empresa" ON inventario_itens
    FOR SELECT USING (
        inventario_id IN (
            SELECT id FROM inventarios WHERE empresa_id IN (
                SELECT empresa_id FROM usuarios WHERE auth_id = auth.uid()
            )
        )
    );

CREATE POLICY "Usuarios podem criar itens de inventarios da sua empresa" ON inventario_itens
    FOR INSERT WITH CHECK (
        inventario_id IN (
            SELECT id FROM inventarios WHERE empresa_id IN (
                SELECT empresa_id FROM usuarios WHERE auth_id = auth.uid()
            )
        )
    );

CREATE POLICY "Usuarios podem atualizar itens de inventarios da sua empresa" ON inventario_itens
    FOR UPDATE USING (
        inventario_id IN (
            SELECT id FROM inventarios WHERE empresa_id IN (
                SELECT empresa_id FROM usuarios WHERE auth_id = auth.uid()
            )
        )
    );
