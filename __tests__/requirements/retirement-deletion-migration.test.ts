/** @jest-environment node */
import {
  actor, bootstrap, deleteRequirement, disposablePostgres, ids, original,
  postgresAvailable, repair, retire,
} from "./retirement-postgres"

describe("retirement deletion migration contract", () => {
  it("changes only the two requirement ownership FKs and keeps private immutable audit", () => {
    expect(repair.match(/DROP CONSTRAINT IF EXISTS/g)).toHaveLength(2)
    expect(repair).not.toMatch(/DISABLE TRIGGER|session_replication_role|DROP TABLE|GRANT|DELETE FROM/)
    expect(repair).toContain("SET LOCAL lock_timeout = '5s'")
    expect(repair.trim()).toMatch(/COMMIT;$/)
  })

  it("preserves the original receipt-aware guard except for the root deletion exception", () => {
    const body = (sql: string) => sql.split("CREATE OR REPLACE FUNCTION public.guard_migration_execution_handoff()")[1]
      .split("$$;")[0]
    const exception = "  IF TG_OP = 'DELETE' AND NOT EXISTS (\n" +
      "    SELECT 1 FROM public.requirements WHERE id = OLD.requirement_id\n" +
      "  ) THEN\n    RETURN NULL;\n  END IF;\n"
    expect(body(repair).replace(exception, "")).toBe(body(original))
  })
})

const suite = postgresAvailable ? describe : describe.skip
suite("retirement deletion in isolated PostgreSQL", () => {
  const postgres = disposablePostgres()
  const db = postgres.db
  const receipt = () => db("SELECT to_jsonb(r) FROM public.requirement_migration_retirements r")
  const counts = () => db(`SELECT json_build_array(
    (SELECT count(*) FROM public.requirements),
    (SELECT count(*) FROM public.requirement_segments),
    (SELECT count(*) FROM public.campaign_requirements),
    (SELECT count(*) FROM public.requirement_migration_lifecycle),
    (SELECT count(*) FROM public.requirement_migration_retirements))`)

  beforeAll(() => postgres.start(), 30000)
  afterAll(() => postgres.stop())
  beforeEach(() => db(bootstrap))

  it("reproduces both FK blockers and the subsequent lifecycle guard failure", () => {
    db(retire)
    expect(() => db(actor(ids.owner, deleteRequirement)))
      .toThrow("requirement_migration_retirements_requirement_id_fkey")
    db(`ALTER TABLE public.requirement_migration_retirements
      DROP CONSTRAINT requirement_migration_retirements_requirement_id_fkey`)
    expect(() => db(actor(ids.owner, deleteRequirement)))
      .toThrow("requirement_migration_retirements_requirement_id_file_fkey")
    db(`ALTER TABLE public.requirement_migration_retirements
      DROP CONSTRAINT requirement_migration_retirements_requirement_id_file_fkey`)
    expect(() => db(actor(ids.owner, deleteRequirement))).toThrow("Transferred migration lifecycle is immutable")
    expect(JSON.parse(counts())).toEqual([1, 1, 1, 1, 1])
    db(repair)
    expect(db(actor(ids.owner, deleteRequirement))).toBe(ids.requirement)
    expect(JSON.parse(counts())).toEqual([0, 0, 0, 0, 1])
  })

  it.each([ids.owner, ids.admin])("lets authorized actor %s delete while retaining the exact receipt", userId => {
    db(repair)
    expect(JSON.parse(db(retire)).already_recorded).toBe(false)
    expect(JSON.parse(db(retire)).already_recorded).toBe(true)
    const before = receipt()
    expect(db(actor(userId, deleteRequirement))).toBe(ids.requirement)
    expect(JSON.parse(counts())).toEqual([0, 0, 0, 0, 1])
    expect(receipt()).toBe(before)
    expect(db("SELECT count(*) FROM public.remote_instances")).toBe("1")
    expect(() => db(retire)).toThrow("Retirement requirement missing")
    expect(receipt()).toBe(before)
  })

  it("does not weaken ordinary lifecycle or requirement deletion", () => {
    db(repair)
    expect(db(actor(ids.owner, deleteRequirement))).toBe(ids.requirement)
    expect(JSON.parse(counts())).toEqual([0, 0, 0, 0, 0])
    expect(() => db(retire)).toThrow("Retirement requirement missing")
  })

  it("keeps direct live lifecycle mutation and fabricated transfers forbidden", () => {
    db(repair)
    expect(() => db("UPDATE public.requirement_migration_lifecycle SET state = 'transferred'"))
      .toThrow("Transferred migration requires its matching immutable receipt")
    db(retire)
    expect(() => db("DELETE FROM public.requirement_migration_lifecycle"))
      .toThrow("Transferred migration lifecycle is immutable")
    expect(() => db("UPDATE public.requirement_migration_lifecycle SET state = 'platform_review'"))
      .toThrow("Transferred migration lifecycle is immutable")
    expect(JSON.parse(counts())).toEqual([1, 1, 1, 1, 1])
  })

  it("keeps anonymous, ordinary member, capability and cross-site denial intact", () => {
    db(repair)
    db(retire)
    expect(() => db("SET ROLE anon; " + deleteRequirement)).toThrow("permission denied")
    expect(() => db(actor(ids.member, deleteRequirement))).toThrow("owner or administrator permission")
    expect(db(actor(ids.outsider, deleteRequirement))).toBe("")
    db(`UPDATE public.site_members SET can_delete = false WHERE user_id = '${ids.admin}'`)
    expect(() => db(actor(ids.admin, deleteRequirement))).toThrow("owner or administrator permission")
    expect(JSON.parse(counts())).toEqual([1, 1, 1, 1, 1])
  })

  it("keeps receipts private and append-only after the parent is gone", () => {
    db(repair)
    db(retire)
    db(actor(ids.owner, deleteRequirement))
    for (const role of ["anon", "authenticated"]) {
      expect(() => db(`SET ROLE ${role}; SELECT * FROM public.requirement_migration_retirements`))
        .toThrow("permission denied")
      expect(() => db(`SET ROLE ${role}; INSERT INTO public.requirement_migration_retirements DEFAULT VALUES`))
        .toThrow("permission denied")
    }
    expect(() => db("SET ROLE service_role; INSERT INTO public.requirement_migration_retirements DEFAULT VALUES"))
      .toThrow("permission denied")
    expect(db("SET ROLE service_role; SELECT count(*) FROM public.requirement_migration_retirements")).toBe("1")
    for (const statement of [
      "DELETE FROM public.requirement_migration_retirements",
      "UPDATE public.requirement_migration_retirements SET reason = 'Changed'",
      "TRUNCATE public.requirement_migration_retirements",
      "DELETE FROM public.requirement_migration_retirements WHERE false",
    ]) expect(() => db(statement)).toThrow("Migration retirement receipts are append-only")
    expect(() => db("DELETE FROM public.remote_instances"))
      .toThrow("requirement_migration_retirements_instance_id_fkey")
  })

  it("rolls back all child removals if an unrelated dependency rejects the parent delete", () => {
    db(repair)
    db(retire)
    db(`CREATE TABLE public.unrelated_dependency (requirement_id uuid REFERENCES public.requirements);
      INSERT INTO public.unrelated_dependency VALUES ('${ids.requirement}');`)
    const before = receipt()
    expect(() => db(actor(ids.owner, deleteRequirement))).toThrow("unrelated_dependency_requirement_id_fkey")
    expect(JSON.parse(counts())).toEqual([1, 1, 1, 1, 1])
    expect(receipt()).toBe(before)
  })

  it("is rerunnable without modifying audit data or widening access", () => {
    db(retire)
    const before = receipt()
    db(repair)
    db(repair)
    expect(receipt()).toBe(before)
    expect(db(`SELECT count(*) FROM pg_constraint WHERE conrelid =
      'public.requirement_migration_retirements'::regclass AND contype = 'f'`)).toBe("1")
    expect(db(`SELECT relrowsecurity FROM pg_class WHERE oid =
      'public.requirement_migration_retirements'::regclass`)).toBe("t")
    for (const role of ["anon", "authenticated", "service_role"]) {
      expect(db(`SELECT has_function_privilege('${role}', 'public.guard_migration_execution_handoff()', 'EXECUTE')`))
        .toBe("f")
    }
  })
})