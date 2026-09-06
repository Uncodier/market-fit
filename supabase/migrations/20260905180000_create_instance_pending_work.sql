-- Pending commands wait here until the instance is idle. They must not appear in chat.

CREATE TABLE IF NOT EXISTS public.instance_pending_work (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.remote_instances(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  message text NOT NULL,
  activity text NOT NULL DEFAULT 'ask',
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  system_prompt text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  CONSTRAINT instance_pending_work_status_check
    CHECK (status = ANY (ARRAY['pending'::text, 'claimed'::text, 'sent'::text, 'cancelled'::text]))
);

COMMENT ON TABLE public.instance_pending_work IS
  'Queued user commands waiting for the instance to become idle before starting the assistant workflow';

CREATE INDEX IF NOT EXISTS idx_instance_pending_work_instance_status_created
  ON public.instance_pending_work USING btree (instance_id, status, created_at);

ALTER TABLE public.instance_pending_work ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS instance_pending_work_access_policy ON public.instance_pending_work;

CREATE POLICY instance_pending_work_access_policy
  ON public.instance_pending_work
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.site_ownership
      WHERE site_ownership.site_id = instance_pending_work.site_id
        AND site_ownership.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.site_members
      WHERE site_members.site_id = instance_pending_work.site_id
        AND site_members.user_id = (SELECT auth.uid())
        AND site_members.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.site_ownership
      WHERE site_ownership.site_id = instance_pending_work.site_id
        AND site_ownership.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.site_members
      WHERE site_members.site_id = instance_pending_work.site_id
        AND site_members.user_id = (SELECT auth.uid())
        AND site_members.status = 'active'
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.instance_pending_work TO authenticated;
GRANT ALL ON TABLE public.instance_pending_work TO service_role;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.instance_pending_work;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
