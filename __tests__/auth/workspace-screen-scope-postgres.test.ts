/** @jest-environment node */
import { ids, installSiteFixture, isolatedPostgres, migration, postgresAvailable } from '../security/isolated-postgres'

const pg = isolatedPostgres()
const fullScope = `SELECT public.read_workspace_screen_scope('${ids.site}')`
const read = (actor: string) => JSON.parse(pg.call(fullScope, actor) || 'null')
const suite = postgresAvailable ? describe : describe.skip

suite('user-scoped workspace screen projection (isolated PostgreSQL)', () => {
  beforeAll(() => {
    pg.start()
    installSiteFixture(pg.db)
    pg.db(`ALTER TABLE public.site_members ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid(),
      ADD COLUMN blocked_screens text[] NOT NULL DEFAULT '{}', ADD COLUMN license_suspended boolean NOT NULL DEFAULT false;
      CREATE TABLE public.site_member_location_restrictions(site_id uuid,site_member_id uuid);
      GRANT SELECT ON public.site_member_location_restrictions TO postgres;
      ALTER TABLE public.site_members ENABLE ROW LEVEL SECURITY;
      CREATE POLICY self_membership ON public.site_members FOR SELECT TO authenticated USING(user_id = auth.uid());
      UPDATE public.site_members SET blocked_screens = ARRAY['chat'] WHERE user_id='${ids.collaborator}';`)
    const scope = migration('20261020030000_location_enforcement_scope.sql')
    pg.db(scope.slice(scope.indexOf('CREATE FUNCTION public.current_user_has_location_restrictions()'),
      scope.indexOf('REVOKE ALL')))
    pg.db('ALTER FUNCTION public.current_user_has_location_restrictions() OWNER TO postgres;')
    pg.db(migration('20261123233000_workspace_screen_scope.sql'))
  })
  afterAll(() => pg.stop())

  it('uses the real database actor, not user-supplied owner or screen claims', () => {
    expect(read(ids.owner)).toEqual({ actor_id: ids.owner, site_id: ids.site, role: 'owner', blocked_screens: [], location_restricted: false })
    expect(read(ids.collaborator)).toMatchObject({ role: 'collaborator', blocked_screens: ['chat'] })
    expect(read(ids.foreign)).toBeNull()
    expect(read(ids.inactive)).toBeNull()
    expect(pg.call(`SELECT public.read_workspace_screen_scope(NULL)`)).toBe('')
    expect(pg.db(`SET ROLE authenticated; SET request.jwt.claims = '{"sub":"${ids.owner}","is_anonymous":true}'; ${fullScope}`)).toBe('')
    for (const role of ['anon','service_role']) expect(() => pg.call(fullScope, ids.owner, role)).toThrow(/permission denied/i)
    expect(pg.db("SELECT prosecdef FROM pg_proc WHERE oid='public.read_workspace_screen_scope(uuid)'::regprocedure")).toBe('f')
  })

  it('reflects restrictions, membership revocation, suspension and archival on the next read', () => {
    pg.db(`INSERT INTO public.site_member_location_restrictions SELECT site_id,id FROM public.site_members WHERE user_id='${ids.marketing}'`)
    expect(read(ids.marketing)).toMatchObject({ location_restricted: true })
    pg.db(`UPDATE public.site_members SET license_suspended=true WHERE user_id='${ids.marketing}'`)
    expect(read(ids.marketing)).toBeNull()
    pg.db(`DELETE FROM public.site_members WHERE user_id='${ids.collaborator}'`)
    expect(read(ids.collaborator)).toBeNull()
    pg.db(`UPDATE public.sites SET archived_at=now() WHERE id='${ids.site}'`)
    expect(read(ids.owner)).toBeNull()
  })
})