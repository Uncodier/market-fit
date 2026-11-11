/** @jest-environment node */
import { available, id, localDatabase, migrations } from "./trash-database-fixture"

describe("Records trash migration source boundaries", () => {
  it("uses additive restrictive policies and no policy replacement or content deletion", () => {
    const source = migrations.join("\n")
    expect(source).not.toMatch(/DROP POLICY|DISABLE.*TRIGGER|session_replication_role|TRUNCATE/)
    expect(source).toContain("AS RESTRICTIVE FOR SELECT")
    expect(source).toContain("SECURITY INVOKER")
    expect(source).not.toMatch(/ALTER FUNCTION .*SECURITY INVOKER/)
  })
})

;(available ? describe : describe.skip)("Records trash on socket-only local PostgreSQL", () => {
  const pg = localDatabase()
  const trashCategory = (n = 20) => pg.actor(`SELECT trash_record_category('${id(n)}')`)
  const restoreCategory = (n = 20) => pg.actor(`SELECT restore_record_category('${id(n)}')`)
  const trashRecord = (n = 30, who = 1) => pg.actor(`SELECT trash_record('${id(n)}')`, who)
  const restoreRecord = (n = 30, who = 1) => pg.actor(`SELECT restore_record('${id(n)}')`, who)
  beforeAll(() => pg.start(), 30000)
  beforeEach(() => pg.reset())
  afterAll(() => pg.stop())

  it("trashes only active subtree rows, restoring its batch while retaining separate trash and diagrams", () => {
    const separate = JSON.parse(trashRecord(31)).deletion_batch_id
    const result = JSON.parse(trashCategory())
    expect(result.affected_categories).toBe(3)
    expect(result.affected_records).toBe(2)
    expect(pg.actor("SELECT count(*) FROM records")).toBe("0")
    expect(pg.actor("SELECT count(*) FROM record_categories")).toBe("0")
    expect(pg.db("SELECT count(*) FROM records")).toBe("3")
    expect(pg.db("SELECT content FROM record_diagrams")).toContain("retained")
    expect(pg.actor("SELECT count(*) FROM record_diagrams")).toBe("0")
    expect(pg.actor(`SELECT count(*) FROM list_record_trash('${id(10)}')`)).toBe("6")
    expect(JSON.parse(restoreCategory()).affected_records).toBe(2)
    expect(pg.actor("SELECT count(*) FROM records")).toBe("2")
    expect(pg.actor("SELECT count(*) FROM record_diagrams")).toBe("1")
    expect(pg.db(`SELECT deletion_batch_id FROM records WHERE id='${id(31)}'`)).toBe(separate)
    expect(pg.db("SELECT record_embedding_revision FROM records LIMIT 1")).toBe("0")
  })

  it("preserves exact DELETE RLS including assignment and additional restrictive policies", () => {
    expect(() => trashRecord(31, 3)).toThrow("Record not found or access denied")
    expect(JSON.parse(trashRecord(30, 3)).affected_records).toBe(1)
    expect(() => restoreRecord(30, 3)).toThrow("Records trash access denied")
    pg.db("CREATE POLICY extra_delete_denial ON records AS RESTRICTIVE FOR DELETE TO authenticated USING (false)")
    expect(() => trashRecord(32)).toThrow("Record not found or access denied")
  })

  it.each([3, 4, 5, 6, 7])("denies collection trash and restore for unauthorized actor %s", who => {
    expect(() => pg.actor(`SELECT trash_record_category('${id(20)}')`, who)).toThrow("Records trash access denied")
    expect(() => pg.actor(`SELECT restore_record_category('${id(20)}')`, who)).toThrow("Records trash access denied")
  })

  it.each([3, 4, 5, 6])("denies minimal trash enumeration for unauthorized actor %s", who => {
    expect(() => pg.actor(`SELECT * FROM list_record_trash('${id(10)}')`, who)).toThrow("Records trash access denied")
  })

  it("allows trusted active admin, rejects anonymous, null and cross-site IDs", () => {
    expect(() => pg.actor(`SELECT trash_record_category('${id(20)}')`, 1, "anon")).toThrow("permission denied")
    expect(() => pg.actor("SELECT trash_record_category(NULL)")).toThrow("Records trash access denied")
    expect(() => pg.actor(`SELECT trash_record_category('${id(23)}')`)).toThrow("Records trash access denied")
    expect(JSON.parse(pg.actor(`SELECT trash_record_category('${id(20)}')`, 2)).affected_categories).toBe(3)
  })

  it("rejects direct trash-marker writes and physical category cascades", () => {
    expect(() => pg.actor(`UPDATE records SET deleted_at=now() WHERE id='${id(30)}'`)).toThrow("permission denied")
    expect(() => pg.actor(`INSERT INTO record_categories(site_id,name,deleted_at)
      VALUES ('${id(10)}','forged',now())`)).toThrow("permission denied")
    expect(() => pg.actor(`DELETE FROM record_categories WHERE id='${id(20)}'`)).toThrow("permission denied")
    pg.actor(`DELETE FROM records WHERE id='${id(30)}'`)
    expect(pg.db(`SELECT deleted_at IS NOT NULL FROM records WHERE id='${id(30)}'`)).toBe("t")
    expect(pg.db("SELECT count(*) FROM record_diagrams")).toBe("1")
    expect(() => pg.actor(`UPDATE records SET deletion_batch_id='${id(90)}' WHERE id='${id(31)}'`))
      .toThrow("permission denied")
    expect(() => pg.db(`UPDATE record_categories SET site_id='${id(11)}' WHERE id='${id(20)}'`))
      .toThrow("identity/site are immutable")
  })

  it("requires root-batch restoration and active parents for independently trashed rows", () => {
    trashRecord()
    trashCategory(21)
    trashCategory()
    expect(() => restoreCategory(21)).toThrow("Restore the parent category first")
    expect(() => restoreRecord()).toThrow("Restore the parent category first")
    restoreCategory()
    expect(pg.db(`SELECT deleted_at IS NOT NULL FROM record_categories WHERE id='${id(21)}'`)).toBe("t")
    restoreCategory(21)
    restoreRecord()
    trashCategory()
    expect(() => restoreCategory(22)).toThrow("Restore the deleted root category first")
    expect(() => restoreRecord(32)).toThrow("Restore the deleted root category first")
  })

  it("does not admit writes into trashed categories, including privileged service writers", () => {
    trashCategory()
    expect(() => pg.actor(`INSERT INTO records(site_id,category_id,title)
      VALUES ('${id(10)}','${id(20)}','Invalid')`)).toThrow("active same-site parent")
    expect(() => pg.actor(`INSERT INTO record_categories(site_id,parent_category_id,name)
      VALUES ('${id(10)}','${id(20)}','Invalid')`)).toThrow("active same-site parent")
    pg.db("GRANT USAGE ON SCHEMA public TO service_role; GRANT ALL ON records,record_categories TO service_role")
    expect(() => pg.actor(`UPDATE records SET title='Changed' WHERE id='${id(30)}'`, 1, "service_role"))
      .toThrow("Trash metadata is managed")
    expect(() => pg.actor(`UPDATE record_categories SET deleted_at=NULL,deletion_batch_id=NULL,
      deletion_root_category_id=NULL WHERE id='${id(20)}'`, 1, "service_role")).toThrow("Trash metadata is managed")
    expect(() => pg.db(`UPDATE records SET title='Owner bypass' WHERE id='${id(30)}'`))
      .toThrow("Trashed content is read-only")
    expect(() => pg.db("UPDATE record_diagrams SET content='{}'"))
      .toThrow("Trashed record diagrams are read-only")
    expect(() => pg.db(`INSERT INTO record_diagram_nodes VALUES ('${id(30)}','{}')`))
      .toThrow("Trashed record diagrams are read-only")
    expect(() => pg.db("DELETE FROM record_diagrams"))
      .toThrow("Trashed record diagrams are read-only")
  })

  it("blocks system categories, including a system descendant, and ignores forged receipt values", () => {
    pg.db(`ALTER TABLE record_categories ADD COLUMN system_key text;
      UPDATE record_categories SET system_key='ai-feedback' WHERE id='${id(21)}'`)
    expect(trashCategory).toThrow("System record categories cannot be trashed")
    expect(() => trashCategory(21)).toThrow("System record categories cannot be trashed")
    expect(() => pg.actor(`SET records.trash_receipt='{"id":"spoofed"}';
      SELECT trash_record('${id(31)}')`, 3)).toThrow("Record not found or access denied")
  })

  it("preserves only trusted service AI-feedback removal, not ordinary records or forged claims", () => {
    pg.db(`ALTER TABLE record_categories ADD COLUMN system_key text;
      ALTER TABLE records ADD COLUMN source_type text;
      UPDATE record_categories SET system_key='ai-feedback' WHERE id='${id(21)}';
      UPDATE records SET source_type='response' WHERE id IN ('${id(31)}','${id(32)}');
      GRANT SELECT, DELETE ON records TO service_role;`)
    expect(() => trashRecord(31)).toThrow("Manage system feedback from its source UI")
    expect(() => pg.actor(`SET request.jwt.claim.role='service_role'; SELECT trash_record('${id(31)}')`))
      .toThrow("Manage system feedback from its source UI")
    expect(() => pg.db("SET SESSION AUTHORIZATION authenticated; SELECT set_config('role','service_role',true)"))
      .toThrow("permission denied to set role")
    for (const record of [30, 32]) {
      expect(() => pg.db(`SET ROLE service_role; DELETE FROM records WHERE id='${id(record)}'`))
        .toThrow("Authenticated record deletion required")
    }
    pg.db(`SET ROLE service_role; DELETE FROM records WHERE id='${id(31)}'`)
    expect(pg.db(`SELECT count(*) FROM records WHERE id='${id(31)}'`)).toBe("0")
    expect(pg.db("SELECT count(*) FROM records")).toBe("2")
  })

  it("aborts rather than rewriting an unexpected definer retrieval wrapper", () => {
    pg.db("ALTER FUNCTION match_records_vector(uuid,double precision,integer) SECURITY DEFINER")
    expect(() => pg.db(migrations[2])).toThrow("Records retrieval boundary review required")
    expect(pg.db(`SELECT prosecdef FROM pg_proc
      WHERE oid='match_records_vector(uuid,double precision,integer)'::regprocedure`)).toBe("t")
  })

  it("cancels queued embedding jobs and refuses fresh pending work for trash", () => {
    trashRecord()
    expect(pg.db("SELECT status || ':' || last_error FROM record_embedding_jobs"))
      .toBe("completed:Record moved to trash")
    pg.db(`INSERT INTO record_embedding_jobs(record_id,site_id,status) VALUES ('${id(30)}','${id(10)}','pending')`)
    expect(pg.db("SELECT count(*) FROM record_embedding_jobs WHERE status='pending'")).toBe("0")
    expect(pg.actor(`SELECT count(*) FROM match_records_vector('${id(30)}',0,100)`)).toBe("2")
  })

  it("rolls the whole subtree back after a mid-transition failure", () => {
    pg.db(`CREATE FUNCTION fail_category() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'test failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER z_fail BEFORE UPDATE ON record_categories FOR EACH ROW EXECUTE FUNCTION fail_category()`)
    expect(trashCategory).toThrow("test failure")
    expect(pg.db("SELECT count(*) FROM records WHERE deleted_at IS NOT NULL")).toBe("0")
    expect(pg.db("SELECT status FROM record_embedding_jobs")).toBe("pending")
  })

  it("serializes child insert behind category trash and rejects the late child", async () => {
    const trash = pg.concurrent(`BEGIN; SELECT trash_record_category('${id(20)}'); SELECT pg_sleep(0.5); COMMIT;`)
    await new Promise(resolve => setTimeout(resolve, 100))
    const insert = pg.concurrent(`INSERT INTO record_categories(site_id,parent_category_id,name)
      VALUES ('${id(10)}','${id(20)}','Late')`)
    const results = await Promise.all([trash, insert])
    expect(results[0].code).toBe(0)
    expect(results[1].code).not.toBe(0)
    expect(results[1].output).toContain("active same-site parent")
    expect(pg.db("SELECT count(*) FROM record_categories WHERE name='Late'")).toBe("0")
  })

  it("includes a concurrent earlier child insertion once its transaction commits", async () => {
    const insert = pg.concurrent(`BEGIN; INSERT INTO record_categories(site_id,parent_category_id,name)
      VALUES ('${id(10)}','${id(20)}','Earlier'); SELECT pg_sleep(0.5); COMMIT;`)
    await new Promise(resolve => setTimeout(resolve, 100))
    const trash = pg.concurrent(`SELECT trash_record_category('${id(20)}')`)
    expect((await Promise.all([insert, trash])).map(result => result.code)).toEqual([0, 0])
    expect(pg.db("SELECT deleted_at IS NOT NULL FROM record_categories WHERE name='Earlier'")).toBe("t")
  })

  it("allows creating a record when its category is readable but not updateable", () => {
    pg.db(`REVOKE UPDATE(name,description,icon,parent_category_id,template_fields)
      ON record_categories FROM authenticated`)
    pg.actor(`INSERT INTO records(site_id,category_id,title) VALUES ('${id(10)}','${id(20)}','Read parent')`)
    expect(pg.db("SELECT count(*) FROM records WHERE title='Read parent'")).toBe("1")
  })
})