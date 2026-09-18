import { existsSync } from "node:fs"
import path from "node:path"

describe("workflow webhook route contract", () => {
  it("keeps the documented workflow callback endpoint implemented", () => {
    const routePath = path.join(
      process.cwd(),
      "app/api/workflows/webhook/route.ts"
    )

    expect(existsSync(routePath)).toBe(true)
  })
})
