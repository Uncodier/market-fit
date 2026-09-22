/** @jest-environment node */

import { readFileSync } from "node:fs"
import { join } from "node:path"

const routes = {
  performance: [
    "approved-contents",
    "completed-requirements",
    "contents-approved",
    "conversations",
    "images-generated",
    "leads-contacted",
    "leads-in-conversation",
    "meetings",
    "metrics-overview",
    "requirements-completed",
    "sales",
    "tasks",
    "tokens",
    "video-minutes",
  ],
  traffic: [
    "browsers",
    "client-conversion",
    "devices",
    "lead-conversion",
    "pages",
    "referrals",
    "regions",
    "session-events",
    "session-events-combined",
    "session-events-referrers",
    "session-time",
    "visits",
  ],
} as const

describe("direct analytics cache boundaries", () => {
  it.each(
    Object.entries(routes).flatMap(([group, names]) =>
      names.map((name) => [group, name])
    )
  )("%s/%s authorizes before reading the cache", (group, name) => {
    const source = readFileSync(
      join(process.cwd(), "app", "api", group, name, "route.ts"),
      "utf8"
    )
    const handler = source.slice(source.indexOf("export async function GET"))
    const accessIndex = handler.indexOf("requireAnalyticsAccess(request)")
    const cacheIndex = handler.indexOf("readThroughAnalyticsResponseCache({")

    expect(accessIndex).toBeGreaterThan(-1)
    expect(cacheIndex).toBeGreaterThan(accessIndex)
    expect(handler.slice(accessIndex, cacheIndex)).toContain(
      "if (access.error) return access.error"
    )
    expect(handler.slice(cacheIndex)).toContain("siteId: access.siteId")
  })

  it.each([
    ["performance", "leads-contacted"],
    ["performance", "leads-in-conversation"],
    ["performance", "tokens"],
    ["traffic", "client-conversion"],
    ["traffic", "session-events-combined"],
  ])("%s/%s uses the pagination lock TTL", (group, name) => {
    const source = readFileSync(
      join(process.cwd(), "app", "api", group, name, "route.ts"),
      "utf8"
    )

    expect(source).toContain("lockTtlMs: 30_000")
  })
})
