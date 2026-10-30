/** @jest-environment node */
import { actorSql, isolatedPostgres, migration, postgresAvailable } from '../security/isolated-postgres'
import { installEvidenceFixture, ids, uuid, supplierId, quoteDocument, sqlJson, upload } from './evidence-fixture'
import { publicationId, tenderId, requirementId, approve, openAward } from './commerce-fixture'

jest.setTimeout(180000)
const describePg = postgresAvailable ? describe : describe.skip
const forward = '20261030120000_procurement_open_self_participation.sql'
describePg('open public self participation on isolated PostgreSQL', () => {
  const pg = isolatedPostgres()
  beforeAll(() => pg.start())
  afterAll(() => pg.stop())
  beforeEach(() => {
    installEvidenceFixture(pg, true)
    for (const file of ['20261028001000_procurement_approval_revalidation.sql',
      '20261028020000_procurement_lifecycle_repair.sql', '20261028020001_procurement_commerce_lifecycle_repair.sql', forward]) pg.db(migration(file))
    pg.call(`SELECT configure_procurement_tender_portal('${ids.site}',true);`)
    pg.db(`SET session_replication_role=replica;
      UPDATE procurement_tenders SET visibility='public',participation='open' WHERE id='${tenderId}';
      UPDATE procurement_tender_publications SET visibility='public',snapshot=jsonb_set(snapshot,'{participation}','"open"') WHERE id='${publicationId}';
      UPDATE procurement_tender_policy_bindings SET working_snapshot=(SELECT to_jsonb(t)-ARRAY['status','updated_at','version'] FROM procurement_tenders t WHERE id='${tenderId}');
      SET session_replication_role=origin;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
      DO $$ DECLARE f record; BEGIN FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef LOOP
      EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',f.signature); END LOOP; END $$;`)
  })
  const registerSql = `SELECT register_open_tender_participant('${publicationId}');`
  const register = (actor = ids.foreign) => pg.call(registerSql, actor)
  const submit = (supplier: string, extra = {}, actor = ids.foreign) => pg.call(
    `SELECT submit_procurement_quotation('${ids.site}',${sqlJson({ ...quoteDocument, supplier_id: supplier, ...extra })});`, actor)
  const opportunities = (actor = ids.foreign) => JSON.parse(pg.call('SELECT my_procurement_participation();', actor))
  const amend = (sql: string) => pg.db(`SET session_replication_role=replica; ${sql} SET session_replication_role=origin;`)

  test('unregistered account sees safe nullable DTO, registers and submits without approval or representation', () => {
    const before = opportunities()
    expect(before).toHaveLength(1)
    expect(before[0].supplier_id).toBeNull()
    expect(before[0].supplier_name).toBe('On behalf of myself')
    expect(before[0].acting_as_self).toBe(true)
    expect(Object.keys(before[0]).sort()).toEqual(['site_id', 'supplier_id', 'supplier_name', 'acting_as_self', 'tender_id', 'publication_id',
      'version', 'title', 'description', 'currency', 'participation_deadline', 'opening_at', 'opening_policy', 'requirements'].sort())
    expect(before[0].requirements).toEqual([{ id: requirementId, description: 'Equipment', quantity: 2, unit: 'each' }])
    const self = register()
    expect(self).not.toBe(supplierId)
    expect(register()).toBe(self)
    expect(opportunities()[0].supplier_id).toBe(self)
    expect(pg.db(`SELECT status FROM suppliers WHERE id='${self}';`)).toBe('prospect')
    expect(pg.call(`SELECT procurement_can_represent('${ids.site}','${self}');`, ids.foreign)).toBe('f')
    expect(pg.db('SELECT count(*) FROM supplier_representatives;')).toBe('0')
    expect(pg.db('SELECT count(*) FROM supplier_contacts;')).toBe('0')
    const quote = submit(self)
    expect(submit(self)).toBe(quote)
    expect(JSON.parse(pg.call('SELECT my_procurement_submissions();', ids.foreign))[0].id).toBe(quote)
    expect(pg.call('SELECT count(*) FROM suppliers;', ids.foreign)).toBe('0')
    expect(pg.call('SELECT count(*) FROM quotations;', ids.foreign)).toBe('0')
  })

  test('anonymous, missing, unconfirmed and forged identities cannot register or claim a supplier', () => {
    expect(() => pg.call(registerSql, ids.foreign, 'anon')).toThrow(/permission denied/)
    expect(() => pg.call(registerSql, uuid(999))).toThrow(/Confirmed account/)
    pg.db(`UPDATE auth.users SET email_confirmed_at=NULL WHERE id='${ids.inactive}';`)
    expect(() => register(ids.inactive)).toThrow(/Confirmed account/)
    expect(opportunities(ids.inactive)).toEqual([])
    expect(() => submit(supplierId)).toThrow(/representation required/)
    const self = register()
    expect(() => submit(self, {}, ids.admin)).toThrow(/representation required/)
    expect(() => pg.call(`INSERT INTO procurement_open_registrations VALUES('${publicationId}','${ids.site}','${self}','${ids.admin}',now());`, ids.foreign)).toThrow(/permission denied/)
    expect(() => pg.call(`SELECT procurement_self_participation('${ids.site}','${self}','${publicationId}','${ids.foreign}');`, ids.foreign)).toThrow(/permission denied/)
    expect(pg.call('SELECT count(*) FROM procurement_self_suppliers;')).toBe('0')
    expect(() => pg.call(`SELECT submit_procurement_quotation('${ids.otherSite}',${sqlJson({ ...quoteDocument, supplier_id: self })});`, ids.foreign)).toThrow(/representation required/)
  })
  test.each(['private', 'unlisted', 'approved_suppliers', 'invitation_only', 'closed', 'expired', 'stale', 'disabled', 'archived'])('rejects %s opportunities and registration', state => {
    if (['private', 'unlisted'].includes(state)) amend(`UPDATE procurement_tender_publications SET visibility='${state}';`)
    else if (['approved_suppliers', 'invitation_only'].includes(state)) amend(`UPDATE procurement_tender_publications SET snapshot=jsonb_set(snapshot,'{participation}',to_jsonb('${state}'::text));`)
    else if (state === 'closed') amend(`UPDATE procurement_tenders SET status='closed';`)
    else if (state === 'expired') openAward(pg)
    else if (state === 'stale') amend(`UPDATE procurement_tenders SET version=2;`)
    else if (state === 'disabled') pg.call(`SELECT configure_procurement_tender_portal('${ids.site}',false);`)
    else pg.db(`UPDATE sites SET archived_at=now() WHERE id='${ids.site}';`)
    expect(opportunities()).toEqual([])
    expect(() => register()).toThrow(/Open public tender/)
    expect(pg.db('SELECT count(*) FROM procurement_self_suppliers;')).toBe('0')
  })

  test('scoped personal evidence remains sealed and rejects another account revision atomically', () => {
    const self = register()
    const first = upload(pg)
    const other = upload(pg, ids.admin)
    expect(() => submit(self, { evidence: [{ requirement_id: requirementId, revision_id: other.revision_id }] })).toThrow(/Private evidence unavailable/)
    expect(pg.db('SELECT count(*) FROM quotations;')).toBe('0')
    const quote = submit(self, { evidence: [{ requirement_id: requirementId, revision_id: first.revision_id }] })
    expect(pg.call('SELECT count(*) FROM procurement_submission_evidence;')).toBe('0')
    expect(pg.call('SELECT count(*) FROM procurement_submission_evidence;', ids.foreign)).toBe('1')
    expect(pg.call(`SELECT count(*) FROM procurement_credential_revisions WHERE id='${first.revision_id}';`)).toBe('0')
    openAward(pg)
    expect(pg.call(`SELECT count(*) FROM procurement_credential_revisions WHERE id='${first.revision_id}';`)).toBe('1')
    expect(pg.call(`SELECT count(*) FROM procurement_credential_revisions WHERE id='${first.revision_id}';`, ids.inactive)).toBe('0')
    expect(() => pg.call(`SELECT attach_procurement_quotation_evidence('${quote}','[]');`, ids.foreign)).toThrow(/permission denied/)
  })

  test('self quotes count for commerce and can be awarded/ordered without blanket supplier approval', () => {
    const self = register()
    const quote = submit(self)
    openAward(pg)
    const context = JSON.parse(pg.call(`SELECT procurement_commerce_event_context('${ids.site}','${quote}',1,'award');`))
    expect(context.supplier_proposals).toBe(1)
    pg.call(approve(quote, 'award'), ids.owner, 'service_role')
    const awardId = pg.db(`SELECT id FROM procurement_awards WHERE quotation_id='${quote}';`)
    pg.call(approve(awardId, 'order'), ids.owner, 'service_role')
    expect(pg.db(`SELECT count(*) FROM purchase_orders WHERE supplier_id='${self}';`)).toBe('1')
    expect(pg.db(`SELECT status FROM suppliers WHERE id='${self}';`)).toBe('prospect')
  })

  test('registration is publication scoped and cannot bypass restricted, buyer-recorded or blocked supplier rules', () => {
    const self = register()
    expect(() => pg.call(`SELECT record_procurement_quotation('${ids.site}',${sqlJson({ ...quoteDocument, supplier_id: self })});`)).toThrow(/not approved/)
    for (const participation of ['approved_suppliers', 'invitation_only']) {
      amend(`UPDATE procurement_tender_publications SET snapshot=jsonb_set(snapshot,'{participation}',to_jsonb('${participation}'::text));`)
      expect(() => submit(self)).toThrow(/representation required/)
    }
    amend(`UPDATE procurement_tender_publications SET snapshot=jsonb_set(snapshot,'{participation}','"open"');`)
    expect(() => submit(self, { publication_id: uuid(991) })).toThrow(/representation required/)
    const quote = submit(self)
    pg.db(`SET request.jwt.claims='{"sub":"${ids.owner}"}'; UPDATE suppliers SET status='blocked',version=version+1 WHERE id='${self}';`)
    expect(opportunities()).toEqual([])
    expect(() => register()).toThrow(/Self participation unavailable/)
    expect(() => submit(self)).toThrow(/representation required/)
    openAward(pg)
    expect(() => pg.call(`SELECT procurement_commerce_event_context('${ids.site}','${quote}',1,'award');`)).toThrow(/approval revoked/)
  })

  test('explicit representation and invitation requirements still apply to existing suppliers', () => {
    amend(`UPDATE procurement_tender_publications SET visibility='private',snapshot=jsonb_set(snapshot,'{participation}','"invitation_only"');`)
    pg.call(`SELECT set_supplier_representative('${ids.site}','${supplierId}','${ids.foreign}',false);`)
    expect(opportunities()).toHaveLength(1)
    pg.call(`SELECT set_procurement_tender_participant('${ids.site}','${tenderId}',1,'${supplierId}','withdrawn');`)
    expect(opportunities()).toEqual([])
    expect(() => submit(supplierId)).toThrow(/Invited supplier required/)
    pg.call(`SELECT set_procurement_tender_participant('${ids.site}','${tenderId}',1,'${supplierId}','invited');`)
    const quote = submit(supplierId)
    expect(quote).toBeTruthy()
    pg.call(`SELECT set_supplier_representative('${ids.site}','${supplierId}','${ids.foreign}',true);`)
    expect(() => submit(supplierId)).toThrow(/representation required/)
  })

  test('concurrent registration retries create one supplier and one publication grant', async () => {
    const results = await Promise.all([pg.concurrent(actorSql(registerSql, ids.foreign)), pg.concurrent(actorSql(registerSql, ids.foreign))])
    expect(results[0]).toBe(results[1])
    expect(pg.db('SELECT count(*) FROM procurement_self_suppliers;')).toBe('1')
    expect(pg.db('SELECT count(*) FROM procurement_open_registrations;')).toBe('1')
    expect(register(ids.admin)).not.toBe(results[0])
  })
})
