/** @jest-environment node */
import { installFixture } from './category-archive-fixture'
import { actorSql, archiveSql, CategoryArchivePostgres, ids, postgresAvailable, uuid } from './category-archive-postgres'

const suite = postgresAvailable ? describe : describe.skip

suite('catalog archival concurrency in disposable PostgreSQL', () => {
  const pg = new CategoryArchivePostgres()
  const insert = `INSERT INTO public.catalog_items(id,site_id,category_id)
    VALUES ('${uuid(100)}','${ids.site}','${ids.category}');`
  const variant = `INSERT INTO public.catalog_items(id,site_id,parent_id)
    VALUES ('${uuid(101)}','${ids.site}','${ids.grandchild}');`
  const link = `INSERT INTO public.pass_redeemable_items(site_id,pass_catalog_item_id,reservable_catalog_item_id)
    VALUES ('${ids.site}','${ids.pass}','${ids.child}');`

  beforeAll(() => pg.startCluster(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => installFixture(pg))

  it.each([
    ['item insertion', insert, uuid(100)],
    ['deep variant insertion', variant, uuid(101)],
    ['active category movement', `UPDATE public.catalog_items SET category_id='${ids.category}' WHERE id='${ids.unrelated}';`, ids.unrelated],
    ['active parent movement', `UPDATE public.catalog_items SET parent_id='${ids.grandchild}' WHERE id='${ids.unrelated}';`, ids.unrelated],
    ['item reactivation', `UPDATE public.catalog_items SET status='active' WHERE id='${ids.archived}';`, ids.archived],
  ])('writer-first %s forces archive retry, then includes the committed item', async (_, sql, item) => {
    const writer = pg.start(actorSql(`BEGIN; ${sql}`), 'writer-first', true)
    try {
      await pg.waitForIdle('writer-first')
      expect(() => pg.call(archiveSql())).toThrow('55P03')
      expect(pg.db(`SELECT status FROM public.catalog_categories WHERE id='${ids.category}'`)).toBe('active')
      writer.finish()
      expect((await writer.result).code).toBe(0)
      expect(JSON.parse(pg.call(archiveSql())).item_ids).toContain(item)
      expect(pg.db(`SELECT status FROM public.catalog_items WHERE id='${item}'`)).toBe('archived')
    } finally { writer.kill() }
  })

  it.each([
    ['category insertion', insert],
    ['deep variant insertion', variant],
    ['category movement', `UPDATE public.catalog_items SET category_id='${ids.category}' WHERE id='${ids.unrelated}';`],
    ['parent movement', `UPDATE public.catalog_items SET parent_id='${ids.grandchild}' WHERE id='${ids.unrelated}';`],
    ['redemption insertion', link],
  ])('archive-first %s conflicts before commit and is rejected on retry', async (_, sql) => {
    const archiver = pg.start(actorSql(`BEGIN; ${archiveSql()}`), 'archive-first', true)
    try {
      await pg.waitForIdle('archive-first')
      expect(() => pg.call(sql)).toThrow('55P03')
      // A different tenant and unrelated metadata edits do not take this gate.
      pg.call(`INSERT INTO public.catalog_items(site_id,category_id)
        VALUES ('${ids.otherSite}','${ids.foreignCategory}');`, ids.foreign)
      pg.call(`UPDATE public.catalog_items SET name='Unrelated edit' WHERE id='${ids.unrelated}';`, ids.member)
      archiver.finish()
      expect((await archiver.result).code).toBe(0)
      expect(() => pg.call(sql)).toThrow('23514')
    } finally { archiver.kill() }
  })

  it('reactivation blocked on an affected row sees committed archive state before evaluating its guard', async () => {
    const archiver = pg.start(actorSql(`BEGIN; ${archiveSql()}`), 'reactivation-archive', true)
    let writer: ReturnType<CategoryArchivePostgres['start']> | undefined
    try {
      await pg.waitForIdle('reactivation-archive')
      writer = pg.start(actorSql(`UPDATE public.catalog_items SET status='active' WHERE id='${ids.root}';`), 'reactivation-writer')
      // Barrier proves UPDATE is waiting on the real category transaction, not a sleep race.
      const deadline = Date.now() + 10000
      while (pg.db(`SELECT EXISTS (SELECT 1 FROM pg_stat_activity
        WHERE application_name='reactivation-writer' AND wait_event_type='Lock')`) !== 't') {
        if (Date.now() > deadline) throw new Error('Expected reactivation row-lock wait')
        await new Promise(resolve => setTimeout(resolve, 20))
      }
      archiver.finish()
      expect((await archiver.result).code).toBe(0)
      const result = await writer.result
      expect(result.code).not.toBe(0)
      expect(result.stderr).toContain('23514')
      expect(pg.db(`SELECT status FROM public.catalog_items WHERE id='${ids.root}'`)).toBe('archived')
    } finally { archiver.kill(); writer?.kill() }
  })

  it('serializes concurrent repeat archives and returns identical IDs after retry', async () => {
    const first = pg.start(actorSql(`BEGIN; ${archiveSql()}`), 'repeat-archive', true)
    try {
      await pg.waitForIdle('repeat-archive')
      expect(() => pg.call(archiveSql())).toThrow('55P03')
      first.finish()
      const result = await first.result
      expect(result.code).toBe(0)
      expect(JSON.parse(pg.call(archiveSql()))).toEqual(JSON.parse(result.stdout))
    } finally { first.kill() }
  })

  it('direct category archival holds the same concurrency gate as the RPC', async () => {
    const direct = pg.start(actorSql(`BEGIN; UPDATE public.catalog_categories
      SET status='archived' WHERE id='${ids.category}';`), 'direct-archive', true)
    try {
      await pg.waitForIdle('direct-archive')
      expect(() => pg.call(variant)).toThrow('55P03')
      direct.finish()
      expect((await direct.result).code).toBe(0)
      expect(() => pg.call(variant)).toThrow('23514')
    } finally { direct.kill() }
  })

  it('cleans a redemption insertion that committed before the archive retry', async () => {
    const writer = pg.start(actorSql(`BEGIN; ${link}`), 'link-first', true)
    try {
      await pg.waitForIdle('link-first')
      expect(() => pg.call(archiveSql())).toThrow('55P03')
      writer.finish()
      expect((await writer.result).code).toBe(0)
      pg.call(archiveSql())
      expect(pg.db(`SELECT count(*) FROM public.pass_redeemable_items
        WHERE site_id='${ids.site}' AND reservable_catalog_item_id='${ids.child}'`)).toBe('0')
    } finally { writer.kill() }
  })

  it('includes archived insertions regardless of status and returns fresh membership after deletion', async () => {
    const writer = pg.start(actorSql(`BEGIN;
      INSERT INTO public.catalog_items(id,site_id,parent_id,status)
      VALUES ('${uuid(105)}','${ids.site}','${ids.grandchild}','archived');
      DELETE FROM public.catalog_items WHERE id='${ids.nullStatus}';`), 'archive-membership', true)
    try {
      await pg.waitForIdle('archive-membership')
      expect(() => pg.call(archiveSql())).toThrow('55P03')
      writer.finish()
      expect((await writer.result).code).toBe(0)
      const result = JSON.parse(pg.call(archiveSql()))
      expect(result.item_ids).toContain(uuid(105))
      expect(result.item_ids).not.toContain(ids.nullStatus)
    } finally { writer.kill() }
  })

  it.each([
    ['category', `UPDATE public.catalog_categories SET name='Concurrent edit' WHERE id='${ids.category}';`],
    ['item', `UPDATE public.catalog_items SET name='Concurrent edit' WHERE id='${ids.root}';`],
    ['redemption link', `UPDATE public.pass_redeemable_items SET sort_order=1 WHERE reservable_catalog_item_id='${ids.root}';`],
  ])('avoids row/gate lock inversion with an unrelated %s edit', async (_, sql) => {
    const editor = pg.start(actorSql(`BEGIN; ${sql}`), 'metadata-editor', true)
    try {
      await pg.waitForIdle('metadata-editor')
      expect(() => pg.call(archiveSql())).toThrow('55P03')
      // All partial cascade work rolled back while the metadata writer stays open.
      expect(pg.db(`SELECT status FROM public.catalog_categories WHERE id='${ids.category}'`)).toBe('active')
      expect(pg.db(`SELECT status FROM public.catalog_items WHERE id='${ids.root}'`)).toBe('active')
      expect(pg.db('SELECT count(*) FROM public.pass_redeemable_items')).toBe('5')
      editor.finish()
      expect((await editor.result).code).toBe(0)
      expect(JSON.parse(pg.call(archiveSql())).item_ids).toContain(ids.root)
    } finally { editor.kill() }
  })

  it('does not skip a committed insert when the archive transaction already had an older READ COMMITTED snapshot', async () => {
    const archiver = pg.start(actorSql('BEGIN; SELECT count(*) FROM public.catalog_items;'), 'old-snapshot', true)
    try {
      await pg.waitForIdle('old-snapshot')
      pg.call(insert)
      archiver.finish(`${archiveSql()} COMMIT;`)
      const result = await archiver.result
      expect(result.code).toBe(0)
      expect(JSON.parse(result.stdout.split('\n').at(-1)!).item_ids).toContain(uuid(100))
      expect(pg.db(`SELECT status FROM public.catalog_items WHERE id='${uuid(100)}'`)).toBe('archived')
    } finally { archiver.kill() }
  })
})