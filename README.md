# Império Sistemas de Alto Nível

Sistema ERP completo para varejo com PDV moderno, controle de estoque, financeiro e emissão fiscal (NFC-e/NF-e).

## Stack

- **Frontend:** Next.js 16 (App Router) + TypeScript + Tailwind CSS
- **UI:** shadcn/ui + Radix UI
- **Backend:** Next.js API Routes + Supabase (PostgreSQL + Auth + Realtime)
- **Estado:** Zustand + React Query
- **Deploy:** Vercel

## Requisitos

- Node.js 18+
- Conta no [Supabase](https://supabase.com)
- Conta no [Vercel](https://vercel.com) (para deploy)

## Configuração

### 1. Clone e instale as dependências

```bash
cd imperio-sistemas
npm install
```

### 2. Configure o Supabase

1. Crie um projeto no [Supabase Dashboard](https://supabase.com/dashboard)
2. Vá em **Settings > API** e copie:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role key` → `SUPABASE_SERVICE_ROLE_KEY`

3. Crie o arquivo `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
```

### 3. Execute as migrations

No Supabase Dashboard, vá em **SQL Editor** e execute os arquivos na pasta `supabase/migrations/` na ordem numérica (001 a 015).

### 4. Crie o primeiro usuário

1. No Supabase Dashboard, vá em **Authentication > Users**
2. Clique em **Add User** e crie um usuário com email e senha
3. Execute no SQL Editor:

```sql
-- Crie a empresa
INSERT INTO empresas (razao_social, nome_fantasia, cnpj)
VALUES ('SUA EMPRESA LTDA', 'Sua Empresa', '00.000.000/0001-00');

-- Vincule o usuário (substitua os IDs)
INSERT INTO usuarios (auth_id, empresa_id, nome, email, perfil)
VALUES (
  'ID_DO_AUTH_USER',
  'ID_DA_EMPRESA',
  'Seu Nome',
  'seu@email.com',
  'admin'
);
```

### 5. Execute o projeto

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

---

## Módulos Implementados

### Autenticação e Segurança
- [x] Login/Logout com Supabase Auth
- [x] Recuperação de senha
- [x] Controle de acesso por perfil (admin, gerente, caixa, estoque)
- [x] Senha mestre para operações críticas
- [x] Row Level Security (RLS) no banco
- [x] Logs de auditoria
- [x] Logs de erros

### Dashboard
- [x] Visão geral com gráficos
- [x] Indicadores de vendas, faturamento, ticket médio
- [x] Alertas de estoque baixo
- [x] Contas a pagar/receber vencidas
- [x] Sistema de notificações

### Produtos
- [x] Cadastro completo (código, código de barras, NCM, etc.)
- [x] Busca de NCM com autocomplete
- [x] Atualização de NCM em lote
- [x] Importação de produtos via Excel
- [x] Preço de custo e venda
- [x] Estoque atual e mínimo
- [x] Produtos por peso (balança)
- [x] Classificação tributária (IBS/CBS)

### Clientes
- [x] Cadastro completo com endereço
- [x] Busca de CEP automática (ViaCEP)
- [x] Validação de CPF/CNPJ
- [x] Limite de crédito
- [x] Histórico de compras

### Fornecedores
- [x] Cadastro completo
- [x] Busca de CNPJ automática (ReceitaWS)
- [x] Busca de CEP
- [x] Status ativo/inativo

### Estoque
- [x] Entrada de produtos
- [x] Saída de produtos
- [x] Movimentações com histórico
- [x] Importação de XML de NF-e
- [x] Inventário físico
- [x] Contagem cega (até 3 contagens)
- [x] Ajuste automático de divergências

### Financeiro
- [x] Contas a pagar
- [x] Contas a receber
- [x] Fluxo de caixa
- [x] Crediário (fiado)
- [x] Controle de saldo devedor por cliente

### PDV (Ponto de Venda)
- [x] Interface moderna e responsiva
- [x] Busca de produtos por código/nome
- [x] Carrinho de compras
- [x] Múltiplas formas de pagamento
- [x] Pagamento via PIX (QR Code EMV)
- [x] Impressão de cupom
- [x] Abertura/Fechamento de caixa
- [x] Sangria e suprimento
- [x] Venda no crediário

### Fiscal
- [x] Emissão de NFC-e
- [x] Emissão de NF-e
- [x] Integração com SEFAZ
- [x] Gerenciamento de certificado digital
- [x] Geração de DANFE
- [x] Cálculo de ICMS, PIS, COFINS
- [x] Suporte à Reforma Tributária (IBS/CBS)
- [x] Configurações fiscais por empresa

### Fidelidade
- [x] Programa de pontos configurável
- [x] Acúmulo automático em vendas
- [x] Catálogo de produtos para resgate
- [x] Histórico de movimentações

### Configurações
- [x] Dados da empresa
- [x] Busca de CNPJ automática
- [x] Configurações fiscais
- [x] Senha mestre
- [x] Restaurar padrão de fábrica
- [x] Limpar dados cadastrais

### Relatórios
- [x] Dashboard com gráficos
- [x] Vendas por período
- [x] Produtos mais vendidos
- [x] Clientes frequentes

---

## Estrutura do Projeto

```
imperio-sistemas/
├── src/
│   ├── app/                    # Rotas (App Router)
│   │   ├── (auth)/             # Login, recuperar senha
│   │   ├── dashboard/          # ERP - retaguarda
│   │   │   ├── clientes/       # Gestão de clientes
│   │   │   ├── produtos/       # Gestão de produtos
│   │   │   ├── estoque/        # Controle de estoque
│   │   │   ├── fornecedores/   # Gestão de fornecedores
│   │   │   ├── financeiro/     # Contas e fluxo de caixa
│   │   │   ├── fiscal/         # NFC-e, NF-e
│   │   │   ├── fidelidade/     # Programa de pontos
│   │   │   ├── configuracoes/  # Configurações do sistema
│   │   │   └── relatorios/     # Relatórios
│   │   ├── pdv/                # PDV - frente de loja
│   │   └── api/                # API Routes
│   ├── components/
│   │   ├── ui/                 # shadcn/ui
│   │   ├── pdv/                # Componentes do PDV
│   │   └── dashboard/          # Componentes do ERP
│   ├── lib/
│   │   ├── supabase/           # Cliente Supabase
│   │   ├── fiscal/             # Emissão NFC-e/NF-e
│   │   ├── utils/              # Utilitários
│   │   └── offline/            # Suporte offline
│   ├── stores/                 # Zustand stores
│   ├── hooks/                  # Custom hooks
│   └── data/                   # Dados estáticos (NCMs)
├── supabase/
│   └── migrations/             # SQL migrations (001-015)
└── public/                     # Arquivos estáticos
```

---

## Migrations

| # | Arquivo | Descrição |
|---|---------|-----------|
| 001 | initial_schema.sql | Tabelas principais (empresas, usuários, produtos, vendas, etc.) |
| 002 | rls_policies.sql | Políticas de segurança (RLS) |
| 003 | fiscal_updates.sql | Campos fiscais adicionais |
| 004 | crediario.sql | Sistema de crediário/fiado |
| 005 | fidelidade.sql | Programa de fidelidade |
| 006 | notificacoes.sql | Sistema de notificações |
| 007 | inventario.sql | Inventário físico |
| 008 | notificacoes.sql | Notificações adicionais |
| 009 | produtos_teste_peso.sql | Produtos por peso |
| 010 | reforma_tributaria_ibs_cbs.sql | Reforma Tributária 2025 |
| 011 | delete_policies.sql | Políticas de exclusão |
| 012 | senha_mestre.sql | Senha mestre |
| 013 | logs_auditoria.sql | Logs de auditoria |
| 014 | logs_erros.sql | Logs de erros |
| 015 | cnpj_nullable.sql | CNPJ opcional |

---

## APIs Externas Integradas

| API | Uso |
|-----|-----|
| ViaCEP | Busca de endereço por CEP |
| ReceitaWS | Consulta de dados por CNPJ |
| SEFAZ | Emissão de NFC-e e NF-e |

---

## Deploy

### Vercel

1. Conecte o repositório no [Vercel](https://vercel.com)
2. Configure as variáveis de ambiente:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Deploy automático a cada push

---

## Perfis de Usuário

| Perfil | Permissões |
|--------|------------|
| admin | Acesso total ao sistema |
| gerente | Dashboard, vendas, estoque, relatórios |
| caixa | PDV, abertura/fechamento de caixa |
| estoque | Entrada/saída de produtos, inventário |

---

## Licença

Projeto privado - Império Sistemas de Alto Nível
