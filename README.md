# Império Sistemas de Alto Nível

Sistema ERP completo para varejo com PDV moderno, controle de estoque, financeiro e emissão fiscal (NFC-e/NF-e).

## Stack

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **UI:** shadcn/ui
- **Backend:** Supabase (PostgreSQL + Auth + Realtime)
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

3. Atualize o arquivo `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
```

### 3. Execute as migrations

No Supabase Dashboard, vá em **SQL Editor** e execute os arquivos na pasta `supabase/migrations/` na ordem:

1. `001_initial_schema.sql` - Cria as tabelas
2. `002_rls_policies.sql` - Configura segurança (RLS)

### 4. Crie o primeiro usuário

1. No Supabase Dashboard, vá em **Authentication > Users**
2. Clique em **Add User** e crie um usuário com email e senha
3. Depois de criar, execute no SQL Editor:

```sql
-- Substitua os valores
INSERT INTO empresas (razao_social, nome_fantasia, cnpj)
VALUES ('SUA EMPRESA LTDA', 'Sua Empresa', '00.000.000/0001-00');

-- Pegue o ID da empresa criada
SELECT id FROM empresas;

-- Crie o usuário vinculado (substitua os IDs)
INSERT INTO usuarios (auth_id, empresa_id, nome, email, perfil)
VALUES (
  'ID_DO_AUTH_USER', -- UUID do usuário no Auth
  'ID_DA_EMPRESA',   -- UUID da empresa
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

## Estrutura do Projeto

```
imperio-sistemas/
├── src/
│   ├── app/                    # Rotas (App Router)
│   │   ├── (auth)/             # Login, recuperar senha
│   │   ├── (dashboard)/        # ERP - retaguarda
│   │   ├── pdv/                # PDV - frente de loja
│   │   └── api/                # API Routes
│   ├── components/
│   │   ├── ui/                 # shadcn/ui
│   │   ├── pdv/                # Componentes do PDV
│   │   └── dashboard/          # Componentes do ERP
│   ├── lib/
│   │   ├── supabase/           # Cliente Supabase
│   │   ├── fiscal/             # Emissão NFC-e/NF-e
│   │   └── utils/              # Utilitários
│   ├── types/                  # TypeScript types
│   └── stores/                 # Zustand stores
├── supabase/
│   └── migrations/             # SQL migrations
└── public/                     # Arquivos estáticos
```

## Módulos

### Implementados (Fase 1)
- [x] Autenticação (login/logout)
- [x] Layout do ERP (sidebar, header)
- [x] Dashboard
- [x] Listagem de produtos
- [x] Cadastro de produtos
- [x] PDV básico (interface)

### Próximas Fases
- [ ] CRUD completo de clientes
- [ ] CRUD de fornecedores
- [ ] Controle de estoque
- [ ] PDV funcional com busca e venda
- [ ] Contas a pagar/receber
- [ ] Fluxo de caixa
- [ ] Emissão NFC-e
- [ ] Emissão NF-e
- [ ] Relatórios e dashboard

## Deploy

### Vercel

1. Conecte o repositório no [Vercel](https://vercel.com)
2. Configure as variáveis de ambiente
3. Deploy automático a cada push

## Licença

Projeto privado - Império Sistemas de Alto Nível
