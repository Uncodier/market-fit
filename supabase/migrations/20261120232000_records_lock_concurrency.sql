BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL search_path = pg_catalog;

-- Quiesce DML using the old bodies before switching the protocol atomically.
LOCK TABLE public.record_categories, public.records, public.record_diagrams,
  public.record_diagram_nodes, public.record_diagram_edges, public.record_embedding_jobs
  IN SHARE ROW EXCLUSIVE MODE;

-- Only lock statements are changed in the audited functions. Pin their bodies,
-- security attributes and browser ACLs so a different baseline fails closed.
DO $preflight$
DECLARE
  expected record;
  installed pg_proc;
BEGIN
  FOR expected IN SELECT * FROM (VALUES
    ('public.guard_record_trash_writes()', '04263df1bd6c4c2df97946371613d135', false, false),
    ('public.guard_trashed_record_diagram_write()', 'c15915b1b694d12e26b5b93855f9a70c', true, false),
    ('public.guard_trashed_record_embedding_job()', '517ec933d516e5d7172bbfc880f28905', true, false),
    ('public.convert_record_delete_to_trash()', '6b88ab27343db99087c9d615cbaf87d4', true, false),
    ('public.trash_record_category(uuid)', '1066c440c8e58ff6bd4b296888b1b812', true, true),
    ('public.restore_record_category(uuid)', 'b0133dc661a1390ecd3410acad895901', true, true),
    ('public.restore_record(uuid)', 'b433909315ad01697350dc558fc6b90d', true, true),
    ('public.trash_record(uuid)', 'd0d89d5ca0572cf73ac31d246ecc3df8', false, true),
    ('public.cancel_trashed_record_embedding_jobs()', '3f43b96fdaedbb9c1b470870a6559942', true, false),
    ('public.save_record_diagram(uuid,bigint,jsonb,jsonb,jsonb)', 'd0069940a3bc29c13c8ecc5dcefb4f67', false, false),
    ('public.enqueue_record_embedding_job(uuid,uuid[],boolean)', 'b5dd3c4905d353668325b2e9a55bb704', true, false)
  ) AS surface(signature, body_hash, definer, browser_rpc)
  LOOP
    SELECT p.* INTO installed FROM pg_proc p WHERE p.oid = to_regprocedure(expected.signature);
    IF NOT FOUND OR md5(installed.prosrc) <> expected.body_hash
      OR installed.proowner <> 'postgres'::regrole
      OR installed.prosecdef IS DISTINCT FROM expected.definer
      OR installed.provolatile <> 'v' OR installed.proisstrict
      OR installed.proconfig IS DISTINCT FROM (CASE WHEN installed.proname IN ('save_record_diagram','enqueue_record_embedding_job')
        THEN ARRAY['search_path=public'] ELSE ARRAY['search_path=public, pg_temp'] END)
      OR has_function_privilege('anon', installed.oid, 'EXECUTE')
      OR has_function_privilege('authenticated', installed.oid, 'EXECUTE') IS DISTINCT FROM expected.browser_rpc THEN
      RAISE EXCEPTION 'Records lock migration requires the audited function: %', expected.signature;
    END IF;
  END LOOP;

  FOR expected IN SELECT * FROM (VALUES
    ('record_categories', 'category_trash_write_guard', 'guard_record_trash_writes()', 31),
    ('records', 'record_trash_write_guard', 'guard_record_trash_writes()', 23),
    ('records', 'record_delete_to_trash', 'convert_record_delete_to_trash()', 11),
    ('records', 'cancel_trashed_record_embedding_jobs', 'cancel_trashed_record_embedding_jobs()', 17),
    ('record_diagrams', 'record_diagram_trash_guard', 'guard_trashed_record_diagram_write()', 31),
    ('record_diagram_nodes', 'record_diagram_node_trash_guard', 'guard_trashed_record_diagram_write()', 31),
    ('record_diagram_edges', 'record_diagram_edge_trash_guard', 'guard_trashed_record_diagram_write()', 31),
    ('record_embedding_jobs', 'guard_trashed_record_embedding_job', 'guard_trashed_record_embedding_job()', 23)
  ) AS bindings(table_name, trigger_name, signature, trigger_type)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger t
      WHERE t.tgrelid = to_regclass('public.' || expected.table_name)
        AND t.tgname = expected.trigger_name AND t.tgenabled = 'O' AND NOT t.tgisinternal
        AND t.tgfoid = to_regprocedure('public.' || expected.signature) AND t.tgtype = expected.trigger_type) THEN
      RAISE EXCEPTION 'Records lock migration requires the enabled trigger: %', expected.trigger_name;
    END IF;
  END LOOP;

  -- Other invoker roles must not be silently admitted by giving the private
  -- helpers PUBLIC execution. The verified writer roles are explicitly granted.
  IF EXISTS (SELECT 1 FROM pg_class c WHERE c.oid IN ('public.records'::regclass, 'public.record_categories'::regclass)
    AND (c.relowner <> 'postgres'::regrole OR NOT c.relrowsecurity)) THEN
    RAISE EXCEPTION 'Records lock migration requires the audited table ownership and RLS';
  END IF;
END;
$preflight$;

CREATE SCHEMA records_lock_private;
REVOKE ALL ON SCHEMA records_lock_private FROM PUBLIC, anon, authenticated, service_role;

-- Row triggers can run after PostgreSQL already holds a tuple lock. Do not wait
-- for a conflicting site fence from a row trigger: trash can own (or be queued
-- for) that fence and need the tuple that this writer already owns.
CREATE FUNCTION records_lock_private.fence(p_site_id uuid, p_exclusive boolean,
  p_wait_before_rows boolean DEFAULT false) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, pg_temp AS $$
DECLARE v_key bigint;
BEGIN
  -- A fixed snapshot might still see active rows after a deletion commits and
  -- releases the fence. The guard's post-fence reads must see fresh snapshots.
  IF current_setting('transaction_isolation') NOT IN ('read committed', 'read uncommitted') THEN
    RAISE EXCEPTION 'Records writes require READ COMMITTED isolation' USING ERRCODE = '0A000';
  END IF;

  -- E.g. an authorized hard-delete cascade can no longer find its parent.
  IF p_site_id IS NULL THEN RETURN; END IF;
  v_key := hashtextextended('records-trash:' || p_site_id::text, 0);

  IF NOT p_exclusive THEN
    IF pg_try_advisory_xact_lock_shared(v_key) THEN RETURN; END IF;
  ELSE
    -- Even an immediately available shared->exclusive upgrade can invert the
    -- order: a different writer may already own a tuple and be about to try the
    -- shared fence, or the same transaction may be doing an unrelated batch.
    -- Choose exclusive first for a transaction that needs a lifecycle change.
    IF EXISTS (
      SELECT 1 FROM pg_locks WHERE pid = pg_backend_pid() AND locktype = 'advisory' AND granted
        AND objsubid = 1 AND classid::bigint = ((v_key >> 32) & 4294967295)
        AND objid::bigint = (v_key & 4294967295)
      GROUP BY classid, objid
      HAVING bool_or(mode = 'ShareLock') AND NOT bool_or(mode = 'ExclusiveLock')
    ) THEN
      RAISE EXCEPTION 'Records lifecycle changes require the exclusive fence first'
        USING ERRCODE = '40001';
    END IF;

    IF pg_try_advisory_xact_lock(v_key) THEN RETURN; END IF;
    IF p_wait_before_rows AND NOT EXISTS (
      -- Do not wait for a second key in a batch that already owns a fence.
      SELECT 1 FROM pg_locks WHERE pid = pg_backend_pid() AND locktype = 'advisory' AND granted
    ) THEN
      PERFORM pg_advisory_xact_lock(v_key);
      RETURN;
    END IF;
  END IF;

  RAISE EXCEPTION 'Conflicting Records write; retry in a new transaction'
    USING ERRCODE = '40001';
END;
$$;
REVOKE ALL ON FUNCTION records_lock_private.fence(uuid, boolean, boolean)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION records_lock_private.fence_record(p_record_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  -- Record edits and diagram saves produce jobs keyed by both revisions.
  -- Serialize that pair and protected content per record, not per site.
  -- Acquisition never waits while a writer already holds tuple locks.
  IF p_record_id IS NOT NULL AND NOT pg_try_advisory_xact_lock(hashtextextended('records-content:' || p_record_id::text, 1)) THEN
    RAISE EXCEPTION 'Conflicting Records write; retry in a new transaction'
      USING ERRCODE = '40001';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION records_lock_private.fence_record(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- Match the existing definer functions' owner even when an authorized
-- migration role executes this file without SET ROLE postgres.
ALTER SCHEMA records_lock_private OWNER TO postgres;
ALTER FUNCTION records_lock_private.fence(uuid, boolean, boolean) OWNER TO postgres;
ALTER FUNCTION records_lock_private.fence_record(uuid) OWNER TO postgres;

-- The record/category guard is SECURITY INVOKER. A private grant lets that
-- trigger acquire the fence without granting any privileged reads or writes.
GRANT USAGE ON SCHEMA records_lock_private TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION records_lock_private.fence(uuid, boolean, boolean), records_lock_private.fence_record(uuid)
  TO authenticated, service_role;

DO $replace_locks$
DECLARE
  patch record;
  original text;
  before_lock text;
  after_lock text;
BEGIN
  FOR patch IN SELECT * FROM (VALUES
    ('public.trash_record_category(uuid)', 'root.site_id', true),
    ('public.restore_record_category(uuid)', 'root.site_id', true),
    ('public.restore_record(uuid)', 'target.site_id', true),
    ('public.convert_record_delete_to_trash()', 'OLD.site_id', false)
  ) AS lifecycle(signature, source_site, may_wait)
  LOOP
    original := pg_get_functiondef(patch.signature::regprocedure);
    before_lock := format($old$PERFORM pg_advisory_xact_lock(hashtextextended('records-trash:' || %s::text, 0));$old$,
      patch.source_site);
    after_lock := format('PERFORM records_lock_private.fence(%s, true, %s);', patch.source_site, patch.may_wait::text);
    IF strpos(original, before_lock) = 0 THEN RAISE EXCEPTION 'Missing Records lock: %', patch.signature; END IF;
    EXECUTE replace(original, before_lock, after_lock);
  END LOOP;

  -- Keep structural changes exclusive: category field contracts check for the
  -- first record, and relation admission relies on category reclassification
  -- not racing the writer. Plain record writes and their enqueue share the key.
  original := pg_get_functiondef('public.guard_record_trash_writes()'::regprocedure);
  before_lock := $old$-- Every child creation/move and trash operation serializes on this site key.
  -- Contention can yield a deadlock victim; callers may retry the whole transaction.
  PERFORM pg_advisory_xact_lock(hashtextextended('records-trash:' || NEW.site_id::text, 0));$old$;
  after_lock := $new$IF TG_TABLE_NAME = 'record_categories' THEN
    PERFORM records_lock_private.fence(NEW.site_id, true);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM records_lock_private.fence(NEW.site_id,
      NEW.category_id IS DISTINCT FROM OLD.category_id
      OR NEW.location_id IS DISTINCT FROM OLD.location_id
      OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
      OR NEW.deletion_batch_id IS DISTINCT FROM OLD.deletion_batch_id
      OR NEW.deletion_root_category_id IS DISTINCT FROM OLD.deletion_root_category_id);
  ELSE
    PERFORM records_lock_private.fence(NEW.site_id, NEW.deleted_at IS NOT NULL);
  END IF;
  IF TG_TABLE_NAME = 'records' AND NEW.deleted_at IS NULL THEN
    PERFORM records_lock_private.fence_record(NEW.id);
  END IF;$new$;
  IF strpos(original, before_lock) = 0 THEN RAISE EXCEPTION 'Missing Records storage lock'; END IF;
  EXECUTE replace(original, before_lock, after_lock);

  original := pg_get_functiondef('public.guard_trashed_record_embedding_job()'::regprocedure);
  before_lock := $old$IF NEW.status IN ('pending', 'processing', 'failed') THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('records-trash:' || NEW.site_id::text, 0));$old$;
  after_lock := $new$IF NEW.status IN ('pending', 'processing', 'failed') THEN
    -- A privileged reparent cannot evade the fence on either site.
    IF TG_OP = 'UPDATE' AND OLD.site_id IS DISTINCT FROM NEW.site_id THEN
      PERFORM records_lock_private.fence(OLD.site_id, false);
    END IF;
    PERFORM records_lock_private.fence(NEW.site_id, false);$new$;
  IF strpos(original, before_lock) = 0 THEN RAISE EXCEPTION 'Missing Records embedding lock'; END IF;
  EXECUTE replace(original, before_lock, after_lock);

  -- Read paired revisions only after acquiring the same fence as record and
  -- diagram saves. Keep the legacy, non-record-revision overload unchanged.
  original := pg_get_functiondef('public.enqueue_record_embedding_job(uuid,uuid[],boolean)'::regprocedure);
  before_lock := $old$BEGIN
  SELECT r.site_id, COALESCE(d.revision, 0), r.record_embedding_revision$old$;
  after_lock := $new$BEGIN
  SELECT r.site_id INTO v_site_id FROM public.records r WHERE r.id = p_record_id;
  PERFORM records_lock_private.fence(v_site_id, false);
  PERFORM records_lock_private.fence_record(p_record_id);

  SELECT r.site_id, COALESCE(d.revision, 0), r.record_embedding_revision$new$;
  IF strpos(original, before_lock) = 0 THEN RAISE EXCEPTION 'Missing Records embedding revision lookup'; END IF;
  EXECUTE replace(original, before_lock, after_lock);

  -- The diagram header's BEFORE INSERT guard acquires both fences. Refresh the
  -- record revision afterward, before any semantic changes or job submission.
  original := pg_get_functiondef('public.save_record_diagram(uuid,bigint,jsonb,jsonb,jsonb)'::regprocedure);
  before_lock := $old$ON CONFLICT (record_id) DO NOTHING;$old$;
  after_lock := $new$ON CONFLICT (record_id) DO NOTHING;

  SELECT r.record_embedding_revision INTO v_record_revision
  FROM public.records r WHERE r.id = p_record_id;$new$;
  IF strpos(original, before_lock) = 0 THEN RAISE EXCEPTION 'Missing Records diagram header insertion'; END IF;
  EXECUTE replace(original, before_lock, after_lock);
END;
$replace_locks$;

CREATE OR REPLACE FUNCTION public.guard_trashed_record_diagram_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_record_id uuid;
  v_old_record_id uuid;
  v_site_id uuid;
  v_old_site_id uuid;
BEGIN
  v_record_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.record_id ELSE NEW.record_id END;
  SELECT r.site_id INTO v_site_id FROM public.records r WHERE r.id = v_record_id;

  -- For a direct privileged reparent, fence both immutable parent sites before
  -- checking either status. Lock requests are nonblocking even across sites.
  IF TG_OP = 'UPDATE' AND NEW.record_id IS DISTINCT FROM OLD.record_id THEN
    v_old_record_id := OLD.record_id;
    SELECT r.site_id INTO v_old_site_id FROM public.records r WHERE r.id = v_old_record_id;
    IF v_old_site_id IS DISTINCT FROM v_site_id THEN
      PERFORM records_lock_private.fence(v_old_site_id, false);
    END IF;
  END IF;
  PERFORM records_lock_private.fence(v_site_id, false);
  IF v_old_site_id IS NOT NULL THEN
    PERFORM records_lock_private.fence_record(v_old_record_id);
  END IF;
  PERFORM records_lock_private.fence_record(v_record_id);

  IF EXISTS (SELECT 1 FROM public.records r
      WHERE r.id IN (v_record_id, v_old_record_id) AND r.deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Trashed record diagrams are read-only until restored' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

COMMIT;