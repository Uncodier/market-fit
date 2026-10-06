-- Operator script, NOT a schema migration. Run the complete file in SQL Editor.
-- Target: Makinari production (rnjgeloamtszdjplmqxy), verified test-owned site below.
-- SQL Editor uses privileged database access, NOT the test user's RLS session.
-- WARNING: content/lead INSERT triggers production workflow webhooks.
-- QA metadata does NOT suppress automation. Review workflows before executing.
-- The QA product is publicly listed, but marked not purchasable.
-- No UPDATE, DELETE, trigger disabling, schema changes or auth impersonation.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $provision$
DECLARE
  target_site constant uuid := 'dea92504-319d-4950-943f-503280f1727c';
  target_owner constant uuid := 'db4ac8f4-0071-44de-b156-d422aca704f1';
  fixture jsonb;
  payload jsonb;
  existing_row jsonb;
  table_name text;
  name_field text;
  columns_sql text;
  collision boolean;
  plan constant jsonb := $fixtures$[
    {"table":"content","field":"title","row":{
      "id":"06780803-b7d5-588e-a5b1-21b77da49e5d",
      "site_id":"dea92504-319d-4950-943f-503280f1727c",
      "user_id":"db4ac8f4-0071-44de-b156-d422aca704f1",
      "author_id":"db4ac8f4-0071-44de-b156-d422aca704f1",
      "title":"QA Smoke Content","type":"blog_post","status":"draft",
      "description":"Synthetic read-only smoke fixture. Do not publish or automate.",
      "text":"Synthetic QA content; not customer or marketing material.",
      "metadata":{"qa_fixture":"shiplight-production-smoke-v1"}
    }},
    {"table":"leads","field":"name","row":{
      "id":"a158458f-2734-565b-a561-2d7afda67193",
      "site_id":"dea92504-319d-4950-943f-503280f1727c",
      "user_id":"db4ac8f4-0071-44de-b156-d422aca704f1",
      "name":"QA Smoke Lead","status":"new","origin":"inbound",
      "email":null,"phone":null,
      "notes":"Synthetic smoke fixture. Do not contact or automate.",
      "do_not_call":true,"voice_call_consent_status":"revoked",
      "metadata":{"qa_fixture":"shiplight-production-smoke-v1"}
    }},
    {"table":"catalog_items","field":"name","row":{
      "id":"46186d7e-0729-5a3e-a2f0-cc27b8e4ce2d",
      "site_id":"dea92504-319d-4950-943f-503280f1727c",
      "name":"QA Smoke Product - NOT FOR SALE","kind":"product","status":"active",
      "description":"Synthetic QA display fixture. Not for sale or fulfillment.",
      "is_marketplace_listed":true,"is_purchasable":false,"is_pos_available":false,
      "is_recurring":false,"is_reservation":false,"track_inventory":false,
      "availability_mode":"manual","availability_status":"available",
      "parent_id":null,"category_id":null,"target_sale_price":1,"currency":"USD",
      "sort_order":-1000000,
      "metadata":{"qa_fixture":"shiplight-production-smoke-v1"}
    }}
  ]$fixtures$::jsonb;
BEGIN
  -- Serialize this provisioning script for this site without locking whole tables.
  PERFORM pg_advisory_xact_lock(hashtextextended('shiplight-smoke:' || target_site::text, 0));
  PERFORM 1 FROM public.sites
    WHERE id = target_site AND user_id = target_owner AND archived_at IS NULL
      AND name = 'Global Tech Innovations Ltd - Updated'
    FOR SHARE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_owner) THEN
    RAISE EXCEPTION 'Verified test site/owner mismatch; refusing fixture insertion';
  END IF;

  FOR fixture IN SELECT value FROM jsonb_array_elements(plan) LOOP
    table_name := fixture->>'table';
    name_field := fixture->>'field';
    payload := fixture->'row';
    IF table_name NOT IN ('content', 'leads', 'catalog_items')
      OR (payload->>'site_id')::uuid <> target_site THEN
      RAISE EXCEPTION 'Invalid fixture scope';
    END IF;

    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE site_id = $1 AND %I = $2 AND id <> $3)',
      table_name, name_field)
      INTO collision USING target_site, payload->>name_field, (payload->>'id')::uuid;
    IF collision THEN
      RAISE EXCEPTION 'QA name collision in %; no existing rows will be overwritten', table_name;
    END IF;

    EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id = $1 FOR SHARE', table_name)
      INTO existing_row USING (payload->>'id')::uuid;
    IF existing_row IS NOT NULL THEN
      IF NOT existing_row @> payload THEN
        RAISE EXCEPTION 'Existing % fixture differs; refusing overwrite', table_name;
      END IF;
      CONTINUE;
    END IF;

    SELECT string_agg(format('%I', key), ', ' ORDER BY key)
      INTO columns_sql FROM jsonb_object_keys(payload) AS keys(key);
    EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I, $1)',
      table_name, columns_sql, columns_sql, table_name) USING payload;

    EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE site_id = $1 AND id = $2', table_name)
      INTO existing_row USING target_site, (payload->>'id')::uuid;
    IF existing_row IS NULL OR NOT existing_row @> payload THEN
      RAISE EXCEPTION 'Inserted % fixture did not match its safety contract', table_name;
    END IF;
  END LOOP;
END
$provision$;

COMMIT;

-- Share these three rows only. No credentials or customer data are returned.
SELECT 'content' AS entity, id, site_id, title AS name FROM public.content
  WHERE site_id = 'dea92504-319d-4950-943f-503280f1727c' AND id = '06780803-b7d5-588e-a5b1-21b77da49e5d'
UNION ALL
SELECT 'lead', id, site_id, name FROM public.leads
  WHERE site_id = 'dea92504-319d-4950-943f-503280f1727c' AND id = 'a158458f-2734-565b-a561-2d7afda67193'
UNION ALL
SELECT 'catalog_item', id, site_id, name FROM public.catalog_items
  WHERE site_id = 'dea92504-319d-4950-943f-503280f1727c' AND id = '46186d7e-0729-5a3e-a2f0-cc27b8e4ce2d';