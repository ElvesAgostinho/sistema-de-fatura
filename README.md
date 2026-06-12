# FaturaAO — Sistema de Faturação para Angola 🇦🇴

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E?logo=supabase)](https://supabase.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://typescriptlang.org)
[![AGT Compliant](https://img.shields.io/badge/AGT-Compliant-green)](https://agt.minfin.gov.ao)

**SaaS de faturação empresarial construído especificamente para o mercado angolano.** Compliance total com a Administração Geral Tributária (AGT), hash SHA-256 encadeado, multi-empresa com RLS e PDFs profissionais em segundos.

---

## ✨ Funcionalidades

### Documentos Fiscais AGT
- 📄 **FT** (Fatura), **FR** (Fatura-Recibo), **NC** (Nota de Crédito), **ND** (Nota de Débito), **RC** (Recibo), **PP** (Proposta de Preço), **GT** (Guia de Transporte)
- 🔢 Numeração sequencial por série e ano (`FT 2026/0001`)
- 🔐 Hash SHA-256 encadeado (blockchain-style) em cada documento
- 🔒 Imutabilidade total via triggers PL/pgSQL
- 📋 IVA 14% com suporte a isenção justificada

### Plataforma SaaS
- 🏢 **Multi-empresa** com isolamento 100% por Row Level Security
- 👥 **Gestão de utilizadores** com roles (Admin, Editor, Caixa)
- ✅ **Fluxo de aprovação** — novos registos aguardam aprovação do super-admin
- 📊 **Dashboard** em tempo real (receita, IVA, faturas pendentes)
- 📦 **Gestão de stocks** com movimentos automáticos por venda
- 🔄 **Faturas recorrentes** (assinaturas e contratos)
- 🧾 **POS** (Ponto de Venda) com fecho de caixa
- 🔗 **Integração ERP** via REST API

### Exportação & Auditoria
- 📁 **SAF-T Angola** — exportação pronta para submissão à AGT
- 🖨️ **PDFs profissionais** com logótipo, NIF, QR Code e hash
- 📝 **Auditoria completa** de todas as operações
- 📧 Envio de faturas por email (Resend)

### Técnico
- ⚡ **Next.js 14** App Router + TypeScript
- 🔐 **Supabase Auth** + Row Level Security
- 🚦 **Rate Limiting** (Upstash Redis) — protecção contra força bruta
- 📱 **PWA instalável** (funciona offline)
- 🛡️ Headers de segurança: CSP, HSTS, X-Frame-Options
- 🐳 **Docker** pronto (`Dockerfile` + `.dockerignore`)

---

## 🚀 Deploy Rápido

### Pré-requisitos
- Node.js 18+
- Conta [Supabase](https://supabase.com) (gratuita)

### 1. Clonar e instalar
```bash
git clone https://github.com/ElvesAgostinho/sistema-de-fatura.git
cd sistema-de-fatura
npm install
```

### 2. Configurar variáveis de ambiente
```bash
cp .env.example .env.local
```

Preencher em `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPER_ADMIN_EMAIL=admin@empresa.ao
```

> Obter as chaves em: Supabase Dashboard → Settings → API

### 3. Aplicar o schema da base de dados
No editor SQL do Supabase, executar o conteúdo de `supabase-setup.sql`.

### 4. Correr localmente
```bash
npm run dev
```
Abrir [http://localhost:3000](http://localhost:3000)

---

## 🐳 Deploy com Docker

```bash
docker build -t faturaao .
docker run -p 3000:3000 --env-file .env.local faturaao
```

---

## 🏗️ Arquitectura

```
angola-billing-system/
├── app/                    # Next.js App Router
│   ├── (app)/              # Área autenticada (dashboard, faturas, etc.)
│   ├── api/                # REST API (21 grupos de endpoints)
│   ├── login/              # Login
│   ├── register/           # Registo de nova empresa
│   └── page.tsx            # Landing page pública
├── components/
│   ├── views/              # Páginas completas (dashboard, faturas, etc.)
│   └── ui/                 # Componentes reutilizáveis
├── lib/
│   ├── supabase/           # Clientes Supabase (browser, server, middleware)
│   ├── hash.ts             # SHA-256 encadeado
│   ├── invoice-pdf.ts      # Geração de PDFs
│   └── saft.ts             # Exportação SAF-T Angola
├── middleware.ts           # Auth, CORS, Rate Limiting
└── supabase-setup.sql      # Schema completo da BD
```

---

## 📋 API Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/signup` | Criar empresa + utilizador (aguarda aprovação) |
| `POST` | `/api/auth/logout` | Terminar sessão |
| `GET` | `/api/dashboard` | Estatísticas do dashboard |
| `GET/POST` | `/api/invoices` | Listar / Emitir documento fiscal |
| `GET` | `/api/invoices/[id]` | Detalhe com validação de hash |
| `POST` | `/api/invoices/[id]/cancel` | Cancelar com motivo |
| `GET` | `/api/invoices/[id]/pdf` | Download PDF |
| `GET/POST` | `/api/clients` | CRUD clientes |
| `GET/POST` | `/api/products` | CRUD produtos/serviços |
| `GET/POST` | `/api/suppliers` | CRUD fornecedores |
| `GET/POST` | `/api/purchases` | Compras / notas de entrada |
| `GET/PUT` | `/api/company` | Dados da empresa e utilizadores |
| `GET` | `/api/audit-logs` | Histórico de auditoria |
| `GET` | `/api/fiscal-config` | Configuração e certificação AGT |
| `POST` | `/api/fiscal-config/saft` | Exportar SAF-T |
| `GET` | `/api/admin/approvals` | Aprovar/rejeitar novas empresas |

---

## 🔒 Compliance AGT Angola

| Requisito | Implementação |
|-----------|---------------|
| Numeração sequencial | Trigger Postgres sem saltos, por série/ano |
| Imutabilidade | Trigger PL/pgSQL bloqueia UPDATE/DELETE |
| Hash encadeado | SHA-256 do conteúdo + hash anterior |
| Cancelamento com motivo | Status `cancelled` + motivo ≥ 5 caracteres |
| IVA 14% / Isenção | Campo `vat_exemption_reason` obrigatório se isento |
| NIF obrigatório | Validação na empresa e no cliente |
| SAF-T | Exportação completa pronta para AGT |
| Auditoria | Registo de todas as operações com utilizador e timestamp |

---

## 💼 Licença

© 2026 FaturaAO — Todos os direitos reservados.  
Sistema pronto para venda comercial e licenciamento SaaS.
