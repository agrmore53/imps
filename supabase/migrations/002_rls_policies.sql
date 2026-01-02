-- =============================================
-- IMPÉRIO SISTEMAS DE ALTO NÍVEL
-- Migration 002: Row Level Security Policies
-- =============================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE venda_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE venda_pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque_movimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_receber ENABLE ROW LEVEL SECURITY;
ALTER TABLE caixas ENABLE ROW LEVEL SECURITY;
ALTER TABLE caixa_movimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE notas_fiscais ENABLE ROW LEVEL SECURITY;

-- =============================================
-- FUNÇÃO AUXILIAR: Obter empresa_id do usuário logado
-- =============================================

CREATE OR REPLACE FUNCTION get_user_empresa_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT empresa_id
        FROM usuarios
        WHERE auth_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- FUNÇÃO AUXILIAR: Verificar se usuário é admin
-- =============================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT perfil = 'admin'
        FROM usuarios
        WHERE auth_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- POLÍTICAS: EMPRESAS
-- =============================================

-- Usuários só podem ver sua própria empresa
CREATE POLICY "Usuarios podem ver sua empresa"
    ON empresas FOR SELECT
    USING (id = get_user_empresa_id());

-- Apenas admins podem atualizar dados da empresa
CREATE POLICY "Admins podem atualizar empresa"
    ON empresas FOR UPDATE
    USING (id = get_user_empresa_id() AND is_admin());

-- =============================================
-- POLÍTICAS: USUÁRIOS
-- =============================================

-- Usuários podem ver outros usuários da mesma empresa
CREATE POLICY "Ver usuarios da empresa"
    ON usuarios FOR SELECT
    USING (empresa_id = get_user_empresa_id());

-- Apenas admins podem inserir novos usuários
CREATE POLICY "Admins podem inserir usuarios"
    ON usuarios FOR INSERT
    WITH CHECK (empresa_id = get_user_empresa_id() AND is_admin());

-- Apenas admins podem atualizar usuários
CREATE POLICY "Admins podem atualizar usuarios"
    ON usuarios FOR UPDATE
    USING (empresa_id = get_user_empresa_id() AND is_admin());

-- =============================================
-- POLÍTICAS: PRODUTOS
-- =============================================

CREATE POLICY "Ver produtos da empresa"
    ON produtos FOR SELECT
    USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Inserir produtos"
    ON produtos FOR INSERT
    WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Atualizar produtos"
    ON produtos FOR UPDATE
    USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Deletar produtos"
    ON produtos FOR DELETE
    USING (empresa_id = get_user_empresa_id() AND is_admin());

-- =============================================
-- POLÍTICAS: CLIENTES
-- =============================================

CREATE POLICY "Ver clientes da empresa"
    ON clientes FOR SELECT
    USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Inserir clientes"
    ON clientes FOR INSERT
    WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Atualizar clientes"
    ON clientes FOR UPDATE
    USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Deletar clientes"
    ON clientes FOR DELETE
    USING (empresa_id = get_user_empresa_id() AND is_admin());

-- =============================================
-- POLÍTICAS: FORNECEDORES
-- =============================================

CREATE POLICY "Ver fornecedores da empresa"
    ON fornecedores FOR SELECT
    USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Inserir fornecedores"
    ON fornecedores FOR INSERT
    WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Atualizar fornecedores"
    ON fornecedores FOR UPDATE
    USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Deletar fornecedores"
    ON fornecedores FOR DELETE
    USING (empresa_id = get_user_empresa_id() AND is_admin());

-- =============================================
-- POLÍTICAS: VENDAS
-- =============================================

CREATE POLICY "Ver vendas da empresa"
    ON vendas FOR SELECT
    USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Inserir vendas"
    ON vendas FOR INSERT
    WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Atualizar vendas"
    ON vendas FOR UPDATE
    USING (empresa_id = get_user_empresa_id());

-- =============================================
-- POLÍTICAS: ITENS DA VENDA
-- =============================================

CREATE POLICY "Ver itens de vendas da empresa"
    ON venda_itens FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM vendas
            WHERE vendas.id = venda_itens.venda_id
            AND vendas.empresa_id = get_user_empresa_id()
        )
    );

CREATE POLICY "Inserir itens de venda"
    ON venda_itens FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM vendas
            WHERE vendas.id = venda_itens.venda_id
            AND vendas.empresa_id = get_user_empresa_id()
        )
    );

-- =============================================
-- POLÍTICAS: PAGAMENTOS DA VENDA
-- =============================================

CREATE POLICY "Ver pagamentos de vendas da empresa"
    ON venda_pagamentos FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM vendas
            WHERE vendas.id = venda_pagamentos.venda_id
            AND vendas.empresa_id = get_user_empresa_id()
        )
    );

CREATE POLICY "Inserir pagamentos de venda"
    ON venda_pagamentos FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM vendas
            WHERE vendas.id = venda_pagamentos.venda_id
            AND vendas.empresa_id = get_user_empresa_id()
        )
    );

-- =============================================
-- POLÍTICAS: MOVIMENTAÇÃO DE ESTOQUE
-- =============================================

CREATE POLICY "Ver movimentos de estoque da empresa"
    ON estoque_movimentos FOR SELECT
    USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Inserir movimentos de estoque"
    ON estoque_movimentos FOR INSERT
    WITH CHECK (empresa_id = get_user_empresa_id());

-- =============================================
-- POLÍTICAS: CONTAS A PAGAR
-- =============================================

CREATE POLICY "Ver contas a pagar da empresa"
    ON contas_pagar FOR SELECT
    USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Inserir contas a pagar"
    ON contas_pagar FOR INSERT
    WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Atualizar contas a pagar"
    ON contas_pagar FOR UPDATE
    USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Deletar contas a pagar"
    ON contas_pagar FOR DELETE
    USING (empresa_id = get_user_empresa_id() AND is_admin());

-- =============================================
-- POLÍTICAS: CONTAS A RECEBER
-- =============================================

CREATE POLICY "Ver contas a receber da empresa"
    ON contas_receber FOR SELECT
    USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Inserir contas a receber"
    ON contas_receber FOR INSERT
    WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Atualizar contas a receber"
    ON contas_receber FOR UPDATE
    USING (empresa_id = get_user_empresa_id());

-- =============================================
-- POLÍTICAS: CAIXAS
-- =============================================

CREATE POLICY "Ver caixas da empresa"
    ON caixas FOR SELECT
    USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Inserir caixas"
    ON caixas FOR INSERT
    WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Atualizar caixas"
    ON caixas FOR UPDATE
    USING (empresa_id = get_user_empresa_id());

-- =============================================
-- POLÍTICAS: MOVIMENTAÇÃO DO CAIXA
-- =============================================

CREATE POLICY "Ver movimentos de caixa"
    ON caixa_movimentos FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM caixas
            WHERE caixas.id = caixa_movimentos.caixa_id
            AND caixas.empresa_id = get_user_empresa_id()
        )
    );

CREATE POLICY "Inserir movimentos de caixa"
    ON caixa_movimentos FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM caixas
            WHERE caixas.id = caixa_movimentos.caixa_id
            AND caixas.empresa_id = get_user_empresa_id()
        )
    );

-- =============================================
-- POLÍTICAS: NOTAS FISCAIS
-- =============================================

CREATE POLICY "Ver notas fiscais da empresa"
    ON notas_fiscais FOR SELECT
    USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Inserir notas fiscais"
    ON notas_fiscais FOR INSERT
    WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Atualizar notas fiscais"
    ON notas_fiscais FOR UPDATE
    USING (empresa_id = get_user_empresa_id());
