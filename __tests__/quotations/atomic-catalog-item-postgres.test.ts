/** @jest-environment node */
import { readFileSync } from "node:fs"
import path from "node:path"
import { spawn } from "node:child_process"
import { actor, bootstrap, disposablePostgres, ids, migration, postgresAvailable, uuid }
  from "../robots/instance-ownership-postgres"

const atomic = readFileSync(path.join(process.cwd(),
  "supabase/migrations/20261113180000_atomic_catalog_item_requirement.sql"), "utf8")
const suite = postgresAvailable ? describe : describe.skip
const item = uuid(300)
const hiddenItem = uuid(301)
const otherItem = uuid(302)
const unavailable = { error: "Catalog quoting context unavailable" }

suite("atomic quotation context in socket-only PostgreSQL", () => {
  const pg = disposablePostgres()
  const db = pg.db
  const call = (user = ids.member, id = item) => JSON.parse(db(actor(user,
    `SELECT public.ensure_catalog_item_requirement('${id}');`)))
  const counts = () => db(`SELECT (SELECT count(*) FROM requirements),
    (SELECT count(*) FROM remote_instances), (SELECT count(*) FROM catalog_item_requirements),
    (SELECT count(*) FROM requirement_status);`)
  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => {
    db(bootstrap)
    db(migration())
    db(`ALTER TABLE remote_instances ALTER COLUMN id SET DEFAULT gen_random_uuid();
      ALTER TABLE remote_instances ADD COLUMN name text;
      ALTER TABLE remote_instances ADD COLUMN instance_type text;
      ALTER TABLE remote_instances ADD COLUMN status text;
      CREATE TABLE catalog_items(id uuid PRIMARY KEY,site_id uuid NOT NULL,name text);
      ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;
      GRANT SELECT,UPDATE ON catalog_items TO authenticated;
      CREATE POLICY item_access ON catalog_items TO authenticated
        USING(public.user_can(site_id,'select')) WITH CHECK(public.user_can(site_id,'update'));
      CREATE TABLE requirements(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text,
        description text,type text,priority text,status text,completion_status text,source text,
        site_id uuid,user_id uuid);
      ALTER TABLE requirements ENABLE ROW LEVEL SECURITY;
      GRANT SELECT,INSERT,UPDATE,DELETE ON requirements TO authenticated;
      CREATE POLICY req_read ON requirements FOR SELECT TO authenticated
        USING(public.instance_row_access(site_id,user_id,user_id));
      CREATE POLICY req_insert ON requirements FOR INSERT TO authenticated
        WITH CHECK(public.user_can(site_id,'insert') AND user_id=auth.uid());
      CREATE POLICY req_delete ON requirements FOR DELETE TO authenticated USING(public.user_can(site_id,'delete'));
      CREATE TABLE catalog_item_requirements(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id uuid NOT NULL,catalog_item_id uuid UNIQUE REFERENCES catalog_items,
        requirement_id uuid UNIQUE REFERENCES requirements,instance_id uuid UNIQUE REFERENCES remote_instances);
      ALTER TABLE catalog_item_requirements ENABLE ROW LEVEL SECURITY;
      GRANT SELECT,INSERT,UPDATE,DELETE ON catalog_item_requirements TO authenticated;
      CREATE POLICY link_access ON catalog_item_requirements TO authenticated USING(true) WITH CHECK(true);
      CREATE TABLE requirement_status(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id uuid,instance_id uuid,requirement_id uuid,stage text,message text);
      ALTER TABLE requirement_status ENABLE ROW LEVEL SECURITY;
      GRANT SELECT,INSERT ON requirement_status TO authenticated;
      CREATE POLICY status_access ON requirement_status TO authenticated USING(true) WITH CHECK(true);
      INSERT INTO catalog_items VALUES('${item}','${ids.site}','Item'),
        ('${hiddenItem}','${ids.site}','Hidden context item'),('${otherItem}','${ids.otherSite}','Other');`)
    db(migration())
    db(atomic)
    db(`INSERT INTO requirements(id,site_id,user_id) VALUES('${uuid(400)}','${ids.site}','${ids.owner}');
      INSERT INTO catalog_item_requirements(site_id,catalog_item_id,requirement_id,instance_id)
      VALUES('${ids.site}','${hiddenItem}','${uuid(400)}','${ids.hidden}');`)
  })

  it("creates actor-attributed context and reuses it without additional writes", () => {
    const result = call()
    expect(result.data.catalog_item_id).toBe(item)
    expect(db(`SELECT user_id,created_by FROM remote_instances WHERE id='${result.data.instance_id}';`))
      .toBe(`${ids.member}|${ids.member}`)
    expect(db(`SELECT user_id FROM requirements WHERE id='${result.data.requirement_id}';`)).toBe(ids.member)
    const before = counts()
    expect(call()).toEqual(result)
    expect(counts()).toBe(before)
  })

  it("rejects repeated hidden-link requests without orphan instances despite denied DELETE", () => {
    expect(db(actor(ids.member, `SELECT count(*) FROM catalog_item_requirements WHERE catalog_item_id='${hiddenItem}';`))).toBe("0")
    const before = counts()
    for (let i = 0; i < 3; i++) expect(call(ids.member, hiddenItem)).toEqual(unavailable)
    expect(counts()).toBe(before)
    expect(db(actor(ids.member, `SELECT public.user_can('${ids.site}','delete');`))).toBe("f")
  })

  it("rolls back every insert if status admission fails after the link is created", () => {
    db(`ALTER TABLE requirement_status ADD CONSTRAINT reject_seed CHECK(stage <> 'dynamic_quote_ready');`)
    const before = counts()
    expect(call()).toEqual(unavailable)
    expect(counts()).toBe(before)
  })

  it("serializes simultaneous requests into one durable triad", async () => {
    const socket = db("SHOW unix_socket_directories;")
    const port = db("SHOW port;")
    const binary = path.join(process.env.REQUIREMENT_TEST_PG_BIN || "/opt/homebrew/opt/postgresql@17/bin", "psql")
    const request = () => new Promise<string>((resolve, reject) => {
      const process = spawn(binary, ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1",
        "-h", socket, "-p", port, "-U", "postgres", "-d", "postgres"])
      let output = ""
      let error = ""
      process.stdout.on("data", chunk => { output += chunk.toString() })
      process.stderr.on("data", chunk => { error += chunk.toString() })
      process.on("error", reject)
      process.on("close", code => { if (code === 0) resolve(output.trim()); else reject(new Error(error)) })
      process.stdin.end(actor(ids.member,
        `BEGIN; SELECT public.ensure_catalog_item_requirement('${item}'); SELECT pg_sleep(0.2); COMMIT;`))
    })
    const [first, second] = await Promise.all([request(), request()])
    expect(JSON.parse(first)).toEqual(JSON.parse(second))
    expect(db(`SELECT count(*) FROM catalog_item_requirements WHERE catalog_item_id='${item}';`)).toBe("1")
    expect(db("SELECT count(*) FROM requirements WHERE source='dynamic_quote';")).toBe("1")
    expect(db("SELECT count(*) FROM remote_instances WHERE name='Quote: Item';")).toBe("1")
  })

  it.each([ids.inactive, ids.foreign, ids.viewer])("denies unauthorized actor %s without writes", user => {
    const before = counts()
    expect(call(user)).toEqual(unavailable)
    expect(counts()).toBe(before)
  })

  it("denies missing/cross-site items and anonymous RPC execution", () => {
    const before = counts()
    expect(call(ids.member, otherItem)).toEqual(unavailable)
    expect(call(ids.member, uuid(999))).toEqual(unavailable)
    expect(() => db(actor(null, `SELECT public.ensure_catalog_item_requirement('${item}');`, "anon")))
      .toThrow(/permission denied/)
    expect(counts()).toBe(before)
  })

  it("reuses owner context only for authorized users and preserves invoker security on replay", () => {
    const before = counts()
    expect(call(ids.owner, hiddenItem).data.instance_id).toBe(ids.hidden)
    expect(counts()).toBe(before)
    db(atomic)
    expect(db(`SELECT prosecdef FROM pg_proc WHERE oid='public.ensure_catalog_item_requirement(uuid)'::regprocedure;`)).toBe("f")
    expect(db(`SELECT has_function_privilege('anon','public.ensure_catalog_item_requirement(uuid)','EXECUTE'),
      has_function_privilege('authenticated','public.ensure_catalog_item_requirement(uuid)','EXECUTE'),
      has_function_privilege('service_role','public.ensure_catalog_item_requirement(uuid)','EXECUTE');`)).toBe("f|t|f")
  })
})