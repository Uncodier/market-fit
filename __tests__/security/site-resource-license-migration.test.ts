/** @jest-environment node */
import { licenseActor, licenseIds as ids, licensePostgres, licensePostgresAvailable, licenseUuid as uuid } from './site-license-postgres'

type Resource = { id: string; isActive?: boolean | number; status?: string; license_suspended?: boolean; _license?: { order: number; suspended?: boolean; previousStatus?: string; previousIsActive?: boolean | number } }
const suite = licensePostgresAvailable ? describe : describe.skip
suite('connected-resource licenses in disposable PostgreSQL', () => {
  const pg = licensePostgres()
  const social = (count: number): Resource[] => Array.from({ length: count }, (_, index) => ({ id: `social-${index}`, isActive: true }))
  const agents = (count: number): Resource[] => Array.from({ length: count }, (_, index) => ({ id: `agent-${index}`, status: 'connected' }))
  const save = (resources: Resource[], channels: Resource[], browser = false) => {
    const sql = `UPDATE settings SET social_media='${JSON.stringify(resources)}',channels='${JSON.stringify({ connections: channels, email: { enabled: true } })}' WHERE site_id='${ids.site}'`
    return browser ? pg.call(sql) : pg.db(sql)
  }
  const state = (): { social: Resource[]; agent: Resource[]; channels: { email: { enabled: boolean } } } => JSON.parse(pg.db(`
    SELECT jsonb_build_object('social',social_media,'agent',channels->'connections','channels',channels) FROM settings WHERE site_id='${ids.site}'`))
  const billing = (plan: string, addons = 0) => pg.db(`UPDATE billing SET plan='${plan}',addons_count=${addons} WHERE site_id='${ids.site}'`)
  const activeCounts = () => { const current = state(); return [current.social.filter(item => item.isActive === true || item.isActive === 1).length, current.agent.filter(item => item.status === 'connected').length] }
  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => pg.install())

  it('clamps every plan to independent category quotas plus one shared addon pool', () => {
    for (const [plan, expected] of [['commission', [1, 0]], ['engine', [3, 1]], ['foundry', [6, 3]], ['enterprise', [10, 10]]] as const) {
      billing(plan)
      save(social(12), agents(12))
      expect(activeCounts()).toEqual(expected)
      expect(state().social).toHaveLength(12); expect(state().agent).toHaveLength(12)
    }
    billing('engine', 2)
    expect(activeCounts()).toEqual([5, 1])
    expect(state().channels.email).toEqual({ enabled: true })
    billing('engine', 0)
    expect(activeCounts()).toEqual([3, 1])
  })

  it('stores reversible original state and never activates preexisting manually disabled resources', () => {
    save([{ id: 'manual', isActive: false }, { id: 'number', isActive: 1 }, { id: 'extra', isActive: true }],
      [{ id: 'manual-agent', status: 'disconnected' }, { id: 'live-agent', status: 'connected' }])
    billing('commission')
    const suspended = state()
    expect(suspended.social.find(item => item.id === 'extra')).toMatchObject({ isActive: false, license_suspended: true, _license: { previousIsActive: true, suspended: true } })
    expect(suspended.agent.find(item => item.id === 'live-agent')).toMatchObject({ status: 'license_suspended', _license: { previousStatus: 'connected', suspended: true } })
    billing('engine')
    expect(state().social.find(item => item.id === 'number')?.isActive).toBe(1)
    expect(state().social.find(item => item.id === 'manual')?.isActive).toBe(false)
    expect(state().agent.find(item => item.id === 'manual-agent')?.status).toBe('disconnected')
    expect(state().agent.find(item => item.id === 'live-agent')?.status).toBe('connected')
    expect(state().social.find(item => item.id === 'extra')?._license?.suspended).toBeUndefined()
  })

  it('uses immutable addition order despite browser prepend/reordering and allocates addons across arrays', () => {
    save(social(3), agents(2)); billing('commission', 2)
    expect(activeCounts()).toEqual([3, 0])
    const initial = state()
    save([{ id: 'prepended-new', isActive: true }, ...initial.social.slice().reverse()], initial.agent.slice().reverse(), true)
    expect(state().social.find(item => item.id === 'prepended-new')).toMatchObject({ isActive: false, license_suspended: true })
    expect(state().social.find(item => item.id === 'social-0')?._license?.order).toBe(initial.social[0]._license?.order)
    // Remove old social excess; freed shared addons restore oldest waiting agents, not the new social.
    const updated = state()
    save(updated.social.filter(item => !['social-1', 'social-2'].includes(item.id)), updated.agent, true)
    expect(activeCounts()).toEqual([1, 2])
    expect(state().social.find(item => item.id === 'prepended-new')?.license_suspended).toBe(true)
  })

  it('protects metadata and blocks UI/provider reenables without deleting resources', () => {
    billing('commission'); save(social(2), agents(1))
    const initial = state()
    expect(() => save(initial.social.map(item => ({ ...item, _license: { order: 1 } })), initial.agent, true)).toThrow('server managed')
    expect(() => save(initial.social.map(item => ({ ...item, license_suspended: false })), initial.agent, true)).toThrow('server managed')
    expect(() => save([{ id: 'forged', isActive: false, _license: { order: 1, suspended: true, previousIsActive: true } }], [], true)).toThrow('server managed')
    // Browser forms may omit unfamiliar metadata; inherited stored metadata cannot be erased.
    save(initial.social.map(item => ({ id: item.id, isActive: true })), initial.agent.map(item => ({ id: item.id, status: 'connected' })), true)
    expect(activeCounts()).toEqual([1, 0])
    save(social(2), agents(1)) // Trusted provider update also cannot bypass the quota.
    expect(activeCounts()).toEqual([1, 0])
    expect(state().social).toHaveLength(2); expect(state().agent).toHaveLength(1)
    billing('engine')
    expect(activeCounts()).toEqual([2, 1]) // Omitted provider metadata retained restoration intent.
  })

  it('backfills pre-migration arrays in stored order while preserving unrelated JSON', () => {
    pg.install(`UPDATE settings SET social_media='${JSON.stringify(social(3))}',channels='${JSON.stringify({ connections: agents(2), custom: 'preserved' })}' WHERE site_id='${ids.other}'`)
    const current = JSON.parse(pg.db(`SELECT jsonb_build_object('social',social_media,'channels',channels) FROM settings WHERE site_id='${ids.other}'`))
    expect(current.social.map((item: Resource) => item.license_suspended)).toEqual([false, true, true])
    expect(current.channels.connections.every((item: Resource) => item.status === 'license_suspended')).toBe(true)
    expect(current.channels.custom).toBe('preserved')
    expect(current.social.map((item: Resource) => item._license?.order)).toEqual([1, 2, 3])
  })

  const installLegacyDuplicates = () => pg.install(`
    UPDATE settings SET social_media='${JSON.stringify([
      { id: 'legacy-social', isActive: true }, { id: 'legacy-social', isActive: false }, { id: 'legacy-social', isActive: true },
    ])}',channels='${JSON.stringify({ connections: [
      { id: 'legacy-agent', status: 'connected' }, { id: 'legacy-agent', status: 'disconnected' }, { id: 'legacy-agent', status: 'connected' },
    ], custom: 'preserved' })}' WHERE site_id='${ids.other}';
    INSERT INTO site_members(id,site_id,user_id,email,role,status) VALUES
      ('${uuid(20)}','${ids.other}','${ids.member}','legacy@example.test','admin','active');`)
  const legacyState = (): { social: Resource[]; agent: Resource[]; custom: string } => JSON.parse(pg.db(`
    SELECT jsonb_build_object('social',social_media,'agent',channels->'connections','custom',channels->>'custom')
    FROM settings WHERE site_id='${ids.other}'`))

  it('backfills legacy duplicate identities during member synchronization without dropping records or sharing suspension', () => {
    installLegacyDuplicates()
    const current = legacyState()
    expect(current.social.map(item => item.isActive)).toEqual([true, false, false])
    expect(current.social.map(item => item.license_suspended)).toEqual([false, false, true])
    expect(current.agent.map(item => item.status)).toEqual(['license_suspended', 'disconnected', 'license_suspended'])
    expect([...current.social, ...current.agent].map(item => item._license?.order)).toEqual([1, 2, 3, 4, 5, 6])
    expect(current.custom).toBe('preserved')
    expect(pg.db(`SELECT license_suspended FROM site_members WHERE id='${uuid(20)}'`)).toBe('t')
    expect(pg.db(`SELECT team_members FROM settings WHERE site_id='${ids.other}'`)).toBe('[]')
    pg.db(`UPDATE billing SET plan='enterprise' WHERE site_id='${ids.other}'`)
    expect(legacyState().social.map(item => item.isActive)).toEqual([true, false, true])
    expect(legacyState().agent.map(item => item.status)).toEqual(['connected', 'disconnected', 'connected'])
    expect(pg.db(`SELECT license_suspended FROM site_members WHERE id='${uuid(20)}'`)).toBe('f')
    expect(JSON.parse(pg.db(`SELECT team_members FROM settings WHERE site_id='${ids.other}'`))).toHaveLength(1)
  })

  it('preserves unchanged duplicate arrays without metadata but rejects ambiguous changes and duplicate growth', () => {
    installLegacyDuplicates()
    const current = legacyState()
    const strip = (items: Resource[]) => items.map(item => {
      const copy = { ...item }; delete copy._license; delete copy.license_suspended; return copy
    })
    const update = (resources: Resource[], browser = false) => {
      const sql = `UPDATE settings SET social_media='${JSON.stringify(resources)}' WHERE site_id='${ids.other}'`
      return browser ? pg.call(sql, ids.foreign) : pg.db(sql)
    }
    pg.call(`UPDATE settings SET updated_at=now() WHERE site_id='${ids.other}'`, ids.foreign)
    update(strip(current.social), true)
    update(strip(current.social))
    pg.call(`UPDATE settings SET channels='${JSON.stringify({ connections: strip(current.agent), custom: current.custom })}' WHERE site_id='${ids.other}'`, ids.foreign)
    expect(legacyState()).toEqual(current)
    for (const browser of [false, true]) {
      expect(() => update([...current.social, { id: 'legacy-social', isActive: true }], browser)).toThrow('Duplicate resource identity')
      expect(() => update(strip(current.social).reverse(), browser)).toThrow('Legacy duplicate resources require stored license metadata')
      expect(() => update(strip(current.social).slice(1), browser)).toThrow('Legacy duplicate resources require stored license metadata')
      expect(() => update([current.social[0], current.social[0]], browser)).toThrow('Duplicate resource license order')
    }
    expect(legacyState()).toEqual(current)
    update([...current.social].reverse(), true)
    expect(legacyState().social).toEqual(current.social)
    update(current.social.slice(1), true)
    expect(legacyState().social).toHaveLength(2)
    expect(legacyState().social.map(item => item.isActive)).toEqual([false, true])
    expect(() => update(current.social, true)).toThrow('Duplicate resource identity')
    expect(() => update([current.social[1], { ...current.social[2], _license: { order: 999 } }], true)).toThrow('Resource license metadata is server managed')
  })

  it('handles identical idless legacy slots independently and rejects new duplicates on insert', () => {
    pg.install(`UPDATE settings SET social_media='[{"platform":"","isActive":false},{"platform":"","isActive":false}]',
      channels='{"connections":[{"type":"email","status":"connected"},{"type":"email","status":"connected"}]}'
      WHERE site_id='${ids.other}'`)
    const current = legacyState()
    expect(current.social).toHaveLength(2)
    expect(current.social.map(item => item.isActive)).toEqual([false, false])
    expect(current.social.map(item => item.license_suspended)).toEqual([false, false])
    expect(current.agent.map(item => item.status)).toEqual(['license_suspended', 'license_suspended'])
    expect([...current.social, ...current.agent].map(item => item._license?.order)).toEqual([1, 2, 3, 4])
    pg.call(`UPDATE settings SET social_media='[{"platform":"","isActive":false},{"platform":"","isActive":false}]'
      WHERE site_id='${ids.other}'`, ids.foreign)
    expect(legacyState()).toEqual(current)
    for (const role of ['authenticated', 'service_role']) {
      pg.db(`DELETE FROM settings WHERE site_id='${ids.site}'`)
      expect(() => pg.call(`INSERT INTO settings(site_id,social_media) VALUES ('${ids.site}',
        '[{"id":"new-duplicate","isActive":true},{"id":"new-duplicate","isActive":true}]')`, ids.owner, role)).toThrow('Duplicate resource identity')
      expect(pg.db(`SELECT count(*) FROM settings WHERE site_id='${ids.site}'`)).toBe('0')
    }
  })

  it('cancels restoration on manual agent disconnect and authorized explicit social disable', () => {
    save(social(2), agents(1)); billing('commission')
    const current = state()
    save(current.social, current.agent.map(item => ({ ...item, status: 'disconnected' })), true)
    const disabled = state()
    save(disabled.social.map(item => item.id === 'social-1' ? { id: item.id, isActive: false, _license: { order: item._license!.order } } : item), disabled.agent)
    billing('enterprise')
    expect(activeCounts()).toEqual([1, 0])
    expect(state().agent[0]._license?.suspended).toBeUndefined()
    expect(state().social[1].license_suspended).toBe(false)
  })

  it('handles legacy empty channels, idless resource fingerprints, malformed arrays and duplicate identities', () => {
    pg.db(`UPDATE settings SET channels='[]' WHERE site_id='${ids.site}'`)
    billing('commission')
    expect(pg.db(`SELECT channels FROM settings WHERE site_id='${ids.site}'`)).toBe('[]')
    pg.db(`UPDATE settings SET channels='{"connections":[{"type":"email","status":"connected"}]}' WHERE site_id='${ids.site}'`)
    const before = state().agent[0]
    pg.call(`UPDATE settings SET channels='{"connections":[{"type":"email","status":"connected"}]}' WHERE site_id='${ids.site}'`)
    expect(state().agent[0]._license?.order).toBe(before._license?.order)
    expect(state().agent[0].status).toBe('license_suspended')
    expect(() => save([{ id: 'same', isActive: true }, { id: 'same', isActive: true }], [])).toThrow('Duplicate resource identity')
    expect(() => pg.call(`UPDATE settings SET social_media='{}' WHERE site_id='${ids.site}'`)).toThrow('must be arrays')
  })

  it('serializes concurrent settings enablement with billing downgrade and preserves the final invariant', async () => {
    save(social(4), agents(3))
    const results = await Promise.allSettled([
      pg.concurrent(`BEGIN; UPDATE billing SET plan='commission' WHERE site_id='${ids.site}'; SELECT pg_sleep(0.2); COMMIT;`),
      pg.concurrent(licenseActor(`UPDATE settings SET social_media='${JSON.stringify(social(5))}' WHERE site_id='${ids.site}'`)),
    ])
    // PostgreSQL may abort a child/parent row-lock inversion; retry the aborted transaction.
    if (results[0].status === 'rejected') billing('commission')
    if (results[1].status === 'rejected') pg.call(`UPDATE settings SET social_media='${JSON.stringify(social(5))}' WHERE site_id='${ids.site}'`)
    expect(results.filter(result => result.status === 'fulfilled').length).toBeGreaterThan(0)
    expect(pg.db(`SELECT plan FROM billing WHERE site_id='${ids.site}'`)).toBe('commission')
    expect(activeCounts()).toEqual([1, 0])
  })
})