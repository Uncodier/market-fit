BEGIN;
SET LOCAL lock_timeout = '5s';

-- Drain message writes before switching the BEFORE and AFTER functions together.
LOCK TABLE public.messages IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  -- This is a targeted correction of the audited trigger chain, not a bootstrap.
  IF NOT EXISTS (
    SELECT FROM pg_catalog.pg_proc
    WHERE oid = 'public.refresh_conversation_message_summary()'::regprocedure
      AND md5(prosrc) = '2ff5403d198166130e61fae59c4d9fc3'
      AND proowner = 'postgres'::regrole AND prosecdef AND proconfig = ARRAY['search_path=public']
  ) OR NOT EXISTS (
    SELECT FROM pg_catalog.pg_proc
    WHERE oid = 'public.update_conversation_last_message_time()'::regprocedure
      AND md5(prosrc) = '1751f5e4c71f33ca2943c2ce7e24fec7'
      AND proowner = 'postgres'::regrole AND prosecdef AND proconfig = ARRAY['search_path=""']
  ) OR EXISTS (
    SELECT FROM (VALUES
      ('location_acl_10_visible', 'public.location_acl_visible_messages()'::regprocedure, 23),
      ('location_acl_inherit', 'public.location_acl_inherit_scope()'::regprocedure, 23),
      ('conversation_automation_snooze_after_human_reply', 'public.snooze_conversation_after_human_reply()'::regprocedure, 5),
      ('messages_refresh_conversation_summary', 'public.refresh_conversation_message_summary()'::regprocedure, 29),
      ('on_message_insert', 'public.update_conversation_last_message_time()'::regprocedure, 5)
    ) AS expected(name, func, type)
    WHERE NOT EXISTS (
      SELECT FROM pg_catalog.pg_trigger t
      WHERE t.tgrelid = 'public.messages'::regclass AND NOT t.tgisinternal
        AND t.tgname = expected.name AND t.tgfoid = expected.func AND t.tgtype = expected.type
        AND t.tgenabled = 'O' AND t.tgqual IS NULL AND t.tgnargs = 0
        AND t.tgconstraint = 0 AND t.tgoldtable IS NULL AND t.tgnewtable IS NULL
        AND CASE WHEN t.tgname = 'messages_refresh_conversation_summary' THEN (
          SELECT array_agg(a.attname::text ORDER BY a.attname)
          FROM pg_catalog.pg_attribute a WHERE a.attrelid = t.tgrelid AND a.attnum = ANY(t.tgattr)
        ) = ARRAY['content', 'conversation_id', 'created_at', 'role']
        ELSE t.tgattr = ''::int2vector END
    )
  ) THEN
    RAISE EXCEPTION 'Unexpected message trigger configuration; inspect before migration';
  END IF;
END;
$$;

-- There is one serialization point per conversation, not a hash plus a parent
-- lock. Take the strongest mode used by the chain (the human reply needs FOR
-- UPDATE) after the invoker visibility guard and before inheritance's FOR SHARE.
CREATE FUNCTION public.lock_message_conversations()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog AS $$
DECLARE
  affected_ids uuid[];
  locked_id uuid;
  new_parent_locked boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM 1 FROM public.conversations AS c WHERE c.id = NEW.conversation_id FOR UPDATE;
    -- Do not let a parent that becomes visible between trigger queries enter
    -- the subsequent ACL SHARE lock without having serialized here first.
    IF NOT FOUND AND NEW.conversation_id IS NOT NULL THEN
      RAISE EXCEPTION 'Operational parent unavailable' USING ERRCODE = '23503';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    affected_ids := ARRAY[OLD.conversation_id];
  ELSE
    affected_ids := ARRAY[OLD.conversation_id, NEW.conversation_id];
  END IF;

  -- PostgreSQL already locked the child tuple. Waiting here could deadlock with
  -- a parent-first write (in particular ON DELETE CASCADE). Report 55P03 so the
  -- caller can roll back and retry the transaction; do not skip any summary.
  -- During a cascade the parent deleted by this transaction is no longer visible.
  FOR locked_id IN SELECT c.id FROM public.conversations AS c
    WHERE c.id = ANY(affected_ids) ORDER BY c.id FOR UPDATE NOWAIT
  LOOP
    IF TG_OP = 'UPDATE' AND locked_id = NEW.conversation_id THEN new_parent_locked := true; END IF;
  END LOOP;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF NOT new_parent_locked AND NEW.conversation_id IS NOT NULL THEN
    RAISE EXCEPTION 'Operational parent unavailable' USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$;
ALTER FUNCTION public.lock_message_conversations() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.lock_message_conversations() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER location_acl_15_lock_message_conversations
BEFORE INSERT OR UPDATE OF content, role, created_at, conversation_id, id ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.lock_message_conversations();

-- Run after the existing BEFORE DELETE permission guard.
CREATE TRIGGER zz_lock_message_conversations_before_delete
BEFORE DELETE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.lock_message_conversations();

-- Retain owner, privileges, SECURITY DEFINER, search path, and exact recompute.
-- The BEFORE locks precede any write, so a READ COMMITTED recompute can see the
-- prior lock holder's committed messages as well as this statement's changes.
CREATE OR REPLACE FUNCTION public.refresh_conversation_message_summary()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  affected_ids uuid[];
  target_conversation_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    affected_ids := ARRAY[OLD.conversation_id];
  ELSIF TG_OP = 'UPDATE' AND OLD.conversation_id IS DISTINCT FROM NEW.conversation_id THEN
    affected_ids := ARRAY[NEW.conversation_id, OLD.conversation_id];
  ELSE
    affected_ids := ARRAY[NEW.conversation_id];
  END IF;

  FOREACH target_conversation_id IN ARRAY affected_ids LOOP
    UPDATE public.conversations AS conversation
    SET
      message_count = summary.total,
      last_message_preview = summary.latest,
      last_message_at = (summary.latest->>'created_at')::timestamptz
    FROM (
      SELECT
        COUNT(*)::bigint AS total,
        (
          SELECT jsonb_build_object(
            'id', latest.id,
            'content', latest.content,
            'role', latest.role,
            'created_at', latest.created_at
          )
          FROM public.messages AS latest
          WHERE latest.conversation_id = target_conversation_id
          ORDER BY latest.created_at DESC, latest.id DESC
          LIMIT 1
        ) AS latest
      FROM public.messages
      WHERE conversation_id = target_conversation_id
    ) AS summary
    WHERE conversation.id = target_conversation_id;
  END LOOP;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- id participates in the preview and the tie-breaker. Keep the summary event
-- list identical to the BEFORE serialization event list.
CREATE OR REPLACE TRIGGER messages_refresh_conversation_summary
AFTER INSERT OR DELETE OR UPDATE OF content, role, created_at, conversation_id, id ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.refresh_conversation_message_summary();

-- Keep the legacy updated_at side effect. It fires after the summary trigger;
-- it must not overwrite last_message_at with a late/backfilled insert's time.
CREATE OR REPLACE FUNCTION public.update_conversation_last_message_time()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NEW.conversation_id IS NOT NULL THEN
    UPDATE public.conversations SET updated_at = NEW.created_at WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$;

-- This orders both parents of a single move. Row triggers cannot pre-order all
-- rows of arbitrary multi-conversation INSERTs or multi-statement transactions.
-- Batch writers should acquire conversation locks in UUID order from the outset.
COMMIT;