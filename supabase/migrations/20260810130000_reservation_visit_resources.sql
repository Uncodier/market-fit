-- Visit registration: resource targets, terms/signature/photo, settings.visits, storage

-- 1. Reservation resource + visit attestation columns
ALTER TABLE public.reservations
  ALTER COLUMN catalog_item_id DROP NOT NULL;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS resource_type text NOT NULL DEFAULT 'catalog_item',
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assignee_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'physical',
  ADD COLUMN IF NOT EXISTS terms_text text,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS signature_url text,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS signed_at timestamptz;

ALTER TABLE public.reservations
  DROP CONSTRAINT IF EXISTS reservations_resource_type_check;

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_resource_type_check
  CHECK (resource_type = ANY (ARRAY['catalog_item'::text, 'location'::text, 'employee'::text]));

ALTER TABLE public.reservations
  DROP CONSTRAINT IF EXISTS reservations_channel_check;

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_channel_check
  CHECK (channel = ANY (ARRAY['physical'::text, 'online'::text]));

ALTER TABLE public.reservations
  DROP CONSTRAINT IF EXISTS reservations_resource_target_check;

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_resource_target_check
  CHECK (
    (
      resource_type = 'catalog_item'
      AND catalog_item_id IS NOT NULL
      AND location_id IS NULL
      AND assignee_user_id IS NULL
    )
    OR (
      resource_type = 'location'
      AND location_id IS NOT NULL
      AND catalog_item_id IS NULL
      AND assignee_user_id IS NULL
    )
    OR (
      resource_type = 'employee'
      AND assignee_user_id IS NOT NULL
      AND catalog_item_id IS NULL
      AND location_id IS NULL
    )
  );

CREATE INDEX IF NOT EXISTS idx_reservations_location_id ON public.reservations (location_id);
CREATE INDEX IF NOT EXISTS idx_reservations_assignee_user_id ON public.reservations (assignee_user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_channel ON public.reservations (site_id, channel);

-- 2. Site visits settings bag
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS visits jsonb DEFAULT '{
    "enabled_physical": true,
    "enabled_online": true,
    "require_signature": true,
    "require_photo": true,
    "terms_text": "",
    "default_duration_minutes": 60
  }'::jsonb;

-- 3. Storage for signatures / photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('visit-attestations', 'visit-attestations', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "site_members_manage_visit_attestations" ON storage.objects;
CREATE POLICY "site_members_manage_visit_attestations" ON storage.objects FOR ALL USING (
  bucket_id = 'visit-attestations' AND
  EXISTS (
    SELECT 1 FROM public.site_members sm
    WHERE sm.site_id::text = (string_to_array(storage.objects.name, '/'))[1]
    AND sm.user_id = auth.uid()
    AND sm.status = 'active'
  )
);

DROP POLICY IF EXISTS "buyers_read_own_visit_attestations" ON storage.objects;
CREATE POLICY "buyers_read_own_visit_attestations" ON storage.objects FOR SELECT USING (
  bucket_id = 'visit-attestations' AND
  EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.buyer_user_id = auth.uid()
    AND (
      storage.objects.name LIKE (r.site_id::text || '/' || r.id::text || '/%')
    )
  )
);
