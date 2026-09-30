/** @jest-environment node */
import { ids, installPurchaseFixture, isolatedPostgres, migration, postgresAvailable, uuid } from './isolated-postgres'

const repair = () => migration('20260930000100_harden_purchase_permissions.sql')
const suite = postgresAvailable ? describe : describe.skip

describe('purchase permission migration contract', () => {
  it('replaces the permissive policies, rejects unexpected drift and preserves RLS', () => {
    const sql = repair()
    expect(sql).toContain('DROP POLICY IF EXISTS purchases_unified')
    expect(sql).toContain('DROP POLICY IF EXISTS purchase_items_unified')
    expect(sql).toContain('Unexpected purchase policies')
    expect(sql).not.toMatch(/DISABLE ROW LEVEL SECURITY|DISABLE TRIGGER|SECURITY DEFINER/)
    expect(sql).toContain('ON DELETE CASCADE NOT VALID')
  })
})

suite('purchase permissions in disposable PostgreSQL', () => {
  const pg = isolatedPostgres()
  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => { installPurchaseFixture(pg.db) })
  const count = (table = 'purchases') => pg.db(`SELECT count(*) FROM ${table}`)
  const purchaseInsert = (site = ids.site) => `INSERT INTO purchases(site_id) VALUES ('${site}');`
  const itemInsert = (purchase = ids.purchase, site = ids.site) =>
    `INSERT INTO purchase_items(purchase_id,site_id) VALUES ('${purchase}','${site}');`
  const snapshot = () => pg.db(`SELECT jsonb_build_array(
    (SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM purchases p),
    (SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM purchase_items i));`)

  it('reproduces the deployed marketing write and then rejects it without partial writes', () => {
    pg.call(purchaseInsert(), ids.marketing)
    expect(count()).toBe('3')
    pg.db(repair())
    const before = snapshot()
    expect(() => pg.call(purchaseInsert(), ids.marketing)).toThrow('row-level security')
    expect(() => pg.call(itemInsert(), ids.marketing)).toThrow('row-level security')
    expect(snapshot()).toBe(before)
  })

  it.each([['owner', ids.owner], ['admin', ids.admin], ['co-owner', ids.coOwner], ['collaborator', ids.collaborator]])(
    'allows %s to read, create and update purchases and items', (_name, user) => {
      pg.db(repair())
      expect(pg.call('SELECT count(*) FROM purchases', user)).toBe('1')
      pg.call(purchaseInsert(), user)
      pg.call(itemInsert(), user)
      expect(pg.call(`UPDATE purchases SET title='Edited' WHERE id='${ids.purchase}' RETURNING title`, user)).toBe('Edited')
      expect(pg.call(`UPDATE purchase_items SET name='Edited item' WHERE id='${ids.item}' RETURNING name`, user)).toBe('Edited item')
    },
  )

  it.each([['marketing', ids.marketing, '1'], ['inactive', ids.inactive, '0'], ['foreign', ids.foreign, '0']])(
    'denies %s writes, with the correct read visibility', (_name, user, visible) => {
      pg.db(repair())
      const before = snapshot()
      expect(pg.call(`SELECT count(*) FROM purchases WHERE site_id='${ids.site}'`, user)).toBe(visible)
      expect(pg.call(`SELECT count(*) FROM purchase_items WHERE site_id='${ids.site}'`, user)).toBe(visible)
      expect(() => pg.call(purchaseInsert(), user)).toThrow('row-level security')
      expect(() => pg.call(itemInsert(), user)).toThrow('row-level security')
      for (const table of ['purchases', 'purchase_items']) {
        pg.call(`UPDATE ${table} SET site_id='${ids.site}' WHERE site_id='${ids.site}';
          DELETE FROM ${table} WHERE site_id='${ids.site}';`, user)
      }
      expect(snapshot()).toBe(before)
    },
  )

  it('denies anonymous, missing identity and legacy column grants', () => {
    pg.db('GRANT SELECT (title), INSERT (site_id) ON purchases TO anon;')
    pg.db(repair())
    expect(() => pg.call('SELECT title FROM purchases', '', 'anon')).toThrow('permission denied')
    expect(() => pg.call(purchaseInsert(), '', 'anon')).toThrow('permission denied')
    expect(() => pg.call('TRUNCATE purchases CASCADE')).toThrow('permission denied')
    expect(() => pg.db(`SET ROLE authenticated; ${purchaseInsert()}`)).toThrow('row-level security')
  })

  it('keeps the newer archived-site denial for owners and collaborators', () => {
    pg.db(repair())
    pg.db(`UPDATE sites SET archived_at=now() WHERE id='${ids.site}';`)
    for (const user of [ids.owner, ids.collaborator]) {
      expect(pg.call(`SELECT count(*) FROM purchases WHERE site_id='${ids.site}'`, user)).toBe('0')
      expect(() => pg.call(purchaseInsert(), user)).toThrow('row-level security')
    }
  })

  it('allows owner/admin deletion with cascades but denies direct collaborator deletion', () => {
    pg.db(repair())
    const before = snapshot()
    pg.call(`DELETE FROM purchase_items; DELETE FROM purchases;`, ids.collaborator)
    expect(snapshot()).toBe(before)
    pg.call(`DELETE FROM purchase_items WHERE id='${ids.item}'`, ids.admin)
    expect(count('purchase_items')).toBe('0')
    pg.call(itemInsert())
    pg.call(`DELETE FROM purchases WHERE id='${ids.purchase}'`)
    expect(count('purchase_items')).toBe('0')
    expect(count()).toBe('1')
  })

  it('allows collaborator item replacement only through the authorized accounting RPC', () => {
    pg.db(repair())
    const version = pg.db(`SELECT updated_at FROM purchases WHERE id='${ids.purchase}'`)
    const request = `SELECT accounting_update_purchase_items('${ids.site}','${ids.purchase}','${version}',
      '[{"name":"Replacement","quantity":2,"unit_cost":10}]', '{}');`
    expect(() => pg.call(request, ids.marketing)).toThrow('not authorized')
    pg.call(request, ids.collaborator)
    expect(pg.db(`SELECT name FROM purchase_items WHERE purchase_id='${ids.purchase}'`)).toBe('Replacement')
    expect(pg.db(`SELECT amount FROM purchases WHERE id='${ids.purchase}'`)).toBe('20.00')
  })

  it('prevents forged child sites and cross-site updates even for a member of both sites', () => {
    pg.db(`INSERT INTO site_ownership VALUES ('${ids.otherSite}', '${ids.owner}');`)
    pg.db(repair())
    const before = snapshot()
    expect(() => pg.call(itemInsert(ids.otherPurchase))).toThrow('row-level security')
    expect(() => pg.call(`UPDATE purchase_items SET purchase_id='${ids.otherPurchase}' WHERE id='${ids.item}'`)).toThrow('row-level security')
    expect(() => pg.call(`UPDATE purchases SET site_id='${ids.otherSite}' WHERE id='${ids.purchase}'`)).toThrow('purchase_items_purchase_site_fkey')
    expect(snapshot()).toBe(before)
  })

  it('enforces parent/site integrity for service writers without blocking legitimate backend writes', () => {
    pg.db(repair())
    pg.call(purchaseInsert(), '', 'service_role')
    pg.call(itemInsert(), '', 'service_role')
    expect(() => pg.call(itemInsert(ids.otherPurchase), '', 'service_role')).toThrow('purchase_items_purchase_site_fkey')
    expect(pg.call('SELECT count(*) FROM purchases', '', 'service_role')).toBe('3')
  })

  it('does not rewrite historical mismatches, hides them and provides explicit validation', () => {
    pg.db(`INSERT INTO purchase_items(id,purchase_id,site_id) VALUES ('${uuid(31)}','${ids.otherPurchase}','${ids.site}');`)
    pg.db(repair())
    expect(count('purchase_items')).toBe('2')
    expect(pg.call('SELECT count(*) FROM purchase_items')).toBe('1')
    expect(() => pg.db('ALTER TABLE purchase_items VALIDATE CONSTRAINT purchase_items_purchase_site_fkey')).toThrow('purchase_items_purchase_site_fkey')
    pg.db(`DELETE FROM purchase_items WHERE id='${uuid(31)}';
      ALTER TABLE purchase_items VALIDATE CONSTRAINT purchase_items_purchase_site_fkey;`)
    pg.db(repair())
    expect(pg.db("SELECT convalidated FROM pg_constraint WHERE conname='purchase_items_purchase_site_fkey'")).toBe('t')
  })

  it('rolls back policy replacement on unknown schema drift and can be rerun', () => {
    pg.db('CREATE POLICY unexpected_access ON purchases FOR ALL USING (true);')
    expect(() => pg.db(repair())).toThrow('Unexpected purchase policies')
    expect(pg.db("SELECT count(*) FROM pg_policies WHERE policyname='purchases_unified'")).toBe('1')
    pg.db('DROP POLICY unexpected_access ON purchases;')
    pg.db(repair()); pg.db(repair())
    expect(pg.db("SELECT count(*) FROM pg_policies WHERE tablename IN ('purchases','purchase_items')")).toBe('8')
    expect(pg.db(`SELECT count(*) FROM pg_constraint WHERE contype='f'
      AND conrelid='public.purchase_items'::regclass AND confrelid='public.purchases'::regclass`)).toBe('1')
  })

  it('checks existing composite key semantics and is independent of the caller search path', () => {
    pg.db(repair())
    pg.db(`SET search_path=''; ${repair()}`)
    pg.db(`ALTER TABLE purchase_items DROP CONSTRAINT purchase_items_purchase_site_fkey;
      ALTER TABLE purchase_items ADD CONSTRAINT purchase_items_purchase_site_fkey
      FOREIGN KEY (purchase_id) REFERENCES purchases(id);`)
    expect(() => pg.db(repair())).toThrow('Unexpected purchase_items_purchase_site_fkey definition')
    expect(pg.db("SELECT count(*) FROM pg_policies WHERE tablename IN ('purchases','purchase_items')")).toBe('8')
  })
})