/** @jest-environment node */
import path from "node:path"
import { CategoryArchivePostgres, postgresAvailable } from "./category-archive-postgres"
import { normalizeCatalogImportRows } from "@/app/catalog/import-schema"

const suite = postgresAvailable ? describe : describe.skip

suite("catalog batch import in disposable PostgreSQL", () => {
  const pg = new CategoryArchivePostgres()
  beforeAll(() => pg.startCluster(), 30_000)
  afterAll(() => pg.stop())

  it("executes authorization, replay, tenant isolation, row errors and 10,000-product regression SQL", () => {
    // psql includes resolve relative to their own file. The harness uses only its
    // freshly initialized Unix socket, never a configured database URL.
    const fixture = path.resolve(__dirname, "../fixtures/catalog-batch-import-bootstrap.sql")
    const regression = path.resolve(__dirname, "catalog-batch-import-regression.sql")
    pg.db(`\\i '${fixture}'`)
    expect(pg.db(`\\i '${regression}'`, 110_000)).toContain("catalog batch import SQL regression passed")
  }, 120_000)

  it("serializes simultaneous replay and SKU writers, and safely retries rollback/archival contention", () => {
    const fixture = path.resolve(__dirname, "../fixtures/catalog-batch-import-bootstrap.sql")
    const concurrency = path.resolve(__dirname, "catalog-batch-import-concurrency.sql")
    pg.db(`\\i '${fixture}'`)
    expect(pg.db(`\\i '${concurrency}'`, 60_000)).toContain("catalog batch import concurrency SQL passed")
  }, 70_000)

  it("accepts the exact canonical image payload produced by the file normalizer", () => {
    const fixture = path.resolve(__dirname, "../fixtures/catalog-batch-import-bootstrap.sql")
    pg.db(`\\i '${fixture}'`)
    const rows = normalizeCatalogImportRows([
      { sku: "IMAGE-UNICODE", name: "Product", image: "https://imágenes.example.test/product photo.png" },
    ], { sku: "sku", name: "name", image_url: "image" }, "USD").rows
    expect(rows).toHaveLength(1)
    const payload = JSON.stringify(rows).replace(/'/g, "''")
    const result = JSON.parse(pg.call(`SELECT public.import_catalog_batch(
      '00000000-0000-4000-8000-000000000001', '${payload}'::jsonb, 'skip', gen_random_uuid());`))
    expect(result.created).toBe(1)
    expect(result.errors).toEqual([])
    expect(pg.db("SELECT image_url FROM public.catalog_items WHERE sku='IMAGE-UNICODE'")).toBe(rows[0].item.image_url)
  })
})