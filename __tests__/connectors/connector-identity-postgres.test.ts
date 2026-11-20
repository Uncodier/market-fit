/** @jest-environment node */
import { isolatedPostgres, migration, postgresAvailable, uuid } from '../security/isolated-postgres'

const suite = postgresAvailable ? describe : describe.skip
const site = uuid(1), owner = uuid(2), member = uuid(3), instance = uuid(4), agent = uuid(5)
suite('connector identity guards in socket-only PostgreSQL', () => {
  const pg = isolatedPostgres(), db = pg.db
  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => {
    db(`DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS auth CASCADE;
      CREATE SCHEMA public; CREATE SCHEMA auth;
      GRANT USAGE ON SCHEMA public,auth TO authenticated,service_role;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
        $$ SELECT (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid $$;
      CREATE TABLE remote_instances(id uuid PRIMARY KEY,site_id uuid,user_id uuid,agent_id uuid,name text);
      CREATE TABLE instance_pending_work(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),instance_id uuid,
        site_id uuid,user_id uuid,message text,status text DEFAULT 'pending');
      CREATE TABLE instance_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),instance_id uuid,
        site_id uuid,user_id uuid,log_type text,trusted_user_action boolean,details jsonb);
      GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated,service_role;
      INSERT INTO remote_instances VALUES ('${instance}','${site}','${owner}',null,'chat');
      INSERT INTO instance_pending_work(instance_id,site_id,user_id,message)
        VALUES ('${instance}','${site}',null,'legacy null'),('${instance}','${site}','${owner}','legacy spoof');
      ALTER TABLE remote_instances ENABLE ROW LEVEL SECURITY;
      ALTER TABLE instance_pending_work ENABLE ROW LEVEL SECURITY;
      ALTER TABLE instance_logs ENABLE ROW LEVEL SECURITY;
      ${['remote_instances','instance_pending_work','instance_logs'].map(table =>
        `CREATE POLICY member_access ON ${table} FOR ALL TO authenticated USING(site_id='${site}') WITH CHECK(site_id='${site}');`).join('\n')}`)
    db(migration('20261119223000_connector_identity_guards.sql'))
  })
  const browser = (sql: string, user = member) => pg.call(sql, user)
  it('rejects browser agent assignment on insert/update but permits NULL chats and normal updates', () => {
    expect(() => browser(`INSERT INTO remote_instances VALUES (gen_random_uuid(),'${site}','${member}','${agent}','spoof')`))
      .toThrow('instance_agent_assignment_server_only')
    expect(() => browser(`UPDATE remote_instances SET agent_id='${agent}' WHERE id='${instance}'`))
      .toThrow('instance_agent_assignment_server_only')
    browser(`INSERT INTO remote_instances VALUES (gen_random_uuid(),'${site}','${member}',null,'new')`)
    browser(`UPDATE remote_instances SET name='renamed' WHERE id='${instance}'`)
    pg.call(`UPDATE remote_instances SET agent_id='${agent}' WHERE id='${instance}'`, owner, 'service_role')
    expect(() => browser(`UPDATE remote_instances SET agent_id=null WHERE id='${instance}'`))
      .toThrow('instance_agent_assignment_server_only')
  })
  it('binds NULL/omitted queue actors to auth.uid, rejects owner spoof and immutable actor/scope reassignment', () => {
    expect(() => browser(`INSERT INTO instance_pending_work(instance_id,site_id,user_id,message)
      VALUES ('${instance}','${site}','${owner}','spoof')`)).toThrow('pending_work_actor_mismatch')
    browser(`INSERT INTO instance_pending_work(instance_id,site_id,message)
      VALUES ('${instance}','${site}','admitted')`)
    expect(db(`SELECT user_id::text||':'||actor_verified FROM instance_pending_work WHERE message='admitted'`))
      .toBe(`${member}:true`)
    for (const update of [`user_id='${owner}'`, `site_id='${uuid(8)}'`, `instance_id='${uuid(9)}'`, 'actor_verified=false']) {
      expect(() => browser(`UPDATE instance_pending_work SET ${update} WHERE message='admitted'`)).toThrow('pending_work_actor_immutable')
    }
    expect(() => browser(`UPDATE instance_pending_work SET message='hijacked' WHERE message='admitted'`, owner))
      .toThrow('pending_work_actor_required')
    expect(db('SELECT count(*) FROM instance_pending_work WHERE NOT actor_verified')).toBe('2')
    expect(() => pg.call(`UPDATE instance_pending_work SET actor_verified=true WHERE NOT actor_verified`, owner, 'service_role'))
      .toThrow('pending_work_actor_immutable')
  })
  it('rejects forged recovery origin and transplantation, preserves server checkpoint writes', () => {
    const fields = `instance_id,site_id,user_id,log_type,trusted_user_action,details`
    const values = `'${instance}','${site}','${member}','user_action',true,'{"assistant_recovery":{"execution":{"callerSource":"interactive"}}}'`
    expect(() => browser(`INSERT INTO instance_logs(${fields}) VALUES (${values})`)).toThrow('assistant_recovery_server_only')
    pg.call(`INSERT INTO instance_logs(${fields}) VALUES (${values})`, owner, 'service_role')
    expect(() => browser(`UPDATE instance_logs SET details='{}'`)).toThrow('assistant_recovery_server_only')
    expect(() => browser(`UPDATE instance_logs SET user_id='${owner}'`)).toThrow('assistant_recovery_server_only')
    pg.call(`UPDATE instance_logs SET details=jsonb_set(details,'{assistant_recovery,execution,callerSource}','"background"')`, owner, 'service_role')
    expect(db(`SELECT details#>>'{assistant_recovery,execution,callerSource}' FROM instance_logs`)).toBe('background')
  })
})