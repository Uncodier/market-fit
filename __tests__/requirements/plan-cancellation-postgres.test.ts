/** @jest-environment node */
import { actorSql, ids, installSiteFixture, isolatedPostgres, migration, postgresAvailable, uuid } from "../security/isolated-postgres"

const suite = postgresAvailable ? describe : describe.skip
const planId = uuid(80), instanceId = uuid(81), requirementId = uuid(82), otherInstance = uuid(83)
const cancel = `SELECT public.cancel_quiescent_instance_plan('${planId}','${instanceId}')`
suite("quiescent plan cancellation in disposable PostgreSQL", () => {
  const pg = isolatedPostgres(), db = pg.db
  const row = () => db(`SELECT to_jsonb(p) FROM instance_plans p WHERE id='${planId}'`)
  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => {
    installSiteFixture(db)
    db(`CREATE TABLE remote_instances(id uuid PRIMARY KEY,site_id uuid,status text,metadata jsonb DEFAULT '{}',configuration jsonb DEFAULT '{}',provider_instance_id text);
      CREATE TABLE instance_plans(id uuid PRIMARY KEY,instance_id uuid,site_id uuid,status text,steps jsonb,
        metadata jsonb DEFAULT '{}',updated_at timestamptz DEFAULT now(),completed_at timestamptz,completion_reason text);
      CREATE TABLE requirements(id uuid PRIMARY KEY,site_id uuid,metadata jsonb DEFAULT '{}',cron_lock_active boolean DEFAULT false,
        cron_lock_run_id text,cron_lock_expires_at timestamptz);
      CREATE TABLE instance_logs(id uuid,instance_id uuid,log_type text,details jsonb);
      CREATE TABLE instance_nodes(instance_id uuid,status text);
      CREATE TABLE workflow_runs(instance_id uuid,status text);
      CREATE TABLE workflow_triggers(instance_id uuid,enabled boolean);
      CREATE TABLE requirement_migration_diagnostics(requirement_id uuid,state text);
      CREATE TABLE requirement_status(id uuid,requirement_id uuid,stage text,active_sandbox_id text,updated_at timestamptz);
      CREATE TABLE harness_sessions(id uuid,snapshot jsonb,lease_owner text,lease_expires_at timestamptz);
      CREATE TABLE harness_requirement_runs(requirement_id uuid,session_id uuid);
      GRANT SELECT,UPDATE ON ALL TABLES IN SCHEMA public TO postgres;
      CREATE FUNCTION robot_instance_requirement_candidates(p_instance_id uuid) RETURNS uuid[] LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
        SELECT COALESCE(array_agg(id ORDER BY id),'{}'::uuid[]) FROM public.requirements
        WHERE metadata->>'runner_instance_id'=p_instance_id::text $$;
      ALTER FUNCTION robot_instance_requirement_candidates(uuid) OWNER TO postgres;
      REVOKE ALL ON FUNCTION robot_instance_requirement_candidates(uuid) FROM PUBLIC,anon,authenticated,service_role;
      INSERT INTO remote_instances VALUES('${instanceId}','${ids.site}','paused','{}','{}',null),
        ('${otherInstance}','${ids.otherSite}','stopped','{}','{}',null);
      INSERT INTO requirements(id,site_id,metadata) VALUES('${requirementId}','${ids.site}',jsonb_build_object('runner_instance_id','${instanceId}'));
      INSERT INTO instance_plans(id,instance_id,site_id,status,steps) VALUES('${planId}','${instanceId}','${ids.site}','paused',
        '[{"id":"step_1","status":"in_progress","started_at":"2026-10-13T02:18:43Z","actual_output":"preserved"},
          {"id":"step_2","status":"pending"},{"id":"step_3","status":"completed","actual_output":"done"},
          {"id":"step_4","status":"failed","error_message":"historical"}]');
      ALTER TABLE instance_plans ENABLE ROW LEVEL SECURITY;
      GRANT SELECT ON instance_plans TO authenticated;
      CREATE POLICY visible_plans ON instance_plans FOR SELECT TO authenticated USING(public.current_user_site_role(site_id) IS NOT NULL);`)
    db(migration("20261020000000_cancel_quiescent_instance_plan.sql"))
    db("ALTER FUNCTION cancel_quiescent_instance_plan(uuid,uuid) OWNER TO postgres;")
  })
  it.each([ids.owner,ids.admin,ids.coOwner])("atomically cancels unfinished steps as manager %s, preserving history", user => {
    const before = JSON.parse(row())
    const result = JSON.parse(pg.call(cancel,user))
    expect(result).toEqual({ plan_id: planId,instance_id: instanceId,status: "cancelled",steps_cancelled: 2 })
    const after = JSON.parse(row())
    expect(after.status).toBe("cancelled")
    expect(after.steps[0]).toMatchObject({ ...before.steps[0],status: "cancelled",cancellation_reason: "Cancelled by project manager" })
    expect(after.steps.slice(2)).toEqual(before.steps.slice(2))
    expect(after.completed_at).toBeTruthy()
    const snapshot = row()
    expect(JSON.parse(pg.call(cancel,user)).steps_cancelled).toBe(0)
    expect(row()).toBe(snapshot)
    expect(() => db(`UPDATE instance_plans SET status='in_progress' WHERE id='${planId}'`)).toThrow("Cancelled plans cannot be resumed")
    expect(() => db(`UPDATE instance_plans SET steps='[{"id":"late","status":"in_progress"}]' WHERE id='${planId}'`)).toThrow("evidence is immutable")
    expect(() => db(`UPDATE instance_plans SET steps='[{"id":"late","status":"completed"}]' WHERE id='${planId}'`)).toThrow("evidence is immutable")
  })
  it.each([ids.collaborator,ids.marketing,ids.inactive,ids.foreign])("denies actor %s without changes", user => {
    const before = row()
    expect(() => pg.call(cancel,user)).toThrow("owner or administrator")
    expect(row()).toBe(before)
  })
  it("denies anonymous/service roles, wrong instance and denied update capability", () => {
    for (const role of ["anon","service_role"]) expect(() => pg.call(cancel,ids.owner,role)).toThrow("permission denied")
    expect(() => pg.call(cancel.replace(instanceId,otherInstance))).toThrow("Plan not found")
    db(`CREATE OR REPLACE FUNCTION user_can(p_site_id uuid,p_command text) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$`)
    expect(() => pg.call(cancel)).toThrow("update permission")
  })
  it.each([
    `UPDATE remote_instances SET status='running'`,
    `UPDATE remote_instances SET status='uninstantiated'`,
    `UPDATE remote_instances SET provider_instance_id='provider'`,
    `UPDATE remote_instances SET metadata='{"active_sandbox_id":"sandbox"}'`,
    `UPDATE requirements SET cron_lock_active=true`,
    `UPDATE requirements SET cron_lock_expires_at=now()-interval '1 day'`,
    `UPDATE requirements SET cron_lock_run_id='persisted'`,
    `INSERT INTO instance_logs VALUES('${uuid(90)}','${instanceId}','user_action','{"status":"running"}')`,
    `INSERT INTO instance_nodes VALUES('${instanceId}','running')`,
    `INSERT INTO workflow_runs VALUES('${instanceId}','pending')`,
    `INSERT INTO workflow_triggers VALUES('${instanceId}',true)`,
    `INSERT INTO requirement_migration_diagnostics VALUES('${requirementId}','running')`,
    `INSERT INTO requirement_status VALUES('${uuid(91)}','${requirementId}','running','sandbox',now())`,
    `INSERT INTO harness_requirement_runs VALUES('${requirementId}','${uuid(92)}'); INSERT INTO harness_sessions VALUES('${uuid(92)}','{"status":"running"}',null,null)`,
    `UPDATE instance_plans SET steps='[{"id":"step_1","status":"in_progress","sandbox_id":"sandbox"}]'`,
    `UPDATE instance_plans SET metadata='{"workflow_template":true}'`,
    `UPDATE instance_plans SET steps='{"not":"an array"}'`,
    `INSERT INTO instance_plans(id,instance_id,site_id,status,metadata) VALUES('${uuid(94)}','${instanceId}','${ids.site}','paused','{"active_sandbox_id":"sibling-sandbox"}')`,
    `INSERT INTO instance_plans(id,instance_id,site_id,status,steps) VALUES('${uuid(94)}','${instanceId}','${ids.site}','paused','[{"id":"sibling","status":"in_progress","sandbox_id":"sibling-sandbox"}]')`,
  ])("fails closed on persisted execution or incompatible plan: %s", seed => {
    db(seed)
    const before = row()
    expect(() => pg.call(cancel)).toThrow()
    expect(row()).toBe(before)
  })
  it("rolls back a trigger-rejected write and keeps deletion's active-step guard unchanged", () => {
    db(`CREATE FUNCTION reject_plan() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'rejected'; END $$;
      CREATE TRIGGER reject_plan BEFORE UPDATE ON instance_plans FOR EACH ROW EXECUTE FUNCTION reject_plan();`)
    const before = row()
    expect(() => pg.call(cancel)).toThrow("rejected")
    expect(row()).toBe(before)
    const source = migration("20261020000000_cancel_quiescent_instance_plan.sql")
    expect(source).not.toMatch(/DELETE FROM|DISABLE TRIGGER|CREATE OR REPLACE FUNCTION public.get_robot_instance_deletion_scope/)
  })
  it("explicitly adopts an already backend-cancelled plan into protected manager cancellation", () => {
    db(`UPDATE instance_plans SET status='cancelled',steps='[{"id":"done","status":"completed"}]',completion_reason='Backend cancellation'`)
    expect(JSON.parse(pg.call(cancel)).steps_cancelled).toBe(0)
    expect(JSON.parse(row()).completion_reason).toBe("Cancelled by project manager")
    expect(() => db(`UPDATE instance_plans SET status='in_progress'`)).toThrow("cannot be resumed")
  })
  it("rejects a trigger-rewritten result rather than issuing a false success receipt", () => {
    db(`CREATE FUNCTION rewrite_plan() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.status:='paused'; RETURN NEW; END $$;
      CREATE TRIGGER z_rewrite_plan BEFORE UPDATE ON instance_plans FOR EACH ROW EXECUTE FUNCTION rewrite_plan();`)
    const before = row()
    expect(() => pg.call(cancel)).toThrow("receipt mismatch")
    expect(row()).toBe(before)
  })
  it("waits for the instance fence and rejects concurrent execution start without overwriting steps", async () => {
    const before = row()
    const holder = pg.concurrent(`BEGIN; UPDATE remote_instances SET status='running' WHERE id='${instanceId}'; SELECT pg_sleep(0.4); COMMIT;`)
    await new Promise(resolve => setTimeout(resolve,100))
    const result = pg.concurrent(actorSql(cancel))
    const rejection = expect(result).rejects.toThrow("Stop and reconcile")
    await Promise.all([holder,rejection])
    expect(row()).toBe(before)
  })
})