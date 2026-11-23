/** @jest-environment node */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { isolatedPostgres, postgresAvailable, uuid } from '../security/isolated-postgres'
import { accessSql, codeRoot, finalizeSql, id, sqlSource } from './connector-postgres-fixture'
import { binding, connector as analytics } from './connector-analytics-fixture'
import { direct, installProviderDirect, instance, issueDirect, issueSql, revision } from './provider-direct-fixture'
import { installDirectReceipts } from './provider-direct-receipt-fixture'

const file = '20261123140000_connector_explicit_agent_grants.sql', canonical = 'makinari-db-scheme'
const probe = (repo: string) => readFileSync(path.join(codeRoot, repo, 'supabase/tests', file), 'utf8')
const turn = uuid(1400), future = uuid(1401)
const grant = (account: string, agent = id.agent, rev = 1, actor = id.owner) =>
  accessSql([], [{agent_id: agent, enabled: true}], rev, actor, account)

test('both local mirrors match the canonical migration and PostgreSQL probe', () => {
  for (const repo of ['market-fit', 'API']) {
    expect(sqlSource(file, repo)).toBe(sqlSource(file, canonical)); expect(probe(repo)).toBe(probe(canonical))
  }
})

if (process.env.REQUIRE_REAL_POSTGRES === '1' && !postgresAvailable) throw Error('Real PostgreSQL required')
;(postgresAvailable ? describe : describe.skip)('explicit agent grants on disposable PostgreSQL', () => {
  const pg = isolatedPostgres(), db = pg.db, service = (sql: string) => db(`SET ROLE service_role; ${sql}`)
  const apply = () => db(sqlSource(file, canonical))
  const compare = (agent = id.agent) => JSON.parse(db(Object.entries({site:id.site, agent, account:direct,
    member:id.admin, instance}).map(([k,v]) => `\\set ${k} '${v}'`).join('\n') + '\n' + probe(canonical)))
  const claim = (digest: string) => service(`SELECT public.connector_claim_support_dispatch('${id.site}','${id.agent}',
    '${id.admin}','${turn}','${direct}','CRM_LIST_DEALS',repeat('${digest}',64))`)
  beforeAll(pg.start, 30000); afterAll(pg.stop)
  beforeEach(() => {
    installProviderDirect(db); installDirectReceipts(db)
    for (const migration of ['20261121012000_connector_creation_catalog_reads.sql','20261123030000_connector_ask_on_connect.sql',
      '20261123040000_connector_instance_member_authority.sql','20261123041000_connector_instance_scoped_reads.sql',
      '20261123080000_connector_instance_report_sources.sql','20261123090000_retire_instance_scoped_report.sql',
      '20261123100000_connector_policy_save_with_ask.sql','20261123110000_connector_instance_member_policy.sql']) db(sqlSource(migration))
    db(`ALTER TABLE agents ADD COLUMN role text; UPDATE agents SET role='Customer Support';
      CREATE TABLE conversations(id uuid PRIMARY KEY,site_id uuid,agent_id uuid,user_id uuid);
      INSERT INTO conversations VALUES ('${turn}','${id.site}','${id.agent}','${id.admin}')`)
    db(sqlSource('20261123130000_connector_support_direct_accounts.sql')); issueDirect(db)
  }, 30000)

  it('ends implicit generic Support listing and claims without changing member-only Instance authority', () => {
    const denied = {support_list:0, support_use:0, instance_member:1}, allowed = {...denied,support_list:1,support_use:1}
    expect(compare()).toEqual(allowed); apply(); expect(compare()).toEqual(denied); expect(claim('a')).toBe('f')
    db(`INSERT INTO agents VALUES ('${future}','${id.site}','active','Customer Support')`)
    expect(compare(future)).toEqual(denied)
    service(grant(direct)); expect(compare()).toEqual(allowed); expect(compare(future)).toEqual(denied)
    expect(claim('a')).toBe('t'); expect(claim('a')).toBe('f')
    for (const patch of [{enabled:false}, {revoked_at:'2020-01-01T00:00:00Z'}, {expires_at:'2020-01-01T00:00:00Z'}]) {
      const rev = +db(`SELECT revision FROM connectors WHERE id='${direct}'`)
      service(accessSql([], [{agent_id:id.agent,enabled:true,...patch}], rev, id.owner, direct))
      expect(compare()).toEqual(denied); expect(claim('b')).toBe('f')
    }
  })

  it('publishes only to explicitly granted agents, never through creation, Ask enrollment, or OAuth replay', () => {
    apply(); service(`INSERT INTO site_connector_auth_attempts(id,site_id,provider_id,user_id,toolkit_slug,auth_config_id,
      nonce_hash,credential_revision,expires_at,ask_on_connect) VALUES ('${id.attempt}','${id.site}','${id.provider}',
      '${id.owner}','gmail','auth-config',repeat('a',64),'${revision}',now()+interval '5 minutes',true);
      UPDATE site_connector_auth_attempts SET provider_account_id='new-account' WHERE id='${id.attempt}';
      UPDATE site_connector_auth_attempts SET status='completing' WHERE id='${id.attempt}'`)
    const finish = finalizeSql().replace('mail.read','https://www.googleapis.com/auth/gmail.readonly')
    const account = JSON.parse(service(finish)); expect(account.access_mode).toBe('workspace')
    db(issueSql().replace(direct,account.id).replace('direct-a','new-account').replace("'crm'","'gmail'"))
    expect(db(`SELECT count(*) FROM connector_result_private.direct_enrollments WHERE connector_id='${account.id}'`)).toBe('1')
    expect(JSON.parse(service(finish)).id).toBe(account.id)
    service(`SELECT public.connector_update_policy('${id.site}','${account.id}','${id.owner}',1,'{}',ARRAY['assistant'],false,
      true,'all','{"audience":"anonymous","label_id":"Label_123"}')`)
    expect(db('SELECT count(*) FROM connector_agents')).toBe('0')
    const page = (agent = id.agent) => service(`SELECT connector_id FROM public.connector_support_publication_page('${id.site}','${agent}','anonymous')`)
    expect(page()).toBe(''); service(grant(direct)); expect(page()).toBe('')
    service(grant(account.id, id.agent, 2)); expect(page()).toBe(account.id); expect(page(id.otherAgent)).toBe('')
    service(accessSql([], [{agent_id:id.agent, enabled:false}], 3, id.owner, account.id)); expect(page()).toBe('')
  })

  it('rechecks old private results after cutover; an explicit grant never overrides member denial or receipt revisions', () => {
    const args = binding.replace('rev-1',revision), ready = (b = args) => service(`SELECT public.connector_private_result_ready(${b})`)
    const store = (b: string) => service(`SELECT public.store_connector_private_result(${b},'v1',repeat('a',64),'{}')`)
    const read = (receipt: string) => db(`SET ROLE authenticated; SET request.jwt.claims='{"sub":"${id.admin}","is_anonymous":false}';
      SELECT public.read_connector_private_result('${receipt}')`)
    const previous = store(args); expect(read(previous)).toBe('{}'); apply(); expect(read(previous)).toBe('')
    expect(ready()).toBe('f'); expect(() => store(args)).toThrow(/unavailable/)
    service(grant(analytics)); const current = args.replace(',1,1,',',2,1,')
    expect(ready(current)).toBe('t'); expect(read(previous)).toBe(''); const receipt = store(current); expect(read(receipt)).toBe('{}')
    service(accessSql([{user_id:id.admin,can_view:true,can_use:false}], [], 2, id.owner, analytics))
    expect(ready(args.replace(',1,1,',',3,1,'))).toBe('f'); expect(read(receipt)).toBe('')
  })

  it('requires the serialized service-role manager RPC for grant writes, scopes targets and preserves existing grants', () => {
    service(grant(direct, id.agent, 1, id.admin)); apply(); expect(compare().support_use).toBe(1)
    for (const role of ['anon','authenticated','service_role']) {
      for (const write of [`INSERT INTO connector_agents(site_id,connector_id,agent_id,enabled,granted_by)
        VALUES ('${id.site}','${analytics}','${id.agent}',true,'${id.owner}')`,
        'UPDATE connector_agents SET enabled=true','DELETE FROM connector_agents']) {
        expect(() => db(`SET ROLE ${role}; ${write}`)).toThrow(/permission denied/)
      }
      if (role !== 'service_role') expect(() => db(`SET ROLE ${role}; ${grant(analytics)}`)).toThrow(/permission denied/)
    }
    for (const actor of [id.member,id.foreign]) expect(() => service(grant(analytics,id.agent,1,actor))).toThrow(/management denied/)
    for (const agent of [id.otherAgent,id.inactiveAgent]) expect(() => service(grant(analytics,agent))).toThrow(/target denied/)
    expect(() => service(grant(direct))).toThrow(/revision conflict/)
    expect(db('SELECT count(*) FROM connector_agents')).toBe('1')
  })

  it('resolves at most two eligible manager-review accounts; exact scope and proof are required on each', () => {
    apply()
    const sql = (slug: string, site = id.site, agent = id.agent) =>
      `SELECT * FROM public.connector_agent_review_candidates('${site}','${agent}',${slug})`
    const slug = "'CRM_LIST_DEALS'", lookup = () => service(sql(slug))
    expect(lookup()).toBe(''); service(grant(direct)); expect(lookup()).toBe(direct)
    for (const wrong of ['NULL',"'CRM_bad'","'COMPOSIO_ADMIN'","'OTHER_LIST'"]) expect(service(sql(wrong))).toBe('')
    for (const role of ['anon','authenticated','connector_result_reader']) expect(() => db(`SET ROLE ${role}; ${sql(slug)}`)).toThrow(/permission denied/)
    expect(service(sql(slug,id.otherSite))).toBe(''); expect(service(sql(slug,id.site,id.otherAgent))).toBe('')
    for (const change of ["UPDATE agents SET role='Sales'",'UPDATE connector_policies SET require_approval=false',
      "UPDATE connector_agents SET expires_at=now()", "UPDATE connector_policies SET allowed_hosts=ARRAY['direct']",
      "UPDATE connector_policies SET tool_access_mode='selected',allowed_tools=ARRAY['CRM_OTHER']"]) {
      expect(db(`BEGIN; ${change}; SET ROLE service_role; ${sql(slug)}; ROLLBACK`)).toBe('')
    }
    for (const account of [uuid(1410),uuid(1411)]) {
      db(`INSERT INTO connectors(id,site_id,provider_id,toolkit_slug,provider_account_id,auth_config_id,display_name,provider_status,
          created_by,verified_at,access_mode,enabled) VALUES ('${account}','${id.site}','${id.provider}','crm','${account}',
          'auth-config','Second CRM','ACTIVE','${id.owner}',now(),'explicit',true);
        INSERT INTO connector_policies(site_id,connector_id,allowed_hosts,tool_access_mode,allowed_tools)
          VALUES ('${id.site}','${account}',ARRAY['assistant'],'selected',ARRAY['CRM_LIST_DEALS'])`)
      service(grant(account)); expect(lookup().split('\n')).not.toContain(account)
      db(issueSql().replace(direct,account).replace('direct-a',account))
      expect(lookup().split('\n')).toEqual([direct,uuid(1410)])
    }
  })
})