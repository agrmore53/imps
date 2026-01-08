-- =============================================
-- IMPÉRIO SISTEMAS DE ALTO NÍVEL
-- Migration 011: Políticas DELETE para Restaurar Padrão de Fábrica
-- =============================================

-- =============================================
-- POLÍTICAS DELETE PARA VENDAS E RELACIONADOS
-- =============================================

-- Vendas (apenas admin pode deletar)
CREATE POLICY "Admins podem deletar vendas"
    ON vendas FOR DELETE
    USING (empresa_id = get_user_empresa_id() AND is_admin());

-- Itens da Venda (apenas admin pode deletar)
CREATE POLICY "Admins podem deletar itens de venda"
    ON venda_itens FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM vendas
            WHERE vendas.id = venda_itens.venda_id
            AND vendas.empresa_id = get_user_empresa_id()
        )
        AND is_admin()
    );

-- Pagamentos da Venda (apenas admin pode deletar)
CREATE POLICY "Admins podem deletar pagamentos de venda"
    ON venda_pagamentos FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM vendas
            WHERE vendas.id = venda_pagamentos.venda_id
            AND vendas.empresa_id = get_user_empresa_id()
        )
        AND is_admin()
    );

-- =============================================
-- POLÍTICAS DELETE PARA ESTOQUE
-- =============================================

-- Movimentos de Estoque (apenas admin pode deletar)
CREATE POLICY "Admins podem deletar movimentos de estoque"
    ON estoque_movimentos FOR DELETE
    USING (empresa_id = get_user_empresa_id() AND is_admin());

-- =============================================
-- POLÍTICAS DELETE PARA FINANCEIRO
-- =============================================

-- Contas a Receber (apenas admin pode deletar)
CREATE POLICY "Admins podem deletar contas a receber"
    ON contas_receber FOR DELETE
    USING (empresa_id = get_user_empresa_id() AND is_admin());

-- =============================================
-- POLÍTICAS DELETE PARA CAIXA
-- =============================================

-- Caixas (apenas admin pode deletar)
CREATE POLICY "Admins podem deletar caixas"
    ON caixas FOR DELETE
    USING (empresa_id = get_user_empresa_id() AND is_admin());

-- Movimentos do Caixa (apenas admin pode deletar)
CREATE POLICY "Admins podem deletar movimentos de caixa"
    ON caixa_movimentos FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM caixas
            WHERE caixas.id = caixa_movimentos.caixa_id
            AND caixas.empresa_id = get_user_empresa_id()
        )
        AND is_admin()
    );

-- =============================================
-- POLÍTICAS DELETE PARA FISCAL
-- =============================================

-- Notas Fiscais (apenas admin pode deletar)
CREATE POLICY "Admins podem deletar notas fiscais"
    ON notas_fiscais FOR DELETE
    USING (empresa_id = get_user_empresa_id() AND is_admin());

-- =============================================
-- COMENTÁRIOS
-- =============================================

COMMENT ON POLICY "Admins podem deletar vendas" ON vendas IS 'Permite que admins deletem vendas para restaurar padrão de fábrica';
COMMENT ON POLICY "Admins podem deletar itens de venda" ON venda_itens IS 'Permite que admins deletem itens de venda para restaurar padrão de fábrica';
COMMENT ON POLICY "Admins podem deletar pagamentos de venda" ON venda_pagamentos IS 'Permite que admins deletem pagamentos para restaurar padrão de fábrica';
COMMENT ON POLICY "Admins podem deletar movimentos de estoque" ON estoque_movimentos IS 'Permite que admins deletem movimentos de estoque para restaurar padrão de fábrica';
COMMENT ON POLICY "Admins podem deletar contas a receber" ON contas_receber IS 'Permite que admins deletem contas a receber para restaurar padrão de fábrica';
COMMENT ON POLICY "Admins podem deletar caixas" ON caixas IS 'Permite que admins deletem caixas para restaurar padrão de fábrica';
COMMENT ON POLICY "Admins podem deletar movimentos de caixa" ON caixa_movimentos IS 'Permite que admins deletem movimentos de caixa para restaurar padrão de fábrica';
COMMENT ON POLICY "Admins podem deletar notas fiscais" ON notas_fiscais IS 'Permite que admins deletem notas fiscais para restaurar padrão de fábrica';
