/** @jest-environment node */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { actorSql, isolatedPostgres, postgresAvailable, uuid } from '../security/isolated-postgres'
import { codeRoot, id, installConnectorFixture, jsonSql, sqlSource } from './connector-postgres-fixture'

const migration = '20261120060000_connector_review_conversations.sql'
const instance = uuid(211), ordinary = uuid(212), next = uuid(213)
const links = 'public.connector_approval_review_links'
const approvals = 'public.connector_action_approvals'
const chats = 'public.conversations'
const action = (instanceId = instance, owner = id.member, connector = id.connector) => ({
  origin: { kind: 'interactive', instance_id: instanceId, user_id: owner }, connector_id: connector,
  arguments: { secret_note: 'must never be projected into the thread' },
})
const request = (key: string, snapshot: unknown = action(), chat: string | null = null, agent = id.agent) =>
  `SELECT id FROM public.request_connector_action_approval('${id.site}',${chat ? `'${chat}'` : 'NULL'},
    '${agent}', '${key}', ${jsonSql(snapshot)})`
function canonicalTable(name: string, file: string) {
  const sql = readFileSync(path.join(codeRoot, 'makinari-db-scheme/bootstrap/supabase/migrations', file), 'utf8')
  const start = `CREATE TABLE public.${name} (`
  return start + sql.split(start)[1].split('\n);')[0] + '\n);'
}

it('keeps both mirrors identical to the forward-only canonical migration', () => {
  expect(sqlSource(migration)).toBe(sqlSource(migration, 'API'))
  expect(sqlSource(migration)).toBe(sqlSource(migration, 'makinari-db-scheme'))
})

;(postgresAvailable ? describe : describe.skip)('real private review conversations in socket-only PostgreSQL', () => {
  const pg = isolatedPostgres(), db = pg.db
  const service = (sql: string) => pg.call(sql, id.viewer, 'service_role')
  const race = (sql: string) => pg.concurrent(actorSql(sql, id.viewer, 'service_role'))
  const apply = () => db(sqlSource(migration))
  const mapped = (approval: string) => service(`SELECT review_conversation_id FROM ${links} WHERE approval_id='${approval}'`)
  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => {
    installConnectorFixture(db)
    db(`${canonicalTable('conversations','20261027000112_qa_baseline_072.sql')}
      ${canonicalTable('messages','20261027000115_qa_baseline_075.sql')}
      ALTER TABLE ${chats} ADD PRIMARY KEY (id);
      ALTER TABLE public.messages ADD FOREIGN KEY(conversation_id) REFERENCES ${chats}(id);
      CREATE TABLE public.remote_instances(id uuid PRIMARY KEY,site_id uuid,user_id uuid);
      INSERT INTO public.remote_instances VALUES('${instance}','${id.site}','${id.member}'),('${next}','${id.site}','${id.member}');
      INSERT INTO ${chats}(id,site_id,agent_id) VALUES('${ordinary}','${id.site}','${id.agent}');
      UPDATE public.connectors SET enabled=true WHERE id='${id.connector}';
      CREATE TABLE public.delivery_events(event text);
      CREATE FUNCTION public.dispatch_workflow_database_webhook() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS
        $$BEGIN INSERT INTO public.delivery_events VALUES(TG_OP); RETURN NULL; END$$;
      CREATE TRIGGER conversations_webhooks AFTER INSERT OR UPDATE OR DELETE ON ${chats}
        FOR EACH ROW EXECUTE FUNCTION public.dispatch_workflow_database_webhook();
      -- Deliberately broader than production: review privacy cannot depend on old permissive policies.
      ALTER TABLE ${chats} ENABLE ROW LEVEL SECURITY;
      CREATE POLICY broad_site_access ON ${chats} USING (true) WITH CHECK (true);
      GRANT ALL ON ${chats},public.messages TO authenticated,anon,service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon,authenticated,service_role;`)
    db(sqlSource('20261120020000_connector_action_approvals.sql'))
  })
  afterEach(() => db(`ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon,authenticated,service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon,authenticated,service_role;`))

  it('groups distinct requests exactly once under concurrent retries, without messages, customer data or workflow events', async () => {
    apply()
    const [a, replay, b] = await Promise.all([race(request('one')), race(request('one')), race(request('two'))])
    expect(a).toBe(replay); expect(a).not.toBe(b)
    expect(mapped(a)).toBe(mapped(b))
    expect(db(`SELECT count(*) FROM ${links}`)).toBe('2')
    expect(db(`SELECT count(*) FROM ${approvals} WHERE conversation_id IS NULL`)).toBe('2')
    expect(() => service(request('one', action(next)))).toThrow(/idempotency conflict/)
    expect(db(`SELECT count(*) FROM ${chats} WHERE channel='internal_review' AND visitor_id IS NULL AND lead_id IS NULL
      AND command_id IS NULL AND delegate_id IS NULL AND title='Instance approvals' AND last_message_at IS NOT NULL
      AND custom_data='{"channel":"internal_review"}' AND last_message_preview IS NULL AND message_count=0`)).toBe('1')
    expect(db('SELECT count(*) FROM public.messages')).toBe('0')
    expect(db('SELECT count(*) FROM public.delivery_events')).toBe('0')
    const other = mapped(service(request('other',action(next))))
    expect(other).not.toBe(mapped(a))
    db(`UPDATE public.remote_instances SET user_id='${id.owner}' WHERE id='${instance}';
      INSERT INTO public.agents VALUES ('${uuid(220)}','${id.site}','active')`)
    expect(pg.call(`SELECT id FROM ${chats} WHERE id='${mapped(a)}'`,id.member)).toBe('')
    const reassigned = mapped(service(request('changed-owner',action(instance,id.owner))))
    expect(reassigned).not.toBe(mapped(a))
    expect(mapped(service(request('changed-agent',action(instance,id.owner),null,uuid(220))))).not.toBe(reassigned)
  })

  it('rechecks real instance/site/owner/prompt agent and rejects channel aliases atomically', () => {
    apply()
    const thread = mapped(service(request('valid')))
    for (const [key,snapshot] of Object.entries({ missing: action(uuid(232)), foreignOwner: action(instance,id.foreign),
      wrongConnector: action(instance,id.member,id.foreignConnector), malformed: action('bad') })) {
      expect(() => service(request(key,snapshot))).toThrow(/Invalid interactive approval origin/)
    }
    expect(() => service(request('mixed',action(),ordinary))).toThrow(/Invalid interactive approval origin/)
    expect(() => service(request('bad-channel',{origin:{kind:'conversation'}},thread))).toThrow(/Invalid approval origin/)
    expect(() => service(request('bad-agent',action(),null,id.otherAgent))).toThrow(/Invalid approval origin/)
    db(`UPDATE public.remote_instances SET site_id='${id.otherSite}' WHERE id='${instance}'`)
    expect(() => service(request('wrong-site'))).toThrow(/Invalid interactive approval origin/)
    expect(db(`SELECT count(*) FROM ${approvals}`)).toBe('1')
    expect(mapped(service(request('ordinary',{origin:{kind:'conversation'}},ordinary)))).toBe('')
    expect(db('SELECT count(*) FROM public.connector_review_threads')).toBe('1')
  })

  it('does not replace custom or disabled workflow triggers and rolls back all DDL on drift', () => {
    db(`ALTER TABLE ${chats} DISABLE TRIGGER conversations_webhooks`)
    expect(apply).toThrow(/Unexpected conversation webhook configuration/)
    expect(db(`SELECT to_regclass('${links}') IS NULL`)).toBe('t')
    expect(db(`SELECT tgenabled FROM pg_trigger WHERE tgname='conversations_webhooks'`)).toBe('D')
  })

  it('allows only the current owner and live use-granted managers; generic UI data does not bypass queue privacy', () => {
    apply()
    const thread = mapped(service(request('visible')))
    const visible = `SELECT id FROM ${chats} WHERE id='${thread}'`
    expect(pg.call(visible,id.member)).toBe(thread)
    expect(pg.call(visible,id.member,'anon')).toBe('')
    for (const user of [id.admin,id.viewer,id.owner,id.blocked,id.disabled,id.foreign]) expect(pg.call(visible,user)).toBe('')
    db(`INSERT INTO public.connector_members(site_id,connector_id,user_id,can_view,can_use,granted_by)
      VALUES('${id.site}','${id.connector}','${id.admin}',true,true,'${id.owner}')`)
    expect(pg.call(visible,id.admin)).toBe(thread)
    db(`UPDATE public.connector_members SET revoked_at=now() WHERE user_id='${id.admin}'`)
    expect(pg.call(visible,id.admin)).toBe('')
    for (const role of ['authenticated','anon']) for (const table of [links,approvals,'public.connector_review_threads']) {
      expect(() => pg.call(`SELECT * FROM ${table}`,id.member,role)).toThrow(/permission denied/)
    }
    db(`UPDATE public.site_members SET status='pending' WHERE user_id='${id.member}'`)
    expect(pg.call(visible,id.member)).toBe('')
    expect(pg.call(`SELECT id FROM ${chats} WHERE id='${ordinary}'`,id.member)).toBe(ordinary)
  })

  it('composes with the canonical chat policy and does not inherit workspace use over an explicit denial', () => {
    const policy = readFileSync(path.join(codeRoot, 'makinari-db-scheme/bootstrap/supabase/migrations',
      '20261027000153_qa_baseline_113.sql'), 'utf8').match(/CREATE POLICY conversations_unified_access_policy [\s\S]*?;/)![0]
    db(`DROP POLICY broad_site_access ON ${chats};
      ALTER TABLE public.site_members ADD COLUMN restrict_to_assigned_only boolean DEFAULT false;
      CREATE TABLE public.leads(id uuid PRIMARY KEY, user_id uuid, assignee_id uuid);
      GRANT SELECT ON public.leads, public.sites, public.site_members, public.site_ownership TO authenticated,anon;
      ${policy}
      INSERT INTO public.connectors(id,site_id,provider_id,toolkit_slug,provider_account_id,auth_config_id,
        display_name,provider_status,created_by,verified_at,enabled,access_mode) VALUES
        ('${uuid(231)}','${id.site}','${id.provider}','gmail','workspace-account','auth-config','Shared','ACTIVE','${id.owner}',now(),true,'workspace');`)
    apply()
    const thread = mapped(service(request('shared',action(instance,id.member,uuid(231)))))
    const list = `SELECT id FROM ${chats} WHERE site_id='${id.site}' AND is_archived=false AND channel='internal_review'`
    expect(pg.call(list,id.owner)).toBe(thread)
    expect(pg.call(list,id.admin)).toBe(thread)
    expect(pg.call(list,id.member)).toBe(thread)
    expect(pg.call(list,id.viewer)).toBe('')
    db(`INSERT INTO public.connector_members(site_id,connector_id,user_id,can_view,can_use,granted_by)
      VALUES('${id.site}','${uuid(231)}','${id.admin}',true,false,'${id.owner}')`)
    expect(pg.call(list,id.admin)).toBe('')
    expect(pg.call(list,id.owner)).toBe(thread)
  })

  it('rejects repointing, forgery, delivery and browser writes without suppressing ordinary chat events', () => {
    apply()
    const a = service(request('sealed')), thread = mapped(a)
    expect(() => db(`UPDATE ${links} SET review_conversation_id='${ordinary}'`)).toThrow(/immutable/)
    for (const role of ['anon','authenticated','service_role']) {
      for (const sql of [`UPDATE ${links} SET review_conversation_id='${ordinary}'`, `DELETE FROM ${links}`, `TRUNCATE ${links}`]) {
        expect(() => pg.call(sql,id.member,role)).toThrow(/permission denied/)
      }
      expect(() => pg.call(`INSERT INTO ${chats}(channel) VALUES('internal_review')`,id.member,role)).toThrow()
      expect(() => pg.call(`INSERT INTO public.messages(conversation_id,role,content) VALUES('${thread}','user','data')`,id.member,role)).toThrow(/Conversation unavailable/)
    }
    expect(pg.call(`UPDATE ${chats} SET channel='email' WHERE id='${thread}' RETURNING id`,id.member)).toBe('')
    expect(pg.call(`DELETE FROM ${chats} WHERE id='${thread}' RETURNING id`,id.member)).toBe('')
    expect(() => service(`UPDATE ${chats} SET lead_id='${uuid(221)}' WHERE id='${thread}'`)).toThrow(/read only/)
    expect(() => service(`DELETE FROM ${chats} WHERE id='${thread}'`)).toThrow(/foreign key constraint/)
    expect(() => pg.call(`TRUNCATE ${chats} CASCADE`,id.member)).toThrow(/permission denied/)
    db(`INSERT INTO ${chats}(id) VALUES('${uuid(223)}'); UPDATE ${chats} SET title='example' WHERE id='${uuid(223)}';
      DELETE FROM ${chats} WHERE id='${uuid(223)}'`)
    expect(db(`SELECT event FROM public.delivery_events`)).toBe('INSERT\nUPDATE\nDELETE')
    expect(mapped(a)).toBe(thread)
  })

  it('links only verifiable live legacy requests on rollout; retries preserve the original provenance and outcome', () => {
    const original = service(request('legacy'))
    const stale = service(request('stale',action(uuid(250))))
    const rejected = service(request('done'))
    service(`SELECT status FROM public.decide_connector_action_approval('${id.site}','${rejected}','${id.owner}','reject')`)
    const expired = db(`INSERT INTO ${approvals}(site_id,agent_id,idempotency_key,action,created_at,expires_at)
      VALUES('${id.site}','${id.agent}','old',${jsonSql(action())},now()-interval '2 days',now()-interval '1 day') RETURNING id`)
    apply()
    expect(mapped(original)).toBeTruthy()
    expect(service(request('legacy'))).toBe(original)
    expect(service(`SELECT conversation_id IS NULL,status FROM ${approvals} WHERE id='${original}'`)).toBe('t|pending')
    for (const unlinked of [stale,rejected,expired]) expect(mapped(unlinked)).toBe('')
    expect(db(`SELECT count(*) FROM ${links}`)).toBe('1')
    expect(db('SELECT count(*) FROM public.delivery_events')).toBe('0')
  })
})