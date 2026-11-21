/** @jest-environment node */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { available, id, localDatabase } from "./trash-database-fixture"
import { recordsSessions } from "./records-lock-postgres-sessions"

const migration = (file: string) => readFileSync(join(process.cwd(), "supabase/migrations", file), "utf8")
const upgrade = migration("20261120232000_records_lock_concurrency.sql")
const correction = migration("20261117223000_record_diagram_trash_guard_ambiguity.sql")
const diagrams = migration("20260916020500_record_diagrams.sql")
const retrieval = migration("20260916020600_record_diagram_retrieval.sql")
const relation = migration("20261111032000_records_relation_admission.sql")
const site = id(10), otherSite = id(11), root = id(20), otherRoot = id(23)
const actor = (who = 1, role = "authenticated") => `SET ROLE ${role}; SET request.jwt.claim.sub = '${id(who)}'`
const trash = (target = root) => `SELECT trash_record_category('${target}')`
const restore = (target = root) => `SELECT restore_record_category('${target}')`
const trashOne = (n = 30) => `SELECT trash_record('${id(n)}')`
const restoreOne = (n = 30) => `SELECT restore_record('${id(n)}')`
const jobs = (expression: string, n: number) =>
  `SELECT ${expression} FROM record_embedding_jobs WHERE record_id='${id(n)}' ORDER BY record_revision`
const editNode = (n: number, value = "changed") =>
  `UPDATE record_diagram_nodes SET content='"${value}"' WHERE record_id='${id(n)}'`
const save = (revision: number, hash: string) => `SELECT revision FROM save_record_diagram('${id(30)}', ${revision}, '{}',
  '[{"id":"${id(50)}","kind":"note","title":"Test","content":"new text","position_x":1,"position_y":2,"embedding_source_hash":"${hash}"}]', '[]')`

// Execute the actual enqueue/claim and queue-on-record-change code, not test
// replacements. Their schema dependencies are added to the small trash fixture.
const workerMigration = retrieval.slice(retrieval.indexOf("CREATE OR REPLACE FUNCTION public.claim_record_embedding_jobs("),
  retrieval.indexOf("CREATE OR REPLACE FUNCTION public.save_record_diagram_node_embedding("))
const saveMigration = diagrams.slice(diagrams.indexOf("CREATE OR REPLACE FUNCTION public.save_record_diagram("))

it("keeps the forward correction local to locking (no policy, trigger or table storage changes)", () => {
  expect(upgrade).not.toMatch(/(?:DROP|CREATE|ALTER) POLICY|(?:DROP|CREATE|ALTER) TRIGGER|ALTER TABLE|TRUNCATE|DISABLE/)
  expect(upgrade).toMatch(/BEGIN;\n[\s\S]*COMMIT;/)
})

;(available ? describe : describe.skip)("Records site fence in disposable PostgreSQL", () => {
  const pg = localDatabase()
  let sessions: ReturnType<typeof recordsSessions>
  const query = (sql: string) => sessions.query(sql)
  beforeAll(() => {
    pg.start()
    sessions = recordsSessions(pg.db("SHOW unix_socket_directories"))
  }, 30000)
  afterEach(async () => { await sessions?.cleanUp() })
  afterAll(() => pg.stop())

  beforeEach(() => {
    pg.reset()
    query(`DROP SCHEMA IF EXISTS records_lock_private CASCADE;
      ${correction}
      ALTER TABLE records ADD CONSTRAINT fixture_record_site UNIQUE (id, site_id);
      ALTER TABLE record_embedding_jobs ADD COLUMN diagram_revision bigint NOT NULL DEFAULT 0,
        ADD COLUMN record_revision bigint NOT NULL DEFAULT 0,
        ADD COLUMN node_ids uuid[] NOT NULL DEFAULT '{}', ADD COLUMN attempts integer NOT NULL DEFAULT 0,
        ADD COLUMN claimed_at timestamptz, ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
        ADD CONSTRAINT fixture_job_revision UNIQUE (record_id, diagram_revision, record_revision),
        ADD FOREIGN KEY (record_id, site_id) REFERENCES records (id, site_id) ON DELETE CASCADE;
      ALTER TABLE record_diagrams ADD COLUMN revision bigint NOT NULL DEFAULT 0,
        ADD COLUMN site_id uuid, ADD COLUMN viewport jsonb DEFAULT '{}', ADD COLUMN updated_at timestamptz,
        ADD UNIQUE (record_id), ADD UNIQUE (record_id, site_id);
      UPDATE record_diagrams d SET site_id=r.site_id FROM records r WHERE d.record_id=r.id;
      ALTER TABLE record_diagrams ADD FOREIGN KEY (record_id, site_id) REFERENCES records(id,site_id) ON DELETE CASCADE;
      ALTER TABLE record_diagram_nodes ADD COLUMN id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        ADD COLUMN site_id uuid, ADD COLUMN kind text, ADD COLUMN title text, ADD COLUMN metadata jsonb,
        ADD COLUMN position_x double precision, ADD COLUMN position_y double precision, ADD COLUMN embedding text,
        ADD COLUMN embedding_source_hash text, ADD COLUMN embedding_model text,
        ADD COLUMN embedding_updated_at timestamptz, ADD COLUMN updated_at timestamptz,
        ADD FOREIGN KEY (record_id,site_id) REFERENCES record_diagrams(record_id,site_id) ON DELETE CASCADE;
      ALTER TABLE record_diagram_nodes ALTER COLUMN content TYPE text USING content::text;
      ALTER TABLE record_diagram_edges ADD COLUMN id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        ADD COLUMN site_id uuid, ADD COLUMN source_node_id uuid, ADD COLUMN target_node_id uuid,
        ADD COLUMN relation_type text, ADD COLUMN label text, ADD COLUMN metadata jsonb, ADD COLUMN updated_at timestamptz;
      GRANT ALL ON record_diagrams, record_diagram_nodes, record_diagram_edges, record_embedding_jobs, records TO service_role;
      GRANT SELECT ON record_categories TO service_role;
      INSERT INTO records(id,site_id,category_id,title) VALUES
        ('${id(34)}','${site}','${root}','Fourth'), ('${id(40)}','${otherSite}','${otherRoot}','Other');
      INSERT INTO record_diagram_nodes(record_id,content)
        VALUES ('${id(30)}','"initial"'), ('${id(31)}','"initial"'), ('${id(32)}','"initial"'), ('${id(40)}','"initial"');
      ${relation}
      ${saveMigration}
      ${workerMigration}`)
  })

  async function connect(who?: number, role?: string) {
    const session = await sessions.connect()
    if (who !== undefined) await session.execute(actor(who, role))
    return session
  }

  it("makes independent diagrams, job admission and normal record multiwrites share the same site fence", async () => {
    query(upgrade)
    const first = await connect(1, "service_role")
    const second = await connect(1, "service_role")
    const writer = await connect(1)
    await first.execute(`BEGIN; ${editNode(30)}; SELECT enqueue_record_embedding_job('${id(30)}', '{}', false)`)
    await second.execute(`BEGIN; ${editNode(31)}; SELECT enqueue_record_embedding_job('${id(31)}', '{}', false)`)
    await writer.execute(`BEGIN;
      UPDATE records SET description='edited' WHERE id IN ('${id(32)}','${id(34)}');
      UPDATE records SET title='edited again' WHERE id IN ('${id(32)}','${id(34)}')`)
    expect(query(`SELECT mode || ':' || count(*) FROM pg_locks WHERE locktype='advisory' AND granted
      AND pid IN (${first.pid},${second.pid},${writer.pid}) GROUP BY mode ORDER BY mode`)).toBe("ExclusiveLock:4\nShareLock:3")
    await writer.execute("COMMIT")
    await second.execute("COMMIT")
    await first.execute("COMMIT")
    expect(query("SELECT count(*) FROM records WHERE record_embedding_revision=2")).toBe("2")
    expect(query("SELECT count(*) FROM record_embedding_jobs WHERE status='pending'")).toBe("6")
  })

  it("waits for earlier writers, then atomically trashes their subtree rows and jobs", async () => {
    query(upgrade)
    const writer = await connect(1, "service_role")
    const lifecycle = await connect(1)
    await writer.execute(`BEGIN; INSERT INTO records(id,site_id,category_id,title)
      VALUES ('${id(33)}','${site}','${id(21)}','Earlier')`)
    const deleting = lifecycle.execute(trash())
    // Attach the assertion before polling so a regression cannot cause an
    // unhandled rejection while waiting for the expected lock.
    const receipt = expect(deleting.then(JSON.parse)).resolves.toMatchObject({ affected_records: 5, affected_categories: 3 })
    void receipt.catch(() => undefined)
    await sessions.waitingOnAdvisory(lifecycle.pid, writer.pid)
    await writer.execute(`UPDATE records SET title='finished' WHERE id IN ('${id(31)}','${id(33)}'); COMMIT`)
    await receipt
    expect(query("SELECT count(*) FROM records WHERE deleted_at IS NOT NULL")).toBe("5")
    expect(query("SELECT count(*) FROM record_embedding_jobs WHERE status <> 'completed'")).toBe("0")
    expect(query("SELECT count(DISTINCT deletion_batch_id) FROM record_categories")).toBe("1")
  })

  it("serializes same-record revisions in both orders without committing a mismatched job", async () => {
    query(upgrade)
    const worker = `${actor(1, "service_role")};`
    const record = await connect(1)
    const initialDiagram = await connect(1, "service_role")
    const enqueue = await connect(1, "service_role")
    await record.execute(`BEGIN; UPDATE records SET title='record v1' WHERE id='${id(30)}'`)
    await expect(initialDiagram.execute(save(0, "first"))).rejects.toThrow("40001: Conflicting Records write")
    await expect(enqueue.execute(`SELECT enqueue_record_embedding_job('${id(30)}', '{}', false)`))
      .rejects.toThrow("40001: Conflicting Records write")
    await record.execute("COMMIT")

    const canvas = await connect(1, "service_role")
    expect(await canvas.execute(`BEGIN; ${save(0, "first")}`)).toBe("1")
    const lateRecord = await connect(1)
    await expect(lateRecord.execute(`UPDATE records SET title='record v2' WHERE id='${id(30)}'`))
      .rejects.toThrow("40001: Conflicting Records write")
    await canvas.execute("COMMIT")
    query(`${actor()}; UPDATE records SET title='record v2' WHERE id='${id(30)}'`)
    expect(query(`${worker} ${save(1, "second")}`)).toBe("2")
    const revisions = query(`SELECT diagram_revision || ':' || record_revision
      FROM record_embedding_jobs WHERE record_id='${id(30)}' ORDER BY diagram_revision,record_revision`)
    expect(revisions).toBe("0:0\n0:1\n1:1\n1:2\n2:2")
  })

  it("aborts late normal writes during exclusive trash; after commit preserves read-only and terminal jobs", async () => {
    query(upgrade)
    const lifecycle = await connect(1)
    await lifecycle.execute(`BEGIN; ${trash()}`)
    // These rows are not locked by trash: failure must come from the fence,
    // before an FK or a subsequent tuple lock can deadlock with it.
    for (const sql of [editNode(30), `INSERT INTO records(id,site_id,category_id,title)
      VALUES ('${id(33)}','${site}','${root}','Late')`,
    `INSERT INTO record_embedding_jobs(record_id,site_id,record_revision,status) VALUES ('${id(31)}','${site}',9,'pending')`]) {
      const late = await connect(1, "service_role")
      await expect(late.execute(sql)).rejects.toThrow("40001: Conflicting Records write")
    }
    const independent = await connect(1, "service_role")
    await independent.execute(`BEGIN; ${editNode(40)}; COMMIT`)
    await lifecycle.execute("COMMIT")
    expect(() => query(editNode(30))).toThrow(/42501: Trashed record diagrams/)
    expect(() => query(`UPDATE records SET description='illegal' WHERE id='${id(30)}'`))
      .toThrow(/42501: Trashed content is read-only/)
    expect(query(`INSERT INTO record_embedding_jobs(record_id,site_id,record_revision,status)
      VALUES ('${id(31)}','${site}',9,'pending') RETURNING status || ':' || last_error`))
      .toBe("completed:Record moved to trash")
    expect(query(`SELECT content FROM record_diagram_nodes WHERE record_id='${id(30)}'`)).toBe('"initial"')
  })

  it("waits for earlier admission before restore; rejects late admission until restore commits", async () => {
    query(upgrade)
    query(`${actor()}; ${trashOne(31)}; ${trash()}`)
    const worker = await connect(1, "service_role")
    const lifecycle = await connect(1)
    await worker.execute(`BEGIN; SELECT enqueue_record_embedding_job('${id(30)}', '{}', false)`)
    expect(query(jobs("status", 30))).toBe("completed")
    const restoring = lifecycle.execute(`BEGIN; ${restore()}`)
    const receipt = expect(restoring.then(JSON.parse)).resolves.toMatchObject({ affected_records: 3, affected_categories: 3 })
    void receipt.catch(() => undefined)
    await sessions.waitingOnAdvisory(lifecycle.pid, worker.pid)
    await worker.execute("COMMIT")
    await receipt
    const late = await connect(1, "service_role")
    await expect(late.execute(editNode(30))).rejects.toThrow("40001: Conflicting Records write")
    await lifecycle.execute("COMMIT")
    query(`${actor(1, "service_role")}; ${editNode(30)}; SELECT enqueue_record_embedding_job('${id(30)}','{}', false)`)
    expect(query(jobs("status", 30))).toBe("pending")
    expect(query(`SELECT deleted_at IS NOT NULL FROM records WHERE id='${id(31)}'`)).toBe("t")
    expect(() => query(editNode(31))).toThrow(/42501: Trashed record diagrams/)
  })

  it("fails fast on standalone DELETE and on shared-to-exclusive conversion, not partially committing a batch", async () => {
    query(upgrade)
    const ordinary = await connect(1, "service_role")
    const deleting = await connect(1)
    await ordinary.execute(`BEGIN; ${editNode(30)}`)
    await expect(deleting.execute(trashOne())).rejects.toThrow("40001: Conflicting Records write")
    await ordinary.execute("COMMIT")
    expect(query(`SELECT deleted_at IS NULL FROM records WHERE id='${id(30)}'`)).toBe("t")
    const mixed = await connect(1)
    await expect(mixed.execute(`BEGIN; UPDATE records SET description='uncommitted'; ${trash()}; COMMIT`))
      .rejects.toThrow("40001: Records lifecycle changes require the exclusive fence first")
    expect(query("SELECT count(*) FROM records WHERE description='uncommitted' OR deleted_at IS NOT NULL")).toBe("0")
    const blocked = await connect(1, "service_role")
    const standalone = await connect(1)
    await standalone.execute(`BEGIN; ${trashOne()}`)
    await expect(blocked.execute(`INSERT INTO record_embedding_jobs(record_id,site_id,record_revision,status)
      SELECT '${id(30)}', '${site}', 20, 'pending'`)).rejects.toThrow("40001: Conflicting Records write")
    await standalone.execute(`COMMIT; ${restoreOne()}`)
    expect(query(`SELECT deleted_at IS NULL FROM records WHERE id='${id(30)}'`)).toBe("t")
  })

  it("allows structural changes to enqueue without downgrading or releasing their exclusive fence", async () => {
    query(upgrade)
    const mover = await connect(1)
    await mover.execute(`BEGIN; UPDATE records SET category_id='${id(21)}' WHERE id='${id(30)}';
      UPDATE records SET title='also edited' WHERE id='${id(30)}'`)
    const siteKeyLocks = query(`WITH site_lock AS (SELECT hashtextextended('records-trash:${site}',0) AS key)
      SELECT mode FROM pg_locks, site_lock WHERE pid=${mover.pid} AND locktype='advisory' AND granted
       AND classid::bigint=((key >> 32) & 4294967295) AND objid::bigint=(key & 4294967295) ORDER BY mode`)
    expect(siteKeyLocks).toBe("ExclusiveLock\nShareLock")
    await mover.execute("COMMIT")
    expect(query(jobs("record_revision", 30))).toBe("0\n1\n2")
  })

  it.each([
    ["record", `SELECT id FROM records WHERE id='${id(30)}' FOR UPDATE`, `UPDATE records SET title='late' WHERE id='${id(30)}'`],
    ["job", `SELECT id FROM record_embedding_jobs WHERE record_id='${id(30)}' FOR UPDATE`,
      `UPDATE record_embedding_jobs SET status='processing' WHERE record_id='${id(30)}'`],
  ])("does not wait on an exclusive fence after locking a %s tuple", async (_, lock, update) => {
    query(upgrade)
    const writer = await connect()
    const lifecycle = await connect(1)
    await writer.execute(`BEGIN; ${lock}`)
    const deleting = lifecycle.execute(trash())
    const receipt = expect(deleting.then(JSON.parse)).resolves.toMatchObject({ affected_records: 4, affected_categories: 3 })
    void receipt.catch(() => undefined)
    await sessions.waitingOnTuple(lifecycle.pid, writer.pid)
    await expect(writer.execute(update)).rejects.toThrow("40001: Conflicting Records write")
    await receipt
    expect(query(jobs("status", 30))).toBe("completed")
  })

  it("lets unrelated records claim work without changing a prior transaction's claimed job", async () => {
    query(upgrade)
    query(`INSERT INTO record_embedding_jobs(record_id,site_id,status) VALUES ('${id(31)}','${site}','pending')`)
    const first = await connect(1, "service_role")
    const second = await connect(1, "service_role")
    const lifecycle = await connect(1)
    const claim = (n: number) => `SELECT status || ':' || attempts FROM claim_record_embedding_jobs('${id(n)}',1)`
    expect(await first.execute(`BEGIN; ${claim(30)}`)).toBe("processing:1")
    expect(await second.execute(`BEGIN; ${claim(31)}; COMMIT`)).toBe("processing:1")
    const deleting = lifecycle.execute(trash())
    const receipt = expect(deleting.then(JSON.parse)).resolves.toMatchObject({ affected_records: 4 })
    void receipt.catch(() => undefined)
    await sessions.waitingOnAdvisory(lifecycle.pid, first.pid)
    await first.execute("COMMIT")
    await receipt
    expect(query(jobs("status", 30))).toBe("completed")
    expect(query(jobs("status", 31))).toBe("completed")
  })

  it("keeps lock order across sites and fences both diagram parents on privileged reparenting", async () => {
    query(upgrade)
    const lifecycle = await connect(1)
    await lifecycle.execute(`BEGIN; ${trash()}`)
    const worker = await connect(1, "service_role")
    await expect(worker.execute(`UPDATE record_diagram_nodes SET record_id='${id(40)}' WHERE record_id='${id(30)}'`))
      .rejects.toThrow("40001: Conflicting Records write")
    await lifecycle.execute("COMMIT")
    expect(() => query(`UPDATE record_diagram_nodes SET record_id='${id(40)}' WHERE record_id='${id(30)}'`))
      .toThrow(/42501: Trashed record diagrams/)
    expect(() => query(`UPDATE record_diagram_nodes SET record_id='${id(30)}' WHERE record_id='${id(40)}'`))
      .toThrow(/42501: Trashed record diagrams/)
    const first = await connect(5)
    const second = await connect(1)
    await first.execute(`BEGIN; UPDATE records SET description='uncommitted' WHERE id='${id(40)}'`)
    await second.execute(`BEGIN; ${restore()}`)
    await first.execute(`SET request.jwt.claim.sub = '${id(1)}'`)
    await expect(first.execute(restore())).rejects.toThrow("40001: Conflicting Records write")
    await second.execute("COMMIT")
  })

  it("fails closed on fixed snapshots and preserves role, tenant, parent and location boundaries", () => {
    query(upgrade)
    for (const isolation of ["REPEATABLE READ", "SERIALIZABLE"]) {
      expect(() => query(`BEGIN ISOLATION LEVEL ${isolation}; ${editNode(30)}; COMMIT`)).toThrow(/0A000:.*READ COMMITTED/)
    }
    expect(query(`BEGIN ISOLATION LEVEL READ UNCOMMITTED; ${editNode(30)}; COMMIT; SELECT 1`)).toBe("1")
    expect(() => query(`${actor(5)}; ${trash()}`)).toThrow(/42501: Records trash access denied/)
    expect(() => query(`${actor(6)}; ${restore()}`)).toThrow(/42501: Records trash access denied/)
    expect(() => query(`${actor(3)}; ${trashOne(31)}`)).toThrow(/42501: Record not found or access denied/)
    expect(query(`${actor(7)}; UPDATE records SET title='read only' WHERE id='${id(30)}' RETURNING id`)).toBe("")
    expect(() => query(`${actor()}; ${editNode(30)}`)).toThrow(/42501: permission denied/)
    expect(() => query(`${actor()}; UPDATE records SET category_id='${otherRoot}' WHERE id='${id(30)}'`))
      .toThrow(/23514: An active same-site parent category is required/)
    expect(() => query(`${actor()}; INSERT INTO records(site_id,category_id,title)
      VALUES ('${site}','${otherRoot}','Wrong site')`)).toThrow(/23514: An active same-site parent category is required/)
    expect(() => query(`${actor()}; UPDATE records SET deleted_at=now() WHERE id='${id(30)}'`)).toThrow(/42501:/)
    expect(() => query(`${actor(1, "anon")}; ${trash()}`)).toThrow(/42501: permission denied/)
  })

  it("fails closed on guard drift and does not broaden existing function ACLs", () => {
    const acl = `SELECT oid::regprocedure::text, proowner, prosecdef, proconfig, proacl FROM pg_proc
      WHERE proname IN ('guard_record_trash_writes','guard_trashed_record_diagram_write',
        'guard_trashed_record_embedding_job','trash_record','trash_record_category','restore_record',
        'restore_record_category','convert_record_delete_to_trash','enqueue_record_embedding_job',
        'save_record_diagram') ORDER BY 1`
    const originalAcl = query(acl)
    query("ALTER FUNCTION public.guard_trashed_record_diagram_write() SECURITY INVOKER")
    expect(() => query(upgrade)).toThrow(/Records lock migration requires the audited function/)
    expect(query("SELECT to_regnamespace('records_lock_private') IS NULL")).toBe("t")
    query("ALTER FUNCTION public.guard_trashed_record_diagram_write() SECURITY DEFINER")
    query(upgrade)
    expect(query(acl)).toBe(originalAcl)
    expect(query("SELECT has_schema_privilege('anon','records_lock_private','USAGE')")).toBe("f")
  })

  it("sets postgres ownership of the private schema and both helpers when applied by a migration role", () => {
    query(`CREATE ROLE records_migration_runner IN ROLE postgres;
      GRANT CREATE ON DATABASE postgres TO records_migration_runner;
      SET ROLE records_migration_runner;
      ${upgrade}`)
    expect(query(`SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname='records_lock_private'`))
      .toBe("postgres")
    expect(query(`SELECT proname || ':' || pg_get_userbyid(proowner) FROM pg_proc
      WHERE pronamespace='records_lock_private'::regnamespace ORDER BY proname`))
      .toBe("fence:postgres\nfence_record:postgres")
    expect(JSON.parse(query(`${actor()}; ${trash()}`))).toMatchObject({ affected_records: 4 })
  })
})