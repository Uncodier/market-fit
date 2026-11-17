/** @jest-environment node */
import { isolatedPostgres, migration, postgresAvailable, uuid } from "../security/isolated-postgres"

const repairName = "20261117223000_record_diagram_trash_guard_ambiguity.sql"
const original = migration("20261111032300_records_trash_embeddings.sql")
const guard = original.slice(original.indexOf("CREATE FUNCTION public.guard_trashed_record_diagram_write()"))
const tables = ["record_diagrams", "record_diagram_nodes", "record_diagram_edges"]
const active = uuid(1), trashed = uuid(2), site = uuid(3)
const suite = postgresAvailable ? describe : describe.skip

describe("record diagram trash guard repair contract", () => {
  it("qualifies record columns and preserves the privileged trigger boundary", () => {
    const sql = migration(repairName)
    expect(sql).toContain("SELECT r.site_id INTO v_site_id FROM public.records AS r WHERE r.id = v_record_id")
    expect(sql).not.toMatch(/\bsource_id\s+uuid/)
    expect(sql).toContain("SECURITY DEFINER SET search_path = public, pg_temp")
    expect(sql).toContain("FROM PUBLIC, anon, authenticated")
    expect(sql).not.toMatch(/DROP TRIGGER|DISABLE TRIGGER|CREATE POLICY/)
  })
})

suite("record diagram trash guard in disposable PostgreSQL", () => {
  const pg = isolatedPostgres(), db = pg.db
  const write = (sql: string) => pg.call(sql, uuid(10), "service_role")
  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => {
    db(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;
      GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
      CREATE TABLE public.records(id uuid PRIMARY KEY, site_id uuid, source_id text, deleted_at timestamptz);
      INSERT INTO public.records VALUES ('${active}', '${site}', 'external-reference', null),
        ('${trashed}', '${site}', null, now());
      ${tables.map(table => `CREATE TABLE public.${table}(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), record_id uuid REFERENCES public.records, content text);`).join("\n")}
      GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;`)
    db(guard)
  })

  it("reproduces the deployed ambiguity and repairs the same write", () => {
    const sql = `INSERT INTO public.record_diagrams(record_id) VALUES ('${active}')`
    expect(() => write(sql)).toThrow('column reference "source_id" is ambiguous')
    db(migration(repairName))
    write(sql)
    expect(db("SELECT count(*) FROM public.record_diagrams")).toBe("1")
  })

  it.each(tables)("supports active insert, update and delete on %s", table => {
    db(migration(repairName))
    db(migration(repairName))
    write(`INSERT INTO public.${table}(record_id, content) VALUES ('${active}', 'node')`)
    write(`UPDATE public.${table} SET content = 'saved'`)
    expect(db(`SELECT content FROM public.${table}`)).toBe("saved")
    write(`DELETE FROM public.${table}`)
    expect(db(`SELECT count(*) FROM public.${table}`)).toBe("0")
  })

  it.each(tables)("keeps %s read-only in trash and writable after restore", table => {
    db(migration(repairName))
    write(`INSERT INTO public.${table}(record_id, content) VALUES ('${active}', 'retained')`)
    expect(() => write(`INSERT INTO public.${table}(record_id) VALUES ('${trashed}')`)).toThrow("read-only until restored")
    expect(() => write(`UPDATE public.${table} SET record_id = '${trashed}'`)).toThrow("read-only until restored")
    db(`UPDATE public.records SET deleted_at = now() WHERE id = '${active}'`)
    for (const sql of [
      `UPDATE public.${table} SET content = 'blocked'`,
      `UPDATE public.${table} SET record_id = '${trashed}'`,
      `DELETE FROM public.${table}`,
    ]) expect(() => write(sql)).toThrow("read-only until restored")
    // Even moving a row to an active record cannot bypass the old-record check.
    db(`UPDATE public.records SET deleted_at = null WHERE id = '${trashed}'`)
    expect(() => write(`UPDATE public.${table} SET record_id = '${trashed}'`)).toThrow("read-only until restored")
    expect(db(`SELECT content FROM public.${table}`)).toBe("retained")
    db(`UPDATE public.records SET deleted_at = null WHERE id = '${active}'`)
    write(`UPDATE public.${table} SET content = 'restored'`)
    write(`DELETE FROM public.${table}`)
  })

  it("does not grant browser roles execution of the trigger function", () => {
    db(migration(repairName))
    for (const role of ["anon", "authenticated"]) {
      expect(db(`SELECT has_function_privilege('${role}', 'public.guard_trashed_record_diagram_write()', 'EXECUTE')`)).toBe("f")
    }
    expect(db(`SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgenabled = 'O'`)).toBe("3")
  })
})