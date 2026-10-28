BEGIN;

CREATE TABLE public.procurement_credentials (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES auth.users(id),
 version integer NOT NULL DEFAULT 0, archived_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.procurement_credential_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), credential_id uuid NOT NULL REFERENCES public.procurement_credentials(id),
 revision integer NOT NULL CHECK(revision>0), uploader_id uuid NOT NULL REFERENCES auth.users(id),
 metadata jsonb NOT NULL CHECK(jsonb_typeof(metadata)='object' AND metadata->>'holder_kind'='person'),
 object_path text NOT NULL UNIQUE, original_name text NOT NULL CHECK(length(original_name) BETWEEN 1 AND 200),
 mime_type text NOT NULL CHECK(mime_type IN ('application/pdf','image/png','image/jpeg')),
 byte_size integer NOT NULL CHECK(byte_size BETWEEN 1 AND 8388608),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','ready')),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(credential_id,revision)
);
CREATE INDEX procurement_credentials_owner ON public.procurement_credentials(owner_id,created_at DESC);
CREATE FUNCTION public.reserve_procurement_credential(p_id uuid,p_version integer,p_metadata jsonb,p_name text,p_mime text,p_bytes integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.procurement_credentials; rid uuid:=gen_random_uuid(); object_key text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 -- Serialize account quota and creation; credentials never inherit a selected workspace.
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text,74001));
 IF COALESCE((SELECT sum(byte_size) FROM public.procurement_credential_revisions WHERE uploader_id=auth.uid()),0)+p_bytes>134217728 THEN
  RAISE EXCEPTION 'Account evidence storage limit reached' USING ERRCODE='40001'; END IF;
 IF p_version IS NULL OR p_version<0 OR p_metadata IS NULL OR jsonb_typeof(p_metadata)<>'object'
 OR p_metadata->>'holder_kind' IS DISTINCT FROM 'person'
 OR NOT p_metadata ?& ARRAY['holder_kind','holder_name','type','title','issuer','reference','scope','issued_on','expires_on','non_expiring']
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_metadata) k WHERE k NOT IN ('holder_kind','holder_name','type','title','issuer','reference','scope','issued_on','expires_on','non_expiring'))
 OR length(p_metadata::text)>6000 OR length(COALESCE(p_metadata->>'title','')) NOT BETWEEN 1 AND 200
 OR length(COALESCE(p_metadata->>'holder_name','')) NOT BETWEEN 1 AND 200
 OR length(COALESCE(p_metadata->>'issuer','')) NOT BETWEEN 1 AND 200
 OR EXISTS(SELECT 1 FROM jsonb_each(p_metadata) field WHERE field.key IN ('holder_kind','holder_name','type','title','issuer','reference','scope') AND jsonb_typeof(field.value)<>'string')
 OR length(COALESCE(p_metadata->>'reference',''))>200 OR length(COALESCE(p_metadata->>'scope',''))>2000
 OR EXISTS(SELECT 1 FROM jsonb_each(p_metadata) field WHERE field.key IN ('issued_on','expires_on') AND jsonb_typeof(field.value) NOT IN ('string','null'))
 OR (p_metadata->>'issued_on' IS NOT NULL AND (p_metadata->>'issued_on' !~ '^\d{4}-\d{2}-\d{2}$' OR (p_metadata->>'issued_on')::date IS NULL))
 OR (p_metadata->>'expires_on' IS NOT NULL AND (p_metadata->>'expires_on' !~ '^\d{4}-\d{2}-\d{2}$' OR (p_metadata->>'expires_on')::date IS NULL))
 OR COALESCE(p_metadata->>'type','') !~ '^[a-z][a-z0-9_-]{1,79}$'
 OR jsonb_typeof(p_metadata->'non_expiring') IS DISTINCT FROM 'boolean'
 OR (p_metadata->>'non_expiring'='true' AND p_metadata->>'expires_on' IS NOT NULL)
 OR (p_metadata->>'issued_on' IS NOT NULL AND p_metadata->>'expires_on' IS NOT NULL AND (p_metadata->>'issued_on')::date>(p_metadata->>'expires_on')::date)
 OR p_name IS NULL OR length(p_name) NOT BETWEEN 1 AND 200 OR p_name ~ '[[:cntrl:]/\\]'
 OR p_mime IS NULL OR p_mime NOT IN ('application/pdf','image/png','image/jpeg') OR p_bytes IS NULL OR p_bytes NOT BETWEEN 1 AND 8388608
 THEN RAISE EXCEPTION 'Invalid personal credential' USING ERRCODE='22023'; END IF;
 IF p_id IS NULL THEN
  IF p_version<>0 OR (SELECT count(*) FROM public.procurement_credentials WHERE owner_id=auth.uid())>=50 THEN
   RAISE EXCEPTION 'Credential limit or version conflict' USING ERRCODE='40001'; END IF;
  INSERT INTO public.procurement_credentials(owner_id) VALUES(auth.uid()) RETURNING * INTO c;
 ELSE
  SELECT * INTO c FROM public.procurement_credentials WHERE id=p_id AND owner_id=auth.uid() FOR UPDATE;
 END IF;
 IF c.id IS NULL OR c.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Credential access denied' USING ERRCODE='42501'; END IF;
 IF c.version<>p_version OR c.version>=100 THEN RAISE EXCEPTION 'Credential version conflict' USING ERRCODE='40001'; END IF;
 object_key:=auth.uid()::text||'/'||c.id::text||'/'||rid::text;
 INSERT INTO public.procurement_credential_revisions(id,credential_id,revision,uploader_id,metadata,object_path,original_name,mime_type,byte_size)
 VALUES(rid,c.id,c.version+1,auth.uid(),p_metadata,object_key,p_name,p_mime,p_bytes);
 UPDATE public.procurement_credentials SET version=version+1 WHERE id=c.id;
 RETURN jsonb_build_object('credential_id',c.id,'revision_id',rid,'object_path',object_key,'version',c.version+1);
END $$;
CREATE FUNCTION public.complete_procurement_credential(p_revision uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.procurement_credential_revisions;
BEGIN
 SELECT * INTO r FROM public.procurement_credential_revisions WHERE id=p_revision AND uploader_id=auth.uid() FOR UPDATE;
 IF r.id IS NULL THEN RAISE EXCEPTION 'Credential access denied' USING ERRCODE='42501'; END IF;
 IF r.state='ready' THEN RETURN r.id; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='procurement-credentials' AND name=r.object_path
 AND (metadata->>'size')::bigint=r.byte_size AND metadata->>'mimetype'=r.mime_type) THEN
  RAISE EXCEPTION 'Uploaded evidence is missing or mismatched' USING ERRCODE='22023'; END IF;
 UPDATE public.procurement_credential_revisions SET state='ready' WHERE id=r.id;
 RETURN r.id;
END $$;
CREATE FUNCTION public.archive_procurement_credential(p_id uuid,p_version integer) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 UPDATE public.procurement_credentials SET archived_at=now(),version=version+1
 WHERE id=p_id AND owner_id=auth.uid() AND version=p_version AND archived_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Credential unavailable or version conflict' USING ERRCODE='40001'; END IF;
 RETURN p_id;
END $$;
CREATE FUNCTION public.guard_procurement_credential_revision() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.state='pending' AND NEW.state='ready'
 AND (to_jsonb(NEW)-'state')=(to_jsonb(OLD)-'state') THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Credential revisions are immutable' USING ERRCODE='42501';
END $$;
CREATE TRIGGER credential_revision_immutable BEFORE UPDATE OR DELETE ON public.procurement_credential_revisions
 FOR EACH ROW EXECUTE FUNCTION public.guard_procurement_credential_revision();
ALTER TABLE public.procurement_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_credential_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.procurement_credentials,public.procurement_credential_revisions FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.procurement_credentials,public.procurement_credential_revisions TO authenticated;
CREATE POLICY credential_owner_read ON public.procurement_credentials FOR SELECT TO authenticated USING(owner_id=auth.uid());
CREATE POLICY credential_revision_owner_read ON public.procurement_credential_revisions FOR SELECT TO authenticated USING(uploader_id=auth.uid());
REVOKE ALL ON FUNCTION public.reserve_procurement_credential(uuid,integer,jsonb,text,text,integer),public.complete_procurement_credential(uuid),
 public.archive_procurement_credential(uuid,integer),public.guard_procurement_credential_revision() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.reserve_procurement_credential(uuid,integer,jsonb,text,text,integer),public.complete_procurement_credential(uuid),
 public.archive_procurement_credential(uuid,integer) TO authenticated;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('procurement-credentials','procurement-credentials',false,8388608,ARRAY['application/pdf','image/png','image/jpeg']);
CREATE FUNCTION public.procurement_credential_object_access(p_name text,p_write boolean) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.procurement_credential_revisions r
 WHERE r.object_path=p_name AND r.uploader_id=auth.uid() AND
 ((p_write AND r.state='pending' AND r.created_at>now()-interval '1 hour') OR (NOT p_write AND r.state='ready')))
$$;
REVOKE ALL ON FUNCTION public.procurement_credential_object_access(text,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.procurement_credential_object_access(text,boolean) TO authenticated;
-- Restrictive policies prevent broader legacy storage policies from granting access.
CREATE POLICY credential_bucket_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
 USING(bucket_id<>'procurement-credentials' OR public.procurement_credential_object_access(name,false));
CREATE POLICY credential_bucket_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(bucket_id<>'procurement-credentials' OR (public.procurement_credential_object_access(name,true)
 AND EXISTS(SELECT 1 FROM public.procurement_credential_revisions reservation WHERE reservation.object_path=name
 AND reservation.uploader_id=auth.uid() AND storage.objects.metadata->>'size'=reservation.byte_size::text
 AND storage.objects.metadata->>'mimetype'=reservation.mime_type)));
CREATE POLICY credential_bucket_update_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(bucket_id<>'procurement-credentials') WITH CHECK(bucket_id<>'procurement-credentials');
CREATE POLICY credential_bucket_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
 USING(bucket_id<>'procurement-credentials');
CREATE POLICY credential_bucket_anon_guard ON storage.objects AS RESTRICTIVE FOR ALL TO anon
 USING(bucket_id<>'procurement-credentials') WITH CHECK(bucket_id<>'procurement-credentials');
CREATE POLICY credential_bucket_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='procurement-credentials' AND public.procurement_credential_object_access(name,false));
CREATE POLICY credential_bucket_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='procurement-credentials' AND public.procurement_credential_object_access(name,true));

COMMIT;