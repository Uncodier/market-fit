/** @jest-environment node */
import { randomBytes } from 'node:crypto'
import { isolatedPostgres, postgresAvailable, uuid } from '../security/isolated-postgres'
import { id, sqlSource } from './connector-postgres-fixture'
import { enableDirect, installProviderDirect, instance, issueDirect } from './provider-direct-fixture'

const migration = '20261123020000_connector_direct_receipts.sql'
const heads = 'connector_result_private.direct_turn_heads', submissions = 'connector_result_private.direct_ask_submissions'
;(postgresAvailable ? describe : describe.skip)('trusted Ask admission fences in socket-only PostgreSQL', () => {
  const pg = isolatedPostgres(), db = pg.db
  const first = uuid(650), second = uuid(651)
  const record = (key:string, marked = false, type='user_action') => `INSERT INTO instance_logs
    (id,instance_id,site_id,user_id,log_type,trusted_user_action,details)
    VALUES ('${key}','${instance}','${id.site}','${id.admin}','${type}',true,
    '${JSON.stringify({status:'running',...(marked && {ask_request_sha256:randomBytes(32).toString('hex')})})}')`
  const service = (s:string) => db(`SET ROLE service_role; ${s}`)
  const head = () => db(`SELECT action_id FROM ${heads}`)

  beforeAll(() => pg.start(),30000)
  afterAll(pg.stop)
  beforeEach(() => {
    installProviderDirect(db)
    db(`ALTER TABLE remote_instances ADD COLUMN agent_id uuid;
      CREATE TABLE instance_pending_work(id uuid PRIMARY KEY, instance_id uuid,site_id uuid,user_id uuid);
      CREATE TABLE instance_logs(id uuid PRIMARY KEY,instance_id uuid REFERENCES remote_instances(id) ON DELETE CASCADE,
        site_id uuid,user_id uuid,agent_id uuid,log_type text,trusted_user_action boolean NOT NULL DEFAULT false,details jsonb,
        message text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT clock_timestamp());
      GRANT ALL ON instance_logs TO anon,authenticated,service_role;`)
    db(sqlSource('20261119223000_connector_identity_guards.sql')); db(sqlSource(migration,'makinari-db-scheme'))
  },30000)

  it('does not register historical/unenrolled turns; deleting a later action never makes the earlier one current', () => {
    service(record(uuid(648))); expect(head()).toBe('')
    issueDirect(db); enableDirect(db); expect(head()).toBe('')
    service(record(first)); service(record(second)); expect(head()).toBe(second)
    service(`DELETE FROM instance_logs WHERE id='${second}'`); expect(head()).toBe(second)
    service(record(uuid(652),false,'agent_action')); expect(head()).toBe(second)
    expect(db(`SELECT count(*) FROM ${submissions}`)).toBe('0')
  })

  it('a reservation waiting on a newer action sees the new slot, not the stale pre-wait row', async () => {
    issueDirect(db); enableDirect(db); service(record(first))
    const holder = pg.concurrent(`SET ROLE service_role; BEGIN; ${record(second)}; SELECT pg_advisory_xact_lock(65601); SELECT pg_sleep(0.6); COMMIT;`)
    try {
      let ready = false
      for (let i=0;i<40 && !ready;i++) {
        ready = db('SELECT NOT pg_try_advisory_lock(65601)')==='t'
        if (!ready) await new Promise(resolve=>setTimeout(resolve,10))
      }
      expect(ready).toBe(true)
      expect(await pg.concurrent(`SELECT action_id FROM ${heads} WHERE instance_id='${instance}' AND action_id='${first}' FOR SHARE`)).toBe('')
    } finally { await holder }
    expect(head()).toBe(second)
  })

  it('retains only an opaque request ID across log and parent erasure, without allowing a repeated admission', async () => {
    const sql = record(first,true)
    const batch = await Promise.allSettled(Array.from({length:4},()=>pg.concurrent(`SET ROLE service_role; ${sql}`)))
    expect(batch.filter(r=>r.status==='fulfilled')).toHaveLength(1)
    expect(db(`SELECT action_id FROM ${submissions}`)).toBe(first)
    pg.call(`UPDATE instance_logs SET details=jsonb_set(details,'{status}','"cancelled"') WHERE id='${first}'`,id.admin)
    expect(() => pg.call(`UPDATE instance_logs SET details='{}' WHERE id='${first}'`,id.admin)).toThrow(/insufficient_privilege/)
    expect(() => pg.call(record(second,true),id.admin)).toThrow(/insufficient_privilege/)
    db(`DELETE FROM remote_instances WHERE id='${instance}'; INSERT INTO remote_instances(id,site_id,user_id) VALUES ('${instance}','${id.site}','${id.admin}')`)
    expect(() => service(sql)).toThrow(/duplicate key/)
    expect(db('SELECT count(*) FROM instance_logs')).toBe('0')
    expect(db(`SELECT count(*) FROM ${submissions}`)).toBe('1')
    for (const r of ['anon','authenticated','service_role','connector_result_reader']) {
      expect(db(`SELECT has_table_privilege('${r}','${submissions}','SELECT,INSERT,DELETE,TRUNCATE') OR has_table_privilege('${r}','${heads}','SELECT,INSERT,DELETE,TRUNCATE')`)).toBe('f')
    }
  })
})