/** @jest-environment node */
import { readFileSync } from "node:fs"
import path from "node:path"

// Source contract only: database authorization is exercised separately in PostgreSQL.
describe("robot list identity-bound cache contract", () => {
  const source = readFileSync(path.join(process.cwd(), "app/context/RobotsContext.tsx"), "utf8")

  it("disables unauthenticated fetching and keys SWR by site and authenticated actor", () => {
    expect(source).toMatch(/const\s*\{\s*user\s*\}\s*=\s*useAuth\(\)/)
    expect(source).toMatch(/const\s+userId\s*=\s*user\?\.id/)
    expect(source).toMatch(/useSWR\(\s*loadRobots\s*&&\s*isSiteContextReady\s*&&\s*currentSite\?\.id\s*&&\s*userId\s*&&\s*permissionRevision !== null/)
    expect(source).toMatch(/\['remote_instances',\s*currentSite\.id,\s*userId,\s*permissionRevision\]\s*:\s*null/)
    expect(source).toContain('keepPreviousData: false')
  })

  it("binds realtime channels and resubscription dependencies to the actor", () => {
    expect(source).toContain('.channel(`robots_context_${siteId}_${userId}`)')
    expect(source).toMatch(/\[siteId,\s*isSiteContextReady,\s*userId,\s*permissionRevision,/)
  })
})