-- ================================================================
-- SESI Leitura — Setup do Banco de Dados (Supabase / PostgreSQL)
-- Execute este script no SQL Editor do seu projeto Supabase.
-- ================================================================

-- ── Extensões ────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Escolas ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.escolas (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome       TEXT NOT NULL,
  cidade     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Perfis (um por usuário do Supabase Auth) ─────────────────────
-- Criado automaticamente via trigger quando o usuário se registra.
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  rm            TEXT UNIQUE,                        -- matrícula do aluno (null para responsáveis)
  role          TEXT NOT NULL DEFAULT 'aluno'
                  CHECK (role IN ('aluno', 'responsavel', 'admin')),
  turma         TEXT,                               -- ex: "7A", "9B"
  escola_id     UUID REFERENCES public.escolas(id),
  avatar_emoji  TEXT DEFAULT '🧒',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Índices úteis ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_rm       ON public.profiles(rm);
CREATE INDEX IF NOT EXISTS idx_profiles_escola   ON public.profiles(escola_id);
CREATE INDEX IF NOT EXISTS idx_profiles_turma    ON public.profiles(turma);

-- ── Trigger: atualiza updated_at ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profiles_updated ON public.profiles;
CREATE TRIGGER on_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── Trigger: cria perfil vazio ao registrar usuário ──────────────
-- (Útil quando o cadastro for feito pelo painel do Supabase ou admin)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'aluno')
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
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escolas  ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode ler escolas
CREATE POLICY "escolas_select" ON public.escolas
  FOR SELECT TO authenticated USING (true);

-- Usuário só lê o próprio perfil (ou admin vê todos)
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Usuário só atualiza o próprio perfil
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- ── Dados iniciais de exemplo ─────────────────────────────────────
-- (Remova ou ajuste conforme necessário)
INSERT INTO public.escolas (nome, cidade)
VALUES ('SESI Escola SP 001', 'São Paulo')
ON CONFLICT DO NOTHING;

-- ================================================================
-- FIM — Próximos passos:
-- 1. Copie a URL e a anon key do projeto em Settings > API
-- 2. Cole em public/js/supabase.js e no arquivo .env
-- 3. Crie usuários pelo painel Supabase > Authentication > Users
--    usando o e-mail rm<NÚMERO>@sesi.internal e uma senha
-- ================================================================