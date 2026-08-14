import { isRouterPrefetchRequest } from "@/lib/navigation/is-router-prefetch"

describe("isRouterPrefetchRequest", () => {
  it("detects Next router prefetch headers", () => {
    expect(
      isRouterPrefetchRequest({ get: (name) => (name === "next-router-prefetch" ? "1" : null) })
    ).toBe(true)
    expect(
      isRouterPrefetchRequest({ get: (name) => (name === "purpose" ? "prefetch" : null) })
    ).toBe(true)
    expect(
      isRouterPrefetchRequest({ get: (name) => (name === "x-middleware-prefetch" ? "1" : null) })
    ).toBe(true)
  })

  it("ignores ordinary navigations", () => {
    expect(isRouterPrefetchRequest({ get: () => null })).toBe(false)
    expect(
      isRouterPrefetchRequest({ get: (name) => (name === "rsc" ? "1" : null) })
    ).toBe(false)
  })
})
