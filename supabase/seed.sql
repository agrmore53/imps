-- =============================================
-- IMPÉRIO SISTEMAS DE ALTO NÍVEL
-- Seed: Dados iniciais para teste
-- =============================================

-- Nota: Este arquivo é para desenvolvimento local
-- Em produção, a empresa e usuário inicial são criados via aplicação

-- Exemplo de empresa para testes (descomente se necessário)
/*
INSERT INTO empresas (
    id,
    razao_social,
    nome_fantasia,
    cnpj,
    ie,
    endereco,
    telefone,
    email
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'IMPÉRIO SISTEMAS LTDA',
    'Império Sistemas',
    '12.345.678/0001-90',
    '123.456.789',
    '{"logradouro": "Rua Exemplo", "numero": "123", "bairro": "Centro", "cidade": "Florianópolis", "uf": "SC", "cep": "88000-000"}',
    '(48) 99999-9999',
    'contato@imperio.com.br'
);
*/

-- Produtos de exemplo (descomente se necessário)
/*
INSERT INTO produtos (empresa_id, codigo, codigo_barras, nome, preco_venda, estoque_atual, ncm, unidade) VALUES
('00000000-0000-0000-0000-000000000001', '001', '7891234567890', 'Coca-Cola 350ml', 5.50, 100, '22021000', 'UN'),
('00000000-0000-0000-0000-000000000001', '002', '7891234567891', 'Coca-Cola 2L', 12.00, 50, '22021000', 'UN'),
('00000000-0000-0000-0000-000000000001', '003', '7891234567892', 'Água Mineral 500ml', 2.50, 200, '22011000', 'UN'),
('00000000-0000-0000-0000-000000000001', '004', '7891234567893', 'Pão Francês', 0.80, 500, '19059090', 'UN'),
('00000000-0000-0000-0000-000000000001', '005', '7891234567894', 'Leite Integral 1L', 6.50, 80, '04011010', 'UN');
*/
