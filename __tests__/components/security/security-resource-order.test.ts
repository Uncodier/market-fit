import {
  isAutomaticApiKey,
  sortApiKeysForDisplay,
  sortAllowedDomainsForDisplay,
} from "@/lib/security-resource-order"

describe("security resource display order", () => {
  it("puts user/legacy keys first and both known automatic issuers last, newest first within each group", () => {
    const keys = [
      { id: "harness-new", created_at: "2026-10-16", metadata: { issued_by: "harness.requirement-provisioning" } },
      { id: "user-old", created_at: "2026-10-01", metadata: { allowed_ips: ["127.0.0.1"] } },
      { id: "platform-old", created_at: "2026-10-10", metadata: { issued_by: "platform-api.ensure-platform-key" } },
      { id: "legacy-new", created_at: "2026-10-15", metadata: null },
    ]
    const input = [...keys]
    expect(sortApiKeysForDisplay(keys).map(key => key.id)).toEqual([
      "legacy-new", "user-old", "harness-new", "platform-old",
    ])
    expect(keys).toEqual(input)
  })

  it("does not infer key provenance from a name, prefix, requirement reference, or unfamiliar issuer", () => {
    expect(isAutomaticApiKey({ metadata: { requirement_id: "requirement" } })).toBe(false)
    expect(isAutomaticApiKey({ metadata: { issued_by: "custom.harness" } })).toBe(false)
    expect(isAutomaticApiKey({ metadata: {} })).toBe(false)
    expect(isAutomaticApiKey({ metadata: null })).toBe(false)
    const keys = [
      { name: "platform-user", prefix: "upk", created_at: "2026-10-01", metadata: null },
      { name: "Integration", prefix: "key", created_at: "2026-10-16", metadata: { issued_by: "harness.requirement-provisioning" } },
    ]
    expect(sortApiKeysForDisplay(keys)[0].name).toBe("platform-user")
  })

  it("puts explicit user domains before unknown history and harness domains last without hostname heuristics", () => {
    const domains = [
      { domain: "preview.example.com", source: "harness" as const, created_at: "2026-10-16" },
      { domain: "old.example.com", source: "user" as const, created_at: "2026-10-01" },
      { domain: "apps-manual.vercel.app", source: "unknown" as const, created_at: "2026-10-15" },
      { domain: "legacy.example.com", created_at: "2026-10-14" },
      { domain: "new.example.com", source: "user" as const, created_at: "2026-10-02" },
      { domain: "preview-old.example.com", source: "harness" as const, created_at: "2026-10-03" },
    ]
    const input = [...domains]
    expect(sortAllowedDomainsForDisplay(domains).map(domain => domain.domain)).toEqual([
      "new.example.com", "old.example.com", "apps-manual.vercel.app", "legacy.example.com",
      "preview.example.com", "preview-old.example.com",
    ])
    expect(domains).toEqual(input)
  })

  it("handles empty lists, invalid timestamps, and preserves ties", () => {
    expect(sortApiKeysForDisplay([])).toEqual([])
    expect(sortAllowedDomainsForDisplay([])).toEqual([])
    const keys = [
      { id: "invalid", created_at: "invalid", metadata: null },
      { id: "first", created_at: "2026-10-16", metadata: null },
      { id: "second", created_at: "2026-10-16", metadata: {} },
    ]
    expect(sortApiKeysForDisplay(keys).map(key => key.id)).toEqual(["first", "second", "invalid"])
  })
})