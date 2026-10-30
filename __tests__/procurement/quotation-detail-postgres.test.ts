/** @jest-environment node */
import { isolatedPostgres, postgresAvailable, migration } from '../security/isolated-postgres'
import { installCommerceFixture, ids, uuid, supplierId, tenderId, quoteDocument, recordQuote, openAward } from './commerce-fixture'
import { sqlJson } from './storage-fixture'

jest.setTimeout(180000)
const describePg = postgresAvailable ? describe : describe.skip
describePg('quotation detail on isolated PostgreSQL', () => {
  const pg = isolatedPostgres()
  const query = (id: string, site = ids.site) => `SELECT get_procurement_quotation('${site}','${id}');`
  beforeAll(() => pg.start())
  afterAll(() => pg.stop())
  beforeEach(() => {
    installCommerceFixture(pg)
    pg.db(migration('20261030220000_procurement_quotation_detail.sql'))
    pg.db('ALTER FUNCTION public.get_procurement_quotation(uuid,uuid) OWNER TO postgres;')
  })

  test('matches the authorized list projection without exposing seller/private fields', () => {
    const id = pg.call(recordQuote())
    const detail = JSON.parse(pg.call(query(id)))
    expect(detail).toEqual(JSON.parse(pg.call(`SELECT list_procurement_quotations('${ids.site}');`))[0])
    expect(detail).toMatchObject({ id, supplier_id: supplierId, tender_id: tenderId, net_amount_minor: 2468 })
    expect(detail.lines).toHaveLength(1)
    expect(detail).not.toHaveProperty('public_access_token')
    expect(detail).not.toHaveProperty('buyer_user_id')
    expect(detail).not.toHaveProperty('private_notes')
    expect(pg.call('SELECT count(*) FROM quotations;')).toBe('0')
  })

  test('reads an older quotation independently of the newest-100 list window', () => {
    const id = pg.call(recordQuote())
    pg.db(`SET session_replication_role=replica;
      CREATE TEMP TABLE extra_suppliers AS SELECT gen_random_uuid() AS id FROM generate_series(1,104);
      INSERT INTO suppliers SELECT id,'${ids.site}','Additional supplier','approved' FROM extra_suppliers;
      INSERT INTO quotations SELECT (jsonb_populate_record(NULL::quotations,
        to_jsonb(q)||jsonb_build_object('id',gen_random_uuid(),
          'procurement_supplier_id',s.id,'procurement_idempotency_key',gen_random_uuid(),'created_at',now()+interval '1 day'))).*
      FROM quotations q CROSS JOIN extra_suppliers s WHERE q.id='${id}';
      SET session_replication_role=origin;`)
    const listed = JSON.parse(pg.call(`SELECT list_procurement_quotations('${ids.site}');`))
    expect(listed).toHaveLength(100)
    expect(listed.some((row: { id: string }) => row.id === id)).toBe(false)
    expect(JSON.parse(pg.call(query(id))).id).toBe(id)
  })

  test('withholds sealed contents even if working tender terms change', () => {
    pg.db(`CREATE FUNCTION public.procurement_can_represent(uuid,uuid) RETURNS boolean LANGUAGE sql AS $$
      SELECT auth.uid()='${ids.foreign}'::uuid AND $1='${ids.site}'::uuid AND $2='${supplierId}'::uuid $$;
      CREATE TABLE public.supplier_representatives(site_id uuid,supplier_id uuid,user_id uuid,revoked_at timestamptz);
      INSERT INTO public.supplier_representatives VALUES('${ids.site}','${supplierId}','${ids.foreign}',NULL);
      GRANT SELECT,UPDATE ON public.supplier_representatives TO postgres;`)
    const id = pg.call(`SELECT submit_procurement_quotation('${ids.site}',${sqlJson(quoteDocument)});`, ids.foreign)
    expect(pg.call(query(id))).toBe('')
    pg.db(`UPDATE procurement_tenders SET version=2,opening_policy='on_receipt' WHERE id='${tenderId}';`)
    expect(pg.call(query(id))).toBe('')
    openAward(pg)
    expect(JSON.parse(pg.call(query(id))).id).toBe(id)
  })

  test.each([ids.foreign, ids.inactive, ids.collaborator])('denies unauthorized actor %s', actor => {
    const id = pg.call(recordQuote())
    expect(() => pg.call(query(id), actor)).toThrow(/access denied/)
  })

  test('denies cross-site and location-restricted access and disallows anonymous/service roles', () => {
    const id = pg.call(recordQuote())
    expect(pg.call(query(id, ids.otherSite), ids.foreign)).toBe('')
    expect(() => pg.call(query(id, ids.otherSite))).toThrow(/access denied/)
    for (const role of ['anon', 'service_role']) expect(() => pg.call(query(id), ids.owner, role)).toThrow(/permission denied/)
    pg.db(`UPDATE fixture_members SET restricted=true WHERE user_id='${ids.admin}';`)
    expect(() => pg.call(query(id), ids.admin)).toThrow(/access denied/)
  })

  test('returns no detail for missing IDs or commercial quotations', () => {
    expect(pg.call(query(uuid(999)))).toBe('')
    const id = uuid(998)
    pg.db(`INSERT INTO quotations(id,site_id,lead_id) VALUES('${id}','${ids.site}','${ids.owner}');`)
    expect(pg.call(query(id))).toBe('')
  })
})