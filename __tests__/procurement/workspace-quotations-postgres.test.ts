/** @jest-environment node */
import { isolatedPostgres, migration, postgresAvailable } from '../security/isolated-postgres'
import { ids, uuid, quoteDocument, sqlJson, supplierId } from './evidence-fixture'
import { publicationId } from './commerce-fixture'
import { installBusinessQuotationFixture } from './business-quotation-fixture'

jest.setTimeout(180000)
const describePg = postgresAvailable ? describe : describe.skip
const forward = '20261030150000_workspace_quotation_reads.sql'

describePg('unified workspace quotations on isolated PostgreSQL', () => {
  const pg = isolatedPostgres()
  const amend = (sql: string) => pg.db(`SET session_replication_role=replica; ${sql} SET session_replication_role=origin;`)
  const listing = (args = "'all','','1','50','newest'", site = ids.otherSite, actor = ids.admin) =>
    JSON.parse(pg.call(`SELECT list_workspace_quotations('${site}',${args});`, actor))
  const detail = (id: string, actor = ids.admin, site = ids.otherSite) =>
    JSON.parse(pg.call(`SELECT COALESCE(get_business_procurement_quotation('${site}','${id}'),'null'::jsonb);`, actor))
  const register = () => pg.call(`SELECT register_open_tender_business('${publicationId}','${ids.otherSite}');`, ids.foreign)
  const submit = (supplier: string, actor = ids.foreign, key = uuid(1500)) => pg.call(
    `SELECT submit_procurement_quotation('${ids.site}',${sqlJson({ ...quoteDocument, supplier_id: supplier, idempotency_key: key })});`, actor)
  let quote: string
  beforeAll(() => pg.start())
  afterAll(() => pg.stop())
  beforeEach(() => {
    pg.db('DROP SCHEMA IF EXISTS workspace_quotation_private CASCADE;')
    installBusinessQuotationFixture(pg)
    pg.db(`ALTER TABLE site_members ADD COLUMN blocked_screens text[] DEFAULT '{}';
      CREATE TABLE leads(id uuid PRIMARY KEY,name text,email text,visible boolean);
      ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
      GRANT SELECT ON leads TO authenticated; GRANT ALL ON leads TO postgres;
      CREATE POLICY fixture_leads ON leads FOR SELECT TO authenticated USING(visible);
      CREATE POLICY fixture_sales_scope ON quotations AS RESTRICTIVE FOR SELECT TO authenticated
        USING(site_id='${ids.otherSite}' AND notes IS DISTINCT FROM 'hidden');
      INSERT INTO leads VALUES('${uuid(1510)}','Sales lead','lead@example.test',true),
        ('${uuid(1511)}','Secret lead','secret@example.test',false);`)
    pg.db(migration(forward))
    pg.db(`ALTER FUNCTION workspace_quotation_private.authorize(uuid) OWNER TO postgres;
      ALTER FUNCTION workspace_quotation_private.business_rows(uuid,uuid) OWNER TO postgres;
      ALTER FUNCTION get_business_procurement_quotation(uuid,uuid) OWNER TO postgres;
      GRANT USAGE ON SCHEMA workspace_quotation_private TO postgres;`)
    quote = submit(register())
  })

  test('ordinary member sees exact safe DTO; sales and personal IDs return null', () => {
    expect(pg.call('SELECT count(*) FROM quotations;', ids.admin)).toBe('0')
    const row = listing().data[0]
    expect(row).toMatchObject({ id: quote, purpose: 'procurement', status: 'sent', total: 28.63,
      currency: 'USD', title: 'Tender', reference: 'Supplier PDF 123', lead: { name: 'Buyer business', email: null } })
    expect(Object.keys(row).sort()).toEqual(['id', 'purpose', 'status', 'total', 'currency', 'created_at',
      'updated_at', 'valid_until', 'lead', 'title', 'reference', 'tender_url'].sort())
    const result = detail(quote)
    expect(result).toMatchObject({ id: quote, purpose: 'procurement', status: 'sent', subtotal: 24.68,
      tax_total: 3.95, total: 28.63, site: { name: 'Owned business' }, lead: { name: 'Buyer business' },
      items: [{ name: 'Equipment', quantity: 2, unit_price: 12.34, subtotal: 24.68 }] })
    expect(Object.keys(result).sort()).toEqual(['id', 'purpose', 'status', 'title', 'reference', 'created_at',
      'valid_until', 'site', 'lead', 'items', 'subtotal', 'tax_total', 'total', 'currency', 'tender_url'].sort())
    expect(Object.keys(result.items[0]).sort()).toEqual(['id', 'name', 'quantity', 'unit_price', 'subtotal'].sort())
    const slug = pg.db(`SELECT portal_slug FROM procurement_tenders WHERE id='${quoteDocument.tender_id}';`)
    const portal = pg.db(`SELECT slug FROM procurement_tender_portals WHERE site_id='${ids.site}';`)
    expect(result.tender_url).toBe(`/tenders/${portal}/${slug}`)
    expect(detail(uuid(1599))).toBeNull()
    const self = pg.call(`SELECT register_open_tender_participant('${publicationId}');`, ids.foreign)
    const personal = submit(self, ids.foreign, uuid(1501))
    expect(detail(personal)).toBeNull()
    pg.call(`SELECT set_supplier_representative('${ids.site}','${supplierId}','${ids.foreign}',false);`)
    const represented = submit(supplierId, ids.foreign, uuid(1502))
    expect(detail(represented)).toBeNull()
    expect(listing().count).toBe(1)
    expect(listing("'all','','1','50','newest'", ids.site, ids.owner).count).toBe(0)
    expect(detail(quote, ids.owner, ids.site)).toBeNull()
  })

  test('visibility survives submitter departure but not viewer revocation/license/archive', () => {
    // Ownership changes are a synthetic departure fixture, not attribution inference.
    pg.db(`UPDATE sites SET user_id='${ids.owner}' WHERE id='${ids.otherSite}';`)
    expect(detail(quote)).not.toBeNull()
    expect(listing().count).toBe(1)
    for (const change of ["status='inactive'", "status='pending'", 'manually_disabled=true']) {
      pg.db(`UPDATE site_members SET ${change} WHERE site_id='${ids.otherSite}' AND user_id='${ids.admin}';`)
      expect(() => listing()).toThrow(/Quotation access denied/)
      expect(() => detail(quote)).toThrow(/Quotation access denied/)
      pg.db(`UPDATE site_members SET status='active',manually_disabled=false WHERE site_id='${ids.otherSite}';`)
    }
    pg.db(`UPDATE sites SET test_plan='commission' WHERE id='${ids.otherSite}';`)
    expect(() => listing()).toThrow(/Quotation access denied/)
    pg.db(`UPDATE sites SET test_plan='engine',archived_at=now() WHERE id='${ids.otherSite}';`)
    expect(() => listing()).toThrow(/Quotation access denied/)
  })

  test('screen, select and unscoped location gates apply inside both RPCs', () => {
    pg.db(`UPDATE site_members SET blocked_screens=ARRAY['quotations'] WHERE site_id='${ids.otherSite}';`)
    expect(() => listing()).toThrow(/Quotation access denied/)
    expect(() => detail(quote)).toThrow(/Quotation access denied/)
    expect(detail(quote, ids.foreign)).not.toBeNull()
    pg.db(`UPDATE site_members SET role='admin' WHERE site_id='${ids.otherSite}' AND user_id='${ids.admin}';`)
    expect(detail(quote)).not.toBeNull()
    pg.db(`INSERT INTO fixture_members(site_id,user_id,role,active,licensed,restricted)
      VALUES('${ids.otherSite}','${ids.admin}','admin',true,true,true);`)
    amend(`INSERT INTO quotations(id,site_id,lead_id,status) VALUES
      ('${uuid(1520)}','${ids.otherSite}','${uuid(1510)}','sent');`)
    expect(listing()).toMatchObject({ count: 1, data: [{ id: uuid(1520), purpose: 'sales' }] })
    expect(detail(quote)).toBeNull()
    pg.db(`UPDATE fixture_members SET restricted=false;
      CREATE OR REPLACE FUNCTION user_can(p_site_id uuid,p_command text) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;`)
    expect(() => listing()).toThrow(/Quotation access denied/)
    expect(() => detail(quote)).toThrow(/Quotation access denied/)
  })

  test('globally paginates, filters, searches and sorts without bypassing sales or lead RLS', () => {
    amend(`UPDATE quotations SET created_at='2026-02-01',updated_at='2026-04-01' WHERE id='${quote}';
      INSERT INTO quotations(id,site_id,lead_id,status,created_at,updated_at,notes) VALUES
      ('${uuid(1520)}','${ids.otherSite}','${uuid(1510)}','sent','2026-01-01','2026-01-01',NULL),
      ('${uuid(1521)}','${ids.otherSite}','${uuid(1511)}','draft','2026-03-01','2026-03-01',NULL),
      ('${uuid(1522)}','${ids.otherSite}','${uuid(1510)}','sent','2026-05-01','2026-05-01','hidden'),
      ('${uuid(1523)}','${ids.site}','${uuid(1510)}','sent','2026-05-01','2026-05-01',NULL);`)
    expect(detail(uuid(1520))).toBeNull()
    expect(listing().count).toBe(3)
    expect(listing().data.map((r: { id: string }) => r.id)).toEqual([uuid(1521), quote, uuid(1520)])
    expect(listing().data[0].lead).toEqual({ name: null, email: null })
    expect(listing("'all','','2','1','newest'")).toMatchObject({ count: 3, data: [{ id: quote }] })
    expect(listing("'all','','1','1','oldest'").data[0].id).toBe(uuid(1520))
    expect(listing("'all','','1','1','updated_at'").data[0].id).toBe(quote)
    expect(listing("'sent','','1','50','newest'").count).toBe(2)
    expect(listing("'draft','','1','50','newest'").count).toBe(1)
    expect(listing("'all','supplier pdf','1','50','newest'").data[0].id).toBe(quote)
    expect(listing("'all','secret','1','50','newest'").count).toBe(0)
    expect(listing("'all','lead@example','1','50','newest'").count).toBe(1)
    expect(listing("'all','','99','50','newest'")).toEqual({ count: 3, data: [] })
  })

  test('company results are paginated globally rather than truncated before counting', () => {
    amend(`DO $$ DECLARE pub uuid; supplier uuid; BEGIN FOR n IN 1..105 LOOP
      pub:=gen_random_uuid(); supplier:=gen_random_uuid();
      INSERT INTO suppliers(id,site_id,name,created_by) VALUES(supplier,'${ids.site}','Historical business','${ids.owner}');
      INSERT INTO procurement_tender_publications SELECT (jsonb_populate_record(NULL::procurement_tender_publications,
        to_jsonb(p)||jsonb_build_object('id',pub,'version',n+1))).*
        FROM procurement_tender_publications p WHERE p.id='${publicationId}';
      INSERT INTO procurement_open_business_registrations(publication_id,acting_site_id,site_id,supplier_id,registered_by)
        VALUES(pub,'${ids.otherSite}','${ids.site}',supplier,'${ids.foreign}');
      INSERT INTO quotations SELECT (jsonb_populate_record(NULL::quotations,
        to_jsonb(q)||jsonb_build_object('id',gen_random_uuid(),'procurement_idempotency_key',gen_random_uuid(),
          'procurement_publication_id',pub,'procurement_supplier_id',supplier,'procurement_reference','Historical proposal '||n))).*
        FROM quotations q WHERE q.id='${quote}';
      END LOOP; END $$;`)
    expect(listing("'all','','1','100','newest'").data).toHaveLength(100)
    expect(listing("'all','','2','100','newest'")).toMatchObject({ count: 106 })
    expect(listing("'all','','2','100','newest'").data).toHaveLength(6)
  })

  test('bounds, direct RPC roles and missing identity fail closed', () => {
    for (const args of ["'all','','0','50','newest'", "'all','','1','101','newest'", "'all','','100001','50','newest'",
      "'all','','1','50','random'", "NULL,'','1','50','newest'", "'all',NULL,'1','50','newest'",
      "'other','','1','50','newest'", `'all','${'x'.repeat(201)}','1','50','newest'`]) {
      expect(() => listing(args)).toThrow(/Invalid quotation filters/)
    }
    for (const role of ['anon', 'service_role']) {
      expect(() => pg.call(`SELECT list_workspace_quotations('${ids.otherSite}');`, ids.foreign, role)).toThrow(/permission denied/)
      expect(() => pg.call(`SELECT get_business_procurement_quotation('${ids.otherSite}','${quote}');`, ids.foreign, role)).toThrow(/permission denied/)
    }
    expect(() => pg.db(`SET ROLE authenticated; SELECT list_workspace_quotations('${ids.otherSite}');`)).toThrow(/Quotation access denied/)
    expect(() => listing(undefined, ids.otherSite, ids.inactive)).toThrow(/Quotation access denied/)
    expect(() => pg.call(`SELECT * FROM workspace_quotation_private.business_rows('${ids.otherSite}');`, ids.inactive)).toThrow(/Quotation access denied/)
    expect(() => pg.call('SELECT * FROM procurement_open_business_registrations;', ids.admin)).toThrow(/permission denied/)
  })
})