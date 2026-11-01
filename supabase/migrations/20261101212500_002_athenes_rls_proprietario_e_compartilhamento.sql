-- SPDX-License-Identifier: GPL-3.0-or-later
-- Migração 002: Colunas de Proprietário / Compartilhamento e Política RLS em documentos_athenes

ALTER TABLE public.documentos_athenes
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS proprietario_email TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS compartilhado_com TEXT[] DEFAULT '{}';

ALTER TABLE public.documentos_athenes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'documentos_athenes'
      AND policyname = 'Apenas dono ou convidados acessam'
  ) THEN
    CREATE POLICY "Apenas dono ou convidados acessam"
      ON public.documentos_athenes
      FOR ALL
      USING (
        user_id IS NULL
        OR auth.uid() = user_id
        OR auth.email() = ANY(compartilhado_com)
      )
      WITH CHECK (
        user_id IS NULL
        OR auth.uid() = user_id
        OR auth.email() = ANY(compartilhado_com)
      );
  END IF;
END $$;
