import {
  cacheSiteSelection, clearSiteSelectionCache, readSiteSelection,
  SITE_SELECTION_CACHE_KEY, SITE_SELECTION_CACHE_TTL_MS,
} from "@/app/context/site-selection-cache"
import type { Site } from "@/app/context/site-types"

const site = {
  id: "11111111-1111-4111-8111-111111111111", name: "Workspace", user_id: "owner",
  settings: { channels: { email: { password: "secret" } } },
  billing: { stripe_customer_id: "private" },
} as Site

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem("currentSiteId", site.id)
})

it("stores only identity fields, not secrets, billing or settings", () => {
  cacheSiteSelection("actor", site)
  const raw = localStorage.getItem(SITE_SELECTION_CACHE_KEY)!
  expect(raw).not.toMatch(/secret|private|settings|billing/)
  expect(readSiteSelection("actor")).toEqual(expect.objectContaining({ id: site.id }))
  expect(readSiteSelection("other")).toBeNull()
  expect(readSiteSelection(null)).toBeNull()
})

it("requires the same selection and a bounded cache age", () => {
  jest.useFakeTimers()
  try {
    cacheSiteSelection("actor", site)
    jest.advanceTimersByTime(SITE_SELECTION_CACHE_TTL_MS + 1)
    expect(readSiteSelection("actor")).toBeNull()
    cacheSiteSelection("actor", site)
    localStorage.removeItem("currentSiteId")
    expect(readSiteSelection("actor")).toBeNull()
  } finally { jest.useRealTimers() }
})

it("ignores malformed data and strips injected settings on read", () => {
  localStorage.setItem(SITE_SELECTION_CACHE_KEY, "{")
  expect(readSiteSelection("actor")).toBeNull()
  localStorage.setItem(SITE_SELECTION_CACHE_KEY, JSON.stringify({ userId: "actor", savedAt: Date.now(), site }))
  expect(readSiteSelection("actor")?.settings).toBeUndefined()
  clearSiteSelectionCache()
  expect(readSiteSelection("actor")).toBeNull()
})

it("does not fail selection when storage is unavailable", () => {
  const spy = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Blocked") })
  expect(() => cacheSiteSelection("actor", site)).not.toThrow()
  spy.mockRestore()
})