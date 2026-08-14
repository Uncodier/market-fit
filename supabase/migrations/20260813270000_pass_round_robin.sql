-- Pass redeem assignment: user_choice (buyer picks) vs round_robin (commerce auto-assign).

ALTER TABLE public.catalog_items
  ADD COLUMN IF NOT EXISTS redeem_assignment_mode text NOT NULL DEFAULT 'user_choice';

ALTER TABLE public.catalog_items
  DROP CONSTRAINT IF EXISTS catalog_items_redeem_assignment_mode_check;

ALTER TABLE public.catalog_items
  ADD CONSTRAINT catalog_items_redeem_assignment_mode_check
  CHECK (redeem_assignment_mode = ANY (ARRAY['user_choice'::text, 'round_robin'::text]));

COMMENT ON COLUMN public.catalog_items.redeem_assignment_mode IS
  'For passes: user_choice lets the buyer pick a redeemable service; round_robin auto-assigns in Shop/POS/Marketplace.';

ALTER TABLE public.pass_redeemable_items
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.pass_round_robin_state (
  pass_catalog_item_id uuid NOT NULL,
  site_id uuid NOT NULL,
  next_index integer NOT NULL DEFAULT 0,
  last_member_id uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pass_round_robin_state_pkey PRIMARY KEY (pass_catalog_item_id),
  CONSTRAINT pass_round_robin_state_pass_fkey FOREIGN KEY (pass_catalog_item_id)
    REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  CONSTRAINT pass_round_robin_state_site_fkey FOREIGN KEY (site_id)
    REFERENCES public.sites(id) ON DELETE CASCADE,
  CONSTRAINT pass_round_robin_state_last_member_fkey FOREIGN KEY (last_member_id)
    REFERENCES public.catalog_items(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_pass_round_robin_state_site_id
  ON public.pass_round_robin_state(site_id);

ALTER TABLE public.pass_round_robin_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pass_round_robin_state_unified" ON public.pass_round_robin_state;
CREATE POLICY "pass_round_robin_state_unified" ON public.pass_round_robin_state
FOR ALL
USING (
  current_setting('role', true) = 'service_role' OR
  (auth.jwt() ->> 'role') = 'service_role' OR
  (
    EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = pass_round_robin_state.site_id AND (
        s.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.site_members sm
          WHERE sm.site_id = s.id AND sm.user_id = auth.uid()
        )
      )
    )
  )
);

NOTIFY pgrst, 'reload schema';
