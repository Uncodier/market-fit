/** @jest-environment node */
import { installFixture } from './category-archive-fixture'
import { archiveSql, CategoryArchivePostgres, ids, postgresAvailable, uuid } from './category-archive-postgres'

const suite = postgresAvailable ? describe : describe.skip
const affected = [ids.root, ids.child, ids.grandchild, ids.archived, ids.nullStatus, ids.legacyChild].sort()

suite('catalog category archival in disposable PostgreSQL', () => {
  const pg = new CategoryArchivePostgres()
  const archive = (category = ids.category, user: string | null = ids.owner) =>
    JSON.parse(pg.call(archiveSql(category), user))
  const itemState = (id: string) => pg.db(`SELECT status FROM public.catalog_items WHERE id='${id}'`)
  const categoryState = () => pg.db(`SELECT status FROM public.catalog_categories WHERE id='${ids.category}'`)
  const snapshot = () => pg.db(`SELECT jsonb_build_object(
    'categories',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM public.catalog_categories c),
    'items',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM public.catalog_items i),
    'links',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public.pass_redeemable_items r));`)

  beforeAll(() => pg.startCluster(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => installFixture(pg))

  it('adds active default, NOT NULL and exact status check without changing historical rows', () => {
    expect(categoryState()).toBe('active')
    expect(pg.call(`INSERT INTO public.catalog_categories(site_id) VALUES ('${ids.site}') RETURNING status`)).toBe('active')
    expect(() => pg.call(`UPDATE public.catalog_categories SET status=NULL WHERE id='${ids.category}'`)).toThrow('23502')
    expect(() => pg.call(`UPDATE public.catalog_categories SET status='deleted' WHERE id='${ids.category}'`)).toThrow('23514')
  })

  it.each([ids.owner, ids.admin, ids.coOwner])('archives the complete recursive graph as manager %s', user => {
    expect(archive(ids.category, user)).toEqual({ item_ids: affected })
    expect(categoryState()).toBe('archived')
    for (const id of affected) expect(itemState(id)).toBe('archived')
    expect(itemState(ids.unrelated)).toBe('active')
    expect(itemState(ids.foreignItem)).toBe('active')
    expect(pg.db(`SELECT status FROM public.catalog_categories WHERE id='${ids.otherCategory}'`)).toBe('active')
    expect(pg.db(`SELECT count(*) FROM public.catalog_items WHERE id <> '${ids.archived}'
      AND id=ANY(ARRAY[${affected.map(id => `'${id}'::uuid`).join(',')}]) AND updated_at > '2020-01-01'`)).toBe('5')
    expect(pg.db(`SELECT updated_at > '2020-01-01' FROM public.catalog_categories WHERE id='${ids.category}'`)).toBe('t')
    expect(pg.db(`SELECT count(*) FROM public.pass_redeemable_items`)).toBe('2')
    // Preserve links where only the pass-side ID matches, and foreign-site links.
    expect(pg.db(`SELECT count(*) FROM public.pass_redeemable_items WHERE site_id='${ids.otherSite}'
      OR pass_catalog_item_id='${ids.root}'`)).toBe('2')
    for (const table of ['journal_lines', 'transactions', 'promotion_catalog_categories', 'promotion_required_categories']) {
      expect(pg.db(`SELECT catalog_category_id FROM public.${table}`)).toBe(ids.category)
    }
    expect(pg.db('SELECT amount FROM public.journal_lines')).toBe('123')
    expect(pg.db('SELECT amount FROM public.transactions')).toBe('456')
    expect(pg.db('SELECT catalog_item_id FROM public.sale_order_items')).toBe(ids.root)
    expect(pg.db('SELECT amount FROM public.sale_order_items')).toBe('789')
  })

  it('returns all IDs beyond API pagination and terminates legacy cycles', () => {
    pg.call(`INSERT INTO public.catalog_items(id,site_id,category_id)
      SELECT ('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'${ids.site}','${ids.category}'
      FROM generate_series(1000,2204) n;
      UPDATE public.catalog_items SET parent_id='${ids.grandchild}' WHERE id='${ids.root}';`)
    const result = archive()
    expect(result.item_ids).toHaveLength(1211)
    expect(result.item_ids).toEqual([...affected, ...Array.from({ length: 1205 }, (_, i) => uuid(i + 1000))].sort())
    expect(pg.db(`SELECT count(*) FROM public.catalog_items WHERE category_id='${ids.category}' AND status='active'`)).toBe('0')
  })

  it('is idempotent including timestamps and handles empty categories', () => {
    expect(archive()).toEqual({ item_ids: affected })
    const first = snapshot()
    expect(archive()).toEqual({ item_ids: affected })
    expect(snapshot()).toBe(first)
    expect(archive(ids.emptyCategory)).toEqual({ item_ids: [] })
    expect(archive(ids.emptyCategory)).toEqual({ item_ids: [] })
  })

  it.each([null, ids.member, ids.marketing, ids.inactive, ids.suspended, ids.foreign])(
    'rejects RPC and direct status mutation for unauthorized actor %s despite permissive member RLS', user => {
      const before = snapshot()
      expect(() => archive(ids.category, user)).toThrow('42501')
      if (user && user !== ids.foreign) {
        // Existing RLS permits even inactive/suspended members: explicit guard is essential.
        expect(pg.call(`SELECT count(*) FROM public.catalog_categories`, user)).toBe('3')
        expect(() => pg.call(`UPDATE public.catalog_categories SET status='archived' WHERE id='${ids.category}'`, user))
          .toThrow('42501')
      }
      expect(snapshot()).toBe(before)
    },
  )

  it('rejects null inputs, missing/cross-site categories and archived sites with stable SQLSTATEs', () => {
    expect(() => pg.call(`SELECT public.archive_catalog_category(NULL,'${ids.category}')`)).toThrow('22023')
    expect(() => pg.call(`SELECT public.archive_catalog_category('${ids.site}',NULL)`)).toThrow('22023')
    expect(() => archive(uuid(999))).toThrow('P0002')
    expect(() => archive(ids.foreignCategory)).toThrow('P0002')
    expect(() => pg.call(archiveSql(ids.category, ids.otherSite))).toThrow('42501')
    pg.db(`UPDATE public.sites SET archived_at=now() WHERE id='${ids.site}'`)
    expect(() => archive()).toThrow('42501')
  })

  it('limits RPC execution to authenticated and prevents exposing internal helpers', () => {
    for (const role of ['anon', 'service_role']) {
      expect(() => pg.call(archiveSql(), ids.owner, role)).toThrow('42501')
    }
    for (const sql of [
      `SELECT public.catalog_archive_lock_site('${ids.site}')`,
      `SELECT public.catalog_category_archive_item_ids('${ids.site}','${ids.category}')`,
      'SELECT public.cascade_catalog_category_archive()',
    ]) expect(() => pg.call(sql)).toThrow('42501')
    expect(() => pg.call(`UPDATE public.catalog_categories SET status='archived' WHERE id='${ids.category}'`, null, 'service_role'))
      .toThrow('42501')
  })

  it('applies insert/upsert archive-state authorization without a caller-controlled bypass', () => {
    expect(() => pg.call(`INSERT INTO public.catalog_categories(site_id,status)
      VALUES ('${ids.site}','archived')`, ids.member)).toThrow('42501')
    pg.call(`INSERT INTO public.catalog_categories(id,site_id,status)
      VALUES ('${uuid(999)}','${ids.site}','archived')`, ids.admin)
    expect(pg.db(`SELECT status FROM public.catalog_categories WHERE id='${uuid(999)}'`)).toBe('archived')
    expect(() => pg.call(`INSERT INTO public.catalog_categories(id,site_id,status)
      VALUES ('${ids.category}','${ids.site}','archived') ON CONFLICT(id) DO UPDATE SET status=excluded.status`, ids.member))
      .toThrow('42501')
    pg.call(`INSERT INTO public.catalog_categories(id,site_id,status)
      VALUES ('${ids.category}','${ids.site}','archived') ON CONFLICT(id) DO UPDATE SET status=excluded.status`, ids.admin)
    for (const id of affected) expect(itemState(id)).toBe('archived')
  })

  it.each([ids.owner, ids.admin])('centrally cascades direct category status updates for %s', user => {
    pg.call(`UPDATE public.catalog_categories SET status='archived' WHERE id='${ids.category}'`, user)
    for (const id of affected) expect(itemState(id)).toBe('archived')
    expect(pg.db('SELECT count(*) FROM public.pass_redeemable_items')).toBe('2')
    expect(archive()).toEqual({ item_ids: affected })
  })

  it('preserves metadata edits/upserts and does not restore items when a manager restores the category', () => {
    archive()
    pg.call(`UPDATE public.catalog_items SET name='Edited',status=status WHERE id='${ids.root}'`, ids.member)
    pg.call(`UPDATE public.catalog_categories SET name='Edited' WHERE id='${ids.category}'`, ids.member)
    pg.call(`INSERT INTO public.catalog_categories(id,site_id,name) VALUES ('${ids.category}','${ids.site}','Upsert')
      ON CONFLICT(id) DO UPDATE SET site_id=excluded.site_id,name=excluded.name;`)
    expect(categoryState()).toBe('archived')
    expect(() => pg.call(`UPDATE public.catalog_categories SET status='active' WHERE id='${ids.category}'`, ids.member)).toThrow('42501')
    pg.call(`UPDATE public.catalog_categories SET status='active' WHERE id='${ids.category}'`)
    for (const id of affected) expect(itemState(id)).toBe('archived')
    expect(() => pg.call(`UPDATE public.catalog_items SET status='active' WHERE id='${ids.grandchild}'`)).toThrow('23514')
  })

  it('rejects active insert/move/reactivation into archived categories and parents, allowing unrelated legacy edits', () => {
    pg.call(`UPDATE public.catalog_items SET name='Legacy edit' WHERE id='${ids.legacyChild}'`, ids.member)
    archive()
    for (const sql of [
      `INSERT INTO public.catalog_items(site_id,category_id) VALUES ('${ids.site}','${ids.category}')`,
      `INSERT INTO public.catalog_items(site_id,parent_id) VALUES ('${ids.site}','${ids.grandchild}')`,
      `UPDATE public.catalog_items SET category_id='${ids.category}' WHERE id='${ids.unrelated}'`,
      `UPDATE public.catalog_items SET parent_id='${ids.child}' WHERE id='${ids.unrelated}'`,
      `UPDATE public.catalog_items SET status='active' WHERE id='${ids.root}'`,
      `UPDATE public.catalog_items SET status='active' WHERE id='${ids.grandchild}'`,
      `UPDATE public.catalog_items SET site_id='${ids.otherSite}',status='active' WHERE id='${ids.root}'`,
    ]) expect(() => pg.call(sql)).toThrow('23514')
    pg.call(`UPDATE public.catalog_items SET name='Unrelated' WHERE id='${ids.unrelated}'`, ids.member)
    pg.call(`INSERT INTO public.catalog_items(site_id,category_id,status) VALUES ('${ids.site}','${ids.category}','archived')`)
    pg.call(`UPDATE public.catalog_items SET category_id='${ids.otherCategory}',status='active' WHERE id='${ids.root}'`)
    expect(itemState(ids.root)).toBe('active')
  })

  it('rejects cross-site categories/parents and category identity reassignment', () => {
    for (const sql of [
      `UPDATE public.catalog_items SET category_id='${ids.foreignCategory}' WHERE id='${ids.unrelated}'`,
      `UPDATE public.catalog_items SET parent_id='${ids.foreignItem}' WHERE id='${ids.unrelated}'`,
      `UPDATE public.catalog_categories SET site_id='${ids.otherSite}' WHERE id='${ids.category}'`,
      `UPDATE public.catalog_categories SET id='${uuid(999)}' WHERE id='${ids.category}'`,
    ]) expect(() => pg.call(sql)).toThrow('23514')
  })

  it('prevents recreated redeemable links after archival', () => {
    archive()
    expect(() => pg.call(`INSERT INTO public.pass_redeemable_items(site_id,pass_catalog_item_id,reservable_catalog_item_id)
      VALUES ('${ids.site}','${ids.pass}','${ids.root}')`)).toThrow('23514')
    expect(() => pg.call(`UPDATE public.pass_redeemable_items SET reservable_catalog_item_id='${ids.root}'
      WHERE site_id='${ids.site}'`)).toThrow('23514')
  })

  it.each(['item update', 'link cleanup'])('rolls back category, every item and cleanup when %s fails', stage => {
    const before = snapshot()
    pg.db(`CREATE FUNCTION public.inject_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Injected archival failure'; END $$;
      CREATE TRIGGER inject_failure BEFORE ${stage === 'item update' ? 'UPDATE ON public.catalog_items' : 'DELETE ON public.pass_redeemable_items'}
        FOR EACH ROW EXECUTE FUNCTION public.inject_failure();`)
    expect(() => archive()).toThrow('Injected archival failure')
    expect(snapshot()).toBe(before)
  })

  it('fails closed for stale-snapshot isolation rather than missing concurrent descendants', () => {
    for (const isolation of ['REPEATABLE READ', 'SERIALIZABLE']) {
      expect(() => pg.call(`BEGIN ISOLATION LEVEL ${isolation}; ${archiveSql()} COMMIT;`)).toThrow('25001')
    }
    expect(categoryState()).toBe('active')
  })
})