-- =============================================
-- MIGRATION: CREDIÁRIO (Sistema de Crédito/Fiado)
-- =============================================

-- Tabela de movimentações do crediário
CREATE TABLE IF NOT EXISTS crediario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    venda_id UUID REFERENCES vendas(id) ON DELETE SET NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('debito', 'credito')),
    -- debito = cliente comprou no fiado (aumenta dívida)
    -- credito = cliente pagou parte da dívida (diminui dívida)
    valor DECIMAL(15, 2) NOT NULL,
    saldo_anterior DECIMAL(15, 2) NOT NULL,
    saldo_posterior DECIMAL(15, 2) NOT NULL,
    descricao TEXT,
    forma_pagamento VARCHAR(50), -- para pagamentos: dinheiro, pix, cartao
    usuario_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_crediario_empresa ON crediario(empresa_id);
CREATE INDEX idx_crediario_cliente ON crediario(cliente_id);
CREATE INDEX idx_crediario_venda ON crediario(venda_id);
CREATE INDEX idx_crediario_tipo ON crediario(tipo);
CREATE INDEX idx_crediario_created_at ON crediario(created_at DESC);

-- RLS Policies para crediario
ALTER TABLE crediario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver crediário da sua empresa" ON crediario
    FOR SELECT USING (
        empresa_id IN (
            SELECT empresa_id FROM usuarios WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Usuários podem inserir crediário na sua empresa" ON crediario
    FOR INSERT WITH CHECK (
        empresa_id IN (
            SELECT empresa_id FROM usuarios WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Usuários podem atualizar crediário da sua empresa" ON crediario
    FOR UPDATE USING (
        empresa_id IN (
            SELECT empresa_id FROM usuarios WHERE user_id = auth.uid()
        )
    );

-- Função para atualizar saldo_devedor do cliente automaticamente
CREATE OR REPLACE FUNCTION atualizar_saldo_cliente()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tipo = 'debito' THEN
        UPDATE clientes
        SET saldo_devedor = saldo_devedor + NEW.valor,
            updated_at = NOW()
        WHERE id = NEW.cliente_id;
    ELSIF NEW.tipo = 'credito' THEN
        UPDATE clientes
        SET saldo_devedor = saldo_devedor - NEW.valor,
            updated_at = NOW()
        WHERE id = NEW.cliente_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar saldo automaticamente
DROP TRIGGER IF EXISTS trigger_atualizar_saldo_cliente ON crediario;
CREATE TRIGGER trigger_atualizar_saldo_cliente
    AFTER INSERT ON crediario
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_saldo_cliente();
