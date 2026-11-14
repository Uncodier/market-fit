/** @jest-environment node */
import {
  actor, bootstrap, childSchema, childSeed, coreChildren, disposablePostgres,
  ids, legacyPolicies, migration, optionalChildren, postgresAvailable, uuid,
} from "./instance-ownership-postgres"

const suite = postgresAvailable ? describe : describe.skip
suite("instance ownership RLS in disposable socket-only PostgreSQL", () => {
  const postgres = disposablePostgres()
  const db = postgres.db
  const as = (user: string | null, sql: string, role?: string) => db(actor(user, sql, role))
  const list = (user: string | null) => as(user,
    "SELECT id FROM public.remote_instances ORDER BY id;").split("\n").filter(Boolean)
  const insert = (user: string | null, created: string | null, site = ids.site) => `
    INSERT INTO public.remote_instances (id, site_id, user_id, created_by)
    VALUES ('${uuid(90)}', '${site}', ${user ? `'${user}'` : "NULL"},
      ${created ? `'${created}'` : "NULL"}) RETURNING user_id || ':' || created_by;`
  const policySnapshot = () => db(`SELECT schemaname, tablename, policyname, permissive,
    roles, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public'
    ORDER BY tablename, policyname;`)

  beforeAll(() => postgres.start(), 30000)
  afterAll(() => postgres.stop())
  beforeEach(() => { db(bootstrap); db(migration()) })

  it("installs a stable SECURITY DEFINER access function with a pinned search path", () => {
    const properties = JSON.parse(db(`SELECT json_build_object(
      'definer', prosecdef, 'volatility', provolatile, 'config', proconfig)
      FROM pg_proc WHERE oid = 'public.instance_row_access(uuid,uuid,uuid)'::regprocedure;`))
    expect(properties.definer).toBe(true)
    expect(properties.volatility).toBe("s")
    expect(properties.config.join(" ")).toMatch(/search_path=/)
    expect(as(ids.member, `SELECT public.instance_row_access('${ids.site}', '${ids.member}', NULL),
      public.instance_row_access('${ids.site}', NULL, '${ids.member}'),
      public.instance_row_access('${ids.site}', '${ids.owner}', '${ids.owner}'),
      public.instance_row_access('${ids.otherSite}', '${ids.member}', '${ids.member}');`))
      .toBe("t|t|f|f")
  })

  it("allows ownership via either field, denies others in lists and direct-ID reads", () => {
    expect(list(ids.member)).toEqual([ids.own, ids.created])
    for (const id of [ids.hidden, ids.crossSite, ids.blocked]) {
      expect(as(ids.member, `SELECT id FROM public.remote_instances WHERE id = '${id}';`)).toBe("")
      expect(as(ids.member, `UPDATE public.remote_instances SET payload = 'forged'
        WHERE id = '${id}' RETURNING id;`)).toBe("")
      expect(as(ids.member, `DELETE FROM public.remote_instances WHERE id = '${id}' RETURNING id;`)).toBe("")
    }
    expect(as(ids.member, `UPDATE public.remote_instances SET payload = 'allowed'
      WHERE id = '${ids.created}' RETURNING payload;`)).toBe("allowed")
    expect(as(ids.member, `DELETE FROM public.remote_instances WHERE id = '${ids.own}' RETURNING id;`)).toBe("")
    expect(db(`SELECT payload FROM public.remote_instances WHERE id = '${ids.hidden}';`)).toBe("original")
  })

  it.each([ids.unrestricted, ids.nullable, ids.owner, ids.coowner, ids.admin])(
    "preserves unrestricted/owner/coowner access for %s", user => {
      expect(list(user)).toEqual([ids.own, ids.created, ids.hidden, ids.viewerInstance])
      expect(as(user, `UPDATE public.remote_instances SET payload = 'allowed'
        WHERE id = '${ids.hidden}' RETURNING id;`)).toBe(ids.hidden)
    })

  it("owner and coowner exemptions survive a restrictive member flag", () => {
    db(`INSERT INTO public.site_members VALUES
      ('${ids.site}', '${ids.owner}', 'collaborator', 'active', true),
      ('${ids.site}', '${ids.coowner}', 'collaborator', 'active', true);`)
    for (const user of [ids.owner, ids.coowner]) {
      expect(list(user)).toContain(ids.hidden)
      expect(as(user, `UPDATE public.remote_instances SET payload = 'allowed'
        WHERE id = '${ids.hidden}' RETURNING id;`)).toBe(ids.hidden)
    }
  })

  it.each([ids.inactive, ids.foreign, null])("denies inactive, unrelated and unauthenticated actor %s", user => {
    expect(list(user)).toEqual(user === ids.foreign ? [ids.crossSite] : [])
    expect(as(user, `SELECT id FROM public.remote_instances WHERE id = '${ids.own}';`)).toBe("")
    expect(() => as(user, insert(user, user))).toThrow()
    expect(as(user, `UPDATE public.remote_instances SET payload = 'forged'
      WHERE id = '${ids.own}' RETURNING id;`)).toBe("")
    expect(as(user, `DELETE FROM public.remote_instances WHERE id = '${ids.own}' RETURNING id;`)).toBe("")
  })

  it("denies anonymous access despite legacy permissive policies and table grants", () => {
    expect(as(null, "SELECT id FROM public.remote_instances;", "anon")).toBe("")
    expect(() => as(null, insert(null, null), "anon")).toThrow()
    expect(as(null, "UPDATE public.remote_instances SET payload = 'forged' RETURNING id;", "anon")).toBe("")
    expect(as(null, "DELETE FROM public.remote_instances RETURNING id;", "anon")).toBe("")
  })

  it("requires operation capability even on a viewer's own row", () => {
    expect(list(ids.viewer)).toEqual([ids.viewerInstance])
    expect(() => as(ids.viewer, insert(ids.viewer, ids.viewer))).toThrow(/row-level security/)
    expect(as(ids.viewer, `UPDATE public.remote_instances SET payload = 'forged'
      WHERE id = '${ids.viewerInstance}' RETURNING id;`)).toBe("")
    expect(as(ids.viewer, `DELETE FROM public.remote_instances WHERE id = '${ids.viewerInstance}' RETURNING id;`)).toBe("")
  })

  it("requires active membership even when both attribution fields match", () => {
    as(null, `UPDATE public.remote_instances SET user_id = '${ids.inactive}',
      created_by = '${ids.inactive}' WHERE id = '${ids.own}';`, "service_role")
    expect(list(ids.inactive)).toEqual([])
    expect(as(ids.inactive, `SELECT public.instance_row_access('${ids.site}',
      '${ids.inactive}', '${ids.inactive}');`)).toBe("f")
    db(`UPDATE public.site_members SET status = 'active' WHERE user_id = '${ids.inactive}';`)
    expect(list(ids.inactive)).toContain(ids.own)
  })

  it("requires select capability in row access even if an operation capability allows writes", () => {
    db(`CREATE OR REPLACE FUNCTION public.user_can(p_site uuid, operation text) RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
        SELECT operation <> 'select';
      $$;`)
    expect(as(ids.member, `SELECT public.instance_row_access('${ids.site}',
      '${ids.member}', '${ids.member}');`)).toBe("f")
    expect(list(ids.member)).toEqual([])
    expect(() => as(ids.member, insert(ids.member, ids.member))).toThrow(/row-level security/)
  })

  it.each([[null, null], [ids.member, null], [null, ids.member], [ids.member, ids.member]])(
    "normalizes authenticated insert attribution (%s, %s)", (user, created) => {
      expect(as(ids.member, insert(user, created))).toBe(`${ids.member}:${ids.member}`)
    })

  it.each([[ids.owner, null], [null, ids.owner], [ids.member, ids.owner], [ids.owner, ids.member]])(
    "rejects forged insert attribution (%s, %s)", (user, created) => {
      expect(() => as(ids.member, insert(user, created))).toThrow()
      expect(db(`SELECT count(*) FROM public.remote_instances WHERE id = '${uuid(90)}';`)).toBe("0")
    })

  it.each(["site_id", "user_id", "created_by"])("rejects authenticated transfers of %s", column => {
    const value = column === "site_id" ? ids.otherSite : ids.foreign
    expect(() => as(ids.member, `UPDATE public.remote_instances SET ${column} = '${value}'
      WHERE id = '${ids.own}' RETURNING id;`)).toThrow()
    // Even an owner with both row access and CRUD cannot rewrite attribution.
    expect(() => as(ids.owner, `UPDATE public.remote_instances SET ${column} = '${value}'
      WHERE id = '${ids.hidden}' RETURNING id;`)).toThrow()
  })

  it("permits no-op attribution updates but rejects clearing either attribution field", () => {
    expect(as(ids.member, `UPDATE public.remote_instances SET site_id = site_id,
      user_id = user_id, created_by = created_by WHERE id = '${ids.own}' RETURNING id;`)).toBe(ids.own)
    for (const column of ["user_id", "created_by"]) {
      expect(() => as(ids.member, `UPDATE public.remote_instances SET ${column} = NULL
        WHERE id = '${ids.own}';`)).toThrow()
    }
  })

  it("service_role bypasses RLS and insert/update attribution guards", () => {
    expect(as(null, insert(ids.owner, ids.foreign, ids.otherSite), "service_role"))
      .toBe(`${ids.owner}:${ids.foreign}`)
    expect(as(ids.member, `UPDATE public.remote_instances SET site_id = '${ids.otherSite}',
      user_id = '${ids.foreign}', created_by = NULL WHERE id = '${ids.hidden}' RETURNING id;`, "service_role"))
      .toBe(ids.hidden)
    expect(as(null, "SELECT count(*) FROM public.remote_instances;", "service_role")).toBe("7")
    expect(as(null, `DELETE FROM public.remote_instances WHERE id = '${ids.hidden}' RETURNING id;`, "service_role"))
      .toBe(ids.hidden)
  })

  it("does not infer attribution for service-role inserts with null fields", () => {
    as(null, insert(null, null), "service_role")
    expect(db(`SELECT user_id IS NULL AND created_by IS NULL FROM public.remote_instances
      WHERE id = '${uuid(90)}';`)).toBe("t")
  })

  it("keeps unrelated restrictive WITH CHECK guards effective on authorized inserts and updates", () => {
    expect(() => as(ids.member, `INSERT INTO public.remote_instances (id, site_id, blocked)
      VALUES ('${uuid(90)}', '${ids.site}', true);`)).toThrow(/row-level security/)
    expect(() => as(ids.member, `UPDATE public.remote_instances SET blocked = true
      WHERE id = '${ids.own}';`)).toThrow(/row-level security/)
    expect(db(`SELECT blocked FROM public.remote_instances WHERE id = '${ids.own}';`)).toBe("f")
  })

  it("does not widen pre-existing child grants when migration is replayed", () => {
    db("REVOKE INSERT, UPDATE, DELETE ON public.instance_logs FROM authenticated;")
    db(migration())
    expect(as(ids.member, `SELECT id FROM public.instance_logs WHERE id = '${uuid(100)}';`)).toBe(uuid(100))
    for (const sql of [
      `INSERT INTO public.instance_logs (id, site_id, instance_id)
        VALUES ('${uuid(110)}', '${ids.site}', '${ids.own}');`,
      `UPDATE public.instance_logs SET payload = 'forged' WHERE id = '${uuid(100)}';`,
      `DELETE FROM public.instance_logs WHERE id = '${uuid(100)}';`,
    ]) expect(() => as(ids.member, sql)).toThrow(/permission denied/)
  })

  const exerciseChild = (table: string) => {
    const standalone = ["assets", "cloud_files", "cloud_file_operations", "requirement_status",
      "remote_sessions", "automation_auth_sessions", "site_secrets"].includes(table)
    expect(as(ids.member, `SELECT id FROM public.${table} ORDER BY id;`))
      .toBe([uuid(100), uuid(101), ...(standalone ? [uuid(105)] : [])].join("\n"))
    expect(as(null, `SELECT id FROM public.${table} WHERE instance_id IS NOT NULL;`, "anon")).toBe("")
    for (const id of [102, 103, 104, 106, 107]) {
      expect(as(ids.member, `SELECT id FROM public.${table} WHERE id = '${uuid(id)}';`)).toBe("")
      expect(as(ids.member, `UPDATE public.${table} SET payload = 'forged'
        WHERE id = '${uuid(id)}' RETURNING id;`)).toBe("")
      expect(as(ids.member, `DELETE FROM public.${table} WHERE id = '${uuid(id)}' RETURNING id;`)).toBe("")
    }
    for (const [site, parent] of [
      [ids.site, ids.hidden], [ids.site, ids.crossSite], [ids.otherSite, ids.own],
      [ids.site, uuid(999)], [ids.site, ids.blocked],
    ]) {
      expect(() => as(ids.member, `INSERT INTO public.${table} (id, site_id, instance_id)
        VALUES ('${uuid(110)}', '${site}', '${parent}');`)).toThrow(/row-level security/)
      expect(() => as(ids.member, `UPDATE public.${table} SET site_id = '${site}',
        instance_id = '${parent}' WHERE id = '${uuid(100)}';`)).toThrow(/row-level security/)
    }
    expect(as(ids.member, `UPDATE public.${table} SET instance_id = '${ids.created}'
      WHERE id = '${uuid(100)}' RETURNING id;`)).toBe(uuid(100))
    if (standalone) {
      expect(() => as(ids.member, `UPDATE public.${table} SET instance_id = '${ids.hidden}'
        WHERE id = '${uuid(105)}';`)).toThrow(/row-level security/)
    } else {
      expect(() => as(ids.member, `UPDATE public.${table} SET instance_id = NULL
        WHERE id = '${uuid(100)}';`)).toThrow(/row-level security/)
      expect(() => as(ids.member, `INSERT INTO public.${table} (id, site_id, instance_id)
        VALUES ('${uuid(110)}', '${ids.site}', NULL);`)).toThrow(/row-level security/)
    }
    expect(as(ids.member, `INSERT INTO public.${table} (id, site_id, instance_id)
      VALUES ('${uuid(110)}', '${ids.site}', '${ids.own}') RETURNING id;`)).toBe(uuid(110))
    expect(as(ids.owner, `DELETE FROM public.${table} WHERE id = '${uuid(110)}' RETURNING id;`)).toBe(uuid(110))
    // Standalone nullable resources retain site-scoped access; core rows cannot detach.
    expect(as(null, `SELECT id FROM public.${table} WHERE instance_id IS NULL;`, "anon")).toBe("")
    expect(as(ids.member, `UPDATE public.${table} SET payload = 'allowed'
      WHERE id = '${uuid(105)}' RETURNING id;`)).toBe(standalone ? uuid(105) : "")
    expect(as(ids.member, `DELETE FROM public.${table} WHERE id = '${uuid(105)}' RETURNING id;`)).toBe("")
    expect(as(ids.owner, `DELETE FROM public.${table} WHERE id = '${uuid(105)}' RETURNING id;`))
      .toBe(standalone ? uuid(105) : "")
    expect(as(null, `SELECT count(*) FROM public.${table};`, "service_role")).toBe(standalone ? "7" : "8")
  }

  it.each(coreChildren)("guards %s reads and mutations against invisible/mismatched parents", exerciseChild)

  it.each(optionalChildren)("guards optional %s when installed and replayed", table => {
    db(childSchema([table]) + childSeed(table))
    db(migration())
    exerciseChild(table)
  })

  it("guards optional catalog requirement links as non-detachable instance children", () => {
    db(childSchema(["catalog_item_requirements"]) + childSeed("catalog_item_requirements"))
    db(migration())
    exerciseChild("catalog_item_requirements")
  })

  it("guards optional infrastructure events through a visible plan", () => {
    db(`CREATE TABLE public.instance_plan_step_infrastructure_events (
      id uuid PRIMARY KEY, plan_id uuid, blocked boolean NOT NULL DEFAULT false);
      ${legacyPolicies("instance_plan_step_infrastructure_events")}
      INSERT INTO public.instance_plan_step_infrastructure_events (id, plan_id) VALUES
        ('${uuid(200)}', '${uuid(100)}'), ('${uuid(201)}', '${uuid(102)}'),
        ('${uuid(202)}', '${uuid(104)}'), ('${uuid(203)}', NULL);`)
    db(migration())
    expect(as(ids.member, "SELECT id FROM public.instance_plan_step_infrastructure_events ORDER BY id;"))
      .toBe(uuid(200))
    for (const plan of [uuid(102), uuid(104), uuid(999)]) {
      expect(() => as(ids.member, `UPDATE public.instance_plan_step_infrastructure_events
        SET plan_id = '${plan}' WHERE id = '${uuid(200)}';`)).toThrow(/row-level security/)
      expect(() => as(ids.member, `INSERT INTO public.instance_plan_step_infrastructure_events (id, plan_id)
        VALUES ('${uuid(210)}', '${plan}');`)).toThrow(/row-level security/)
    }
    expect(() => as(ids.member, `UPDATE public.instance_plan_step_infrastructure_events
      SET plan_id = NULL WHERE id = '${uuid(200)}';`)).toThrow(/row-level security/)
    expect(as(ids.member, `UPDATE public.instance_plan_step_infrastructure_events SET plan_id = '${uuid(101)}'
      WHERE id = '${uuid(200)}' RETURNING id;`)).toBe(uuid(200))
    expect(as(ids.member, "DELETE FROM public.instance_plan_step_infrastructure_events RETURNING id;")).toBe("")
    expect(as(ids.owner, `DELETE FROM public.instance_plan_step_infrastructure_events
      WHERE id = '${uuid(200)}' RETURNING id;`)).toBe(uuid(200))
  })

  it("revokes non-RLS table privileges rather than trusting permissive historical grants", () => {
    const tables = ["remote_instances", ...coreChildren]
    db(tables.map(table => `GRANT TRUNCATE, REFERENCES, TRIGGER ON public.${table}
      TO PUBLIC, authenticated, anon;`).join("\n"))
    db(migration())
    for (const table of tables) {
      for (const role of ["authenticated", "anon"]) {
        for (const privilege of ["TRUNCATE", "REFERENCES", "TRIGGER"]) {
          expect(db(`SELECT has_table_privilege('${role}', 'public.${table}', '${privilege}');`)).toBe("f")
        }
      }
      expect(() => as(ids.owner, `TRUNCATE public.${table};`)).toThrow(/permission denied/)
    }
  })

  it("fails closed on null-site standalone resources without relying on NOT NULL constraints", () => {
    db(childSchema(["assets"]) + `ALTER TABLE public.assets ALTER COLUMN site_id DROP NOT NULL;
      INSERT INTO public.assets (id, site_id, instance_id) VALUES ('${uuid(120)}', NULL, NULL);`)
    db(migration())
    expect(as(ids.member, "SELECT id FROM public.assets;")).toBe("")
    expect(() => as(ids.member, `INSERT INTO public.assets (id, site_id, instance_id)
      VALUES ('${uuid(121)}', NULL, NULL);`)).toThrow(/row-level security/)
    expect(as(ids.owner, `DELETE FROM public.assets WHERE id = '${uuid(120)}' RETURNING id;`)).toBe("")
  })

  it("re-evaluates child visibility after a privileged parent ownership/site update", () => {
    as(null, `UPDATE public.remote_instances SET user_id = '${ids.owner}', created_by = '${ids.owner}'
      WHERE id = '${ids.own}';`, "service_role")
    for (const table of coreChildren) {
      expect(as(ids.member, `SELECT id FROM public.${table} WHERE id = '${uuid(100)}';`)).toBe("")
    }
    as(null, `UPDATE public.remote_instances SET site_id = '${ids.otherSite}'
      WHERE id = '${ids.created}';`, "service_role")
    for (const table of coreChildren) {
      expect(as(ids.owner, `SELECT id FROM public.${table} WHERE id = '${uuid(101)}';`)).toBe("")
      expect(as(ids.member, `UPDATE public.${table} SET payload = 'forged'
        WHERE id = '${uuid(101)}' RETURNING id;`)).toBe("")
    }
  })

  it("guards both optional node-context endpoints through same-site visible nodes", () => {
    db(`CREATE TABLE public.instance_node_contexts (
      id uuid PRIMARY KEY, site_id uuid NOT NULL, target_node_id uuid, context_node_id uuid,
      payload text DEFAULT 'original', blocked boolean NOT NULL DEFAULT false);
      ${legacyPolicies("instance_node_contexts")}
      INSERT INTO public.instance_node_contexts (id, site_id, target_node_id, context_node_id) VALUES
        ('${uuid(200)}', '${ids.site}', '${uuid(100)}', '${uuid(101)}'),
        ('${uuid(201)}', '${ids.site}', '${uuid(102)}', '${uuid(100)}'),
        ('${uuid(202)}', '${ids.site}', '${uuid(100)}', '${uuid(102)}'),
        ('${uuid(203)}', '${ids.otherSite}', '${uuid(100)}', '${uuid(101)}');`)
    db(migration())
    expect(as(ids.member, "SELECT id FROM public.instance_node_contexts ORDER BY id;")).toBe(uuid(200))
    for (const endpoint of ["target_node_id", "context_node_id"]) {
      for (const node of [uuid(102), uuid(103), uuid(104), uuid(106), uuid(999)]) {
        expect(() => as(ids.member, `UPDATE public.instance_node_contexts SET ${endpoint} = '${node}'
          WHERE id = '${uuid(200)}';`)).toThrow(/row-level security/)
        const target = endpoint === "target_node_id" ? node : uuid(100)
        const context = endpoint === "context_node_id" ? node : uuid(101)
        expect(() => as(ids.member, `INSERT INTO public.instance_node_contexts
          (id, site_id, target_node_id, context_node_id)
          VALUES ('${uuid(210)}', '${ids.site}', '${target}', '${context}');`)).toThrow(/row-level security/)
      }
    }
    expect(() => as(ids.member, `UPDATE public.instance_node_contexts SET site_id = '${ids.otherSite}'
      WHERE id = '${uuid(200)}';`)).toThrow(/row-level security/)
    expect(as(ids.member, `UPDATE public.instance_node_contexts SET payload = 'allowed'
      WHERE id = '${uuid(200)}' RETURNING id;`)).toBe(uuid(200))
    for (const id of [201, 202, 203]) {
      expect(as(ids.member, `SELECT id FROM public.instance_node_contexts WHERE id = '${uuid(id)}';`)).toBe("")
      expect(as(ids.member, `DELETE FROM public.instance_node_contexts WHERE id = '${uuid(id)}' RETURNING id;`)).toBe("")
    }
    expect(as(ids.owner, `DELETE FROM public.instance_node_contexts WHERE id = '${uuid(200)}' RETURNING id;`))
      .toBe(uuid(200))
  })

  it("replays without replacing legacy permissive policies or restrictive guards", () => {
    const before = policySnapshot()
    db(migration())
    expect(policySnapshot()).toBe(before)
    for (const table of ["remote_instances", ...coreChildren]) {
      expect(db(`SELECT policyname || ':' || permissive FROM pg_policies
        WHERE tablename = '${table}' AND policyname IN ('legacy_allow', 'legacy_guard') ORDER BY policyname;`))
        .toBe("legacy_allow:PERMISSIVE\nlegacy_guard:RESTRICTIVE")
      expect(db(`SELECT cmd FROM pg_policies WHERE tablename = '${table}'
        AND permissive = 'RESTRICTIVE' AND policyname <> 'legacy_guard'
        AND roles @> ARRAY['authenticated']::name[] ORDER BY cmd;`))
        .toBe("DELETE\nINSERT\nSELECT\nUPDATE")
    }
    expect(list(ids.member)).toEqual([ids.own, ids.created])
  })
})