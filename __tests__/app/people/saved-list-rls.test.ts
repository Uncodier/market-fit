/** @jest-environment node */
import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import path from "node:path"

const pgBin = process.env.SAVED_LIST_TEST_PG_BIN || "/opt/homebrew/opt/postgresql@17/bin"
const available = ["initdb", "pg_ctl", "psql"].every(file => existsSync(path.join(pgBin, file)))
const suite = available ? describe : describe.skip
const pgEnv = { ...process.env, LC_ALL: "C", LANG: "C" }
const migration = () => readFileSync(path.resolve(__dirname,
  "../../../supabase/migrations/20261117120000_finder_saved_list_site_read.sql"), "utf8")
const uuid = (id: number) => `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`
const owner = uuid(1)
const collaborator = uuid(2)
const inactive = uuid(3)
const suspended = uuid(4)
const outsider = uuid(5)
const restricted = uuid(6)
const unknownLocation = uuid(7)
const foreignOwner = uuid(8)
const site = uuid(10)
const foreignSite = uuid(11)
const sharedQuery = uuid(20)
const unsegmentedQuery = uuid(21)
const legacyPolicy = "icp_mining - authenticated can select in site"
const sitePolicy = "icp_mining - authenticated can select by site"
const boundaryPolicy = "icp_mining - authenticated select site boundary"

suite("Finder saved-list RLS in disposable PostgreSQL", () => {
  let directory = ""
  const db = (sql: string) => execFileSync(path.join(pgBin, "psql"), [
    "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-h", directory,
    "-p", "55447", "-U", "postgres", "-d", "postgres",
  ], { input: sql, encoding: "utf8", stdio: "pipe", timeout: 20000, env: pgEnv }).trim()
  const actor = (user: string | null, sql: string, role = "authenticated") => db(`
    SET ROLE ${role};
    SET request.jwt.claim.sub = '${user || ""}';
    ${sql}
  `)
  const visible = (user: string | null, role = "authenticated") => JSON.parse(actor(user, `
    SELECT coalesce(json_agg(id ORDER BY id), '[]'::json) FROM public.icp_mining;
  `, role))
  const policies = () => JSON.parse(db(`
    SELECT coalesce(json_agg(p ORDER BY policyname), '[]'::json)
    FROM pg_policies p WHERE schemaname = 'public' AND tablename = 'icp_mining';
  `)) as Array<{ policyname: string; permissive: string; roles: string[]; cmd: string; qual: string; with_check: string | null }>
  const preservedPolicies = () => policies().filter(p =>
    ![legacyPolicy, sitePolicy, boundaryPolicy].includes(p.policyname))

  beforeAll(() => {
    // Socket-only disposable cluster: never use DATABASE_URL or a remote project.
    directory = mkdtempSync("/tmp/saved-list-pg-")
    execFileSync(path.join(pgBin, "initdb"), [
      "-D", path.join(directory, "data"), "-U", "postgres", "-A", "trust", "--no-locale",
    ], { stdio: "pipe", env: pgEnv, timeout: 20000 })
    execFileSync(path.join(pgBin, "pg_ctl"), [
      "-D", path.join(directory, "data"), "-l", path.join(directory, "server.log"),
      "-o", `-F -p 55447 -k ${directory} -c listen_addresses='' -c lc_messages=C`, "-w", "start",
    ], { stdio: "pipe", env: pgEnv, timeout: 20000 })
    db("CREATE ROLE authenticated; CREATE ROLE anon;")
  }, 30000)

  afterAll(() => {
    if (!directory) return
    if (existsSync(path.join(directory, "data/postmaster.pid"))) {
      execFileSync(path.join(pgBin, "pg_ctl"), [
        "-D", path.join(directory, "data"), "-m", "fast", "-w", "stop",
      ], { stdio: "pipe", env: pgEnv, timeout: 20000 })
    }
    rmSync(directory, { recursive: true, force: true })
  }, 30000)

  beforeEach(() => {
    // Minimal pre-migration schema; authorization stubs derive access from fixture members.
    db(`
      DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS auth CASCADE;
      CREATE SCHEMA public; CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
      CREATE TABLE public.site_members (
        site_id uuid, user_id uuid, role text, status text, location_restricted boolean,
        PRIMARY KEY (site_id, user_id)
      );
      INSERT INTO public.site_members VALUES
        ('${site}', '${owner}', 'owner', 'active', false),
        ('${site}', '${collaborator}', 'collaborator', 'active', false),
        ('${site}', '${inactive}', 'collaborator', 'inactive', false),
        ('${site}', '${suspended}', 'collaborator', 'suspended', false),
        ('${site}', '${restricted}', 'collaborator', 'active', true),
        ('${site}', '${unknownLocation}', 'collaborator', 'active', NULL),
        ('${foreignSite}', '${foreignOwner}', 'owner', 'active', false);
      CREATE FUNCTION public.user_can(p_site uuid, p_action text) RETURNS boolean
      LANGUAGE sql STABLE AS $$
        SELECT EXISTS (SELECT 1 FROM public.site_members m
          WHERE m.site_id = p_site AND m.user_id = auth.uid() AND m.status = 'active'
            AND (p_action = 'select' OR
              (p_action IN ('insert', 'update', 'delete') AND m.role = 'owner')));
      $$;
      CREATE FUNCTION public.current_user_has_site_location_restrictions(p_site uuid)
      RETURNS boolean LANGUAGE sql STABLE AS $$
        SELECT CASE WHEN EXISTS (SELECT 1 FROM public.site_members m
          WHERE m.site_id = p_site AND m.user_id = auth.uid() AND m.status = 'active')
        THEN (SELECT m.location_restricted FROM public.site_members m
          WHERE m.site_id = p_site AND m.user_id = auth.uid()) ELSE true END;
      $$;
      CREATE FUNCTION public.current_user_has_location_restrictions()
      RETURNS boolean LANGUAGE sql STABLE AS $$
        SELECT EXISTS (SELECT 1 FROM public.site_members m
          WHERE m.user_id = auth.uid() AND m.location_restricted IS TRUE);
      $$;
      CREATE TABLE public.query_segments (query_id uuid, site_id uuid);
      CREATE TABLE public.icp_mining (id text PRIMARY KEY, site_id uuid, query_id uuid, name text);
      INSERT INTO public.query_segments VALUES ('${sharedQuery}', '${site}');
      INSERT INTO public.icp_mining VALUES
        ('own-unsegmented', '${site}', '${unsegmentedQuery}', 'Unsegmented list'),
        ('own-segmented', '${site}', '${sharedQuery}', 'Segmented list'),
        ('foreign-shared', '${foreignSite}', '${sharedQuery}', 'Foreign list sharing query'),
        ('null-site', NULL, '${sharedQuery}', 'Missing site');
      GRANT USAGE ON SCHEMA public, auth TO authenticated, anon;
      GRANT SELECT ON public.site_members, public.query_segments TO authenticated, anon;
      GRANT SELECT, INSERT, UPDATE, DELETE ON public.icp_mining TO authenticated, anon;
      ALTER TABLE public.icp_mining ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "${legacyPolicy}" ON public.icp_mining FOR SELECT TO authenticated
        USING (EXISTS (SELECT 1 FROM public.query_segments s
          WHERE s.query_id = icp_mining.query_id AND public.user_can(s.site_id, 'select')));
      CREATE POLICY "icp_mining - authenticated can insert" ON public.icp_mining
        FOR INSERT TO authenticated WITH CHECK (public.user_can(site_id, 'insert'));
      CREATE POLICY "icp_mining - authenticated can update" ON public.icp_mining
        FOR UPDATE TO authenticated USING (public.user_can(site_id, 'update'))
        WITH CHECK (public.user_can(site_id, 'update'));
      CREATE POLICY "icp_mining - authenticated can delete" ON public.icp_mining
        FOR DELETE TO authenticated USING (public.user_can(site_id, 'delete'));
      CREATE POLICY location_acl_unscoped ON public.icp_mining AS RESTRICTIVE
        FOR ALL TO authenticated USING (NOT public.current_user_has_location_restrictions())
        WITH CHECK (NOT public.current_user_has_location_restrictions());
      CREATE POLICY location_acl_anon ON public.icp_mining AS RESTRICTIVE
        FOR ALL TO anon USING (false) WITH CHECK (false);
    `)
  })

  it.each([["owner", owner], ["collaborator", collaborator]])(
    "makes unsegmented saved lists visible to an authorized %s without cross-site leaks", (_, user) => {
      expect(visible(user)).toEqual(["foreign-shared", "null-site", "own-segmented"])
      db(migration())
      expect(visible(user)).toEqual(["own-segmented", "own-unsegmented"])
      expect(actor(user, `SELECT count(*) FROM public.icp_mining WHERE site_id = '${site}'`)).toBe("2")
      expect(actor(user, `SELECT count(*) FROM public.icp_mining WHERE site_id = '${foreignSite}'`)).toBe("0")
      expect(visible(foreignOwner)).toEqual(["foreign-shared"])
    })

  it("enforces the site boundary even when a remaining legacy permissive policy grants every row", () => {
    db(`CREATE POLICY legacy_broad_select ON public.icp_mining FOR SELECT TO authenticated USING (true);`)
    expect(visible(owner)).toHaveLength(4)
    db(migration())
    expect(visible(owner)).toEqual(["own-segmented", "own-unsegmented"])
    expect(visible(collaborator)).toEqual(["own-segmented", "own-unsegmented"])
    expect(visible(foreignOwner)).toEqual(["foreign-shared"])
    expect(policies().find(p => p.policyname === "legacy_broad_select")?.qual).toBe("true")
  })

  it.each([
    ["inactive", inactive], ["suspended", suspended], ["outsider", outsider],
    ["missing authenticated identity", null], ["location-restricted member", restricted],
    ["unknown location restriction", unknownLocation],
  ])("denies %s even with a broad authenticated SELECT grant", (_, user) => {
    // Isolate the new per-site predicate from the pre-existing global location guard.
    db(`DROP POLICY location_acl_unscoped ON public.icp_mining;
      CREATE POLICY legacy_broad_select ON public.icp_mining FOR SELECT TO authenticated USING (true);`)
    db(migration())
    expect(visible(user)).toEqual([])
  })

  it("preserves anonymous denial even with a broad anonymous SELECT grant", () => {
    db(`CREATE POLICY legacy_anon_select ON public.icp_mining FOR SELECT TO anon USING (true);`)
    db(migration())
    expect(visible(null, "anon")).toEqual([])
  })

  it("retains the existing global location guard even when the new per-site predicate allows access", () => {
    db(`INSERT INTO public.site_members VALUES
      ('${foreignSite}', '${owner}', 'collaborator', 'active', true);`)
    db(migration())
    expect(actor(owner, `SELECT public.user_can('${site}', 'select') AND
      public.current_user_has_site_location_restrictions('${site}') IS NOT DISTINCT FROM false;`)).toBe("t")
    expect(visible(owner)).toEqual([])
    expect(() => actor(owner, `INSERT INTO public.icp_mining (id, site_id) VALUES ('location-denied', '${site}');`))
      .toThrow("row-level security")
  })

  it("creates matching authenticated permissive and restrictive SELECT predicates and is repeat-safe", () => {
    const untouched = preservedPolicies()
    db(migration())
    const first = policies()
    expect(first.some(p => p.policyname === legacyPolicy)).toBe(false)
    const permissive = first.find(p => p.policyname === sitePolicy)!
    const restrictive = first.find(p => p.policyname === boundaryPolicy)!
    expect(permissive).toMatchObject({ permissive: "PERMISSIVE", roles: ["authenticated"], cmd: "SELECT", with_check: null })
    expect(restrictive).toMatchObject({ permissive: "RESTRICTIVE", roles: ["authenticated"], cmd: "SELECT", with_check: null })
    expect(restrictive.qual).toBe(permissive.qual)
    expect(permissive.qual).toContain("site_id IS NOT NULL")
    expect(permissive.qual).toContain("user_can(site_id, 'select'::text)")
    // PostgreSQL deparses IS NOT DISTINCT FROM as NOT (... IS DISTINCT FROM ...).
    expect(permissive.qual).toContain("NOT (current_user_has_site_location_restrictions(site_id) IS DISTINCT FROM false)")
    expect(preservedPolicies()).toEqual(untouched)
    db(migration())
    expect(policies()).toEqual(first)
    expect(visible(owner)).toEqual(["own-segmented", "own-unsegmented"])
    expect(db("SELECT relrowsecurity FROM pg_class WHERE oid = 'public.icp_mining'::regclass")).toBe("t")
  })

  it("preserves write and location policies, allowing owner writes but not collaborator or foreign writes", () => {
    const untouched = preservedPolicies()
    db(migration())
    expect(preservedPolicies()).toEqual(untouched)
    actor(owner, `INSERT INTO public.icp_mining VALUES ('new-list', '${site}', '${unsegmentedQuery}', 'Created');`)
    actor(owner, "UPDATE public.icp_mining SET name = 'Updated' WHERE id = 'new-list';")
    expect(db("SELECT name FROM public.icp_mining WHERE id = 'new-list'")).toBe("Updated")
    actor(collaborator, "UPDATE public.icp_mining SET name = 'Forbidden' WHERE id = 'new-list';")
    actor(collaborator, "DELETE FROM public.icp_mining WHERE id = 'new-list';")
    expect(db("SELECT name FROM public.icp_mining WHERE id = 'new-list'")).toBe("Updated")
    for (const user of [collaborator, inactive, suspended, outsider, restricted]) {
      expect(() => actor(user, `INSERT INTO public.icp_mining (id, site_id) VALUES ('denied', '${site}');`))
        .toThrow("row-level security")
    }
    expect(() => actor(owner, `INSERT INTO public.icp_mining (id, site_id) VALUES ('foreign-write', '${foreignSite}');`))
      .toThrow("row-level security")
    expect(() => actor(owner, `UPDATE public.icp_mining SET site_id = '${foreignSite}' WHERE id = 'new-list';`))
      .toThrow("row-level security")
    actor(owner, "UPDATE public.icp_mining SET name = 'Forbidden' WHERE id = 'foreign-shared';")
    actor(owner, "DELETE FROM public.icp_mining WHERE id = 'foreign-shared';")
    expect(db("SELECT name FROM public.icp_mining WHERE id = 'foreign-shared'")).toBe("Foreign list sharing query")
    actor(owner, "DELETE FROM public.icp_mining WHERE id = 'new-list';")
    expect(db("SELECT count(*) FROM public.icp_mining WHERE id = 'new-list'")).toBe("0")
  })
})