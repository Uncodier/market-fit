-- Idempotency ledger for local-first POS outbox sync

CREATE TABLE IF NOT EXISTS public.pos_client_mutations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  client_mutation_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('checkout', 'check_in', 'create_lead')),
  sale_id uuid NULL,
  order_id uuid NULL,
  lead_id uuid NULL,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, client_mutation_id)
);

CREATE INDEX IF NOT EXISTS idx_pos_client_mutations_site
  ON public.pos_client_mutations (site_id);

ALTER TABLE public.pos_client_mutations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pos_client_mutations'
      AND policyname = 'pos_client_mutations_member_all'
  ) THEN
    CREATE POLICY pos_client_mutations_member_all
      ON public.pos_client_mutations
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.site_members sm
          WHERE sm.site_id = pos_client_mutations.site_id
            AND sm.user_id = auth.uid()
            AND sm.status = 'active'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.site_members sm
          WHERE sm.site_id = pos_client_mutations.site_id
            AND sm.user_id = auth.uid()
            AND sm.status = 'active'
        )
      );
  END IF;
END $$;
