/** @jest-environment node */
import path from "node:path"
import { CategoryArchivePostgres, ids, migration, postgresAvailable } from "./category-archive-postgres"
import { catalogImportCategoryKey } from "@/app/catalog/import-categories"

const filename = "20261020010000_catalog_import_categories.sql"
const sqlText = (value: unknown) => `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`
const row = (sku: string, category: string, rowNumber = 2) => ({ rowNumber, item: { sku, name: sku }, category })
const importSql = (rows: ReturnType<typeof row>[], mode = "skip", request = "gen_random_uuid()") =>
  `SELECT public.import_catalog_batch('${ids.site}', ${sqlText(rows)}, '${mode}', ${request});`
const previewSql = (names: unknown) => `SELECT public.preview_catalog_import_categories('${ids.site}', ${sqlText(names)});`

it("keeps category matching explicit, bounded, tenant-scoped and separate from receipt replay", () => {
  const source = migration(filename)
  expect(source).toContain("CREATE OR REPLACE FUNCTION public.import_catalog_batch(")
  expect(source).toContain("jsonb_array_length(p_names) > 100")
  expect(source).toContain("public.catalog_archive_lock_site(NEW.site_id)")
  expect(source).toContain("BEFORE INSERT OR UPDATE OF name OR DELETE")
  expect(source.indexOf("RETURN receipt.result;")).toBeLessThan(source.indexOf("INSERT INTO public.catalog_categories"))
  expect(catalogImportCategoryKey("  New\t CATEGORY  ")).toBe("new category")
  expect(catalogImportCategoryKey('Tools "Pro", 50%_\\parts')).toBe('tools "pro", 50%_\\parts')
  expect(catalogImportCategoryKey("Café")).not.toBe(catalogImportCategoryKey("Cafe"))
})

const suite = postgresAvailable ? describe : describe.skip
suite("automatic category import in disposable PostgreSQL", () => {
  const pg = new CategoryArchivePostgres()
  beforeAll(() => pg.startCluster(), 30_000)
  afterAll(() => pg.stop())
  beforeEach(() => pg.db(`\\i '${path.resolve(__dirname, "../fixtures/catalog-batch-import-bootstrap.sql")}'`))

  it("previews normalized matches, missing names and ambiguity without writing", () => {
    const before = pg.db("SELECT count(*) FROM public.catalog_categories")
    const preview = JSON.parse(pg.call(previewSql([" existing ", "MISSING", "ambiguous", "Archived", "ForeignOnly"])))
    expect(preview.missingCategories.sort()).toEqual(["Archived", "ForeignOnly", "MISSING"].sort())
    expect(preview.ambiguousCategories).toEqual(["ambiguous"])
    expect(pg.db("SELECT count(*) FROM public.catalog_categories")).toBe(before)
    expect(pg.db("SELECT count(*) FROM public.catalog_import_batches")).toBe("0")
  })

  it("creates one category for equivalent names across rows, batches and replays", () => {
    const request = "'00000000-0000-4000-8000-000000000099'::uuid"
    const statement = importSql([row("CAT-A", "  New\t Category "), row("CAT-B", "new  CATEGORY", 3)], "skip", request)
    const first = JSON.parse(pg.call(statement))
    expect(first.created).toBe(2)
    expect(first.errors).toEqual([])
    expect(JSON.parse(pg.call(statement))).toEqual(first)
    expect(JSON.parse(pg.call(importSql([row("CAT-C", "NEW CATEGORY")]))).created).toBe(1)
    expect(pg.db("SELECT count(*) FROM public.catalog_categories WHERE public.catalog_import_category_key(name)='new category'")).toBe("1")
    expect(pg.db("SELECT count(DISTINCT category_id) FROM public.catalog_items WHERE sku LIKE 'CAT-%'")).toBe("1")
    expect(pg.db("SELECT name FROM public.catalog_categories WHERE public.catalog_import_category_key(name)='new category'")).toBe("New Category")
  })

  it("treats punctuation literally and preserves existing category names", () => {
    const name = 'Tools "Pro", 50%_\\parts'
    expect(JSON.parse(pg.call(importSql([row("PUNCT-A", name), row("PUNCT-B", name.toUpperCase(), 3)]))).created).toBe(2)
    expect(JSON.parse(pg.call(previewSql([name])))).toEqual({ missingCategories: [], ambiguousCategories: [] })
    expect(JSON.parse(pg.call(importSql([row("REUSE", " EXISTING ")]))).created).toBe(1)
    expect(pg.db(`SELECT name FROM public.catalog_categories WHERE id='${ids.category}'`)).toBe("Existing")
    expect(pg.db("SELECT count(DISTINCT category_id) FROM public.catalog_items WHERE sku LIKE 'PUNCT-%'")).toBe("1")
  })

  it("does not create categories for skipped or specialized rows and supports explicit updates", () => {
    expect(JSON.parse(pg.call(importSql([row("OLD", "Unused")]))).skipped).toBe(1)
    expect(JSON.parse(pg.call(importSql([row("SERVICE", "Unused")], "update"))).errors).toHaveLength(1)
    expect(pg.db("SELECT count(*) FROM public.catalog_categories WHERE name='Unused'")).toBe("0")
    expect(JSON.parse(pg.call(importSql([row("OLD", "Updated category")], "update"))).updated).toBe(1)
    expect(pg.db("SELECT c.name FROM public.catalog_items i JOIN public.catalog_categories c ON c.id=i.category_id WHERE i.sku='OLD'")).toBe("Updated category")
  })

  it("rolls back a newly created category when its product row fails", () => {
    pg.db("ALTER TABLE public.catalog_items ADD CONSTRAINT test_reject_product CHECK (sku <> 'FAIL');")
    const result = JSON.parse(pg.call(importSql([row("FAIL", "Rolled back"), row("PEER", "Committed", 3)])))
    expect(result.created).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(pg.db("SELECT count(*) FROM public.catalog_categories WHERE name='Rolled back'")).toBe("0")
    expect(pg.db("SELECT count(*) FROM public.catalog_categories WHERE name='Committed'")).toBe("1")
  })

  it("denies anonymous, foreign and read-only actors and rejects malformed lookups", () => {
    for (const actor of [null, ids.foreign, ids.marketing]) {
      expect(() => pg.call(previewSql(["Denied"]), actor)).toThrow(/42501/)
      expect(() => pg.call(importSql([row("DENIED", "Denied")]), actor)).toThrow(/42501/)
    }
    for (const names of [null, "name", [null], [""], ["x".repeat(201)], Array(101).fill("Name")]) {
      expect(() => pg.call(previewSql(names))).toThrow(/22023/)
    }
    expect(pg.db("SELECT count(*) FROM public.catalog_categories WHERE name='Denied'")).toBe("0")
    expect(pg.db("SELECT has_function_privilege('anon','public.preview_catalog_import_categories(uuid,jsonb)','EXECUTE')")).toBe("f")
    expect(pg.db("SELECT has_function_privilege('service_role','public.preview_catalog_import_categories(uuid,jsonb)','EXECUTE')")).toBe("f")
  })

  it("serializes simultaneous imports of equivalent names without duplicate categories", async () => {
    const writer = pg.start(`BEGIN; SET ROLE authenticated; SET request.jwt.claims='{"sub":"${ids.owner}"}'; ${importSql([row("CONCURRENT-A", "Concurrent category")])}`, "category-import-first", true)
    try {
      await pg.waitForIdle("category-import-first")
      const waiter = pg.start(`SET ROLE authenticated; SET request.jwt.claims='{"sub":"${ids.owner}"}'; ${importSql([row("CONCURRENT-B", "CONCURRENT  CATEGORY")])}`, "category-import-second")
      try {
        pg.db(`DO $$ DECLARE deadline timestamptz := clock_timestamp() + interval '8 seconds'; BEGIN LOOP
          EXIT WHEN EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='category-import-second' AND wait_event_type='Lock');
          IF clock_timestamp() > deadline THEN RAISE EXCEPTION 'No lock barrier'; END IF; PERFORM pg_sleep(0.01);
        END LOOP; END $$;`)
        writer.finish()
        expect((await writer.result).code).toBe(0)
        const result = await waiter.result
        expect(result.code).toBe(0)
        expect(JSON.parse(result.stdout).created).toBe(1)
      } finally { waiter.kill() }
      expect(pg.db("SELECT count(*) FROM public.catalog_categories WHERE public.catalog_import_category_key(name)='concurrent category'")).toBe("1")
    } finally { writer.kill() }
  })

  it("safely retries import after ordinary category creation or rename contention", async () => {
    for (const change of [
      `INSERT INTO public.catalog_categories(site_id,name) VALUES ('${ids.site}','External category')`,
      `UPDATE public.catalog_categories SET name='External category' WHERE id='${ids.category}'`,
    ]) {
      const writer = pg.start(`BEGIN; SET ROLE authenticated; SET request.jwt.claims='{"sub":"${ids.owner}"}'; ${change};`, "category-name-writer", true)
      try {
        await pg.waitForIdle("category-name-writer")
        expect(() => pg.call(importSql([row("RETRY", "External category")]))).toThrow(/55P03/)
        expect(pg.db("SELECT count(*) FROM public.catalog_import_batches")).toBe("0")
        writer.finish("ROLLBACK;")
        expect((await writer.result).code).toBe(0)
      } finally { writer.kill() }
    }
    expect(JSON.parse(pg.call(importSql([row("RETRY", "External category")]))).created).toBe(1)
  }, 30_000)
})