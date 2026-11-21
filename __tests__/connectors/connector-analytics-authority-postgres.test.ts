/** @jest-environment node */
import { isolatedPostgres, postgresAvailable, uuid } from '../security/isolated-postgres'
import { id, sqlSource } from './connector-postgres-fixture'
import { analyticsMigrations,binding,connector,installAnalytics,instance,project } from './connector-analytics-fixture'

const scopeArgs = (scope='workspace',source='paid_sales') => `'${project}','${scope}','${source}'`
const ready = (scope='workspace',source='paid_sales',base=binding) => `SELECT public.connector_analytics_result_ready(${base},${scopeArgs(scope,source)})`
const store = (scope='workspace',source='paid_sales',epoch='NULL') => `SELECT public.store_connector_analytics_result(${binding},'v1','${'a'.repeat(64)}','{"rows":[]}',${scopeArgs(scope,source)},${epoch})`
const grant = `INSERT INTO connector_result_private.analytics_grants(site_id,user_id,connector_id,agent_id,project_ref,expires_at)
  VALUES ('${id.site}','${id.admin}','${connector}','${id.agent}','${project}',now()+interval '1 day') RETURNING id`
;(postgresAvailable ? describe : describe.skip)('source and private-result authorization in socket-only synthetic PostgreSQL', () => {
  const pg = isolatedPostgres(), db = pg.db
  const service = (q:string) => pg.call(q,id.owner,'service_role')
  const user = (q:string,who=id.admin) => db(`SET ROLE authenticated; SET request.jwt.claims='${JSON.stringify({sub:who,is_anonymous:false})}'; ${q}`)
  beforeAll(() => { pg.start(); db('CREATE ROLE supabase_read_only_user;') },30000); afterAll(pg.stop)
  beforeEach(() => installAnalytics(db),30000)

  it('only authorizes native procurement for owner/admin-equivalent users; role changes gate existing private reports', () => {
    expect(JSON.parse(service(ready()))).toEqual({allowed:true,grant_id:null})
    const receipt = service(store('workspace','tender_awards'))
    db(`UPDATE site_members SET role='collaborator' WHERE user_id='${id.admin}'`)
    expect(JSON.parse(service(ready('workspace','tender_awards'))).allowed).toBe(false)
    expect(user(`SELECT public.read_connector_private_result('${receipt}')`)).toBe(''); expect(JSON.parse(service(ready())).allowed).toBe(true)
  })

  it('rejects missing, mismatched, expired, revoked and replaced platform grants on admission, store and old/private reads', () => {
    expect(JSON.parse(service(ready('platform')))).toEqual({allowed:false,grant_id:null})
    expect(() => service(store('platform'))).toThrow()
    const grantId = db(grant), epoch = `'${grantId}'`
    expect(JSON.parse(service(ready('platform')))).toEqual({allowed:true,grant_id:grantId})
    for (const bad of [binding.replace(id.admin,id.member),binding.replace(id.site,id.otherSite),binding.replace(id.agent,id.otherAgent),
      binding.replace(instance,uuid(88)),binding.replace(connector,id.hidden)]) expect(JSON.parse(service(ready('platform','paid_sales',bad))).allowed).toBe(false)
    expect(JSON.parse(service(ready('platform').replace(project,'b'.repeat(20)))).allowed).toBe(false)
    expect(() => service(store('platform','paid_sales',`'${uuid(89)}'`))).toThrow()
    const receipt = service(store('platform','paid_sales',epoch)), other = service(store())
    const read = `SELECT public.read_connector_private_result('${receipt}')`, list = 'SELECT id FROM public.list_connector_private_results()'
    expect(user(read)).toBe('{"rows": []}'); expect(user(list).split('\n')).toEqual([other,receipt]); expect(user(read,id.owner)).toBe('')
    db(`UPDATE connector_result_private.analytics_grants SET revoked_at=now() WHERE id=${epoch}`)
    expect(user(read)).toBe(''); expect(user(list)).toBe(other)
    expect(() => db(`UPDATE connector_result_private.analytics_grants SET revoked_at=NULL WHERE id=${epoch}`)).toThrow()
    const newEpoch = db(grant); expect(newEpoch).not.toBe(grantId); expect(() => service(store('platform','paid_sales',epoch))).toThrow()
    expect(user(read)).toBe(''); expect(user(list)).toBe(other)
    db('UPDATE connector_result_private.analytics_grants SET revoked_at=now() WHERE revoked_at IS NULL')
    db(grant.replace("interval '1 day'", "interval '800 milliseconds'")); const expires = JSON.parse(service(ready('platform'))).grant_id
    const expiring = service(store('platform','paid_sales',`'${expires}'`)); db('SELECT pg_sleep(0.85)')
    expect(JSON.parse(service(ready('platform'))).allowed).toBe(false); expect(user(`SELECT public.read_connector_private_result('${expiring}')`)).toBe('')
    expect(user(list)).toBe(other)
  })

  it('never grants lower roles entitlement DML or a way to override private RPC ownership', () => {
    for (const role of ['anon','authenticated','service_role','supabase_read_only_user','connector_result_reader']) {
      expect(() => db(`SET ROLE ${role}; ${grant}`)).toThrow(/permission denied/)
      expect(() => db(`SET ROLE ${role}; UPDATE connector_result_private.analytics_grants SET revoked_at=NULL`)).toThrow(/permission denied/)
      if (role !== 'service_role') for (const q of [ready(),store()]) expect(() => db(`SET ROLE ${role}; ${q}`)).toThrow(/permission denied/)
    }
    // Upstream management role may read tables via out-of-band DBA/PAT access. This feature
    // neither confers nor revokes those rights. A grant UUID is NOT a read/write capability.
    db('ALTER ROLE supabase_read_only_user BYPASSRLS; GRANT pg_read_all_data TO supabase_read_only_user')
    const epoch=db(grant)
    expect(db('SET ROLE supabase_read_only_user; SELECT id FROM connector_result_private.analytics_grants')).toBe(epoch)
    expect(() => db(`SET ROLE supabase_read_only_user; ${store('platform','paid_sales',`'${epoch}'`)}`)).toThrow(/permission denied/)
    expect(() => db(`SET ROLE supabase_read_only_user; ${grant}`)).toThrow(/permission denied/)
  })

  it('does not borrow a grant from another otherwise-admitted owner or active prompt agent', () => {
    db(grant)
    const secondInstance=uuid(901), secondAgent=uuid(902)
    db(`INSERT INTO remote_instances VALUES ('${secondInstance}','${id.site}','${id.member}');
      INSERT INTO agents(id,site_id,status) VALUES ('${secondAgent}','${id.site}','active');`)
    for (const b of [binding.replace(instance,secondInstance).replace(id.admin,id.member),binding.replace(id.agent,secondAgent)]) {
      expect(JSON.parse(service(ready('workspace','paid_sales',b))).allowed).toBe(true)
      expect(JSON.parse(service(ready('platform','paid_sales',b)))).toEqual({allowed:false,grant_id:null})
    }
  })
})
test('all direct analytics migrations match the canonical checked-in bytes', () => {
  for (const m of analyticsMigrations) for (const repo of ['API','market-fit']) expect(sqlSource(m,repo)).toBe(sqlSource(m,'makinari-db-scheme'))
})