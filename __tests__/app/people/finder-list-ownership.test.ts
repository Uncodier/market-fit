/** @jest-environment node */
import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import path from "node:path"

const pgBin = process.env.SAVED_LIST_TEST_PG_BIN || "/opt/homebrew/opt/postgresql@17/bin"
const available = ["initdb", "pg_ctl", "psql"].every(file => existsSync(path.join(pgBin, file)))
const suite = available ? describe : describe.skip
const pgEnv = { ...process.env, LC_ALL: "C", LANG: "C" }
const migration = (name: string) => readFileSync(path.resolve(__dirname,
  `../../../supabase/migrations/${name}.sql`), "utf8")
const uuid = (id: number) => `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`
const owner = uuid(1)
const coowner = uuid(2)
const carlos = uuid(3)
const member = uuid(4)
const suspended = uuid(5)
const inactive = uuid(6)
const unlicensed = uuid(7)
const outsider = uuid(8)
const locationRestricted = uuid(9)
const site = uuid(10)
const foreignSite = uuid(11)
const sharedQuery = uuid(20)
const unsegmentedQuery = uuid(21)
const siteRows = ["carlos-own", "historical", "member-own"]

suite("Finder list ownership in disposable PostgreSQL 17", () => {
  let directory = ""
  let historicalBefore = ""
  const db = (sql: string) => execFileSync(path.join(pgBin, "psql"), [
    "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-h", directory,
    "-p", "55448", "-U", "postgres", "-d", "postgres",
  ], { input: sql, encoding: "utf8", stdio: "pipe", timeout: 20000, env: pgEnv }).trim()
  const actor = (user: string | null, sql: string, role = "authenticated") => db(`
    SET ROLE ${role}; SET request.jwt.claim.sub = '${user || ""}'; ${sql}
  `)
  const visible = (user: string | null, role = "authenticated") => JSON.parse(actor(user, `
    SELECT coalesce(json_agg(id ORDER BY id), '[]'::json) FROM public.icp_mining;
  `, role))
  const insert = (id: string, targetSite = site, attribution = "") => `
    INSERT INTO public.icp_mining (id, site_id, query_id${attribution ? ", user_id" : ""})
    VALUES ('${id}', '${targetSite}', '${unsegmentedQuery}'${attribution ? `, ${attribution}` : ""});
  `
  const historical = () => db(`SELECT row_to_json(t) FROM (
    SELECT id, site_id, query_id, name, created_at FROM public.icp_mining WHERE id = 'historical'
  ) t;`)

  beforeAll(() => {
    // Socket-only disposable cluster: never use DATABASE_URL or a remote project.
    directory = mkdtempSync("/tmp/finder-ownership-pg-")
    execFileSync(path.join(pgBin, "initdb"), [
      "-D", path.join(directory, "data"), "-U", "postgres", "-A", "trust", "--no-locale",
    ], { stdio: "pipe", env: pgEnv, timeout: 20000 })
    execFileSync(path.join(pgBin, "pg_ctl"), [
      "-D", path.join(directory, "data"), "-l", path.join(directory, "server.log"),
      "-o", `-F -p 55448 -k ${directory} -c listen_addresses='' -c lc_messages=C`, "-w", "start",
    ], { stdio: "pipe", env: pgEnv, timeout: 20000 })
    db("CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;")
  }, 30000)

  afterAll(() => {
    if (!directory) return
    try {
      if (existsSync(path.join(directory, "data/postmaster.pid"))) {
        execFileSync(path.join(pgBin, "pg_ctl"), [
          "-D", path.join(directory, "data"), "-m", "fast", "-w", "stop",
        ], { stdio: "pipe", env: pgEnv, timeout: 20000 })
      }
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  }, 30000)

  beforeEach(() => {
    // Minimal pre-migration schema; user_can models licensed, action-specific site access.
    // Assigned-only ownership is distinct from the existing location restriction guards.
    db(`
      DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS auth CASCADE;
      CREATE SCHEMA public; CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY);
      INSERT INTO auth.users SELECT ('00000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid
        FROM generate_series(1, 9) i;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
      CREATE TABLE public.sites (id uuid PRIMARY KEY, user_id uuid REFERENCES auth.users);
      CREATE TABLE public.site_ownership (site_id uuid, user_id uuid);
      CREATE TABLE public.site_members (
        site_id uuid, user_id uuid, status text, restrict_to_assigned_only boolean,
        license_active boolean, location_restricted boolean, actions text[],
        PRIMARY KEY (site_id, user_id)
      );
      INSERT INTO public.sites VALUES ('${site}', '${owner}'), ('${foreignSite}', '${outsider}');
      INSERT INTO public.site_ownership VALUES ('${site}', '${coowner}');
      INSERT INTO public.site_members VALUES
        ('${site}', '${carlos}', 'active', true, true, false, ARRAY['select','insert','update','delete']),
        ('${site}', '${member}', 'active', false, true, false, ARRAY['select','insert','update','delete']),
        ('${site}', '${suspended}', 'suspended', true, true, false, ARRAY['select','insert','update','delete']),
        ('${site}', '${inactive}', 'inactive', false, true, false, ARRAY['select','insert','update','delete']),
        ('${site}', '${unlicensed}', 'active', false, false, false, ARRAY['select','insert','update','delete']),
        ('${site}', '${locationRestricted}', 'active', false, true, true, ARRAY['select','insert','update','delete']);
      CREATE FUNCTION public.user_can(p_site uuid, p_action text) RETURNS boolean
      LANGUAGE sql STABLE AS $$
        SELECT p_action IN ('select','insert','update','delete') AND (
          EXISTS (SELECT 1 FROM public.sites WHERE id = p_site AND user_id = auth.uid())
          OR EXISTS (SELECT 1 FROM public.site_ownership WHERE site_id = p_site AND user_id = auth.uid())
          OR EXISTS (SELECT 1 FROM public.site_members WHERE site_id = p_site AND user_id = auth.uid()
            AND status = 'active' AND license_active AND p_action = ANY(actions))
        );
      $$;
      CREATE FUNCTION public.current_user_has_site_location_restrictions(p_site uuid)
      RETURNS boolean LANGUAGE sql STABLE AS $$
        SELECT coalesce((SELECT location_restricted FROM public.site_members
          WHERE site_id = p_site AND user_id = auth.uid()), false);
      $$;
      CREATE FUNCTION public.current_user_has_location_restrictions()
      RETURNS boolean LANGUAGE sql STABLE AS $$
        SELECT EXISTS (SELECT 1 FROM public.site_members
          WHERE user_id = auth.uid() AND location_restricted IS TRUE);
      $$;
      CREATE TABLE public.query_segments (query_id uuid, site_id uuid);
      CREATE TABLE public.icp_mining (
        id text PRIMARY KEY, site_id uuid, query_id uuid, name text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      INSERT INTO public.query_segments VALUES ('${sharedQuery}', '${site}');
      INSERT INTO public.icp_mining VALUES
        ('historical', '${site}', '${sharedQuery}', 'Original historical list', '2025-01-02T03:04:05Z');
      GRANT USAGE ON SCHEMA public, auth TO authenticated, anon, service_role;
      GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated, anon;
      GRANT ALL ON public.icp_mining TO authenticated, anon, service_role;
      ALTER TABLE public.icp_mining ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "icp_mining - authenticated can select in site" ON public.icp_mining
        FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.query_segments s
          WHERE s.query_id = icp_mining.query_id AND public.user_can(s.site_id, 'select')));
      CREATE POLICY existing_broad_select ON public.icp_mining FOR SELECT TO authenticated USING (true);
      CREATE POLICY existing_anon_access ON public.icp_mining FOR ALL TO anon USING (true) WITH CHECK (true);
      CREATE POLICY existing_segment_insert ON public.icp_mining FOR INSERT TO authenticated
        WITH CHECK (EXISTS (SELECT 1 FROM public.query_segments s
          WHERE s.query_id = icp_mining.query_id AND public.user_can(s.site_id, 'insert')));
      CREATE POLICY existing_update ON public.icp_mining FOR UPDATE TO authenticated
        USING (public.user_can(site_id, 'update')) WITH CHECK (public.user_can(site_id, 'update'));
      CREATE POLICY existing_delete ON public.icp_mining FOR DELETE TO authenticated
        USING (public.user_can(site_id, 'delete'));
      CREATE POLICY location_acl_unscoped ON public.icp_mining AS RESTRICTIVE FOR ALL TO authenticated
        USING (NOT public.current_user_has_location_restrictions())
        WITH CHECK (NOT public.current_user_has_location_restrictions());
    `)
    historicalBefore = historical()
    db(migration("20261117120000_finder_saved_list_site_read"))
    db(migration("20261117203000_finder_list_ownership"))
    db(`INSERT INTO public.icp_mining (id, site_id, query_id, name, user_id) VALUES
      ('carlos-own', '${site}', '${unsegmentedQuery}', 'Carlos list', '${carlos}'),
      ('member-own', '${site}', '${sharedQuery}', 'Member list', '${member}'),
      ('foreign-shared', '${foreignSite}', '${sharedQuery}', 'Foreign list', '${carlos}'),
      ('null-site', NULL, '${sharedQuery}', 'No site', '${carlos}');`)
  })

  it("restricts Carlos to his own list, excluding another member, null owners and cross-site shared queries", () => {
    expect(visible(carlos)).toEqual(["carlos-own"])
    expect(actor(carlos, `SELECT public.finder_list_row_access('${site}', NULL);`)).toBe("f")
    expect(db(`SELECT count(*) FROM pg_policies WHERE tablename = 'icp_mining'
      AND policyname = 'existing_broad_select' AND qual = 'true';`)).toBe("1")
    expect(visible(outsider)).toEqual(["foreign-shared"])
  })

  it.each([["owner", owner], ["co-owner", coowner], ["unrestricted licensed member", member]])(
    "preserves site-wide read/write compatibility for the %s", (_, user) => {
      expect(visible(user)).toEqual(siteRows)
      actor(user, "UPDATE public.icp_mining SET name = 'Compatible' WHERE id = 'carlos-own';")
      expect(db("SELECT name FROM public.icp_mining WHERE id = 'carlos-own'")).toBe("Compatible")
      actor(user, "DELETE FROM public.icp_mining WHERE id = 'member-own';")
      expect(visible(user)).toEqual(["carlos-own", "historical"])
    })

  it.each([["suspended", suspended], ["inactive", inactive], ["unlicensed", unlicensed],
    ["cross-site", outsider], ["location-restricted", locationRestricted]])(
    "denies %s actors all access to this site's lists", (_, user) => {
      expect(actor(user, `SELECT count(*) FROM public.icp_mining WHERE site_id = '${site}';`)).toBe("0")
      expect(() => actor(user, insert("denied"))).toThrow("row-level security")
      actor(user, "UPDATE public.icp_mining SET name = 'Forbidden' WHERE id = 'carlos-own';")
      actor(user, "DELETE FROM public.icp_mining WHERE id = 'carlos-own';")
      expect(db("SELECT name FROM public.icp_mining WHERE id = 'carlos-own'")).toBe("Carlos list")
    })

  it("defaults attribution to the actor and accepts explicit self or null attribution on unsegmented inserts", () => {
    actor(carlos, insert("default-actor"))
    actor(carlos, insert("explicit-self", site, `'${carlos}'`))
    actor(carlos, insert("explicit-null", site, "NULL"))
    expect(db(`SELECT count(*) FROM public.icp_mining WHERE id IN
      ('default-actor','explicit-self','explicit-null') AND user_id = '${carlos}';`)).toBe("3")
    expect(actor(carlos, `SELECT count(*) FROM public.query_segments WHERE query_id = '${unsegmentedQuery}';`)).toBe("0")
    expect(visible(carlos)).toEqual(["carlos-own", "default-actor", "explicit-null", "explicit-self"])
    expect(() => actor(carlos, insert("foreign-site", foreignSite))).toThrow("row-level security")
  })

  it.each([["restricted", carlos], ["unrestricted", member], ["owner", owner]])(
    "rejects forged attribution from the %s actor", (_, user) => {
      expect(() => actor(user, insert("forged", site, `'${coowner}'`))).toThrow("must match the actor")
      expect(db("SELECT count(*) FROM public.icp_mining WHERE id = 'forged'")).toBe("0")
    })

  it("makes site/user attribution immutable even for an owner authorized in both sites", () => {
    db(`INSERT INTO public.site_ownership VALUES ('${foreignSite}', '${owner}');`)
    for (const user of [carlos, member, owner]) {
      expect(() => actor(user, `UPDATE public.icp_mining SET site_id = '${foreignSite}'
        WHERE id = 'carlos-own';`)).toThrow("attribution is immutable")
      expect(() => actor(user, `UPDATE public.icp_mining SET user_id = '${member}'
        WHERE id = 'carlos-own';`)).toThrow("attribution is immutable")
      expect(() => actor(user, "UPDATE public.icp_mining SET user_id = NULL WHERE id = 'carlos-own';"))
        .toThrow("attribution is immutable")
    }
    expect(() => actor(owner, `UPDATE public.icp_mining SET user_id = '${owner}' WHERE id = 'historical';`))
      .toThrow("attribution is immutable")
  })

  it("allows restricted own updates/deletes but never modifies foreign-member or historical lists", () => {
    actor(carlos, "UPDATE public.icp_mining SET name = 'Updated own' WHERE id = 'carlos-own';")
    expect(db("SELECT name FROM public.icp_mining WHERE id = 'carlos-own'")).toBe("Updated own")
    actor(carlos, "UPDATE public.icp_mining SET name = 'Forbidden' WHERE id IN ('member-own','historical');")
    actor(carlos, "DELETE FROM public.icp_mining WHERE id IN ('member-own','historical','foreign-shared');")
    expect(historical()).toBe(historicalBefore)
    expect(db("SELECT name FROM public.icp_mining WHERE id = 'member-own'")).toBe("Member list")
    actor(carlos, "DELETE FROM public.icp_mining WHERE id = 'carlos-own';")
    expect(visible(carlos)).toEqual([])
  })

  it.each(["insert", "update", "delete", "select"])(
    "intersects ownership with the %s action even with a broad existing permissive policy", action => {
      db(`UPDATE public.site_members SET actions = array_remove(actions, '${action}') WHERE user_id = '${carlos}';
        CREATE POLICY broad_action ON public.icp_mining FOR ALL TO authenticated USING (true) WITH CHECK (true);`)
      if (action === "insert" || action === "select") {
        expect(() => actor(carlos, insert("action-denied"))).toThrow("row-level security")
      }
      if (action === "update" || action === "select") {
        actor(carlos, "UPDATE public.icp_mining SET name = 'Forbidden' WHERE id = 'carlos-own';")
        expect(db("SELECT name FROM public.icp_mining WHERE id = 'carlos-own'")).toBe("Carlos list")
      }
      if (action === "delete" || action === "select") {
        actor(carlos, "DELETE FROM public.icp_mining WHERE id = 'carlos-own';")
        expect(db("SELECT count(*) FROM public.icp_mining WHERE id = 'carlos-own'")).toBe("1")
      }
      if (action === "select") expect(visible(carlos)).toEqual([])
    })

  it("denies anonymous and missing-identity authenticated access despite broad anonymous grants", () => {
    for (const role of ["anon", "authenticated"]) {
      expect(visible(null, role)).toEqual([])
      expect(() => actor(null, insert("anonymous"), role)).toThrow("requires authentication")
      actor(null, "UPDATE public.icp_mining SET name = 'Forbidden'; DELETE FROM public.icp_mining;", role)
    }
    // Even a spoofed sub cannot turn the anonymous role into an authenticated reader/writer.
    expect(visible(carlos, "anon")).toEqual([])
    expect(() => actor(carlos, insert("anon-sub"), "anon")).toThrow("row-level security")
    expect(db("SELECT count(*) FROM public.icp_mining")).toBe("5")
  })

  it("revokes trigger execution and dangerous table privileges while retaining the authenticated access helper", () => {
    for (const role of ["anon", "authenticated"]) {
      expect(db(`SELECT has_function_privilege('${role}', 'public.guard_finder_list_attribution()', 'EXECUTE');`)).toBe("f")
      for (const privilege of ["TRUNCATE", "REFERENCES", "TRIGGER"]) {
        expect(db(`SELECT has_table_privilege('${role}', 'public.icp_mining', '${privilege}');`)).toBe("f")
      }
      expect(() => actor(carlos, "TRUNCATE public.icp_mining;", role)).toThrow("permission denied")
    }
    expect(db(`SELECT has_function_privilege('anon', 'public.finder_list_row_access(uuid,uuid)', 'EXECUTE');`)).toBe("f")
    expect(db(`SELECT has_function_privilege('authenticated', 'public.finder_list_row_access(uuid,uuid)', 'EXECUTE');`)).toBe("t")
    expect(db(`SELECT count(*) FROM pg_proc p, LATERAL aclexplode(p.proacl) a
      WHERE p.oid IN ('public.guard_finder_list_attribution()'::regprocedure,
        'public.finder_list_row_access(uuid,uuid)'::regprocedure) AND a.grantee = 0;`)).toBe("0")
  })

  it("leaves historical rows untouched with no inferred creator from shared queries or site ownership", () => {
    expect(historical()).toBe(historicalBefore)
    expect(db("SELECT user_id IS NULL FROM public.icp_mining WHERE id = 'historical'")).toBe("t")
    expect(visible(carlos)).not.toContain("historical")
    expect(visible(owner)).toContain("historical")
    expect(db(`SELECT column_default FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'icp_mining' AND column_name = 'user_id';`)).toBe("auth.uid()")
  })

  it("allows service-role explicit attribution while default and ignored-default null owners stay fail closed", () => {
    actor(null, insert("service-explicit", site, `'${carlos}'`), "service_role")
    actor(null, insert("service-default"), "service_role")
    actor(null, insert("service-ignore-default", site, "NULL"), "service_role")
    expect(db(`SELECT user_id FROM public.icp_mining WHERE id = 'service-explicit';`)).toBe(carlos)
    expect(db(`SELECT count(*) FROM public.icp_mining WHERE id IN
      ('service-default','service-ignore-default') AND user_id IS NULL;`)).toBe("2")
    expect(visible(carlos)).toEqual(["carlos-own", "service-explicit"])
    expect(visible(member)).toEqual([...siteRows, "service-default", "service-explicit", "service-ignore-default"])
    expect(historical()).toBe(historicalBefore)
  })
})