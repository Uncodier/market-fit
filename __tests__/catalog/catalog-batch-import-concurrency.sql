-- LOCAL fixture only: dblink connects exclusively to this disposable cluster's
-- Unix socket (never DATABASE_URL, environment connection strings, or TCP).
CREATE EXTENSION IF NOT EXISTS dblink WITH SCHEMA extensions;
CREATE FUNCTION pg_temp.assert(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %', label; END IF; END $$;
CREATE FUNCTION pg_temp.call_sql(sku text, request uuid, mode text DEFAULT 'skip') RETURNS text LANGUAGE sql AS $$
  SELECT format('SELECT public.import_catalog_batch(%L::uuid,%L::jsonb,%L,%L::uuid)',
    '00000000-0000-4000-8000-000000000001', jsonb_build_array(jsonb_build_object(
      'rowNumber',2,'item',jsonb_build_object('sku',sku,'name','Concurrent '||sku)))::text, mode, request)
$$;
CREATE FUNCTION pg_temp.wait_lock(application text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE deadline timestamptz := clock_timestamp() + interval '8 seconds'; BEGIN
  LOOP
    IF EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name=application AND wait_event_type='Lock') THEN RETURN; END IF;
    IF clock_timestamp() > deadline THEN RAISE EXCEPTION 'Concurrent session did not reach lock barrier'; END IF;
    PERFORM pg_sleep(0.01);
  END LOOP;
END $$;
DO $$ DECLARE conn text; BEGIN
  IF current_setting('listen_addresses') <> '' OR current_setting('unix_socket_directories') NOT LIKE '/tmp/%' THEN
    RAISE EXCEPTION 'Concurrency fixture requires a socket-only disposable /tmp cluster';
  END IF;
  conn := format('host=%L port=%s dbname=%L user=auditor connect_timeout=3',
    current_setting('unix_socket_directories'), current_setting('port'), current_database());
  PERFORM extensions.dblink_connect('writer',conn||' application_name=catalog-import-writer');
  PERFORM extensions.dblink_connect('waiter',conn||' application_name=catalog-import-waiter');
  PERFORM extensions.dblink_exec('writer', 'SET ROLE authenticated');
  PERFORM extensions.dblink_exec('waiter', 'SET ROLE authenticated');
  PERFORM extensions.dblink_exec('writer', $s$SET request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000010","role":"authenticated"}'$s$);
  PERFORM extensions.dblink_exec('waiter', $s$SET request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000010","role":"authenticated"}'$s$);
  PERFORM extensions.dblink_exec('writer', 'SET statement_timeout = ''10s''');
  PERFORM extensions.dblink_exec('waiter', 'SET statement_timeout = ''10s''');
END $$;

-- Same request, simultaneous delivery: waiter returns the committed receipt,
-- preserving original created counters and ids; exactly one item and receipt.
DO $$ DECLARE request uuid := gen_random_uuid(); r1 jsonb; r2 jsonb; BEGIN
  PERFORM extensions.dblink_exec('writer','BEGIN');
  SELECT result INTO r1 FROM extensions.dblink('writer',pg_temp.call_sql('CONCURRENT-REPLAY',request)) AS t(result jsonb);
  PERFORM extensions.dblink_send_query('waiter',pg_temp.call_sql('CONCURRENT-REPLAY',request));
  PERFORM pg_temp.wait_lock('catalog-import-waiter');
  PERFORM extensions.dblink_exec('writer','COMMIT');
  SELECT result INTO r2 FROM extensions.dblink_get_result('waiter') AS t(result jsonb);
  PERFORM pg_temp.assert(r1=r2 AND r1->>'created'='1','simultaneous replay');
  PERFORM result FROM extensions.dblink_get_result('waiter') AS t(result jsonb);
END $$;
SELECT pg_temp.assert((SELECT count(*)=1 FROM public.catalog_items WHERE sku='CONCURRENT-REPLAY'), 'concurrent replay unique');

-- Different requests, same SKU: second imports after gate and skips, not creates.
DO $$ DECLARE r1 jsonb; r2 jsonb; BEGIN
  PERFORM extensions.dblink_exec('writer','BEGIN');
  SELECT result INTO r1 FROM extensions.dblink('writer',pg_temp.call_sql('CONCURRENT-SKU',gen_random_uuid())) AS t(result jsonb);
  PERFORM extensions.dblink_send_query('waiter',pg_temp.call_sql('CONCURRENT-SKU',gen_random_uuid()));
  PERFORM pg_temp.wait_lock('catalog-import-waiter');
  PERFORM extensions.dblink_exec('writer','COMMIT');
  SELECT result INTO r2 FROM extensions.dblink_get_result('waiter') AS t(result jsonb);
  PERFORM pg_temp.assert(r1->>'created'='1' AND r2->>'created'='0' AND r2->>'skipped'='1', 'same SKU separate requests');
  PERFORM result FROM extensions.dblink_get_result('waiter') AS t(result jsonb);
END $$;

-- Concurrent external SKU update deliberately skips the archival membership gate.
-- Its unique-index win must be reselected after ON CONFLICT DO NOTHING, with
-- exact skip/update counters and no duplicate item (tests both import modes).
INSERT INTO public.catalog_items(id,site_id,kind,name,sku) VALUES
  ('00000000-0000-4000-8000-000000000040','00000000-0000-4000-8000-000000000001','product','External seed','EXTERNAL-SEED');
DO $$ DECLARE mode text; r jsonb; BEGIN
  FOREACH mode IN ARRAY ARRAY['skip','update'] LOOP
    PERFORM extensions.dblink_exec('writer','BEGIN');
    PERFORM extensions.dblink_exec('writer',format('UPDATE public.catalog_items SET sku=%L WHERE id=%L::uuid',
      'EXTERNAL-'||mode,'00000000-0000-4000-8000-000000000040'));
    PERFORM extensions.dblink_send_query('waiter',pg_temp.call_sql('EXTERNAL-'||mode,gen_random_uuid(),mode));
    PERFORM pg_temp.wait_lock('catalog-import-waiter');
    PERFORM extensions.dblink_exec('writer','COMMIT');
    SELECT result INTO r FROM extensions.dblink_get_result('waiter') AS t(result jsonb);
    PERFORM pg_temp.assert(r->>'created'='0' AND jsonb_array_length(r->'errors')=0
      AND r->>CASE WHEN mode='skip' THEN 'skipped' ELSE 'updated' END='1', 'external unique conflict counters');
    PERFORM result FROM extensions.dblink_get_result('waiter') AS t(result jsonb);
  END LOOP;
END $$;
SELECT pg_temp.assert((SELECT count(*)=1 FROM public.catalog_items WHERE sku LIKE 'EXTERNAL-%'), 'external conflict unique');

-- Holder rolls back the first delivery; waiting identical request creates once,
-- with no phantom receipt or rolled-back item id.
DO $$ DECLARE request uuid := gen_random_uuid(); r1 jsonb; r2 jsonb; BEGIN
  PERFORM extensions.dblink_exec('writer','BEGIN');
  SELECT result INTO r1 FROM extensions.dblink('writer',pg_temp.call_sql('CONCURRENT-ROLLBACK',request)) AS t(result jsonb);
  PERFORM extensions.dblink_send_query('waiter',pg_temp.call_sql('CONCURRENT-ROLLBACK',request));
  PERFORM pg_temp.wait_lock('catalog-import-waiter');
  PERFORM extensions.dblink_exec('writer','ROLLBACK');
  SELECT result INTO r2 FROM extensions.dblink_get_result('waiter') AS t(result jsonb);
  PERFORM pg_temp.assert(r2->>'created'='1' AND r1->'item_ids'<>r2->'item_ids','rollback waiter recreates safely');
  PERFORM result FROM extensions.dblink_get_result('waiter') AS t(result jsonb);
END $$;

-- Archival gate contention is a retryable whole-batch failure, not stored as a
-- completed receipt whose errors would prevent a later safe replay.
DO $$ DECLARE request uuid := gen_random_uuid(); r jsonb; receipts integer; BEGIN
  SELECT count(*) INTO receipts FROM public.catalog_import_batches;
  PERFORM extensions.dblink_exec('writer','BEGIN');
  PERFORM extensions.dblink_exec('writer',$s$UPDATE public.catalog_categories SET status='archived'
    WHERE id='00000000-0000-4000-8000-000000000020'$s$);
  BEGIN
    PERFORM result FROM extensions.dblink('waiter',pg_temp.call_sql('ARCHIVE-RETRY',request)) AS t(result jsonb);
    RAISE EXCEPTION 'Expected archival gate conflict';
  EXCEPTION WHEN lock_not_available THEN NULL;
  END;
  PERFORM pg_temp.assert((SELECT count(*)=receipts FROM public.catalog_import_batches),'retryable failure has no receipt');
  PERFORM extensions.dblink_exec('writer','ROLLBACK');
  SELECT result INTO r FROM extensions.dblink('waiter',pg_temp.call_sql('ARCHIVE-RETRY',request)) AS t(result jsonb);
  PERFORM pg_temp.assert(r->>'created'='1','retry after archival contention');
END $$;
SELECT extensions.dblink_disconnect('writer');
SELECT extensions.dblink_disconnect('waiter');
SELECT 'catalog batch import concurrency SQL passed';