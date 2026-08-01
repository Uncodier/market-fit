-- Migration: Digital Assets Fulfillment (Files, Tickets, Course player)

-- 1. Table for Downloadable Files (file & license subtypes)
CREATE TABLE IF NOT EXISTS public.catalog_item_files (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  catalog_item_id uuid NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  size_bytes bigint DEFAULT 0,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT catalog_item_files_pkey PRIMARY KEY (id),
  CONSTRAINT catalog_item_files_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE,
  CONSTRAINT catalog_item_files_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.catalog_items(id) ON DELETE CASCADE
);

ALTER TABLE public.catalog_item_files ENABLE ROW LEVEL SECURITY;

-- Site members can manage files
CREATE POLICY "site_members_manage_files" ON public.catalog_item_files FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.site_members sm 
    WHERE sm.site_id = catalog_item_files.site_id AND sm.user_id = auth.uid() AND sm.status = 'active'
  )
);

-- Note: Buyers will access file metadata via server actions (bypassing RLS), 
-- to prevent leaking storage paths through open SELECT policies.

-- 2. Table for Ticket Check-ins
CREATE TABLE IF NOT EXISTS public.ticket_check_ins (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  entitlement_id uuid NOT NULL,
  catalog_item_id uuid NOT NULL,
  scanned_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  code text NOT NULL,
  status text NOT NULL CHECK (status = ANY (ARRAY['valid'::text, 'already_used'::text, 'invalid'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ticket_check_ins_pkey PRIMARY KEY (id),
  CONSTRAINT ticket_check_ins_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE,
  CONSTRAINT ticket_check_ins_entitlement_id_fkey FOREIGN KEY (entitlement_id) REFERENCES public.entitlements(id) ON DELETE CASCADE,
  CONSTRAINT ticket_check_ins_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.catalog_items(id) ON DELETE CASCADE
);

ALTER TABLE public.ticket_check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_members_manage_check_ins" ON public.ticket_check_ins FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.site_members sm 
    WHERE sm.site_id = ticket_check_ins.site_id AND sm.user_id = auth.uid() AND sm.status = 'active'
  )
);

-- 3. Storage Bucket for Digital Downloads
INSERT INTO storage.buckets (id, name, public) 
VALUES ('digital-downloads', 'digital-downloads', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for digital-downloads
-- Allow site members to insert, select, update, delete in digital-downloads bucket
-- RLS on storage.objects where bucket_id = 'digital-downloads'
CREATE POLICY "site_members_manage_downloads" ON storage.objects FOR ALL USING (
  bucket_id = 'digital-downloads' AND
  EXISTS (
    SELECT 1 FROM public.site_members sm 
    WHERE sm.site_id::text = (string_to_array(storage.objects.name, '/'))[1] 
    AND sm.user_id = auth.uid() 
    AND sm.status = 'active'
  )
);
