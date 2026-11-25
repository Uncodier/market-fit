/** @jest-environment node */
import { randomUUID } from 'node:crypto'
import { isolatedPostgres, postgresAvailable } from '../security/isolated-postgres'
import { id, jsonSql, sqlSource } from './connector-postgres-fixture'
import { completeOrdinaryOauth, installOrdinaryOauth } from './ordinary-oauth-fixture'
import { direct, instance, issueSql } from './provider-direct-fixture'
import { createGateway, gateway } from './provider-direct-receipt-fixture'

if (process.env.REQUIRE_REAL_POSTGRES === '1' && !postgresAvailable) throw Error('Real PostgreSQL required')
;(postgresAvailable ? describe : describe.skip).each([
  {kit:'hubspot',slug:'HUBSPOT_LIST_CONTACTS',version:'20261119_01',scope:'crm.objects.contacts.read',args:{limit:1}},
  {kit:'ledger-kit',slug:'LEDGER_KIT_POST_ENTRY',version:'20261124_02',scope:'journal.write',args:{memo:"Customer's note",lines:[{value:3}]}},
])('scheduled $kit authority, socket-only PostgreSQL', ({kit,slug,version,scope,args}) => {
  const pg = isolatedPostgres(), db = pg.db
  const root = randomUUID(), node = randomUUID(), trigger = randomUUID(), run = randomUUID(), job = randomUUID()
  const sql = (name: string, args: string) => `SELECT public.workflow_connector_${name}(${args})`
  const service = (q: string) => db(`\\set VERBOSITY verbose\n${gateway} ${q}`)
  const names = (actor = id.admin) => `'${instance}','${node}','${actor}'`
  const hash='df'.repeat(32)
  const operation=()=>({connector_id:connector,toolkit_slug:kit,tool_slug:slug,toolkit_version:version,schema_hash:hash,arguments:args})
  const reviewSql=(actor=id.admin,value:unknown=operation())=>sql('review',`${names(actor)},${jsonSql(value)}`)
  const review = (actor = id.admin) => JSON.parse(service(reviewSql(actor)))
  const publish = (d: string,value:unknown=operation(),actor=id.admin) => JSON.parse(service(sql('publish', `${names(actor)},'${d}',${jsonSql(value)}`)))
  const result = (actor = id.admin) => service(sql('result', names(actor)))
  const revoke = () => service(sql('revoke', names()))
  const bind = (r: string=run, j: string=job, t: string=trigger, occ="date_trunc('minute', now())") =>
    sql('bind', `'${instance}','${t}',${occ},'${r}','${j}'`)
  const pair = (j: string=job) => `'${run}','${j}'`
  const dispatch = (j: string=job) => service(sql('dispatch',pair(j)))
  const finish = (doc: unknown) => service(sql('finish',`${pair()},'${JSON.stringify(doc)}'::jsonb`))
  // Test-owner only: simulate the passage of time without weakening the RPC or
  // waiting 30 days. The immutable-publication trigger is restored atomically.
  const shiftTime = (set:string) => db(`BEGIN; ALTER TABLE workflow_connector_private.publications DISABLE TRIGGER immutable_publication;
    UPDATE workflow_connector_private.publications SET ${set} WHERE revoked_at IS NULL;
    ALTER TABLE workflow_connector_private.publications ENABLE TRIGGER immutable_publication; COMMIT`)
  const approve = () => {
    const s=review(); publish(s.digest)
    // No minute-long wall-clock wait: move the private fixture's approval into the past.
    shiftTime("approved_at=now()-interval '5 minutes'")
  }
  let connector: string
  const cfg = JSON.stringify({ kind:'cron', active_kinds:['cron'],cron:'* * * * *', timezone:'UTC' })
  beforeAll(() => {
    pg.start(); db(createGateway); installOrdinaryOauth(db)
    for (const f of ['20261123151000_connector_account_receipts.sql','20261123164000_retire_connector_project_binding.sql',
      '20261123165000_connector_ask_host_policy.sql','20261123170000_connector_ask_connection_policy.sql',
      '20261125223000_connector_creation_direct_host.sql']) db(sqlSource(f))
    connector=completeOrdinaryOauth(db,{toolkit:kit,scopes:[scope]}).connectorId
    const external=db(`SELECT provider_account_id FROM connectors WHERE id='${connector}'`)
    db(issueSql().replace(direct,connector).replace('direct-a',external).replace("'crm'",`'${kit}'`))
    db(`UPDATE connector_policies SET allowed_tools='{${slug}}',tool_access_mode='selected' WHERE connector_id='${connector}';
      INSERT INTO connector_members(site_id,connector_id,user_id,can_view,can_use,granted_by) VALUES
        ('${id.site}','${connector}','${id.admin}',true,true,'${id.owner}');
      CREATE TABLE instance_nodes(id uuid PRIMARY KEY,instance_id uuid,site_id uuid,user_id uuid,type text,parent_node_id uuid,settings jsonb,prompt jsonb);
      CREATE TABLE instance_node_contexts(target_node_id uuid,context_node_id uuid);
      CREATE TABLE workflow_triggers(id uuid PRIMARY KEY,instance_id uuid,site_id uuid,node_id uuid,kind text,enabled boolean,config jsonb);
      INSERT INTO instance_nodes VALUES ('${root}','${instance}','${id.site}','${id.member}','wf-trigger',NULL,jsonb_build_object('trigger','${cfg}'::jsonb),'{}'),
        ('${node}','${instance}','${id.site}','${id.member}','wf-step','${root}','{}','{}');
      INSERT INTO workflow_triggers VALUES ('${trigger}','${instance}','${id.site}','${root}','cron',true,'${cfg}');`)
    db(sqlSource('20261125210000_workflow_task_connector_reference.sql'))
    db(`SET request.jwt.claims='{"sub":"${id.admin}"}'; UPDATE instance_nodes SET task_connector_id='${connector}' WHERE id='${node}'`)
    for (const f of ['20261125211000_workflow_connector_authority.sql','20261125212000_workflow_connector_rpc.sql','20261125230000_workflow_connector_queue_reservations.sql','20261125231000_workflow_connector_descriptor_guard.sql']) db(sqlSource(f))
  },60_000)
  afterAll(pg.stop)
  beforeEach(() => db('TRUNCATE workflow_connector_private.publications CASCADE;'))

  it('requires the actual account, manager grant and live proof to read private descriptor rejection markers', () => {
    const guard=(actor:string,site:string)=>sql('descriptor_markers',`'${site}','${connector}','${actor}','${slug}'`)
    expect(JSON.parse(service(guard(id.admin,id.site)))).toContain('customer-tenant-17')
    expect(()=>service(guard(id.member,id.site))).toThrow(/42501/)
    expect(()=>service(guard(id.admin,id.otherSite))).toThrow(/42501/)
    expect(()=>db(`SET ROLE authenticated; ${guard(id.admin,id.site)}`)).toThrow(/permission denied/)
  })

  it('requires distinct manager and explicit use, synchronized cron, fixed account/operation and an isolated current proof', () => {
    const s=review()
    expect(s).toEqual({instance_id:instance,node_id:node,trigger_id:trigger,principal_id:id.admin,digest:expect.stringMatching(/^[a-f0-9]{64}$/),
      connector_id:connector,operation:slug,toolkit_slug:kit,toolkit_version:version,schema_hash:hash,arguments:args,cron:'* * * * *',timezone:'UTC',published:false})
    for(const actor of [id.owner,id.member,id.foreign]) expect(() => review(actor)).toThrow(/42501/)
    expect(() => publish('a'.repeat(64))).toThrow(/40001/)
    expect(publish(s.digest)).toEqual({...s,published:true}); expect(review().published).toBe(true)
    const q=reviewSql()
    for (const mutation of [
      `UPDATE remote_instances SET visible=false`, `UPDATE connector_members SET can_use=false WHERE user_id='${id.admin}'`,
      `UPDATE site_members SET role='collaborator' WHERE user_id='${id.admin}'`, `UPDATE site_members SET blocked_screens='{people}' WHERE user_id='${id.admin}'`,
      `UPDATE connector_members SET expires_at=now()-interval '1 second'`, `UPDATE connector_policies SET allowed_hosts='{assistant}'`,
      `UPDATE connector_policies SET allowed_tools='{}',tool_access_mode='selected'`, `UPDATE connectors SET enabled=false`,
      `UPDATE connector_result_private.direct_attestations SET revoked_at=now() WHERE connector_id='${connector}'`,
      `UPDATE workflow_triggers SET enabled=false`, `UPDATE workflow_triggers SET node_id=gen_random_uuid()`,
      `UPDATE workflow_triggers SET config=config || '{"cron":"0 4 * * *"}'`, `UPDATE instance_nodes SET parent_node_id=NULL WHERE id='${node}'`,
      `UPDATE instance_nodes SET settings='{"step":{"requires_sandbox":true}}' WHERE id='${node}'`,
      `UPDATE site_secrets SET is_active=false`, `DELETE FROM connector_result_private.provider_attestations`,
      `INSERT INTO instance_node_contexts VALUES ('${node}',gen_random_uuid())`,
      `INSERT INTO instance_nodes(id,instance_id,type) VALUES (gen_random_uuid(),'${instance}','wf-condition')`,
    ]) expect(() => db(`\\set VERBOSITY verbose\nBEGIN; ${mutation}; ${gateway} ${q}; ROLLBACK;`)).toThrow(/42501/)
  })

  it('requires one exact descriptor envelope; pins the schema, version and entire argument object', () => {
    const op=operation(), s=review()
    for(const bad of [null,{},[],{...op,extra:true},{...op,connector_id:id.foreignConnector},
      {...op,tool_slug:'WRONG_KIT_LOOKUP'},{...op,tool_slug:`${slug}_NOT_SELECTED`},{...op,toolkit_slug:'other'},
      {...op,arguments:null},{...op,arguments:[]},{...op,arguments:{value:'a'.repeat(65536)}},
      {...op,schema_hash:'invalid'},{...op,toolkit_version:'latest'},
      ...Object.keys(op).map(key=>Object.fromEntries(Object.entries(op).filter(([k])=>k!==key)))]) {
      expect(()=>service(reviewSql(id.admin,bad))).toThrow(/42501/)
    }
    for(const changed of [{...op,arguments:{nested:{list:[true,null,3]}}},
      {...op,schema_hash:'ab'.repeat(32)}, {...op,toolkit_version:'20261125_06'}]) {
      expect(()=>publish(s.digest,changed)).toThrow(/40001/)
    }
    publish(s.digest)
    expect(JSON.parse(db('SELECT operation::text FROM workflow_connector_private.publications'))).toEqual(op)
    const changed={...op,arguments:{terms:['a','b'],path:{from:'closed'}}}
    const reviewed=JSON.parse(service(reviewSql(id.admin,changed)))
    expect(reviewed.digest).not.toBe(s.digest); expect(reviewed.published).toBe(false)
    publish(reviewed.digest,changed); shiftTime("approved_at=now()-interval '5 minutes'")
    expect(JSON.parse(service(bind()))).toMatchObject(changed)
    expect(JSON.parse(dispatch())).toMatchObject(changed)
    expect(()=>publish(s.digest)).toThrow(/40001/)
  })

  it('does not revive a queued job or stale review when member use is withdrawn and restored', () => {
    approve(); const old=review(); service(bind())
    db(`UPDATE connector_members SET can_use=false WHERE connector_id='${connector}' AND user_id='${id.admin}'`)
    expect(()=>dispatch()).toThrow(/42501/)
    db(`UPDATE connector_members SET can_use=true WHERE connector_id='${connector}' AND user_id='${id.admin}'`)
    expect(()=>publish(old.digest)).toThrow(/40001/); expect(()=>dispatch()).toThrow(/42501/)
    const next=review(); expect(next.published).toBe(false); publish(next.digest)
    expect(()=>dispatch()).toThrow(/42501/)
  })

  it('invalidates old review challenges on principal replacement, expired publication and revoke', () => {
    const a=review(); publish(a.digest)
    db(`INSERT INTO connector_members(site_id,connector_id,user_id,can_view,can_use,granted_by) VALUES
      ('${id.site}','${connector}','${id.owner}',true,true,'${id.owner}');
      CREATE POLICY second_fixture_manager ON remote_instances FOR SELECT TO authenticated USING (visible AND auth.uid()='${id.owner}');`)
    try {
      const b=review(id.owner)
      publish(b.digest,operation(),id.owner); expect(()=>publish(a.digest)).toThrow(/40001/)
      const fresh=review(); expect(fresh.digest).not.toBe(a.digest); publish(fresh.digest)
      shiftTime("expires_at=now()-interval '1 second'")
      expect(()=>publish(fresh.digest)).toThrow(/40001/); const next=review(); publish(next.digest)
      revoke(); expect(()=>publish(next.digest)).toThrow(/40001/)
      expect(()=>db(`UPDATE workflow_connector_private.publications SET revoked_at=NULL WHERE challenge='${next.digest}'`)).toThrow(/check_violation/)
    } finally { db(`DROP POLICY second_fixture_manager ON remote_instances; DELETE FROM connector_members WHERE user_id='${id.owner}' AND connector_id='${connector}'`) }
  })

  it('checks minute, trigger, graph and one-shot job capability; safe results are visible only while all current gates pass',async () => {
    approve()
    for (const q of [bind(run,job,randomUUID()),bind(run,job,trigger,'now()'),bind(run,job,trigger,"date_trunc('minute',now())-interval '3 minutes'")])
      expect(()=>service(q)).toThrow(/42501/)
    const occurrence=db("SELECT date_trunc('minute',now())::text"), tick=`'${occurrence}'::timestamptz`
    const delivery=`${gateway} ${bind(run,job,trigger,tick)}`
    const concurrent=await Promise.allSettled([pg.concurrent(delivery),pg.concurrent(delivery)])
    expect(concurrent.filter(x=>x.status==='fulfilled')).toHaveLength(1)
    const binding=JSON.parse((concurrent.find(x=>x.status==='fulfilled') as PromiseFulfilledResult<string>).value)
    expect(binding).toMatchObject({...operation(),principal_id:id.admin,site_id:id.site})
    expect(()=>service(bind(randomUUID(),randomUUID(),trigger,tick))).toThrow(/23505/)
    const report = { executed:true, report:{title:'Connector result',note:'Private preview',columns:['Field','Value'],rows:[['$.name','record']]} }
    expect(()=>finish(report)).toThrow(/42501/); expect(()=>dispatch(randomUUID())).toThrow(/42501/)
    expect(JSON.parse(dispatch())).toEqual(binding); expect(()=>dispatch()).toThrow(/42501/)
    for(const bad of [{...report,raw:{}},{...report,report:{...report.report,rows:[['private','x'.repeat(201)]]}},{executed:true},null,[],{count:1},{executed:false},{executed:'true'},{executed:true,data:['private']}]) expect(()=>finish(bad)).toThrow(/42501/)
    expect(finish(report)).toBe('t'); expect(()=>finish(report)).toThrow(/42501/)
    expect(JSON.parse(result())).toEqual(report); expect(()=>result(id.owner)).toThrow(/42501/)
    for(const change of [`UPDATE connector_policies SET revision=revision+1`, `UPDATE remote_instances SET visible=false`,
      `UPDATE instance_nodes SET prompt='{"text":"edited"}' WHERE id='${node}'`, `UPDATE workflow_connector_private.jobs SET completed_at=now()-interval '2 hours'`])
      expect(()=>db(`\\set VERBOSITY verbose\nBEGIN; ${change}; ${gateway} ${sql('result',names())}`)).toThrow(/42501/)
    expect(JSON.parse(revoke())).toEqual({published:false,revoked:true,connector_id:connector}); expect(()=>result()).toThrow(/42501/)
    expect(service(sql('route',`'${instance}'`))).toBe('t')
  })

  it('reserves before queueing and survives queue delays or lost acknowledgements without replaying provider work', async () => {
    approve(); const expected=JSON.parse(service(bind()));
    // Time passes after a valid reservation, beyond the old two/five minute cutoffs.
    db("UPDATE workflow_connector_private.jobs SET occurrence=now()-interval '1 hour', reserved_at=now()-interval '1 hour'")
    const claim=sql('claim_queue','10'), prepare=()=>service(sql('prepare',pair()))
    const claims=await Promise.all([pg.concurrent(`${gateway} ${claim}`),pg.concurrent(`${gateway} ${claim}`)])
    const handles=claims.flatMap(answer=>JSON.parse(answer)); expect(handles).toHaveLength(1)
    const first=handles[0]; expect(first).toEqual({run_id:run,job_id:job,lease_id:expect.any(String)})
    expect(JSON.parse(service(claim))).toEqual([])
    db("UPDATE workflow_connector_private.jobs SET queue_lease_until=now()-interval '1 second'")
    const second=JSON.parse(service(claim))[0]; expect(second.lease_id).not.toBe(first.lease_id)
    const ack=(lease:string)=>service(sql('ack_queue',`${pair()},'${lease}'`))
    expect(ack(first.lease_id)).toBe('f');expect(ack(second.lease_id)).toBe('t');expect(JSON.parse(service(claim))).toEqual([])
    expect(JSON.parse(prepare())).toEqual(expected);expect(JSON.parse(dispatch())).toEqual(expected)
    expect(()=>prepare()).toThrow(/42501/);expect(()=>dispatch()).toThrow(/42501/)
    expect(finish({executed:true,report:{title:'Connector result',note:'Private preview',columns:['Field','Value'],rows:[]}})).toBe('t')
  })

  it('does not dispatch stale, revoked or wrong queued capabilities even if they were reserved on time', () => {
    approve();service(bind()); const prepare=()=>service(sql('prepare',pair()))
    expect(()=>service(sql('prepare',pair(randomUUID())))).toThrow(/42501/)
    db("UPDATE workflow_connector_private.jobs SET reserved_at=now()-interval '25 hours'")
    expect(()=>prepare()).toThrow(/42501/);expect(()=>dispatch()).toThrow(/42501/);expect(JSON.parse(service(sql('claim_queue','1')))).toEqual([])
    db("UPDATE workflow_connector_private.jobs SET reserved_at=now()")
    revoke();expect(()=>prepare()).toThrow(/42501/);expect(()=>dispatch()).toThrow(/42501/)
  })

  it('rejects delayed or manual runs, stale reviews and jobs, can stop a stale publication after use/graph loss', () => {
    const old=review(); publish(old.digest)
    shiftTime("approved_at=clock_timestamp()+interval '1 minute'")
    expect(()=>service(bind())).toThrow(/42501/); approve(); service(bind());
    db(`UPDATE instance_nodes SET prompt='{"text":"edited"}' WHERE id='${node}'`)
    expect(()=>dispatch()).toThrow(/42501/); expect(()=>publish(old.digest)).toThrow(/40001/)
    db(`UPDATE connector_members SET can_use=false WHERE user_id='${id.admin}'; UPDATE instance_nodes SET task_connector_id=NULL WHERE id='${node}'`)
    try { expect(JSON.parse(revoke()).revoked).toBe(true); expect(service(sql('route',`'${instance}'`))).toBe('t') }
    finally { db(`SET request.jwt.claims='{"sub":"${id.admin}"}'; UPDATE instance_nodes SET task_connector_id='${connector}',prompt='{}' WHERE id='${node}';
      UPDATE connector_members SET can_use=true WHERE user_id='${id.admin}'`) }
    expect(()=>publish(old.digest)).toThrow(/40001/); approve(); expect(()=>dispatch()).toThrow(/42501/)
  })

  it('matches the reviewed cron in its saved timezone, not just an arbitrary recent minute', () => {
    const statement=(offset:number)=>`WITH local AS (SELECT date_trunc('minute',now()) AT TIME ZONE 'Asia/Kathmandu' AS tick),
      cfg AS (SELECT jsonb_build_object('kind','cron','timezone','Asia/Kathmandu','cron',
      concat((extract(minute FROM tick)::int+${offset})%60,' ',extract(hour FROM tick)::int,' * * *')) AS j FROM local)
      UPDATE workflow_triggers SET config=cfg.j FROM cfg; UPDATE instance_nodes SET settings=jsonb_build_object('trigger',(SELECT config FROM workflow_triggers)) WHERE id='${root}'`
    // Capture one instant for this case, even when the test crosses a minute boundary.
    const tick=db("SELECT date_trunc('minute',now())::text")
    try {
      for(const offset of [1,0]) {
        db(statement(offset).replace("date_trunc('minute',now())",`'${tick}'::timestamptz`)); approve()
        const attempt=()=>service(bind(run,job,trigger,`'${tick}'::timestamptz`))
        if(offset) expect(attempt).toThrow(/42501/); else expect(JSON.parse(attempt()).tool_slug).toBe(slug)
      }
    } finally { db(`UPDATE workflow_triggers SET config='${cfg}'; UPDATE instance_nodes SET settings=jsonb_build_object('trigger','${cfg}'::jsonb) WHERE id='${root}'`) }
  })

  it('excludes browser RPC execution and direct access to private jobs, publications and receipts even by service_role', () => {
    expect(db(`SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND starts_with(proname,'workflow_connector_')
      AND (has_function_privilege('authenticated',oid,'EXECUTE') OR has_function_privilege('anon',oid,'EXECUTE'))`)).toBe('0')
    for(const role of ['service_role','authenticated','anon']) for(const table of ['jobs','publications'])
      for(const op of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE']) expect(db(`SELECT has_table_privilege('${role}','workflow_connector_private.${table}','${op}')`)).toBe('f')
    expect(()=>db(`SET ROLE authenticated; ${sql('publish',`${names()},'anything',${jsonSql(operation())}`)}`)).toThrow(/permission denied/)
  })
})
