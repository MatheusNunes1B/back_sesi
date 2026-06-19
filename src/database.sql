-- ================================================================
-- SESI Leitura — Setup do Banco de Dados (Supabase / PostgreSQL)
-- Execute este script no SQL Editor do seu projeto Supabase.
-- ================================================================

-- ── Extensões ────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Alunos / Perfis ──────────────────────────────────────────────
-- Substituímos "profiles" por "alunos", pois o back-end (register.js) 
-- e o front-end (auth.js) esperam ler/escrever na tabela "alunos".
CREATE TABLE IF NOT EXISTS public.alunos (
  id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rm        TEXT UNIQUE,
  nome      TEXT NOT NULL,
  turma     TEXT,
  ano       TEXT,
  email     TEXT UNIQUE NOT NULL,
  role      TEXT NOT NULL DEFAULT 'aluno'
              CHECK (role IN ('aluno', 'professor', 'responsavel', 'admin')),
  avatar    TEXT DEFAULT '🧒',
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Registros de Leitura ─────────────────────────────────────────
-- Faltava essa tabela que é usada em `/api/leitura/registrar.js`
CREATE TABLE IF NOT EXISTS public.registros_leitura (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id  UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  minutos   INT NOT NULL CHECK (minutos > 0 AND minutos <= 16),
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ── Índices úteis ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_alunos_rm ON public.alunos(rm);
CREATE INDEX IF NOT EXISTS idx_registros_aluno_data ON public.registros_leitura(aluno_id, criado_em);

-- ── Trigger: atualiza updated_at ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_alunos_updated ON public.alunos;
CREATE TRIGGER on_alunos_updated
  BEFORE UPDATE ON public.alunos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── Trigger: cria perfil vazio ao registrar usuário ──────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.alunos (id, email, nome, role, rm, turma, ano)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'full_name', 'Usuário'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'aluno'),
    NEW.raw_user_meta_data->>'rm',
    NEW.raw_user_meta_data->>'turma',
    NEW.raw_user_meta_data->>'ano'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── RLS (Row Level Security) ─────────────────────────────────────
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros_leitura ENABLE ROW LEVEL SECURITY;

-- Usuário só lê o próprio perfil (ou admin vê todos)
CREATE POLICY "alunos_select_own" ON public.alunos
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.alunos p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Usuário só atualiza o próprio perfil
CREATE POLICY "alunos_update_own" ON public.alunos
  FOR UPDATE TO authenticated
  USING (id = auth.uid());

CREATE POLICY "aluno_le_proprios_registros" ON public.registros_leitura
  FOR SELECT TO authenticated
  USING (auth.uid() = aluno_id);

CREATE POLICY "aluno_insere_proprios_registros" ON public.registros_leitura
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = aluno_id);

-- ================================================================
-- INSERÇÃO DE USUÁRIOS DE TESTE (login.js)
-- ================================================================
DO $$
DECLARE
  uid_aluno UUID := gen_random_uuid();
  uid_prof UUID := gen_random_uuid();
  uid_resp UUID := gen_random_uuid();
BEGIN
  -- 1. Aluno: rm 123456 / senha: aluno@123
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = '123456@aluno.sesi.sp.br') THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
      uid_aluno, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      '123456@aluno.sesi.sp.br', crypt('aluno@123', gen_salt('bf')), NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"role":"aluno","nome":"Aluno Teste","rm":"123456","turma":"7A"}',
      NOW(), NOW()
    );
  END IF;

  -- 2. Professor: prof@sesi.sp.br / prof@123
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'prof@sesi.sp.br') THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
      uid_prof, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'prof@sesi.sp.br', crypt('prof@123', gen_salt('bf')), NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"role":"professor","nome":"Professor Teste"}',
      NOW(), NOW()
    );
  END IF;

  -- 3. Responsável: responsavel@email.com / resp@123
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'responsavel@email.com') THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
      uid_resp, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'responsavel@email.com', crypt('resp@123', gen_salt('bf')), NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"role":"responsavel","nome":"Responsável Teste"}',
      NOW(), NOW()
    );
  END IF;
END
$$;