/** @jest-environment node */
import { randomBytes, randomUUID } from 'node:crypto'
import { isolatedPostgres, postgresAvailable } from '../security/isolated-postgres'
import { finalizeSql, id, jsonSql, sqlSource } from './connector-postgres-fixture'
import { direct, installProviderDirect, instance, issueSql, proofTable, revision } from './provider-direct-fixture'

const migration = '20261123030000_connector_ask_on_connect.sql'
const moreCatalog = '20261121012000_connector_creation_catalog_reads.sql'
const attempts = 'public.site_connector_auth_attempts'
const revisions = 'connector_result_private.direct_revisions'
const serviceRole = 'SET ROLE service_role;'
const local = 'b'.repeat(20), remote = 'c'.repeat(20)

function attempt(actor=id.admin, kit='crm') {
  const a = { attempt: randomUUID(), actor, nonce: randomBytes(32).toString('hex'), account: randomUUID(), toolkit: kit }
  const start = (notice?: boolean, project?: string) => `INSERT INTO ${attempts}
    (id,site_id,provider_id,user_id,toolkit_slug,auth_config_id,nonce_hash,credential_revision,expires_at
      ${notice === undefined ? '' : ',ask_on_connect'}${project ? ',supabase_project_ref' : ''}) VALUES
    ('${a.attempt}','${id.site}','${id.provider}','${actor}','${kit}','auth-config','${a.nonce}','${revision}',now()+interval '5 minutes'
      ${notice === undefined ? '' : `,${notice}`}${project ? `,'${project}'` : ''})`
  return { ...a, start, claim: `UPDATE ${attempts} SET provider_account_id='${a.account}' WHERE id='${a.attempt}';
      UPDATE ${attempts} SET status='completing' WHERE id='${a.attempt}'`, finalize: finalizeSql(a) }
}

const lookup = (c: string, actor=id.owner, site=id.site, version='ask_policy_status') =>
  `SELECT public.connector_${version}('${site}','${actor}','${c}')`
const set = (c: string, enable: boolean, epoch: number, rev=1, legacy=false, actor=id.owner) =>
  `SELECT public.connector_set_${legacy ? 'direct' : 'ask'}_policy('${id.site}','${actor}','${c}',${rev},${epoch},${enable})`
const count = (c:string, slug='CRM_GET_DATA') => `SELECT jsonb_array_length(public.connector_direct_accounts(
  '${id.site}','${id.admin}','${instance}','${id.agent}','${c}','${slug}'))`
const proof = (c:string, a:ReturnType<typeof attempt>) => issueSql().replace(direct,c).replace('direct-a',a.account).replace("'crm'",`'${a.toolkit}'`)
const proofRevoke = (c:string) => `UPDATE ${proofTable} SET revoked_at=now() WHERE connector_id='${c}' AND revoked_at IS NULL`
const event = (c:string) => `SELECT direct_revision,connector_revision,actor_id,enabled FROM connector_result_private.direct_policy_events
  WHERE connector_id='${c}' ORDER BY direct_revision`
const edit = (c:string, rev:number, enable:boolean|null) => `SELECT public.connector_update_policy('${id.site}','${c}','${id.owner}',${rev},
  ARRAY['CRM_GET_DATA'],ARRAY['assistant'],true,${enable},'selected',NULL)`
const status = (c:string, direct_revision:number, setup_pending=false, attested=false, enabled=false, revision=1, bound_supabase_ref:string|null=null) =>
  ({ connector_id:c, revision, direct_revision, setup_pending, attested, enabled, bound_supabase_ref })

if (process.env.REQUIRE_REAL_POSTGRES === '1' && !postgresAvailable) throw new Error('Disposable PostgreSQL binaries required')
test('canonical migration matches both mirrors exactly', () => {
  for (const repo of ['API','market-fit']) expect(sqlSource(migration,repo)).toBe(sqlSource(migration,'makinari-db-scheme'))
})

;(postgresAvailable ? describe : describe.skip)('prospective Ask default on disposable socket-only PostgreSQL', () => {
  const pg = isolatedPostgres(), db = pg.db, service = (q:string) => db(`${serviceRole} ${q}`)
  const migrate = () => db(sqlSource(migration,'makinari-db-scheme'))
  const read = (c:string) => JSON.parse(service(lookup(c)))
  const start = (a:ReturnType<typeof attempt>, notice?:boolean, project?:string) => service(a.start(notice, project))
  const finish = (a:ReturnType<typeof attempt>) => { service(a.claim); return JSON.parse(service(a.finalize)).id as string }
  const connect = (actor=id.admin, kit='crm') => { const a=attempt(actor,kit); start(a,true); return { a, c:finish(a) } }
  beforeAll(pg.start,30000); afterAll(pg.stop)
  beforeEach(() => installProviderDirect(db),30000)

  it.each([false,true])('does not change either catalog-default predecessor (%s), old accounts, old writers or in-flight attempts', catalog => {
    if (catalog) db(sqlSource(moreCatalog))
    const historical=attempt(), inFlight=attempt(), oldClient=attempt()
    start(historical); const before=finish(historical); start(inFlight)
    db(issueSql()); service(set(direct,true,2,1,true))
    const existing = service(lookup(direct,id.owner,id.site,'direct_policy'))
    const policies = () => db('SELECT jsonb_agg(to_jsonb(p) ORDER BY connector_id) FROM connector_policies p')
    const snapshot=policies()
    migrate()
    expect(policies()).toBe(snapshot)
    expect(service(lookup(direct,id.owner,id.site,'direct_policy'))).toBe(existing)
    expect(JSON.parse(service(historical.finalize)).id).toBe(before)
    const mid=finish(inFlight); start(oldClient); const old=finish(oldClient)
    for (const [c,a] of [[before,historical],[mid,inFlight],[old,oldClient]] as const) {
      expect(read(c)).toEqual(status(c,1)); db(proof(c,a)); expect(read(c)).toEqual(status(c,2,false,true))
      expect(service(count(c))).toBe('0')
      expect(db(`SELECT catalog_reads FROM connector_policies WHERE connector_id='${c}'`)).toBe(catalog ? 't' : 'f')
    }
    const {a,c}=connect()
    expect(read(c)).toEqual(status(c,1,true)); expect(service(count(c))).toBe('0')
    expect(db(`SELECT catalog_reads,tool_access_mode,require_approval FROM connector_policies WHERE connector_id='${c}'`)).toBe(`${catalog ? 't' : 'f'}|all|t`)
    expect(()=>service(set(c,true,1))).toThrow(/attestation required/)
    db(proof(c,a)); expect(read(c)).toEqual(status(c,2,false,true,true)); expect(service(count(c))).toBe('1')
    expect(db(event(c))).toBe(`2|1|${a.actor}|t`); expect(JSON.parse(service(a.finalize)).id).toBe(c)
    expect(db(event(c))).toBe(`2|1|${a.actor}|t`)
  })

  it('the existing receipt turn fence starts tracking only after effective first enrollment', () => {
    // Install the actual receipt prerequisite and migration, not a substitute eligibility predicate.
    db(`ALTER TABLE remote_instances ADD COLUMN agent_id uuid;
      CREATE TABLE instance_pending_work(id uuid PRIMARY KEY,instance_id uuid,site_id uuid,user_id uuid);
      CREATE TABLE instance_logs(id uuid PRIMARY KEY,instance_id uuid REFERENCES remote_instances(id) ON DELETE CASCADE,
        site_id uuid,user_id uuid,agent_id uuid,log_type text,trusted_user_action boolean NOT NULL DEFAULT false,details jsonb,
        message text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT clock_timestamp());
      GRANT INSERT ON instance_logs TO service_role;`)
    db(sqlSource('20261119223000_connector_identity_guards.sql')); db(sqlSource('20261123020000_connector_direct_receipts.sql'))
    migrate(); const {a,c}=connect(), before=randomUUID(), after=randomUUID()
    const turn=(key:string) => service(`INSERT INTO instance_logs(id,instance_id,site_id,user_id,log_type,trusted_user_action,details)
      VALUES ('${key}','${instance}','${id.site}','${id.admin}','user_action',true,'{"status":"running"}')`)
    const head=() => db(`SELECT action_id FROM connector_result_private.direct_turn_heads WHERE instance_id='${instance}'`)
    turn(before); expect(head()).toBe(''); db(proof(c,a)); expect(head()).toBe(''); turn(after); expect(head()).toBe(after)
  })

  it.each([false,true])('opt-out before proof via current or legacy manager CAS (%s) is terminal', legacy => {
    migrate(); const {a,c}=connect()
    expect(()=>service(set(c,false,1,1,legacy,id.member))).toThrow(/management denied/)
    expect(()=>service(set(c,false,2,1,legacy))).toThrow(/Direct revision conflict/)
    expect(()=>service(set(c,false,1,2,legacy))).toThrow(/Connector revision conflict/)
    const unchanged=service(lookup(c,id.owner,id.site,'direct_policy'))
    expect(Object.keys(JSON.parse(unchanged)).sort()).toEqual(['attested','connector_id','direct_revision','enabled','revision'])
    // Clearing is local even if provider verification is offline or withdrawn.
    db('UPDATE site_secrets SET is_active=false')
    const cleared=JSON.parse(service(set(c,false,1,1,legacy)))
    expect(cleared).toEqual(legacy ? {...JSON.parse(unchanged),direct_revision:2} : status(c,2))
    expect(read(c)).toEqual(status(c,2)); expect(()=>service(set(c,false,1))).toThrow(/Direct revision conflict/)
    db('UPDATE site_secrets SET is_active=true'); service(a.finalize); db(proof(c,a)); expect(read(c)).toEqual(status(c,3,false,true))
    expect(service(count(c))).toBe('0'); expect(db(event(c))).toBe(`2|1|${id.owner}|f`)
    expect(JSON.parse(service(set(c,true,3)))).toEqual(status(c,4,false,true,true)) // explicit fresh opt-in remains possible
  })

  it('never rotates enrollment to a renewed proof, even after proof deletion, callback replay or in-place re-verification', () => {
    migrate(); const {a,c}=connect(); const first=db(proof(c,a))
    db(proofRevoke(c)); expect(read(c)).toEqual(status(c,3)); expect(service(count(c))).toBe('0')
    service(a.finalize); expect(db(proof(c,a))).not.toBe(first); expect(read(c)).toEqual(status(c,4,false,true))
    service(set(c,true,4)); service(set(c,false,5)); service(a.finalize)
    service(`SELECT public.connector_set_provider_state('${id.site}','${c}','${id.owner}',1,'ACTIVE',false,true,ARRAY['mail.read'],'${revision}')`)
    expect(read(c)).toEqual(status(c,6,false,true,false,2)); expect(service(count(c))).toBe('0')
    db(`DELETE FROM ${proofTable} WHERE connector_id='${c}'`); db(proof(c,a)); expect(read(c)).toEqual(status(c,9,false,true,false,2))
  })

  it('preserves independent host, tool and member limits, ordinary revisions and legacy private reports', () => {
    db(sqlSource(moreCatalog)); migrate(); const {a,c}=connect()
    service(edit(c,1,null)); const legacyReport={title:'Catalogue',note:'Private',columns:['Total'],rows:[['3']]}
    const report=service(`SELECT public.store_connector_private_result('${id.site}','${id.admin}','${instance}','${id.agent}',
      '${c}','CRM_GET_DATA',true,2,2,'${revision}','v1','${'a'.repeat(64)}',${jsonSql(legacyReport)})`)
    const open=() => db(`SET ROLE authenticated; SET request.jwt.claims='{"sub":"${id.admin}","is_anonymous":false}'; SELECT public.read_connector_private_result('${report}')`)
    expect(JSON.parse(open())).toEqual(legacyReport)
    db(proof(c,a)); expect(read(c)).toEqual(status(c,2,false,true,true,2))
    expect(service(count(c))).toBe('1'); expect(service(count(c,'CRM_DELETE_DATA'))).toBe('0')
    expect(db(event(c))).toBe(`2|2|${a.actor}|t`)
    service(set(c,false,2,2)); expect(JSON.parse(open())).toEqual(legacyReport); expect(service(count(c))).toBe('0')
    service(set(c,true,3,2)); expect(JSON.parse(open())).toEqual(legacyReport)
    db(`UPDATE connector_policies SET allowed_hosts=ARRAY['direct'] WHERE connector_id='${c}'`); expect(service(count(c))).toBe('0')
    db(`UPDATE connector_policies SET allowed_hosts=ARRAY['assistant'] WHERE connector_id='${c}';
      INSERT INTO connector_members(site_id,connector_id,user_id,can_view,can_use,granted_by) VALUES ('${id.site}','${c}','${id.admin}',true,false,'${id.owner}')`)
    expect(service(count(c))).toBe('0')
  })

  it('rechecks the original manager, not any available owner, and burns the first opportunity even after later restoration', () => {
    migrate(); const {a,c}=connect(); db(`UPDATE site_members SET role='collaborator' WHERE user_id='${a.actor}'`)
    db(proof(c,a)); expect(read(c)).toEqual(status(c,2,false,true)); expect(db(event(c))).toBe('')
    db(`UPDATE site_members SET role='admin' WHERE user_id='${a.actor}'`); service(a.finalize)
    db(proofRevoke(c)); db(proof(c,a)); expect(read(c)).toEqual(status(c,4,false,true)); expect(service(count(c))).toBe('0')
  })

  it.each(['opt-out','proof','demotion'])('serializes a withheld %s transaction with first activation and CAS', async first => {
    migrate(); const {a,c}=connect(); const held=715032
    const hold=(q:string) => pg.concurrent(`BEGIN; ${q}; SELECT pg_advisory_xact_lock(${held}); SELECT pg_sleep(0.6); COMMIT`)
    // Wait on an observable lock, not on a guessed scheduler delay. The peer
    // sees the uncommitted proof/opt-out/authority change only after its wait.
    const winner=hold(first==='proof' ? proof(c,a) : first==='opt-out' ? `${serviceRole} ${set(c,false,1)}` :
      `UPDATE public.site_members SET manually_disabled=true WHERE user_id='${a.actor}'`)
    let ready=false
    for (let i=0;i<50 && !ready;i++) {
      ready=db(`SELECT NOT pg_try_advisory_lock(${held})`)==='t'
      if (!ready) await new Promise(resolve=>setTimeout(resolve,10))
    }
    expect(ready).toBe(true)
    const peer=pg.concurrent(first==='proof' ? `${serviceRole} ${set(c,false,1)}` : proof(c,a))
    const results=await Promise.allSettled([winner,peer]); expect(results[0].status).toBe('fulfilled')
    if (first==='proof') {
      expect(results[1].status==='rejected' && String(results[1].reason)).toMatch(/Direct revision conflict/)
      expect(read(c)).toEqual(status(c,2,false,true,true)); service(set(c,false,2)); expect(service(count(c))).toBe('0')
    } else {
      expect(results[1].status).toBe('fulfilled'); expect(read(c)).toEqual(status(c,first==='opt-out' ? 3 : 2,false,true))
      expect(service(count(c))).toBe('0'); expect(db(event(c))).not.toContain('|t')
    }
  })

  it('provider revocation, disabled account or rotated provider credentials retire pending setup, even after restore', () => {
    migrate(); const gone=connect(), disabled=connect(), rotate=connect()
    service(`SELECT public.connector_set_provider_state('${id.site}','${gone.c}','${id.owner}',1,'ACTIVE',true,false)`)
    expect(read(gone.c)).toEqual(status(gone.c,2,false,false,false,2)); expect(()=>db(proof(gone.c,gone.a))).toThrow(/binding required/)
    service(`SELECT public.connector_set_provider_state('${id.site}','${gone.c}','${id.owner}',2,'REVOKED',false,true,NULL,'${revision}')`)
    expect(()=>service(`SELECT public.connector_set_provider_state('${id.site}','${gone.c}','${id.owner}',3,'ACTIVE',false,true,NULL,'${revision}')`)).toThrow(/cannot be restored/)
    service(edit(disabled.c,1,false)); service(edit(disabled.c,2,true)); db(proof(disabled.c,disabled.a)); expect(service(count(disabled.c))).toBe('0')
    db(`UPDATE site_connector_providers SET credential_revision='platform:${revision}' WHERE id='${id.provider}';
      UPDATE site_connector_providers SET credential_revision='${revision}' WHERE id='${id.provider}'`)
    db(proof(rotate.c,rotate.a)); expect(read(rotate.c)).toEqual(status(rotate.c,3,false,true)); expect(service(count(rotate.c))).toBe('0')
  })

  it('rejects shared/local database or admin scope as isolation evidence and keeps Management PAT onboarding off', () => {
    migrate(); const pat=attempt(id.admin,'supabase')
    expect(()=>start(pat,true,remote)).toThrow(/manager onboarding required/)
    start(pat,undefined,remote); const patId=finish(pat); expect(read(patId)).toEqual(status(patId,1,false,false,false,1,remote))
    const {a,c}=connect(id.admin,'supabase'); expect(read(c)).toEqual(status(c,1,true))
    const sql=(accountId:string, source:typeof a, target:string, installation:string) => proof(accountId,source)
      .replace('external_business_resource','external_database_project').replace('resource_kind,','local_installation_ref,resource_kind,')
      .replace("'external_database_project',",`'${installation}','external_database_project',`).replace('customer-tenant-17',target)
    db(`INSERT INTO connector_result_private.direct_resources VALUES ('crm-issuer','${local}','${id.site}','{}'),('crm-issuer','${remote}','${id.site}','{}')`)
    expect(()=>db(sql(c,a,remote,local))).toThrow(/binding required/)
    service(`SELECT public.connector_bind_supabase_project('${id.site}','${c}','${id.owner}',1,'${local}','${revision}')`)
    expect(()=>db(sql(c,a,local,local))).toThrow(/check constraint/)
    expect(()=>db(sql(c,a,remote,local))).toThrow(/binding required/)
    expect(read(c)).toEqual(status(c,1,true,false,false,2,local)); expect(service(count(c,'SUPABASE_GET_DATA'))).toBe('0')
    expect(()=>db(sql(patId,pat,remote,local).replace('business_data_only_no_control_plane','admin'))).toThrow(/check constraint/)
    // Even an issuer's positive assertion cannot turn the old/PAT start path into auto-enrollment.
    db(sql(patId,pat,remote,local)); expect(read(patId)).toEqual(status(patId,2,false,true,false,1,remote))
    const isolated=connect(id.admin,'supabase')
    service(`SELECT public.connector_bind_supabase_project('${id.site}','${isolated.c}','${id.owner}',1,'${remote}','${revision}')`)
    db(sql(isolated.c,isolated.a,remote,local)); expect(read(isolated.c)).toEqual(status(isolated.c,2,false,true,true,2,remote))
  })

  it('rejects mismatched/stale proof and never trusts a raw account, callback metadata or visible member', () => {
    migrate(); const {a,c}=connect(); const issue=proof(c,a)
    for (const [from,to] of [[id.site,id.otherSite],[a.account,'wrong-account'],['auth-config','wrong-config'],[revision,'d'.repeat(64)],
      ['provider_enforced_single_site','shared'],['customer_owned_dedicated','admin_pat'],['reauth_cannot_expand_boundary','unverified']]) {
      expect(()=>db(issue.replace(from,to))).toThrow()
      expect(read(c)).toEqual(status(c,1,true)); expect(service(count(c))).toBe('0')
    }
    const ordinary=attempt(id.member); expect(()=>start(ordinary,true)).toThrow(/manager onboarding required/)
    const old=attempt(); start(old); expect(()=>service(`UPDATE ${attempts} SET ask_on_connect=true WHERE id='${old.attempt}'`)).toThrow(/immutable/)
    // Even matching raw service-written account/attempt flags cannot manufacture the owner-written auth_completed event.
    const raw=attempt(); start(raw,true); service(raw.claim)
    service(`INSERT INTO connectors(id,site_id,provider_id,toolkit_slug,provider_account_id,auth_config_id,display_name,provider_status,
      created_by,verified_at,access_mode,enabled) VALUES ('${raw.attempt}','${id.site}','${id.provider}','crm','${raw.account}',
      'auth-config','Raw account','ACTIVE','${raw.actor}',now(),'workspace',true);
      UPDATE ${attempts} SET status='completed',connector_id='${raw.attempt}' WHERE id='${raw.attempt}'`)
    db(proof(raw.attempt,raw)); expect(read(raw.attempt)).toEqual(status(raw.attempt,2,false,true))
    for (const role of ['authenticated','anon','connector_result_reader']) {
      const call=(q:string) => pg.call(q,id.owner,role)
      for (const q of [lookup(c),set(c,false,1),raw.start(true),`SELECT * FROM ${revisions}`,`SELECT * FROM ${proofTable}`]) expect(()=>call(q)).toThrow(/permission denied/)
    }
    expect(pg.call(`SELECT id FROM public.connectors WHERE id='${c}'`,id.member)).toBe(c) // browse != manage
    for (const [actor,site] of [[id.member,id.site],[id.foreign,id.site],[id.foreign,id.otherSite]]) {
      expect(()=>service(lookup(c,actor,site))).toThrow(/insufficient_privilege/)
    }
    for (const q of [`SELECT * FROM ${revisions}`,`UPDATE ${revisions} SET direct_revision=1`,issue,
      `INSERT INTO public.connector_audit_events(site_id,connector_id,actor_id,event_type,revision) VALUES ('${id.site}','${c}','${a.actor}','auth_completed',1)`]) {
      expect(()=>service(q)).toThrow(/permission denied/)
    }
  })
})