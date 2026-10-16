/** @jest-environment node */
import { licenseIds as ids, licensePostgres, licensePostgresAvailable } from "../security/site-license-postgres"

const suite = licensePostgresAvailable ? describe : describe.skip
const actors = [{ label: "owner", user: ids.owner }, { label: "admin", user: ids.member }]
const printers = { devices: [{
  id: "printer-a", name: "Kitchen printer", transport: "usb", paperWidthMm: 58, copies: 1,
  modules: { pos: false, orders: true, inventory: false },
  autoPrint: { posReceipt: false, kitchenTicket: true, orderDelta: true, inventoryLabel: false },
}] }
const json = (value: unknown) => `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`

suite("printer settings with installed license triggers in disposable PostgreSQL", () => {
  const pg = licensePostgres()
  const state = (siteId = ids.site) => JSON.parse(pg.db(
    `SELECT row_to_json(settings) FROM settings WHERE site_id='${siteId}'`,
  ))
  const update = `UPDATE settings SET printers=${json(printers)}, updated_at=updated_at + interval '1 second'
    WHERE site_id='${ids.site}' RETURNING id, site_id`

  beforeAll(() => pg.start(), 30000)
  afterAll(() => pg.stop())
  beforeEach(() => {
    pg.install()
    // Extend only the disposable fixture; production triggers and policies stay intact.
    pg.db(`ALTER TABLE settings ADD COLUMN printers jsonb DEFAULT '{"devices":[]}';
      ALTER TABLE settings ADD COLUMN about text;
      INSERT INTO site_members(site_id,user_id,role,status,email)
        VALUES ('${ids.site}','${ids.member}','admin','active','admin@example.test');
      UPDATE settings SET social_media='[{"id":"social","isActive":true}]',
        channels='{"connections":[{"id":"agent","status":"connected"}],"website":{"enabled":true}}',
        printers='{"devices":[{"id":"existing-printer","name":"Existing printer"}]}',
        about='Keep the company''s information', updated_at='2026-10-01T00:00:00Z'
        WHERE site_id='${ids.site}'`)
  })

  describe.each(actors)("$label settings writer", ({ user }) => {
    it("rejects a full-row upsert before conflict resolution, but saves a printer-only update", () => {
      const before = state()
      const otherBefore = state(ids.other)
      expect(pg.call(`SELECT public.current_user_site_role('${ids.site}')`, user))
        .toBe(user === ids.owner ? "owner" : "admin")
      expect(before.social_media[0]._license.order).toEqual(expect.any(Number))
      expect(before.channels.connections[0]._license.order).toEqual(expect.any(Number))
      expect(before.social_media[0].license_suspended).toBe(false)
      expect(before.channels.connections[0].license_suspended).toBe(false)

      const fullRow = { ...before, printers, updated_at: "2026-10-01T00:00:01Z" }
      // Even when the conflict branch changes only printers, INSERT sees copied _license metadata first.
      expect(() => pg.call(`INSERT INTO settings
        SELECT (jsonb_populate_record(NULL::settings, ${json(fullRow)})).*
        ON CONFLICT(site_id) DO UPDATE SET printers=excluded.printers, updated_at=excluded.updated_at`, user))
        .toThrow("Resource license metadata is server managed")
      expect(state()).toEqual(before)

      expect(pg.call(update, user)).toBe(`${before.id}|${ids.site}`)
      const after = state()
      expect(after).toEqual({ ...before, printers, updated_at: after.updated_at })
      expect(Date.parse(after.updated_at) - Date.parse(before.updated_at)).toBe(1000)
      expect(state(ids.other)).toEqual(otherBefore)
    })

    it.each([
      ["social_media", "{0,_license,order}", "999"],
      ["channels", "{connections,0,_license,order}", "999"],
      ["social_media", "{0,license_suspended}", "true"],
      ["channels", "{connections,0,license_suspended}", "true"],
    ])("rejects forged %s metadata at %s without saving printers", (column, path, value) => {
      const before = state()
      expect(() => pg.call(`UPDATE settings SET printers=${json(printers)},
        ${column}=jsonb_set(${column}, '${path}', '${value}'::jsonb)
        WHERE site_id='${ids.site}' RETURNING id`, user))
        .toThrow("Resource license metadata is server managed")
      expect(state()).toEqual(before)
    })

    it("safely inserts only requested fields when the settings row is missing", () => {
      const otherBefore = state(ids.other)
      pg.db(`DELETE FROM settings WHERE site_id='${ids.site}'`)
      expect(pg.call(update, user)).toBe("")
      const inserted = JSON.parse(pg.call(`INSERT INTO settings(site_id,printers,updated_at)
        VALUES ('${ids.site}',${json(printers)},'2026-10-01T00:00:01Z')
        RETURNING row_to_json(settings)`, user))
      expect(inserted).toMatchObject({
        id: expect.any(String), site_id: ids.site, printers,
        social_media: [], channels: [], about: null,
      })
      expect(Date.parse(inserted.updated_at)).toBe(Date.parse("2026-10-01T00:00:01Z"))
      expect(state()).toEqual(inserted)
      expect(pg.db(`SELECT count(*) FROM settings WHERE site_id='${ids.site}'`)).toBe("1")
      expect(state(ids.other)).toEqual(otherBefore)
    })
  })

  it("does not let another site's owner update printers", () => {
    const before = state()
    const otherBefore = state(ids.other)
    expect(pg.call(update, ids.foreign)).toBe("")
    expect(state()).toEqual(before)
    expect(state(ids.other)).toEqual(otherBefore)
  })

  it("denies anonymous printer updates even with an owner subject claim", () => {
    const before = state()
    expect(() => pg.call(update, ids.owner, "anon")).toThrow("permission denied")
    expect(state()).toEqual(before)
  })

  it("denies printer updates by an active marketing member", () => {
    pg.db(`UPDATE site_members SET role='marketing' WHERE site_id='${ids.site}' AND user_id='${ids.member}'`)
    const before = state()
    expect(pg.call(`SELECT public.current_user_site_role('${ids.site}')`, ids.member)).toBe("marketing")
    expect(() => pg.call(update, ids.member)).toThrow("row-level security")
    expect(state()).toEqual(before)
  })

  it("denies printer updates by a license-suspended active admin", () => {
    pg.db(`UPDATE site_members SET license_suspended=true
      WHERE site_id='${ids.site}' AND user_id='${ids.member}'`)
    const before = state()
    expect(pg.db(`SELECT status, license_suspended FROM site_members
      WHERE site_id='${ids.site}' AND user_id='${ids.member}'`)).toBe("active|t")
    expect(pg.call(`SELECT public.current_user_site_role('${ids.site}')`, ids.member)).toBe("")
    expect(pg.call(update, ids.member)).toBe("")
    expect(state()).toEqual(before)
  })
})