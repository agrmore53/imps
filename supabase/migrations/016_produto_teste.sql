-- =============================================
-- IMPÉRIO SISTEMAS DE ALTO NÍVEL
-- Migration 016: Produto com estoque infinito e preço variável
-- (Temporário - para testes de NFC-e/NF-e)
-- =============================================

-- Adicionar campo para controle de estoque
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS controla_estoque BOOLEAN DEFAULT true;

-- Adicionar campo para preço variável (operador define no PDV)
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS preco_variavel BOOLEAN DEFAULT false;

-- Comentários explicativos
COMMENT ON COLUMN produtos.controla_estoque IS 'Se false, não desconta do estoque nas vendas (estoque infinito)';
COMMENT ON COLUMN produtos.preco_variavel IS 'Se true, operador pode definir o preço no momento da venda no PDV';

-- =============================================
-- Atualizar trigger de baixa de estoque para respeitar controla_estoque
-- =============================================

CREATE OR REPLACE FUNCTION baixar_estoque_venda()
RETURNS TRIGGER AS $$
DECLARE
    v_controla_estoque BOOLEAN;
BEGIN
    -- Verificar se o produto controla estoque
    SELECT COALESCE(controla_estoque, true) INTO v_controla_estoque
    FROM produtos WHERE id = NEW.produto_id;

    -- Só reduz o estoque se o produto controlar estoque
    IF v_controla_estoque THEN
        UPDATE produtos
        SET estoque_atual = estoque_atual - NEW.quantidade
        WHERE id = NEW.produto_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Criar produto TESTE para todas as empresas existentes
-- =============================================

DO $$
DECLARE
    emp RECORD;
BEGIN
    FOR emp IN SELECT id FROM empresas LOOP
        -- Verificar se já existe produto TESTE para esta empresa
        IF NOT EXISTS (
            SELECT 1 FROM produtos
            WHERE empresa_id = emp.id
            AND (codigo = 'TESTE' OR nome = 'TESTE')
        ) THEN
            INSERT INTO produtos (
                empresa_id,
                codigo,
                nome,
                descricao,
                unidade,
                preco_custo,
                preco_venda,
                estoque_atual,
                estoque_minimo,
                ncm,
                ativo,
                controla_estoque,
                preco_variavel
            ) VALUES (
                emp.id,
                'TESTE',
                '🧪 PRODUTO TESTE',
                'Produto para testes de NFC-e/NF-e. Não controla estoque e preço é definido no PDV.',
                'UN',
                0,
                0.01,
                999999,
                0,
                '00000000',
                true,
                false,  -- Não controla estoque (infinito)
                true    -- Preço variável (define no PDV)
            );
        END IF;
    END LOOP;
END $$;
