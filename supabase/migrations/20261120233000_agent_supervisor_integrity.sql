BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL search_path = pg_catalog, pg_temp;

-- Install atomically with respect to DML. No agents scan, validation or backfill.
LOCK TABLE public.agents IN SHARE ROW EXCLUSIVE MODE;
DO $preflight$
DECLARE
  agent_id smallint;
  parent_id smallint;
BEGIN
  SELECT attnum INTO STRICT agent_id FROM pg_attribute WHERE attrelid = 'public.agents'::regclass
    AND attname = 'id' AND atttypid = 'uuid'::regtype AND attnotnull AND NOT attisdropped;
  SELECT attnum INTO STRICT parent_id FROM pg_attribute WHERE attrelid = 'public.agents'::regclass
    AND attname = 'supervisor' AND atttypid = 'uuid'::regtype AND NOT attnotnull AND NOT attisdropped;
  IF NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid = 'public.agents'::regclass
      AND attname = 'site_id' AND atttypid = 'uuid'::regtype AND attnotnull AND NOT attisdropped)
    OR NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid = 'public.agents'::regclass
      AND confrelid = conrelid AND contype = 'f' AND conname = 'agents_supervisor_fkey'
      AND conkey = ARRAY[parent_id] AND confkey = ARRAY[agent_id]
      AND NOT condeferrable AND convalidated AND confupdtype = 'a' AND confdeltype = 'a')
    OR NOT EXISTS (SELECT FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
      WHERE i.indrelid = 'public.agents'::regclass AND i.indisvalid AND i.indisready AND i.indislive
        AND i.indkey[0] = parent_id AND i.indpred IS NULL AND c.relam = (SELECT oid FROM pg_am WHERE amname = 'btree')) THEN
    RAISE EXCEPTION 'Agent hierarchy guard requires the canonical site, supervisor FK and supervisor index';
  END IF;
END;
$preflight$;

CREATE SCHEMA agent_hierarchy_private;
REVOKE ALL ON SCHEMA agent_hierarchy_private FROM PUBLIC, anon, authenticated, service_role;

-- The DML lock waits for writers, not for transactions with older read views.
-- An immutable marker tells fixed snapshots whether all pre-guard writes are
-- visible. No scan/seed of sites or agents and no global lock on later writes.
CREATE TABLE agent_hierarchy_private.install_marker (installed boolean PRIMARY KEY CHECK (installed));
REVOKE ALL ON agent_hierarchy_private.install_marker FROM PUBLIC, anon, authenticated, service_role;
INSERT INTO agent_hierarchy_private.install_marker VALUES (true);

-- One lazily created MVCC witness per affected site, never a copy of the graph.
CREATE TABLE agent_hierarchy_private.site_fences (
  site_id uuid PRIMARY KEY REFERENCES public.sites(id) ON DELETE CASCADE,
  generation boolean NOT NULL DEFAULT false
);
REVOKE ALL ON agent_hierarchy_private.site_fences FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION agent_hierarchy_private.check_supervisor() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
SET row_security = off
AS $guard$
DECLARE
  old_site uuid;
  new_site uuid;
  scope uuid;
  parent_found boolean;
  reached_root boolean;
BEGIN
  IF current_setting('transaction_isolation') IN ('repeatable read', 'serializable') THEN
    IF NOT EXISTS (SELECT FROM agent_hierarchy_private.install_marker) THEN
      RAISE EXCEPTION 'Agent hierarchy guard changed; retry the transaction' USING ERRCODE = '40001';
    END IF;
  END IF;
  IF TG_OP <> 'INSERT' THEN old_site := OLD.site_id; END IF;
  IF TG_OP <> 'DELETE' THEN
    new_site := NEW.site_id;
  ELSIF NOT EXISTS (SELECT FROM public.sites WHERE id = old_site) THEN
    -- Site deletion cascades both the agents and the witness. Don't recreate it.
    RETURN NULL;
  END IF;

  -- A new UUID normally has no children. ON DELETE/UPDATE NO ACTION also
  -- permits removing and reinserting the *same* UUID in one SQL command: the
  -- replacement must not inherit another site's children, even if it is a root.
  IF TG_OP = 'INSERT' AND NEW.supervisor IS NULL THEN
    IF NOT EXISTS (SELECT FROM ONLY public.agents a WHERE a.supervisor = NEW.id) THEN RETURN NULL; END IF;
  END IF;

  -- The quoted C prefix sorts before PostgreSQL's RI_* AFTER triggers: do not wait on an FK row
  -- lock before trying this fence. Never queue for a fence while holding agent
  -- tuples (including multi-site / multi-statement writes). A hash collision
  -- can cause a retry but cannot allow conflicting writes to pass.
  FOR scope IN SELECT DISTINCT s FROM unnest(ARRAY[old_site, new_site]) s WHERE s IS NOT NULL ORDER BY s LOOP
    IF NOT pg_try_advisory_xact_lock(hashtextextended('agent-supervisor:' || scope::text, 0)) THEN
      RAISE EXCEPTION 'Concurrent agent hierarchy change; retry the transaction' USING ERRCODE = '40001';
    END IF;
    -- An advisory lock alone cannot refresh a REPEATABLE READ snapshot. A real
    -- write detects an intervening commit even on first use of a site's fence.
    INSERT INTO agent_hierarchy_private.site_fences AS f (site_id) VALUES (scope)
      ON CONFLICT (site_id) DO UPDATE SET generation = NOT f.generation;
  END LOOP;

  -- A delete/reinsert of one UUID is also a move. Fence the deleted row's
  -- site even when this snapshot cannot see a newly committed child there.
  IF TG_OP = 'DELETE' THEN RETURN NULL; END IF;

  -- The AFTER row event sees the statement's final graph, including siblings
  -- inserted/rewired by the same command. Only inserts/moves/identity changes
  -- need to examine incoming edges (using the existing index on supervisor).
  IF TG_OP = 'INSERT' OR NEW.site_id <> OLD.site_id OR NEW.id <> OLD.id THEN
    IF EXISTS (SELECT FROM ONLY public.agents a WHERE a.supervisor = NEW.id AND a.site_id <> NEW.site_id) THEN
      RAISE EXCEPTION 'Invalid agent supervisor hierarchy' USING ERRCODE = '23514', CONSTRAINT = 'agents_supervisor_hierarchy';
    END IF;
  END IF;

  IF NEW.supervisor IS NOT NULL THEN
    -- Follow one indexed parent at a time. A changed edge must reach a root in
    -- at most 128 ancestors; never follow or return another tenant's graph.
    -- Require positive evidence in this snapshot. A later FK lookup at READ
    -- COMMITTED can see a newly committed root but cannot validate its site.
    WITH RECURSIVE ancestors(parent, site, visited, repeated) AS (
      SELECT a.supervisor, a.site_id, ARRAY[a.id], a.id = NEW.id
        FROM ONLY public.agents a WHERE a.id = NEW.supervisor
      UNION ALL
      SELECT a.supervisor, a.site_id, w.visited || a.id, a.id = NEW.id OR a.id = ANY(w.visited)
        FROM ancestors w JOIN ONLY public.agents a ON a.id = w.parent
        WHERE w.site = NEW.site_id AND NOT w.repeated AND cardinality(w.visited) < 128
    ) SELECT EXISTS (SELECT FROM ancestors),
        EXISTS (SELECT FROM ancestors WHERE site = NEW.site_id AND NOT repeated AND parent IS NULL)
      INTO parent_found, reached_root;
    IF NOT parent_found THEN
      RAISE EXCEPTION 'Agent supervisor does not exist' USING ERRCODE = '23503', CONSTRAINT = 'agents_supervisor_fkey';
    END IF;
    IF NOT reached_root THEN
      RAISE EXCEPTION 'Invalid agent supervisor hierarchy' USING ERRCODE = '23514', CONSTRAINT = 'agents_supervisor_hierarchy';
    END IF;
  END IF;
  RETURN NULL;
END;
$guard$;
REVOKE ALL ON FUNCTION agent_hierarchy_private.check_supervisor() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER "Check_agent_supervisor_delete" AFTER DELETE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION agent_hierarchy_private.check_supervisor();
CREATE TRIGGER "Check_agent_supervisor_insert" AFTER INSERT ON public.agents
  FOR EACH ROW EXECUTE FUNCTION agent_hierarchy_private.check_supervisor();
CREATE TRIGGER "Check_agent_supervisor_update" AFTER UPDATE ON public.agents
  FOR EACH ROW WHEN (OLD.supervisor IS DISTINCT FROM NEW.supervisor OR OLD.site_id IS DISTINCT FROM NEW.site_id
    OR OLD.id IS DISTINCT FROM NEW.id) EXECUTE FUNCTION agent_hierarchy_private.check_supervisor();

COMMIT;