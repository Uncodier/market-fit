import { CURRENT_SITE_COOKIE, persistCurrentSiteCookie } from "@/lib/auth/current-site-cookie"
import { leaveArchivedSite, requestSiteArchive } from "@/lib/sites/archive-site-client"

const siteId = "11111111-1111-4111-8111-111111111111"
const otherSiteId = "22222222-2222-4222-8222-222222222222"
const password = "  test-only-password  "
const fallbackError = "Unable to archive the site. Please try again."
const mockFetch = jest.mocked(fetch)
const originalLocation = window.location
const replace = jest.fn()

function respond(body: unknown, ok = true) {
  mockFetch.mockResolvedValueOnce({ ok, json: async () => body } as Response)
}

beforeEach(() => {
  mockFetch.mockReset()
  replace.mockReset()
  localStorage.clear()
  document.cookie = `${CURRENT_SITE_COOKIE}=; Path=/; Max-Age=0`
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { replace },
  })
})

afterEach(() => {
  jest.restoreAllMocks()
  Object.defineProperty(window, "location", { configurable: true, value: originalLocation })
  localStorage.clear()
  document.cookie = `${CURRENT_SITE_COOKIE}=; Path=/; Max-Age=0`
})

describe("requestSiteArchive", () => {
  it("posts only the site ID and unchanged password without persisting either", async () => {
    const writes = jest.spyOn(Storage.prototype, "setItem")
    respond({ success: true })

    await expect(requestSiteArchive(siteId, password)).resolves.toBeUndefined()

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith("/api/sites/archive", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId, password }),
    })
    expect(writes).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
  })

  it.each([400, 401, 403, 409, 429, 500])("surfaces the API error for status %i without clearing state", async (status) => {
    persistCurrentSiteCookie(siteId)
    localStorage.setItem("currentSiteId", siteId)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status,
      json: async () => ({ error: "Archive request denied." }),
    } as Response)

    await expect(requestSiteArchive(siteId, password)).rejects.toThrow("Archive request denied.")

    expect(localStorage.getItem("currentSiteId")).toBe(siteId)
    expect(document.cookie).toContain(`${CURRENT_SITE_COOKIE}=${siteId}`)
    expect(replace).not.toHaveBeenCalled()
  })

  it.each([null, {}, [], { success: false }, { success: "true" }, { error: "" }])(
    "requires explicit success for response %j",
    async (body) => {
      respond(body)
      await expect(requestSiteArchive(siteId, password)).rejects.toThrow(fallbackError)
    },
  )

  it("does not accept success on a failed HTTP request", async () => {
    respond({ success: true }, false)
    await expect(requestSiteArchive(siteId, password)).rejects.toThrow(fallbackError)
  })

  it("rejects an error even on a successful HTTP request", async () => {
    respond({ error: "Incorrect password." })
    await expect(requestSiteArchive(siteId, password)).rejects.toThrow("Incorrect password.")
  })

  it("handles non-JSON responses without exposing response content", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => { throw new Error("Internal response details") },
    } as unknown as Response)
    await expect(requestSiteArchive(siteId, password)).rejects.toThrow(fallbackError)
  })

  it("does not log or automatically retry a failed request", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {})
    mockFetch.mockRejectedValueOnce(new Error(`Request body: ${password}`))

    await expect(requestSiteArchive(siteId, password)).rejects.toThrow(fallbackError)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(log).not.toHaveBeenCalled()
  })
})

describe("leaveArchivedSite", () => {
  it("clears active-site state before hard navigation while preserving other sites and auth", () => {
    persistCurrentSiteCookie(siteId)
    localStorage.setItem("currentSiteId", siteId)
    localStorage.setItem(`site_${siteId}_focusMode`, "50")
    localStorage.setItem(`site_${siteId}_focus_mode`, "50")
    localStorage.setItem(`site_${otherSiteId}_focus_mode`, "25")
    localStorage.setItem("sb-test-auth-token", "test-session")
    replace.mockImplementation(() => {
      expect(document.cookie).not.toContain(CURRENT_SITE_COOKIE)
      expect(localStorage.getItem("currentSiteId")).toBeNull()
      expect(localStorage.getItem(`site_${siteId}_focusMode`)).toBeNull()
      expect(localStorage.getItem(`site_${siteId}_focus_mode`)).toBeNull()
    })

    leaveArchivedSite(siteId)

    expect(replace).toHaveBeenCalledWith("/projects")
    expect(localStorage.getItem(`site_${otherSiteId}_focus_mode`)).toBe("25")
    expect(localStorage.getItem("sb-test-auth-token")).toBe("test-session")
  })

  it("still clears the cookie and leaves when localStorage is unavailable", () => {
    persistCurrentSiteCookie(siteId)
    const remove = jest.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("Storage blocked")
    })

    leaveArchivedSite(siteId)

    expect(document.cookie).not.toContain(CURRENT_SITE_COOKIE)
    expect(remove).toHaveBeenCalledTimes(3)
    expect(replace).toHaveBeenCalledWith("/projects")
  })

  it("still clears localStorage and leaves when cookies are unavailable", () => {
    localStorage.setItem("currentSiteId", siteId)
    jest.spyOn(document, "cookie", "set").mockImplementation(() => {
      throw new Error("Cookies blocked")
    })

    leaveArchivedSite(siteId)

    expect(localStorage.getItem("currentSiteId")).toBeNull()
    expect(replace).toHaveBeenCalledWith("/projects")
  })
})