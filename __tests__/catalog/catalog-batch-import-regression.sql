-- Executed after catalog-batch-import-bootstrap.sql in an isolated socket-only
-- PostgreSQL 17 cluster. All identifiers and data here are synthetic.
CREATE FUNCTION pg_temp.assert(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %', label; END IF; END $$;
CREATE FUNCTION pg_temp.expect_error(statement text, expected_state text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE caught boolean := false;
BEGIN
  BEGIN EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    caught := true;
    IF SQLSTATE <> expected_state THEN RAISE EXCEPTION 'Expected %, got %: %', expected_state, SQLSTATE, SQLERRM; END IF;
  END;
  IF NOT caught THEN RAISE EXCEPTION 'Expected SQLSTATE %', expected_state; END IF;
END $$;
CREATE FUNCTION pg_temp.row(sku text, number integer DEFAULT 2, extra jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('rowNumber', number, 'item',
    jsonb_build_object('sku', sku, 'name', 'Imported ' || sku)) || extra
$$;
CREATE FUNCTION pg_temp.import(rows jsonb, mode text DEFAULT 'skip', request uuid DEFAULT gen_random_uuid())
RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.import_catalog_batch('00000000-0000-4000-8000-000000000001', rows, mode, request)
$$;

SELECT pg_temp.assert(NOT has_function_privilege('anon',
  'public.import_catalog_batch(uuid,jsonb,text,uuid)', 'EXECUTE'), 'anonymous RPC execution denied');
SELECT pg_temp.assert(NOT has_function_privilege('service_role',
  'public.import_catalog_batch(uuid,jsonb,text,uuid)', 'EXECUTE'), 'service RPC execution denied');
SELECT pg_temp.assert(has_function_privilege('authenticated',
  'public.import_catalog_batch(uuid,jsonb,text,uuid)', 'EXECUTE'), 'authenticated RPC execution granted');
SELECT pg_temp.assert(NOT has_table_privilege('authenticated', 'public.catalog_import_batches', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.catalog_import_batches', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.catalog_import_batches', 'DELETE')
  AND NOT has_table_privilege('anon', 'public.catalog_import_batches', 'SELECT')
  AND NOT has_table_privilege('service_role', 'public.catalog_import_batches', 'INSERT'), 'receipts cannot be forged');
SELECT pg_temp.assert((SELECT prosecdef AND proconfig @> ARRAY['search_path=pg_catalog, public, pg_temp']
  AND pg_get_userbyid(proowner) = 'postgres' FROM pg_proc
  WHERE oid = 'public.import_catalog_batch(uuid,jsonb,text,uuid)'::regprocedure), 'safe non-superuser definer');
SELECT pg_temp.assert((SELECT count(*) = 5 FROM pg_indexes WHERE tablename = 'catalog_items'
  AND indexname IN ('catalog_items_site_status_created_id_idx', 'catalog_items_site_status_updated_id_idx',
    'catalog_items_site_status_display_id_idx', 'catalog_items_name_trgm_idx', 'catalog_items_sku_trgm_idx')), 'pagination and search indexes installed');

SET ROLE authenticated;
SET request.jwt.claims = '{"sub":null,"role":"authenticated"}';
SELECT pg_temp.expect_error($s$SELECT pg_temp.import(jsonb_build_array(pg_temp.row('NO-ACTOR')))$s$, '42501');
DO $$ DECLARE actor text; BEGIN
  FOREACH actor IN ARRAY ARRAY['00000000-0000-4000-8000-000000000013',
    '00000000-0000-4000-8000-000000000014', '00000000-0000-4000-8000-000000000015',
    '00000000-0000-4000-8000-000000000016'] LOOP
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', actor, 'role', 'service_role')::text, false);
    PERFORM pg_temp.expect_error($s$SELECT pg_temp.import(jsonb_build_array(pg_temp.row('DENIED')))$s$, '42501');
  END LOOP;
END $$;
SET request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000010","role":"authenticated"}';
SELECT pg_temp.expect_error($s$SELECT public.import_catalog_batch('00000000-0000-4000-8000-000000000002',
  jsonb_build_array(pg_temp.row('CROSS')), 'skip', gen_random_uuid())$s$, '42501');
SELECT pg_temp.expect_error($s$SELECT public.import_catalog_batch('00000000-0000-4000-8000-000000000003',
  jsonb_build_array(pg_temp.row('ARCHIVED-SITE')), 'skip', gen_random_uuid())$s$, '42501');

-- Every malformed batch fails before writing a single row or receipt.
DO $$ DECLARE bad jsonb; sample jsonb := pg_temp.row('INVALID'); n integer; BEGIN
  SELECT count(*) INTO n FROM public.catalog_import_batches;
  FOR bad IN SELECT value FROM jsonb_array_elements(jsonb_build_array(
    'null'::jsonb, '{}'::jsonb, '[]'::jsonb, '[null]'::jsonb, '[true]'::jsonb,
    jsonb_build_array(sample || '{"site_id":"fake"}'),
    jsonb_build_array(sample || '{"actor_id":"fake"}'),
    jsonb_build_array(sample || '{"rowNumber":1}'),
    jsonb_build_array(sample || '{"rowNumber":100002}'),
    jsonb_build_array(sample || '{"rowNumber":2.5}'),
    jsonb_build_array(sample || '{"rowNumber":"2"}'),
    jsonb_build_array(sample - 'rowNumber'),
    jsonb_build_array(sample || '{"item":null}'),
    jsonb_build_array(sample || '{"category":null}'),
    jsonb_build_array(sample || '{"category":"   "}'),
    jsonb_build_array(sample || jsonb_build_object('category', repeat('c',201))),
    jsonb_build_array(sample || '{"defaultCurrency":"usd"}'),
    jsonb_build_array(sample || '{"defaultCurrency":null}'),
    jsonb_build_array(sample, pg_temp.row('INVALID', 3)),
    jsonb_build_array(sample, pg_temp.row(E'  INVALID\t', 3)),
    jsonb_build_array(sample, pg_temp.row('OTHER-SKU', 2))
  )) LOOP
    PERFORM pg_temp.expect_error(format('SELECT pg_temp.import(%L::jsonb)', bad::text), '22023');
  END LOOP;
  FOR bad IN SELECT value FROM jsonb_array_elements(jsonb_build_array(
    '{"sku":"","name":"N"}', '{"sku":" \t\n","name":"N"}',
    '{"sku":null,"name":"N"}', '{"sku":true,"name":"N"}',
    '{"sku":"I","name":null}', '{"sku":"I","name":"   "}', '{"sku":"I"}',
    '{"sku":"I","name":"N","category_id":"fake"}',
    '{"sku":"I","name":"N","parent_id":"fake"}',
    '{"sku":"I","name":"N","kind":"service"}',
    '{"sku":"I","name":"N","status":"active"}',
    '{"sku":"I","name":"N","is_marketplace_listed":true}',
    '{"sku":"I","name":"N","description":null}',
    '{"sku":"I","name":"N","currency":"usd"}',
    '{"sku":"I","name":"N","currency":null}',
    '{"sku":"I","name":"N","cost":"NaN"}',
    '{"sku":"I","name":"N","cost":null}',
    '{"sku":"I","name":"N","cost":-1}',
    '{"sku":"I","name":"N","cost":1000000000000.0001}',
    '{"sku":"I","name":"N","lowest_sale_price":0.00001}',
    '{"sku":"I","name":"N","target_sale_price":"1"}',
    '{"sku":"I","name":"N","image_url":null}',
    '{"sku":"I","name":"N","image_url":"http://images.example.test/a.png"}',
    '{"sku":"I","name":"N","image_url":"https://images.example.test:8443/a.png"}',
    '{"sku":"I","name":"N","image_url":"https://images.example.test/a b.png"}',
    '{"sku":"I","name":"N","image_url":"https://images.example.test\\evil/a.png"}',
    jsonb_build_object('sku', repeat('s', 201), 'name', 'N'),
    jsonb_build_object('sku', 'I', 'name', repeat('n', 501)),
    jsonb_build_object('sku', 'I', 'name', 'N', 'description', repeat('d', 10001)),
    jsonb_build_object('sku', 'I', 'name', 'N', 'image_url', 'https://images.example.test/' || repeat('a', 2048)),
    jsonb_build_object('sku', 'I', 'name', 'N', 'image_url',
      'https://' || md5(gen_random_uuid()::text) || ':' || md5(gen_random_uuid()::text) || '@images.example.test/a')
  )) LOOP
    PERFORM pg_temp.expect_error(format('SELECT pg_temp.import(%L::jsonb)',
      jsonb_build_array(jsonb_build_object('rowNumber', 2, 'item', bad))::text), '22023');
  END LOOP;
  PERFORM pg_temp.expect_error($s$SELECT pg_temp.import(jsonb_build_array(pg_temp.row('INVALID')), 'replace')$s$, '22023');
  PERFORM pg_temp.expect_error($s$SELECT pg_temp.import(jsonb_build_array(pg_temp.row('INVALID')), NULL)$s$, '22023');
  PERFORM pg_temp.expect_error($s$SELECT pg_temp.import(jsonb_build_array(pg_temp.row('INVALID')), 'skip', NULL)$s$, '22023');
  PERFORM pg_temp.expect_error($s$SELECT pg_temp.import((SELECT jsonb_agg(pg_temp.row('OVER-'||n, n+1))
    FROM generate_series(1,101) n))$s$, '22023');
  PERFORM pg_temp.expect_error($s$SELECT pg_temp.import((SELECT jsonb_agg(pg_temp.row('LARGE-'||n, n+1,
    jsonb_build_object('item', jsonb_build_object('sku','LARGE-'||n,'name','N','description',repeat('d',10000)))))
    FROM generate_series(1,40) n))$s$, '22023');
  PERFORM pg_temp.assert((SELECT count(*) = n FROM public.catalog_import_batches), 'malformed input creates no receipts');
  PERFORM pg_temp.assert(NOT EXISTS(SELECT 1 FROM public.catalog_items WHERE sku='INVALID'), 'malformed input creates no items');
END $$;

DO $$ DECLARE r jsonb; old_row jsonb; BEGIN
  SELECT to_jsonb(i) INTO old_row FROM public.catalog_items i WHERE sku = 'OLD';
  r := pg_temp.import(jsonb_build_array(pg_temp.row('OLD')));
  PERFORM pg_temp.assert(r = '{"created":0,"updated":0,"skipped":1,"errors":[],"item_ids":[]}', 'default existing skip');
  PERFORM pg_temp.assert((SELECT to_jsonb(i) = old_row FROM public.catalog_items i WHERE sku='OLD'), 'skip preserves every field');
  r := pg_temp.import(jsonb_build_array(pg_temp.row('OLD', 100001, '{"defaultCurrency":"MXN"}')), 'update');
  PERFORM pg_temp.assert(r->>'updated' = '1' AND jsonb_array_length(r->'item_ids')=1, 'update counts and changed ids');
  PERFORM pg_temp.assert((SELECT to_jsonb(i) - ARRAY['name','updated_at'] = old_row - ARRAY['name','updated_at']
    FROM public.catalog_items i WHERE sku='OLD'), 'update preserves omission/currency/status/commerce flags');
  r := pg_temp.import(jsonb_build_array(pg_temp.row('OLD', 3, jsonb_build_object('item',
    jsonb_build_object('sku','OLD','name','Updated','cost',0,'lowest_sale_price',0,'target_sale_price',0,
      'currency','GBP','description','Explicit','image_url','https://images.example.test/new.png'),
      'category','Existing'))), 'update');
  PERFORM pg_temp.assert(r->>'updated'='1', 'provided update supported');
  PERFORM pg_temp.assert((SELECT cost=0 AND lowest_sale_price=0 AND target_sale_price=0
    AND currency='GBP' AND description='Explicit' AND name='Updated' AND status='archived'
    AND is_marketplace_listed AND is_pos_available AND NOT is_purchasable
    FROM public.catalog_items WHERE sku='OLD'), 'explicit zero/fields with protected defaults preserved');
END $$;

-- Row-level errors commit valid peers, never create categories or foreign links.
DO $$ DECLARE r jsonb; BEGIN
  r := pg_temp.import(jsonb_build_array(
    pg_temp.row('NEW', 2, '{"defaultCurrency":"MXN","category":"Existing"}'),
    pg_temp.row('UNKNOWN-CATEGORY', 3, '{"category":"Missing"}'),
    pg_temp.row('AMBIGUOUS-CATEGORY', 4, '{"category":"Ambiguous"}'),
    pg_temp.row('FOREIGN-CATEGORY', 5, '{"category":"ForeignOnly"}'),
    pg_temp.row('ARCHIVED-CATEGORY', 6, '{"category":"Archived"}'),
    pg_temp.row('CASE-CATEGORY', 7, '{"category":"existing"}'),
    pg_temp.row('FOREIGN', 8)
  ));
  PERFORM pg_temp.assert(r->>'created'='2' AND r->>'updated'='0' AND r->>'skipped'='0'
    AND jsonb_array_length(r->'errors')=5 AND jsonb_array_length(r->'item_ids')=2, 'partial errors exact accounting');
  PERFORM pg_temp.assert(r->'errors'->0->>'rowNumber'='3' AND r->'errors'->4->>'rowNumber'='7', 'physical error row numbers');
  PERFORM pg_temp.assert((SELECT kind='product' AND currency='MXN' AND status='active'
    AND availability_status='available' AND is_purchasable AND NOT is_marketplace_listed AND NOT is_pos_available
    AND parent_id IS NULL AND category_id='00000000-0000-4000-8000-000000000020'
    FROM public.catalog_items WHERE sku='NEW'), 'safe new product defaults and chosen default currency');
  PERFORM pg_temp.assert((SELECT count(*)=4 FROM public.catalog_categories), 'categories not created');
  PERFORM pg_temp.assert((SELECT count(*)=1 FROM public.catalog_items WHERE sku='FOREIGN'), 'foreign SKU identity not reused');
  r := pg_temp.import(jsonb_build_array(pg_temp.row('SERVICE', 2), pg_temp.row('VARIANT', 3)), 'update');
  PERFORM pg_temp.assert(jsonb_array_length(r->'errors')=2 AND r->>'updated'='0', 'specialized products protected');
  r := pg_temp.import(jsonb_build_array(pg_temp.row('SERVICE', 2), pg_temp.row('VARIANT', 3)), 'skip');
  PERFORM pg_temp.assert(r->>'skipped'='2', 'specialized identities skippable');
  r := pg_temp.import(jsonb_build_array(pg_temp.row('CASE',2),pg_temp.row('case',3),
    pg_temp.row(E'  TRIMMED\t',4),pg_temp.row('USD-DEFAULT',5),
    pg_temp.row('CURRENCY-EXPLICIT',6,'{"defaultCurrency":"MXN","item":{"sku":"CURRENCY-EXPLICIT","name":"N","currency":"EUR","cost":1000000000000,"target_sale_price":0.0001}}')));
  PERFORM pg_temp.assert(r->>'created'='5', 'case-sensitive SKUs and money boundaries accepted');
  PERFORM pg_temp.assert((SELECT currency='USD' FROM public.catalog_items WHERE sku='USD-DEFAULT'), 'USD fallback only on create');
  PERFORM pg_temp.assert((SELECT currency='EUR' FROM public.catalog_items WHERE sku='CURRENCY-EXPLICIT'), 'file currency overrides default');
  PERFORM pg_temp.assert(EXISTS(SELECT 1 FROM public.catalog_items WHERE sku='TRIMMED'), 'identity trimmed');
END $$;

-- Replay returns the original result byte-for-byte, not new counters. Different
-- actor/mode/input cannot claim or overwrite the receipt. Direct writes fail.
DO $$ DECLARE rows jsonb := jsonb_build_array(pg_temp.row('REPLAY'));
  request uuid := gen_random_uuid(); r jsonb; BEGIN
  r := pg_temp.import(rows,'skip',request);
  PERFORM pg_temp.assert(pg_temp.import(rows,'skip',request)=r,'identical replay');
  PERFORM pg_temp.expect_error(format('SELECT pg_temp.import(%L::jsonb,%L,%L::uuid)',rows::text,'update',request),'22023');
  PERFORM pg_temp.expect_error(format('SELECT pg_temp.import(%L::jsonb,%L,%L::uuid)',
    jsonb_build_array(pg_temp.row('CHANGED'))::text,'skip',request),'22023');
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000011","role":"authenticated"}',false);
  PERFORM pg_temp.assert((SELECT count(*)=0 FROM public.catalog_import_batches),'other actor cannot read receipts');
  PERFORM pg_temp.expect_error(format('SELECT pg_temp.import(%L::jsonb,%L,%L::uuid)',rows::text,'skip',request),'22023');
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000010","role":"authenticated"}',false);
  PERFORM pg_temp.assert((SELECT count(*)=1 FROM public.catalog_import_batches WHERE request_id=request),'owner reads own receipt');
  PERFORM pg_temp.expect_error($s$INSERT INTO public.catalog_import_batches(site_id,request_id,actor_id,payload,result)
    VALUES('00000000-0000-4000-8000-000000000001',gen_random_uuid(),'00000000-0000-4000-8000-000000000010','{}','{}')$s$,'42501');
  PERFORM pg_temp.expect_error($s$UPDATE public.catalog_import_batches SET result='{}'$s$,'42501');
  PERFORM pg_temp.expect_error($s$DELETE FROM public.catalog_import_batches$s$,'42501');
END $$;

-- Transaction rollback removes both receipt and items, so the same request can retry.
BEGIN;
SELECT pg_temp.import(jsonb_build_array(pg_temp.row('ROLLED-BACK')), 'skip', '00000000-0000-4000-8000-000000000090');
ROLLBACK;
SELECT pg_temp.assert(NOT EXISTS(SELECT 1 FROM public.catalog_items WHERE sku='ROLLED-BACK')
  AND NOT EXISTS(SELECT 1 FROM public.catalog_import_batches WHERE request_id='00000000-0000-4000-8000-000000000090'), 'atomic rollback');
SELECT pg_temp.assert(pg_temp.import(jsonb_build_array(pg_temp.row('ROLLED-BACK')), 'skip',
  '00000000-0000-4000-8000-000000000090')->>'created'='1', 'request retry after rollback');
SELECT pg_temp.assert(pg_temp.import(jsonb_build_array(pg_temp.row('ROLLED-BACK')), 'skip',
  '00000000-0000-4000-8000-000000000090')->>'created'='1', 'request replay after commit');
BEGIN ISOLATION LEVEL REPEATABLE READ;
SELECT pg_temp.expect_error($s$SELECT pg_temp.import(jsonb_build_array(pg_temp.row('OLD-SNAPSHOT')))$s$, '25001');
ROLLBACK;

-- Genuine constraint failure rolls back just that row, with no raw error leakage.
RESET ROLE;
ALTER TABLE public.catalog_items ADD CONSTRAINT synthetic_import_failure CHECK (sku <> 'FORCED-FAILURE');
SET ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
  r := pg_temp.import(jsonb_build_array(pg_temp.row('BEFORE-FAIL',2),pg_temp.row('FORCED-FAILURE',3),pg_temp.row('AFTER-FAIL',4)));
  PERFORM pg_temp.assert(r->>'created'='2' AND jsonb_array_length(r->'errors')=1
    AND r->'errors'->0->>'rowNumber'='3' AND r::text NOT LIKE '%synthetic_import_failure%'
    AND r::text NOT LIKE '%FORCED-FAILURE%', 'row subtransaction and redacted error');
END $$;

-- A realistic large import: 100 committed batches x100 rows, each immediately
-- replayed. Unique SKU index and counters prove 10k creates, never 20k writes.
CREATE FUNCTION pg_temp.large_batch(b integer) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r jsonb; rows jsonb; request uuid := gen_random_uuid(); BEGIN
  SELECT jsonb_agg(pg_temp.row('LOAD-'||(b*100+n),b*100+n+1) ORDER BY n)
    INTO rows FROM generate_series(1,100) n;
  r := pg_temp.import(rows,'skip',request);
  PERFORM pg_temp.assert(r->>'created'='100' AND jsonb_array_length(r->'errors')=0
    AND jsonb_array_length(r->'item_ids')=100,'large batch counts');
  PERFORM pg_temp.assert(pg_temp.import(rows,'skip',request)=r,'large replay');
END $$;
SELECT format('SELECT pg_temp.large_batch(%s);', b) FROM generate_series(0,99) b
\gexec
SELECT pg_temp.assert((SELECT count(*)=10000 AND count(DISTINCT sku)=10000
  FROM public.catalog_items WHERE sku LIKE 'LOAD-%'), '10k unique products');
SELECT pg_temp.assert((SELECT count(*)=100 AND sum((result->>'created')::integer)=10000
  FROM public.catalog_import_batches WHERE payload->'rows'->0->'item'->>'sku' LIKE 'LOAD-%'), '100 committed batch receipts');
RESET ROLE;
SELECT pg_temp.assert((SELECT name='Foreign original' FROM public.catalog_items
  WHERE id='00000000-0000-4000-8000-000000000031'),'foreign item unchanged');
SELECT pg_temp.assert((SELECT name='Keep service' FROM public.catalog_items WHERE sku='SERVICE')
  AND (SELECT name='Keep variant' AND parent_id='00000000-0000-4000-8000-000000000030'
    FROM public.catalog_items WHERE sku='VARIANT'),'specialized fields unchanged');
-- Independently deny each command at the existing capability boundary. The real
-- deployed matrix is restored immediately; this checks that update is opt-in
-- even if a future role matrix grants insert but not update.
ALTER FUNCTION public.user_can(uuid,text) RENAME TO catalog_test_original_user_can;
CREATE FUNCTION public.user_can(p_site_id uuid,p_command text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT public.catalog_test_original_user_can(p_site_id,p_command)
    AND current_setting('catalog_test.deny_command',true) IS DISTINCT FROM p_command
$$;
ALTER FUNCTION public.user_can(uuid,text) OWNER TO postgres;
SET ROLE authenticated;
SET catalog_test.deny_command = 'update';
SELECT pg_temp.expect_error($s$SELECT pg_temp.import(jsonb_build_array(pg_temp.row('OLD')), 'update')$s$, '42501');
SELECT pg_temp.assert(pg_temp.import(jsonb_build_array(pg_temp.row('INSERT-WITHOUT-UPDATE')))->>'created'='1', 'skip needs insert not update');
SET catalog_test.deny_command = 'insert';
SELECT pg_temp.expect_error($s$SELECT pg_temp.import(jsonb_build_array(pg_temp.row('NO-INSERT')))$s$, '42501');
SET catalog_test.deny_command = 'select';
SELECT pg_temp.expect_error($s$SELECT pg_temp.import(jsonb_build_array(pg_temp.row('NO-SELECT')))$s$, '42501');
RESET ROLE;
DROP FUNCTION public.user_can(uuid,text);
ALTER FUNCTION public.catalog_test_original_user_can(uuid,text) RENAME TO user_can;
RESET catalog_test.deny_command;
-- Even the original actor loses receipt visibility/replay after site access ends.
UPDATE public.sites SET archived_at=now() WHERE id='00000000-0000-4000-8000-000000000001';
SET ROLE authenticated;
SELECT pg_temp.assert((SELECT count(*)=0 FROM public.catalog_import_batches),'revoked tenant access hides receipts');
SELECT pg_temp.expect_error($s$SELECT pg_temp.import(jsonb_build_array(pg_temp.row('ROLLED-BACK')), 'skip',
  '00000000-0000-4000-8000-000000000090')$s$, '42501');
RESET ROLE;
UPDATE public.sites SET archived_at=NULL WHERE id='00000000-0000-4000-8000-000000000001';
SELECT 'catalog batch import SQL regression passed';