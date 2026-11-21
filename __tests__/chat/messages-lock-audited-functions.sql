-- Synthetic PostgreSQL fixture only. These two pre-fix bodies are exact copies
-- of the audited definitions, including the preflight prosrc fingerprints.
-- Fixture loader restores the original trailing spaces marked as @space@.
CREATE FUNCTION public.refresh_conversation_message_summary() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  target_conversation_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_conversation_id := OLD.conversation_id;
  ELSE
    target_conversation_id := NEW.conversation_id;
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.conversation_id IS DISTINCT FROM NEW.conversation_id
  THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended(
        LEAST(OLD.conversation_id::text, NEW.conversation_id::text),
        0
      )
    );
    PERFORM pg_advisory_xact_lock(
      hashtextextended(
        GREATEST(OLD.conversation_id::text, NEW.conversation_id::text),
        0
      )
    );
  ELSE
    PERFORM pg_advisory_xact_lock(
      hashtextextended(target_conversation_id::text, 0)
    );
  END IF;

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

  IF TG_OP = 'UPDATE' AND OLD.conversation_id IS DISTINCT FROM NEW.conversation_id THEN
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
          WHERE latest.conversation_id = OLD.conversation_id
          ORDER BY latest.created_at DESC, latest.id DESC
          LIMIT 1
        ) AS latest
      FROM public.messages
      WHERE conversation_id = OLD.conversation_id
    ) AS summary
    WHERE conversation.id = OLD.conversation_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.update_conversation_last_message_time() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
    -- Update the conversation's last_message_at timestamp
    -- Use explicit public schema reference since search_path is empty for security
    -- Only update if conversation_id is not null for performance
    IF NEW.conversation_id IS NOT NULL THEN
        UPDATE public.conversations@space@
        SET@space@
            last_message_at = NEW.created_at,  -- Use message timestamp instead of NOW() for consistency
            updated_at = NEW.created_at
        WHERE id = NEW.conversation_id;
    END IF;
@space@@space@@space@@space@
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_conversation_message_summary(),
  public.update_conversation_last_message_time() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_conversation_message_summary(),
  public.update_conversation_last_message_time() TO authenticated, service_role;

CREATE TRIGGER messages_refresh_conversation_summary
  AFTER INSERT OR DELETE OR UPDATE OF content, role, created_at, conversation_id ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.refresh_conversation_message_summary();
CREATE TRIGGER on_message_insert AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message_time();

-- Invoker visibility gate from the canonical location ACL baseline.
CREATE FUNCTION public.location_acl_visible_messages() RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
BEGIN
  IF current_setting('role', true) <> 'authenticated' THEN RETURN NEW; END IF;
  IF (TG_OP = 'INSERT' OR to_jsonb(OLD)->'conversation_id' IS DISTINCT FROM to_jsonb(NEW)->'conversation_id'
      OR to_jsonb(OLD)->'site_id' IS DISTINCT FROM to_jsonb(NEW)->'site_id')
      AND NEW.conversation_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.conversations WHERE id = NEW.conversation_id)
  THEN
    RAISE EXCEPTION 'Operational parent unavailable' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.location_acl_visible_messages() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER location_acl_10_visible BEFORE INSERT OR UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.location_acl_visible_messages();

-- Same invoker parent lock and write contract as the audited human-reply
-- trigger. This focused fixture uses the site policy only, without the separate
-- WhatsApp ledger, lead override or settings validation implementation.
CREATE FUNCTION public.snooze_conversation_after_human_reply() RETURNS trigger LANGUAGE plpgsql
SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE
  v_human_at timestamptz;
  v_previous_at timestamptz;
  v_site uuid;
  v_hours numeric;
BEGIN
  IF NEW.role IS DISTINCT FROM 'team_member'
    OR NEW.custom_data->>'internal' = 'true'
    OR NEW.custom_data->>'is_internal' = 'true'
    OR NEW.custom_data->>'is_internal_note' = 'true'
    OR NEW.custom_data->>'type' IN ('note', 'internal_note')
    OR NEW.custom_data->>'message_type' IN ('note', 'internal_note')
  THEN RETURN NEW; END IF;
  v_human_at := LEAST(COALESCE(NEW.created_at, statement_timestamp()), statement_timestamp());
  SELECT last_human_reply_at, site_id INTO v_previous_at, v_site
    FROM public.conversations WHERE id = NEW.conversation_id FOR UPDATE;
  IF NOT FOUND OR v_site IS NULL THEN
    RAISE EXCEPTION 'Human reply requires an authorized conversation site' USING ERRCODE = '42501';
  END IF;
  IF v_previous_at IS NOT NULL AND v_human_at <= v_previous_at THEN RETURN NEW; END IF;
  SELECT hours INTO v_hours FROM public.snooze_test_settings WHERE site_id = v_site;
  UPDATE public.conversations SET last_human_reply_at = v_human_at,
    automation_paused_until = CASE WHEN v_hours = 0 THEN automation_paused_until
      ELSE GREATEST(automation_paused_until, v_human_at + v_hours * interval '1 hour') END
    WHERE id = NEW.conversation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Human reply requires conversation update authorization' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.snooze_conversation_after_human_reply() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER conversation_automation_snooze_after_human_reply AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.snooze_conversation_after_human_reply();