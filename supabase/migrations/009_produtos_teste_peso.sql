-- Migration: Produtos de Teste por Peso
-- Descrição: Adiciona produtos de teste vendidos por peso (KG, G, L)

-- Inserir produtos de teste para a primeira empresa encontrada
DO $$
DECLARE
    v_empresa_id UUID;
BEGIN
    -- Buscar a primeira empresa
    SELECT id INTO v_empresa_id FROM empresas LIMIT 1;

    IF v_empresa_id IS NOT NULL THEN
        -- Ração a Granel (KG)
        INSERT INTO produtos (empresa_id, codigo, nome, descricao, unidade, preco_custo, preco_venda, estoque_atual, estoque_minimo, ncm, ativo)
        VALUES (v_empresa_id, 'RACAO-GRANEL-001', 'Ração Premium Cães Adultos - Granel', 'Ração premium para cães adultos vendida a granel por kg', 'KG', 12.00, 18.90, 50.000, 10.000, '23091000', true)
        ON CONFLICT (empresa_id, codigo) DO NOTHING;

        -- Ração Gatos Granel (KG)
        INSERT INTO produtos (empresa_id, codigo, nome, descricao, unidade, preco_custo, preco_venda, estoque_atual, estoque_minimo, ncm, ativo)
        VALUES (v_empresa_id, 'RACAO-GRANEL-002', 'Ração Premium Gatos - Granel', 'Ração premium para gatos vendida a granel por kg', 'KG', 15.00, 24.90, 30.000, 5.000, '23091000', true)
        ON CONFLICT (empresa_id, codigo) DO NOTHING;

        -- Ração Filhotes Granel (KG)
        INSERT INTO produtos (empresa_id, codigo, nome, descricao, unidade, preco_custo, preco_venda, estoque_atual, estoque_minimo, ncm, ativo)
        VALUES (v_empresa_id, 'RACAO-GRANEL-003', 'Ração Filhotes Premium - Granel', 'Ração para filhotes vendida a granel por kg', 'KG', 14.00, 22.50, 25.000, 5.000, '23091000', true)
        ON CONFLICT (empresa_id, codigo) DO NOTHING;

        -- Petisco a Granel (G)
        INSERT INTO produtos (empresa_id, codigo, nome, descricao, unidade, preco_custo, preco_venda, estoque_atual, estoque_minimo, ncm, ativo)
        VALUES (v_empresa_id, 'PETISCO-GRANEL-001', 'Bifinho de Carne - Granel', 'Petisco de carne para cães vendido por grama', 'G', 0.08, 0.15, 5000.000, 500.000, '23091000', true)
        ON CONFLICT (empresa_id, codigo) DO NOTHING;

        -- Areia Sanitária (KG)
        INSERT INTO produtos (empresa_id, codigo, nome, descricao, unidade, preco_custo, preco_venda, estoque_atual, estoque_minimo, ncm, ativo)
        VALUES (v_empresa_id, 'AREIA-GRANEL-001', 'Areia Sanitária Perfumada - Granel', 'Areia higiênica para gatos vendida por kg', 'KG', 3.50, 6.90, 100.000, 20.000, '38089419', true)
        ON CONFLICT (empresa_id, codigo) DO NOTHING;

        -- Shampoo a Granel (L)
        INSERT INTO produtos (empresa_id, codigo, nome, descricao, unidade, preco_custo, preco_venda, estoque_atual, estoque_minimo, ncm, ativo)
        VALUES (v_empresa_id, 'SHAMPOO-GRANEL-001', 'Shampoo Neutro Pet - Granel', 'Shampoo neutro para cães e gatos vendido por litro', 'L', 15.00, 29.90, 20.000, 5.000, '33051000', true)
        ON CONFLICT (empresa_id, codigo) DO NOTHING;

        -- Condicionador a Granel (ML)
        INSERT INTO produtos (empresa_id, codigo, nome, descricao, unidade, preco_custo, preco_venda, estoque_atual, estoque_minimo, ncm, ativo)
        VALUES (v_empresa_id, 'CONDIC-GRANEL-001', 'Condicionador Hidratante Pet - Granel', 'Condicionador para pelos vendido por ml', 'ML', 0.025, 0.045, 10000.000, 2000.000, '33051000', true)
        ON CONFLICT (empresa_id, codigo) DO NOTHING;

        RAISE NOTICE 'Produtos de teste por peso criados com sucesso para empresa %', v_empresa_id;
    ELSE
        RAISE NOTICE 'Nenhuma empresa encontrada. Execute após criar uma empresa.';
    END IF;
END $$;
