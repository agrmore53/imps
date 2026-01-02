-- =============================================
-- IMPÉRIO SISTEMAS DE ALTO NÍVEL
-- Migration 001: Initial Schema
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- TIPOS ENUMERADOS
-- =============================================

CREATE TYPE perfil_usuario AS ENUM ('admin', 'gerente', 'caixa', 'estoque');
CREATE TYPE tipo_pessoa AS ENUM ('PF', 'PJ');
CREATE TYPE status_venda AS ENUM ('pendente', 'finalizada', 'cancelada');
CREATE TYPE tipo_documento AS ENUM ('nfce', 'nfe', 'sem_nota');
CREATE TYPE forma_pagamento AS ENUM ('dinheiro', 'cartao_credito', 'cartao_debito', 'pix', 'crediario');
CREATE TYPE tipo_movimento_estoque AS ENUM ('entrada', 'saida', 'ajuste');
CREATE TYPE status_conta AS ENUM ('pendente', 'pago', 'cancelado');
CREATE TYPE status_recebimento AS ENUM ('pendente', 'recebido', 'cancelado');
CREATE TYPE status_caixa AS ENUM ('aberto', 'fechado');
CREATE TYPE tipo_movimento_caixa AS ENUM ('entrada', 'saida', 'sangria', 'suprimento');
CREATE TYPE tipo_nota_fiscal AS ENUM ('nfce', 'nfe');
CREATE TYPE status_nota_fiscal AS ENUM ('pendente', 'autorizada', 'cancelada', 'rejeitada');

-- =============================================
-- TABELA: EMPRESAS
-- =============================================

CREATE TABLE empresas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    razao_social VARCHAR(255) NOT NULL,
    nome_fantasia VARCHAR(255) NOT NULL,
    cnpj VARCHAR(18) UNIQUE NOT NULL,
    ie VARCHAR(20),
    endereco JSONB DEFAULT '{}',
    telefone VARCHAR(20),
    email VARCHAR(255),
    logo_url TEXT,
    certificado_digital TEXT,
    config_fiscal JSONB DEFAULT '{
        "ambiente": "homologacao",
        "serie_nfce": "1",
        "serie_nfe": "1",
        "proximo_numero_nfce": 1,
        "proximo_numero_nfe": 1,
        "csc_id": "",
        "csc_token": ""
    }',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TABELA: USUÁRIOS
-- =============================================

CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    perfil perfil_usuario DEFAULT 'caixa',
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_usuarios_empresa ON usuarios(empresa_id);
CREATE INDEX idx_usuarios_auth ON usuarios(auth_id);

-- =============================================
-- TABELA: PRODUTOS
-- =============================================

CREATE TABLE produtos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    codigo VARCHAR(50) NOT NULL,
    codigo_barras VARCHAR(50),
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    ncm VARCHAR(10),
    cest VARCHAR(10),
    cfop VARCHAR(10) DEFAULT '5102',
    unidade VARCHAR(10) DEFAULT 'UN',
    preco_custo DECIMAL(15, 2) DEFAULT 0,
    preco_venda DECIMAL(15, 2) NOT NULL,
    margem DECIMAL(5, 2),
    estoque_atual DECIMAL(15, 3) DEFAULT 0,
    estoque_minimo DECIMAL(15, 3) DEFAULT 0,
    icms_cst VARCHAR(5) DEFAULT '00',
    icms_aliquota DECIMAL(5, 2) DEFAULT 0,
    pis_cst VARCHAR(5) DEFAULT '01',
    cofins_cst VARCHAR(5) DEFAULT '01',
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(empresa_id, codigo)
);

CREATE INDEX idx_produtos_empresa ON produtos(empresa_id);
CREATE INDEX idx_produtos_codigo_barras ON produtos(codigo_barras);
CREATE INDEX idx_produtos_nome ON produtos(nome);

-- =============================================
-- TABELA: CLIENTES
-- =============================================

CREATE TABLE clientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    tipo_pessoa tipo_pessoa DEFAULT 'PF',
    cpf_cnpj VARCHAR(18) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    telefone VARCHAR(20),
    endereco JSONB DEFAULT '{}',
    limite_credito DECIMAL(15, 2) DEFAULT 0,
    saldo_devedor DECIMAL(15, 2) DEFAULT 0,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(empresa_id, cpf_cnpj)
);

CREATE INDEX idx_clientes_empresa ON clientes(empresa_id);
CREATE INDEX idx_clientes_cpf_cnpj ON clientes(cpf_cnpj);

-- =============================================
-- TABELA: FORNECEDORES
-- =============================================

CREATE TABLE fornecedores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    cpf_cnpj VARCHAR(18) NOT NULL,
    razao_social VARCHAR(255) NOT NULL,
    nome_fantasia VARCHAR(255),
    contato VARCHAR(255),
    telefone VARCHAR(20),
    email VARCHAR(255),
    endereco JSONB DEFAULT '{}',
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(empresa_id, cpf_cnpj)
);

CREATE INDEX idx_fornecedores_empresa ON fornecedores(empresa_id);

-- =============================================
-- TABELA: CAIXAS
-- =============================================

CREATE TABLE caixas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    data_abertura TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    valor_abertura DECIMAL(15, 2) DEFAULT 0,
    data_fechamento TIMESTAMP WITH TIME ZONE,
    valor_fechamento DECIMAL(15, 2),
    status status_caixa DEFAULT 'aberto',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_caixas_empresa ON caixas(empresa_id);
CREATE INDEX idx_caixas_usuario ON caixas(usuario_id);
CREATE INDEX idx_caixas_status ON caixas(status);

-- =============================================
-- TABELA: VENDAS
-- =============================================

CREATE TABLE vendas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    numero SERIAL,
    data_hora TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    cliente_id UUID REFERENCES clientes(id),
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    caixa_id UUID REFERENCES caixas(id),
    subtotal DECIMAL(15, 2) DEFAULT 0,
    desconto DECIMAL(15, 2) DEFAULT 0,
    total DECIMAL(15, 2) DEFAULT 0,
    status status_venda DEFAULT 'pendente',
    tipo_documento tipo_documento DEFAULT 'sem_nota',
    chave_nfce VARCHAR(50),
    observacao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_vendas_empresa ON vendas(empresa_id);
CREATE INDEX idx_vendas_cliente ON vendas(cliente_id);
CREATE INDEX idx_vendas_usuario ON vendas(usuario_id);
CREATE INDEX idx_vendas_data ON vendas(data_hora);
CREATE INDEX idx_vendas_status ON vendas(status);

-- =============================================
-- TABELA: ITENS DA VENDA
-- =============================================

CREATE TABLE venda_itens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venda_id UUID NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
    produto_id UUID NOT NULL REFERENCES produtos(id),
    quantidade DECIMAL(15, 3) NOT NULL,
    preco_unitario DECIMAL(15, 2) NOT NULL,
    desconto DECIMAL(15, 2) DEFAULT 0,
    total DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_venda_itens_venda ON venda_itens(venda_id);
CREATE INDEX idx_venda_itens_produto ON venda_itens(produto_id);

-- =============================================
-- TABELA: PAGAMENTOS DA VENDA
-- =============================================

CREATE TABLE venda_pagamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venda_id UUID NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
    forma_pagamento forma_pagamento NOT NULL,
    valor DECIMAL(15, 2) NOT NULL,
    bandeira VARCHAR(50),
    nsu VARCHAR(50),
    autorizacao VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_venda_pagamentos_venda ON venda_pagamentos(venda_id);

-- =============================================
-- TABELA: MOVIMENTAÇÃO DE ESTOQUE
-- =============================================

CREATE TABLE estoque_movimentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    produto_id UUID NOT NULL REFERENCES produtos(id),
    tipo tipo_movimento_estoque NOT NULL,
    quantidade DECIMAL(15, 3) NOT NULL,
    custo_unitario DECIMAL(15, 2),
    documento_origem VARCHAR(100),
    observacao TEXT,
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    data_hora TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_estoque_movimentos_empresa ON estoque_movimentos(empresa_id);
CREATE INDEX idx_estoque_movimentos_produto ON estoque_movimentos(produto_id);
CREATE INDEX idx_estoque_movimentos_data ON estoque_movimentos(data_hora);

-- =============================================
-- TABELA: CONTAS A PAGAR
-- =============================================

CREATE TABLE contas_pagar (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    fornecedor_id UUID REFERENCES fornecedores(id),
    descricao VARCHAR(255) NOT NULL,
    valor DECIMAL(15, 2) NOT NULL,
    vencimento DATE NOT NULL,
    pagamento_data DATE,
    status status_conta DEFAULT 'pendente',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_contas_pagar_empresa ON contas_pagar(empresa_id);
CREATE INDEX idx_contas_pagar_vencimento ON contas_pagar(vencimento);
CREATE INDEX idx_contas_pagar_status ON contas_pagar(status);

-- =============================================
-- TABELA: CONTAS A RECEBER
-- =============================================

CREATE TABLE contas_receber (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES clientes(id),
    venda_id UUID REFERENCES vendas(id),
    parcela INTEGER DEFAULT 1,
    valor DECIMAL(15, 2) NOT NULL,
    vencimento DATE NOT NULL,
    recebimento_data DATE,
    status status_recebimento DEFAULT 'pendente',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_contas_receber_empresa ON contas_receber(empresa_id);
CREATE INDEX idx_contas_receber_vencimento ON contas_receber(vencimento);
CREATE INDEX idx_contas_receber_status ON contas_receber(status);

-- =============================================
-- TABELA: MOVIMENTAÇÃO DO CAIXA
-- =============================================

CREATE TABLE caixa_movimentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    caixa_id UUID NOT NULL REFERENCES caixas(id) ON DELETE CASCADE,
    tipo tipo_movimento_caixa NOT NULL,
    valor DECIMAL(15, 2) NOT NULL,
    descricao TEXT,
    venda_id UUID REFERENCES vendas(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_caixa_movimentos_caixa ON caixa_movimentos(caixa_id);

-- =============================================
-- TABELA: NOTAS FISCAIS
-- =============================================

CREATE TABLE notas_fiscais (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    venda_id UUID REFERENCES vendas(id),
    tipo tipo_nota_fiscal NOT NULL,
    serie VARCHAR(5) NOT NULL,
    numero INTEGER NOT NULL,
    chave VARCHAR(50),
    protocolo VARCHAR(50),
    xml TEXT,
    status status_nota_fiscal DEFAULT 'pendente',
    motivo_rejeicao TEXT,
    emitida_em TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notas_fiscais_empresa ON notas_fiscais(empresa_id);
CREATE INDEX idx_notas_fiscais_venda ON notas_fiscais(venda_id);
CREATE INDEX idx_notas_fiscais_chave ON notas_fiscais(chave);

-- =============================================
-- TRIGGERS: UPDATED_AT
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_empresas_updated_at
    BEFORE UPDATE ON empresas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_usuarios_updated_at
    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_produtos_updated_at
    BEFORE UPDATE ON produtos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_clientes_updated_at
    BEFORE UPDATE ON clientes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_fornecedores_updated_at
    BEFORE UPDATE ON fornecedores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_vendas_updated_at
    BEFORE UPDATE ON vendas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_caixas_updated_at
    BEFORE UPDATE ON caixas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_contas_pagar_updated_at
    BEFORE UPDATE ON contas_pagar
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_contas_receber_updated_at
    BEFORE UPDATE ON contas_receber
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_notas_fiscais_updated_at
    BEFORE UPDATE ON notas_fiscais
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- TRIGGER: BAIXA AUTOMÁTICA DE ESTOQUE
-- =============================================

CREATE OR REPLACE FUNCTION baixar_estoque_venda()
RETURNS TRIGGER AS $$
BEGIN
    -- Reduz o estoque do produto
    UPDATE produtos
    SET estoque_atual = estoque_atual - NEW.quantidade
    WHERE id = NEW.produto_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_baixar_estoque
    AFTER INSERT ON venda_itens
    FOR EACH ROW EXECUTE FUNCTION baixar_estoque_venda();

-- =============================================
-- TRIGGER: CALCULAR TOTAL DO ITEM
-- =============================================

CREATE OR REPLACE FUNCTION calcular_total_item()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total = (NEW.quantidade * NEW.preco_unitario) - NEW.desconto;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_calcular_total_item
    BEFORE INSERT OR UPDATE ON venda_itens
    FOR EACH ROW EXECUTE FUNCTION calcular_total_item();

-- =============================================
-- TRIGGER: CALCULAR MARGEM DO PRODUTO
-- =============================================

CREATE OR REPLACE FUNCTION calcular_margem_produto()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.preco_custo > 0 THEN
        NEW.margem = ((NEW.preco_venda - NEW.preco_custo) / NEW.preco_custo) * 100;
    ELSE
        NEW.margem = 0;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_calcular_margem
    BEFORE INSERT OR UPDATE ON produtos
    FOR EACH ROW EXECUTE FUNCTION calcular_margem_produto();
