/** @jest-environment node */
import { actorSql, ids, installSiteFixture, isolatedPostgres, migration, postgresAvailable, uuid } from '../security/isolated-postgres'

const document = { name: 'Independent professional', status: 'prospect', company_id: null,
  commercial_terms: 'Net 30', private_notes: 'Private buyer note',
  contacts: [{ name: 'Purchasing contact', email: 'contact@example.test', phone: '+1 555 0100', role: 'Sales', is_primary: true }],
  category_ids: [uuid(50)] }
const json = (value: unknown) => `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`
const save = (id: string | null = null, version = 0, value: unknown = document, site = ids.site) =>
  `SELECT public.save_procurement_supplier('${site}',${id ? `'${id}'` : 'NULL'},${version},${json(value)});`

;(postgresAvailable ? describe : describe.skip)('supplier migration in isolated PostgreSQL', () => {
  const pg = isolatedPostgres()
  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => {
    installSiteFixture(pg.db)
    pg.db(`CREATE TABLE companies(id uuid PRIMARY KEY, name text);
      CREATE TABLE catalog_categories(id uuid PRIMARY KEY, site_id uuid REFERENCES sites, name text, status text);
      INSERT INTO catalog_categories VALUES ('${uuid(50)}','${ids.site}','Services','active'),
        ('${uuid(51)}','${ids.otherSite}','Other site','active');
      CREATE FUNCTION public.current_user_has_site_location_restrictions(p_site_id uuid) RETURNS boolean
      LANGUAGE sql STABLE AS $$ SELECT auth.uid() = '${uuid(90)}'::uuid $$;
      INSERT INTO site_members VALUES ('${ids.site}','${uuid(90)}','admin','active');
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon,authenticated,service_role;`)
    pg.db(migration('20261027170000_procurement_suppliers.sql'))
    pg.db(`ALTER TABLE suppliers OWNER TO postgres; ALTER TABLE supplier_contacts OWNER TO postgres;
      ALTER TABLE supplier_category_links OWNER TO postgres;
      ALTER TABLE supplier_activity OWNER TO postgres;
      GRANT SELECT ON companies,catalog_categories TO postgres;
      ALTER FUNCTION save_procurement_supplier(uuid,uuid,integer,jsonb) OWNER TO postgres;
      ALTER FUNCTION procurement_supplier_can(uuid,text) OWNER TO postgres;
      ALTER FUNCTION guard_supplier_category() OWNER TO postgres;`)
    pg.db('ALTER FUNCTION record_supplier_activity() OWNER TO postgres;')
  })
  it('persists a professional without a company or lead and normalized contacts/categories', () => {
    const created = JSON.parse(pg.call(save()))
    expect(created).toMatchObject({ ...document, site_id: ids.site, version: 1 })
    expect(pg.call('SELECT count(*) FROM supplier_contacts')).toBe('1')
    expect(pg.call('SELECT count(*) FROM supplier_category_links')).toBe('1')
    expect(pg.call('SELECT private_notes FROM suppliers')).toBe('Private buyer note')
    expect(created).not.toHaveProperty('created_by')
  })
  it('permits active read members and collaborator writes, denies foreign/inactive/restricted and marketing writes', () => {
    pg.call(save(), ids.collaborator)
    expect(pg.call('SELECT count(*) FROM suppliers', ids.marketing)).toBe('1')
    for (const user of [ids.foreign, ids.inactive, uuid(90)]) {
      expect(pg.call('SELECT count(*) FROM suppliers', user)).toBe('0')
      expect(() => pg.call(save(), user)).toThrow(/access denied/)
    }
    expect(() => pg.call(save(), ids.marketing)).toThrow(/access denied/)
    expect(() => pg.call(save(), ids.owner, 'anon')).toThrow(/permission denied/)
    expect(() => pg.call('SELECT * FROM suppliers', ids.owner, 'anon')).toThrow(/permission denied/)
    expect(() => pg.call(save(), ids.owner, 'service_role')).toThrow(/permission denied/)
  })
  it('blocks direct writes/deletes and preserves identity with an archive transition', () => {
    const created = JSON.parse(pg.call(save()))
    expect(() => pg.call(`UPDATE suppliers SET name='Bypass' WHERE id='${created.id}'`)).toThrow(/permission denied/)
    expect(() => pg.call('DELETE FROM suppliers')).toThrow(/permission denied/)
    expect(() => pg.db('DELETE FROM suppliers')).toThrow(/Archive suppliers/)
    expect(() => pg.db('TRUNCATE suppliers CASCADE')).toThrow(/Archive suppliers/)
    const archived = JSON.parse(pg.call(save(created.id, 1, { ...document, status: 'archived' })))
    expect(archived).toMatchObject({ id: created.id, status: 'archived', version: 2 })
    expect(pg.call('SELECT count(*) FROM supplier_contacts')).toBe('1')
    expect(JSON.parse(pg.call(save(created.id, 2))).status).toBe('prospect')
  })
  it('rolls back invalid references, contact constraints, unknown fields and duplicate primary contacts', () => {
    for (const invalid of [
      { ...document, category_ids: [uuid(51)] }, { ...document, company_id: uuid(99) },
      { ...document, category_ids: [uuid(50), uuid(50)] },
      { ...document, contacts: [...document.contacts, ...document.contacts] },
      { ...document, contacts: [{ ...document.contacts[0], email: 'invalid' }] },
      { ...document, contacts: [{ ...document.contacts[0], is_primary: null }] },
      { ...document, name: '' }, { ...document, supplier_user_id: ids.foreign },
      { ...document, private_notes: null },
    ]) expect(() => pg.call(save(null, 0, invalid))).toThrow()
    expect(pg.call('SELECT count(*) FROM suppliers')).toBe('0')
  })
  it('does not partially replace children when a later category fails', () => {
    const created = JSON.parse(pg.call(save()))
    expect(() => pg.call(save(created.id, 1, { ...document, name: 'Changed', contacts: [], category_ids: [uuid(51)] }))).toThrow()
    expect(pg.call('SELECT name FROM suppliers')).toBe(document.name)
    expect(pg.call('SELECT version FROM suppliers')).toBe('1')
    expect(pg.call('SELECT count(*) FROM supplier_contacts')).toBe('1')
  })
  it('supports buyer-specific lifecycle review and denies implicit approval on creation or restoration', () => {
    expect(() => pg.call(save(null, 0, { ...document, status: 'approved' }))).toThrow(/initial supplier state/)
    const created = JSON.parse(pg.call(save()))
    for (const [index, status] of ['under_review', 'approved', 'blocked', 'archived'].entries()) {
      expect(JSON.parse(pg.call(save(created.id, index + 1, { ...document, status }))).status).toBe(status)
    }
    expect(() => pg.call(save(created.id, 5, { ...document, status: 'approved' }))).toThrow(/Restore archived suppliers/)
    expect(JSON.parse(pg.call(save(created.id, 5))).status).toBe('prospect')
  })
  it('enforces capability checks independently of active editor membership', () => {
    pg.db(`CREATE OR REPLACE FUNCTION public.user_can(p_site_id uuid,p_command text) RETURNS boolean
      LANGUAGE sql STABLE AS $$ SELECT p_command = 'select' $$;`)
    expect(() => pg.call(save(), ids.admin)).toThrow(/access denied/)
  })
  it('prevents category tenant reassignment after association', () => {
    pg.call(save())
    expect(() => pg.db(`UPDATE catalog_categories SET site_id='${ids.otherSite}' WHERE id='${uuid(50)}'`)).toThrow(/foreign key/)
  })
  it('records immutable private revision activity atomically', () => {
    const created = JSON.parse(pg.call(save()))
    pg.call(save(created.id, 1, { ...document, status: 'under_review' }))
    expect(pg.call("SELECT string_agg(action,',' ORDER BY version) FROM supplier_activity")).toBe('created,status_changed')
    expect(pg.call('SELECT count(*) FROM supplier_activity', ids.foreign)).toBe('0')
    expect(() => pg.call('DELETE FROM supplier_activity')).toThrow(/permission denied/)
    expect(() => pg.db('DELETE FROM supplier_activity')).toThrow(/immutable/)
    expect(() => pg.call(save(created.id, 2, { ...document, category_ids: [uuid(51)] }))).toThrow()
    expect(pg.call('SELECT count(*) FROM supplier_activity')).toBe('2')
  })
  it('has exactly one winner for concurrent CAS writes', async () => {
    const created = JSON.parse(pg.call(save()))
    const attempts = await Promise.allSettled([
      pg.concurrent(actorSql(save(created.id, 1, { ...document, name: 'First' }))),
      pg.concurrent(actorSql(save(created.id, 1, { ...document, name: 'Second' }))),
    ])
    expect(attempts.filter(value => value.status === 'fulfilled')).toHaveLength(1)
    expect(attempts.filter(value => value.status === 'rejected')).toHaveLength(1)
    expect(pg.call('SELECT version FROM suppliers')).toBe('2')
    expect(() => pg.call(save(created.id, 1))).toThrow(/revision conflict/)
    expect(() => pg.call(save(created.id, 2, document, ids.otherSite))).toThrow(/access denied/)
  })
})