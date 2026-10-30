/** @jest-environment node */
import { isolatedPostgres, postgresAvailable, migration } from '../security/isolated-postgres'
import { installCommerceFixture } from './commerce-fixture'
import { linkedDraft, publish, quote, openAward, approvalSql, requestPolicy, ids, saveTender } from './lifecycle-repair-fixture'

;(postgresAvailable ? describe : describe.skip)('lifecycle repair upgrade of actual historical workflow', () => {
  const pg = isolatedPostgres()
  beforeAll(() => pg.start())
  afterAll(() => pg.stop())
  beforeEach(() => {
    installCommerceFixture(pg, true)
    pg.db(migration('20261028001000_procurement_approval_revalidation.sql'))
  })
  function upgrade() {
    pg.db(migration('20261028020000_procurement_lifecycle_repair.sql'))
    pg.db(migration('20261028020001_procurement_commerce_lifecycle_repair.sql'))
    pg.db(`GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
      DO $$ DECLARE f record; BEGIN FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
        JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef LOOP
        EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',f.signature); END LOOP; END $$;`)
  }
  test('backfills exact saved working version and request submission; clean legacy publication can order', () => {
    const f = linkedDraft(pg)
    const pub = publish(pg, f.tender)
    const q = quote(pg, f.tender, pub)
    upgrade()
    expect(pg.db(`SELECT request_id::text||':'||request_revision FROM procurement_tender_policy_bindings WHERE publication_id='${pub}'`)).toBe(`${f.request}:1`)
    expect(pg.db(`SELECT request_plan=(SELECT resolved_plan FROM procurement_requests WHERE id='${f.request}') FROM procurement_tender_policy_bindings WHERE publication_id='${pub}'`)).toBe('t')
    openAward(pg)
    pg.call(`SELECT transition_procurement_tender('${ids.site}','${f.tender}',1,'close')`)
    pg.call(approvalSql(q, 'award'), ids.owner, 'service_role')
    const award = pg.db(`SELECT id FROM procurement_awards WHERE quotation_id='${q}'`)
    pg.call(approvalSql(award, 'order'), ids.owner, 'service_role')
    expect(pg.db('SELECT count(*) FROM purchase_orders')).toBe('1')
  })
  test('backfilled approved historical request requirements are not replaced by empty current event rules', () => {
    const f = linkedDraft(pg, requestPolicy('award', 3))
    const pub = publish(pg, f.tender, f.document)
    const q = quote(pg, f.tender, pub)
    upgrade(); openAward(pg)
    expect(() => pg.call(approvalSql(q, 'award'), ids.owner, 'service_role')).toThrow(/Inherited request requirements/)
    expect(pg.db(`SELECT request_plan->>'minimumSupplierProposals' FROM procurement_tender_policy_bindings WHERE publication_id='${pub}'`)).toBe('3')
    expect(pg.db('SELECT count(*) FROM purchase_orders')).toBe('0')
  })
  test('missing saved audit and pre-upgrade detached linkage fail closed rather than trusting today\'s draft', () => {
    const f = linkedDraft(pg)
    const pub = publish(pg, f.tender)
    const q = quote(pg, f.tender, pub)
    pg.call(saveTender(f.tender, 1, { ...f.tenderDoc, request_id: null }))
    upgrade(); openAward(pg)
    expect(pg.db(`SELECT request_id::text FROM procurement_tender_policy_bindings WHERE publication_id='${pub}'`)).toBe(f.request)
    expect(() => pg.call(`SELECT procurement_inherited_policy('${ids.site}','${f.tender}','award')`)).toThrow(/provenance unavailable or changed/)
    expect(() => pg.call(approvalSql(q, 'award'), ids.owner, 'service_role')).toThrow(/unpublished amendments/)
    // The baseline fixture's synthetic publication deliberately has no saved audit.
    expect(pg.db(`SELECT working_snapshot IS NULL FROM procurement_tender_policy_bindings WHERE tender_id='00000000-0000-4000-8000-000000000802'`)).toBe('t')
    expect(() => pg.call(`SELECT procurement_inherited_policy('${ids.site}','00000000-0000-4000-8000-000000000802','award')`)).toThrow(/provenance unavailable/)
  })
})