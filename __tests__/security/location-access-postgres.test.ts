/** @jest-environment node */
import { isolatedPostgres, postgresAvailable, uuid } from './isolated-postgres'
import { installLocationFixture, installLocationMemberGuard, locationActor, locationIds as i, locationMigration,
  locationSecuritySnapshot, replaceLocations, waitForLocationBarrier } from './location-access-fixture'

const suite = postgresAvailable ? describe : describe.skip
suite('location ACL foundation in disposable socket-only PostgreSQL', () => {
  const pg = isolatedPostgres()
  const read = (user = i.member, site = i.site) => JSON.parse(pg.db(locationActor(
    `SELECT public.current_user_location_access('${site}')`, user,
  )))
  const can = (location: string | null, user = i.member, site = i.site) => pg.db(locationActor(
    `SELECT public.user_can_access_location('${site}',${location === null ? 'NULL' : `'${location}'`})`, user,
  ))
  // Test-only privileged activation of a brand-new synthetic cluster. The shipped
  // migration and application requests cannot enable this flag.
  const simulateFutureRollout = () => pg.db('UPDATE public.location_access_rollout SET editing_enabled=true')
  const replace = (locations: string[], user = i.owner, member = i.memberRow, site = i.site) =>
    JSON.parse(pg.db(locationActor(replaceLocations(locations, member, site), user)))
  const count = (table: string) => pg.db(`SELECT count(*) FROM public.${table}`)

  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => installLocationFixture(pg))

  it('ships disabled, with zero restrictions/audits and unchanged existing policy definitions', () => {
    expect(pg.db('SELECT editing_enabled FROM public.location_access_rollout')).toBe('f')
    expect(count('site_member_location_restrictions')).toBe('0')
    expect(count('site_member_location_restriction_audit')).toBe('0')
    expect(read()).toEqual({ site_id: i.site, role: 'collaborator', restricted_location_ids: [], revision: 0 })
    const policies = pg.db(locationSecuritySnapshot)
    pg.db(`DROP TABLE public.site_member_location_restrictions,public.site_member_location_restriction_audit,
      public.location_access_rollout CASCADE;
      DROP FUNCTION public.current_user_location_access(uuid),public.user_can_access_location(uuid,uuid),
        public.replace_site_member_location_restrictions(uuid,uuid,uuid[]),public.read_site_location_restrictions(uuid);
      DROP INDEX public.site_members_location_acl_site_id_id,public.locations_location_acl_site_id_id;`)
    pg.db(locationMigration)
    expect(pg.db(locationSecuritySnapshot)).toBe(policies)
    expect(() => replace([i.location])).toThrow('Location restriction editing is not enabled')
    expect(count('site_member_location_restrictions')).toBe('0')
  })

  it('does not let authenticated, anon or service requests flip rollout, write tables or invoke as service', () => {
    for (const role of ['authenticated', 'anon', 'service_role']) {
      for (const sql of [
        'UPDATE public.location_access_rollout SET editing_enabled=true',
        'DELETE FROM public.location_access_rollout',
        `INSERT INTO public.site_member_location_restrictions VALUES ('${i.site}','${i.memberRow}','${i.location}')`,
        'DELETE FROM public.site_member_location_restrictions',
        'DELETE FROM public.site_member_location_restriction_audit',
      ]) expect(() => pg.db(locationActor(sql, i.owner, role))).toThrow('permission denied')
    }
    for (const role of ['anon', 'service_role']) {
      expect(() => pg.db(locationActor(replaceLocations([]), i.owner, role))).toThrow('permission denied')
      expect(() => pg.db(locationActor(`SELECT public.current_user_location_access('${i.site}')`, i.owner, role)))
        .toThrow('permission denied')
      expect(() => pg.db(locationActor(`SELECT public.user_can_access_location('${i.site}',NULL)`, i.owner, role)))
        .toThrow('permission denied')
    }
    expect(() => pg.db(`SET ROLE authenticated; SELECT public.current_user_location_access('${i.site}')`))
      .toThrow('Authentication required')
    expect(pg.db(`SET ROLE authenticated; SELECT public.user_can_access_location('${i.site}',NULL)`)).toBe('f')
  })

  it('reads a complete manager configuration in one statement, including nullable activity and co-ownership', () => {
    simulateFutureRollout()
    replace([i.location])
    pg.db(`UPDATE public.locations SET is_active=NULL WHERE id='${i.location}';
      INSERT INTO public.locations(id,site_id,name) SELECT
        ('10000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'${i.site}','Branch ' || n
        FROM generate_series(1,1100) n;
      INSERT INTO public.site_member_location_restrictions(site_id,site_member_id,location_id)
        SELECT '${i.site}','${i.memberRow}',id FROM public.locations
        WHERE site_id='${i.site}' AND id <> '${i.location}';`)
    const result = JSON.parse(pg.db(locationActor(`SELECT public.read_site_location_restrictions('${i.site}')`)))
    expect(result.locations).toHaveLength(1102)
    expect(result.locations.find((row: { id: string }) => row.id === i.location).is_active).toBeNull()
    expect(result.members.find((row: { id: string }) => row.id === i.memberRow).restricted_location_ids).toHaveLength(1102)
    expect(result.members.find((row: { id: string }) => row.id === i.coOwnerMember).is_location_exempt).toBe(true)
    expect(result.members.some((row: { id: string }) => row.id === i.foreignMember)).toBe(false)
    expect(result.locations.some((row: { id: string }) => row.id === i.foreignLocation)).toBe(false)
  })

  it('never substitutes RLS-empty configuration when the manager is revoked or belongs to another site', () => {
    const query = `SELECT public.read_site_location_restrictions('${i.site}')`
    for (const actor of [i.member, i.viewer, i.foreign, i.pendingUser]) {
      expect(() => pg.db(locationActor(query, actor))).toThrow('Team manager access required')
    }
    for (const role of ['anon', 'service_role']) {
      expect(() => pg.db(locationActor(query, i.owner, role))).toThrow('permission denied')
    }
    pg.db(`UPDATE public.site_members SET manually_disabled=true WHERE id='${i.adminMember}'`)
    expect(() => pg.db(locationActor(query, i.admin))).toThrow('Team manager access required')
    pg.db(`ALTER TABLE public.site_member_location_restrictions RENAME TO missing_restrictions`)
    expect(() => pg.db(locationActor(query))).toThrow('does not exist')
  })

  it('preserves empty-list null/known/new-location compatibility without widening the site boundary', () => {
    for (const user of [i.owner, i.admin, i.member, i.viewer, i.coOwner]) {
      expect(can(null, user)).toBe('t')
      expect(can(i.location, user)).toBe('t')
      expect(can(i.foreignLocation, user)).toBe('f')
      expect(can(uuid(999), user)).toBe('f')
    }
    pg.db(`INSERT INTO public.locations(id,site_id,is_active) VALUES ('${uuid(204)}','${i.site}',false)`)
    expect(can(uuid(204))).toBe('t') // Active/archive visibility remains existing module policy responsibility.
    expect(can(null, i.foreign)).toBe('f')
    expect(can(i.location, i.owner, uuid(999))).toBe('f')
    expect(() => read(i.foreign)).toThrow('Site access denied')
  })

  it('deduplicates atomically, returns strict contracts, audits old/new actor and makes no-op retries idempotent', () => {
    simulateFutureRollout()
    expect(replace([i.secondLocation, i.location, i.location], i.admin)).toEqual({
      site_id: i.site, site_member_id: i.memberRow,
      restricted_location_ids: [i.location, i.secondLocation], revision: 1,
    })
    expect(read()).toEqual({ site_id: i.site, role: 'collaborator',
      restricted_location_ids: [i.location, i.secondLocation], revision: 1 })
    expect(can(i.location)).toBe('f')
    expect(can(null)).toBe('f')
    expect(can(i.secondLocation)).toBe('f')
    pg.db(`INSERT INTO public.locations(id,site_id) VALUES ('${uuid(204)}','${i.site}')`)
    expect(can(uuid(204))).toBe('t')
    expect(replace([i.location, i.secondLocation]).revision).toBe(1)
    expect(count('site_member_location_restriction_audit')).toBe('1')
    expect(replace([]).revision).toBe(2)
    expect(can(null)).toBe('t')
    expect(JSON.parse(pg.db(`SELECT jsonb_agg(jsonb_build_object('actor',actor_user_id,
      'old',old_location_ids,'new',new_location_ids,'revision',revision) ORDER BY revision)
      FROM public.site_member_location_restriction_audit`))).toEqual([
      { actor: i.admin, old: [], new: [i.location, i.secondLocation], revision: 1 },
      { actor: i.owner, old: [i.location, i.secondLocation], new: [], revision: 2 },
    ])
  })

  it('rejects malformed/null/cross-site/unknown IDs and invalid targets without ever clearing old restrictions', () => {
    simulateFutureRollout()
    replace([i.location])
    const invalid = [
      `SELECT public.replace_site_member_location_restrictions('${i.site}','${i.memberRow}',NULL)`,
      `SELECT public.replace_site_member_location_restrictions('${i.site}','${i.memberRow}',ARRAY[NULL]::uuid[])`,
      `SELECT public.replace_site_member_location_restrictions('${i.site}','${i.memberRow}',ARRAY[['${i.location}']]::uuid[])`,
      `SELECT public.replace_site_member_location_restrictions('${i.site}','${i.memberRow}',ARRAY['bad']::uuid[])`,
      replaceLocations([uuid(999)]), replaceLocations([i.location, i.foreignLocation]),
      replaceLocations([], uuid(999)), replaceLocations([], i.foreignMember), replaceLocations([], i.rejectedMember),
    ]
    for (const sql of invalid) {
      expect(() => pg.db(locationActor(sql))).toThrow()
      expect(read().restricted_location_ids).toEqual([i.location])
      expect(read().revision).toBe(1)
    }
    for (const user of [i.member, i.viewer, i.foreign, i.rejectedUser]) {
      expect(() => replace([], user)).toThrow('Team manager access required')
    }
  })

  it('enforces same-site composite FKs and uniqueness even for privileged local fixture writes', () => {
    const insert = (site: string, member: string, location: string) =>
      pg.db(`INSERT INTO public.site_member_location_restrictions VALUES ('${site}','${member}','${location}')`)
    expect(() => insert(i.site, i.foreignMember, i.location)).toThrow('location_restrictions_member_site_fkey')
    expect(() => insert(i.site, i.memberRow, i.foreignLocation)).toThrow('location_restrictions_location_site_fkey')
    insert(i.site, i.memberRow, i.location)
    expect(() => insert(i.site, i.memberRow, i.location)).toThrow('duplicate key')
    expect(() => pg.db(`UPDATE public.locations SET site_id='${i.otherSite}' WHERE id='${i.location}'`)).toThrow('foreign key')
    expect(() => pg.db(`DELETE FROM public.locations WHERE id='${i.location}'`)).toThrow('foreign key')
    expect(() => pg.db(`UPDATE public.site_members SET site_id='${i.otherSite}' WHERE id='${i.memberRow}'`)).toThrow('foreign key')
  })

  it('exempts validated owners/admins but rejects nonempty manager/coowner target restrictions explicitly', () => {
    simulateFutureRollout()
    for (const member of [i.adminMember, i.coOwnerMember]) {
      expect(() => replace([i.location], i.owner, member)).toThrow('Owners and admins are exempt')
      expect(replace([], i.owner, member).restricted_location_ids).toEqual([])
      pg.db(`INSERT INTO public.site_member_location_restrictions VALUES ('${i.site}','${member}','${i.location}')`)
    }
    for (const user of [i.owner, i.admin, i.coOwner]) {
      expect(can(i.location, user)).toBe('t')
      expect(can(null, user)).toBe('t')
      expect(can(i.foreignLocation, user)).toBe('f')
    }
  })

  it('preserves pending restrictions on acceptance and disable/reactivate; pending/rejected never grant access', () => {
    simulateFutureRollout()
    expect(replace([i.location], i.owner, i.pendingMember).revision).toBe(1)
    expect(can(null, i.pendingUser)).toBe('f')
    expect(can(null, i.rejectedUser)).toBe('f')
    pg.db(`UPDATE public.site_members SET user_id='${i.pendingUser}',status='active' WHERE id='${i.pendingMember}'`)
    expect(read(i.pendingUser).restricted_location_ids).toEqual([i.location])
    expect(can(i.location, i.pendingUser)).toBe('f')
    expect(can(i.secondLocation, i.pendingUser)).toBe('t')
    pg.db(`UPDATE public.site_members SET manually_disabled=true,license_suspended=true WHERE id='${i.pendingMember}'`)
    expect(can(i.secondLocation, i.pendingUser)).toBe('f')
    expect(() => read(i.pendingUser)).toThrow('Site access denied')
    pg.db(`UPDATE public.site_members SET manually_disabled=false,license_suspended=false WHERE id='${i.pendingMember}'`)
    expect(read(i.pendingUser).restricted_location_ids).toEqual([i.location])
    pg.db(`UPDATE public.site_members SET status='pending',email=' ' WHERE id='${i.pendingMember}'`)
    expect(() => replace([], i.owner, i.pendingMember)).toThrow('valid pending invitation')
  })

  it('uses real chronological licensing and denies expired plans, disabled managers/coowners and archived sites', () => {
    simulateFutureRollout()
    pg.db(`UPDATE public.billing SET plan='engine' WHERE site_id='${i.site}';
      UPDATE public.site_members SET created_at='2027-01-01' WHERE id='${i.coOwnerMember}';
      UPDATE public.site_members SET status='active',user_id='${i.pendingUser}' WHERE id='${i.pendingMember}';
      UPDATE public.site_members SET status='active' WHERE id='${i.rejectedMember}'`)
    expect(can(null, i.coOwner)).toBe('f') // Ownership cannot bypass chronological seat suspension.
    pg.db(`UPDATE public.billing SET plan='commission' WHERE site_id='${i.site}'`)
    expect(can(null)).toBe('f')
    expect(can(null, i.admin)).toBe('f')
    expect(() => replace([], i.admin)).toThrow('Team manager access required')
    expect(can(null, i.owner)).toBe('t')
    pg.db(`UPDATE public.billing SET plan='enterprise',stripe_subscription_id='test-subscription',
      paid_subscription_invoice_id='test-invoice',paid_subscription_period_start=now()-interval '2 months',
      paid_subscription_period_end=now()-interval '1 month',subscription_status='active' WHERE site_id='${i.site}'`)
    expect(can(null)).toBe('f') // Stored enterprise does not override expired verified paid coverage.
    pg.db(`UPDATE public.billing SET plan='enterprise' WHERE site_id='${i.site}';
      UPDATE public.billing SET stripe_subscription_id=NULL WHERE site_id='${i.site}';
      UPDATE public.site_members SET manually_disabled=true,license_suspended=true WHERE id='${i.adminMember}'`)
    expect(() => replace([], i.admin)).toThrow('Team manager access required')
    pg.db(`UPDATE public.sites SET archived_at=now() WHERE id='${i.site}'`)
    expect(can(null, i.owner)).toBe('f')
    expect(() => read(i.owner)).toThrow('Site access denied')
  })

  it('RLS exposes only own restrictions to operators and site-scoped sets/audit to effective managers', () => {
    simulateFutureRollout()
    replace([i.location])
    replace([i.secondLocation], i.owner, i.viewerMember)
    for (const [user, expected] of [[i.owner, '2'], [i.admin, '2'], [i.member, '1'], [i.viewer, '1'], [i.foreign, '0']]) {
      expect(pg.db(locationActor('SELECT count(*) FROM public.site_member_location_restrictions', user))).toBe(expected)
    }
    for (const [user, expected] of [[i.owner, '2'], [i.member, '0'], [i.foreign, '0']]) {
      expect(pg.db(locationActor('SELECT count(*) FROM public.site_member_location_restriction_audit', user))).toBe(expected)
    }
    expect(() => pg.db(locationActor('SELECT * FROM public.site_member_location_restrictions', i.owner, 'anon')))
      .toThrow('permission denied')
    pg.db(`DELETE FROM public.site_members WHERE id='${i.memberRow}'`)
    expect(count('site_member_location_restrictions')).toBe('1')
    expect(count('site_member_location_restriction_audit')).toBe('2')
  })

  it('fails closed on resolver/schema failures instead of turning them into successful empty access', () => {
    pg.db(`CREATE OR REPLACE FUNCTION public.current_user_site_role(p_site_id uuid) RETURNS text
      LANGUAGE sql AS $$ SELECT 'unknown'::text $$`)
    expect(can(null)).toBe('f')
    expect(() => read()).toThrow('Site access denied')
    pg.db(`CREATE OR REPLACE FUNCTION public.current_user_site_role(p_site_id uuid) RETURNS text
      LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test resolver failure'; END; $$`)
    expect(() => can(null)).toThrow('test resolver failure')
    expect(() => read()).toThrow('test resolver failure')
    installLocationFixture(pg)
    pg.db('DROP TABLE public.site_member_location_restrictions CASCADE')
    expect(() => read()).toThrow('does not exist')
    expect(() => can(null)).toThrow('does not exist')
  })

  it('rolls restriction changes back if audit insertion fails', () => {
    simulateFutureRollout()
    replace([i.location])
    pg.db(`CREATE FUNCTION public.fail_location_audit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'test audit failure'; END; $$;
      CREATE TRIGGER fail_audit BEFORE INSERT ON public.site_member_location_restriction_audit
        FOR EACH ROW EXECUTE FUNCTION public.fail_location_audit()`)
    expect(() => replace([i.secondLocation])).toThrow('test audit failure')
    expect(read()).toMatchObject({ restricted_location_ids: [i.location], revision: 1 })
  })

  it('serializes concurrent replacements so every audit old set is the prior committed new set', async () => {
    simulateFutureRollout()
    const first = pg.concurrent(locationActor(`SET application_name='location-first'; BEGIN;
      ${replaceLocations([i.location])}; SELECT pg_sleep(0.8); COMMIT;`))
    await waitForLocationBarrier(pg, 'location-first')
    await Promise.all([first, pg.concurrent(locationActor(replaceLocations([i.secondLocation]), i.admin))])
    expect(read()).toMatchObject({ restricted_location_ids: [i.secondLocation], revision: 2 })
    expect(pg.db(`SELECT old_location_ids::text || '|' || new_location_ids::text
      FROM public.site_member_location_restriction_audit ORDER BY revision`))
      .toBe(`{}|{${i.location}}\n{${i.location}}|{${i.secondLocation}}`)
  }, 10000)

  it('revalidates a manager/target after waiting on concurrent membership transitions', async () => {
    simulateFutureRollout()
    const revoke = pg.concurrent(`SET application_name='location-revoke'; BEGIN;
      SELECT public.lock_site_license('${i.site}'); UPDATE public.site_members SET
        manually_disabled=true,license_suspended=true WHERE id='${i.adminMember}';
      SELECT pg_sleep(0.8); COMMIT;`)
    await waitForLocationBarrier(pg, 'location-revoke')
    const request = pg.concurrent(locationActor(replaceLocations([i.location]), i.admin))
    await expect(request).rejects.toThrow('Team manager access required')
    await revoke
    expect(count('site_member_location_restrictions')).toBe('0')
    const reject = pg.concurrent(`SET application_name='location-reject'; BEGIN;
      SELECT public.lock_site_license('${i.site}'); UPDATE public.site_members SET status='rejected'
        WHERE id='${i.pendingMember}'; SELECT pg_sleep(0.8); COMMIT;`)
    await waitForLocationBarrier(pg, 'location-reject')
    await expect(pg.concurrent(locationActor(replaceLocations([i.location], i.pendingMember))))
      .rejects.toThrow('valid pending invitation')
    await reject
    expect(count('site_member_location_restrictions')).toBe('0')
  }, 10000)

  it.each(['REPEATABLE READ', 'SERIALIZABLE'])('rejects stale %s mutation snapshots', isolation => {
    simulateFutureRollout()
    expect(() => pg.db(locationActor(`BEGIN ISOLATION LEVEL ${isolation}; ${replaceLocations([i.location])}; COMMIT`)))
      .toThrow('Location restriction writes require READ COMMITTED')
  })

  it('does not let serializable snapshots authorize a manager across concurrent revocation', async () => {
    simulateFutureRollout()
    installLocationMemberGuard(pg)
    const revoke = pg.concurrent(`SET application_name='location-serial-revoke'; BEGIN;
      UPDATE public.site_members SET manually_disabled=true,license_suspended=true WHERE id='${i.adminMember}';
      SELECT pg_sleep(0.8); COMMIT;`)
    await waitForLocationBarrier(pg, 'location-serial-revoke')
    await expect(pg.concurrent(locationActor(`BEGIN ISOLATION LEVEL SERIALIZABLE;
      ${replaceLocations([i.location])}; COMMIT;`, i.admin)))
      .rejects.toThrow('Location restriction writes require READ COMMITTED')
    await revoke
    expect(count('site_member_location_restrictions')).toBe('0')
    expect(count('site_member_location_restriction_audit')).toBe('0')
    expect(() => replace([i.location], i.admin)).toThrow('Team manager access required')
  }, 10000)

  it('returns a retryable conflict instead of deadlocking with the real BEFORE membership trigger', async () => {
    simulateFutureRollout()
    installLocationMemberGuard(pg)
    // Pause immediately after the ACL's first lock. The direct UPDATE takes the
    // member row first, then waits for the site in the actual deployed trigger.
    const acl = pg.concurrent(`SET application_name='location-acl-lock-order'; BEGIN;
      SELECT public.lock_site_license('${i.site}');
      ${locationActor(`SELECT pg_sleep(1.5); ${replaceLocations([i.location])}; COMMIT;`)}`)
      .then(() => ({ error: '' }), error => ({ error: String(error) }))
    await waitForLocationBarrier(pg, 'location-acl-lock-order')
    const update = pg.concurrent(`SET application_name='location-direct-member';
      UPDATE public.site_members SET role='marketing' WHERE id='${i.memberRow}'`)
    const results = await Promise.all([acl, update])
    expect(results[0].error).toContain('could not obtain lock on row')
    expect(results[0].error).not.toContain('deadlock detected')
    expect(count('site_member_location_restrictions')).toBe('0')
    expect(count('site_member_location_restriction_audit')).toBe('0')
    expect(read().role).toBe('marketing')
    expect(replace([i.location])).toMatchObject({ restricted_location_ids: [i.location], revision: 1 })
  }, 10000)

  it('rejects a location moving to another site concurrently without partial replacement', async () => {
    simulateFutureRollout()
    replace([i.location])
    const move = pg.concurrent(`SET application_name='location-move'; BEGIN;
      UPDATE public.locations SET site_id='${i.otherSite}' WHERE id='${i.secondLocation}';
      SELECT pg_sleep(0.8); COMMIT;`)
    await waitForLocationBarrier(pg, 'location-move')
    await expect(pg.concurrent(locationActor(replaceLocations([i.secondLocation]))))
      .rejects.toThrow('Every location must belong to this site')
    await move
    expect(read()).toMatchObject({ restricted_location_ids: [i.location], revision: 1 })
  }, 10000)
})