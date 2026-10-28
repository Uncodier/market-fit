/** @jest-environment node */
import { actorSql, ids, installSiteFixture, isolatedPostgres, migration, postgresAvailable, uuid } from '../security/isolated-postgres'

const item = uuid(70), supplier = uuid(71), restricted = uuid(90)
const offer = (supplierId = supplier, itemId = item) => `INSERT INTO catalog_item_suppliers
  (site_id,catalog_item_id,supplier_id,purchase_unit,units_per_purchase_unit,minimum_quantity,lead_time_days,currency,unit_price_minor,valid_from,valid_until)
  VALUES ('${ids.site}','${itemId}','${supplierId}','box',12,2,7,'USD',1200,'2026-10-01','2026-12-31') RETURNING id;`

;(postgresAvailable ? describe : describe.skip)('catalog sourcing isolated PostgreSQL', () => {
  const pg = isolatedPostgres()
  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => {
    installSiteFixture(pg.db)
    pg.db(`CREATE TABLE companies(id uuid PRIMARY KEY, name text);
      CREATE TABLE catalog_categories(id uuid PRIMARY KEY, site_id uuid REFERENCES sites, name text,status text);
      CREATE TABLE catalog_items(id uuid PRIMARY KEY,site_id uuid REFERENCES sites,name text,status text,is_purchasable boolean DEFAULT true);
      CREATE FUNCTION public.current_user_has_site_location_restrictions(p_site_id uuid) RETURNS boolean
      LANGUAGE sql STABLE AS $$ SELECT auth.uid()='${restricted}'::uuid $$;
      INSERT INTO site_members VALUES ('${ids.site}','${restricted}','admin','active');
      GRANT ALL ON catalog_items TO authenticated; ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;
      CREATE POLICY catalog_read ON catalog_items FOR SELECT TO authenticated USING (public.user_can(site_id,'select'));
      CREATE POLICY catalog_update ON catalog_items FOR UPDATE TO authenticated USING (public.user_can(site_id,'update'));
      INSERT INTO catalog_items VALUES ('${item}','${ids.site}','Stock item','active',false),
        ('${uuid(72)}','${ids.otherSite}','Other item','active',true);`)
    pg.db(migration('20261027170000_procurement_suppliers.sql'))
    pg.db(migration('20261027175000_catalog_procurement.sql'))
    pg.db(`SET request.jwt.claims = '{"sub":"${ids.owner}"}'; INSERT INTO suppliers(id,site_id,name,status,created_by) VALUES
      ('${supplier}','${ids.site}','Approved supplier','approved','${ids.owner}'),
      ('${uuid(73)}','${ids.otherSite}','Other supplier','approved','${ids.foreign}'),
      ('${uuid(74)}','${ids.site}','Prospect','prospect','${ids.owner}');`)
    pg.call(`UPDATE catalog_items SET procurement_enabled=true WHERE id='${item}';`)
  })
  it('keeps purchasing independent of sale flags and records authenticated provenance', () => {
    pg.call(offer(), ids.collaborator)
    expect(pg.call('SELECT is_purchasable FROM catalog_items')).toBe('f')
    expect(pg.call('SELECT created_by FROM catalog_item_suppliers')).toBe(ids.collaborator)
    expect(pg.call('SELECT units_per_purchase_unit FROM catalog_item_suppliers')).toBe('12.000000')
  })
  it('denies anonymous, foreign, inactive, restricted users and marketing writes', () => {
    pg.call(offer())
    expect(pg.call('SELECT count(*) FROM catalog_item_suppliers', ids.marketing)).toBe('1')
    expect(() => pg.call('SELECT * FROM catalog_item_suppliers', ids.owner, 'anon')).toThrow()
    for (const user of [ids.foreign, ids.inactive, restricted]) {
      expect(pg.call('SELECT count(*) FROM catalog_item_suppliers', user)).toBe('0')
      expect(() => pg.call(offer(), user)).toThrow()
    }
    expect(() => pg.call(offer(), ids.marketing)).toThrow()
    expect(() => pg.call(`UPDATE catalog_items SET procurement_enabled=false WHERE id='${item}'`, restricted)).toThrow()
  })
  it('rejects cross-site references, unapproved suppliers and disabled or archived items', () => {
    expect(() => pg.call(offer(uuid(73)))).toThrow()
    expect(() => pg.call(offer(uuid(74)))).toThrow()
    expect(() => pg.call(offer(supplier, uuid(72)))).toThrow()
    pg.call(`UPDATE catalog_items SET procurement_enabled=false WHERE id='${item}'`)
    expect(() => pg.call(offer())).toThrow()
    pg.call(`UPDATE catalog_items SET procurement_enabled=true,status='archived' WHERE id='${item}'`)
    expect(() => pg.call(offer())).toThrow()
  })
  it('keeps history append-only and rejects invalid prices and dates', () => {
    pg.call(offer())
    expect(() => pg.call('DELETE FROM catalog_item_suppliers')).toThrow()
    expect(() => pg.call('UPDATE catalog_item_suppliers SET unit_price_minor=1')).toThrow()
    expect(() => pg.db('DELETE FROM catalog_item_suppliers')).toThrow('append-only')
    expect(() => pg.db('UPDATE catalog_item_suppliers SET unit_price_minor=1')).toThrow('append-only')
    expect(() => pg.call(offer().replace("'USD',1200", "'USD',-1"))).toThrow()
    expect(() => pg.call(offer().replace("'2026-12-31'", "'2026-09-01'"))).toThrow()
    pg.db(`SET request.jwt.claims = '{"sub":"${ids.owner}"}'; UPDATE suppliers SET status='blocked',version=version+1 WHERE id='${supplier}'`)
    expect(pg.call('SELECT count(*) FROM catalog_item_suppliers')).toBe('1')
    expect(() => pg.call(offer())).toThrow()
  })
  it('rejects repeated submission keys even after a lost response', () => {
    const sql = offer().replace('site_id,catalog_item_id', 'submission_key,site_id,catalog_item_id')
      .replace(`VALUES ('${ids.site}'`, `VALUES ('${uuid(95)}','${ids.site}'`)
    pg.call(sql)
    expect(() => pg.call(sql)).toThrow('duplicate key')
    expect(pg.call('SELECT count(*) FROM catalog_item_suppliers')).toBe('1')
  })
  it('allows only one stale capability compare-and-set writer to win', async () => {
    const sql = `UPDATE catalog_items SET procurement_enabled=false WHERE id='${item}' AND procurement_enabled=true RETURNING id;`
    const results = await Promise.all([pg.concurrent(actorSql(sql)), pg.concurrent(actorSql(sql))])
    expect(results.filter(Boolean)).toHaveLength(1)
  })
})