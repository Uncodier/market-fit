/** @jest-environment node */

import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

describe("retired workflow webhook route contract", () => {
  it("does not restore the retired unauthenticated workflow callback", () => {
    const routePath = path.join(
      process.cwd(),
      "app/api/workflows/webhook/route.ts"
    )

    expect(existsSync(routePath)).toBe(false)
  })

  it("documents authentication and tenant verification before callbacks can return", () => {
    const guide = readFileSync(path.join(process.cwd(), "docs/WORKFLOW_WEBHOOK_INTEGRATION.md"), "utf8")

    expect(guide).toContain("not present in")
    expect(guide).toContain("authenticate the external service")
    expect(guide).toContain("derive or verify tenant and actor scope")
    expect(guide).toContain("replay/idempotency")
  })
})
