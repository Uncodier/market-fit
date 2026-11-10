BEGIN;

-- User-uploaded carrier paperwork only; this does not generate official labels.
CREATE TABLE public.shipment_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  object_path text NOT NULL UNIQUE,
  file_name text NOT NULL CHECK (length(file_name) BETWEEN 5 AND 180 AND file_name ~* '\.pdf$'
    AND file_name !~ '[[:cntrl:]/\\]'),
  mime_type text NOT NULL DEFAULT 'application/pdf' CHECK (mime_type = 'application/pdf'),
  size_bytes bigint NOT NULL CHECK (size_bytes BETWEEN 16 AND 10485760),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (object_path = shipment_id::text || '/' || uploaded_by::text || '/' || id::text || '.pdf')
);
CREATE INDEX shipment_documents_shipment_created ON public.shipment_documents(shipment_id, created_at DESC);
ALTER TABLE public.shipment_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shipment_documents FROM anon, authenticated;
GRANT SELECT, INSERT ON public.shipment_documents TO authenticated;

-- Invoker security preserves shipment RLS (including assigned-only restrictions).
CREATE FUNCTION public.shipment_document_access(p_shipment_id uuid, p_write boolean)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.shipments s WHERE s.id = p_shipment_id
      AND public.user_can(s.site_id, CASE WHEN p_write THEN 'update' ELSE 'select' END)
      AND public.user_can_access_location(s.site_id, s.origin_location_id)
  );
$$;
REVOKE ALL ON FUNCTION public.shipment_document_access(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shipment_document_access(uuid, boolean) TO authenticated;

CREATE FUNCTION public.shipment_document_object_access(p_name text, p_write boolean)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR p_name !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$' THEN
    RETURN false;
  END IF;
  IF p_write AND split_part(p_name, '/', 2) <> auth.uid()::text THEN RETURN false; END IF;
  RETURN public.shipment_document_access(split_part(p_name, '/', 1)::uuid, p_write);
EXCEPTION WHEN invalid_text_representation THEN RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.shipment_document_object_access(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shipment_document_object_access(text, boolean) TO authenticated;

CREATE POLICY shipment_documents_read ON public.shipment_documents FOR SELECT TO authenticated
USING (public.shipment_document_access(shipment_id, false));
CREATE POLICY shipment_documents_insert ON public.shipment_documents FOR INSERT TO authenticated
WITH CHECK (uploaded_by = auth.uid() AND public.shipment_document_access(shipment_id, true)
  AND EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'shipment-carrier-documents'
    AND o.name = object_path AND o.metadata->>'mimetype' = 'application/pdf'
    AND o.metadata->>'size' = size_bytes::text));

INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES ('shipment-carrier-documents', 'shipment-carrier-documents', false, 10485760, ARRAY['application/pdf']);

CREATE POLICY shipment_pdf_read ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'shipment-carrier-documents' AND public.shipment_document_object_access(name, false));
CREATE POLICY shipment_pdf_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'shipment-carrier-documents' AND public.shipment_document_object_access(name, true));
-- Only unattached uploads can be removed (compensation after metadata failure).
CREATE POLICY shipment_pdf_cleanup ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'shipment-carrier-documents' AND public.shipment_document_object_access(name, true)
  AND NOT EXISTS (SELECT 1 FROM public.shipment_documents d WHERE d.object_path = name));

-- Restrictive policies defeat unrelated legacy permissive storage policies.
CREATE POLICY shipment_pdf_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO public
USING (bucket_id <> 'shipment-carrier-documents' OR
  CASE WHEN auth.uid() IS NOT NULL THEN public.shipment_document_object_access(name, false) ELSE false END);
CREATE POLICY shipment_pdf_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO public
WITH CHECK (bucket_id <> 'shipment-carrier-documents' OR
  CASE WHEN auth.uid() IS NOT NULL THEN public.shipment_document_object_access(name, true) ELSE false END);
CREATE POLICY shipment_pdf_update_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO public
USING (bucket_id <> 'shipment-carrier-documents') WITH CHECK (bucket_id <> 'shipment-carrier-documents');
CREATE POLICY shipment_pdf_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO public
USING (bucket_id <> 'shipment-carrier-documents' OR CASE WHEN auth.uid() IS NOT NULL THEN
  public.shipment_document_object_access(name, true)
  AND NOT EXISTS (SELECT 1 FROM public.shipment_documents d WHERE d.object_path = name)
  ELSE false END);
COMMIT;