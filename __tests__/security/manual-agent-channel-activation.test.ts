/** @jest-environment node */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { licenseActor, licensePostgresAvailable, licenseUuid } from './site-license-postgres'
import { startupTrialPostgres, startupTrialPrerequisitesAvailable } from './startup-trial-postgres'

const migration = readFileSync(path.resolve(__dirname,
  '../../supabase/migrations/20261020002000_manual_agent_channel_activation.sql'), 'utf8')
type Connection = { id: string; type?: string; status: string; enabled?: boolean;
  license_suspended?: boolean; _license?: { order?: number; manually_disabled?: boolean;
    manualPreviousStatus?: string; manualPreviousEnabled?: boolean } }

describe('Manual agent activation migration contract', () => {
  it('uses private transition authority, preserves installed function ACLs and returns only channels', () => {
    expect(migration).toContain("pg_get_functiondef('public.enforce_settings_license()'::regprocedure)")
    expect(migration).toContain("pg_get_functiondef('public.get_site_licensed_resources(uuid)'::regprocedure)")
    expect(migration).toContain('public.site_member_has_effective_license(m.id)')
    expect(migration).toContain("EXCEPTION WHEN SQLSTATE 'PML01'")
    expect(migration).toContain("jsonb_build_object('success',true,'channels',channels_result)")
    expect(migration).toContain('FROM PUBLIC, anon, authenticated, service_role')
    expect(migration).not.toContain('set_config(')
  })
})

const live = licensePostgresAvailable && startupTrialPrerequisitesAvailable ? describe : describe.skip
live('Manual agent channel activation in disposable socket-only PostgreSQL', () => {
  const pg = startupTrialPostgres()
  beforeAll(() => { pg.start(); pg.install(); pg.db(migration) }, 60_000)
  afterAll(() => pg.stop())
  const channels = (site: string): { connections: Connection[] } => JSON.parse(pg.db(
    `SELECT channels FROM settings WHERE site_id='${site}';`))
  const projection = (site: string): { channels: { connections: Connection[] }; social_media: { id: string; isActive: boolean }[] } =>
    pg.rpc('get_site_licensed_resources', `'${site}'`)
  const toggleSql = (site: string, id: string, enabled: boolean, actor: string) =>
    `SELECT public.set_site_agent_channel_enabled('${site}','${id}',${enabled},'${actor}');`
  const toggle = (site: string, id: string, enabled: boolean, actor: string) => JSON.parse(
    pg.call(toggleSql(site, id, enabled, actor), actor, 'service_role'))
  const write = (site: string, connections: Connection[], social?: { id: string; isActive: boolean }[]) => pg.db(
    `UPDATE settings SET channels='${JSON.stringify({ connections })}'${social ? `,social_media='${JSON.stringify(social)}'` : ''} WHERE site_id='${site}';`)
  const seed = (id: number, plan = 'engine', addons = 0) => {
    const result = pg.seed(id)
    pg.db(`UPDATE billing SET plan='${plan}',addons_count=${addons} WHERE site_id='${result.site}';`)
    return result
  }
  const snapshot = (site: string) => pg.db(`SELECT row_to_json(settings) FROM settings WHERE site_id='${site}';`)

  it('revokes browser execution and rejects forged/cross-tenant actors without mutation', () => {
    const { site, actor } = seed(701)
    write(site, [{ id: 'a', status: 'connected' }])
    const before = snapshot(site)
    for (const role of ['anon', 'authenticated']) {
      expect(() => pg.call(toggleSql(site, 'a', false, actor), actor, role)).toThrow('permission denied')
    }
    expect(() => toggle(site, 'a', false, licenseUuid(9999))).toThrow('site access denied')
    const other = seed(702)
    expect(() => toggle(other.site, 'a', false, actor)).toThrow('site access denied')
    expect(() => toggle(other.site, 'a', false, other.actor)).toThrow('does not belong')
    expect(snapshot(site)).toBe(before)
    expect(pg.db(`SELECT has_function_privilege('service_role','public.set_site_agent_channel_enabled(uuid,text,boolean,uuid)','EXECUTE');`)).toBe('t')
    expect(pg.db(`SELECT has_function_privilege('authenticated','public.get_site_licensed_resources(uuid)','EXECUTE'),
      has_function_privilege('service_role','public.enforce_settings_license()','EXECUTE');`)).toBe('f|f')
  })

  it('authorizes only currently licensed managers, including expiry before stale flags reconcile', () => {
    const { site, actor } = pg.seed(703)
    pg.startTrial(site, actor)
    const admin = licenseUuid(2703); const member = licenseUuid(3703)
    pg.db(`INSERT INTO site_members(site_id,user_id,role,status,email) VALUES
      ('${site}','${admin}','admin','active','admin703@test.invalid'),
      ('${site}','${member}','collaborator','active','member703@test.invalid');`)
    write(site, [{ id: 'a', status: 'connected' }])
    expect(() => toggle(site, 'a', false, member)).toThrow('site access denied')
    expect(toggle(site, 'a', false, admin).success).toBe(true)
    expect(toggle(site, 'a', true, admin).success).toBe(true)
    // Trial timestamps are moved by the fixture, but access is derived at statement time.
    pg.expire(site)
    expect(() => toggle(site, 'a', false, admin)).toThrow('site access denied')
    expect(toggle(site, 'a', false, actor).success).toBe(true)
    pg.db(`UPDATE billing SET plan='engine' WHERE site_id='${site}';
      UPDATE site_members SET manually_disabled=true,license_suspended=true WHERE site_id='${site}' AND user_id='${admin}';`)
    expect(() => toggle(site, 'a', true, admin)).toThrow('site access denied')
  })

  it('rechecks a manager revoked while the request waits for the site lock', async () => {
    const { site } = seed(704)
    const admin = licenseUuid(2704)
    pg.db(`INSERT INTO site_members(site_id,user_id,role,status,email) VALUES
      ('${site}','${admin}','admin','active','admin704@test.invalid');`)
    write(site, [{ id: 'a', status: 'connected' }])
    const revoke = pg.concurrent(`SET application_name='manual-channel-revoke'; BEGIN; SELECT 1 FROM sites WHERE id='${site}' FOR UPDATE;
      UPDATE site_members SET role='collaborator' WHERE site_id='${site}' AND user_id='${admin}';
      SELECT pg_sleep(0.6); COMMIT;`)
    let locked = false
    for (let attempt = 0; attempt < 50 && !locked; attempt++) {
      locked = pg.db("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='manual-channel-revoke' AND wait_event='PgSleep');") === 't'
      if (!locked) await new Promise(resolve => setTimeout(resolve, 10))
    }
    expect(locked).toBe(true)
    const waiting = pg.concurrent(licenseActor(toggleSql(site, 'a', false, admin), admin, 'service_role'))
    await expect(waiting).rejects.toThrow('site access denied')
    await revoke
    expect(channels(site).connections[0].status).toBe('connected')
  })

  it('captures trusted restoration data, frees quota and never auto-restores manual intent', () => {
    const { site, actor } = seed(705)
    write(site, [{ id: 'a', status: 'connected', enabled: true }, { id: 'b', status: 'connected' }])
    expect(channels(site).connections.map(row => row.status)).toEqual(['connected', 'license_suspended'])
    const result = toggle(site, 'a', false, actor)
    expect(Object.keys(result).sort()).toEqual(['channels', 'success'])
    expect(result.channels.connections[0]).toMatchObject({ id: 'a', status: 'disabled', enabled: false,
      license_suspended: false, _license: { manually_disabled: true, manualPreviousStatus: 'connected', manualPreviousEnabled: true, order: 1 } })
    expect(result.channels.connections[1].status).toBe('connected')
    pg.db(`UPDATE billing SET plan='foundry',addons_count=5 WHERE site_id='${site}';`)
    expect(projection(site).channels.connections[0].status).toBe('disabled')
    expect(toggle(site, 'a', true, actor).channels.connections[0]).toMatchObject({ status: 'connected', enabled: true,
      _license: { manually_disabled: false, manualPreviousStatus: 'connected', manualPreviousEnabled: true, order: 1 } })
    expect(pg.db('SELECT count(*) FROM agent_channel_activation_context;')).toBe('0')
  })

  it('provider connected writes cannot remove manual disable or forge restoration data', () => {
    const { site, actor } = seed(706)
    write(site, [{ id: 'a', status: 'connected', enabled: true }])
    toggle(site, 'a', false, actor)
    write(site, [{ id: 'a', status: 'connected', enabled: true }])
    expect(channels(site).connections[0]).toMatchObject({ status: 'disabled', enabled: false,
      _license: { manually_disabled: true, manualPreviousStatus: 'connected', manualPreviousEnabled: true } })
    write(site, [{ id: 'a', status: 'connected', enabled: true,
      _license: { manually_disabled: false, manualPreviousStatus: 'disconnected', manualPreviousEnabled: false } }])
    expect(projection(site).channels.connections[0]).toMatchObject({ status: 'disabled', enabled: false, license_suspended: false })
    // Browser payloads cannot forge manual state, even with forged JWT role claims.
    expect(() => pg.call(`SET request.jwt.claims='{"sub":"${actor}","role":"service_role"}';
      UPDATE settings SET channels='{"connections":[{"id":"a","status":"connected","_license":{"manually_disabled":false}}]}' WHERE site_id='${site}';`, actor)).toThrow('server managed')
    expect(toggle(site, 'a', true, actor).channels.connections[0]).toMatchObject({ status: 'connected', enabled: true })
    // Neither a custom GUC nor service-role table access creates an RPC capability.
    expect(() => pg.call(`INSERT INTO agent_channel_activation_context VALUES(txid_current(),'${site}','a');`, actor, 'service_role')).toThrow('permission denied')
  })

  it('read projection forces disabled even for a stale raw provider-connected snapshot', () => {
    const { site, actor } = seed(707)
    write(site, [{ id: 'a', status: 'connected' }])
    toggle(site, 'a', false, actor)
    // Test-owner only: simulate a legacy snapshot without executing the write guard.
    pg.db(`SET session_replication_role=replica; UPDATE settings SET channels=jsonb_set(jsonb_set(channels,
      '{connections,0,status}','"connected"'),'{connections,0,enabled}','true') WHERE site_id='${site}';`)
    expect(channels(site).connections[0].status).toBe('connected')
    expect(projection(site).channels.connections[0]).toMatchObject({ status: 'disabled', enabled: false, license_suspended: false })
  })

  it('denies restoring an earlier connection at capacity without displacing later active resources', () => {
    const { site, actor } = seed(708)
    write(site, [{ id: 'earlier', status: 'connected' }, { id: 'later', status: 'connected' }])
    toggle(site, 'earlier', false, actor)
    const before = snapshot(site)
    expect(toggle(site, 'earlier', true, actor)).toEqual({ success: false, code: 'ACCOUNT_LIMIT' })
    expect(snapshot(site)).toBe(before)
    expect(projection(site).channels.connections.map(row => row.status)).toEqual(['disabled', 'connected'])
    expect(toggle(site, 'later', true, actor).success).toBe(true)
  })

  it('denies restoring later suspended resources instead of reporting a successful suspension', () => {
    const { site, actor } = seed(709)
    write(site, [{ id: 'earlier', status: 'connected' }, { id: 'later', status: 'connected' }])
    const before = snapshot(site)
    expect(toggle(site, 'later', true, actor)).toEqual({ success: false, code: 'ACCOUNT_LIMIT' })
    expect(snapshot(site)).toBe(before)
    expect(toggle(site, 'later', false, actor).channels.connections[1]).toMatchObject({ status: 'disabled',
      _license: { manualPreviousStatus: 'connected', manualPreviousEnabled: true } })
  })

  it('shares one addon pool with socials and preserves currently active resources in both categories', () => {
    const { site, actor } = seed(710, 'engine', 1)
    write(site, [{ id: 'a', status: 'connected' }, { id: 'b', status: 'connected' }],
      [1, 2, 3, 4].map(id => ({ id: `social-${id}`, isActive: true })))
    expect(projection(site).social_media.every(row => row.isActive)).toBe(true)
    expect(projection(site).channels.connections.map(row => row.status)).toEqual(['connected', 'license_suspended'])
    const before = snapshot(site)
    expect(toggle(site, 'b', true, actor)).toEqual({ success: false, code: 'ACCOUNT_LIMIT' })
    expect(snapshot(site)).toBe(before)
    pg.db(`UPDATE billing SET addons_count=2 WHERE site_id='${site}';`)
    expect(toggle(site, 'b', true, actor).success).toBe(true)
    expect(projection(site).social_media.every(row => row.isActive)).toBe(true)
  })

  it('does not let an older manually disabled channel evict later socials from the shared addon pool', () => {
    const { site, actor } = seed(719, 'engine', 1)
    write(site, [{ id: 'older', status: 'connected' }])
    toggle(site, 'older', false, actor)
    write(site, [...channels(site).connections, { id: 'later', status: 'connected' }],
      [1, 2, 3, 4].map(id => ({ id: `later-social-${id}`, isActive: true })))
    const before = snapshot(site)
    expect(toggle(site, 'older', true, actor)).toEqual({ success: false, code: 'ACCOUNT_LIMIT' })
    expect(snapshot(site)).toBe(before)
    expect(projection(site).social_media.every(row => row.isActive)).toBe(true)
    expect(projection(site).channels.connections.map(row => row.status)).toEqual(['disabled', 'connected'])
  })

  it('serializes concurrent last-slot activation and duplicate enable/disable calls', async () => {
    const { site, actor } = seed(711)
    write(site, [{ id: 'a', status: 'connected' }, { id: 'b', status: 'connected' }])
    toggle(site, 'a', false, actor); toggle(site, 'b', false, actor)
    const results = await Promise.all(['a', 'b'].map(id => pg.concurrent(
      licenseActor(toggleSql(site, id, true, actor), actor, 'service_role')).then(output => JSON.parse(output))))
    expect(results.filter(result => result.success)).toHaveLength(1)
    expect(results.filter(result => result.code === 'ACCOUNT_LIMIT')).toHaveLength(1)
    const active = channels(site).connections.find(row => row.status === 'connected')!
    const repeated = await Promise.all([false, false].map(enabled => pg.concurrent(
      licenseActor(toggleSql(site, active.id, enabled, actor), actor, 'service_role')).then(output => JSON.parse(output))))
    expect(repeated.every(result => result.success)).toBe(true)
    expect(channels(site).connections.find(row => row.id === active.id)).toMatchObject({ status: 'disabled',
      _license: { manualPreviousStatus: 'connected', manualPreviousEnabled: true } })
    const enableTwice = await Promise.all([true, true].map(enabled => pg.concurrent(
      licenseActor(toggleSql(site, active.id, enabled, actor), actor, 'service_role')).then(output => JSON.parse(output))))
    expect(enableTwice.every(result => result.success)).toBe(true)
  })

  it('rolls back settings and all trigger effects when post-write admission fails', () => {
    const { site, actor } = seed(712)
    write(site, [{ id: 'a', status: 'connected' }])
    toggle(site, 'a', false, actor)
    // Force an effective cap loss between the locked admission and projection.
    // Real clock-based expiry can occur here even without another writer.
    pg.db(`CREATE FUNCTION public.test_activation_cap_loss() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.site_id='${site}' AND EXISTS(SELECT 1 FROM agent_channel_activation_context) THEN
        UPDATE billing SET status='inactive' WHERE site_id=NEW.site_id;
      END IF; RETURN NEW; END $$;
      CREATE TRIGGER test_activation_cap_loss AFTER UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION test_activation_cap_loss();`)
    const before = snapshot(site); const beforeBilling = pg.row(site)
    expect(toggle(site, 'a', true, actor)).toEqual({ success: false, code: 'ACCOUNT_LIMIT' })
    expect(snapshot(site)).toBe(before)
    expect(pg.row(site)).toEqual(beforeBilling)
    expect(pg.db('SELECT count(*) FROM agent_channel_activation_context;')).toBe('0')
    pg.db('DROP TRIGGER test_activation_cap_loss ON settings; DROP FUNCTION test_activation_cap_loss();')
  })

  it.each(['active', 'synced'])('preserves Voice %s across manual disable, provider sync, expiry and upgrade', status => {
    const { site, actor } = pg.seed(status === 'active' ? 713 : 714)
    pg.startTrial(site, actor)
    write(site, [{ id: 'voice', type: 'voice', status }, { id: 'other', status: 'connected' }])
    expect(toggle(site, 'voice', false, actor).channels.connections[0]).toMatchObject({ status: 'disabled', enabled: false,
      _license: { manualPreviousStatus: status, manualPreviousEnabled: true } })
    write(site, [{ id: 'voice', type: 'voice', status, enabled: true }, { id: 'other', status: 'connected' }])
    expect(projection(site).channels.connections[0].status).toBe('disabled')
    pg.expire(site)
    expect(projection(site).channels.connections.map(row => row.status)).toEqual(['disabled', 'license_suspended'])
    const before = snapshot(site)
    expect(toggle(site, 'voice', true, actor)).toEqual({ success: false, code: 'ACCOUNT_LIMIT' })
    expect(snapshot(site)).toBe(before)
    pg.db(`UPDATE billing SET plan='foundry' WHERE site_id='${site}';`)
    expect(projection(site).channels.connections.map(row => row.status)).toEqual(['disabled', 'connected'])
    expect(toggle(site, 'voice', true, actor).channels.connections[0]).toMatchObject({ status, enabled: true })
  })

  it('legacy Voice quota suspension restores the trusted active status only explicitly after manual disable', () => {
    const { site, actor } = seed(715, 'commission')
    write(site, [{ id: 'voice', type: 'voice', status: 'synced' }])
    expect(channels(site).connections[0].status).toBe('license_suspended')
    expect(toggle(site, 'voice', false, actor).channels.connections[0]._license.manualPreviousStatus).toBe('synced')
    pg.db(`UPDATE billing SET plan='engine' WHERE site_id='${site}';`)
    expect(channels(site).connections[0].status).toBe('disabled')
    expect(toggle(site, 'voice', true, actor).channels.connections[0].status).toBe('synced')
  })

  it('explicitly activates legacy disabled/enabled-false rows while retaining trusted historical enabled values', () => {
    const { site, actor } = seed(717)
    write(site, [{ id: 'legacy', status: 'disabled', enabled: false }])
    expect(toggle(site, 'legacy', true, actor).channels.connections[0]).toMatchObject({ status: 'connected', enabled: true,
      _license: { manualPreviousEnabled: false, manualPreviousStatus: 'connected' } })
    toggle(site, 'legacy', false, actor)
    expect(toggle(site, 'legacy', true, actor).channels.connections[0]).toMatchObject({ status: 'connected', enabled: true })
  })

  it('never consumes quota for established enabled-false rows or unrelated active/synced states', () => {
    const { site, actor } = seed(718)
    write(site, [{ id: 'off', status: 'connected', enabled: false },
      { id: 'telegram', type: 'telegram', status: 'active' },
      { id: 'email', type: 'email', status: 'synced' }, { id: 'on', status: 'connected' }])
    expect(projection(site).channels.connections.find(row => row.id === 'on')?.status).toBe('connected')
    const before = snapshot(site)
    expect(toggle(site, 'off', true, actor)).toEqual({ success: false, code: 'ACCOUNT_LIMIT' })
    expect(snapshot(site)).toBe(before)
  })

  it('rejects invalid inputs, draft/non-established states, ambiguous IDs and repeatable-read writes', () => {
    const { site, actor } = seed(716)
    write(site, [{ id: 'draft', status: 'pending' }, { id: 'telegram', type: 'telegram', status: 'active' }])
    for (const id of ['draft', 'telegram']) expect(() => toggle(site, id, true, actor)).toThrow('Only established')
    expect(() => toggle(site, '', false, actor)).toThrow('inputs are required')
    expect(() => pg.db(`SELECT set_site_agent_channel_enabled('${site}','draft',NULL,'${actor}');`)).toThrow('inputs are required')
    // Stored duplicates are legacy data, not introduced by the new RPC.
    pg.db(`SET session_replication_role=replica; UPDATE settings SET channels='{"connections":[{"id":"duplicate","status":"connected"},{"id":"duplicate","status":"disabled"}]}' WHERE site_id='${site}';`)
    const before = snapshot(site)
    expect(() => toggle(site, 'duplicate', false, actor)).toThrow('uniquely belong')
    expect(() => pg.call(`BEGIN ISOLATION LEVEL REPEATABLE READ; ${toggleSql(site, 'duplicate', false, actor)}`, actor, 'service_role')).toThrow('READ COMMITTED or SERIALIZABLE')
    expect(snapshot(site)).toBe(before)
  })
})