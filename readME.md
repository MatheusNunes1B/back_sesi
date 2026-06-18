# SESI Leitura — Backend Serverless (Vercel)

## Estrutura das rotas

| Método | Rota                      | Descrição                                   | Auth? |
|--------|---------------------------|---------------------------------------------|-------|
| POST   | `/api/auth/login`         | Login por RM ou e-mail institucional        | ❌    |
| POST   | `/api/auth/register`      | Cadastro de aluno                           | ❌    |
| POST   | `/api/leitura/registrar`  | Registrar minutos lidos (limite: 16/dia)    | ✅    |
| GET    | `/api/leitura/progresso`  | Progresso do aluno (semana/mês)             | ✅    |
| GET    | `/api/ranking?tipo=turmas`| Ranking de minutos por turma                | ✅    |
| GET    | `/api/ranking?tipo=escola`| Termômetro geral da escola                  | ✅    |

---

## Como fazer o deploy

### 1. Pré-requisitos
- Conta no [Vercel](https://vercel.com)
- Projeto criado no [Supabase](https://supabase.com)

### 2. Variáveis de ambiente

No painel do Vercel → **Settings → Environment Variables**, adicione:

| Nome                        | Onde encontrar no Supabase                          |
|-----------------------------|-----------------------------------------------------|
| `SUPABASE_URL`              | Settings → API → Project URL                        |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → service_role (⚠️ nunca expor)     |
| `SUPABASE_ANON_KEY`         | Settings → API → anon/public                        |

> ⚠️ A `SERVICE_ROLE_KEY` só deve existir no backend (Vercel). Nunca coloque no código do frontend.

### 3. Deploy

```bash
npm install
npm run deploy
```

Ou conecte o repositório GitHub ao Vercel para deploy automático a cada push.

---

## Tabelas necessárias no Supabase

Execute o SQL abaixo no **SQL Editor** do Supabase:

```sql
-- Perfis dos alunos (complementa o auth.users)
CREATE TABLE alunos (
  id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rm        TEXT UNIQUE NOT NULL,
  nome      TEXT NOT NULL,
  turma     TEXT NOT NULL,
  ano       TEXT NOT NULL,
  email     TEXT UNIQUE NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Registros diários de leitura
CREATE TABLE registros_leitura (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id  UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  minutos   INT NOT NULL CHECK (minutos > 0 AND minutos <= 16),
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para consultas de progresso por dia
CREATE INDEX idx_registros_aluno_data
  ON registros_leitura (aluno_id, criado_em);

-- RLS: aluno só vê/edita os próprios registros
ALTER TABLE registros_leitura ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aluno lê próprios registros"
  ON registros_leitura FOR SELECT
  USING (auth.uid() = aluno_id);

-- O backend usa service_role, então o INSERT/SELECT irrestrito é seguro via API
```

---

## Testando localmente

```bash
npm install
npm run dev
# Acesse: http://localhost:3000
```

O `vercel dev` replica o ambiente serverless localmente.

---

## Regra dos 16 minutos/dia

A validação ocorre **em dois lugares**:

1. **Frontend (`/public/js/db.js`)** — bloqueia antes de chamar a API (UX rápida).
2. **Backend (`/api/leitura/registrar.js`)** — revalida no servidor mesmo que o JS do browser seja burlado.

Resposta quando o limite é atingido:
```json
{
  "error": "Você já leu 10 min hoje. Você pode registrar no máximo 6 min a mais.",
  "totalHoje": 10,
  "restante": 6,
  "limite": 16
}
```
