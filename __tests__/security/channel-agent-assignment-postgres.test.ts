/** @jest-environment node */
import { actorSql, ids, installSiteFixture, isolatedPostgres, migration, postgresAvailable, uuid } from "./isolated-postgres"

const { db, call, start, stop, concurrent } = isolatedPostgres()
const agent = uuid(50), another = uuid(51), inactive = uuid(52), otherSiteAgent = uuid(53)
const restricted = uuid(54), disabled = uuid(55), restrictedElsewhere = uuid(56)
const connections = [{ id: "sms-a", type: "sms", status: "disabled", zavu_sender_id: "same" },
  { id: "voice-a", type: "voice", zavu_sender_id: "same" }, { id: "dup" }, { id: "dup" }, { id: 42 }]
const settings = JSON.stringify({ connections, unrelated: { keep: true } })
const save = (connection: string, agentId: string | null, revision: number, site = ids.site) =>
  `SELECT public.set_channel_agent_assignment('${site}', '${connection}', ${agentId ? `'${agentId}'` : "NULL"}, ${revision})`
const table = "public.channel_agent_assignments"
const history = "public.channel_agent_assignment_history"

// Use the production helper definitions for ranked membership, restrictions and
// the site lock, without installing unrelated billing/procurement triggers.
function installFunction(file: string, name: string) {
  const sql = migration(file)
  const body = sql.match(new RegExp(`CREATE (?:OR REPLACE )?FUNCTION public\\.${name}\\([\\s\\S]+?\\$\\$;`))?.[0]
  if (!body) throw new Error(`Missing fixture function: ${name}`)
  db(body)
}

;(postgresAvailable ? describe : describe.skip)("channel assignment migration in socket-only PostgreSQL", () => {
  beforeAll(() => {
    start()
    installSiteFixture(db)
    db(`ALTER TABLE public.site_members ADD COLUMN id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
          ADD COLUMN manually_disabled boolean NOT NULL DEFAULT false, ADD COLUMN created_at timestamptz DEFAULT now();
      CREATE TABLE public.site_member_location_restrictions(site_id uuid, site_member_id uuid);
      CREATE FUNCTION public.effective_site_plan(uuid) RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'enterprise'::text $$;
      CREATE TABLE public.agents(id uuid PRIMARY KEY, site_id uuid NOT NULL REFERENCES public.sites, status text);
      CREATE TABLE public.settings(site_id uuid PRIMARY KEY REFERENCES public.sites, channels jsonb);
      GRANT SELECT ON ALL TABLES IN SCHEMA public TO postgres;
      INSERT INTO public.site_members(site_id,user_id,role,status,manually_disabled) VALUES
        ('${ids.site}','${disabled}','admin','active',true), ('${ids.site}','${restricted}','collaborator','active',false),
        ('${ids.site}','${restrictedElsewhere}','admin','active',false),
        ('${ids.otherSite}','${restrictedElsewhere}','collaborator','active',false),
        ('${ids.site}','${ids.coOwner}','collaborator','active',false);
      INSERT INTO public.site_member_location_restrictions SELECT site_id,id FROM public.site_members WHERE
        user_id='${restricted}' OR (user_id='${restrictedElsewhere}' AND site_id='${ids.otherSite}');
      INSERT INTO public.agents VALUES ('${agent}','${ids.site}','active'),('${another}','${ids.site}','active'),
        ('${inactive}','${ids.site}','inactive'),('${otherSiteAgent}','${ids.otherSite}','active');`)
    installFunction("20261019220003_startup_trial_licensing.sql", "site_member_has_effective_license")
    installFunction("20261019220003_startup_trial_licensing.sql", "current_user_site_role")
    installFunction("20261021010004_location_records_insert_and_readiness.sql", "current_user_has_site_location_restrictions")
    installFunction("20261020030000_location_enforcement_scope.sql", "current_user_has_location_restrictions")
    installFunction("20261007220000_site_license_enforcement.sql", "lock_site_license")
    db(`GRANT EXECUTE ON FUNCTION public.site_member_has_effective_license(uuid) TO postgres;
      GRANT CREATE ON SCHEMA public TO postgres;
      GRANT REFERENCES ON public.sites TO postgres;
      -- Locking reads in the definer need UPDATE privilege on the source tables.
      GRANT UPDATE ON public.sites, public.site_members, public.site_ownership, public.settings, public.agents TO postgres;
      -- Mirror broad Supabase defaults; the migration must explicitly remove them.
      ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;`)
    db(`SET ROLE postgres; ${migration("20261120231000_channel_agent_assignments.sql")}`)
  })
  afterAll(stop)
  beforeEach(() => {
    db(`TRUNCATE ${history}, ${table}; DELETE FROM public.settings;
      INSERT INTO public.settings VALUES ('${ids.site}', '${settings}'::jsonb)`)
  })

  it("writes per canonical connection, keeps independent revisions on clear, and audits the actual session actor", () => {
    expect(JSON.parse(call(save("sms-a", agent, 0), ids.admin))).toEqual({ connectionId: "sms-a", agentId: agent, revision: 1 })
    call(save("voice-a", another, 0), ids.coOwner)
    call(save("website", another, 0))
    expect(JSON.parse(call(save("sms-a", null, 1)))).toEqual({ connectionId: "sms-a", agentId: null, revision: 2 })
    expect(() => call(save("sms-a", agent, 0))).toThrow(/revision changed/)
    expect(call(`SELECT connection_id,agent_id,revision FROM ${table} ORDER BY connection_id`, ids.collaborator)).toBe(
      `sms-a||2\nvoice-a|${another}|1\nwebsite|${another}|1`)
    expect(db(`SELECT previous_agent_id,agent_id,actor_id,revision FROM ${history} WHERE connection_id='sms-a' ORDER BY revision`))
      .toBe(`|${agent}|${ids.admin}|1\n${agent}||${ids.owner}|2`)
    expect(db(`SELECT channels='${settings}'::jsonb FROM public.settings`)).toBe("t")
  })
  it("retains unavailable explicit IDs instead of silently substituting a default", () => {
    call(save("website", agent, 0))
    db(`UPDATE public.agents SET status='inactive' WHERE id='${agent}'`)
    expect(() => call(save("voice-a", agent, 0))).toThrow(/Agent unavailable/)
    db(`DELETE FROM public.agents WHERE id='${agent}'`)
    expect(call(`SELECT agent_id,revision FROM ${table}`)).toBe(`${agent}|1`)
    expect(JSON.parse(call(save("website", null, 1))).revision).toBe(2)
    db(`INSERT INTO public.agents VALUES ('${agent}','${ids.site}','active')`)
  })
  it("rejects missing, foreign, duplicate and reserved collisions without partial writes", () => {
    for (const key of ["SMS-a", "dup", "same", "draft-id", "42", "absent"]) {
      expect(() => call(save(key, agent, 0))).toThrow(/Connection unavailable/)
    }
    for (const id of [inactive, otherSiteAgent, uuid(404)]) expect(() => call(save("sms-a", id, 0))).toThrow(/Agent unavailable/)
    for (const key of ["", " sms-a", "bad\tkey"]) expect(() => call(save(key, agent, 0))).toThrow(/Invalid assignment request/)
    expect(() => call(save("website", null, -1))).toThrow(/Invalid assignment request/)
    db(`UPDATE public.settings SET channels='{"connections":[{"id":"website"}]}'`)
    expect(() => call(save("website", agent, 0))).toThrow(/Connection unavailable/)
    expect(db(`SELECT count(*) FROM ${history}`)).toBe("0")
  })
  it("checks the authorized site even for website and even when no settings exist", () => {
    expect(() => call(save("website", null, 0, ids.otherSite))).toThrow(/management denied/)
    expect(JSON.parse(call(save("website", null, 0, ids.otherSite), ids.foreign))).toEqual({
      connectionId: "website", agentId: null, revision: 1,
    })
    expect(call(`SELECT count(*) FROM ${table}`)).toBe("0")
    db(`UPDATE public.settings SET channels='{"connections":null}' WHERE site_id='${ids.site}'`)
    expect(JSON.parse(call(save("website", null, 0))).revision).toBe(1)
  })
  it("enforces member visibility, manager-only writes, global and site location, license and archive boundaries", () => {
    call(save("website", null, 0))
    for (const user of [ids.collaborator, ids.marketing]) {
      expect(call(`SELECT count(*) FROM ${table}`, user)).toBe("1")
      expect(() => call(save("website", agent, 1), user)).toThrow(/management denied/)
    }
    for (const user of [ids.foreign, disabled, ids.inactive, restricted, restrictedElsewhere]) {
      expect(call(`SELECT count(*) FROM ${table}`, user)).toBe("0")
      expect(() => call(save("website", agent, 1), user)).toThrow(/management denied/)
    }
    db(`UPDATE public.sites SET archived_at=now() WHERE id='${ids.site}'`)
    expect(call(`SELECT count(*) FROM ${table}`)).toBe("0")
    expect(() => call(save("website", agent, 1))).toThrow(/management denied/)
    db(`UPDATE public.sites SET archived_at=NULL WHERE id='${ids.site}'`)
  })
  it("denies direct mutation, private history access, anonymous access and service execution", () => {
    for (const role of ["authenticated", "anon", "service_role"]) {
      expect(() => call(`DELETE FROM ${table}`, ids.owner, role)).toThrow(/permission denied/)
      expect(() => call(`UPDATE ${table} SET revision=5`, ids.owner, role)).toThrow(/permission denied/)
      expect(() => call(`INSERT INTO ${table} VALUES ('${ids.site}','arbitrary',NULL,1)`, ids.owner, role)).toThrow(/permission denied/)
      expect(() => call(`SELECT * FROM ${history}`, ids.owner, role)).toThrow(/permission denied/)
      expect(db(`SELECT has_table_privilege('${role}', '${history}', 'INSERT,UPDATE,DELETE,TRUNCATE'),
        has_table_privilege('${role}', '${table}', 'TRUNCATE')`)).toBe("f|f")
      if (role !== "authenticated") {
        expect(() => call(save("website", agent, 0), ids.owner, role)).toThrow(/permission denied/)
        expect(() => call(`SELECT * FROM ${table}`, ids.owner, role)).toThrow(/permission denied/)
      }
    }
  })
  it("does not admit an authenticated role without an actor, or write history on a refused snapshot", () => {
    call(save("website", null, 0))
    expect(db(`SET ROLE authenticated; SELECT count(*) FROM ${table}`)).toBe("0")
    expect(() => db(`SET ROLE authenticated; ${save("website", agent, 1)}`)).toThrow(/management denied/)
    expect(() => call(`BEGIN ISOLATION LEVEL REPEATABLE READ; ${save("website", agent, 1)}; COMMIT`))
      .toThrow(/License writes require READ COMMITTED or SERIALIZABLE/)
    expect(call(`SELECT revision,agent_id IS NULL FROM ${table}`)).toBe("1|t")
    expect(db(`SELECT count(*) FROM ${history}`)).toBe("1")
  })
  it("allows exactly one winner for concurrent first writes and concurrent stale clears", async () => {
    for (const rev of [0, 1]) {
      const results = await Promise.allSettled([ids.owner, ids.admin].map((user, i) => concurrent(actorSql(
        save("website", rev === 0 ? (i === 0 ? agent : another) : null, rev), user))))
      expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1)
      expect(results.find(r => r.status === "rejected")).toMatchObject({ reason: expect.objectContaining({ message: expect.stringContaining("revision changed") }) })
    }
    expect(call(`SELECT revision,agent_id IS NULL FROM ${table}`)).toBe("2|t")
    expect(db(`SELECT count(*) FROM ${history}`)).toBe("2")
  })
})