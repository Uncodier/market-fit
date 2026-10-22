BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Small transactional indexes for the inspected Makinari workload. No data
-- backfill, policy changes or redundant global timestamp indexes.
CREATE INDEX IF NOT EXISTS requirement_status_site_requirement_recent_idx
  ON public.requirement_status (site_id, requirement_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS sale_orders_site_created_recent_idx
  ON public.sale_orders (site_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS sale_orders_site_updated_recent_idx
  ON public.sale_orders (site_id, updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS reservations_site_time_window_idx
  ON public.reservations (site_id, start_time, id) INCLUDE (end_time);
CREATE INDEX IF NOT EXISTS tasks_site_status_kanban_idx
  ON public.tasks (site_id, status, priority DESC, scheduled_date ASC, id);
CREATE INDEX IF NOT EXISTS tasks_site_scheduled_window_idx
  ON public.tasks (site_id, scheduled_date, id) WHERE scheduled_date IS NOT NULL;

-- IF NOT EXISTS alone must not silently bless an unrelated pre-existing index.
DO $verify$
DECLARE expected record; actual record;
BEGIN
  FOR expected IN SELECT * FROM (VALUES
    ('requirement_status_site_requirement_recent_idx','requirement_status',
      ARRAY['site_id','requirement_id','created_at','id'], ARRAY[0,0,3,3]::smallint[],NULL::text),
    ('sale_orders_site_created_recent_idx','sale_orders',
      ARRAY['site_id','created_at','id'], ARRAY[0,3,3]::smallint[],NULL::text),
    ('sale_orders_site_updated_recent_idx','sale_orders',
      ARRAY['site_id','updated_at','id'], ARRAY[0,3,3]::smallint[],NULL::text),
    ('reservations_site_time_window_idx','reservations',
      ARRAY['site_id','start_time','id','end_time'], ARRAY[0,0,0]::smallint[],NULL::text),
    ('tasks_site_status_kanban_idx','tasks',
      ARRAY['site_id','status','priority','scheduled_date','id'], ARRAY[0,0,3,0,0]::smallint[],NULL::text),
    ('tasks_site_scheduled_window_idx','tasks',
      ARRAY['site_id','scheduled_date','id'], ARRAY[0,0,0]::smallint[],'(scheduled_date IS NOT NULL)'::text)
  ) AS definitions(name,table_name,columns,options,predicate) LOOP
    SELECT i.*, am.amname,
      ARRAY(SELECT a.attname::text FROM unnest(i.indkey::smallint[]) WITH ORDINALITY k(attnum,n)
        JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum ORDER BY k.n) AS columns,
      pg_get_expr(i.indpred,i.indrelid) AS predicate INTO actual
    FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
    JOIN pg_am am ON am.oid=c.relam
    WHERE c.oid=to_regclass('public.'||expected.name);
    IF NOT FOUND OR actual.indrelid<>to_regclass('public.'||expected.table_name)
      OR NOT actual.indisvalid OR NOT actual.indisready OR actual.indisunique
      OR actual.amname<>'btree' OR actual.indexprs IS NOT NULL
      OR actual.columns IS DISTINCT FROM expected.columns
      OR ARRAY(SELECT option FROM unnest(actual.indoption::smallint[]) option) IS DISTINCT FROM expected.options
      OR actual.predicate IS DISTINCT FROM expected.predicate THEN
      RAISE EXCEPTION 'Unexpected operational read index %',expected.name;
    END IF;
  END LOOP;
END;
$verify$;
COMMIT;