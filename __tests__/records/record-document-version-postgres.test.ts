/** @jest-environment node */
import { isolatedPostgres, migration, postgresAvailable, uuid } from "../security/isolated-postgres"

const repair = migration("20261123174000_records_document_modified_at.sql")
const retrieval = migration("20260916020600_record_diagram_retrieval.sql")
const aggregateStart = retrieval.indexOf("CREATE OR REPLACE FUNCTION public.save_record_aggregate_embedding(")
const aggregateEnd = retrieval.indexOf("-- Existing similarity functions", aggregateStart)
// This fixture exercises the real aggregate RPC without requiring pgvector.
const aggregate = retrieval.slice(aggregateStart, aggregateEnd).replace(/\bvector(?:\(1536\))?/g, "real[]")
const record = uuid(1)
const version = "2026-01-01T00:00:00.123456Z"
const suite = postgresAvailable ? describe : describe.skip

suite("Records document version in disposable PostgreSQL", () => {
  const pg = isolatedPostgres()
  const { db } = pg
  const readVersion = () => db(`SELECT updated_at FROM public.records WHERE id = '${record}'`)
  const save = (expectedVersion: string, title: string) => pg.call(`
    UPDATE public.records SET title = '${title}'
    WHERE id = '${record}' AND updated_at = '${expectedVersion}' RETURNING updated_at;`)
  const saveEmbedding = (revision: number, diagramRevision = 0) => pg.call(`
    SELECT public.save_record_aggregate_embedding('${record}', ${diagramRevision}, ${revision}, 'fresh summary', ARRAY[1]::real[]);`,
  uuid(2), "service_role")

  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())

  beforeEach(() => {
    db(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;
      GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
      CREATE TABLE public.records (
        id uuid PRIMARY KEY, title text NOT NULL, summary text, embedding real[],
        updated_at timestamptz, deleted_at timestamptz, record_embedding_revision bigint DEFAULT 0
      );
      CREATE TABLE public.record_diagrams (record_id uuid PRIMARY KEY, revision bigint NOT NULL);
      CREATE FUNCTION public.update_modified_column() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
      CREATE TRIGGER update_records_modtime BEFORE UPDATE ON public.records
        FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
      ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;
      CREATE POLICY fixture_access ON public.records TO authenticated USING (true) WITH CHECK (true);
      GRANT SELECT ON public.records TO authenticated;
      GRANT UPDATE (title) ON public.records TO authenticated;
      INSERT INTO public.records(id, title, updated_at) VALUES ('${record}', 'draft', '${version}');`)
    db(aggregate)
  })

  it("reproduces the false conflict and saves on the first attempt after indexing with the repair", () => {
    expect(saveEmbedding(0)).toBe("t")
    expect(save(version, "before repair")).toBe("")

    db(repair)
    db(repair)
    const openedVersion = readVersion()
    expect(saveEmbedding(0)).toBe("t")
    expect(readVersion()).toBe(openedVersion)
    expect(db("SELECT summary || ':' || embedding[1] FROM public.records")).toBe("fresh summary:1")
    const savedVersion = save(openedVersion, "first click")
    expect(savedVersion).not.toBe("")
    expect(savedVersion).not.toBe(openedVersion)
    expect(db("SELECT title FROM public.records")).toBe("first click")
    expect(save(openedVersion, "stale tab")).toBe("")
  })

  it("does not weaken embedding revision, trash versioning, or application privileges", () => {
    db(repair)
    expect(saveEmbedding(1)).toBe("f")
    expect(saveEmbedding(0, 1)).toBe("f")
    expect(db("SELECT summary IS NULL FROM public.records")).toBe("t")
    const openedVersion = readVersion()
    db("UPDATE public.records SET deleted_at = now()")
    expect(readVersion()).not.toBe(openedVersion)
    expect(save(openedVersion, "stale after trash")).toBe("")
    expect(db(`SELECT has_function_privilege('authenticated',
      'public.save_record_aggregate_embedding(uuid,bigint,bigint,text,real[])', 'EXECUTE')`)).toBe("f")
    expect(() => pg.call("UPDATE public.records SET embedding = ARRAY[2]::real[]")).toThrow()
  })

  it("refuses an unexpected disabled trigger", () => {
    db("ALTER TABLE public.records DISABLE TRIGGER update_records_modtime")
    expect(() => db(repair)).toThrow("Unexpected Records modification timestamp trigger")
    expect(db("SELECT tgenabled FROM pg_trigger WHERE tgname = 'update_records_modtime'")).toBe("D")
  })
})