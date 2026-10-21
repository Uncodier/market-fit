/** @jest-environment node */
import { licenseIds as ids, licensePostgres, licensePostgresAvailable } from "../security/site-license-postgres"
import { getScopedTasks, ONBOARDING_MODES } from "@/app/components/dashboard/onboarding-tasks"

const suite = licensePostgresAvailable ? describe : describe.skip

suite("onboarding writes with license protection in disposable PostgreSQL", () => {
  const pg = licensePostgres()
  const state = () => JSON.parse(pg.db(`SELECT row_to_json(settings) FROM settings WHERE site_id='${ids.site}'`))
  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => {
    pg.install()
    pg.db(`ALTER TABLE settings ADD COLUMN onboarding jsonb DEFAULT '{}';
      UPDATE settings SET social_media='[{"id":"social","isActive":true}]',
        channels='{"connections":[{"id":"agent","status":"connected"}]}',
        onboarding='{"take_guided_tour":true}' WHERE site_id='${ids.site}'`)
  })

  it("reproduces the owner's full-row upsert denial and allows an onboarding-only update", () => {
    const before = state()
    expect(before.social_media[0]._license.order).toBeDefined()
    expect(() => pg.call(`INSERT INTO settings(id,site_id,social_media,channels,onboarding)
      VALUES ('${before.id}','${ids.site}','${JSON.stringify(before.social_media)}',
        '${JSON.stringify(before.channels)}','{"take_guided_tour":true,"create_workflows":true}')
      ON CONFLICT(site_id) DO UPDATE SET onboarding=excluded.onboarding`))
      .toThrow("Resource license metadata is server managed")
    expect(state()).toEqual(before)

    pg.call(`UPDATE settings SET onboarding='{"take_guided_tour":true,"create_workflows":true}'
      WHERE site_id='${ids.site}' RETURNING onboarding`)
    expect(state()).toEqual({ ...before, onboarding: { take_guided_tour: true, create_workflows: true } })
  })

  it("keeps cross-site, unauthenticated and read-only writes denied", () => {
    const before = state()
    const update = `UPDATE settings SET onboarding='{"create_workflows":true}' WHERE site_id='${ids.site}' RETURNING onboarding`
    expect(pg.call(update, ids.foreign)).toBe("")
    expect(() => pg.call(update, ids.owner, "anon")).toThrow("permission denied")
    pg.db(`INSERT INTO site_members(site_id,user_id,role,status,email)
      VALUES ('${ids.site}','${ids.member}','marketing','active','reader@example.test')`)
    expect(() => pg.call(update, ids.member)).toThrow("row-level security")
    expect(state().onboarding).toEqual(before.onboarding)
  })

  it("still rejects forged license metadata when updating existing settings", () => {
    expect(() => pg.call(`UPDATE settings SET social_media='[{"id":"social","isActive":true,"_license":{"order":999}}]'
      WHERE site_id='${ids.site}'`)).toThrow("Resource license metadata is server managed")
  })

  it.each(ONBOARDING_MODES)("rejects a stale validator snapshot after skipping all %s tasks", mode => {
    const before = state()
    const snapshot = JSON.stringify(before.onboarding)
    const skipped = Object.fromEntries(getScopedTasks(mode).map(task => [task.id, true]))
    const saved = { ...before.onboarding, ...skipped }
    pg.call(`UPDATE settings SET onboarding='${JSON.stringify(saved)}'
      WHERE site_id='${ids.site}' AND onboarding='${snapshot}'::jsonb RETURNING onboarding`)

    expect(pg.call(`UPDATE settings SET onboarding='{"take_guided_tour":true,"create_workflows":true}'
      WHERE site_id='${ids.site}' AND onboarding='${snapshot}'::jsonb RETURNING onboarding`)).toBe("")
    expect(state().onboarding).toEqual(saved)

    const merged = { ...state().onboarding, create_workflows: true }
    const latestSnapshot = JSON.stringify(state().onboarding)
    pg.call(`UPDATE settings SET onboarding='${JSON.stringify(merged)}'
      WHERE site_id='${ids.site}' AND onboarding='${latestSnapshot}'::jsonb RETURNING onboarding`)
    expect(state()).toEqual({ ...before, onboarding: merged })
  })

  it("compares JSON snapshots independently of key order and preserves explicit false values", () => {
    pg.db(`UPDATE settings SET onboarding='{"take_guided_tour":true,"create_workflows":true}' WHERE site_id='${ids.site}'`)
    expect(pg.call(`UPDATE settings SET onboarding='{"take_guided_tour":true,"create_workflows":false}'
      WHERE site_id='${ids.site}' AND onboarding='{"create_workflows":true,"take_guided_tour":true}'::jsonb
      RETURNING onboarding`)).not.toBe("")
    expect(state().onboarding).toEqual({ take_guided_tour: true, create_workflows: false })
  })

  it("initializes null onboarding only while the snapshot remains null", () => {
    pg.db(`UPDATE settings SET onboarding=NULL WHERE site_id='${ids.site}'`)
    pg.call(`UPDATE settings SET onboarding='{"take_guided_tour":true}'
      WHERE site_id='${ids.site}' AND onboarding IS NULL RETURNING onboarding`)
    expect(pg.call(`UPDATE settings SET onboarding='{"create_workflows":true}'
      WHERE site_id='${ids.site}' AND onboarding IS NULL RETURNING onboarding`)).toBe("")
    expect(state().onboarding).toEqual({ take_guided_tour: true })
  })
})