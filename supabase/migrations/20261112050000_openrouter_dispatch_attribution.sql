BEGIN;
-- Never settle a receipt against another model's dispatch, even within one tenant.
CREATE OR REPLACE FUNCTION public.openrouter_customer_receipt_settle_intent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  UPDATE public.openrouter_customer_dispatches SET state=NEW.receipt->>'state',updated_at=now()
    WHERE event_id=NEW.event_id AND site_id=NEW.site_id AND connection_id=NEW.connection_id
      AND policy_version=(NEW.receipt->>'policy_version')::integer
      AND credential_version=(NEW.receipt->>'credential_version')::integer
      AND capability=NEW.receipt->>'capability'
      AND requested_model=NEW.receipt->'usage_evidence'->>'requested_model'
      AND state IN ('dispatching','uncertain');
  IF NOT FOUND THEN RAISE EXCEPTION 'Receipt requires matching dispatch intent' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.openrouter_customer_receipt_settle_intent() FROM PUBLIC,anon,authenticated,service_role;
COMMIT;