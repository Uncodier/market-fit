BEGIN;

-- Storage permission probes precede backend upload metadata. Older probes may
-- have NULL/empty metadata; newer probes have mimetype/contentLength, not size.
-- Authorize only an exact, unexpired caller-owned reservation. If backend size
-- or MIME is supplied, it must match; completion still requires BOTH values.
DROP POLICY credential_bucket_insert_guard ON storage.objects;
CREATE POLICY credential_bucket_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(bucket_id<>'procurement-credentials' OR (
  public.procurement_credential_object_access(name,true)
  AND (metadata IS NULL OR jsonb_typeof(metadata)='object')
  AND EXISTS(SELECT 1 FROM public.procurement_credential_revisions reservation
   WHERE reservation.object_path=storage.objects.name AND reservation.uploader_id=auth.uid()
   AND (NOT COALESCE(storage.objects.metadata ? 'size',false)
    OR storage.objects.metadata->>'size'=reservation.byte_size::text)
   AND (NOT COALESCE(storage.objects.metadata ? 'mimetype',false)
    OR storage.objects.metadata->>'mimetype'=reservation.mime_type))
 ));

-- No caller UPDATE/DELETE or pending SELECT is granted. Storage's internal
-- completion transaction owns metadata persistence, not the application client.
-- contentLength is deliberately not treated as size: multipart request length
-- can include the envelope; only backend size is authoritative at completion.
COMMIT;