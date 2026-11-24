/** @jest-environment node */
import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import path from "node:path"

const pgBin = process.env.RECORDS_TEST_PG_BIN || "/opt/homebrew/opt/postgresql@17/bin"
const available = ["initdb", "pg_ctl", "psql"].every(file => existsSync(path.join(pgBin, file)))
const suite = available ? describe : describe.skip
const migration = readFileSync(path.join(process.cwd(), "supabase/migrations/20261111032000_records_relation_admission.sql"), "utf8")
const fieldCompatibility = readFileSync(path.join(process.cwd(), "supabase/migrations/20261124010000_records_field_value_compatibility.sql"), "utf8")
const schemaFence = readFileSync(path.join(process.cwd(), "supabase/migrations/20261124011000_records_schema_write_fence.sql"), "utf8")
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const env = { ...process.env, LC_ALL: "C", LANG: "C" }

describe("relation admission migration contract", () => {
  it("preserves policies and explicitly documents reverse-integrity limitations", () => {
    expect(migration).toContain("SECURITY INVOKER")
    expect(migration).not.toMatch(/CREATE POLICY|DROP POLICY|ALTER POLICY/)
    expect(migration).toContain("does NOT implement JSON foreign keys")
    expect(migration).toContain("REVOKE ALL ON FUNCTION")
    expect(migration).toContain("WHEN 'sales_order' THEN 'sale_orders'")
  })
})

suite("relation admission in isolated PostgreSQL", () => {
  let directory = ""
  const db = (sql: string) => execFileSync(path.join(pgBin, "psql"), [
    "-h", directory, "-p", "55443", "-U", "postgres", "-d", "postgres", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-c", sql,
  ], { encoding: "utf8", stdio: "pipe", env, timeout: 15000 }).trim()
  const actor = (sql: string) => db(`SET ROLE authenticated; SET test.records_role = 'admin'; ${sql}`)
  const fields = (target: string, extra = "") => `[{"id":"link","name":"Link","type":"relation","relationTarget":"${target}"${extra}}]`
  const write = (id: string, value: unknown = uuid(3), category = uuid(2)) => actor(`
    INSERT INTO public.records(id, site_id, category_id, relations)
    VALUES ('${id}', '${uuid(1)}', '${category}', '${JSON.stringify({ Link: value })}'::jsonb);
  `)
  const configure = (target: string, extra = "") => actor(`UPDATE public.record_categories SET template_fields = '${fields(target, extra)}'::jsonb WHERE id = '${uuid(2)}'`)
  const template = (value: unknown, insert = false) => actor(insert
    ? `INSERT INTO public.record_categories VALUES ('${uuid(20)}', '${uuid(1)}', '${JSON.stringify(value)}'::jsonb)`
    : `UPDATE public.record_categories SET template_fields = '${JSON.stringify(value)}'::jsonb WHERE id = '${uuid(2)}'`)

  beforeAll(() => {
    // Socket-only disposable cluster; never consumes a configured database URL.
    directory = mkdtempSync("/tmp/records-pg-")
    execFileSync(path.join(pgBin, "initdb"), ["-D", path.join(directory, "data"), "-U", "postgres", "-A", "trust", "--no-locale", "--encoding=UTF8"], { stdio: "pipe", env, timeout: 20000 })
    execFileSync(path.join(pgBin, "pg_ctl"), ["-D", path.join(directory, "data"), "-l", path.join(directory, "server.log"),
      "-o", `-F -p 55443 -k ${directory} -c listen_addresses='' -c lc_messages=C`, "-w", "start"], { stdio: "pipe", env, timeout: 20000 })
    db(`CREATE ROLE authenticated; CREATE ROLE anon;
      CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO authenticated;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT '${uuid(90)}'::uuid $$;`)
  }, 30000)
  afterAll(() => {
    if (!directory) return
    if (existsSync(path.join(directory, "data/postmaster.pid"))) execFileSync(path.join(pgBin, "pg_ctl"), ["-D", path.join(directory, "data"), "-m", "fast", "-w", "stop"], { stdio: "pipe", env, timeout: 20000 })
    rmSync(directory, { recursive: true, force: true })
  })
  beforeEach(() => {
    db(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;
      CREATE TABLE public.record_categories(id uuid PRIMARY KEY, site_id uuid, template_fields jsonb);
      CREATE TABLE public.records(id uuid PRIMARY KEY, site_id uuid, category_id uuid, relations jsonb DEFAULT '{}',
        data jsonb DEFAULT '{}', status text DEFAULT 'draft', deleted_at timestamptz);
      CREATE TABLE public.companies(id uuid PRIMARY KEY);
      CREATE TABLE public.site_members(user_id uuid, site_id uuid, status text, license_suspended boolean, manually_disabled boolean);
      ${["leads", "deals", "suppliers", "sale_orders"].map(table => `CREATE TABLE public.${table}(id uuid PRIMARY KEY, site_id uuid, company_id uuid, visible boolean DEFAULT true);`).join("\n")}
      INSERT INTO public.record_categories VALUES ('${uuid(2)}','${uuid(1)}','${fields("lead")}'), ('${uuid(4)}','${uuid(1)}','[]');
      INSERT INTO public.leads(id,site_id) VALUES ('${uuid(3)}','${uuid(1)}'), ('${uuid(5)}','${uuid(9)}');
      INSERT INTO public.leads(id,site_id,visible) VALUES ('${uuid(6)}','${uuid(1)}',false);
      ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
      CREATE POLICY readable_leads ON public.leads FOR SELECT TO authenticated USING (visible);
      GRANT USAGE ON SCHEMA public TO authenticated;
      GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;`)
    db(migration)
  })
  it("allows same-site readable targets and rejects foreign-site and RLS-hidden targets", () => {
    expect(() => write(uuid(10))).not.toThrow()
    expect(() => write(uuid(11), uuid(5))).toThrow("target not found or access denied")
    expect(() => write(uuid(12), uuid(6))).toThrow("target not found or access denied")
    expect(() => write(uuid(13), [uuid(3)])).toThrow("single entity ID")
  })
  it("enforces target categories on internal record links", () => {
    db(`INSERT INTO public.records(id,site_id,category_id) VALUES ('${uuid(3)}','${uuid(1)}','${uuid(4)}')`)
    configure("record", `,"targetCategoryId":"${uuid(4)}"`)
    expect(() => write(uuid(10))).not.toThrow()
    expect(() => configure("record", `,"targetCategoryId":"${uuid(2)}"`)).toThrow("Populated field changes require a data migration")
    db(`UPDATE public.records SET category_id = '${uuid(2)}', relations = '{}' WHERE id = '${uuid(3)}'`)
    expect(() => write(uuid(11))).toThrow("target not found or access denied")
  })
  it("requires an enabled membership user_id", () => {
    configure("team_member")
    db(`INSERT INTO public.site_members VALUES ('${uuid(3)}','${uuid(1)}','active',false,false)`)
    expect(() => write(uuid(10))).not.toThrow()
    db("UPDATE public.site_members SET manually_disabled = true")
    expect(() => actor(`UPDATE public.records SET relations = relations WHERE id = '${uuid(10)}'`)).not.toThrow()
    expect(() => write(uuid(11))).toThrow("target not found or access denied")
    db(`INSERT INTO public.site_members VALUES ('${uuid(7)}','${uuid(1)}','active',false,true)`)
    expect(() => actor(`UPDATE public.records SET relations = '{"Link":"${uuid(7)}"}' WHERE id = '${uuid(10)}'`)).toThrow("target not found or access denied")
  })
  it("does not ignore invalid nonrecord targetCategoryId in legacy metadata", () => {
    db("DROP TRIGGER record_category_field_contracts ON public.record_categories")
    configure("lead", `,"targetCategoryId":"${uuid(4)}"`)
    db(migration)
    expect(() => write(uuid(10))).toThrow("Invalid target category")
  })
  it("requires readable site-linked business association for companies", () => {
    configure("company")
    db(`INSERT INTO public.companies VALUES ('${uuid(3)}')`)
    expect(() => write(uuid(10))).toThrow("target not found or access denied")
    db(`UPDATE public.leads SET company_id = '${uuid(3)}' WHERE id = '${uuid(6)}'`)
    expect(() => write(uuid(11))).toThrow("target not found or access denied")
    db(`UPDATE public.leads SET company_id = '${uuid(3)}' WHERE id = '${uuid(3)}'`)
    expect(() => write(uuid(12))).not.toThrow()
  })
  it("rejects new person definitions, preserves legacy definitions/links, and tolerates empty system relations", () => {
    expect(() => configure("person")).toThrow("New person fields are unsupported")
    // Seed historical data before reinstalling the unapplied admission guard.
    db(`DROP TRIGGER record_category_field_contracts ON public.record_categories;
      DROP TRIGGER records_relation_admission ON public.records;`)
    configure("person")
    write(uuid(12))
    db(migration)
    expect(() => template([{ ...JSON.parse(fields("person"))[0], label: "Legacy person" }])).not.toThrow()
    expect(() => actor(`UPDATE public.records SET relations = relations WHERE id = '${uuid(12)}'`)).not.toThrow()
    expect(() => write(uuid(10))).toThrow("New person links are unsupported")
    expect(() => actor(`INSERT INTO public.records(id,site_id,category_id) VALUES ('${uuid(11)}','${uuid(1)}','${uuid(4)}')`)).not.toThrow()
  })
  it("is rerunnable without changing existing policy definitions", () => {
    expect(() => db(migration)).not.toThrow()
    expect(db("SELECT qual FROM pg_policies WHERE policyname = 'readable_leads'")).toBe("visible")
  })
  it("protects populated category schema even if records are hidden by RLS", () => {
    write(uuid(10))
    db(`ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;
      CREATE POLICY hidden_records ON public.records FOR SELECT TO authenticated USING (false)`)
    expect(() => actor(`UPDATE public.record_categories SET template_fields = '[]' WHERE id = '${uuid(2)}'`)).toThrow("Populated field changes require a data migration")
    expect(() => actor(`UPDATE public.record_categories SET template_fields = '${fields("lead").replace('"Link"', '"Renamed"')}' WHERE id = '${uuid(2)}'`)).toThrow("storage names are immutable")
    const old = JSON.parse(fields("lead"))[0]
    expect(() => template([{ ...old, id: "replacement", name: "Renamed" }])).toThrow("Populated field changes require a data migration")
    expect(() => template([{ ...old, id: "replacement" }])).toThrow("Populated field changes require a data migration")
    expect(() => template([{ ...old, label: "Display only" }])).not.toThrow()
  })
  it.each([
    [null], [{ id: 1, name: "Name", type: "text" }], [{ id: "x", name: [], type: "text" }],
    [{ id: "x", name: "\t ", type: "text" }], [{ id: "x", name: "constructor", type: "text" }],
    [{ id: "x", name: "Name", type: "text" }, { id: "y", name: "Name", type: "number" }],
    [{ id: "x", name: "Name", type: "text" }, { id: "x", name: "Other", type: "text" }],
    [{ id: "x", name: "Link", type: "relation", relationTarget: "lead", targetCategoryId: uuid(4) }],
    [{ id: "x", name: "Link", type: "relation", relationTarget: "record", targetCategoryId: "bad" }],
    [{ id: "x", name: "Link", type: "text", targetCategoryId: uuid(4) }],
    [{ id: "x", name: "Link", type: "relation", relationTarget: "person" }],
    [{ id: "x", name: "Number", type: "number", min: "1" }],
    [{ id: "x", name: "Number", type: "number", min: 2, max: 1 }],
    [{ id: "x", name: "Choice", type: "select", options: ["A", "A"] }],
  ])("rejects malformed/new unsupported metadata on both INSERT and UPDATE: %j", (...value) => {
    // Jest expands array cases into arguments; recover the template field list.
    expect(() => template(value, true)).toThrow()
    expect(() => template(value)).toThrow()
  })
  it("accepts nullable old templates/relations without rewriting them and rejects scalar relations", () => {
    db(`INSERT INTO public.record_categories VALUES ('${uuid(20)}','${uuid(1)}',NULL)`)
    for (const value of ["NULL", "'null'::jsonb"]) {
      expect(() => actor(`INSERT INTO public.records(id,site_id,category_id,relations)
        VALUES ('${uuid(value === "NULL" ? 21 : 22)}','${uuid(1)}','${uuid(20)}',${value})`)).not.toThrow()
    }
    expect(db(`SELECT relations IS NULL FROM public.records WHERE id = '${uuid(21)}'`)).toBe("t")
    expect(() => actor(`UPDATE public.records SET relations = '[]' WHERE id = '${uuid(21)}'`)).toThrow("must be an object")
    expect(() => template(null)).not.toThrow()
    expect(() => template([{ id: "new", name: "Optional", type: "text" }])).not.toThrow()
  })
  it("checks record target RLS and preserves source write policies and function restrictions", () => {
    db(`INSERT INTO public.records(id,site_id,category_id) VALUES ('${uuid(3)}','${uuid(1)}','${uuid(4)}');
      ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;
      CREATE POLICY visible_records ON public.records FOR SELECT TO authenticated USING (id <> '${uuid(3)}');
      CREATE POLICY writable_records ON public.records FOR INSERT TO authenticated
        WITH CHECK (site_id = '${uuid(1)}' AND id <> '${uuid(12)}');`)
    const policies = db("SELECT policyname, cmd, qual, with_check FROM pg_policies ORDER BY policyname")
    configure("record")
    expect(() => write(uuid(10))).toThrow("target not found or access denied")
    expect(() => actor(`INSERT INTO public.records(id,site_id,category_id) VALUES ('${uuid(11)}','${uuid(1)}','${uuid(4)}')`)).not.toThrow()
    expect(() => actor(`INSERT INTO public.records(id,site_id,category_id) VALUES ('${uuid(12)}','${uuid(1)}','${uuid(4)}')`)).toThrow("row-level security")
    expect(() => db(`SET ROLE anon; SELECT * FROM public.records`)).toThrow("permission denied")
    expect(db(`SELECT has_function_privilege('authenticated', 'public.preserve_populated_record_field_contracts()', 'EXECUTE'),
      has_function_privilege('anon', 'public.preserve_populated_record_field_contracts()', 'EXECUTE')`)).toBe("f|f")
    db(migration)
    expect(db("SELECT policyname, cmd, qual, with_check FROM pg_policies ORDER BY policyname")).toBe(policies)
  })
  it("allows legitimate record cycles rather than enforcing a global dependency DAG", () => {
    configure("record")
    db(`INSERT INTO public.records(id,site_id,category_id) VALUES ('${uuid(3)}','${uuid(1)}','${uuid(2)}')`)
    expect(() => write(uuid(10))).not.toThrow()
    expect(() => actor(`UPDATE public.records SET relations = '{"Link":"${uuid(10)}"}' WHERE id = '${uuid(3)}'`)).not.toThrow()
  })
  it("blocks populated constraint tightening, including legacy null bounds", () => {
    const number = { id: "n", name: "Number", type: "number", min: 0, max: 10 }
    template([number])
    db(`INSERT INTO public.records(id,site_id,category_id) VALUES ('${uuid(10)}','${uuid(1)}','${uuid(2)}')`)
    for (const change of [{ min: 1 }, { max: 9 }, { required: true }]) {
      expect(() => template([{ ...number, ...change }])).toThrow("Populated field changes require a data migration")
    }
    expect(() => template([{ ...number, min: -1, max: 11 }])).not.toThrow()
    expect(() => template([number, { id: "required", name: "Required", type: "text", required: true }])).toThrow()
    db("DROP TRIGGER record_category_field_contracts ON public.record_categories")
    template([{ ...number, min: null }])
    db(migration)
    expect(() => template([number])).toThrow("Populated field changes require a data migration")
  })
  describe("value-aware field edits", () => {
    beforeEach(() => {
      db(`CREATE FUNCTION public.current_user_site_role(uuid) RETURNS text LANGUAGE sql STABLE
          AS $$ SELECT CASE WHEN current_setting('test.records_role', true) IN ('restricted','assigned') THEN 'admin'
            ELSE current_setting('test.records_role', true) END $$;
        CREATE FUNCTION public.current_user_has_site_location_restrictions(uuid) RETURNS boolean LANGUAGE sql STABLE
          AS $$ SELECT current_setting('test.records_role', true) = 'restricted' $$;
        CREATE FUNCTION public.record_row_access(uuid,uuid,jsonb) RETURNS boolean LANGUAGE sql STABLE
          AS $$ SELECT current_setting('test.records_role', true) IS DISTINCT FROM 'assigned' $$;
        CREATE FUNCTION public.user_can(uuid,text) RETURNS boolean LANGUAGE sql STABLE
          AS $$ SELECT $1 = '${uuid(1)}'::uuid $$;
        ALTER TABLE public.record_categories ADD COLUMN updated_at timestamptz DEFAULT now(), ADD COLUMN deleted_at timestamptz;
        ALTER TABLE public.records ADD COLUMN updated_at timestamptz DEFAULT now(), ADD COLUMN title text, ADD COLUMN description text;
        ALTER TABLE public.records ALTER COLUMN id SET DEFAULT gen_random_uuid();`)
      db(fieldCompatibility)
      db(schemaFence)
    })

    const text = { id: "n", name: "Note", type: "text" }
    const number = { id: "q", name: "Quantity", type: "number" }
    const flag = { id: "b", name: "Flag", type: "boolean" }
    const record = (data: object, status = "draft") => db(`INSERT INTO public.records(id,site_id,category_id,data,status)
      VALUES ('${uuid(10)}','${uuid(1)}','${uuid(2)}','${JSON.stringify(data)}','${status}')`)

    it("removes or retypes empty fields in populated categories without rewriting records", () => {
      template([text, number, flag])
      record({ Note: null, Quantity: 0, Flag: "" }, "active")
      template([{ ...text, type: "date" }, number])
      template([number])
      expect(db("SELECT data FROM public.records")).toBe('{"Flag": "", "Note": null, "Quantity": 0}')
      expect(() => template(null)).toThrow('Cannot change "Quantity"')
    })

    it("permits compatible text conversions, valid bounds and unused option removal", () => {
      template([text, number])
      record({ Note: "Ready", Quantity: 0 }, "active")
      template([{ ...text, type: "description", required: true }, { ...number, min: 0, max: 1, required: true }])
      const choice = { ...text, type: "select", options: ["Ready", "Waiting"] }
      template([choice, number])
      template([{ ...choice, options: ["Ready"] }, number])
      expect(() => template([{ ...choice, options: ["Waiting"] }, number])).toThrow('Cannot change "Note"')
      expect(() => template([choice, { ...number, min: 1 }])).toThrow('Cannot change "Quantity"')
      expect(() => template([choice, { ...number, type: "text" }])).toThrow('Cannot change "Quantity"')
    })

    it("allows missing required values in drafts, but not active records", () => {
      const required = { ...text, required: true }
      template([])
      record({})
      template([required])
      template([text])
      db("UPDATE public.records SET status = 'active'")
      expect(() => template([required])).toThrow('Cannot change "Note"')
      db(`UPDATE public.records SET data = '{"Note":"😀"}'`)
      template([{ ...required, minLength: 2 }])
      expect(() => template([{ ...required, maxLength: 1 }])).toThrow('Cannot change "Note"')
    })

    it("protects false values hidden by RLS and trash without making rows readable", () => {
      template([flag, text])
      record({ Flag: false })
      db(`UPDATE public.records SET deleted_at = now();
        ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;
        CREATE POLICY active_records ON public.records FOR SELECT TO authenticated USING (deleted_at IS NULL);`)
      expect(actor("SELECT count(*) FROM public.records")).toBe("0")
      template([flag])
      expect(() => template([])).toThrow('Cannot change "Flag"')
      expect(db(`SELECT has_function_privilege('authenticated',
        'public.record_field_edit_conflicts(jsonb,jsonb,jsonb,jsonb,boolean)', 'EXECUTE')`)).toBe("f")
    })

    it("permits retargeting an empty relation but never reinterprets an existing link", () => {
      const link = { id: "link", name: "Link", type: "relation" }
      record({})
      expect(() => configure("supplier")).not.toThrow()
      template([link])
      write(uuid(11))
      expect(() => configure("supplier")).toThrow('Cannot change "Link"')
      expect(() => template([{ ...link, type: "text" }])).toThrow('Cannot change "Link"')
      expect(() => template([])).toThrow('Cannot change "Link"')
    })

    it("allows removal and retyping of tables with no rows but preserves tables with rows", () => {
      const table = { ...text, type: "table" }
      template([table])
      record({ Note: [] }, "active")
      template([text])
      template([])
      template([table])
      db(`UPDATE public.records SET data = '{"Note":[{"Cell":"value"}]}'`)
      expect(() => template([text])).toThrow('Cannot change "Note"')
      expect(() => template([])).toThrow('Cannot change "Note"')
    })

    it("blocks value-dependent schema edits before inspection but permits labels", () => {
      template([text])
      const change = (role: string, fields: unknown) => actor(`SET test.records_role = '${role}';
        UPDATE public.record_categories SET template_fields = '${JSON.stringify(fields)}' WHERE id = '${uuid(2)}'`)
      for (const role of ["collaborator", "restricted", "assigned"]) {
        expect(() => change(role, [{ ...text, label: "Presentation" }])).not.toThrow()
        expect(() => change(role, [])).toThrow("Only unrestricted workspace owners or admins")
      }
      record({ Note: "Hidden" })
      expect(() => change("collaborator", [])).toThrow("Only unrestricted workspace owners or admins")
    })

    it("checks both template and document version before a write and preserves omitted fields", () => {
      template([text])
      record({ Note: "keep" })
      const version = db("SELECT updated_at FROM public.records")
      const save = (fields: unknown, id: string | null, timestamp: string | null) => actor(`SELECT title FROM public.save_record_at_template(
        ${id ? `'${id}'` : "NULL"}, ${timestamp ? `'${timestamp}'` : "NULL"}, '${uuid(1)}', '${uuid(2)}',
        '${JSON.stringify(fields)}', '{"title":"Saved","data":{"Note":"keep"},"relations":{},"status":"draft"}')`)
      expect(() => save([], uuid(10), version)).toThrow("template changed")
      expect(() => save([], null, null)).toThrow("template changed")
      expect(save([text], uuid(10), "2000-01-01")).toBe("")
      expect(save([text], uuid(10), version)).toBe("Saved")
      expect(save([text], null, null)).toBe("Saved")
      const categoryVersion = db(`SELECT updated_at FROM public.record_categories WHERE id = '${uuid(2)}'`)
      template([{ ...text, label: "New label" }])
      expect(actor(`UPDATE public.record_categories SET template_fields = '[]'
        WHERE id = '${uuid(2)}' AND updated_at = '${categoryVersion}' RETURNING id`)).toBe("")
      expect(() => save([text], uuid(10), version)).toThrow("template changed")
    })
  })
  it("preserves or clears opaque old relations without allowing new or moved opaque links", () => {
    db(`DROP TRIGGER records_relation_admission ON public.records;
      INSERT INTO public.records(id,site_id,category_id,relations)
        VALUES ('${uuid(10)}','${uuid(1)}','${uuid(4)}','{"Historical":"opaque"}');`)
    db(migration)
    expect(() => actor(`UPDATE public.records SET relations = relations WHERE id = '${uuid(10)}'`)).not.toThrow()
    expect(() => actor(`UPDATE public.records SET category_id = '${uuid(2)}' WHERE id = '${uuid(10)}'`)).toThrow("Unknown record relation field")
    expect(() => actor(`UPDATE public.records SET relations = '{"Historical":"changed"}' WHERE id = '${uuid(10)}'`)).toThrow("Unknown record relation field")
    expect(() => actor(`UPDATE public.records SET relations = '{"Historical":null}' WHERE id = '${uuid(10)}'`)).not.toThrow()
  })
})