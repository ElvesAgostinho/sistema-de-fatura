# FaturaAO - Sistema de Faturação para Angola

Sistema SaaS completo de faturação pronto para venda comercial, com compliance total à Administração Geral Tributária (AGT) de Angola.

## Funcionalidades

- ✅ **Emissão de Faturas (FT)** com numeração sequencial por série/ano (`FT 2026/0001`)
- ✅ **Hash SHA-256 encadeado (blockchain-style)** em todas as faturas
- ✅ **Faturas imutáveis** após emissão (triggers Postgres)
- ✅ **Cancelamento com motivo obrigatório** (sem apagar dados)
- ✅ **IVA 14%** com opção de isenção e motivo legal
- ✅ **Multi-empresa** com Row Level Security (RLS)
- ✅ **Auditoria completa** de todas as ações
- ✅ **Geração de PDF** profissional estilo Microsoft 365
- ✅ **Validação de integridade** em cada consulta de fatura
- ✅ **PWA instalável** (manifest + service worker)
- ✅ **Autenticação** via Supabase Auth
- ✅ **Upload de logo** via S3/cloud storage
- ✅ **Tipos de documento preparados:** FT, FR, NC, ND, RC (estrutura)

## Setup - PASSO CRÍTICO

**1. Aplicar o schema no Supabase**

Abra o editor SQL do seu projeto Supabase:

> https://supabase.com/dashboard/project/eulbaaiumpizuprxtozq/sql/new

Copie e cole o conteúdo do ficheiro `supabase-setup.sql` e execute. Isto irá:
- Apagar quaisquer tabelas existentes com estes nomes
- Criar as 8 tabelas (`companies`, `users`, `clients`, `products`, `invoice_series`, `invoices`, `invoice_items`, `audit_logs`)
- Criar triggers de imutabilidade de faturas
- Ativar Row Level Security para isolamento multi-empresa
- Criar todas as policies

**2. Variáveis de ambiente (já configuradas)**

O ficheiro `.env` já contém:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AWS_BUCKET_NAME` / `AWS_FOLDER_PREFIX` (cloud storage)
- `ABACUSAI_API_KEY` (para geração de PDFs)

Consulte `.env.example` para a lista completa.

**3. Correr localmente**

```bash
cd nextjs_space
yarn install
yarn dev
```

Abra http://localhost:3000 e crie a sua primeira empresa em `/register`.

## Arquitetura

- **Framework:** Next.js 14 (App Router) + TypeScript
- **UI:** Tailwind CSS com tema Microsoft 365 (Segoe UI, cor #0078D4)
- **Base de dados:** Supabase (Postgres + Auth)
- **Storage:** S3 (Abacus.AI CDN)
- **PDF:** API HTML-to-PDF (Playwright serverless)
- **Hash:** SHA-256 nativo do Node.js

## Compliance AGT Angola

O sistema implementa as seguintes exigências regulamentares:

1. **Numeração sequencial** sem saltos, por série (FT/FR/NC/ND/RC) e ano
2. **Imutabilidade**: faturas emitidas não podem ser editadas nem apagadas (enforced em trigger Postgres)
3. **Cancelamento com motivo**: em vez de apagar, a fatura fica com status `cancelled` e motivo obrigatório (mínimo 5 caracteres)
4. **Moeda AOA** (Kwanza) com 2 casas decimais
5. **Hash SHA-256 encadeado**: cada fatura contém o hash da anterior, criando uma cadeia verificável
6. **Validação de integridade** no momento da consulta
7. **NIF obrigatório** na empresa emitente e no cliente
8. **Auditoria completa** com utilizador, ação, entidade, timestamp
9. **Isenção de IVA** exige motivo legal gravado

## Estrutura de endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/signup` | Criar empresa + utilizador |
| POST | `/api/auth/logout` | Terminar sessão |
| GET | `/api/dashboard` | Estatísticas |
| GET/POST | `/api/invoices` | Listar / Emitir fatura |
| GET | `/api/invoices/[id]` | Detalhe (com validação de hash) |
| POST | `/api/invoices/[id]/cancel` | Cancelar |
| GET | `/api/invoices/[id]/pdf` | Download PDF |
| GET/POST | `/api/clients` | CRUD clientes |
| GET/POST | `/api/products` | CRUD produtos |
| GET/PUT | `/api/company` | Dados da empresa |
| GET | `/api/audit-logs` | Histórico de auditoria |
| POST | `/api/upload/logo` | Upload do logo |

## Tipos de documento AGT suportados

O esquema de BD suporta já os seguintes tipos (basta estender o UI):
- **FT** - Fatura (implementado no UI)
- **FR** - Fatura-Recibo (estrutura pronta)
- **NC** - Nota de Crédito (estrutura pronta)
- **ND** - Nota de Débito (estrutura pronta)
- **RC** - Recibo (estrutura pronta)

A API `POST /api/invoices` aceita `document_type` para emitir qualquer um destes.

## Licença

Pronto para venda comercial. Todo o código pertence ao proprietário deste projeto.
